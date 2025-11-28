'use strict';

const { Permission } = require('../models');

const list = async (req, res) => {
  try {
    const perms = await Permission.findAll();
    return res.json(perms);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const getById = async (req, res) => {
  try {
    const perm = await Permission.findByPk(req.params.id);
    if (!perm) return res.status(404).json({ message: 'Permission not found' });
    return res.json(perm);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const create = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'name is required' });
    }

    const exists = await Permission.findOne({ where: { name } });
    if (exists) return res.status(409).json({ message: 'Permission name already exists' });

    const perm = await Permission.create({ name, description });
    return res.status(201).json(perm);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const update = async (req, res) => {
  try {
    const { name, description } = req.body;
    const perm = await Permission.findByPk(req.params.id);
    if (!perm) return res.status(404).json({ message: 'Permission not found' });

    if (name !== undefined) perm.name = name;
    if (description !== undefined) perm.description = description;

    await perm.save();
    return res.json(perm);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const remove = async (req, res) => {
  try {
    const perm = await Permission.findByPk(req.params.id);
    if (!perm) return res.status(404).json({ message: 'Permission not found' });

    await perm.destroy();
    return res.json({ message: 'Deleted' });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { list, getById, create, update, remove };
