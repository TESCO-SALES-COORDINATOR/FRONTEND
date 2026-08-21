import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle, Clock, AlertCircle, XCircle, Plus, Calendar, ChevronDown, X, Eye, Trash2, Pencil, Download, Upload, FileText, Bell, Save } from 'lucide-react';
import { useToast } from '../components/Toast';

const PAYMENTS_API = 'https://api-salescoordinator.tescomanagement.com/api/payments';
const LEADS_API = 'https://api-salescoordinator.tescomanagement.com/api/leads';
const PER_PAGE = 6;

// Sales team — matches the roster used across the app (LeadManagement / Appointments)
const SALES_TEAM = ['Azar Abdullah A', 'Praveenraja P', 'Suresh P', 'Agsal A'];
const PAYMENT_METHODS = ['Bank Transfer', 'UPI', 'Cheque', 'Cash'];

// ── Money helpers ──────────────────────────────────────────────
const parseAmount = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const n = parseFloat(String(val).replace(/[^0-9.]/g, ''));
  return Number.isNaN(n) ? 0 : n;
};
// Indian grouping: 450000 -> ₹4,50,000
const formatINR = (n) => '₹' + Math.round(parseAmount(n)).toLocaleString('en-IN');
// Compact: 24000000 -> ₹2.4Cr, 4500000 -> ₹45L
const formatCompact = (val) => {
  const n = parseAmount(val);
  const trim = (v) => Number(v.toFixed(2)).toString();
  if (n >= 1e7) return '₹' + trim(n / 1e7) + 'Cr';
  if (n >= 1e5) return '₹' + trim(n / 1e5) + 'L';
  if (n >= 1e3) return '₹' + trim(n / 1e3) + 'K';
  return '₹' + Math.round(n);
};

// ── Date helpers ───────────────────────────────────────────────
const fmtDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const todayStr = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

const RANGE_OPTIONS = [
  { key: 'all', label: 'All Time', days: null },
  { key: '7', label: 'Last 7 Days', days: 7 },
  { key: '30', label: 'Last 30 Days', days: 30 },
  { key: '90', label: 'Last 90 Days', days: 90 },
];
const rangeStart = (days) => {
  if (!days) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
};

// Derive an invoice's status from its numbers when one isn't stored.
const deriveStatus = (p) => {
  if (p.status) return p.status;
  const invoice = Number(p.invoiceValue) || Number(p.orderValue) || 0;
  const collected = Number(p.amountCollected) || 0;
  if ((Number(p.overduePayments) || 0) > 0) return 'Overdue';
  if (invoice > 0 && collected >= invoice) return 'Paid';
  if (collected > 0) return 'Partial';
  return 'Pending';
};

const STATUS_OPTIONS = ['Paid', 'Partial', 'Pending', 'Overdue'];

// Status → badge colour (used by the detail drawer + table)
const STATUS_COLORS = {
  Paid: '#22C55E',
  Partial: '#3B82F6',
  Pending: '#F59E0B',
  Overdue: '#EF4444',
};

