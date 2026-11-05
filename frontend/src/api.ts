// The ONLY file that talks to the API (docs/frontend-plan.md).
// It adds the login token to every call, and tells the app when the session has ended.

/** An error answer from the API: {"error": "item_over", "message": "Item over: only 4 in store"}. */
export class ApiError extends Error {
  readonly status: number; // HTTP status, e.g. 403
  readonly code: string; // the API's "error" field, e.g. "owner_only"

  constructor(status: number, code: string, message: string) {
    super(message); // the API's "message": the exact sentence to show on screen
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

// ---------- The token ----------
// Only in sessionStorage: gone when the tab closes. Never localStorage, a URL or a log.

const TOKEN_KEY = 'depot-token';

export function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null; // storage blocked: behave as logged out
  }
}

export function saveToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage blocked: the user will have to log in again on the next page load.
  }
}

export function clearToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing to clear.
  }
}

// ---------- "The session has ended" ----------
// auth.tsx registers a function here. api.ts calls it on a 401 (token expired or fake)
// or a 423 (account locked), after clearing the token.

type SessionEndHandler = (error: ApiError) => void;
let onSessionEnd: SessionEndHandler | null = null;

export function setSessionEndHandler(handler: SessionEndHandler | null): void {
  onSessionEnd = handler;
}

// ---------- Calls ----------

type Options = {
  /** false for the login call: there a 401 just means "wrong password". */
  endsSession?: boolean;
};

/** Read {"error", "message"} from an error body; fall back to a plain message. */
function readError(body: unknown, status: number): { code: string; message: string } {
  if (typeof body === 'object' && body !== null) {
    const { error, message } = body as Record<string, unknown>;
    if (typeof error === 'string' && typeof message === 'string') {
      return { code: error, message };
    }
  }
  return { code: 'request_failed', message: `Request failed (${status})` };
}

async function request<T>(method: string, path: string, body: unknown, options: Options): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = readToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // Not every answer is JSON (e.g. the forwarder's error page when the API is off).
  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const { code, message } = readError(data, response.status);
    const error = new ApiError(response.status, code, message);
    const sessionOver = response.status === 401 || response.status === 423;
    if (sessionOver && options.endsSession !== false) {
      clearToken();
      onSessionEnd?.(error);
    }
    throw error;
  }
  return data as T;
}

/** GET /api<path>. Throws ApiError when the answer is not OK. */
export function apiGet<T>(path: string, options: Options = {}): Promise<T> {
  return request<T>('GET', path, undefined, options);
}

/** POST /api<path> with a JSON body. Throws ApiError when the answer is not OK. */
export function apiPost<T>(path: string, body: unknown, options: Options = {}): Promise<T> {
  return request<T>('POST', path, body, options);
}
