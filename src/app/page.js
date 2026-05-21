'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '../context/LanguageContext';

export default function LandingPage() {
  const { t } = useLanguage();
  const router = useRouter();

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
            <div className="feature-icon">💬</div>
            <div className="feature-title">{t('landing.feature1')}</div>
            <div className="feature-desc">{t('landing.feature1Desc')}</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <div className="feature-title">{t('landing.feature2')}</div>
            <div className="feature-desc">{t('landing.feature2Desc')}</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📎</div>
            <div className="feature-title">{t('landing.feature3')}</div>
            <div className="feature-desc">{t('landing.feature3Desc')}</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📍</div>
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
