import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken, getToken } from '../lib/api.js';
import AuthShell from '../features/auth/AuthShell.jsx';

export default function Login() {
  const navigate = useNavigate();
  const [tab, setTab]         = useState('login');
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const [loginEmail, setLoginEmail]       = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regEmail, setRegEmail]           = useState('');
  const [regPassword, setRegPassword]     = useState('');
  const [forgotEmail, setForgotEmail]     = useState('');
  const [forgotStep, setForgotStep]       = useState(1);
  const [forgotToken, setForgotToken]     = useState('');
  const [newPassword, setNewPassword]     = useState('');
  const [newConfirm,  setNewConfirm]      = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    api.get('/api/auth/me').then(r => { if (r.ok) redirect(); }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function redirect() {
    const r = await api.get('/api/setup/status');
    const d = await r.json();
    navigate((!d.hasMail || !d.hasLlm) ? '/setup' : '/chat', { replace: true });
  }

  async function doLogin(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const r = await api.post('/api/auth/login', { email: loginEmail, password: loginPassword });
      const d = await r.json();
      if (!r.ok) return setError(d.error ?? 'Login failed.');
      setToken(d.token);
      await redirect();
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  }

  async function doRegister(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const r = await api.post('/api/auth/register', { email: regEmail, password: regPassword });
      const d = await r.json();
      if (!r.ok) return setError(d.error ?? 'Registration failed.');
      setToken(d.token);
      navigate('/setup', { replace: true });
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  }

  async function doForgotEmail(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const r = await api.post('/api/auth/forgot-password', { email: forgotEmail });
      const d = await r.json();
      if (!r.ok) return setError(d.error ?? 'No account found with that email.');
      setForgotToken(d.token ?? '');
      setForgotStep(2);
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  }

  async function doForgotReset(e) {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) return setError('Password must be at least 8 characters.');
    if (newPassword !== newConfirm) return setError('Passwords do not match.');
    setLoading(true);
    try {
      const r = await api.post('/api/auth/reset-password', { token: forgotToken, password: newPassword });
      const d = await r.json();
      if (!r.ok) return setError(d.error ?? 'Reset failed. Please try again.');
      setSuccess('Password updated! You can now sign in.');
      switchTab('login');
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  }

  function switchTab(t) {
    setTab(t); setError(''); setSuccess('');
    if (t !== 'forgot') { setForgotStep(1); setForgotEmail(''); setForgotToken(''); setNewPassword(''); setNewConfirm(''); }
  }

  return (
    <AuthShell>
      <div className="fk-auth-head">
        <div className="fk-auth-logo">
          <span className="fk-auth-logo-mark"><img src="/flokilogo.PNG" alt="Floki" /></span>
          <span className="fk-auth-logo-text">Floki Mail</span>
        </div>
        <p className="fk-auth-tagline">Your AI-powered email assistant</p>
      </div>

      <div className="fk-auth-card">
        <div className="fk-auth-card-body">
          {tab !== 'forgot' && (
            <div className="fk-auth-tabs">
              <div className={`fk-auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => switchTab('login')}>Sign In</div>
              <div className={`fk-auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => switchTab('register')}>Create Account</div>
            </div>
          )}

          {error   && <div className="fk-auth-alert fk-auth-alert-error">{error}</div>}
          {success && <div className="fk-auth-alert fk-auth-alert-success">{success}</div>}

          {tab === 'login' && (
            <form onSubmit={doLogin}>
              <div className="field">
                <label>Email</label>
                <input type="email" placeholder="you@example.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className="field">
                <label>Password</label>
                <input type="password" placeholder="Your password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} autoComplete="current-password" />
              </div>
              <button className="fk-auth-btn fk-auth-btn-primary fk-auth-btn-full" type="submit" disabled={loading}>
                {loading && <span className="fk-spinner" />}
                {loading ? 'Please wait…' : 'Sign In'}
              </button>
              <div className="fk-auth-center">
                <button type="button" className="fk-auth-link" onClick={() => switchTab('forgot')}>Forgot your password?</button>
              </div>
            </form>
          )}

          {tab === 'register' && (
            <form onSubmit={doRegister}>
              <div className="field">
                <label>Email</label>
                <input type="email" placeholder="you@example.com" value={regEmail} onChange={e => setRegEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className="field">
                <label>Password <span className="hint">min 8 characters</span></label>
                <input type="password" placeholder="Create a password" value={regPassword} onChange={e => setRegPassword(e.target.value)} autoComplete="new-password" />
              </div>
              <button className="fk-auth-btn fk-auth-btn-primary fk-auth-btn-full" type="submit" disabled={loading}>
                {loading && <span className="fk-spinner" />}
                {loading ? 'Please wait…' : 'Create Account'}
              </button>
            </form>
          )}

          {tab === 'forgot' && (
            <form onSubmit={forgotStep === 1 ? doForgotEmail : doForgotReset}>
              <div style={{ marginBottom: 18 }}>
                <button type="button" className="fk-auth-link" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                  onClick={() => forgotStep === 2 ? setForgotStep(1) : switchTab('login')}>
                  ← {forgotStep === 2 ? 'Back' : 'Back to Sign In'}
                </button>
                <h3 className="fk-auth-h">Reset your password</h3>
                <p className="fk-auth-p">{forgotStep === 1 ? 'Enter your account email to continue.' : 'Choose a new password for your account.'}</p>
              </div>

              {forgotStep === 1 && (
                <div className="field">
                  <label>Email</label>
                  <input type="email" placeholder="you@example.com" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} autoComplete="email" />
                </div>
              )}

              {forgotStep === 2 && (
                <>
                  <div className="field">
                    <label>New Password <span className="hint">min 8 characters</span></label>
                    <input type="password" placeholder="New password" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" />
                  </div>
                  <div className="field">
                    <label>Confirm Password</label>
                    <input type="password" placeholder="Repeat new password" value={newConfirm} onChange={e => setNewConfirm(e.target.value)} autoComplete="new-password" />
                  </div>
                </>
              )}

              <button className="fk-auth-btn fk-auth-btn-primary fk-auth-btn-full" type="submit" disabled={loading}>
                {loading && <span className="fk-spinner" />}
                {forgotStep === 1 ? (loading ? 'Checking…' : 'Continue') : (loading ? 'Saving…' : 'Update Password')}
              </button>
            </form>
          )}
        </div>
      </div>
    </AuthShell>
  );
}
