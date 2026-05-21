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
          <div className="jobs-empty">
            <div className="jobs-empty-icon">📋</div>
            <p>{t('jobs.noJobs') || 'Hiện tại chưa có việc làm nào.'}</p>
          </div>
        ) : (
          jobs.map(job => {
            const posLabel = t('register.positions.' + job.position) || job.position || '';
            const preview = job.content.length > 100 ? job.content.substring(0, 100) + '...' : job.content;
            return (
              <div key={job.id} className="job-card" onClick={() => router.push(`/jobs/${job.id}`)}>
                <div className="job-card-header">
                  <h3 className="job-card-title">{job.title}</h3>
                  {posLabel && <span className="job-card-badge">{posLabel}</span>}
                </div>
                <div className="job-card-meta">
                  {job.salary && <div className="job-card-meta-item"><span className="meta-icon">💰</span>{job.salary}</div>}
                  {job.location && <div className="job-card-meta-item"><span className="meta-icon">📍</span>{job.location}</div>}
                </div>
                <div className="job-card-preview">{preview}</div>
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
