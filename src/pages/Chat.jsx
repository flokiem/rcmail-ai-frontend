import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken, getToken } from '../lib/api.js';
import AppShell from '../features/layout/AppShell.jsx';

// Thin container: guards auth, loads the account/provider/thread data once, and
// hands it to the themed <AppShell>. All UI lives in feature components.
export default function Chat() {
  const navigate = useNavigate();
  const [loading, setLoading]           = useState(true);
  const [userEmail, setUserEmail]       = useState('');
  const [accounts, setAccounts]         = useState([]);
  const [llmProviders, setLlmProviders] = useState([]);

  const reloadAccounts  = async () => setAccounts(await api.get('/api/accounts').then((r) => r.json()));
  const reloadProviders = async () => setLlmProviders(await api.get('/api/llm-providers').then((r) => r.json()));

  useEffect(() => {
    if (!getToken()) { navigate('/', { replace: true }); return; }
    (async () => {
      try {
        const meRes = await api.get('/api/auth/me');
        if (!meRes.ok) { navigate('/', { replace: true }); return; }
        const me = await meRes.json();
        if (!me.hasMail || !me.hasLlm) { navigate('/setup', { replace: true }); return; }
        setUserEmail(me.email ?? '');
        await Promise.all([reloadAccounts(), reloadProviders()]);
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function logout() { clearToken(); navigate('/', { replace: true }); }

  if (loading) {
    return (
      <div className="fk-splash">
        <div className="fk-splash-mark"><img src="/flokilogo.PNG" alt="Floki" /></div>
        <span>Loading your workspace…</span>
      </div>
    );
  }

  return (
    <AppShell
      userEmail={userEmail}
      accounts={accounts}
      llmProviders={llmProviders}
      reloadAccounts={reloadAccounts}
      reloadProviders={reloadProviders}
      onLogout={logout}
    />
  );
}
