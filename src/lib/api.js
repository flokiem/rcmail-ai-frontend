const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export const getToken = () => localStorage.getItem('token');
export const setToken = (t) => localStorage.setItem('token', t);
export const clearToken = () => localStorage.removeItem('token');

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  };
}

async function req(path, { method = 'GET', body } = {}) {
  return fetch(BASE + path, {
    method,
    headers: authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export const api = {
  get:  (path)        => req(path),
  post: (path, body)  => req(path, { method: 'POST', body }),
  put:  (path, body)  => req(path, { method: 'PUT',  body }),
  del:  (path)        => req(path, { method: 'DELETE' }),
};

// Inbox: list emails for an account since a cutoff date (defaults to June 1, 2026).
export const INBOX_SINCE = '2026-06-01';

export async function listInboxEmails(accountId, { since = INBOX_SINCE, folder = 'INBOX', limit = 50 } = {}) {
  const qs = new URLSearchParams({ since, folder, limit: String(limit) });
  const r = await req(`/api/accounts/${accountId}/emails?${qs}`);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? 'Failed to load emails.');
  return d.messages ?? [];
}

// List an account's mail folders (Inbox, Sent, Drafts, Trash, custom labels…).
export async function listFolders(accountId) {
  const r = await req(`/api/accounts/${accountId}/folders`);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? 'Failed to load folders.');
  return d.folders ?? [];
}

export async function readInboxEmail(accountId, uid, folder = 'INBOX') {
  const qs = new URLSearchParams({ folder });
  const r = await req(`/api/accounts/${accountId}/emails/${uid}?${qs}`);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? 'Failed to open email.');
  return d;
}

// AI composer assist: action = 'write' | 'proofread' | 'expand' | 'shorten'
export async function aiCompose({ llmId, action, text, instruction, tone, model }) {
  const r = await req('/api/ai/compose', { method: 'POST', body: { llmId, action, text, instruction, tone, model } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? 'AI request failed.');
  return d.text ?? '';
}

export function streamChat(threadId, message, { onTool, onDone, onError, onComposeDraft, context } = {}) {
  const ctrl = new AbortController();

  fetch(`${BASE}/api/threads/${threadId}/chat`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(context ? { message, context } : { message }),
    signal: ctrl.signal,
  }).then(async (res) => {
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      onError(d.error ?? 'Something went wrong.');
      return;
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split('\n\n');
      buffer = chunks.pop();

      for (const chunk of chunks) {
        if (!chunk.trim()) continue;
        let evtType = 'message', dataStr = '';
        for (const line of chunk.split('\n')) {
          if (line.startsWith('event: '))     evtType = line.slice(7).trim();
          else if (line.startsWith('data: ')) dataStr = line.slice(6);
        }
        if (!dataStr) continue;
        let data;
        try { data = JSON.parse(dataStr); } catch { continue; }

        if (evtType === 'tool')          onTool(data.name);
        else if (evtType === 'compose_draft') onComposeDraft?.(data);
        else if (evtType === 'done')         { onDone(data); return; }
        else if (evtType === 'error')        { onError(data.error ?? 'AI error.'); return; }
      }
    }
  }).catch((err) => {
    if (err.name !== 'AbortError') onError('Network error. Please try again.');
  });

  return () => ctrl.abort();
}
