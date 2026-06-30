import { PROVIDER_MODELS } from './ModelPicker.jsx';

// Shared provider display metadata + the choices offered when adding one.
export const LLM_META = {
  claude:     { label: 'Anthropic',  glyph: '✳', color: '#C8643C' },
  openai:     { label: 'OpenAI',     glyph: '◍', color: '#10A37F' },
  groq:       { label: 'Groq',       glyph: '⚡', color: '#6B7280' },
  perplexity: { label: 'Perplexity', glyph: 'P', color: '#20B8CD' },
  gemini:     { label: 'Google',     glyph: '◆', color: '#4285F4' },
};

export const llmLabel = (provider) => LLM_META[provider]?.label ?? provider;
export const llmGlyph = (provider) => LLM_META[provider]?.glyph ?? '◆';

// Backend default model per provider (used when no override / saved model).
export const DEFAULT_MODELS = {
  claude: 'claude-sonnet-4-6', openai: 'gpt-4o', groq: 'llama-3.3-70b-versatile',
  perplexity: 'sonar-pro', gemini: 'gemini-2.0-flash',
};

// Friendly display name for the model actually in effect.
export function modelDisplayName(provider, model) {
  const id = (model && String(model).trim()) || DEFAULT_MODELS[provider] || '';
  const known = (PROVIDER_MODELS[provider] || []).find((m) => m.id === id);
  return known ? known.name : (id || llmLabel(provider));
}

export const PROVIDER_CHOICES = [
  { id: 'claude',     name: 'Claude',     desc: 'Anthropic' },
  { id: 'openai',     name: 'GPT-4o',     desc: 'OpenAI' },
  { id: 'groq',       name: 'Groq',       desc: 'Ultra-fast LLaMA' },
  { id: 'perplexity', name: 'Perplexity', desc: 'Search-augmented' },
  { id: 'gemini',     name: 'Gemini',     desc: 'Google' },
];

export const MODEL_PLACEHOLDER = {
  claude: 'e.g. claude-sonnet-4-6',
  openai: 'e.g. gpt-4o',
  groq: 'e.g. llama-3.3-70b-versatile',
  perplexity: 'e.g. sonar-pro',
  gemini: 'e.g. gemini-2.0-flash',
};
