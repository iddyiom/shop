// Log in. No menu on this page. Shows the API's own messages (tries left, locked).
import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';

import { ApiError } from '../api';
import { useAuth } from '../auth';
import ThemeSwitch from '../components/ThemeSwitch';

const CANNOT_REACH = 'Cannot reach the API. Is it running?';

// Demo accounts: only under `npm run dev`. In a build, DEV is false, so Vite drops
// this import entirely and the demo passwords never reach the depot's app.
const DemoLogin = import.meta.env.DEV ? lazy(() => import('../components/DemoLogin')) : null;

export default function Login() {
  const { user, checking, notice, logIn } = useAuth();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    document.title = 'Log in · Depot';
  }, []);

  // Where they wanted to go before being sent here (RequireAuth remembers it).
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  if (checking) {
    return (
      <p className="loading-page" role="status">
        Loading…
      </p>
    );
  }
  if (user) return <Navigate to={from} replace />; // logged in: leave this page

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); // stay in React; do not reload the page
    if (sending) return; // one click = one try (each wrong try counts towards the lock)
    setSending(true);
    setError(null);
    try {
      await logIn(username, password);
      // Success: the user now exists, so this page re-draws and <Navigate> takes over.
    } catch (err) {
      // 4xx: the API's own sentence. Anything else (API off, forwarder error): cannot reach.
      setError(err instanceof ApiError && err.status < 500 ? err.message : CANNOT_REACH);
      setSending(false);
    } finally {
      setPassword(''); // never keep the password after the request
    }
  }

  return (
    <main className="login-page">
      <div className="login-theme">
        <ThemeSwitch />
      </div>
      <div className="login-column">
        <form className="login-card" onSubmit={submit} noValidate>
          <div className="logo">
            <span className="logo-mark" aria-hidden="true">D</span>
            Depot
          </div>
          <div>
            <h1>Karibu</h1>
            <p className="login-lead">Log in to the depot system.</p>
          </div>

          {/* Why the last session ended (expired token, locked account). */}
          {notice && (
            <p className="form-note" role="status">
              {notice}
            </p>
          )}
          {/* What went wrong with this try (the API's own sentence). */}
          {error && (
            <p className="form-message" role="alert">
              {error}
            </p>
          )}

          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          <button type="submit" className="primary-button" disabled={sending || !username || !password}>
            {sending ? 'Logging in…' : 'Log in'}
          </button>
          <p className="login-help">Forgot your password? Ask the owner.</p>
        </form>
        {DemoLogin && (
          <Suspense fallback={null}>
            <DemoLogin />
          </Suspense>
        )}
      </div>
    </main>
  );
}
