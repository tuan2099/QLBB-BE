'use strict';
const { Op } = require('sequelize');
const { sequelize, StockIn, StockInItem, InventoryBalance, Warehouse, Supplier, Product } = require('../models');

const list = async (req, res) => {
  const {
    page = 1,
    limit = 20,
    warehouse_id,
    supplier_id,
    status,
    code,
    deleted,
  } = req.query;

  const baseWhere = {};
  if (warehouse_id) baseWhere.warehouse_id = warehouse_id;
  if (supplier_id) baseWhere.supplier_id = supplier_id;
  if (status) baseWhere.status = status;
  if (code) baseWhere.code = { [Op.like]: `%${code}%` };

  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = Math.max(Number(limit) || 20, 1);
  const offset = (pageNum - 1) * limitNum;

  // deleted=1 -> chỉ lấy bản ghi đã xoá mềm (deleted_at NOT NULL)
  const isDeletedList = deleted === '1' || deleted === 1 || deleted === true || deleted === 'true';

  let rows;
  let count;

  if (isDeletedList) {
    const where = { ...baseWhere, deleted_at: { [Op.ne]: null } };
    ({ rows, count } = await StockIn.findAndCountAll({
      where,
      include: [Warehouse, Supplier],
      order: [['created_at', 'DESC']],
      offset,
      limit: limitNum,
      paranoid: false,
    }));
  } else {
    const where = { ...baseWhere };
    ({ rows, count } = await StockIn.findAndCountAll({
      where,
      include: [Warehouse, Supplier],
      order: [['created_at', 'DESC']],
      offset,
      limit: limitNum,
      // dùng paranoid mặc định: tự động loại bỏ bản ghi đã xoá mềm
    }));
  }

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
  const item = await StockIn.findByPk(req.params.id, {
    include: [
      Warehouse,
      Supplier,
      {
        model: StockInItem,
        include: [Product],
      },
    ],
  });
  if (!item) return res.status(404).json({ message: 'Stock-in not found' });
  return res.json(item);
};

