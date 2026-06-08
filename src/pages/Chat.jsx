import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken, getToken, streamChat } from '../lib/api.js';

const ACCOUNT_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];
const LLM_INFO = {
  claude:      { label: 'Claude',      badge: 'C',  cls: 'ai-claude'      },
  openai:      { label: 'GPT-4o',      badge: 'G',  cls: 'ai-openai'      },
  groq:        { label: 'Groq',        badge: '⚡', cls: 'ai-groq'        },
  perplexity:  { label: 'Perplexity',  badge: 'P',  cls: 'ai-perplexity'  },
};
const TOOL_LABELS = {
  list_folders:     '📂 Listing folders',
  get_unread_count: '📊 Checking unread count',
  list_emails:      '📬 Fetching emails',
  read_email:       '📖 Reading email',
  search_emails:    '🔍 Searching emails',
  send_email:       '📤 Sending email',
  move_email:       '📁 Moving email',
  delete_email:     '🗑️ Deleting email',
  mark_email:       '🏷️ Marking email',
  list_contacts:    '👥 Loading contacts',
  search_contacts:  '🔎 Searching contacts',
  get_identities:   '🪪 Loading identities',
};

function acctColor(idx) { return ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length]; }
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function formatContent(text) {
  return escHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

export default function Chat() {
  const navigate = useNavigate();
  const [userEmail, setUserEmail]       = useState('');
  const [accounts, setAccounts]         = useState([]);
  const [llmProviders, setLlmProviders] = useState([]);
  const [threads, setThreads]           = useState([]);
  const [messages, setMessages]         = useState([]);
  const [currentThreadId, setCurrentThreadId] = useState(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedLlmId, setSelectedLlmId]         = useState('');
  const [sending, setSending]           = useState(false);
  const [typingTool, setTypingTool]     = useState('');
  const [isTyping, setIsTyping]         = useState(false);
  const [msgInput, setMsgInput]         = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab]   = useState('accounts');
  const [threadTitle, setThreadTitle]   = useState('Floki Mail');

  const [pendingEmail, setPendingEmail] = useState(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendEmailError, setSendEmailError] = useState('');

  const [showAddAcct, setShowAddAcct] = useState(false);
  const [showAddLlm,  setShowAddLlm]  = useState(false);
  const [newAcct, setNewAcct] = useState({ label:'', imapHost:'', imapPort:'993', imapUser:'', imapPass:'', smtpHost:'', smtpPort:'587' });
  const [newLlm,  setNewLlm]  = useState({ label:'', provider:'claude', apiKey:'', model:'' });
  const [acctErr, setAcctErr] = useState('');
  const [llmErr,  setLlmErr]  = useState('');
  const [savingAcct, setSavingAcct] = useState(false);
  const [savingLlm,  setSavingLlm]  = useState(false);

  const messagesRef = useRef(null);
  const textareaRef = useRef(null);
  const cancelStreamRef = useRef(null);

  useEffect(() => {
    if (!getToken()) { navigate('/', { replace: true }); return; }
    init();
  }, []);

  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages, isTyping]);

  async function init() {
    const meRes = await api.get('/api/auth/me');
    if (!meRes.ok) { navigate('/', { replace: true }); return; }
    const me = await meRes.json();
    if (!me.hasMail || !me.hasLlm) { navigate('/setup', { replace: true }); return; }
    setUserEmail(me.email ?? '');
    const [accts, llms] = await Promise.all([
      api.get('/api/accounts').then(r => r.json()),
      api.get('/api/llm-providers').then(r => r.json()),
    ]);
    setAccounts(accts);
    setLlmProviders(llms);
    if (accts[0]) setSelectedAccountId(String(accts[0].id));
    if (llms[0])  setSelectedLlmId(String(llms[0].id));
    await loadThreads();
  }

  async function loadThreads() {
    const r = await api.get('/api/threads');
    const data = await r.json();
    setThreads(data);
    return data;
  }

  function getAcctColor(accountId) {
    const idx = accounts.findIndex(a => a.id === accountId);
    return idx >= 0 ? acctColor(idx) : '#94a3b8';
  }

  async function newChat() {
    const accountId = Number(selectedAccountId);
    const llmId     = Number(selectedLlmId);
    if (!accountId || !llmId) return;
    const r = await api.post('/api/threads', { accountId, llmId });
    if (!r.ok) return;
    const t = await r.json();
    setCurrentThreadId(t.id);
    setThreadTitle('New Chat');
    setMessages([]);
    await loadThreads();
    textareaRef.current?.focus();
  }

  async function loadThread(id) {
    const r = await api.get(`/api/threads/${id}/messages`);
    const msgs = await r.json();
    setCurrentThreadId(id);
    setMessages(msgs.map(m => ({ role: m.role, content: m.content })));
    const t2 = await api.get('/api/threads').then(r => r.json());
    setThreads(t2);
    const t = t2.find(x => x.id === id);
    if (t) setThreadTitle(t.title);
  }

  async function deleteThread(e, id) {
    e.stopPropagation();
    if (!confirm('Delete this chat?')) return;
    await api.del(`/api/threads/${id}`);
    if (currentThreadId === id) {
      setCurrentThreadId(null);
      setMessages([]);
      setThreadTitle('Floki Mail');
    }
    await loadThreads();
  }

  async function sendMessage() {
    if (sending) return;
    const message = msgInput.trim();
    if (!message) return;

    let threadId = currentThreadId;
    if (!threadId) {
      const accountId = Number(selectedAccountId);
      const llmId     = Number(selectedLlmId);
      if (!accountId || !llmId) return;
      const r = await api.post('/api/threads', { accountId, llmId });
      if (!r.ok) return;
      const t = await r.json();
      threadId = t.id;
      setCurrentThreadId(t.id);
      await loadThreads();
    }

    setSending(true);
    setMsgInput('');
    if (textareaRef.current) textareaRef.current.style.height = '';
    setMessages(m => [...m, { role: 'user', content: message }]);
    setIsTyping(true);
    setTypingTool('');

    cancelStreamRef.current = streamChat(threadId, message, {
      onTool: (name) => setTypingTool(TOOL_LABELS[name] ?? ('⚙️ ' + name.replace(/_/g, ' '))),
      onSendPreview: (email) => setPendingEmail(email),
      onDone: async ({ reply, title }) => {
        setIsTyping(false);
        setMessages(m => [...m, { role: 'assistant', content: reply }]);
        if (title) {
          setThreadTitle(title);
          setThreads(ts => ts.map(t => t.id === threadId ? { ...t, title } : t));
        }
        setSending(false);
        textareaRef.current?.focus();
      },
      onError: (err) => {
        setIsTyping(false);
        setMessages(m => [...m, { role: 'assistant', content: '⚠️ ' + err }]);
        setSending(false);
      },
    });
  }

  function useSuggestion(text) {
    setMsgInput(text);
    setTimeout(() => sendMessageWith(text), 0);
  }

  async function sendMessageWith(message) {
    if (sending) return;
    let threadId = currentThreadId;
    if (!threadId) {
      const accountId = Number(selectedAccountId);
      const llmId     = Number(selectedLlmId);
      if (!accountId || !llmId) return;
      const r = await api.post('/api/threads', { accountId, llmId });
      if (!r.ok) return;
      const t = await r.json();
      threadId = t.id;
      setCurrentThreadId(t.id);
      await loadThreads();
    }
    setSending(true);
    setMsgInput('');
    setMessages(m => [...m, { role: 'user', content: message }]);
    setIsTyping(true);
    setTypingTool('');

    cancelStreamRef.current = streamChat(threadId, message, {
      onTool: (name) => setTypingTool(TOOL_LABELS[name] ?? ('⚙️ ' + name.replace(/_/g, ' '))),
      onSendPreview: (email) => setPendingEmail(email),
      onDone: async ({ reply, title }) => {
        setIsTyping(false);
        setMessages(m => [...m, { role: 'assistant', content: reply }]);
        if (title) {
          setThreadTitle(title);
          setThreads(ts => ts.map(t => t.id === threadId ? { ...t, title } : t));
        }
        setSending(false);
      },
      onError: (err) => {
        setIsTyping(false);
        setMessages(m => [...m, { role: 'assistant', content: '⚠️ ' + err }]);
        setSending(false);
      },
    });
  }

  async function sendEmailDirectly() {
    if (!pendingEmail) return;
    setSendingEmail(true); setSendEmailError('');
    try {
      const { accountId, ...emailFields } = pendingEmail;
      const r = await api.post(`/api/accounts/${accountId}/send`, emailFields);
      const d = await r.json();
      if (!r.ok) { setSendEmailError(d.error ?? 'Failed to send email.'); return; }
      setMessages(m => [...m, { role: 'assistant', content: `✓ Email sent to ${pendingEmail.to}.` }]);
      setPendingEmail(null);
    } catch { setSendEmailError('Network error. Please try again.'); }
    finally { setSendingEmail(false); }
  }

  function logout() { clearToken(); navigate('/', { replace: true }); }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function autoResize(e) {
    e.target.style.height = '';
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
  }

  async function submitAddAccount() {
    const { imapHost, imapUser, imapPass } = newAcct;
    if (!imapHost || !imapUser || !imapPass) { setAcctErr('Mail server, email, and password are required.'); return; }
    setSavingAcct(true); setAcctErr('');
    try {
      const body = { ...newAcct, imapPort: Number(newAcct.imapPort), smtpPort: Number(newAcct.smtpPort), smtpHost: newAcct.smtpHost || newAcct.imapHost, label: newAcct.label || 'My Email' };
      const r = await api.post('/api/accounts', body);
      const d = await r.json();
      if (!r.ok) { setAcctErr(d.error ?? 'Failed.'); return; }
      const accts = await api.get('/api/accounts').then(r => r.json());
      setAccounts(accts);
      setShowAddAcct(false);
      setNewAcct({ label:'', imapHost:'', imapPort:'993', imapUser:'', imapPass:'', smtpHost:'', smtpPort:'587' });
    } catch { setAcctErr('Network error.'); }
    finally { setSavingAcct(false); }
  }

  async function deleteAccount(id, label) {
    if (!confirm(`Delete account "${label}"?`)) return;
    await api.del(`/api/accounts/${id}`);
    const accts = await api.get('/api/accounts').then(r => r.json());
    setAccounts(accts);
  }

  async function submitAddLlm() {
    if (!newLlm.apiKey) { setLlmErr('API key is required.'); return; }
    setSavingLlm(true); setLlmErr('');
    try {
      const body = { label: newLlm.label || 'My AI', provider: newLlm.provider, apiKey: newLlm.apiKey, model: newLlm.model };
      const r = await api.post('/api/llm-providers', body);
      const d = await r.json();
      if (!r.ok) { setLlmErr(d.error ?? 'Failed.'); return; }
      const llms = await api.get('/api/llm-providers').then(r => r.json());
      setLlmProviders(llms);
      setShowAddLlm(false);
      setNewLlm({ label:'', provider:'claude', apiKey:'', model:'' });
    } catch { setLlmErr('Network error.'); }
    finally { setSavingLlm(false); }
  }

  async function deleteLlm(id, label) {
    if (!confirm(`Delete AI provider "${label}"?`)) return;
    await api.del(`/api/llm-providers/${id}`);
    const llms = await api.get('/api/llm-providers').then(r => r.json());
    setLlmProviders(llms);
  }

  const modelPh = { claude:'e.g. claude-sonnet-4-6', openai:'e.g. gpt-4o', groq:'e.g. llama-3.3-70b-versatile', perplexity:'e.g. sonar-pro' };

  const currentThread = threads.find(t => t.id === currentThreadId);
  const currentAcct   = accounts.find(a => a.id === currentThread?.account_id);
  const currentLlm    = llmProviders.find(l => l.id === currentThread?.llm_id);

  return (
    <div className="chat-root">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src="/flokilogo.PNG" alt="Floki" />
            <span>Floki Mail</span>
          </div>
          <div className="select-label">Mail Account</div>
          <div className="side-select">
            <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.label} — {a.imap_user}</option>
              ))}
            </select>
          </div>
          <div className="select-label">AI Provider</div>
          <div className="side-select" style={{ marginBottom: 8 }}>
            <select value={selectedLlmId} onChange={e => setSelectedLlmId(e.target.value)}>
              {llmProviders.map(l => (
                <option key={l.id} value={l.id}>{l.label} — {LLM_INFO[l.provider]?.label ?? l.provider}</option>
              ))}
            </select>
          </div>
          <button className="btn-new-chat" onClick={newChat}>
            <svg viewBox="0 0 24 24" style={{ width:14, height:14, fill:'#fff', flexShrink:0 }}><path d="M19 3H5c-1.1 0-2 .9-2 2v14l4-4h12c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 10H7v-2h3v-3h2v3h3v2h-3v3h-2v-3z"/></svg>
            New Chat
          </button>
        </div>

        <div className="threads-list">
          {threads.length === 0 && (
            <div style={{ padding:10, fontSize:11, color:'rgba(255,255,255,0.3)' }}>No chats yet</div>
          )}
          {threads.map((t, i) => {
            const color = t.account_id ? getAcctColor(t.account_id) : '#94a3b8';
            const ai    = LLM_INFO[t.llm_provider] ?? {};
            return (
              <div key={t.id} className={`thread-item ${t.id === currentThreadId ? 'active' : ''}`} onClick={() => loadThread(t.id)}>
                <span className="thread-dot" style={{ background: color }} />
                <span className="thread-title">{t.title}</span>
                {ai.badge && <span className={`thread-ai-badge ${ai.cls ?? ''}`}>{ai.badge}</span>}
                <button className="thread-delete" onClick={e => deleteThread(e, t.id)}>×</button>
              </div>
            );
          })}
        </div>

        <div className="sidebar-footer">
          <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:130 }}>{userEmail}</span>
          <div style={{ display:'flex', gap:9, flexShrink:0 }}>
            <button onClick={() => setSettingsOpen(true)}>Settings</button>
            <button onClick={logout}>Logout</button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="main">
        <div className="main-header">
          <h2>{threadTitle}</h2>
          <div className="header-actions">
            {currentAcct && (
              <span className="user-chip" style={{ background: getAcctColor(currentThread?.account_id) + '22', color: getAcctColor(currentThread?.account_id), fontWeight: 600 }}>
                {currentAcct.label}
              </span>
            )}
            {currentLlm && (
              <span className={`user-chip ${LLM_INFO[currentLlm.provider]?.cls ?? ''}`}>{currentLlm.label}</span>
            )}
          </div>
        </div>

        <div className="messages" ref={messagesRef}>
          {messages.length === 0 && !isTyping && (
            <div className="empty-state">
              <svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
              <h3>What can I help you with?</h3>
              <p>Ask me to read your emails, search for messages, send a reply, or manage your inbox.</p>
              <div className="suggestions">
                {['Show my unread emails','Search for emails from my boss','How many unread emails do I have?','List my email folders'].map(s => (
                  <div key={s} className="suggestion" onClick={() => useSuggestion(s)}>{s}</div>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`message ${m.role}`}>
              <div className={`avatar ${m.role === 'user' ? 'avatar-user' : 'avatar-ai'}`}>{m.role === 'user' ? 'You' : 'AI'}</div>
              <div className="bubble" dangerouslySetInnerHTML={{ __html: formatContent(m.content) }} />
            </div>
          ))}

          {isTyping && (
            <div className="message assistant">
              <div className="avatar avatar-ai">AI</div>
              <div className="bubble" style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:7 }}>
                <div className="typing-dots">
                  <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                </div>
                {typingTool && (
                  <div className="typing-tool show">
                    <div className="typing-tool-spinner" />
                    <span>{typingTool}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="input-area">
          <div className="input-row">
            <textarea
              ref={textareaRef}
              className="msg-input"
              rows={1}
              placeholder="Ask about your emails…"
              value={msgInput}
              onChange={e => setMsgInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={autoResize}
            />
            <button className="btn-send" disabled={sending} onClick={sendMessage}>
              <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
          </div>
          <div className="input-hint">Enter to send · Shift+Enter for new line</div>
        </div>
      </div>

      {/* Send Confirmation Modal */}
      {pendingEmail && (
        <div className="modal-overlay open" onClick={e => { if (e.target.classList.contains('modal-overlay')) { setPendingEmail(null); setSendEmailError(''); } }}>
          <div className="settings-panel" style={{ width: 560 }}>
            <div className="settings-head">
              <h3>📤 Review Email Before Sending</h3>
              <button className="settings-close" onClick={() => { setPendingEmail(null); setSendEmailError(''); }}>×</button>
            </div>
            <div className="settings-body" style={{ padding: '20px 22px 22px' }}>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 18 }}>
                Review and edit this email before it's sent. Nothing has been sent yet.
              </p>

              <div className="field">
                <label>To</label>
                <input type="text" value={pendingEmail.to ?? ''} onChange={e => setPendingEmail(p => ({ ...p, to: e.target.value }))} />
              </div>

              {(pendingEmail.cc !== undefined) && (
                <div className="field">
                  <label>CC</label>
                  <input type="text" value={pendingEmail.cc ?? ''} onChange={e => setPendingEmail(p => ({ ...p, cc: e.target.value }))} placeholder="optional" />
                </div>
              )}

              {(pendingEmail.bcc !== undefined) && (
                <div className="field">
                  <label>BCC</label>
                  <input type="text" value={pendingEmail.bcc ?? ''} onChange={e => setPendingEmail(p => ({ ...p, bcc: e.target.value }))} placeholder="optional" />
                </div>
              )}

              <div className="field">
                <label>Subject</label>
                <input type="text" value={pendingEmail.subject ?? ''} onChange={e => setPendingEmail(p => ({ ...p, subject: e.target.value }))} />
              </div>

              <div className="field">
                <label>Body</label>
                <textarea
                  value={pendingEmail.body ?? ''}
                  onChange={e => setPendingEmail(p => ({ ...p, body: e.target.value }))}
                  rows={10}
                  style={{ width:'100%', padding:'10px 14px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:13, fontFamily:'inherit', resize:'vertical', outline:'none', lineHeight:1.6 }}
                  onFocus={e => e.target.style.borderColor = 'var(--blue)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>

              {sendEmailError && <div className="alert alert-error show">{sendEmailError}</div>}

              <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop: 4 }}>
                <button className="btn btn-secondary" onClick={() => { setPendingEmail(null); setSendEmailError(''); }}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={sendEmailDirectly} disabled={sendingEmail}>
                  {sendingEmail ? <><span className="spinner" /> Sending…</> : '📤 Send Email'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="modal-overlay open" onClick={e => { if (e.target.classList.contains('modal-overlay')) setSettingsOpen(false); }}>
          <div className="settings-panel">
            <div className="settings-head">
              <h3>Settings</h3>
              <button className="settings-close" onClick={() => setSettingsOpen(false)}>×</button>
            </div>
            <div className="settings-tabs">
              <button className={`stab ${settingsTab === 'accounts' ? 'active' : ''}`} onClick={() => setSettingsTab('accounts')}>Mail Accounts</button>
              <button className={`stab ${settingsTab === 'ai' ? 'active' : ''}`} onClick={() => setSettingsTab('ai')}>AI Providers</button>
            </div>
            <div className="settings-body">

              {settingsTab === 'accounts' && (
                <>
                  {accounts.length === 0 && <p style={{ fontSize:13, color:'var(--muted)', marginBottom:8 }}>No accounts yet.</p>}
                  {accounts.map((a, i) => (
                    <div key={a.id} className="acct-card">
                      <span className="acct-dot" style={{ background: acctColor(i) }} />
                      <div className="acct-info">
                        <div className="acct-label">{a.label}</div>
                        <div className="acct-sub">{a.imap_user}</div>
                      </div>
                      <button className="acct-del" onClick={() => deleteAccount(a.id, a.label)}>Delete</button>
                    </div>
                  ))}
                  {!showAddAcct && <button className="add-toggle" onClick={() => setShowAddAcct(true)}>+ Add Mail Account</button>}
                  {showAddAcct && (
                    <div className="add-form">
                      <div className="field"><label>Account Name</label><input type="text" placeholder="e.g. Business" value={newAcct.label} onChange={e => setNewAcct(a => ({...a, label:e.target.value}))} /></div>
                      <div className="sec">IMAP — Incoming Mail</div>
                      <div className="row-2" style={{ gridTemplateColumns:'1fr 85px' }}>
                        <div className="field"><label>Mail Server</label><input type="text" placeholder="mail.example.com" value={newAcct.imapHost} onChange={e => setNewAcct(a => ({...a, imapHost:e.target.value}))} /></div>
                        <div className="field"><label>Port</label><input type="number" value={newAcct.imapPort} onChange={e => setNewAcct(a => ({...a, imapPort:e.target.value}))} /></div>
                      </div>
                      <div className="field"><label>Email</label><input type="email" placeholder="you@example.com" value={newAcct.imapUser} onChange={e => setNewAcct(a => ({...a, imapUser:e.target.value}))} /></div>
                      <div className="field"><label>Password</label><input type="password" placeholder="App password" value={newAcct.imapPass} onChange={e => setNewAcct(a => ({...a, imapPass:e.target.value}))} /></div>
                      <div className="sec">SMTP — Outgoing Mail</div>
                      <div className="row-2" style={{ gridTemplateColumns:'1fr 85px' }}>
                        <div className="field"><label>SMTP Host</label><input type="text" placeholder="mail.example.com" value={newAcct.smtpHost} onChange={e => setNewAcct(a => ({...a, smtpHost:e.target.value}))} /></div>
                        <div className="field"><label>Port</label><input type="number" value={newAcct.smtpPort} onChange={e => setNewAcct(a => ({...a, smtpPort:e.target.value}))} /></div>
                      </div>
                      {acctErr && <div className="alert alert-error show">{acctErr}</div>}
                      <div className="add-form-actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => { setShowAddAcct(false); setAcctErr(''); }}>Cancel</button>
                        <button className="btn btn-primary btn-sm" onClick={submitAddAccount} disabled={savingAcct}>
                          {savingAcct ? <><span className="spinner" /> Saving…</> : 'Save Account'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {settingsTab === 'ai' && (
                <>
                  {llmProviders.length === 0 && <p style={{ fontSize:13, color:'var(--muted)', marginBottom:8 }}>No AI providers yet.</p>}
                  {llmProviders.map(l => {
                    const info = LLM_INFO[l.provider] ?? { label: l.provider, badge: '?', cls: '' };
                    return (
                      <div key={l.id} className="acct-card">
                        <span className={`acct-dot ${info.cls}`} style={{ width:24, height:24, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, opacity:1 }}>{info.badge}</span>
                        <div className="acct-info">
                          <div className="acct-label">{l.label}</div>
                          <div className="acct-sub">{info.label}{l.model ? ' · ' + l.model : ''}</div>
                        </div>
                        <button className="acct-del" onClick={() => deleteLlm(l.id, l.label)}>Delete</button>
                      </div>
                    );
                  })}
                  {!showAddLlm && <button className="add-toggle" onClick={() => setShowAddLlm(true)}>+ Add AI Provider</button>}
                  {showAddLlm && (
                    <div className="add-form">
                      <div className="field"><label>Provider Name</label><input type="text" placeholder="My AI" value={newLlm.label} onChange={e => setNewLlm(l => ({...l, label:e.target.value}))} /></div>
                      <div className="provider-grid" style={{ gridTemplateColumns:'1fr 1fr', gap:7, marginBottom:12 }}>
                        {[
                          { id:'claude',     name:'Claude',      desc:'Anthropic' },
                          { id:'openai',     name:'GPT-4o',      desc:'OpenAI' },
                          { id:'groq',       name:'Groq ⚡',     desc:'Ultra-fast LLaMA' },
                          { id:'perplexity', name:'Perplexity',  desc:'Search-augmented AI' },
                        ].map(p => (
                          <div key={p.id} className={`provider-card ${newLlm.provider === p.id ? 'selected' : ''}`} onClick={() => setNewLlm(l => ({...l, provider:p.id}))}>
                            <div className="name">{p.name}</div>
                            <div className="desc">{p.desc}</div>
                          </div>
                        ))}
                      </div>
                      <div className="field"><label>API Key</label><input type="password" placeholder="sk-… or sk-ant-…" value={newLlm.apiKey} onChange={e => setNewLlm(l => ({...l, apiKey:e.target.value}))} /></div>
                      <div className="field"><label>Model <span className="hint">optional</span></label><input type="text" placeholder={modelPh[newLlm.provider]} value={newLlm.model} onChange={e => setNewLlm(l => ({...l, model:e.target.value}))} /></div>
                      {llmErr && <div className="alert alert-error show">{llmErr}</div>}
                      <div className="add-form-actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => { setShowAddLlm(false); setLlmErr(''); }}>Cancel</button>
                        <button className="btn btn-primary btn-sm" onClick={submitAddLlm} disabled={savingLlm}>
                          {savingLlm ? <><span className="spinner" /> Saving…</> : 'Save Provider'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
