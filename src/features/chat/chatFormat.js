// Lightweight markdown-ish rendering for assistant replies + tool labels.

export const TOOL_LABELS = {
  list_folders:     '📂 Listing folders',
  get_unread_count: '📊 Checking unread count',
  list_emails:      '📬 Fetching emails',
  read_email:       '📖 Reading email',
  search_emails:    '🔍 Searching emails',
  send_email:       '📤 Preparing email',
  move_email:       '📁 Moving email',
  delete_email:     '🗑️ Deleting email',
  mark_email:       '🏷️ Marking email',
  list_contacts:    '👥 Loading contacts',
  search_contacts:  '🔎 Searching contacts',
  get_identities:   '🪪 Loading identities',
};

export const toolLabel = (name) => TOOL_LABELS[name] ?? ('⚙️ ' + String(name).replace(/_/g, ' '));

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Escape, then apply **bold**, `code`, and newlines.
export function formatContent(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}
