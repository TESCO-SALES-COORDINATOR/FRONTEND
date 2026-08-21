import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { notificationsApi } from '../api/client';
// Reuse the SAME timestamp helpers as the Notifications page so the bell dropdown
// and the page always show identical relative/absolute times.
import { timeAgo, fmtDateTime } from '../views/Notifications';

const TopNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef(null);

  const path = location.pathname.substring(1).replace('-', ' ');
  const title = path.charAt(0).toUpperCase() + path.slice(1);

  // Pull the real, DB-backed notifications + unread badge count (Sales Coordinator scope).
  const load = useCallback(async () => {
    try {
      const data = await notificationsApi.getNotifications();
      setNotifs(Array.isArray(data?.notifications) ? data.notifications : []);
      setUnreadCount(Number(data?.unreadCount) || 0);
    } catch {
      /* leave last-known state on transient errors */
    }
  }, []);

  // Fetch on mount and poll every 30s for near-real-time updates.
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  // Close the dropdown when clicking outside
  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const markRead = async (n) => {
    if (n.isRead) return;
    // Optimistic: flip the item + decrement the badge immediately.
    setNotifs((prev) => prev.map((x) => (x._id === n._id ? { ...x, isRead: true } : x)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await notificationsApi.markRead(n._id);
    } catch {
      load();
    }
  };

  const markAllRead = async () => {
    if (unreadCount === 0) return;
    setNotifs((prev) => prev.map((x) => ({ ...x, isRead: true })));
    setUnreadCount(0);
    try {
      await notificationsApi.markAllRead();
    } catch {
      load();
    }
  };

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
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: '-6px', right: '-6px', minWidth: '18px', height: '18px', padding: '0 5px', backgroundColor: '#ef4444', color: '#ffffff', fontSize: '0.65rem', fontWeight: '700', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff', lineHeight: 1 }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {open && (
              <div style={{
                position: 'absolute', top: '36px', right: 0, width: '360px', maxHeight: '440px', overflowY: 'auto',
                backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.12))', zIndex: 100
              }}>
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, backgroundColor: 'var(--surface-color)' }}>
                  <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}</span>
                  {unreadCount > 0 ? (
                    <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}>Mark all as read</button>
                  ) : (
                    <button onClick={() => { setOpen(false); navigate('/notifications'); }} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}>View all</button>
                  )}
                </div>
                {notifs.length === 0 ? (
                  <div style={{ padding: '1.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>You're all caught up.</div>
                ) : (
                  notifs.map((n) => {
                    const unread = !n.isRead;
                    const when = n.eventAt || n.createdAt;
                    return (
                      <div
                        key={n._id}
                        onClick={() => markRead(n)}
                        style={{
                          padding: '0.7rem 1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.2rem',
                          cursor: unread ? 'pointer' : 'default',
                          borderLeft: unread ? '3px solid var(--primary-color)' : '3px solid transparent',
                          background: unread ? 'var(--hover-color, rgba(99,102,241,0.06))' : 'transparent'
                        }}
                      >
                        <span style={{ fontSize: '0.82rem', fontWeight: unread ? '700' : '500', color: 'var(--text-main)' }}>{n.title}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{n.message}</span>
                        <span title={fmtDateTime(when)} style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{timeAgo(when)}</span>
                      </div>
                    );
                  })
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
