import React, { useState, useEffect } from 'react';
import { DollarSign, AlertCircle, CheckCircle, TrendingUp, DownloadCloud } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useToast } from '../components/Toast';

const QUOTES_API = 'http://localhost:5000/api/quotations';

// ── Money helpers ──
const parseAmount = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const n = parseFloat(String(val).replace(/[^0-9.]/g, ''));
  return Number.isNaN(n) ? 0 : n;
};
const formatINR = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
const formatCompact = (n) => {
  if (n >= 1e7) return '₹' + (n / 1e7).toFixed(2) + 'Cr';
  if (n >= 1e5) return '₹' + (n / 1e5).toFixed(2) + 'L';
  if (n >= 1e3) return '₹' + Math.round(n / 1e3) + 'K';
  return '₹' + Math.round(n);
};
const formatDate = (d) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// Map a real quotation record onto a payment/invoice row.
const quoteToInvoice = (q) => {
  const created = q.createdAt ? new Date(q.createdAt) : new Date();
  const due = new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000);
  const total = parseAmount(q.amount) + parseAmount(q.gst);
  const isReceived = q.approvalStatus === 'Approved' && q.quotationStatus === 'Prepared';
  let status;
  if (isReceived) status = 'Received';
  else if (due < new Date()) status = 'Overdue';
  else status = 'Pending';
  return {
    id: `INV-${q.id}`,
    client: q.client || '—',
    project: q.project || '',
    createdAt: created,
    due: formatDate(due),
    amountNum: total,
    amount: formatINR(total),
    status,
    approvalStatus: q.approvalStatus,
    quotationStatus: q.quotationStatus,
  };
};

const KpiCard = ({ title, value, icon: Icon, color }) => (
  <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
    <div style={{
      width: '48px', height: '48px', borderRadius: 'var(--radius-lg)',
      backgroundColor: `${color}15`, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <Icon size={24} />
    </div>
    <div>
      <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{title}</p>
      <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>{value}</h3>
    </div>
  </div>
);

const Payments = () => {
  const addToast = useToast();
  const [invoices, setInvoices] = useState([]);

  // Derive payments from live quotations
  useEffect(() => {
    fetch(QUOTES_API)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setInvoices(data.map(quoteToInvoice));
      })
      .catch((err) => console.error('Failed to load payments from quotations:', err));
  }, []);

  // ── Live KPI totals ──
  const totalCollected = invoices.filter((i) => i.status === 'Received').reduce((s, i) => s + i.amountNum, 0);
  const advancePayments = invoices
    .filter((i) => i.approvalStatus === 'Approved' && i.quotationStatus !== 'Prepared')
    .reduce((s, i) => s + i.amountNum, 0);
  const pendingCollection = invoices.filter((i) => i.status === 'Pending').reduce((s, i) => s + i.amountNum, 0);
  const overduePayments = invoices.filter((i) => i.status === 'Overdue').reduce((s, i) => s + i.amountNum, 0);

  // ── Live collection trend: last 4 weeks of received collections ──
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const chartData = [0, 1, 2, 3].map((idx) => {
    // idx 0 = oldest (Week 1), idx 3 = most recent (Week 4)
    const weeksAgo = 3 - idx;
    const start = now - (weeksAgo + 1) * weekMs;
    const end = now - weeksAgo * weekMs;
    const collected = invoices
      .filter((i) => i.status === 'Received' && i.createdAt.getTime() >= start && i.createdAt.getTime() < end)
      .reduce((s, i) => s + i.amountNum, 0);
    return { name: `Week ${idx + 1}`, collected };
  });

  // Most recent invoices first
  const recentInvoices = [...invoices].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
      <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>Payment Collection</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
        <KpiCard title="Total Collected" value={formatCompact(totalCollected)} icon={CheckCircle} color="var(--success-color)" />
        <KpiCard title="Advance Payments" value={formatCompact(advancePayments)} icon={TrendingUp} color="var(--primary-color)" />
        <KpiCard title="Pending Collection" value={formatCompact(pendingCollection)} icon={DollarSign} color="var(--warning-color)" />
        <KpiCard title="Overdue Payments" value={formatCompact(overduePayments)} icon={AlertCircle} color="#DC2626" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Recent Invoices</h3>
            <button className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }} onClick={() => addToast('Opening full invoice list...')}>View All</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: '#F8FAFC' }}>
              <tr>
                <th style={{ padding: '1rem 1.5rem', fontWeight: '600', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Invoice Number</th>
                <th style={{ padding: '1rem 1.5rem', fontWeight: '600', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Customer Name</th>
                <th style={{ padding: '1rem 1.5rem', fontWeight: '600', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Due Date</th>
                <th style={{ padding: '1rem 1.5rem', fontWeight: '600', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Amount</th>
                <th style={{ padding: '1rem 1.5rem', fontWeight: '600', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentInvoices.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '2rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    No invoices yet. They appear here as quotations are created.
                  </td>
                </tr>
              )}
              {recentInvoices.map((inv, index) => (
                <tr key={inv.id} style={{ borderBottom: index === recentInvoices.length - 1 ? 'none' : '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', fontWeight: '600', color: 'var(--primary-color)' }}>{inv.id}</td>
                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', fontWeight: '500' }}>{inv.client}</td>
                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{inv.due}</td>
                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', fontWeight: '600' }}>{inv.amount}</td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <span className={`badge ${inv.status === 'Overdue' ? 'badge-danger' : inv.status === 'Received' ? 'badge-success' : 'badge-warning'}`}>
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Collection Trend</h3>
          <div style={{ height: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} />
                <Tooltip cursor={{ fill: 'transparent' }} formatter={(v) => formatINR(v)} />
                <Bar dataKey="collected" fill="var(--success-color)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', display: 'flex', gap: '0.5rem', justifyContent: 'center' }} onClick={() => addToast('Generating Financial Report PDF...', 'success')}>
            <DownloadCloud size={16} /> Generate Financial Report
          </button>
        </div>
      </div>
    </div>
  );
};

export default Payments;
