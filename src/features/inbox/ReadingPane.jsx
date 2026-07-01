import React, { useState, useEffect, useRef } from 'react';
import { readInboxEmail, downloadAttachment } from '../../lib/api.js';
import { getCachedMail, setCachedMail } from '../../lib/mailCache.js';
import { emailSrcDoc, senderName, initialsFromName, formatBytes } from '../../lib/mailFormat.js';

// Full single-email view (live read, keeps original HTML in a sandboxed iframe).
// Reply/Forward open the composer; "Reply with AI" asks Floki to draft a reply
// for this email (onReplyWithAI). All action props are optional.
export default function ReadingPane({ accountId, folder, uid, dotColor, onClose, onReply, onForward, onReplyWithAI }) {
  const [detail, setDetail]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [dlBusy, setDlBusy]   = useState(null);   // attachment index currently downloading
  const [dlError, setDlError] = useState('');

  async function grabAttachment(a) {
    if (dlBusy != null) return;
    setDlError(''); setDlBusy(a.index);
    try {
      await downloadAttachment(accountId, uid, a.index, { folder, filename: a.filename });
    } catch (e) { setDlError(e.message); }
    finally { setDlBusy(null); }
  }

  // Auto-size the email iframe to its content so the message flows down the
  // pane (single scroll) instead of scrolling inside a fixed-height box.
  const frameRef = useRef(null);
  const roRef = useRef(null);
  const lastWidthRef = useRef(0);
  const fit = () => {
    const f = frameRef.current; if (!f) return;
    try {
      const doc = f.contentDocument || f.contentWindow?.document;
      if (!doc?.body) return;
      const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, doc.body.offsetHeight);
      if (h) f.style.height = h + 'px';
    } catch { /* cross-origin — keep default height */ }
  };
  const onFrameLoad = () => {
    // Measure AFTER the browser lays the content out (two frames). Reading
    // scrollHeight synchronously in onLoad returns a pre-layout height — that's
    // why it looked small until a window resize forced a reflow.
    requestAnimationFrame(() => requestAnimationFrame(fit));
    try {
      const doc = frameRef.current?.contentDocument;
      // Late reflows: network images and web-font swaps both change the height.
      doc?.querySelectorAll('img')?.forEach((img) => {
        img.addEventListener('load', fit);
        img.addEventListener('error', fit);
      });
      doc?.fonts?.ready?.then(fit).catch(() => {});
    } catch { /* noop */ }
  };
  // Re-fit when the iframe's WIDTH changes (window resize, chat-panel collapse,
  // etc. reflow the email's height). Observed on the iframe element itself
  // (parent side — reliable across the frame boundary) and guarded on width so
  // our own height writes don't loop the observer.
  useEffect(() => {
    const f = frameRef.current;
    if (f && typeof ResizeObserver !== 'undefined') {
      roRef.current = new ResizeObserver((entries) => {
        const w = Math.round(entries[0]?.contentRect?.width ?? f.clientWidth);
        if (w !== lastWidthRef.current) { lastWidthRef.current = w; fit(); }
      });
      roRef.current.observe(f);
      return () => roRef.current?.disconnect();
    }
    const onResize = () => fit();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
        <div className="fk-reading-inner">
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

            {(() => {
              const files = (detail.attachments || []).filter((a) => !a.related);
              if (!files.length) return null;
              return (
                <div className="fk-reading-attach">
                  <div className="fk-reading-attach-head">📎 {files.length} attachment{files.length > 1 ? 's' : ''}</div>
                  <div className="fk-reading-attach-list">
                    {files.map((a) => (
                      <button
                        key={a.index}
                        className="fk-reading-attach-item"
                        onClick={() => grabAttachment(a)}
                        disabled={dlBusy != null}
                        title={`Download ${a.filename}`}
                      >
                        <span className="fk-reading-attach-ico">📄</span>
                        <span className="fk-reading-attach-info">
                          <span className="fk-reading-attach-name">{a.filename}</span>
                          {a.size ? <span className="fk-reading-attach-size">{formatBytes(a.size)}</span> : null}
                        </span>
                        <span className="fk-reading-attach-dl">{dlBusy === a.index ? '…' : '⤓'}</span>
                      </button>
                    ))}
                  </div>
                  {dlError && <div className="fk-mail-error">{dlError}</div>}
                </div>
              );
            })()}

            <div className="fk-reading-actions">
              <button className="fk-reading-act ai" onClick={() => onReplyWithAI?.(detail)}>↩ Reply with AI</button>
              <button className="fk-reading-act" onClick={() => onForward?.(detail)}>↪ Forward</button>
            </div>
          </>
        ) : null}
        </div>
      </div>
    </div>
  );
}
