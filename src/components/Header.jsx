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
  }, [pathname]);

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
            <button className="btn-settings" onClick={() => setShowSettings(true)} title="Settings">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <span className="admin-header-divider"></span>
            <button className="btn-admin-logout" onClick={handleAdminLogout} title={t('admin.logout') || 'Đăng xuất'}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
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
