// The light/dark button. It flips the colors and remembers the choice on this browser.
// It shows an icon only, so its name ("Dark mode" / "Light mode") is in aria-label and title.
import { Moon, Sun } from 'lucide-react';
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
  const Icon = theme === 'dark' ? Sun : Moon;
  return (
    <button type="button" className="icon-button" aria-label={label} title={label} onClick={toggle}>
      <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}
