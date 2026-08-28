import React, { useState, useEffect } from 'react';
import { Search, Filter, User, Phone, MapPin, ChevronLeft, ChevronRight, CalendarCheck2, CalendarClock, CheckCircle2, Flag, X, Calendar as CalendarIcon } from 'lucide-react';
import { useToast } from '../components/Toast';

const APPT_API = 'https://api-salescoordinator.tescomanagement.com/api/appointments';

const STATUS_STYLES = {
  Waiting:   { bg: '#FEF3C7', color: '#92400E', label: 'WAITING' },
  Assigned:  { bg: '#D1FAE5', color: '#065F46', label: 'ASSIGNED' },
  Completed: { bg: '#DBEAFE', color: '#1E40AF', label: 'COMPLETED' },
  Started:   { bg: '#EDE9FE', color: '#5B21B6', label: 'STARTED' },
};

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// The 4 sales managers a visit can be assigned to
const SALES_TEAM = ['Azar Abdullah A', 'Praveenraja P', 'Suresh P', 'Agsal A'];

function formatDisplayDate(dateStr) {
  const d = new Date(dateStr);
  // Guard against missing / invalid dates so a single bad record can't crash the page
  if (!dateStr || isNaN(d.getTime())) return dateStr || '—';
  const day = d.getDate();
  const month = (MONTHS[d.getMonth()] || '').slice(0, 3).toUpperCase();
  const year = d.getFullYear();
  return `${day < 10 ? '0' + day : day} ${month} ${year}`;
}

function convertTo12Hour(time24) {
  if (!time24 || !String(time24).includes(':')) return time24 || '';
  const [hoursStr, minutesStr] = String(time24).split(':');
  let hours = parseInt(hoursStr, 10);
  if (isNaN(hours)) return time24;
  const minutes = minutesStr ?? '00';
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursFormatted = hours < 10 ? '0' + hours : hours;
  return `${hoursFormatted}:${minutes} ${ampm}`;
}

function convertTo24Hour(time12) {
  if (!time12 || !String(time12).includes(':')) return '';
  const [time, modifier] = String(time12).split(' ');
  let [hours, minutes] = time.split(':');
  if (minutes === undefined) minutes = '00';
  if (hours === '12') {
    hours = '00';
  }
  if (modifier === 'PM') {
    hours = parseInt(hours, 10) + 12;
  }
  const hoursStr = parseInt(hours, 10) < 10 ? '0' + parseInt(hours, 10) : hours.toString();
  return `${hoursStr}:${minutes}`;
}

// Always render a time in 12-hour AM/PM (handles values already in 12h or stored as 24h)
function display12h(t) {
  if (!t) return '';
  return /[ap]m/i.test(t) ? t : convertTo12Hour(t);
}

