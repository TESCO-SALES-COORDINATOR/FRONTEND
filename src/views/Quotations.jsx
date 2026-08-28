import React, { useState, useEffect } from 'react';
import { FileText, Download, Eye, Plus, CheckCircle, Clock, X, ThumbsUp, Send, Upload, Trash2 } from 'lucide-react';
import { useToast } from '../components/Toast';

// Newest-first: order records by creation time, then by id (numeric-aware) as a tie-breaker.
const byNewest = (a, b) => {
  const da = new Date(a.createdAt || a.date || 0).getTime();
  const db = new Date(b.createdAt || b.date || 0).getTime();
  if (!isNaN(da) && !isNaN(db) && da !== db) return db - da;
  return String(b.id || '').localeCompare(String(a.id || ''), undefined, { numeric: true });
};

const getApprovalStatusStyle = (status) => {
  const base = {
    padding: '0.35rem 1.6rem 0.35rem 0.75rem',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: '600',
    border: 'none',
    outline: 'none',
    cursor: 'pointer',
    appearance: 'none',
    WebkitAppearance: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    textAlign: 'center',
    transition: 'all 0.2s ease',
  };

  if (status === 'Approved') return { ...base, backgroundColor: '#DCFCE7', color: '#166534' };
  if (status === 'Rejected') return { ...base, backgroundColor: '#FEE2E2', color: '#991B1B' };
  return { ...base, backgroundColor: '#FEF3C7', color: '#92400E' }; // Pending
};

const getQuotationStatusStyle = (status) => {
  const base = {
    padding: '0.35rem 1.6rem 0.35rem 0.75rem',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: '600',
    border: 'none',
    outline: 'none',
    cursor: 'pointer',
    appearance: 'none',
    WebkitAppearance: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    textAlign: 'center',
    transition: 'all 0.2s ease',
  };

  if (status === 'Prepared') return { ...base, backgroundColor: '#E0F2FE', color: '#0369A1' };
  return { ...base, backgroundColor: '#E0E7FF', color: '#3730A3' }; // In Preparation
};

const QUOTES_API = 'https://api-salescoordinator.tescomanagement.com/api/quotations';

// Highest numeric suffix across the given quotations (base 5000 so the first id is QT-5001).
const maxQuoteNum = (rows) => rows.reduce((m, q) => {
  const n = parseInt(String(q.id || '').replace(/\D/g, ''), 10);
  return isNaN(n) ? m : Math.max(m, n);
}, 5000);

// The next guaranteed-unique quotation id. Length-based ids (QT-5001 + length) collide
// after a delete or against pre-existing quotes, which made two rows share an id — so
// changing one row's status changed the other. Deriving from the max suffix avoids that.
const nextQuoteId = (rows) => `QT-${maxQuoteNum(rows) + 1}`;

// Repair any duplicate / missing ids already present in the data so each row is unique
// (older data may contain collisions created by the previous length-based id scheme).
const dedupeIds = (rows) => {
  const seen = new Set();
  let maxNum = maxQuoteNum(rows);
  return rows.map((q) => {
    let id = q.id;
    if (!id || seen.has(id)) { maxNum += 1; id = `QT-${maxNum}`; }
    seen.add(id);
    return id === q.id ? q : { ...q, id };
  });
};

