import React from 'react';

export const PROVIDER_MODELS = {
  claude: [
    { id: 'claude-sonnet-4-6',        name: 'Claude Sonnet 4.6',  desc: 'Latest · Recommended' },
    { id: 'claude-opus-4-8',           name: 'Claude Opus 4.8',    desc: 'Most capable' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5',   desc: 'Fastest · Affordable' },
  ],
  openai: [
    { id: 'gpt-4o',      name: 'GPT-4o',      desc: 'Latest · Recommended' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', desc: 'Fast · Affordable' },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', desc: 'Recommended' },
    { id: 'llama-3.1-8b-instant',    name: 'Llama 3.1 8B',  desc: 'Ultra-fast' },
    { id: 'mixtral-8x7b-32768',      name: 'Mixtral 8x7B',  desc: 'Efficient' },
    { id: 'gemma2-9b-it',            name: 'Gemma 2 9B',    desc: 'Compact' },
  ],
  perplexity: [
    { id: 'sonar-pro',           name: 'Sonar Pro',           desc: 'Most capable · Recommended' },
    { id: 'sonar',               name: 'Sonar',               desc: 'Fast · Affordable' },
    { id: 'sonar-reasoning-pro', name: 'Sonar Reasoning Pro', desc: 'Deep reasoning' },
    { id: 'sonar-reasoning',     name: 'Sonar Reasoning',     desc: 'Reasoning · Fast' },
  ],
  gemini: [
    { id: 'gemini-2.0-flash',      name: 'Gemini 2.0 Flash',      desc: 'Latest · Recommended' },
    { id: 'gemini-2.5-flash',      name: 'Gemini 2.5 Flash',      desc: 'Fast · Capable' },
    { id: 'gemini-2.5-pro',        name: 'Gemini 2.5 Pro',        desc: 'Most capable' },
    { id: 'gemini-1.5-flash',      name: 'Gemini 1.5 Flash',      desc: 'Fast · Affordable' },
  ],
};

export default function ModelPicker({ provider, value, onChange }) {
  const models = PROVIDER_MODELS[provider] ?? [];
  if (models.length === 0) return null;

  return (
    <div className="model-picker">
      {models.map(m => (
        <button
          key={m.id}
          type="button"
          className={`model-pill ${value === m.id ? 'selected' : ''}`}
          onClick={() => onChange(value === m.id ? '' : m.id)}
          title={m.id}
        >
          <span className="model-pill-name">{m.name}</span>
          <span className="model-pill-desc">{m.desc}</span>
        </button>
      ))}
    </div>
  );
}
