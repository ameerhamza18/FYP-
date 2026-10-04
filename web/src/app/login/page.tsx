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

function safeNext(value: string | null): string {
  if (!value) return '/analyze';
  if (!value.startsWith('/') || value.startsWith('//')) return '/analyze';
  return value;
}

const loginSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = loginSchema.extend({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/\d/, 'Must contain a numeric digit'),
  confirm: z.string(),
}).refine((data) => data.password === data.confirm, {
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
      toast.error(err.message || 'Authentication failed. Please verify credentials.');
    }
  };

  const isRegister = mode === 'register';

  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-background">
      {/* Left Obsidian Security Band */}
      <aside className="relative hidden overflow-hidden border-ink-border bg-ink lg:flex lg:w-[46%] lg:flex-col lg:justify-between lg:border-r lg:p-12">
        <div className="tl-cyber-grid pointer-events-none absolute inset-0 opacity-25" aria-hidden />
        <div
          className="pointer-events-none absolute -left-24 top-1/3 h-96 w-96 rounded-full bg-brand/20 blur-[140px]"
          aria-hidden
        />

        <div className="relative">
          <Link href="/" aria-label="TrustLayer home">
            <Logo onInk size={36} subtitle="DECEPTION DEFENSE PLATFORM" />
          </Link>
        </div>

        <div className="relative max-w-md">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-[10px] text-brand-cyan mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 tl-beacon" />
            SECURE ACCESS GATEWAY
          </div>
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-ink-foreground">
            Unified threat telemetry.
            <br />
            Forensic certainty.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">
            Authenticate to access the live threat analyzer, maintain persistent incident records,
            and inspect organisation-wide telemetry across our fused multi-engine matrix.
          </p>

          <ul className="mt-8 space-y-3 font-mono text-xs text-slate-300">
            {[
              'Multimodal payloads: raw text, hyperlinks, mobile screenshots',
              'Deterministic rule triggers & deception tactics exposed',
              'Append-only cryptographic audit logs & rate-limiting',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand/20 text-brand-cyan text-[10px] font-bold">
                  ✓
                </span>
                <span className="leading-relaxed text-ink-muted">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative font-mono text-[11px] text-slate-500">
          PROTECTED BY ZERO-DISK IN-MEMORY PROCESSING · SHA-256 VERIFIED
        </p>
      </aside>

      {/* Right Auth Portal */}
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-6">
            <Link href="/" aria-label="TrustLayer home">
              <Logo size={32} />
            </Link>
          </div>

          <div className="tl-reticle-card rounded-2xl border border-border-default/80 bg-surface/90 p-8 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-border-default/80 pb-4">
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-foreground">
                  {isRegister ? 'Create Security Account' : 'Authenticate Principal'}
                </h1>
                <p className="mt-1 text-xs text-muted">
                  {isRegister
                    ? 'Deploy instant protection across web and mobile.'
                    : 'Enter your credentials to access the console.'}
                </p>
              </div>
              <span className="h-2 w-2 rounded-full bg-emerald-400 tl-beacon" />
            </div>

            {/* Mode Switcher */}
            <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-surface-muted/80 p-1 font-mono text-xs">
              {(['signin', 'register'] as Mode[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => switchMode(value)}
                  className={`rounded-lg py-2 font-bold uppercase transition-all ${
                    mode === value
                      ? 'bg-surface text-foreground shadow-sm border border-brand/30'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  {value === 'signin' ? 'Sign In' : 'Register'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="font-mono text-xs font-semibold text-foreground">
                  PRINCIPAL EMAIL
                </label>
                <input
                  {...registerField('email')}
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="analyst@domain.com"
                  className={`${INPUT} ${errors.email ? 'border-risk-critical' : ''}`}
                />
                {errors.email && <p className="font-mono text-[11px] text-risk-critical">{errors.email.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="font-mono text-xs font-semibold text-foreground">
                  PASSWORD
                </label>
                <input
                  {...registerField('password')}
                  id="password"
                  type="password"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  placeholder={isRegister ? '8+ chars (upper, lower, digit)' : '••••••••'}
                  className={`${INPUT} ${errors.password ? 'border-risk-critical' : ''}`}
                />
                {errors.password && <p className="font-mono text-[11px] text-risk-critical">{errors.password.message}</p>}
              </div>

              {isRegister && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="confirm" className="font-mono text-xs font-semibold text-foreground">
                    CONFIRM PASSWORD
                  </label>
                  <input
                    {...registerField('confirm')}
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repeat password"
                    className={`${INPUT} ${errors.confirm ? 'border-risk-critical' : ''}`}
                  />
                  {errors.confirm && <p className="font-mono text-[11px] text-risk-critical">{errors.confirm.message}</p>}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className={`${BTN.primary} w-full py-3.5 font-mono text-xs font-bold tracking-wider mt-2`}
              >
                {isSubmitting
                  ? isRegister
                    ? 'PROVISIONING ACCOUNT…'
                    : 'AUTHENTICATING…'
                  : isRegister
                    ? 'PROVISION ACCOUNT'
                    : 'ACCESS CONSOLE'}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-muted font-mono">
              {isRegister ? 'Already registered? ' : 'Need credentials? '}
              <button
                type="button"
                onClick={() => switchMode(isRegister ? 'signin' : 'register')}
                className="font-bold text-brand hover:underline"
              >
                {isRegister ? 'Sign in' : 'Create account'}
              </button>
            </p>
          </div>

          <p className="mt-6 text-center font-mono text-xs text-muted">
            <Link href="/" className="hover:text-foreground transition-colors">
              ← Return to Home Overview
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

