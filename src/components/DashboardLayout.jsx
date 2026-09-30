import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopNav from './TopNav';
import ErrorBoundary from './ErrorBoundary';

const DashboardLayout = () => {
  const location = useLocation();
  // Collapsible sidebar (like the Manager/Head apps). Remembered across reloads.
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('crm_sidebar_collapsed') === '1'; } catch { return false; }
  });
  const toggleSidebar = () => setCollapsed((c) => {
    const next = !c;
    try { localStorage.setItem('crm_sidebar_collapsed', next ? '1' : '0'); } catch { /* ignore */ }
    return next;
  });
  return (
    <div className="app-container">
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
      <div className="main-content">
        <TopNav />
        <main className="content-scroll">
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
