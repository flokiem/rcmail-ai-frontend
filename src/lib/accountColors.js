// Stable per-account accent colors (assigned by list index) + small helpers,
// shared across the sidebar, mail list, chat and compose so a given account
// always shows the same dot color.
export const ACCOUNT_COLORS = ['#2E5C8A', '#8A5A3C', '#B65A4D', '#7E6159', '#A07C3A', '#2F7D5B'];

export const acctColor = (i) => ACCOUNT_COLORS[((i % ACCOUNT_COLORS.length) + ACCOUNT_COLORS.length) % ACCOUNT_COLORS.length];

export function colorForAccount(accounts, accountId) {
  const i = accounts.findIndex((a) => String(a.id) === String(accountId));
  return i >= 0 ? acctColor(i) : 'var(--muted)';
}

export function initialsOf(text) {
  const s = String(text || '').trim();
  if (!s) return '·';
  const parts = s.split(/[\s@.]+/).filter(Boolean);
  const a = parts[0]?.[0] || '';
  const b = parts.length > 1 ? parts[1][0] : (parts[0]?.[1] || '');
  return (a + b).toUpperCase() || '·';
}
