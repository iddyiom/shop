// useApi(path): load data from the API for a page. Gives data, error, loading and reload().
// Pass null as the path to wait (e.g. until another answer tells you what to ask for).
import { useCallback, useEffect, useState } from 'react';

import { ApiError, apiGet } from './api';

type ApiState<T> = {
  data: T | null;
  error: string | null; // the sentence to show on screen
  loading: boolean;
};

/** The sentence to show for a failed call: the API's own message, or "cannot reach". */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status < 500) return error.message;
  return 'Cannot reach the API. Is it running?';
}

export function useApi<T>(path: string | null) {
  const [state, setState] = useState<ApiState<T>>({ data: null, error: null, loading: true });
  const [attempt, setAttempt] = useState(0); // changing it asks again

  useEffect(() => {
    if (path === null) return; // nothing to ask yet
    let active = true; // ignore a late answer if the page has closed or asked again
    setState((previous) => ({ ...previous, error: null, loading: true }));
    apiGet<T>(path)
      .then((data) => {
        if (active) setState({ data, error: null, loading: false });
      })
      .catch((error: unknown) => {
        if (active) setState({ data: null, error: errorMessage(error), loading: false });
      });
    return () => {
      active = false;
    };
  }, [path, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}
