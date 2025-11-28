'use strict';
const { ActivityLog } = require('../models');

const activityLogger = async (req, res, next) => {
  const start = Date.now();
  const originalJson = res.json.bind(res);

  res.json = async (body) => {
    const duration = Date.now() - start;
    try {
      const payload = req.body && Object.keys(req.body).length
        ? JSON.stringify(req.body).slice(0, 1000)
        : null;

      await ActivityLog.create({
        user_id: req.user ? req.user.id : null,
        endpoint: req.originalUrl,
        method: req.method,
        payload_summary: payload,
        ip_address: req.ip,
        user_agent: req.headers['user-agent'] || null,
        status_code: res.statusCode,
      });
    } catch (e) {
      // không log lỗi vào response
      console.error('Failed to log activity', e.message);
    }

    return originalJson(body);
  };

  next();
};

module.exports = activityLogger;
