import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { listInboxEmails, readInboxEmail, listFolders, INBOX_SINCE } from './api.js';

const REFRESH_MS = 40000; // auto-refresh the inbox every 40 seconds
const MIN_W = 360, MAX_W = 760, DEFAULT_W = 480; // inbox dock width bounds (px) — fits folder rail + list

// ── Persistent caches (localStorage) so the inbox/emails load instantly,
//    even across page reloads. Falls back silently if storage is unavailable. ──
const LS_LIST = 'inbox.list.';      // + accountId            -> messages[]
const LS_MAIL = 'inbox.mail.';      // + `${accountId}:${uid}` -> detail
const LS_FOLDERS = 'inbox.folders.'; // + accountId            -> folders[]
const lsGet = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota / private mode */ } };

const getCachedList = (id, folder)        => lsGet(`${LS_LIST}${id}:${folder}`);
const setCachedList = (id, folder, msgs)  => lsSet(`${LS_LIST}${id}:${folder}`, msgs);
const getCachedMail = (id, folder, uid)   => lsGet(`${LS_MAIL}${id}:${folder}:${uid}`);
const setCachedMail = (id, folder, uid, d) => lsSet(`${LS_MAIL}${id}:${folder}:${uid}`, d);
const getCachedFolders = (id)        => lsGet(LS_FOLDERS + id);
const setCachedFolders = (id, fs)    => lsSet(LS_FOLDERS + id, fs);

// ── Folder display: friendly icon/label + sort order from IMAP special-use flags ──
// The special-use token may arrive as `specialUse` (SPECIAL-USE ext.) or inside `flags`.
function specialUse(f) {
  if (f.specialUse) return f.specialUse;
  return (f.flags || []).find(x => ['\\Sent', '\\Drafts', '\\Junk', '\\Trash', '\\All', '\\Flagged', '\\Important', '\\Archive'].includes(x)) || '';
}
function folderIcon(f) {
  if (f.path.toUpperCase() === 'INBOX') return '📥';
  switch (specialUse(f)) {
    case '\\Flagged':   return '⭐';
    case '\\Important': return '🔖';
    case '\\Sent':      return '📤';
    case '\\Drafts':    return '📝';
    case '\\All':
    case '\\Archive':   return '🗂️';
    case '\\Junk':      return '⚠️';
    case '\\Trash':     return '🗑️';
    default:            return '📁';
  }
}
function folderOrder(f) {
  if (f.path.toUpperCase() === 'INBOX') return 0;
  switch (specialUse(f)) {
    case '\\Flagged':   return 1;
    case '\\Important': return 2;
    case '\\Sent':      return 3;
    case '\\Drafts':    return 4;
    case '\\All':
    case '\\Archive':   return 5;
    case '\\Junk':      return 6;
    case '\\Trash':     return 7;
    default:            return 100; // custom folders / labels last
  }
}

function fmtRowDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function senderName(from) {
  if (!from) return '(unknown)';
  const m = from.match(/^(.*?)\s*<(.+)>$/);
  const name = m ? (m[1] || m[2]) : from;
  return name.replace(/^"|"$/g, '').trim() || from;
}

const sinceLabel = (opts) => new Date(INBOX_SINCE).toLocaleDateString([], opts);

