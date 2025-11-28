'use strict';
const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middlewares/auth.middleware');
const rbacController = require('../controllers/rbac.controller');

// Chỉ cho phép user có quyền mạnh (ví dụ admin: có user.update) quản lý RBAC
router.get('/roles', authenticate, requirePermission('user.read'), rbacController.listRolesWithPermissions);
router.get('/permissions', authenticate, requirePermission('user.read'), rbacController.listPermissions);
router.get('/roles/:id/permissions', authenticate, requirePermission('user.read'), rbacController.getRolePermissions);
router.post('/roles/:id/permissions', authenticate, requirePermission('user.update'), rbacController.setRolePermissions);

module.exports = router;
