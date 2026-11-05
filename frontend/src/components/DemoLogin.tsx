// DEVELOPMENT ONLY: one-click log in with the demo accounts from dev-accounts.json.
// Login.tsx loads this file only when import.meta.env.DEV is true, so Vite leaves it
// (and the passwords) out of the built app. Spec: docs/specs/d01-demo-login.md.
import { useState } from 'react';

import devAccounts from '../../dev-accounts.json';
import { ApiError } from '../api';
import { useAuth } from '../auth';

const SETUP_HINT = 'Create or reset them: python -m app.manage add-demo-users';

export default function DemoLogin() {
  const { logIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; showHint: boolean } | null>(null);

  async function quickLogIn(username: string, password: string) {
    if (busy) return; // one click = one try
    setBusy(true);
    setError(null);
    try {
      await logIn(username, password); // the same log in as the form
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) {
        // Wrong password or locked: the demo account is missing or was locked by testing.
        setError({ message: err.message, showHint: true });
      } else {
        setError({ message: 'Cannot reach the API. Is it running?', showHint: false });
      }
      setBusy(false);
    }
  }

  return (
    <section className="demo-box" aria-labelledby="demo-title">
      <h2 id="demo-title">Demo accounts</h2>
      <p className="demo-note">Only on this laptop (npm run dev). Never in the depot&apos;s app.</p>
      <div className="demo-buttons">
        {devAccounts.accounts.map((account) => (
          <button
            key={account.username}
            type="button"
            className="demo-button"
            disabled={busy}
            onClick={() => quickLogIn(account.username, account.password)}
          >
            <span className="demo-label">{account.label}</span>
            <span className="demo-credentials">
              {account.username} · {account.password}
            </span>
          </button>
        ))}
      </div>
      {error && (
        <div className="demo-error">
          <p role="alert">{error.message}</p>
          {error.showHint && <p>{SETUP_HINT}</p>}
        </div>
      )}
    </section>
  );
}
