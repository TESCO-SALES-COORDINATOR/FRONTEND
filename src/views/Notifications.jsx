import React, { useState, useEffect } from 'react';
import { Bell, Calendar, FileText, DollarSign, UserCheck, FolderOpen } from 'lucide-react';
import { useToast } from '../components/Toast';

const LEADS_API = 'http://localhost:5000/api/leads';
const QUOTES_API = 'http://localhost:5000/api/quotations';
const PROJECTS_API = 'http://localhost:5000/api/projects';
const APPTS_API = 'http://localhost:5000/api/appointments';

const READ_KEY = 'crm_notif_read';

// type → icon + color (icons can't be stored in data, so resolve on the client)
const TYPE_META = {
  appointment: { icon: Calendar, color: 'var(--primary-color)' },
  quotation:   { icon: FileText, color: 'var(--warning-color)' },
  payment:     { icon: DollarSign, color: '#DC2626' },
  lead:        { icon: UserCheck, color: 'var(--success-color)' },
  project:     { icon: FolderOpen, color: 'var(--text-muted)' },
};

const parseAmount = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const n = parseFloat(String(val).replace(/[^0-9.]/g, ''));
  return Number.isNaN(n) ? 0 : n;
};

const timeAgo = (date) => {
  if (!date) return '';
  const diff = Date.now() - new Date(date).getTime();
  if (diff < 0) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
};

const loadReadSet = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]'));
  } catch {
    return new Set();
  }
};
const saveReadSet = (set) => localStorage.setItem(READ_KEY, JSON.stringify([...set]));

