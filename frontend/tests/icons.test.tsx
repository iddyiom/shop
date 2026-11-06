// Tests for the Solar icon set (components/Icon.tsx). Icons are decoration: names live in words.
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Icon from '../src/components/Icon';
import { MENU } from '../src/menu';
import { loggedInAs, OWNER, openAt } from './helpers';

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  document.documentElement.dataset.theme = 'light';
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('icons (Solar Linear, CC0)', () => {
  it('an icon is hidden from screen readers and draws in the text color', () => {
    const { container } = render(<Icon name="home" />);
    const svg = container.querySelector('svg') as SVGSVGElement;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('every menu entry has its own icon and is still named by its words', async () => {
    expect(new Set(MENU.map((entry) => entry.icon)).size).toBe(MENU.length); // no icon used twice
    loggedInAs(OWNER);
    openAt('/');
    const nav = await screen.findByRole('navigation', { name: 'Main menu' });
    for (const entry of MENU) {
      const link = within(nav).getByRole('link', { name: entry.label });
      expect(link.querySelector('svg.icon')).not.toBeNull();
    }
  });
});
