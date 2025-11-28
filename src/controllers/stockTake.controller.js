'use strict';
const { Op } = require('sequelize');
const {
  sequelize,
  StockTake,
  StockTakeItem,
  Warehouse,
  Product,
  InventoryBalance,
} = require('../models');

const list = async (req, res) => {
  const { page = 1, limit = 20, warehouse_id, status, code } = req.query;

  const where = {};
  if (warehouse_id) where.warehouse_id = warehouse_id;
  if (status) where.status = status;
  if (code) where.code = { [Op.like]: `%${code}%` };

  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = Math.max(Number(limit) || 20, 1);
  const offset = (pageNum - 1) * limitNum;

  const { rows, count } = await StockTake.findAndCountAll({
    where,
    include: [{ model: Warehouse }],
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
  const item = await StockTake.findByPk(req.params.id, {
    include: [
      Warehouse,
      {
        model: StockTakeItem,
        include: [Product],
      },
    ],
  });
  if (!item) return res.status(404).json({ message: 'Stock-take not found' });
  return res.json(item);
};

const create = async (req, res) => {
  const { code, warehouse_id, note, status, items } = req.body;

  if (!code || !warehouse_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'code, warehouse_id và ít nhất 1 item là bắt buộc' });
  }

  const t = await sequelize.transaction();
  try {
    const wh = await Warehouse.findByPk(warehouse_id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!wh) {
      await t.rollback();
      return res.status(400).json({ message: 'warehouse_id không tồn tại' });
    }

    const exists = await StockTake.findOne({ where: { code }, transaction: t, lock: t.LOCK.UPDATE });
    if (exists) {
      await t.rollback();
      return res.status(409).json({ message: 'Stock-take code already exists' });
    }

    const stockTake = await StockTake.create(
      {
        code,
        warehouse_id,
        note: note || null,
        status: status || 'draft',
        created_by: req.user?.id || null,
      },
      { transaction: t }
    );

    for (const row of items) {
      const { product_id, actual_quantity } = row;
      if (!product_id) {
        await t.rollback();
        return res.status(400).json({ message: 'Mỗi item cần product_id' });
      }

      const product = await Product.findByPk(product_id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!product) {
        await t.rollback();
        return res.status(400).json({ message: `product_id ${product_id} không tồn tại` });
      }

      const balance = await InventoryBalance.findOne({
        where: { warehouse_id, product_id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      const systemQty = balance ? Number(balance.quantity) : 0;
      const actualQty = Number(actual_quantity ?? systemQty);
      const diff = actualQty - systemQty;

      await StockTakeItem.create(
        {
          stock_take_id: stockTake.id,
          product_id,
          system_quantity: systemQty,
          actual_quantity: actualQty,
          difference: diff,
        },
        { transaction: t }
      );
    }

    await t.commit();

    const result = await StockTake.findByPk(stockTake.id, {
      include: [Warehouse, { model: StockTakeItem, include: [Product] }],
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
    const stockTake = await StockTake.findByPk(id, {
      include: [StockTakeItem],
      paranoid: false,
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!stockTake) {
      await t.rollback();
      return res.status(404).json({ message: 'Stock-take not found' });
    }

    if (!stockTake.deleted_at && !stockTake.deletedAt) {
      await t.rollback();
      return res.status(400).json({ message: 'Cần xoá mềm trước khi xoá vĩnh viễn' });
    }

    await StockTakeItem.destroy({
      where: { stock_take_id: stockTake.id },
      transaction: t,
      force: true,
      paranoid: false,
    });

    await StockTake.destroy({ transaction: t, force: true });

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
  const { code, warehouse_id, note, status, items } = req.body;

  if (!warehouse_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'warehouse_id và ít nhất 1 item là bắt buộc' });
  }

  const t = await sequelize.transaction();
  try {
    const stockTake = await StockTake.findByPk(id, {
      include: [StockTakeItem],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!stockTake) {
      await t.rollback();
      return res.status(404).json({ message: 'Stock-take not found' });
    }

    if (stockTake.status !== 'draft') {
      await t.rollback();
      return res.status(400).json({ message: 'Chỉ được sửa phiếu ở trạng thái draft' });
    }

    if (code && code !== stockTake.code) {
      const exists = await StockTake.findOne({ where: { code }, transaction: t, lock: t.LOCK.UPDATE });
      if (exists) {
        await t.rollback();
        return res.status(409).json({ message: 'Stock-take code already exists' });
      }
    }

    const wh = await Warehouse.findByPk(warehouse_id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!wh) {
      await t.rollback();
      return res.status(400).json({ message: 'warehouse_id không tồn tại' });
    }

    await StockTakeItem.destroy({ where: { stock_take_id: stockTake.id }, transaction: t });

    stockTake.code = code ?? stockTake.code;
    stockTake.warehouse_id = warehouse_id;
    stockTake.note = note ?? null;
    stockTake.status = status ?? stockTake.status;
    await stockTake.save({ transaction: t });

    for (const row of items) {
      const { product_id, actual_quantity } = row;
      if (!product_id) {
        await t.rollback();
        return res.status(400).json({ message: 'Mỗi item cần product_id' });
      }

      const product = await Product.findByPk(product_id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!product) {
        await t.rollback();
        return res.status(400).json({ message: `product_id ${product_id} không tồn tại` });
      }

      const balance = await InventoryBalance.findOne({
        where: { warehouse_id, product_id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      const systemQty = balance ? Number(balance.quantity) : 0;
      const actualQty = Number(actual_quantity ?? systemQty);
      const diff = actualQty - systemQty;

      await StockTakeItem.create(
        {
          stock_take_id: stockTake.id,
          product_id,
          system_quantity: systemQty,
          actual_quantity: actualQty,
          difference: diff,
        },
        { transaction: t }
      );
    }

    await t.commit();

    const result = await StockTake.findByPk(stockTake.id, {
      include: [Warehouse, { model: StockTakeItem, include: [Product] }],
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
    const stockTake = await StockTake.findByPk(id, {
      include: [StockTakeItem],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!stockTake) {
      await t.rollback();
      return res.status(404).json({ message: 'Stock-take not found' });
    }

    // Xoá mềm phiếu, xoá mềm các item
    await StockTakeItem.destroy({ where: { stock_take_id: stockTake.id }, transaction: t });
    await StockTake.destroy({ transaction: t });

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
    const stockTake = await StockTake.findByPk(id, {
      include: [StockTakeItem],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!stockTake) {
      await t.rollback();
      return res.status(404).json({ message: 'Stock-take not found' });
    }

    if (stockTake.status === 'confirmed') {
      await t.rollback();
      return res.status(400).json({ message: 'Phiếu đã ở trạng thái confirmed' });
    }
    if (stockTake.status === 'cancelled') {
      await t.rollback();
      return res.status(400).json({ message: 'Không thể confirm phiếu đã cancelled' });
    }

    // KHÔNG cập nhật InventoryBalance, chỉ đổi trạng thái phiếu
    stockTake.status = 'confirmed';
    await stockTake.save({ transaction: t });

    await t.commit();

    const result = await StockTake.findByPk(stockTake.id, {
      include: [Warehouse, { model: StockTakeItem, include: [Product] }],
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
