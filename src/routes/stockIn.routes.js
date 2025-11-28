'use strict';
const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middlewares/auth.middleware');
const stockInController = require('../controllers/stockIn.controller');

router.get('/', authenticate, requirePermission('inventory.read'), stockInController.list);
router.get('/:id', authenticate, requirePermission('inventory.read'), stockInController.getById);
router.post('/', authenticate, requirePermission('inventory.create'), stockInController.create);
router.put('/:id', authenticate, requirePermission('inventory.update'), stockInController.update);
router.delete('/:id', authenticate, requirePermission('inventory.delete'), stockInController.remove);
router.post('/:id/confirm', authenticate, requirePermission('inventory.update'), stockInController.confirm);
router.delete('/:id/permanent', authenticate, requirePermission('inventory.delete'), stockInController.permanentRemove);

module.exports = router;
