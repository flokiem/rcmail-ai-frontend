import React from 'react';
import ThemePicker from './ThemePicker.jsx';
import ComingSoon, { ComingSoonBadge } from '../common/ComingSoon.jsx';
import { llmLabel, llmGlyph, LLM_META } from '../../lib/llmMeta.js';

// Dummy behavior toggles — no backend acts on these yet (flagged Coming soon).
const BEHAVIORS = [
  { title: 'Require approval before sending', desc: 'Floki always waits for your okay on outbound mail', on: true },
  { title: 'Morning digest',                  desc: 'One overnight summary, delivered at 8:00am',        on: true },
  { title: 'Quiet hours',                     desc: 'Pause automated sends outside 9–6',                 on: false },
  { title: 'Keep drafts for 30 days',         desc: 'Auto-clear reviewed drafts after a month',          on: true },
];

function Toggle({ on }) {
  return <span className={`fk-toggle ${on ? 'on' : ''}`}><span className="fk-toggle-knob" /></span>;
}

export default function SettingsView({
  themeProps,            // { theme, accent, accent2, setTheme, setAccent, setAccent2 }
  llmProviders = [],
  brand = {},
  setBrand,              // (key, value) => void
  onManageModels,
  onManageAccounts,
}) {
  return (
    <main className="fk-view fk-settings">
      <section className="fk-settings-main">
        <header className="fk-view-head">
          <div className="fk-view-title-row">
            <h1>Settings</h1>
            <span className="fk-chip fk-chip-accent2">workspace</span>
          </div>
          <div className="fk-view-sub">Brand, models, and the look of your cockpit — all in one place</div>
        </header>

        <div className="fk-settings-scroll">
          {/* Workspace & brand — saved locally (no backend yet) */}
          <div className="fk-rule"><span>WORKSPACE &amp; BRAND</span><em><button className="fk-link-btn" onClick={onManageAccounts}>Manage mail accounts →</button></em></div>
          <div className="fk-card fk-brand-card">
            <div className="fk-brand-logo">
              <div className="fk-field-label">BRAND MARK</div>
              <div className="fk-brand-logo-box"><img src="/flokilogo.PNG" alt="" /></div>
            </div>
            <div className="fk-brand-fields">
              <div>
                <div className="fk-field-label">Workspace name</div>
                <input className="fk-input" value={brand.workspaceName ?? ''} onChange={(e) => setBrand?.('workspaceName', e.target.value)} />
              </div>
              <div className="fk-row-2">
                <div>
                  <div className="fk-field-label">Agent display name</div>
                  <input className="fk-input" value={brand.agentName ?? ''} onChange={(e) => setBrand?.('agentName', e.target.value)} />
                </div>
                <div>
                  <div className="fk-field-label">Reply-to domain</div>
                  <input className="fk-input fk-input-mono" value={brand.replyToDomain ?? ''} onChange={(e) => setBrand?.('replyToDomain', e.target.value)} />
                </div>
              </div>
              <div>
                <div className="fk-field-label">Default signature <span className="fk-ms-hint">added to messages you compose</span></div>
                <textarea className="fk-input fk-textarea" value={brand.signature ?? ''} onChange={(e) => setBrand?.('signature', e.target.value)} />
              </div>
            </div>
          </div>
          <div className="fk-brand-note">Saved on this device for now — syncing to your account comes with the mobile app.</div>

          {/* Color scheme — fully functional */}
          <div className="fk-rule"><span>COLOR SCHEME</span><em>popular in email · applies instantly</em></div>
          <ThemePicker {...themeProps} />

          {/* Behavior — dummy data, flagged */}
          <div className="fk-rule"><span>BEHAVIOR</span></div>
          <ComingSoon note="These will take effect once the automation engine is connected.">
            <div className="fk-card">
              {BEHAVIORS.map((b, i) => (
                <div key={i} className={`fk-behavior-row ${i < BEHAVIORS.length - 1 ? 'bordered' : ''}`}>
                  <div className="fk-behavior-text">
                    <div className="fk-behavior-title">{b.title}</div>
                    <div className="fk-behavior-desc">{b.desc}</div>
                  </div>
                  <Toggle on={b.on} />
                </div>
              ))}
            </div>
          </ComingSoon>
        </div>
      </section>

      {/* Right: models panel */}
      <section className="fk-settings-aside">
        <header className="fk-aside-head">
          <span className="fk-aside-title">Models</span>
          <span className="fk-mono fk-faint">{llmProviders.length} connected</span>
        </header>
        <div className="fk-aside-scroll">
          <div className="fk-card">
            {llmProviders.length === 0 && (
              <div className="fk-aside-empty">No AI providers yet — add one in Mail Settings.</div>
            )}
            {llmProviders.map((m, i) => (
              <div key={m.id} className={`fk-model-row ${i < llmProviders.length - 1 ? 'bordered' : ''}`}>
                <span className="fk-model-badge" style={{ background: LLM_META[m.provider]?.color || '#6B7280' }}>{llmGlyph(m.provider)}</span>
                <div className="fk-model-info">
                  <div className="fk-model-name">{m.label}</div>
                  <div className="fk-model-meta">{llmLabel(m.provider)}{m.model ? ` · ${m.model}` : ''}</div>
                </div>
              </div>
            ))}
            <div className="fk-model-add">
              <button className="fk-model-addbtn" onClick={onManageModels}>+ Add a model</button>
              <ComingSoonBadge label="enable / default · soon" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
