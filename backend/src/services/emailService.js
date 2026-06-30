const nodemailer = require('nodemailer');
const axios = require('axios');
require('dotenv').config();

let transporter;

async function getTransporter() {
  if (transporter) return transporter;

  const provider = process.env.EMAIL_SERVICE_PROVIDER || 'ethereal';

  if (provider === 'ethereal') {
    console.log('Initializing Ethereal Mail test account...');
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    console.log(`Ethereal account created. Username: ${testAccount.user}`);
  } else if (provider === 'smtp') {
    console.log('Initializing SMTP Mail transport...');
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  return transporter;
}

/**
 * Universal mail sender supporting Ethereal, SMTP, and Resend HTTP API
 */
async function sendMail({ to, subject, html }) {
  const provider = process.env.EMAIL_SERVICE_PROVIDER || 'ethereal';
  const from = process.env.SMTP_FROM || 'LotusTime <onboarding@resend.dev>';

  // If using Resend HTTP API (Ideal for GCP to bypass SMTP port blocking)
  if (provider === 'resend') {
    console.log(`Sending email to ${to} via Resend HTTP API...`);
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not defined in environment variables');
    }

    try {
      const response = await axios.post('https://api.resend.com/emails', {
        from: from,
        to: [to],
        subject: subject,
        html: html
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      console.log(`Email sent successfully via Resend. Message ID: ${response.data.id}`);
      return response.data;
    } catch (err) {
      console.error('Error sending email via Resend:', err.response ? err.response.data : err.message);
      throw err;
    }
  }

  // Fallback to Nodemailer (SMTP or Ethereal)
  const client = await getTransporter();
  const mailOptions = {
    from: from,
    to: to,
    subject: subject,
    html: html
  };

  const info = await client.sendMail(mailOptions);
  
  if (provider === 'ethereal') {
    console.log(`Email sent. Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
  } else {
    console.log(`Email sent successfully to ${to}. Message ID: ${info.messageId}`);
  }
  
  return info;
}

async function sendResetPasswordEmail(email, username, resetToken) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
      <h2 style="color: #76b900; border-bottom: 2px solid #76b900; padding-bottom: 10px;">Đặt lại mật khẩu của bạn</h2>
      <p>Xin chào <strong>${username}</strong>,</p>
      <p>Hệ thống LotusTime đã nhận được yêu cầu đặt lại mật khẩu của bạn. Vui lòng bấm vào liên kết dưới đây để thiết lập mật khẩu mới:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" style="background-color: #76b900; color: #000; padding: 12px 25px; text-decoration: none; border-radius: 3px; font-weight: bold; display: inline-block;">Đặt lại mật khẩu</a>
      </div>
      <p style="color: #e52020; font-weight: bold;">Lưu ý: Liên kết này chỉ có hiệu lực trong vòng 15 phút.</p>
      <p>Nếu bạn không gửi yêu cầu này, vui lòng bỏ qua email này. Mật khẩu của bạn vẫn sẽ được giữ nguyên.</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
      <p style="font-size: 12px; color: #777; text-align: center;">Đây là email tự động từ hệ thống LotusTime, vui lòng không trả lời email này.</p>
    </div>
  `;

  return sendMail({ to: email, subject: '[LotusTime] Yêu cầu đặt lại mật khẩu', html });
}

async function sendAccountCredentialsEmail(email, username, password) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const loginLink = `${frontendUrl}/login`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
      <h2 style="color: #76b900; border-bottom: 2px solid #76b900; padding-bottom: 10px;">Tài khoản LotusTime của bạn đã được khởi tạo</h2>
      <p>Xin chào,</p>
      <p>Tài khoản truy cập hệ thống xếp lịch LotusTime của bạn đã được quản trị viên khởi tạo thành công. Thông tin đăng nhập chi tiết như sau:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; width: 150px;">Đường dẫn:</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;"><a href="${loginLink}">${loginLink}</a></td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Tên đăng nhập:</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;"><code>${username}</code></td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Mật khẩu:</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;"><code>${password}</code></td>
        </tr>
      </table>
      <p style="color: #e52020; font-weight: bold;">Lưu ý: Trong lần đăng nhập đầu tiên, bạn sẽ được yêu cầu đổi mật khẩu mới để đảm bảo tính bảo mật.</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
      <p style="font-size: 12px; color: #777; text-align: center;">Đây là email tự động từ hệ thống LotusTime, vui lòng không trả lời email này.</p>
    </div>
  `;

  return sendMail({ to: email, subject: '[LotusTime] Thông tin tài khoản của bạn', html });
}

module.exports = {
  sendResetPasswordEmail,
  sendAccountCredentialsEmail
};
