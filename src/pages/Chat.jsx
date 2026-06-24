import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken, getToken, streamChat, aiCompose } from '../lib/api.js';
import ModelPicker, { PROVIDER_MODELS } from '../lib/ModelPicker.jsx';
import InboxPanel from '../lib/InboxPanel.jsx';

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
function senderName(from) {
  if (!from) return '(unknown sender)';
  const m = from.match(/^(.*?)\s*<(.+)>$/);
  const name = m ? (m[1] || m[2]) : from;
  return name.replace(/^"|"$/g, '').trim() || from;
}
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
  const [loading, setLoading]           = useState(true);
  const [messages, setMessages]         = useState([]);
  const [currentThreadId, setCurrentThreadId] = useState(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedLlmId, setSelectedLlmId]         = useState('');
  const [sending, setSending]           = useState(false);
  const [typingTool, setTypingTool]     = useState('');
  const [isTyping, setIsTyping]         = useState(false);
  const [msgInput, setMsgInput]         = useState('');
  const [listening, setListening]       = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inboxOpen, setInboxOpen]       = useState(false);
  const [activeEmail, setActiveEmail]   = useState(null); // email currently open in the Inbox panel (chat context)
  // Persistent map of "<accountId>:<uid>" -> threadId, so each email keeps its own chat.
  const [emailThreadMap, setEmailThreadMap] = useState(() => {
    try { return JSON.parse(localStorage.getItem('emailChatMap') || '{}'); } catch { return {}; }
  });
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [settingsTab, setSettingsTab]   = useState('accounts');
  const [threadTitle, setThreadTitle]   = useState('Floki Mail');

  const [composeOpen, setComposeOpen]   = useState(false);
  const [compose, setCompose]           = useState({ to:'', cc:'', subject:'', body:'' });
  const [composeAccountId, setComposeAccountId] = useState('');
  const [aiBusy, setAiBusy]             = useState('');       // which AI action is running
  const [showWritePrompt, setShowWritePrompt] = useState(false);
  const [writePrompt, setWritePrompt]   = useState('');
  const [composeError, setComposeError] = useState('');
  const [composeSending, setComposeSending] = useState(false);
  const [tone, setTone]                 = useState('Professional');
  const [prevBody, setPrevBody]         = useState(null);   // for Undo after AI edit
  const [composeLlmId, setComposeLlmId] = useState('');     // per-email AI provider
  const [composeModel, setComposeModel] = useState('');     // per-email model override ('' = provider default)

  const [showAddAcct, setShowAddAcct] = useState(false);
  const [showAddLlm,  setShowAddLlm]  = useState(false);
  const [newAcct, setNewAcct] = useState({ label:'', imapHost:'', imapPort:'993', imapUser:'', imapPass:'', smtpHost:'', smtpPort:'587' });
  const [newLlm,  setNewLlm]  = useState({ label:'', provider:'claude', apiKey:'', model:'' });
  const [acctErr, setAcctErr] = useState('');
  const [llmErr,  setLlmErr]  = useState('');
  const [savingAcct, setSavingAcct] = useState(false);
  const [savingLlm,  setSavingLlm]  = useState(false);
  const [editAcctId, setEditAcctId]       = useState(null);  // account being edited
  const [editAcct, setEditAcct]           = useState({ label:'', imapHost:'', imapPort:'993', imapUser:'', imapPass:'', smtpHost:'', smtpPort:'587' });
  const [savingEditAcct, setSavingEditAcct] = useState(false);

  const [headerDropdown, setHeaderDropdown] = useState(null); // 'provider' | 'account' | 'model' | null
  const [confirmDeleteThread, setConfirmDeleteThread] = useState(null);
  const [modelInput, setModelInput] = useState('');

  const messagesRef      = useRef(null);
  const textareaRef      = useRef(null);
  const cancelStreamRef  = useRef(null);
  const headerActionsRef = useRef(null);
  const recognitionRef   = useRef(null);
  const baseTranscriptRef = useRef('');
  const emailThreadMapRef = useRef(emailThreadMap);
  emailThreadMapRef.current = emailThreadMap;

  const emailKey = (e) => (e && e.uid != null ? `${e.accountId}:${e.uid}` : null);
  function rememberEmailThread(key, threadId) {
    if (!key) return;
    setEmailThreadMap(m => {
      const next = { ...m, [key]: threadId };
      try { localStorage.setItem('emailChatMap', JSON.stringify(next)); } catch {}
      return next;
    });
  }

  // Whether the browser supports the Web Speech API (Chrome/Edge/Safari).
  const speechSupported = typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  // Clean up any active recognition session when the component unmounts.
  useEffect(() => () => { try { recognitionRef.current?.abort(); } catch {} }, []);

  function toggleVoiceInput() {
    if (listening) { recognitionRef.current?.stop(); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';
    recognitionRef.current = recognition;

    // Remember what's already typed so dictation appends to it.
    baseTranscriptRef.current = msgInput ? msgInput.trim() + ' ' : '';

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setMsgInput(baseTranscriptRef.current + transcript);
      requestAnimationFrame(() => {
        if (textareaRef.current) autoResize({ target: textareaRef.current });
      });
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  useEffect(() => {
    if (!getToken()) { navigate('/', { replace: true }); return; }
    init();
  }, []);

  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages, isTyping]);

  // Each email gets its own chat. Opening an email restores that email's thread
  // (if one exists) or starts a fresh empty chat; the chat also follows the
  // email's mailbox so "this email" always resolves correctly.
  useEffect(() => {
    if (!activeEmail?.uid) return;
    const acctId = Number(activeEmail.accountId);
    if (acctId) setSelectedAccountId(String(acctId));

    const key    = emailKey(activeEmail);
    const mapped = emailThreadMapRef.current[key];
    if (mapped && threads.some(t => t.id === mapped)) {
      if (mapped !== currentThreadId) loadThread(mapped);
    } else {
      // No saved chat for this email yet — open a fresh one (created on first send).
      setCurrentThreadId(null);
      setMessages([]);
      setThreadTitle(activeEmail.subject ? activeEmail.subject.slice(0, 50) : 'New Chat');
    }
  }, [activeEmail]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!headerDropdown) return;
    function handleOutsideClick(e) {
      if (headerActionsRef.current && !headerActionsRef.current.contains(e.target)) {
        setHeaderDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [headerDropdown]);

  async function init() {
    try {
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
    } finally {
      setLoading(false);
    }
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

  // Build the POST body for a new thread from the current selection.
  // selectedAccountId === 'all' creates a unified "all inboxes" thread.
  function newThreadBody() {
    const llmId = Number(selectedLlmId);
    if (!llmId) return null;
    if (selectedAccountId === 'all') return { scope: 'all', llmId };
    const accountId = Number(selectedAccountId);
    if (!accountId) return null;
    return { accountId, llmId };
  }

  async function newChat() {
    const body = newThreadBody();
    if (!body) return;
    const r = await api.post('/api/threads', body);
    if (!r.ok) return;
    const t = await r.json();
    setCurrentThreadId(t.id);
    setThreadTitle('New Chat');
    setMessages([]);
    await loadThreads();
    setSidebarOpen(false);
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
    setSidebarOpen(false);
  }

  async function deleteThread(id) {
    setConfirmDeleteThread(null);
    await api.del(`/api/threads/${id}`);
    if (currentThreadId === id) {
      setCurrentThreadId(null);
      setMessages([]);
      setThreadTitle('Floki Mail');
    }
    await loadThreads();
  }

  async function switchThreadModel(llmId) {
    setHeaderDropdown(null);
    if (!currentThreadId) { setSelectedLlmId(String(llmId)); return; }
    const r = await api.put(`/api/threads/${currentThreadId}`, { llmId: Number(llmId) });
    if (!r.ok) return;
    const provider = llmProviders.find(l => l.id === Number(llmId))?.provider;
    setThreads(ts => ts.map(t => t.id === currentThreadId ? { ...t, llm_id: Number(llmId), llm_provider: provider } : t));
  }

  async function switchThreadAccount(accountId) {
    setHeaderDropdown(null);
    const isAll = accountId === 'all';
    if (!currentThreadId) { setSelectedAccountId(isAll ? 'all' : String(accountId)); return; }
    const body = isAll ? { scope: 'all' } : { accountId: Number(accountId) };
    const r = await api.put(`/api/threads/${currentThreadId}`, body);
    if (!r.ok) return;
    setThreads(ts => ts.map(t => t.id === currentThreadId
      ? { ...t, scope: isAll ? 'all' : 'account', account_id: isAll ? null : Number(accountId) }
      : t));
  }

  async function switchModelOverride(model) {
    if (!currentThreadId) return;
    const r = await api.put(`/api/threads/${currentThreadId}`, { model });
    if (!r.ok) return;
    setThreads(ts => ts.map(t => t.id === currentThreadId ? { ...t, model_override: model || null } : t));
  }

  function openModelDropdown() {
    setModelInput(currentThread?.model_override ?? '');
    setHeaderDropdown(d => d === 'model' ? null : 'model');
  }

  function stopStreaming() {
    cancelStreamRef.current?.();
    setIsTyping(false);
    setSending(false);
  }

  async function sendMessage(overrideText) {
    if (sending) return;
    const message = (overrideText !== undefined ? overrideText : msgInput).trim();
    if (!message) return;
    if (listening) recognitionRef.current?.stop();

    let threadId = currentThreadId;
    if (!threadId) {
      const body = newThreadBody();
      if (!body) return;
      const r = await api.post('/api/threads', body);
      if (!r.ok) return;
      const t = await r.json();
      threadId = t.id;
      setCurrentThreadId(t.id);
      // Bind this brand-new thread to the email being discussed, so re-opening
      // the email later restores this same chat.
      if (activeEmail) rememberEmailThread(emailKey(activeEmail), t.id);
      await loadThreads();
    }

    setSending(true);
    setMsgInput('');
    if (textareaRef.current) textareaRef.current.style.height = '';
    setMessages(m => [...m, { role: 'user', content: message }]);
    setIsTyping(true);
    setTypingTool('');

    cancelStreamRef.current = streamChat(threadId, message, {
      context: activeEmail || undefined,
      onTool: (name) => setTypingTool(TOOL_LABELS[name] ?? ('⚙️ ' + name.replace(/_/g, ' '))),
      onComposeDraft: (email) => openComposeWithDraft(email),
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

  const AI_BUSY_LABEL = { write: 'Writing…', proofread: 'Proofreading…', expand: 'Expanding…', shorten: 'Shortening…' };

  function openCompose() {
    setCompose({ to:'', cc:'', subject:'', body:'' });
    setComposeAccountId(selectedAccountId || (accounts[0] ? String(accounts[0].id) : ''));
    setComposeError(''); setShowWritePrompt(false); setWritePrompt(''); setAiBusy('');
    setPrevBody(null);
    setComposeLlmId(selectedLlmId || (llmProviders[0] ? String(llmProviders[0].id) : ''));
    setComposeModel('');
    setComposeOpen(true);
    setSidebarOpen(false);
  }

  // When the AI drafts an email, open it in the Compose modal (with its AI tools)
  // pre-filled, instead of a separate confirm dialog.
  function openComposeWithDraft(email) {
    setCompose({
      to:      email.to      ?? '',
      cc:      email.cc      ?? '',
      subject: email.subject ?? '',
      body:    email.body    ?? '',
    });
    setComposeAccountId(email.accountId ? String(email.accountId) : (selectedAccountId || (accounts[0] ? String(accounts[0].id) : '')));
    setComposeError(''); setShowWritePrompt(false); setWritePrompt(''); setAiBusy('');
    setPrevBody(null);
    setComposeLlmId(selectedLlmId || (llmProviders[0] ? String(llmProviders[0].id) : ''));
    setComposeModel('');
    setComposeOpen(true);
    setSidebarOpen(false);
  }

  function undoAiEdit() {
    if (prevBody === null) return;
    setCompose(c => ({ ...c, body: prevBody }));
    setPrevBody(null);
  }

  async function runAiAction(action) {
    setComposeError('');
    if (action === 'write') { setShowWritePrompt(s => !s); return; }
    if (!compose.body.trim()) { setComposeError('Write something in the body first, or use "Write for me".'); return; }
    setAiBusy(action);
    const before = compose.body;
    try {
      const text = await aiCompose({ llmId: Number(composeLlmId) || undefined, model: composeModel, action, text: compose.body, tone });
      setPrevBody(before);
      setCompose(c => ({ ...c, body: text }));
    } catch (e) { setComposeError(e.message); }
    finally { setAiBusy(''); }
  }

  async function runWriteForMe() {
    if (!writePrompt.trim() || aiBusy) return;
    setAiBusy('write'); setComposeError('');
    const before = compose.body;
    try {
      const text = await aiCompose({ llmId: Number(composeLlmId) || undefined, model: composeModel, action: 'write', text: compose.body, instruction: writePrompt, tone });
      setPrevBody(before);
      setCompose(c => ({ ...c, body: text }));
      setShowWritePrompt(false); setWritePrompt('');
    } catch (e) { setComposeError(e.message); }
    finally { setAiBusy(''); }
  }

  async function sendComposed() {
    if (!compose.to.trim() || !compose.subject.trim() || !compose.body.trim()) {
      setComposeError('To, subject, and body are required.'); return;
    }
    if (!composeAccountId) { setComposeError('Select an account to send from.'); return; }
    setComposeSending(true); setComposeError('');
    try {
      const r = await api.post(`/api/accounts/${composeAccountId}/send`, {
        to: compose.to, cc: compose.cc || undefined, subject: compose.subject, body: compose.body,
      });
      const d = await r.json();
      if (!r.ok) { setComposeError(d.error ?? 'Failed to send email.'); return; }
      setComposeOpen(false);
    } catch { setComposeError('Network error. Please try again.'); }
    finally { setComposeSending(false); }
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

  function startEditAccount(acct) {
    setEditAcctId(acct.id);
    setEditAcct({
      label:    acct.label || '',
      imapHost: acct.imap_host || '',
      imapPort: String(acct.imap_port || '993'),
      imapUser: acct.imap_user || '',
      imapPass: '',                                  // blank = keep current password
      smtpHost: acct.smtp_host || '',
      smtpPort: String(acct.smtp_port || '587'),
    });
    setShowAddAcct(false);
    setAcctErr('');
  }

  function cancelEditAccount() {
    setEditAcctId(null);
    setAcctErr('');
  }

  async function submitEditAccount(id) {
    const { label, imapHost, imapUser, smtpHost } = editAcct;
    if (!label.trim()) { setAcctErr('Account name is required.'); return; }
    if (!imapHost || !imapUser || !smtpHost) { setAcctErr('Mail server, email, and SMTP host are required.'); return; }
    setSavingEditAcct(true); setAcctErr('');
    try {
      const body = {
        label: label.trim(),
        imapHost, imapUser,
        imapPort: Number(editAcct.imapPort),
        smtpHost: smtpHost || imapHost,
        smtpPort: Number(editAcct.smtpPort),
      };
      if (editAcct.imapPass) body.imapPass = editAcct.imapPass;  // omit to keep current password
      const r = await api.put(`/api/accounts/${id}`, body);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setAcctErr(d.error ?? 'Failed to update account.'); return; }
      const accts = await api.get('/api/accounts').then(r => r.json());
      setAccounts(accts);
      cancelEditAccount();
    } catch { setAcctErr('Network error.'); }
    finally { setSavingEditAcct(false); }
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
      {/* Mobile drawer backdrop */}
      <div className={`sidebar-backdrop ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)} />
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src="/flokilogo.PNG" alt="Floki" />
            <span>Floki Mail</span>
            <button className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu">×</button>
          </div>
          <div className="select-label">Default Account</div>
          {loading ? <div className="skeleton skel-select" /> : (
            <div className="side-select">
              <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}>
                {accounts.length > 1 && <option value="all">🌐 All Inboxes</option>}
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.label} — {a.imap_user}</option>
                ))}
              </select>
            </div>
          )}
          <div className="select-label">Default AI Provider</div>
          {loading ? <div className="skeleton skel-select" style={{ marginBottom: 8 }} /> : (
            <div className="side-select" style={{ marginBottom: 8 }}>
              <select value={selectedLlmId} onChange={e => setSelectedLlmId(e.target.value)}>
                {llmProviders.map(l => (
                  <option key={l.id} value={l.id}>{l.label} — {LLM_INFO[l.provider]?.label ?? l.provider}</option>
                ))}
              </select>
            </div>
          )}
          <button className="btn-new-chat" onClick={newChat}>
            <svg viewBox="0 0 24 24" style={{ width:14, height:14, fill:'#fff', flexShrink:0 }}><path d="M19 3H5c-1.1 0-2 .9-2 2v14l4-4h12c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 10H7v-2h3v-3h2v3h3v2h-3v3h-2v-3z"/></svg>
            New Chat
          </button>
          <button className="btn-compose" onClick={openCompose} style={{ marginTop: 8 }}>
            <svg viewBox="0 0 24 24" style={{ width:14, height:14, fill:'currentColor', flexShrink:0 }}><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
            Compose Email
          </button>
          <button className={`btn-inbox ${inboxOpen ? 'active' : ''}`} onClick={() => { setInboxOpen(o => !o); setSidebarOpen(false); }} style={{ marginTop: 8 }} disabled={accounts.length === 0}>
            <svg viewBox="0 0 24 24" style={{ width:14, height:14, fill:'currentColor', flexShrink:0 }}><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 12h-4c0 1.66-1.35 3-3 3s-3-1.34-3-3H5V5h14v10z"/></svg>
            Inbox
          </button>
        </div>

        <div className="threads-list">
          {loading ? (
            <div className="thread-skeletons">
              {[80, 65, 72, 58, 68].map((w, i) => (
                <div key={i} className="skel-thread">
                  <span className="skeleton skel-thread-dot" />
                  <span className="skeleton skel-thread-bar" style={{ maxWidth: w + '%' }} />
                </div>
              ))}
            </div>
          ) : threads.length === 0 ? (
            <div style={{ padding:10, fontSize:11, color:'rgba(255,255,255,0.3)' }}>No chats yet</div>
          ) : (
            threads.map((t) => {
            const isAll = t.scope === 'all';
            const color = isAll ? '#6366f1' : (t.account_id ? getAcctColor(t.account_id) : '#94a3b8');
            const ai    = LLM_INFO[t.llm_provider] ?? {};
            const isConfirming = confirmDeleteThread === t.id;
            return (
              <div key={t.id} className={`thread-item ${t.id === currentThreadId ? 'active' : ''}`} onClick={() => !isConfirming && loadThread(t.id)}>
                <span className="thread-dot" style={{ background: color }} title={isAll ? 'All inboxes' : undefined} />
                <span className="thread-title">{isAll ? '🌐 ' : ''}{t.title}</span>
                {!isConfirming && ai.badge && <span className={`thread-ai-badge ${ai.cls ?? ''}`}>{ai.badge}</span>}
                {isConfirming ? (
                  <div className="thread-confirm" onClick={e => e.stopPropagation()}>
                    <span style={{ fontSize:10, color:'rgba(255,255,255,0.55)', whiteSpace:'nowrap' }}>Delete?</span>
                    <button className="thread-confirm-yes" onClick={() => deleteThread(t.id)}>Yes</button>
                    <button className="thread-confirm-no" onClick={() => setConfirmDeleteThread(null)}>No</button>
                  </div>
                ) : (
                  <button className="thread-delete" onClick={e => { e.stopPropagation(); setConfirmDeleteThread(t.id); }}>×</button>
                )}
              </div>
            );
          })
          )}
        </div>

        <div className="sidebar-footer">
          <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:130 }}>{userEmail}</span>
          <div style={{ display:'flex', gap:9, flexShrink:0 }}>
            <button onClick={() => { setSettingsOpen(true); setSidebarOpen(false); }}>Settings</button>
            <button onClick={logout}>Logout</button>
          </div>
        </div>
      </aside>

      {/* Inbox dock — sits to the left of the chat, toggled by the sidebar button */}
      <InboxPanel
        open={inboxOpen}
        onClose={() => setInboxOpen(false)}
        accounts={accounts}
        defaultAccountId={selectedAccountId}
        onActiveEmailChange={setActiveEmail}
      />

      {/* Main */}
      <div className="main">
        <div className="main-header">
          <button className="menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <svg viewBox="0 0 24 24"><path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"/></svg>
          </button>
          <h2>{threadTitle}</h2>
          <div className="header-actions" ref={headerActionsRef}>
            {currentThread && (
              <>
                {/* Account switcher */}
                {(() => {
                  const isAll = currentThread.scope === 'all';
                  const chipColor = isAll ? '#6366f1' : getAcctColor(currentThread.account_id);
                  return (
                <div className="header-chip-wrap">
                  <span
                    className="user-chip header-chip-btn"
                    style={{ background: chipColor + '22', color: chipColor, fontWeight: 600 }}
                    onClick={() => setHeaderDropdown(d => d === 'account' ? null : 'account')}
                    title="Switch mail account for this chat"
                  >
                    {isAll ? '🌐 All Inboxes' : (currentAcct?.label ?? 'Account')}
                    <svg viewBox="0 0 10 6" style={{ width:8, height:8, marginLeft:4, fill:'currentColor', opacity:0.65 }}><path d="M0 0l5 6 5-6z"/></svg>
                  </span>
                  {headerDropdown === 'account' && (
                    <div className="header-dropdown">
                      <div className="header-dropdown-label">Switch Account</div>
                      {accounts.length > 1 && (
                        <div
                          className={`header-dropdown-item ${isAll ? 'selected' : ''}`}
                          onClick={() => switchThreadAccount('all')}
                        >
                          <span className="hdi-dot" style={{ background: '#6366f1' }} />
                          <span>🌐 All Inboxes</span>
                          {isAll && <span className="hdi-check">✓</span>}
                        </div>
                      )}
                      {accounts.map((a, i) => (
                        <div
                          key={a.id}
                          className={`header-dropdown-item ${!isAll && a.id === currentThread.account_id ? 'selected' : ''}`}
                          onClick={() => switchThreadAccount(a.id)}
                        >
                          <span className="hdi-dot" style={{ background: acctColor(i) }} />
                          <span>{a.label}</span>
                          {!isAll && a.id === currentThread.account_id && <span className="hdi-check">✓</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                  );
                })()}

                {/* AI provider switcher */}
                <div className="header-chip-wrap">
                  <span
                    className={`user-chip header-chip-btn ${LLM_INFO[currentLlm?.provider]?.cls ?? ''}`}
                    onClick={() => setHeaderDropdown(d => d === 'provider' ? null : 'provider')}
                    title="Switch AI provider for this chat"
                  >
                    {currentLlm?.label ?? 'AI'}
                    <svg viewBox="0 0 10 6" style={{ width:8, height:8, marginLeft:4, fill:'currentColor', opacity:0.65 }}><path d="M0 0l5 6 5-6z"/></svg>
                  </span>
                  {headerDropdown === 'provider' && (
                    <div className="header-dropdown">
                      <div className="header-dropdown-label">Switch AI Provider</div>
                      {llmProviders.map(l => {
                        const info = LLM_INFO[l.provider] ?? { label: l.provider, badge: '?', cls: '' };
                        return (
                          <div
                            key={l.id}
                            className={`header-dropdown-item ${l.id === currentThread.llm_id ? 'selected' : ''}`}
                            onClick={() => switchThreadModel(l.id)}
                          >
                            <span className={`hdi-badge ${info.cls}`}>{info.badge}</span>
                            <span>{l.label}</span>
                            <span style={{ fontSize:10, color:'var(--muted)', marginLeft:'auto', paddingLeft:8 }}>{info.label}</span>
                            {l.id === currentThread.llm_id && <span className="hdi-check">✓</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Model override switcher */}
                {currentLlm && (() => {
                  const activeModel = currentThread.model_override || currentLlm.model || '';
                  const knownModel  = PROVIDER_MODELS[currentLlm.provider]?.find(m => m.id === activeModel);
                  const modelLabel  = knownModel ? knownModel.name : (activeModel || 'Default model');
                  return (
                    <div className="header-chip-wrap">
                      <span
                        className="user-chip header-chip-btn"
                        style={{ color: 'var(--muted)', background: activeModel ? '#f1f5f9' : 'var(--gray)', fontStyle: activeModel ? 'normal' : 'italic' }}
                        onClick={openModelDropdown}
                        title="Switch model for this chat"
                      >
                        {modelLabel}
                        <svg viewBox="0 0 10 6" style={{ width:8, height:8, marginLeft:4, fill:'currentColor', opacity:0.65 }}><path d="M0 0l5 6 5-6z"/></svg>
                      </span>
                      {headerDropdown === 'model' && (
                        <div className="header-dropdown header-dropdown-wide">
                          <div className="header-dropdown-label">Switch Model</div>
                          <div style={{ padding:'0 10px 6px' }}>
                            <ModelPicker
                              provider={currentLlm.provider}
                              value={modelInput}
                              onChange={v => { setModelInput(v); switchModelOverride(v); setHeaderDropdown(null); }}
                            />
                            <div style={{ display:'flex', gap:6, marginTop:8 }}>
                              <input
                                className="model-custom-input"
                                type="text"
                                placeholder="Custom model ID…"
                                value={modelInput}
                                onChange={e => setModelInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { switchModelOverride(modelInput); setHeaderDropdown(null); } }}
                                autoFocus
                              />
                              <button
                                className="btn btn-primary btn-sm"
                                style={{ flexShrink:0 }}
                                onClick={() => { switchModelOverride(modelInput); setHeaderDropdown(null); }}
                              >Apply</button>
                            </div>
                            {activeModel && (
                              <button
                                className="model-reset-btn"
                                onClick={() => { switchModelOverride(''); setHeaderDropdown(null); }}
                              >Reset to default</button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>

        <div className="messages" ref={messagesRef}>
          {messages.length === 0 && !isTyping && (() => {
            const allMode = currentThread ? currentThread.scope === 'all' : selectedAccountId === 'all';
            const suggestions = allMode
              ? ['Give me urgent emails from all inboxes','Show unread across every account','Summarize what needs my attention today','Any invoices in any inbox?']
              : ['Show my unread emails','Search for emails from my boss','How many unread emails do I have?','List my email folders'];
            return (
            <div className="empty-state">
              <svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
              <h3>{allMode ? '🌐 All Inboxes' : 'What can I help you with?'}</h3>
              <p>{allMode
                ? 'Ask across every connected account at once — search, summarize, and triage all your mail together.'
                : 'Ask me to read your emails, search for messages, send a reply, or manage your inbox.'}</p>
              <div className="suggestions">
                {suggestions.map(s => (
                  <div key={s} className="suggestion" onClick={() => sendMessage(s)}>{s}</div>
                ))}
              </div>
            </div>
            );
          })()}

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
          {activeEmail && (
            <div className="chat-context-bar">
              <div className="ccb-info">
                <span className="ccb-icon">📧</span>
                <div className="ccb-text">
                  <span className="ccb-label">Talking about this email</span>
                  <span className="ccb-sub" title={`${activeEmail.subject || '(no subject)'} — ${activeEmail.from || ''}`}>
                    {activeEmail.subject || '(no subject)'} · {senderName(activeEmail.from)}
                    {activeEmail.account ? ` · ${activeEmail.account}` : ''}
                  </span>
                </div>
                <button className="ccb-close" onClick={() => setActiveEmail(null)} title="Stop using this email as context">×</button>
              </div>
              <div className="ccb-actions">
                {[
                  { l: 'Summarize',      m: 'Summarize this email.' },
                  { l: 'Draft a reply',  m: 'Draft a reply to this email.' },
                  { l: 'Who sent this?', m: 'Who sent this email and what are they asking for?' },
                ].map(a => (
                  <button key={a.l} className="ccb-action" onClick={() => sendMessage(a.m)} disabled={sending}>{a.l}</button>
                ))}
              </div>
            </div>
          )}
          <div className="input-row">
            <textarea
              ref={textareaRef}
              className="msg-input"
              rows={1}
              placeholder={listening ? 'Listening… speak now' : (activeEmail ? 'Ask about this email…' : 'Ask about your emails…')}
              value={msgInput}
              onChange={e => setMsgInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={autoResize}
              disabled={sending}
            />
            {speechSupported && (
              <button
                className={`btn-mic${listening ? ' listening' : ''}`}
                onClick={toggleVoiceInput}
                disabled={sending}
                title={listening ? 'Stop dictation' : 'Speak your prompt'}
                aria-label={listening ? 'Stop dictation' : 'Start voice input'}
              >
                <svg viewBox="0 0 24 24">
                  <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z"/>
                  <path d="M17 11a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/>
                </svg>
              </button>
            )}
            {sending ? (
              <button className="btn-stop" onClick={stopStreaming} title="Stop generating">
                <svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
              </button>
            ) : (
              <button className="btn-send" disabled={!msgInput.trim()} onClick={() => sendMessage()}>
                <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              </button>
            )}
          </div>
          <div className="input-hint">Enter to send · Shift+Enter for new line</div>
        </div>
      </div>

      {/* Compose Modal */}
      {composeOpen && (
        <div className="modal-overlay open" onClick={e => { if (e.target.classList.contains('modal-overlay')) setComposeOpen(false); }}>
          <div className="settings-panel" style={{ width: 600 }}>
            <div className="settings-head">
              <h3>✉️ Compose Email</h3>
              <button className="settings-close" onClick={() => setComposeOpen(false)}>×</button>
            </div>
            <div className="settings-body" style={{ padding: '18px 22px 22px' }}>
              <div className="field">
                <label>From</label>
                <select value={composeAccountId} onChange={e => setComposeAccountId(e.target.value)}>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.label} — {a.imap_user}</option>)}
                </select>
              </div>
              <div className="field">
                <label>To</label>
                <input type="text" placeholder="recipient@example.com" value={compose.to} onChange={e => setCompose(c => ({ ...c, to: e.target.value }))} />
              </div>
              <div className="field">
                <label>CC <span className="hint">optional</span></label>
                <input type="text" placeholder="optional" value={compose.cc} onChange={e => setCompose(c => ({ ...c, cc: e.target.value }))} />
              </div>
              <div className="field">
                <label>Subject</label>
                <input type="text" value={compose.subject} onChange={e => setCompose(c => ({ ...c, subject: e.target.value }))} />
              </div>

              {/* AI assistant panel */}
              <div className="ai-panel">
                <div className="ai-panel-head">
                  <span className="ai-panel-title"><span className="ai-panel-spark">✦</span> AI Assistant</span>
                  {prevBody !== null && !aiBusy && (
                    <button className="ai-undo-btn" onClick={undoAiEdit} title="Restore text from before the last AI edit">
                      <span className="ai-tool-icon">↶</span> Undo
                    </button>
                  )}
                </div>
                <div className="ai-controls">
                  {(() => {
                    const cp = llmProviders.find(l => String(l.id) === String(composeLlmId));
                    const models = PROVIDER_MODELS[cp?.provider] ?? [];
                    return (
                      <>
                        <select className="ai-ctrl-select" value={composeLlmId} onChange={e => { setComposeLlmId(e.target.value); setComposeModel(''); }} disabled={!!aiBusy} title="AI provider for this email">
                          {llmProviders.map(l => <option key={l.id} value={l.id}>{l.label} — {LLM_INFO[l.provider]?.label ?? l.provider}</option>)}
                        </select>
                        {models.length > 0 && (
                          <select className="ai-ctrl-select" value={composeModel} onChange={e => setComposeModel(e.target.value)} disabled={!!aiBusy} title="Model for this email">
                            <option value="">Default model</option>
                            {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                        )}
                      </>
                    );
                  })()}
                  <select className="ai-ctrl-select" value={tone} onChange={e => setTone(e.target.value)} disabled={!!aiBusy} title="Tone for AI writing">
                    {['Professional','Friendly','Casual','Formal'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="ai-toolbar">
                  {[
                    { id:'write',     label:'Write for me', icon:'✨' },
                    { id:'proofread', label:'Proofread',    icon:'✓'  },
                    { id:'expand',    label:'Expand',       icon:'↔'  },
                    { id:'shorten',   label:'Shorten',      icon:'⇥'  },
                  ].map(b => (
                    <button
                      key={b.id}
                      className={`ai-tool-btn ${b.id === 'write' && showWritePrompt ? 'active' : ''}`}
                      onClick={() => runAiAction(b.id)}
                      disabled={!!aiBusy}
                    >
                      {aiBusy === b.id ? <span className="spinner" /> : <span className="ai-tool-icon">{b.icon}</span>}
                      {b.label}
                    </button>
                  ))}
                </div>

                {showWritePrompt && (
                  <div className="ai-write-row">
                    <input
                      type="text"
                      placeholder="Tell the AI what to write… e.g. 'a polite follow-up about the invoice'"
                      value={writePrompt}
                      onChange={e => setWritePrompt(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') runWriteForMe(); }}
                      autoFocus
                    />
                    <button className="btn btn-primary btn-sm" onClick={runWriteForMe} disabled={!writePrompt.trim() || !!aiBusy}>
                    {aiBusy === 'write' ? <span className="spinner" /> : 'Generate'}
                    </button>
                  </div>
                )}
              </div>

              <div className="field" style={{ marginTop: 12 }}>
                <label>Body</label>
                <div className={`ai-body-wrap ${aiBusy ? 'busy' : ''}`}>
                  <textarea
                    value={compose.body}
                    onChange={e => setCompose(c => ({ ...c, body: e.target.value }))}
                    rows={11}
                    placeholder="Write your email, or use the AI tools above…"
                    disabled={!!aiBusy}
                    style={{ width:'100%', padding:'10px 14px', border:'1.5px solid var(--border)', borderRadius:8, fontSize:13, fontFamily:'inherit', resize:'vertical', outline:'none', lineHeight:1.6 }}
                    onFocus={e => e.target.style.borderColor = 'var(--blue)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  />
                  {aiBusy && (
                    <div className="ai-body-overlay">
                      <span className="spinner spinner-dark" />
                      <span>✨ {AI_BUSY_LABEL[aiBusy] ?? 'Working…'}</span>
                    </div>
                  )}
                </div>
              </div>

              {composeError && <div className="alert alert-error show">{composeError}</div>}
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop: 4 }}>
                <button className="btn btn-secondary" onClick={() => setComposeOpen(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={sendComposed} disabled={composeSending}>
                  {composeSending ? <><span className="spinner" /> Sending…</> : '📤 Send Email'}
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
                    editAcctId === a.id ? (
                      <div key={a.id} className="add-form">
                        <div className="field"><label>Account Name</label><input type="text" placeholder="e.g. Business" value={editAcct.label} onChange={e => setEditAcct(v => ({...v, label:e.target.value}))} /></div>
                        <div className="sec">IMAP — Incoming Mail</div>
                        <div className="row-2" style={{ gridTemplateColumns:'1fr 85px' }}>
                          <div className="field"><label>Mail Server</label><input type="text" placeholder="mail.example.com" value={editAcct.imapHost} onChange={e => setEditAcct(v => ({...v, imapHost:e.target.value}))} /></div>
                          <div className="field"><label>Port</label><input type="number" value={editAcct.imapPort} onChange={e => setEditAcct(v => ({...v, imapPort:e.target.value}))} /></div>
                        </div>
                        <div className="field"><label>Email</label><input type="email" placeholder="you@example.com" value={editAcct.imapUser} onChange={e => setEditAcct(v => ({...v, imapUser:e.target.value}))} /></div>
                        <div className="field"><label>Password <span className="hint">leave blank to keep current</span></label><input type="password" placeholder="••••••••" value={editAcct.imapPass} onChange={e => setEditAcct(v => ({...v, imapPass:e.target.value}))} /></div>
                        <div className="sec">SMTP — Outgoing Mail</div>
                        <div className="row-2" style={{ gridTemplateColumns:'1fr 85px' }}>
                          <div className="field"><label>SMTP Host</label><input type="text" placeholder="mail.example.com" value={editAcct.smtpHost} onChange={e => setEditAcct(v => ({...v, smtpHost:e.target.value}))} /></div>
                          <div className="field"><label>Port</label><input type="number" value={editAcct.smtpPort} onChange={e => setEditAcct(v => ({...v, smtpPort:e.target.value}))} /></div>
                        </div>
                        {acctErr && <div className="alert alert-error show">{acctErr}</div>}
                        <div className="add-form-actions">
                          <button className="btn btn-secondary btn-sm" onClick={cancelEditAccount}>Cancel</button>
                          <button className="btn btn-primary btn-sm" onClick={() => submitEditAccount(a.id)} disabled={savingEditAcct}>
                            {savingEditAcct ? <><span className="spinner" /> Saving…</> : 'Save Changes'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div key={a.id} className="acct-card">
                        <span className="acct-dot" style={{ background: acctColor(i) }} />
                        <div className="acct-info">
                          <div className="acct-label">{a.label}</div>
                          <div className="acct-sub">{a.imap_user}</div>
                        </div>
                        <button className="acct-edit" onClick={() => startEditAccount(a)}>Edit</button>
                        <button className="acct-del" onClick={() => deleteAccount(a.id, a.label)}>Delete</button>
                      </div>
                    )
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
                      <div className="field">
                        <label>Model <span className="hint">optional</span></label>
                        <ModelPicker provider={newLlm.provider} value={newLlm.model} onChange={v => setNewLlm(l => ({...l, model:v}))} />
                        <input type="text" placeholder={modelPh[newLlm.provider]} value={newLlm.model} onChange={e => setNewLlm(l => ({...l, model:e.target.value}))} style={{ marginTop: 8 }} />
                      </div>
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
