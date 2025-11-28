'use strict';
const bcrypt = require('bcrypt');
const { User, Role, UserRole } = require('../models');

const list = async (req, res) => {
  const users = await User.findAll({
    include: [{ model: Role }],
  });
  return res.json(users);
};

const getById = async (req, res) => {
  const user = await User.findByPk(req.params.id, {
    include: [{ model: Role }],
  });
  if (!user) return res.status(404).json({ message: 'User not found' });
  return res.json(user);
};

const create = async (req, res) => {
  const {
    username,
    email,
    password,
    is_active,
    roleIds,
    phone,
    address,
    country,
    state,
    city,
    company,
    avatar_url,
  } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'username, email, password are required' });
  }

  const exists = await User.findOne({ where: { username } });
  if (exists) return res.status(409).json({ message: 'Username already exists' });

  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({
    username,
    email,
    password: hash,
    is_active: is_active ?? true,
    phone,
    address,
    country,
    state,
    city,
    company,
    avatar_url,
  });

  if (Array.isArray(roleIds) && roleIds.length) {
    const bulk = roleIds.map((roleId) => ({ user_id: user.id, role_id: roleId }));
    await UserRole.bulkCreate(bulk);
  }

  const result = await User.findByPk(user.id, { include: [Role] });
  return res.status(201).json(result);
};

const update = async (req, res) => {
  const { email, password, is_active, roleIds, phone, address, country, state, city, company, avatar_url } = req.body;
  const user = await User.findByPk(req.params.id, { include: [Role] });
  if (!user) return res.status(404).json({ message: 'User not found' });

  if (password) {
    const hash = await bcrypt.hash(password, 10);
    user.password = hash;
  }

  if (email !== undefined) user.email = email;
  if (is_active !== undefined) user.is_active = is_active;
  if (phone !== undefined) user.phone = phone;
  if (address !== undefined) user.address = address;
  if (country !== undefined) user.country = country;
  if (state !== undefined) user.state = state;
  if (city !== undefined) user.city = city;
  if (company !== undefined) user.company = company;
  if (avatar_url !== undefined) user.avatar_url = avatar_url;

  await user.save();

  if (Array.isArray(roleIds)) {
    await UserRole.destroy({ where: { user_id: user.id } });
    const bulk = roleIds.map((roleId) => ({ user_id: user.id, role_id: roleId }));
    if (bulk.length) await UserRole.bulkCreate(bulk);
  }

  const result = await User.findByPk(user.id, { include: [Role] });
  return res.json(result);
};

const remove = async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  await UserRole.destroy({ where: { user_id: user.id } });
  await user.destroy();
  return res.json({ message: 'Deleted' });
};

module.exports = { list, getById, create, update, remove };
