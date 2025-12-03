'use strict';
const express = require('express');
const router = express.Router();
const warehouseRoutes = require('./warehouse.routes');
const supplierRoutes = require('./supplier.routes');
const customerRoutes = require('./customer.routes');
const productRoutes = require('./product.routes');
const stockInRoutes = require('./stockIn.routes');
const inventoryBalanceRoutes = require('./inventoryBalance.routes');
const stockOutRoutes = require('./stockOut.routes');
const stockTransferRoutes = require('./stockTransfer.routes');
const stockTakeRoutes = require('./stockTake.routes');
const reportRoutes = require('./report.routes');

router.use('/warehouses', warehouseRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/customers', customerRoutes);
router.use('/products', productRoutes);
router.use('/stock-ins', stockInRoutes);
router.use('/balances', inventoryBalanceRoutes);
router.use('/stock-outs', stockOutRoutes);
router.use('/stock-transfers', stockTransferRoutes);
router.use('/stock-takes', stockTakeRoutes);
router.use('/reports', reportRoutes);

module.exports = router;