const create = async (req, res) => {
  const { code, warehouse_id, supplier_id, note, status, items, creator_signature, received_date, stock_in_type } = req.body;

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

    if (supplier_id) {
      const supplier = await Supplier.findByPk(supplier_id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!supplier) {
        await t.rollback();
        return res.status(400).json({ message: 'supplier_id không tồn tại' });
      }
    }

    const exists = await StockIn.findOne({ where: { code }, transaction: t, lock: t.LOCK.UPDATE });
    if (exists) {
      await t.rollback();
      return res.status(409).json({ message: 'Stock-in code already exists' });
    }

    const stockIn = await StockIn.create(
      {
        code,
        warehouse_id,
        supplier_id: supplier_id || null,
        note: note || null,
        received_date: received_date || null,
        stock_in_type: stock_in_type || null,
        creator_signature: creator_signature || null,
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

      await StockInItem.create(
        {
          stock_in_id: stockIn.id,
          product_id,
          quantity,
        },
        { transaction: t }
      );
    }

    await t.commit();

    const result = await StockIn.findByPk(stockIn.id, {
      include: [
        Warehouse,
        Supplier,
        { model: StockInItem, include: [Product] },
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
    // Lấy cả bản ghi đã xoá mềm
    const stockIn = await StockIn.findByPk(id, {
      include: [{ model: StockInItem, paranoid: false }],
      paranoid: false,
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!stockIn) {
      await t.rollback();
      return res.status(404).json({ message: 'Stock-in not found' });
    }

    // Chỉ cho xoá hẳn khi đã xoá mềm (đã có deleted_at)
    if (!stockIn.deleted_at && !stockIn.deletedAt) {
      await t.rollback();
      return res.status(400).json({ message: 'Cần xoá mềm trước khi xoá vĩnh viễn' });
    }

    if (!stockIn.StockInItems || stockIn.StockInItems.length === 0) {
      await t.rollback();
      return res
        .status(400)
        .json({ message: 'Không tìm thấy chi tiết phiếu nhập để rollback tồn kho' });
    }

    // Rollback tồn kho tương ứng (phiếu đã từng được confirm trước đó)
    const warehouseId = stockIn.warehouse_id;

    let hasRolledBack = false;

    for (const item of stockIn.StockInItems) {
      const { product_id, quantity } = item;

      const balance = await InventoryBalance.findOne({
        where: { warehouse_id: warehouseId, product_id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (balance) {
        const newQty = Number(balance.quantity) - Number(quantity);
        if (newQty < 0) {
          await t.rollback();
          return res.status(400).json({ message: 'Tồn kho sau rollback không được âm' });
        }
        balance.quantity = newQty;
        await balance.save({ transaction: t });
        hasRolledBack = true;
      }
    }

    if (!hasRolledBack) {
      await t.rollback();
      return res
        .status(400)
        .json({ message: 'Không tìm thấy tồn kho phù hợp để rollback, kiểm tra lại kho & sản phẩm' });
    }

    await StockInItem.destroy({ where: { stock_in_id: stockIn.id }, transaction: t, force: true, paranoid: false });
    await stockIn.destroy({ transaction: t, force: true });

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
  const { code, warehouse_id, supplier_id, note, status, items, creator_signature, received_date, stock_in_type } = req.body;

  if (!warehouse_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'warehouse_id và ít nhất 1 item là bắt buộc' });
  }

  const t = await sequelize.transaction();
  try {
    const stockIn = await StockIn.findByPk(id, {
      include: [StockInItem],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!stockIn) {
      await t.rollback();
      return res.status(404).json({ message: 'Stock-in not found' });
    }

    if (stockIn.status !== 'draft') {
      await t.rollback();
      return res.status(400).json({ message: 'Chỉ được sửa phiếu ở trạng thái draft' });
    }

    // kiểm tra code mới trùng với phiếu khác không
    if (code && code !== stockIn.code) {
      const exists = await StockIn.findOne({
        where: { code },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (exists) {
        await t.rollback();
        return res.status(409).json({ message: 'Stock-in code already exists' });
      }
    }

    const warehouse = await Warehouse.findByPk(warehouse_id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!warehouse) {
      await t.rollback();
      return res.status(400).json({ message: 'warehouse_id không tồn tại' });
    }

    if (supplier_id) {
      const supplier = await Supplier.findByPk(supplier_id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!supplier) {
        await t.rollback();
        return res.status(400).json({ message: 'supplier_id không tồn tại' });
      }
    }

    await StockInItem.destroy({ where: { stock_in_id: stockIn.id }, transaction: t });

    stockIn.code = code ?? stockIn.code;
    stockIn.warehouse_id = warehouse_id;
    stockIn.supplier_id = supplier_id ?? null;
    stockIn.note = note ?? null;
    stockIn.received_date = received_date ?? stockIn.received_date;
    stockIn.stock_in_type = stock_in_type ?? stockIn.stock_in_type;
    stockIn.creator_signature = creator_signature ?? stockIn.creator_signature;
    await stockIn.save({ transaction: t });

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

      await StockInItem.create(
        {
          stock_in_id: stockIn.id,
          product_id,
          quantity,
        },
        { transaction: t }
      );
    }

    await t.commit();

    const result = await StockIn.findByPk(stockIn.id, {
      include: [
        Warehouse,
        Supplier,
        { model: StockInItem, include: [Product] },
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
    const stockIn = await StockIn.findByPk(id, {
      include: [StockInItem],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!stockIn) {
      await t.rollback();
      return res.status(404).json({ message: 'Stock-in not found' });
    }

    if (stockIn.status === 'draft') {
      // Draft: cho phép xoá hẳn luôn (hard delete), không ảnh hưởng tồn kho
      await StockInItem.destroy({ where: { stock_in_id: stockIn.id }, transaction: t, force: true });
      await stockIn.destroy({ transaction: t, force: true });
    } else {
      // Confirmed/cancelled: chỉ xoá mềm header, giữ lại chi tiết để rollback tồn kho khi xoá vĩnh viễn
      await stockIn.destroy({ transaction: t });
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
    const stockIn = await StockIn.findByPk(id, {
      include: [StockInItem],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!stockIn) {
      await t.rollback();
      return res.status(404).json({ message: 'Stock-in not found' });
    }

    if (stockIn.status === 'confirmed') {
      await t.rollback();
      return res.status(400).json({ message: 'Phiếu đã ở trạng thái confirmed' });
    }
    if (stockIn.status === 'cancelled') {
      await t.rollback();
      return res.status(400).json({ message: 'Không thể confirm phiếu đã cancelled' });
    }

    const warehouseId = stockIn.warehouse_id;

    for (const item of stockIn.StockInItems) {
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

    stockIn.status = 'confirmed';
    await stockIn.save({ transaction: t });

    await t.commit();

    const result = await StockIn.findByPk(stockIn.id, {
      include: [
        Warehouse,
        Supplier,
        { model: StockInItem, include: [Product] },
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
