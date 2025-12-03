'use strict';

const cron = require('node-cron');
const { Op, fn, col } = require('sequelize');
const {
  Setting,
  StockIn,
  StockInItem,
  StockOut,
  StockOutItem,
  StockTransfer,
  StockTransferItem,
  Product,
  InventoryBalance,
} = require('../models');
const { sendMail } = require('../services/email.service');

function getPeriodRange(type, year, month, quarter) {
  const y = Number(year);
  if (!y) {
    throw new Error('year is required');
  }

  let start;
  let end;

  if (type === 'month') {
    const m = Number(month);
    if (!m || m < 1 || m > 12) {
      throw new Error('month is required and must be 1-12');
    }
    start = new Date(y, m - 1, 1, 0, 0, 0);
    end = new Date(y, m, 0, 23, 59, 59);
  } else if (type === 'quarter') {
    const q = Number(quarter);
    if (!q || q < 1 || q > 4) {
      throw new Error('quarter is required and must be 1-4');
    }
    const startMonth = (q - 1) * 3;
    const endMonth = startMonth + 2;
    start = new Date(y, startMonth, 1, 0, 0, 0);
    end = new Date(y, endMonth + 1, 0, 23, 59, 59);
  } else if (type === 'year') {
    start = new Date(y, 0, 1, 0, 0, 0);
    end = new Date(y, 11, 31, 23, 59, 59);
  } else {
    throw new Error('type must be month, quarter or year');
  }

  return { start, end };
}

async function getRecipients() {
  const row = await Setting.findOne({ where: { key: 'report_recipients' } });
  if (!row || !row.value) return [];

  return row.value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => !!v);
}

async function buildStockInSummary(start, end) {
  const where = {
    status: 'confirmed',
    created_at: { [Op.between]: [start, end] },
  };

  const stockIns = await StockIn.findAll({ where, attributes: ['id'], raw: true });
  if (!stockIns.length) {
    return { totalOrders: 0, totalQuantity: 0 };
  }

  const ids = stockIns.map((s) => s.id);
  const rows = await StockInItem.findAll({
    where: { stock_in_id: ids },
    attributes: [[fn('SUM', col('quantity')), 'totalQuantity']],
    raw: true,
  });

  const totalQuantity = Number(rows[0]?.totalQuantity || 0);

  return {
    totalOrders: stockIns.length,
    totalQuantity,
  };
}

async function buildStockOutSummary(start, end) {
  const where = {
    status: 'confirmed',
    created_at: { [Op.between]: [start, end] },
  };

  const stockOuts = await StockOut.findAll({ where, attributes: ['id'], raw: true });
  if (!stockOuts.length) {
    return { totalOrders: 0, totalQuantity: 0 };
  }

  const ids = stockOuts.map((s) => s.id);
  const rows = await StockOutItem.findAll({
    where: { stock_out_id: ids },
    attributes: [[fn('SUM', col('quantity')), 'totalQuantity']],
    raw: true,
  });

  const totalQuantity = Number(rows[0]?.totalQuantity || 0);

  return {
    totalOrders: stockOuts.length,
    totalQuantity,
  };
}

async function buildStockTransferSummary(start, end) {
  const where = {
    status: 'confirmed',
    created_at: { [Op.between]: [start, end] },
  };

  const transfers = await StockTransfer.findAll({ where, attributes: ['id'], raw: true });
  if (!transfers.length) {
    return { totalOrders: 0, totalQuantity: 0 };
  }

  const ids = transfers.map((t) => t.id);
  const rows = await StockTransferItem.findAll({
    where: { stock_transfer_id: ids },
    attributes: [[fn('SUM', col('quantity')), 'totalQuantity']],
    raw: true,
  });

  const totalQuantity = Number(rows[0]?.totalQuantity || 0);

  return {
    totalOrders: transfers.length,
    totalQuantity,
  };
}

