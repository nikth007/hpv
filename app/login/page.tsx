'use client';

import { LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const users = ['admin', 'hub', 'lab', 'stanley', 'kmc', 'kgh', 'phc'];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('stanley');
  const [password, setPassword] = useState('welcome@123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error || 'Login failed');
    router.replace('/dashboard');
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-hero">
          <div className="badge" style={{ background: 'rgba(255,255,255,0.14)', color: 'white' }}>IOG Egmore hub</div>
          <h1 className="title" style={{ marginTop: 22 }}>HPV screening operations</h1>
          <p style={{ lineHeight: 1.6, maxWidth: 560 }}>
            Aadhaar-first registration, ABHA-ready identifiers, sample barcodes, dispatch manifests, hub receipt, lab results, and referral tracking.
          </p>
          <div className="demo-list">
            {users.map((u) => (
              <button key={u} className="demo-user" onClick={() => setUsername(u)} type="button">
                {u} / welcome@123
              </button>
            ))}
          </div>
        </div>
        <div className="login-panel">
          <div className="kicker">Authorised access</div>
          <h2>Login</h2>
          <form className="form" onSubmit={submit}>
            <div className="field">
              <label>Username</label>
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="field">
              <label>Password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <div className="toast error">{error}</div>}
            <button className="btn" disabled={loading}>
              <LogIn size={18} aria-hidden="true" />
              {loading ? 'Signing in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
