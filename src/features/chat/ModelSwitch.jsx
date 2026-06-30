import React, { useState } from 'react';
import { PROVIDER_MODELS } from '../../lib/ModelPicker.jsx';
import { llmGlyph, llmLabel, modelDisplayName, LLM_META } from '../../lib/llmMeta.js';

// The ✦ model chip in the chat composer — click to switch AI provider and model
// for the current chat. Opens upward (it sits at the bottom of the panel).
export default function ModelSwitch({ llmProviders = [], activeLlmId, activeModel, onPickProvider, onPickModel }) {
  const [open, setOpen] = useState(false);
  if (!llmProviders.length) return null;

  const active = llmProviders.find((l) => l.id === activeLlmId) || llmProviders[0];
  const provider = active?.provider;
  const label = provider ? modelDisplayName(provider, activeModel || active?.model) : 'No model';
  const models = PROVIDER_MODELS[provider] || [];
  const effModel = activeModel || ''; // '' = provider default

  return (
    <div className="fk-modelsw">
      <button className="fk-chat-model fk-modelsw-btn" title="Change AI provider / model" onClick={() => setOpen((o) => !o)}>
        ✦ {label} <span className="fk-modelsw-caret">⌄</span>
      </button>
      {open && (
        <>
          <div className="fk-modelsw-overlay" onClick={() => setOpen(false)} />
          <div className="fk-modelsw-menu">
            <div className="fk-modelsw-label">PROVIDER</div>
            {llmProviders.map((l) => (
              <button key={l.id} className={`fk-modelsw-row ${l.id === activeLlmId ? 'active' : ''}`} onClick={() => { onPickProvider(l.id); setOpen(false); }}>
                <span className="fk-modelsw-glyph" style={{ background: LLM_META[l.provider]?.color || '#6B7280' }}>{llmGlyph(l.provider)}</span>
                <span className="fk-modelsw-text"><span className="fk-modelsw-name">{l.label}</span><span className="fk-modelsw-sub">{llmLabel(l.provider)}</span></span>
                {l.id === activeLlmId && <span className="fk-modelsw-check">✓</span>}
              </button>
            ))}

            {models.length > 0 && (
              <>
                <div className="fk-modelsw-label">MODEL</div>
                <button className={`fk-modelsw-row ${!effModel ? 'active' : ''}`} onClick={() => { onPickModel(''); setOpen(false); }}>
                  <span className="fk-modelsw-text"><span className="fk-modelsw-name">Default</span><span className="fk-modelsw-sub">{modelDisplayName(provider, '')}</span></span>
                  {!effModel && <span className="fk-modelsw-check">✓</span>}
                </button>
                {models.map((m) => (
                  <button key={m.id} className={`fk-modelsw-row ${effModel === m.id ? 'active' : ''}`} onClick={() => { onPickModel(m.id); setOpen(false); }}>
                    <span className="fk-modelsw-text"><span className="fk-modelsw-name">{m.name}</span><span className="fk-modelsw-sub">{m.desc}</span></span>
                    {effModel === m.id && <span className="fk-modelsw-check">✓</span>}
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
