'use strict';
const { Role, UserRole, RolePermission } = require('../models');

const list = async (req, res) => {
  const roles = await Role.findAll();
  return res.json(roles);
};

const getById = async (req, res) => {
  const role = await Role.findByPk(req.params.id);
  if (!role) return res.status(404).json({ message: 'Role not found' });
  return res.json(role);
};

const create = async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ message: 'name is required' });

  const exists = await Role.findOne({ where: { name } });
  if (exists) return res.status(409).json({ message: 'Role name already exists' });

  const role = await Role.create({ name, description });
  return res.status(201).json(role);
};

const update = async (req, res) => {
  const { name, description } = req.body;
  const role = await Role.findByPk(req.params.id);
  if (!role) return res.status(404).json({ message: 'Role not found' });

  if (name && name !== role.name) {
    const exists = await Role.findOne({ where: { name } });
    if (exists) return res.status(409).json({ message: 'Role name already exists' });
  }

  role.name = name ?? role.name;
  role.description = description ?? role.description;
  await role.save();

  return res.json(role);
};

const remove = async (req, res) => {
  const role = await Role.findByPk(req.params.id);
  if (!role) return res.status(404).json({ message: 'Role not found' });

  // Xóa mapping với user và permission rồi mới xóa role
  await UserRole.destroy({ where: { role_id: role.id } });
  await RolePermission.destroy({ where: { role_id: role.id } });
  await role.destroy();

  return res.json({ message: 'Deleted' });
};

module.exports = { list, getById, create, update, remove };
