import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Bell, Shield, PaintBucket, Briefcase, Save, LogOut } from 'lucide-react';
import { useToast } from '../components/Toast';
import { authApi, clearSession } from '../api/client';

const getStoredUser = () => {
  try {
    const base = JSON.parse(localStorage.getItem('crm_user') || 'null') || {};
    const override = JSON.parse(localStorage.getItem('crm_profile') || 'null') || {};
    return { ...base, ...override };
  } catch { return {}; }
};

const SettingsSection = ({ title, icon: Icon, children }) => (
  <div className="card" style={{ marginBottom: '1.5rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
      <Icon size={20} color="var(--primary-color)" />
      <h3 style={{ margin: 0, fontSize: '1.125rem' }}>{title}</h3>
    </div>
    {children}
  </div>
);

const Toggle = ({ label, description, defaultChecked }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
    <div>
      <p style={{ margin: 0, fontWeight: '500', fontSize: '0.875rem' }}>{label}</p>
      {description && <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{description}</p>}
    </div>
    <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '24px' }}>
      <input type="checkbox" defaultChecked={defaultChecked} style={{ opacity: 0, width: 0, height: 0 }} />
      <span style={{ 
        position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
        backgroundColor: defaultChecked ? 'var(--primary-color)' : 'var(--border-color)', borderRadius: '24px', transition: '0.4s' 
      }}>
        <span style={{ 
          position: 'absolute', content: '""', height: '18px', width: '18px', left: defaultChecked ? '18px' : '3px', bottom: '3px', 
          backgroundColor: 'white', borderRadius: '50%', transition: '0.4s' 
        }}></span>
      </span>
    </label>
  </div>
);

const Settings = () => {
  const addToast = useToast();
  const navigate = useNavigate();

  const storedUser = getStoredUser();
  const [fullName, setFullName] = useState(storedUser.name || 'Indhumathi T');
  const [email, setEmail] = useState(storedUser.email || 'akash@constructioncrm.com');

  const handleSave = async () => {
    const user = getStoredUser();
    const name = (fullName || '').trim() || user.name;
    const mail = (email || '').trim() || user.email;

    // Persist to MongoDB first so the name survives logout/login (login re-reads
    // crm_user from the DB record). Keep the local overrides updated regardless so
    // the UI reflects the edit instantly even if the request fails.
    let saved = { ...user, name, email: mail };
    let serverOk = false;
    try {
      const res = await authApi.updateProfile({ name, email: mail });
      if (res && res.user) saved = { ...user, ...res.user };
      serverOk = true;
    } catch (err) {
      addToast(err.message || 'Could not save to server. Changes kept locally.', 'error');
    }

    // Write the (server-confirmed) user to crm_user, and keep crm_profile as a
    // dedicated override that the login flow never touches, so the change sticks.
    localStorage.setItem('crm_user', JSON.stringify(saved));
    const override = { ...(JSON.parse(localStorage.getItem('crm_profile') || 'null') || {}), name: saved.name, email: saved.email };
    localStorage.setItem('crm_profile', JSON.stringify(override));

    // Reflect the edited fields in THIS view immediately.
    setFullName(saved.name);
    setEmail(saved.email);

    // Notify every component that displays the profile (sidebar, top nav, greeting)
    // so they re-read the merged profile with no manual refresh. A same-tab
    // localStorage write does not fire the native `storage` event, so we dispatch
    // a custom event that the persistent Sidebar listens for.
    window.dispatchEvent(new Event('crm-profile-updated'));
    if (serverOk) addToast('Settings saved successfully!', 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>Settings</h2>
        <button className="btn btn-primary" style={{ display: 'flex', gap: '0.5rem' }} onClick={handleSave}>
          <Save size={16} /> Save Changes
        </button>
      </div>

      <SettingsSection title="Profile Settings" icon={User}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Full Name</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Email Address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }} />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Notification Preferences" icon={Bell}>
        <Toggle label="Email Notifications" description="Receive daily summaries and critical alerts via email." defaultChecked={true} />
        <Toggle label="SMS Alerts" description="Get instant SMS for hot leads and urgent appointments." defaultChecked={false} />
        <Toggle label="Browser Push Notifications" description="Receive real-time updates while dashboard is open." defaultChecked={true} />
      </SettingsSection>

      <SettingsSection title="CRM Workflow Settings" icon={Briefcase}>
        <div style={{ marginBottom: '1rem' }}>
           <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Default Lead Priority</label>
           <select style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
             <option>Medium Priority</option>
             <option>Low Priority</option>
             <option>High Priority</option>
           </select>
        </div>
        <Toggle label="Auto-Assign Leads" description="Automatically assign incoming leads based on manager availability." defaultChecked={false} />
      </SettingsSection>

      <SettingsSection title="Account & Session" icon={Shield}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: 0, fontWeight: '500', fontSize: '0.875rem' }}>Active Session</p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>You are currently logged in as {email}</p>
          </div>
          <button 
            type="button"
            className="btn" 
            style={{ 
              backgroundColor: '#FEF2F2', 
              color: '#DC2626', 
              border: '1px solid #FCA5A5',
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              padding: '0.625rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onClick={async () => {
              try {
                await authApi.logout(); // notify backend (records event)
              } catch {
                // even if the server is unreachable, clear the local session
              }
              clearSession();
              addToast('Logged out successfully!', 'success');
              navigate('/login');
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#FEE2E2';
              e.currentTarget.style.borderColor = '#EF4444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#FEF2F2';
              e.currentTarget.style.borderColor = '#FCA5A5';
            }}
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </SettingsSection>
    </div>
  );
};

export default Settings;
