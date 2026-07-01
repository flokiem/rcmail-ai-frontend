// Maps IMAP folders ({ path, name, flags[], specialUse }) to friendly
// labels/icons and a sort order, mirroring the design's folder rail.

// `icon` is a key into FolderIcon.jsx (line icons), not an emoji.
const SPECIAL = {
  '\\Flagged': { label: 'Starred',  icon: 'starred', order: 1 },
  '\\Sent':    { label: 'Sent',     icon: 'sent',    order: 2 },
  '\\Drafts':  { label: 'Drafts',   icon: 'drafts',  order: 3 },
  '\\All':     { label: 'All Mail', icon: 'all',     order: 4 },
  '\\Archive': { label: 'Archive',  icon: 'archive', order: 5 },
  '\\Junk':    { label: 'Spam',     icon: 'spam',    order: 6 },
  '\\Trash':   { label: 'Trash',    icon: 'trash',   order: 7 },
};

const isInbox = (f) => (f.path || f.name || '').toUpperCase() === 'INBOX';
const lastSeg = (path) => String(path || '').split(/[/.]/).filter(Boolean).pop() || path;

// Returns sorted, display-ready folders (hides \Noselect container folders).
// Each carries `unread` (0 when the backend didn't return counts).
export function decorateFolders(folders = []) {
  return folders
    .filter((f) => !(f.flags || []).some((fl) => String(fl).toLowerCase() === '\\noselect'))
    .map((f) => {
      const unread = Number(f.unread) || 0;
      if (isInbox(f)) return { path: f.path, label: 'Inbox', icon: 'inbox', order: 0, special: true, unread };
      const sp = SPECIAL[f.specialUse];
      if (sp) return { path: f.path, label: sp.label, icon: sp.icon, order: sp.order, special: true, unread };
      return { path: f.path, label: lastSeg(f.name || f.path), icon: 'folder', order: 50, special: false, unread };
    })
    // Stable sort by section order only — custom folders keep the server's own
    // order (the design lists them unsorted, not alphabetically).
    .sort((a, b) => a.order - b.order);
}

// Splits decorated folders into the three rail sections that mirror the v6 design:
//   primary — Inbox / Starred / Sent / Drafts / All Mail (order < 5), shown top-level
//   custom  — user folders, collapsed under a "Folders (N)" group
//   system  — Archive / Spam / Trash (order >= 5), shown top-level below the group
export function groupFolders(decorated = []) {
  return {
    primary: decorated.filter((f) => f.special && f.order < 5),
    custom:  decorated.filter((f) => !f.special),
    system:  decorated.filter((f) => f.special && f.order >= 5),
  };
}

// Friendly label for a folder path (used in the inbox header chip).
export function folderLabel(path) {
  if (!path || path.toUpperCase() === 'INBOX') return 'Inbox';
  return lastSeg(path);
}
