'use client';
import React, { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useRouter, usePathname } from 'next/navigation';
import { DB } from '../lib/supabase';
import { showConfirmModal } from '../lib/helpers';
import AdminSettingsModal from './AdminSettingsModal';

export default function Header() {
  const { lang, changeLanguage, t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  
  const [adminName, setAdminName] = useState('');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [isApplicantLoggedIn, setIsApplicantLoggedIn] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    // Check login states
    const checkAuth = async () => {
      const adminSession = await DB.getAdminSession();
      if (adminSession) {
        setIsAdminLoggedIn(true);
        setAdminName(adminSession.profile.display_name);
      } else {
        setIsAdminLoggedIn(false);
      }

      const applicantToken = localStorage.getItem('jobchat_session');
      if (applicantToken) {
        setIsApplicantLoggedIn(true);
      } else {
        setIsApplicantLoggedIn(false);
      }
    };

    checkAuth();
    
    // Custom event listener for auth changes to trigger header re-render
    const handleAuthChange = () => checkAuth();
    window.addEventListener('authChange', handleAuthChange);
    return () => window.removeEventListener('authChange', handleAuthChange);
  }, []);

  const goBack = () => {
    if (pathname === '/admin/login') {
      router.push('/');
    } else if (pathname.startsWith('/admin')) {
      router.push('/admin/dashboard');
    } else if (pathname.startsWith('/jobs/')) {
      router.push('/jobs');
    } else if (pathname === '/jobs') {
      router.push('/');
    } else {
      router.push('/');
    }
  };

  const handleAdminLogout = () => {
    showConfirmModal(
      t('admin.confirmLogoutTitle') || 'Xác nhận đăng xuất',
      t('admin.confirmLogoutText') || 'Bạn có chắc chắn muốn đăng xuất khỏi hệ thống quản trị?',
      async () => {
        await DB.adminLogout();
        window.dispatchEvent(new Event('authChange'));
        router.push('/admin/login');
      },
      t('admin.logout') || 'Đăng xuất',
      { t }
    );
  };

  const handleApplicantLogout = () => {
    showConfirmModal(
      t('chat.confirmLogoutTitle') || 'Xác nhận đăng xuất',
      t('chat.confirmLogoutText') || 'Bạn có chắc chắn muốn đăng xuất khỏi phiên chat hiện tại không?',
      () => {
        localStorage.removeItem('jobchat_session');
        window.dispatchEvent(new Event('authChange'));
        router.push('/');
      },
      t('chat.logout') || 'Thoát',
      { t }
    );
  };

  // Determine visibility
  const showBackButton = pathname !== '/' && pathname !== '/admin/dashboard' && !pathname.startsWith('/chat');
  const showAdminLogin = pathname === '/';
  const showAdminControls = isAdminLoggedIn && pathname.startsWith('/admin');
  const showApplicantLogout = isApplicantLoggedIn && pathname.startsWith('/chat');
  const isLogoClickable = !pathname.startsWith('/chat') && (!pathname.startsWith('/admin') || pathname === '/admin/login');

  return (
    <header id="app-header" className="glass-header">
      <div className="header-left">
        {showBackButton && (
          <button id="btn-back" className="btn-icon" onClick={goBack}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
        )}
        <h1 className="logo" onClick={() => { if (isLogoClickable) router.push('/'); }} style={{cursor: isLogoClickable ? 'pointer' : 'default'}}>
          Up<span className="logo-accent">hill</span>
        </h1>
      </div>
      <div className="header-right">
        <div id="lang-switcher" className="lang-dropdown-wrapper">
          <select 
            id="lang-select" 
            className="lang-select" 
            value={lang} 
            onChange={(e) => changeLanguage(e.target.value)}
          >
            <option value="ja">🇯🇵 JP</option>
            <option value="vi">🇻🇳 VN</option>
            <option value="en">🇬🇧 EN</option>
            <option value="my">🇲🇲 MM</option>
            <option value="pt">🇧🇷 BR</option>
          </select>
        </div>
        
        {showAdminLogin && (
          <button id="btn-admin-login" className="btn-admin-login" onClick={() => router.push('/admin/login')}>
            {t('landing.adminLink') || 'Đăng nhập Quản lý'}
          </button>
        )}



        {showAdminControls && (
          <div id="admin-header-controls" className="admin-header-controls">
            <span id="admin-header-name" className="admin-header-name">{adminName}</span>
            <button className="btn-settings" onClick={() => setShowSettings(true)} title="Settings" style={{background:'none',border:'none',cursor:'pointer',padding:'4px',color:'var(--text-muted)',display:'flex',alignItems:'center'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            </button>
            <button className="btn-chat-logout" onClick={handleAdminLogout} style={{marginLeft: '10px'}}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
        )}

        {showApplicantLogout && (
          <button id="btn-chat-logout" className="btn-chat-logout" onClick={handleApplicantLogout}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            <span>{t('chat.logout')}</span>
          </button>
        )}
      </div>

      <AdminSettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </header>
  );
}
