'use client';

/**
 * Light/dark switch. The choice is persisted in localStorage and applied by
 * the inline bootstrap script in `app/layout.tsx` before first paint, so there
 * is no theme flash on reload. Keep the storage key in sync with that script.
 */
import { useCallback, useEffect, useState } from 'react';

export const THEME_STORAGE_KEY = 'trustlayer.theme';

type Theme = 'light' | 'dark';

export default function ThemeToggle({ onInk = false }: { onInk?: boolean }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const initial: Theme =
      stored === 'dark' || stored === 'light'
        ? stored
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    setTheme(initial);
    setMounted(true);
  }, []);

  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  }, [theme]);

  const base =
    'inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors';
  const skin = onInk
    ? 'border-ink-border bg-white/5 text-ink-muted hover:bg-white/10 hover:text-ink-foreground'
    : 'border-border-default bg-surface text-muted hover:bg-surface-muted hover:text-foreground';

  const label =
    theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button type="button" onClick={toggle} className={`${base} ${skin}`} aria-label={label} title={label}>
      {/* Render a stable placeholder until the stored theme is known, so the
          server and client markup never disagree. */}
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