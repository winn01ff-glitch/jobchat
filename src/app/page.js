'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '../context/LanguageContext';

export default function LandingPage() {
  const { t } = useLanguage();
  const router = useRouter();

  React.useEffect(() => {
    const sessionStr = localStorage.getItem('jobchat_session');
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        if (session && session.id) {
          router.push(`/chat/${session.id}`);
        }
      } catch(e) {}
    }
  }, [router]);

  return (
    <div className="landing-container">
      <div className="landing-content">
        <div className="company-badge">
          <span className="pulse-dot"></span> {t('landing.badge') || 'Uphill Recruiting'}
        </div>

        <h2 className="landing-title text-gradient">{t('landing.title') || 'Welcome'}</h2>
        <p className="landing-subtitle">{t('landing.subtitle')}</p>
        
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="feature-svg">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="feature-title">{t('landing.feature1')}</div>
            <div className="feature-desc">{t('landing.feature1Desc')}</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="feature-svg">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div className="feature-title">{t('landing.feature2')}</div>
            <div className="feature-desc">{t('landing.feature2Desc')}</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="feature-svg">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </div>
            <div className="feature-title">{t('landing.feature3')}</div>
            <div className="feature-desc">{t('landing.feature3Desc')}</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="feature-svg">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div className="feature-title">{t('landing.feature4')}</div>
            <div className="feature-desc">{t('landing.feature4Desc')}</div>
          </div>
        </div>
        
        <div className="landing-cta">
          <button className="btn-primary" onClick={() => router.push('/register')}>
            💬 {t('landing.cta')}
          </button>
          <button className="btn-secondary" onClick={() => router.push('/jobs')}>
            📋 {t('landing.viewJobs') || 'Xem việc làm'}
          </button>
        </div>
      </div>
    </div>
  );
}
