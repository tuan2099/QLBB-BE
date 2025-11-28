'use strict';
const { InventoryBalance, Warehouse, Product } = require('../models');

const list = async (req, res) => {
  const { warehouse_id, product_id } = req.query;

  const where = {};
  if (warehouse_id) where.warehouse_id = warehouse_id;
  if (product_id) where.product_id = product_id;

  const balances = await InventoryBalance.findAll({
    where,
    include: [Warehouse, Product],
    order: [
      ['warehouse_id', 'ASC'],
      ['product_id', 'ASC'],
    ],
  });

  return res.json(balances);
};

module.exports = {
  list,
};
