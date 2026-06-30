import React, { useState } from 'react';
import Sidebar from './Sidebar.jsx';
import InboxView from '../inbox/InboxView.jsx';
import AutomationsView from '../automations/AutomationsView.jsx';
import SettingsView from '../settings/SettingsView.jsx';
import MailSettingsModal from '../settings/MailSettingsModal.jsx';
import { useTheme } from '../../lib/useTheme.js';
import { useBrand } from '../../lib/useBrand.js';

// The themed application frame: sidebar + active view. Owns the cross-cutting
// shell state (current view, selected box, theme, brand name, mobile drawer).
export default function AppShell({ userEmail = '', accounts = [], llmProviders = [], reloadAccounts, reloadProviders, onLogout }) {
  const theme = useTheme();
  const [view, setView]   = useState('inbox');         // inbox | automations | settings
  const [box, setBox]     = useState('all');           // 'all' | String(accountId)
  const [folder, setFolder] = useState('INBOX');
  const [expandedBox, setExpandedBox] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mailSettings, setMailSettings] = useState(null); // null | 'accounts' | 'ai'
  const { brand, setField: setBrandField } = useBrand();

  // Default the selected box to the single account when only one exists.
  const effectiveBox = accounts.length <= 1 && accounts[0] ? String(accounts[0].id) : box;

  function navigate(v) { setView(v); setDrawerOpen(false); }
  function selectBox(k) {
    setBox(k); setView('inbox'); setFolder('INBOX');
    setExpandedBox(k === 'all' ? null : (prev) => (prev === k ? null : k));
    setDrawerOpen(false);
  }
  function selectFolder(accountKey, path) {
    setBox(accountKey); setFolder(path); setExpandedBox(accountKey); setView('inbox'); setDrawerOpen(false);
  }

  const themeProps = {
    theme: theme.theme, accent: theme.accent, accent2: theme.accent2,
    setTheme: theme.setTheme, setAccent: theme.setAccent, setAccent2: theme.setAccent2,
  };

  return (
    <div
      className="floki-app"
      data-theme={theme.theme}
      style={theme.customStyle}
    >
      {/* Mobile drawer backdrop */}
      <div className={`fk-drawer-backdrop ${drawerOpen ? 'show' : ''}`} onClick={() => setDrawerOpen(false)} />

      <div className={`fk-sidebar-wrap ${drawerOpen ? 'open' : ''}`}>
        <Sidebar
          brandName={brand.workspaceName}
          accounts={accounts}
          selectedBox={effectiveBox}
          onSelectBox={selectBox}
          expandedBox={expandedBox}
          folder={folder}
          onSelectFolder={selectFolder}
          view={view}
          onNavigate={navigate}
          userEmail={userEmail}
          onOpenMailSettings={() => setMailSettings('accounts')}
        />
      </div>

      <div className="fk-main">
        {/* Mobile top bar */}
        <div className="fk-mobile-bar">
          <button className="fk-mobile-menu" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
            <svg viewBox="0 0 24 24"><path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" /></svg>
          </button>
          <span className="fk-mobile-title">{brand.workspaceName}</span>
          <button className="fk-mobile-logout" onClick={onLogout}>Logout</button>
        </div>

        {view === 'inbox' && <InboxView accounts={accounts} selectedBox={effectiveBox} folder={folder} llmProviders={llmProviders} signature={brand.signature} agentName={brand.agentName} />}
        {view === 'automations' && <AutomationsView />}
        {view === 'settings' && (
          <SettingsView
            themeProps={themeProps}
            llmProviders={llmProviders}
            brand={brand}
            setBrand={setBrandField}
            onManageModels={() => setMailSettings('ai')}
            onManageAccounts={() => setMailSettings('accounts')}
          />
        )}
      </div>

      <MailSettingsModal
        open={!!mailSettings}
        tab={mailSettings || 'accounts'}
        onTab={setMailSettings}
        onClose={() => setMailSettings(null)}
        accounts={accounts}
        llmProviders={llmProviders}
        reloadAccounts={reloadAccounts}
        reloadProviders={reloadProviders}
      />
    </div>
  );
}
