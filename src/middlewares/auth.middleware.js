'use strict';
const jwt = require('jsonwebtoken');
const { User, Role, Permission } = require('../models');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findByPk(payload.userId, {
      include: {
        model: Role,
        include: [Permission],
      },
    });

    if (!user || !user.is_active) {
      return res.status(401).json({ message: 'User is inactive or not found' });
    }

    const permissionsSet = new Set();
    user.Roles?.forEach((role) => {
      role.Permissions?.forEach((perm) => permissionsSet.add(perm.name));
    });

    req.user = {
      id: user.id,
      username: user.username,
      permissions: Array.from(permissionsSet),
    };

    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const requirePermission = (permissionName) => {
  return (req, res, next) => {
    if (!req.user || !req.user.permissions?.includes(permissionName)) {
      return res.status(403).json({ message: 'Forbidden: insufficient permission' });
    }
    next();
  };
};

module.exports = {
  authenticate,
  requirePermission,
};
