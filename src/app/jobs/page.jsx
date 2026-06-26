'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '../../context/LanguageContext';
import { DB } from '../../lib/supabase';
import { formatDate } from '../../lib/helpers';

export default function JobsPage() {
  const { t } = useLanguage();
  const router = useRouter();

  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await DB.getPublishedJobs();
        setJobs(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="jobs-container">
      <div className="jobs-header">
        <h2>{t('jobs.title') || 'Việc làm'}</h2>
        <p>{t('jobs.subtitle') || 'Tìm công việc phù hợp cho bạn'}</p>
      </div>
      
      <div className="jobs-list" id="jobs-list">
        {isLoading ? (
          <div style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)'}}>
            <div className="spinner"></div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="jobs-empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gridColumn: '1 / -1', width: '100%' }}>
            <div className="jobs-empty-icon" style={{ display: 'flex', justifyContent: 'center' }}>
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--text-muted)'}}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
            </div>
            <p>{t('jobs.noJobs') || 'Hiện tại chưa có việc làm nào.'}</p>
          </div>
        ) : (
          jobs.map(job => {
            const posLabel = t('register.positions.' + job.position) || job.position || '';
            
            let previewText = job.content;
            try {
              const parsed = JSON.parse(job.content);
              if (parsed && typeof parsed === 'object' && 'description' in parsed) {
                previewText = parsed.description;
              }
            } catch (e) {}
            
            const preview = previewText.length > 100 ? previewText.substring(0, 100) + '...' : previewText;
            return (
              <div key={job.id} className="job-card" onClick={() => router.push(`/jobs/${job.id}`)}>
                <div className="job-card-header">
                  <h3 className="job-card-title">{job.title}</h3>
                  {posLabel && <span className="job-card-badge">{posLabel}</span>}
                </div>
                <div className="job-card-meta">
                  {job.salary && (
                    <div className="job-card-meta-item">
                      <span className="meta-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}><path d="M6 3l6 8 6-8M12 11v10M9 13h6M9 17h6"/></svg>
                      </span>
                      <span>{job.salary}</span>
                    </div>
                  )}
                  {job.location && (
                    <div className="job-card-meta-item">
                      <span className="meta-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                      </span>
                      <span>{job.location}</span>
                    </div>
                  )}
                </div>
                <div className="job-card-footer">
                  <span className="job-card-date">{formatDate(job.created_at)}</span>
                  <span className="job-card-action">{t('jobs.viewDetail') || 'Xem chi tiết'} →</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
