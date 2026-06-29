import React from 'react';
import { NavLink } from 'react-router-dom';
import { getUser } from '../api/client';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  FileText, 
  FolderOpen, 
  CreditCard, 
  BarChart3, 
  Bell, 
  Settings
} from 'lucide-react';

const menuItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/leads', label: 'Lead Management', icon: Users },
  { path: '/appointments', label: 'Appointments', icon: Calendar },
  { path: '/quotations', label: 'Quotations', icon: FileText },
  { path: '/projects', label: 'Project Filing', icon: FolderOpen },
  { path: '/payments', label: 'Payment Collection', icon: CreditCard },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
];

const bottomItems = [
  { path: '/notifications', label: 'Notifications', icon: Bell },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const Sidebar = () => {
  const user = getUser();
  const userName = user?.name || 'Indhumathi T';
  const userRole = user?.role || 'Sales Coordinator';
  const userInitials = userName.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'IT';
  return (
    <div style={{
      width: '260px',
      backgroundColor: 'var(--sidebar-bg)',
      color: 'var(--sidebar-text)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '1.5rem 1rem'
    }}>
      <div style={{ marginBottom: '2rem', padding: '0 0.75rem' }}>
        <h2 style={{ color: 'white', fontSize: '1.25rem', fontWeight: '700', letterSpacing: '0.5px', margin: 0 }}>
          SalesCRM
        </h2>
        <div style={{ color: 'var(--secondary-color)', fontSize: '0.75rem', fontWeight: '500', marginTop: '0.25rem' }}>
          Construction Workflow
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              color: isActive ? 'white' : 'var(--sidebar-text)',
              backgroundColor: isActive ? 'var(--sidebar-active)' : 'transparent',
              fontWeight: isActive ? '600' : '500',
              transition: 'all 0.2s ease',
              boxShadow: isActive ? '0 0 10px rgba(255, 255, 255, 0.05)' : 'none'
            })}
          >
            <item.icon size={20} strokeWidth={2} />
            {item.label}
          </NavLink>
        ))}
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {bottomItems.map((item) => (
             <NavLink
             key={item.path}
             to={item.path}
             style={({ isActive }) => ({
               display: 'flex',
               alignItems: 'center',
               gap: '0.75rem',
               padding: '0.75rem',
               borderRadius: 'var(--radius-md)',
               textDecoration: 'none',
               color: 'var(--sidebar-text)',
               fontWeight: '500',
               transition: 'all 0.2s ease'
             })}
           >
             <item.icon size={20} strokeWidth={2} />
             {item.label}
           </NavLink>
        ))}
      </div>

      <div style={{
        marginTop: '1.5rem',
        padding: '1rem',
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem'
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          backgroundColor: 'var(--primary-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold'
        }}>
          {userInitials}
        </div>
        <div>
          <div style={{ color: 'white', fontSize: '0.875rem', fontWeight: '600' }}>{userName}</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>{userRole}</div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
