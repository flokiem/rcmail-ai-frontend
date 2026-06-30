import React, { useState } from 'react';
import { api } from '../../lib/api.js';
import { acctColor } from '../../lib/accountColors.js';
import { LLM_META, PROVIDER_CHOICES, MODEL_PLACEHOLDER, llmLabel } from '../../lib/llmMeta.js';
import ModelPicker from '../../lib/ModelPicker.jsx';

const EMPTY_ACCT = { label: '', imapHost: '', imapPort: '993', imapUser: '', smtpHost: '', smtpPort: '587', password: '' };
const EMPTY_LLM  = { label: '', provider: 'claude', apiKey: '', model: '' };

// Settings modal: Mail Accounts (add / edit / delete, wired to /api/accounts)
// and AI Providers (add / delete, wired to /api/llm-providers). After any
// mutation the parent reloads the lists. The design's Providers tab is
// read-only; we make it functional so providers can actually be managed.
export default function MailSettingsModal({ open, tab = 'accounts', onTab, onClose, accounts = [], llmProviders = [], reloadAccounts, reloadProviders }) {
  // account editor: null | { id|'new', ...fields }
  const [acctForm, setAcctForm] = useState(null);
  const [acctErr, setAcctErr]   = useState('');
  const [savingAcct, setSavingAcct] = useState(false);
  // provider editor
  const [llmForm, setLlmForm] = useState(null); // null | EMPTY_LLM
  const [llmErr, setLlmErr]   = useState('');
  const [savingLlm, setSavingLlm] = useState(false);

  if (!open) return null;

  const closeAll = () => { setAcctForm(null); setAcctErr(''); setLlmForm(null); setLlmErr(''); };
  const switchTab = (t) => { closeAll(); onTab?.(t); };

  // ---- accounts ----
  function startAddAcct() { setAcctErr(''); setAcctForm({ id: 'new', ...EMPTY_ACCT }); }
  function startEditAcct(a) {
    setAcctErr('');
    setAcctForm({
      id: a.id, label: a.label || '', imapHost: a.imap_host || '', imapPort: String(a.imap_port || 993),
      imapUser: a.imap_user || '', smtpHost: a.smtp_host || '', smtpPort: String(a.smtp_port || 587), password: '',
    });
  }
  const setAF = (k, v) => setAcctForm((f) => ({ ...f, [k]: v }));

  async function saveAcct() {
    const f = acctForm;
    if (!f.imapHost || !f.imapUser) { setAcctErr('Mail server and email are required.'); return; }
    if (f.id === 'new' && !f.password) { setAcctErr('Password is required for a new account.'); return; }
    setSavingAcct(true); setAcctErr('');
    try {
      const base = {
        label: f.label || 'My Email', imapHost: f.imapHost, imapPort: Number(f.imapPort),
        imapUser: f.imapUser, smtpHost: f.smtpHost || f.imapHost, smtpPort: Number(f.smtpPort),
      };
      let r;
      if (f.id === 'new') r = await api.post('/api/accounts', { ...base, imapPass: f.password });
      else r = await api.put(`/api/accounts/${f.id}`, { ...base, ...(f.password ? { imapPass: f.password } : {}) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setAcctErr(d.error ?? 'Failed to save account.'); return; }
      await reloadAccounts?.();
      setAcctForm(null);
    } catch { setAcctErr('Network error.'); }
    finally { setSavingAcct(false); }
  }

  async function deleteAcct(a) {
    if (!window.confirm(`Delete account "${a.label}"? This removes its chats' link and cached mail.`)) return;
    await api.del(`/api/accounts/${a.id}`);
    await reloadAccounts?.();
  }

  // ---- providers ----
  function startAddLlm() { setLlmErr(''); setLlmForm({ ...EMPTY_LLM }); }
  const setLF = (k, v) => setLlmForm((f) => ({ ...f, [k]: v }));

  async function saveLlm() {
    const f = llmForm;
    if (!f.apiKey) { setLlmErr('API key is required.'); return; }
    setSavingLlm(true); setLlmErr('');
    try {
      const r = await api.post('/api/llm-providers', { label: f.label || 'My AI', provider: f.provider, apiKey: f.apiKey, model: f.model });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setLlmErr(d.error ?? 'Failed to save provider.'); return; }
      await reloadProviders?.();
      setLlmForm(null);
    } catch { setLlmErr('Network error.'); }
    finally { setSavingLlm(false); }
  }

  async function deleteLlm(l) {
    if (!window.confirm(`Delete AI provider "${l.label}"?`)) return;
    await api.del(`/api/llm-providers/${l.id}`);
    await reloadProviders?.();
  }

  return (
    <div className="fk-modal-overlay" onClick={(e) => { if (e.target.classList.contains('fk-modal-overlay')) onClose(); }}>
      <div className="fk-modal">
        <div className="fk-modal-head">
          <span className="fk-modal-title">Settings</span>
          <button className="fk-modal-close" onClick={onClose} title="Close">✕</button>
        </div>
        <div className="fk-modal-tabs">
          <button className={`fk-modal-tab ${tab === 'accounts' ? 'active' : ''}`} onClick={() => switchTab('accounts')}>Mail Accounts</button>
          <button className={`fk-modal-tab ${tab === 'ai' ? 'active' : ''}`} onClick={() => switchTab('ai')}>AI Providers</button>
        </div>

        <div className="fk-modal-body">
          {tab === 'accounts' ? (
            <div className="fk-ms-list">
              {accounts.map((a, i) => (
                <div key={a.id} className="fk-ms-row">
                  <span className="fk-ms-dot" style={{ background: acctColor(i) }} />
                  <div className="fk-ms-info">
                    <div className="fk-ms-name">{a.label}</div>
                    <div className="fk-ms-meta">{a.imap_user}</div>
                  </div>
                  <button className="fk-ms-btn" onClick={() => startEditAcct(a)}>Edit</button>
                  <button className="fk-ms-btn danger" onClick={() => deleteAcct(a)}>Delete</button>
                </div>
              ))}

              {acctForm && (
                <div className="fk-ms-form">
                  <div className="fk-ms-form-title">{acctForm.id === 'new' ? 'Add account' : 'Edit account'}</div>
                  <Field label="Account Name"><input className="fk-input" value={acctForm.label} onChange={(e) => setAF('label', e.target.value)} placeholder="e.g. Business" /></Field>
                  <div className="fk-ms-sec">IMAP — INCOMING MAIL</div>
                  <div className="fk-ms-row2">
                    <Field label="Mail Server"><input className="fk-input" value={acctForm.imapHost} onChange={(e) => setAF('imapHost', e.target.value)} placeholder="mail.example.com" /></Field>
                    <Field label="Port" narrow><input className="fk-input" type="number" value={acctForm.imapPort} onChange={(e) => setAF('imapPort', e.target.value)} /></Field>
                  </div>
                  <Field label="Email"><input className="fk-input" value={acctForm.imapUser} onChange={(e) => setAF('imapUser', e.target.value)} placeholder="you@example.com" /></Field>
                  <Field label={<>Password <span className="fk-ms-hint">leave blank to keep current</span></>}><input className="fk-input" type="password" value={acctForm.password} onChange={(e) => setAF('password', e.target.value)} placeholder="••••••••" /></Field>
                  <div className="fk-ms-sec">SMTP — OUTGOING MAIL</div>
                  <div className="fk-ms-row2">
                    <Field label="SMTP Host"><input className="fk-input" value={acctForm.smtpHost} onChange={(e) => setAF('smtpHost', e.target.value)} placeholder="often same as IMAP" /></Field>
                    <Field label="Port" narrow><input className="fk-input" type="number" value={acctForm.smtpPort} onChange={(e) => setAF('smtpPort', e.target.value)} /></Field>
                  </div>
                  {acctErr && <div className="fk-cmp-error">{acctErr}</div>}
                  <div className="fk-ms-actions">
                    <button className="fk-auth-btn fk-auth-btn-secondary" onClick={() => setAcctForm(null)}>Cancel</button>
                    <button className="fk-auth-btn fk-auth-btn-primary" onClick={saveAcct} disabled={savingAcct}>{savingAcct ? 'Saving…' : 'Save Changes'}</button>
                  </div>
                </div>
              )}

              {!acctForm && (
                <button className="fk-ms-add" onClick={startAddAcct}>+ Add account</button>
              )}
            </div>
          ) : (
            <div className="fk-ms-list">
              {llmProviders.map((l) => (
                <div key={l.id} className="fk-ms-row">
                  <span className="fk-ms-glyph" style={{ background: (LLM_META[l.provider]?.color || '#6B7280') }}>{LLM_META[l.provider]?.glyph || '◆'}</span>
                  <div className="fk-ms-info">
                    <div className="fk-ms-name">{l.label}</div>
                    <div className="fk-ms-meta">{llmLabel(l.provider)}{l.model ? ` · ${l.model}` : ''}</div>
                  </div>
                  <button className="fk-ms-btn danger" onClick={() => deleteLlm(l)}>Delete</button>
                </div>
              ))}

              {llmForm && (
                <div className="fk-ms-form">
                  <div className="fk-ms-form-title">Add AI provider</div>
                  <div className="fk-ms-providers">
                    {PROVIDER_CHOICES.map((p) => (
                      <button key={p.id} className={`fk-provider-card ${llmForm.provider === p.id ? 'selected' : ''}`} onClick={() => setLF('provider', p.id)}>
                        <div className="name">{p.name}</div>
                        <div className="desc">{p.desc}</div>
                      </button>
                    ))}
                  </div>
                  <Field label="Provider Name"><input className="fk-input" value={llmForm.label} onChange={(e) => setLF('label', e.target.value)} placeholder="My AI" /></Field>
                  <Field label="API Key"><input className="fk-input" type="password" value={llmForm.apiKey} onChange={(e) => setLF('apiKey', e.target.value)} placeholder="sk-… or sk-ant-…" /></Field>
                  <Field label={<>Model <span className="fk-ms-hint">optional</span></>}>
                    <ModelPicker provider={llmForm.provider} value={llmForm.model} onChange={(v) => setLF('model', v)} />
                    <input className="fk-input" style={{ marginTop: 8 }} value={llmForm.model} onChange={(e) => setLF('model', e.target.value)} placeholder={MODEL_PLACEHOLDER[llmForm.provider]} />
                  </Field>
                  {llmErr && <div className="fk-cmp-error">{llmErr}</div>}
                  <div className="fk-ms-actions">
                    <button className="fk-auth-btn fk-auth-btn-secondary" onClick={() => setLlmForm(null)}>Cancel</button>
                    <button className="fk-auth-btn fk-auth-btn-primary" onClick={saveLlm} disabled={savingLlm}>{savingLlm ? 'Saving…' : 'Save Provider'}</button>
                  </div>
                </div>
              )}

              {!llmForm && (
                <button className="fk-ms-add" onClick={startAddLlm}>+ Add provider</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, narrow, children }) {
  return (
    <div className={`fk-ms-field ${narrow ? 'narrow' : ''}`}>
      <div className="fk-field-label">{label}</div>
      {children}
    </div>
  );
}
