'use strict';
const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middlewares/auth.middleware');
const customerController = require('../controllers/customer.controller');

router.get('/', authenticate, requirePermission('inventory.read'), customerController.list);
router.get('/:id', authenticate, requirePermission('inventory.read'), customerController.getById);
router.post('/', authenticate, requirePermission('inventory.create'), customerController.create);
router.put('/:id', authenticate, requirePermission('inventory.update'), customerController.update);
router.delete('/:id', authenticate, requirePermission('inventory.delete'), customerController.remove);

module.exports = router;
