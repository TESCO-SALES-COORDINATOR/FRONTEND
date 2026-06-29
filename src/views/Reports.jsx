import React, { useState, useEffect } from 'react';
import { BarChart3, PieChart, TrendingUp, Users, DollarSign } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell } from 'recharts';
import { useToast } from '../components/Toast';

const LEADS_API = 'http://localhost:5000/api/leads';
const QUOTES_API = 'http://localhost:5000/api/quotations';
const PROJECTS_API = 'http://localhost:5000/api/projects';

// ── Money helpers ──
const parseAmount = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const n = parseFloat(String(val).replace(/[^0-9.]/g, ''));
  return Number.isNaN(n) ? 0 : n;
};
const formatCompact = (n) => {
  if (n >= 1e7) return '₹' + (n / 1e7).toFixed(2) + 'Cr';
  if (n >= 1e5) return '₹' + (n / 1e5).toFixed(2) + 'L';
  if (n >= 1e3) return '₹' + Math.round(n / 1e3) + 'K';
  return '₹' + Math.round(n);
};
const formatINR = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
const quoteTotal = (q) => parseAmount(q.amount) + parseAmount(q.gst);

const COLORS = ['var(--success-color)', '#ef4444', 'var(--warning-color)'];

const KpiWidget = ({ title, value, subtitle, icon: Icon, color }) => (
  <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)' }}>
      <Icon size={18} />
      <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>{title}</span>
    </div>
    <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-main)' }}>{value}</h3>
    <span style={{ fontSize: '0.75rem', color: color, fontWeight: '500' }}>{subtitle}</span>
  </div>
);

const Reports = () => {
  const addToast = useToast();
  const [leads, setLeads] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    fetch(LEADS_API).then((r) => r.json()).then((d) => { if (Array.isArray(d)) setLeads(d); }).catch((e) => console.error('Reports leads:', e));
    fetch(QUOTES_API).then((r) => r.json()).then((d) => { if (Array.isArray(d)) setQuotes(d); }).catch((e) => console.error('Reports quotes:', e));
    fetch(PROJECTS_API).then((r) => r.json()).then((d) => { if (Array.isArray(d)) setProjects(d); }).catch((e) => console.error('Reports projects:', e));
  }, []);

  // ── Lead conversion (cross-referenced with approved quotations) ──
  const approvedLeadIds = new Set(quotes.filter((q) => q.approvalStatus === 'Approved').map((q) => q.leadId).filter(Boolean));
  const isLost = (s) => /lost|junk|dead|not interested/i.test(s || '');
  const isConverted = (l) => approvedLeadIds.has(l.id) || /convert|won|booked/i.test(l.status || '');
  const convertedCount = leads.filter(isConverted).length;
  const lostCount = leads.filter((l) => !isConverted(l) && isLost(l.status)).length;
  const inProgressCount = Math.max(leads.length - convertedCount - lostCount, 0);

  // ── Quotation / pipeline value ──
  const totalQuoteValue = quotes.reduce((s, q) => s + quoteTotal(q), 0);
  const approvedQuotes = quotes.filter((q) => q.approvalStatus === 'Approved');
  const pipelineValue = quotes.filter((q) => q.approvalStatus !== 'Approved' && !isLost(q.quotationStatus)).reduce((s, q) => s + quoteTotal(q), 0);

  const convPct = leads.length ? Math.round((convertedCount / leads.length) * 100) : 0;
  const successPct = quotes.length ? Math.round((approvedQuotes.length / quotes.length) * 100) : 0;

  // ── Revenue trend: last 6 months from quotation totals ──
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const revenueData = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const value = quotes
      .filter((q) => {
        if (!q.createdAt) return false;
        const qd = new Date(q.createdAt);
        return qd.getFullYear() === d.getFullYear() && qd.getMonth() === d.getMonth();
      })
      .reduce((s, q) => s + quoteTotal(q), 0);
    return { name: MONTHS[d.getMonth()], value };
  });

  // ── Lead analytics pie ──
  const leadData = [
    { name: 'Converted', value: convertedCount },
    { name: 'Lost', value: lostCount },
    { name: 'In Progress', value: inProgressCount },
  ];
  const hasLeadData = leadData.some((d) => d.value > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>Reports & Analytics</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <select className="btn btn-outline" style={{ appearance: 'none', paddingRight: '2rem', cursor: 'pointer' }} onChange={(e) => addToast(`Data filtered by ${e.target.value}`)}>
            <option>Last 30 Days</option>
            <option>This Quarter</option>
            <option>This Year</option>
          </select>
          <button className="btn btn-primary" style={{ display: 'flex', gap: '0.5rem' }} onClick={() => addToast('Exporting Report as CSV...', 'success')}>
            <BarChart3 size={16} /> Export Report
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
        <KpiWidget title="Sales Pipeline" value={formatCompact(pipelineValue)} subtitle={`${quotes.length} quotations tracked`} icon={TrendingUp} color="var(--success-color)" />
        <KpiWidget title="Lead Conversion" value={`${convPct}%`} subtitle={`${convertedCount} of ${leads.length} leads`} icon={Users} color="var(--success-color)" />
        <KpiWidget title="Quotation Value" value={formatCompact(totalQuoteValue)} subtitle={`${approvedQuotes.length} approved`} icon={DollarSign} color="var(--warning-color)" />
        <KpiWidget title="Success Rate" value={`${successPct}%`} subtitle={`${approvedQuotes.length}/${quotes.length} quotations`} icon={PieChart} color="var(--primary-color)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Revenue Trend</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} width={70} />
                <Tooltip formatter={(v) => formatINR(v)} />
                <Area type="monotone" dataKey="value" stroke="var(--primary-color)" fill="var(--primary-color)" fillOpacity={0.1} strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Lead Analytics</h3>
          <div style={{ height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {hasLeadData ? (
              <ResponsiveContainer width="100%" height="80%">
                <RechartsPie>
                  <Pie data={leadData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {leadData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPie>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '80%', display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                No lead data yet
              </div>
            )}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
               {leadData.map((entry, idx) => (
                 <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}>
                   <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: COLORS[idx] }}></div>
                   {entry.name} ({entry.value})
                 </div>
               ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
