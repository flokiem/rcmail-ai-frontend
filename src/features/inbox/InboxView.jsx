import React, { useState, useEffect } from 'react';
import MailList from './MailList.jsx';
import AllInboxesList from './AllInboxesList.jsx';
import ReadingPane from './ReadingPane.jsx';
import AgentPanel from '../chat/AgentPanel.jsx';
import Composer from '../compose/Composer.jsx';
import { colorForAccount } from '../../lib/accountColors.js';
import { folderLabel } from './folderMeta.js';
import { addressOf, buildQuote } from '../../lib/mailFormat.js';

// Inbox layout: center column (list + reading pane side-by-side) + the Floki
// agent panel on the right. Opening a message keeps the list visible (it just
// narrows) and opens a reading column beside it — and tells the chat which email
// is active so Floki can answer about "this email".
export default function InboxView({ accounts = [], selectedBox = 'all', folder = 'INBOX', llmProviders = [], signature = '', agentName = 'Floki' }) {
  const [reading, setReading] = useState(null); // { accountId, uid, folder, dotColor, from, subject, date }
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [compose, setCompose] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => { setReading(null); }, [selectedBox, folder]);

  const isAll = selectedBox === 'all';
  const account = accounts.find((a) => String(a.id) === String(selectedBox));
  const dotColor = colorForAccount(accounts, selectedBox);
  const defaultAccountId = account?.id ?? accounts[0]?.id;

  function openCompose(init) { setCompose({ key: Date.now(), ...init }); }
  function showToast(msg) { setToast(msg); clearTimeout(showToast._t); showToast._t = setTimeout(() => setToast(''), 2600); }

  const composeFrom = () => reading?.accountId ?? defaultAccountId;
  const newMessage = () => openCompose({ mode: 'new', accountId: defaultAccountId });
  const replyTo = (detail) => detail && openCompose({
    mode: 'reply', accountId: composeFrom(), to: addressOf(detail.from),
    subject: /^re:/i.test(detail.subject || '') ? detail.subject : `Re: ${detail.subject || ''}`,
    quoted: buildQuote(detail),
  });
  const forward = (detail) => detail && openCompose({
    mode: 'forward', accountId: composeFrom(), to: '',
    subject: /^fwd:/i.test(detail.subject || '') ? detail.subject : `Fwd: ${detail.subject || ''}`,
    quoted: buildQuote(detail),
  });

  // The email currently open in the reading pane, in the shape the chat sends as
  // `context` so the AI answers about it.
  const activeEmail = reading ? {
    type: 'email', accountId: reading.accountId,
    account: accounts.find((a) => String(a.id) === String(reading.accountId))?.label,
    uid: reading.uid, folder: reading.folder, from: reading.from, subject: reading.subject, date: reading.date,
  } : null;

  const header = (dot, title, chip, sub) => (
    <header className="fk-inbox-head">
      <div className="fk-inbox-titlewrap">
        <span className="fk-inbox-dot" style={{ background: dot }} />
        <h1>{title}</h1>
        {chip && <span className="fk-chip">{chip}</span>}
        <span className="fk-spacer" />
        <button className="fk-inbox-iconbtn" title="Search — coming soon" disabled>⌕</button>
        <button className="fk-inbox-iconbtn primary" title="Compose" onClick={newMessage}>✎</button>
      </div>
      {sub && <div className="fk-inbox-sub">{sub}</div>}
    </header>
  );

  const readingPane = (
    <ReadingPane
      accountId={reading?.accountId} folder={reading?.folder} uid={reading?.uid} dotColor={reading?.dotColor}
      onClose={() => setReading(null)} onReply={replyTo} onForward={forward}
    />
  );

  const listColumn = isAll ? (
    <AllInboxesList
      accounts={accounts}
      onOpen={(m) => setReading({ accountId: m._accountId, uid: m.uid, folder: 'INBOX', dotColor: m._color, from: m.from, subject: m.subject, date: m.date })}
    />
  ) : (
    <MailList
      accountId={account?.id} folder={folder} dotColor={dotColor}
      onOpen={(m) => setReading({ accountId: account.id, uid: m.uid, folder, dotColor, from: m.from, subject: m.subject, date: m.date })}
    />
  );

  return (
    <main className={`fk-view fk-inbox ${mobileChatOpen ? 'chat-open' : ''}`}>
      <section className="fk-inbox-center">
        {isAll
          ? header('linear-gradient(135deg,var(--accent),var(--accent2))', 'All boxes', `${accounts.length} mailboxes unified`)
          : !account
            ? null
            : header(dotColor, account.label, folderLabel(folder), account.imap_user)}

        {!isAll && !account ? (
          <div className="fk-inbox-placeholder" style={{ flex: 1 }}>
            <div className="fk-placeholder-card"><h2>No mailbox selected</h2><p>Pick a mailbox from the left to get started.</p></div>
          </div>
        ) : (
          <div className="fk-inbox-body">
            <div className={`fk-inbox-listcol ${reading ? 'narrow' : ''}`}>{listColumn}</div>
            {reading && readingPane}
          </div>
        )}

        {compose && (
          <Composer
            key={compose.key} initial={compose} accounts={accounts} llmProviders={llmProviders} signature={signature}
            onClose={() => setCompose(null)}
            onSent={(label) => { setCompose(null); showToast(`Message sent from ${label}`); }}
          />
        )}

        {toast && <div className="fk-toast">✓ {toast}</div>}
      </section>

      <AgentPanel
        accounts={accounts}
        llmProviders={llmProviders}
        selectedBox={selectedBox}
        agentName={agentName}
        activeEmail={activeEmail}
        collapsed={chatCollapsed}
        onToggleCollapse={() => { if (mobileChatOpen) setMobileChatOpen(false); else setChatCollapsed((c) => !c); }}
        onComposeDraft={(d) => { setMobileChatOpen(false); openCompose({ mode: 'new', accountId: d.accountId ?? defaultAccountId, to: d.to, cc: d.cc, subject: d.subject, body: d.body }); }}
      />

      <button className="fk-chat-fab" title="Chat with Floki" onClick={() => { setChatCollapsed(false); setMobileChatOpen(true); }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 8.5a3.5 3.5 0 0 1-3.5 3.5H6l-3 2.5v-8A3.5 3.5 0 0 1 6 3h3.5A3.5 3.5 0 0 1 13 6.5z" />
          <path d="M16 8h1.5A3.5 3.5 0 0 1 21 11.5v8L18 17h-3.5A3.5 3.5 0 0 1 11 13.5V13" />
        </svg>
      </button>
    </main>
  );
}
