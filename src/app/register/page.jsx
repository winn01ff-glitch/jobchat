'use client';
import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '../../context/LanguageContext';
import { useNotification } from '../../context/NotificationContext';
import { DB } from '../../lib/supabase';

function RegisterContent() {
  const { t } = useLanguage();
  const { showToast } = useNotification();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlPosition = searchParams ? searchParams.get('position') : '';
  
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('');
  const [isModalLoading, setIsModalLoading] = useState(false);

  const [step, setStep] = useState('email'); // 'email' or 'otp'
  const [otp, setOtp] = useState('');
  const [isOtpLoading, setIsOtpLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    const sessionStr = localStorage.getItem('jobchat_session');
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        if (session && session.id) {
          router.push(`/chat/${session.id}`);
          return;
        }
      } catch(e) {}
    }

    const cachedEmail = localStorage.getItem('uphill_email');
    if (cachedEmail) setEmail(cachedEmail);
  }, [router]);

  useEffect(() => {
    if (urlPosition) {
      setPosition(urlPosition);
    }
  }, [urlPosition]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleResendOtp = async () => {
    if (countdown > 0 || isResending) return;
    setIsResending(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const currentLang = (typeof window !== 'undefined' ? localStorage.getItem('jobchat_lang') : 'vi') || 'vi';
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, lang: currentLang })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }

      showToast(t('register.otpSent') || 'Mã xác thực đã được gửi tới email của bạn!', 'success');
      setCountdown(60);
    } catch(err) {
      console.error('Resend OTP failed:', err);
      showToast(t('register.sendOtpFailed') || 'Gửi mã xác thực thất bại. Vui lòng thử lại.', 'error');
    } finally {
      setIsResending(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    
    if (!cleanEmail) {
      showToast(t('register.fillAll') || 'Vui lòng điền đầy đủ thông tin', 'error');
      return;
    }

    setIsLoading(true);

    try {
      // Check if we have a saved token for this specific email in localStorage
      const cachedSessionsStr = localStorage.getItem('uphill_cached_sessions');
      let cachedSessions = {};
      if (cachedSessionsStr) {
        try {
          cachedSessions = JSON.parse(cachedSessionsStr);
        } catch (e) {}
      }

      const savedToken = cachedSessions[cleanEmail];
      if (savedToken) {
        const applicant = await DB.getApplicantByToken(savedToken);
        if (applicant && applicant.email.toLowerCase() === cleanEmail) {
          localStorage.setItem('uphill_email', cleanEmail);
          localStorage.setItem('jobchat_session', JSON.stringify({
            id: applicant.id,
            name: applicant.name,
            email: cleanEmail,
            token: savedToken
          }));
          showToast(t('register.welcomeBack') || 'Chào mừng quay trở lại!', 'success');
          window.dispatchEvent(new Event('authChange'));
          router.push(`/chat/${applicant.id}`);
          setIsLoading(false);
          return;
        }
      }

      const currentLang = (typeof window !== 'undefined' ? localStorage.getItem('jobchat_lang') : 'vi') || 'vi';
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, lang: currentLang })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }

      showToast(t('register.otpSent') || 'Mã xác thực đã được gửi tới email của bạn!', 'success');
      setStep('otp');
      setCountdown(60);
    } catch(err) {
      console.error('Send OTP failed:', err);
      showToast(t('register.sendOtpFailed') || 'Gửi mã xác thực thất bại. Vui lòng thử lại.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    if (!cleanOtp) {
      showToast(t('register.enterOtp') || 'Vui lòng nhập mã xác thực', 'error');
      return;
    }

    setIsOtpLoading(true);

    try {
      const result = await DB.verifyOtp(cleanEmail, cleanOtp);
      
      if (!result || !result.success) {
        showToast(t('register.invalidOtp') || 'Mã xác thực không chính xác hoặc đã hết hạn.', 'error');
        setIsOtpLoading(false);
        return;
      }

      if (result.is_existing) {
        localStorage.setItem('uphill_email', cleanEmail);
        localStorage.setItem('jobchat_session', JSON.stringify({
          id: result.applicant.id,
          name: result.applicant.name,
          email: cleanEmail,
          token: result.applicant.session_token
        }));

        // Cache the session token for this email
        try {
          const cachedSessionsStr = localStorage.getItem('uphill_cached_sessions') || '{}';
          const cachedSessions = JSON.parse(cachedSessionsStr);
          cachedSessions[cleanEmail] = result.applicant.session_token;
          localStorage.setItem('uphill_cached_sessions', JSON.stringify(cachedSessions));
        } catch (e) {}

        showToast(t('register.welcomeBack') || 'Chào mừng quay trở lại!', 'success');
        window.dispatchEvent(new Event('authChange'));
        router.push(`/chat/${result.applicant.id}`);
      } else {
        setShowModal(true);
      }
    } catch (err) {
      console.error('Verify OTP failed:', err);
      showToast(t('common.error') || 'Đã xảy ra lỗi', 'error');
    } finally {
      setIsOtpLoading(false);
    }
  };

  const confirmDisplayName = async () => {
    const cleanName = name.trim();
    if (!cleanName) {
      document.getElementById('modal-display-name')?.focus();
      return;
    }

    setIsModalLoading(true);
    try {
      const result = await DB.registerNewApplicant({
        name: cleanName,
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        position: position || urlPosition || 'other',
        language: typeof window !== 'undefined' ? localStorage.getItem('jobchat_lang') : 'vi'
      });

      if (!result || !result.success) {
        throw new Error(result?.message || 'Registration failed');
      }

      localStorage.setItem('uphill_email', email.trim().toLowerCase());
      localStorage.setItem('jobchat_session', JSON.stringify({
        id: result.id, name: result.name,
        email: email.trim().toLowerCase(), token: result.session_token
      }));

      // Cache the session token for this email
      try {
        const cleanEmail = email.trim().toLowerCase();
        const cachedSessionsStr = localStorage.getItem('uphill_cached_sessions') || '{}';
        const cachedSessions = JSON.parse(cachedSessionsStr);
        cachedSessions[cleanEmail] = result.session_token;
        localStorage.setItem('uphill_cached_sessions', JSON.stringify(cachedSessions));
      } catch (e) {}

      setShowModal(false);
      window.dispatchEvent(new Event('authChange'));
      
      if (typeof Notification !== 'undefined' && Notification.requestPermission) {
        Notification.requestPermission();
      }
      
      router.push(`/chat/${result.id}`);
    } catch(err) {
      console.error('Registration failed:', err);
      showToast(t('common.error') || 'Đã xảy ra lỗi', 'error');
      setIsModalLoading(false);
    }
  };

  return (
    <div className="form-container">
      <div className="form-card">
        <div className="form-icon-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: '#ffffff'}}><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
        </div>
        <h2 className="form-title">{t('register.title')}</h2>
        <p className="form-subtitle">{t('register.subtitle')}</p>
        
        {step === 'email' ? (
          <form id="register-form" onSubmit={handleEmailSubmit}>
            <div className="form-group">
              <label className="form-label">{t('register.email')} <span style={{color: 'var(--error)'}}>*</span></label>
              <div className="input-with-icon">
                <span className="input-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                </span>
                <input 
                  type="email" 
                  className="form-input" 
                  required 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t('register.emailPlaceholder')}
                />
              </div>
            </div>
            <button type="submit" className="form-submit" disabled={isLoading}>
              {isLoading ? <div className="spinner"></div> : <span>{t('register.submit') || 'Tiếp tục'}</span>}
            </button>
          </form>
        ) : (
          <form id="otp-form" onSubmit={handleOtpSubmit}>
            <div className="form-group">
              <label className="form-label">{t('register.enterOtp') || 'Nhập mã xác thực'} <span style={{color: 'var(--error)'}}>*</span></label>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: '1.4' }}>
                {t('register.otpSentHint') || 'Chúng tôi đã gửi mã xác thực gồm 6 chữ số đến:'} <br/>
                <strong style={{color: 'var(--text-primary)'}}>{email}</strong>
              </p>
              <div className="input-with-icon">
                <span className="input-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </span>
                <input 
                  type="text" 
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="form-input" 
                  required 
                  maxLength={6}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  onKeyPress={e => {
                    if (!/[0-9]/.test(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  placeholder="------"
                  style={{ textAlign: 'center', letterSpacing: '6px', fontSize: '20px', fontWeight: 'bold' }}
                />
              </div>
            </div>
            <button type="submit" className="form-submit" disabled={isOtpLoading}>
              {isOtpLoading ? <div className="spinner"></div> : <span>{t('register.verify') || 'Xác thực & Bắt đầu chat'}</span>}
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
              {countdown > 0 ? (
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  {t('register.resendCountdown') ? t('register.resendCountdown').replace('{seconds}', countdown) : `Gửi lại mã sau ${countdown}s`}
                </span>
              ) : (
                <button 
                  type="button" 
                  onClick={handleResendOtp}
                  disabled={isResending}
                  style={{
                    background: 'none', border: 'none', 
                    color: 'var(--messenger-blue)', fontSize: '13px', cursor: 'pointer',
                    textDecoration: 'underline', padding: 0
                  }}
                >
                  {isResending ? '...' : (t('register.resendOtp') || 'Gửi lại mã OTP')}
                </button>
              )}
              
              <button 
                type="button" 
                onClick={() => setStep('email')} 
                style={{
                  background: 'none', border: 'none', 
                  color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer',
                  textDecoration: 'underline', padding: 0
                }}
              >
                {t('register.changeEmail') || 'Thay đổi email'}
              </button>
            </div>
          </form>
        )}
      </div>

      {showModal && (
        <div className="confirm-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="job-form-card" style={{maxWidth: '420px'}} onClick={e => e.stopPropagation()}>
            <div className="job-form-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--messenger-blue)'}}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                {t('register.enterName')}
              </h3>
              <button className="job-form-close" onClick={() => setShowModal(false)} style={{background:'none',border:'none',fontSize:'20px',cursor:'pointer',color:'var(--text-muted)',padding:'4px 8px',lineHeight:1}}>✕</button>
            </div>
            <div className="job-form-body">
              <p style={{color:'var(--text-secondary)',margin:'0 0 16px',fontSize:'var(--font-sm)'}}>
                {t('register.nameHint')}
              </p>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">{t('register.name')}</label>
                <div className="input-with-icon">
                  <span className="input-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  </span>
                  <input 
                    type="text" 
                    className="form-input" 
                    id="modal-display-name" 
                    required 
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && confirmDisplayName()}
                    placeholder={t('register.namePlaceholder')} 
                    autoFocus
                  />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">
                  {t('register.phone')} <span style={{color:'var(--text-muted)',fontWeight:400,fontSize:'var(--font-xs)'}}>({t('register.optional')})</span>
                </label>
                <div className="input-with-icon">
                  <span className="input-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
                  </span>
                  <input 
                    type="tel" 
                    className="form-input" 
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && confirmDisplayName()}
                    placeholder={t('register.phonePlaceholder')}
                  />
                </div>
              </div>
              {!urlPosition && (
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">{t('register.position')}</label>
                  <div className="input-with-icon">
                    <span className="input-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                    </span>
                    <select 
                      className="form-select" 
                      value={position}
                      onChange={e => setPosition(e.target.value)}
                    >
                      <option value="">-- {t('register.positionPlaceholder') || 'Chọn vị trí'} --</option>
                      <option value="factory">{t('register.positions.factory')}</option>
                      <option value="office">{t('register.positions.office')}</option>
                      <option value="nursing">{t('register.positions.nursing')}</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
            <div className="job-form-footer">
              <button className="btn-job-cancel" onClick={() => setShowModal(false)}>{t('admin.cancel') || 'Cancel'}</button>
              <button className="btn-job-publish" onClick={confirmDisplayName} disabled={isModalLoading}>
                {isModalLoading ? <div className="spinner"></div> : t('register.submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="form-container"><div className="spinner"></div></div>}>
      <RegisterContent />
    </Suspense>
  );
}
