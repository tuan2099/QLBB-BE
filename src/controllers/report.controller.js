'use strict';

const { Op, fn, col, literal } = require('sequelize');
const {
  sequelize,
  StockIn,
  StockInItem,
  StockOut,
  StockOutItem,
  StockTransfer,
  StockTransferItem,
  Warehouse,
  Product,
  InventoryBalance,
} = require('../models');

const getPeriodRange = (type, year, month, quarter) => {
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
};

// ----------------------------------------------------------------------
// Tổng nhập theo kỳ (chỉ phiếu confirmed)
// ----------------------------------------------------------------------

const stockInSummary = async (req, res) => {
  const { type = 'month', year, warehouse_id } = req.query;

  try {
    const y = Number(year);
    if (!y) {
      return res.status(400).json({ message: 'year is required' });
    }

    const results = [];

    if (type === 'year') {
      for (let m = 1; m <= 12; m += 1) {
        const { start, end } = getPeriodRange('month', y, m);

        const where = {
          status: 'confirmed',
          created_at: { [Op.between]: [start, end] },
        };
        if (warehouse_id) {
          where.warehouse_id = warehouse_id;
        }

        const stockIns = await StockIn.findAll({
          where,
          attributes: ['id'],
        });

        if (!stockIns.length) {
          results.push({ period: `${y}-${String(m).padStart(2, '0')}`, totalOrders: 0, totalQuantity: 0 });
          continue;
        }

        const ids = stockIns.map((s) => s.id);

        const rows = await StockInItem.findAll({
          where: { stock_in_id: ids },
          attributes: [[fn('SUM', col('quantity')), 'totalQuantity']],
          raw: true,
        });

        const totalQuantity = Number(rows[0]?.totalQuantity || 0);

        results.push({
          period: `${y}-${String(m).padStart(2, '0')}`,
          totalOrders: stockIns.length,
          totalQuantity,
        });
      }
    } else if (type === 'quarter') {
      for (let q = 1; q <= 4; q += 1) {
        const { start, end } = getPeriodRange('quarter', y, undefined, q);

        const where = {
          status: 'confirmed',
          created_at: { [Op.between]: [start, end] },
        };
        if (warehouse_id) {
          where.warehouse_id = warehouse_id;
        }

        const stockIns = await StockIn.findAll({ where, attributes: ['id'] });

        if (!stockIns.length) {
          results.push({ period: `Q${q}-${y}`, totalOrders: 0, totalQuantity: 0 });
          continue;
        }

        const ids = stockIns.map((s) => s.id);

        const rows = await StockInItem.findAll({
          where: { stock_in_id: ids },
          attributes: [[fn('SUM', col('quantity')), 'totalQuantity']],
          raw: true,
        });

        const totalQuantity = Number(rows[0]?.totalQuantity || 0);

        results.push({ period: `Q${q}-${y}`, totalOrders: stockIns.length, totalQuantity });
      }
    } else if (type === 'month') {
      const { start, end } = getPeriodRange('month', y, req.query.month);
      const where = {
        status: 'confirmed',
        created_at: { [Op.between]: [start, end] },
      };
      if (warehouse_id) {
        where.warehouse_id = warehouse_id;
      }

      const stockIns = await StockIn.findAll({ where, attributes: ['id'] });
      let totalQuantity = 0;
      if (stockIns.length) {
        const ids = stockIns.map((s) => s.id);
        const rows = await StockInItem.findAll({
          where: { stock_in_id: ids },
          attributes: [[fn('SUM', col('quantity')), 'totalQuantity']],
          raw: true,
        });
        totalQuantity = Number(rows[0]?.totalQuantity || 0);
      }

      results.push({
        period: `${y}-${String(req.query.month).padStart(2, '0')}`,
        totalOrders: stockIns.length,
        totalQuantity,
      });
    } else {
      return res.status(400).json({ message: 'type must be month, quarter or year' });
    }

    return res.json({ data: results });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('stockInSummary error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ----------------------------------------------------------------------
// Tổng xuất theo kỳ (chỉ phiếu confirmed)
// ----------------------------------------------------------------------

const stockOutSummary = async (req, res) => {
  const { type = 'month', year, warehouse_id } = req.query;

  try {
    const y = Number(year);
    if (!y) {
      return res.status(400).json({ message: 'year is required' });
    }

    const results = [];

    const build = async (rangeType, labelBuilder, extra) => {
      const { start, end } = rangeType;
      const where = {
        status: 'confirmed',
        created_at: { [Op.between]: [start, end] },
      };
      if (warehouse_id) {
        where.warehouse_id = warehouse_id;
      }

      const stockOuts = await StockOut.findAll({ where, attributes: ['id'] });
      let totalQuantity = 0;
      if (stockOuts.length) {
        const ids = stockOuts.map((s) => s.id);
        const rows = await StockOutItem.findAll({
          where: { stock_out_id: ids },
          attributes: [[fn('SUM', col('quantity')), 'totalQuantity']],
          raw: true,
        });
        totalQuantity = Number(rows[0]?.totalQuantity || 0);
      }

      results.push({ period: labelBuilder(), totalOrders: stockOuts.length, totalQuantity, ...extra });
    };

    if (type === 'year') {
      for (let m = 1; m <= 12; m += 1) {
        const range = getPeriodRange('month', y, m);
        // eslint-disable-next-line no-await-in-loop
        await build(range, () => `${y}-${String(m).padStart(2, '0')}`);
      }
    } else if (type === 'quarter') {
      for (let q = 1; q <= 4; q += 1) {
        const range = getPeriodRange('quarter', y, undefined, q);
        // eslint-disable-next-line no-await-in-loop
        await build(range, () => `Q${q}-${y}`);
      }
    } else if (type === 'month') {
      const range = getPeriodRange('month', y, req.query.month);
      await build(range, () => `${y}-${String(req.query.month).padStart(2, '0')}`);
    } else {
      return res.status(400).json({ message: 'type must be month, quarter or year' });
    }

    return res.json({ data: results });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('stockOutSummary error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ----------------------------------------------------------------------
// Tổng chuyển kho theo kỳ (chỉ phiếu confirmed)
// ----------------------------------------------------------------------

const stockTransferSummary = async (req, res) => {
  const { type = 'month', year, from_warehouse_id, to_warehouse_id } = req.query;

  try {
    const y = Number(year);
    if (!y) {
      return res.status(400).json({ message: 'year is required' });
    }

    const results = [];

    const build = async (rangeType, labelBuilder) => {
      const { start, end } = rangeType;
      const where = {
        status: 'confirmed',
        created_at: { [Op.between]: [start, end] },
      };
      if (from_warehouse_id) {
        where.from_warehouse_id = from_warehouse_id;
      }
      if (to_warehouse_id) {
        where.to_warehouse_id = to_warehouse_id;
      }

      const transfers = await StockTransfer.findAll({ where, attributes: ['id'] });
      let totalQuantity = 0;
      if (transfers.length) {
        const ids = transfers.map((s) => s.id);
        const rows = await StockTransferItem.findAll({
          where: { stock_transfer_id: ids },
          attributes: [[fn('SUM', col('quantity')), 'totalQuantity']],
          raw: true,
        });
        totalQuantity = Number(rows[0]?.totalQuantity || 0);
      }

      results.push({ period: labelBuilder(), totalTransfers: transfers.length, totalQuantity });
    };

    if (type === 'year') {
      for (let m = 1; m <= 12; m += 1) {
        const range = getPeriodRange('month', y, m);
        // eslint-disable-next-line no-await-in-loop
        await build(range, () => `${y}-${String(m).padStart(2, '0')}`);
      }
    } else if (type === 'quarter') {
      for (let q = 1; q <= 4; q += 1) {
        const range = getPeriodRange('quarter', y, undefined, q);
        // eslint-disable-next-line no-await-in-loop
        await build(range, () => `Q${q}-${y}`);
      }
    } else if (type === 'month') {
      const range = getPeriodRange('month', y, req.query.month);
      await build(range, () => `${y}-${String(req.query.month).padStart(2, '0')}`);
    } else {
      return res.status(400).json({ message: 'type must be month, quarter or year' });
    }

    return res.json({ data: results });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('stockTransferSummary error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ----------------------------------------------------------------------
// Báo cáo tồn cuối kỳ (theo kho + sản phẩm)
// Lấy trực tiếp từ bảng inventory_balances (tồn hiện tại),
// nhằm khớp với số liệu snapshot tồn kho.
// Các tham số kỳ (type/year/month/quarter) chỉ dùng để trả về thông tin period,
// không ảnh hưởng tới phép tính.
// ----------------------------------------------------------------------

const stockBalancePeriod = async (req, res) => {
  const { type = 'month', year, month, quarter, warehouse_id, product_id } = req.query;

  try {
    const where = {};
    if (warehouse_id) {
      where.warehouse_id = warehouse_id;
    }
    if (product_id) {
      where.product_id = product_id;
    }
    // Bỏ các dòng tồn = 0 cho gọn báo cáo
    where.quantity = { [Op.ne]: 0 };

    const rows = await InventoryBalance.findAll({
      where,
      attributes: ['warehouse_id', 'product_id', 'quantity'],
      include: [
        { model: Warehouse, attributes: ['id', 'name', 'code'] },
        { model: Product, attributes: ['id', 'name', 'sku'] },
      ],
      order: [
        ['warehouse_id', 'ASC'],
        ['product_id', 'ASC'],
      ],
    });

    const data = rows.map((row) => ({
      warehouse_id: row.warehouse_id,
      warehouse_name: row.Warehouse?.name || null,
      warehouse_code: row.Warehouse?.code || null,
      product_id: row.product_id,
      product_name: row.Product?.name || null,
      product_sku: row.Product?.sku || null,
      ending_quantity: Number(row.quantity || 0),
    }));

    return res.json({
      period: {
        type,
        year: year ? Number(year) : undefined,
        month: month ? Number(month) : undefined,
        quarter: quarter ? Number(quarter) : undefined,
      },
      data,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('stockBalancePeriod error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  stockInSummary,
  stockOutSummary,
  stockTransferSummary,
  stockBalancePeriod,
};
