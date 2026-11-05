// A small pill in the top bar: is the API running? (Was the F1 status card.)
import { useEffect, useState } from 'react';

import { apiGet } from '../api';

type Status = 'checking' | 'running' | 'unreachable';
type Health = { status: string }; // the shape of GET /health's answer

const TEXT: Record<Status, string> = {
  checking: 'Checking API…',
  running: 'API connected',
  unreachable: 'API not reachable',
};

export default function ApiStatus() {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    let active = true; // ignore a late answer if the page has already closed
    apiGet<Health>('/health')
      .then((health) => {
        if (active) setStatus(health.status === 'ok' ? 'running' : 'unreachable');
      })
      .catch(() => {
        if (active) setStatus('unreachable');
      });
    return () => {
      active = false;
    };
  }, []); // [] = once, when the app opens

  return (
    <span className={`api-pill ${status}`} role="status">
      <span className="api-dot" aria-hidden="true"></span>
      {TEXT[status]}
    </span>
  );
}
