import React, { useRef, useEffect } from 'react';
import { fmtRowDate, senderName } from '../../lib/mailFormat.js';

// Coordinates open swipes so only one row is revealed at a time (mobile).
const swipeBus = typeof window !== 'undefined' ? new EventTarget() : null;
const MOBILE = '(max-width: 860px)';

// One message row. `accountLabel` is shown only in the merged All-boxes list so
// you can tell which mailbox a message came from. onOpen receives the message.
// Desktop: quick actions (Reply / Star / Trash) appear on hover, right-aligned.
// Mobile (≤860px): the actions sit behind the row content on the right edge and
// are revealed by a right→left swipe that slides the content aside (see the swipe
// effect + the ≤860px CSS). Each action stops propagation so it doesn't also open
// the email. onStar/onTrash/onReply optional.
export default function MailRow({ msg, dotColor, accountLabel, onOpen, onReply, onStar, onTrash, busy }) {
  const unread = !msg.seen;

  const rowRef = useRef(null);
  const actionsRef = useRef(null);
  const openRef = useRef(false);          // is the swipe tray open? (mobile only)
  const suppressClickRef = useRef(false); // swallow the click that follows a drag
  const idRef = useRef(Symbol('row'));

  const setX = (px) => rowRef.current?.style.setProperty('--swipe-x', px + 'px');
  const closeSwipe = () => {
    if (!openRef.current) return;
    openRef.current = false;
    rowRef.current?.classList.remove('dragging'); // keep the CSS transition for the snap-back
    setX(0);
  };

  // Right→left swipe reveals the actions on the right — mobile only (the content
  // slides left to expose the tray). Native listeners (not React's) so we can
  // preventDefault to block vertical scroll, but only once a horizontal drag is
  // committed. Position is driven entirely by the --swipe-x CSS var, which the
  // desktop stylesheet never reads.
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const mq = window.matchMedia(MOBILE);
    let startX = 0, startY = 0, dir = null, base = 0, max = 0, cur = 0, moved = false;

    const onStart = (e) => {
      if (!mq.matches || e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dir = null; moved = false;
      suppressClickRef.current = false;
      max = actionsRef.current?.offsetWidth || 120;
      base = openRef.current ? -max : 0; // open = content shifted left by the tray width
    };
    const onMove = (e) => {
      if (!mq.matches || dir === 'y') return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (dir === null) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return; // ignore tiny jitters
        dir = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (dir === 'x') row.classList.add('dragging');
        else return; // vertical → let the list scroll
      }
      e.preventDefault();
      moved = true;
      cur = Math.min(0, Math.max(-max, base + dx)); // finger right→left (dx<0) slides content left
      setX(cur);
    };
    const onEnd = () => {
      if (dir !== 'x') { dir = null; return; }
      dir = null;
      row.classList.remove('dragging'); // re-enable the transition for the snap
      suppressClickRef.current = moved;
      const willOpen = cur < -max * 0.4;
      openRef.current = willOpen;
      setX(willOpen ? -max : 0);
      if (willOpen) swipeBus?.dispatchEvent(new CustomEvent('floki-swipe-open', { detail: idRef.current }));
    };

    row.addEventListener('touchstart', onStart, { passive: true });
    row.addEventListener('touchmove', onMove, { passive: false });
    row.addEventListener('touchend', onEnd);
    row.addEventListener('touchcancel', onEnd);
    return () => {
      row.removeEventListener('touchstart', onStart);
      row.removeEventListener('touchmove', onMove);
      row.removeEventListener('touchend', onEnd);
      row.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  // Close this row's tray when another row opens.
  useEffect(() => {
    if (!swipeBus) return;
    const onOther = (e) => { if (e.detail !== idRef.current) closeSwipe(); };
    swipeBus.addEventListener('floki-swipe-open', onOther);
    return () => swipeBus.removeEventListener('floki-swipe-open', onOther);
  }, []);

  const handleClick = () => {
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    closeSwipe();   // tapping the email hides the tray (action buttons keep it open, via act())
    onOpen(msg);    // ...and opens the email
  };

  // Actions keep the tray open (e.g. star toggles in place); Trash unmounts the
  // row and Reply opens the composer over it, so neither needs an explicit close.
  const act = (fn) => (e) => { e.stopPropagation(); fn?.(msg); };

  return (
    <div
      ref={rowRef}
      className={`fk-mail-row ${unread ? 'unread' : ''}`}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(msg); } }}
    >
      <span className="fk-mail-actions" ref={actionsRef}>
        <button className="fk-mail-act" title="Reply" onClick={act(onReply)} disabled={busy} aria-label="Reply">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></svg>
        </button>
        <button className={`fk-mail-act ${msg.flagged ? 'on' : ''}`} title={msg.flagged ? 'Unstar' : 'Star'} onClick={act(onStar)} disabled={busy} aria-label="Star">
          <svg width="15" height="15" viewBox="0 0 24 24" fill={msg.flagged ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
        </button>
        <button className="fk-mail-act danger" title="Trash" onClick={act(onTrash)} disabled={busy} aria-label="Trash">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
        </button>
      </span>

      <div className="fk-mail-slide">
        <span className="fk-mail-dot" style={{ background: unread ? dotColor : 'transparent' }} />
        <span className="fk-mail-main">
          <span className="fk-mail-top">
            <span className="fk-mail-from">{senderName(msg.from)}</span>
            {accountLabel && <span className="fk-mail-acct" style={{ color: dotColor }}>{accountLabel}</span>}
            {msg.flagged && <span className="fk-mail-flag" title="Starred">★</span>}
            <span className="fk-spacer" />
            <span className="fk-mail-time">{fmtRowDate(msg.date)}</span>
          </span>
          <span className="fk-mail-sub">{msg.subject || '(no subject)'}</span>
        </span>
      </div>
    </div>
  );
}
