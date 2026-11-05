// Tests for F1. Spec: docs/specs/f01-setup.md, section 7.
// fetch is replaced by a fake, so these tests never need the real API.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from '../src/App';
import { ApiError, apiGet } from '../src/api';

function fakeFetch(answer: Promise<Response>) {
  const fetchMock = vi.fn(() => answer);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  cleanup(); // remove what render() drew
  vi.unstubAllGlobals(); // give back the real fetch
});

describe('App (the API status card)', () => {
  it('shows "The API is running" when /api/health answers ok', async () => {
    fakeFetch(Promise.resolve(jsonResponse({ status: 'ok' })));
    render(<App />);
    expect(await screen.findByText('The API is running')).toBeTruthy();
  });

  it('shows "Cannot reach the API" when the request fails', async () => {
    fakeFetch(Promise.reject(new TypeError('Failed to fetch'))); // like the API being off
    render(<App />);
    expect(await screen.findByText('Cannot reach the API')).toBeTruthy();
    expect(screen.getByText('uvicorn app.main:app --reload')).toBeTruthy();
  });

  it('shows "Checking the API…" before the answer arrives', () => {
    fakeFetch(new Promise<Response>(() => {})); // an answer that never comes
    render(<App />);
    expect(screen.getByText('Checking the API…')).toBeTruthy();
  });
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
