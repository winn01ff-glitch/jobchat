'use client';
import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '../../context/LanguageContext';
import { useNotification } from '../../context/NotificationContext';
import { DB } from '../../lib/supabase';
import { hashPassword } from '../../lib/helpers';

function RegisterContent() {
  const { t } = useLanguage();
  const { showToast } = useNotification();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlPosition = searchParams ? searchParams.get('position') : '';
  
  // Modes: 'login' (default) | 'register' | 'forgot'
  const [mode, setMode] = useState('login');
  const [isLoading, setIsLoading] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  
  // Password Visibilities
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);

  // Refs for auto-focusing on validation warning
  const idInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const nameInputRef = useRef(null);

  // Login / Common Fields
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Register Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('');

  // Forgot Password Fields
  const [forgotStep, setForgotStep] = useState('id'); // 'id' | 'otp'
  const [otp, setOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [isOtpLoading, setIsOtpLoading] = useState(false);
  const [isOtpFocused, setIsOtpFocused] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  // Real-time unique check for ID
  const [idWarning, setIdWarning] = useState('');

  // Computed Validation Warnings for Register
  const idLengthWarning = mode === 'register' && loginId.length > 0 && loginId.length < 4 
    ? (t('auth.errorIdLength') || 'ID phải có ít nhất 4 ký tự.') 
    : '';

  const passwordLengthWarning = mode === 'register' && password.length > 0 && password.length < 6 
    ? (t('auth.errorPasswordLength') || 'Mật khẩu phải có ít nhất 6 ký tự.') 
    : '';

  const nameWarning = mode === 'register' && hasSubmitted && !name.trim() 
    ? (t('auth.errorNameRequired') || 'Vui lòng nhập họ tên.') 
    : '';

  useEffect(() => {
    // Check if session already exists
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

    // Prefill cached credentials if checked before
    const cachedId = localStorage.getItem('uphill_remembered_id');
    const cachedHash = localStorage.getItem('uphill_remembered_pw_hash');
    if (cachedId) {
      setLoginId(cachedId);
      if (cachedHash) {
        setPassword('******'); // placeholder to indicate cached password
      }
    }
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

  // ID Validation unique check on Blur
  const handleIdBlur = async () => {
    const cleanId = loginId.trim().toLowerCase();
    if (!cleanId || cleanId.length < 4) {
      setIdWarning('');
      return;
    }
    if (mode !== 'register') return;
    
    try {
      const exists = await DB.checkLoginIdExists(cleanId);
      if (exists) {
        setIdWarning(t('auth.errorIdExists') || 'ID này đã tồn tại, vui lòng chọn ID khác.');
      } else {
        setIdWarning('');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const cleanId = loginId.trim().toLowerCase();
    const enteredPassword = password.trim();

    if (!cleanId || !enteredPassword) {
      showToast(t('common.error') || 'Vui lòng nhập ID và mật khẩu', 'error');
      return;
    }

    setIsLoading(true);
    try {
      let pwHash;
      const cachedId = localStorage.getItem('uphill_remembered_id');
      const cachedHash = localStorage.getItem('uphill_remembered_pw_hash');

      if (enteredPassword === '******' && cachedId === cleanId && cachedHash) {
        pwHash = cachedHash;
      } else {
        pwHash = await hashPassword(enteredPassword);
      }

      const applicant = await DB.loginApplicantWithPassword(cleanId, pwHash);

      // Save credentials if Remember Me is checked
      if (rememberMe) {
        localStorage.setItem('uphill_remembered_id', cleanId);
        localStorage.setItem('uphill_remembered_pw_hash', pwHash);
      } else {
        localStorage.removeItem('uphill_remembered_id');
        localStorage.removeItem('uphill_remembered_pw_hash');
      }

      // Save session
      localStorage.setItem('jobchat_session', JSON.stringify({
        id: applicant.id, name: applicant.name,
        email: applicant.email || '', token: applicant.session_token
      }));

      // Update applied_job_title if pending in localStorage
      try {
        const jobStr = localStorage.getItem('uphill_apply_job');
        if (jobStr) {
          const jobObj = JSON.parse(jobStr);
          if (jobObj && jobObj.title) {
            await DB.updateApplicant(applicant.id, { applied_job_title: jobObj.title });
          }
        }
      } catch (e) {
        console.error('Failed to update applied job title on login:', e);
      }

      showToast(t('register.welcomeBack') || 'Chào mừng quay trở lại!', 'success');
      window.dispatchEvent(new Event('authChange'));
      router.push(`/chat/${applicant.id}`);
    } catch (err) {
      console.error('Login failed:', err);
      showToast(t('auth.loginFailed') || 'Sai tên đăng nhập hoặc mật khẩu', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setHasSubmitted(true);

    const cleanId = loginId.trim().toLowerCase();
    const cleanPassword = password.trim();
    const cleanName = name.trim();

    if (cleanId.length < 4) {
      idInputRef.current?.focus();
      return;
    }
    if (cleanPassword.length < 6) {
      passwordInputRef.current?.focus();
      return;
    }
    if (!cleanName) {
      nameInputRef.current?.focus();
      return;
    }

    setIsLoading(true);
    try {
      // Verify ID is unique
      const exists = await DB.checkLoginIdExists(cleanId);
      if (exists) {
        showToast(t('auth.errorIdExists') || 'ID này đã tồn tại, vui lòng chọn ID khác.', 'error');
        setIdWarning(t('auth.errorIdExists') || 'ID này đã tồn tại, vui lòng chọn ID khác.');
        idInputRef.current?.focus();
        setIsLoading(false);
        return;
      }

      const pwHash = await hashPassword(cleanPassword);
      const currentLang = (typeof window !== 'undefined' ? localStorage.getItem('jobchat_lang') : 'vi') || 'vi';

      const result = await DB.registerApplicantWithPassword({
        name: cleanName,
        loginId: cleanId,
        passwordHash: pwHash,
        email: email.trim().toLowerCase() || null,
        phone: phone.trim(),
        position: position || urlPosition || 'other',
        language: currentLang
      });

      // Save credentials if Remember Me is checked
      if (rememberMe) {
        localStorage.setItem('uphill_remembered_id', cleanId);
        localStorage.setItem('uphill_remembered_pw_hash', pwHash);
      } else {
        localStorage.removeItem('uphill_remembered_id');
        localStorage.removeItem('uphill_remembered_pw_hash');
      }

      // Save session
      localStorage.setItem('jobchat_session', JSON.stringify({
        id: result.id, name: result.name,
        email: result.email || '', token: result.session_token
      }));

      // Update applied_job_title if pending in localStorage
      try {
        const jobStr = localStorage.getItem('uphill_apply_job');
        if (jobStr) {
          const jobObj = JSON.parse(jobStr);
          if (jobObj && jobObj.title) {
            await DB.updateApplicant(result.id, { applied_job_title: jobObj.title });
          }
        }
      } catch (e) {
        console.error('Failed to update applied job title:', e);
      }

      showToast(t('register.success') || 'Đăng ký thành công!', 'success');
      window.dispatchEvent(new Event('authChange'));
      
      if (typeof Notification !== 'undefined' && Notification.requestPermission) {
        Notification.requestPermission();
      }

      router.push(`/chat/${result.id}`);
    } catch (err) {
      console.error('Registration failed:', err);
      showToast(t('common.error') || 'Đăng ký thất bại', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotRequest = async (e) => {
    e.preventDefault();
    const cleanId = loginId.trim().toLowerCase();
    if (!cleanId) return;

    setIsLoading(true);
    try {
      const currentLang = (typeof window !== 'undefined' ? localStorage.getItem('jobchat_lang') : 'vi') || 'vi';
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId: cleanId, lang: currentLang })
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'not_found') {
          showToast(t('auth.errorIdNotExists') || 'ID tài khoản không tồn tại.', 'error');
        } else if (data.error === 'no_email') {
          showToast(t('auth.errorNoEmailLinked') || 'Tài khoản này chưa liên kết email. Vui lòng liên hệ Quản lý.', 'error');
        } else {
          throw new Error(data.error || 'Request failed');
        }
        return;
      }

      showToast(t('auth.otpSentSuccess') || 'Mã xác thực đã được gửi tới email liên kết của bạn.', 'success');
      setMaskedEmail(data.email);
      setForgotStep('otp');
      setCountdown(60);
    } catch (err) {
      console.error('Forgot password request failed:', err);
      showToast(t('register.sendOtpFailed') || 'Gửi mã xác thực thất bại.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotResend = async () => {
    if (countdown > 0 || isResending) return;
    setIsResending(true);
    try {
      const cleanId = loginId.trim().toLowerCase();
      const currentLang = (typeof window !== 'undefined' ? localStorage.getItem('jobchat_lang') : 'vi') || 'vi';
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId: cleanId, lang: currentLang })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }

      showToast(t('auth.otpSentSuccess') || 'Mã xác thực đã được gửi lại tới email của bạn!', 'success');
      setCountdown(60);
    } catch(err) {
      console.error('Resend OTP failed:', err);
      showToast(t('register.sendOtpFailed') || 'Gửi mã xác thực thất bại. Vui lòng thử lại.', 'error');
    } finally {
      setIsResending(false);
    }
  };

  const handleForgotReset = async (e) => {
    e.preventDefault();
    const cleanId = loginId.trim().toLowerCase();
    const cleanOtp = otp.trim();
    const cleanNewPassword = forgotNewPassword.trim();

    if (!cleanOtp) {
      showToast(t('register.enterOtp') || 'Vui lòng nhập mã OTP', 'error');
      return;
    }
    if (cleanNewPassword.length < 6) {
      showToast(t('auth.errorPasswordLength') || 'Mật khẩu phải có ít nhất 6 ký tự.', 'error');
      return;
    }

    setIsOtpLoading(true);
    try {
      const pwHash = await hashPassword(cleanNewPassword);
      await DB.resetPasswordWithOtp(cleanId, cleanOtp, pwHash);

      showToast(t('auth.resetSuccess') || 'Đặt lại mật khẩu thành công! Hãy đăng nhập lại.', 'success');
      
      // Pre-fill ID and reset other forgot states
      setMode('login');
      setPassword('');
      setOtp('');
      setForgotNewPassword('');
      setForgotStep('id');
    } catch (err) {
      console.error('Password reset failed:', err);
      showToast(err.message || t('register.invalidOtp') || 'Đặt lại mật khẩu thất bại.', 'error');
    } finally {
      setIsOtpLoading(false);
    }
  };

  return (
    <div className="form-container">
      <div className="form-card">
        <div className="form-icon-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: '#ffffff'}}><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
        </div>
        
        {mode === 'login' && (
          <>
            <h2 className="form-title">{t('common.login') || 'Đăng nhập'}</h2>
            <p className="form-subtitle">{t('register.subtitle') || 'Nhập thông tin để bắt đầu chat'}</p>
            <form onSubmit={handleLogin}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">{t('auth.loginId') || 'ID'} <span style={{color: 'var(--error)'}}>*</span></label>
                <div className="input-with-icon">
                  <span className="input-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  </span>
                  <input 
                    type="text" 
                    className="form-input" 
                    required 
                    value={loginId}
                    onChange={e => {
                      setLoginId(e.target.value);
                      if (password === '******') setPassword(''); // reset pre-filled password if ID changes
                    }}
                    placeholder={t('auth.loginIdPlaceholder') || 'Tối thiểu 4 ký tự'}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">{t('auth.password') || 'Mật khẩu'} <span style={{color: 'var(--error)'}}>*</span></label>
                <div className="input-with-icon" style={{ position: 'relative' }}>
                  <span className="input-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  </span>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    className="form-input" 
                    required 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={t('auth.passwordPlaceholder') || 'Tối thiểu 6 ký tự'}
                    style={{ paddingRight: '42px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      zIndex: 10
                    }}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="form-flex-row">
                <label className="form-checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                  />
                  <span>{t('auth.rememberMe') || 'Ghi nhớ đăng nhập'}</span>
                </label>
                <button 
                  type="button" 
                  className="form-link-btn" 
                  onClick={() => { setMode('forgot'); setForgotStep('id'); setHasSubmitted(false); }}
                >
                  {t('auth.forgotPassword') || 'Quên mật khẩu?'}
                </button>
              </div>

              <button type="submit" className="form-submit" disabled={isLoading}>
                {isLoading ? <div className="spinner"></div> : <span>{t('common.login') || 'Đăng nhập'}</span>}
              </button>

              <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>
                {t('auth.noAccount') || 'Chưa có tài khoản?'}{' '}
                <button 
                  type="button" 
                  className="form-link-btn" 
                  onClick={() => { setMode('register'); setIdWarning(''); setHasSubmitted(false); }}
                  style={{ fontWeight: '600' }}
                >
                  {t('common.register') || 'Đăng ký ngay'}
                </button>
              </div>
            </form>
          </>
        )}

        {mode === 'register' && (
          <>
            <h2 className="form-title">{t('register.title') || 'Đăng ký ứng tuyển'}</h2>
            <p className="form-subtitle">{t('register.subtitle') || 'Điền thông tin để bắt đầu chat'}</p>
            <form onSubmit={handleRegister}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">{t('auth.loginId') || 'ID'} <span style={{color: 'var(--error)'}}>*</span></label>
                <div className="input-with-icon">
                  <span className="input-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  </span>
                  <input 
                    type="text" 
                    ref={idInputRef}
                    className={`form-input ${(idLengthWarning || idWarning) ? 'error' : ''}`}
                    required 
                    value={loginId}
                    onChange={e => setLoginId(e.target.value)}
                    onBlur={handleIdBlur}
                    placeholder={t('auth.loginIdPlaceholder') || 'Tối thiểu 4 ký tự'}
                  />
                </div>
                {idLengthWarning ? (
                  <div className="form-error">{idLengthWarning}</div>
                ) : (
                  idWarning && <div className="form-error">{idWarning}</div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">{t('auth.password') || 'Mật khẩu'} <span style={{color: 'var(--error)'}}>*</span></label>
                <div className="input-with-icon" style={{ position: 'relative' }}>
                  <span className="input-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  </span>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    ref={passwordInputRef}
                    className={`form-input ${passwordLengthWarning ? 'error' : ''}`}
                    required 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={t('auth.passwordPlaceholder') || 'Tối thiểu 6 ký tự'}
                    style={{ paddingRight: '42px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      zIndex: 10
                    }}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    )}
                  </button>
                </div>
                {passwordLengthWarning && <div className="form-error">{passwordLengthWarning}</div>}
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">{t('register.name') || 'Họ tên'} <span style={{color: 'var(--error)'}}>*</span></label>
                <div className="input-with-icon">
                  <span className="input-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  </span>
                  <input 
                    type="text" 
                    ref={nameInputRef}
                    className={`form-input ${nameWarning ? 'error' : ''}`}
                    required 
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={t('register.namePlaceholder') || 'Ví dụ: Nguyễn Văn A'}
                  />
                </div>
                {nameWarning && <div className="form-error">{nameWarning}</div>}
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">
                  {t('register.email') || 'Email'}{' '}
                  <span style={{color:'var(--text-muted)',fontWeight:400,fontSize:'12px'}}>({t('register.optional') || 'không bắt buộc'})</span>
                </label>
                <div className="input-with-icon">
                  <span className="input-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                  </span>
                  <input 
                    type="email" 
                    className="form-input" 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={t('register.emailPlaceholder') || 'Ví dụ: example@gmail.com'}
                  />
                </div>
                <p className="form-helper-text" style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '6px' }}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', flexShrink: 0 }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                  <span>{t('auth.emailOptionalDesc') || 'Nhập email giúp lấy lại mật khẩu khi quên'}</span>
                </p>
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">
                  {t('register.phone') || 'Số điện thoại'}{' '}
                  <span style={{color:'var(--text-muted)',fontWeight:400,fontSize:'12px'}}>({t('register.optional') || 'không bắt buộc'})</span>
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
                    placeholder={t('register.phonePlaceholder') || 'Ví dụ: 0901234567'}
                  />
                </div>
              </div>


              <button type="submit" className="form-submit" disabled={isLoading}>
                {isLoading ? <div className="spinner"></div> : <span>{t('common.register') || 'Đăng ký & Bắt đầu chat'}</span>}
              </button>

              <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>
                {t('auth.haveAccount') || 'Đã có tài khoản?'}{' '}
                <button 
                  type="button" 
                  className="form-link-btn" 
                  onClick={() => { setMode('login'); setHasSubmitted(false); }}
                  style={{ fontWeight: '600' }}
                >
                  {t('common.login') || 'Đăng nhập'}
                </button>
              </div>
            </form>
          </>
        )}

        {mode === 'forgot' && (
          <>
            <h2 className="form-title">{t('auth.resetPasswordTitle') || 'Lấy lại mật khẩu'}</h2>
            
            {forgotStep === 'id' ? (
              <form onSubmit={handleForgotRequest}>
                <p className="form-subtitle" style={{ marginBottom: '16px', textAlign: 'left', lineHeight: '1.4' }}>
                  {t('auth.resetPasswordDesc') || 'Nhập ID tài khoản của bạn để nhận mã xác thực qua email.'}
                </p>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">{t('auth.loginId') || 'ID'} <span style={{color: 'var(--error)'}}>*</span></label>
                  <div className="input-with-icon">
                    <span className="input-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    </span>
                    <input 
                      type="text" 
                      className="form-input" 
                      required 
                      value={loginId}
                      onChange={e => setLoginId(e.target.value)}
                      placeholder={t('auth.loginIdPlaceholder') || 'Nhập ID của bạn'}
                    />
                  </div>
                </div>

                <button type="submit" className="form-submit" disabled={isLoading}>
                  {isLoading ? <div className="spinner"></div> : <span>{t('auth.sendOtpCode') || 'Gửi mã xác thực'}</span>}
                </button>

                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                  <button 
                    type="button" 
                    className="form-link-btn" 
                    onClick={() => { setMode('login'); setHasSubmitted(false); }}
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', margin: '0 auto' }}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12,19 5,12 12,5"></polyline></svg>
                    <span>{t('common.back') || 'Quay lại'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleForgotReset}>
                <div className="form-group">
                  <label className="form-label">{t('auth.enterOtp') || 'Nhập mã xác thực OTP'} <span style={{color: 'var(--error)'}}>*</span></label>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: '1.4' }}>
                    {t('register.otpSentHint') || 'Chúng tôi đã gửi mã xác thực gồm 6 chữ số đến:'} <br/>
                    <strong style={{color: 'var(--text-primary)'}}>{maskedEmail}</strong>
                  </p>
                  
                  <div className="input-with-icon" style={{ marginBottom: '16px' }}>
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
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '');
                        setOtp(val);
                      }}
                      onFocus={() => setIsOtpFocused(true)}
                      onBlur={() => setIsOtpFocused(false)}
                      placeholder={isOtpFocused ? "" : "------"}
                      style={{ textAlign: 'center', letterSpacing: '6px', fontSize: '20px', fontWeight: 'bold' }}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">{t('auth.newPassword') || 'Mật khẩu mới'} <span style={{color: 'var(--error)'}}>*</span></label>
                  <div className="input-with-icon" style={{ position: 'relative' }}>
                    <span className="input-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    </span>
                    <input 
                      type={showForgotNewPassword ? "text" : "password"} 
                      className="form-input" 
                      required 
                      value={forgotNewPassword}
                      onChange={e => setForgotNewPassword(e.target.value)}
                      placeholder={t('auth.passwordPlaceholder') || 'Tối thiểu 6 ký tự'}
                      style={{ paddingRight: '42px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        zIndex: 10
                      }}
                    >
                      {showForgotNewPassword ? (
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                      ) : (
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                      )}
                    </button>
                  </div>
                </div>

                <button type="submit" className="form-submit" disabled={isOtpLoading}>
                  {isOtpLoading ? <div className="spinner"></div> : <span>{t('auth.resetPasswordTitle') || 'Đặt lại mật khẩu'}</span>}
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
                  {countdown > 0 ? (
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      {t('register.resendCountdown') ? t('register.resendCountdown').replace('{seconds}', countdown) : `Gửi lại mã sau ${countdown}s`}
                    </span>
                  ) : (
                    <button 
                      type="button" 
                      onClick={handleForgotResend}
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
                    onClick={() => { setForgotStep('id'); setOtp(''); setForgotNewPassword(''); }}
                    style={{
                      background: 'none', border: 'none', 
                      color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer',
                      textDecoration: 'underline', padding: 0,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12,19 5,12 12,5"></polyline></svg>
                    <span>{t('common.back') || 'Quay lại'}</span>
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
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
