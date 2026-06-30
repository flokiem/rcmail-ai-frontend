import React from 'react';
import { fmtRowDate, dateGroup } from '../../lib/mailFormat.js';

// Conversation switcher: active-title button + chat-history dropdown grouped
// into Today / Earlier, with per-row delete.
export default function ChatHistory({ threads, currentThreadId, open, onToggle, onNew, onOpen, onDelete, scopeLabel }) {
  const active = threads.find((t) => t.id === currentThreadId);
  const groups = [['today', 'TODAY'], ['earlier', 'EARLIER']]
    .map(([k, label]) => ({
      label,
      items: threads.filter((t) => (dateGroup(t.updated_at) === 'today') === (k === 'today')),
    }))
    .filter((g) => g.items.length);

  return (
    <div className="fk-chat-switch">
      <div className="fk-chat-switch-bar">
        <button className="fk-chat-switch-active" onClick={onToggle} title="Chat history">
          <span className="fk-chat-switch-title">{active ? active.title : 'New chat'}</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 8.5a3.5 3.5 0 0 1-3.5 3.5H6l-3 2.5v-8A3.5 3.5 0 0 1 6 3h3.5A3.5 3.5 0 0 1 13 6.5z" />
            <path d="M16 8h1.5A3.5 3.5 0 0 1 21 11.5v8L18 17h-3.5A3.5 3.5 0 0 1 11 13.5V13" />
          </svg>
        </button>
        <button className="fk-chat-newbtn" onClick={onNew} title="New chat">＋</button>
      </div>

      {open && (
        <>
          <div className="fk-chat-switch-overlay" onClick={onToggle} />
          <div className="fk-chat-switch-menu">
            <button className="fk-chat-menu-new" onClick={onNew}>
              <span className="fk-chat-menu-new-ico">＋</span>
              <span>New chat</span>
              <span className="fk-chat-menu-scope">{scopeLabel}</span>
            </button>
            <div className="fk-chat-menu-list">
              {threads.length === 0 && <div className="fk-chat-menu-empty">No chats in this mailbox yet.</div>}
              {groups.map((g) => (
                <div key={g.label}>
                  <div className="fk-chat-menu-grouplabel">{g.label}</div>
                  {g.items.map((c) => (
                    <div key={c.id} className={`fk-chat-menu-row ${c.id === currentThreadId ? 'active' : ''}`}>
                      <button className="fk-chat-menu-open" onClick={() => onOpen(c.id)}>
                        <span className="fk-chat-menu-title">{c.title}</span>
                      </button>
                      <span className="fk-chat-menu-when">{fmtRowDate(c.updated_at)}</span>
                      <button className="fk-chat-menu-del" title="Delete chat" onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}>✕</button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
