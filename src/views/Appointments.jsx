import React, { useState, useEffect } from 'react';
import { Search, Filter, User, Phone, MapPin, ChevronLeft, ChevronRight, CalendarCheck2, CalendarClock, CheckCircle2, Flag, X, Calendar as CalendarIcon } from 'lucide-react';
import { useToast } from '../components/Toast';

const APPT_API = 'http://localhost:5000/api/appointments';

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
  const day = d.getDate();
  const month = MONTHS[d.getMonth()].slice(0,3).toUpperCase();
  const year = d.getFullYear();
  return `${day < 10 ? '0'+day : day} ${month} ${year}`;
}

function convertTo12Hour(time24) {
  if (!time24) return '';
  const [hoursStr, minutesStr] = time24.split(':');
  let hours = parseInt(hoursStr, 10);
  const minutes = minutesStr;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursFormatted = hours < 10 ? '0' + hours : hours;
  return `${hoursFormatted}:${minutes} ${ampm}`;
}

function convertTo24Hour(time12) {
  if (!time12) return '';
  const [time, modifier] = time12.split(' ');
  let [hours, minutes] = time.split(':');
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
  const [appointments, setAppointments] = useState([]);
  const [apptLoaded, setApptLoaded] = useState(false);
  const [leads, setLeads] = useState([]);

  // Normalize API record so existing JSX (apt.id) keeps working
  const normalize = (a) => ({ ...a, id: a._id || a.id });

  // Load appointments from API on mount (show only what is stored)
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(APPT_API);
        const data = await res.json();
        if (Array.isArray(data)) setAppointments(data.map(normalize));
      } catch (err) {
        console.error('Failed to load appointments:', err);
      } finally {
        setApptLoaded(true);
      }
    };
    load();
  }, []);

  // Load leads so an appointment can be linked to a lead (and logged on its history)
  useEffect(() => {
    fetch('http://localhost:5000/api/leads')
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
    fetch(`http://localhost:5000/api/leads/${leadId}`, {
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
  const [rescheduleDetails, setRescheduleDetails] = useState({ date: '', timeStart: '', timeEnd: '' });
  const [selectedManager, setSelectedManager] = useState('All');
  const uniqueManagers = Array.from(new Set(appointments.map(a => a.manager).filter(Boolean)));

  /* ── Live counts ── */
  const totalAppointments = appointments.length;
  const visitPlanned      = appointments.filter(a => a.status !== 'Completed').length;
  const completedAppt     = appointments.filter(a => a.status === 'Completed').length;
  const visitComplete     = appointments.filter(a => a.type === 'Visits' && a.status === 'Completed').length;

  /* ── Filter ── */
  // Robust segregation: anything whose type contains "visit" is a Visit, everything else an Appointment
  const isVisitType = (a) => /visit/i.test(a.type || '');
  const filtered = appointments.filter(a => {
    const matchesTab = activeTab === 'Visits' ? isVisitType(a) : !isVisitType(a);
    const matchesManager = selectedManager === 'All' || a.manager === selectedManager;
    const matchesDay = !selectedDay || a.date === selectedDay;
    return matchesTab && matchesManager && matchesDay;
  });

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
      timeEnd: convertTo24Hour(apt.timeEnd)
    });
    setIsRescheduleModalOpen(true);
  };

  const coordinatorName = (JSON.parse(localStorage.getItem('crm_user') || 'null')?.name) || 'Coordinator';

  const handleDeleteAppt = (apt) => {
    if (!window.confirm(`Delete "${apt.title || 'this appointment'}"?`)) return;
    setAppointments(prev => prev.filter(a => a.id !== apt.id));
    fetch(`${APPT_API}/${apt.id}`, { method: 'DELETE' }).catch(err => console.error('Failed to delete appointment:', err));
  };

  const handleRescheduleSubmit = (e) => {
    e.preventDefault();
    const updated = {
      date: rescheduleDetails.date,
      timeStart: convertTo12Hour(rescheduleDetails.timeStart),
      timeEnd: convertTo12Hour(rescheduleDetails.timeEnd),
      // mark the reschedule so the assigned manager gets notified
      rescheduledAt: new Date().toISOString(),
      rescheduledBy: coordinatorName
    };
    const apt = appointments.find(a => a.id === rescheduleAptId);
    setAppointments(prev => prev.map(a => a.id === rescheduleAptId ? { ...a, ...updated } : a));
    fetch(`${APPT_API}/${rescheduleAptId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    }).catch(err => console.error('Failed to reschedule appointment:', err));
    if (apt?.leadId) appendLeadHistory(apt.leadId, `Appointment "${apt.title}" rescheduled to ${updated.date} ${updated.timeStart} by ${coordinatorName}`);
    setIsRescheduleModalOpen(false);
    setRescheduleAptId(null);
    addToast('Appointment rescheduled successfully!', 'success');
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    // Store times in 12-hour AM/PM format
    const payload = {
      ...newVisit,
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
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>Appointments & Site Visits</h2>
        <button className="btn btn-primary" style={{ display: 'flex', gap: '0.5rem' }} onClick={() => setIsModalOpen(true)}>
          <CalendarIcon size={16} /> Schedule Visit
        </button>
      </div>

      {/* ── 4 Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem' }}>
        {[
          { label: 'Total Appointments', value: totalAppointments, Icon: CalendarCheck2, color: '#4F46E5', bg: '#EEF4FF', border: '#C7D2FE', sub: 'All scheduled appointments' },
          { label: 'Total Visit Planned', value: visitPlanned,     Icon: CalendarClock,  color: '#0EA5E9', bg: '#F0F9FF', border: '#BAE6FD', sub: 'Upcoming & pending visits' },
          { label: 'Completed Appointments', value: completedAppt, Icon: CheckCircle2,   color: '#22C55E', bg: '#ECFDF5', border: '#BBF7D0', sub: 'Successfully completed' },
          { label: 'Total Visit Complete',  value: visitComplete,  Icon: Flag,           color: '#F97316', bg: '#FFF7ED', border: '#FED7AA', sub: 'Site visits wrapped up' },
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start' }}>

        {/* ── LEFT: List ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Tabs + Search */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: '9999px', padding: '4px', gap: '4px' }}>
              {['Appointment', 'Visits'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  padding: '0.4rem 1.25rem', borderRadius: '9999px', border: 'none', cursor: 'pointer',
                  fontWeight: '600', fontSize: '0.875rem', transition: 'all 0.2s',
                  background: activeTab === tab ? 'var(--primary-color)' : 'transparent',
                  color: activeTab === tab ? '#fff' : 'var(--text-muted)',
                }}>
                  {tab}
                </button>
              ))}
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
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No {activeTab.toLowerCase()}s found.</div>
          )}
          {filtered.map(apt => {
            const s = STATUS_STYLES[apt.status] || STATUS_STYLES.Waiting;
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-main)' }}>{apt.title}</span>
                    <span style={{ padding: '0.15rem 0.65rem', borderRadius: '9999px', fontSize: '0.65rem', fontWeight: '700', letterSpacing: '0.5px', backgroundColor: s.bg, color: s.color }}>
                      {s.label}
                    </span>
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
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end', minWidth: '120px' }}>
                  <button
                    onClick={() => handleReschedule(apt)}
                    style={{ padding: '0.35rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'transparent', fontSize: '0.8rem', fontWeight: '500', color: 'var(--text-main)', cursor: 'pointer', width: '100%' }}
                  >
                    Reschedule
                  </button>
                  <button
                    onClick={() => handleDeleteAppt(apt)}
                    style={{ padding: '0.35rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid #FCA5A5', background: '#FEF2F2', fontSize: '0.8rem', fontWeight: '500', color: '#B91C1C', cursor: 'pointer', width: '100%' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── RIGHT: Calendar + Summary ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
                  disabled={!rescheduleDetails.date || !rescheduleDetails.timeStart || !rescheduleDetails.timeEnd}
                  style={{ padding: '0.55rem 1.25rem', opacity: (!rescheduleDetails.date || !rescheduleDetails.timeStart || !rescheduleDetails.timeEnd) ? 0.5 : 1 }}
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
              <h3 style={{ margin: 0 }}>Schedule New Visit</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                { label: 'Title', key: 'title', type: 'text', required: true },
                { label: 'Lead (Customer)', key: 'leadId', type: 'leadselect', required: true },
                { label: 'Assign to Manager', key: 'manager', type: 'select', required: true },
                { label: 'Phone', key: 'phone', type: 'text', required: true },
                { label: 'Location', key: 'location', type: 'text', required: true },
              ].map(({ label, key, type, required }) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.4rem' }}>{label}</label>
                  {type === 'leadselect' ? (
                    <select value={newVisit.leadId} onChange={e => {
                      const lead = leads.find(l => l.id === e.target.value);
                      setNewVisit({ ...newVisit, leadId: e.target.value, phone: lead?.phone || newVisit.phone });
                    }}
                      required={required}
                      style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', fontSize: '0.875rem', backgroundColor: 'var(--surface-color)' }}>
                      <option value="">Select lead</option>
                      {leads.map(l => <option key={l.id} value={l.id}>{l.id}{l.name ? ` — ${l.name}` : ''}</option>)}
                    </select>
                  ) : type === 'select' ? (
                    <select value={newVisit[key]} onChange={e => setNewVisit({ ...newVisit, [key]: e.target.value })}
                      required={required}
                      style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', fontSize: '0.875rem', backgroundColor: 'var(--surface-color)' }}>
                      <option value="">Select manager</option>
                      {SALES_TEAM.map(n => <option key={n} value={n}>{n}</option>)}
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.4rem' }}>Type</label>
                  <select value={newVisit.type} onChange={e => setNewVisit({ ...newVisit, type: e.target.value })} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', fontSize: '0.875rem', backgroundColor: 'var(--surface-color)' }}>
                    <option>Appointment</option>
                    <option>Visits</option>
                  </select>
                </div>
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
                <button type="submit" className="btn btn-primary" disabled={!newVisit.title || !newVisit.leadId || !newVisit.manager || !newVisit.phone || !newVisit.location || !newVisit.date || !newVisit.timeStart || !newVisit.timeEnd} style={{ opacity: (!newVisit.title || !newVisit.leadId || !newVisit.manager || !newVisit.phone || !newVisit.location || !newVisit.date || !newVisit.timeStart || !newVisit.timeEnd) ? 0.5 : 1 }}>Schedule Visit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Appointments;
