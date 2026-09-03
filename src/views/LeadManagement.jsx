import React, { useState, useEffect } from 'react';
import AddLeadWizard from '../components/AddLeadWizard';
import { Search, Filter, Phone, MoreVertical, X, Edit2, Mail, Trash2, Users, Flame, CalendarCheck, Clock, Calendar, ChevronDown, ChevronUp, MapPin, Activity, User, FileText, UserPlus, Sparkles, Thermometer, Snowflake, FileSignature, HandshakeIcon, CheckCircle2, XCircle, Trash, Send, ArrowUpDown, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { useToast } from '../components/Toast';
import { statusColor, sourceColor } from '../theme/statusColors';

const LEAD_SOURCES = [
  'Referral',
  'Website Enquiry',
  'Cold Calling',
  'Meta Leads',
  'Google Ads',
  'Organic Leads',
];

// The 4 sales managers leads can be assigned to (Indhumathi assigns, so she is not a target)
const SALES_TEAM = [
  'Azar Abdullah A',
  'Praveenraja P',
  'Suresh P',
  'Agsal A',
];

// Delegate to the shared canonical palette so every app colours sources identically.
const getSourceStyles = (source) => sourceColor(source);

// Delegate to the shared canonical palette so every app colours statuses identically.
const getStatusStyles = (status) => statusColor(status);

// Map any stored status/source variant onto the EXACT dropdown option value, so the
// <select> always displays the right label (and therefore the right colour) instead of
// silently falling back to the first option when the stored value differs (e.g. a lead
// saved as "Hot" wouldn't match the option "Hot Leads", or "Google Leads" vs "Google Ads").
const STATUS_OPTION = {
  'new': 'New Lead', 'new lead': 'New Lead', 'new leads': 'New Lead',
  'hot': 'Hot Leads', 'hot leads': 'Hot Leads',
  'warm': 'Warm Leads', 'warm leads': 'Warm Leads',
  'cold': 'Cold Leads', 'cold leads': 'Cold Leads',
  'appointment fixed': 'Appointment Fixed', 'appt fixed': 'Appointment Fixed',
  'quotation send': 'Quotation Send', 'quotation sent': 'Quotation Send', 'qutation send': 'Quotation Send',
  'order confirmed': 'Order Confirmed',
  'junk': 'Junk', 'lost': 'Lost',
};
const canonStatus = (v) => STATUS_OPTION[String(v || '').trim().toLowerCase()] || v || 'New Lead';
const SOURCE_OPTION = {
  'referral': 'Referral', 'website enquiry': 'Website Enquiry',
  'cold calling': 'Cold Calling', 'meta leads': 'Meta Leads', 'meta': 'Meta Leads', 'meta ads': 'Meta Leads',
  'google ads': 'Google Ads', 'google leads': 'Google Ads', 'google': 'Google Ads',
  'organic leads': 'Organic Leads', 'organic': 'Organic Leads',
};
const canonSource = (v) => SOURCE_OPTION[String(v || '').trim().toLowerCase()] || v || 'Website Enquiry';

const LeadOverviewCard = ({ title, value, subtitle, icon: Icon, color, bg, borderColor, isSelected, onClick }) => (
  <div 
    className="card" 
    onClick={onClick}
    style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      padding: '1.25rem', 
      backgroundColor: bg || 'var(--surface-color)', 
      border: isSelected ? `2px solid ${color}` : `1px solid ${borderColor || 'var(--border-color)'}`, 
      boxShadow: isSelected ? `0 6px 14px ${color}25` : '0 2px 4px rgba(0,0,0,0.02)', 
      borderRadius: 'var(--radius-lg)',
      cursor: 'pointer',
      transform: isSelected ? 'translateY(-3px)' : 'none',
      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: '500', margin: 0 }}>{title}</p>
      <Icon size={18} color={color} />
    </div>
    <div>
      <h3 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-main)', margin: '0 0 0.5rem 0', letterSpacing: '-0.5px' }}>{value}</h3>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '500' }}>{subtitle}</span>
    </div>
  </div>
);

const API_URL = 'https://api-salescoordinator.tescomanagement.com/api/leads';