async function buildStockBalanceSummary(end) {
  const whereIn = {
    status: 'confirmed',
    created_at: { [Op.lte]: end },
  };

  const whereOut = {
    status: 'confirmed',
    created_at: { [Op.lte]: end },
  };

  const stockIns = await StockIn.findAll({ where: whereIn, attributes: ['id', 'warehouse_id'], raw: true });
  const inMap = new Map();
  if (stockIns.length) {
    const inIds = stockIns.map((s) => s.id);
    const inRows = await StockInItem.findAll({
      where: { stock_in_id: inIds },
      attributes: ['stock_in_id', 'product_id', [fn('SUM', col('quantity')), 'qty']],
      group: ['stock_in_id', 'product_id'],
      raw: true,
    });

    inRows.forEach((row) => {
      const si = stockIns.find((s) => s.id === row.stock_in_id);
      if (!si) return;
      const key = `${si.warehouse_id}_${row.product_id}`;
      const prev = inMap.get(key) || 0;
      inMap.set(key, prev + Number(row.qty || 0));
    });
  }

  const stockOuts = await StockOut.findAll({ where: whereOut, attributes: ['id', 'warehouse_id'], raw: true });
  const outMap = new Map();
  if (stockOuts.length) {
    const outIds = stockOuts.map((s) => s.id);
    const outRows = await StockOutItem.findAll({
      where: { stock_out_id: outIds },
      attributes: ['stock_out_id', 'product_id', [fn('SUM', col('quantity')), 'qty']],
      group: ['stock_out_id', 'product_id'],
      raw: true,
    });

    outRows.forEach((row) => {
      const so = stockOuts.find((s) => s.id === row.stock_out_id);
      if (!so) return;
      const key = `${so.warehouse_id}_${row.product_id}`;
      const prev = outMap.get(key) || 0;
      outMap.set(key, prev + Number(row.qty || 0));
    });
  }

  const transferWhere = {
    status: 'confirmed',
    created_at: { [Op.lte]: end },
  };

  const transfers = await StockTransfer.findAll({
    where: transferWhere,
    attributes: ['id', 'from_warehouse_id', 'to_warehouse_id'],
    raw: true,
  });

  const transferOutMap = new Map();
  const transferInMap = new Map();

  if (transfers.length) {
    const trIds = transfers.map((t) => t.id);
    const trRows = await StockTransferItem.findAll({
      where: { stock_transfer_id: trIds },
      attributes: ['stock_transfer_id', 'product_id', [fn('SUM', col('quantity')), 'qty']],
      group: ['stock_transfer_id', 'product_id'],
      raw: true,
    });

    trRows.forEach((row) => {
      const tr = transfers.find((t) => t.id === row.stock_transfer_id);
      if (!tr) return;
      const qty = Number(row.qty || 0);

      const outKey = `${tr.from_warehouse_id}_${row.product_id}`;
      transferOutMap.set(outKey, (transferOutMap.get(outKey) || 0) + qty);

      const inKey = `${tr.to_warehouse_id}_${row.product_id}`;
      transferInMap.set(inKey, (transferInMap.get(inKey) || 0) + qty);
    });
  }

  const allKeys = new Set([
    ...inMap.keys(),
    ...outMap.keys(),
    ...transferOutMap.keys(),
    ...transferInMap.keys(),
  ]);

  let totalProducts = 0;
  let totalQuantity = 0;

  for (const key of allKeys) {
    const inQty = inMap.get(key) || 0;
    const outQty = outMap.get(key) || 0;
    const trOut = transferOutMap.get(key) || 0;
    const trIn = transferInMap.get(key) || 0;

    const endingQty = inQty - outQty - trOut + trIn;
    if (endingQty === 0) continue;

    totalProducts += 1;
    totalQuantity += endingQty;
  }

  return {
    totalProducts,
    totalQuantity,
  };
}

async function buildLowStockItems() {
	// Lấy tổng tồn hiện tại theo sản phẩm (cộng tất cả kho)
	const rows = await InventoryBalance.findAll({
		attributes: ['product_id', [fn('SUM', col('quantity')), 'totalQuantity']],
		include: [
			{
				model: Product,
				attributes: ['id', 'sku', 'name', 'unit', 'min_quantity', 'max_quantity'],
			},
		],
		group: ['product_id', 'Product.id'],
		raw: false,
	});

	const result = [];

	rows.forEach((row) => {
		const product = row.Product;
		if (!product) return;

		const minQty = product.min_quantity != null ? Number(product.min_quantity) : null;
		if (minQty == null || Number.isNaN(minQty) || minQty <= 0) return;

		const totalQty = Number(row.get('totalQuantity') || 0);
		if (totalQty >= minQty) return;

		result.push({
			productId: product.id,
			sku: product.sku,
			name: product.name,
			unit: product.unit,
			minQuantity: minQty,
			currentQuantity: totalQty,
		});
	});

	return result;
}

