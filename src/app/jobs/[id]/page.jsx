'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useLanguage } from '../../../context/LanguageContext';
import { DB } from '../../../lib/supabase';
import { formatDate } from '../../../lib/helpers';

export default function JobDetailPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const id = params?.id;

  const [job, setJob] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

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
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id]);

  const handleApply = () => {
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

  return (
    <div className="candidate-job-detail-container">
      
      {/* Sticky Job Header Bar (Bọc trong Wrapper chống đè chữ khi cuộn) */}
      <div style={{ 
        position: 'sticky', 
        top: 'var(--header-height, 60px)', 
        zIndex: 100, 
        background: 'var(--bg-secondary)', 
        padding: '6px 0 12px 0',
        margin: '-6px 0 -12px 0' 
      }}>
        <div className="candidate-job-sticky-header" style={{ margin: 0 }}>
          <div style={{ flex: 1 }}>
            <h1 className="job-detail-title">{job.title}</h1>
            
            <div className="job-detail-meta">
              {job.position && (
                <div className="job-detail-meta-item">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                  <span>{t('register.positions.' + job.position) || job.position}</span>
                </div>
              )}
              {job.salary && (
                <div className="job-detail-meta-item">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}><path d="M6 3l6 8 6-8M12 11v10M9 13h6M9 17h6"/></svg>
                  <span>{job.salary}</span>
                </div>
              )}
              {job.location && (
                <div className="job-detail-meta-item">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                  <span>{job.location}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Card chi tiết (Nội dung & Phúc lợi) */}
      <div className="candidate-job-detail-card">
        
        {/* Khung phúc lợi đãi ngộ (Nằm trên đầu) */}
        {(parsed.bonus || parsed.nenkin || parsed.insurance || parsed.raise || parsed.transport) && (
          <div style={{
            marginBottom: '24px',
            padding: '20px',
            background: 'var(--bg-secondary)',
            borderRadius: '12px',
            border: '1px solid var(--border-light)'
          }}>
            <h4 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--messenger-blue)'}}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <span>{t('jobs.welfare') || 'Chế độ & Phúc lợi'}</span>
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              {parsed.bonus && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(230,126,34,0.1)', flexShrink: 0 }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#e67e22" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 12 20 22 4 22 4 12"></polyline>
                      <rect x="2" y="7" width="20" height="5"></rect>
                      <line x1="12" y1="22" x2="12" y2="7"></line>
                      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path>
                      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>{t('jobs.jobFields.bonus')}</div>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>
                      {['twice_a_year', 'once_a_year', 'performance', 'none'].includes(parsed.bonus) ? t(`jobs.jobFields.bonusOptions.${parsed.bonus}`) : parsed.bonus}
                    </div>
                  </div>
                </div>
              )}
              {(parsed.insurance || parsed.nenkin) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(39,174,96,0.1)', flexShrink: 0 }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#27ae60" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>{t('jobs.jobFields.insurance')}</div>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>
                      {parsed.insurance ? (
                        ['full', 'partial', 'none'].includes(parsed.insurance) ? t(`jobs.jobFields.insuranceOptions.${parsed.insurance}`) : parsed.insurance
                      ) : (
                        ['full', 'none'].includes(parsed.nenkin) ? t(`jobs.jobFields.nenkinOptions.${parsed.nenkin}`) : parsed.nenkin
                      )}
                    </div>
                  </div>
                </div>
              )}
              {parsed.raise && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(192,57,43,0.1)', flexShrink: 0 }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#c0392b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                      <polyline points="17 6 23 6 23 12"></polyline>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>{t('jobs.jobFields.raise')}</div>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>
                      {['once_a_year', 'performance', 'none'].includes(parsed.raise) ? t(`jobs.jobFields.raiseOptions.${parsed.raise}`) : parsed.raise}
                    </div>
                  </div>
                </div>
              )}
              {parsed.transport && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(22,160,133,0.1)', flexShrink: 0 }}>
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
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>{t('jobs.jobFields.transport')}</div>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>
                      {['full', 'limited', 'none'].includes(parsed.transport) ? t(`jobs.jobFields.transportOptions.${parsed.transport}`) : parsed.transport}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '24px 0' }} />

        {/* Nội dung chi tiết công việc */}
        <div className="job-detail-content" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.8', color: 'var(--text-primary)', fontSize: '16px' }}>
          {parsed.description}
        </div>
      </div>

      {/* Thanh ứng tuyển ghim cố định ở dưới cùng (PC & Mobile) */}
      <div className="candidate-job-apply-bar-wrapper">
        <div className="candidate-job-apply-bar">
          <button onClick={handleApply}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            <span>{t('jobs.applyNow') || 'Ứng tuyển ngay'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