const LeadManagement = () => {
  const [leads, setLeads] = useState([]);
  const [leadsLoaded, setLeadsLoaded] = useState(false);
  // Live manager list from the shared users collection, so any manager the Sales Head
  // creates is immediately selectable here. Falls back to SALES_TEAM if the fetch fails.
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

  // Load leads from backend API on mount, then keep polling so leads created by
  // the n8n `lead-mail-PRODUCTION` automation appear automatically — no manual import.
  //   • First load  -> replace state with whatever the DB holds.
  //   • Each poll   -> MERGE in any server leads we don't already have locally,
  //                    without overwriting leads already in state (so in-progress
  //                    edits and the bulk-sync round-trip are never clobbered).
  useEffect(() => {
    let cancelled = false;
    let firstLoad = true;

    const loadLeads = async () => {
      try {
        const res = await fetch(API_URL);
        const data = await res.json();
        if (cancelled || !Array.isArray(data)) return;

        if (firstLoad) {
          setLeads(data);
        } else {
          // Append only brand-new leads (by id) coming from the automation.
          setLeads(prev => {
            const known = new Set(prev.map(l => l.id));
            const fresh = data.filter(l => l && l.id && !known.has(l.id));
            return fresh.length ? [...prev, ...fresh] : prev;
          });
        }
      } catch (err) {
        console.error('Failed to load leads from API:', err);
        if (firstLoad && !cancelled) setLeads([]);
      } finally {
        if (!cancelled && firstLoad) setLeadsLoaded(true);
        firstLoad = false;
      }
    };

    loadLeads();
    const poll = setInterval(loadLeads, 15000); // auto-show automation imports
    return () => { cancelled = true; clearInterval(poll); };
  }, []);

  // Sync leads to backend API whenever they change
  useEffect(() => {
    if (!leadsLoaded) return;
    fetch(`${API_URL}/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leads)
    }).catch(err => console.error('Failed to sync leads to API:', err));
  }, [leads, leadsLoaded]);

  // Live appointment + quotation records so the overview cards reflect real data
  // (not just leads whose status text says "Appointment Fixed" / "Quotation Send").
  const [apptRecords, setApptRecords] = useState([]);
  const [quoteRecords, setQuoteRecords] = useState([]);
  const [projectRecords, setProjectRecords] = useState([]);
  useEffect(() => {
    fetch('https://api-salescoordinator.tescomanagement.com/api/appointments').then(r => r.json()).then(d => { if (Array.isArray(d)) setApptRecords(d); }).catch(() => {});
    fetch('https://api-salescoordinator.tescomanagement.com/api/quotations').then(r => r.json()).then(d => { if (Array.isArray(d)) setQuoteRecords(d); }).catch(() => {});
    fetch('https://api-salescoordinator.tescomanagement.com/api/projects').then(r => r.json()).then(d => { if (Array.isArray(d)) setProjectRecords(d); }).catch(() => {});
  }, []);
  // Overview counts are computed below (after the header-filter state is declared) so the
  // "All Managers" dropdown scopes them too.

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('All Time');
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
    
    // Single-date selection: show only that date's leads
    setDateRange({ start: formatted, end: formatted });
    setSelectedPreset('Custom');
    setIsCalendarOpen(false);
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [newLead, setNewLead] = useState({
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    name: '', projectType: '', phone: '', budget: '', source: '', status: 'Lead Received', notes: ''
  });

  // The lead currently being edited in the Add New Lead wizard (null = adding new)
  const [editLead, setEditLead] = useState(null);

  // Lead pending deletion (drives the confirmation popup)
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Clicking Edit re-opens the Add New Lead form, pre-filled with this lead's data
  const openEditModal = (lead) => {
    setEditLead(lead);
    setIsModalOpen(true);
  };

  // Parse any stored follow-up value into { dPart:'YYYY-MM-DD', tPart:'HH:mm' } (tPart may be '')
  const parseFollowUp = (v) => {
    if (!v || typeof v !== 'string') return null;
    const s = v.trim();
    if (s === 'No Date' || s === 'Pending' || s === '') return null;
    let dPart = '', tPart = '', m;
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/))) { dPart = `${m[1]}-${m[2]}-${m[3]}`; tPart = `${m[4]}:${m[5]}`; }
    else if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) { dPart = `${m[1]}-${m[2]}-${m[3]}`; }
    else if ((m = s.match(/(\d{2})-(\d{2})-(\d{4})[,\s]+(\d{1,2}):(\d{2})\s*([AaPp][Mm])/))) { let h = parseInt(m[4], 10); const ap = m[6].toUpperCase(); if (ap === 'PM' && h !== 12) h += 12; if (ap === 'AM' && h === 12) h = 0; dPart = `${m[3]}-${m[2]}-${m[1]}`; tPart = `${String(h).padStart(2, '0')}:${m[5]}`; }
    else if ((m = s.match(/(\d{2})-(\d{2})-(\d{4})[,\s]+(\d{2}):(\d{2})/))) { dPart = `${m[3]}-${m[2]}-${m[1]}`; tPart = `${m[4]}:${m[5]}`; }
    else if ((m = s.match(/(\d{2})-(\d{2})-(\d{4})/))) { dPart = `${m[3]}-${m[2]}-${m[1]}`; }
    else { const d = new Date(s); if (!isNaN(d.getTime())) { dPart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; tPart = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; } }
    if (!dPart) return null;
    return { dPart, tPart };
  };

  // Convert any stored follow-up value into a datetime-local value (YYYY-MM-DDTHH:mm)
  const toDateInputValue = (v) => {
    const p = parseFollowUp(v);
    if (!p) return '';
    return `${p.dPart}T${p.tPart || '09:00'}`;
  };

  // Display a follow-up value as "DD-MM-YYYY, hh:mm AM/PM" (date only when no time was set)
  const fmtFollowUp = (v) => {
    const p = parseFollowUp(v);
    if (!p) return '';
    const [y, mo, d] = p.dPart.split('-');
    const dateStr = `${d}-${mo}-${y}`;
    if (!p.tPart) return dateStr;
    let h = parseInt(p.tPart.slice(0, 2), 10);
    const mm = p.tPart.slice(3, 5);
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return `${dateStr}, ${String(h).padStart(2, '0')}:${mm} ${ap}`;
  };

  // Inline follow-up date edit from the table column
  const updateLeadFollowUp = (id, value) => {
    const formattedTime = getFormattedTimestamp();
    setLeads(leads.map(l => {
      if (l.id !== id) return l;
      if (toDateInputValue(l.followUp) === value) return l;
      const newHistory = [...(l.history || []), {
        timestamp: formattedTime,
        message: value ? `Updated follow-up date to: ${value}` : 'Cleared follow-up date'
      }];
      const updatedLead = { ...l, followUp: value || 'No Date', history: newHistory };
      if (selectedLeadForTimeline && selectedLeadForTimeline.id === id) {
        setSelectedLeadForTimeline(updatedLead);
      }
      return updatedLead;
    }));
  };

  // Build the branded TESCO STRUCTURES quotation-style document for a lead
  // Load html2pdf.js once (used to generate a real downloadable PDF file)
  const ensureHtml2Pdf = () => new Promise((resolve, reject) => {
    if (window.html2pdf) return resolve(window.html2pdf);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js';
    s.onload = () => resolve(window.html2pdf);
    s.onerror = () => reject(new Error('Failed to load html2pdf.js'));
    document.head.appendChild(s);
  });

  // Build the branded Tesco Structures lead document as { quoteNo, style, inner }.
  // Uses a normal (non-fixed) flow layout so it renders cleanly both as a PDF and in print.
  const leadDocParts = (lead) => {
    const w = lead._wizard || {};
    const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const or = (v, fb) => (v !== undefined && v !== null && String(v).trim() !== '' ? v : fb);
    // Hide 4 digits of a phone number in the exported PDF for privacy (keeps the last 2
    // and any leading digits visible; masks 4 digits in the middle-end as X).
    const maskPhone = (v) => { const s = String(v ?? ''); const d = s.replace(/\D/g, ''); if (d.length < 6) return s; const a = d.length - 6, b = d.length - 2; let n = -1; return s.replace(/\d/g, (c) => { n += 1; return (n >= a && n < b) ? 'X' : c; }); };

    const idNum = (lead.id || '').replace(/\D/g, '') || '0000';
    const quoteNo = `TS-Q-${idNum}`;
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const budgetRaw = or(lead.budget, or(w.projectValue, ''));
    const budget = budgetRaw ? (String(budgetRaw).trim().startsWith('₹') ? String(budgetRaw) : `₹${budgetRaw}`) : '—';

    const clientName = or(lead.name, 'Client');
    const company = or(lead.company, clientName);
    const salesRep = (lead.manager && lead.manager !== 'Unassigned') ? lead.manager : 'Unassigned';

    const dq = String(lead.designReq || '').toLowerCase();
    const has3d = dq.includes('3d') || dq === 'both';
    const has2d = dq.includes('2d') || dq === 'both';
    const designServices = `3D: ${has3d ? 'Yes' : 'No'} | 2D: ${has2d ? 'Yes' : 'No'}`;

    const detailRow = (a, b, c) => `
      <div class="grid3 drow">
        <div class="field"><div class="k">${esc(a[0])}</div><div class="v">${esc(a[1])}</div></div>
        <div class="field"><div class="k">${esc(b[0])}</div><div class="v">${esc(b[1])}</div></div>
        <div class="field"><div class="k">${esc(c[0])}</div><div class="v">${esc(c[1])}</div></div>
      </div>`;
    const milestone = (n, label, pct) => `
      <div class="mrow"><span>${n}. ${esc(label)}</span><b>${esc(pct)}</b></div>`;

    const style = `<style>
  @page { size: A4; margin: 0; }
  .tsdoc, .tsdoc * { box-sizing: border-box; }
  .tsdoc { font-family: Arial, Helvetica, sans-serif; color: #1F2937; background: #fff; width: 794px; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .tsdoc .hdr { padding: 26px 48px 14px; display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #8DC63F; }
  .tsdoc .logo-wrap { display: flex; align-items: center; gap: 14px; }
  .tsdoc .logo-text .t1 { font-size: 22px; letter-spacing: 9px; font-weight: 800; color: #2B2B2B; line-height: 1; }
  .tsdoc .logo-text .t2 { font-size: 10px; letter-spacing: 6px; color: #6B7280; margin-top: 5px; }
  .tsdoc .hdr-email { color: #4B5563; font-size: 12px; margin-top: 12px; }
  .tsdoc .ftr { margin-top: 36px; background: #8DC63F; color: #fff; text-align: center; font-size: 11px; font-weight: 700; padding: 12px 8px; letter-spacing: 0.3px; }
  .tsdoc .content { padding: 22px 48px 0; }
  .tsdoc .pagebreak { page-break-before: always; height: 0; }
  .tsdoc .quotebox { border: 1px solid #E5E9F0; border-radius: 8px; padding: 15px 24px; display: flex; justify-content: space-between; font-size: 13px; color: #4B5563; margin-bottom: 8px; }
  .tsdoc .quotebox b { color: #111827; }
  .tsdoc .sec-title { color: #1E3A8A; font-size: 14px; font-weight: 800; letter-spacing: 0.3px; margin: 30px 0 7px; }
  .tsdoc .sec-rule { height: 2px; background: #E3E8F0; border-radius: 2px; margin-bottom: 20px; }
  .tsdoc .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .tsdoc .card2 { background: #F6F8FB; border: 1px solid #EBEFF5; border-radius: 10px; padding: 18px 22px; page-break-inside: avoid; }
  .tsdoc .card2 .lbl { font-size: 10px; letter-spacing: 1px; font-weight: 800; color: #64748B; text-transform: uppercase; margin-bottom: 12px; }
  .tsdoc .card2 .big { font-size: 16px; font-weight: 800; color: #111827; margin: 0 0 10px; }
  .tsdoc .card2 .row { font-size: 12.5px; color: #64748B; margin: 3px 0; }
  .tsdoc .card2 .row b { color: #374151; font-weight: 700; }
  .tsdoc .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px 26px; }
  .tsdoc .drow { padding: 14px 0; border-bottom: 1px solid #EEF1F5; }
  .tsdoc .field .k { font-size: 12px; color: #6B7280; margin-bottom: 5px; }
  .tsdoc .field .v { font-size: 13px; font-weight: 700; color: #1F2937; }
  .tsdoc .qtable { border: 1px solid #EBEFF5; border-radius: 10px; overflow: hidden; margin-top: 10px; page-break-inside: avoid; }
  .tsdoc .qhead { display: flex; justify-content: space-between; background: #F1F4F8; padding: 14px 20px; font-size: 12.5px; font-weight: 800; color: #475569; }
  .tsdoc .qbody { display: flex; justify-content: space-between; padding: 18px 20px; gap: 20px; }
  .tsdoc .qbody .desc-t { font-size: 14px; font-weight: 800; color: #111827; margin: 0 0 6px; }
  .tsdoc .qbody .desc-s { font-size: 11.5px; color: #94A3B8; line-height: 1.5; max-width: 460px; }
  .tsdoc .qbody .price { font-size: 14px; font-weight: 800; color: #111827; white-space: nowrap; }
  .tsdoc .qsub { display: flex; justify-content: flex-end; gap: 40px; background: #F6F8FB; padding: 14px 20px; font-size: 13px; color: #64748B; }
  .tsdoc .qsub b { color: #111827; }
  .tsdoc .qtotal { display: flex; justify-content: flex-end; gap: 40px; padding: 16px 20px; font-size: 15px; font-weight: 800; color: #0F9D8F; }
  .tsdoc .mtitle { font-size: 11.5px; font-weight: 800; letter-spacing: 0.6px; color: #334155; text-transform: uppercase; margin: 26px 0 10px; }
  .tsdoc .mhead { display: flex; justify-content: space-between; font-size: 12.5px; font-weight: 800; color: #475569; padding: 8px 4px 12px; border-bottom: 1px solid #E3E8F0; }
  .tsdoc .mrow { display: flex; justify-content: space-between; font-size: 13px; color: #374151; padding: 14px 4px; border-bottom: 1px dashed #E5E9F0; }
  .tsdoc .mrow b { color: #111827; }
  .tsdoc .sign { margin-top: 40px; display: flex; justify-content: flex-end; }
  .tsdoc .sign .box { border-top: 1px solid #CBD5E1; padding-top: 8px; width: 230px; text-align: center; font-size: 11px; letter-spacing: 1px; color: #94A3B8; }
</style>`;

    const inner = `<div class="tsdoc">
  <div class="hdr">
    <div class="logo-wrap">
      <svg width="42" height="42" viewBox="0 0 42 42" aria-hidden="true">
        <g fill="#8DC63F">
          <polygon points="4,30 15,12 21,12 10,30"/>
          <polygon points="13,30 24,12 30,12 19,30"/>
          <polygon points="22,30 33,12 39,12 28,30"/>
        </g>
        <rect x="4" y="32" width="30" height="3" fill="#4B7A1E"/>
      </svg>
      <div class="logo-text"><div class="t1">TESCO</div><div class="t2">STRUCTURES</div></div>
    </div>
    <div class="hdr-email">tescostructures@gmail.com</div>
  </div>
  <div class="content">
    <div class="quotebox">
      <div><b>Quote No:</b> ${esc(quoteNo)}</div>
      <div><b>Date:</b> ${esc(today)}</div>
      <div><b>Validity:</b> 30 Days</div>
    </div>

    <div class="sec-title">1. BASIC INFO</div>
    <div class="sec-rule"></div>
    <div class="cards">
      <div class="card2">
        <div class="lbl">Client Details</div>
        <div class="big">${esc(clientName)}</div>
        <div class="row">Billing Name: ${esc(company)}</div>
        <div class="row">GST: ${esc(or(w.gst, '-'))}</div>
      </div>
      <div class="card2">
        <div class="lbl">Contact Info</div>
        <div class="row"><b>Mobile:</b> ${esc(maskPhone(or(lead.phone, '-')))}</div>
        <div class="row"><b>Alt Mobile:</b> ${esc(maskPhone(or(w.altPhone, '-')))}</div>
        <div class="row"><b>Email:</b> ${esc(or(lead.email, '-'))}</div>
      </div>
      <div class="card2">
        <div class="lbl">Location</div>
        <div class="row"><b>Site Location:</b> ${esc(or(lead.location, '-'))}</div>
        <div class="row"><b>Site Address:</b> ${esc(or(w.siteAddress, '-'))}</div>
        <div class="row"><b>Billing Address:</b> ${esc(or(w.billingAddress, 'Same as Site'))}</div>
      </div>
      <div class="card2">
        <div class="lbl">Sales Representative</div>
        <div class="big">${esc(salesRep)}</div>
        <div class="row">Tesco Structures Sales Division</div>
      </div>
    </div>

    <div class="sec-title">2. PROJECT DETAILS</div>
    <div class="sec-rule"></div>
    ${detailRow(
      ['Segment Category', or(w.service, or(lead.projectType, '-'))],
      ['Work Type / Segment', or(w.projectType, '-')],
      ['Structure Type', or(w.structureType, '-')]
    )}
    ${detailRow(
      ['Plot Dimensions', or(w.plotDimensions, '-')],
      ['Roof Area / Size', w.approximateArea ? `${w.approximateArea} sq.ft` : '-'],
      ['Heights (Roof/Clearance/Eave)', or(w.heights, '-')]
    )}
    ${detailRow(
      ['Roof Covering Sheeting', or(w.roofCovering, '-')],
      ['Site Condition / Soil Test', (w.siteCondition || w.soilTest) ? `${or(w.siteCondition, '-')} / ${or(w.soilTest, '-')}` : '-'],
      ['Insulation Work', or(w.insulation, '-')]
    )}
    ${detailRow(
      ['Site Access (Road/Crane/HV)', or(w.siteAccess, '-')],
      ['Environment (Sun/Wind/Drain)', or(w.environment, '-')],
      ['Working Space', or(w.workingSpace, '-')]
    )}

    <div class="pagebreak"></div>

    <div class="sec-title">3. QUOTATIONS</div>
    <div class="sec-rule"></div>
    ${detailRow(
      ['Design Services', designServices],
      ['Transportation Scope', or(w.transportation, '-')],
      ['Scaffolding Scope', or(w.scaffolding, '-')]
    )}
    <div class="qtable">
      <div class="qhead"><span>Description of Work</span><span>Total Price (INR)</span></div>
      <div class="qbody">
        <div>
          <div class="desc-t">Design, Fabrication, Supply, and Erection work charges</div>
          <div class="desc-s">Charge covers design calculation, raw material sourcing, structural framework columns, rafters, primary/secondary purlins, bracing rods, roofing sheets, fasteners, and site erection.</div>
        </div>
        <div class="price">${esc(budget)}</div>
      </div>
      <div class="qsub"><span>Subtotal:</span><b>${esc(budget)}</b></div>
    </div>
    <div class="qtotal"><span>Grand Total (All-Inclusive):</span><span>${esc(budget)}</span></div>

    <div class="mtitle">Pricing &amp; Payment Milestones Schedule</div>
    <div class="mhead"><span>Billing Milestone Event Description</span><span>Percentage</span></div>
    ${milestone(1, 'Advance with Purchase Order (PO)', '10%')}
    ${milestone(2, 'Dispatch / after Drawing Approval', '30%')}
    ${milestone(3, 'Erection / after Structure Work Completion', '40%')}
    ${milestone(4, 'Handover / after Completion Sign-off', '20%')}

    <div class="sec-title">4. ORDER CONFIRM</div>
    <div class="sec-rule"></div>
    ${detailRow(
      ['Order Date', or(w.confirmationDate, '-')],
      ['Proposal Ref', or(w.proposalRef, '-')],
      ['Lead Time', or(w.leadTime, '-')]
    )}
    ${detailRow(
      ['Start Date', or(w.expectedStartDate, '-')],
      ['Completion Date', or(w.completionDate, '-')],
      ['Salesperson Declaration', or(w.orderStatus, '-')]
    )}
    <div class="sign"><div class="box">AUTHORIZED SIGNATURE</div></div>
  </div>
  <div class="ftr">www.tescostructures.com&nbsp;&nbsp;|&nbsp;&nbsp;+91 90033 28229&nbsp;&nbsp;|&nbsp;&nbsp;37, 15th St, Gandhi Nagar, Ashok Nagar, Chennai, Tamil Nadu 600083</div>
</div>`;

    return { quoteNo, style, inner };
  };

  // Full standalone HTML doc (used for the print fallback)
  const buildLeadDocHtml = (lead) => {
    const { quoteNo, style, inner } = leadDocParts(lead);
    return `<!doctype html><html><head><meta charset="utf-8"><title>${quoteNo} - Tesco Structures</title>${style}</head><body>${inner}<scr` + `ipt>setTimeout(function(){window.print();},400);</scr` + `ipt></body></html>`;
  };

  // Download a single lead as a real branded PDF file (falls back to print-to-PDF)
  const downloadLead = async (lead) => {
    const { quoteNo, style, inner } = leadDocParts(lead);
    try {
      const html2pdf = await ensureHtml2Pdf();
      // Render into an on-screen host (height:0 + overflow hidden → invisible but fully laid
      // out) and capture the .tsdoc element itself. A far off-screen container can render blank.
      const host = document.createElement('div');
      // On-screen (top-left, briefly) at exactly A4 content width so html2canvas captures it
      // full and html2pdf fits it to the A4 page — no clipping, no oversized page.
      host.style.cssText = 'position:absolute;left:0;top:0;width:794px;background:#fff;';
      host.innerHTML = style + inner;
      document.body.appendChild(host);
      const target = host.querySelector('.tsdoc') || host;
      if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch {} }
      await new Promise((r) => setTimeout(r, 80));
      await html2pdf().set({
        margin: 0,
        filename: `${quoteNo}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      }).from(target).save();
      document.body.removeChild(host);
      addToast('Lead PDF downloaded', 'success');
    } catch (err) {
      console.error('PDF download failed, falling back to print:', err);
      const win = window.open('', '_blank');
      if (!win) { addToast('Please allow pop-ups to download the lead.', 'warning'); return; }
      win.document.write(buildLeadDocHtml(lead));
      win.document.close();
    }
  };

  // "Delete" permanently removes the lead. It is deleted from the `leads` collection
  // AND from the shared `pipelines` collection (whose docs are keyed OP-<lead digits>),
  // so it does not linger as a "legacy" row in the Sales Pipeline. It is also removed
  // from local state so the bulk-sync round-trip never re-uploads it to the DB.
  const confirmDelete = () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    // Hard-delete the lead record from the backend.
    fetch(`${API_URL}/${id}`, { method: 'DELETE' })
      .catch(err => console.error('Failed to delete lead:', err));
    // Delete the matching pipeline opportunity (id derives as OP-<digits of lead id>).
    const opId = `OP-${String(id).replace(/\D/g, '') || id}`;
    fetch(`https://api-salescoordinator.tescomanagement.com/api/pipeline/${opId}`, { method: 'DELETE' })
      .catch(err => console.error('Failed to delete pipeline entry:', err));
    // Drop it from local state so the sync effect posts the reduced set (no resurrect).
    setLeads(leads.filter(l => l.id !== id));
    // Clear any legacy localStorage pipeline entry for this lead.
    try {
      const extras = JSON.parse(localStorage.getItem('crm_pipeline_extra') || '[]');
      localStorage.setItem('crm_pipeline_extra', JSON.stringify(extras.filter(o => o.leadId !== id)));
    } catch (e) { /* storage unavailable */ }
    if (selectedLeadForTimeline && selectedLeadForTimeline.id === id) setSelectedLeadForTimeline(null);
    setDeleteTarget(null);
    addToast('Lead deleted', 'info');
  };

  const [isApptModalOpen, setIsApptModalOpen] = useState(false);
  const [activeApptLeadId, setActiveApptLeadId] = useState(null);
  const [apptDetails, setApptDetails] = useState({
    date: '',
    time: '',
    location: '',
    remark: ''
  });

  const [selectedLeadForTimeline, setSelectedLeadForTimeline] = useState(null);
  const [timelineSortOrder, setTimelineSortOrder] = useState('desc'); // 'desc' (newest first) or 'asc' (oldest first)
  const [isRemarkModalOpen, setIsRemarkModalOpen] = useState(false);
  const [remarkLeadId, setRemarkLeadId] = useState(null);
  const [remarkNewStatus, setRemarkNewStatus] = useState('');
  const [remarkText, setRemarkText] = useState('');

  const [isGenQuoteModalOpen, setIsGenQuoteModalOpen] = useState(false);
  const [genQuoteLeadId, setGenQuoteLeadId] = useState(null);
  const [genQuoteDetails, setGenQuoteDetails] = useState({
    leadId: '',
    client: '',
    project: '',
    approvalStatus: 'Pending',
    quotationStatus: 'In Preparation',
    amount: '',
    gst: ''
  });

  const addToast = useToast();

  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [headerFilters, setHeaderFilters] = useState({
    services: 'All',
    source: 'All',
    assignTo: 'All'
  });

  // The "All Managers" dropdown (headerFilters.assignTo) scopes every overview count too,
  // not just the table — selecting a manager shows only that manager's numbers.
  const selMgr = headerFilters.assignTo;
  const byMgr = (m) => selMgr === 'All' || (m || 'Unassigned') === selMgr;
  // Date-range predicate shared by the overview counts AND the leads table, so the KPI
  // numbers always reflect the calendar range chosen at the top of the page.
  const inDateRange = (v) => {
    if (!dateRange.start || !dateRange.end) return true;
    const t = new Date(v).getTime();
    if (isNaN(t)) return true; // undated records are never hidden
    const s = new Date(dateRange.start); s.setHours(0, 0, 0, 0);
    const e = new Date(dateRange.end); e.setHours(23, 59, 59, 999);
    return t >= s.getTime() && t <= e.getTime();
  };
  const overviewLeads = leads.filter(l => byMgr(l.manager) && inDateRange(l.date || l.createdAt));
  const mgrLeadIds = new Set(overviewLeads.map(l => l.id));
  const apptFixedCount = apptRecords.filter(a => !/visit/i.test(a.type || '') && byMgr(a.manager) && inDateRange(a.date || a.createdAt)).length;
  const quotationCount = quoteRecords.filter(q => (selMgr === 'All' || mgrLeadIds.has(q.leadId)) && inDateRange(q.date || q.createdAt)).length;
  const orderConfirmedCount = projectRecords.filter(p => (selMgr === 'All' || mgrLeadIds.has(p.leadId) || (p.salesperson || '') === selMgr || (p.manager || '') === selMgr) && inDateRange(p.date || p.createdAt)).length;

  const toggleFilter = (filterName) => {
    if (statusFilter === filterName) {
      setStatusFilter('All');
    } else {
      setStatusFilter(filterName);
    }
  };

  const leadsInDateRange = leads.filter(l => inDateRange(l.date || l.createdAt));

  const filteredLeads = leadsInDateRange.filter(l => {
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchName = (l.name || '').toLowerCase().includes(q);
      const matchId = (l.id || '').toLowerCase().includes(q);
      const matchProj = (l.projectType || '').toLowerCase().includes(q);
      if (!matchName && !matchId && !matchProj) return false;
    }

    if (statusFilter !== 'All') {
      const statusLower = (l.status || '').toLowerCase();
      let matchesStatus = false;
      if (statusFilter === 'New') {
        matchesStatus = statusLower.includes('new') || statusLower.includes('received');
      } else if (statusFilter === 'Hot') {
        matchesStatus = statusLower.includes('hot');
      } else if (statusFilter === 'Warm') {
        matchesStatus = statusLower.includes('warm');
      } else if (statusFilter === 'Cold') {
        matchesStatus = statusLower.includes('cold');
      } else if (statusFilter === 'Appt. Fixed') {
        matchesStatus = statusLower.includes('appointment') || statusLower.includes('appt');
      } else if (statusFilter === 'Quotation Send') {
        matchesStatus = statusLower.includes('quot');
      } else if (statusFilter === 'Negotiation') {
        matchesStatus = statusLower.includes('negot');
      } else if (statusFilter === 'Order Confirmed') {
        matchesStatus = statusLower.includes('order');
      } else if (statusFilter === 'Junk') {
        matchesStatus = statusLower.includes('junk');
      } else if (statusFilter === 'Lost') {
        matchesStatus = statusLower.includes('lost');
      }
      if (!matchesStatus) return false;
    }

    if (headerFilters.services !== 'All') {
      if (l.projectType !== headerFilters.services) return false;
    }

    if (headerFilters.source !== 'All') {
      if (l.source !== headerFilters.source) return false;
    }

    if (headerFilters.assignTo !== 'All') {
      if (l.manager !== headerFilters.assignTo) return false;
    }

    return true;
  }).sort((a, b) => {
    // Newest first — by the real backend create/update time (never by id or name)
    const da = new Date(a.createdAt || a.updatedAt || a.date || 0).getTime();
    const db = new Date(b.createdAt || b.updatedAt || b.date || 0).getTime();
    return (isNaN(db) ? 0 : db) - (isNaN(da) ? 0 : da);
  });

  const getFormattedTimestamp = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB'); // e.g. "02/06/2026"
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false }); // e.g. "10:50:16"
    return `${dateStr}, ${timeStr}`;
  };

  const saveNote = (id) => {
    const formattedTime = getFormattedTimestamp();
    setLeads(leads.map(l => {
      if (l.id === id) {
        if (l.notes === editingNoteText) return l;
        const newHistory = [...(l.history || []), {
          timestamp: formattedTime,
          message: `Updated notes: "${editingNoteText}"`
        }];
        const updatedLead = { ...l, notes: editingNoteText, history: newHistory };
        if (selectedLeadForTimeline && selectedLeadForTimeline.id === id) {
          setSelectedLeadForTimeline(updatedLead);
        }
        return updatedLead;
      }
      return l;
    }));
    setEditingNoteId(null);
  };

  const updateLeadStatus = (id, newStatus) => {
    const lead = leads.find(l => l.id === id);
    if (!lead || lead.status === newStatus) return;

    // Apply the status change immediately so the overview counts always reflect the pick,
    // even if the details popup below is closed without submitting.
    setLeads(prev => prev.map(l => (l.id === id ? { ...l, status: newStatus } : l)));

    if (newStatus === 'Appointment Fixed') {
      setActiveApptLeadId(id);
      setIsApptModalOpen(true);
    } else if (newStatus === 'Quotation Send') {
      setGenQuoteLeadId(id);
      setGenQuoteDetails({
        leadId: lead.id,
        client: lead.name || '',
        project: lead.projectType || '',
        approvalStatus: 'Pending',
        quotationStatus: 'In Preparation',
        amount: '',
        gst: ''
      });
      setIsGenQuoteModalOpen(true);
    } else {
      setRemarkLeadId(id);
      setRemarkNewStatus(newStatus);
      setRemarkText('');
      setIsRemarkModalOpen(true);
    }
  };

  const handleRemarkSubmit = (e) => {
    e.preventDefault();
    const formattedTime = getFormattedTimestamp();

    setLeads(leads.map(l => {
      if (l.id === remarkLeadId) {
        const newHistory = [...(l.history || []), {
          timestamp: formattedTime,
          message: `Updated status to: ${remarkNewStatus.toUpperCase()}`,
          remark: remarkText.trim()
        }];
        const updatedLead = { ...l, status: remarkNewStatus, history: newHistory };
        if (selectedLeadForTimeline && selectedLeadForTimeline.id === remarkLeadId) {
          setSelectedLeadForTimeline(updatedLead);
        }
        return updatedLead;
      }
      return l;
    }));

    setIsRemarkModalOpen(false);
    setRemarkLeadId(null);
    setRemarkNewStatus('');
    setRemarkText('');
    addToast('Status updated successfully!', 'success');
  };

  const cancelRemarkModal = () => {
    setIsRemarkModalOpen(false);
    setRemarkLeadId(null);
    setRemarkNewStatus('');
    setRemarkText('');
  };

  const handleApptSubmit = (e) => {
    e.preventDefault();
    const formattedTime = getFormattedTimestamp();
    setLeads(leads.map(l => {
      if (l.id === activeApptLeadId) {
        const newHistory = [...(l.history || []), {
          timestamp: formattedTime,
          message: `Updated status to: APPT FIXED`,
          remark: apptDetails.remark ? apptDetails.remark.trim() : undefined
        }];
        const updatedLead = { 
          ...l, 
          status: 'Appointment Fixed', 
          followUp: `${apptDetails.date}, ${apptDetails.time}`,
          appointmentLocation: apptDetails.location,
          appointmentRemark: apptDetails.remark,
          history: newHistory
        };
        if (selectedLeadForTimeline && selectedLeadForTimeline.id === activeApptLeadId) {
          setSelectedLeadForTimeline(updatedLead);
        }
        return updatedLead;
      }
      return l;
    }));
    setIsApptModalOpen(false);
    setActiveApptLeadId(null);
    setApptDetails({ date: '', time: '', location: '', remark: '' });
  };

  const cancelApptModal = () => {
    setIsApptModalOpen(false);
    setActiveApptLeadId(null);
    setApptDetails({ date: '', time: '', location: '', remark: '' });
  };

  const handleGenQuoteSubmit = (e) => {
    e.preventDefault();
    const formattedTime = getFormattedTimestamp();

    // Ensure amount and gst have ₹ symbol
    const formattedAmount = genQuoteDetails.amount.startsWith('₹') ? genQuoteDetails.amount : `₹${genQuoteDetails.amount}`;
    const formattedGst = genQuoteDetails.gst.startsWith('₹') ? genQuoteDetails.gst : `₹${genQuoteDetails.gst}`;

    // Read existing quotes from localStorage to calculate new ID
    const initialQuotesDataFallback = [
      { id: 'QT-5001', leadId: 'LD-1001', client: 'Acme Corp', project: 'PEB', amount: '₹500,000', gst: '₹90,000', approvalStatus: 'Approved', quotationStatus: 'Prepared', revision: 'Rev 1', fileName: 'acme_renovation_final.pdf' },
      { id: 'QT-5002', leadId: 'LD-1002', client: 'John Doe', project: 'Tensile', amount: '₹150,000', gst: '₹27,000', approvalStatus: 'Pending', quotationStatus: 'Prepared', revision: 'Rev 3', fileName: null },
      { id: 'QT-5003', leadId: 'LD-1003', client: 'Stark Industries', project: 'Other roofing', amount: '₹1,200,000', gst: '₹216,000', approvalStatus: 'Pending', quotationStatus: 'In Preparation', revision: 'Rev 0', fileName: null },
      { id: 'QT-5004', leadId: 'LD-1004', client: 'Wayne Enterprises', project: 'PEB', amount: '₹850,000', gst: '₹153,000', approvalStatus: 'Approved', quotationStatus: 'Prepared', revision: 'Rev 2', fileName: 'wayne_manor_proposal.pdf' },
      { id: 'QT-5005', leadId: 'LD-1005', client: 'Oscorp Labs', project: 'Tensile', amount: '₹320,000', gst: '₹57,600', approvalStatus: 'Approved', quotationStatus: 'Prepared', revision: 'Rev 1', fileName: null },
      { id: 'QT-5006', leadId: 'LD-1006', client: 'LexCorp', project: 'Other roofing', amount: '₹450,000', gst: '₹81,000', approvalStatus: 'Pending', quotationStatus: 'In Preparation', revision: 'Rev 1', fileName: null },
    ];
    const savedQuotesStr = localStorage.getItem('crm_quotes');
    const existingQuotes = savedQuotesStr ? JSON.parse(savedQuotesStr) : initialQuotesDataFallback;
    const maxQuoteNum = existingQuotes.reduce((max, q) => { const n = parseInt((q.id || '').replace('QT-', ''), 10); return isNaN(n) ? max : Math.max(max, n); }, 5000);
    const newQuoteId = `QT-${maxQuoteNum + 1}`;

    // Append new quote to quotes list in localStorage
    const newQuoteObj = {
      id: newQuoteId,
      leadId: genQuoteLeadId,
      client: genQuoteDetails.client,
      project: genQuoteDetails.project,
      amount: formattedAmount,
      gst: formattedGst,
      approvalStatus: genQuoteDetails.approvalStatus,
      quotationStatus: genQuoteDetails.quotationStatus,
      revision: 'Rev 0',
      fileName: null
    };
    const updatedQuotes = [...existingQuotes, newQuoteObj];
    // Strip any base64 file data and guard the write so a full localStorage quota can never
    // throw here (a few uploaded PDFs would otherwise exceed the ~5MB limit).
    try {
      localStorage.setItem('crm_quotes', JSON.stringify(updatedQuotes.map(({ fileData, ...rest }) => rest)));
    } catch (e) {
      console.warn('Skipped caching quotations to localStorage:', e && e.message);
    }

    // Persist the new quotation to the backend API (so dashboard/Quotations page show it)
    fetch('https://api-salescoordinator.tescomanagement.com/api/quotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newQuoteObj)
    }).catch(err => console.error('Failed to save quotation to API:', err));

    // Update the lead's status & history timeline log
    setLeads(leads.map(l => {
      if (l.id === genQuoteLeadId) {
        const historyMessage = `Generated quotation ${newQuoteId} - Amount: ${formattedAmount}, Approval: ${genQuoteDetails.approvalStatus}, Status: ${genQuoteDetails.quotationStatus}`;
        const newHistory = [...(l.history || []), {
          timestamp: formattedTime,
          message: `Updated status to: QUOTATION SEND`,
          remark: historyMessage
        }];
        const updatedLead = { ...l, status: 'Quotation Send', history: newHistory };
        if (selectedLeadForTimeline && selectedLeadForTimeline.id === genQuoteLeadId) {
          setSelectedLeadForTimeline(updatedLead);
        }
        return updatedLead;
      }
      return l;
    }));

    setIsGenQuoteModalOpen(false);
    setGenQuoteLeadId(null);
    setGenQuoteDetails({
      leadId: '',
      client: '',
      project: '',
      approvalStatus: 'Pending',
      quotationStatus: 'In Preparation',
      amount: '',
      gst: ''
    });

    addToast('Quotation generated successfully!', 'success');
  };

  const cancelGenQuoteModal = () => {
    setIsGenQuoteModalOpen(false);
    setGenQuoteLeadId(null);
    setGenQuoteDetails({
      leadId: '',
      client: '',
      project: '',
      approvalStatus: 'Pending',
      quotationStatus: 'In Preparation',
      amount: '',
      gst: ''
    });
  };

  const updateLeadManager = (id, newManager) => {
    const formattedTime = getFormattedTimestamp();
    setLeads(leads.map(l => {
      if (l.id === id) {
        if (l.manager === newManager) return l;
        const newHistory = [...(l.history || []), {
          timestamp: formattedTime,
          message: `Updated assignTo to: ${newManager}`
        }];
        const updatedLead = { ...l, manager: newManager, history: newHistory };
        if (selectedLeadForTimeline && selectedLeadForTimeline.id === id) {
          setSelectedLeadForTimeline(updatedLead);
        }
        return updatedLead;
      }
      return l;
    }));
  };

  const updateLeadDesignReq = (id, newValue) => {
    const formattedTime = getFormattedTimestamp();
    setLeads(leads.map(l => {
      if (l.id === id) {
        if ((l.designReq || '') === newValue) return l;
        const newHistory = [...(l.history || []), {
          timestamp: formattedTime,
          message: newValue ? `Updated design requirement to: ${newValue}` : 'Cleared design requirement'
        }];
        const updatedLead = { ...l, designReq: newValue, history: newHistory };
        if (selectedLeadForTimeline && selectedLeadForTimeline.id === id) {
          setSelectedLeadForTimeline(updatedLead);
        }
        return updatedLead;
      }
      return l;
    }));
  };

  const updateLeadSource = (id, newSource) => {
    const formattedTime = getFormattedTimestamp();
    setLeads(leads.map(l => {
      if (l.id === id) {
        if (l.source === newSource) return l;
        const newHistory = [...(l.history || []), {
          timestamp: formattedTime,
          message: `Updated source to: ${newSource.toUpperCase()}`
        }];
        const updatedLead = { ...l, source: newSource, history: newHistory };
        if (selectedLeadForTimeline && selectedLeadForTimeline.id === id) {
          setSelectedLeadForTimeline(updatedLead);
        }
        return updatedLead;
      }
      return l;
    }));
  };

  const handleAddLead = (e) => {
    e.preventDefault();
    // Only count the real sequential LD-#### ids; ignore any legacy timestamp ids (13-digit)
    // so the sequence continues correctly (…LD-0017 -> LD-0018) instead of jumping to a huge number.
    const maxIdNum = leads.reduce((max, l) => { const n = parseInt((l.id || '').replace(/\D/g, ''), 10); return (isNaN(n) || n >= 1000000) ? max : Math.max(max, n); }, 0);
    const newId = `LD-${String(maxIdNum + 1).padStart(4, '0')}`;
    const formattedTime = getFormattedTimestamp();
    
    const leadToAdd = {
      ...newLead,
      id: newId,
      type: 'new leads',
      manager: 'Unassigned',
      followUp: 'Pending',
      priority: 'Medium',
      history: [
        { timestamp: formattedTime, message: `Lead created from ${newLead.source || 'Manual Form'}` }
      ]
    };

    setLeads([...leads, leadToAdd]);
    setIsModalOpen(false);
    setNewLead({
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      name: '', projectType: '', phone: '', budget: '', source: '', status: 'Lead Received', notes: ''
    });
  };

  // Map a wizard status back to the table/lead status value
  const WIZARD_STATUS_TO_TABLE = {
    'New': 'New Lead', 'Hot': 'Hot Leads', 'Warm': 'Warm Leads', 'Cold': 'Cold Leads',
    'Appt. Fixed': 'Appointment Fixed', 'Quotation Send': 'Quotation Send',
    'Order Confirmed': 'Order Confirmed', 'Junk': 'Junk', 'Lost': 'Lost',
  };

  // Keep a lead's Sales Pipeline entry in sync. A lead only appears in the
  // pipeline when it has a Project Value; here we remove its old entry and,
  // if a value is present, add a fresh one tagged with the lead id.
  const syncPipelineForLead = (leadId, data) => {
    let extras = [];
    try { extras = JSON.parse(localStorage.getItem('crm_pipeline_extra') || '[]'); } catch (e) { extras = []; }
    // Drop any existing entry for this lead so we never duplicate on edit
    extras = extras.filter(o => o.leadId !== leadId);

    if (data.budget && String(data.budget).trim() !== '') {
      const numVal = parseFloat(String(data.budget).replace(/[^\d.]/g, '')) || 0;
      const maxOpNum = extras.reduce((m, o) => {
        const n = parseInt(String(o.id).replace(/\D/g, ''), 10);
        return isNaN(n) ? m : Math.max(m, n);
      }, 1000);
      const stageMap = { 'Appt. Fixed': 'Appointment Fixed', 'Quotation Send': 'Warm', 'Order Confirmed': 'Appointment Fixed', 'Junk': 'Cold' };
      const stage = ['New', 'Hot', 'Warm', 'Cold', 'Lost'].includes(data.status) ? data.status : (stageMap[data.status] || 'New');
      const fmtDate = (d) => {
        if (!d || d === 'Pending') return '-';
        const dt = new Date(d);
        return isNaN(dt.getTime()) ? '-' : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      };
      const opportunity = {
        id: `OP-${maxOpNum + 1}`,
        leadId,
        customer: data.name,
        service: data.projectType || '-',
        stage,
        assignedTo: data.manager || 'Unassigned',
        expectedClose: fmtDate(data.followUp),
        value: numVal,
        lastActivity: 'Today',
        followUp: (data.followUp && data.followUp !== 'Pending') ? data.followUp : ''
      };
      extras = [opportunity, ...extras];
    }
    try { localStorage.setItem('crm_pipeline_extra', JSON.stringify(extras)); } catch (e) { /* storage unavailable */ }
  };

  // Save handler for the multi-step Add New Lead wizard (handles both create and edit)
  const handleWizardSave = (data) => {
    const formattedTime = getFormattedTimestamp();

    // ----- EDIT MODE: update the existing lead in place -----
    if (data._editId) {
      const id = data._editId;
      setLeads(leads.map(l => {
        if (l.id !== id) return l;
        const updatedLead = {
          ...l,
          name: data.name,
          company: data.company,
          phone: data.phone,
          email: data.email,
          projectType: data.projectType,
          location: data.location,
          budget: data.budget,
          source: data.source,
          status: WIZARD_STATUS_TO_TABLE[data.status] || l.status,
          notes: data.notes,
          manager: data.manager || l.manager || 'Unassigned',
          followUp: data.followUp || l.followUp || 'Pending',
          _wizard: data._wizard,
          history: [...(l.history || []), { timestamp: formattedTime, message: 'Lead details updated via edit form' }]
        };
        if (selectedLeadForTimeline && selectedLeadForTimeline.id === id) {
          setSelectedLeadForTimeline(updatedLead);
        }
        return updatedLead;
      }));
      syncPipelineForLead(id, data);
      setEditLead(null);
      setIsModalOpen(false);
      addToast('Lead updated successfully!', 'success');
      return;
    }

    // ----- CREATE MODE: add a brand-new lead -----
    // Only count the real sequential LD-#### ids; ignore any legacy timestamp ids (13-digit)
    // so the sequence continues correctly (…LD-0017 -> LD-0018) instead of jumping to a huge number.
    const maxIdNum = leads.reduce((max, l) => { const n = parseInt((l.id || '').replace(/\D/g, ''), 10); return (isNaN(n) || n >= 1000000) ? max : Math.max(max, n); }, 0);
    const newId = `LD-${String(maxIdNum + 1).padStart(4, '0')}`;

    const leadToAdd = {
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      id: newId,
      name: data.name,
      company: data.company,
      phone: data.phone,
      email: data.email,
      projectType: data.projectType,
      location: data.location,
      budget: data.budget,
      source: data.source,
      status: WIZARD_STATUS_TO_TABLE[data.status] || data.status,
      notes: data.notes,
      type: 'new leads',
      manager: data.manager || 'Unassigned',
      followUp: data.followUp || 'Pending',
      priority: 'Medium',
      history: [
        { timestamp: formattedTime, message: `Lead created from ${data.source || 'Manual Form'}` }
      ]
    };

    setLeads([...leads, leadToAdd]);

    // If a Project Value was entered on the Quotations step, also add this lead to the Sales Pipeline
    syncPipelineForLead(newId, data);

    setEditLead(null);
    setIsModalOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <style>{`
        .lead-row {
          transition: background-color 0.15s ease;
        }
        .lead-row:hover {
          background-color: rgba(79, 70, 229, 0.03) !important;
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeInBackdrop {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-0.5px' }}>Lead Management</h2>
        <button className="btn btn-primary" style={{ padding: '0.7rem 1.4rem', fontSize: '0.9rem', borderRadius: '0.7rem' }} onClick={() => { setEditLead(null); setIsModalOpen(true); }}>Add New Lead</button>
      </div>

      {/* Filter row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', position: 'relative', zIndex: 40 }}>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setIsCalendarOpen(!isCalendarOpen)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'var(--surface-color)', padding: '0.7rem 1.15rem', borderRadius: '0.65rem', border: '1px solid var(--border-color)', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-main)', outline: 'none', whiteSpace: 'nowrap' }}
          >
            <Calendar size={16} color="var(--primary-color)" />
            <span>
              {selectedPreset === 'Custom'
                ? `${formatDateDisplay(dateRange.start)} - ${formatDateDisplay(dateRange.end)}`
                : `${selectedPreset}${dateRange.start ? ` (${formatDateDisplay(dateRange.start)} - ${formatDateDisplay(dateRange.end)})` : ''}`}
            </span>
            <ChevronRight size={14} style={{ transform: isCalendarOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', opacity: 0.7 }} />
          </button>

          {isCalendarOpen && (
            <div style={{ position: 'absolute', top: '52px', left: 0, backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', display: 'flex', zIndex: 100, overflow: 'hidden', minWidth: '460px' }}>
              <div style={{ width: '160px', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', backgroundColor: '#F8FAFC', padding: '0.5rem 0' }}>
                {['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'This Month', 'Custom'].map(preset => (
                  <button key={preset} type="button" onClick={() => applyPreset(preset)} style={{ padding: '0.6rem 1rem', border: 'none', textAlign: 'left', fontSize: '0.8125rem', fontWeight: selectedPreset === preset ? '600' : '500', color: selectedPreset === preset ? 'var(--primary-color)' : 'var(--text-muted)', backgroundColor: selectedPreset === preset ? '#EEF2FF' : 'transparent', cursor: 'pointer', width: '100%' }}>{preset}</button>
                ))}
              </div>
              <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '300px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <button type="button" onClick={prevMonth} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '4px' }}><ChevronLeft size={16} /></button>
                  <span style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-main)', userSelect: 'none' }}>{currentNavDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                  <button type="button" onClick={nextMonth} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '4px' }}><ChevronRight size={16} /></button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '4px' }}>
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (<span key={d} style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)' }}>{d}</span>))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                  {getDaysInMonth(currentNavDate).map((day, idx) => {
                    if (!day) return <div key={`empty-${idx}`}></div>;
                    const isSel = isSelected(day);
                    const isInRange = isRange(day);
                    const isToday = day.toDateString() === new Date().toDateString();
                    return (
                      <button key={idx} type="button" onClick={() => handleDayClick(day)} style={{ padding: '0.35rem 0', fontSize: '0.75rem', fontWeight: isSel || isToday ? '700' : '500', border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: isSel ? 'var(--primary-color)' : isInRange ? '#EEF2FF' : 'transparent', color: isSel ? 'white' : isInRange ? 'var(--primary-color)' : isToday ? 'var(--primary-color)' : 'var(--text-main)', boxShadow: isToday && !isSel ? 'inset 0 0 0 1px var(--primary-color)' : 'none' }} title={day.toLocaleDateString()}>{day.getDate()}</button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <select
            value={headerFilters.assignTo}
            onChange={(e) => setHeaderFilters({ ...headerFilters, assignTo: e.target.value })}
            style={{ background: 'var(--surface-color)', padding: '0.7rem 2.4rem 0.7rem 1.15rem', borderRadius: '0.65rem', border: '1px solid var(--border-color)', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-main)', outline: 'none', appearance: 'none', WebkitAppearance: 'none' }}
          >
            <option value="All">All Managers</option>
            <option value="Unassigned">Unassigned</option>
            {managerList.map((name) => (<option key={name} value={name}>{name}</option>))}
          </select>
          <ChevronDown size={16} color="var(--text-muted)" style={{ position: 'absolute', right: '0.9rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        </div>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
          <input type="text" placeholder="Search leads..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ padding: '0.6rem 1rem 0.6rem 2.5rem', borderRadius: '0.65rem', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)', outline: 'none', width: '240px' }} />
        </div>
      </div>

      {/* Overview Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '700', color: 'var(--text-main)' }}>Overview</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
          {/* Row 1 */}
          <LeadOverviewCard
            title="Total Leads"
            value={overviewLeads.length}
            subtitle="All leads in system"
            icon={Users}
            color="#4F46E5"
            bg="#EEF4FF"
            borderColor="#C7D2FE"
            isSelected={statusFilter === 'All'}
            onClick={() => toggleFilter('All')}
          />
          <LeadOverviewCard
            title="New Leads"
            value={overviewLeads.filter(l => {
              const s = (l.status||'').toLowerCase();
              return s.includes('new') || s.includes('received');
            }).length}
            subtitle="Freshly received"
            icon={Sparkles}
            color="#0EA5E9"
            bg="#F0F9FF"
            borderColor="#BAE6FD"
            isSelected={statusFilter === 'New'}
            onClick={() => toggleFilter('New')}
          />
          <LeadOverviewCard
            title="Hot Leads"
            value={overviewLeads.filter(l => (l.status||'').toLowerCase().includes('hot')).length}
            subtitle="High conversion chance"
            icon={Flame}
            color="#E11D48"
            bg="#FFF1F2"
            borderColor="#FECDD3"
            isSelected={statusFilter === 'Hot'}
            onClick={() => toggleFilter('Hot')}
          />
          <LeadOverviewCard
            title="Warm Leads"
            value={overviewLeads.filter(l => (l.status||'').toLowerCase().includes('warm')).length}
            subtitle="Nurturing in progress"
            icon={Thermometer}
            color="#F97316"
            bg="#FFF7ED"
            borderColor="#FED7AA"
            isSelected={statusFilter === 'Warm'}
            onClick={() => toggleFilter('Warm')}
          />
          <LeadOverviewCard
            title="Cold Leads"
            value={overviewLeads.filter(l => (l.status||'').toLowerCase().includes('cold')).length}
            subtitle="Need re-engagement"
            icon={Snowflake}
            color="#64748B"
            bg="#F8FAFC"
            borderColor="#CBD5E1"
            isSelected={statusFilter === 'Cold'}
            onClick={() => toggleFilter('Cold')}
          />
          {/* Row 2 */}
          <LeadOverviewCard
            title="Appt. Fixed"
            value={apptFixedCount}
            subtitle="Meetings scheduled"
            icon={CalendarCheck}
            color="#22C55E"
            bg="#ECFDF5"
            borderColor="#BBF7D0"
            isSelected={statusFilter === 'Appt. Fixed'}
            onClick={() => toggleFilter('Appt. Fixed')}
          />
          <LeadOverviewCard
            title="Quotation Send"
            value={quotationCount}
            subtitle="Awaiting response"
            icon={FileText}
            color="#8B5CF6"
            bg="#F5F3FF"
            borderColor="#DDD6FE"
            isSelected={statusFilter === 'Quotation Send'}
            onClick={() => toggleFilter('Quotation Send')}
          />
          <LeadOverviewCard
            title="Order Confirmed"
            value={orderConfirmedCount}
            subtitle="Successfully closed"
            icon={CheckCircle2}
            color="#16A34A"
            bg="#DCFCE7"
            borderColor="#86EFAC"
            isSelected={statusFilter === 'Order Confirmed'}
            onClick={() => toggleFilter('Order Confirmed')}
          />
          <LeadOverviewCard
            title="Junk"
            value={overviewLeads.filter(l => (l.status||'').toLowerCase().includes('junk')).length}
            subtitle="Unqualified leads"
            icon={Trash2}
            color="#94A3B8"
            bg="#F1F5F9"
            borderColor="#E2E8F0"
            isSelected={statusFilter === 'Junk'}
            onClick={() => toggleFilter('Junk')}
          />
          <LeadOverviewCard
            title="Lost"
            value={overviewLeads.filter(l => (l.status||'').toLowerCase().includes('lost')).length}
            subtitle="Unconverted leads"
            icon={XCircle}
            color="#EF4444"
            bg="#FEF2F2"
            borderColor="#FECACA"
            isSelected={statusFilter === 'Lost'}
            onClick={() => toggleFilter('Lost')}
          />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{ width: '100%', minWidth: '1100px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: '#F1F5F9', borderBottom: '1px solid var(--border-color)' }}>
              <tr>
                 <th style={{ padding: '0.75rem 1rem', fontWeight: '600', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>Date</th>
                 <th style={{ padding: '0.75rem 1rem', fontWeight: '600', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>Lead ID</th>
                 <th style={{ padding: '0.75rem 1rem', fontWeight: '600', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>Customer Name</th>
                 <th style={{ padding: '0.75rem 1rem', fontWeight: '600', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>Work Type</th>
                 <th style={{ padding: '0.75rem 1rem', fontWeight: '600', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>Project Location</th>
                 <th style={{ padding: '0.75rem 1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <select
                    value={headerFilters.services}
                    onChange={(e) => setHeaderFilters({ ...headerFilters, services: e.target.value })}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      outline: 'none',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2364748B%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 0px center',
                      backgroundSize: '0.45rem auto',
                      paddingRight: '0.75rem',
                      textAlignLast: 'center',
                      fontFamily: 'inherit'
                    }}
                  >
                    <option value="All" style={{ color: 'var(--text-main)' }}>SERVICES (ALL)</option>
                    <option value="PEB" style={{ color: 'var(--text-main)' }}>PEB</option>
                    <option value="Tensile" style={{ color: 'var(--text-main)' }}>TENSILE</option>
                    <option value="Other roofing" style={{ color: 'var(--text-main)' }}>OTHER ROOFING</option>
                  </select>
                </th>
                 <th style={{ padding: '0.75rem 1rem', fontWeight: '600', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>Project Value</th>
                 <th style={{ padding: '0.75rem 1rem', fontWeight: '600', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>Phone Number</th>
                 <th style={{ padding: '0.75rem 1rem', fontWeight: '600', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>Email</th>
                 <th style={{ padding: '0.75rem 1rem', fontWeight: '600', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>Campaign</th>
                 <th style={{ padding: '0.75rem 1rem', fontWeight: '600', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>City</th>
                 <th style={{ padding: '0.75rem 1rem', fontWeight: '600', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>Expected Start</th>
                 <th style={{ padding: '0.75rem 1rem', fontWeight: '600', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>Area (sq ft)</th>
                 <th style={{ padding: '0.75rem 1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <select
                    value={headerFilters.source}
                    onChange={(e) => setHeaderFilters({ ...headerFilters, source: e.target.value })}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      outline: 'none',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2364748B%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 0px center',
                      backgroundSize: '0.45rem auto',
                      paddingRight: '0.75rem',
                      textAlignLast: 'center',
                      fontFamily: 'inherit'
                    }}
                  >
                    <option value="All" style={{ color: 'var(--text-main)' }}>LEAD SOURCE (ALL)</option>
                    {LEAD_SOURCES.map(src => (
                      <option key={src} value={src} style={{ color: 'var(--text-main)' }}>{src.toUpperCase()}</option>
                    ))}
                  </select>
                </th>
                 <th style={{ padding: '0.75rem 1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      outline: 'none',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2364748B%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 0px center',
                      backgroundSize: '0.45rem auto',
                      paddingRight: '0.75rem',
                      textAlignLast: 'center',
                      fontFamily: 'inherit'
                    }}
                  >
                    <option value="All" style={{ color: 'var(--text-main)' }}>STATUS (ALL)</option>
                    <option value="New" style={{ color: 'var(--text-main)' }}>NEW LEAD</option>
                    <option value="Hot" style={{ color: 'var(--text-main)' }}>HOT</option>
                    <option value="Warm" style={{ color: 'var(--text-main)' }}>WARM</option>
                    <option value="Cold" style={{ color: 'var(--text-main)' }}>COLD</option>
                    <option value="Appt. Fixed" style={{ color: 'var(--text-main)' }}>APPT FIXED</option>
                    <option value="Quotation Send" style={{ color: 'var(--text-main)' }}>QUOTATION SEND</option>
                    <option value="Order Confirmed" style={{ color: 'var(--text-main)' }}>ORDER CONFIRMED</option>
                    <option value="Junk" style={{ color: 'var(--text-main)' }}>JUNK</option>
                    <option value="Lost" style={{ color: 'var(--text-main)' }}>LOST</option>
                  </select>
                </th>
                 <th style={{ padding: '0.75rem 1rem', fontWeight: '600', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>Design Req</th>
                 <th style={{ padding: '0.75rem 1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <select
                    value={headerFilters.assignTo}
                    onChange={(e) => setHeaderFilters({ ...headerFilters, assignTo: e.target.value })}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      outline: 'none',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2364748B%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 0px center',
                      backgroundSize: '0.45rem auto',
                      paddingRight: '0.75rem',
                      textAlignLast: 'center',
                      fontFamily: 'inherit'
                    }}
                  >
                    <option value="All" style={{ color: 'var(--text-main)' }}>ASSIGN TO (ALL)</option>
                    <option value="Unassigned" style={{ color: 'var(--text-main)' }}>UNASSIGNED</option>
                    {managerList.map((name) => (
                      <option key={name} value={name} style={{ color: 'var(--text-main)' }}>{name.toUpperCase()}</option>
                    ))}
                  </select>
                </th>
                 <th style={{ padding: '0.75rem 1rem', fontWeight: '600', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>Follow-up</th>
                 <th style={{ padding: '0.75rem 1rem', fontWeight: '600', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>Actions</th>
                 <th style={{ padding: '0.75rem 1rem', fontWeight: '600', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.map((lead, index) => (
              <React.Fragment key={lead.id}>
              <tr
                onClick={() => setSelectedLeadForTimeline(lead)}
                className="lead-row"
                style={{
                  borderBottom: index === leads.length - 1 ? 'none' : '1px solid var(--border-color)',
                  cursor: 'pointer'
                }}
              >
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>{lead.date}</td>
                <td
                  style={{
                    padding: '0.75rem 1rem',
                    fontSize: '0.8125rem',
                    fontWeight: '600',
                    color: 'var(--secondary-color)',
                    textAlign: 'center',
                    whiteSpace: 'nowrap'
                  }}
                  title="Lead ID"
                >
                  {lead.id}
                </td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', fontWeight: '600', textAlign: 'center', whiteSpace: 'nowrap' }}>{lead.name}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>{lead.workType || '-'}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>{lead.location || '-'}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-main)', textAlign: 'center', whiteSpace: 'nowrap' }}>{lead.projectType}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', fontWeight: '600', color: 'var(--text-main)', textAlign: 'center', whiteSpace: 'nowrap' }}>{lead.budget || '-'}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>{lead.phone}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>{lead.email || '-'}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>{lead.campaign || '-'}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>{lead.city || '-'}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>{lead.timeline ? String(lead.timeline).replace(/_/g, ' ') : '-'}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>{lead.area ? String(lead.area).replace(/_/g, ' ') : '-'}</td>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'center', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: getSourceStyles(canonSource(lead.source)).bg, borderRadius: '9999px', padding: '0.2rem 0.1rem 0.2rem 0.6rem' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: getSourceStyles(canonSource(lead.source)).dot, flexShrink: 0 }} />
                    <select
                      value={canonSource(lead.source)}
                      onChange={(e) => updateLeadSource(lead.id, e.target.value)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        outline: 'none',
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        color: getSourceStyles(canonSource(lead.source)).color,
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                        letterSpacing: '0.4px',
                        paddingRight: '1.2rem',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23${getSourceStyles(canonSource(lead.source)).color.replace('#', '')}%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 0.25rem center',
                        backgroundSize: '0.55rem auto',
                      }}
                    >
                      {LEAD_SOURCES.map(src => (
                        <option key={src} value={src}>{src.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                </td>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'center', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                  <select
                    value={canonStatus(lead.status)}
                    onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                    style={{
                      padding: '0.25rem 1.5rem 0.25rem 0.75rem',
                      borderRadius: '9999px',
                      border: '1px solid transparent',
                      fontSize: '0.65rem',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      backgroundColor: getStatusStyles(canonStatus(lead.status)).bg,
                      color: getStatusStyles(canonStatus(lead.status)).color,
                      cursor: 'pointer',
                      outline: 'none',
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23${getStatusStyles(canonStatus(lead.status)).color.replace('#', '')}%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 0.5rem center',
                      backgroundSize: '0.65rem auto'
                    }}
                  >
                    <option value="New Lead">NEW LEAD</option>
                    <option value="Hot Leads">HOT</option>
                    <option value="Warm Leads">WARM</option>
                    <option value="Cold Leads">COLD</option>
                    <option value="Appointment Fixed">APPT FIXED</option>
                    <option value="Quotation Send">QUOTATION SEND</option>
                    <option value="Order Confirmed">ORDER CONFIRMED</option>
                    <option value="Junk">JUNK</option>
                    <option value="Lost">LOST</option>
                  </select>
                </td>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'center', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                  <select
                    value={lead.designReq || ''}
                    onChange={(e) => updateLeadDesignReq(lead.id, e.target.value)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.8125rem',
                      backgroundColor: 'var(--surface-color)',
                      color: lead.designReq ? 'var(--text-main)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="">Select</option>
                    <option value="2D Design">2D Design</option>
                    <option value="3D Design">3D Design</option>
                    <option value="Both">Both</option>
                  </select>
                </td>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'center', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                  <select
                    value={lead.manager}
                    onChange={(e) => updateLeadManager(lead.id, e.target.value)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.8125rem',
                      backgroundColor: 'var(--surface-color)',
                      color: 'var(--text-main)',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="Unassigned">Unassigned</option>
                    {managerList.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'center', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="datetime-local"
                    title={fmtFollowUp(lead.followUp)}
                    value={toDateInputValue(lead.followUp)}
                    onChange={(e) => updateLeadFollowUp(lead.id, e.target.value)}
                    style={{
                      padding: '0.35rem 0.5rem',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md, 6px)',
                      fontSize: '0.8125rem',
                      color: 'var(--text-main)',
                      background: 'var(--surface-color)',
                      outline: 'none',
                      fontFamily: 'inherit',
                      cursor: 'pointer'
                    }}
                  />
                </td>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'center', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                    <button
                      title="Timeline & Notes"
                      onClick={(e) => { e.stopPropagation(); setSelectedLeadForTimeline(lead); }}
                      style={{
                        background: 'var(--primary-color)',
                        border: 'none',
                        color: 'white',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'transform 0.15s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <Activity size={12} />
                    </button>
                    <button title="Edit" onClick={() => openEditModal(lead)} style={{ background: '#E0E7FF', border: 'none', color: 'var(--primary-color)', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <Edit2 size={12} />
                    </button>
                    <button title="Download" onClick={(e) => { e.stopPropagation(); downloadLead(lead); }} style={{ background: '#DCFCE7', border: 'none', color: '#166534', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <Download size={12} />
                    </button>
                  </div>
                </td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '120px' }} onClick={(e) => e.stopPropagation()}>
                  {editingNoteId === lead.id ? (
                    <input
                      autoFocus
                      type="text"
                      value={editingNoteText}
                      onChange={(e) => setEditingNoteText(e.target.value)}
                      onBlur={() => saveNote(lead.id)}
                      onKeyDown={(e) => e.key === 'Enter' && saveNote(lead.id)}
                      style={{ width: '100%', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid var(--primary-color)', outline: 'none', fontSize: '0.8125rem' }}
                    />
                  ) : (
                    <div
                      onClick={() => { setEditingNoteId(lead.id); setEditingNoteText(lead.notes || ''); }}
                      title="Click to edit notes"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden' }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.notes || 'Add note...'}</span>
                      <Edit2 size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
                    </div>
                  )}
                </td>
              </tr>

              </React.Fragment>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Add New Lead / Edit Lead Wizard */}
      <AddLeadWizard
        isOpen={isModalOpen}
        editLead={editLead}
        onClose={() => { setIsModalOpen(false); setEditLead(null); }}
        onSave={handleWizardSave}
      />


      {/* Generate Quotation Modal */}
      {isGenQuoteModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          animation: 'fadeInBackdrop 0.25s ease-out'
        }}>
          <div className="card" style={{ 
            width: '100%', 
            maxWidth: '560px', 
            padding: '2rem', 
            animation: 'scaleIn 0.25s ease-out',
            backgroundColor: 'var(--surface-color)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            borderRadius: 'var(--radius-lg)'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
              <h3 style={{ 
                margin: 0, 
                fontSize: '1.5rem', 
                fontFamily: 'Poppins, sans-serif', 
                color: '#1E293B', 
                fontWeight: '700' 
              }}>
                Generate Quotation
              </h3>
              <button 
                onClick={cancelGenQuoteModal} 
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer', 
                  color: 'var(--text-muted)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  padding: '0.25rem', 
                  borderRadius: '50%', 
                  transition: 'background-color 0.2s' 
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F1F5F9'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleGenQuoteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Row 1: Lead ID | Client Name */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', color: '#64748B' }}>
                    Lead ID
                  </label>
                  <input 
                    readOnly 
                    value={genQuoteDetails.leadId} 
                    type="text" 
                    placeholder="e.g. LD-1007" 
                    style={{ 
                      width: '100%', 
                      padding: '0.625rem 0.875rem', 
                      borderRadius: 'var(--radius-md)', 
                      border: '1px solid var(--border-color)', 
                      outline: 'none',
                      backgroundColor: '#F8FAFC',
                      color: '#64748B',
                      cursor: 'not-allowed',
                      fontSize: '0.875rem'
                    }} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', color: '#64748B' }}>
                    Client Name
                  </label>
                  <input 
                    required 
                    value={genQuoteDetails.client} 
                    onChange={(e) => setGenQuoteDetails({...genQuoteDetails, client: e.target.value})} 
                    type="text" 
                    placeholder="e.g. Acme Corp" 
                    style={{ 
                      width: '100%', 
                      padding: '0.625rem 0.875rem', 
                      borderRadius: 'var(--radius-md)', 
                      border: '1px solid var(--border-color)', 
                      outline: 'none',
                      fontSize: '0.875rem',
                      color: 'var(--text-main)',
                      transition: 'border-color 0.2s'
                    }} 
                    onFocus={(e) => e.target.style.borderColor = 'var(--secondary-color)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                  />
                </div>
              </div>

              {/* Row 2: Services */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', color: '#64748B' }}>
                  Services
                </label>
                <select 
                  required 
                  value={genQuoteDetails.project} 
                  onChange={(e) => setGenQuoteDetails({...genQuoteDetails, project: e.target.value})} 
                  style={{ 
                    width: '100%', 
                    padding: '0.625rem 0.875rem', 
                    borderRadius: 'var(--radius-md)', 
                    border: '1px solid var(--border-color)', 
                    backgroundColor: 'var(--surface-color)', 
                    color: 'var(--text-main)', 
                    outline: 'none',
                    fontSize: '0.875rem',
                    transition: 'border-color 0.2s',
                    cursor: 'pointer'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--secondary-color)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                >
                  <option value="">Select type</option>
                  <option value="PEB">PEB</option>
                  <option value="Tensile">Tensile</option>
                  <option value="Other roofing">Other roofing</option>
                </select>
              </div>

              {/* Row 4: Amount | GST Amount */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', color: '#64748B' }}>
                    Amount (ex. GST)
                  </label>
                  <input 
                    required 
                    value={genQuoteDetails.amount} 
                    onChange={(e) => setGenQuoteDetails({...genQuoteDetails, amount: e.target.value})} 
                    type="text" 
                    placeholder="e.g. ₹100,000" 
                    style={{ 
                      width: '100%', 
                      padding: '0.625rem 0.875rem', 
                      borderRadius: 'var(--radius-md)', 
                      border: '1px solid var(--border-color)',
                      outline: 'none',
                      fontSize: '0.875rem',
                      color: 'var(--text-main)',
                      transition: 'border-color 0.2s'
                    }} 
                    onFocus={(e) => e.target.style.borderColor = 'var(--secondary-color)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', color: '#64748B' }}>
                    GST Amount
                  </label>
                  <input 
                    required 
                    value={genQuoteDetails.gst} 
                    onChange={(e) => setGenQuoteDetails({...genQuoteDetails, gst: e.target.value})} 
                    type="text" 
                    placeholder="e.g. ₹18,000" 
                    style={{ 
                      width: '100%', 
                      padding: '0.625rem 0.875rem', 
                      borderRadius: 'var(--radius-md)', 
                      border: '1px solid var(--border-color)',
                      outline: 'none',
                      fontSize: '0.875rem',
                      color: 'var(--text-main)',
                      transition: 'border-color 0.2s'
                    }} 
                    onFocus={(e) => e.target.style.borderColor = 'var(--secondary-color)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button 
                  type="button" 
                  onClick={cancelGenQuoteModal} 
                  className="btn btn-outline"
                  style={{
                    padding: '0.625rem 1.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn"
                  style={{
                    padding: '0.625rem 1.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#2E2A72',
                    color: '#FFFFFF',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  Generate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Change Remark Modal */}
      {isRemarkModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '450px', padding: '2rem', animation: 'scaleIn 0.25s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'Poppins, sans-serif', color: 'var(--text-main)', fontWeight: '600' }}>
                Status Update Remark
              </h3>
              <button 
                onClick={cancelRemarkModal} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem', borderRadius: '50%', transition: 'background-color 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F1F5F9'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleRemarkSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: '1.5' }}>
                  You are changing the status to <strong style={{ 
                    color: getStatusStyles(remarkNewStatus).color, 
                    backgroundColor: getStatusStyles(remarkNewStatus).bg,
                    padding: '0.15rem 0.6rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    display: 'inline-block',
                    marginLeft: '0.25rem'
                  }}>{remarkNewStatus.toUpperCase()}</strong>.
                </p>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                  Add a Remark / Note for this transition:
                </label>
                <textarea 
                  rows="3" 
                  value={remarkText} 
                  onChange={(e) => setRemarkText(e.target.value)} 
                  placeholder="e.g., Talked to client, they requested pricing details..." 
                  required
                  style={{ 
                    width: '100%', 
                    padding: '0.75rem', 
                    borderRadius: 'var(--radius-md)', 
                    border: '1px solid var(--border-color)', 
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.875rem',
                    color: 'var(--text-main)',
                    outline: 'none',
                    resize: 'vertical',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--secondary-color)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                ></textarea>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                <button 
                  type="button" 
                  onClick={cancelRemarkModal} 
                  className="btn btn-outline"
                  style={{ padding: '0.5rem 1.25rem' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 1.25rem' }}
                >
                  Save Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Appointment Fixed Modal */}
      {isApptModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Schedule Appointment</h3>
              <button onClick={cancelApptModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleApptSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--text-muted)' }}>Appointment from (Date)</label>
                  <input required value={apptDetails.date} onChange={(e) => setApptDetails({...apptDetails, date: e.target.value})} type="date" style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--text-muted)' }}>Meeting timing (Time)</label>
                  <input required value={apptDetails.time} onChange={(e) => setApptDetails({...apptDetails, time: e.target.value})} type="time" style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--text-muted)' }}>Location / Address</label>
                <input required value={apptDetails.location} onChange={(e) => setApptDetails({...apptDetails, location: e.target.value})} type="text" placeholder="Office address or site location..." style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--text-muted)' }}>Remark</label>
                <textarea rows="3" value={apptDetails.remark} onChange={(e) => setApptDetails({...apptDetails, remark: e.target.value})} placeholder="Any notes for the meeting..." style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', resize: 'vertical' }}></textarea>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={cancelApptModal} className="btn btn-outline">Cancel</button>
                <button type="submit" className="btn btn-primary">Confirm Appointment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slide-out Timeline Drawer */}
      {selectedLeadForTimeline && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'flex-end', // Anchored right, so drawer sits on the right
          animation: 'fadeInBackdrop 0.25s ease-out'
        }}
        onClick={() => setSelectedLeadForTimeline(null)} // Click outside to close
        >
          <div style={{
            width: '100%',
            maxWidth: '460px',
            height: '100%',
            backgroundColor: 'var(--surface-color)',
            boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            zIndex: 1001,
            animation: 'slideInRightToLeft 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            borderLeft: '1px solid var(--border-color)',
            overflow: 'hidden'
          }}
          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking drawer content
          >
            <style>{`
              @keyframes fadeInBackdrop {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes slideInRightToLeft {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
              }
              @keyframes timelineFadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
              }
              .timeline-scroll::-webkit-scrollbar {
                width: 6px;
              }
              .timeline-scroll::-webkit-scrollbar-track {
                background: transparent;
              }
              .timeline-scroll::-webkit-scrollbar-thumb {
                background: #CBD5E1;
                border-radius: 3px;
              }
              .timeline-scroll::-webkit-scrollbar-thumb:hover {
                background: #94A3B8;
              }
            `}</style>
            
            {/* Header */}
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: 'var(--surface-color)',
              color: 'var(--text-main)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-main)' }}>
                  Lead Change History & Notes
                </h3>
              </div>
              <button 
                onClick={() => setSelectedLeadForTimeline(null)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer', 
                  color: 'var(--text-muted)',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = '#F1F5F9';
                  e.currentTarget.style.color = 'var(--text-main)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Main Drawer Body Scrollable */}
            <div className="timeline-scroll" style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
              backgroundColor: '#F8FAFC'
            }}>


              {/* Timeline Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)' }}>
                    Change History & Logs
                  </h4>
                </div>

                <div style={{
                  position: 'relative',
                  paddingLeft: '1.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  marginTop: '0.5rem'
                }}>
                  {/* Continuous Timeline Vertical Line */}
                  <div style={{
                    position: 'absolute',
                    left: '8px',
                    top: '8px',
                    bottom: '8px',
                    width: '2px',
                    backgroundColor: 'var(--border-color)'
                  }} />

                  {/* Sort & Map Timeline entries */}
                  {(() => {
                    // Show every logged event for this lead (status, assignment, quotation, appointment, visit, notes…)
                    const historyList = [...(selectedLeadForTimeline.history || [])]
                      .filter(h => h && (h.message || h.event));

                    if (timelineSortOrder === 'desc') {
                      historyList.reverse();
                    }
                    
                    if (historyList.length === 0) {
                      return (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic', padding: '1rem 0' }}>
                          No status tracking logs recorded yet.
                        </div>
                      );
                    }

                    return historyList.map((h, i) => {
                      // Determine icon and color styling based on status tracking event
                      let Icon = FileText;
                      let iconBg = '#F1F5F9';
                      let iconColor = '#64748B';

                      const msg = (h.message || h.event || '').toLowerCase();

                      if (msg.includes('created') || msg.includes('received')) {
                        Icon = UserPlus;
                        iconBg = '#DCFCE7';
                        iconColor = '#16A34A';
                      } else if (msg.includes('hot')) {
                        Icon = Flame;
                        iconBg = '#FEE2E2';
                        iconColor = '#DC2626';
                      } else if (msg.includes('cold')) {
                        Icon = Snowflake;
                        iconBg = '#F1F5F9';
                        iconColor = '#475569';
                      } else if (msg.includes('warm')) {
                        Icon = Thermometer;
                        iconBg = '#FEF3C7';
                        iconColor = '#D97706';
                      } else if (msg.includes('appointment') || msg.includes('appt')) {
                        Icon = CalendarCheck;
                        iconBg = '#ECFDF5';
                        iconColor = '#10B981';
                      } else if (msg.includes('quotation') || msg.includes('quot')) {
                        Icon = FileText;
                        iconBg = '#E0E7FF';
                        iconColor = '#4F46E5';
                      } else if (msg.includes('negotiation') || msg.includes('negot')) {
                        Icon = FileSignature;
                        iconBg = '#FFFBEB';
                        iconColor = '#D97706';
                      } else if (msg.includes('order confirmed') || msg.includes('confirmed') || msg.includes('order')) {
                        Icon = CheckCircle2;
                        iconBg = '#DCFCE7';
                        iconColor = '#16A34A';
                      } else if (msg.includes('junk')) {
                        Icon = Trash2;
                        iconBg = '#F3F4F6';
                        iconColor = '#4B5563';
                      } else if (msg.includes('status')) {
                        Icon = Activity;
                        iconBg = '#EEF2FF';
                        iconColor = '#4F46E5';
                      }

                      return (
                        <div 
                          key={i} 
                          style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '0.25rem', 
                            fontSize: '0.8125rem',
                            position: 'relative',
                            animation: 'timelineFadeIn 0.25s ease-out'
                          }}
                        >
                          {/* Node Icon Ball */}
                          <div style={{
                            position: 'absolute',
                            left: '-37px',
                            top: '2px',
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: iconBg,
                            border: '2.5px solid #FFFFFF',
                            boxShadow: '0 0 0 1.5px ' + iconColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 2
                          }}>
                            <Icon size={9} color={iconColor} strokeWidth={2.5} />
                          </div>

                          {/* Timeline Text Card */}
                          <div style={{
                            backgroundColor: '#FFFFFF',
                            borderRadius: 'var(--radius-md)',
                            padding: '0.75rem',
                            border: '1px solid var(--border-color)',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.25rem'
                          }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: '600' }}>
                              {h.timestamp || h.date}
                            </span>
                            <span style={{ color: 'var(--text-main)', fontWeight: '500', lineHeight: '1.4' }}>
                              {h.message || h.event}
                            </span>
                            {(h.remark || h.meetingRemarks) && (
                              <div style={{ 
                                display: 'block', 
                                borderLeft: '3px solid var(--secondary-color)', 
                                paddingLeft: '0.6rem', 
                                marginTop: '0.35rem', 
                                color: 'var(--text-muted)', 
                                fontStyle: 'italic', 
                                fontSize: '0.75rem',
                                lineHeight: '1.4'
                              }}>
                                <strong>Remark:</strong> &ldquo;{h.remark || h.meetingRemarks}&rdquo;
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}

                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadManagement;
