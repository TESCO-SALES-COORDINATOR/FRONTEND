import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import DashboardLayout from './components/DashboardLayout';
import DashboardHome from './views/DashboardHome';
import LeadManagement from './views/LeadManagement';
import SalesPipeline from './views/SalesPipeline';
import Appointments from './views/Appointments';
import Quotations from './views/Quotations';
import ProjectFiling from './views/ProjectFiling';
import Payments from './views/Payments';
import Reports from './views/Reports';
import Notifications from './views/Notifications';
import Settings from './views/Settings';
import Login from './views/Login';
import { getUser, clearSession } from './api/client';

// This application is LOCKED to the Sales Coordinator role.
const APP_ROLE = 'Sales Coordinator';

// Protect dashboard routes:
//  1. must be authenticated (token + flag)
//  2. the signed-in account's role must match this app's role.
// This blocks accessing another role's dashboard by editing the URL or by
// carrying over a token/localStorage from a different role's app.
const ProtectedRoute = ({ children }) => {
  const authenticated =
    !!localStorage.getItem('crm_token') &&
    localStorage.getItem('crm_authenticated') === 'true';

  if (!authenticated) return <Navigate to="/login" replace />;

  const role = getUser()?.role;
  if (role && role !== APP_ROLE) {
    // Wrong role for this portal — drop the session and bounce to login.
    clearSession();
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  return (
    <ToastProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardHome />} />
            <Route path="leads" element={<LeadManagement />} />
            <Route path="pipeline" element={<SalesPipeline />} />
            <Route path="appointments" element={<Appointments />} />
            <Route path="quotations" element={<Quotations />} />
            <Route path="projects" element={<ProjectFiling />} />
            <Route path="payments" element={<Payments />} />
            <Route path="reports" element={<Reports />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </ToastProvider>
  );
}

export default App;
