'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '../../../context/LanguageContext';
import { useNotification } from '../../../context/NotificationContext';
import { DB } from '../../../lib/supabase';

export default function AdminLoginPage() {
  const { t } = useLanguage();
  const { showToast } = useNotification();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
        <div className="form-icon-wrapper">🔒</div>
        <h2 className="form-title">{t('admin.loginTitle') || 'Đăng nhập quản lý'}</h2>
        <p className="form-subtitle">{t('admin.loginSubtitle') || 'Đăng nhập để quản lý ứng viên'}</p>
        
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">{t('admin.username') || 'Tài khoản'}</label>
            <div className="input-with-icon">
              <span className="input-icon">👤</span>
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
            <div className="input-with-icon">
              <span className="input-icon">🔑</span>
              <input 
                type="password" 
                className="form-input" 
                required 
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
              />
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
