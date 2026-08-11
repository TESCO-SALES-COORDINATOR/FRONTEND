import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { getUser } from '../api/client';
import {
  LayoutDashboard,
  Users,
  KanbanSquare,
  Calendar,
  FileText,
  FolderOpen,
  CreditCard,
  Bell,
  Settings
} from 'lucide-react';

const menuItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/leads', label: 'Lead Management', icon: Users },
  { path: '/pipeline', label: 'Sales Pipeline', icon: KanbanSquare },
  { path: '/appointments', label: 'Appointments', icon: Calendar },
  { path: '/quotations', label: 'Quotations', icon: FileText },
  { path: '/projects', label: 'Order Confirm', icon: FolderOpen },
  { path: '/payments', label: 'Payment Collection', icon: CreditCard },
];

const bottomItems = [
  { path: '/notifications', label: 'Notifications', icon: Bell },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const Sidebar = () => {
  // Keep the account holder reactive: re-read the merged profile whenever Settings
  // saves (custom event) or another tab changes it (native `storage` event), so the
  // sidebar reflects a saved name/role instantly with no manual refresh.
  const [user, setUser] = useState(getUser());
  useEffect(() => {
    const refresh = () => setUser(getUser());
    window.addEventListener('crm-profile-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('crm-profile-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  const userName = user?.name || 'Indhumathi T';
  // This is the Sales Coordinator app — always show the Coordinator role regardless of what
  // a shared/stored account role says (e.g. an account whose stored role is "Sales Manager").
  const userRole = 'Sales Coordinator';
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
        <h2 style={{ color: 'white', fontSize: '1.4rem', fontWeight: '800', letterSpacing: '0.3px', margin: 0 }}>
          SalesCRM
        </h2>
        <div style={{ color: '#8A8FC5', fontSize: '0.75rem', fontWeight: '500', marginTop: '0.25rem' }}>
          Construction Workflow
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
              padding: '0.8rem 0.9rem',
              borderRadius: '0.7rem',
              textDecoration: 'none',
              color: isActive ? '#FFFFFF' : '#C4C7E8',
              backgroundColor: isActive ? '#312E81' : 'transparent',
              fontWeight: isActive ? '600' : '500',
              fontSize: '0.95rem',
              transition: 'all 0.2s ease',
              boxShadow: isActive ? '0 6px 16px rgba(49, 46, 129, 0.5)' : 'none'
            })}
          >
            {({ isActive }) => (
              <>
                <item.icon size={20} strokeWidth={2} color={isActive ? '#A5B4FC' : '#9FA3CE'} />
                {item.label}
              </>
            )}
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
               gap: '0.85rem',
               padding: '0.8rem 0.9rem',
               borderRadius: '0.7rem',
               textDecoration: 'none',
               color: isActive ? '#FFFFFF' : '#C4C7E8',
               backgroundColor: isActive ? '#312E81' : 'transparent',
               fontWeight: '500',
               fontSize: '0.95rem',
               transition: 'all 0.2s ease'
             })}
           >
             {({ isActive }) => (
               <>
                 <item.icon size={20} strokeWidth={2} color={isActive ? '#A5B4FC' : '#9FA3CE'} />
                 {item.label}
               </>
             )}
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
