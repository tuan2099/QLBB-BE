'use strict';
const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middlewares/auth.middleware');
const roleController = require('../controllers/role.controller');

router.get('/', authenticate, requirePermission('user.read'), roleController.list);
router.get('/:id', authenticate, requirePermission('user.read'), roleController.getById);
router.post('/', authenticate, requirePermission('user.create'), roleController.create);
router.put('/:id', authenticate, requirePermission('user.update'), roleController.update);
router.delete('/:id', authenticate, requirePermission('user.delete'), roleController.remove);

module.exports = router;
