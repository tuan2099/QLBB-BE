'use strict';
const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middlewares/auth.middleware');
const stockTransferController = require('../controllers/stockTransfer.controller');

router.get('/', authenticate, requirePermission('inventory.read'), stockTransferController.list);
router.get('/:id', authenticate, requirePermission('inventory.read'), stockTransferController.getById);
router.post('/', authenticate, requirePermission('inventory.create'), stockTransferController.create);
router.put('/:id', authenticate, requirePermission('inventory.update'), stockTransferController.update);
router.delete('/:id', authenticate, requirePermission('inventory.delete'), stockTransferController.remove);
router.post('/:id/confirm', authenticate, requirePermission('inventory.update'), stockTransferController.confirm);
router.delete('/:id/permanent', authenticate, requirePermission('inventory.delete'), stockTransferController.permanentRemove);

module.exports = router;
