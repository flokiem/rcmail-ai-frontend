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

export async function readInboxEmail(accountId, uid, folder = 'INBOX') {
  const qs = new URLSearchParams({ folder });
  const r = await req(`/api/accounts/${accountId}/emails/${uid}?${qs}`);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? 'Failed to open email.');
  return d;
}

// Download one email attachment by its index (see readEmail's attachments[].index).
// Auth is a Bearer header, so we can't just navigate to the URL — fetch the bytes
// as a blob and trigger a client-side save.
export async function downloadAttachment(accountId, uid, index, { folder = 'INBOX', filename = 'attachment' } = {}) {
  const qs = new URLSearchParams({ folder });
  const r = await fetch(`${BASE}/api/accounts/${accountId}/emails/${uid}/attachments/${index}?${qs}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.error ?? 'Failed to download attachment.');
  }
  const blob = await r.blob();
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Live IMAP folder list for an account: [{ path, name, flags[], specialUse, unread, total }]
// (?counts=1 adds per-folder unread/total for the rail badges).
export async function listFolders(accountId) {
  const r = await req(`/api/accounts/${accountId}/folders?counts=1`);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? 'Failed to load folders.');
  return d.folders ?? [];
}

// Toggle a flag (star = 'flagged', or 'seen') on a single email.
export async function flagEmail(accountId, uid, { folder = 'INBOX', flag = 'flagged', value = true } = {}) {
  const r = await req(`/api/accounts/${accountId}/emails/${uid}/flag`, { method: 'PUT', body: { folder, flag, value } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? 'Failed to update the email.');
  return d;
}

// Move a single email to Trash (or delete if the account has no Trash folder).
export async function trashEmail(accountId, uid, { folder = 'INBOX' } = {}) {
  const qs = new URLSearchParams({ folder });
  const r = await req(`/api/accounts/${accountId}/emails/${uid}?${qs}`, { method: 'DELETE' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? 'Failed to trash the email.');
  return d;
}

// Send an email from an account. With files it uploads as multipart/form-data
// (browser sets the multipart boundary, so we must NOT set Content-Type); with
// no files it posts JSON (unchanged path). fields = { to, cc, subject, body, … }.
export async function sendMail(accountId, fields, files = []) {
  let r;
  if (files.length) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined && v !== null && v !== '') fd.append(k, v);
    }
    for (const f of files) fd.append('attachments', f, f.name);
    r = await fetch(`${BASE}/api/accounts/${accountId}/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: fd,
    });
  } else {
    r = await req(`/api/accounts/${accountId}/send`, { method: 'POST', body: fields });
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? 'Failed to send.');
  return d;
}

// AI composer assist: action = 'write' | 'proofread' | 'expand' | 'shorten'
export async function aiCompose({ llmId, action, text, instruction, tone, model }) {
  const r = await req('/api/ai/compose', { method: 'POST', body: { llmId, action, text, instruction, tone, model } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? 'AI request failed.');
  return d.text ?? '';
}

export function streamChat(threadId, message, { onTool, onDone, onError, onComposeDraft, context, forceDraft } = {}) {
  const ctrl = new AbortController();

  fetch(`${BASE}/api/threads/${threadId}/chat`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ message, ...(context ? { context } : {}), ...(forceDraft ? { forceDraft: true } : {}) }),
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

        if (evtType === 'tool')               onTool?.(data.name);
        else if (evtType === 'compose_draft') onComposeDraft?.(data);
        else if (evtType === 'done')          { onDone?.(data); return; }
        else if (evtType === 'error')         { onError?.(data.error ?? 'AI error.'); return; }
      }
    }
  }).catch((err) => {
    if (err.name !== 'AbortError') onError('Network error. Please try again.');
  });

  return () => ctrl.abort();
}