const Appointments = () => {
  const addToast = useToast();
  // Start empty and show only real appointments stored in the database (no demo/seed rows)
  const [appointments, setAppointments] = useState([]);
  const [apptLoaded, setApptLoaded] = useState(false);
  const [leads, setLeads] = useState([]);

  // Normalize API record so existing JSX (apt.id) keeps working
  const normalize = (a) => ({ ...a, id: a._id || a.id });

  // Load appointments from API on mount (always reflect what is stored, even when empty)
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(APPT_API);
        const data = await res.json();
        // Hide cancelled appointments from the active list (they remain in the DB so the
        // assigned manager still gets a cancellation notification).
        if (Array.isArray(data)) setAppointments([...data].sort((a, b) => new Date(b.createdAt || b.updatedAt || b.date || 0) - new Date(a.createdAt || a.updatedAt || a.date || 0)).map(normalize).filter(a => a.status !== 'Cancelled' && !a.cancelledAt));
      } catch (err) {
        console.error('Failed to load appointments:', err);
      } finally {
        setApptLoaded(true);
      }
    };
    load();
    // Poll so a manager completing/rescheduling an appointment is reflected here live
    // (without needing a manual page refresh).
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, []);

  // Load leads so an appointment can be linked to a lead (and logged on its history)
  useEffect(() => {
    fetch('https://api-salescoordinator.tescomanagement.com/api/leads')
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setLeads(d); })
      .catch((e) => console.error('Failed to load leads:', e));
  }, []);

  // Append an entry to a lead's shared history (visible to manager + coordinator)
  const appendLeadHistory = (leadId, message) => {
    if (!leadId) return;
    const lead = leads.find((l) => l.id === leadId);
    const stamp = new Date().toLocaleDateString('en-GB') + ', ' + new Date().toLocaleTimeString('en-US', { hour12: false });
    const entry = { timestamp: stamp, message, remark: '' };
    const history = Array.isArray(lead?.history) ? [...lead.history, entry] : [entry];
    fetch(`https://api-salescoordinator.tescomanagement.com/api/leads/${leadId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ history })
    }).catch((e) => console.error('Failed to update lead history:', e));
  };

  const [activeTab, setActiveTab] = useState('Appointment');
  const [searchQuery, setSearchQuery] = useState('');
  const [calendarDate, setCalendarDate] = useState(() => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), 1); });
  const [selectedDay, setSelectedDay] = useState(null); // 'YYYY-MM-DD' when a calendar day is clicked
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newVisit, setNewVisit] = useState({ title: '', leadId: '', date: '', timeStart: '', timeEnd: '', manager: '', phone: '', location: '', status: 'Waiting', type: 'Appointment' });
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [rescheduleAptId, setRescheduleAptId] = useState(null);
  const [rescheduleDetails, setRescheduleDetails] = useState({ date: '', timeStart: '', timeEnd: '', reason: '' });
  const [selectedManager, setSelectedManager] = useState('All');
  const uniqueManagers = Array.from(new Set(appointments.map(a => a.manager).filter(Boolean)));

  // The lead id an appointment/visit belongs to. Prefer the stored leadId; otherwise recover
  // it by matching the phone (last 10 digits) or the customer name to a loaded lead. Shows the
  // coordinator exactly which lead each record is for (and flags unlinked records with "—").
  const digitsOnly = (s) => String(s || '').replace(/\D/g, '');
  const leadIdFor = (apt) => {
    if (apt.leadId) return apt.leadId;
    const ph = digitsOnly(apt.phone);
    const byPhone = ph ? leads.find(l => digitsOnly(l.phone) && digitsOnly(l.phone).slice(-10) === ph.slice(-10)) : null;
    if (byPhone) return byPhone.id;
    const nm = String(apt.client || apt.customerName || apt.title || '').trim().toLowerCase();
    const byName = nm ? leads.find(l => String(l.name || '').trim().toLowerCase() === nm) : null;
    return byName ? byName.id : '—';
  };

  /* ── Live counts (type-aware, computed from real stored appointments) ── */
  // Anything whose type contains "visit" is a Visit; everything else is an Appointment
  const isVisitType = (a) => /visit/i.test(a.type || '');
  // Robust "completed" check: a manager may write status "Completed" and/or progressStatus
  // "completed" (any casing) — count it done if either says so.
  const isDone = (a) => {
    const s = String(a.status || '').toLowerCase();
    return s.includes('complet') || String(a.progressStatus || '').toLowerCase() === 'completed' || !!a.completedAt;
  };
  const totalAppointments = appointments.filter(a => !isVisitType(a)).length;
  const visitPlanned      = appointments.filter(a => isVisitType(a) && !isDone(a)).length;
  const completedAppt     = appointments.filter(a => !isVisitType(a) && isDone(a)).length;
  const visitComplete     = appointments.filter(a => isVisitType(a) && isDone(a)).length;

  /* ── Lifecycle gating (strict sequence Lead → Appointment → Visit) ──
     Eligibility is derived from the actual appointment/visit records, keyed by leadId.
       • Appointment: a lead can have only ONE appointment → hide leads that already have one.
       • Visit:       a lead can have only ONE visit, and only AFTER its appointment is completed
                      → show only leads with a completed appointment and no visit yet. */
  // Match an appointment/visit to a lead. A LINKED record (has leadId) matches only its exact
  // lead. An UNLINKED record (no leadId) falls back to the phone's last 10 digits, so a lead
  // that already has an appointment is still removed from the dropdown even if the record was
  // saved without a leadId. (Name is deliberately not used — several test leads share a name.)
  const asLead = (x) => (x && typeof x === 'object') ? x : (leads.find(l => l.id === x) || { id: x });
  const apptMatchesLead = (a, l) => {
    if (a.leadId) return a.leadId === l.id;
    const ap = digitsOnly(a.phone), lp = digitsOnly(l.phone);
    return !!(ap && lp && ap.slice(-10) === lp.slice(-10));
  };
  const leadHasAppointment          = (x) => { const l = asLead(x); return appointments.some(a => !isVisitType(a) && apptMatchesLead(a, l)); };
  const leadHasCompletedAppointment = (x) => { const l = asLead(x); return appointments.some(a => !isVisitType(a) && isDone(a) && apptMatchesLead(a, l)); };
  const leadHasVisit                = (x) => { const l = asLead(x); return appointments.some(a => isVisitType(a) && apptMatchesLead(a, l)); };
  // Leads that may be picked for the record type currently chosen in the create modal.
  // Always keep the currently-selected lead visible so an in-progress choice never vanishes.
  const eligibleLeads = leads.filter(l => {
    if (l.id === newVisit.leadId) return true;
    if (newVisit.type === 'Visits') return leadHasCompletedAppointment(l) && !leadHasVisit(l);
    // Appointment: only leads that have NOT already been scheduled for an appointment or visit.
    return !leadHasAppointment(l) && !leadHasVisit(l);
  });

  /* ── Filter — appointments only (visits live on the manager side) ── */
  const filtered = appointments.filter(a => {
    if (isVisitType(a)) return false;
    const matchesManager = selectedManager === 'All' || a.manager === selectedManager;
    const matchesDay = !selectedDay || a.date === selectedDay;
    return matchesManager && matchesDay;
  });

  /* ── "Last 30 days" range label (dynamic, so it never goes stale) ── */
  const fmtRange = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const rangeToday = new Date();
  const range30Ago = new Date(); range30Ago.setDate(rangeToday.getDate() - 30);
  const rangeLabel = `${fmtRange(range30Ago)} - ${fmtRange(rangeToday)}`;

  /* ── Calendar helpers ── */
  const year  = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const apptDays = new Set(
    appointments
      .filter(a => {
        const d = new Date(a.date);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .map(a => new Date(a.date).getDate())
  );

  const handleStart = (id) => {
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'Started' } : a));
    fetch(`${APPT_API}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Started' })
    }).catch(err => console.error('Failed to update appointment:', err));
    addToast('Appointment started!', 'success');
  };

  const handleReschedule = (apt) => {
    setRescheduleAptId(apt.id);
    setRescheduleDetails({
      date: apt.date,
      timeStart: convertTo24Hour(apt.timeStart),
      timeEnd: convertTo24Hour(apt.timeEnd),
      reason: ''
    });
    setIsRescheduleModalOpen(true);
  };

  const coordinatorName = (JSON.parse(localStorage.getItem('crm_user') || 'null')?.name) || 'Coordinator';

  // Accept / decline a reschedule that a manager requested
  const handleRescheduleDecision = (apt, decision) => {
    const rescheduleStatus = decision === 'accept' ? 'Accepted' : 'Declined';
    setAppointments(prev => prev.map(a => (a.id === apt.id ? { ...a, rescheduleStatus } : a)));
    fetch(`${APPT_API}/${apt.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rescheduleStatus })
    }).catch(err => console.error('Failed to update reschedule status:', err));
    if (apt.leadId) appendLeadHistory(apt.leadId, `Reschedule ${rescheduleStatus.toLowerCase()} by ${coordinatorName} for "${apt.title}" (${apt.date} ${display12h(apt.timeStart)})`);
    addToast(decision === 'accept' ? 'Reschedule accepted' : 'Reschedule declined', decision === 'accept' ? 'success' : 'info');
  };

  // Cancel (soft-delete): mark the appointment Cancelled and keep the record so the assigned
  // manager receives a cancellation notification. It's removed from the coordinator's active list.
  const handleCancelAppt = (apt) => {
    if (!window.confirm(`Cancel "${apt.title || 'this appointment'}"? The assigned manager will be notified.`)) return;
    const payload = { status: 'Cancelled', cancelledAt: new Date().toISOString(), cancelledBy: coordinatorName };
    setAppointments(prev => prev.filter(a => a.id !== apt.id));
    fetch(`${APPT_API}/${apt.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    }).catch(err => console.error('Failed to cancel appointment:', err));
    if (apt.leadId) appendLeadHistory(apt.leadId, `Appointment "${apt.title}" cancelled by ${coordinatorName}`);
    addToast('Appointment cancelled — manager notified', 'info');
  };

  const handleRescheduleSubmit = (e) => {
    e.preventDefault();
    const apt = appointments.find(a => a.id === rescheduleAptId);
    const newTimeStart = convertTo12Hour(rescheduleDetails.timeStart);
    const newTimeEnd = convertTo12Hour(rescheduleDetails.timeEnd);
    // A reschedule always mutates the SAME appointment record (never a new one).
    // Capture the change as a history entry so the full reschedule trail survives reload.
    const historyEntry = {
      oldDate: apt?.date || '',
      oldTime: display12h(apt?.timeStart),
      newDate: rescheduleDetails.date,
      newTime: newTimeStart,
      reason: rescheduleDetails.reason,
      by: coordinatorName,
      at: new Date().toISOString()
    };
    const rescheduleHistory = Array.isArray(apt?.rescheduleHistory) ? [...apt.rescheduleHistory, historyEntry] : [historyEntry];
    const updated = {
      date: rescheduleDetails.date,
      timeStart: newTimeStart,
      timeEnd: newTimeEnd,
      // mark the reschedule so the assigned manager gets notified
      rescheduledAt: new Date().toISOString(),
      rescheduledBy: coordinatorName,
      rescheduleReason: rescheduleDetails.reason,
      // append-only trail persisted on the appointment record
      rescheduleHistory
    };
    setAppointments(prev => prev.map(a => a.id === rescheduleAptId ? { ...a, ...updated } : a));
    fetch(`${APPT_API}/${rescheduleAptId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    }).catch(err => console.error('Failed to reschedule appointment:', err));
    if (apt?.leadId) appendLeadHistory(apt.leadId, `Appointment "${apt.title}" rescheduled to ${updated.date} ${updated.timeStart} by ${coordinatorName} (reason: ${rescheduleDetails.reason})`);
    setIsRescheduleModalOpen(false);
    setRescheduleAptId(null);
    setRescheduleDetails({ date: '', timeStart: '', timeEnd: '', reason: '' });
    addToast('Appointment rescheduled successfully!', 'success');
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    // ── Enforce the strict lifecycle before creating the record ──
    if (newVisit.type === 'Visits') {
      if (!leadHasCompletedAppointment(newVisit.leadId)) {
        addToast('This lead has no completed appointment yet — complete the appointment first.', 'error');
        return;
      }
      if (leadHasVisit(newVisit.leadId)) {
        addToast('This lead already has a visit. Only one visit is allowed per lead.', 'error');
        return;
      }
    } else if (leadHasAppointment(newVisit.leadId)) {
      addToast('This lead already has an appointment. Only one appointment is allowed per lead.', 'error');
      return;
    }
    // Store times in 12-hour AM/PM format. Status is derived from the manager assignment:
    // no manager -> Waiting, manager chosen -> Assigned.
    const payload = {
      ...newVisit,
      status: newVisit.manager ? 'Assigned' : 'Waiting',
      timeStart: convertTo12Hour(newVisit.timeStart),
      timeEnd: convertTo12Hour(newVisit.timeEnd)
    };
    fetch(APPT_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(r => r.json())
      .then(saved => setAppointments(prev => [...prev, normalize(saved)]))
      .catch(err => {
        console.error('Failed to add appointment:', err);
        setAppointments(prev => [...prev, { ...payload, id: Date.now() }]);
      });
    // Log the scheduled appointment/visit on the lead's shared history
    appendLeadHistory(payload.leadId, `${payload.type === 'Visits' ? 'Visit' : 'Appointment'} "${payload.title}" scheduled for ${payload.date} (${payload.timeStart} - ${payload.timeEnd}), assigned to ${payload.manager} by ${coordinatorName}`);
    setIsModalOpen(false);
    setNewVisit({ title: '', leadId: '', date: '', timeStart: '', timeEnd: '', manager: '', phone: '', location: '', status: 'Waiting', type: 'Appointment' });
    addToast('Appointment scheduled!', 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>Appointments</h2>
        <button className="btn btn-primary" style={{ display: 'flex', gap: '0.5rem' }} onClick={() => setIsModalOpen(true)}>
          <CalendarIcon size={16} /> Schedule Appointment
        </button>
      </div>

      {/* ── Stat Cards (appointments only) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
        {[
          { label: 'Total Appointments', value: totalAppointments, Icon: CalendarCheck2, color: '#4F46E5', bg: '#EEF4FF', border: '#C7D2FE', sub: 'All scheduled appointments' },
          { label: 'Completed Appointments', value: completedAppt, Icon: CheckCircle2,   color: '#22C55E', bg: '#ECFDF5', border: '#BBF7D0', sub: 'Successfully completed' },
        ].map(({ label, value, Icon, color, bg, border, sub }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem', backgroundColor: bg, border: `1px solid ${border}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)', borderRadius: 'var(--radius-lg)', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: '500', margin: 0 }}>{label}</p>
              <Icon size={18} color={color} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-main)', margin: '0 0 0.5rem 0', letterSpacing: '-0.5px' }}>{value}</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '500' }}>{sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main 2-col layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* ── LEFT: List ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Date range + Manager filter */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--surface-color)', padding: '0.55rem 1rem', borderRadius: '9999px', border: '1px solid var(--border-color)', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
              <CalendarIcon size={15} /> Last 30 Days ({rangeLabel}) <ChevronRight size={14} style={{ opacity: 0.5 }} />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <select
                value={selectedManager}
                onChange={e => setSelectedManager(e.target.value)}
                style={{
                  padding: '0.45rem 2rem 0.45rem 1rem',
                  borderRadius: '9999px',
                  border: '1px solid var(--border-color)',
                  outline: 'none',
                  fontSize: '0.875rem',
                  color: 'var(--text-muted)',
                  backgroundColor: 'var(--surface-color)',
                  cursor: 'pointer',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2364748B%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.75rem center',
                  backgroundSize: '0.55rem auto',
                }}
              >
                <option value="All">All Managers</option>
                {SALES_TEAM.map(mgr => (
                  <option key={mgr} value={mgr}>{mgr}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: '1px', background: 'var(--border-color)' }} />

          {/* Cards */}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No appointments found.</div>
          )}
          {filtered.map(apt => {
            // Reflect completion even when the manager only updated progressStatus/completedAt:
            // a coordinator-assigned appointment finished by the manager must read COMPLETED here.
            const s = isDone(apt) ? STATUS_STYLES.Completed : (STATUS_STYLES[apt.status] || STATUS_STYLES.Waiting);
            return (
              <div key={apt.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1.25rem 1.5rem', borderRadius: 'var(--radius-lg)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                {/* Date block */}
                <div style={{ minWidth: '110px' }}>
                  <div style={{ fontWeight: '700', fontSize: '0.8rem', color: 'var(--text-main)', marginBottom: '0.2rem' }}>{formatDisplayDate(apt.date)}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '500' }}>{display12h(apt.timeStart)} - {display12h(apt.timeEnd)}</div>
                </div>

                {/* Divider */}
                <div style={{ width: '1px', height: '56px', background: 'var(--border-color)', flexShrink: 0 }} />

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-main)' }}>{apt.title}</span>
                    <span style={{ padding: '0.15rem 0.6rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '700', backgroundColor: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE' }}>
                      {leadIdFor(apt)}
                    </span>
                    <span style={{ padding: '0.15rem 0.65rem', borderRadius: '9999px', fontSize: '0.65rem', fontWeight: '700', letterSpacing: '0.5px', backgroundColor: s.bg, color: s.color }}>
                      {s.label}
                    </span>
                    {apt.rescheduledAt && (
                      <span style={{ padding: '0.15rem 0.65rem', borderRadius: '9999px', fontSize: '0.65rem', fontWeight: '700', letterSpacing: '0.5px', backgroundColor: apt.rescheduleStatus === 'Accepted' ? '#DCFCE7' : apt.rescheduleStatus === 'Declined' ? '#FEE2E2' : '#FEF3C7', color: apt.rescheduleStatus === 'Accepted' ? '#166534' : apt.rescheduleStatus === 'Declined' ? '#991B1B' : '#92400E' }}>
                        {apt.rescheduleStatus === 'Pending' ? 'RESCHEDULE REQUEST' : apt.rescheduleStatus === 'Accepted' ? 'RESCHEDULE ACCEPTED' : apt.rescheduleStatus === 'Declined' ? 'RESCHEDULE DECLINED' : 'RESCHEDULED'} → {formatDisplayDate(apt.date)}{apt.rescheduledBy ? ` · by ${apt.rescheduledBy}` : ''}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <User size={12} /> {apt.manager}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <Phone size={12} /> {apt.phone}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <MapPin size={12} /> {apt.location}
                    </span>
                  </div>

                  {/* Reschedule history — compact append-only trail on this appointment */}
                  {Array.isArray(apt.rescheduleHistory) && apt.rescheduleHistory.length > 0 && (
                    <div style={{ marginTop: '0.65rem', paddingTop: '0.55rem', borderTop: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.3px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Reschedule History ({apt.rescheduleHistory.length})
                      </span>
                      {apt.rescheduleHistory.map((h, hi) => (
                        <div key={hi} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                          <CalendarClock size={11} style={{ marginTop: '2px', flexShrink: 0 }} />
                          <span>
                            {formatDisplayDate(h.oldDate)} {display12h(h.oldTime)} → <strong style={{ color: 'var(--text-main)' }}>{formatDisplayDate(h.newDate)} {display12h(h.newTime)}</strong>
                            {h.reason ? ` · ${h.reason}` : ''}
                            {h.by ? ` · by ${h.by}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Site visit details captured by the manager (image + notes) */}
                  {(apt.siteImage || apt.measurementImage || apt.measurementNote || apt.meetingRemarks) && (
                    <div style={{ marginTop: '0.65rem', paddingTop: '0.55rem', borderTop: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.3px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Site Visit Details</span>
                      {(apt.siteImage || apt.measurementImage) && (
                        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                          {apt.siteImage && (
                            <a href={apt.siteImage} target="_blank" rel="noopener noreferrer" title="Open site image">
                              <img src={apt.siteImage} alt="Site" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-color)' }} />
                            </a>
                          )}
                          {apt.measurementImage && (
                            <a href={apt.measurementImage} target="_blank" rel="noopener noreferrer" title="Open measurement image">
                              <img src={apt.measurementImage} alt="Measurement" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-color)' }} />
                            </a>
                          )}
                        </div>
                      )}
                      {apt.measurementNote && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}><span style={{ fontWeight: 600 }}>Measurement:</span> {apt.measurementNote}</div>}
                      {apt.meetingRemarks && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}><span style={{ fontWeight: 600 }}>Remarks:</span> {apt.meetingRemarks}</div>}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end', minWidth: '150px' }}>
                  {apt.rescheduleStatus === 'Pending' && (
                    <div style={{ width: '100%', border: '1px solid #FCD34D', background: '#FFFBEB', borderRadius: 'var(--radius-md)', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#92400E' }}>Reschedule request</span>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button onClick={() => handleRescheduleDecision(apt, 'accept')} style={{ flex: 1, padding: '0.35rem 0.5rem', borderRadius: 'var(--radius-md)', border: 'none', background: '#16A34A', color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Accept</button>
                        <button onClick={() => handleRescheduleDecision(apt, 'decline')} style={{ flex: 1, padding: '0.35rem 0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid #FCA5A5', background: '#fff', color: '#DC2626', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Decline</button>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => handleReschedule(apt)}
                    style={{ padding: '0.35rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'transparent', fontSize: '0.8rem', fontWeight: '500', color: 'var(--text-main)', cursor: 'pointer', width: '100%' }}
                  >
                    Reschedule
                  </button>
                  <button
                    onClick={() => handleCancelAppt(apt)}
                    style={{ padding: '0.35rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid #FCA5A5', background: 'transparent', fontSize: '0.8rem', fontWeight: '500', color: '#DC2626', cursor: 'pointer', width: '100%' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── RIGHT: Calendar + Summary (hidden to match full-width layout) ── */}
        <div style={{ display: 'none' }}>
          <div className="card" style={{ padding: '1.5rem' }}>
            {/* Calendar header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <span style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-main)' }}>Calendar View</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button onClick={() => { setSelectedDay(null); setCalendarDate(new Date(year, month - 1, 1)); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--primary-color)', whiteSpace: 'nowrap' }}>
                  {MONTHS[month].slice(0, 3)} {year}
                </span>
                <button onClick={() => { setSelectedDay(null); setCalendarDate(new Date(year, month + 1, 1)); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: '0.5rem' }}>
              {DAYS.map(d => (
                <div key={d} style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--text-muted)', padding: '0.25rem 0' }}>{d}</div>
              ))}
            </div>

            {/* Day grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const hasAppt = apptDays.has(day);
                const today = new Date();
                const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
                const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isSelectedDay = selectedDay === dayStr;
                return (
                  <div key={day} onClick={() => setSelectedDay(isSelectedDay ? null : dayStr)} style={{ textAlign: 'center', padding: '0.35rem 0', borderRadius: 'var(--radius-sm)', position: 'relative', cursor: 'pointer', background: isToday ? 'var(--primary-color)' : isSelectedDay ? '#EEF2FF' : 'transparent', boxShadow: isSelectedDay && !isToday ? 'inset 0 0 0 1px var(--primary-color)' : 'none' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: isToday ? '700' : (hasAppt || isSelectedDay) ? '600' : '400', color: isToday ? '#fff' : (hasAppt || isSelectedDay) ? 'var(--primary-color)' : 'var(--text-main)' }}>
                      {day}
                    </span>
                    {hasAppt && !isToday && (
                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--primary-color)', margin: '2px auto 0' }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Quick Summary */}
            <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)' }}>Quick Summary</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[
                  { label: 'Site Visits', detail: `${appointments.filter(a => a.type === 'Visits').length} scheduled` },
                  { label: 'Appointments', detail: `${appointments.filter(a => a.type !== 'Visits').length} scheduled` },
                  { label: 'Pending', detail: `${appointments.filter(a => a.status === 'Waiting').length} awaiting confirmation` },
                  { label: 'Completed', detail: `${appointments.filter(a => a.status === 'Completed').length} done` },
                ].map(({ label, detail }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary-color)', marginTop: '5px', flexShrink: 0 }} />
                    <span><strong style={{ color: 'var(--text-main)' }}>{label}:</strong> {detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Reschedule Modal ── */}
      {isRescheduleModalOpen && (
        <div style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '450px', padding: '2rem', animation: 'scaleIn 0.2s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'Poppins, sans-serif', fontWeight: '700', color: 'var(--text-main)' }}>
                Reschedule Appointment
              </h3>
              <button 
                onClick={() => {
                  setIsRescheduleModalOpen(false);
                  setRescheduleAptId(null);
                }} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleRescheduleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                  New Date
                </label>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={rescheduleDetails.date}
                  onChange={e => setRescheduleDetails({ ...rescheduleDetails, date: e.target.value })}
                  required
                  style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', fontSize: '0.875rem', color: 'var(--text-main)' }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                  Time Duration
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input 
                    type="time" 
                    value={rescheduleDetails.timeStart} 
                    onChange={e => setRescheduleDetails({ ...rescheduleDetails, timeStart: e.target.value })} 
                    required 
                    style={{ flex: 1, padding: '0.65rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', fontSize: '0.875rem', color: 'var(--text-main)' }} 
                  />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: '500' }}>to</span>
                  <input
                    type="time"
                    value={rescheduleDetails.timeEnd}
                    onChange={e => setRescheduleDetails({ ...rescheduleDetails, timeEnd: e.target.value })}
                    required
                    style={{ flex: 1, padding: '0.65rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', fontSize: '0.875rem', color: 'var(--text-main)' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                  Reason for Reschedule
                </label>
                <textarea
                  value={rescheduleDetails.reason}
                  onChange={e => setRescheduleDetails({ ...rescheduleDetails, reason: e.target.value })}
                  required
                  placeholder="Why is this appointment being rescheduled?"
                  rows={3}
                  style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', fontSize: '0.875rem', color: 'var(--text-main)', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                <button 
                  type="button" 
                  onClick={() => {
                    setIsRescheduleModalOpen(false);
                    setRescheduleAptId(null);
                  }} 
                  className="btn btn-outline"
                  style={{ padding: '0.55rem 1.25rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!rescheduleDetails.date || !rescheduleDetails.timeStart || !rescheduleDetails.timeEnd || !rescheduleDetails.reason.trim()}
                  style={{ padding: '0.55rem 1.25rem', opacity: (!rescheduleDetails.date || !rescheduleDetails.timeStart || !rescheduleDetails.timeEnd || !rescheduleDetails.reason.trim()) ? 0.5 : 1 }}
                >
                  Confirm Reschedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Schedule Modal ── */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '480px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>Schedule New Appointment</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                { label: 'Title', key: 'title', type: 'text', required: true },
                { label: 'Lead (Customer)', key: 'leadId', type: 'leadselect', required: true },
                { label: 'Assign to Manager', key: 'manager', type: 'select', required: false },
                { label: 'Phone', key: 'phone', type: 'text', required: true },
                { label: 'Location', key: 'location', type: 'text', required: true },
              ].map(({ label, key, type, required }) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.4rem' }}>{label}</label>
                  {type === 'leadselect' ? (
                    <select value={newVisit.leadId} onChange={e => {
                      const lead = leads.find(l => l.id === e.target.value);
                      // Auto-fill the manager from the lead's existing assignment. If the lead has
                      // no manager (Unassigned), leave it blank so the coordinator picks one manually.
                      const assignedMgr = (lead?.manager && String(lead.manager).trim() && String(lead.manager).trim().toLowerCase() !== 'unassigned') ? String(lead.manager).trim() : '';
                      setNewVisit({
                        ...newVisit,
                        leadId: e.target.value,
                        phone: lead?.phone || newVisit.phone,
                        manager: assignedMgr,
                        status: assignedMgr ? 'Assigned' : 'Waiting',
                      });
                    }}
                      required={required}
                      style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', fontSize: '0.875rem', backgroundColor: 'var(--surface-color)' }}>
                      <option value="">Select lead</option>
                      {eligibleLeads.map(l => <option key={l.id} value={l.id}>{l.id}{l.name ? ` — ${l.name}` : ''}</option>)}
                      {eligibleLeads.length === 0 && <option value="" disabled>{newVisit.type === 'Visits' ? 'No leads with a completed appointment yet' : 'All leads already have an appointment'}</option>}
                    </select>
                  ) : type === 'select' ? (
                    <select value={newVisit[key]} onChange={e => {
                      const val = e.target.value;
                      // Assigning a manager flips the status: none -> Waiting, chosen -> Assigned
                      setNewVisit(prev => ({ ...prev, [key]: val, ...(key === 'manager' ? { status: val ? 'Assigned' : 'Waiting' } : {}) }));
                    }}
                      required={required}
                      style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', fontSize: '0.875rem', backgroundColor: 'var(--surface-color)' }}>
                      <option value="">Select manager</option>
                      {SALES_TEAM.map(n => <option key={n} value={n}>{n}</option>)}
                      {newVisit.manager && !SALES_TEAM.includes(newVisit.manager) && <option value={newVisit.manager}>{newVisit.manager}</option>}
                    </select>
                  ) : (
                    <input type={type} value={newVisit[key]} onChange={e => setNewVisit({ ...newVisit, [key]: e.target.value })}
                      required={required}
                      style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', fontSize: '0.875rem' }} />
                  )}
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.4rem' }}>Date</label>
                  <input type="date" min={new Date().toISOString().split('T')[0]} value={newVisit.date} onChange={e => setNewVisit({ ...newVisit, date: e.target.value })} required style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', fontSize: '0.875rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.4rem' }}>Start Time</label>
                  <input type="time" value={newVisit.timeStart} onChange={e => setNewVisit({ ...newVisit, timeStart: e.target.value })} required style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', fontSize: '0.875rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.4rem' }}>End Time</label>
                  <input type="time" value={newVisit.timeEnd} onChange={e => setNewVisit({ ...newVisit, timeEnd: e.target.value })} required style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', fontSize: '0.875rem' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.4rem' }}>Status</label>
                  <select value={newVisit.status} onChange={e => setNewVisit({ ...newVisit, status: e.target.value })} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', fontSize: '0.875rem', backgroundColor: 'var(--surface-color)' }}>
                    <option>Waiting</option>
                    <option>Assigned</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!newVisit.title || !newVisit.leadId || !newVisit.phone || !newVisit.location || !newVisit.date || !newVisit.timeStart || !newVisit.timeEnd} style={{ opacity: (!newVisit.title || !newVisit.leadId || !newVisit.phone || !newVisit.location || !newVisit.date || !newVisit.timeStart || !newVisit.timeEnd) ? 0.5 : 1 }}>Schedule Appointment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Appointments;