// Format an ISO timestamp OR a 'YYYY-MM-DD' string into a readable date; '' when empty/invalid
const fmtAny = (val) => {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Build the drawer's Timeline purely from the record's REAL data — no placeholder dates.
const deriveTimeline = (p) => {
  if (!p) return [];
  const events = [];
  const status = deriveStatus(p);
  const collected = Number(p.amountCollected) || 0;
  const invoice = Number(p.invoiceValue) || Number(p.orderValue) || 0;
  const fullyPaid = invoice > 0 && collected >= invoice;

  if (p.createdAt) events.push({ label: 'Invoice Generated', date: p.createdAt });
  if (p.reminderSentAt) events.push({ label: 'Payment Reminder Sent', date: p.reminderSentAt });
  if (collected > 0 && !fullyPaid && p.paymentDate) {
    events.push({ label: 'Partial Payment Received', date: p.paymentDate });
  }
  if (status === 'Paid' && (p.paymentDate || p.dueDate)) {
    events.push({ label: 'Full Payment Cleared', date: p.paymentDate || p.dueDate });
  }
  // Fold in any extra custom entries stored on the record (each {label, date})
  if (Array.isArray(p.timeline)) {
    p.timeline.forEach((e) => { if (e && e.label) events.push(e); });
  }
  return events;
};

const KpiCard = ({ value, title, icon: Icon, color }) => (
  <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
    <div style={{
      width: '52px', height: '52px', borderRadius: 'var(--radius-lg)', flexShrink: 0,
      backgroundColor: `${color}1A`, color, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon size={26} />
    </div>
    <div>
      <h3 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-main)' }}>{value}</h3>
      <p style={{ margin: '0.15rem 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{title}</p>
    </div>
  </div>
);

const inputStyle = {
  width: '100%', padding: '0.7rem 0.85rem', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-color)', outline: 'none', fontSize: '0.9rem',
  backgroundColor: 'var(--surface-color)', color: 'var(--text-main)',
};
const labelStyle = {
  display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-main)',
};
const selectStyle = {
  appearance: 'none', WebkitAppearance: 'none',
  padding: '0.75rem 2.5rem 0.75rem 1rem', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)',
  color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: '500', cursor: 'pointer', outline: 'none',
};

const emptyForm = {
  id: '', leadId: '', customer: '', orderValue: '', amountCollected: '',
  pendingPayments: '', upcomingDues: '', overduePayments: '', invoiceValue: '', dueDate: '',
  method: '', transactionId: '', paymentDate: '', notes: '', manager: '',
};

// ── Payment Collection detail drawer ─────────────────────────────
// Right-side slide-over. Fully populated from the selected record's LIVE data.
const DRAWER_TABS = [
  { key: 'overview', label: 'Payment Overview' },
  { key: 'billing', label: 'Billing Details' },
  { key: 'upload', label: 'Upload Invoice' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'notes', label: 'Notes' },
];

const PaymentDrawer = ({
  record, mode, setMode, tab, setTab, editForm, setEditForm, rebuildEditForm,
  saving, onClose, onSaveEdits, newNote, setNewNote, onSaveNote,
  uploadForm, setUploadForm, onInvoiceFile, onSubmitUpload,
  onSendReminder, onLogPayment, onDownload, leads, managerOptions,
}) => {
  const isEdit = mode === 'edit';
  const status = deriveStatus(record);
  const badgeColor = STATUS_COLORS[status] || '#4F46E5';
  const lead = leads.find((l) => l.id === record.leadId);
  const upd = (k, v) => setEditForm((f) => ({ ...f, [k]: v }));

  const startEdit = () => { setEditForm(rebuildEditForm()); setMode('edit'); };
  const cancelEdit = () => { setEditForm(rebuildEditForm()); setMode('view'); };

  // View-mode values (billing falls back to the linked lead — never invents data)
  const bv = {
    clientName: record.clientName || record.customer || '',
    projectLocation: record.projectLocation || lead?.appointmentLocation || '',
    contactDetails: record.contactDetails || [lead?.phone, lead?.email].filter(Boolean).join(' / '),
    billingName: record.billingName || record.customer || '',
    mobileNumber: record.mobileNumber || lead?.phone || '',
    altMobile: record.altMobile || '',
    siteAddress: record.siteAddress || lead?.appointmentLocation || '',
    billingAddress: record.billingAddress || '',
    gstNumber: record.gstNumber || '',
    email: record.email || lead?.email || '',
    salesperson: record.salesperson || record.manager || lead?.manager || '',
  };

  const cardStyle = { border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.1rem 1.25rem' };
  const cardTitle = { margin: '0 0 0.9rem', fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-main)' };
  const smallInput = { ...inputStyle, padding: '0.5rem 0.65rem', fontSize: '0.85rem' };

  // Render one Payment Overview stat (view: label/value, edit: label/input)
  const OverviewStat = ({ k, label, type }) => {
    const raw = record[k];
    let display;
    if (type === 'money') display = formatINR(raw);
    else if (type === 'date') display = fmtAny(raw) || '—';
    else if (type === 'status') display = status;
    else display = raw || '—';
    return (
      <div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>{label}</div>
        {isEdit ? (
          type === 'status' ? (
            <select value={editForm?.status || ''} onChange={(e) => upd('status', e.target.value)} style={{ ...smallInput, appearance: 'none' }}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <input
              type={type === 'date' ? 'date' : 'text'}
              inputMode={type === 'money' ? 'numeric' : undefined}
              value={editForm?.[k] ?? ''}
              onChange={(e) => upd(k, e.target.value)}
              style={smallInput}
            />
          )
        ) : (
          <div style={{ fontSize: '0.95rem', fontWeight: '700', color: type === 'money' ? 'var(--text-main)' : 'var(--text-main)' }}>{display}</div>
        )}
      </div>
    );
  };

  // Render one Billing Details field
  const BillingField = ({ k, label }) => (
    <div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>{label}</div>
      {isEdit ? (
        <input value={editForm?.[k] ?? ''} onChange={(e) => upd(k, e.target.value)} style={smallInput} />
      ) : (
        <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-main)', wordBreak: 'break-word' }}>{bv[k] || '—'}</div>
      )}
    </div>
  );

  const timelineEvents = deriveTimeline(record)
    .filter((e) => e.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const notes = Array.isArray(record.notesLog) ? record.notesLog : [];

  const footerBtn = {
    flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
    padding: '0.7rem 0.5rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer',
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(600px, 100%)', height: '100%', backgroundColor: 'var(--surface-color)',
          display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 30px rgba(0,0,0,0.25)',
          animation: 'none',
        }}
      >
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '800', color: 'var(--text-main)' }}>{record.id || '—'}</h3>
              <span style={{ padding: '0.25rem 0.7rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: '700', color: '#fff', backgroundColor: badgeColor }}>{status}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {isEdit ? (
                <>
                  <button type="button" onClick={onSaveEdits} disabled={saving} className="btn" style={{ backgroundColor: '#16A34A', color: '#fff', padding: '0.4rem 0.9rem', fontSize: '0.85rem', gap: '0.35rem', opacity: saving ? 0.6 : 1 }}>
                    <Save size={15} /> {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" onClick={cancelEdit} className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>Cancel</button>
                </>
              ) : (
                <button type="button" onClick={startEdit} className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', gap: '0.35rem' }}>
                  <Pencil size={15} /> Edit
                </button>
              )}
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={22} /></button>
            </div>
          </div>
          <div style={{ marginTop: '0.6rem', fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-main)' }}>{bv.billingName || '—'}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{bv.clientName || record.customer || '—'}</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.15rem', padding: '0 0.6rem', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
          {DRAWER_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                padding: '0.85rem 0.6rem', fontSize: '0.82rem', fontWeight: '600',
                color: tab === t.key ? 'var(--secondary-color)' : 'var(--text-muted)',
                borderBottom: tab === t.key ? '2px solid var(--secondary-color)' : '2px solid transparent',
              }}
            >{t.label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {tab === 'overview' && (
            <>
              <div style={cardStyle}>
                <h4 style={cardTitle}>Payment Status</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {[
                    ['orderValue', 'Order Value', 'money'],
                    ['amountCollected', 'Amount Collected', 'money'],
                    ['upcomingDues', 'Upcoming Dues', 'money'],
                    ['pendingPayments', 'Pending Payments', 'money'],
                    ['overduePayments', 'Overdue Payments', 'money'],
                    ['invoiceValue', 'Invoice Value', 'money'],
                    ['dueDate', 'Due Date', 'date'],
                    ['status', 'Status', 'status'],
                  ].map(([k, label, type]) => <OverviewStat key={k} k={k} label={label} type={type} />)}
                </div>
              </div>
              <div style={cardStyle}>
                <h4 style={cardTitle}>Payment Method</h4>
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Selected Method</div>
                  {isEdit ? (
                    <select value={editForm?.method || ''} onChange={(e) => upd('method', e.target.value)} style={{ ...smallInput, appearance: 'none' }}>
                      <option value="">Select Method</option>
                      {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  ) : (
                    <div style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-main)' }}>{record.method || '—'}</div>
                  )}
                </div>
              </div>
            </>
          )}

          {tab === 'billing' && (
            <div style={cardStyle}>
              <h4 style={cardTitle}>Client &amp; Project Details</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {[
                  ['clientName', 'Client Name'],
                  ['projectLocation', 'Project Location'],
                  ['contactDetails', 'Contact Details'],
                  ['billingName', 'Billing Name'],
                  ['mobileNumber', 'Mobile Number'],
                  ['altMobile', 'Alternate Mobile Number'],
                  ['siteAddress', 'Site Address'],
                  ['billingAddress', 'Billing Address'],
                  ['gstNumber', 'GST Number'],
                  ['email', 'Email ID / WhatsApp'],
                  ['salesperson', 'Salesperson'],
                ].map(([k, label]) => <BillingField key={k} k={k} label={label} />)}
              </div>
            </div>
          )}

          {tab === 'upload' && (
            <div style={cardStyle}>
              <h4 style={cardTitle}>Upload Invoice</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Invoice Value (₹)</label>
                  <input
                    type="text" inputMode="numeric" value={uploadForm.invoiceValue}
                    onChange={(e) => setUploadForm((f) => ({ ...f, invoiceValue: e.target.value }))}
                    placeholder="e.g. 425000" style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Upload Document</label>
                  <input type="file" onChange={(e) => onInvoiceFile(e.target.files && e.target.files[0])} style={{ ...inputStyle, padding: '0.5rem' }} />
                  {uploadForm.fileName && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <FileText size={15} />
                      {uploadForm.fileData
                        ? <a href={uploadForm.fileData} download={uploadForm.fileName} style={{ color: 'var(--secondary-color)' }}>{uploadForm.fileName}</a>
                        : uploadForm.fileName}
                    </div>
                  )}
                </div>
                <button type="button" onClick={onSubmitUpload} disabled={saving} className="btn btn-primary" style={{ alignSelf: 'flex-start', padding: '0.6rem 1.4rem', gap: '0.4rem', opacity: saving ? 0.6 : 1 }}>
                  <Upload size={16} /> {saving ? 'Saving…' : 'Submit'}
                </button>
              </div>
            </div>
          )}

          {tab === 'timeline' && (
            <div style={cardStyle}>
              <h4 style={cardTitle}>Timeline</h4>
              {timelineEvents.length === 0 ? (
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>No timeline events yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {timelineEvents.map((e, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: 'var(--secondary-color)', marginTop: '0.3rem', flexShrink: 0 }} />
                        {i < timelineEvents.length - 1 && <div style={{ width: '2px', flex: 1, backgroundColor: 'var(--border-color)', minHeight: '1.5rem' }} />}
                      </div>
                      <div style={{ paddingBottom: '1rem' }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-main)' }}>{e.label}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{fmtAny(e.date)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'notes' && (
            <div style={cardStyle}>
              <h4 style={cardTitle}>Notes</h4>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Add Note</label>
                <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Write a note…" style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', fontFamily: 'inherit' }} />
                <button type="button" onClick={onSaveNote} disabled={saving || !newNote.trim()} className="btn btn-primary" style={{ marginTop: '0.6rem', padding: '0.5rem 1.2rem', opacity: (saving || !newNote.trim()) ? 0.5 : 1 }}>
                  {saving ? 'Saving…' : 'Save Note'}
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {record.notes && (
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>{record.notes}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Original payment note</div>
                  </div>
                )}
                {notes.length === 0 && !record.notes && (
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>No notes yet.</div>
                )}
                {[...notes].reverse().map((n, i) => (
                  <div key={i} style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>{n.text}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{fmtAny(n.timestamp)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{ display: 'flex', gap: '0.6rem', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)' }}>
          <button type="button" onClick={onDownload} style={{ ...footerBtn, backgroundColor: 'var(--secondary-color)', color: '#fff', border: 'none' }}>
            <Download size={16} /> Invoice
          </button>
          <button type="button" onClick={onSendReminder} disabled={saving} style={{ ...footerBtn, backgroundColor: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border-color)', opacity: saving ? 0.6 : 1 }}>
            <Bell size={16} /> Reminder
          </button>
          <button type="button" onClick={onLogPayment} disabled={saving} style={{ ...footerBtn, backgroundColor: '#16A34A', color: '#fff', border: 'none', opacity: saving ? 0.6 : 1 }}>
            <CheckCircle size={16} /> Log Payment
          </button>
        </div>
      </div>
    </div>
  );
};

const Payments = () => {
  const addToast = useToast();
  const [payments, setPayments] = useState([]);
  const [leads, setLeads] = useState([]);
  const [projects, setProjects] = useState([]); // order-confirmations — used to gate the Payment lead picker
  const [loaded, setLoaded] = useState(false);

  const [rangeKey, setRangeKey] = useState('all');
  const [manager, setManager] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dueDateFilter, setDueDateFilter] = useState('');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // ── Load live payments (stored in MongoDB) ──
  const loadPayments = async () => {
    try {
      const res = await fetch(PAYMENTS_API);
      const data = await res.json();
      if (Array.isArray(data)) setPayments(data);
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    loadPayments();
    // Poll so a payment a manager records shows up here without a manual refresh
    const iv = setInterval(loadPayments, 15000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    fetch(LEADS_API)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setLeads(d); })
      .catch((e) => console.error('Failed to load leads:', e));
  }, []);

  // Load order-confirmations (projects) so Payment only offers leads whose order is
  // confirmed — strict lifecycle: Order Confirmation → Payment Collection.
  useEffect(() => {
    const loadProjects = () => fetch('https://api-salescoordinator.tescomanagement.com/api/projects')
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setProjects(d); })
      .catch(() => {});
    loadProjects();
    const iv = setInterval(loadProjects, 15000);
    return () => clearInterval(iv);
  }, []);

  // ── Lifecycle gating for the Payment lead picker ──
  //   • eligible = lead has a COMPLETED order confirmation AND no payment record yet.
  const isOrderConfirmed = (p) => /confirm/i.test(String(p.status || ''));
  const leadHasOrderConfirmed = (leadId) => projects.some((p) => (p.leadId || p.id) === leadId && isOrderConfirmed(p));
  const leadHasPayment = (leadId) => payments.some((p) => p.leadId === leadId);
  const eligibleLeads = leads.filter((l) => leadHasOrderConfirmed(l.id) && !leadHasPayment(l.id));

  // ── Managers for the filter (derived from data) ──
  const managers = useMemo(() => {
    const set = new Set();
    payments.forEach((p) => { if (p.manager) set.add(p.manager); });
    return Array.from(set).sort();
  }, [payments]);

  // ── Manager options for the Record Payment form ──
  //   Start from the app's sales roster, then fold in any manager seen on the
  //   leads (so a lead-autofilled manager is always selectable).
  const managerOptions = useMemo(() => {
    const set = new Set(SALES_TEAM);
    leads.forEach((l) => { if (l.manager) set.add(l.manager); });
    if (form.manager) set.add(form.manager);
    return Array.from(set);
  }, [leads, form.manager]);

  // ── Date range label + start ──
  const rangeDays = RANGE_OPTIONS.find((o) => o.key === rangeKey)?.days;
  const start = rangeStart(rangeDays);

  // Rows after top filters (date range + manager) — drives the KPI totals
  const scoped = useMemo(() => {
    return payments.filter((p) => {
      const created = p.createdAt ? new Date(p.createdAt) : null;
      if (start && created && created < start) return false;
      if (manager !== 'all' && p.manager !== manager) return false;
      return true;
    });
  }, [payments, start, manager]);

  // ── KPI totals (live from stored data) ──
  const kpis = useMemo(() => {
    const sum = (key) => scoped.reduce((s, p) => s + (Number(p[key]) || 0), 0);
    return {
      collected: sum('amountCollected'),
      upcoming: sum('upcomingDues'),
      pending: sum('pendingPayments'),
      overdue: sum('overduePayments'),
    };
  }, [scoped]);

  // Rows after in-table filters (status + due date)
  const filtered = useMemo(() => {
    return scoped.filter((p) => {
      if (statusFilter !== 'all' && deriveStatus(p) !== statusFilter) return false;
      if (dueDateFilter && p.dueDate !== dueDateFilter) return false;
      return true;
    });
  }, [scoped, statusFilter, dueDateFilter]);

  // Reset to first page whenever the filters change the result set
  useEffect(() => { setPage(1); }, [rangeKey, manager, statusFilter, dueDateFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PER_PAGE;
  const pageRows = filtered.slice(pageStart, pageStart + PER_PAGE);

  // ── Suggested next invoice id (no hardcoded seed) ──
  const nextInvoiceId = () => {
    let max = 1000;
    payments.forEach((p) => {
      const m = /(\d+)$/.exec(p.id || '');
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return `INV-${max + 1}`;
  };

  const openModal = () => {
    setForm({ ...emptyForm, id: nextInvoiceId(), dueDate: todayStr(), paymentDate: todayStr() });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setForm(emptyForm); };

  const onLeadChange = (val) => {
    const lead = leads.find((l) => l.id === val || l.name === val);
    setForm((prev) => ({
      ...prev,
      leadId: lead?.id || prev.leadId,
      customer: lead?.name || val,
      manager: lead?.manager || prev.manager,
      orderValue: lead?.budget ? parseAmount(lead.budget) : prev.orderValue,
    }));
  };

  // Selecting a Lead ID from the dropdown autofills the invoice from that lead
  const onLeadSelect = (val) => {
    const lead = leads.find((l) => l.id === val);
    setForm((prev) => ({
      ...prev,
      leadId: val,
      customer: lead?.name || prev.customer,
      manager: lead?.manager || prev.manager,
      orderValue: lead?.budget ? parseAmount(lead.budget) : prev.orderValue,
    }));
  };

  // ── Create a payment (persists to Mongo) ──
  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.id || !form.customer) return;
    // ── Enforce the strict lifecycle before recording a payment ──
    if (!leadHasOrderConfirmed(form.leadId)) {
      addToast('This lead has no confirmed order yet — confirm the order first.', 'error');
      return;
    }
    if (leadHasPayment(form.leadId)) {
      addToast('This lead already has a payment record. Only one payment collection is allowed per lead.', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      id: form.id.trim(),
      leadId: (form.leadId || '').trim(),
      customer: form.customer.trim(),
      manager: (form.manager || '').trim(),
      orderValue: parseAmount(form.orderValue),
      amountCollected: parseAmount(form.amountCollected),
      pendingPayments: parseAmount(form.pendingPayments),
      upcomingDues: parseAmount(form.upcomingDues),
      overduePayments: parseAmount(form.overduePayments),
      invoiceValue: parseAmount(form.invoiceValue),
      dueDate: form.dueDate || '',
      method: (form.method || '').trim(),
      transactionId: (form.transactionId || '').trim(),
      paymentDate: form.paymentDate || '',
      notes: (form.notes || '').trim(),
    };
    try {
      const res = await fetch(PAYMENTS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('create failed');
      addToast('Payment recorded', 'success');
      // Payment is the final stage — lock this lead as Completed (leads PUT).
      const lead = leads.find((l) => l.id === form.leadId);
      if (lead && !/completed/i.test(String(lead.status || ''))) {
        const stamp = new Date().toLocaleDateString('en-GB') + ', ' + new Date().toLocaleTimeString('en-US', { hour12: false });
        const entry = { timestamp: stamp, message: 'Payment collected — lead marked Completed', remark: '' };
        const history = Array.isArray(lead.history) ? [...lead.history, entry] : [entry];
        fetch(`${LEADS_API}/${form.leadId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Completed', history })
        }).catch((err) => console.error('Failed to mark lead Completed:', err));
        setLeads((prev) => prev.map((l) => (l.id === form.leadId ? { ...l, status: 'Completed', history } : l)));
      }
      await loadPayments();
      closeModal();
    } catch (err) {
      console.error('Failed to record payment:', err);
      addToast('Could not save. Is the backend running?', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Inline due-date update (persists to Mongo) ──
  const handleDueDateChange = async (p, value) => {
    setPayments((prev) => prev.map((x) => (x.id === p.id ? { ...x, dueDate: value } : x)));
    try {
      await fetch(`${PAYMENTS_API}/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueDate: value }),
      });
    } catch (err) {
      console.error('Failed to update due date:', err);
      addToast('Could not update due date', 'error');
    }
  };

  // ── Payment Collection detail drawer (View / Edit) ──
  const [drawer, setDrawer] = useState(null);        // the payment record shown in the drawer
  const [drawerMode, setDrawerMode] = useState('view'); // 'view' | 'edit'
  const [drawerTab, setDrawerTab] = useState('overview');
  const [editForm, setEditForm] = useState(null);    // editable copy (edit mode)
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [uploadForm, setUploadForm] = useState({ invoiceValue: '', fileName: '', fileData: '' });

  // Pre-fill billing details from the record itself and, where blank, the linked lead.
  // Never invents values — unknown fields stay blank.
  const buildEditForm = (p) => {
    const lead = leads.find((l) => l.id === p.leadId);
    const num = (v) => (v === 0 || v ? String(v) : '');
    return {
      ...p,
      clientName: p.clientName || p.customer || '',
      billingName: p.billingName || p.customer || '',
      projectLocation: p.projectLocation || lead?.appointmentLocation || '',
      contactDetails: p.contactDetails || [lead?.phone, lead?.email].filter(Boolean).join(' / '),
      mobileNumber: p.mobileNumber || lead?.phone || '',
      altMobile: p.altMobile || '',
      siteAddress: p.siteAddress || lead?.appointmentLocation || '',
      billingAddress: p.billingAddress || '',
      gstNumber: p.gstNumber || '',
      email: p.email || lead?.email || '',
      salesperson: p.salesperson || p.manager || lead?.manager || '',
      orderValue: num(p.orderValue),
      amountCollected: num(p.amountCollected),
      upcomingDues: num(p.upcomingDues),
      pendingPayments: num(p.pendingPayments),
      overduePayments: num(p.overduePayments),
      invoiceValue: num(p.invoiceValue),
      dueDate: p.dueDate || '',
      method: p.method || '',
      status: deriveStatus(p),
    };
  };

  const openDrawer = (p, mode = 'view') => {
    setDrawer(p);
    setDrawerMode(mode);
    setDrawerTab('overview');
    setNewNote('');
    setUploadForm({ invoiceValue: p.invoiceValue ? String(p.invoiceValue) : '', fileName: p.invoiceFileName || '', fileData: p.invoiceFileData || '' });
    setEditForm(buildEditForm(p));
  };
  const closeDrawer = () => { setDrawer(null); setEditForm(null); setNewNote(''); };

  // Persist a partial update to a record (PUT) and sync both the drawer and the table.
  const patchRecord = async (record, patch, successMsg) => {
    const id = record.id;
    try {
      const res = await fetch(`${PAYMENTS_API}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('update failed');
      const updated = await res.json();
      setPayments((prev) => prev.map((x) => (x.id === id ? updated : x)));
      setDrawer((cur) => (cur && cur.id === id ? updated : cur));
      if (successMsg) addToast(successMsg, 'success');
      return updated;
    } catch (err) {
      console.error('Failed to update payment:', err);
      addToast('Could not save changes. Is the backend running?', 'error');
      return null;
    }
  };

  // Save all editable fields from the drawer's edit form
  const saveDrawerEdits = async () => {
    if (!editForm) return;
    setDrawerSaving(true);
    const payload = {
      customer: (editForm.customer || '').trim(),
      manager: (editForm.manager || '').trim(),
      orderValue: parseAmount(editForm.orderValue),
      amountCollected: parseAmount(editForm.amountCollected),
      upcomingDues: parseAmount(editForm.upcomingDues),
      pendingPayments: parseAmount(editForm.pendingPayments),
      overduePayments: parseAmount(editForm.overduePayments),
      invoiceValue: parseAmount(editForm.invoiceValue),
      dueDate: editForm.dueDate || '',
      method: (editForm.method || '').trim(),
      status: editForm.status || '',
      clientName: (editForm.clientName || '').trim(),
      projectLocation: (editForm.projectLocation || '').trim(),
      contactDetails: (editForm.contactDetails || '').trim(),
      billingName: (editForm.billingName || '').trim(),
      mobileNumber: (editForm.mobileNumber || '').trim(),
      altMobile: (editForm.altMobile || '').trim(),
      siteAddress: (editForm.siteAddress || '').trim(),
      billingAddress: (editForm.billingAddress || '').trim(),
      gstNumber: (editForm.gstNumber || '').trim(),
      email: (editForm.email || '').trim(),
      salesperson: (editForm.salesperson || '').trim(),
    };
    const updated = await patchRecord(drawer, payload, 'Payment updated');
    setDrawerSaving(false);
    if (updated) { setDrawerMode('view'); setEditForm(buildEditForm(updated)); }
  };

  // Notes tab — append a note to the record's notesLog
  const saveNote = async () => {
    const text = newNote.trim();
    if (!text || !drawer) return;
    const entry = { text, timestamp: new Date().toISOString() };
    const notesLog = Array.isArray(drawer.notesLog) ? [...drawer.notesLog, entry] : [entry];
    setDrawerSaving(true);
    const updated = await patchRecord(drawer, { notesLog }, 'Note saved');
    setDrawerSaving(false);
    if (updated) setNewNote('');
  };

  // Upload Invoice tab — store invoiceValue + the file (base64) on the record
  const onInvoiceFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setUploadForm((f) => ({ ...f, fileName: file.name, fileData: reader.result }));
    reader.readAsDataURL(file);
  };
  const submitInvoiceUpload = async () => {
    if (!drawer) return;
    setDrawerSaving(true);
    const patch = {
      invoiceValue: parseAmount(uploadForm.invoiceValue),
      invoiceFileName: uploadForm.fileName || '',
      invoiceFileData: uploadForm.fileData || '',
    };
    await patchRecord(drawer, patch, 'Invoice uploaded');
    setDrawerSaving(false);
  };

  // Footer — Reminder: add a "Payment Reminder Sent" timeline entry dated now
  const sendReminder = async () => {
    if (!drawer) return;
    setDrawerSaving(true);
    await patchRecord(drawer, { reminderSentAt: new Date().toISOString() }, 'Reminder logged');
    setDrawerSaving(false);
  };

  // Footer — Log Payment: open a styled in-app modal (no native prompt)
  const [logPayOpen, setLogPayOpen] = useState(false);
  const [logPayAmount, setLogPayAmount] = useState('');
  const openLogPayment = () => {
    if (!drawer) return;
    setLogPayAmount(String(Number(drawer.amountCollected) || 0));
    setLogPayOpen(true);
  };
  const closeLogPayment = () => { setLogPayOpen(false); setLogPayAmount(''); };
  // Confirm — inline-update amountCollected for this record (same logic as before, minus the prompt)
  const confirmLogPayment = async () => {
    if (!drawer) return;
    const amt = parseAmount(logPayAmount);
    const invoice = Number(drawer.invoiceValue) || Number(drawer.orderValue) || 0;
    const pending = Math.max(0, invoice - amt);
    const patch = {
      amountCollected: amt,
      pendingPayments: pending,
      paymentDate: todayStr(),
      status: invoice > 0 && amt >= invoice ? 'Paid' : amt > 0 ? 'Partial' : 'Pending',
    };
    setDrawerSaving(true);
    await patchRecord(drawer, patch, 'Payment logged');
    setDrawerSaving(false);
    closeLogPayment();
  };

  // Download — dependency-free branded PDF: open a window, write a self-contained
  // styled HTML doc with THIS record's live data, then print (Save as PDF).
  const buildInvoiceHtml = (p) => {
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const status = deriveStatus(p);
    const color = STATUS_COLORS[status] || '#4F46E5';
    const lead = leads.find((l) => l.id === p.leadId);
    const clientName = p.clientName || p.customer || '';
    const billingName = p.billingName || p.customer || '';
    const contact = p.contactDetails || [lead?.phone, lead?.email].filter(Boolean).join(' / ');
    const row = (k, v) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v || '—')}</td></tr>`;
    const money = (v) => formatINR(v);
    const overview = [
      ['Order Value', money(p.orderValue)],
      ['Amount Collected', money(p.amountCollected)],
      ['Upcoming Dues', money(p.upcomingDues)],
      ['Pending Payments', money(p.pendingPayments)],
      ['Overdue Payments', money(p.overduePayments)],
      ['Invoice Value', money(p.invoiceValue)],
      ['Due Date', fmtAny(p.dueDate)],
      ['Payment Method', p.method],
      ['Status', status],
    ].map(([k, v]) => row(k, v)).join('');
    const billing = [
      ['Client Name', clientName],
      ['Project Location', p.projectLocation],
      ['Contact Details', contact],
      ['Billing Name', billingName],
      ['Mobile Number', p.mobileNumber || lead?.phone],
      ['Alternate Mobile', p.altMobile],
      ['Site Address', p.siteAddress || lead?.appointmentLocation],
      ['Billing Address', p.billingAddress],
      ['GST Number', p.gstNumber],
      ['Email / WhatsApp', p.email || lead?.email],
      ['Salesperson', p.salesperson || p.manager],
    ].map(([k, v]) => row(k, v)).join('');
    const style = `<style>
      *{box-sizing:border-box;} body{font-family:Arial,Helvetica,sans-serif;color:#111827;margin:0;padding:32px;background:#fff;}
      .doc{max-width:760px;margin:0 auto;}
      .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #4F46E5;padding-bottom:16px;margin-bottom:8px;}
      .brand{font-size:22px;font-weight:800;color:#4F46E5;} .brand small{display:block;font-size:11px;font-weight:600;color:#6B7280;letter-spacing:1px;}
      .inv{text-align:right;} .inv .no{font-size:18px;font-weight:800;} .inv .lbl{font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:1px;}
      .badge{display:inline-block;margin-top:6px;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;color:#fff;background:${color};}
      .who{margin:14px 0 22px;font-size:13px;color:#374151;} .who b{color:#111827;}
      h2{font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#4F46E5;margin:22px 0 8px;}
      table{width:100%;border-collapse:collapse;} td{padding:9px 12px;font-size:13px;border-bottom:1px solid #E5E7EB;}
      td.k{color:#6B7280;width:45%;} td.v{color:#111827;font-weight:600;text-align:right;}
      .ftr{margin-top:28px;padding-top:14px;border-top:1px solid #E5E7EB;font-size:11px;color:#9CA3AF;text-align:center;}
      @media print{body{padding:0;}}
    </style>`;
    const inner = `<div class="doc">
      <div class="head">
        <div class="brand">Tesco Structures<small>PAYMENT COLLECTION</small></div>
        <div class="inv"><div class="lbl">Invoice</div><div class="no">${esc(p.id || '')}</div><span class="badge">${esc(status)}</span></div>
      </div>
      <div class="who"><b>${esc(billingName || clientName || '—')}</b>${clientName && clientName !== billingName ? ' · ' + esc(clientName) : ''}${contact ? '<br>' + esc(contact) : ''}</div>
      <h2>Payment Overview</h2>
      <table>${overview}</table>
      <h2>Billing Details</h2>
      <table>${billing}</table>
      <div class="ftr">www.tescostructures.com &nbsp;|&nbsp; +91 90033 28229 &nbsp;|&nbsp; Generated ${esc(fmtAny(new Date().toISOString()))}</div>
    </div>`;
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(p.id || 'Invoice')} - Tesco Structures</title>${style}</head><body>${inner}<scr` + `ipt>setTimeout(function(){window.print();},400);</scr` + `ipt></body></html>`;
  };

  const downloadRecord = (p) => {
    const win = window.open('', '_blank');
    if (!win) { addToast('Please allow pop-ups to download the invoice.', 'warning'); return; }
    win.document.write(buildInvoiceHtml(p));
    win.document.close();
  };

  // ── Delete a payment (persists to Mongo) ──
  const handleDelete = async (p) => {
    if (!window.confirm(`Delete payment ${p.id || ''}${p.customer ? ` for ${p.customer}` : ''}? This cannot be undone.`)) return;
    setPayments((prev) => prev.filter((x) => (x._id || x.id) !== (p._id || p.id)));
    try {
      const res = await fetch(`${PAYMENTS_API}/${p.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      addToast('Payment deleted', 'success');
    } catch (err) {
      console.error('Failed to delete payment:', err);
      addToast('Could not delete payment', 'error');
      loadPayments();
    }
  };

  const th = { padding: '0.9rem 1.25rem', fontWeight: '600', fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', textAlign: 'left' };
  const td = { padding: '1.1rem 1.25rem', fontSize: '0.9rem', whiteSpace: 'nowrap', verticalAlign: 'middle' };
  const today = todayStr();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Pages / Payment Collection</div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '800', color: 'var(--text-main)' }}>Payment Collection</h1>
        </div>
        <button
          onClick={openModal}
          className="btn"
          style={{
            backgroundColor: 'var(--secondary-color)', color: 'white', gap: '0.5rem',
            padding: '0.8rem 1.4rem', fontSize: '0.95rem', fontWeight: '600',
            borderRadius: 'var(--radius-lg)', boxShadow: '0 6px 16px rgba(79,70,229,0.35)',
          }}
        >
          <Plus size={18} /> Record Payment
        </button>
      </div>

      {/* Top filters */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <Calendar size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--secondary-color)', pointerEvents: 'none' }} />
          <select value={rangeKey} onChange={(e) => setRangeKey(e.target.value)} style={{ ...selectStyle, paddingLeft: '2.9rem', fontWeight: '600', boxShadow: 'var(--shadow-sm)', borderRadius: 'var(--radius-lg)' }}>
            {RANGE_OPTIONS.map((o) => {
              const s = rangeStart(o.days);
              const text = o.days ? `${o.label} (${fmtDate(s)} - ${fmtDate(new Date())})` : 'All Time';
              return <option key={o.key} value={o.key}>{text}</option>;
            })}
          </select>
          <ChevronDown size={16} style={{ position: 'absolute', right: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        </div>
        <div style={{ position: 'relative' }}>
          <select value={manager} onChange={(e) => setManager(e.target.value)} style={{ ...selectStyle, fontWeight: '600', boxShadow: 'var(--shadow-sm)', borderRadius: 'var(--radius-lg)' }}>
            <option value="all">All Managers</option>
            {managers.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <ChevronDown size={16} style={{ position: 'absolute', right: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
        <KpiCard value={formatCompact(kpis.collected)} title="Total Collected" icon={CheckCircle} color="#22C55E" />
        <KpiCard value={formatCompact(kpis.upcoming)} title="Upcoming Dues" icon={Clock} color="#3B82F6" />
        <KpiCard value={formatCompact(kpis.pending)} title="Pending Payments" icon={AlertCircle} color="#F59E0B" />
        <KpiCard value={formatCompact(kpis.overdue)} title="Overdue Payments" icon={XCircle} color="#EF4444" />
      </div>

      {/* Table card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* In-table filters */}
        <div style={{ display: 'flex', gap: '1rem', padding: '1.5rem', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
              <option value="all">Filter by Status</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown size={16} style={{ position: 'absolute', right: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          </div>
          <input type="date" value={dueDateFilter} onChange={(e) => setDueDateFilter(e.target.value)} style={{ ...inputStyle, width: 'auto' }} />
          {(statusFilter !== 'all' || dueDateFilter) && (
            <button className="btn btn-outline" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }} onClick={() => { setStatusFilter('all'); setDueDateFilter(''); }}>Clear</button>
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1100px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={th}>Lead id</th>
                <th style={th}>Customer</th>
                <th style={th}>Order value</th>
                <th style={th}>Amount collect</th>
                <th style={th}>Pending payments</th>
                <th style={th}>Upcoming dues</th>
                <th style={th}>Overdue payments</th>
                <th style={th}>Invoice value</th>
                <th style={th}>Method</th>
                <th style={th}>Due date</th>
                <th style={{ ...th, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loaded && filtered.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {payments.length === 0
                      ? 'No payments yet. Click “Record Payment” to add one.'
                      : 'No invoices match the selected filters.'}
                  </td>
                </tr>
              )}
              {pageRows.map((p, i) => {
                const overdue = p.dueDate && p.dueDate < today;
                return (
                  <tr key={p._id || p.id || i} style={{ borderBottom: i === pageRows.length - 1 ? 'none' : '1px solid var(--border-color)' }}>
                    <td style={{ ...td, fontWeight: '600' }}>
                      {p.leadId || '—'}
                      {p.id && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>{p.id}</div>}
                    </td>
                    <td style={{ ...td, fontWeight: '700' }}>{p.customer || '—'}</td>
                    <td style={{ ...td, fontWeight: '600' }}>{formatINR(p.orderValue)}</td>
                    <td style={{ ...td, fontWeight: '700', color: '#16A34A' }}>{formatINR(p.amountCollected)}</td>
                    <td style={{ ...td, color: 'var(--text-muted)' }}>{formatINR(p.pendingPayments)}</td>
                    <td style={{ ...td, color: 'var(--text-muted)' }}>{formatINR(p.upcomingDues)}</td>
                    <td style={{ ...td, color: 'var(--text-muted)' }}>{formatINR(p.overduePayments)}</td>
                    <td style={{ ...td, color: 'var(--text-muted)' }}>{formatINR(p.invoiceValue)}</td>
                    <td style={{ ...td, color: 'var(--text-main)' }}>{p.method || '—'}</td>
                    <td style={td}>
                      <input
                        type="date"
                        value={p.dueDate || ''}
                        onChange={(e) => handleDueDateChange(p, e.target.value)}
                        style={{
                          padding: '0.5rem 0.6rem', borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-color)', fontSize: '0.85rem', outline: 'none',
                          color: overdue ? '#DC2626' : 'var(--text-main)', fontWeight: overdue ? '700' : '500',
                          backgroundColor: 'var(--surface-color)', cursor: 'pointer',
                        }}
                      />
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => openDrawer(p, 'view')}
                          title="View payment"
                          style={{ background: 'transparent', border: 'none', color: 'var(--secondary-color)', cursor: 'pointer', display: 'inline-flex' }}
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openDrawer(p, 'edit')}
                          title="Edit payment"
                          style={{ background: 'transparent', border: 'none', color: '#2563EB', cursor: 'pointer', display: 'inline-flex' }}
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadRecord(p)}
                          title="Download invoice PDF"
                          style={{ background: 'transparent', border: 'none', color: '#0891B2', cursor: 'pointer', display: 'inline-flex' }}
                        >
                          <Download size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p)}
                          title="Delete payment"
                          style={{ background: 'transparent', border: 'none', color: '#DC2626', cursor: 'pointer', display: 'inline-flex' }}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '1rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Showing {pageStart + 1} to {Math.min(pageStart + PER_PAGE, filtered.length)} of {filtered.length} invoices
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="btn btn-outline"
                style={{ padding: '0.4rem 0.8rem', opacity: safePage === 1 ? 0.5 : 1, cursor: safePage === 1 ? 'not-allowed' : 'pointer' }}
              >‹</button>
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className="btn"
                  style={{
                    padding: '0.4rem 0.85rem', minWidth: '38px',
                    backgroundColor: n === safePage ? 'var(--primary-color)' : 'transparent',
                    color: n === safePage ? 'white' : 'var(--text-main)',
                    border: n === safePage ? 'none' : '1px solid var(--border-color)',
                    fontWeight: '600',
                  }}
                >{n}</button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="btn btn-outline"
                style={{ padding: '0.4rem 0.8rem', opacity: safePage === totalPages ? 0.5 : 1, cursor: safePage === totalPages ? 'not-allowed' : 'pointer' }}
              >›</button>
            </div>
          </div>
        )}
      </div>

      {/* Record Payment modal */}
      {modalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', overflowY: 'auto' }}>
          <div className="card" style={{ width: '100%', maxWidth: '680px', padding: '2rem', borderRadius: '1rem', margin: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700', color: 'var(--text-main)' }}>Record Payment</h3>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={22} /></button>
            </div>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.1rem' }}>
                <div>
                  <label style={labelStyle}>Lead ID</label>
                  <div style={{ position: 'relative' }}>
                    <select required value={form.leadId} onChange={(e) => onLeadSelect(e.target.value)} style={{ ...selectStyle, width: '100%', fontWeight: '500' }}>
                      <option value="">Select Lead ID</option>
                      {eligibleLeads.map((l) => (
                        <option key={l.id} value={l.id}>{l.name ? `${l.id} — ${l.name}` : l.id}</option>
                      ))}
                      {eligibleLeads.length === 0 && <option value="" disabled>No order-confirmed leads awaiting payment</option>}
                    </select>
                    <ChevronDown size={16} style={{ position: 'absolute', right: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Invoice ID</label>
                  <input required value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} type="text" placeholder="e.g. INV-1024" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Customer</label>
                <input required value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} type="text" placeholder="e.g. Akash Kumar" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.1rem' }}>
                <div>
                  <label style={labelStyle}>Order value (₹)</label>
                  <input value={form.orderValue} onChange={(e) => setForm({ ...form, orderValue: e.target.value })} type="text" inputMode="numeric" placeholder="e.g. 425000" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Invoice value (₹)</label>
                  <input value={form.invoiceValue} onChange={(e) => setForm({ ...form, invoiceValue: e.target.value })} type="text" inputMode="numeric" placeholder="e.g. 425000" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.1rem' }}>
                <div>
                  <label style={labelStyle}>Amount collected (₹)</label>
                  <input value={form.amountCollected} onChange={(e) => setForm({ ...form, amountCollected: e.target.value })} type="text" inputMode="numeric" placeholder="e.g. 425000" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Pending payments (₹)</label>
                  <input value={form.pendingPayments} onChange={(e) => setForm({ ...form, pendingPayments: e.target.value })} type="text" inputMode="numeric" placeholder="e.g. 0" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.1rem' }}>
                <div>
                  <label style={labelStyle}>Upcoming dues (₹)</label>
                  <input value={form.upcomingDues} onChange={(e) => setForm({ ...form, upcomingDues: e.target.value })} type="text" inputMode="numeric" placeholder="e.g. 0" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Overdue payments (₹)</label>
                  <input value={form.overduePayments} onChange={(e) => setForm({ ...form, overduePayments: e.target.value })} type="text" inputMode="numeric" placeholder="e.g. 0" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.1rem' }}>
                <div>
                  <label style={labelStyle}>Payment Method</label>
                  <div style={{ position: 'relative' }}>
                    <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} style={{ ...selectStyle, width: '100%', fontWeight: '500' }}>
                      <option value="">Select Method</option>
                      {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <ChevronDown size={16} style={{ position: 'absolute', right: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Transaction ID / Cheque No.</label>
                  <input value={form.transactionId} onChange={(e) => setForm({ ...form, transactionId: e.target.value })} type="text" placeholder="e.g. TXN123456 / CHQ-0012" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.1rem' }}>
                <div>
                  <label style={labelStyle}>Payment Date</label>
                  <input value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} type="date" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Due date</label>
                  <input value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} type="date" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.1rem' }}>
                <div>
                  <label style={labelStyle}>Manager</label>
                  <div style={{ position: 'relative' }}>
                    <select value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })} style={{ ...selectStyle, width: '100%', fontWeight: '500' }}>
                      <option value="">Select Manager</option>
                      {managerOptions.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <ChevronDown size={16} style={{ position: 'absolute', right: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  </div>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Payment Notes &amp; Remarks</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any notes or remarks about this payment" style={{ ...inputStyle, minHeight: '90px', resize: 'vertical', fontFamily: 'inherit' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={closeModal} className="btn btn-outline" style={{ padding: '0.6rem 1.4rem' }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving || !form.id || !form.customer} style={{ padding: '0.6rem 1.6rem', opacity: (saving || !form.id || !form.customer) ? 0.5 : 1 }}>
                  {saving ? 'Saving…' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Collection detail drawer (View / Edit) */}
      {drawer && (
        <PaymentDrawer
          record={drawer}
          mode={drawerMode}
          setMode={setDrawerMode}
          tab={drawerTab}
          setTab={setDrawerTab}
          editForm={editForm}
          setEditForm={setEditForm}
          rebuildEditForm={() => buildEditForm(drawer)}
          saving={drawerSaving}
          onClose={closeDrawer}
          onSaveEdits={saveDrawerEdits}
          newNote={newNote}
          setNewNote={setNewNote}
          onSaveNote={saveNote}
          uploadForm={uploadForm}
          setUploadForm={setUploadForm}
          onInvoiceFile={onInvoiceFile}
          onSubmitUpload={submitInvoiceUpload}
          onSendReminder={sendReminder}
          onLogPayment={openLogPayment}
          onDownload={() => downloadRecord(drawer)}
          leads={leads}
          managerOptions={managerOptions}
        />
      )}

      {/* Log Payment modal (styled like Record Payment — replaces the native prompt) */}
      {logPayOpen && drawer && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', overflowY: 'auto' }}>
          <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '2rem', borderRadius: '1rem', margin: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700', color: 'var(--text-main)' }}>Log Payment</h3>
              <button onClick={closeLogPayment} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={22} /></button>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Invoice <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>{drawer.id || '—'}</span>
              {drawer.customer ? <> · {drawer.customer}</> : null}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); confirmLogPayment(); }} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div>
                <label style={labelStyle}>Amount Collected (₹)</label>
                <input
                  autoFocus
                  type="text"
                  inputMode="numeric"
                  value={logPayAmount}
                  onChange={(e) => setLogPayAmount(e.target.value)}
                  placeholder="e.g. 425000"
                  style={inputStyle}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.25rem' }}>
                <button type="button" onClick={closeLogPayment} className="btn btn-outline" style={{ padding: '0.6rem 1.4rem' }}>Cancel</button>
                <button type="submit" className="btn" disabled={drawerSaving} style={{ padding: '0.6rem 1.6rem', backgroundColor: '#16A34A', color: '#fff', border: 'none', opacity: drawerSaving ? 0.6 : 1 }}>
                  {drawerSaving ? 'Saving…' : 'Log Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payments;
