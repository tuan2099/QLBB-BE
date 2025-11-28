'use strict';
const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middlewares/auth.middleware');
const stockOutController = require('../controllers/stockOut.controller');

// Authenticated inventory operations
router.get('/', authenticate, requirePermission('inventory.read'), stockOutController.list);
router.get('/:id', authenticate, requirePermission('inventory.read'), stockOutController.getById);
router.post('/', authenticate, requirePermission('inventory.create'), stockOutController.create);
router.put('/:id', authenticate, requirePermission('inventory.update'), stockOutController.update);
router.delete('/:id', authenticate, requirePermission('inventory.delete'), stockOutController.remove);
router.post('/:id/confirm', authenticate, requirePermission('inventory.update'), stockOutController.confirm);
router.delete('/:id/permanent', authenticate, requirePermission('inventory.delete'), stockOutController.permanentRemove);

// Receiver signature flow
// Gửi email link ký nhận (cần quyền cập nhật inventory)
router.post(
  '/:id/send-receive-sign-link',
  authenticate,
  requirePermission('inventory.update'),
  stockOutController.sendReceiveSignLink
);

// Ký nhận tại chỗ trong hệ thống (onsite) - cần quyền cập nhật
router.post(
  '/:id/receive-sign-onsite',
  authenticate,
  requirePermission('inventory.update'),
  stockOutController.receiveSignOnsite
);

// Public routes (không cần auth) cho người nhận ở xa dùng token
router.get('/receive-sign/:token', stockOutController.getReceiveSignInfo);
router.post('/receive-sign/:token', stockOutController.receiveSignByToken);

module.exports = router;
