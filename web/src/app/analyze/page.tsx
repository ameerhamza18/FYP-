'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';
import ResultReport from '@/components/analysis/ResultReport';
import { BTN, CARD, EmptyState, INPUT, RiskBadge, SkeletonRows } from '@/components/ui';
import { api } from '@/lib/api';
import { RequireAuth } from '@/lib/auth';
import { relativeTime } from '@/lib/presentation';
import type { Analysis, AnalysisDetail, InputType } from '@/lib/types';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const TABS: { id: InputType; label: string; sub: string; bg: string }[] = [
  { id: 'text', label: 'Message', sub: 'SMS, WhatsApp, Email', bg: 'bg-[#CBE3DF] text-[#134E44]' },
  { id: 'url', label: 'Link', sub: 'URL & Domain Check', bg: 'bg-[#E8D68A] text-[#5A4506]' },
  { id: 'screenshot', label: 'Screenshot', sub: 'In-Memory OCR', bg: 'bg-[#CBD4FA] text-[#1D2549]' },
];

const SOURCES = ['web', 'sms', 'email', 'whatsapp', 'other'];

const SAMPLE_PROMPTS: { label: string; tab: InputType; value: string; source?: string }[] = [
  {
    label: 'Is this text a delivery scam?',
    tab: 'text',
    source: 'sms',
    value:
      'USPS: Your package is on hold due to an unpaid customs fee of $2.99. Confirm delivery details immediately at http://usps-track-customs-alert.top/pay to avoid return.',
  },
  {
    label: 'Is this website link safe?',
    tab: 'url',
    value: 'http://secure-raast-verification-portal.xyz/login',
  },
  {
    label: 'Verify this bank OTP message?',
    tab: 'text',
    source: 'sms',
    value:
      'Your one-time verification code is 482913. Do not share this code with anyone, including our staff.',
  },
];

const PASTEL_HISTORY_CARDS = [
  'bg-[#E6ECFE]/75 border-[#CBD4FA] dark:bg-surface-muted dark:border-border-default',
  'bg-[#E3F3EF]/80 border-[#CBE3DF] dark:bg-surface-muted dark:border-border-default',
  'bg-[#F7EFE9]/85 border-[#EFE2D8] dark:bg-surface-muted dark:border-border-default',
  'bg-[#FAF2CE]/80 border-[#E8D68A] dark:bg-surface-muted dark:border-border-default',
];

