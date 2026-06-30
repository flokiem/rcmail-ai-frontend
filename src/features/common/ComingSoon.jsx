import React from 'react';

// Small pill used to flag a control/feature whose backend doesn't exist yet.
export function ComingSoonBadge({ className = '', label = 'Coming soon' }) {
  return <span className={`cs-badge ${className}`}>{label}</span>;
}

// Wrapper that renders the (dummy-data) UI for a not-yet-functional feature:
// a corner flag + the content dimmed and non-interactive. Use `block` for a
// full-section overlay, or pass `note` for an explanatory line underneath.
export default function ComingSoon({ children, label = 'Coming soon', note, className = '' }) {
  return (
    <div className={`cs-wrap ${className}`}>
      <div className="cs-flag"><span className="cs-flag-dot" />{label}</div>
      <div className="cs-content">{children}</div>
      {note && <div className="cs-note">{note}</div>}
    </div>
  );
}
