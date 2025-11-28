'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize, StockOut, StockOutItem, InventoryBalance, Warehouse, Customer, Product } = require('../models');
const { sendMail } = require('../services/email.service');

const list = async (req, res) => {
  const {
    page = 1,
    limit = 20,
    warehouse_id,
    customer_id,
    status,
    code,
  } = req.query;

  const where = {};
  if (warehouse_id) where.warehouse_id = warehouse_id;
  if (customer_id) where.customer_id = customer_id;
  if (status) where.status = status;
  if (code) where.code = { [Op.like]: `%${code}%` };

  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = Math.max(Number(limit) || 20, 1);
  const offset = (pageNum - 1) * limitNum;

  const { rows, count } = await StockOut.findAndCountAll({
    where,
    include: [Warehouse, Customer],
    order: [['created_at', 'DESC']],
    offset,
    limit: limitNum,
  });

  return res.json({
    data: rows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: count,
      totalPages: Math.ceil(count / limitNum) || 1,
    },
  });
};

const getById = async (req, res) => {
  const item = await StockOut.findByPk(req.params.id, {
    include: [
      Warehouse,
      Customer,
      {
        model: StockOutItem,
        include: [Product],
      },
    ],
  });
  if (!item) return res.status(404).json({ message: 'Stock-out not found' });
  return res.json(item);
};

