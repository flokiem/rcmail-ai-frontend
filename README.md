# Floki Mail — Frontend

AI-powered email client. Users connect IMAP/SMTP accounts and chat with an AI assistant to read, search, send, and manage their email. The AI can also assist with composing emails (write, proofread, expand, shorten).

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 18 (ES modules) |
| Build Tool | Vite 5 |
| Routing | React Router v6 |
| Styling | Custom CSS — no framework (`src/index.css`) |
| Auth | JWT stored in `localStorage` |
| Streaming | Server-Sent Events (SSE) |
| Voice Input | Browser-native Web Speech API (`SpeechRecognition`) — no library |
| Backend Communication | REST API + SSE |
| Deploy | Dockerfile → nginx, hosted on Coolify |

---

## External Libraries

### Production Dependencies

| Library | Version | Purpose |
|---|---|---|
| `react` | ^18.3.1 | Core UI library |
| `react-dom` | ^18.3.1 | React DOM renderer |
| `react-router-dom` | ^6.23.1 | Client-side routing (SPA navigation) |

### Dev Dependencies

| Library | Version | Purpose |
|---|---|---|
| `vite` | ^5.4.0 | Build tool and dev server |
| `@vitejs/plugin-react` | ^4.3.1 | Vite plugin for React (Fast Refresh, JSX transform) |

> No external UI component libraries, no CSS frameworks, no state management libraries — kept intentionally minimal.

---

## Pages

| Route | File | Purpose |
|---|---|---|
| `/` | `src/pages/Login.jsx` | Login / register |
| `/setup` | `src/pages/Setup.jsx` | First-run: add mail account + AI provider |
| `/chat` | `src/pages/Chat.jsx` | Main app — email chat + compose |
| `/reset-password` | `src/pages/ResetPassword.jsx` | Password reset |

---

## Key Files

| File | Purpose |
|---|---|
| `src/lib/api.js` | All API calls, token helpers, SSE streaming (`streamChat`), AI compose (`aiCompose`) |
| `src/lib/ModelPicker.jsx` | Reusable model selector component |
| `src/pages/Chat.jsx` | Entire main UI — accounts, threads, compose modal, settings modal, voice input |
| `src/lib/InboxPanel.jsx` | Inbox panel — folder sidebar + email list, reports opened email to Chat via `onActiveEmailChange` |
| `src/index.css` | All custom styles |

---

## AI Providers Supported

All user-configured — users supply their own API keys, stored in the backend.

| Provider | Notes |
|---|---|
| **Claude** (Anthropic) | Default recommended |
| **OpenAI** | GPT-4o |
| **Groq** | LLaMA models |
| **Perplexity** | |

Threads are per-account + per-LLM-provider and support per-thread model overrides.

---

## Email AI Tools

These tools are shown in the chat UI while the AI is working on a task:

| Tool | Description |
|---|---|
| `list_folders` | List mailbox folders |
| `get_unread_count` | Get unread email count |
| `list_emails` | List emails in a folder |
| `read_email` | Read a specific email |
| `search_emails` | Search emails |
| `send_email` | Send an email |
| `move_email` | Move email to a folder |
| `delete_email` | Delete an email |
| `mark_email` | Mark email as read/unread |
| `list_contacts` | List contacts |
| `search_contacts` | Search contacts |
| `get_identities` | Get sending identities |

---

## Features

### Compose Modal (AI-assisted send)
When the AI wants to send an email, the `send_email` tool emits a `compose_draft` SSE event (backend `lib/llm.js` + `index.js`). The frontend opens the **Compose modal** pre-filled with the draft (`openComposeWithDraft` in `Chat.jsx`) so the user can refine it with compose AI tools and send via `POST /api/accounts/:id/send`. There is no separate "review before sending" confirm dialog.

### Unified Inbox — "All Inboxes" Chat
A thread has a `scope` column — `'account'` (default, bound to one `account_id`) or `'all'` (spans every connected account, `account_id` NULL).

