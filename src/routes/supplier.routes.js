'use strict';
const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middlewares/auth.middleware');
const supplierController = require('../controllers/supplier.controller');

router.get('/', authenticate, requirePermission('inventory.read'), supplierController.list);
router.get('/:id', authenticate, requirePermission('inventory.read'), supplierController.getById);
router.post('/', authenticate, requirePermission('inventory.create'), supplierController.create);
router.put('/:id', authenticate, requirePermission('inventory.update'), supplierController.update);
router.delete('/:id', authenticate, requirePermission('inventory.delete'), supplierController.remove);

module.exports = router;
