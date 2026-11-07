import { useState, type FormEvent } from 'react';
import type { CloudSync, SyncStatus } from '../sync/useCloudSync';

const STATUS_TEXT: Record<SyncStatus, string> = {
  disabled: '',
  signedOut: '',
  syncing: 'Syncing…',
  synced: 'Synced',
  offline: 'Offline — changes will sync when you reconnect',
  error: 'Sync failed',
};

export function AccountCard({ cloud }: { cloud: CloudSync }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (cloud.status === 'disabled') {
    return (
      <section className="card" aria-label="Cloud sync">
        <h2 className="card-title">Cloud sync</h2>
        <p className="muted small">
          Not set up. Data is stored on this device only. Add <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> to enable syncing.
        </p>
      </section>
    );
  }

  if (cloud.status !== 'signedOut') {
    const time = cloud.lastSyncedAt ? new Date(cloud.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
    return (
      <section className="card" aria-label="Cloud sync">
        <h2 className="card-title">Cloud sync</h2>
        <p className="small">Signed in as <strong>{cloud.email}</strong></p>
        <p className="muted small" role="status">
          {STATUS_TEXT[cloud.status]}
          {cloud.status === 'synced' && time && ` at ${time}`}
          {cloud.status === 'error' && cloud.error && `: ${cloud.error}`}
        </p>
        <div className="button-row">
          <button className="btn" onClick={cloud.syncNow} disabled={cloud.status === 'syncing'}>Sync now</button>
          <button className="btn" onClick={() => void cloud.signOut()}>Sign out</button>
        </div>
      </section>
    );
  }

  const submit = async (e: FormEvent, mode: 'signIn' | 'signUp') => {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      setMessage('Enter your email and a password of at least 6 characters.');
      return;
    }
    setPending(true);
    setMessage(null);
    const err = await (mode === 'signIn' ? cloud.signIn : cloud.signUp)(email.trim(), password);
    setPending(false);
    setMessage(err);
    if (!err) setPassword('');
  };

  return (
    <section className="card" aria-label="Cloud sync">
      <h2 className="card-title">Cloud sync</h2>
      <p className="muted small">Sign in to back up your workouts and settings and sync them across devices.</p>
      <form onSubmit={e => void submit(e, 'signIn')}>
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Password</span>
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        <div className="button-row">
          <button className="btn primary" type="submit" disabled={pending}>Sign in</button>
          <button className="btn" type="button" disabled={pending} onClick={e => void submit(e, 'signUp')}>Create account</button>
        </div>
      </form>
      {message && <p className="small" role="status">{message}</p>}
    </section>
  );
}