function formatNumber(num) {
  return Number(num || 0).toLocaleString('vi-VN');
}

async function sendInventoryReportEmail({ type, year, month, quarter }) {
  const recipients = await getRecipients();
  if (!recipients.length) {
    return;
  }

  const { start, end } = getPeriodRange(type, year, month, quarter);

  const [inSummary, outSummary, transferSummary, balanceSummary] = await Promise.all([
    buildStockInSummary(start, end),
    buildStockOutSummary(start, end),
    buildStockTransferSummary(start, end),
    buildStockBalanceSummary(end),
  ]);

  let periodLabel = '';
  if (type === 'month') {
    periodLabel = `Tháng ${month}/${year}`;
  } else if (type === 'quarter') {
    periodLabel = `Quý ${quarter}/${year}`;
  } else if (type === 'year') {
    periodLabel = `Năm ${year}`;
  }

  const subject = `[Inventory] Báo cáo tồn kho ${periodLabel}`;

  const html = `
    <h2 style="font-family: Arial, sans-serif; margin-bottom: 8px;">Báo cáo tồn kho ${periodLabel}</h2>
    <p style="font-family: Arial, sans-serif; margin-top: 0;">Email tự động gửi lúc 7h sáng. Dữ liệu chỉ tính các chứng từ đã xác nhận (confirmed).</p>

    <h3 style="font-family: Arial, sans-serif; margin-top: 24px;">1. Tổng nhập</h3>
    <table cellpadding="6" cellspacing="0" border="1" style="border-collapse: collapse; font-family: Arial, sans-serif; min-width: 320px;">
      <thead style="background-color: #f4f6f8;">
        <tr>
          <th align="left">Chỉ tiêu</th>
          <th align="right">Giá trị</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Số phiếu nhập</td>
          <td align="right">${formatNumber(inSummary.totalOrders)}</td>
        </tr>
        <tr>
          <td>Tổng số lượng nhập</td>
          <td align="right">${formatNumber(inSummary.totalQuantity)}</td>
        </tr>
      </tbody>
    </table>

    <h3 style="font-family: Arial, sans-serif; margin-top: 24px;">2. Tổng xuất</h3>
    <table cellpadding="6" cellspacing="0" border="1" style="border-collapse: collapse; font-family: Arial, sans-serif; min-width: 320px;">
      <thead style="background-color: #f4f6f8;">
        <tr>
          <th align="left">Chỉ tiêu</th>
          <th align="right">Giá trị</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Số phiếu xuất</td>
          <td align="right">${formatNumber(outSummary.totalOrders)}</td>
        </tr>
        <tr>
          <td>Tổng số lượng xuất</td>
          <td align="right">${formatNumber(outSummary.totalQuantity)}</td>
        </tr>
      </tbody>
    </table>

    <h3 style="font-family: Arial, sans-serif; margin-top: 24px;">3. Tổng chuyển kho</h3>
    <table cellpadding="6" cellspacing="0" border="1" style="border-collapse: collapse; font-family: Arial, sans-serif; min-width: 320px;">
      <thead style="background-color: #f4f6f8;">
        <tr>
          <th align="left">Chỉ tiêu</th>
          <th align="right">Giá trị</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Số phiếu chuyển</td>
          <td align="right">${formatNumber(transferSummary.totalOrders)}</td>
        </tr>
        <tr>
          <td>Tổng số lượng chuyển</td>
          <td align="right">${formatNumber(transferSummary.totalQuantity)}</td>
        </tr>
      </tbody>
    </table>

    <h3 style="font-family: Arial, sans-serif; margin-top: 24px;">4. Tồn cuối kỳ (tổng tất cả kho)</h3>
    <table cellpadding="6" cellspacing="0" border="1" style="border-collapse: collapse; font-family: Arial, sans-serif; min-width: 320px;">
      <thead style="background-color: #f4f6f8;">
        <tr>
          <th align="left">Chỉ tiêu</th>
          <th align="right">Giá trị</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Số sản phẩm còn tồn</td>
          <td align="right">${formatNumber(balanceSummary.totalProducts)}</td>
        </tr>
        <tr>
          <td>Tổng số lượng tồn</td>
          <td align="right">${formatNumber(balanceSummary.totalQuantity)}</td>
        </tr>
      </tbody>
    </table>

    <p style="font-family: Arial, sans-serif; margin-top: 24px;">Chi tiết xem thêm trong hệ thống ở mục <strong>Báo cáo</strong>.</p>
  `;

  await sendMail({ to: recipients.join(','), subject, html });
}

