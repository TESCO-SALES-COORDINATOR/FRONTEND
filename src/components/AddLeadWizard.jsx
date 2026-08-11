import React, { useState, useEffect } from 'react';
import { X, Check, ArrowRight, ArrowLeft, Building2, ClipboardList, CalendarDays, IndianRupee, PenLine, Plus, Trash2 } from 'lucide-react';

const STEPS = ['Basic Info', 'Project Details', 'Quotations', 'Order Confirm', 'Review'];

const LEAD_SOURCES = ['WEBSITE ENQUIRY', 'REFERRAL', 'COLD CALLING', 'META LEADS', 'LINKEDIN LEADS', 'ORGANIC LEADS'];
const SERVICES = ['PEB Building', 'Tensile', 'Other roofing', 'Other Service'];
const ROOFING_TYPES = ['Tensile Roofing', 'UPVC Roofing', 'Polycarbonate Roofing', 'Glass Roofing', 'Mangalore Tile Roofing', 'Shingles Roofing', 'GI Roofing', 'Retractable Roofing', 'Metal Roofing', 'Other'];
const TIMELINES = ['Immediately', 'Within 1 Month', 'Within 3 Months', 'Within 6 Months', 'Just Planning'];
const STATUSES = ['New', 'Hot', 'Warm', 'Cold', 'Appt. Fixed', 'Quotation Send', 'Order Confirmed', 'Junk', 'Lost'];
const PROJECT_TYPES = ['Industrial', 'Warehouse', 'Commercial', 'Cold Storage', 'Institutional', 'Other'];
const STRUCTURE_TYPES = ['Clear Span', 'Multi-span', 'Mezzanine', 'Multi-storey', 'Other'];
const SITE_CONDITIONS = ['Flat', 'Slope', 'Filled', 'Rock', 'Other'];
const START_DATES = ['Immediately', 'Within 1 Month', 'Within 3 Months', 'Just Planning', 'Other'];
const QUOTATION_TYPES = ['Initial Quotation', 'Revised Quotation', 'Final Quotation'];

const emptyForm = {
  // Basic Info
  customerName: '', companyName: '', phone: '', email: '',
  leadSource: 'WEBSITE ENQUIRY', service: 'PEB Building',
  projectLocation: '', assignedManager: '', expectedTimeline: '',
  followUpDate: '', status: 'New',
  // Project Details
  pdService: 'PEB Building', projectType: 'Industrial', structureType: 'Clear Span',
  siteCondition: 'Flat', soilTest: 'Done', approximateArea: '', siteVisit: 'No', expectedStartDate: 'Immediately',
  // Quotations
  quotationType: 'Initial Quotation', projectValue: '', fileName: '', roofingType: '',
  // Order Confirm — 1. Client & Project Details
  ocClientName: '', ocProjectLocation: '', ocContact: '', ocBillingName: '',
  ocMobile: '', ocAltMobile: '', ocSiteAddress: '', ocBillingAddress: '',
  ocGst: '', ocEmailWhatsapp: '', ocSalesperson: '', ocOrderDate: '', ocProposalRef: '',
  // 2. Scope of Work
  ocScopeProjectType: '', ocProjectSize: '', ocDesign3D: false, ocDesign2D: false,
  ocTransportScope: '', ocScaffoldingScope: '',
  // 3. Timeline & Delivery
  ocStartDate: '', ocCompletionDate: '', ocLeadTime: '',
  // 4. Pricing & Payment Terms
  ocQuotedPrice: '', ocMilestones: [{ term: '', percentage: '', value: '' }],
  // 5. Confirmations & Declarations
  ocDeclaration: false, ocSignature: '',
};

const STATUS_TO_WIZARD = {
  'New Lead': 'New', 'Hot Leads': 'Hot', 'Warm Leads': 'Warm', 'Cold Leads': 'Cold',
  'Appointment Fixed': 'Appt. Fixed', 'Quotation Send': 'Quotation Send',
  'Negotiation': 'Quotation Send', 'Order Confirmed': 'Order Confirmed',
  'Junk': 'Junk', 'Lost': 'Lost',
};

