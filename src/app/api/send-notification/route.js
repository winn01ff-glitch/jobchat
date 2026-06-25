import nodemailer from 'nodemailer';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { type, applicantName, applicantEmail, applicantPhone, applicantPosition, messageContent } = body;

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT || 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    // If SMTP details are not configured, log a warning and return success.
    // This prevents the application from failing or throwing 500 errors in local dev without SMTP.
    if (!smtpHost || !smtpUser || !smtpPass) {
      console.warn('[Mail Notification] SMTP environment variables are missing. Skip sending email.');
      return NextResponse.json({
        status: 'skipped',
        message: 'SMTP is not configured. Email notification was skipped.'
      });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort),
      secure: Number(smtpPort) === 465, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    let subject = '';
    let htmlContent = '';

    if (type === 'registration') {
      subject = `[Uphill Jobchat] Ứng viên mới đăng ký: ${applicantName}`;
      htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #0070f3; margin-top: 0;">Thông báo ứng viên mới</h2>
          <p>Có một ứng viên mới vừa đăng ký trên hệ thống Uphill Jobchat:</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; width: 150px; border-bottom: 1px solid #eee;">Họ và tên:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${applicantName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #eee;">Email:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><a href="mailto:${applicantEmail}">${applicantEmail}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #eee;">Số điện thoại:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${applicantPhone || 'Chưa cung cấp'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #eee;">Vị trí ứng tuyển:</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${applicantPosition || 'Khác'}</td>
            </tr>
          </table>
          <div style="margin-top: 30px; text-align: center;">
            <a href="https://uphill-jobchat.vercel.app/admin/dashboard" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Truy cập bảng điều khiển Admin</a>
          </div>
        </div>
      `;
    } else if (type === 'message') {
      subject = `[Uphill Jobchat] Tin nhắn mới từ ứng viên: ${applicantName}`;
      
      // Check if message content is JSON (indicates file/image/location)
      let displayContent = messageContent;
      try {
        const parsed = JSON.parse(messageContent);
        if (parsed.type === 'image') {
          displayContent = `[Đã gửi một hình ảnh] - Tên file: ${parsed.name || 'Image'}`;
        } else if (parsed.type === 'file') {
          displayContent = `[Đã gửi một tệp đính kèm] - Tên file: ${parsed.name || 'File'}`;
        } else if (parsed.type === 'location') {
          displayContent = `[Đã gửi vị trí định vị GPS]`;
        }
      } catch (e) {
        // Not JSON, display as normal text
      }

      htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #0070f3; margin-top: 0;">Tin nhắn mới nhận</h2>
          <p>Ứng viên <strong>${applicantName}</strong> (${applicantEmail}) vừa gửi tin nhắn mới đến admin:</p>
          <div style="background-color: #f7f9fa; padding: 15px; border-left: 4px solid #0070f3; margin: 20px 0; font-style: italic; white-space: pre-wrap; color: #333;">${displayContent}</div>
          <div style="margin-top: 30px; text-align: center;">
            <a href="https://uphill-jobchat.vercel.app/admin/dashboard" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Trả lời trong phòng chat</a>
          </div>
        </div>
      `;
    }

    const mailOptions = {
      from: `"Uphill Jobchat" <${smtpUser}>`,
      to: 'winn01ff@gmail.com',
      subject: subject,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[Mail Notification] Email sent successfully:', info.messageId);

    return NextResponse.json({
      status: 'success',
      messageId: info.messageId
    });
  } catch (err) {
    console.error('[Mail Notification] Failed to send email:', err.message || err);
    return NextResponse.json(
      { status: 'error', message: err.message || 'Failed to send email notification' },
      { status: 500 }
    );
  }
}
