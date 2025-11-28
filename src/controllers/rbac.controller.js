'use strict';
const { Role, Permission, RolePermission } = require('../models');

const listRolesWithPermissions = async (req, res) => {
  const roles = await Role.findAll({ include: [Permission] });
  return res.json(roles);
};

const listPermissions = async (req, res) => {
  const perms = await Permission.findAll();
  return res.json(perms);
};

const getRolePermissions = async (req, res) => {
  const roleId = req.params.id;

  const role = await Role.findByPk(roleId, { include: [Permission] });
  if (!role) return res.status(404).json({ message: 'Role not found' });

  // Return only the permissions array for this role
  return res.json(role.Permissions || []);
};

// Gán lại toàn bộ permission cho một role (replace)
const setRolePermissions = async (req, res) => {
  const roleId = req.params.id;
  const { permissionIds } = req.body;

  if (!Array.isArray(permissionIds)) {
    return res.status(400).json({ message: 'permissionIds must be an array of IDs' });
  }

  const role = await Role.findByPk(roleId);
  if (!role) return res.status(404).json({ message: 'Role not found' });

  await RolePermission.destroy({ where: { role_id: role.id } });

  const bulk = permissionIds.map((pid) => ({ role_id: role.id, permission_id: pid }));
  if (bulk.length) await RolePermission.bulkCreate(bulk);

  const result = await Role.findByPk(role.id, { include: [Permission] });
  return res.json(result);
};

module.exports = {
  listRolesWithPermissions,
  listPermissions,
  getRolePermissions,
  setRolePermissions,
};
