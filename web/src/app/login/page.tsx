'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { BTN, INPUT, Logo } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';

type Mode = 'signin' | 'register';

/** Only allow internal absolute paths; reject protocol-relative and absolute URLs. */
function safeNext(value: string | null): string {
  if (!value) return '/analyze';
  if (!value.startsWith('/') || value.startsWith('//')) return '/analyze';
  return value;
}

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = loginSchema.extend({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/\d/, 'Must contain a digit'),
  confirm: z.string(),
}).refine((data) => data.password === data.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

export default function LoginPage() {
  const { user, ready, login, register } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('signin');
  const [next, setNext] = useState('/analyze');

  // Form setup
  const methods = useForm<RegisterValues>({
    resolver: mode === 'register' ? zodResolver(registerSchema) : zodResolver(loginSchema as any),
    defaultValues: {
      email: '',
      password: '',
      confirm: '',
    },
  });

  const {
    register: registerField,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = methods;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(safeNext(params.get('next')));
  }, []);

  useEffect(() => {
    if (ready && user) router.replace(next);
  }, [ready, user, router, next]);

  const switchMode = useCallback((nextMode: Mode) => {
    setMode(nextMode);
    reset({ email: '', password: '', confirm: '' });
  }, [reset]);

  const onSubmit = async (data: any) => {
    try {
      if (mode === 'register') {
        await register(data.email, data.password);
      } else {
        await login(data.email, data.password);
      }
      router.replace(next);
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong. Try again.');
    }
  };

  const isRegister = mode === 'register';

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
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

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email address
              </label>
              <input
                {...registerField('email')}
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                className={`${INPUT} ${errors.email ? 'border-risk-critical' : ''}`}
              />
              {errors.email && <p className="text-xs text-risk-critical">{errors.email.message}</p>}
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <input
                {...registerField('password')}
                id="password"
                type="password"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                placeholder={isRegister ? 'At least 8 characters' : '••••••••'}
                className={`${INPUT} ${errors.password ? 'border-risk-critical' : ''}`}
              />
              {errors.password && <p className="text-xs text-risk-critical">{errors.password.message}</p>}
              {isRegister && (
                <p className="mt-1.5 text-xs text-muted">
                  8+ characters with an uppercase letter, a lowercase letter and a digit.
                </p>
              )}
            </div>

            {isRegister && (
              <div className="flex flex-col gap-1">
                <label htmlFor="confirm" className="text-sm font-medium text-foreground">
                  Confirm password
                </label>
                <input
                  {...registerField('confirm')}
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  className={`${INPUT} ${errors.confirm ? 'border-risk-critical' : ''}`}
                />
                {errors.confirm && <p className="text-xs text-risk-critical">{errors.confirm.message}</p>}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={`${BTN.primary} w-full py-3`}
            >
              {isSubmitting
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
