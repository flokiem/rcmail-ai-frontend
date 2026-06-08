import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken, getToken } from '../lib/api.js';

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

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    api.get('/api/auth/me').then(r => {
      if (r.ok) redirect();
    }).catch(() => {});
  }, []);

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

  async function doForgot(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { email: forgotEmail });
      setSuccess('If that email exists, a reset link has been sent. Check your inbox.');
      setForgotEmail('');
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  }

  function switchTab(t) { setTab(t); setError(''); setSuccess(''); }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div className="page-logo" style={{ justifyContent: 'center' }}>
          <img src="/flokilogo.PNG" alt="Floki" className="logo-img" />
          <span className="logo-text">Floki Mail</span>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 15, marginTop: 8 }}>Your AI-powered email assistant</p>
      </div>

      <div className="card" style={{ width: '100%', maxWidth: 420 }}>
        <div className="card-body">

          {tab !== 'forgot' && (
            <div className="tabs">
              <div className={`tab ${tab === 'login' ? 'active' : ''}`} onClick={() => switchTab('login')}>Sign In</div>
              <div className={`tab ${tab === 'register' ? 'active' : ''}`} onClick={() => switchTab('register')}>Create Account</div>
            </div>
          )}

          {error   && <div className="alert alert-error show">{error}</div>}
          {success && <div className="alert alert-success show">{success}</div>}

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
              <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
                {loading && <span className="spinner" />}
                {loading ? 'Please wait…' : 'Sign In'}
              </button>
              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <button type="button" onClick={() => switchTab('forgot')} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 13, cursor: 'pointer' }}>
                  Forgot your password?
                </button>
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
              <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
                {loading && <span className="spinner" />}
                {loading ? 'Please wait…' : 'Create Account'}
              </button>
            </form>
          )}

          {tab === 'forgot' && (
            <form onSubmit={doForgot}>
              <div style={{ marginBottom: 18 }}>
                <button type="button" onClick={() => switchTab('login')} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                  ← Back to Sign In
                </button>
                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Reset your password</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>Enter your email and we'll send you a reset link.</p>
              </div>
              <div className="field">
                <label>Email</label>
                <input type="email" placeholder="you@example.com" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} autoComplete="email" />
              </div>
              <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
                {loading && <span className="spinner" />}
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
