import React, { useState, useMemo, useEffect } from 'react';
import { Filter, Flame, Activity, Snowflake, XCircle, Eye, Pencil, Trash2, X } from 'lucide-react';
import { stageColor } from '../theme/statusColors';

// Pipeline stage options (the fixed set a deal can move through)
const STAGES = ['New', 'Hot', 'Warm', 'Cold', 'Appointment Fixed', 'Lost'];

// How many rows to show per page
const ROWS_PER_PAGE = 10;

// Delegate to the shared canonical palette so pipeline stages match statuses everywhere.
const getStageStyles = (stage) => stageColor(stage);

// Rupee grouping used across the app (e.g. 850000 -> ₹8,50,000)
const formatINR = (num) => '₹' + Number(num || 0).toLocaleString('en-IN');

// Backend endpoints. Pipeline stage / follow-up edits are stored in MongoDB (the SAME
// `pipelines` collection the Sales Manager app uses) — no localStorage, no hardcoded data.
// Rows are still derived from EVERY valued lead; the stored docs only carry user edits.
const LEADS_API = 'http://localhost:5000/api/leads';
const PIPELINE_API = 'http://localhost:5000/api/pipeline';

// The fields persisted for one opportunity (matches the Pipeline schema on the server).
const toPayload = (row) => ({
  id: row.id,
  leadId: row.leadId || '',
  customer: row.customer || '',
  company: row.company || '',
  service: row.service || '',
  stage: row.stage || 'New',
  assignedTo: row.assignedTo || '',
  expectedClose: row.expectedClose || '',
  value: Number(row.value) || 0,
  lastActivity: row.lastActivity || 'Today',
  followUp: row.followUp || '',
});

// Parse any project-value representation (₹35,00,000 / "100k" / 100) into a plain number.
const parseVal = (v) => parseFloat(String(v == null ? '' : v).replace(/[^\d.]/g, '')) || 0;

// Map a lead's status onto one of the fixed pipeline stages.
const toStage = (status) => {
  const s = String(status || '').toLowerCase();
  if (s.includes('hot')) return 'Hot';
  if (s.includes('warm') || s.includes('quotation')) return 'Warm';
  if (s.includes('lost')) return 'Lost';
  if (s.includes('cold') || s.includes('junk')) return 'Cold';
  if (s.includes('appoint')) return 'Appointment Fixed';
  return 'New';
};

