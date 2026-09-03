import React, { useState, useEffect } from 'react';
import {
  Users, Sparkles, Flame, Thermometer, Snowflake, CalendarCheck, FileText,
  CheckCircle2, Trash2, XCircle, Calendar, CalendarClock, Flag, Clock, Send,
  ThumbsUp, AlertCircle, ChevronRight, ChevronLeft, ChevronDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// --- API endpoints (unchanged backend) ---
const LEADS_API = 'https://api-salescoordinator.tescomanagement.com/api/leads';
const APPTS_API = 'https://api-salescoordinator.tescomanagement.com/api/appointments';
const QUOTES_API = 'https://api-salescoordinator.tescomanagement.com/api/quotations';
const PROJECTS_API = 'https://api-salescoordinator.tescomanagement.com/api/projects';
const PAYMENTS_API = 'https://api-salescoordinator.tescomanagement.com/api/payments';

// --- Card colour palette (pastel tints matching the reference design) ---
const TINTS = {
  neutral: { bg: '#FFFFFF', border: '#E2E8F0', icon: '#64748B' },
  indigo:  { bg: '#EEF2FF', border: '#E0E7FF', icon: '#6366F1' },
  blue:    { bg: '#EFF6FF', border: '#DBEAFE', icon: '#3B82F6' },
  sky:     { bg: '#F0F9FF', border: '#E0F2FE', icon: '#0EA5E9' },
  red:     { bg: '#FEF2F2', border: '#FEE2E2', icon: '#EF4444' },
  amber:   { bg: '#FEFCE8', border: '#FEF3C7', icon: '#F59E0B' },
  green:   { bg: '#F0FDF4', border: '#DCFCE7', icon: '#22C55E' },
  purple:  { bg: '#FAF5FF', border: '#F3E8FF', icon: '#A855F7' },
  orange:  { bg: '#FFF7ED', border: '#FFEDD5', icon: '#F97316' },
};

// --- Reusable stat card ---
const StatCard = ({ title, value, subtitle, icon: Icon, tint = 'neutral' }) => {
  const t = TINTS[tint] || TINTS.neutral;
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        gap: '1.25rem', padding: '1.25rem 1.35rem', minHeight: '150px',
        backgroundColor: t.bg, border: `1px solid ${t.border}`,
        borderRadius: '1rem', boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 18px rgba(16,24,40,0.08)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(16,24,40,0.04)'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ color: '#334155', fontSize: '0.9rem', fontWeight: 600 }}>{title}</span>
        <Icon size={20} color={t.icon} strokeWidth={2} />
      </div>
      <div>
        <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-1px', lineHeight: 1.1 }}>{value}</div>
        {subtitle && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: '0.4rem' }}>{subtitle}</div>}
      </div>
    </div>
  );
};

