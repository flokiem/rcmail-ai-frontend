import React, { useState, useEffect, useCallback } from 'react';
import { listInboxEmails, flagEmail, trashEmail } from '../../lib/api.js';
import { getCachedList } from '../../lib/mailCache.js';
import { acctColor } from '../../lib/accountColors.js';
import MailRow from './MailRow.jsx';

const REFRESH_MS = 60000;
const CAP = 120; // max rows shown after merge

const tagMsg = (m, a, i) => ({ ...m, _accountId: a.id, _accountLabel: a.label, _color: acctColor(i) });
const sortCap = (arr) => [...arr].sort((x, y) => new Date(y.date) - new Date(x.date)).slice(0, CAP);

// Unified inbox: there's no aggregate backend endpoint, so we fan out the
// per-account INBOX list calls (Promise.allSettled), tag each message with its
// mailbox, and merge by date. Cache-first for an instant first paint.
export default function AllInboxesList({ accounts = [], onOpen, onReply }) {
  const [emails, setEmails] = useState(() => {
    const all = [];
    accounts.forEach((a, i) => (getCachedList(a.id, 'INBOX') || []).forEach((m) => all.push(tagMsg(m, a, i))));
    return sortCap(all);
  });
  const [loading, setLoading]       = useState(emails.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState('');
  const [filter, setFilter]         = useState('all');

  const accountKey = accounts.map((a) => a.id).join(',');

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const results = await Promise.allSettled(accounts.map((a) => listInboxEmails(a.id, { folder: 'INBOX' })));
      const all = [];
      results.forEach((res, i) => {
        if (res.status === 'fulfilled') res.value.forEach((m) => all.push(tagMsg(m, accounts[i], i)));
      });
      setEmails(sortCap(all));
      setError(results.some((r) => r.status === 'fulfilled') ? '' : 'Could not load any mailbox.');
    } finally { setLoading(false); setRefreshing(false); }
  }, [accountKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setFilter('all'); load(); }, [accountKey, load]);
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) load({ silent: true }); }, REFRESH_MS);
    const onFocus = () => load({ silent: true });
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(id); window.removeEventListener('focus', onFocus); };
  }, [load]);

  // Star toggle + Trash act on the message's own mailbox (merged INBOX view).
  const same = (a, b) => a._accountId === b._accountId && a.uid === b.uid;
  async function onStar(msg) {
    const value = !msg.flagged;
    const prev = emails;
    setEmails(emails.map((e) => (same(e, msg) ? { ...e, flagged: value } : e)));
    try { await flagEmail(msg._accountId, msg.uid, { folder: 'INBOX', flag: 'flagged', value }); }
    catch { setEmails(prev); }
  }
  async function onTrash(msg) {
    const prev = emails;
    setEmails(emails.filter((e) => !same(e, msg)));
    try { await trashEmail(msg._accountId, msg.uid, { folder: 'INBOX' }); }
    catch { setEmails(prev); }
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
        <span className="fk-mono fk-faint">{refreshing ? '↻ syncing…' : `${accounts.length} mailboxes`}</span>
      </div>

      <div className="fk-mail-scroll">
        {loading && emails.length === 0 ? (
          <div className="fk-mail-empty">Loading all mailboxes…</div>
        ) : error ? (
          <div className="fk-mail-error">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="fk-mail-empty">Nothing here right now.</div>
        ) : (
          <>
            {filtered.map((m) => (
              <MailRow key={`${m._accountId}:${m.uid}`} msg={m} dotColor={m._color} accountLabel={m._accountLabel}
                onOpen={onOpen} onReply={onReply} onStar={onStar} onTrash={onTrash} />
            ))}
            <div className="fk-mail-end">That's everything across your mailboxes.</div>
          </>
        )}
      </div>
    </div>
  );
}
