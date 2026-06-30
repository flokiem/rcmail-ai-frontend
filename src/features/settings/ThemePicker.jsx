import React from 'react';
import { THEMES, ACCENT_SWATCHES, ACCENT2_SWATCHES } from '../../lib/theme.js';

function SchemeCard({ sc, active, onClick }) {
  return (
    <button type="button" className={`fk-scheme ${active ? 'active' : ''}`} onClick={onClick}>
      <div className="fk-scheme-mock" style={{ borderColor: sc.line }}>
        <span className="fk-scheme-rail" style={{ background: sc.rail }} />
        <span className="fk-scheme-center" style={{ background: sc.center, borderColor: sc.line }}>
          <span className="fk-scheme-dot" style={{ background: sc.accent }} />
          <span className="fk-scheme-dot" style={{ background: sc.accent2 }} />
          <span className="fk-scheme-bar" style={{ background: sc.ink }} />
        </span>
        <span className="fk-scheme-card" style={{ background: sc.card, borderColor: sc.line }} />
      </div>
      <div className="fk-scheme-row">
        <span className="fk-scheme-name">{sc.name}</span>
        {active && <span className="fk-scheme-check">✓</span>}
      </div>
      <div className="fk-scheme-desc">{sc.desc}</div>
    </button>
  );
}

export default function ThemePicker({ theme, accent, accent2, setTheme, setAccent, setAccent2 }) {
  // The custom card uses the current custom colors for its preview.
  const customCard = {
    id: 'custom', name: 'Custom', desc: 'Your brand colors',
    bg: '#fff', rail: '#f0f0f0', center: '#fafafa', card: '#ffffff',
    accent, accent2, ink: '#1b2130', line: '#e5e5e5',
  };

  return (
    <div>
      <div className="fk-scheme-grid">
        {THEMES.map((sc) => (
          <SchemeCard key={sc.id} sc={sc} active={theme === sc.id} onClick={() => setTheme(sc.id)} />
        ))}
        <SchemeCard sc={customCard} active={theme === 'custom'} onClick={() => setTheme('custom')} />
      </div>

      {theme === 'custom' && (
        <div className="fk-custom-colors">
          <div className="fk-custom-row">
            <div className="fk-custom-col">
              <div className="fk-field-label">Primary</div>
              <div className="fk-swatch-row">
                <label className="fk-color-input" style={{ background: accent }}>
                  <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} />
                </label>
                <span className="fk-hex">{accent.toUpperCase()}</span>
                <span className="fk-spacer" />
                {ACCENT_SWATCHES.map((h) => (
                  <button
                    key={h}
                    type="button"
                    className="fk-swatch"
                    title={h}
                    style={{ background: h, borderColor: accent.toLowerCase() === h.toLowerCase() ? 'var(--heading)' : 'transparent' }}
                    onClick={() => setAccent(h)}
                  />
                ))}
              </div>
            </div>
            <div className="fk-custom-col">
              <div className="fk-field-label">Secondary</div>
              <div className="fk-swatch-row">
                <label className="fk-color-input" style={{ background: accent2 }}>
                  <input type="color" value={accent2} onChange={(e) => setAccent2(e.target.value)} />
                </label>
                <span className="fk-hex">{accent2.toUpperCase()}</span>
                <span className="fk-spacer" />
                {ACCENT2_SWATCHES.map((h) => (
                  <button
                    key={h}
                    type="button"
                    className="fk-swatch"
                    title={h}
                    style={{ background: h, borderColor: accent2.toLowerCase() === h.toLowerCase() ? 'var(--heading)' : 'transparent' }}
                    onClick={() => setAccent2(h)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
