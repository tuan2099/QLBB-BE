'use strict';

const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middlewares/auth.middleware');
const permissionController = require('../controllers/permission.controller');

// Basic CRUD for permissions
router.get('/', authenticate, requirePermission('user.read'), permissionController.list);
router.get('/:id', authenticate, requirePermission('user.read'), permissionController.getById);
router.post('/', authenticate, requirePermission('user.update'), permissionController.create);
router.put('/:id', authenticate, requirePermission('user.update'), permissionController.update);
router.delete('/:id', authenticate, requirePermission('user.update'), permissionController.remove);

module.exports = router;
