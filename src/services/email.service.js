'use strict';

const nodemailer = require('nodemailer');
const { Setting } = require('../models');

async function loadMailConfig() {
  const rows = await Setting.findAll({ where: { key: ['smtp_user', 'smtp_password', 'mail_from'] } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const user = map.smtp_user || process.env.SMTP_USER;
  const pass = map.smtp_password || process.env.SMTP_PASSWORD;
  const from = map.mail_from || process.env.MAIL_FROM || 'no-reply@example.com';

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: user
      ? {
          user,
          pass,
        }
      : undefined,
  });

  return { transporter, from };
}

async function sendMail({ to, subject, html }) {
  if (!to) {
    throw new Error('sendMail: `to` is required');
  }

  const { transporter, from } = await loadMailConfig();

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    html,
  });

  // eslint-disable-next-line no-console
  console.log('Email sent:', info.messageId);

  return info;
}

module.exports = {
  sendMail,
};
