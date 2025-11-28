'use strict';
const { Op } = require('sequelize');
const { sequelize, StockTransfer, StockTransferItem, InventoryBalance, Warehouse, Product } = require('../models');

const list = async (req, res) => {
  const {
    page = 1,
    limit = 20,
    from_warehouse_id,
    to_warehouse_id,
    status,
    code,
  } = req.query;

  const where = {};
  if (from_warehouse_id) where.from_warehouse_id = from_warehouse_id;
  if (to_warehouse_id) where.to_warehouse_id = to_warehouse_id;
  if (status) where.status = status;
  if (code) where.code = { [Op.like]: `%${code}%` };

  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = Math.max(Number(limit) || 20, 1);
  const offset = (pageNum - 1) * limitNum;

  const { rows, count } = await StockTransfer.findAndCountAll({
    where,
    include: [
      { model: Warehouse, as: 'FromWarehouse' },
      { model: Warehouse, as: 'ToWarehouse' },
    ],
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
  const item = await StockTransfer.findByPk(req.params.id, {
    include: [
      { model: Warehouse, as: 'FromWarehouse' },
      { model: Warehouse, as: 'ToWarehouse' },
      {
        model: StockTransferItem,
        include: [Product],
      },
    ],
  });
  if (!item) return res.status(404).json({ message: 'Stock-transfer not found' });
  return res.json(item);
};

const create = async (req, res) => {
  const { code, from_warehouse_id, to_warehouse_id, note, status, items } = req.body;

  if (!code || !from_warehouse_id || !to_warehouse_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'code, from_warehouse_id, to_warehouse_id và ít nhất 1 item là bắt buộc' });
  }
  if (from_warehouse_id === to_warehouse_id) {
    return res.status(400).json({ message: 'Kho nguồn và kho đích phải khác nhau' });
  }

  const t = await sequelize.transaction();
  try {
    const fromWh = await Warehouse.findByPk(from_warehouse_id, { transaction: t, lock: t.LOCK.UPDATE });
    const toWh = await Warehouse.findByPk(to_warehouse_id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!fromWh || !toWh) {
      await t.rollback();
      return res.status(400).json({ message: 'from_warehouse_id hoặc to_warehouse_id không tồn tại' });
    }

    const exists = await StockTransfer.findOne({ where: { code }, transaction: t, lock: t.LOCK.UPDATE });
    if (exists) {
      await t.rollback();
      return res.status(409).json({ message: 'Stock-transfer code already exists' });
    }

    const transfer = await StockTransfer.create(
      {
        code,
        from_warehouse_id,
        to_warehouse_id,
        note: note || null,
        status: status || 'draft',
        created_by: req.user?.id || null,
      },
      { transaction: t }
    );

    for (const row of items) {
      const { product_id, quantity } = row;
      if (!product_id || !quantity || Number(quantity) <= 0) {
        await t.rollback();
        return res.status(400).json({ message: 'Mỗi item cần product_id và quantity > 0' });
      }

      const product = await Product.findByPk(product_id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!product) {
        await t.rollback();
        return res.status(400).json({ message: `product_id ${product_id} không tồn tại` });
      }

      await StockTransferItem.create(
        {
          stock_transfer_id: transfer.id,
          product_id,
          quantity,
        },
        { transaction: t }
      );
    }

    await t.commit();

    const result = await StockTransfer.findByPk(transfer.id, {
      include: [
        { model: Warehouse, as: 'FromWarehouse' },
        { model: Warehouse, as: 'ToWarehouse' },
        { model: StockTransferItem, include: [Product] },
      ],
    });

    return res.status(201).json(result);
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
    const transfer = await StockTransfer.findByPk(id, {
      include: [StockTransferItem],
      paranoid: false,
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!transfer) {
      await t.rollback();
      return res.status(404).json({ message: 'Stock-transfer not found' });
    }

    if (!transfer.deleted_at && !transfer.deletedAt) {
      await t.rollback();
      return res.status(400).json({ message: 'Cần xoá mềm trước khi xoá vĩnh viễn' });
    }

    const fromId = transfer.from_warehouse_id;
    const toId = transfer.to_warehouse_id;

    for (const item of transfer.StockTransferItems) {
      const { product_id, quantity } = item;

      const [fromBalance] = await InventoryBalance.findOrCreate({
        where: { warehouse_id: fromId, product_id },
        defaults: { quantity: 0 },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      fromBalance.quantity = Number(fromBalance.quantity) + Number(quantity);
      await fromBalance.save({ transaction: t });

      const toBalance = await InventoryBalance.findOne({
        where: { warehouse_id: toId, product_id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (toBalance) {
        const newQty = Number(toBalance.quantity) - Number(quantity);
        if (newQty < 0) {
          await t.rollback();
          return res.status(400).json({ message: 'Tồn kho kho đích sau rollback không được âm' });
        }
        toBalance.quantity = newQty;
        await toBalance.save({ transaction: t });
      }
    }

    await StockTransferItem.destroy({ where: { stock_transfer_id: transfer.id }, transaction: t, force: true, paranoid: false });
    await StockTransfer.destroy({ transaction: t, force: true });

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
  const { code, from_warehouse_id, to_warehouse_id, note, status, items } = req.body;

  if (!from_warehouse_id || !to_warehouse_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'from_warehouse_id, to_warehouse_id và ít nhất 1 item là bắt buộc' });
  }
  if (from_warehouse_id === to_warehouse_id) {
    return res.status(400).json({ message: 'Kho nguồn và kho đích phải khác nhau' });
  }

  const t = await sequelize.transaction();
  try {
    const transfer = await StockTransfer.findByPk(id, {
      include: [StockTransferItem],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!transfer) {
      await t.rollback();
      return res.status(404).json({ message: 'Stock-transfer not found' });
    }

    if (transfer.status !== 'draft') {
      await t.rollback();
      return res.status(400).json({ message: 'Chỉ được sửa phiếu ở trạng thái draft' });
    }

    if (code && code !== transfer.code) {
      const exists = await StockTransfer.findOne({ where: { code }, transaction: t, lock: t.LOCK.UPDATE });
      if (exists) {
        await t.rollback();
        return res.status(409).json({ message: 'Stock-transfer code already exists' });
      }
    }

    const fromWh = await Warehouse.findByPk(from_warehouse_id, { transaction: t, lock: t.LOCK.UPDATE });
    const toWh = await Warehouse.findByPk(to_warehouse_id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!fromWh || !toWh) {
      await t.rollback();
      return res.status(400).json({ message: 'from_warehouse_id hoặc to_warehouse_id không tồn tại' });
    }

    await StockTransferItem.destroy({ where: { stock_transfer_id: transfer.id }, transaction: t });

    transfer.code = code ?? transfer.code;
    transfer.from_warehouse_id = from_warehouse_id;
    transfer.to_warehouse_id = to_warehouse_id;
    transfer.note = note ?? null;
    await transfer.save({ transaction: t });

    for (const row of items) {
      const { product_id, quantity } = row;
      if (!product_id || !quantity || Number(quantity) <= 0) {
        await t.rollback();
        return res.status(400).json({ message: 'Mỗi item cần product_id và quantity > 0' });
      }

      const product = await Product.findByPk(product_id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!product) {
        await t.rollback();
        return res.status(400).json({ message: `product_id ${product_id} không tồn tại` });
      }

      await StockTransferItem.create(
        {
          stock_transfer_id: transfer.id,
          product_id,
          quantity,
        },
        { transaction: t }
      );
    }

    await t.commit();

    const result = await StockTransfer.findByPk(transfer.id, {
      include: [
        { model: Warehouse, as: 'FromWarehouse' },
        { model: Warehouse, as: 'ToWarehouse' },
        { model: StockTransferItem, include: [Product] },
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
    const transfer = await StockTransfer.findByPk(id, {
      include: [StockTransferItem],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!transfer) {
      await t.rollback();
      return res.status(404).json({ message: 'Stock-transfer not found' });
    }

    if (transfer.status === 'draft') {
      // Draft: xoá hẳn, không ảnh hưởng tồn
      await StockTransferItem.destroy({ where: { stock_transfer_id: transfer.id }, transaction: t, force: true });
      await StockTransfer.destroy({ transaction: t, force: true });
    } else {
      // Confirmed/cancelled: xoá mềm, chưa rollback tồn
      await StockTransferItem.destroy({ where: { stock_transfer_id: transfer.id }, transaction: t });
      await StockTransfer.destroy({ transaction: t });
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
    const transfer = await StockTransfer.findByPk(id, {
      include: [StockTransferItem],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!transfer) {
      await t.rollback();
      return res.status(404).json({ message: 'Stock-transfer not found' });
    }

    if (transfer.status === 'confirmed') {
      await t.rollback();
      return res.status(400).json({ message: 'Phiếu đã ở trạng thái confirmed' });
    }
    if (transfer.status === 'cancelled') {
      await t.rollback();
      return res.status(400).json({ message: 'Không thể confirm phiếu đã cancelled' });
    }

    const fromId = transfer.from_warehouse_id;
    const toId = transfer.to_warehouse_id;

    for (const item of transfer.StockTransferItems) {
      const { product_id, quantity } = item;

      const fromBalance = await InventoryBalance.findOne({
        where: { warehouse_id: fromId, product_id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      const fromCurrent = fromBalance ? Number(fromBalance.quantity) : 0;
      const fromNew = fromCurrent - Number(quantity);
      if (fromNew < 0) {
        await t.rollback();
        return res.status(400).json({ message: 'Tồn kho kho nguồn không đủ để chuyển (không được âm)' });
      }

      if (fromBalance) {
        fromBalance.quantity = fromNew;
        await fromBalance.save({ transaction: t });
      }

      const [toBalance] = await InventoryBalance.findOrCreate({
        where: { warehouse_id: toId, product_id },
        defaults: { quantity: 0 },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      toBalance.quantity = Number(toBalance.quantity) + Number(quantity);
      await toBalance.save({ transaction: t });
    }

    transfer.status = 'confirmed';
    await transfer.save({ transaction: t });

    await t.commit();

    const result = await StockTransfer.findByPk(transfer.id, {
      include: [
        { model: Warehouse, as: 'FromWarehouse' },
        { model: Warehouse, as: 'ToWarehouse' },
        { model: StockTransferItem, include: [Product] },
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
  permanentRemove,
};
