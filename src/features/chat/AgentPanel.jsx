import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api, streamChat } from '../../lib/api.js';
import { colorForAccount } from '../../lib/accountColors.js';
import { senderName } from '../../lib/mailFormat.js';
import { toolLabel } from './chatFormat.js';
import ChatMessages from './ChatMessages.jsx';
import ChatComposer from './ChatComposer.jsx';
import ChatHistory from './ChatHistory.jsx';
import ModelSwitch from './ModelSwitch.jsx';
import AgentRail from './AgentRail.jsx';

// The Floki agent panel: thread list (scoped to the selected box), the active
// conversation, and the composer. Threads bind to one account, or scope:'all'
// for the unified "All boxes" chat. New chats use the default AI provider
// (provider/model switching isn't surfaced in the v5 chat design).
export default function AgentPanel({ accounts = [], llmProviders = [], selectedBox = 'all', agentName = 'Floki', activeEmail = null, ask = null, collapsed = false, onToggleCollapse, onComposeDraft }) {
  const [threads, setThreads]   = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [sending, setSending]   = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingTool, setTypingTool] = useState('');
  const [chatsOpen, setChatsOpen]   = useState(false);
  const [contextOn, setContextOn]   = useState(true); // attach the open email as context
  const [pendingLlmId, setPendingLlmId] = useState(null); // provider/model chosen for the next new chat
  const [pendingModel, setPendingModel] = useState(null);
  const cancelRef = useRef(null);
  const lastAskRef = useRef(null);

  // Re-attach context whenever a different email is opened.
  useEffect(() => { setContextOn(true); }, [activeEmail?.accountId, activeEmail?.uid]);

  // A prompt handed up from the reading pane (e.g. "Reply with AI") — send it
  // once per request (the open email rides along as context).
  useEffect(() => {
    if (ask?.nonce && ask.nonce !== lastAskRef.current) {
      lastAskRef.current = ask.nonce;
      send(ask.text, { forceDraft: ask.forceDraft });
    }
  }, [ask?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const isAll = selectedBox === 'all';
  const defaultLlmId = llmProviders[0]?.id;
  const providerOf = (id) => llmProviders.find((l) => l.id === id)?.provider;
  const account = accounts.find((a) => String(a.id) === String(selectedBox));
  const dotColor = isAll ? 'var(--accent2)' : colorForAccount(accounts, selectedBox);
  const scopeName = isAll ? 'All boxes' : (account?.label || 'Mailbox');
  const scopeLabel = `SCOPED TO ${(isAll ? 'all boxes' : account?.label || 'mailbox').toUpperCase()}`;

  // Provider/model in effect: an existing thread's, else the pending choice for
  // the next new chat, else the default provider.
  const curThread = threads.find((t) => t.id === currentId);
  const activeLlmId = curThread ? curThread.llm_id : (pendingLlmId ?? defaultLlmId);
  const activeModel = curThread ? curThread.model_override : pendingModel;

  const loadThreads = useCallback(async () => {
    const r = await api.get('/api/threads');
    if (r.ok) setThreads(await r.json());
  }, []);

  async function loadMessages(id) {
    const r = await api.get(`/api/threads/${id}/messages`);
    if (r.ok) { const m = await r.json(); setMessages(m.map((x) => ({ role: x.role, content: x.content }))); }
  }

  useEffect(() => { loadThreads(); }, [loadThreads]);

  const visible = useMemo(
    () => threads.filter((t) => isAll ? t.scope === 'all' : String(t.account_id) === String(selectedBox)),
    [threads, selectedBox, isAll],
  );

  // Keep an active thread that belongs to the current box.
  useEffect(() => {
    if (visible.some((t) => t.id === currentId)) return;
    const next = visible[0]?.id ?? null;
    setCurrentId(next);
    setChatsOpen(false);
    if (next) loadMessages(next); else setMessages([]);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  function openThread(id) { setCurrentId(id); setChatsOpen(false); loadMessages(id); }

  function newChat() { setCurrentId(null); setMessages([]); setChatsOpen(false); }

  async function deleteThread(id) {
    await api.del(`/api/threads/${id}`);
    setThreads((ts) => ts.filter((t) => t.id !== id));
    if (id === currentId) { setCurrentId(null); setMessages([]); }
  }

  async function changeProvider(llmId) {
    if (curThread) {
      await api.put(`/api/threads/${curThread.id}`, { llmId, model: '' });
      setThreads((ts) => ts.map((x) => (x.id === curThread.id ? { ...x, llm_id: llmId, llm_provider: providerOf(llmId), model_override: null } : x)));
    } else { setPendingLlmId(llmId); setPendingModel(null); }
  }
  async function changeModel(model) {
    if (curThread) {
      await api.put(`/api/threads/${curThread.id}`, { model });
      setThreads((ts) => ts.map((x) => (x.id === curThread.id ? { ...x, model_override: model || null } : x)));
    } else { setPendingModel(model); }
  }

  function stop() { cancelRef.current?.(); setIsTyping(false); setSending(false); }

  async function send(text, opts = {}) {
    const t = (text ?? input).trim();
    if (!t || sending) return;
    if (!activeLlmId) { setMessages((m) => [...m, { role: 'assistant', content: '⚠️ Add an AI provider in Settings first.' }]); return; }

    let id = currentId;
    if (!id) {
      const body = isAll ? { scope: 'all', llmId: activeLlmId } : { accountId: Number(selectedBox), llmId: activeLlmId };
      const r = await api.post('/api/threads', body);
      if (!r.ok) { setMessages((m) => [...m, { role: 'assistant', content: '⚠️ Could not start a chat.' }]); return; }
      const nt = await r.json();
      id = nt.id;
      if (pendingModel) { await api.put(`/api/threads/${id}`, { model: pendingModel }).catch(() => {}); }
      const optimistic = {
        id, title: 'New Chat', updated_at: new Date().toISOString(),
        account_id: isAll ? null : Number(selectedBox), scope: isAll ? 'all' : 'account',
        llm_id: activeLlmId, llm_provider: providerOf(activeLlmId), model_override: pendingModel || null,
      };
      setThreads((ts) => [optimistic, ...ts]);
      setCurrentId(id);
    }

    setInput('');
    setMessages((m) => [...m, { role: 'user', content: t }]);
    setIsTyping(true); setTypingTool(''); setSending(true);

    const ctx = (activeEmail && contextOn) ? activeEmail : undefined;
    cancelRef.current = streamChat(id, t, {
      context: ctx,
      forceDraft: !!opts.forceDraft && !!ctx, // guarantee the composer opens for "Reply with AI" / reply chip
      onTool: (name) => setTypingTool(toolLabel(name)),
      onComposeDraft: (d) => onComposeDraft?.(d),
      onDone: ({ reply, title }) => {
        setIsTyping(false); setSending(false);
        setMessages((m) => [...m, { role: 'assistant', content: reply }]);
        if (title) setThreads((ts) => ts.map((x) => (x.id === id ? { ...x, title } : x)));
      },
      onError: (err) => {
        setIsTyping(false); setSending(false);
        setMessages((m) => [...m, { role: 'assistant', content: '⚠️ ' + err }]);
      },
    });
  }

  if (collapsed) {
    return (
      <AgentRail
        dotColor={dotColor}
        onExpand={onToggleCollapse}
        onNewChat={() => { onToggleCollapse?.(); newChat(); }}
        onHistory={() => { onToggleCollapse?.(); setChatsOpen(true); }}
      />
    );
  }

  return (
    <section className="fk-chat-panel">
      <header className="fk-chat-head">
        <div className="fk-chat-head-mark"><img src="/flokilogo.PNG" alt="" /></div>
        <div className="fk-chat-head-text">
          <div className="fk-chat-head-name">{agentName} <span className="fk-chat-head-status"><span className="fk-chat-status-dot" />ready</span></div>
          <div className="fk-chat-head-sub">do this now · always your call</div>
        </div>
        <span className="fk-chat-head-chip"><span className="fk-chat-chip-dot" style={{ background: dotColor }} />{scopeName}</span>
        <button className="fk-chat-collapse" title="Collapse Floki" onClick={onToggleCollapse}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" /><polyline points="14 9 17 12 14 15" />
          </svg>
        </button>
      </header>

      <ChatHistory
        threads={visible}
        currentThreadId={currentId}
        open={chatsOpen}
        onToggle={() => setChatsOpen((o) => !o)}
        onNew={newChat}
        onOpen={openThread}
        onDelete={deleteThread}
        scopeLabel={`in ${scopeName}`}
      />

      <ChatMessages messages={messages} isTyping={isTyping} typingTool={typingTool} onPick={setInput} />

      {activeEmail && contextOn && (
        <div className="fk-chat-context">
          <div className="fk-chat-context-bar">
            <span className="fk-chat-context-ico">✉</span>
            <div className="fk-chat-context-text">
              <div className="fk-chat-context-title">Talking about this email</div>
              <div className="fk-chat-context-sub">{activeEmail.subject || '(no subject)'} · {senderName(activeEmail.from)}</div>
            </div>
            <button className="fk-chat-context-x" title="Detach" onClick={() => setContextOn(false)}>×</button>
          </div>
          <div className="fk-chat-context-chips">
            {[['Summarize', 'Summarize this email.', false], ['Draft a reply', 'Draft a reply to this email.', true], ['Who sent this?', 'Who sent this email and what do they want?', false]].map(([label, q, force]) => (
              <button key={label} className="fk-chat-context-chip" onClick={() => send(q, { forceDraft: force })} disabled={sending}>{label}</button>
            ))}
          </div>
        </div>
      )}

      <ChatComposer
        value={input}
        onChange={setInput}
        onSend={() => send()}
        onStop={stop}
        sending={sending}
        scopeLabel={scopeLabel}
        modelSwitch={
          <ModelSwitch
            llmProviders={llmProviders}
            activeLlmId={activeLlmId}
            activeModel={activeModel}
            onPickProvider={changeProvider}
            onPickModel={changeModel}
          />
        }
      />
    </section>
  );
}
