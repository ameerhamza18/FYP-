'use client';

/**
 * Sign in / create account. This route was previously linked from the navbar
 * but did not exist (404).
 *
 * The `?next=` parameter is validated to a same-origin relative path so it can
 * never be used as an open redirect.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { BTN, INPUT, Logo } from '@/components/ui';
import { useAuth } from '@/lib/auth';

type Mode = 'signin' | 'register';

/** Only allow internal absolute paths; reject protocol-relative and absolute URLs. */
function safeNext(value: string | null): string {
  if (!value) return '/analyze';
  if (!value.startsWith('/') || value.startsWith('//')) return '/analyze';
  return value;
}

function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter.';
  if (!/\d/.test(password)) return 'Password must contain a digit.';
  return null;
}

export default function LoginPage() {
  const { user, ready, login, register } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [next, setNext] = useState('/analyze');

  // Read ?next= from the URL without useSearchParams (keeps the page static).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(safeNext(params.get('next')));
  }, []);

  // Already signed in? Bounce straight to the destination.
  useEffect(() => {
    if (ready && user) router.replace(next);
  }, [ready, user, router, next]);

  const switchMode = useCallback((nextMode: Mode) => {
    setMode(nextMode);
    setError(null);
    setPassword('');
    setConfirm('');
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Enter your email address.');
      return;
    }

    if (mode === 'register') {
      const problem = passwordProblem(password);
      if (problem) {
        setError(problem);
        return;
      }
      if (password !== confirm) {
        setError('Passwords do not match.');
        return;
      }
    } else if (!password) {
      setError('Enter your password.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'register') {
        await register(trimmedEmail, password);
      } else {
        await login(trimmedEmail, password);
      }
      router.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const isRegister = mode === 'register';

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Brand panel — always dark, for the dark/white contrast. */}
      <aside className="relative hidden overflow-hidden border-ink-border bg-ink lg:flex lg:w-[46%] lg:flex-col lg:justify-between lg:border-r lg:p-12">
        <div className="tl-grid-bg pointer-events-none absolute inset-0 opacity-30" aria-hidden />
        <div
          className="pointer-events-none absolute -left-24 top-1/3 h-96 w-96 rounded-full bg-brand/20 blur-[130px]"
          aria-hidden
        />

        <div className="relative">
          <Link href="/" aria-label="TrustLayer home">
            <Logo onInk size={34} subtitle="Threat defense platform" />
          </Link>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-ink-foreground">
            One score.
            <br />
            Every signal behind it.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">
            Sign in to run analyses, keep a personal history of everything you have
            checked, and — if you are an administrator — open the live SOC dashboard.
          </p>

          <ul className="mt-8 space-y-3">
            {[
              'Multimodal: text, URL and screenshot',
              'Indicators and manipulation techniques listed',
              'Audit-logged and rate-limited by default',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-ink-muted">
                <span
                  className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-brand/40 bg-brand/15 text-brand-hover"
                  aria-hidden
                >
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m5 13 4 4L19 7" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-ink-muted">
          Detection assistance only — always verify with the official source.
        </p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden">
            <Link href="/" aria-label="TrustLayer home">
              <Logo size={30} />
            </Link>
          </div>

          <h1 className="mt-8 text-2xl font-bold tracking-tight text-foreground lg:mt-0">
            {isRegister ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {isRegister
              ? 'Free to use — start checking suspicious messages in seconds.'
              : 'Sign in to run analyses and view your history.'}
          </p>

          <div className="mt-7 inline-flex rounded-xl border border-border-default bg-surface-muted p-1">
            {(['signin', 'register'] as Mode[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => switchMode(value)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  mode === value
                    ? 'bg-surface text-foreground shadow-[var(--shadow-card)]'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                {value === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className={INPUT}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isRegister ? 'At least 8 characters' : '••••••••'}
                className={INPUT}
              />
              {isRegister && (
                <p className="mt-1.5 text-xs text-muted">
                  8+ characters with an uppercase letter, a lowercase letter and a digit.
                </p>
              )}
            </div>

            {isRegister && (
              <div>
                <label
                  htmlFor="confirm"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Confirm password
                </label>
                <input
                  id="confirm"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat your password"
                  className={INPUT}
                />
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-risk-critical/30 bg-risk-critical/10 px-4 py-3 text-sm text-risk-critical"
              >
                {error}
              </div>
            )}

            <button type="submit" disabled={busy} className={`${BTN.primary} w-full py-3`}>
              {busy
                ? isRegister
                  ? 'Creating account…'
                  : 'Signing in…'
                : isRegister
                  ? 'Create account'
                  : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            {isRegister ? 'Already have an account? ' : 'New to TrustLayer? '}
            <button
              type="button"
              onClick={() => switchMode(isRegister ? 'signin' : 'register')}
              className="font-semibold text-brand hover:text-brand-hover"
            >
              {isRegister ? 'Sign in' : 'Create one free'}
            </button>
          </p>

          <p className="mt-8 text-center text-xs text-muted">
            <Link href="/" className="hover:text-foreground">
              ← Back to home
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}