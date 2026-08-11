// ──────────────────────────────────────────────────────────────────────────
// CANONICAL status / source / stage colors — the single source of truth.
// The SAME values are used in the Coordinator, Manager, and Head apps so that
// a given status / source / stage always renders in one fixed colour for every
// role. Each entry returns { bg, color, border } (+ dot for sources).
// Keep these three files identical across the three apps.
// ──────────────────────────────────────────────────────────────────────────
const norm = (v) => String(v || '').trim().toLowerCase();

const NEUTRAL = { bg: '#F1F5F9', color: '#475569', border: '#E2E8F0', dot: '#94A3B8' };

// Lead statuses (pipeline stages reuse the same colours)
const STATUS = {
  'new':               { bg: '#DBEAFE', color: '#1E40AF', border: '#BFDBFE' },
  'new lead':          { bg: '#DBEAFE', color: '#1E40AF', border: '#BFDBFE' },
  'hot':               { bg: '#FEE2E2', color: '#991B1B', border: '#FECACA' },
  'hot leads':         { bg: '#FEE2E2', color: '#991B1B', border: '#FECACA' },
  'warm':              { bg: '#FEF3C7', color: '#92400E', border: '#FDE68A' },
  'warm leads':        { bg: '#FEF3C7', color: '#92400E', border: '#FDE68A' },
  'cold':              { bg: '#E2E8F0', color: '#475569', border: '#CBD5E1' },
  'cold leads':        { bg: '#E2E8F0', color: '#475569', border: '#CBD5E1' },
  'appointment fixed': { bg: '#DCFCE7', color: '#166534', border: '#BBF7D0' },
  'appt fixed':        { bg: '#DCFCE7', color: '#166534', border: '#BBF7D0' },
  'quotation send':    { bg: '#EDE9FE', color: '#5B21B6', border: '#DDD6FE' },
  'quotation sent':    { bg: '#EDE9FE', color: '#5B21B6', border: '#DDD6FE' },
  'qutation send':     { bg: '#EDE9FE', color: '#5B21B6', border: '#DDD6FE' }, // legacy misspelling
  'negotiation':       { bg: '#FFEDD5', color: '#9A3412', border: '#FED7AA' },
  'negotation':        { bg: '#FFEDD5', color: '#9A3412', border: '#FED7AA' }, // legacy misspelling
  'order confirmed':   { bg: '#D1FAE5', color: '#065F46', border: '#A7F3D0' },
  'junk':              { bg: '#F3F4F6', color: '#374151', border: '#E5E7EB' },
  'lost':              { bg: '#FFE4E6', color: '#9F1239', border: '#FECDD3' },
};

// Lead sources — each a distinct hue, with a matching dot colour
const SOURCE = {
  'website enquiry': { bg: '#DBEAFE', color: '#1D4ED8', border: '#BFDBFE', dot: '#3B82F6' },
  'referral':        { bg: '#EDE9FE', color: '#5B21B6', border: '#DDD6FE', dot: '#7C3AED' },
  'cold calling':    { bg: '#FEF3C7', color: '#92400E', border: '#FDE68A', dot: '#F59E0B' },
  'meta leads':      { bg: '#FCE7F3', color: '#9D174D', border: '#FBCFE8', dot: '#EC4899' },
  'google ads':      { bg: '#FEE2E2', color: '#991B1B', border: '#FECACA', dot: '#EF4444' },
  'google leads':    { bg: '#FEE2E2', color: '#991B1B', border: '#FECACA', dot: '#EF4444' },
  'linkedin leads':  { bg: '#E0F2FE', color: '#075985', border: '#BAE6FD', dot: '#0EA5E9' },
  'organic leads':   { bg: '#D1FAE5', color: '#065F46', border: '#A7F3D0', dot: '#10B981' },
  'email':           { bg: '#E0E7FF', color: '#3730A3', border: '#C7D2FE', dot: '#6366F1' },
  'whatsapp':        { bg: '#DCFCE7', color: '#166534', border: '#BBF7D0', dot: '#22C55E' },
};

export const statusColor = (v) => STATUS[norm(v)] || NEUTRAL;
export const sourceColor = (v) => SOURCE[norm(v)] || NEUTRAL;
export const stageColor  = (v) => STATUS[norm(v)] || NEUTRAL; // stages share status colours

export default { statusColor, sourceColor, stageColor };