// Wrap raw email HTML for safe display inside a sandboxed iframe.
function emailSrcDoc(html) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base target="_blank">
<style>
  body { margin: 0; padding: 14px; font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; font-size: 13.5px; color: #1e293b; line-height: 1.6; word-wrap: break-word; overflow-wrap: break-word; }
  img { max-width: 100%; height: auto; }
  a { color: #2563eb; }
  table { max-width: 100%; }
</style></head><body>${html}</body></html>`;
}

export default function InboxPanel({ open, onClose, accounts, defaultAccountId, onActiveEmailChange }) {
  const [accountId, setAccountId]   = useState(defaultAccountId || '');
  const [folders, setFolders]       = useState([]);
  const [folder, setFolder]         = useState('INBOX');
  const [emails, setEmails]         = useState([]);
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const [openUid, setOpenUid]             = useState(null);
  const [detail, setDetail]               = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError]     = useState('');

  // Resizable width (persisted)
  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem('inboxWidth'));
    return saved >= MIN_W && saved <= MAX_W ? saved : DEFAULT_W;
  });
  const dockRef     = useRef(null);
  const draggingRef = useRef(false);
  const widthRef    = useRef(width);
  widthRef.current = width;

  // refs so the polling interval always sees the current account + folder
  const accountIdRef = useRef(accountId);
  accountIdRef.current = accountId;
  const folderRef = useRef(folder);
  folderRef.current = folder;

  // Default to the chat's selected account when the panel first opens
  useEffect(() => {
    if (open && !accountId && defaultAccountId) setAccountId(defaultAccountId);
  }, [open, defaultAccountId]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async ({ silent = false } = {}) => {
    const id = accountIdRef.current;
    const fld = folderRef.current;
    if (!id) return;
    const cached = getCachedList(id, fld);
    if (cached && !silent) setEmails(cached); // show cached instantly

    if (silent) setRefreshing(true);
    else if (!cached) { setLoading(true); setError(''); }
    else setError('');

    try {
      const msgs = await listInboxEmails(id, { folder: fld });
      // Ignore the response if the user switched folder/account mid-request.
      if (accountIdRef.current !== id || folderRef.current !== fld) return;
      setEmails(msgs);
      setCachedList(id, fld, msgs);
      setLastUpdated(new Date());
    } catch (e) {
      if (!silent && !cached) setError(e.message);
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  // Load the account's folder list when the panel opens / account changes.
  // Show the cached list instantly (no waiting on the live IMAP round-trip),
  // then refresh in the background so switching accounts feels immediate.
  useEffect(() => {
    if (!open || !accountId) return;
    setFolders(getCachedFolders(accountId) || []); // instant; clears stale on a cache miss
    let cancelled = false;
    listFolders(accountId)
      .then(fs => { if (!cancelled) { setFolders(fs); setCachedFolders(accountId, fs); } })
      .catch(() => { /* keep whatever we showed (cached or empty) */ });
    return () => { cancelled = true; };
  }, [open, accountId]);

  // Load on open / account / folder change (and reset any open email)
  useEffect(() => {
    if (!open || !accountId) return;
    setOpenUid(null);
    setDetail(null);
    onActiveEmailChange?.(null);
    load();
  }, [open, accountId, folder, load]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detach the chat context when the panel is closed.
  useEffect(() => { if (!open) onActiveEmailChange?.(null); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // 60s polling + refresh when the tab regains focus
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => { if (!document.hidden) load({ silent: true }); }, REFRESH_MS);
    const onFocus = () => load({ silent: true });
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, [open, load]);

  // Drag-to-resize handlers (desktop)
  useEffect(() => {
    if (!open) return;
    function onMove(e) {
      if (!draggingRef.current || !dockRef.current) return;
      const left = dockRef.current.getBoundingClientRect().left;
      const w = Math.max(MIN_W, Math.min(MAX_W, e.clientX - left));
      setWidth(w);
    }
    function onUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('inboxWidth', String(widthRef.current));
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [open]);

  function startResize(e) {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  // Switch account → reset to its Inbox (folder list reloads via effect).
  function changeAccount(id) {
    setAccountId(id);
    setFolder('INBOX');
  }

  function selectFolder(path) {
    if (path !== folderRef.current) setFolder(path);
  }

  async function openEmail(uid) {
    const id  = accountIdRef.current;
    const fld = folderRef.current;
    const cached = getCachedMail(id, fld, uid);
    setOpenUid(uid);
    setDetailError('');
    // Tell the chat which email is now open so the user can talk about it directly.
    const row = emails.find(e => e.uid === uid);
    onActiveEmailChange?.({
      type: 'email',
      accountId: id,
      account: accounts.find(a => String(a.id) === String(id))?.label,
      uid,
      folder: fld,
      from: row?.from,
      subject: row?.subject,
      date: row?.date,
    });
    if (cached) { setDetail(cached); setDetailLoading(false); }
    else { setDetail(null); setDetailLoading(true); }
    try {
      const data = await readInboxEmail(id, uid, fld);
      setDetail(data);
      setCachedMail(id, fld, uid, data);
      setEmails(es => es.map(e => (e.uid === uid ? { ...e, seen: true } : e)));
    } catch (e) {
      if (!cached) setDetailError(e.message);
    } finally {
      setDetailLoading(false);
    }
  }

  function backToList() {
    setOpenUid(null);
    setDetail(null);
    setDetailError('');
    onActiveEmailChange?.(null);
  }

  // Selectable folders, friendly-labelled and sorted (special folders first).
  const folderList = useMemo(() => (
    folders
      .filter(f => !(f.flags || []).includes('\\Noselect'))
      .map(f => ({ path: f.path, label: f.name || f.path, icon: folderIcon(f), order: folderOrder(f) }))
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
  ), [folders]);

  if (!open) return null;

  const unreadCount = emails.filter(e => !e.seen).length;
  const current     = folderList.find(f => f.path === folder);
  const headIcon    = current?.icon  || '📥';
  const headLabel   = current?.label || 'Inbox';

  return (
    <>
      <div className="inbox-dock-backdrop" onClick={onClose} />
      <aside className="inbox-dock" ref={dockRef} style={{ '--inbox-w': `${width}px` }}>
        <div className="inbox-head">
          <div className="inbox-head-left">
            {openUid !== null && (
              <button className="inbox-back-btn" onClick={backToList} title="Back to inbox">←</button>
            )}
            <h3>
              {headIcon} {headLabel}
              {unreadCount > 0 && <span className="inbox-unread-badge">{unreadCount}</span>}
            </h3>
          </div>
          <div className="inbox-head-actions">
            <button className="inbox-refresh" onClick={() => load({ silent: true })} disabled={refreshing || loading} title="Refresh">
              <svg viewBox="0 0 24 24" className={refreshing ? 'spinning' : ''}><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
            </button>
            <button className="settings-close" onClick={onClose} title="Close inbox">×</button>
          </div>
        </div>

        <div className="inbox-subhead">
          <select value={accountId} onChange={e => changeAccount(e.target.value)}>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.label} — {a.imap_user}</option>)}
          </select>
          <span className="inbox-since">Since {sinceLabel({ month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>

        <div className="inbox-main">
          {openUid === null && folderList.length > 0 && (
            <nav className="inbox-folders">
              {folderList.map(f => (
                <button
                  key={f.path}
                  className={`inbox-folder ${f.path === folder ? 'active' : ''}`}
                  onClick={() => selectFolder(f.path)}
                  title={f.label}
                >
                  <span className="inbox-folder-icon">{f.icon}</span>
                  <span className="inbox-folder-label">{f.label}</span>
                </button>
              ))}
            </nav>
          )}

          <div className="inbox-body">
          {openUid !== null ? (
            <div className="inbox-detail">
              {detailLoading && !detail ? (
                <div className="inbox-empty">Loading email…</div>
              ) : detailError ? (
                <div className="alert alert-error show">{detailError}</div>
              ) : detail ? (
                <>
                  <h4 className="inbox-detail-subject">{detail.subject || '(no subject)'}</h4>
                  <div className="inbox-detail-meta">
                    <div><strong>From:</strong> {detail.from}</div>
                    {detail.to && <div><strong>To:</strong> {detail.to}</div>}
                    {detail.cc && <div><strong>Cc:</strong> {detail.cc}</div>}
                    {detail.date && <div className="inbox-detail-date">{new Date(detail.date).toLocaleString()}</div>}
                  </div>
                  <div className="inbox-detail-content">
                    {detail.html ? (
                      <iframe
                        title="email"
                        className="inbox-iframe"
                        sandbox="allow-popups allow-popups-to-escape-sandbox"
                        srcDoc={emailSrcDoc(detail.html)}
                      />
                    ) : (
                      <div className="inbox-detail-body">{detail.body || '(empty message)'}</div>
                    )}
                  </div>
                  {detail.attachments?.length > 0 && (
                    <div className="inbox-attach">
                      📎 {detail.attachments.length} attachment{detail.attachments.length > 1 ? 's' : ''}: {detail.attachments.map(a => a.filename).join(', ')}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          ) : loading ? (
            <div className="inbox-empty">Loading {headLabel}…</div>
          ) : error ? (
            <div className="alert alert-error show">{error}</div>
          ) : emails.length === 0 ? (
            <div className="inbox-empty">No emails in {headLabel}.</div>
          ) : (
            <ul className="inbox-list">
              {emails.map(m => (
                <li key={m.uid} className={`inbox-row ${m.seen ? '' : 'unread'}`} onClick={() => openEmail(m.uid)}>
                  <span className="inbox-row-dot" />
                  <div className="inbox-row-main">
                    <div className="inbox-row-top">
                      <span className="inbox-row-from">{senderName(m.from)}</span>
                      <span className="inbox-row-date">{fmtRowDate(m.date)}</span>
                    </div>
                    <div className="inbox-row-subject">{m.subject || '(no subject)'}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          </div>
        </div>

        {openUid === null && lastUpdated && (
          <div className="inbox-foot">
            {refreshing
              ? 'Refreshing…'
              : `Updated ${lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · auto-refreshes every 40s`}
          </div>
        )}
      </aside>

      {/* Drag handle to resize the inbox / chat split (desktop) */}
      <div className="inbox-resize" onMouseDown={startResize} title="Drag to resize" />
    </>
  );
}
