import React from 'react';

// Collapsed Floki rail (60px). Expands the panel, starts a new chat, or opens
// history (which also expands).
export default function AgentRail({ dotColor, onExpand, onNewChat, onHistory }) {
  return (
    <aside className="fk-chat-rail">
      <button className="fk-rail-btn" title="Expand Floki" onClick={onExpand}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="15" y1="3" x2="15" y2="21" /><polyline points="10 9 7 12 10 15" />
        </svg>
      </button>
      <div className="fk-rail-mark"><img src="/flokilogo.PNG" alt="" /></div>
      <span className="fk-rail-sep" />
      <button className="fk-rail-btn" title="New chat" onClick={onNewChat}>＋</button>
      <button className="fk-rail-btn" title="Chat history" onClick={onHistory}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 8.5a3.5 3.5 0 0 1-3.5 3.5H6l-3 2.5v-8A3.5 3.5 0 0 1 6 3h3.5A3.5 3.5 0 0 1 13 6.5z" />
          <path d="M16 8h1.5A3.5 3.5 0 0 1 21 11.5v8L18 17h-3.5A3.5 3.5 0 0 1 11 13.5V13" />
        </svg>
      </button>
      <span className="fk-spacer" />
      <span className="fk-rail-dot" style={{ background: dotColor }} />
    </aside>
  );
}
