'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth';
import ThemeToggle from './ThemeToggle';
import { Logo } from './ui';
import NotificationTray from './NotificationTray';
import PasswordChangeModal from './PasswordChangeModal';

const MARKETING_LINKS = [
  { href: '/#features', label: 'Capabilities' },
  { href: '/#pipeline', label: '3D Pipeline' },
  { href: '/#security', label: 'Assurance' },
];

export default function Navbar() {
  const { user, ready, isAdmin, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

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
    <header className="sticky top-0 z-50 border-b border-ink-border bg-ink/85 backdrop-blur-2xl transition-all">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="shrink-0" aria-label="TrustLayer home">
            <Logo onInk />
          </Link>

          {/* Sub-header SOC Beacon */}
          <div className="hidden xl:flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[10px] text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 tl-beacon" />
            <span className="font-semibold text-slate-300">CORE SENSORS: ONLINE</span>
            <span className="text-slate-500">· 99.98%</span>
          </div>
        </div>

        <div className="hidden items-center gap-1.5 lg:flex font-mono text-xs">
          {MARKETING_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-ink-muted transition-all hover:bg-white/[0.05] hover:text-ink-foreground"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/analyze"
            className={`rounded-lg px-3 py-2 transition-all ${
              pathname === '/analyze'
                ? 'bg-brand/15 text-brand-cyan border border-brand/30'
                : 'text-ink-muted hover:bg-white/[0.05] hover:text-ink-foreground'
            }`}
          >
            Threat Analyzer
          </Link>
          {isAdmin && (
            <Link
              href="/dashboard"
              className={`rounded-lg px-3 py-2 transition-all ${
                pathname === '/dashboard'
                  ? 'bg-brand/15 text-brand-cyan border border-brand/30'
                  : 'text-ink-muted hover:bg-white/[0.05] hover:text-ink-foreground'
              }`}
            >
              SOC Command
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle onInk />

          {ready && user ? (
            <div className="hidden items-center gap-2 sm:gap-3 sm:flex font-mono">
              <NotificationTray />

              <span className="max-w-[150px] truncate text-[11px] text-ink-muted" title={user.email}>
                {user.email}
                {isAdmin && (
                  <span className="ml-1.5 rounded bg-brand/20 border border-brand/40 px-1.5 py-0.5 text-[9px] font-bold uppercase text-brand-cyan">
                    SOC_ADMIN
                  </span>
                )}
              </span>

              <button
                type="button"
                onClick={() => setPasswordModalOpen(true)}
                className="rounded-xl border border-ink-border bg-white/[0.04] px-2.5 py-1.5 text-xs text-ink-muted transition-all hover:bg-white/[0.08] hover:text-ink-foreground"
                title="Change account password"
              >
                Key
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-ink-foreground transition-all hover:bg-white/[0.08]"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-3 sm:flex">
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-xs font-mono font-medium text-ink-muted transition-colors hover:text-ink-foreground"
              >
                Sign in
              </Link>
              <Link
                href="/analyze"
                className="rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground shadow-[var(--shadow-cyber)] transition-all hover:bg-brand-hover hover:shadow-[var(--shadow-lift)]"
              >
                Launch Console
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
          <div className="flex flex-col gap-1 font-mono text-xs">
            {MARKETING_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2.5 text-ink-muted hover:bg-white/5 hover:text-ink-foreground"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/analyze"
              className="rounded-lg px-3 py-2.5 text-ink-muted hover:bg-white/5 hover:text-ink-foreground"
            >
              Threat Analyzer
            </Link>
            {isAdmin && (
              <Link
                href="/dashboard"
                className="rounded-lg px-3 py-2.5 text-ink-muted hover:bg-white/5 hover:text-ink-foreground"
              >
                SOC Command
              </Link>
            )}
          </div>

          <div className="mt-4 border-t border-ink-border pt-4">
            {ready && user ? (
              <div className="flex flex-col gap-3 font-mono text-xs">
                <span className="truncate text-ink-muted">{user.email}</span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-xl border border-ink-border bg-white/5 px-4 py-2.5 font-semibold text-ink-foreground"
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
                  Launch Console
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
      <PasswordChangeModal
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
      />
    </header>
  );
}


