'use strict';
const { Product, Supplier, Warehouse } = require('../models');

const list = async (req, res) => {
  const items = await Product.findAll({
    include: [Supplier, Warehouse],
  });
  return res.json(items);
};

const getById = async (req, res) => {
  const item = await Product.findByPk(req.params.id, {
    include: [Supplier, Warehouse],
  });
  if (!item) return res.status(404).json({ message: 'Product not found' });
  return res.json(item);
};

const create = async (req, res) => {
  const {
    sku,
    name,
    description,
    unit,
    supplier_id,
    warehouse_id,
    image_url,
    size,
    product_group,
    specification,
    min_quantity,
    max_quantity,
    status,
    company,
  } = req.body;
  if (!sku || !name) return res.status(400).json({ message: 'sku and name are required' });

  const exists = await Product.findOne({ where: { sku } });
  if (exists) return res.status(409).json({ message: 'SKU already exists' });

  const created = await Product.create({
    sku,
    name,
    description,
    unit,
    supplier_id,
    warehouse_id,
    image_url: image_url || null,
    size: size || null,
    product_group: product_group || null,
    specification: specification || null,
    min_quantity: min_quantity ?? null,
    max_quantity: max_quantity ?? null,
    status: status || null,
    company: company || null,
  });
  return res.status(201).json(created);
};

const update = async (req, res) => {
  const item = await Product.findByPk(req.params.id);
  if (!item) return res.status(404).json({ message: 'Product not found' });

  const {
    sku,
    name,
    description,
    unit,
    supplier_id,
    warehouse_id,
    image_url,
    size,
    product_group,
    specification,
    min_quantity,
    max_quantity,
    status,
    company,
  } = req.body;

  if (sku && sku !== item.sku) {
    const exists = await Product.findOne({ where: { sku } });
    if (exists) return res.status(409).json({ message: 'SKU already exists' });
  }

  await item.update({
    sku: sku ?? item.sku,
    name: name ?? item.name,
    description: description ?? item.description,
    unit: unit ?? item.unit,
    supplier_id: supplier_id ?? item.supplier_id,
    warehouse_id: warehouse_id ?? item.warehouse_id,
    image_url: image_url ?? item.image_url,
    size: size ?? item.size,
    product_group: product_group ?? item.product_group,
    specification: specification ?? item.specification,
    min_quantity: min_quantity ?? item.min_quantity,
    max_quantity: max_quantity ?? item.max_quantity,
    status: status ?? item.status,
    company: company ?? item.company,
  });

  return res.json(item);
};

const remove = async (req, res) => {
  const item = await Product.findByPk(req.params.id);
  if (!item) return res.status(404).json({ message: 'Product not found' });
  await item.destroy();
  return res.json({ message: 'Deleted' });
};

module.exports = { list, getById, create, update, remove };
