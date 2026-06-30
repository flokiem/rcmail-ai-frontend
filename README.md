# Floki Mail — Frontend

AI-powered email client. Users connect IMAP/SMTP accounts and chat with an AI
assistant ("Floki") to read, search, send, and manage their email, and get help
composing messages (write / proofread / expand / shorten / tone).

This is the **frontend** (React + Vite). The backend lives in a sibling repo at
`../rcmail-ai` (Node + Express + MySQL).

---

## Tech stack

| Area | Choice | Version |
|---|---|---|
| UI library | **React** | ^18.3.1 |
| React DOM | **react-dom** | ^18.3.1 |
| Routing | **react-router-dom** | ^6.23.1 |
| Build tool / dev server | **Vite** | ^5.4.0 |
| React plugin for Vite | **@vitejs/plugin-react** | ^4.3.1 |
| Language | JavaScript (ES modules, JSX) | — |
| Styling | Hand-written CSS with a CSS-variable theme system (no CSS framework) | — |
| Fonts | Hanken Grotesk + Geist Mono (Google Fonts, loaded in `index.html`) | — |
| Auth | JWT in `localStorage` | — |
| Backend transport | REST (`fetch`) + SSE streaming for chat | — |
| Voice input | Browser-native Web Speech API (`SpeechRecognition`) | — |
| Deploy | Dockerfile → nginx, hosted on Coolify | — |

No state-management or UI-component libraries are used — state is local React
state/hooks, and all components are custom.

---

## Getting started

```bash
npm install
npm run dev      # start the Vite dev server (default http://localhost:5173)
npm run build    # production build → dist/
npm run preview  # preview the production build
```

### Environment

Create a `.env` (or `.env.local`):

```
VITE_API_URL=https://your-backend.example.com
```

`VITE_API_URL` is the base URL of the `rcmail-ai` backend. When empty, requests
are made relative to the current origin.

---

## App structure

```
index.html                     # fonts + root mount
src/
  main.jsx                     # mounts <App>, imports the 3 stylesheets
  App.jsx                      # routes
  pages/
    Login.jsx                  # login / register / forgot-password
    Setup.jsx                  # first-run wizard (mail account + AI provider)
    ResetPassword.jsx          # reset via emailed token
    Chat.jsx                   # authed container: loads data → <AppShell>
  features/
    auth/AuthShell.jsx         # themed dark backdrop + card for auth pages
    layout/
      AppShell.jsx             # themed frame, view router, shell state
      Sidebar.jsx              # brand, nav, accounts ("boxes"), footer
      BoxFolders.jsx           # per-account IMAP folder rail
    inbox/
      InboxView.jsx            # center column + agent panel orchestration
      MailList.jsx, MailRow.jsx
      AllInboxesList.jsx       # merged "All boxes" list (client fan-out)
      ReadingPane.jsx          # single email (auto-sizing HTML iframe)
      folderMeta.js            # special-use folder labels/icons/sorting
    chat/
      AgentPanel.jsx           # Floki chat (threads, send via SSE)
      AgentRail.jsx            # collapsed 60px rail
      ChatHistory.jsx          # conversation switcher
      ChatMessages.jsx         # bubbles, welcome state, tool indicator
      ChatComposer.jsx         # input + mic + send
      chatFormat.js            # tool labels + markdown-ish rendering
    compose/Composer.jsx       # email composer + AI toolbar
    settings/
      SettingsView.jsx         # brand (local), theme picker, models panel
      ThemePicker.jsx
      MailSettingsModal.jsx    # Mail Accounts + AI Providers CRUD
    automations/AutomationsView.jsx   # dummy UI, flagged "Coming soon"
    common/ComingSoon.jsx      # reusable coming-soon flag/wrapper
  lib/
    api.js                     # all API calls, token helpers, streamChat, aiCompose
    theme.js, useTheme.js      # theme tokens + localStorage persistence
    accountColors.js           # stable per-account colors
    mailCache.js, mailFormat.js
    llmMeta.js                 # provider labels/glyphs/choices
    useSpeech.js               # Web Speech API hook
    ModelPicker.jsx            # reusable model selector
  styles/
    tokens.css                 # theme CSS variables (6 themes), scoped to .floki-app
    components.css             # all app component styles
    auth.css                   # auth page styles
```

### Theme system

Six built-in themes (Parchment, Arctic, Graphite, Evergreen, Plum, Rose) plus a
**Custom** theme (pick primary/secondary colors). Themes are CSS variables
**scoped to `.floki-app`** (so they never leak into other pages), applied via a
`data-theme` attribute; the custom theme computes overrides inline. The choice
is **persisted to `localStorage`** (`floki.theme`, `floki.customAccent`,
`floki.customAccent2`). Change it under **Settings → Color Scheme**.

---

## Pages / routes

| Route | File | Purpose |
|---|---|---|
| `/` | `pages/Login.jsx` | Login / register / forgot password |
| `/setup` | `pages/Setup.jsx` | First-run: add mail account + AI provider |
| `/chat` | `pages/Chat.jsx` | Main app (inbox + chat + compose + settings) |
| `/reset-password` | `pages/ResetPassword.jsx` | Password reset via token |

---

## Features

- **Inbox** per account, with an IMAP folder rail, All/Unread/Flagged filters,
  and a reading pane that renders the original email HTML (auto-sized, sandboxed
  iframe).
- **All boxes** — a unified inbox merged client-side across every connected
  account (no aggregate backend endpoint exists, so the per-account lists are
  fanned out and merged).
- **Floki chat** — per-account or all-accounts (`scope:'all'`) AI threads over
  SSE, with tool-progress indicators, conversation history, voice dictation, and
  a collapsible panel (full-screen overlay on mobile via a floating button).
- **Compose** — floating/expandable composer with From picker, Cc, quoted
  replies/forwards, and AI assist (**Write / Proofread / Expand / Shorten** +
  **Tone**). Also opens automatically when Floki drafts an email in chat.
- **Settings** — workspace/brand (local), 6 themes + custom colors, and a models
  panel. **Mail Accounts** and **AI Providers** are added/edited/deleted in the
  Settings modal.

### Not yet backed (shown but flagged "Coming soon")

These have UI (with placeholder/dummy data) but no backend yet:
**Automations** (whole section), composer **Translate / Schedule-send / Save
draft**, model **enable/default** toggles, behavior toggles, and brand/workspace
settings (currently saved to `localStorage` only).

---

## Backend

The backend (`../rcmail-ai`) is Node 20 + Express 4 + MySQL. Key endpoints this
frontend uses: auth (`/api/auth/*`), accounts (`/api/accounts*`), providers
(`/api/llm-providers*`), threads + SSE chat (`/api/threads*`), AI compose
(`/api/ai/compose`), inbox list/read/folders (`/api/accounts/:id/emails*`,
`/api/accounts/:id/folders`), and send (`/api/accounts/:id/send`).