const create = async (req, res) => {
  const { code, warehouse_id, customer_id, note, receiver_name, receiver_email, items } = req.body;

  if (!code || !warehouse_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'code, warehouse_id và ít nhất 1 item là bắt buộc' });
  }

  const t = await sequelize.transaction();
  try {
    const warehouse = await Warehouse.findByPk(warehouse_id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!warehouse) {
      await t.rollback();
      return res.status(400).json({ message: 'warehouse_id không tồn tại' });
    }

    if (customer_id) {
      const customer = await Customer.findByPk(customer_id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!customer) {
        await t.rollback();
        return res.status(400).json({ message: 'customer_id không tồn tại' });
      }
    }

    const exists = await StockOut.findOne({ where: { code }, transaction: t, lock: t.LOCK.UPDATE });
    if (exists) {
      await t.rollback();
      return res.status(409).json({ message: 'Stock-out code already exists' });
    }

    // Kiểm tra tồn kho cho tất cả item trước khi tạo phiếu
    for (const row of items) {
      const { product_id, quantity } = row;
      if (!product_id || !quantity || Number(quantity) <= 0) {
        await t.rollback();
        return res.status(400).json({ message: 'Mỗi item cần product_id và quantity > 0' });
      }

      const balance = await InventoryBalance.findOne({
        where: { warehouse_id, product_id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      const currentQty = balance ? Number(balance.quantity) : 0;
      if (currentQty < Number(quantity)) {
        await t.rollback();
        return res.status(400).json({ message: 'Tồn kho không đủ để xuất (không được âm)' });
      }
    }

    const stockOut = await StockOut.create(
      {
        code,
        warehouse_id,
        customer_id: customer_id || null,
        note: note || null,
        receiver_name: receiver_name || null,
        receiver_email: receiver_email || null,
        status: 'draft',
        created_by: req.user?.id || null,
      },
      { transaction: t }
    );

    for (const row of items) {
      const { product_id, quantity } = row;

      const product = await Product.findByPk(product_id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!product) {
        await t.rollback();
        return res.status(400).json({ message: `product_id ${product_id} không tồn tại` });
      }

      await StockOutItem.create(
        {
          stock_out_id: stockOut.id,
          product_id,
          quantity,
        },
        { transaction: t }
      );
    }

    await t.commit();

    const result = await StockOut.findByPk(stockOut.id, {
      include: [
        Warehouse,
        Customer,
        { model: StockOutItem, include: [Product] },
      ],
    });

    return res.status(201).json(result);
  } catch (error) {
    await t.rollback();
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ----------------------------------------------------------------------
// Receiver signature flow
// ----------------------------------------------------------------------

const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:3001';

const generateSignToken = () => crypto.randomBytes(32).toString('hex');

const saveSignatureImage = (signatureData) => {
  if (!signatureData || typeof signatureData !== 'string') {
    throw new Error('Invalid signature data');
  }

  const matches = signatureData.match(/^data:(image\/(png|jpeg|jpg));base64,(.+)$/);
  if (!matches) {
    throw new Error('Signature data must be a base64 image data URL');
  }

  const mimeType = matches[1];
  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const base64Data = matches[3];

  const buffer = Buffer.from(base64Data, 'base64');

  const uploadDir = path.join(__dirname, '../../uploads/signatures');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const fileName = `signature_${Date.now()}_${Math.floor(Math.random() * 100000)}.${ext}`;
  const filePath = path.join(uploadDir, fileName);

  fs.writeFileSync(filePath, buffer);

  // Public URL path
  return `/uploads/signatures/${fileName}`;
};

// Gửi email chứa link ký nhận (remote)
const sendReceiveSignLink = async (req, res) => {
  const id = req.params.id;

  try {
    const stockOut = await StockOut.findByPk(id, {
      include: [Warehouse, Customer],
    });

    if (!stockOut) {
      return res.status(404).json({ message: 'Stock-out not found' });
    }

    if (!stockOut.receiver_email) {
      return res.status(400).json({ message: 'receiver_email is required to send sign link' });
    }

    const token = generateSignToken();
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours

    stockOut.receive_sign_token = token;
    stockOut.receive_sign_token_expires_at = expiresAt;
    stockOut.receive_sign_token_used = false;
    await stockOut.save();

    const signUrl = `${FRONTEND_BASE_URL.replace(/\/$/, '')}/receive-sign/${token}`;

    const subject = `Yêu cầu ký nhận phiếu xuất ${stockOut.code}`;
    const html = `
      <p>Xin chào,</p>
      <p>Bạn có một phiếu xuất cần ký nhận: <strong>${stockOut.code}</strong>.</p>
      <p>Vui lòng nhấp vào liên kết sau để xem chi tiết và ký nhận (link có hiệu lực trong 12 giờ, chỉ dùng được 1 lần):</p>
      <p><a href="${signUrl}">${signUrl}</a></p>
      <p>Trân trọng.</p>
    `;

    await sendMail({ to: stockOut.receiver_email, subject, html });

    return res.json({ message: 'Đã gửi link ký nhận cho người nhận' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Lấy thông tin phiếu xuất theo token ký (public, không cần auth)
const getReceiveSignInfo = async (req, res) => {
  const { token } = req.params;

  try {
    const now = new Date();
    const stockOut = await StockOut.findOne({
      where: {
        receive_sign_token: token,
        receive_sign_token_used: false,
        receive_sign_token_expires_at: { [Op.gt]: now },
      },
      include: [
        Warehouse,
        Customer,
        {
          model: StockOutItem,
          include: [Product],
        },
      ],
    });

    if (!stockOut) {
      return res.status(404).json({ message: 'Link ký không hợp lệ hoặc đã hết hạn' });
    }

    return res.json(stockOut);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Ký nhận từ xa bằng token (public)
const receiveSignByToken = async (req, res) => {
  const { token } = req.params;
  const { signatureData, receiverName } = req.body;

  const t = await sequelize.transaction();
  try {
    const now = new Date();
    const stockOut = await StockOut.findOne({
      where: {
        receive_sign_token: token,
        receive_sign_token_used: false,
        receive_sign_token_expires_at: { [Op.gt]: now },
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!stockOut) {
      await t.rollback();
      return res.status(404).json({ message: 'Link ký không hợp lệ hoặc đã hết hạn' });
    }

    if (!signatureData) {
      await t.rollback();
      return res.status(400).json({ message: 'signatureData is required' });
    }

    const signatureUrl = saveSignatureImage(signatureData);

    stockOut.receiver_signature_url = signatureUrl;
    stockOut.receiver_signed_at = new Date();
    stockOut.receiver_signature_type = 'remote';
    if (receiverName) {
      stockOut.receiver_name = receiverName;
    }
    stockOut.receive_sign_token_used = true;

    await stockOut.save({ transaction: t });
    await t.commit();

    return res.json({ message: 'Ký nhận thành công' });
  } catch (error) {
    await t.rollback();
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Ký nhận trực tiếp trong hệ thống (onsite)
const receiveSignOnsite = async (req, res) => {
  const id = req.params.id;
  const { signatureData, receiverName } = req.body;

  const t = await sequelize.transaction();
  try {
    const stockOut = await StockOut.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!stockOut) {
      await t.rollback();
      return res.status(404).json({ message: 'Stock-out not found' });
    }

    if (!signatureData) {
      await t.rollback();
      return res.status(400).json({ message: 'signatureData is required' });
    }

    const signatureUrl = saveSignatureImage(signatureData);

    stockOut.receiver_signature_url = signatureUrl;
    stockOut.receiver_signed_at = new Date();
    stockOut.receiver_signature_type = 'onsite';
    if (receiverName) {
      stockOut.receiver_name = receiverName;
    }

    await stockOut.save({ transaction: t });
    await t.commit();

    return res.json({ message: 'Ký nhận tại chỗ thành công' });
  } catch (error) {
    await t.rollback();
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const permanentRemove = async (req, res) => {
  const id = req.params.id;
  const t = await sequelize.transaction();

  try {
    const stockOut = await StockOut.findByPk(id, {
      include: [StockOutItem],
      paranoid: false,
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!stockOut) {
      await t.rollback();
      return res.status(404).json({ message: 'Stock-out not found' });
    }

    if (!stockOut.deleted_at && !stockOut.deletedAt) {
      await t.rollback();
      return res.status(400).json({ message: 'Cần xoá mềm trước khi xoá vĩnh viễn' });
    }

    const warehouseId = stockOut.warehouse_id;

    // Rollback tồn kho: cộng trả lại số đã xuất
    for (const item of stockOut.StockOutItems) {
      const { product_id, quantity } = item;

      const [balance] = await InventoryBalance.findOrCreate({
        where: { warehouse_id: warehouseId, product_id },
        defaults: { quantity: 0 },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      balance.quantity = Number(balance.quantity) + Number(quantity);
      await balance.save({ transaction: t });
    }

    await StockOutItem.destroy({ where: { stock_out_id: stockOut.id }, transaction: t, force: true, paranoid: false });
    await stockOut.destroy({ transaction: t, force: true });

    await t.commit();
    return res.json({ message: 'Permanently deleted' });
  } catch (error) {
    await t.rollback();
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const update = async (req, res) => {
  const id = req.params.id;
  const { code, warehouse_id, customer_id, note, receiver_name, receiver_email, status, items } = req.body;

  if (!warehouse_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'warehouse_id và ít nhất 1 item là bắt buộc' });
  }

  const t = await sequelize.transaction();
  try {
    const stockOut = await StockOut.findByPk(id, {
      include: [StockOutItem],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!stockOut) {
      await t.rollback();
      return res.status(404).json({ message: 'Stock-out not found' });
    }

    if (stockOut.status !== 'draft') {
      await t.rollback();
      return res.status(400).json({ message: 'Chỉ được sửa phiếu ở trạng thái draft' });
    }

    if (code && code !== stockOut.code) {
      const exists = await StockOut.findOne({ where: { code }, transaction: t, lock: t.LOCK.UPDATE });
      if (exists) {
        await t.rollback();
        return res.status(409).json({ message: 'Stock-out code already exists' });
      }
    }

    const warehouse = await Warehouse.findByPk(warehouse_id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!warehouse) {
      await t.rollback();
      return res.status(400).json({ message: 'warehouse_id không tồn tại' });
    }

    if (customer_id) {
      const customer = await Customer.findByPk(customer_id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!customer) {
        await t.rollback();
        return res.status(400).json({ message: 'customer_id không tồn tại' });
      }
    }

    // Kiểm tra tồn kho cho items mới trước khi ghi lại
    for (const row of items) {
      const { product_id, quantity } = row;
      if (!product_id || !quantity || Number(quantity) <= 0) {
        await t.rollback();
        return res.status(400).json({ message: 'Mỗi item cần product_id và quantity > 0' });
      }

      const balance = await InventoryBalance.findOne({
        where: { warehouse_id, product_id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      const currentQty = balance ? Number(balance.quantity) : 0;
      if (currentQty < Number(quantity)) {
        await t.rollback();
        return res.status(400).json({ message: 'Tồn kho không đủ để xuất (không được âm)' });
      }
    }

    await StockOutItem.destroy({ where: { stock_out_id: stockOut.id }, transaction: t });

    stockOut.code = code ?? stockOut.code;
    stockOut.warehouse_id = warehouse_id;
    stockOut.customer_id = customer_id ?? null;
    stockOut.note = note ?? null;
    stockOut.receiver_name = receiver_name ?? stockOut.receiver_name;
    stockOut.receiver_email = receiver_email ?? stockOut.receiver_email;
    await stockOut.save({ transaction: t });

    for (const row of items) {
      const { product_id, quantity } = row;

      const product = await Product.findByPk(product_id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!product) {
        await t.rollback();
        return res.status(400).json({ message: `product_id ${product_id} không tồn tại` });
      }

      await StockOutItem.create(
        {
          stock_out_id: stockOut.id,
          product_id,
          quantity,
        },
        { transaction: t }
      );
    }

    await t.commit();

    const result = await StockOut.findByPk(stockOut.id, {
      include: [
        Warehouse,
        Customer,
        { model: StockOutItem, include: [Product] },
      ],
    });

    return res.json(result);
  } catch (error) {
    await t.rollback();
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const remove = async (req, res) => {
  const id = req.params.id;
  const t = await sequelize.transaction();

  try {
    const stockOut = await StockOut.findByPk(id, {
      include: [StockOutItem],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!stockOut) {
      await t.rollback();
      return res.status(404).json({ message: 'Stock-out not found' });
    }

    if (stockOut.status === 'draft') {
      // Draft: xoá hẳn không ảnh hưởng tồn kho
      await StockOutItem.destroy({ where: { stock_out_id: stockOut.id }, transaction: t, force: true });
      await stockOut.destroy({ transaction: t, force: true });
    } else {
      // Confirmed/cancelled: xoá mềm, không rollback tồn
      await StockOutItem.destroy({ where: { stock_out_id: stockOut.id }, transaction: t });
      await stockOut.destroy({ transaction: t });
    }

    await t.commit();
    return res.json({ message: 'Deleted' });
  } catch (error) {
    await t.rollback();
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const confirm = async (req, res) => {
  const id = req.params.id;
  const t = await sequelize.transaction();

  try {
    const stockOut = await StockOut.findByPk(id, {
      include: [StockOutItem],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!stockOut) {
      await t.rollback();
      return res.status(404).json({ message: 'Stock-out not found' });
    }

    if (stockOut.status === 'confirmed') {
      await t.rollback();
      return res.status(400).json({ message: 'Phiếu đã ở trạng thái confirmed' });
    }
    if (stockOut.status === 'cancelled') {
      await t.rollback();
      return res.status(400).json({ message: 'Không thể confirm phiếu đã cancelled' });
    }

    const warehouseId = stockOut.warehouse_id;

    for (const item of stockOut.StockOutItems) {
      const { product_id, quantity } = item;

      const balance = await InventoryBalance.findOne({
        where: { warehouse_id: warehouseId, product_id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      const currentQty = balance ? Number(balance.quantity) : 0;
      const newQty = currentQty - Number(quantity);
      if (newQty < 0) {
        await t.rollback();
        return res.status(400).json({ message: 'Tồn kho không đủ để xuất (không được âm)' });
      }

      if (balance) {
        balance.quantity = newQty;
        await balance.save({ transaction: t });
      }
    }

    stockOut.status = 'confirmed';
    await stockOut.save({ transaction: t });

    await t.commit();

    const result = await StockOut.findByPk(stockOut.id, {
      include: [
        Warehouse,
        Customer,
        { model: StockOutItem, include: [Product] },
      ],
    });

    return res.json(result);
  } catch (error) {
    await t.rollback();
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  confirm,
  sendReceiveSignLink,
  getReceiveSignInfo,
  receiveSignByToken,
  receiveSignOnsite,
  permanentRemove,
};
