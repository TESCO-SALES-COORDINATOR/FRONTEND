import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Compact From / To date filter (same UX as the other SalesCRM apps).
//   • Two small fields: "From: <date> 📅" and "To: <date> 📅".
//   • Clicking either field opens a small single-month calendar.
//   • Quick ranges kept as chips at the top of the calendar popover.
// CONTRACT: props { start, end, onChange } where start/end are "YYYY-MM-DD" strings
// (local date, never UTC) and onChange(startISO, endISO) emits the same — so each view's
// existing dateRange state + inDateRange filtering keep working exactly as before.
// ─────────────────────────────────────────────────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PRESETS = ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'This Month'];

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
// Local YYYY-MM-DD (never toISOString — that shifts the day for +UTC zones like IST).
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseISO = (s) => {
  if (!s) return null;
  const p = String(s).split('-').map(Number);
  if (p.length !== 3) return null;
  return startOfDay(new Date(p[0], p[1] - 1, p[2]));
};
const fmtDisplay = (d) => d ? `${d.toLocaleString('en-US', { month: 'short' })} ${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()}` : '—';

export default function DateRangePicker({ start, end, onChange } = {}) {
  const [openField, setOpenField] = useState(null); // null | 'from' | 'to'
  const containerRef = useRef(null);
  const startDate = parseISO(start);
  const endDate = parseISO(end);
  const [viewMonth, setViewMonth] = useState(startOfDay(new Date()));

  useEffect(() => {
    const onDoc = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) setOpenField(null); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const emit = (s, e) => { if (typeof onChange === 'function') onChange(s ? ymd(s) : '', e ? ymd(e) : ''); };

  const openCalendar = (field) => {
    setOpenField((cur) => (cur === field ? null : field));
    setViewMonth(startOfDay((field === 'to' ? endDate : startDate) || new Date()));
  };

  const applyPreset = (preset) => {
    const today = startOfDay(new Date());
    let s = today, e = today;
    if (preset === 'Today') { s = today; e = today; }
    else if (preset === 'Yesterday') { const y = new Date(today); y.setDate(y.getDate() - 1); s = y; e = y; }
    else if (preset === 'Last 7 Days') { const a = new Date(today); a.setDate(a.getDate() - 6); s = a; e = today; }
    else if (preset === 'Last 30 Days') { const a = new Date(today); a.setDate(a.getDate() - 29); s = a; e = today; }
    else if (preset === 'This Month') { s = new Date(today.getFullYear(), today.getMonth(), 1); e = new Date(today.getFullYear(), today.getMonth() + 1, 0); }
    emit(s, e); setOpenField(null);
  };

  const handleDayClick = (dayNum) => {
    const clicked = startOfDay(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), dayNum));
    let s = startDate, e = endDate;
    if (openField === 'to') { e = clicked; if (s && clicked < s) s = clicked; }
    else { s = clicked; if (e && clicked > e) e = clicked; }
    emit(s, e); setOpenField(null);
  };

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const slots = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const field = { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', border: '1px solid var(--border-color, #E5E9F0)', borderRadius: '0.6rem', background: 'var(--surface-color, #fff)', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-main, #1F2937)', minWidth: 150, justifyContent: 'space-between', fontFamily: 'inherit' };
  const fieldLabel = { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--text-muted, #94A3B8)' };
  const popover = { position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 1000, background: 'var(--surface-color, #fff)', border: '1px solid var(--border-color, #E5E9F0)', borderRadius: '0.8rem', boxShadow: '0 12px 32px rgba(15,23,42,0.16)', padding: '0.75rem', width: 260 };

  const dayCellStyle = (dayNum) => {
    const base = { height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', borderRadius: '0.45rem', cursor: 'pointer', color: 'var(--text-main, #334155)', userSelect: 'none' };
    if (!dayNum) return { ...base, visibility: 'hidden', cursor: 'default' };
    const d = startOfDay(new Date(year, month, dayNum));
    const isStart = startDate && d.getTime() === startDate.getTime();
    const isEnd = endDate && d.getTime() === endDate.getTime();
    const inRange = startDate && endDate && d > startDate && d < endDate;
    if (isStart || isEnd) return { ...base, background: 'var(--primary-color, #4f46e5)', color: '#fff', fontWeight: 700 };
    if (inRange) return { ...base, background: '#EEF2FF', color: '#4338CA' };
    return base;
  };

  const renderCalendar = () => (
    <div style={popover} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.6rem' }}>
        {PRESETS.map((p) => (
          <button key={p} type="button" onClick={() => applyPreset(p)} style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.25rem 0.5rem', borderRadius: '999px', border: '1px solid var(--border-color, #E5E9F0)', background: '#F8FAFC', color: '#475569', cursor: 'pointer', fontFamily: 'inherit' }}>{p}</button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
        <button type="button" onClick={() => setViewMonth(new Date(year, month - 1, 1))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted, #64748B)', display: 'flex', padding: 4 }}><ChevronLeft size={16} /></button>
        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main, #111827)' }}>{MONTHS[month]} {year}</div>
        <button type="button" onClick={() => setViewMonth(new Date(year, month + 1, 1))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted, #64748B)', display: 'flex', padding: 4 }}><ChevronRight size={16} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((w) => (<div key={w} style={{ height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted, #94A3B8)' }}>{w}</div>))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {slots.map((dayNum, idx) => (<div key={idx} style={dayCellStyle(dayNum)} onClick={() => dayNum && handleDayClick(dayNum)}>{dayNum || ''}</div>))}
      </div>
    </div>
  );

  return (
    <div ref={containerRef} style={{ display: 'inline-flex', gap: '0.6rem', position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <div style={field} onClick={() => openCalendar('from')}>
          <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1.2 }}>
            <span style={fieldLabel}>From</span>
            <span style={{ fontWeight: 600 }}>{fmtDisplay(startDate)}</span>
          </span>
          <CalendarIcon size={15} color="var(--text-muted, #64748B)" />
        </div>
        {openField === 'from' && renderCalendar()}
      </div>
      <div style={{ position: 'relative' }}>
        <div style={field} onClick={() => openCalendar('to')}>
          <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1.2 }}>
            <span style={fieldLabel}>To</span>
            <span style={{ fontWeight: 600 }}>{fmtDisplay(endDate || startDate)}</span>
          </span>
          <CalendarIcon size={15} color="var(--text-muted, #64748B)" />
        </div>
        {openField === 'to' && renderCalendar()}
      </div>
    </div>
  );
}
