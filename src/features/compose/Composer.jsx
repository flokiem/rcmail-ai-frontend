import React, { useState, useRef } from 'react';
import { sendMail, aiCompose } from '../../lib/api.js';
import { acctColor } from '../../lib/accountColors.js';
import { formatBytes } from '../../lib/mailFormat.js';
import { ComingSoonBadge } from '../common/ComingSoon.jsx';

const ATTACH_MAX_BYTES = 25 * 1024 * 1024; // 25 MB total (matches the server guard)

const TONES = ['Professional', 'Friendly', 'Formal', 'Casual', 'Confident', 'Empathetic'];
const LANGS = ['Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Dutch', 'Japanese', 'Chinese', 'Korean', 'Arabic'];
const TITLES = { new: 'New message', reply: 'Reply', forward: 'Forward' };

// Email composer (floating, or expanded over the center). Send + AI assist
// (Write/Proofread/Expand/Shorten + Tone) are wired to the backend. Translate,
// Schedule-send and Save-draft have no backend yet and are flagged Coming soon.
export default function Composer({ initial = {}, accounts = [], llmProviders = [], signature = '', onClose, onSent }) {
  const acctIndex = (id) => accounts.findIndex((a) => String(a.id) === String(id));
  const [from, setFrom]       = useState(String(initial.accountId || accounts[0]?.id || ''));
  const [to, setTo]           = useState(initial.to || '');
  const [cc, setCc]           = useState(initial.cc || '');
  const [showCc, setShowCc]   = useState(!!initial.cc);
  const [subject, setSubject] = useState(initial.subject || '');
  // Start with the default signature appended (editable before sending).
  const [body, setBody]       = useState(() => {
    const base = initial.body || '';
    return signature ? `${base}\n\n${signature}` : base;
  });
  const [quoted, setQuoted]   = useState(initial.quoted || '');
  const [expanded, setExpanded] = useState(initial.mode === 'reply' || initial.mode === 'forward');
  const [tone, setTone]       = useState('Professional');
  const [menu, setMenu]       = useState(null);     // from | tone | translate | send | null
  const [writeOpen, setWriteOpen] = useState(false);
  const [writePrompt, setWritePrompt] = useState('');
  const [aiBusy, setAiBusy]   = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError]     = useState('');
  const [attachments, setAttachments] = useState([]); // File[]
  const fileInputRef = useRef(null);

  const llmId = llmProviders[0]?.id;
  const fromAcct = accounts.find((a) => String(a.id) === String(from));

  function addFiles(fileList) {
    const picked = Array.from(fileList || []);
    if (!picked.length) return;
    const next = [...attachments, ...picked];
    const total = next.reduce((n, f) => n + f.size, 0);
    if (total > ATTACH_MAX_BYTES) {
      setError(`Attachments exceed the ${formatBytes(ATTACH_MAX_BYTES)} total limit.`);
      return;
    }
    setError('');
    setAttachments(next);
  }

  function removeFile(i) {
    setAttachments((list) => list.filter((_, idx) => idx !== i));
  }

  async function runAi(action, { instruction } = {}) {
    if (aiBusy) return;
    if (action !== 'write' && !body.trim()) { setError('Write something in the body first, or use "Write for me".'); return; }
    setError(''); setAiBusy(action); setMenu(null);
    try {
      const text = await aiCompose({ llmId, action, text: body, instruction, tone });
      if (text) setBody(text);
    } catch (e) { setError(e.message); }
    finally { setAiBusy(''); }
  }

  async function generateWrite() {
    if (!writePrompt.trim()) return;
    await runAi('write', { instruction: writePrompt });
    setWriteOpen(false); setWritePrompt('');
  }

  async function pickTone(t) {
    setTone(t); setMenu(null);
    if (!body.trim() || aiBusy) return;     // no text yet → tone just applies to future AI actions
    setError(''); setAiBusy('tone');
    try {
      const text = await aiCompose({
        llmId, action: 'write', tone: t, text: body,
        instruction: `Rewrite the email below in a ${t.toLowerCase()} tone. Keep the same meaning, recipient and key points. Return only the body.`,
      });
      if (text) setBody(text);
    } catch (e) { setError(e.message); }
    finally { setAiBusy(''); }
  }

  async function send() {
    if (sending) return;
    if (!from) { setError('Pick an account to send from.'); return; }
    if (!to.trim() || !subject.trim()) { setError('To and subject are required.'); return; }
    const finalBody = body + (quoted ? `\n\n${quoted}` : '');
    if (!finalBody.trim()) { setError('Write a message first.'); return; }
    setSending(true); setError(''); setMenu(null);
    try {
      await sendMail(from, { to, cc: cc || undefined, subject, body: finalBody }, attachments);
      onSent?.(fromAcct?.label || 'your mailbox');
    } catch (e) { setError(e.message || 'Network error. Please try again.'); }
    finally { setSending(false); }
  }

  return (
    <div className={`fk-cmp ${expanded ? 'expanded' : ''}`}>
      <div className="fk-cmp-head">
        <span className="fk-cmp-grip">⠿</span>
        <span className="fk-cmp-title">{TITLES[initial.mode] || 'New message'}</span>
        <span className="fk-spacer" />
        <button className="fk-cmp-headbtn" title={expanded ? 'Collapse' : 'Expand'} onClick={() => setExpanded((e) => !e)}>{expanded ? '⤡' : '⤢'}</button>
        <button className="fk-cmp-headbtn" title="Discard" onClick={onClose}>✕</button>
      </div>

      {/* From */}
      <div className="fk-cmp-row fk-cmp-from">
        <span className="fk-cmp-lbl">From</span>
        <button className="fk-cmp-frombtn" onClick={() => setMenu((m) => (m === 'from' ? null : 'from'))}>
          <span className="fk-cmp-dot" style={{ background: fromAcct ? acctColor(acctIndex(from)) : 'var(--muted)' }} />
          <span className="fk-cmp-fromlabel">{fromAcct?.label || 'Select account'}</span>
          <span className="fk-cmp-fromemail">{fromAcct?.imap_user || ''}</span>
          <span className="fk-cmp-caret">⌄</span>
        </button>
        {menu === 'from' && (
          <div className="fk-cmp-menu fk-cmp-frommenu">
            <div className="fk-cmp-menu-label">SEND FROM</div>
            {accounts.map((a, i) => (
              <button key={a.id} className="fk-cmp-menu-row" onClick={() => { setFrom(String(a.id)); setMenu(null); }}>
                <span className="fk-cmp-dot" style={{ background: acctColor(i) }} />
                <span><span className="fk-cmp-menu-name">{a.label}</span><span className="fk-cmp-menu-email">{a.imap_user}</span></span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* To / Cc */}
      <div className="fk-cmp-row">
        <span className="fk-cmp-lbl">To</span>
        <input className="fk-cmp-input" value={to} placeholder="Recipients" onChange={(e) => setTo(e.target.value)} />
        <button className="fk-cmp-cc" onClick={() => setShowCc((s) => !s)}>Cc</button>
      </div>
      {showCc && (
        <div className="fk-cmp-row">
          <span className="fk-cmp-lbl">Cc</span>
          <input className="fk-cmp-input" value={cc} placeholder="Carbon copy" onChange={(e) => setCc(e.target.value)} />
        </div>
      )}

      {/* Subject */}
      <div className="fk-cmp-row">
        <span className="fk-cmp-lbl">Subject</span>
        <input className="fk-cmp-input fk-cmp-subject" value={subject} placeholder="Subject" onChange={(e) => setSubject(e.target.value)} />
      </div>

      {/* AI toolbar */}
      <div className="fk-cmp-aibar">
        <button className="fk-cmp-ai primary" onClick={() => { setWriteOpen((o) => !o); setMenu(null); }} disabled={!!aiBusy}>✨ Write for me</button>
        <span className="fk-cmp-aisep" />
        <button className="fk-cmp-ai" onClick={() => runAi('proofread')} disabled={!!aiBusy}>✓ Proofread</button>
        <button className="fk-cmp-ai" onClick={() => runAi('expand')} disabled={!!aiBusy}>↔ Expand</button>
        <button className="fk-cmp-ai" onClick={() => runAi('shorten')} disabled={!!aiBusy}>→← Shorten</button>

        <div className="fk-cmp-aiwrap">
          <button className="fk-cmp-ai" onClick={() => setMenu((m) => (m === 'tone' ? null : 'tone'))} disabled={!!aiBusy}>◗ {tone} <span className="fk-cmp-caret">⌄</span></button>
          {menu === 'tone' && (
            <div className="fk-cmp-menu fk-cmp-tonemenu">
              <div className="fk-cmp-menu-label">REWRITE IN TONE</div>
              {TONES.map((t) => (
                <button key={t} className="fk-cmp-menu-row" onClick={() => pickTone(t)}>
                  <span className="fk-cmp-menu-name">{t}</span>{t === tone && <span className="fk-cmp-check">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="fk-cmp-aiwrap">
          <button className="fk-cmp-ai" onClick={() => setMenu((m) => (m === 'translate' ? null : 'translate'))} disabled={!!aiBusy}>⌘ Translate <ComingSoonBadge label="soon" /></button>
          {menu === 'translate' && (
            <div className="fk-cmp-menu fk-cmp-transmenu">
              <div className="fk-cmp-menu-label">TRANSLATE TO · coming soon</div>
              {LANGS.map((l) => (
                <button key={l} className="fk-cmp-menu-row" disabled><span className="fk-cmp-menu-name">{l}</span></button>
              ))}
            </div>
          )}
        </div>

        <span className="fk-spacer" />
        {aiBusy && <span className="fk-cmp-busy"><span className="fk-cmp-busy-dot" />Floki is writing…</span>}
      </div>

      {writeOpen && (
        <div className="fk-cmp-writerow">
          <input
            className="fk-cmp-input" autoFocus value={writePrompt}
            placeholder="Tell Floki what to write… e.g. a polite follow-up about the invoice"
            onChange={(e) => setWritePrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') generateWrite(); }}
          />
          <button className="fk-cmp-gen" onClick={generateWrite} disabled={!writePrompt.trim() || !!aiBusy}>
            {aiBusy === 'write' ? '…' : 'Generate'}
          </button>
        </div>
      )}

      {error && <div className="fk-cmp-error">{error}</div>}

      <textarea
        className="fk-cmp-body" value={body}
        placeholder="Write your message, or let Floki draft it for you…"
        onChange={(e) => setBody(e.target.value)}
      />

      {quoted && (
        <div className="fk-cmp-quote">
          <div className="fk-cmp-quote-head">
            <span className="fk-mono fk-faint">QUOTED ORIGINAL</span>
            <span className="fk-spacer" />
            <button className="fk-cmp-quote-rm" onClick={() => setQuoted('')}>Remove</button>
          </div>
          <div className="fk-cmp-quote-body">{quoted}</div>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="fk-cmp-attach">
          {attachments.map((f, i) => (
            <span key={`${f.name}-${i}`} className="fk-cmp-attach-chip" title={f.name}>
              <span className="fk-cmp-attach-ico">📎</span>
              <span className="fk-cmp-attach-name">{f.name}</span>
              <span className="fk-cmp-attach-size">{formatBytes(f.size)}</span>
              <button className="fk-cmp-attach-rm" onClick={() => removeFile(i)} title="Remove" disabled={sending}>×</button>
            </span>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
      />

      <div className="fk-cmp-foot">
        <div className="fk-cmp-sendwrap">
          <button className="fk-cmp-send" onClick={send} disabled={sending}>{sending ? 'Sending…' : 'Send ➤'}</button>
          <button className="fk-cmp-send-caret" onClick={() => setMenu((m) => (m === 'send' ? null : 'send'))} title="Send options">⌄</button>
          {menu === 'send' && (
            <div className="fk-cmp-menu fk-cmp-sendmenu">
              <button className="fk-cmp-menu-row" onClick={send}><span className="fk-cmp-menu-name">Send now</span><span className="fk-cmp-menu-email">Delivers immediately</span></button>
              <button className="fk-cmp-menu-row" disabled><span className="fk-cmp-menu-name">Send later <ComingSoonBadge label="soon" /></span><span className="fk-cmp-menu-email">Schedule a time</span></button>
            </div>
          )}
        </div>
        <span className="fk-spacer" />
        <button className="fk-cmp-footbtn" title="Attach files" onClick={() => fileInputRef.current?.click()} disabled={sending}>📎</button>
        <button className="fk-cmp-footbtn" title="Save draft — coming soon" disabled>🖫</button>
        <button className="fk-cmp-footbtn" title="Discard" onClick={onClose}>🗑</button>
      </div>
    </div>
  );
}
