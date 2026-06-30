import React, { useState, useEffect, useRef } from 'react';
import { readInboxEmail } from '../../lib/api.js';
import { getCachedMail, setCachedMail } from '../../lib/mailCache.js';
import { emailSrcDoc, senderName, initialsFromName } from '../../lib/mailFormat.js';

// Full single-email view (live read, keeps original HTML in a sandboxed iframe).
// Reply/Forward are wired to the composer in Phase 4 (props are optional).
export default function ReadingPane({ accountId, folder, uid, dotColor, onClose, onReply, onForward }) {
  const [detail, setDetail]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // Auto-size the email iframe to its content so the message flows down the
  // pane (single scroll) instead of scrolling inside a fixed-height box.
  const frameRef = useRef(null);
  const roRef = useRef(null);
  const fit = () => {
    const f = frameRef.current; if (!f) return;
    try {
      const doc = f.contentDocument || f.contentWindow?.document;
      if (!doc?.body) return;
      const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
      if (h) f.style.height = h + 'px';
    } catch { /* cross-origin — keep default height */ }
  };
  const onFrameLoad = () => {
    fit();
    try {
      const doc = frameRef.current?.contentDocument;
      roRef.current?.disconnect();
      if (typeof ResizeObserver !== 'undefined' && doc?.body) {
        roRef.current = new ResizeObserver(() => fit());
        roRef.current.observe(doc.body);
      }
      doc?.querySelectorAll('img')?.forEach((img) => { if (!img.complete) img.addEventListener('load', fit); });
    } catch { /* noop */ }
  };
  useEffect(() => () => roRef.current?.disconnect(), []);

  useEffect(() => {
    let alive = true;
    const cached = getCachedMail(accountId, folder, uid);
    setError('');
    if (cached) { setDetail(cached); setLoading(false); } else { setDetail(null); setLoading(true); }
    readInboxEmail(accountId, uid, folder)
      .then((d) => { if (alive) { setDetail(d); setCachedMail(accountId, folder, uid, d); } })
      .catch((e) => { if (alive && !cached) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [accountId, folder, uid]);

  const name = detail ? senderName(detail.from) : '';

  return (
    <div className="fk-reading">
      <div className="fk-reading-head">
        <button className="fk-reading-back" onClick={onClose}><span>←</span> Back</button>
        <span className="fk-spacer" />
        <button className="fk-reading-act primary" onClick={() => onReply?.(detail)}>↩ Reply</button>
        <button className="fk-reading-act" onClick={() => onForward?.(detail)}>↪ Forward</button>
      </div>

      <div className="fk-reading-body">
        {loading && !detail ? (
          <div className="fk-mail-empty">Loading email…</div>
        ) : error ? (
          <div className="fk-mail-error">{error}</div>
        ) : detail ? (
          <>
            <div className="fk-reading-subject">{detail.subject || '(no subject)'}</div>
            <div className="fk-reading-meta">
              <span className="fk-reading-avatar" style={{ background: 'var(--av)', color: dotColor }}>{initialsFromName(name)}</span>
              <div className="fk-reading-who">
                <div className="fk-reading-name">{name} <span className="fk-reading-addr">&lt;{detail.from}&gt;</span></div>
                {detail.to && <div className="fk-reading-to">to {detail.to}</div>}
              </div>
              <span className="fk-mono fk-faint">{detail.date ? new Date(detail.date).toLocaleString() : ''}</span>
            </div>

            <div className="fk-reading-content">
              {detail.html ? (
                <iframe
                  ref={frameRef}
                  title="email"
                  className="fk-reading-iframe"
                  sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                  srcDoc={emailSrcDoc(detail.html)}
                  onLoad={onFrameLoad}
                />
              ) : (
                <div className="fk-reading-text">{detail.body || '(empty message)'}</div>
              )}
            </div>

            {detail.attachments?.length > 0 && (
              <div className="fk-reading-attach">
                📎 {detail.attachments.length} attachment{detail.attachments.length > 1 ? 's' : ''}: {detail.attachments.map((a) => a.filename).join(', ')}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
