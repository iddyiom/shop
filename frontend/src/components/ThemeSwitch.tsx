// The light/dark button. It flips the colors and remembers the choice on this browser.
import { useState } from 'react';

import { applyTheme, readTheme, saveTheme, type Theme } from '../theme';

export default function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>(() => readTheme());

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    saveTheme(next);
    setTheme(next);
  }

  // The button names what it will switch TO.
  const label = theme === 'dark' ? 'Light mode' : 'Dark mode';
  return (
    <button type="button" className="pill-button" onClick={toggle}>
      {label}
    </button>
  );
}
