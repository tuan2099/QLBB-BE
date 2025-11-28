'use strict';

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: process.env.SMTP_USER
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      }
    : undefined,
});

const DEFAULT_FROM = process.env.MAIL_FROM || 'no-reply@example.com';

async function sendMail({ to, subject, html }) {
  if (!to) {
    throw new Error('sendMail: `to` is required');
  }

  const info = await transporter.sendMail({
    from: DEFAULT_FROM,
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
