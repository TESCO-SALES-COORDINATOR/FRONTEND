import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Calendar, ChevronDown } from 'lucide-react';
import { useToast } from '../components/Toast';
import HandoverForm from '../components/HandoverForm';

const PROJECTS_API = 'http://localhost:5000/api/projects';
const LEADS_API = 'http://localhost:5000/api/leads';

// ── Money helpers ──────────────────────────────────────────────
const parseAmount = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const n = parseFloat(String(val).replace(/[^0-9.]/g, ''));
  return Number.isNaN(n) ? 0 : n;
};
// Indian grouping: 450000 -> ₹4,50,000
const formatINR = (n) => '₹' + Math.round(parseAmount(n)).toLocaleString('en-IN');

// ── Date helpers (all derived from "now", nothing hardcoded) ────
const fmtDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

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

// Normalise a raw project record onto the columns the table renders,
// tolerating older records that only carried `quote`/`team`.
const normalise = (p) => ({
  ...p,
  _id: p._id,
  id: p.id || '',
  client: p.client || '—',
  type: p.type || '—',
  location: p.location || '—',
  salesperson: p.salesperson || p.team || '—',
  valueNum: p.value != null ? Number(p.value) : parseAmount(p.quote),
  createdAt: p.createdAt ? new Date(p.createdAt) : null,
});

const inputStyle = {
  width: '100%', padding: '0.7rem 0.85rem', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-color)', outline: 'none', fontSize: '0.9rem',
  backgroundColor: 'var(--surface-color)', color: 'var(--text-main)',
};
const labelStyle = {
  display: 'block', fontSize: '0.9rem', fontWeight: '600',
  marginBottom: '0.5rem', color: 'var(--text-main)',
};

const emptyForm = { id: '', client: '', type: '', location: '', salesperson: '', value: '' };