async function sendLowStockAlertEmail() {
	const recipients = await getRecipients();
	if (!recipients.length) {
		return;
	}

	const items = await buildLowStockItems();
	if (!items.length) {
		return;
	}

	const subject = '[Inventory] Cảnh báo tồn kho dưới mức tối thiểu';

	const rowsHtml = items
		.map(
			(item) => `
		<tr>
			<td>${item.sku}</td>
			<td>${item.name}</td>
			<td align="right">${formatNumber(item.minQuantity)}</td>
			<td align="right">${formatNumber(item.currentQuantity)}</td>
			<td align="right">${formatNumber(item.currentQuantity - item.minQuantity)}</td>
			<td>${item.unit || ''}</td>
		</tr>`
		)
		.join('');

	const html = `
		<h2 style="font-family: Arial, sans-serif; margin-bottom: 8px;">Cảnh báo tồn kho dưới mức tối thiểu</h2>
		<p style="font-family: Arial, sans-serif; margin-top: 0;">Danh sách các sản phẩm có tồn hiện tại nhỏ hơn tồn tối thiểu (cộng tất cả kho).</p>
		<table cellpadding="6" cellspacing="0" border="1" style="border-collapse: collapse; font-family: Arial, sans-serif; min-width: 480px;">
			<thead style="background-color: #f4f6f8;">
				<tr>
					<th align="left">Mã SP</th>
					<th align="left">Tên sản phẩm</th>
					<th align="right">Tồn tối thiểu</th>
					<th align="right">Tồn hiện tại</th>
					<th align="right">Chênh lệch</th>
					<th align="left">Đơn vị</th>
				</tr>
			</thead>
			<tbody>
				${rowsHtml}
			</tbody>
		</table>
		<p style="font-family: Arial, sans-serif; margin-top: 24px;">Vui lòng xem xét nhập thêm hàng cho các sản phẩm trên.</p>
	`;

	await sendMail({ to: recipients.join(','), subject, html });
}

function scheduleInventoryReports() {
  // Báo cáo tháng: 7h sáng ngày 1 hàng tháng -> cho tháng trước
  cron.schedule('0 7 1 * *', async () => {
    try {
      const now = new Date();
      let year = now.getFullYear();
      let month = now.getMonth();
      if (month === 0) {
        year -= 1;
        month = 12;
      }

      await sendInventoryReportEmail({ type: 'month', year, month });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Monthly inventory report job error', error);
    }
  });

  // Báo cáo quý: 7h sáng ngày 1 các tháng 1,4,7,10 -> cho quý trước
  cron.schedule('0 7 1 1,4,7,10 *', async () => {
    try {
      const now = new Date();
      let year = now.getFullYear();
      const month = now.getMonth() + 1;
      let quarter;

      if (month === 1) {
        year -= 1;
        quarter = 4;
      } else if (month === 4) {
        quarter = 1;
      } else if (month === 7) {
        quarter = 2;
      } else {
        quarter = 3;
      }

      await sendInventoryReportEmail({ type: 'quarter', year, quarter });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Quarterly inventory report job error', error);
    }
  });

  // Báo cáo năm: 7h sáng ngày 1/1 -> cho năm trước
  cron.schedule('0 7 1 1 *', async () => {
    try {
      const now = new Date();
      const year = now.getFullYear() - 1;
      await sendInventoryReportEmail({ type: 'year', year });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Yearly inventory report job error', error);
    }
  });

	// Cảnh báo tồn tối thiểu: 7h10 sáng mỗi ngày
	cron.schedule('10 7 * * *', async () => {
		try {
			await sendLowStockAlertEmail();
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error('Low stock alert job error', error);
		}
	});
}

module.exports = {
  scheduleInventoryReports,
  sendInventoryReportEmail,
  sendLowStockAlertEmail,
};
