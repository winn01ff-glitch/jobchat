import nodemailer from 'nodemailer';
import { NextResponse } from 'next/server';
import { supabaseClient } from '../../../../lib/supabase';

export const dynamic = 'force-dynamic';

const emailTemplates = {
  vi: {
    subject: (otp) => `[Uphill Jobchat] Mã xác thực đăng nhập: ${otp}`,
    title: 'Uphill Jobchat',
    greeting: 'Xin chào,',
    body: 'Bạn đang thực hiện đăng nhập hoặc đăng ký tài khoản trên hệ thống Uphill Jobchat. Dưới đây là mã xác thực (OTP) của bạn:',
    expiry: '* Mã xác thực này có hiệu lực trong vòng 10 phút và chỉ sử dụng được 1 lần.',
    ignore: 'Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.',
    footer: '© 2026 Uphill. All rights reserved.'
  },
  en: {
    subject: (otp) => `[Uphill Jobchat] Verification Code: ${otp}`,
    title: 'Uphill Jobchat',
    greeting: 'Hello,',
    body: 'You are logging in or registering an account on the Uphill Jobchat system. Below is your verification code (OTP):',
    expiry: '* This verification code is valid for 10 minutes and can only be used once.',
    ignore: 'If you did not request this, please ignore this email.',
    footer: '© 2026 Uphill. All rights reserved.'
  },
  ja: {
    subject: (otp) => `[Uphill Jobchat] ログイン認証コード：${otp}`,
    title: 'Uphill Jobchat',
    greeting: 'こんにちは、',
    body: 'Uphill Jobchatシステムへのログインまたはアカウント登録を行っています。以下はあなたの認証コード（OTP）です：',
    expiry: '※この認証コードの有効期限は10分間で、1回のみ使用可能です。',
    ignore: 'このリクエストに覚えがない場合は、このメールを無視してください。',
    footer: '© 2026 Uphill. All rights reserved.'
  },
  my: {
    subject: (otp) => `[Uphill Jobchat] အတည်ပြုကုဒ်: ${otp}`,
    title: 'Uphill Jobchat',
    greeting: 'မင်္ဂလာပါ၊',
    body: 'သင်သည် Uphill Jobchat စနစ်တွင် လော့ဂ်အင်ဝင်ခြင်း သို့မဟုတ် အကောင့်ဖွင့်ခြင်း ပြုလုပ်နေပါသည်။ သင်၏အတည်ပြုကုဒ် (OTP) မှာ အောက်ပါအတိုင်း ဖြစ်ပါသည်:',
    expiry: '* ဤအတည်ပြုကုဒ်သည် ၁၀ မိနစ်အတွင်းသာ အကျုံးဝင်ပြီး တစ်ကြိမ်သာ အသုံးပြုနိုင်ပါသည်။',
    ignore: 'အကယ်၍ သင်သည် ဤတောင်းဆိုမှုကို မပြုလုပ်ခဲ့ပါက ဤအီးမေးလ်ကို လျစ်လျူရှုလိုက်ပါ။',
    footer: '© 2026 Uphill. All rights reserved.'
  },
  pt: {
    subject: (otp) => `[Uphill Jobchat] Código de verificação: ${otp}`,
    title: 'Uphill Jobchat',
    greeting: 'Olá,',
    body: 'Você está fazendo login ou registrando uma conta no sistema Uphill Jobchat. Abaixo está o seu código de verificação (OTP):',
    expiry: '* Este código de verificação é válido por 10 minutos e só pode ser usado uma vez.',
    ignore: 'Se você não solicitou isso, desconsidere este e-mail.',
    footer: '© 2026 Uphill. All rights reserved.'
  }
};

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, lang } = body;
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const selectedLang = lang || 'vi';
    const template = emailTemplates[selectedLang] || emailTemplates['vi'];
    
    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Save OTP to database via RPC
    const { data: success, error: rpcError } = await supabaseClient
      .rpc('request_otp', { email_param: cleanEmail, code_param: otpCode });

    if (rpcError || !success) {
      console.error('[Auth OTP] Failed to save OTP in database:', rpcError);
      return NextResponse.json({ error: 'Failed to generate OTP' }, { status: 500 });
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT || 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.warn('[Auth OTP] SMTP is not configured. OTP code is:', otpCode);
      return NextResponse.json({
        status: 'skipped',
        message: 'SMTP is not configured. (Dev mode: OTP is printed to console)',
        otp: process.env.NODE_ENV !== 'production' ? otpCode : undefined
      });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort),
      secure: Number(smtpPort) === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const mailOptions = {
      from: `"Uphill Jobchat" <${smtpUser}>`,
      to: cleanEmail,
      subject: template.subject(otpCode),
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 25px; border: 1px solid #e1e8ed; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #0084ff; margin: 0; font-size: 24px; font-weight: 800;">${template.title}</h2>
          </div>
          <p style="font-size: 16px; color: #333; line-height: 1.5; margin: 0 0 16px;">${template.greeting}</p>
          <p style="font-size: 15px; color: #555; line-height: 1.5; margin: 0 0 20px;">${template.body}</p>
          
          <div style="text-align: center; margin: 24px 0; padding: 16px; background-color: #f5f8fa; border-radius: 8px; border: 1px dashed #cbd5e1;">
            <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #0084ff; font-family: monospace;">${otpCode}</span>
          </div>
          
          <p style="font-size: 13px; color: #e11d48; margin: 0 0 16px; font-weight: 600;">${template.expiry}</p>
          <p style="font-size: 14px; color: #666; line-height: 1.5; margin: 0 0 20px;">${template.ignore}</p>
          <hr style="border: none; border-top: 1px solid #e1e8ed; margin: 24px 0 16px;" />
          <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">${template.footer}</p>
        </div>
      `,
    };

    // Send email asynchronously in the background to return response instantly to user
    transporter.sendMail(mailOptions)
      .then(() => {
        console.log(`[Auth OTP] Email sent successfully to ${cleanEmail}`);
      })
      .catch((err) => {
        console.error(`[Auth OTP] Failed to send email to ${cleanEmail}:`, err);
      });

    return NextResponse.json({
      status: 'success',
      message: 'OTP sent successfully'
    });
  } catch (err) {
    console.error('[Auth OTP] Error in send-otp API:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to send OTP email' },
      { status: 500 }
    );
  }
}
