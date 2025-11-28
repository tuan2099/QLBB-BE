'use strict';
const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middlewares/auth.middleware');
const stockTakeController = require('../controllers/stockTake.controller');

router.get('/', authenticate, requirePermission('inventory.read'), stockTakeController.list);
router.get('/:id', authenticate, requirePermission('inventory.read'), stockTakeController.getById);
router.post('/', authenticate, requirePermission('inventory.create'), stockTakeController.create);
router.put('/:id', authenticate, requirePermission('inventory.update'), stockTakeController.update);
router.delete('/:id', authenticate, requirePermission('inventory.delete'), stockTakeController.remove);
router.post('/:id/confirm', authenticate, requirePermission('inventory.update'), stockTakeController.confirm);
router.delete(
  '/:id/permanent',
  authenticate,
  requirePermission('inventory.delete'),
  stockTakeController.permanentRemove
);

module.exports = router;
