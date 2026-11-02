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
  { href: '/#pipeline', label: 'How It Works' },
  { href: '/#security', label: 'Assurance' },
];

export default function Navbar() {
  const { user, ready, isAdmin, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    logout();
    setOpen(false);
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border-default/80 bg-background/88 backdrop-blur-xl transition-all">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-6">
        <div className="flex items-center gap-5">
          <Link href="/" className="shrink-0" aria-label="TrustLayer home">
            <Logo />
          </Link>

          <div className="hidden xl:flex items-center gap-2 rounded-full border border-border-default bg-surface px-3 py-1 text-[11px] font-medium text-muted shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-[#158067] tl-beacon" />
            <span className="font-semibold text-foreground">Available & Armed</span>
            <span>· 4 Engines</span>
          </div>
        </div>

        {/* Center pill dock */}
        <div className="hidden items-center gap-1 rounded-full border border-border-default bg-surface p-1 shadow-2xs lg:flex text-xs font-medium">
          {MARKETING_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3.5 py-1.5 text-muted transition-all hover:bg-surface-muted hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/analyze"
            className={`rounded-full px-3.5 py-1.5 transition-all ${
              pathname === '/analyze'
                ? 'bg-brand text-brand-foreground font-semibold shadow-2xs'
                : 'text-muted hover:bg-surface-muted hover:text-foreground'
            }`}
          >
            Shield AI Scanner
          </Link>
          {isAdmin && (
            <Link
              href="/dashboard"
              className={`rounded-full px-3.5 py-1.5 transition-all ${
                pathname === '/dashboard'
                  ? 'bg-brand text-brand-foreground font-semibold shadow-2xs'
                  : 'text-muted hover:bg-surface-muted hover:text-foreground'
              }`}
            >
              SOC Dashboard
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <ThemeToggle />

          {ready && user ? (
            <div className="hidden items-center gap-2 sm:flex">
              <NotificationTray />

              <div className="flex items-center gap-2 rounded-full border border-border-default bg-surface pl-2.5 pr-1.5 py-1 shadow-2xs">
                <span className="max-w-[140px] truncate text-xs font-medium text-foreground" title={user.email}>
                  {user.email}
                </span>
                {isAdmin && (
                  <span className="rounded-full bg-[#A3F750] px-2 py-0.5 text-[10px] font-bold text-[#143300]">
                    SOC
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setPasswordModalOpen(true)}
                  className="rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                  title="Change account password"
                >
                  Password
                </button>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground transition-all hover:bg-brand-hover"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-2.5 sm:flex">
              <Link
                href="/login"
                className="rounded-full px-3.5 py-2 text-xs font-semibold text-muted transition-colors hover:text-foreground"
              >
                Sign in
              </Link>
              <Link
                href="/analyze"
                className="rounded-full bg-brand px-4.5 py-2 text-xs font-semibold text-brand-foreground shadow-[var(--shadow-cyber)] transition-all hover:bg-brand-hover"
              >
                Get Started
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Toggle navigation menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-default bg-surface text-foreground sm:hidden"
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
        <div className="border-t border-border-default bg-surface px-5 pb-5 pt-3 sm:hidden shadow-lg">
          <div className="flex flex-col gap-1 text-sm font-medium">
            {MARKETING_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-2xl px-3.5 py-2.5 text-muted hover:bg-surface-muted hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/analyze"
              className="rounded-2xl px-3.5 py-2.5 text-muted hover:bg-surface-muted hover:text-foreground"
            >
              Shield AI Scanner
            </Link>
            {isAdmin && (
              <Link
                href="/dashboard"
                className="rounded-2xl px-3.5 py-2.5 text-muted hover:bg-surface-muted hover:text-foreground"
              >
                SOC Dashboard
              </Link>
            )}
          </div>

          <div className="mt-4 border-t border-border-default pt-4">
            {ready && user ? (
              <div className="flex flex-col gap-3 text-xs">
                <span className="truncate font-medium text-muted">{user.email}</span>
                <button
                  type="button"
                  onClick={() => setPasswordModalOpen(true)}
                  className="rounded-full border border-border-default bg-surface-muted px-4 py-2.5 font-semibold text-foreground"
                >
                  Change Password
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full bg-brand px-4 py-2.5 font-semibold text-brand-foreground"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Link
                  href="/login"
                  className="rounded-full border border-border-default px-4 py-2.5 text-center text-sm font-semibold text-foreground"
                >
                  Sign in
                </Link>
                <Link
                  href="/analyze"
                  className="rounded-full bg-brand px-4 py-2.5 text-center text-sm font-semibold text-brand-foreground"
                >
                  Get Started
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
