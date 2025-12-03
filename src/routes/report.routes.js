'use strict';
const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middlewares/auth.middleware');
const reportController = require('../controllers/report.controller');

// Tổng nhập theo kỳ
router.get(
  '/stock-ins',
  authenticate,
  requirePermission('inventory.read'),
  reportController.stockInSummary
);

// Tổng xuất theo kỳ
router.get(
  '/stock-outs',
  authenticate,
  requirePermission('inventory.read'),
  reportController.stockOutSummary
);

// Tổng chuyển kho theo kỳ
router.get(
  '/stock-transfers',
  authenticate,
  requirePermission('inventory.read'),
  reportController.stockTransferSummary
);

// Tồn cuối kỳ theo kho + sản phẩm
router.get(
  '/stock-balance-period',
  authenticate,
  requirePermission('inventory.read'),
  reportController.stockBalancePeriod
);

module.exports = router;
