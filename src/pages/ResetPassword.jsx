import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import AuthShell from '../features/auth/AuthShell.jsx';

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
    <AuthShell>
      <div className="fk-auth-head">
        <div className="fk-auth-logo">
          <span className="fk-auth-logo-mark"><img src="/flokilogo.PNG" alt="Floki" /></span>
          <span className="fk-auth-logo-text">Floki Mail</span>
        </div>
      </div>

      <div className="fk-auth-card">
        <div className="fk-auth-card-body">
          {!token ? (
            <div>
              <p className="fk-auth-p">Invalid reset link. Please request a new one.</p>
              <button className="fk-auth-btn fk-auth-btn-secondary fk-auth-btn-full" style={{ marginTop: 16 }} onClick={() => navigate('/')}>Back to Sign In</button>
            </div>
          ) : done ? (
            <div style={{ textAlign: 'center' }}>
              <div className="fk-auth-success-mark">✓</div>
              <h3 className="fk-auth-h">Password updated!</h3>
              <p className="fk-auth-p" style={{ marginBottom: 20 }}>Your password has been changed. You can now sign in.</p>
              <button className="fk-auth-btn fk-auth-btn-primary fk-auth-btn-full" onClick={() => navigate('/')}>Go to Sign In</button>
            </div>
          ) : (
            <form onSubmit={doReset}>
              <h3 className="fk-auth-h">Set a new password</h3>
              <p className="fk-auth-p" style={{ marginBottom: 20 }}>Choose a strong password for your account.</p>

              {error && <div className="fk-auth-alert fk-auth-alert-error">{error}</div>}

              <div className="field">
                <label>New Password <span className="hint">min 8 characters</span></label>
                <input type="password" placeholder="New password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
              </div>
              <div className="field">
                <label>Confirm Password</label>
                <input type="password" placeholder="Repeat new password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
              </div>
              <button className="fk-auth-btn fk-auth-btn-primary fk-auth-btn-full" type="submit" disabled={loading}>
                {loading && <span className="fk-spinner" />}
                {loading ? 'Saving…' : 'Update Password'}
              </button>
              <div className="fk-auth-center">
                <button type="button" className="fk-auth-link" onClick={() => navigate('/')}>Back to Sign In</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </AuthShell>
  );
}
