'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';
import ResultReport from '@/components/analysis/ResultReport';
import { BTN, CARD, EmptyState, RiskBadge, SkeletonRows } from '@/components/ui';
import { api } from '@/lib/api';
import { RequireAuth } from '@/lib/auth';
import { relativeTime } from '@/lib/presentation';
import type { Analysis, AnalysisDetail, InputType } from '@/lib/types';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const TABS: { id: InputType; label: string; code: string }[] = [
  { id: 'text', label: 'Message Payload', code: 'PAYLOAD // TXT' },
  { id: 'url', label: 'URL Forensics', code: 'TARGET // URI' },
  { id: 'screenshot', label: 'OCR Visual Scan', code: 'OPTICAL // IMG' },
];

const SOURCES = ['web', 'sms', 'email', 'whatsapp', 'other'];

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

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-10 lg:px-6 lg:py-12">
      {/* Console Header */}
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border-default/80 pb-6">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-brand-cyan">
            <span className="h-2 w-2 rounded-full bg-emerald-400 tl-beacon" />
            LIVE FORENSIC SENSORS ARMED
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Threat Analyzer Console
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Submit suspicious message bodies, analyze deceptive hyperlinks, or process mobile screenshots.
            Results include full algorithmic evidence, confidence ratings, and mitigation actions.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-4 font-mono text-xs text-muted">
          <span>PIPELINE: <span className="text-emerald-400 font-bold">READY</span></span>
          <span className="text-slate-600">|</span>
          <span>LATENCY: <span className="text-foreground font-bold">&lt; 240ms</span></span>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Main Console Input & Verdict Area */}
        <div className="space-y-8">
          <section className={`${CARD} p-6 sm:p-8`}>
            {/* Tactical Channel Selector */}
            <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-surface-muted/80 p-1.5 font-mono">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTab(item.id);
                    setError(null);
                  }}
                  className={`flex flex-col items-center justify-center rounded-lg px-3 py-2.5 text-xs transition-all ${
                    tab === item.id
                      ? 'bg-surface text-foreground shadow-md border border-brand/40 font-bold'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  <span className="text-[9px] uppercase tracking-wider text-slate-500">
                    {item.code}
                  </span>
                  <span className="mt-0.5 truncate">{item.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-6 space-y-4">
              {tab === 'text' && (
                <>
                  <div className="relative">
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      rows={8}
                      maxLength={10000}
                      placeholder="Paste suspicious SMS, WhatsApp message, email body, or deceptive offer here…"
                      className="tl-scroll w-full resize-y rounded-xl border border-border-default bg-background/80 p-4 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
                    <label className="flex items-center gap-2 text-muted">
                      <span>ORIGIN CHANNEL:</span>
                      <select
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                        className="rounded-lg border border-border-default bg-surface px-2.5 py-1 text-xs text-foreground focus:border-brand focus:outline-none"
                      >
                        {SOURCES.map((option) => (
                          <option key={option} value={option}>
                            {option.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </label>
                    <span className="tabular-nums text-muted">{text.length}/10,000 BYTES</span>
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
                      className="w-full rounded-xl border border-border-default bg-background/80 px-4 py-3.5 font-mono text-sm text-foreground placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
                    />
                  </div>
                  <p className="font-mono text-[11px] text-muted">
                    Full protocol scheme (https://) will be appended automatically if omitted.
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
                    className={`relative overflow-hidden rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
                      dragging
                        ? 'border-brand bg-brand-soft/50'
                        : 'border-border-strong bg-background/50 hover:border-brand/50'
                    }`}
                  >
                    {/* Animated Scanning Beam in Dropzone */}
                    <div className="tl-scanline" />

                    {previewUrl ? (
                      <div className="flex flex-col items-center gap-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewUrl}
                          alt="Uploaded evidence screenshot"
                          className="max-h-60 rounded-xl border border-white/10 shadow-2xl object-contain"
                        />
                        <div className="flex items-center gap-3 font-mono text-xs">
                          <span className="max-w-[260px] truncate text-muted">
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
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-brand">
                          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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
                            className="font-bold text-brand hover:text-brand-hover underline"
                          >
                            browse files
                          </button>
                        </p>
                        <p className="font-mono text-xs text-muted">
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
                  <p className="font-mono text-[10px] text-muted">
                    OCR extraction runs in volatile memory only. Images are never written to disk or shared with 3rd parties.
                  </p>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-risk-critical/40 bg-risk-critical/10 px-4 py-3 font-mono text-xs text-risk-critical"
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
                  className={`${BTN.primary} flex-1 py-3 text-sm font-mono tracking-wide`}
                >
                  {busy ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      ANALYZING PAYLOAD WITH FUSED ENGINES…
                    </span>
                  ) : (
                    'RUN THREAT ANALYSIS'
                  )}
                </button>
                <button
                  type="button"
                  onClick={clearInputs}
                  disabled={busy}
                  className={`${BTN.secondary} font-mono text-xs`}
                >
                  CLEAR
                </button>
              </div>
            </div>
          </section>

          {/* Verdict Report Display Area */}
          <div ref={resultRef}>
            {busy && !result && <SkeletonRows rows={4} />}
            {result && <ResultReport analysis={result} />}
            {!result && !busy && (
              <div className={`${CARD} tl-cyber-grid`}>
                <EmptyState
                  title="Ready for Analysis"
                  description="Submit a text message, suspect link, or mobile screenshot above to initiate fused multi-engine inspection."
                />
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: Incident History & Reference Scales */}
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <section className={`${CARD} p-5`}>
            <div className="flex items-center justify-between border-b border-border-default pb-3">
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-muted">
                RECENT INCIDENTS
              </h2>
              <button
                type="button"
                onClick={loadHistory}
                className="font-mono text-[10px] font-bold text-brand hover:underline"
              >
                REFRESH
              </button>
            </div>

            {historyLoading ? (
              <SkeletonRows rows={5} className="mt-4" />
            ) : history.length === 0 ? (
              <p className="mt-4 text-xs text-muted leading-relaxed">
                Zero threat analyses logged. Completed records will populate here in real-time.
              </p>
            ) : (
              <ul className="tl-scroll mt-3 max-h-[500px] space-y-2 overflow-y-auto pr-1">
                {history.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openHistoryItem(item.id)}
                      disabled={busy}
                      className="w-full rounded-xl border border-border-default bg-surface-muted/60 p-3 text-left transition-all hover:border-brand/40 hover:bg-surface-muted disabled:opacity-60"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-bold text-foreground">
                          {item.threat_type}
                        </span>
                        <RiskBadge level={item.risk_level} score={item.risk_score} />
                      </div>
                      <p className="mt-1.5 truncate text-[11px] text-muted">
                        {item.recommendation}
                      </p>
                      <div className="mt-2 flex items-center justify-between font-mono text-[9px] text-slate-500">
                        <span>{item.input_type.toUpperCase()}</span>
                        <span>{relativeTime(item.created_at)}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Risk Scale Matrix */}
          <section className={`${CARD} p-5 font-mono`}>
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted border-b border-border-default pb-2">
              SEVERITY TAXONOMY
            </h2>
            <ul className="mt-3 space-y-2.5 text-xs text-muted">
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-risk-critical" />
                  Critical Severe
                </span>
                <span className="tabular-nums font-bold text-risk-critical">80–100</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-risk-high" />
                  High Suspicion
                </span>
                <span className="tabular-nums font-bold text-risk-high">60–79</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-risk-medium" />
                  Moderate Caution
                </span>
                <span className="tabular-nums font-bold text-risk-medium">30–59</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-risk-low" />
                  Clean / Low
                </span>
                <span className="tabular-nums font-bold text-risk-low">0–29</span>
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
      <main className="flex-1 bg-background-subtle">
        <RequireAuth>
          <Analyzer />
        </RequireAuth>
      </main>
      <Footer />
    </>
  );
}