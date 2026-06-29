import React, { useState, useEffect, useRef } from 'react';
import { Bell, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const API = 'http://localhost:5000/api';

const timeAgo = (date) => {
  if (!date) return '';
  const diff = Date.now() - new Date(date).getTime();
  if (diff < 0) return 'just now';
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const TopNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const ref = useRef(null);

  const path = location.pathname.substring(1).replace('-', ' ');
  const title = path.charAt(0).toUpperCase() + path.slice(1);

  useEffect(() => {
    const build = async () => {
      const [appts, quotes] = await Promise.all([
        fetch(`${API}/appointments`).then((r) => r.json()).catch(() => []),
        fetch(`${API}/quotations`).then((r) => r.json()).catch(() => []),
      ]);
      const items = [];

      // Reschedules done by managers — highest priority
      (Array.isArray(appts) ? appts : [])
        .filter((a) => a.rescheduledAt)
        .forEach((a) => items.push({
          id: `resched-${a._id || a.id}-${a.rescheduledAt}`,
          text: `Rescheduled by ${a.rescheduledBy || 'manager'}: ${a.title || 'Appointment'} → ${a.date}${a.timeStart ? ' ' + a.timeStart : ''}`,
          sortDate: a.rescheduledAt,
        }));

      // Visits completed by a manager
      (Array.isArray(appts) ? appts : [])
        .filter((a) => a.completedAt)
        .forEach((a) => items.push({
          id: `completed-${a._id || a.id}`,
          text: `Visit completed by ${a.completedBy || 'manager'}: ${a.title || 'Visit'}`,
          sortDate: a.completedAt,
        }));

      // Visits created by a manager
      (Array.isArray(appts) ? appts : [])
        .filter((a) => a.createdBy)
        .forEach((a) => items.push({
          id: `created-${a._id || a.id}`,
          text: `New visit by ${a.createdBy}: ${a.title || 'Visit'} on ${a.date || ''}`,
          sortDate: a.createdAt || a.date,
        }));

      // Upcoming appointments
      (Array.isArray(appts) ? appts : [])
        .filter((a) => a.status !== 'Completed')
        .forEach((a) => items.push({
          id: `appt-${a._id || a.id}`,
          text: `${a.title || 'Appointment'}${a.manager ? ' — ' + a.manager : ''} on ${a.date || ''}`,
          sortDate: a.createdAt || a.date,
        }));

      // Pending quotations
      (Array.isArray(quotes) ? quotes : [])
        .filter((q) => q.approvalStatus === 'Pending')
        .forEach((q) => items.push({
          id: `quote-${q.id}`,
          text: `Quotation ${q.id} pending approval`,
          sortDate: q.updatedAt || q.createdAt,
        }));

      items.sort((a, b) => new Date(b.sortDate || 0) - new Date(a.sortDate || 0));
      setNotifs(items.slice(0, 15));
    };
    build();
  }, [location.pathname]);

  // Close the dropdown when clicking outside
  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="glass-panel" style={{
      height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 2rem', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid var(--border-color)'
    }}>
      {/* Left Section */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pages / {title}</div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>{title}</h1>
      </div>

      {/* Right Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div ref={ref} style={{ position: 'relative' }}>
            <button
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', position: 'relative', display: 'flex' }}
              onClick={() => setOpen((o) => !o)}
            >
              <Bell size={20} />
              {notifs.length > 0 && (
                <span style={{ position: 'absolute', top: '-6px', right: '-6px', minWidth: '18px', height: '18px', padding: '0 5px', backgroundColor: '#ef4444', color: '#ffffff', fontSize: '0.65rem', fontWeight: '700', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff', lineHeight: 1 }}>
                  {notifs.length}
                </span>
              )}
            </button>

            {open && (
              <div style={{
                position: 'absolute', top: '36px', right: 0, width: '340px', maxHeight: '420px', overflowY: 'auto',
                backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.12))', zIndex: 100
              }}>
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>Notifications</span>
                  <button onClick={() => { setOpen(false); navigate('/notifications'); }} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}>View all</button>
                </div>
                {notifs.length === 0 ? (
                  <div style={{ padding: '1.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>You're all caught up.</div>
                ) : (
                  notifs.map((n) => (
                    <div key={n.id} style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>{n.text}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{timeAgo(n.sortDate)}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => navigate('/settings')}>
            <User size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopNav;
