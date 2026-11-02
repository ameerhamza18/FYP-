'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { BTN, CARD, INPUT, Logo } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';

type Mode = 'signin' | 'register';

function safeNext(value: string | null): string {
  if (!value) return '/analyze';
  if (!value.startsWith('/') || value.startsWith('//')) return '/analyze';
  return value;
}

const loginSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = loginSchema
  .extend({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[a-z]/, 'Must contain a lowercase letter')
      .regex(/\d/, 'Must contain a numeric digit'),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

type RegisterValues = z.infer<typeof registerSchema>;

export default function LoginPage() {
  const { user, ready, login, register } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('signin');
  const [next, setNext] = useState('/analyze');

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

  const switchMode = useCallback(
    (nextMode: Mode) => {
      setMode(nextMode);
      reset({ email: '', password: '', confirm: '' });
    },
    [reset]
  );

  const onSubmit = async (data: any) => {
    try {
      if (mode === 'register') {
        await register(data.email, data.password);
      } else {
        await login(data.email, data.password);
      }
      router.replace(next);
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed. Please verify credentials.');
    }
  };

  const isRegister = mode === 'register';

  return (
    <div className="flex min-h-screen flex-col bg-background p-4 lg:flex-row lg:p-5">
      {/* Left Sunlit Golden-Amber Editorial Panel (RevenueX Inspired) */}
      <aside className="tl-amber-mesh relative hidden overflow-hidden rounded-[32px] border border-[#E8D59C] lg:flex lg:w-[46%] lg:flex-col lg:justify-between lg:p-12 dark:border-border-default">
        <div className="relative">
          <Link href="/" aria-label="TrustLayer home">
            <Logo size={36} subtitle="Deception Defense Platform" />
          </Link>
        </div>

        <div className="relative max-w-md">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#141416] px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-[#A3F750]" />
            Secure Access Gateway
          </div>
          <h2 className="tl-serif text-5xl font-normal leading-[1.05] tracking-tight text-[#141416] dark:text-foreground">
            Unified threat telemetry.
            <br />
            <span className="italic">Forensic certainty.</span>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-[#4E4632] dark:text-muted">
            Sign in to access the live threat analyzer, maintain persistent incident history, and
            inspect organisation-wide telemetry across our four-engine defense stack.
          </p>

          <ul className="mt-8 space-y-2.5 text-xs">
            {[
              'Multimodal payloads: messages, links, and mobile screenshots',
              'Deterministic rule triggers & social-engineering tactics exposed',
              'Append-only cryptographic audit logs & RBAC enforcement',
            ].map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/75 px-4 py-3 font-medium text-[#141416] shadow-2xs backdrop-blur-sm dark:border-border-default dark:bg-surface/80 dark:text-foreground"
              >
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#DFF4EC] text-[11px] font-bold text-[#158067]">
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs font-medium text-[#5C533D] dark:text-muted">
          Protected by Zero-Disk In-Memory Processing · SHA-256 Verified
        </p>
      </aside>

      {/* Right Auth Portal */}
      <main className="flex flex-1 items-center justify-center px-4 py-10 lg:px-10">
        <div className="w-full max-w-md">
          <div className="mb-6 lg:hidden">
            <Link href="/" aria-label="TrustLayer home">
              <Logo size={32} />
            </Link>
          </div>

          <div className={`${CARD} p-8 sm:p-9`}>
            <div className="flex items-start justify-between border-b border-border-default pb-5">
              <div>
                <h1 className="tl-serif text-3xl font-normal tracking-tight text-foreground">
                  {isRegister ? 'Create your account' : 'Welcome back'}
                </h1>
                <p className="mt-1 text-xs text-muted">
                  {isRegister
                    ? 'Deploy instant protection across web and mobile.'
                    : 'Enter your credentials to access the TrustLayer console.'}
                </p>
              </div>
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-[#DFF4EC] px-2.5 py-1 text-[10px] font-semibold text-[#158067]">
                • Live
              </span>
            </div>

            {/* Mode Switcher */}
            <div className="mt-6 grid grid-cols-2 gap-1.5 rounded-full border border-border-default bg-surface-muted p-1 text-xs">
              {(['signin', 'register'] as Mode[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => switchMode(value)}
                  className={`rounded-full py-2 font-semibold transition-all ${
                    mode === value
                      ? 'bg-brand text-brand-foreground shadow-2xs'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  {value === 'signin' ? 'Sign In' : 'Register'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-xs font-semibold text-foreground">
                  Email Address
                </label>
                <input
                  {...registerField('email')}
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="analyst@domain.com"
                  className={`${INPUT} ${errors.email ? 'border-risk-critical' : ''}`}
                />
                {errors.email && (
                  <p className="text-xs font-medium text-risk-critical">{errors.email.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-xs font-semibold text-foreground">
                  Password
                </label>
                <input
                  {...registerField('password')}
                  id="password"
                  type="password"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  placeholder={isRegister ? '8+ chars (upper, lower, digit)' : '••••••••'}
                  className={`${INPUT} ${errors.password ? 'border-risk-critical' : ''}`}
                />
                {errors.password && (
                  <p className="text-xs font-medium text-risk-critical">{errors.password.message}</p>
                )}
              </div>

              {isRegister && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="confirm" className="text-xs font-semibold text-foreground">
                    Confirm Password
                  </label>
                  <input
                    {...registerField('confirm')}
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repeat password"
                    className={`${INPUT} ${errors.confirm ? 'border-risk-critical' : ''}`}
                  />
                  {errors.confirm && (
                    <p className="text-xs font-medium text-risk-critical">
                      {errors.confirm.message}
                    </p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className={`${BTN.primary} mt-2 w-full py-3.5 text-sm`}
              >
                {isSubmitting
                  ? isRegister
                    ? 'Creating account…'
                    : 'Signing in…'
                  : isRegister
                    ? 'Create Account'
                    : 'Access Console'}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-muted">
              {isRegister ? 'Already registered? ' : 'Need an account? '}
              <button
                type="button"
                onClick={() => switchMode(isRegister ? 'signin' : 'register')}
                className="font-bold text-foreground underline underline-offset-4 hover:text-[#6D28D9]"
              >
                {isRegister ? 'Sign in' : 'Create account'}
              </button>
            </p>
          </div>

          <p className="mt-6 text-center text-xs font-medium text-muted">
            <Link href="/" className="transition-colors hover:text-foreground">
              ← Return to Home Overview
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
