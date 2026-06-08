import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getToken } from '../lib/api.js';

const KNOWN_HOSTS = {
  'gmail.com':   { imap: 'imap.gmail.com',        smtp: 'smtp.gmail.com',      ip: 993, sp: 465 },
  'outlook.com': { imap: 'outlook.office365.com',  smtp: 'smtp.office365.com',  ip: 993, sp: 587 },
  'hotmail.com': { imap: 'outlook.office365.com',  smtp: 'smtp.office365.com',  ip: 993, sp: 587 },
  'yahoo.com':   { imap: 'imap.mail.yahoo.com',    smtp: 'smtp.mail.yahoo.com', ip: 993, sp: 465 },
};

export default function Setup() {
  const navigate = useNavigate();
  const [step, setStep]         = useState(1);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showOptional, setShowOptional] = useState(false);

  const [mail, setMail] = useState({ label: '', imapHost: '', imapPort: '993', imapUser: '', imapPass: '', smtpHost: '', smtpPort: '587', rcUrl: '', rcKey: '' });
  const [llm,  setLlm]  = useState({ label: '', provider: 'claude', apiKey: '', model: '' });

  useEffect(() => {
    if (!getToken()) { navigate('/', { replace: true }); return; }
    api.get('/api/setup/status').then(r => r.json()).then(d => {
      if (d.hasMail && d.hasLlm) navigate('/chat', { replace: true });
      else if (d.hasMail) setStep(2);
    });
  }, []);

  function setM(k, v) { setMail(m => ({ ...m, [k]: v })); }
  function setL(k, v) { setLlm(l => ({ ...l, [k]: v })); }

  function handleUserBlur() {
    const domain = mail.imapUser.split('@')[1]?.toLowerCase();
    const h = KNOWN_HOSTS[domain];
    if (!h) return;
    setMail(m => ({
      ...m,
      imapHost: m.imapHost || h.imap,
      imapPort: m.imapHost ? m.imapPort : String(h.ip),
      smtpHost: m.smtpHost || h.smtp,
      smtpPort: m.smtpHost ? m.smtpPort : String(h.sp),
    }));
  }

  function handleImapHostBlur() {
    setMail(m => ({ ...m, smtpHost: m.smtpHost || m.imapHost }));
  }

  async function testConnection() {
    setTestResult(null);
    const { imapHost, imapPort, imapUser, imapPass } = mail;
    if (!imapHost || !imapUser || !imapPass) { setError('Fill in mail server, email, and password before testing.'); return; }
    setError(''); setLoading(true);
    try {
      const r = await api.post('/api/test/imap', { imapHost, imapPort: Number(imapPort), imapUser, imapPass });
      const d = await r.json();
      setTestResult(d.ok ? 'ok' : d.error);
    } catch { setTestResult('Network error during test.'); }
    finally { setLoading(false); }
  }

  async function saveMail() {
    const { imapHost, imapUser, imapPass } = mail;
    if (!imapHost || !imapUser || !imapPass) { setError('Mail server, email, and password are required.'); return; }
    setError(''); setLoading(true);
    try {
      const body = { ...mail, imapPort: Number(mail.imapPort), smtpPort: Number(mail.smtpPort), smtpHost: mail.smtpHost || mail.imapHost, label: mail.label || 'My Email' };
      const r = await api.post('/api/setup/mail', body);
      const d = await r.json();
      if (!r.ok) return setError(d.error ?? 'Failed to save mail settings.');
      setStep(2);
    } catch { setError('Network error.'); }
    finally { setLoading(false); }
  }

  async function saveLlm() {
    if (!llm.apiKey) { setError('API key is required.'); return; }
    setError(''); setLoading(true);
    try {
      const body = { label: llm.label || 'My AI', provider: llm.provider, apiKey: llm.apiKey, model: llm.model };
      const r = await api.post('/api/setup/llm', body);
      const d = await r.json();
      if (!r.ok) return setError(d.error ?? 'Failed to save LLM settings.');
      navigate('/chat', { replace: true });
    } catch { setError('Network error.'); }
    finally { setLoading(false); }
  }

  const modelPlaceholders = { claude: 'e.g. claude-sonnet-4-6', openai: 'e.g. gpt-4o', groq: 'e.g. llama-3.3-70b-versatile', perplexity: 'e.g. sonar-pro' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 16px 60px' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div className="page-logo" style={{ justifyContent: 'center' }}>
          <img src="/flokilogo.PNG" alt="Floki" className="logo-img" />
          <span className="logo-text">Floki Mail</span>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 6 }}>Let's connect your mailbox and AI provider</p>
      </div>

      <div className="card" style={{ width: '100%', maxWidth: 480 }}>
        <div className="card-body">
          <div className="steps">
            <div className={`step ${step === 1 ? 'active' : 'done'}`}>
              <div className="step-num">1</div>
              <div className="step-label">Mail Server</div>
            </div>
            <div className={`step ${step === 2 ? 'active' : ''}`}>
              <div className="step-num">2</div>
              <div className="step-label">AI Provider</div>
            </div>
          </div>

          {error && <div className="alert alert-error show">{error}</div>}

          {step === 1 && (
            <>
              <div className="field">
                <label>Account Name <span className="hint">e.g. Business, Personal</span></label>
                <input type="text" placeholder="My Email" value={mail.label} onChange={e => setM('label', e.target.value)} />
              </div>

              <div className="section-title">IMAP — Incoming mail</div>
              <div className="row-2">
                <div className="field">
                  <label>Mail Server</label>
                  <input type="text" placeholder="mail.example.com" value={mail.imapHost} onChange={e => setM('imapHost', e.target.value)} onBlur={handleImapHostBlur} />
                </div>
                <div className="field">
                  <label>Port</label>
                  <input type="number" value={mail.imapPort} onChange={e => setM('imapPort', e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>Email / Username</label>
                <input type="email" placeholder="you@example.com" value={mail.imapUser} onChange={e => setM('imapUser', e.target.value)} onBlur={handleUserBlur} />
              </div>
              <div className="field">
                <label>Password</label>
                <input type="password" placeholder="Your email password" value={mail.imapPass} onChange={e => setM('imapPass', e.target.value)} />
              </div>

              <div className="divider" />
              <div className="section-title">SMTP — Outgoing mail</div>
              <div className="row-2">
                <div className="field">
                  <label>SMTP Host <span className="hint">often same as IMAP</span></label>
                  <input type="text" placeholder="mail.example.com" value={mail.smtpHost} onChange={e => setM('smtpHost', e.target.value)} />
                </div>
                <div className="field">
                  <label>Port</label>
                  <input type="number" value={mail.smtpPort} onChange={e => setM('smtpPort', e.target.value)} />
                </div>
              </div>

              <div className="divider" />
              <div className="optional-toggle" onClick={() => setShowOptional(o => !o)}>
                <span style={{ fontSize: 10, transition: 'transform 0.2s', transform: showOptional ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>▶</span>
                Roundcube contacts &amp; identities (optional)
              </div>
              {showOptional && (
                <>
                  <div className="field">
                    <label>Roundcube URL</label>
                    <input type="url" placeholder="https://your-roundcube.com" value={mail.rcUrl} onChange={e => setM('rcUrl', e.target.value)} />
                  </div>
                  <div className="field">
                    <label>API Key</label>
                    <input type="text" placeholder="rcmcp_…" value={mail.rcKey} onChange={e => setM('rcKey', e.target.value)} />
                  </div>
                </>
              )}

              {testResult && (
                <div className={`alert ${testResult === 'ok' ? 'alert-success' : 'alert-error'} show`} style={{ marginBottom: 0, marginTop: 4 }}>
                  {testResult === 'ok' ? '✓ Connection successful — your credentials work.' : `✗ Connection failed: ${testResult}`}
                </div>
              )}

              <div className="step-actions">
                <button className="btn btn-secondary" style={{ flex: '0 0 auto' }} onClick={testConnection} disabled={loading}>
                  {loading ? <><span className="spinner spinner-dark" /> Testing…</> : 'Test Connection'}
                </button>
                <button className="btn btn-primary" onClick={saveMail} disabled={loading}>
                  {loading ? <><span className="spinner" /> Saving…</> : 'Save & Continue'}
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
                Choose your AI provider and paste your API key. Your key is encrypted before storage.
              </p>
              <div className="provider-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {[
                  { id:'claude',     name:'Claude',      desc:'Anthropic · Best for long emails' },
                  { id:'openai',     name:'GPT-4o',      desc:'OpenAI · Fast & affordable' },
                  { id:'groq',       name:'Groq ⚡',     desc:'Groq · Ultra-fast LLaMA' },
                  { id:'perplexity', name:'Perplexity',  desc:'Search-augmented AI · All models' },
                ].map(p => (
                  <div key={p.id} className={`provider-card ${llm.provider === p.id ? 'selected' : ''}`} onClick={() => setL('provider', p.id)}>
                    <div className="name">{p.name}</div>
                    <div className="desc">{p.desc}</div>
                  </div>
                ))}
              </div>
              <div className="field">
                <label>Provider Name <span className="hint">e.g. Claude Main, GPT Work</span></label>
                <input type="text" placeholder="My AI" value={llm.label} onChange={e => setL('label', e.target.value)} />
              </div>
              <div className="field">
                <label>API Key</label>
                <input type="password" placeholder="sk-… or sk-ant-…" value={llm.apiKey} onChange={e => setL('apiKey', e.target.value)} />
              </div>
              <div className="field">
                <label>Model <span className="hint">optional — leave blank for default</span></label>
                <input type="text" placeholder={modelPlaceholders[llm.provider]} value={llm.model} onChange={e => setL('model', e.target.value)} />
              </div>
              <div className="step-actions">
                <button className="btn btn-secondary btn-sm" style={{ flex: '0 0 auto' }} onClick={() => { setStep(1); setError(''); }}>← Back</button>
                <button className="btn btn-primary" onClick={saveLlm} disabled={loading}>
                  {loading ? <><span className="spinner" /> Saving…</> : 'Finish Setup'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
