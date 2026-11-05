// Tests for src/api.ts (kept from F1). fetch is replaced by a fake.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiGet } from '../src/api';

function fakeFetch(answer: Promise<Response>) {
  const fetchMock = vi.fn(() => answer);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiGet', () => {
  it('adds /api to the path', async () => {
    const fetchMock = fakeFetch(Promise.resolve(jsonResponse({ status: 'ok' })));
    await apiGet('/health');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]).toEqual(['/api/health', expect.anything()]);
  });

  it("throws ApiError with the API's message on a 4xx answer", async () => {
    fakeFetch(Promise.resolve(jsonResponse({ error: 'owner_only', message: 'Only the owner can do this' }, 403)));
    const error = await apiGet('/users').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(403);
    expect((error as ApiError).code).toBe('owner_only');
    expect((error as ApiError).message).toBe('Only the owner can do this');
  });

  it('throws a plain ApiError when the error answer is not JSON', async () => {
    fakeFetch(Promise.resolve(new Response('Bad Gateway', { status: 502 })));
    const error = await apiGet('/health').catch((e: unknown) => e);
    expect((error as ApiError).message).toBe('Request failed (502)');
  });
});
