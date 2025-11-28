'use strict';
const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middlewares/auth.middleware');
const productController = require('../controllers/product.controller');

router.get('/', authenticate, requirePermission('product.read'), productController.list);
router.get('/:id', authenticate, requirePermission('product.read'), productController.getById);
router.post('/', authenticate, requirePermission('product.create'), productController.create);
router.put('/:id', authenticate, requirePermission('product.update'), productController.update);
router.delete('/:id', authenticate, requirePermission('product.delete'), productController.remove);

module.exports = router;