const Notifications = () => {
  const addToast = useToast();
  const [notifs, setNotifs] = useState([]);

  useEffect(() => {
    const build = async () => {
      const [leads, quotes, projects, appts] = await Promise.all([
        fetch(LEADS_API).then((r) => r.json()).catch(() => []),
        fetch(QUOTES_API).then((r) => r.json()).catch(() => []),
        fetch(PROJECTS_API).then((r) => r.json()).catch(() => []),
        fetch(APPTS_API).then((r) => r.json()).catch(() => []),
      ]);

      const readSet = loadReadSet();
      const items = [];

      // Appointments rescheduled by a manager — notify the coordinator with the new date/time
      (Array.isArray(appts) ? appts : [])
        .filter((a) => a.rescheduledAt)
        .forEach((a) => {
          items.push({
            id: `resched-${a._id || a.id}-${a.rescheduledAt}`, type: 'appointment', priority: 'High',
            text: `Rescheduled by ${a.rescheduledBy || 'manager'}: ${a.title || 'Appointment'} → ${a.date}${a.timeStart ? ' ' + a.timeStart : ''}`,
            sortDate: a.rescheduledAt,
          });
        });

      // Visits completed by a manager — notify the coordinator
      (Array.isArray(appts) ? appts : [])
        .filter((a) => a.completedAt)
        .forEach((a) => {
          items.push({
            id: `completed-${a._id || a.id}`, type: 'appointment', priority: 'High',
            text: `Visit completed by ${a.completedBy || 'manager'}: ${a.title || 'Visit'}`,
            sortDate: a.completedAt,
          });
        });

      // Visits created by a manager — notify the coordinator
      (Array.isArray(appts) ? appts : [])
        .filter((a) => a.createdBy)
        .forEach((a) => {
          items.push({
            id: `created-${a._id || a.id}`, type: 'appointment', priority: 'Medium',
            text: `New visit created by ${a.createdBy}: ${a.title || 'Visit'} on ${a.date || ''}`,
            sortDate: a.createdAt || a.date,
          });
        });

      // Upcoming appointments (not completed)
      (Array.isArray(appts) ? appts : [])
        .filter((a) => a.status !== 'Completed')
        .forEach((a) => {
          const id = `appt-${a._id || a.id}`;
          items.push({
            id, type: 'appointment', priority: 'High',
            text: `Reminder: ${a.title || 'Appointment'}${a.location ? ' at ' + a.location : ''}`,
            sortDate: a.createdAt || a.date,
          });
        });

      // Pending quotations + overdue payments (derived from quotations)
      (Array.isArray(quotes) ? quotes : []).forEach((q) => {
        if (q.approvalStatus === 'Pending') {
          items.push({
            id: `quote-${q.id}`, type: 'quotation', priority: 'Medium',
            text: `Quotation ${q.id} pending approval`,
            sortDate: q.updatedAt || q.createdAt,
          });
        }
        const created = q.createdAt ? new Date(q.createdAt) : null;
        const due = created ? new Date(created.getTime() + 30 * 864e5) : null;
        const received = q.approvalStatus === 'Approved' && q.quotationStatus === 'Prepared';
        if (due && due < new Date() && !received && parseAmount(q.amount) > 0) {
          items.push({
            id: `pay-${q.id}`, type: 'payment', priority: 'High',
            text: `Payment overdue for Invoice INV-${q.id}`,
            sortDate: q.createdAt,
          });
        }
      });

      // New / unassigned leads
      (Array.isArray(leads) ? leads : []).forEach((l) => {
        const isNew = /new|received/i.test(l.status || '');
        const unassigned = !l.manager || l.manager === 'Unassigned';
        if (isNew || unassigned) {
          items.push({
            id: `lead-${l.id}`, type: 'lead', priority: unassigned ? 'Medium' : 'Low',
            text: unassigned ? `Lead ${l.name || l.id} needs assignment` : `New lead: ${l.name || l.id}`,
            sortDate: l.updatedAt || l.createdAt,
          });
        }
      });

      // Recent project updates
      (Array.isArray(projects) ? projects : []).forEach((p) => {
        items.push({
          id: `proj-${p.id}`, type: 'project', priority: 'Low',
          text: `Project File ${p.id} — ${p.status || 'updated'}`,
          sortDate: p.updatedAt || p.createdAt,
        });
      });

      items.sort((a, b) => new Date(b.sortDate || 0) - new Date(a.sortDate || 0));
      const withMeta = items.slice(0, 25).map((n) => ({
        ...n,
        time: timeAgo(n.sortDate),
        read: readSet.has(n.id),
        color: TYPE_META[n.type].color,
        icon: TYPE_META[n.type].icon,
      }));
      setNotifs(withMeta);
    };
    build();
  }, []);

  const handleMarkAllRead = () => {
    const set = loadReadSet();
    notifs.forEach((n) => set.add(n.id));
    saveReadSet(set);
    setNotifs(notifs.map((n) => ({ ...n, read: true })));
    addToast('All notifications marked as read', 'success');
  };

  const handleMarkRead = (id) => {
    const set = loadReadSet();
    set.add(id);
    saveReadSet(set);
    setNotifs(notifs.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Bell size={24} /> Notifications
        </h2>
        <button className="btn btn-outline" style={{ fontSize: '0.875rem' }} onClick={handleMarkAllRead}>Mark all as read</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {notifs.length === 0 && (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 1.5rem' }}>
            You're all caught up — no notifications.
          </div>
        )}
        {notifs.map((notif) => (
          <div key={notif.id} className="card" style={{
            display: 'flex', gap: '1rem', alignItems: 'flex-start',
            opacity: notif.read ? 0.6 : 1,
            borderLeft: notif.read ? 'none' : `4px solid ${notif.color}`,
            transition: 'opacity 0.2s'
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%', backgroundColor: `${notif.color}15`, color: notif.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <notif.icon size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <p style={{ margin: 0, fontWeight: notif.read ? '500' : '600', color: 'var(--text-main)', fontSize: '1rem' }}>{notif.text}</p>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{notif.time}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                <span className={`badge ${notif.priority === 'High' ? 'badge-danger' : notif.priority === 'Medium' ? 'badge-warning' : 'badge-primary'}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.5rem' }}>
                  {notif.priority}
                </span>
                {!notif.read && <button style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '500' }} onClick={() => handleMarkRead(notif.id)}>Mark as read</button>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Notifications;