const SectionTitle = ({ children }) => (
  <h3 style={{ margin: '0 0 1.1rem 0', fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)' }}>{children}</h3>
);

const DashboardHome = () => {
  const navigate = useNavigate();

  const [allLeads, setAllLeads] = useState([]);
  const [allAppointments, setAllAppointments] = useState([]);
  const [liveQuotes, setLiveQuotes] = useState([]);
  const [liveProjects, setLiveProjects] = useState([]);
  const [livePayments, setLivePayments] = useState([]);

  useEffect(() => {
    const loadAll = () => {
      fetch(LEADS_API).then(r => r.json()).then(d => { if (Array.isArray(d)) setAllLeads(d); }).catch(e => console.error('Dashboard failed to load leads:', e));
      fetch(APPTS_API).then(r => r.json()).then(d => { if (Array.isArray(d)) setAllAppointments(d.map(a => ({ ...a, id: a._id || a.id }))); }).catch(e => console.error('Dashboard failed to load appointments:', e));
      fetch(QUOTES_API).then(r => r.json()).then(d => { if (Array.isArray(d)) setLiveQuotes(d); }).catch(e => console.error('Failed to load quotations:', e));
      fetch(PROJECTS_API).then(r => r.json()).then(d => { if (Array.isArray(d)) setLiveProjects(d); }).catch(e => console.error('Failed to load projects:', e));
      fetch(PAYMENTS_API).then(r => r.json()).then(d => { if (Array.isArray(d)) setLivePayments(d); }).catch(e => console.error('Failed to load payments:', e));
    };
    loadAll();
    // Poll so manager-side completions/updates appear on the dashboard without a manual refresh
    const iv = setInterval(loadAll, 15000);
    return () => clearInterval(iv);
  }, []);

  // Greeting name lives in state so a Settings edit updates it instantly. We merge
  // crm_user + crm_profile (profile override wins) and recompute on the same-tab
  // custom event and the cross-tab native `storage` event.
  const readUserName = () => {
    try {
      const base = JSON.parse(localStorage.getItem('crm_user') || 'null') || {};
      const override = JSON.parse(localStorage.getItem('crm_profile') || 'null') || {};
      return ({ ...base, ...override }).name || 'Akash';
    } catch { return 'Akash'; }
  };
  const [userName, setUserName] = useState(readUserName);
  useEffect(() => {
    const refresh = () => setUserName(readUserName());
    window.addEventListener('crm-profile-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('crm-profile-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  /* ── Date range filter (drives EVERY dashboard metric below) ── */
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
  // Local-time YYYY-MM-DD (never toISOString — that shifts to UTC and moves IST dates back a day,
  // which would drop "today" records from a single-day filter)
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const [dateRange, setDateRange] = useState({ start: iso(daysAgo(30)), end: iso(new Date()) });
  const dstr = (v) => { if (!v) return ''; const d = new Date(v); return isNaN(d.getTime()) ? String(v).slice(0, 10) : iso(d); };
  const inRange = (v) => { const f = dstr(v); if (!f) return true; return (!dateRange.start || f >= dateRange.start) && (!dateRange.end || f <= dateRange.end); };

  /* ── Manager filter ── */
  // Managers come live from the shared users collection, so any manager the Sales Head
  // creates appears here automatically. Falls back to the known names if the fetch fails.
  const SALES_TEAM = ['Azar Abdullah A', 'Praveenraja P', 'Suresh P', 'Agsal A'];
  const [selectedManager, setSelectedManager] = useState('All');
  const [managerList, setManagerList] = useState(SALES_TEAM);
  useEffect(() => {
    fetch('https://api-salescoordinator.tescomanagement.com/api/auth/managers')
      .then((r) => r.json())
      .then((rows) => {
        const names = (Array.isArray(rows) ? rows : []).map((m) => m && m.name).filter(Boolean);
        if (names.length) setManagerList(names);
      })
      .catch(() => {});
  }, []);
  const byManager = (arr) => selectedManager === 'All' ? arr : arr.filter(x => x.manager === selectedManager);

  const leads = byManager(allLeads).filter(l => inRange(l.date || l.createdAt));
  const appointments = byManager(allAppointments).filter(a => inRange(a.date || a.createdAt));

  // Scope quotations & projects to the selected manager (via their leads) so EVERY dashboard
  // count reflects only that manager's data when a manager is chosen.
  const dashLeadIds = new Set(leads.map(l => l.id));
  const dQuotes = liveQuotes.filter(q => inRange(q.date || q.createdAt));
  const dProjects = liveProjects.filter(p => inRange(p.date || p.createdAt));
  const scopedQuotes = selectedManager === 'All' ? dQuotes : dQuotes.filter(q => dashLeadIds.has(q.leadId));
  const scopedProjects = selectedManager === 'All' ? dProjects : dProjects.filter(p => dashLeadIds.has(p.leadId) || (p.salesperson || '') === selectedManager || (p.manager || '') === selectedManager);

  /* ── Leads Overview counts ── */
  const has = (s, kw) => (s || '').toLowerCase().includes(kw);
  const countBy = (kw) => leads.filter(l => has(l.status, kw)).length;
  const isNewStatus = (s) => has(s, 'new') || has(s, 'received');

  const totalLeads = leads.length;
  const newLeads = leads.filter(l => isNewStatus(l.status)).length;
  const hotLeads = countBy('hot');
  const warmLeads = countBy('warm');
  const coldLeads = countBy('cold');
  const junkLeads = countBy('junk');
  const lostLeads = countBy('lost');
  // Match both "Appointment Fixed" and short "Appt Fixed" status labels
  // Appt. Fixed reflects the real scheduled appointments (matches the Appointments page + Lead Management)
  const apptFixed = appointments.filter(a => !/visit/i.test(a.type || '')).length;
  // Order Confirmed reflects the real Order Confirm handovers (matches the Order Confirm page + Lead Management)
  const orderConfirmed = scopedProjects.length;

  /* ── Appointments counts (type-aware, matches the Appointments page) ── */
  // A record is a "Visit" if its type contains "visit"; otherwise it's an Appointment
  const isVisitAppt = (a) => /visit/i.test(a.type || '');
  // Count "done" if either the status or progressStatus says completed (manager writes both)
  const isDoneAppt = (a) => {
    const s = String(a.status || '').toLowerCase();
    return s.includes('complet') || String(a.progressStatus || '').toLowerCase() === 'completed' || !!a.completedAt;
  };
  const totalAppointments = appointments.filter(a => !isVisitAppt(a)).length;
  const visitPlanned = appointments.filter(a => isVisitAppt(a) && !isDoneAppt(a)).length;
  const completedAppt = appointments.filter(a => !isVisitAppt(a) && isDoneAppt(a)).length;
  const visitComplete = appointments.filter(a => isVisitAppt(a) && isDoneAppt(a)).length;

  /* ── Quotations counts ── */
  // Leads-overview "Quotation Send" reflects real quotations (matches the Quotations page + Lead Management)
  const quotationSend = scopedQuotes.length;
  const requestedQuotes = scopedQuotes.filter(q => !q.quotationStatus || q.quotationStatus === 'Requested' || q.quotationStatus === 'Draft').length;
  const pendingQuotes = scopedQuotes.filter(q => q.approvalStatus === 'Pending').length;
  const completedQuotes = scopedQuotes.filter(q => q.quotationStatus === 'Prepared' || q.quotationStatus === 'Completed' || q.quotationStatus === 'Sent').length;
  const approvedQuotes = scopedQuotes.filter(q => q.approvalStatus === 'Approved').length;

  /* ── Payments (from the REAL payments collection — same source & fields as the
        Payment Collection page, so the dashboard matches it exactly) ── */
  const fmtCompact = (n) => n >= 1e7 ? '₹' + (n / 1e7).toFixed(1).replace(/\.0$/, '') + 'Cr'
    : n >= 1e5 ? '₹' + (n / 1e5).toFixed(1).replace(/\.0$/, '') + 'L'
    : n >= 1e3 ? '₹' + Math.round(n / 1e3) + 'K'
    : '₹' + Math.round(n);
  // Scope payments to the selected manager (by the payment's own manager, or via its lead).
  const dPayments = livePayments.filter(p => inRange(p.date || p.createdAt));
  const scopedPayments = selectedManager === 'All'
    ? dPayments
    : dPayments.filter(p => (p.manager || '') === selectedManager || dashLeadIds.has(p.leadId));
  const sumField = (key) => scopedPayments.reduce((s, p) => s + (Number(p[key]) || 0), 0);
  const collectedTotal = sumField('amountCollected');
  const upcomingTotal = sumField('upcomingDues');
  const pendingPayTotal = sumField('pendingPayments');
  const overdueTotal = sumField('overduePayments');

  /* ── Date range picker UI state (dateRange declared above) ── */
  const [selectedPreset, setSelectedPreset] = useState('Last 30 Days');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [rangeSelectionState, setRangeSelectionState] = useState('start');
  const [currentNavDate, setCurrentNavDate] = useState(new Date());

  const applyPreset = (presetName) => {
    const today = new Date();
    let start = new Date(); let end = new Date();
    switch (presetName) {
      case 'Today': start = today; end = today; break;
      case 'Yesterday': start = daysAgo(1); end = daysAgo(1); break;
      case 'Last 7 Days': start = daysAgo(7); end = today; break;
      case 'Last 30 Days': start = daysAgo(30); end = today; break;
      case 'This Month': start = new Date(today.getFullYear(), today.getMonth(), 1); end = new Date(today.getFullYear(), today.getMonth() + 1, 0); break;
      default: break;
    }
    setSelectedPreset(presetName);
    if (presetName !== 'Custom') { setDateRange({ start: iso(start), end: iso(end) }); setIsCalendarOpen(false); }
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear(); const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const numDays = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= numDays; i++) days.push(new Date(year, month, i));
    return days;
  };
  const isSelected = (day) => { if (!day) return false; const f = iso(day); return f === dateRange.start || f === dateRange.end; };
  const isRange = (day) => { if (!day || !dateRange.start || !dateRange.end) return false; const f = iso(day); return f > dateRange.start && f < dateRange.end; };
  const handleDayClick = (day) => {
    if (!day) return; const f = iso(day);
    if (!rangeSelectionState || rangeSelectionState === 'start') { setDateRange({ start: f, end: '' }); setRangeSelectionState('end'); setSelectedPreset('Custom'); }
    else { if (f < dateRange.start) setDateRange({ start: f, end: dateRange.start }); else setDateRange({ ...dateRange, end: f }); setRangeSelectionState('start'); setIsCalendarOpen(false); }
  };
  const fmtD = (s) => { if (!s) return ''; return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };

  const pillBtn = {
    display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'var(--surface-color)',
    padding: '0.7rem 1.15rem', borderRadius: '0.65rem', border: '1px solid var(--border-color)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)', cursor: 'pointer', fontSize: '0.9rem',
    fontWeight: 600, color: 'var(--text-main)', outline: 'none', whiteSpace: 'nowrap',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '3rem' }}>

      {/* 1. Welcome banner */}
      <div style={{
        padding: '2.25rem 2.5rem', borderRadius: '1.25rem',
        background: 'linear-gradient(120deg, #EEF0FF 0%, #F3F0FF 55%, #FDF2FF 100%)',
        border: '1px solid #E5E7FB',
      }}>
        <h1 style={{ fontSize: '2.4rem', fontWeight: 800, margin: '0 0 0.6rem 0', color: '#1E293B', letterSpacing: '-0.5px' }}>
          Welcome Back, {userName} <span style={{ fontWeight: 400 }}>👋</span>
        </h1>
        <p style={{ color: '#64748B', fontSize: '1.05rem', margin: 0 }}>
          Manage construction leads, appointments, quotations, and project coordination efficiently.
        </p>
      </div>

      {/* 2. Filter row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', position: 'relative', zIndex: 50 }}>
        <div style={{ position: 'relative' }}>
          <button style={pillBtn} onClick={() => setIsCalendarOpen(o => !o)}>
            <Calendar size={17} color="var(--primary-color)" />
            <span>{selectedPreset === 'Custom' ? `${fmtD(dateRange.start)} - ${fmtD(dateRange.end)}` : `${selectedPreset} (${fmtD(dateRange.start)} - ${fmtD(dateRange.end)})`}</span>
            <ChevronRight size={15} style={{ transform: isCalendarOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', opacity: 0.6 }} />
          </button>

          {isCalendarOpen && (
            <div style={{ position: 'absolute', top: '52px', left: 0, backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', display: 'flex', zIndex: 100, overflow: 'hidden', minWidth: '460px' }}>
              <div style={{ width: '160px', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', backgroundColor: '#F8FAFC', padding: '0.5rem 0' }}>
                {['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'This Month', 'Custom'].map(preset => (
                  <button key={preset} onClick={() => applyPreset(preset)} style={{ padding: '0.6rem 1rem', border: 'none', textAlign: 'left', fontSize: '0.8125rem', fontWeight: selectedPreset === preset ? 600 : 500, color: selectedPreset === preset ? 'var(--primary-color)' : 'var(--text-muted)', backgroundColor: selectedPreset === preset ? '#EEF2FF' : 'transparent', cursor: 'pointer', width: '100%' }}>{preset}</button>
                ))}
              </div>
              <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '300px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <button onClick={() => setCurrentNavDate(new Date(currentNavDate.getFullYear(), currentNavDate.getMonth() - 1, 1))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '4px' }}><ChevronLeft size={16} /></button>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>{currentNavDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                  <button onClick={() => setCurrentNavDate(new Date(currentNavDate.getFullYear(), currentNavDate.getMonth() + 1, 1))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '4px' }}><ChevronRight size={16} /></button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '4px' }}>
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <span key={d} style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>{d}</span>)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                  {getDaysInMonth(currentNavDate).map((day, idx) => {
                    if (!day) return <div key={`empty-${idx}`}></div>;
                    const isSel = isSelected(day); const inRange = isRange(day);
                    const isToday = day.toDateString() === new Date().toDateString();
                    return (
                      <button key={idx} onClick={() => handleDayClick(day)} style={{ padding: '0.35rem 0', fontSize: '0.75rem', fontWeight: isSel || isToday ? 700 : 500, border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: isSel ? 'var(--primary-color)' : inRange ? '#EEF2FF' : 'transparent', color: isSel ? 'white' : inRange ? 'var(--primary-color)' : isToday ? 'var(--primary-color)' : 'var(--text-main)', boxShadow: isToday && !isSel ? 'inset 0 0 0 1px var(--primary-color)' : 'none' }}>{day.getDate()}</button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Managers dropdown */}
        <div style={{ position: 'relative' }}>
          <select
            value={selectedManager}
            onChange={e => setSelectedManager(e.target.value)}
            style={{ ...pillBtn, appearance: 'none', WebkitAppearance: 'none', paddingRight: '2.4rem', cursor: 'pointer' }}
          >
            <option value="All">All Managers</option>
            {managerList.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <ChevronDown size={16} color="var(--text-muted)" style={{ position: 'absolute', right: '0.9rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        </div>
      </div>

      {/* 3. Leads Overview */}
      <section>
        <SectionTitle>Leads Overview</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.25rem' }}>
          <StatCard title="Total Leads" value={totalLeads} subtitle="All leads in system" icon={Users} tint="neutral" />
          <StatCard title="New Leads" value={newLeads} subtitle="Freshly received" icon={Sparkles} tint="blue" />
          <StatCard title="Hot Leads" value={hotLeads} subtitle="High conversion chance" icon={Flame} tint="red" />
          <StatCard title="Warm Leads" value={warmLeads} subtitle="Nurturing in progress" icon={Thermometer} tint="amber" />
          <StatCard title="Cold Leads" value={coldLeads} subtitle="Need re-engagement" icon={Snowflake} tint="sky" />
          <StatCard title="Appt. Fixed" value={apptFixed} subtitle="Appointments booked" icon={CalendarCheck} tint="green" />
          <StatCard title="Quotation Send" value={quotationSend} subtitle="Quotations prepared" icon={FileText} tint="purple" />
          <StatCard title="Order Confirmed" value={orderConfirmed} subtitle="Confirmed orders" icon={CheckCircle2} tint="green" />
          <StatCard title="Junk" value={junkLeads} subtitle="Marked as junk" icon={Trash2} tint="neutral" />
          <StatCard title="Lost" value={lostLeads} subtitle="Deals lost" icon={XCircle} tint="red" />
        </div>
      </section>

      {/* 4. Appointments */}
      <section>
        <SectionTitle>Appointments</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
          <StatCard title="Total Appointments" value={totalAppointments} subtitle="All scheduled appointments" icon={Calendar} tint="indigo" />
          <StatCard title="Completed Appointments" value={completedAppt} subtitle="Successfully completed" icon={CheckCircle2} tint="green" />
        </div>
      </section>

      {/* 5. Quotations */}
      <section>
        <SectionTitle>Quotations</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '1.25rem' }}>
          <StatCard title="Requested Quotations" value={requestedQuotes} subtitle="Draft & initial requests" icon={FileText} tint="indigo" />
          <StatCard title="Pending Quotations" value={pendingQuotes} subtitle="Awaiting client/mgr approval" icon={Clock} tint="amber" />
          <StatCard title="Completed Quotations" value={completedQuotes} subtitle="Prepared & sent to clients" icon={Send} tint="sky" />
          <StatCard title="Approved Quotations" value={approvedQuotes} subtitle="Accepted quotations" icon={ThumbsUp} tint="green" />
        </div>
      </section>

      {/* 6. Payments */}
      <section>
        <SectionTitle>Payments</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '1.25rem' }}>
          <StatCard title="Total Collected" value={fmtCompact(collectedTotal)} subtitle="Total Collected" icon={CheckCircle2} tint="green" />
          <StatCard title="Upcoming Dues" value={fmtCompact(upcomingTotal)} subtitle="Upcoming Dues" icon={Clock} tint="blue" />
          <StatCard title="Pending Payments" value={fmtCompact(pendingPayTotal)} subtitle="Pending Payments" icon={AlertCircle} tint="amber" />
          <StatCard title="Overdue Payments" value={fmtCompact(overdueTotal)} subtitle="Overdue Payments" icon={XCircle} tint="red" />
        </div>
      </section>

    </div>
  );
};

export default DashboardHome;
