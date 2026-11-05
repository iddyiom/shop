// Log in: no menu on this page. The real form comes in unit F3.
import { useEffect } from 'react';
import { Link } from 'react-router';

import { ComingSoon } from '../components/PageHeader';
import ThemeSwitch from '../components/ThemeSwitch';

export default function Login() {
  useEffect(() => {
    document.title = 'Log in · Depot';
  }, []);

  return (
    <main className="login-page">
      <div className="login-theme">
        <ThemeSwitch />
      </div>
      <section className="login-card">
        <div className="logo">
          <span className="logo-mark" aria-hidden="true">D</span>
          Depot
        </div>
        <p className="eyebrow">LOG IN</p>
        <h1>Karibu</h1>
        <ComingSoon unit="F3" />
        <Link to="/">Go to Home (until log in exists)</Link>
      </section>
    </main>
  );
}
