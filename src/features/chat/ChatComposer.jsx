import React from 'react';
import { useSpeech } from '../../lib/useSpeech.js';

const MicIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0 0 12 0" /><line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

// Chat input: text + attach (flagged coming soon — no backend), mic dictation,
// and send/stop. Scope line shows which box the chat is bound to.
export default function ChatComposer({ value, onChange, onSend, onStop, sending, scopeLabel, modelSwitch }) {
  const speech = useSpeech((text) => onChange((value ? value + ' ' : '') + text));

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!sending) onSend(); }
  }

  return (
    <div className="fk-chat-composer">
      <div className="fk-chat-inputbox">
        <input
          className="fk-chat-input"
          value={value}
          placeholder="Talk to your email…"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKey}
        />
        <div className="fk-chat-inputbar">
          <button className="fk-chat-attach" title="Attachments — coming soon" disabled>+</button>
          <span className="fk-spacer" />
          {speech.supported && (
            <button
              className={`fk-chat-mic ${speech.listening ? 'on' : ''}`}
              onClick={speech.toggle}
              title="Voice input"
            ><MicIcon /></button>
          )}
          {sending ? (
            <button className="fk-chat-send stop" onClick={onStop} title="Stop">■</button>
          ) : (
            <button className="fk-chat-send" onClick={onSend} disabled={!value.trim()} title="Send">↑</button>
          )}
        </div>
      </div>
      <div className="fk-chat-scope">
        {modelSwitch}
        <span className="fk-spacer" />
        <span className="fk-mono">{scopeLabel}</span>
      </div>
    </div>
  );
}
