import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopNav from './TopNav';
import ErrorBoundary from './ErrorBoundary';

const DashboardLayout = () => {
  const location = useLocation();
  return (
    <div className="app-container">
      <Sidebar />
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
