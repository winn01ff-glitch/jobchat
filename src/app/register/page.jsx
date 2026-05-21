'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '../../context/LanguageContext';
import { useNotification } from '../../context/NotificationContext';
import { DB } from '../../lib/supabase';

export default function RegisterPage() {
  const { t } = useLanguage();
  const { showToast } = useNotification();
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isModalLoading, setIsModalLoading] = useState(false);

  useEffect(() => {
    const cachedEmail = localStorage.getItem('uphill_email');
    if (cachedEmail) setEmail(cachedEmail);
  }, []);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    
    if (!cleanEmail) {
      showToast(t('register.fillAll'), 'error');
      return;
    }

    setIsLoading(true);

    try {
      const existing = await DB.getApplicantByEmail(cleanEmail);
      if (existing) {
        localStorage.setItem('uphill_email', cleanEmail);
        localStorage.setItem('jobchat_session', JSON.stringify({
          id: existing.id, name: existing.name,
          email: cleanEmail, token: existing.session_token
        }));
        showToast(t('register.welcomeBack') || 'Welcome back!', 'success');
        window.dispatchEvent(new Event('authChange'));
        router.push(`/chat/${existing.id}`);
        return;
      }

      setShowModal(true);
    } catch(err) {
      console.error('Email check failed:', err);
      showToast(t('common.error'), 'error');
    } finally {
      setIsLoading(false);
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
      const applicant = await DB.createApplicant({
        name: cleanName, email: email.trim().toLowerCase(), phone: phone.trim(), position: ''
      });

      localStorage.setItem('uphill_email', email.trim().toLowerCase());
      localStorage.setItem('jobchat_session', JSON.stringify({
        id: applicant.id, name: applicant.name,
        email: email.trim().toLowerCase(), token: applicant.session_token
      }));

      setShowModal(false);
      window.dispatchEvent(new Event('authChange'));
      
      if (typeof Notification !== 'undefined' && Notification.requestPermission) {
        Notification.requestPermission();
      }
      
      router.push(`/chat/${applicant.id}`);
    } catch(err) {
      console.error('Registration failed:', err);
      showToast(t('common.error'), 'error');
      setIsModalLoading(false);
    }
  };

  return (
    <div className="form-container">
      <div className="form-card">
        <div className="form-icon-wrapper">✍️</div>
        <h2 className="form-title">{t('register.title')}</h2>
        <p className="form-subtitle">{t('register.subtitle')}</p>
        <form id="register-form" onSubmit={handleEmailSubmit}>
          <div className="form-group">
            <label className="form-label">{t('register.email')} <span style={{color: 'var(--error)'}}>*</span></label>
            <div className="input-with-icon">
              <span className="input-icon">📧</span>
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
            {isLoading ? <div className="spinner"></div> : <span>{t('register.submit')}</span>}
          </button>
        </form>
      </div>

      {showModal && (
        <div className="confirm-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="job-form-card" style={{maxWidth: '420px'}} onClick={e => e.stopPropagation()}>
            <div className="job-form-header">
              <h3>👋 {t('register.enterName')}</h3>
              <button className="job-form-close" onClick={() => setShowModal(false)} style={{background:'none',border:'none',fontSize:'20px',cursor:'pointer',color:'var(--text-muted)',padding:'4px 8px',lineHeight:1}}>✕</button>
            </div>
            <div className="job-form-body">
              <p style={{color:'var(--text-secondary)',margin:'0 0 16px',fontSize:'var(--font-sm)'}}>
                {t('register.nameHint')}
              </p>
              <div className="form-group">
                <label className="form-label">{t('register.name')}</label>
                <div className="input-with-icon">
                  <span className="input-icon">👤</span>
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
              <div className="form-group">
                <label className="form-label">
                  {t('register.phone')} <span style={{color:'var(--text-muted)',fontWeight:400,fontSize:'var(--font-xs)'}}>({t('register.optional')})</span>
                </label>
                <div className="input-with-icon">
                  <span className="input-icon">📱</span>
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
