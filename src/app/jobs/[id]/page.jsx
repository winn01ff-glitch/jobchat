'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useLanguage } from '../../../context/LanguageContext';
import { DB } from '../../../lib/supabase';
import { formatDate, formatSalary, showToast } from '../../../lib/helpers';

const langNames = {
  vi: 'Tiếng Việt',
  en: 'English',
  ja: '日本語',
  my: 'မြန်မာဘာသာ',
  pt: 'Português'
};

export default function JobDetailPage() {
  const { lang, t } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const id = params?.id;

  const [job, setJob] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [translatedJob, setTranslatedJob] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTranslated, setIsTranslated] = useState(false);

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }
    const load = async () => {
      try {
        const data = await DB.getJob(id);
        if (data) {
          setJob(data);
          setTranslatedJob(null);
          setIsTranslated(false);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id]);

  const translateText = async (text, targetLang) => {
    if (!text || !targetLang) return text;
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json && json[0]) {
        return json[0].map(item => item[0]).join('');
      }
    } catch (e) {
      console.error('Translation error:', e);
    }
    return text;
  };

  const handleTranslate = async () => {
    if (isTranslated) {
      setIsTranslated(false);
      return;
    }
    setIsTranslating(true);
    try {
      const tTitle = await translateText(job.title, lang);
      const tLocation = await translateText(job.location, lang);
      const tDesc = await translateText(parsed.description, lang);
      setTranslatedJob({
        title: tTitle,
        location: tLocation,
        description: tDesc
      });
      setIsTranslated(true);
    } catch (e) {
      console.error(e);
      showToast(t('common.error') || 'Có lỗi xảy ra khi dịch.', 'error');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleApply = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('uphill_apply_job', JSON.stringify({
        id: job.id,
        title: job.title
      }));
      const sessionStr = localStorage.getItem('jobchat_session');
      if (sessionStr) {
        try {
          const session = JSON.parse(sessionStr);
          if (session && session.id) {
            router.push(`/chat/${session.id}`);
            return;
          }
        } catch (e) {}
      }
    }
    router.push(`/register?position=${job.position || ''}`);
  };

  const parseJobContent = (rawContent) => {
    try {
      const data = JSON.parse(rawContent);
      if (data && typeof data === 'object' && 'description' in data) {
        return {
          description: data.description || '',
          bonus: data.bonus || '',
          nenkin: data.nenkin || '',
          insurance: data.insurance || '',
          raise: data.raise || '',
          transport: data.transport || ''
        };
      }
    } catch (e) {}
    return {
      description: rawContent || '',
      bonus: '',
      nenkin: '',
      insurance: '',
      raise: '',
      transport: ''
    };
  };

  if (isLoading) {
    return (
      <div className="jobs-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="jobs-container">
        <div className="jobs-empty">
          <p>{t('jobs.noJobs') || 'Không tìm thấy việc làm'}</p>
          <button onClick={() => router.push('/jobs')} className="btn-primary" style={{ marginTop: '16px', padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--messenger-blue)', color: 'white', cursor: 'pointer' }}>
            {t('jobs.jobList') || 'Danh sách việc làm'}
          </button>
        </div>
      </div>
    );
  }

  const parsed = parseJobContent(job.content || '');
  const hasWelfare = [parsed.bonus, parsed.nenkin, parsed.insurance, parsed.raise, parsed.transport].some(
    val => val && val !== 'none' && val !== ''
  );

  return (
    <div className="job-detail-page">
      <div className="job-detail-content-wrapper">
        <div className="job-detail-inner">
          <h1 className="job-detail-title">{isTranslated ? translatedJob.title : job.title}</h1>
          
          <div className="job-detail-meta">
            {job.position && (
              <div className="job-detail-meta-item position">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                <span>{t('register.positions.' + job.position) || job.position}</span>
              </div>
            )}
            {job.salary && (
              <div className="job-detail-meta-item salary">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}><path d="M6 3l6 8 6-8M12 11v10M9 13h6M9 17h6"/></svg>
                <span>{formatSalary(job.salary, t)}</span>
              </div>
            )}
            {job.location && (
              <div className="job-detail-meta-item location">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                <span>{isTranslated ? translatedJob.location : job.location}</span>
              </div>
            )}
          </div>

          {hasWelfare && (
            <div className="job-detail-section">
              <h4 className="section-title">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--messenger-blue)'}}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span>{t('jobs.welfare') || 'Chế độ & Phúc lợi'}</span>
              </h4>
              <div className="welfare-grid">
                {parsed.bonus && parsed.bonus !== 'none' && (
                  <div className="welfare-item">
                    <div className="welfare-icon-box bonus">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#e67e22" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 12 20 22 4 22 4 12"></polyline>
                        <rect x="2" y="7" width="20" height="5"></rect>
                        <line x1="12" y1="22" x2="12" y2="7"></line>
                        <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path>
                        <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>
                      </svg>
                    </div>
                    <div>
                      <div className="welfare-label">{t('jobs.jobFields.bonus')}</div>
                      <div className="welfare-value">
                        {['twice_a_year', 'once_a_year', 'performance'].includes(parsed.bonus) ? t(`jobs.jobFields.bonusOptions.${parsed.bonus}`) : parsed.bonus}
                      </div>
                    </div>
                  </div>
                )}
                {((parsed.insurance && parsed.insurance !== 'none') || (parsed.nenkin && parsed.nenkin !== 'none')) && (
                  <div className="welfare-item">
                    <div className="welfare-icon-box insurance">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#27ae60" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                      </svg>
                    </div>
                    <div>
                      <div className="welfare-label">{t('jobs.jobFields.insurance')}</div>
                      <div className="welfare-value">
                        {parsed.insurance && parsed.insurance !== 'none' ? (
                          ['full', 'partial'].includes(parsed.insurance) ? t(`jobs.jobFields.insuranceOptions.${parsed.insurance}`) : parsed.insurance
                        ) : (
                          ['full'].includes(parsed.nenkin) ? t(`jobs.jobFields.nenkinOptions.${parsed.nenkin}`) : parsed.nenkin
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {parsed.raise && parsed.raise !== 'none' && (
                  <div className="welfare-item">
                    <div className="welfare-icon-box raise">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#c0392b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                        <polyline points="17 6 23 6 23 12"></polyline>
                      </svg>
                    </div>
                    <div>
                      <div className="welfare-label">{t('jobs.jobFields.raise')}</div>
                      <div className="welfare-value">
                        {['once_a_year', 'performance'].includes(parsed.raise) ? t(`jobs.jobFields.raiseOptions.${parsed.raise}`) : parsed.raise}
                      </div>
                    </div>
                  </div>
                )}
                {parsed.transport && parsed.transport !== 'none' && (
                  <div className="welfare-item">
                    <div className="welfare-icon-box transport">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#16a085" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="5" y="4" width="14" height="16" rx="2" ry="2"></rect>
                        <line x1="5" y1="9" x2="19" y2="9"></line>
                        <line x1="5" y1="14" x2="19" y2="14"></line>
                        <path d="M8 17h.01"></path>
                        <path d="M16 17h.01"></path>
                        <path d="M7 21v1"></path>
                        <path d="M17 21v1"></path>
                      </svg>
                    </div>
                    <div>
                      <div className="welfare-label">{t('jobs.jobFields.transport')}</div>
                      <div className="welfare-value">
                        {['full', 'limited'].includes(parsed.transport) ? t(`jobs.jobFields.transportOptions.${parsed.transport}`) : parsed.transport}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="job-detail-section">
            <h4 className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--messenger-blue)'}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                <span>{t('jobs.description') || 'Chi tiết công việc'}</span>
              </div>
              
              <button 
                onClick={handleTranslate} 
                className={`btn-translate ${isTranslated ? 'active' : ''}`}
                disabled={isTranslating}
              >
                {isTranslating ? (
                  <>
                    <svg style={{ animation: 'spin 1s linear infinite', width: '12px', height: '12px' }} viewBox="0 0 24 24" fill="none">
                      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>{t('jobs.translating') || 'Đang dịch...'}</span>
                  </>
                ) : isTranslated ? (
                  <>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block', transform: lang === 'ja' ? 'translateY(1.5px)' : 'none'}}><path d="M2.5 12a9.5 9.5 0 0 1 19 0 9.5 9.5 0 0 1-19 0z"></path><path d="M12 2.5a15.3 15.3 0 0 1 4 9.5 15.3 15.3 0 0 1-4 9.5 15.3 15.3 0 0 1-4-9.5 15.3 15.3 0 0 1 4-9.5z"></path><path d="M2.5 12h19"></path></svg>
                    <span>{t('jobs.viewOriginal') || 'Xem bản gốc'}</span>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block', transform: lang === 'ja' ? 'translateY(1.5px)' : 'none'}}><path d="M2.5 12a9.5 9.5 0 0 1 19 0 9.5 9.5 0 0 1-19 0z"></path><path d="M12 2.5a15.3 15.3 0 0 1 4 9.5 15.3 15.3 0 0 1-4 9.5 15.3 15.3 0 0 1-4-9.5 15.3 15.3 0 0 1 4-9.5z"></path><path d="M2.5 12h19"></path></svg>
                    <span>{t('jobs.translateTo') || 'Dịch bài viết'}</span>
                  </>
                )}
              </button>
            </h4>
            <div className="job-detail-body">
              {isTranslated ? translatedJob.description : parsed.description}
            </div>
          </div>
        </div>
      </div>

      <button onClick={handleApply} className="btn-apply">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        <span>{t('jobs.applyNow') || 'Ứng tuyển ngay'}</span>
      </button>
    </div>
  );
}
