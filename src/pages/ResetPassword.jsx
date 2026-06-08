import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params]  = useSearchParams();
  const token     = params.get('token') ?? '';

  const [password, setPassword]   = useState('');
  const [confirm,  setConfirm]    = useState('');
  const [loading,  setLoading]    = useState(false);
  const [error,    setError]      = useState('');
  const [done,     setDone]       = useState(false);

  async function doReset(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm)  return setError('Passwords do not match.');
    setLoading(true);
    try {
      const r = await api.post('/api/auth/reset-password', { token, password });
      const d = await r.json();
      if (!r.ok) return setError(d.error ?? 'Reset failed. The link may have expired.');
      setDone(true);
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div className="page-logo" style={{ justifyContent: 'center' }}>
          <img src="/flokilogo.PNG" alt="Floki" className="logo-img" />
          <span className="logo-text">Floki Mail</span>
        </div>
      </div>

      <div className="card" style={{ width: '100%', maxWidth: 420 }}>
        <div className="card-body">
          {!token ? (
            <div>
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>Invalid reset link. Please request a new one.</p>
              <button className="btn btn-secondary btn-full" style={{ marginTop: 16 }} onClick={() => navigate('/')}>Back to Sign In</button>
            </div>
          ) : done ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Password updated!</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>Your password has been changed. You can now sign in.</p>
              <button className="btn btn-primary btn-full" onClick={() => navigate('/')}>Go to Sign In</button>
            </div>
          ) : (
            <form onSubmit={doReset}>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Set a new password</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>Choose a strong password for your account.</p>

              {error && <div className="alert alert-error show">{error}</div>}

              <div className="field">
                <label>New Password <span className="hint">min 8 characters</span></label>
                <input type="password" placeholder="New password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
              </div>
              <div className="field">
                <label>Confirm Password</label>
                <input type="password" placeholder="Repeat new password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
              </div>
              <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
                {loading && <span className="spinner" />}
                {loading ? 'Saving…' : 'Update Password'}
              </button>
              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <button type="button" onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 13, cursor: 'pointer' }}>
                  Back to Sign In
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
