'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '../../../context/LanguageContext';
import { useNotification } from '../../../context/NotificationContext';
import { DB } from '../../../lib/supabase';
import { hashPassword } from '../../../lib/helpers';

export default function AdminLoginPage() {
  const { t } = useLanguage();
  const { showToast } = useNotification();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Redirect if already logged in
    DB.getAdminSession().then(session => {
      if (session) {
        router.push('/admin/dashboard');
      }
    });
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      showToast(t('admin.fillAll') || 'Vui lòng nhập đầy đủ', 'error');
      return;
    }

    setIsLoading(true);

    try {
      const session = await DB.adminLogin(username.trim(), password);
      if (session) {
        window.dispatchEvent(new Event('authChange'));
        router.push('/admin/dashboard');
      }
    } catch(err) {
      console.error('Login error:', err);
      showToast(t('admin.invalidCredentials') || 'Sai tài khoản hoặc mật khẩu', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="form-container">
      <div className="form-card">
        <div className="form-icon-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: '#ffffff'}}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        </div>
        <h2 className="form-title">{t('admin.loginTitle') || 'Đăng nhập quản lý'}</h2>
        <p className="form-subtitle">{t('admin.loginSubtitle') || 'Đăng nhập để quản lý ứng viên'}</p>
        
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">{t('admin.username') || 'Tài khoản'}</label>
            <div className="input-with-icon">
              <span className="input-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              </span>
              <input 
                type="text" 
                className="form-input" 
                required 
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin"
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{t('admin.password') || 'Mật khẩu'}</label>
            <div className="input-with-icon" style={{ position: 'relative' }}>
              <span className="input-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
              </span>
              <input 
                type={showPassword ? 'text' : 'password'} 
                className="form-input" 
                required 
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ paddingRight: '40px' }}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)} 
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                )}
              </button>
            </div>
          </div>
          <button type="submit" className="form-submit" disabled={isLoading}>
            {isLoading ? <div className="spinner"></div> : <span>{t('admin.loginBtn') || 'Đăng nhập'}</span>}
          </button>
        </form>
      </div>
    </div>
  );
}