function Analyzer() {
  const [tab, setTab] = useState<InputType>('text');
  const [text, setText] = useState('');
  const [source, setSource] = useState('web');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisDetail | null>(null);

  const [history, setHistory] = useState<Analysis[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      setHistory(await api.analyze.history(15));
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const chooseFile = useCallback((candidate: File | null | undefined) => {
    setError(null);
    if (!candidate) {
      setFile(null);
      return;
    }
    if (!ACCEPTED_IMAGE_TYPES.includes(candidate.type)) {
      setError('Unsupported file type. Please upload a PNG, JPEG, or WebP image.');
      return;
    }
    if (candidate.size > MAX_UPLOAD_BYTES) {
      setError(
        `File exceeds maximum limit (${(candidate.size / 1024 / 1024).toFixed(1)} MB). Max supported is 8 MB.`
      );
      return;
    }
    setFile(candidate);
  }, []);

  const canSubmit =
    (tab === 'text' && text.trim().length > 0) ||
    (tab === 'url' && url.trim().length > 0) ||
    (tab === 'screenshot' && file !== null);

  const revealResult = () =>
    requestAnimationFrame(() =>
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    );

  const runAnalysis = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      let analysis: AnalysisDetail;
      if (tab === 'text') {
        analysis = await api.analyze.text(text.trim(), source);
      } else if (tab === 'url') {
        analysis = await api.analyze.url(url.trim());
      } else {
        analysis = await api.analyze.screenshot(file as File);
      }
      setResult(analysis);
      loadHistory();
      revealResult();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const openHistoryItem = async (id: number) => {
    setBusy(true);
    setError(null);
    try {
      setResult(await api.analyze.detail(id));
      revealResult();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load that analysis record.');
    } finally {
      setBusy(false);
    }
  };

  const clearInputs = () => {
    setText('');
    setUrl('');
    setFile(null);
    setResult(null);
    setError(null);
  };

  const applySample = (sample: (typeof SAMPLE_PROMPTS)[number]) => {
    setError(null);
    setTab(sample.tab);
    if (sample.tab === 'text') {
      setText(sample.value);
      if (sample.source) setSource(sample.source);
    } else if (sample.tab === 'url') {
      setUrl(sample.value);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-10 lg:px-6 lg:py-12">
      {/* Shieldly AI Signature Periwinkle Banner */}
      <header className="tl-periwinkle-card mb-8 flex flex-col justify-between gap-6 rounded-[28px] border border-[#BBC7F7] p-6 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:p-8 dark:border-border-default">
        <div className="flex items-start gap-4 sm:items-center">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-[#141416] shadow-sm">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
              <path d="M5 3v4M3 5h4" />
            </svg>
          </div>
          <div>
            <h1 className="tl-serif text-3xl font-normal tracking-tight text-[#141416] sm:text-4xl dark:text-white">
              How can TrustLayer help you?
            </h1>
            <p className="mt-1 text-sm text-[#394270] dark:text-slate-300">
              Paste anything, inspect suspicious links, or upload screenshots — get instant forensic answers.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/85 px-3.5 py-1.5 text-xs font-semibold text-[#141416] shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-[#158067]" />
            4 Engines Armed
          </span>
          <span className="inline-flex items-center rounded-full bg-white/70 px-3.5 py-1.5 text-xs font-medium text-[#2B335C]">
            &lt; 240ms latency
          </span>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_350px]">
        {/* Main Console Input & Verdict Area */}
        <div className="space-y-8">
          <section className={`${CARD} p-6 sm:p-8`}>
            {/* Shieldly-Style Filter Pills + Pastel Upload Tiles */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex flex-wrap gap-2">
                {TABS.map((item) => {
                  const active = tab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setTab(item.id);
                        setError(null);
                      }}
                      className={`rounded-full px-5 py-2.5 text-xs font-semibold transition-all ${
                        active
                          ? 'bg-brand text-brand-foreground shadow-sm'
                          : 'bg-surface-muted text-muted hover:bg-surface-hover hover:text-foreground'
                      }`}
                    >
                      {item.label}
                      <span className="ml-1.5 hidden opacity-75 sm:inline">· {item.sub}</span>
                    </button>
                  );
                })}
              </div>
              <span className="text-xs font-medium text-muted">Zero-disk inspection</span>
            </div>

            {/* Try Asking Quick Prompts */}
            <div className="mt-5">
              <p className="text-xs font-bold text-foreground">Try Asking</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {SAMPLE_PROMPTS.map((sample) => (
                  <button
                    key={sample.label}
                    type="button"
                    onClick={() => applySample(sample)}
                    className="rounded-2xl border border-border-default bg-surface-muted/75 px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-surface-hover"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {tab === 'text' && (
                <>
                  <div className="relative">
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      rows={7}
                      maxLength={10000}
                      placeholder="Paste suspicious SMS, WhatsApp message, email body, or deceptive offer here…"
                      className="tl-scroll w-full resize-y rounded-[20px] border border-border-default bg-surface-muted/65 p-4 text-sm leading-relaxed text-foreground placeholder:text-muted focus:border-[#8B3DFF] focus:bg-surface focus:outline-none focus:ring-2 focus:ring-[#8B3DFF]/15"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                    <label className="flex items-center gap-2 font-medium text-muted">
                      <span>Origin Channel:</span>
                      <select
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                        className="rounded-full border border-border-default bg-surface px-3 py-1.5 text-xs font-semibold text-foreground focus:border-[#8B3DFF] focus:outline-none"
                      >
                        {SOURCES.map((option) => (
                          <option key={option} value={option}>
                            {option.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </label>
                    <span className="tabular-nums text-muted">{text.length.toLocaleString()} / 10,000 chars</span>
                  </div>
                </>
              )}

              {tab === 'url' && (
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://suspicious-domain.example/auth/login"
                      className={INPUT}
                    />
                  </div>
                  <p className="text-xs text-muted">
                    Full protocol scheme (<code>https://</code>) is appended automatically if omitted.
                  </p>
                </div>
              )}

              {tab === 'screenshot' && (
                <div className="space-y-2">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      chooseFile(e.dataTransfer.files?.[0]);
                    }}
                    className={`relative overflow-hidden rounded-[24px] border-2 border-dashed p-8 text-center transition-all ${
                      dragging
                        ? 'border-[#8B3DFF] bg-[#EEF1FE]/60'
                        : 'border-border-strong bg-surface-muted/50 hover:border-[#8B3DFF]/50'
                    }`}
                  >
                    {previewUrl ? (
                      <div className="flex flex-col items-center gap-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewUrl}
                          alt="Uploaded evidence screenshot"
                          className="max-h-60 rounded-2xl border border-border-default shadow-md object-contain"
                        />
                        <div className="flex items-center gap-3 text-xs">
                          <span className="max-w-[260px] truncate font-medium text-muted">
                            {file?.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setFile(null);
                              if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            className={BTN.ghost}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#CBD4FA] text-[#1D2549]">
                          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                        </div>
                        <p className="text-sm font-medium text-foreground">
                          Drag and drop screenshot here, or{' '}
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="font-bold text-[#6D28D9] hover:underline dark:text-[#C4B5FD]"
                          >
                            browse files
                          </button>
                        </p>
                        <p className="text-xs text-muted">
                          PNG, JPEG, WebP · Max 8 MB · 100% In-Memory OCR
                        </p>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPTED_IMAGE_TYPES.join(',')}
                      className="hidden"
                      onChange={(e) => chooseFile(e.target.files?.[0])}
                    />
                  </div>
                  <p className="text-xs text-muted">
                    OCR extraction runs in volatile memory only. Images are never written to disk or shared with third parties.
                  </p>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="rounded-2xl border border-risk-critical/30 bg-[#FCE4E4] px-4 py-3 text-xs font-semibold text-risk-critical"
                >
                  ⚠ {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={runAnalysis}
                  disabled={!canSubmit || busy}
                  className={`${BTN.primary} flex-1 py-3.5 text-sm`}
                >
                  {busy ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-brand-foreground border-t-transparent animate-spin" />
                      Analyzing with Fused Engines…
                    </span>
                  ) : (
                    'Run Threat Analysis'
                  )}
                </button>
                <button
                  type="button"
                  onClick={clearInputs}
                  disabled={busy}
                  className={BTN.secondary}
                >
                  Clear
                </button>
              </div>
            </div>
          </section>

          {/* Verdict Report Display Area */}
          <div ref={resultRef}>
            {busy && !result && <SkeletonRows rows={4} />}
            {result && <ResultReport analysis={result} />}
            {!result && !busy && (
              <div className={CARD}>
                <EmptyState
                  title="Ready for Analysis"
                  description="Submit a text message, suspect link, or mobile screenshot above to initiate fused multi-engine inspection."
                />
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: Shieldly-Styled Stacked Pastel Incident Cards & Severity Scale */}
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <section className={`${CARD} p-5`}>
            <div className="flex items-center justify-between border-b border-border-default pb-3.5">
              <h2 className="tl-serif text-2xl font-normal text-foreground">Recent Scans</h2>
              <button
                type="button"
                onClick={loadHistory}
                className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-surface-hover"
              >
                Refresh
              </button>
            </div>

            {historyLoading ? (
              <SkeletonRows rows={5} className="mt-4" />
            ) : history.length === 0 ? (
              <p className="mt-4 text-xs leading-relaxed text-muted">
                Zero threat analyses logged yet. Completed scans will appear here as stacked cards.
              </p>
            ) : (
              <ul className="tl-scroll mt-4 max-h-[520px] space-y-2.5 overflow-y-auto pr-1">
                {history.map((item, idx) => {
                  const tint = PASTEL_HISTORY_CARDS[idx % PASTEL_HISTORY_CARDS.length];
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => openHistoryItem(item.id)}
                        disabled={busy}
                        className={`w-full rounded-[22px] border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-60 ${tint}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/90 text-[11px] font-bold text-[#141416] shadow-2xs">
                              {item.input_type === 'url' ? '🔗' : item.input_type === 'screenshot' ? '📷' : '💬'}
                            </span>
                            <span className="truncate text-xs font-bold text-foreground">
                              {item.threat_type}
                            </span>
                          </div>
                          <RiskBadge level={item.risk_level} score={item.risk_score} />
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">
                          {item.recommendation}
                        </p>
                        <div className="mt-2.5 flex items-center justify-between text-[10px] font-medium text-muted">
                          <span className="uppercase">{item.input_type}</span>
                          <span>{relativeTime(item.created_at)}</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Risk Scale Matrix */}
          <section className={`${CARD} p-5`}>
            <h2 className="tl-serif text-xl font-normal text-foreground border-b border-border-default pb-2.5">
              Severity Scale
            </h2>
            <ul className="mt-3.5 space-y-2.5 text-xs">
              <li className="flex items-center justify-between">
                <span className="font-medium text-foreground">Critical Scam</span>
                <span className="rounded-full bg-[#FCE4E4] px-2.5 py-0.5 font-semibold text-[#C8282A] tabular-nums">
                  • 80–100
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="font-medium text-foreground">High Risk</span>
                <span className="rounded-full bg-[#FDE9DC] px-2.5 py-0.5 font-semibold text-[#C24B12] tabular-nums">
                  • 60–79
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="font-medium text-foreground">Moderate Caution</span>
                <span className="rounded-full bg-[#FFF5CC] px-2.5 py-0.5 font-semibold text-[#8F6200] tabular-nums">
                  • 30–59
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="font-medium text-foreground">Safe / Clean</span>
                <span className="rounded-full bg-[#DFF4EC] px-2.5 py-0.5 font-semibold text-[#12735C] tabular-nums">
                  • 0–29
                </span>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 bg-background">
        <RequireAuth>
          <Analyzer />
        </RequireAuth>
      </main>
      <Footer />
    </>
  );
}
