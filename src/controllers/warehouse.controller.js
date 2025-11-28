'use strict';
const { Warehouse } = require('../models');

const list = async (req, res) => {
  const items = await Warehouse.findAll();
  return res.json(items);
};

const getById = async (req, res) => {
  const item = await Warehouse.findByPk(req.params.id);
  if (!item) return res.status(404).json({ message: 'Warehouse not found' });
  return res.json(item);
};

const create = async (req, res) => {
  const { code, name, address } = req.body;
  if (!code || !name) return res.status(400).json({ message: 'code and name are required' });
  const created = await Warehouse.create({ code, name, address });
  return res.status(201).json(created);
};

const update = async (req, res) => {
  const item = await Warehouse.findByPk(req.params.id);
  if (!item) return res.status(404).json({ message: 'Warehouse not found' });
  const { code, name, address } = req.body;
  await item.update({ code: code ?? item.code, name: name ?? item.name, address: address ?? item.address });
  return res.json(item);
};

const remove = async (req, res) => {
  const item = await Warehouse.findByPk(req.params.id);
  if (!item) return res.status(404).json({ message: 'Warehouse not found' });
  await item.destroy();
  return res.json({ message: 'Deleted' });
};

module.exports = { list, getById, create, update, remove };
