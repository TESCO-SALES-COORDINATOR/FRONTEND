import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Calendar, FileText, DollarSign, UserCheck, FolderOpen } from 'lucide-react';
import { useToast } from '../components/Toast';
import { notificationsApi } from '../api/client';

// entityType → icon + color (icons can't be stored in data, so resolve on the client)
export const TYPE_META = {
  appointment: { icon: Calendar, color: 'var(--primary-color)' },
  quotation:   { icon: FileText, color: 'var(--warning-color)' },
  payment:     { icon: DollarSign, color: '#DC2626' },
  lead:        { icon: UserCheck, color: 'var(--success-color)' },
  project:     { icon: FolderOpen, color: 'var(--text-muted)' },
};
const metaFor = (n) => TYPE_META[n.entityType] || { icon: Bell, color: 'var(--text-muted)' };

// Relative label ("2h ago", "1d ago") from a REAL timestamp
export const timeAgo = (date) => {
  if (!date) return '';
  const diff = Date.now() - new Date(date).getTime();
  if (Number.isNaN(diff)) return '';
  if (diff < 0) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

// Absolute date/time from the record's REAL timestamp (e.g. "Aug 4, 2026, 2:30 PM")
export const fmtDateTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const Notifications = () => {
  const addToast = useToast();
  const [notifs, setNotifs] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

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

  // Fetch on mount and poll every 30s so manager/head-side events surface in real time.
  useEffect(() => {
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load]);

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await notificationsApi.markAllRead();
      addToast('All notifications marked as read', 'success');
    } catch {
      load();
    }
  };

  const handleMarkRead = async (n) => {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Bell size={24} /> Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}
        </h2>
        {unreadCount > 0 && (
          <button className="btn btn-outline" style={{ fontSize: '0.875rem' }} onClick={handleMarkAllRead}>Mark all as read</button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {notifs.length === 0 && (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 1.5rem' }}>
            You're all caught up — no notifications.
          </div>
        )}
        {notifs.map((notif) => {
          const meta = metaFor(notif);
          const Icon = meta.icon;
          const when = notif.eventAt || notif.createdAt;
          return (
            <div key={notif._id} className="card" style={{
              display: 'flex', gap: '1rem', alignItems: 'flex-start',
              opacity: notif.isRead ? 0.6 : 1,
              borderLeft: notif.isRead ? 'none' : `4px solid ${meta.color}`,
              transition: 'opacity 0.2s'
            }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%', backgroundColor: `${meta.color}15`, color: meta.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <Icon size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.25rem' }}>
                  <p style={{ margin: 0, fontWeight: notif.isRead ? '500' : '700', color: 'var(--text-main)', fontSize: '1rem' }}>{notif.title}</p>
                  <span title={fmtDateTime(when)} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{timeAgo(when)}</span>
                </div>
                <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.9rem' }}>{notif.message}</p>
                {when && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{fmtDateTime(when)}</div>}
                {!notif.isRead && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <button style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '500', padding: 0 }} onClick={() => handleMarkRead(notif)}>Mark as read</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Notifications;
