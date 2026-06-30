import React from 'react';
import { acctColor, initialsOf } from '../../lib/accountColors.js';
import { ComingSoonBadge } from '../common/ComingSoon.jsx';
import BoxFolders from './BoxFolders.jsx';

// Left navigation rail: brand, primary nav, the account "boxes" with an
// expandable folder rail, and the settings / user footer.
export default function Sidebar({
  brandName = 'Floki',
  accounts = [],
  selectedBox = 'all',
  onSelectBox,
  expandedBox = null,
  folder = 'INBOX',
  onSelectFolder,
  view = 'inbox',
  onNavigate,
  userEmail = '',
  onOpenMailSettings,
}) {
  const showAll = accounts.length > 1;
  const boxes = [
    ...(showAll ? [{ key: 'all', name: 'All boxes', provider: '', isAll: true }] : []),
    ...accounts.map((a, i) => ({
      key: String(a.id),
      name: a.label,
      provider: a.imap_user,
      color: acctColor(i),
    })),
  ];

  return (
    <aside className="fk-sidebar">
      {/* Brand */}
      <div className="fk-brand">
        <div className="fk-brand-mark"><img src="/flokilogo.PNG" alt="Floki" /></div>
        <div className="fk-brand-text">
          <div className="fk-brand-name">{brandName}</div>
          <div className="fk-brand-sub">MAIL · AGENT</div>
        </div>
      </div>

      {/* Primary nav */}
      <nav className="fk-nav">
        <button
          className={`fk-nav-item ${view === 'automations' ? 'active' : ''}`}
          onClick={() => onNavigate?.('automations')}
        >
          <span className="fk-nav-label"><span className="fk-nav-ico fk-nav-ico-accent">◈</span>Automations</span>
          <span className="fk-nav-count">5</span>
        </button>

        <div className="fk-nav-gap" />

        <button
          className={`fk-nav-item ${view === 'inbox' ? 'active' : ''}`}
          onClick={() => onNavigate?.('inbox')}
        >
          <span className="fk-nav-label"><span className="fk-nav-ico">✉</span>Inbox</span>
        </button>

        {[
          { ico: '➤', label: 'Sent' },
          { ico: '❏', label: 'Drafts' },
          { ico: '★', label: 'Starred' },
        ].map((it) => (
          <div key={it.label} className="fk-nav-item fk-nav-soon" title="Coming soon">
            <span className="fk-nav-label"><span className="fk-nav-ico">{it.ico}</span>{it.label}</span>
            <ComingSoonBadge label="soon" />
          </div>
        ))}
      </nav>

      {/* Boxes */}
      <div className="fk-section-label">BOXES</div>
      <div className="fk-boxes">
        {boxes.map((b) => (
          <div key={b.key} className="fk-box-group">
            <button
              className={`fk-box ${selectedBox === b.key ? 'active' : ''}`}
              onClick={() => onSelectBox?.(b.key)}
            >
              <span
                className="fk-box-dot"
                style={b.isAll
                  ? { background: 'linear-gradient(135deg,var(--accent),var(--accent2))', borderRadius: 2 }
                  : { background: b.color }}
              />
              <span className="fk-box-name">
                {b.name}
                {b.provider && <span className="fk-box-prov"> · {b.provider}</span>}
              </span>
              {!b.isAll && <span className={`fk-box-chev ${expandedBox === b.key ? 'open' : ''}`}>›</span>}
            </button>
            {!b.isAll && expandedBox === b.key && (
              <BoxFolders
                accountId={b.key}
                activeFolder={folder}
                isActiveBox={selectedBox === b.key}
                onSelectFolder={(path) => onSelectFolder?.(b.key, path)}
              />
            )}
          </div>
        ))}
        <button className="fk-box fk-box-add" onClick={onOpenMailSettings}>
          <span className="fk-box-add-ico">+</span>
          <span>Add a mailbox</span>
        </button>
      </div>

      {/* Footer */}
      <div className="fk-sidebar-foot">
        <button
          className={`fk-nav-item ${view === 'settings' ? 'active' : ''}`}
          onClick={() => onNavigate?.('settings')}
        >
          <span className="fk-nav-label"><span className="fk-nav-ico">⚙</span>Settings</span>
        </button>

        <div className="fk-isolated">
          <span className="fk-isolated-ico">🔒</span>
          <div>
            <div className="fk-isolated-title">Accounts isolated</div>
            <div className="fk-isolated-sub">no cross-box</div>
          </div>
        </div>

        <button className="fk-user" onClick={onOpenMailSettings} title="Mail settings">
          <span className="fk-user-avatar">{initialsOf(userEmail)}</span>
          <span className="fk-user-text">
            <span className="fk-user-name">{userEmail || 'Account'}</span>
            <span className="fk-user-sub">{accounts.length} {accounts.length === 1 ? 'mailbox' : 'mailboxes'}</span>
          </span>
          <span className="fk-user-caret">⌄</span>
        </button>
      </div>
    </aside>
  );
}
