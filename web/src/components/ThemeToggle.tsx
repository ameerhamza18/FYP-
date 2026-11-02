'use client';

/**
 * Light/dark switch. Defaults to the warm-ivory light theme (matching the
 * Shieldly AI & RevenueX reference designs) and persists explicit toggles in
 * localStorage. Keep THEME_STORAGE_KEY in sync with `app/layout.tsx`.
 */
import { useCallback, useEffect, useState } from 'react';

export const THEME_STORAGE_KEY = 'trustlayer.theme.v2';

type Theme = 'light' | 'dark';

export default function ThemeToggle({ onInk = false }: { onInk?: boolean }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const initial: Theme = stored === 'dark' ? 'dark' : 'light';
    setTheme(initial);
    document.documentElement.classList.toggle('dark', initial === 'dark');
    setMounted(true);
  }, []);

  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  }, [theme]);

  const base =
    'inline-flex h-9 w-9 items-center justify-center rounded-full border transition-all';
  const skin = onInk
    ? 'border-border-default bg-surface text-muted hover:bg-surface-muted hover:text-foreground shadow-2xs'
    : 'border-border-default bg-surface text-muted hover:bg-surface-muted hover:text-foreground shadow-2xs';

  const label =
    theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button type="button" onClick={toggle} className={`${base} ${skin}`} aria-label={label} title={label}>
      {!mounted ? (
        <span className="h-4 w-4" aria-hidden />
      ) : theme === 'dark' ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
