'use strict';

const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middlewares/auth.middleware');
const settingController = require('../controllers/setting.controller');

// Lấy cấu hình mail hiện tại
router.get('/mail', authenticate, requirePermission('settings.read'), settingController.getMailSettings);

// Cập nhật cấu hình mail
router.put('/mail', authenticate, requirePermission('settings.update'), settingController.updateMailSettings);

// Gửi thử báo cáo tồn kho qua mail
router.post(
  '/mail/test',
  authenticate,
  requirePermission('settings.update'),
  settingController.testSendInventoryReportEmail
);

// Gửi thử cảnh báo tồn tối thiểu qua mail
router.post(
  '/mail/test-low-stock',
  authenticate,
  requirePermission('settings.update'),
  settingController.testSendLowStockAlertEmail
);

module.exports = router;