const ProjectFiling = () => {
  const addToast = useToast();
  const [projects, setProjects] = useState([]);
  const [leads, setLeads] = useState([]);
  const [quotes, setQuotes] = useState([]); // quotations — used to gate the Order Confirm lead picker
  const [loaded, setLoaded] = useState(false);

  const [rangeKey, setRangeKey] = useState('all');       // default: All Time, so no handover (incl. manager-created) is hidden by a date window
  const [manager, setManager] = useState('all');

  const [view, setView] = useState('list');        // 'list' | 'form'
  const [editingRecord, setEditingRecord] = useState(null); // full record when editing (null => creating)

  // ── Load live projects (no hardcoded/seed rows) ──
  const loadProjects = async () => {
    try {
      const res = await fetch(PROJECTS_API);
      const data = await res.json();
      if (Array.isArray(data)) setProjects(data.map(normalise));
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    loadProjects();
    // Poll so an Order Confirm a manager files shows up here without a manual refresh
    const iv = setInterval(loadProjects, 15000);
    return () => clearInterval(iv);
  }, []);

  // Load leads so the handover form can offer a Lead ID dropdown + autofill
  useEffect(() => {
    fetch(LEADS_API)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setLeads(d); })
      .catch((e) => console.error('Failed to load leads:', e));
  }, []);

  // Load quotations (and keep them fresh) so Order Confirm only offers leads whose
  // quotation is APPROVED — strict lifecycle: Quotation Approval → Order Confirmation.
  useEffect(() => {
    const loadQuotes = () => fetch('http://localhost:5000/api/quotations')
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setQuotes(d); })
      .catch(() => {});
    loadQuotes();
    const iv = setInterval(loadQuotes, 15000);
    return () => clearInterval(iv);
  }, []);

  // ── Lifecycle gating for the Order Confirm lead picker ──
  //   • eligible = lead has an APPROVED quotation AND has not been order-confirmed yet.
  const leadHasApprovedQuote = (leadId) => quotes.some((q) => q.leadId === leadId && String(q.approvalStatus || '') === 'Approved');
  const leadHasOrder = (leadId) => projects.some((p) => (p.leadId || p.id) === leadId);
  const eligibleLeads = leads.filter((l) => leadHasApprovedQuote(l.id) && !leadHasOrder(l.id));

  // Resolve the ORIGINAL Lead ID (LD-xxxx) for a handover row: prefer the stored leadId,
  // otherwise match the linked lead by customer name; fall back to the File ID only if
  // nothing matches. Keeps the Lead id column consistent with the Manager app.
  const resolveLeadId = (p) => {
    if (p.leadId) return p.leadId;
    const nm = String(p.client || '').trim().toLowerCase();
    const byName = nm ? leads.find((l) => String(l.name || '').trim().toLowerCase() === nm) : null;
    return byName ? byName.id : p.id;
  };

  // ── Derived: unique salespersons for the manager filter ──
  const managers = useMemo(() => {
    const set = new Set();
    projects.forEach((p) => { if (p.salesperson && p.salesperson !== '—') set.add(p.salesperson); });
    return Array.from(set).sort();
  }, [projects]);

  // ── Derived: rows after date + manager filters ──
  const start = rangeStart(RANGE_OPTIONS.find((o) => o.key === rangeKey)?.days);
  const rangeLabel = (() => {
    const opt = RANGE_OPTIONS.find((o) => o.key === rangeKey);
    if (!opt.days) return 'All Time';
    return `${opt.label} (${fmtDate(start)} - ${fmtDate(new Date())})`;
  })();

  const rows = useMemo(() => {
    return projects.filter((p) => {
      if (start && p.createdAt && p.createdAt < start) return false;
      if (manager !== 'all' && p.salesperson !== manager) return false;
      return true;
    });
  }, [projects, start, manager]);

  // ── Open the full Sales-to-Project Handover form (New Project File) ──
  const openCreate = () => { setEditingRecord(null); setView('form'); };
  const openEdit = (p) => { setEditingRecord(p); setView('form'); };
  const backToList = () => { setView('list'); setEditingRecord(null); };
  const onSaved = async () => { await loadProjects(); backToList(); };

  // When creating/editing, show the full multi-section handover form (matches the Sales Manager design)
  if (view === 'form') {
    return (
      <HandoverForm
        record={editingRecord}
        leads={editingRecord ? leads : eligibleLeads}
        isDuplicateLead={(id) => leadHasOrder(id)}
        onCancel={backToList}
        onSaved={onSaved}
      />
    );
  }

  const th = {
    padding: '0.9rem 1.5rem', fontWeight: '600', fontSize: '0.8rem',
    color: 'var(--text-muted)', textTransform: 'none', whiteSpace: 'nowrap',
  };
  const td = { padding: '1.1rem 1.5rem', fontSize: '0.9rem', verticalAlign: 'middle' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '800', color: 'var(--text-main)' }}>Order Confirm</h1>
          <p style={{ margin: '0.4rem 0 0', color: 'var(--text-muted)', fontSize: '1rem' }}>
            Manage all sales to project handovers.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="btn"
          style={{
            backgroundColor: 'var(--secondary-color)', color: 'white', gap: '0.5rem',
            padding: '0.8rem 1.4rem', fontSize: '0.95rem', fontWeight: '600',
            borderRadius: 'var(--radius-lg)', boxShadow: '0 6px 16px rgba(79,70,229,0.35)',
          }}
        >
          <Plus size={18} /> New Handover Form
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <Calendar size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--secondary-color)', pointerEvents: 'none' }} />
          <select
            value={rangeKey}
            onChange={(e) => setRangeKey(e.target.value)}
            style={{
              appearance: 'none', WebkitAppearance: 'none',
              padding: '0.85rem 2.5rem 0.85rem 2.9rem',
              borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)',
              backgroundColor: 'var(--surface-color)', color: 'var(--text-main)',
              fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', outline: 'none',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {RANGE_OPTIONS.map((o) => {
              const s = rangeStart(o.days);
              const text = o.days ? `${o.label} (${fmtDate(s)} - ${fmtDate(new Date())})` : 'All Time';
              return <option key={o.key} value={o.key}>{text}</option>;
            })}
          </select>
          <ChevronDown size={16} style={{ position: 'absolute', right: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        </div>

        <div style={{ position: 'relative' }}>
          <select
            value={manager}
            onChange={(e) => setManager(e.target.value)}
            style={{
              appearance: 'none', WebkitAppearance: 'none',
              padding: '0.85rem 2.5rem 0.85rem 1.1rem',
              borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)',
              backgroundColor: 'var(--surface-color)', color: 'var(--text-main)',
              fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', outline: 'none',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <option value="all">All Managers</option>
            {managers.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <ChevronDown size={16} style={{ position: 'absolute', right: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '860px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={th}>Lead id</th>
                <th style={th}>Client name</th>
                <th style={th}>Project type</th>
                <th style={th}>Location</th>
                <th style={th}>Salesperson</th>
                <th style={th}>Value</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loaded && rows.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {projects.length === 0
                      ? 'No handovers yet. Click “New Handover Form” to add one.'
                      : 'No handovers match the selected filters.'}
                  </td>
                </tr>
              )}
              {rows.map((p, i) => (
                <tr
                  key={p._id || p.id || i}
                  style={{ borderBottom: i === rows.length - 1 ? 'none' : '1px solid var(--border-color)' }}
                >
                  <td style={{ ...td, fontWeight: '600', color: 'var(--text-main)' }} title={p.id}>{resolveLeadId(p)}</td>
                  <td style={{ ...td, fontWeight: '700' }}>{p.client}</td>
                  <td style={{ ...td, color: 'var(--text-muted)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.type}>{p.type}</td>
                  <td style={{ ...td, color: 'var(--text-muted)' }}>{p.location}</td>
                  <td style={{ ...td, color: 'var(--text-muted)' }}>{p.salesperson}</td>
                  <td style={{ ...td, fontWeight: '700', color: '#16A34A' }}>{p.valueNum ? formatINR(p.valueNum) : '—'}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button
                      onClick={() => openEdit(p)}
                      title="Edit handover"
                      style={{
                        width: '34px', height: '34px', borderRadius: '50%',
                        border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)',
                        color: 'var(--text-muted)', cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--secondary-color)'; e.currentTarget.style.borderColor = 'var(--secondary-color)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                    >
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProjectFiling;
