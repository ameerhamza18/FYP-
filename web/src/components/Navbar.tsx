'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth';
import ThemeToggle from './ThemeToggle';
import { Logo } from './ui';

const MARKETING_LINKS = [
  { href: '/#features', label: 'Features' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#security', label: 'Security' },
];

export default function Navbar() {
  const { user, ready, isAdmin, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile panel whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    logout();
    setOpen(false);
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-ink-border bg-ink/85 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-6">
        <Link href="/" className="shrink-0" aria-label="TrustLayer home">
          <Logo onInk />
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {MARKETING_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-white/5 hover:text-ink-foreground"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/analyze"
            className="rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-white/5 hover:text-ink-foreground"
          >
            Analyze
          </Link>
          {isAdmin && (
            <Link
              href="/dashboard"
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-white/5 hover:text-ink-foreground"
            >
              SOC Dashboard
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle onInk />

          {ready && user ? (
            <div className="hidden items-center gap-3 sm:flex">
              <span className="max-w-[180px] truncate text-xs text-ink-muted" title={user.email}>
                {user.email}
                {isAdmin && (
                  <span className="ml-2 rounded bg-brand/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-hover">
                    admin
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl border border-ink-border bg-white/5 px-3.5 py-2 text-sm font-semibold text-ink-foreground transition-colors hover:bg-white/10"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-3 sm:flex">
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink-foreground"
              >
                Sign in
              </Link>
              <Link
                href="/analyze"
                className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-hover"
              >
                Get started
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Toggle navigation menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-ink-border bg-white/5 text-ink-foreground sm:hidden"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              {open ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
            </svg>
          </button>
        </div>
      </nav>
      {open && (
        <div className="border-t border-ink-border bg-ink px-5 pb-5 pt-3 sm:hidden">
          <div className="flex flex-col gap-1">
            {MARKETING_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-muted hover:bg-white/5 hover:text-ink-foreground"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/analyze"
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-muted hover:bg-white/5 hover:text-ink-foreground"
            >
              Analyze
            </Link>
            {isAdmin && (
              <Link
                href="/dashboard"
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-muted hover:bg-white/5 hover:text-ink-foreground"
              >
                SOC Dashboard
              </Link>
            )}
          </div>

          <div className="mt-4 border-t border-ink-border pt-4">
            {ready && user ? (
              <div className="flex flex-col gap-3">
                <span className="truncate text-xs text-ink-muted">{user.email}</span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-xl border border-ink-border bg-white/5 px-4 py-2.5 text-sm font-semibold text-ink-foreground"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Link
                  href="/login"
                  className="rounded-xl border border-ink-border px-4 py-2.5 text-center text-sm font-semibold text-ink-foreground"
                >
                  Sign in
                </Link>
                <Link
                  href="/analyze"
                  className="rounded-xl bg-brand px-4 py-2.5 text-center text-sm font-semibold text-brand-foreground"
                >
                  Get started
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
