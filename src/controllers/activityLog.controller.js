"use strict";
const { Op } = require('sequelize');
const { ActivityLog, User } = require('../models');

// GET /activity-logs?page=1&limit=20&user_id=&method=&status_code=&endpoint=
const buildWhereFromQuery = (query) => {
  const { user_id, method, status_code, endpoint } = query;

  const where = {};

  if (user_id) {
    where.user_id = user_id;
  }
  if (method) {
    where.method = method.toUpperCase();
  }
  if (status_code) {
    where.status_code = status_code;
  }
  if (endpoint) {
    where.endpoint = { [Op.like]: `%${endpoint}%` };
  }

  return where;
};

const list = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const where = buildWhereFromQuery(req.query);

  const pageNum = Math.max(Number(page) || 1, 1);
  const limitNum = Math.max(Number(limit) || 20, 1);
  const offset = (pageNum - 1) * limitNum;

  const { rows, count } = await ActivityLog.findAndCountAll({
    where,
    include: [
      {
        model: User,
        attributes: ['id', 'username', 'email'],
      },
    ],
    order: [['created_at', 'DESC']],
    offset,
    limit: limitNum,
  });

  return res.json({
    data: rows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: count,
      totalPages: Math.ceil(count / limitNum) || 1,
    },
  });
};

// GET /activity-logs/export?user_id=&method=&status_code=&endpoint=
// Xuất toàn bộ logs (theo filter nếu có) ra CSV để mở bằng Excel
const exportAll = async (req, res) => {
  const where = buildWhereFromQuery(req.query);

  const rows = await ActivityLog.findAll({
    where,
    include: [
      {
        model: User,
        attributes: ['id', 'username', 'email'],
      },
    ],
    order: [['created_at', 'DESC']],
  });

  const header = [
    'id',
    'user_id',
    'user_username',
    'user_email',
    'method',
    'endpoint',
    'status_code',
    'payload_summary',
    'created_at',
  ];

  const escapeCsv = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const lines = [];
  lines.push(header.join(','));

  rows.forEach((log) => {
    const createdAt = log.created_at || log.createdAt;
    const user = log.User || {};
    const line = [
      escapeCsv(log.id),
      escapeCsv(log.user_id),
      escapeCsv(user.username || ''),
      escapeCsv(user.email || ''),
      escapeCsv(log.method),
      escapeCsv(log.endpoint),
      escapeCsv(log.status_code),
      escapeCsv(log.payload_summary),
      escapeCsv(createdAt ? new Date(createdAt).toISOString() : ''),
    ];
    lines.push(line.join(','));
  });

  const csvContent = lines.join('\n');

  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="activity_logs_${timestamp}.csv"`);

  return res.send(csvContent);
};

module.exports = {
  list,
  exportAll,
};