- Pick **All Inboxes** in the sidebar "Default Account" select (shown only when >1 account connected) to start a unified thread.
- The header account chip can switch a thread between a single account and All Inboxes (`switchThreadAccount('all')` → `PUT { scope:'all' }`).
- `POST /api/threads` accepts `{ scope:'all', llmId }` (no accountId needed).
- In an `all` thread, the backend loads all user accounts into `mailCtx = { accounts:[{id,label,email,creds}], multi:true }`.
- In multi mode, every tool gains an optional `account` param (label or email):
  - **Listing/searching tools** (`list_emails`, `search_emails`, `get_unread_count`, `list_folders`, contacts/identities) fan out across all accounts via `Promise.allSettled` when `account` is omitted and return `{ multiAccount:true, accounts:[{account,email,result|error}] }`.
  - **Per-email actions** (`read_email`, `move_email`, `delete_email`, `mark_email`, `send_email`) **require** `account` because a UID is only unique within its own mailbox.
- Single-account threads pass `multi:false` and behave exactly as before.

### Email-Aware Chat (Context Bar)
When a user opens an email in the Inbox panel (`InboxPanel.jsx`), it reports the open email up to `Chat.jsx` via the `onActiveEmailChange` prop:
```js
{ type:'email', accountId, account, uid, folder, from, subject, date }
```
`Chat.jsx` stores this as `activeEmail` and:
- Auto-switches the chat thread/selected account to that email's mailbox so the two views stay in sync.
- Shows a blue **context bar** above the composer ("Talking about this email" + subject/sender/account) with quick-action chips: **Summarize**, **Draft a reply**, **Who sent this?** — and an × to detach.
- Passes the email identity as `context` on the chat POST.

The backend (`/api/threads/:id/chat`) accepts `context` and prepends a context preamble (uid/folder/from/subject) to the message the AI sees — the stored user message stays clean — so the AI can `read_email`/`move_email`/`mark_email` on "this email" directly. `streamChat` in `api.js` takes an optional `context` option.

### Inbox Folder Sidebar
The Inbox panel (`src/lib/InboxPanel.jsx`) shows a **Gmail-style folder rail** on its left side:
- Folders are fetched from `GET /api/accounts/:id/folders` (backend `imap.listFolders` via the `listFolders` helper in `api.js`).
- Special-use folders (Inbox, Starred, Sent, Drafts, All Mail/Archive, Spam, Trash) get friendly icons + labels and sort first; custom folders/labels follow alphabetically. Detection prefers the IMAP `specialUse` attribute, falling back to mailbox `flags`. `\Noselect` folders (e.g. Gmail's `[Gmail]` parent) are hidden.
- Selecting a folder reloads the message list for that folder (`GET /api/accounts/:id/emails?folder=…`, cache-backed) and the header shows the folder's icon + name. The list, per-message read cache, and the chat email-context all key off the selected folder.
- The folder list reloads when the account changes (account switch resets to Inbox). On mobile the rail narrows so it fits the full-screen dock.

### Voice Input
The chat prompt box has a mic button (`btn-mic` in `Chat.jsx`) using the **browser-native Web Speech API** (`SpeechRecognition`):
- Dictates speech into the prompt textarea (append mode).
- No backend or external library involved.
- Button only renders when the browser supports it (Chrome / Edge / Safari).
- Pulses red while listening.

---

## Environment Variables

```
VITE_API_URL=https://your-backend.example.com
```

---

## Dev Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build → dist/
npm run preview  # Preview the build
```

---

## Backend

Backend code lives at `/var/www/html/rcmail-ai/`. The frontend communicates via:
- **REST API** — account management, thread CRUD, email send
- **SSE streaming** — AI chat responses and tool call events

---

## Development Rules

- All UI must be **mobile responsive**.
- Backend changes must account for a planned **mobile app** in the future.
- Always update `CLAUDE.local.md` when a new feature is added or a new library is used.
- Always update `README.md` with the tech stack, all external libraries and versions, and any new feature.

---

## Notes

- `CLAUDE.local.md` is gitignored — do not commit it.
- Threads are per-account + per-LLM-provider and can have per-thread model overrides.
