import React from 'react';
import ComingSoon, { ComingSoonBadge } from '../common/ComingSoon.jsx';

// Automations has no backend yet. Per product direction we show the full UI
// with the design's dummy data, clearly flagged "Coming soon". The drag-drop
// builder/canvas is intentionally represented by a summary card for now.
const STATS = [
  { label: 'Active workflows', value: 8, tone: 'ink' },
  { label: 'Emails handled / wk', value: 214, tone: 'accent2' },
  { label: 'Pending review', value: 3, tone: 'dark' },
];

const PENDING = [
  { icon: '▤', name: 'Receipts → Expense sheet',  note: 'You log receipts to Expenses every week',    acts: '2 actions' },
  { icon: '≋', name: 'Standups → Reading digest',  note: 'You skim & file standup notes each morning', acts: '1 action' },
  { icon: '◉', name: 'GitHub pings → Daily bundle', note: 'You batch-clear GitHub mail at day end',     acts: '2 actions' },
];

const WORKFLOWS = [
  { icon: '▤', name: 'Invoice triage',       trig: 'Invoice arrives', acts: '4 actions', on: true },
  { icon: '◎', name: 'Lead qualification',   trig: 'New inbound',     acts: '2 actions', on: true },
  { icon: '◷', name: 'Meeting scheduler',    trig: '"Can we meet?"',  acts: '2 actions', on: true },
  { icon: '≋', name: 'Newsletter filing',    trig: 'Digests',         acts: '2 actions', on: true },
  { icon: '⛨', name: 'Support triage',       trig: 'Tickets',         acts: '2 actions', on: false },
  { icon: '↻', name: 'Follow-up nudger',     trig: 'No reply in 5d',  acts: '1 action',  on: true },
];

const TABS = ['Dashboard', 'Builder', 'Suggestions'];

export default function AutomationsView() {
  return (
    <main className="fk-view fk-automations">
      <div className="fk-auto-head">
        <div className="fk-view-title-row">
          <h1>Automations</h1>
          <span className="fk-chip">do this every time</span>
          <ComingSoonBadge />
          <span className="fk-spacer" />
          <span className="fk-mono fk-faint">8 active · 2 paused</span>
        </div>
        <div className="fk-auto-tabs">
          {TABS.map((t, i) => (
            <button key={t} className={`fk-auto-tab ${i === 0 ? 'active' : ''}`} disabled>
              {t}{t === 'Suggestions' && <span className="fk-sugg-badge">3</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="fk-auto-scroll">
        <ComingSoon
          label="Coming soon"
          note="The workflow builder, suggestions and live activity arrive once the automation engine is connected. Numbers below are illustrative."
        >
          {/* Stats */}
          <div className="fk-stat-row">
            {STATS.map((s) => (
              <div key={s.label} className={`fk-stat fk-stat-${s.tone}`}>
                <div className="fk-stat-label">{s.label}</div>
                <div className="fk-stat-value">{s.value}</div>
              </div>
            ))}
          </div>

          {/* Pending approval */}
          <div className="fk-rule fk-rule-accent2"><span>PENDING APPROVAL · 3</span><em>auto-built from your patterns</em></div>
          <div className="fk-auto-list">
            {PENDING.map((p) => (
              <div key={p.name} className="fk-pend-row">
                <div className="fk-pend-ico">{p.icon}</div>
                <div className="fk-pend-main">
                  <div className="fk-pend-name">{p.name}<span className="fk-pend-tag">Pending approval</span></div>
                  <div className="fk-pend-note">↻ {p.note} · → {p.acts}</div>
                </div>
                <button className="fk-btn fk-btn-accent" disabled>✓ Approve</button>
                <button className="fk-icon-btn" disabled>✕</button>
              </div>
            ))}
          </div>

          {/* Your workflows */}
          <div className="fk-rule"><span style={{ fontSize: 15, fontWeight: 700, color: 'var(--heading)', letterSpacing: 0 }}>Your workflows</span></div>
          <div className="fk-card">
            {WORKFLOWS.map((w, i) => (
              <div key={w.name} className={`fk-wf-row ${i < WORKFLOWS.length - 1 ? 'bordered' : ''} ${w.on ? '' : 'off'}`}>
                <div className="fk-wf-ico">{w.icon}</div>
                <div className="fk-wf-main">
                  <div className="fk-wf-name">{w.name}</div>
                  <div className="fk-wf-meta">⚡ {w.trig} · → {w.acts}</div>
                </div>
                <span className={`fk-wf-status ${w.on ? 'on' : ''}`}>{w.on ? 'on' : 'off'}</span>
                <span className={`fk-toggle ${w.on ? 'on' : ''}`}><span className="fk-toggle-knob" /></span>
              </div>
            ))}
          </div>
        </ComingSoon>
      </div>
    </main>
  );
}
