'use strict';
const { Supplier } = require('../models');

const list = async (req, res) => {
  const items = await Supplier.findAll();
  return res.json(items);
};

const getById = async (req, res) => {
  const item = await Supplier.findByPk(req.params.id);
  if (!item) return res.status(404).json({ message: 'Supplier not found' });
  return res.json(item);
};

const create = async (req, res) => {
  const { name, contact_name, phone, email, address } = req.body;
  if (!name) return res.status(400).json({ message: 'name is required' });
  const created = await Supplier.create({ name, contact_name, phone, email, address });
  return res.status(201).json(created);
};

const update = async (req, res) => {
  const item = await Supplier.findByPk(req.params.id);
  if (!item) return res.status(404).json({ message: 'Supplier not found' });
  const { name, contact_name, phone, email, address } = req.body;
  await item.update({
    name: name ?? item.name,
    contact_name: contact_name ?? item.contact_name,
    phone: phone ?? item.phone,
    email: email ?? item.email,
    address: address ?? item.address,
  });
  return res.json(item);
};

const remove = async (req, res) => {
  const item = await Supplier.findByPk(req.params.id);
  if (!item) return res.status(404).json({ message: 'Supplier not found' });
  await item.destroy();
  return res.json({ message: 'Deleted' });
};

module.exports = { list, getById, create, update, remove };