const Quotations = () => {
  const addToast = useToast();
  const [quotes, setQuotes] = useState([]);
  const [quotesLoaded, setQuotesLoaded] = useState(false);
  const [leads, setLeads] = useState([]);
  const [appts, setAppts] = useState([]); // appointments/visits — used to gate the Lead dropdown

  // Load all leads so the Generate Quotation form can offer a Lead ID dropdown
  useEffect(() => {
    fetch('https://api-salescoordinator.tescomanagement.com/api/leads')
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setLeads(d); })
      .catch((e) => console.error('Failed to load leads:', e));
  }, []);

  // Load appointments/visits so we can offer only leads whose VISIT is completed
  // (strict lifecycle: Visit must be completed before a quotation can be uploaded).
  useEffect(() => {
    fetch('https://api-salescoordinator.tescomanagement.com/api/appointments')
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setAppts(d); })
      .catch((e) => console.error('Failed to load appointments:', e));
  }, []);

  // Load quotations from API (no reference/seed data)
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(QUOTES_API);
        const data = await res.json();
        if (Array.isArray(data)) setQuotes(dedupeIds(data).sort(byNewest));
      } catch (err) {
        console.error('Failed to load quotations:', err);
      } finally {
        setQuotesLoaded(true);
      }
    };
    load();
  }, []);

  // Sync to API on change (also mirror to localStorage so dashboard/lead pages stay in sync)
  useEffect(() => {
    if (!quotesLoaded) return;
    localStorage.setItem('crm_quotes', JSON.stringify(quotes));
    fetch(`${QUOTES_API}/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quotes)
    }).catch(err => console.error('Failed to sync quotations:', err));
  }, [quotes, quotesLoaded]);

  // ── Lifecycle: when a quotation is APPROVED, advance its lead to the Order
  // Confirmation stage (leads PUT). Idempotent — only fires when the lead is not
  // already at/after that stage, so it neither loops nor spams the API.
  useEffect(() => {
    if (!quotesLoaded || leads.length === 0) return;
    const approvedLeadIds = Array.from(new Set(
      quotes.filter(q => q.approvalStatus === 'Approved' && q.leadId).map(q => q.leadId)
    ));
    approvedLeadIds.forEach((leadId) => {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) return;
      if (/order confirm|payment collection|completed/i.test(String(lead.status || ''))) return;
      const stamp = new Date().toLocaleDateString('en-GB') + ', ' + new Date().toLocaleTimeString('en-US', { hour12: false });
      const entry = { timestamp: stamp, message: 'Quotation approved — moved to Order Confirmation stage', remark: '' };
      const history = Array.isArray(lead.history) ? [...lead.history, entry] : [entry];
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: 'Order Confirmed', history } : l));
      fetch(`https://api-salescoordinator.tescomanagement.com/api/leads/${leadId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Order Confirmed', history })
      }).catch(err => console.error('Failed to advance lead to Order Confirmation:', err));
    });
  }, [quotes, quotesLoaded, leads]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newQuote, setNewQuote] = useState({
    leadId: '', client: '', project: '', amount: '', gst: '', quotationType: 'Initial Quotation', approvalStatus: 'Pending', quotationStatus: 'In Preparation', revision: 'Rev 0', fileName: null, fileData: null
  });

  // Only PDF quotations are accepted. Images (or any non-PDF) are rejected so a
  // quotation can never bypass the Sales Head's approval by being uploaded as a picture.
  const isPdfFile = (file) => file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || ''));

  // Read the chosen PDF into the new-quote state (attached on Upload)
  const handleModalFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) { setNewQuote(prev => ({ ...prev, fileName: null, fileData: null })); return; }
    if (!isPdfFile(file)) {
      addToast('Only PDF files are allowed. Please upload the quotation as a PDF.', 'error');
      event.target.value = '';
      setNewQuote(prev => ({ ...prev, fileName: null, fileData: null }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const tooBig = file.size > 5 * 1024 * 1024;
      setNewQuote(prev => ({ ...prev, fileName: file.name, fileData: tooBig ? null : reader.result }));
    };
    reader.readAsDataURL(file);
  };

  /* ── Lifecycle gating (Visit completed → Quotation) ──
     A lead is eligible for a new quotation only when it has a COMPLETED visit and does
     not already have an ACTIVE quotation. "Active" = Pending or Approved. A Rejected
     quotation does not block re-upload, and all rejected quotations are kept for audit. */
  const isVisitDone = (a) => {
    const s = String(a.status || '').toLowerCase();
    return s.includes('complet') || String(a.progressStatus || '').toLowerCase() === 'completed' || !!a.completedAt;
  };
  const digits = (s) => String(s || '').replace(/\D/g, '');
  const norm = (s) => String(s || '').trim().toLowerCase();
  // Resolve the lead a completed appointment/visit record belongs to (id → phone → name),
  // falling back to a lightweight lead built from the record when the lead isn't loaded.
  const resolveLead = (a) => {
    if (a.leadId) { const byId = leads.find(l => l.id === a.leadId); if (byId) return byId; }
    const ap = digits(a.phone);
    if (ap) { const byPhone = leads.find(l => { const lp = digits(l.phone); return lp && lp.slice(-10) === ap.slice(-10); }); if (byPhone) return byPhone; }
    const nm = norm(a.client || a.customerName || a.title);
    const byName = nm ? leads.find(l => norm(l.name) === nm) : null;
    if (byName) return byName;
    return a.leadId ? { id: a.leadId, name: a.client || a.customerName || a.title || 'Customer', phone: a.phone || '' } : null;
  };
  // Completed records — Site Visits AND coordinator-assigned appointments completed by the
  // manager in the Visit section. Eligibility is keyed off the RECORDS so a completed visit
  // surfaces even when its lead's fields don't line up perfectly.
  const completedRecords = (Array.isArray(appts) ? appts : []).filter(a => isVisitDone(a));
  // The lead's active (non-rejected) quotation, if any — its existence blocks a new upload.
  const leadActiveQuote = (leadId) => quotes.find(q => q.leadId === leadId && String(q.approvalStatus || '') !== 'Rejected');
  const eligibleMap = new Map();
  completedRecords.forEach(a => { const l = resolveLead(a); if (!l || !l.id || leadActiveQuote(l.id) || eligibleMap.has(l.id)) return; eligibleMap.set(l.id, l); });
  const eligibleLeads = Array.from(eligibleMap.values());
  const leadHasCompletedVisit = (leadOrId) => {
    const id = typeof leadOrId === 'object' && leadOrId !== null ? leadOrId.id : leadOrId;
    return completedRecords.some(a => { const l = resolveLead(a); return l && l.id === id; });
  };

  const handleGenerateQuote = (e) => {
    e.preventDefault();
    // ── Enforce the strict lifecycle before uploading ──
    if (!leadHasCompletedVisit(newQuote.leadId)) {
      addToast('This lead has no completed visit yet — complete the site visit first.', 'error');
      return;
    }
    // PDF is mandatory — a quotation cannot be created without a PDF document.
    if (!newQuote.fileName) {
      addToast('A PDF quotation file is required before uploading.', 'error');
      return;
    }
    const active = leadActiveQuote(newQuote.leadId);
    if (active) {
      addToast(`This lead already has a ${String(active.approvalStatus).toLowerCase()} quotation (${active.id}). A new one is allowed only after it is rejected.`, 'error');
      return;
    }
    const newId = nextQuoteId(quotes);

    // Ensure the project value carries a ₹ symbol; keep GST empty when not provided
    const formattedAmount = newQuote.amount.startsWith('₹') ? newQuote.amount : `₹${newQuote.amount}`;
    const formattedGst = newQuote.gst ? (newQuote.gst.startsWith('₹') ? newQuote.gst : `₹${newQuote.gst}`) : '';

    setQuotes([{
      ...newQuote,
      id: newId,
      amount: formattedAmount,
      gst: formattedGst,
      // A file attached at upload time means the quotation is prepared
      quotationStatus: newQuote.fileName ? 'Prepared' : newQuote.quotationStatus
    }, ...quotes]);

    // Record the quotation on the lead's shared history (visible to manager + coordinator)
    if (newQuote.leadId) {
      const lead = leads.find(l => l.id === newQuote.leadId);
      if (lead) {
        const stamp = new Date().toLocaleDateString('en-GB') + ', ' + new Date().toLocaleTimeString('en-US', { hour12: false });
        const entry = { timestamp: stamp, message: `Quotation ${newId} generated (${formattedAmount}) by ${(JSON.parse(localStorage.getItem('crm_user') || 'null')?.name) || 'Coordinator'}`, remark: newQuote.project || '' };
        const history = Array.isArray(lead.history) ? [...lead.history, entry] : [entry];
        fetch(`https://api-salescoordinator.tescomanagement.com/api/leads/${lead.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ history })
        }).catch(err => console.error('Failed to update lead history:', err));
      }
    }

    setIsModalOpen(false);
    setNewQuote({ leadId: '', client: '', project: '', amount: '', gst: '', quotationType: 'Initial Quotation', approvalStatus: 'Pending', quotationStatus: 'In Preparation', revision: 'Rev 0', fileName: null, fileData: null });
    addToast('Quotation uploaded successfully!', 'success');
  };

  const handleApprovalStatusChange = (id, newStatus) => {
    setQuotes(quotes.map(q => q.id === id ? { ...q, approvalStatus: newStatus } : q));
  };

  const handleQuotationStatusChange = (id, newStatus) => {
    setQuotes(quotes.map(q => q.id === id ? { ...q, quotationStatus: newStatus } : q));
    addToast(`Quotation marked as "${newStatus}"`, 'success');
  };

  const handleFileUpload = (id, event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!isPdfFile(file)) {
      addToast('Only PDF files are allowed. Please upload the quotation as a PDF.', 'error');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const tooBig = file.size > 5 * 1024 * 1024;
      setQuotes(prev => prev.map(q => q.id === id ? { ...q, fileName: file.name, fileData: tooBig ? null : reader.result } : q));
      addToast(tooBig ? `Uploaded "${file.name}" (too large to preview)` : `Quotation "${file.name}" uploaded`, 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFile = (id) => {
    setQuotes(quotes.map(q => q.id === id ? { ...q, fileName: null, quotationStatus: 'In Preparation' } : q));
    addToast('Uploaded quotation removed', 'info');
  };

  // ── Quotation export / preview (generate a printable PDF document from row data) ──
  const parseAmt = (v) => {
    const n = parseFloat(String(v || '').replace(/[^0-9.]/g, ''));
    return Number.isNaN(n) ? 0 : n;
  };
  const buildQuotationHtml = (q, autoPrint) => {
    const amt = parseAmt(q.amount);
    const gst = parseAmt(q.gst);
    const total = amt + gst;
    const fmt = (n) => '₹' + n.toLocaleString('en-IN');
    const today = new Date().toLocaleDateString('en-GB');
    return `<!doctype html><html><head><meta charset="utf-8"><title>${q.id} - Quotation</title>
    <style>
      *{box-sizing:border-box;} body{font-family:Arial,Helvetica,sans-serif;color:#1E293B;margin:0;padding:40px;}
      .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #4F46E5;padding-bottom:18px;margin-bottom:24px;}
      .brand{font-size:22px;font-weight:800;color:#4F46E5;margin:0;}
      .sub{color:#64748B;font-size:12px;margin:4px 0 0;}
      .qid{text-align:right;} .qid h2{margin:0;font-size:18px;}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:12px 24px;margin-bottom:24px;font-size:14px;}
      .meta span{color:#64748B;display:block;font-size:12px;margin-bottom:2px;}
      table{width:100%;border-collapse:collapse;margin-top:8px;}
      th,td{padding:12px;border-bottom:1px solid #E2E8F0;text-align:left;font-size:14px;}
      th{background:#F1F5F9;color:#475569;}
      .right{text-align:right;}
      .total td{font-weight:800;font-size:16px;border-top:2px solid #4F46E5;}
      .badge{display:inline-block;padding:3px 10px;border-radius:9999px;font-size:12px;font-weight:600;background:#FEF3C7;color:#92400E;}
      .badge.ok{background:#DCFCE7;color:#166534;}
      .foot{margin-top:36px;color:#94A3B8;font-size:12px;}
    </style></head><body>
      <div class="head">
        <div><p class="brand">TESCO Sales CRM</p><p class="sub">Construction &amp; Roofing Solutions</p></div>
        <div class="qid"><h2>QUOTATION</h2><p class="sub">${q.id} &bull; ${today}</p></div>
      </div>
      <div class="meta">
        <div><span>Lead ID</span>${q.leadId || 'N/A'}</div>
        <div><span>Client</span>${q.client || '-'}</div>
        <div><span>Service</span>${q.project || '-'}</div>
        <div><span>Approval Status</span><span class="badge ${q.approvalStatus === 'Approved' ? 'ok' : ''}">${q.approvalStatus}</span></div>
      </div>
      <table>
        <thead><tr><th>Description</th><th class="right">Amount</th></tr></thead>
        <tbody>
          <tr><td>${q.project || 'Service'} (${q.revision || 'Rev 0'})</td><td class="right">${fmt(amt)}</td></tr>
          <tr><td>GST</td><td class="right">${fmt(gst)}</td></tr>
          <tr class="total"><td>Total</td><td class="right">${fmt(total)}</td></tr>
        </tbody>
      </table>
      <p class="foot">This is a system-generated quotation from TESCO Sales CRM.</p>
      ${autoPrint ? '<scr' + 'ipt>window.onload=function(){setTimeout(function(){window.print();},300);}<\/scr' + 'ipt>' : ''}
    </body></html>`;
  };
  const openQuotationDoc = (q, autoPrint) => {
    const win = window.open('', '_blank');
    if (!win) { addToast('Please allow pop-ups to export the quotation.', 'warning'); return; }
    win.document.write(buildQuotationHtml(q, autoPrint));
    win.document.close();
  };
  // Preview/Download show the actual uploaded document when one exists; otherwise the generated quotation.
  // View shows ONLY the actual uploaded document (no system-generated fallback).
  const handlePreview = (q) => {
    if (q.fileData) {
      const w = window.open('', '_blank');
      if (!w) { addToast('Please allow pop-ups to preview the document.', 'warning'); return; }
      w.document.write(`<title>${q.fileName || 'Quotation'}</title><iframe src="${q.fileData}" style="border:0;width:100vw;height:100vh"></iframe>`);
      w.document.close();
      return;
    }
    addToast(q.fileName ? `"${q.fileName}" isn't available to preview — please re-upload the file.` : 'No file has been uploaded for this quotation yet.', 'warning');
  };
  // Download gives back exactly the uploaded file (no system-generated fallback).
  const handleExportPdf = (q) => {
    if (q.fileData) {
      const a = document.createElement('a');
      a.href = q.fileData;
      a.download = q.fileName || 'quotation';
      document.body.appendChild(a); a.click(); a.remove();
      return;
    }
    addToast(q.fileName ? `"${q.fileName}" isn't available to download — please re-upload the file.` : 'No file has been uploaded for this quotation yet.', 'warning');
  };
  const handleDeleteQuote = (id) => {
    const q = quotes.find(x => x.id === id);
    setQuotes(quotes.filter(x => x.id !== id));
    if (q?.id) fetch(`${QUOTES_API}/${q.id}`, { method: 'DELETE' }).catch(err => console.error('Failed to delete quotation:', err));
    addToast('Quotation deleted', 'info');
  };

  // Compute card stats live from the quotations we have
  const requestedCount = quotes.length;
  const pendingCount = quotes.filter(q => q.approvalStatus === 'Pending').length;
  const completedCount = quotes.filter(q => q.quotationStatus === 'Prepared').length;
  const approvedCount = quotes.filter(q => q.approvalStatus === 'Approved').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>Quotations</h2>
        <button className="btn btn-primary" style={{ display: 'flex', gap: '0.5rem' }} onClick={() => setIsModalOpen(true)}>
          <Plus size={16} /> Upload Quotation
        </button>
      </div>

      {/* ── 4 Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem' }}>
        {[
          { label: 'Requested Quotations', value: requestedCount, Icon: FileText, color: '#4F46E5', bg: '#EEF4FF', border: '#C7D2FE', sub: 'All quotation requests' },
          { label: 'Pending Quotations', value: pendingCount, Icon: Clock, color: '#D97706', bg: '#FFF7ED', border: '#FED7AA', sub: 'Awaiting client/mgr approval' },
          { label: 'Completed Quotations', value: completedCount, Icon: Send, color: '#0EA5E9', bg: '#F0F9FF', border: '#BAE6FD', sub: 'Prepared & sent to clients' },
          { label: 'Approved Quotations', value: approvedCount, Icon: ThumbsUp, color: '#16A34A', bg: '#ECFDF5', border: '#BBF7D0', sub: 'Accepted quotations' },
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

      {/* ── Main Full-Width Table Card ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Table Card */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: '#F1F5F9', borderBottom: '1px solid var(--border-color)' }}>
              <tr>
                <th style={{ padding: '1rem 1.5rem', fontWeight: '600', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Lead ID</th>
                <th style={{ padding: '1rem 1.5rem', fontWeight: '600', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Customer Name</th>
                <th style={{ padding: '1rem 1.5rem', fontWeight: '600', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Approval Status</th>
                <th style={{ padding: '1rem 1.5rem', fontWeight: '600', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Quotations Status</th>
                <th style={{ padding: '1rem 1.5rem', fontWeight: '600', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Upload Quotation</th>
                <th style={{ padding: '1rem 1.5rem', fontWeight: '600', fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote, index) => {
                // An APPROVED quotation is permanently locked: no status change, no
                // file upload/removal, no delete — the lead has moved to Order Confirmation.
                const isApproved = quote.approvalStatus === 'Approved';
                return (
                <tr key={quote.id} style={{ borderBottom: index === quotes.length - 1 ? 'none' : '1px solid var(--border-color)' }}>
                  {/* Lead ID Column */}
                  <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', fontWeight: '600', color: 'var(--primary-color)' }}>
                    {quote.leadId || 'N/A'}
                  </td>
                  
                  {/* Customer Name Column */}
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>{quote.client}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {quote.project}
                    </div>
                  </td>
                  
                  {/* Approval Status Badge Column */}
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <span style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      display: 'inline-flex',
                      alignItems: 'center',
                      textAlign: 'center',
                      backgroundColor: quote.approvalStatus === 'Approved' ? '#DCFCE7' : quote.approvalStatus === 'Rejected' ? '#FEE2E2' : '#FEF3C7',
                      color: quote.approvalStatus === 'Approved' ? '#166534' : quote.approvalStatus === 'Rejected' ? '#991B1B' : '#92400E'
                    }}>
                      {quote.approvalStatus}
                    </span>
                    {(quote.approvalStatus === 'Rejected' || quote.approvalStatus === 'Changes Requested') && quote.rejectionReason && (
                      <div style={{ fontSize: '0.7rem', color: '#991B1B', marginTop: '0.35rem', maxWidth: '220px' }}>
                        Reason: {quote.rejectionReason}
                      </div>
                    )}
                  </td>
                  
                  {/* Quotation Status Drop Down Column */}
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <select
                        value={quote.quotationStatus}
                        onChange={(e) => handleQuotationStatusChange(quote.id, e.target.value)}
                        disabled={!quote.fileName || isApproved}
                        title={isApproved ? 'Approved quotation is locked' : (!quote.fileName ? 'Upload the quotation PDF first' : '')}
                        style={{ ...getQuotationStatusStyle(quote.quotationStatus), opacity: (quote.fileName && !isApproved) ? 1 : 0.5, cursor: (quote.fileName && !isApproved) ? 'pointer' : 'not-allowed' }}
                      >
                        <option value="In Preparation" style={{ color: '#1E293B', backgroundColor: '#fff' }}>In Preparation</option>
                        <option value="Prepared" style={{ color: '#1E293B', backgroundColor: '#fff' }}>Prepared</option>
                      </select>
                      <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: '0.55rem', opacity: 0.7, color: 'inherit' }}>▼</span>
                    </div>
                  </td>
                  
                  {/* Upload Quotation Column */}
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {quote.fileName ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', padding: '0.25rem 0.6rem', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', color: '#166534' }}>
                          <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={quote.fileName}>
                            📄 {quote.fileName}
                          </span>
                          {!isApproved && (
                            <button
                              onClick={() => handleRemoveFile(quote.id)}
                              style={{ background: 'none', border: 'none', color: '#991B1B', cursor: 'pointer', display: 'flex', padding: 0 }}
                              title="Remove file"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      ) : isApproved ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Locked</span>
                      ) : (
                        <div style={{ position: 'relative' }}>
                          <input 
                            type="file"
                            accept="application/pdf,.pdf"
                            id={`file-input-${quote.id}`}
                            onChange={(e) => handleFileUpload(quote.id, e)}
                            style={{ display: 'none' }} 
                          />
                          <button 
                            onClick={() => document.getElementById(`file-input-${quote.id}`)?.click()}
                            style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '0.35rem', 
                              padding: '0.35rem 0.75rem', 
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--surface-color)',
                              cursor: 'pointer',
                              color: 'var(--text-muted)',
                              transition: 'all 0.2s'
                            }}
                          >
                            <Upload size={12} /> Upload PDF
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                  
                  {/* Action Column */}
                  <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button onClick={() => handlePreview(quote)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} title="Preview">
                        <Eye size={18} />
                      </button>
                      <button onClick={() => handleExportPdf(quote)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} title="Export PDF">
                        <Download size={18} />
                      </button>
                      <button onClick={() => !isApproved && handleDeleteQuote(quote.id)} disabled={isApproved} style={{ background: 'transparent', border: 'none', color: '#DC2626', cursor: isApproved ? 'not-allowed' : 'pointer', opacity: isApproved ? 0.4 : 1 }} title={isApproved ? 'Approved quotation is locked' : 'Delete quotation'}>
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

      </div>

      {/* Generate Quotation Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px', padding: '2rem', borderRadius: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-main)' }}>Upload Quotation</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={22} />
              </button>
            </div>
            <form onSubmit={handleGenerateQuote} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Row 1: Lead ID | Client Name */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Lead ID</label>
                  <select
                    required
                    value={newQuote.leadId}
                    onChange={(e) => {
                      const val = e.target.value;
                      const lead = leads.find(l => l.id === val);
                      setNewQuote({ ...newQuote, leadId: val, client: lead ? (lead.name || newQuote.client) : newQuote.client });
                    }}
                    style={{ width: '100%', padding: '0.7rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', fontSize: '0.9rem', backgroundColor: 'var(--surface-color)' }}
                  >
                    <option value="">Select lead</option>
                    {eligibleLeads.map(l => (<option key={l.id} value={l.id}>{l.name ? `${l.id} — ${l.name}` : l.id}</option>))}
                    {eligibleLeads.length === 0 && <option value="" disabled>No leads with a completed visit awaiting a quotation</option>}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Client Name</label>
                  <input required value={newQuote.client} onChange={(e) => setNewQuote({...newQuote, client: e.target.value})} type="text" placeholder="e.g. Acme Corp" style={{ width: '100%', padding: '0.7rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', fontSize: '0.9rem' }} />
                </div>
              </div>

              {/* Row 2: Services | Project Value */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Services</label>
                  <select required value={newQuote.project} onChange={(e) => setNewQuote({...newQuote, project: e.target.value})} style={{ width: '100%', padding: '0.7rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)', color: 'var(--text-main)', outline: 'none', fontSize: '0.9rem' }}>
                    <option value="">Select type</option>
                    <option value="PEB">PEB</option>
                    <option value="Tensile">Tensile</option>
                    <option value="Other roofing">Other roofing</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Project Value (₹)</label>
                  <input required value={newQuote.amount} onChange={(e) => setNewQuote({...newQuote, amount: e.target.value})} type="text" placeholder="Enter project value" style={{ width: '100%', padding: '0.7rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', fontSize: '0.9rem' }} />
                </div>
              </div>

              {/* Row 3: Quotation Type | Upload File (PDF) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Quotation Type</label>
                  <select value={newQuote.quotationType} onChange={(e) => setNewQuote({...newQuote, quotationType: e.target.value})} style={{ width: '100%', padding: '0.7rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)', color: 'var(--text-main)', outline: 'none', fontSize: '0.9rem' }}>
                    <option value="Initial Quotation">Initial Quotation</option>
                    <option value="Revised Quotation">Revised Quotation</option>
                    <option value="Final Quotation">Final Quotation</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Upload File (PDF)</label>
                  <input type="file" accept="application/pdf,.pdf" onChange={handleModalFileChange} style={{ width: '100%', padding: '0.5rem 0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', fontSize: '0.85rem', backgroundColor: 'var(--surface-color)', color: 'var(--text-muted)', cursor: 'pointer' }} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.75rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-outline" style={{ padding: '0.6rem 1.4rem' }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!newQuote.leadId || !newQuote.client || !newQuote.project || !newQuote.amount} style={{ padding: '0.6rem 1.6rem', opacity: (!newQuote.leadId || !newQuote.client || !newQuote.project || !newQuote.amount) ? 0.5 : 1 }}>Upload</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Quotations;
