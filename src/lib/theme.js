// ============================================================================
// Theme system — ported from the v5 design's SCHEMES + custom-color logic.
// Persisted to localStorage (no backend in this pass). The selected theme is
// applied as a `data-theme` attribute on the .floki-app element; the "custom"
// theme additionally applies computed CSS variables inline.
// ============================================================================

export const DEFAULT_THEME = 'parchment';
export const DEFAULT_ACCENT = '#2E5C8A';
export const DEFAULT_ACCENT2 = '#8A5A3C';

// Preview swatch colors for the theme picker cards (also drive the mini mockups).
export const THEMES = [
  { id:'parchment', name:'Parchment', desc:'Warm paper · steel & terracotta', bg:'#F4EEE2', rail:'#EFE7D8', center:'#F7F7F6', card:'#FFFFFF', accent:'#2E5C8A', accent2:'#8A5A3C', ink:'#1B2130', line:'#E7DFD0' },
  { id:'arctic',    name:'Arctic',    desc:'Cool & crisp · Outlook blue',     bg:'#F2F5F9', rail:'#E9EEF4', center:'#F6F7F9', card:'#FFFFFF', accent:'#0F6CBD', accent2:'#0E7C86', ink:'#1B2433', line:'#DCE3EC' },
  { id:'graphite',  name:'Graphite',  desc:'Focused dark · indigo glow',      bg:'#15171E', rail:'#1A1D26', center:'#181B22', card:'#1F2330', accent:'#7C82FF', accent2:'#E0A35C', ink:'#5B63F5', line:'#2A2F3D' },
  { id:'evergreen', name:'Evergreen', desc:'Calm sage · forest green',        bg:'#F3F6F1', rail:'#E9EFE6', center:'#F6F7F5', card:'#FFFFFF', accent:'#2F7D5B', accent2:'#B5763A', ink:'#1F2A24', line:'#DCE4D7' },
  { id:'plum',      name:'Plum',      desc:'Soft violet · electric indigo',   bg:'#F5F4FA', rail:'#ECEAF5', center:'#F7F6FA', card:'#FFFFFF', accent:'#6D4AFF', accent2:'#C2557E', ink:'#221F33', line:'#E0DCEC' },
  { id:'rose',      name:'Rose',      desc:'Warm coral · bold & friendly',    bg:'#F7F1EC', rail:'#F0E7DF', center:'#F7F6F5', card:'#FFFFFF', accent:'#C8553D', accent2:'#2E6F8A', ink:'#2A2320', line:'#E7DBD0' },
];

export const ACCENT_SWATCHES  = ['#2E5C8A','#C8553D','#2F7D5B','#6D4AFF','#0F6CBD','#111827'];
export const ACCENT2_SWATCHES = ['#8A5A3C','#2E6F8A','#B5763A','#C2557E','#0E7C86','#E0A35C'];

const LS = { theme:'floki.theme', accent:'floki.customAccent', accent2:'floki.customAccent2' };
const lsGet = (k, fb) => { try { return localStorage.getItem(k) ?? fb; } catch { return fb; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

export function loadThemePrefs() {
  return {
    theme:   lsGet(LS.theme, DEFAULT_THEME),
    accent:  lsGet(LS.accent, DEFAULT_ACCENT),
    accent2: lsGet(LS.accent2, DEFAULT_ACCENT2),
  };
}
export const saveTheme   = (t) => lsSet(LS.theme, t);
export const saveAccent  = (c) => lsSet(LS.accent, c);
export const saveAccent2 = (c) => lsSet(LS.accent2, c);

const mix = (c, pct, base) => `color-mix(in srgb, ${c} ${pct}%, ${base})`;

// Compute the inline CSS-variable overrides for the "custom" theme.
// Returns a style object suitable for React's `style` prop.
export function computeCustomVars(cA = DEFAULT_ACCENT, cB = DEFAULT_ACCENT2) {
  return {
    '--bg': mix(cA,7,'#fff'), '--rail': mix(cA,12,'#fff'), '--rail-hover': mix(cA,18,'#fff'),
    '--panel': mix(cA,6,'#fff'), '--card': '#ffffff',
    '--soft': mix(cA,9,'#fff'), '--soft2': mix(cA,15,'#fff'), '--line': mix(cA,18,'#fff'), '--line2': mix(cA,12,'#fff'),
    '--center': mix(cA,4,'#fff'), '--center-line': mix(cA,12,'#fff'), '--av': mix(cA,14,'#fff'), '--av-line': mix(cA,20,'#fff'),
    '--ink': mix(cA,18,'#12161d'), '--ink-hover': mix(cA,26,'#1c222c'), '--on-ink': mix(cA,7,'#fff'),
    '--heading': mix(cA,22,'#16181d'), '--text': mix(cA,20,'#2c3037'), '--text2': mix(cA,24,'#4a4f57'), '--muted': mix(cA,26,'#737880'), '--faint': mix(cA,28,'#aab0b8'),
    '--accent': cA, '--accent-hover': mix(cA,86,'#000'), '--accent-2': mix(cA,68,'#fff'), '--accent-bg': mix(cA,12,'#fff'), '--accent-line': mix(cA,24,'#fff'),
    '--accent2': cB, '--accent2-hover': mix(cB,86,'#000'), '--accent2-bg': mix(cB,12,'#fff'), '--accent2-line': mix(cB,24,'#fff'),
  };
}
