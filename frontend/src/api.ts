// The ONLY file that talks to the API (docs/frontend-plan.md).
// F3 will add the login token here, in one place.

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

/** GET /api<path> and return the JSON. Throws ApiError when the answer is not OK. */
export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`/api${path}`, { headers: { Accept: 'application/json' } });
  // Not every answer is JSON (e.g. the forwarder's error page when the API is off).
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const { code, message } = readError(body, response.status);
    throw new ApiError(response.status, code, message);
  }
  return body as T;
}
