'use strict';
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { User, RefreshToken, Role, Permission } = require('../models');

const generateAccessToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
  });
};

const generateRefreshToken = (userId) => {
  const token = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
  });
  return token;
};

const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'username, email, password are required' });
    }

    const existing = await User.findOne({
      where: {
        [Op.or]: [{ username }, { email }],
      },
    });

    if (existing) {
      return res.status(409).json({ message: 'Username or email already exists' });
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      password: hash,
    });

    return res.status(201).json({
      id: user.id,
      username: user.username,
      email: user.email,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const login = async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;

    if (!usernameOrEmail || !password) {
      return res.status(400).json({ message: 'usernameOrEmail and password are required' });
    }

    const user = await User.findOne({
      where: {
        [Op.or]: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
      },
      include: [
        {
          model: Role,
          include: [Permission],
        },
      ],
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.is_active) {
      return res.status(403).json({ message: 'User is inactive' });
    }

    const accessToken = generateAccessToken(user.id);
    const refreshTokenStr = generateRefreshToken(user.id);

    const decoded = jwt.decode(refreshTokenStr);
    const expiresAt = decoded && decoded.exp ? new Date(decoded.exp * 1000) : null;

    await RefreshToken.create({
      user_id: user.id,
      token: refreshTokenStr,
      expires_at: expiresAt,
    });

    const roles = user.Roles ? user.Roles.map((r) => r.name) : [];
    const permissions = user.Roles
      ? [
          ...new Set(
            user.Roles.flatMap((r) => (r.Permissions ? r.Permissions.map((p) => p.name) : []))
          ),
        ]
      : [];

    return res.json({
      accessToken,
      refreshToken: refreshTokenStr,
      user: {
        id: user.id,
        name: user.name || user.username,
        email: user.email,
        phone: user.phone || null,
        address: user.address || null,
        country: user.country || null,
        state: user.state || null,
        city: user.city || null,
        zip_code: user.zip_code || null,
        avatar_url: user.avatar_url || null,
        roles,
        permissions,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'refreshToken is required' });
    }

    await RefreshToken.update(
      { revoked_at: new Date() },
      { where: { token: refreshToken } }
    );

    return res.json({ message: 'Logged out' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'refreshToken is required' });
    }

    const stored = await RefreshToken.findOne({ where: { token: refreshToken } });
    if (!stored || stored.revoked_at) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    try {
      const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

      const newAccessToken = generateAccessToken(payload.userId);
      const newRefreshTokenStr = generateRefreshToken(payload.userId);
      const decoded = jwt.decode(newRefreshTokenStr);
      const expiresAt = decoded && decoded.exp ? new Date(decoded.exp * 1000) : null;

      stored.revoked_at = new Date();
      await stored.save();

      await RefreshToken.create({
        user_id: payload.userId,
        token: newRefreshTokenStr,
        expires_at: expiresAt,
      });

      return res.json({
        accessToken: newAccessToken,
        refreshToken: newRefreshTokenStr,
      });
    } catch (err) {
      stored.revoked_at = new Date();
      await stored.save();
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'oldPassword and newPassword are required' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match) {
      return res.status(400).json({ message: 'Old password is incorrect' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    user.password = hash;
    await user.save();

    return res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const me = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId, {
      include: [
        {
          model: Role,
          include: [Permission],
        },
      ],
    });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const roles = user.Roles ? user.Roles.map((r) => r.name) : [];
    const permissions = user.Roles
      ? [
          ...new Set(
            user.Roles.flatMap((r) => (r.Permissions ? r.Permissions.map((p) => p.name) : []))
          ),
        ]
      : [];

    return res.json({
      id: user.id,
      name: user.name || user.username,
      email: user.email,
      phone: user.phone || null,
      address: user.address || null,
      country: user.country || null,
      state: user.state || null,
      city: user.city || null,
      zip_code: user.zip_code || null,
      avatar_url: user.avatar_url || null,
      roles,
      permissions,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  register,
  login,
  logout,
  refreshToken,
  changePassword,
  me,
};