const fmtExpected = (d) => {
  if (!d || d === 'Pending' || d === 'No Date') return '-';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '-' : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const toDateInput = (d) => {
  if (!d || d === 'Pending' || d === 'No Date') return '';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '' : dt.toISOString().split('T')[0];
};

// Build a pipeline opportunity from a live lead.
const deriveFromLead = (l, val) => ({
  id: `OP-${String(l.id || '').replace(/\D/g, '') || l.id}`,
  leadId: l.id,
  customer: l.name || l.customer || '—',
  service: l.projectType || l.services || l.service || '-',
  stage: toStage(l.status),
  assignedTo: l.manager || 'Unassigned',
  expectedClose: fmtExpected(l.followUp),
  value: val,
  lastActivity: 'Today',
  followUp: toDateInput(l.followUp),
});

const selectArrowBg = `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2364748B%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`;

// Tinted overview card (label top-left, icon top-right, value, subtitle)
const PipelineStatCard = ({ title, value, subtitle, icon: Icon, color, bg, borderColor }) => (
  <div style={{
    padding: '1.25rem 1.5rem',
    backgroundColor: bg,
    border: `1px solid ${borderColor}`,
    borderRadius: 'var(--radius-lg)',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '150px',
    justifyContent: 'space-between'
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '0.95rem', fontWeight: '500', color: 'var(--text-main)' }}>{title}</span>
      <Icon size={20} color={color} strokeWidth={2} />
    </div>
    <div style={{ fontSize: '2.25rem', fontWeight: '700', color: 'var(--text-main)', lineHeight: 1, letterSpacing: '-1px', margin: '0.75rem 0 0.5rem' }}>{value}</div>
    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{subtitle}</span>
  </div>
);

const filterSelectStyle = {
  padding: '0.6rem 2rem 0.6rem 0.9rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-color)',
  backgroundColor: 'var(--surface-color)',
  outline: 'none',
  fontSize: '0.875rem',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  appearance: 'none',
  WebkitAppearance: 'none',
  backgroundImage: selectArrowBg,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 0.75rem center',
  backgroundSize: '0.55rem auto',
  fontFamily: 'inherit',
  minWidth: '190px'
};

const actionBtnStyle = (bg, color) => ({
  width: '32px', height: '32px', borderRadius: 'var(--radius-md)', border: 'none',
  backgroundColor: bg, color, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
});

const SalesPipeline = () => {
  const [extras, setExtras] = useState([]); // stage/follow-up edits, loaded from MongoDB (/api/pipeline)
  const [leads, setLeads] = useState([]);   // live leads from the backend
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('All');
  const [execFilter, setExecFilter] = useState('All');
  const [serviceFilter, setServiceFilter] = useState('All');
  const [managerFilter, setManagerFilter] = useState('All');
  const [sortValueDir, setSortValueDir] = useState(null); // null | 'asc' | 'desc'
  const [activePage, setActivePage] = useState(1);

  // Action modals
  const [viewOp, setViewOp] = useState(null);      // opportunity being viewed
  const [editOp, setEditOp] = useState(null);      // working copy being edited
  const [deleteOp, setDeleteOp] = useState(null);  // opportunity pending delete

  // Pull leads AND the stored pipeline opportunities from the backend, and poll so edits
  // made on the Manager side (shared collection) show up here without a manual refresh.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch(LEADS_API).then((r) => r.json()).then((d) => { if (!cancelled && Array.isArray(d)) setLeads(d); }).catch(() => {});
      fetch(PIPELINE_API).then((r) => r.json()).then((d) => { if (!cancelled && Array.isArray(d)) setExtras(d); }).catch(() => {});
    };
    load();
    const t = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // Merge: derive an opportunity from every valued lead, then overlay stored edits
  // (stage / follow-up) and legacy seed rows. Deduped by lead id.
  const pipeline = useMemo(() => {
    const byLead = new Map();
    leads.forEach((l) => {
      const val = parseVal(l.budget != null ? l.budget : l.value);
      if (val <= 0) return;
      if (String(l.status || '').toLowerCase() === 'junk') return;
      byLead.set(l.id, deriveFromLead(l, val));
    });
    extras.forEach((e) => {
      const key = e.leadId || e.id;
      const base = byLead.get(key);
      if (base) {
        // Live lead drives customer/value/service; the stored extra keeps the user's
        // stage & follow-up edits.
        byLead.set(key, {
          ...base,
          stage: e.stage || base.stage,
          followUp: (e.followUp !== undefined && e.followUp !== '') ? e.followUp : base.followUp,
          expectedClose: (e.expectedClose && e.expectedClose !== '-') ? e.expectedClose : base.expectedClose,
        });
      } else {
        // Legacy / seed opportunity with no matching live lead — keep it as-is.
        byLead.set(key, e);
      }
    });
    return Array.from(byLead.values());
  }, [leads, extras]);

  // Persist derived opportunities to MongoDB once leads are loaded, so ALL pipeline rows live
  // in the DB (not only the ones a stage/follow-up was edited on). Idempotent upsert by id.
  const persistedRef = React.useRef(false);
  useEffect(() => {
    if (persistedRef.current || leads.length === 0) return;
    const extraIds = new Set(extras.map((e) => e.id));
    const extraLeadIds = new Set(extras.map((e) => e.leadId).filter(Boolean));
    const toPersist = [];
    leads.forEach((l) => {
      const val = parseVal(l.budget != null ? l.budget : l.value);
      if (val <= 0 || String(l.status || '').toLowerCase() === 'junk') return;
      const op = deriveFromLead(l, val);
      if (extraIds.has(op.id) || (op.leadId && extraLeadIds.has(op.leadId))) return;
      toPersist.push(toPayload(op));
    });
    persistedRef.current = true;
    if (toPersist.length === 0) return;
    fetch(`${PIPELINE_API}/bulk`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(toPersist) })
      .then(() => fetch(PIPELINE_API).then((r) => r.json()).then((d) => { if (Array.isArray(d)) setExtras(d); }))
      .catch((e) => console.error('Failed to persist pipeline opportunities:', e));
  }, [leads, extras]);

  // Persist a stage / follow-up edit to MongoDB (upsert by opportunity id) and mirror it
  // into local state so the change shows immediately.
  const upsertExtra = (row, patch) => {
    const payload = toPayload({ ...row, ...patch });
    setExtras((prev) => {
      const idx = prev.findIndex((e) => e.id === payload.id);
      return idx >= 0 ? prev.map((e, i) => (i === idx ? { ...e, ...payload } : e)) : [payload, ...prev];
    });
    fetch(`${PIPELINE_API}/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([payload]),
    }).catch((e) => console.error('Failed to save pipeline edit:', e));
  };

  const updateStage = (row, newStage) => upsertExtra(row, { stage: newStage });

  const updateFollowUp = (row, date) => upsertExtra(row, { followUp: date });

  const deleteRow = (row) => {
    setExtras((prev) => prev.filter((e) => e.id !== row.id));
    if (row.id) fetch(`${PIPELINE_API}/${row.id}`, { method: 'DELETE' }).catch((e) => console.error('Failed to delete pipeline row:', e));
  };

  // Show the REAL lead id in the Lead ID column. Derived rows already carry it; legacy/seed
  // opportunities without a leadId are matched to a live lead by customer name.
  const resolveLeadId = (op) => {
    if (op.leadId) return op.leadId;
    const nm = String(op.customer || '').trim().toLowerCase();
    const byName = nm ? leads.find((l) => String(l.name || '').trim().toLowerCase() === nm) : null;
    return byName ? byName.id : op.id;
  };

  // Filter options are derived from the real leads, not a fixed list
  const managers = useMemo(
    () => Array.from(new Set(pipeline.map((op) => op.assignedTo).filter(Boolean))).sort(),
    [pipeline]
  );
  const services = useMemo(
    () => Array.from(new Set(pipeline.map((op) => op.service).filter((s) => s && s !== '-'))).sort(),
    [pipeline]
  );

  // Save the currently-edited opportunity back to the pipeline
  const saveEdit = () => {
    if (!editOp) return;
    const numValue = parseFloat(String(editOp.value).replace(/[^\d.]/g, '')) || 0;
    upsertExtra(editOp, { ...editOp, value: numValue });
    setEditOp(null);
  };

  // Confirmed delete from the popup
  const confirmDelete = () => {
    if (!deleteOp) return;
    deleteRow(deleteOp);
    setDeleteOp(null);
  };

  const editField = (key, val) => setEditOp((o) => ({ ...o, [key]: val }));

  const resetFilters = () => {
    setSearchQuery('');
    setStageFilter('All');
    setExecFilter('All');
    setServiceFilter('All');
    setManagerFilter('All');
    setSortValueDir(null);
  };

  const toggleValueSort = () =>
    setSortValueDir((d) => (d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc'));

  const filtered = useMemo(() => {
    let rows = pipeline.filter((op) => {
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const customer = (op.customer || '').toLowerCase();
        const id = (op.id || '').toLowerCase();
        if (!(customer.includes(q) || id.includes(q))) return false;
      }
      if (stageFilter !== 'All' && op.stage !== stageFilter) return false;
      if (execFilter !== 'All' && op.assignedTo !== execFilter) return false;
      if (serviceFilter !== 'All' && op.service !== serviceFilter) return false;
      if (managerFilter !== 'All' && op.assignedTo !== managerFilter) return false;
      return true;
    });
    if (sortValueDir) rows = [...rows].sort((a, b) => (sortValueDir === 'asc' ? a.value - b.value : b.value - a.value));
    return rows;
  }, [pipeline, searchQuery, stageFilter, execFilter, serviceFilter, managerFilter, sortValueDir]);

  // Pagination derived from the real filtered results
  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  useEffect(() => { if (activePage > totalPages) setActivePage(1); }, [activePage, totalPages]);
  const pageStart = (activePage - 1) * ROWS_PER_PAGE;
  const pageRows = filtered.slice(pageStart, pageStart + ROWS_PER_PAGE);
  const showingFrom = filtered.length === 0 ? 0 : pageStart + 1;
  const showingTo = Math.min(pageStart + ROWS_PER_PAGE, filtered.length);

  // Stat cards summarise the deals (respecting the manager filter)
  const scoped = managerFilter === 'All' ? pipeline : pipeline.filter((op) => op.assignedTo === managerFilter);
  const countStage = (s) => scoped.filter((op) => (op.stage || '').toLowerCase() === s).length;
  // Total project value of all opportunities in a stage (for the Hot/Warm/Cold cards)
  const sumStage = (s) => scoped.filter((op) => (op.stage || '').toLowerCase() === s).reduce((t, op) => t + (Number(op.value) || 0), 0);

  const thStyle = { padding: '0.85rem 1rem', fontWeight: '600', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'left', whiteSpace: 'nowrap' };
  const tdStyle = { padding: '1rem', fontSize: '0.875rem', color: 'var(--text-main)', whiteSpace: 'nowrap' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <style>{`
        .pipeline-row { transition: background-color 0.15s ease; }
        .pipeline-row:hover { background-color: rgba(79, 70, 229, 0.03); }
        .pl-date { padding: 0.4rem 0.6rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); font-size: 0.8rem; color: var(--text-main); font-family: inherit; outline: none; background: var(--surface-color); }
      `}</style>

      <div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>Pages / Sales Pipeline</div>
        <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.75rem', fontWeight: '700' }}>Sales Pipeline</h2>
      </div>

      {/* Manager filter */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <select
          value={managerFilter}
          onChange={(e) => setManagerFilter(e.target.value)}
          style={{ ...filterSelectStyle, padding: '0.7rem 2.25rem 0.7rem 1.25rem', fontWeight: '600', color: 'var(--text-main)', minWidth: '180px' }}
        >
          <option value="All">All Managers</option>
          {managers.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
        <PipelineStatCard title="Total Pipeline" value={scoped.length}     subtitle="All open deals"      icon={Filter}    color="#475569" bg="#EEF4FF" borderColor="#DBE4FF" />
        <PipelineStatCard title="Hot"            value={formatINR(sumStage('hot'))}  subtitle="Total value · high probability"    icon={Flame}     color="#EF4444" bg="#FEF2F2" borderColor="#FEE2E2" />
        <PipelineStatCard title="Warm"           value={formatINR(sumStage('warm'))} subtitle="Total value · medium probability"  icon={Activity}  color="#F97316" bg="#FFF7ED" borderColor="#FFEDD5" />
        <PipelineStatCard title="Cold"           value={formatINR(sumStage('cold'))} subtitle="Total value · low probability"     icon={Snowflake} color="#64748B" bg="#EFF2F7" borderColor="#E2E8F0" />
        <PipelineStatCard title="Lost"           value={countStage('lost')} subtitle="Closed deals"        icon={XCircle}   color="#DB2777" bg="#FDF2F8" borderColor="#FCE7F3" />
      </div>

      {/* Filters + table card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', padding: '1.25rem 1.5rem' }}>
          <input
            type="text"
            placeholder="Search Opportunity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: '0.6rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)', outline: 'none', fontSize: '0.875rem', minWidth: '200px', flex: '1 1 200px' }}
          />
          <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} style={filterSelectStyle}>
            <option value="All">Filter by Stage</option>
            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={execFilter} onChange={(e) => setExecFilter(e.target.value)} style={filterSelectStyle}>
            <option value="All">Filter by Sales Executive</option>
            {managers.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} style={filterSelectStyle}>
            <option value="All">Filter by Service</option>
            {services.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={resetFilters} style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer', padding: '0.6rem 0.5rem' }}>
            Reset Filters
          </button>
        </div>

        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{ width: '100%', minWidth: '1250px', borderCollapse: 'collapse' }}>
            <thead style={{ borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
              <tr>
                <th style={thStyle}>Lead id</th>
                <th style={thStyle}>Customer</th>
                <th style={thStyle}>Service</th>
                <th style={thStyle}>Stage</th>
                <th style={thStyle}>Assigned to</th>
                <th style={thStyle}>Expected close</th>
                <th style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }} onClick={toggleValueSort}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    Project value
                    <span style={{ fontSize: '0.7rem', opacity: sortValueDir ? 1 : 0.6 }}>↑↓</span>
                  </span>
                </th>
                <th style={thStyle}>Last activity</th>
                <th style={thStyle}>Follow-up</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {pipeline.length === 0
                    ? 'No opportunities yet. Add a lead with a Project Value to see it here.'
                    : 'No opportunities match your filters.'}
                </td></tr>
              ) : (
                pageRows.map((op) => {
                  const st = getStageStyles(op.stage);
                  return (
                    <tr key={op.id} className="pipeline-row" style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ ...tdStyle, fontWeight: '700' }}>{resolveLeadId(op)}</td>
                      <td style={{ ...tdStyle, fontWeight: '600' }}>{op.customer}</td>
                      <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{op.service}</td>
                      <td style={tdStyle}>
                        <select
                          value={op.stage}
                          onChange={(e) => updateStage(op, e.target.value)}
                          style={{
                            padding: '0.4rem 1.75rem 0.4rem 0.75rem', borderRadius: 'var(--radius-md)',
                            border: `1px solid ${st.border}`, backgroundColor: st.bg, color: st.color,
                            fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', outline: 'none',
                            appearance: 'none', WebkitAppearance: 'none',
                            backgroundImage: selectArrowBg, backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 0.6rem center', backgroundSize: '0.5rem auto',
                            fontFamily: 'inherit', minWidth: '130px'
                          }}
                        >
                          {STAGES.map((s) => <option key={s} value={s} style={{ color: 'var(--text-main)', backgroundColor: '#fff' }}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{op.assignedTo}</td>
                      <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{op.expectedClose}</td>
                      <td style={{ ...tdStyle, fontWeight: '700', color: 'var(--success-color)' }}>{formatINR(op.value)}</td>
                      <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{op.lastActivity}</td>
                      <td style={tdStyle}>
                        <input type="date" className="pl-date" value={op.followUp || ''} onChange={(e) => updateFollowUp(op, e.target.value)} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination (derived from the real result set) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', padding: '1.25rem 1.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Showing {showingFrom} to {showingTo} of {filtered.length} entries
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button onClick={() => setActivePage((p) => Math.max(1, p - 1))} disabled={activePage === 1} style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)', cursor: activePage === 1 ? 'default' : 'pointer', opacity: activePage === 1 ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setActivePage(p)}
                style={{
                  minWidth: '34px', height: '34px', borderRadius: 'var(--radius-md)',
                  border: `1px solid ${p === activePage ? 'var(--primary-color)' : 'var(--border-color)'}`,
                  backgroundColor: p === activePage ? 'var(--primary-color)' : 'var(--surface-color)',
                  color: p === activePage ? '#fff' : 'var(--text-main)',
                  fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', padding: '0 0.5rem'
                }}
              >
                {p}
              </button>
            ))}
            <button onClick={() => setActivePage((p) => Math.min(totalPages, p + 1))} disabled={activePage === totalPages} style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)', cursor: activePage === totalPages ? 'default' : 'pointer', opacity: activePage === totalPages ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>›</button>
          </div>
        </div>
      </div>

      {/* View opportunity modal */}
      {viewOp && (
        <div onClick={() => setViewOp(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '460px', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Opportunity {viewOp.id}</h3>
              <button onClick={() => setViewOp(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            {[
              ['Customer', viewOp.customer],
              ['Service', viewOp.service],
              ['Stage', viewOp.stage],
              ['Assigned to', viewOp.assignedTo],
              ['Expected close', viewOp.expectedClose],
              ['Project value', formatINR(viewOp.value)],
              ['Last activity', viewOp.lastActivity],
              ['Follow-up', viewOp.followUp || '—'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.875rem', padding: '0.6rem 0', borderBottom: '1px dashed var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                <span style={{ fontWeight: 600, color: 'var(--text-main)', textAlign: 'right' }}>{v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button className="btn btn-outline" onClick={() => setViewOp(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit opportunity modal */}
      {editOp && (
        <div onClick={() => setEditOp(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '480px', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Edit {editOp.id}</h3>
              <button onClick={() => setEditOp(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Customer</label>
                <input value={editOp.customer || ''} onChange={(e) => editField('customer', e.target.value)} style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', fontFamily: 'inherit' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Service</label>
                  <input value={editOp.service || ''} onChange={(e) => editField('service', e.target.value)} style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', fontFamily: 'inherit' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Stage</label>
                  <select value={editOp.stage || ''} onChange={(e) => editField('stage', e.target.value)} style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', fontFamily: 'inherit', background: 'var(--surface-color)' }}>
                    {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Assigned to</label>
                  <input value={editOp.assignedTo || ''} onChange={(e) => editField('assignedTo', e.target.value)} style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', fontFamily: 'inherit' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Project value (₹)</label>
                  <input value={editOp.value ?? ''} onChange={(e) => editField('value', e.target.value)} style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', fontFamily: 'inherit' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Expected close</label>
                <input value={editOp.expectedClose || ''} onChange={(e) => editField('expectedClose', e.target.value)} style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', fontFamily: 'inherit' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button className="btn btn-outline" onClick={() => setEditOp(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation popup */}
      {deleteOp && (
        <div onClick={() => setDeleteOp(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '420px', padding: '1.75rem', textAlign: 'center' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <Trash2 size={24} color="#DC2626" />
            </div>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', fontWeight: 700 }}>Delete this opportunity?</h3>
            <p style={{ margin: '0 0 1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Are you sure you want to remove <strong>{deleteOp.customer || deleteOp.id}</strong> from the pipeline? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="btn btn-outline" onClick={() => setDeleteOp(null)}>Cancel</button>
              <button className="btn" onClick={confirmDelete} style={{ background: '#DC2626', color: '#fff', border: 'none' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesPipeline;
