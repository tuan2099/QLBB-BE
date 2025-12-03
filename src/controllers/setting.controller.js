
'use strict';

const { Setting } = require('../models');
const { sendInventoryReportEmail, sendLowStockAlertEmail } = require('../jobs/reportEmail.scheduler');

const MAIL_KEYS = ['smtp_user', 'smtp_password', 'mail_from', 'report_recipients'];

const getMailSettings = async (req, res) => {
  try {
    const rows = await Setting.findAll({ where: { key: MAIL_KEYS } });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    return res.json({
      smtp_user: map.smtp_user || '',
      smtp_password: map.smtp_password || '',
      mail_from: map.mail_from || '',
      report_recipients: map.report_recipients || '',
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('getMailSettings error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const updateMailSettings = async (req, res) => {
  try {
    const { smtp_user, smtp_password, mail_from, report_recipients } = req.body || {};
    const payload = { smtp_user, smtp_password, mail_from, report_recipients };

    for (const key of MAIL_KEYS) {
      if (typeof payload[key] === 'undefined') continue;

      // upsert by key
      const [row] = await Setting.findOrCreate({
        where: { key },
        defaults: { value: payload[key] },
      });
      row.value = payload[key];
      await row.save();
    }

    const rows = await Setting.findAll({ where: { key: MAIL_KEYS } });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    return res.json({
      smtp_user: map.smtp_user || '',
      smtp_password: map.smtp_password || '',
      mail_from: map.mail_from || '',
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('updateMailSettings error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const testSendInventoryReportEmail = async (req, res) => {
  try {
    let { type, year, month, quarter } = req.body || {};

    // Mặc định: gửi báo cáo tháng hiện tại nếu không truyền gì
    if (!type) {
      type = 'month';
    }

    const now = new Date();
    if (!year) {
      year = now.getFullYear();
    }

    if (type === 'month' && !month) {
      month = now.getMonth() + 1; // 1-12
    }

    if (type === 'quarter' && !quarter) {
      quarter = Math.floor(now.getMonth() / 3) + 1; // 1-4
    }

    await sendInventoryReportEmail({ type, year, month, quarter });

    return res.json({ message: 'Đã gửi yêu cầu gửi thử báo cáo tồn kho (kiểm tra email nhận báo cáo).' });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('testSendInventoryReportEmail error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const testSendLowStockAlertEmail = async (req, res) => {
  try {
    await sendLowStockAlertEmail();

    return res.json({ message: 'Đã gửi yêu cầu gửi thử cảnh báo tồn tối thiểu (kiểm tra email nhận báo cáo).' });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('testSendLowStockAlertEmail error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getMailSettings,
  updateMailSettings,
  testSendInventoryReportEmail,
  testSendLowStockAlertEmail,
};
