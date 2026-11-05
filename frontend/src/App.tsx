// F1: one card that asks the API "are you there?" and shows the answer.
import { useEffect, useState } from 'react';

import { apiGet } from './api';

type Status = 'checking' | 'running' | 'unreachable';
type Health = { status: string }; // the shape of GET /health's answer

const TEXT: Record<Status, { pill: string; heading: string; detail: string }> = {
  checking: {
    pill: 'CHECKING',
    heading: 'Checking the API…',
    detail: 'Asking the server if it is there.',
  },
  running: {
    pill: 'CONNECTED',
    heading: 'The API is running',
    detail: 'Front end and API are talking. Next: the menu and pages (F2).',
  },
  unreachable: {
    pill: 'NOT CONNECTED',
    heading: 'Cannot reach the API',
    detail: 'Start it in another terminal:',
  },
};

export default function App() {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    let active = true; // ignore a late answer if the page has already closed
    apiGet<Health>('/health')
      .then((health) => {
        if (active) setStatus(health.status === 'ok' ? 'running' : 'unreachable');
      })
      .catch(() => {
        if (active) setStatus('unreachable'); // API off, or any error: same message
      });
    return () => {
      active = false;
    };
  }, []); // [] = run once, when the page opens

  const text = TEXT[status];
  return (
    <main className="status-page">
      <section className="status-card" aria-live="polite">
        <div className="logo">
          <span className="logo-mark" aria-hidden="true">D</span>
          Depot
        </div>
        <span className={`status-pill ${status}`}>{text.pill}</span>
        <h1>{text.heading}</h1>
        <p>
          {text.detail}
          {status === 'unreachable' && (
            <>
              {' '}
              <code>uvicorn app.main:app --reload</code>
            </>
          )}
        </p>
      </section>
    </main>
  );
}
