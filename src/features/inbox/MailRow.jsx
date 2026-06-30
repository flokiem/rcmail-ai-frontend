import React from 'react';
import { fmtRowDate, senderName } from '../../lib/mailFormat.js';

// One message row. `accountLabel` is shown only in the merged All-boxes list so
// you can tell which mailbox a message came from. onOpen receives the message.
export default function MailRow({ msg, dotColor, accountLabel, onOpen }) {
  const unread = !msg.seen;
  return (
    <button className={`fk-mail-row ${unread ? 'unread' : ''}`} onClick={() => onOpen(msg)}>
      <span className="fk-mail-dot" style={{ background: unread ? dotColor : 'transparent' }} />
      <span className="fk-mail-main">
        <span className="fk-mail-top">
          <span className="fk-mail-from">{senderName(msg.from)}</span>
          {accountLabel && <span className="fk-mail-acct" style={{ color: dotColor }}>{accountLabel}</span>}
          {msg.flagged && <span className="fk-mail-flag" title="Flagged">★</span>}
          <span className="fk-spacer" />
          <span className="fk-mail-time">{fmtRowDate(msg.date)}</span>
        </span>
        <span className="fk-mail-sub">{msg.subject || '(no subject)'}</span>
      </span>
    </button>
  );
}
