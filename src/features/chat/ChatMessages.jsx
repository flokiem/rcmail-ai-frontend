import React, { useRef, useEffect } from 'react';
import { formatContent } from './chatFormat.js';

const PILLS = [
  { icon: '↩', label: 'Show unread', q: 'Show me my unread emails.' },
  { icon: '✎', label: 'Draft a message', q: 'Draft a message to ' },
  { icon: '▤', label: 'Organize inbox', q: 'Help me clean up and organize my inbox.' },
  { icon: '🔍', label: 'Search mail', q: 'Search my emails for ' },
];

// Scrollable message stream: welcome state (no/empty thread), the conversation,
// the working-on-it indicator (with current tool), and errors.
export default function ChatMessages({ messages, isTyping, typingTool, onPick }) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages, isTyping]);

  const empty = messages.length === 0 && !isTyping;

  return (
    <div className="fk-chat-msgs">
      {empty && (
        <div className="fk-chat-welcome">
          <div className="fk-chat-welcome-mark"><img src="/flokilogo.PNG" alt="" /></div>
          <div className="fk-chat-welcome-title">What can I do for you today?</div>
          <div className="fk-chat-welcome-desc">I'm your AI assistant — ask me to read your emails, search messages, summarize, or manage your inbox.</div>
          <div className="fk-chat-pills">
            {PILLS.map((p) => (
              <button key={p.label} className="fk-chat-pill" onClick={() => onPick(p.q)}>
                <span className="fk-chat-pill-ico">{p.icon}</span>{p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((m, i) => (
        <div key={i} className={`fk-bubble ${m.role === 'user' ? 'user' : 'agent'}`}
          dangerouslySetInnerHTML={{ __html: formatContent(m.content) }} />
      ))}

      {isTyping && (
        <div className="fk-bubble agent fk-thinking">
          <span className="fk-typing"><span /><span /><span /></span>
          {typingTool && <span className="fk-thinking-tool">{typingTool}</span>}
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
