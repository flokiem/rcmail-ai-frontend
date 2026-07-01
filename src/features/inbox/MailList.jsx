import React, { useState, useEffect, useCallback, useRef } from 'react';
import { listInboxEmails, flagEmail, trashEmail } from '../../lib/api.js';
import { getCachedList, setCachedList } from '../../lib/mailCache.js';
import MailRow from './MailRow.jsx';

const REFRESH_MS = 40000;

// Cache-first mail list for one (account, folder): instant from localStorage,
// then refreshes from the backend; polls every 40s and on window focus.
export default function MailList({ accountId, folder, dotColor, onOpen, onReply }) {
  const [emails, setEmails]         = useState([]);
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState('');
  const [filter, setFilter]         = useState('all'); // all | unread | flagged

  const idRef = useRef(accountId); idRef.current = accountId;
  const folderRef = useRef(folder); folderRef.current = folder;

  const load = useCallback(async ({ silent = false } = {}) => {
    const id = idRef.current, fld = folderRef.current;
    if (!id) return;
    const cached = getCachedList(id, fld);
    if (cached && !silent) setEmails(cached);
    if (silent) setRefreshing(true);
    else if (!cached) { setLoading(true); setError(''); }
    else setError('');
    try {
      const msgs = await listInboxEmails(id, { folder: fld });
      if (idRef.current === id && folderRef.current === fld) { setEmails(msgs); setCachedList(id, fld, msgs); }
    } catch (e) {
      if (!silent && !cached) setError(e.message);
    } finally {
      if (silent) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { setFilter('all'); load(); }, [accountId, folder, load]);

  useEffect(() => {
    const interval = setInterval(() => { if (!document.hidden) load({ silent: true }); }, REFRESH_MS);
    const onFocus = () => load({ silent: true });
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, [load]);

  // Star toggle + Trash — optimistic (update list + cache immediately), revert on failure.
  const commit = (next) => { setEmails(next); setCachedList(accountId, folder, next); };
  async function onStar(msg) {
    const value = !msg.flagged;
    const prev = emails;
    commit(emails.map((e) => (e.uid === msg.uid ? { ...e, flagged: value } : e)));
    try { await flagEmail(accountId, msg.uid, { folder, flag: 'flagged', value }); }
    catch { commit(prev); }
  }
  async function onTrash(msg) {
    const prev = emails;
    commit(emails.filter((e) => e.uid !== msg.uid));
    try { await trashEmail(accountId, msg.uid, { folder }); }
    catch { commit(prev); }
  }

  const unreadN = emails.filter((e) => !e.seen).length;
  const filtered = emails.filter((m) => filter === 'all' ? true : filter === 'unread' ? !m.seen : m.flagged);

  const chips = [['all', 'All'], ['unread', 'Unread'], ['flagged', 'Flagged']];

  return (
    <div className="fk-maillist">
      <div className="fk-mail-filterbar">
        <div className="fk-mail-filters">
          {chips.map(([k, label]) => (
            <button key={k} className={`fk-mail-filter ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>
              {label}{k === 'unread' && unreadN > 0 ? ` ${unreadN}` : ''}
            </button>
          ))}
        </div>
        <span className="fk-spacer" />
        <span className="fk-mono fk-faint">{refreshing ? '↻ syncing…' : '↻ synced'}</span>
      </div>

      <div className="fk-mail-scroll">
        {loading && emails.length === 0 ? (
          <div className="fk-mail-empty">Loading inbox…</div>
        ) : error ? (
          <div className="fk-mail-error">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="fk-mail-empty">Nothing here right now.</div>
        ) : (
          <>
            {filtered.map((m) => (
              <MailRow key={m.uid} msg={m} dotColor={dotColor} onOpen={onOpen}
                onReply={onReply} onStar={onStar} onTrash={onTrash} />
            ))}
            <div className="fk-mail-end">That's everything in this folder.</div>
          </>
        )}
      </div>
    </div>
  );
}
