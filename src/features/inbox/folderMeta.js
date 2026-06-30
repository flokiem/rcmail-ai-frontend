// Maps IMAP folders ({ path, name, flags[], specialUse }) to friendly
// labels/icons and a sort order, mirroring the design's folder rail.

const SPECIAL = {
  '\\Flagged': { label: 'Starred',  icon: '★', order: 1 },
  '\\Sent':    { label: 'Sent',     icon: '➤', order: 2 },
  '\\Drafts':  { label: 'Drafts',   icon: '❏', order: 3 },
  '\\All':     { label: 'All Mail', icon: '✉', order: 4 },
  '\\Archive': { label: 'Archive',  icon: '🗄', order: 5 },
  '\\Junk':    { label: 'Spam',     icon: '⚠', order: 6 },
  '\\Trash':   { label: 'Trash',    icon: '🗑', order: 7 },
};

const isInbox = (f) => (f.path || f.name || '').toUpperCase() === 'INBOX';
const lastSeg = (path) => String(path || '').split(/[/.]/).filter(Boolean).pop() || path;

// Returns sorted, display-ready folders (hides \Noselect container folders).
export function decorateFolders(folders = []) {
  return folders
    .filter((f) => !(f.flags || []).some((fl) => String(fl).toLowerCase() === '\\noselect'))
    .map((f) => {
      if (isInbox(f)) return { path: f.path, label: 'Inbox', icon: '📥', order: 0, special: true };
      const sp = SPECIAL[f.specialUse];
      if (sp) return { path: f.path, label: sp.label, icon: sp.icon, order: sp.order, special: true };
      return { path: f.path, label: lastSeg(f.name || f.path), icon: '📁', order: 50, special: false };
    })
    .sort((a, b) => (a.order - b.order) || a.label.localeCompare(b.label));
}

// Friendly label for a folder path (used in the inbox header chip).
export function folderLabel(path) {
  if (!path || path.toUpperCase() === 'INBOX') return 'Inbox';
  return lastSeg(path);
}
