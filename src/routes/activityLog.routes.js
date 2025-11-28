'use strict';
const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middlewares/auth.middleware');
const activityLogController = require('../controllers/activityLog.controller');

// Tạm thời dùng quyền user.read để xem / xuất activity logs (thường chỉ admin có)
router.get('/', authenticate, requirePermission('user.read'), activityLogController.list);
router.get('/export', authenticate, requirePermission('user.read'), activityLogController.exportAll);

module.exports = router;