const toDateInput = (v) => {
  if (!v || typeof v !== 'string') return '';
  const s = v.trim();
  if (s === 'No Date' || s === 'Pending' || s === '') return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
};

const leadToForm = (lead) => {
  const base = { ...emptyForm, ...(lead._wizard || {}) };
  const upperSource = (lead.source || '').toUpperCase();
  return {
    ...base,
    customerName: lead.name ?? base.customerName,
    companyName: lead.company ?? base.companyName,
    phone: lead.phone ?? base.phone,
    email: lead.email ?? base.email,
    leadSource: LEAD_SOURCES.includes(upperSource) ? upperSource : base.leadSource,
    service: lead.projectType || base.service,
    projectLocation: lead.location ?? base.projectLocation,
    assignedManager: (lead.manager && lead.manager !== 'Unassigned') ? lead.manager : base.assignedManager,
    status: STATUS_TO_WIZARD[lead.status] || base.status,
    projectValue: base.projectValue || String(lead.budget || '').replace(/[^\d.]/g, ''),
    followUpDate: toDateInput(lead.followUp) || base.followUpDate,
    ocMilestones: Array.isArray(base.ocMilestones) && base.ocMilestones.length ? base.ocMilestones : [{ term: '', percentage: '', value: '' }],
  };
};

const labelStyle = { display: 'block', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' };
const inputStyle = { width: '100%', padding: '0.7rem 0.9rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit', color: 'var(--text-main)', background: 'var(--surface-color)', boxSizing: 'border-box' };
const Req = () => <span style={{ color: '#EF4444' }}> *</span>;

const Field = ({ label, required, children }) => (
  <div>
    <label style={labelStyle}>{label}{required && <Req />}</label>
    {children}
  </div>
);

const PillGroup = ({ label, options, value, onChange }) => (
  <div style={{ marginBottom: '1.5rem' }}>
    {label && <label style={labelStyle}>{label}</label>}
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button type="button" key={opt} onClick={() => onChange(opt)}
            style={{
              padding: '0.6rem 1.1rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.85rem',
              fontWeight: active ? 700 : 500, fontFamily: 'inherit',
              border: `1px solid ${active ? 'var(--sidebar-bg)' : 'var(--border-color)'}`,
              background: 'var(--surface-color)', color: 'var(--text-main)',
              boxShadow: active ? 'inset 0 0 0 1px var(--sidebar-bg)' : 'none'
            }}>
            {opt}
          </button>
        );
      })}
    </div>
  </div>
);

const Segmented = ({ label, options, value, onChange }) => (
  <div>
    {label && <label style={labelStyle}>{label}</label>}
    <div style={{ display: 'inline-flex', gap: '0.25rem', background: '#F1F5F9', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.25rem' }}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button type="button" key={opt} onClick={() => onChange(opt)}
            style={{
              padding: '0.45rem 1.2rem', borderRadius: 'calc(var(--radius-md) - 2px)', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: active ? 700 : 500,
              background: active ? 'var(--surface-color)' : 'transparent',
              color: active ? 'var(--text-main)' : 'var(--text-muted)',
              boxShadow: active ? 'var(--shadow-sm)' : 'none'
            }}>
            {opt}
          </button>
        );
      })}
    </div>
  </div>
);

// Card section wrapper for the Order Confirm form (numbered heading + icon)
const SectionCard = ({ icon: Icon, title, children }) => (
  <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '1.5rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
      <Icon size={20} style={{ color: 'var(--sidebar-bg)' }} />
      <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>{title}</h3>
    </div>
    {children}
  </div>
);

// Yes / No radio pair
const YesNo = ({ label, value, onChange }) => (
  <div>
    <label style={{ ...labelStyle, textTransform: 'none', letterSpacing: 0, fontWeight: 600, color: 'var(--text-main)' }}>{label}</label>
    <div style={{ display: 'flex', gap: '1.5rem' }}>
      {['Yes', 'No'].map((opt) => (
        <label key={opt} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-main)' }}>
          <input type="radio" checked={value === opt} onChange={() => onChange(opt)} style={{ cursor: 'pointer' }} />
          {opt}
        </label>
      ))}
    </div>
  </div>
);

