import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowRight, KeyRound } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { signupStaff, ApiError } from '../api';

export default function LoginPanel() {
  const { login } = useAuth();
  const [mode, setMode] = useState('signin'); // 'signin' | 'create'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      await signupStaff({ email: email.trim(), password, role: 'admin', adminKey });
      setNotice('Account created — you can sign in now.');
      setMode('signin');
      setPassword('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      className="card"
      style={{ maxWidth: 420, margin: '0 auto' }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <KeyRound size={16} style={{ color: 'var(--accent-deep)' }} />
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>
          Staff access
        </h3>
      </div>
      <p className="field__hint" style={{ marginBottom: 18 }}>
        {mode === 'signin'
          ? 'Sign in to review and manage bookings.'
          : 'First time here? Create the first admin account using the admin key from the backend .env.'}
      </p>

      {notice && (
        <div className="banner" style={{ background: 'var(--success-wash)', color: 'var(--success)' }}>
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="banner banner--error" role="alert">
          <AlertCircle size={16} style={{ flex: 'none', marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      {mode === 'signin' ? (
        <form onSubmit={handleSignIn}>
          <div className="field">
            <label className="field__label" htmlFor="staff_email">Email</label>
            <input
              id="staff_email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="staff_password">Password</label>
            <input
              id="staff_password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn btn--accent" type="submit" disabled={submitting} style={{ marginTop: 6 }}>
            {submitting ? <span className="spinner" /> : <>Sign in <ArrowRight size={15} /></>}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            style={{ marginTop: 10 }}
            onClick={() => { setMode('create'); setError(''); }}
          >
            Create an admin account instead
          </button>
        </form>
      ) : (
        <form onSubmit={handleCreate}>
          <div className="field">
            <label className="field__label" htmlFor="new_email">Email</label>
            <input
              id="new_email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="new_password">Password</label>
            <input
              id="new_password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="admin_key">Admin key</label>
            <input
              id="admin_key"
              type="password"
              className="input"
              placeholder="from backend .env"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              required
            />
          </div>
          <button className="btn btn--accent" type="submit" disabled={submitting} style={{ marginTop: 6 }}>
            {submitting ? <span className="spinner" /> : <>Create account <ArrowRight size={15} /></>}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            style={{ marginTop: 10 }}
            onClick={() => { setMode('signin'); setError(''); }}
          >
            Back to sign in
          </button>
        </form>
      )}
    </motion.div>
  );
}
