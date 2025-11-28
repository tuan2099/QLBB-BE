'use strict';
const { Customer } = require('../models');

const list = async (req, res) => {
  const items = await Customer.findAll();
  return res.json(items);
};

const getById = async (req, res) => {
  const item = await Customer.findByPk(req.params.id);
  if (!item) return res.status(404).json({ message: 'Customer not found' });
  return res.json(item);
};

const create = async (req, res) => {
  const {
    name,
    phone,
    email,
    address,
    pm,
    category,
    branch,
    total_spent,
    representative,
    status,
    assignee_user_id,
    notes,
  } = req.body;
  if (!name) return res.status(400).json({ message: 'name is required' });
  const created = await Customer.create({
    name,
    phone,
    email,
    address,
    pm,
    category,
    branch,
    total_spent,
    representative,
    status,
    assignee_user_id,
    notes,
  });
  return res.status(201).json(created);
};

const update = async (req, res) => {
  const item = await Customer.findByPk(req.params.id);
  if (!item) return res.status(404).json({ message: 'Customer not found' });
  const {
    name,
    phone,
    email,
    address,
    pm,
    category,
    branch,
    total_spent,
    representative,
    status,
    assignee_user_id,
    notes,
  } = req.body;
  await item.update({
    name: name ?? item.name,
    phone: phone ?? item.phone,
    email: email ?? item.email,
    address: address ?? item.address,
    pm: pm ?? item.pm,
    category: category ?? item.category,
    branch: branch ?? item.branch,
    total_spent: total_spent ?? item.total_spent,
    representative: representative ?? item.representative,
    status: status ?? item.status,
    assignee_user_id: assignee_user_id ?? item.assignee_user_id,
    notes: notes ?? item.notes,
  });
  return res.json(item);
};

const remove = async (req, res) => {
  const item = await Customer.findByPk(req.params.id);
  if (!item) return res.status(404).json({ message: 'Customer not found' });
  await item.destroy();
  return res.json({ message: 'Deleted' });
};

module.exports = { list, getById, create, update, remove };
