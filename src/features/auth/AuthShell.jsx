import React from 'react';
import { useTheme } from '../../lib/useTheme.js';

// Shared frame for Login / Setup / Reset-Password: applies the user's saved
// theme (so the card matches their chosen scheme) over the design's dark
// cosmic backdrop. `wide` widens the inner column for the multi-field Setup.
export default function AuthShell({ children, wide = false }) {
  const { theme, customStyle } = useTheme();
  return (
    <div className="floki-app fk-auth" data-theme={theme} style={customStyle}>
      <div className="fk-auth-grid" />
      <div className="fk-auth-glow" />
      <div className={`fk-auth-inner ${wide ? 'wide' : ''}`}>{children}</div>
    </div>
  );
}