const AddLeadWizard = ({ isOpen, onClose, onSave, editLead = null }) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(emptyForm);

  const isEditing = Boolean(editLead);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setForm(editLead ? leadToForm(editLead) : emptyForm);
  }, [isOpen, editLead]);

  if (!isOpen) return null;

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  // Milestone helpers
  const setMilestone = (idx, key, val) => setForm((f) => ({
    ...f, ocMilestones: f.ocMilestones.map((m, i) => (i === idx ? { ...m, [key]: val } : m)),
  }));
  const addMilestone = () => setForm((f) => ({ ...f, ocMilestones: [...f.ocMilestones, { term: '', percentage: '', value: '' }] }));
  const removeMilestone = (idx) => setForm((f) => ({ ...f, ocMilestones: f.ocMilestones.filter((_, i) => i !== idx) }));

  const reset = () => { setForm(emptyForm); setStep(1); };
  const close = () => { reset(); onClose(); };

  // Prefill the Order Confirm form from the earlier steps when the user lands on it.
  const goToStep = (num) => {
    if (num === 4) {
      setForm((f) => ({
        ...f,
        ocClientName: f.ocClientName || f.customerName,
        ocProjectLocation: f.ocProjectLocation || f.projectLocation,
        ocContact: f.ocContact || f.phone || f.email,
        ocMobile: f.ocMobile || f.phone,
        ocEmailWhatsapp: f.ocEmailWhatsapp || f.email,
        ocSalesperson: f.ocSalesperson || f.assignedManager,
        ocScopeProjectType: f.ocScopeProjectType || f.service,
        ocQuotedPrice: f.ocQuotedPrice || f.projectValue,
      }));
    }
    setStep(num);
  };

  const canProceed = step !== 1 || (form.customerName.trim() && form.phone.trim() && form.leadSource && form.service && form.status);

  const next = () => goToStep(Math.min(5, step + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const submit = () => {
    onSave({
      _editId: editLead ? editLead.id : undefined,
      name: form.customerName,
      company: form.companyName,
      phone: form.phone,
      email: form.email,
      source: form.leadSource,
      projectType: form.service,
      location: form.projectLocation,
      manager: form.assignedManager || 'Unassigned',
      expectedTimeline: form.expectedTimeline,
      followUp: form.followUpDate || 'Pending',
      status: form.status,
      budget: form.projectValue || form.ocQuotedPrice,
      notes: `Project: ${form.projectType} / ${form.structureType}. Site: ${form.siteCondition}. Area: ${form.approximateArea || '-'} sq.ft.`,
      _wizard: form,
    });
    reset();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ background: 'var(--surface-color)', width: '100%', maxWidth: '1040px', maxHeight: '92vh', borderRadius: 'var(--radius-xl)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>

        {/* Header */}
        <div style={{ padding: '1.75rem 2rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700 }}>{isEditing ? 'Edit Lead' : 'Add New Lead'}</h2>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.6rem', padding: '0.3rem 0.8rem', background: isEditing ? '#E0E7FF' : '#DCFCE7', color: isEditing ? '#3730A3' : '#166534', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 600 }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isEditing ? '#6366F1' : '#22C55E' }} /> {isEditing ? `Editing ${editLead.id || 'lead'}` : 'Saved to draft'}
            </span>
          </div>
          <button onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={22} /></button>
        </div>

        {/* Step tabs */}
        <div style={{ padding: '0.5rem 2rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {STEPS.map((label, i) => {
            const num = i + 1;
            const isActive = num === step;
            const isDone = num < step;
            return (
              <button key={label} type="button" onClick={() => goToStep(num)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 1.1rem', borderRadius: 'var(--radius-md)',
                  border: `1px solid ${isActive ? 'var(--sidebar-bg)' : isDone ? '#22C55E' : 'var(--border-color)'}`,
                  background: isActive ? 'var(--surface-color)' : isDone ? '#F0FDF4' : '#F8FAFC',
                  cursor: 'pointer', fontFamily: 'inherit'
                }}>
                <span style={{
                  width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.78rem', fontWeight: 700,
                  background: isActive ? 'var(--sidebar-bg)' : isDone ? '#22C55E' : '#E2E8F0',
                  color: isActive || isDone ? '#fff' : 'var(--text-muted)'
                }}>
                  {isDone ? <Check size={14} /> : num}
                </span>
                <span style={{ fontSize: '0.9rem', fontWeight: isActive ? 700 : 500, color: isActive || isDone ? 'var(--text-main)' : 'var(--text-muted)' }}>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div style={{ padding: '1.75rem 2rem', overflowY: 'auto', flex: 1 }}>

          {step === 1 && (
            <>
              <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem', fontWeight: 700 }}>Basic Information</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem 1.75rem' }}>
                <Field label="Customer Name" required>
                  <input style={inputStyle} placeholder="Enter customer name" value={form.customerName} onChange={(e) => set('customerName', e.target.value)} />
                </Field>
                <Field label="Company Name">
                  <input style={inputStyle} placeholder="Enter company name" value={form.companyName} onChange={(e) => set('companyName', e.target.value)} />
                </Field>
                <Field label="Phone Number" required>
                  <input style={inputStyle} placeholder="Enter phone number" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
                </Field>
                <Field label="Email Address">
                  <input type="email" style={inputStyle} placeholder="Enter email address" value={form.email} onChange={(e) => set('email', e.target.value)} />
                </Field>
                <Field label="Lead Source" required>
                  <select style={inputStyle} value={form.leadSource} onChange={(e) => set('leadSource', e.target.value)}>
                    {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Service" required>
                  <select style={inputStyle} value={form.service} onChange={(e) => { set('service', e.target.value); set('pdService', e.target.value); }}>
                    {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Project Location">
                  <input style={inputStyle} placeholder="Enter project location" value={form.projectLocation} onChange={(e) => set('projectLocation', e.target.value)} />
                </Field>
                <Field label="Assigned Manager" required>
                  <input style={inputStyle} placeholder="Enter executive name" value={form.assignedManager} onChange={(e) => set('assignedManager', e.target.value)} />
                </Field>
                <Field label="Expected Timeline">
                  <select style={inputStyle} value={form.expectedTimeline} onChange={(e) => set('expectedTimeline', e.target.value)}>
                    <option value="">Select Expected Timeline</option>
                    {TIMELINES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <div />
                <Field label="Next Follow-up Date">
                  <input type="date" style={inputStyle} value={form.followUpDate} onChange={(e) => set('followUpDate', e.target.value)} />
                </Field>
                <Field label="Status" required>
                  <select style={inputStyle} value={form.status} onChange={(e) => set('status', e.target.value)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s === 'New' ? 'NEW' : s}</option>)}
                  </select>
                </Field>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem', fontWeight: 700 }}>Project Details - {form.pdService}</h3>
              <PillGroup options={SERVICES} value={form.pdService} onChange={(v) => set('pdService', v)} />
              <PillGroup label="Project Type" options={PROJECT_TYPES} value={form.projectType} onChange={(v) => set('projectType', v)} />
              <PillGroup label="Structure Type" options={STRUCTURE_TYPES} value={form.structureType} onChange={(v) => set('structureType', v)} />
              <PillGroup label="Site Condition" options={SITE_CONDITIONS} value={form.siteCondition} onChange={(v) => set('siteCondition', v)} />
              <div style={{ marginBottom: '1.5rem' }}>
                <Segmented label="Soil Test Done?" options={['Done', 'Not Done']} value={form.soilTest} onChange={(v) => set('soilTest', v)} />
              </div>

              <div style={{ borderTop: '1px dashed var(--border-color)', margin: '0.5rem 0 1.5rem' }} />
              <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem', fontWeight: 700 }}>Final Project Details</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <Field label="Approximate Area">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0 0.9rem' }}>
                    <input style={{ ...inputStyle, border: 'none', padding: '0.7rem 0', flex: 1 }} placeholder="Enter Sq.ft" value={form.approximateArea} onChange={(e) => set('approximateArea', e.target.value)} />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>sq.ft</span>
                  </div>
                </Field>
                <Segmented label="Site Visit Required?" options={['Yes', 'No']} value={form.siteVisit} onChange={(v) => set('siteVisit', v)} />
              </div>
              <PillGroup label="Expected Start Date" options={START_DATES} value={form.expectedStartDate} onChange={(v) => set('expectedStartDate', v)} />
            </>
          )}

          {step === 3 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem 1.75rem', marginBottom: '1.5rem' }}>
                <Field label="Lead ID">
                  <input style={{ ...inputStyle, background: '#F1F5F9', color: 'var(--text-muted)' }} value="Pending Generation" disabled />
                </Field>
                <Field label="Client Name">
                  <input style={inputStyle} value={form.customerName} onChange={(e) => set('customerName', e.target.value)} placeholder="e.g. Acme Corp" />
                </Field>
              </div>
              <Field label="Services">
                <select style={{ ...inputStyle, marginBottom: '1.5rem' }} value={form.service} onChange={(e) => set('service', e.target.value)}>
                  {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              {/* Conditional roofing type — only for "Other roofing" */}
              {form.service === 'Other roofing' && (
                <Field label="Select Roofing Type">
                  <select style={{ ...inputStyle, marginBottom: '1.5rem' }} value={form.roofingType} onChange={(e) => set('roofingType', e.target.value)}>
                    <option value="">Select Roofing Type</option>
                    {ROOFING_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </Field>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                <Field label="Quotation Type">
                  <select style={inputStyle} value={form.quotationType} onChange={(e) => set('quotationType', e.target.value)}>
                    {QUOTATION_TYPES.map((q) => <option key={q} value={q}>{q}</option>)}
                  </select>
                </Field>
                <Field label="Project Value (₹)">
                  <input style={inputStyle} placeholder="Enter project value" value={form.projectValue} onChange={(e) => set('projectValue', e.target.value)} />
                </Field>
                <Field label="Upload File (PDF)">
                  <input type="file" accept="application/pdf" style={{ ...inputStyle, padding: '0.5rem' }} onChange={(e) => set('fileName', e.target.files?.[0]?.name || '')} />
                </Field>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.4rem', fontWeight: 800 }}>Order Confirm Form</h3>

              <SectionCard icon={Building2} title="1. Client & Project Details">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem 1.5rem', marginBottom: '1.25rem' }}>
                  <Field label="Client Name" required>
                    <input style={inputStyle} placeholder="e.g. Sree Brindaavan Kindergarten" value={form.ocClientName} onChange={(e) => set('ocClientName', e.target.value)} />
                  </Field>
                  <Field label="Project Location" required>
                    <input style={inputStyle} placeholder="e.g. Chitlapakkam" value={form.ocProjectLocation} onChange={(e) => set('ocProjectLocation', e.target.value)} />
                  </Field>
                  <Field label="Contact Details (Phone/Email)">
                    <input style={inputStyle} placeholder="e.g. 9840714353 / ..." value={form.ocContact} onChange={(e) => set('ocContact', e.target.value)} />
                  </Field>
                  <Field label="Billing Name">
                    <input style={inputStyle} placeholder="e.g. Sree Brindaavan Kindergarten" value={form.ocBillingName} onChange={(e) => set('ocBillingName', e.target.value)} />
                  </Field>
                  <Field label="Mobile Number" required>
                    <input style={inputStyle} placeholder="e.g. 9551269990" value={form.ocMobile} onChange={(e) => set('ocMobile', e.target.value)} />
                  </Field>
                  <Field label="Alternate Mobile Number">
                    <input style={inputStyle} value={form.ocAltMobile} onChange={(e) => set('ocAltMobile', e.target.value)} />
                  </Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem 1.5rem', marginBottom: '1.25rem' }}>
                  <Field label="Site Address" required>
                    <textarea style={{ ...inputStyle, minHeight: '96px', resize: 'vertical' }} placeholder="e.g. 46, First main Road, Venkatraman Nagar, Chennai-600064" value={form.ocSiteAddress} onChange={(e) => set('ocSiteAddress', e.target.value)} />
                  </Field>
                  <Field label="Billing Address">
                    <textarea style={{ ...inputStyle, minHeight: '96px', resize: 'vertical' }} value={form.ocBillingAddress} onChange={(e) => set('ocBillingAddress', e.target.value)} />
                  </Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem 1.5rem', marginBottom: '1.25rem' }}>
                  <Field label="GST Number">
                    <input style={inputStyle} value={form.ocGst} onChange={(e) => set('ocGst', e.target.value)} />
                  </Field>
                  <Field label="Email ID / WhatsApp Number">
                    <input style={inputStyle} value={form.ocEmailWhatsapp} onChange={(e) => set('ocEmailWhatsapp', e.target.value)} />
                  </Field>
                  <Field label="Salesperson Name" required>
                    <input style={inputStyle} value={form.ocSalesperson} onChange={(e) => set('ocSalesperson', e.target.value)} />
                  </Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem 1.5rem' }}>
                  <Field label="Date of Order" required>
                    <input type="date" style={inputStyle} value={form.ocOrderDate} onChange={(e) => set('ocOrderDate', e.target.value)} />
                  </Field>
                  <Field label="Proposal Ref No" required>
                    <input style={inputStyle} placeholder="e.g. TES/ENT/176-R1" value={form.ocProposalRef} onChange={(e) => set('ocProposalRef', e.target.value)} />
                  </Field>
                </div>
              </SectionCard>

              <SectionCard icon={ClipboardList} title="2. Scope of Work">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
                  <Field label="Type of Project" required>
                    <input style={inputStyle} value={form.ocScopeProjectType} onChange={(e) => set('ocScopeProjectType', e.target.value)} />
                  </Field>
                  <Field label="Project Size/Area" required>
                    <input style={inputStyle} placeholder="e.g. 760 Sqft." value={form.ocProjectSize} onChange={(e) => set('ocProjectSize', e.target.value)} />
                  </Field>
                </div>
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', alignItems: 'center' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600 }}>
                    <input type="checkbox" checked={form.ocDesign3D} onChange={(e) => set('ocDesign3D', e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} /> 3D Design
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600 }}>
                    <input type="checkbox" checked={form.ocDesign2D} onChange={(e) => set('ocDesign2D', e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} /> 2D Design
                  </label>
                  <YesNo label="Transportation Client Scope" value={form.ocTransportScope} onChange={(v) => set('ocTransportScope', v)} />
                  <YesNo label="Scaffolding Client Scope" value={form.ocScaffoldingScope} onChange={(v) => set('ocScaffoldingScope', v)} />
                </div>
              </SectionCard>

              <SectionCard icon={CalendarDays} title="3. Timeline & Delivery Commitment">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                  <Field label="Tentative Start Date" required>
                    <input type="date" style={inputStyle} value={form.ocStartDate} onChange={(e) => set('ocStartDate', e.target.value)} />
                  </Field>
                  <Field label="Tentative Completion Date" required>
                    <input type="date" style={inputStyle} value={form.ocCompletionDate} onChange={(e) => set('ocCompletionDate', e.target.value)} />
                  </Field>
                  <Field label="Lead Time Promised">
                    <input style={inputStyle} placeholder="e.g. 30 days" value={form.ocLeadTime} onChange={(e) => set('ocLeadTime', e.target.value)} />
                  </Field>
                </div>
              </SectionCard>

              <SectionCard icon={IndianRupee} title="4. Pricing & Payment Terms">
                <Field label="Quoted Price" required>
                  <input style={{ ...inputStyle, marginBottom: '1.5rem' }} placeholder="₹ Amount" value={form.ocQuotedPrice} onChange={(e) => set('ocQuotedPrice', e.target.value)} />
                </Field>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <label style={labelStyle}>Payment Terms Schedule</label>
                  <button type="button" onClick={addMilestone} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.9rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: '#EEF2FF', color: 'var(--sidebar-bg)', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem' }}>
                    <Plus size={15} /> Add Milestone
                  </button>
                </div>
                {form.ocMilestones.map((m, idx) => (
                  <div key={idx} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '0.75rem', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
                    <Field label="Term / Milestone">
                      <input style={inputStyle} placeholder="e.g. Advance Payment" value={m.term} onChange={(e) => setMilestone(idx, 'term', e.target.value)} />
                    </Field>
                    <Field label="Percentage (%)">
                      <input style={inputStyle} placeholder="%" value={m.percentage} onChange={(e) => setMilestone(idx, 'percentage', e.target.value)} />
                    </Field>
                    <Field label="Value (₹)">
                      <input style={inputStyle} placeholder="₹ Amount" value={m.value} onChange={(e) => setMilestone(idx, 'value', e.target.value)} />
                    </Field>
                    <button type="button" onClick={() => removeMilestone(idx)} disabled={form.ocMilestones.length === 1}
                      title="Remove milestone"
                      style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: form.ocMilestones.length === 1 ? '#F8FAFC' : '#FEE2E2', color: '#DC2626', cursor: form.ocMilestones.length === 1 ? 'not-allowed' : 'pointer', opacity: form.ocMilestones.length === 1 ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </SectionCard>

              <SectionCard icon={PenLine} title="5. Confirmations & Declarations">
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>5. Salesperson Declaration</div>
                  <label style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '1.25rem' }}>
                    <input type="checkbox" checked={form.ocDeclaration} onChange={(e) => set('ocDeclaration', e.target.checked)} style={{ marginTop: '0.2rem', width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0 }} />
                    <span>"I confirm that all details communicated to the client and project team are accurate and have been agreed upon. I also acknowledge that the project will commence once the design has been confirmed."</span>
                  </label>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Signature of Salesperson:</div>
                  <input style={{ ...inputStyle, border: 'none', borderBottom: '1px solid var(--border-color)', borderRadius: 0, fontStyle: 'italic', fontSize: '1.4rem', padding: '0.5rem 0', maxWidth: '360px' }} placeholder="Sign here..." value={form.ocSignature} onChange={(e) => set('ocSignature', e.target.value)} />
                </div>
              </SectionCard>
            </>
          )}

          {step === 5 && (
            <>
              <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem', fontWeight: 700 }}>Review &amp; Submit</h3>
              {[
                { title: 'Basic Info', rows: [['Customer Name', form.customerName || '-'], ['Company', form.companyName || '-'], ['Phone', form.phone || '-'], ['Email', form.email || '-'], ['Lead Source', form.leadSource], ['Service', form.service], ['Assigned Manager', form.assignedManager || '-'], ['Status', form.status]] },
                { title: 'Project Details', rows: [['Project Type', form.projectType], ['Structure Type', form.structureType], ['Site Condition', form.siteCondition], ['Soil Test', form.soilTest], ['Approx. Area', form.approximateArea ? `${form.approximateArea} sq.ft` : '-'], ['Site Visit', form.siteVisit], ['Expected Start', form.expectedStartDate]] },
                { title: 'Quotation', rows: [['Quotation Type', form.quotationType], ['Roofing Type', form.service === 'Other roofing' ? (form.roofingType || '-') : 'N/A'], ['Project Value', form.projectValue ? `₹${form.projectValue}` : '-'], ['File', form.fileName || 'None']] },
                { title: 'Order Confirm', rows: [['Client', form.ocClientName || '-'], ['Proposal Ref', form.ocProposalRef || '-'], ['Quoted Price', form.ocQuotedPrice ? `₹${form.ocQuotedPrice}` : '-'], ['Milestones', String(form.ocMilestones.filter((m) => m.term).length)], ['Declaration', form.ocDeclaration ? 'Confirmed' : 'Not confirmed'], ['Signature', form.ocSignature || '-']] },
              ].map((sec) => (
                <div key={sec.title} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.9rem' }}>{sec.title}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem 1.5rem' }}>
                    {sec.rows.map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.35rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)', textAlign: 'right' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '1.25rem 2rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" className="btn btn-outline" onClick={close}>Cancel</button>
            <button type="button" className="btn btn-outline" onClick={() => {}}>Save Draft</button>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {step > 1 && (
              <button type="button" className="btn btn-outline" onClick={back} style={{ display: 'inline-flex', gap: '0.4rem' }}>
                <ArrowLeft size={16} /> Back
              </button>
            )}
            {step < 5 ? (
              <button type="button" className="btn btn-primary" onClick={next} disabled={!canProceed} style={{ display: 'inline-flex', gap: '0.4rem', opacity: canProceed ? 1 : 0.5, background: 'var(--sidebar-bg)' }}>
                Next <ArrowRight size={16} />
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={submit} style={{ background: 'var(--sidebar-bg)' }}>{isEditing ? 'Update Lead' : 'Submit Lead'}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddLeadWizard;
