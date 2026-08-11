import React, { useState, useEffect, useRef } from 'react';
import { Bell, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
// Reuse the SAME notification derivation + timestamp helpers + read-set as the
// Notifications page, so the bell dropdown and the page always show identical
// items, order and timestamps.
import { buildNotifications, timeAgo, fmtDateTime, loadReadSet, READ_KEY } from '../views/Notifications';

const TopNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [readVersion, setReadVersion] = useState(0);
  const ref = useRef(null);

  const path = location.pathname.substring(1).replace('-', ' ');
  const title = path.charAt(0).toUpperCase() + path.slice(1);

  useEffect(() => {
    let active = true;
    buildNotifications().then((items) => { if (active) setNotifs(items); });
    return () => { active = false; };
  }, [location.pathname]);

  // Close the dropdown when clicking outside
  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Badge shows only UNREAD notifications (read set is shared with the Notifications page)
  const readSet = loadReadSet();
  const unreadCount = notifs.filter((n) => !readSet.has(n.id)).length;
  void readVersion; // referenced so the badge recomputes after marking read

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
              onClick={() => {
                const next = !open;
                // Opening the panel marks the shown notifications as read → clears the badge
                if (next) {
                  const set = loadReadSet();
                  notifs.forEach((n) => set.add(n.id));
                  localStorage.setItem(READ_KEY, JSON.stringify([...set]));
                  setReadVersion((v) => v + 1);
                }
                setOpen(next);
              }}
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: '-6px', right: '-6px', minWidth: '18px', height: '18px', padding: '0 5px', backgroundColor: '#ef4444', color: '#ffffff', fontSize: '0.65rem', fontWeight: '700', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff', lineHeight: 1 }}>
                  {unreadCount}
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
                      <span title={fmtDateTime(n.sortDate)} style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{timeAgo(n.sortDate)} · {fmtDateTime(n.sortDate)}</span>
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
