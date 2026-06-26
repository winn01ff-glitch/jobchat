'use client';
import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import JobsPage from './page';

export default function JobsLayout({ children }) {
  const pathname = usePathname();
  const isDetail = pathname !== '/jobs';
  const [savedDetailChild, setSavedDetailChild] = useState(null);

  useEffect(() => {
    if (isDetail) {
      setSavedDetailChild(children);
    }
  }, [children, isDetail]);

  return (
    <div className="jobs-layout-container">
      {/* List view (background on detail, active on list) */}
      <div className={`jobs-layout-list ${isDetail ? 'is-detail' : ''}`}>
        {isDetail ? <JobsPage /> : children}
      </div>

      {/* Detail view overlay */}
      <div className={`jobs-layout-detail ${isDetail ? 'is-detail' : ''}`}>
        {isDetail ? children : savedDetailChild}
      </div>
    </div>
  );
}
