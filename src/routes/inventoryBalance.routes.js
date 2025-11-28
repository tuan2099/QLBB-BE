'use strict';
const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middlewares/auth.middleware');
const inventoryBalanceController = require('../controllers/inventoryBalance.controller');

router.get('/', authenticate, requirePermission('inventory.read'), inventoryBalanceController.list);

module.exports = router;
