'use strict';
const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middlewares/auth.middleware');
const userController = require('../controllers/user.controller');

router.get('/', authenticate, requirePermission('user.read'), userController.list);
router.get('/:id', authenticate, requirePermission('user.read'), userController.getById);
router.post('/', authenticate, requirePermission('user.create'), userController.create);
router.put('/:id', authenticate, requirePermission('user.update'), userController.update);
router.delete('/:id', authenticate, requirePermission('user.delete'), userController.remove);

module.exports = router;
