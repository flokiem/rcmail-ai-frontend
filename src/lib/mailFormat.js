// Formatting helpers shared by the mail list + reading pane.

export function fmtRowDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (sameDay) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// Bucket a message into Today / Yesterday / Earlier (keys + labels).
export function dateGroup(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return 'earlier';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'today';
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return 'yest';
  return 'earlier';
}

export const GROUP_LABELS = [['today', 'Today'], ['yest', 'Yesterday'], ['earlier', 'Earlier']];

// Derive a friendly display name from a raw From address/header.
export function senderName(from) {
  if (!from) return '(unknown)';
  const m = from.match(/^(.*?)\s*<(.+)>$/);
  if (m && m[1].trim()) return m[1].replace(/^"|"$/g, '').trim();
  const addr = (m ? m[2] : from).trim();
  const local = addr.split('@')[0] || addr;
  return local.replace(/[._]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || addr;
}

// Extract a bare email address from a "Name <email>" header (or return as-is).
export function addressOf(from) {
  if (!from) return '';
  const m = String(from).match(/<([^>]+)>/);
  return (m ? m[1] : from).trim();
}

// Build a quoted-original block for replies/forwards.
export function buildQuote(detail) {
  if (!detail) return '';
  const when = detail.date ? new Date(detail.date).toLocaleString() : '';
  const who = detail.from || '';
  const body = (detail.body || '').trim();
  return `On ${when}, ${who} wrote:\n\n${body}`;
}

export function initialsFromName(name) {
  const parts = String(name || '').split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || '';
  const b = parts.length > 1 ? parts[1][0] : '';
  return (a + b).toUpperCase() || '·';
}

// Wrap raw email HTML for safe display inside a sandboxed iframe.
export function emailSrcDoc(html) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base target="_blank">
<style>
  body { margin: 0; padding: 4px 2px; font-family: 'Hanken Grotesk', -apple-system, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #1e293b; line-height: 1.6; word-wrap: break-word; overflow-wrap: break-word; }
  img { max-width: 100%; height: auto; }
  a { color: #2563eb; }
  table { max-width: 100%; }
</style></head><body>${html}</body></html>`;
}
