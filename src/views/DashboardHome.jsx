import React, { useState, useEffect } from 'react';
import { 
  Phone, Flame, CalendarCheck, FileText, DollarSign, TrendingUp, CheckCircle, Clock, 
  Plus, MoreVertical, MapPin, UploadCloud, DownloadCloud, Activity, Bell, ChevronRight, User, Trash,
  Calendar, ChevronLeft
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, FunnelChart, Funnel, LabelList
} from 'recharts';
import { useToast } from '../components/Toast';
import { useNavigate } from 'react-router-dom';

// --- MOCK DATA ---
const pipelineData = [
  { name: 'Jan', value: 30 }, { name: 'Feb', value: 45 }, { name: 'Mar', value: 35 }, 
  { name: 'Apr', value: 60 }, { name: 'May', value: 55 }, { name: 'Jun', value: 80 }
];

const paymentsData = [
  { client: 'Wayne Ent.', amount: '₹5L', status: 'Advance Received', date: 'Oct 24' },
  { client: 'Daily Planet', amount: '₹2.1L', status: 'Overdue', date: 'Oct 15' },
];

// --- SUB-COMPONENTS ---
const KpiCard = ({ title, value, subtitle, icon: Icon, color, bg, borderColor, showChart }) => (
  <div className="card" style={{ display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', padding: '1.25rem', backgroundColor: bg || 'var(--surface-color)', border: `1px solid ${borderColor || 'var(--border-color)'}`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: '500', margin: 0 }}>{title}</p>
      <Icon size={18} color={color} />
    </div>
    <div style={{ zIndex: 1 }}>
      <h3 style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--text-main)', margin: '0 0 0.5rem 0', letterSpacing: '-0.5px' }}>{value}</h3>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '500' }}>{subtitle}</span>
    </div>
    {showChart && (
      <div style={{ position: 'absolute', bottom: '1rem', left: '1.25rem', right: '1.25rem', height: '30px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={pipelineData}>
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )}
  </div>
);

const SectionHeader = ({ title, action, onAction }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
    <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>{title}</h3>
    {action && <button className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }} onClick={onAction}>{action}</button>}
  </div>
);

// --- MAIN DASHBOARD ---
const LEADS_API = 'http://localhost:5000/api/leads';
const APPTS_API = 'http://localhost:5000/api/appointments';
const QUOTES_API = 'http://localhost:5000/api/quotations';
const PROJECTS_API = 'http://localhost:5000/api/projects';

const DashboardHome = () => {
  const addToast = useToast();
  const navigate = useNavigate();

  // Live lead data from API for KPI cards
  const [allLeads, setAllLeads] = useState([]);
  const [allAppointments, setAllAppointments] = useState([]);
  useEffect(() => {
    fetch(LEADS_API)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setAllLeads(d); })
      .catch(err => console.error('Dashboard failed to load leads:', err));
    fetch(APPTS_API)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setAllAppointments(d.map(a => ({ ...a, id: a._id || a.id }))); })
      .catch(err => console.error('Dashboard failed to load appointments:', err));
  }, []);

  const isNewStatus = (s) => {
    const x = (s || '').toLowerCase();
    return x.includes('new') || x.includes('received');
  };
  const countBy = (kw) => allLeads.filter(l => (l.status || '').toLowerCase().includes(kw)).length;

  const receivedLeadsCount = allLeads.length;
  const newLeadsCount = allLeads.filter(l => isNewStatus(l.status)).length;
  // Calls Made = leads that have moved OUT of "New" (Hot/Warm/Cold/etc.)
  const callsMadeCount = allLeads.filter(l => !isNewStatus(l.status)).length;
  const hotLeadsCount = countBy('hot');
  const warmLeadsCount = countBy('warm');
  const coldLeadsCount = countBy('cold');
  const junkLeadsCount = countBy('junk');
  const appointmentFixedCount = countBy('appointment');

  // Live lead-status pie data (replaces hardcoded leadStatusData)
  const liveLeadStatusData = [
    { name: 'Hot', value: hotLeadsCount, color: 'var(--danger-color)' },
    { name: 'Warm', value: warmLeadsCount, color: 'var(--warning-color)' },
    { name: 'Cold', value: coldLeadsCount, color: 'var(--primary-color)' },
    { name: 'Appointment Fixed', value: appointmentFixedCount, color: 'var(--success-color)' },
  ];

  // Live assigned-leads list (leads that have a manager assigned)
  const liveAssignedLeads = allLeads
    .filter(l => l.manager && l.manager !== 'Unassigned')
    .map(l => ({ name: l.name, priority: l.priority, manager: l.manager, status: l.status }));

  // Live quotations from the quotations API
  const [liveQuotes, setLiveQuotes] = useState([]);
  const [liveProjects, setLiveProjects] = useState([]);
  useEffect(() => {
    fetch(QUOTES_API)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setLiveQuotes(d); })
      .catch(err => console.error('Failed to load quotations:', err));
    fetch(PROJECTS_API)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setLiveProjects(d); })
      .catch(err => console.error('Failed to load projects:', err));
  }, []);

  // Live quotation count for the KPI card
  const quotationPreparedCount = liveQuotes.length;

  // Derive Payment Collection from live quotations (no hardcoded values)
  const parseAmt = (v) => { const n = parseFloat(String(v || '').replace(/[^0-9.]/g, '')); return Number.isNaN(n) ? 0 : n; };
  const quoteTotal = (q) => parseAmt(q.amount) + parseAmt(q.gst);
  const fmtCompact = (n) => n >= 1e7 ? '₹' + (n / 1e7).toFixed(2) + 'Cr' : n >= 1e5 ? '₹' + (n / 1e5).toFixed(2) + 'L' : n >= 1e3 ? '₹' + Math.round(n / 1e3) + 'K' : '₹' + Math.round(n);
  const isReceived = (q) => q.approvalStatus === 'Approved' && q.quotationStatus === 'Prepared';
  const collectedTotal = liveQuotes.filter(isReceived).reduce((s, q) => s + quoteTotal(q), 0);
  const pendingTotal = liveQuotes.filter((q) => !isReceived(q)).reduce((s, q) => s + quoteTotal(q), 0);
  const livePayments = liveQuotes.slice(0, 4).map((q) => ({
    client: q.client,
    amount: fmtCompact(quoteTotal(q)),
    status: isReceived(q) ? 'Received' : q.approvalStatus === 'Approved' ? 'Advance' : 'Pending',
  }));

  // Today's appointments only (normalized)
  const _todayStr = new Date().toISOString().split('T')[0];
  const liveAppointments = allAppointments
    .filter(a => a.date === _todayStr)
    .map(a => ({
      id: a.id,
      client: a.title || a.manager,
      type: a.type,
      time: a.timeStart,
      status: a.status
    }));
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('Today');
  const [rangeSelectionState, setRangeSelectionState] = useState('start');
  const [currentNavDate, setCurrentNavDate] = useState(new Date());

  const applyPreset = (presetName) => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    switch (presetName) {
      case 'Today':
        start = today;
        end = today;
        break;
      case 'Yesterday':
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        start = yesterday;
        end = yesterday;
        break;
      case 'Last 7 Days':
        const last7 = new Date();
        last7.setDate(today.getDate() - 7);
        start = last7;
        end = today;
        break;
      case 'Last 30 Days':
        const last30 = new Date();
        last30.setDate(today.getDate() - 30);
        start = last30;
        end = today;
        break;
      case 'This Month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      default:
        break;
    }

    setSelectedPreset(presetName);
    if (presetName !== 'Custom') {
      setDateRange({
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      });
      setIsCalendarOpen(false);
    }
  };

  const prevMonth = () => {
    setCurrentNavDate(new Date(currentNavDate.getFullYear(), currentNavDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentNavDate(new Date(currentNavDate.getFullYear(), currentNavDate.getMonth() + 1, 1));
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const numDays = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    for (let i = 1; i <= numDays; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const isSelected = (day) => {
    if (!day) return false;
    const formatted = day.toISOString().split('T')[0];
    return formatted === dateRange.start || formatted === dateRange.end;
  };

  const isRange = (day) => {
    if (!day || !dateRange.start || !dateRange.end) return false;
    const formatted = day.toISOString().split('T')[0];
    return formatted > dateRange.start && formatted < dateRange.end;
  };

  const handleDayClick = (day) => {
    if (!day) return;
    const formatted = day.toISOString().split('T')[0];
    
    if (!rangeSelectionState || rangeSelectionState === 'start') {
      setDateRange({ start: formatted, end: '' });
      setRangeSelectionState('end');
      setSelectedPreset('Custom');
    } else {
      if (formatted < dateRange.start) {
        setDateRange({ start: formatted, end: dateRange.start });
      } else {
        setDateRange({ ...dateRange, end: formatted });
      }
      setRangeSelectionState('start');
      setIsCalendarOpen(false);
    }
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '4rem' }}>
      
      {/* 1. Welcome Header Section */}
      <div className="glass-panel" style={{
        padding: '2rem', borderRadius: 'var(--radius-xl)',
        background: 'linear-gradient(135deg, rgba(49, 46, 129, 0.05) 0%, rgba(79, 70, 229, 0.1) 100%)',
        border: '1px solid rgba(49, 46, 129, 0.1)',
      }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Welcome Back, {(JSON.parse(localStorage.getItem('crm_user') || 'null')?.name) || 'Indhumathi T'} 👋</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', margin: 0 }}>
            Manage construction leads, appointments, quotations, and project coordination efficiently.
          </p>
        </div>
      </div>

      {/* Date Picker Controls */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-1rem', position: 'relative', zIndex: 50 }}>
        <button 
          onClick={() => setIsCalendarOpen(!isCalendarOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            background: 'var(--surface-color)',
            padding: '0.6rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '600',
            color: 'var(--text-main)',
            outline: 'none',
            transition: 'all 0.2s'
          }}
        >
          <Calendar size={16} color="var(--primary-color)" />
          <span>
            {selectedPreset === 'Custom' 
              ? `${formatDateDisplay(dateRange.start)} - ${formatDateDisplay(dateRange.end)}` 
              : `${selectedPreset} (${formatDateDisplay(dateRange.start)} - ${formatDateDisplay(dateRange.end)})`}
          </span>
          <ChevronRight size={14} style={{ transform: isCalendarOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', opacity: 0.7 }} />
        </button>

        {isCalendarOpen && (
          <div style={{
            position: 'absolute',
            top: '48px',
            right: 0,
            backgroundColor: 'var(--surface-color)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            zIndex: 100,
            overflow: 'hidden',
            minWidth: '460px'
          }}>
            {/* Presets Sidebar */}
            <div style={{
              width: '160px',
              borderRight: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#F8FAFC',
              padding: '0.5rem 0'
            }}>
              {['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'This Month', 'Custom'].map(preset => (
                <button
                  key={preset}
                  onClick={() => applyPreset(preset)}
                  style={{
                    padding: '0.6rem 1rem',
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    fontSize: '0.8125rem',
                    fontWeight: selectedPreset === preset ? '600' : '500',
                    color: selectedPreset === preset ? 'var(--primary-color)' : 'var(--text-muted)',
                    backgroundColor: selectedPreset === preset ? '#EEF2FF' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    width: '100%'
                  }}
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Calendar View Area */}
            <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '300px' }}>
              
              {/* Header Navigator */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <button 
                  onClick={prevMonth}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '4px', borderRadius: '4px' }}
                >
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-main)' }}>
                  {currentNavDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <button 
                  onClick={nextMonth}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '4px', borderRadius: '4px' }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Weekdays Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '4px' }}>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                  <span key={d} style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)' }}>{d}</span>
                ))}
              </div>

              {/* Days Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                {getDaysInMonth(currentNavDate).map((day, idx) => {
                  if (!day) return <div key={`empty-${idx}`}></div>;
                  
                  const isSel = isSelected(day);
                  const isInRange = isRange(day);
                  const isToday = day.toDateString() === new Date().toDateString();
                  
                  return (
                    <button
                      key={idx}
                      onClick={() => handleDayClick(day)}
                      style={{
                        padding: '0.35rem 0',
                        fontSize: '0.75rem',
                        fontWeight: isSel || isToday ? '700' : '500',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        backgroundColor: isSel 
                          ? 'var(--primary-color)' 
                          : isInRange 
                            ? '#EEF2FF' 
                            : 'transparent',
                        color: isSel 
                          ? 'white' 
                          : isInRange 
                            ? 'var(--primary-color)' 
                            : isToday 
                              ? 'var(--primary-color)' 
                              : 'var(--text-main)',
                        boxShadow: isToday && !isSel ? 'inset 0 0 0 1px var(--primary-color)' : 'none'
                      }}
                      title={day.toLocaleDateString()}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>

            </div>
          </div>
        )}
      </div>

      {/* 2. KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        <KpiCard title="Received Leads" value={receivedLeadsCount} subtitle="+20 New Today" icon={FileText} color="#4F46E5" bg="#EEF4FF" borderColor="#C7D2FE" />
        <KpiCard title="Total Calls Made" value={callsMadeCount} subtitle="+12% from yesterday" icon={Phone} color="#7C3AED" bg="#F5F3FF" borderColor="#DDD6FE" />
        <KpiCard title="Hot Leads" value={hotLeadsCount} subtitle="High conversion chance" icon={Flame} color="#E11D48" bg="#FFF1F2" borderColor="#FECDD3" />
        <KpiCard title="Followup Leads" value={coldLeadsCount} subtitle="Needs attention" icon={Clock} color="#F97316" bg="#FFF7ED" borderColor="#FED7AA" />
        <KpiCard title="Warm Leads" value={warmLeadsCount} subtitle="Moderate potential" icon={Activity} color="#D97706" bg="#FFFBEB" borderColor="#FDE68A" />
        <KpiCard title="Junk Leads" value={junkLeadsCount} subtitle="Low quality" icon={Trash} color="#6B7280" bg="#F3F4F6" borderColor="#D1D5DB" />
        <KpiCard title="Appointment Fixed" value={appointmentFixedCount} subtitle="+5 New Today" icon={CalendarCheck} color="#22C55E" bg="#ECFDF5" borderColor="#BBF7D0" />
        <KpiCard title="Quotation Prepared" value={quotationPreparedCount} subtitle="Total Quotations" icon={FileText} color="#6366F1" bg="#EEF2FF" borderColor="#C7D2FE" />
        <KpiCard title="Payment Collection" value={fmtCompact(collectedTotal)} subtitle={`${fmtCompact(pendingTotal)} Pending`} icon={DollarSign} color="#16A34A" bg="#F0FDF4" borderColor="#86EFAC" />
      </div>

      {/* Row 2: Appointments | Quotation Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="card">
          <SectionHeader title="Today's Appointments" action="View All" onAction={() => navigate('/appointments')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {liveAppointments.length === 0 && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.5rem' }}>No appointments yet.</div>
            )}
            {liveAppointments.map(apt => (
              <div key={apt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>{apt.time} — {apt.type}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <User size={12} /> {apt.client}
                  </div>
                </div>
                <span className={`badge ${apt.status === 'Confirmed' ? 'badge-success' : 'badge-warning'}`}>{apt.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <SectionHeader title="Quotation Overview" action="View All" onAction={() => navigate('/quotations')} />
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                <th style={{ paddingBottom: '0.5rem' }}>Client</th>
                <th style={{ paddingBottom: '0.5rem' }}>Amount</th>
                <th style={{ paddingBottom: '0.5rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {liveQuotes.map((quote, idx) => (
                <tr key={idx} style={{ borderBottom: idx === liveQuotes.length - 1 ? 'none' : '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem 0', fontSize: '0.875rem', fontWeight: '500' }}>{quote.client}</td>
                  <td style={{ padding: '0.75rem 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{quote.amount}</td>
                  <td style={{ padding: '0.75rem 0' }}>
                    <span className={`badge ${(quote.status || quote.approvalStatus) === 'Approved' ? 'badge-success' : 'badge-warning'}`}>{quote.status || quote.approvalStatus}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 4: Payment Collection | Project Filing */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="card">
          <SectionHeader title="Payment Collection" action="View All" onAction={() => navigate('/payments')} />
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                <th style={{ paddingBottom: '0.5rem' }}>Client</th>
                <th style={{ paddingBottom: '0.5rem' }}>Amount</th>
                <th style={{ paddingBottom: '0.5rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {livePayments.length === 0 && (
                <tr><td colSpan={3} style={{ padding: '0.75rem 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>No payments yet.</td></tr>
              )}
              {livePayments.map((pay, idx) => (
                <tr key={idx} style={{ borderBottom: idx === livePayments.length - 1 ? 'none' : '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem 0', fontSize: '0.875rem', fontWeight: '500' }}>{pay.client}</td>
                  <td style={{ padding: '0.75rem 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{pay.amount}</td>
                  <td style={{ padding: '0.75rem 0' }}>
                    <span className={`badge ${pay.status === 'Pending' ? 'badge-warning' : 'badge-success'}`}>{pay.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <SectionHeader title="Project Filing Status" action="View All" onAction={() => navigate('/projects')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {liveProjects.map((proj, idx) => (
              <div key={idx} style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>{proj.name || proj.type}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Client: {proj.client}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className={`badge ${(proj.status || '').includes('Pending') ? 'badge-warning' : 'badge-success'}`}>{proj.status}</span>
                  <button className="btn btn-outline" style={{ padding: '0.25rem', border: 'none' }}><ChevronRight size={16}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>



    </div>
  );
};

export default DashboardHome;

