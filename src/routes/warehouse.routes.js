'use strict';
const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middlewares/auth.middleware');
const warehouseController = require('../controllers/warehouse.controller');

router.get('/', authenticate, requirePermission('inventory.read'), warehouseController.list);
router.get('/:id', authenticate, requirePermission('inventory.read'), warehouseController.getById);
router.post('/', authenticate, requirePermission('inventory.create'), warehouseController.create);
router.put('/:id', authenticate, requirePermission('inventory.update'), warehouseController.update);
router.delete('/:id', authenticate, requirePermission('inventory.delete'), warehouseController.remove);

module.exports = router;
