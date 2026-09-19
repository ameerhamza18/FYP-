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

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // mirrors MAX_UPLOAD_SIZE_MB default
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const TABS: { id: InputType; label: string }[] = [
  { id: 'text', label: 'Message text' },
  { id: 'url', label: 'URL' },
  { id: 'screenshot', label: 'Screenshot' },
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
      setHistory(await api.analyze.history(12));
    } catch {
      // History is a convenience; a failure here must not block analysis.
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Manage the object URL backing the image preview.
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
      setError('Unsupported file type. Upload a PNG, JPEG or WebP image.');
      return;
    }
    if (candidate.size > MAX_UPLOAD_BYTES) {
      setError(
        `Image is too large (${(candidate.size / 1024 / 1024).toFixed(1)} MB). The limit is 8 MB.`,
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
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
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
      setError(err instanceof Error ? err.message : 'Could not load that analysis.');
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
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Threat analyzer</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Paste a message, inspect a link, or upload a screenshot. Every result includes the
          indicators that fired and the manipulation techniques detected.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          <section className={`${CARD} p-6`}>
            <div className="flex flex-wrap gap-1 rounded-xl border border-border-default bg-surface-muted p-1">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTab(item.id);
                    setError(null);
                  }}
                  className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                    tab === item.id
                      ? 'bg-surface text-foreground shadow-[var(--shadow-card)]'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mt-5 space-y-4">
              {tab === 'text' && (
                <>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={9}
                    maxLength={10000}
                    placeholder="Paste the suspicious message here…"
                    className="tl-scroll w-full resize-y rounded-xl border border-border-default bg-background p-4 text-sm leading-relaxed text-foreground placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm text-muted">
                      Source
                      <select
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                        className="rounded-lg border border-border-default bg-background px-3 py-1.5 text-sm text-foreground focus:border-brand focus:outline-none"
                      >
                        {SOURCES.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <span className="text-xs tabular-nums text-muted">{text.length}/10000</span>
                  </div>
                </>
              )}

              {tab === 'url' && (
                <>
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://suspicious-link.example/login"
                    className="w-full rounded-xl border border-border-default bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
                  />
                  <p className="text-xs text-muted">
                    A scheme is added automatically if you omit http:// or https://
                  </p>
                </>
              )}

              {tab === 'screenshot' && (
                <>
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
                    className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                      dragging ? 'border-brand bg-brand-soft' : 'border-border-strong bg-background-subtle'
                    }`}
                  >
                    {previewUrl ? (
                      <div className="flex flex-col items-center gap-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewUrl}
                          alt="Selected screenshot preview"
                          className="max-h-56 rounded-lg border border-border-default object-contain"
                        />
                        <div className="flex items-center gap-3">
                          <span className="max-w-[220px] truncate text-xs text-muted">
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
                        <span className="text-muted">
                          <svg
                            width="30"
                            height="30"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                          >
                            <path d="M12 16V4m0 0L8 8m4-4 4 4" />
                            <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                          </svg>
                        </span>
                        <p className="text-sm text-muted">
                          Drag an image here, or{' '}
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="font-semibold text-brand hover:text-brand-hover"
                          >
                            browse files
                          </button>
                        </p>
                        <p className="text-xs text-muted">PNG, JPEG or WebP · up to 8 MB</p>
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
                    Text is extracted on the server via OCR; the image itself is never written
                    to disk.
                  </p>
                </>
              )}
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-risk-critical/30 bg-risk-critical/10 px-4 py-3 text-sm text-risk-critical"
                >
                  {error}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={runAnalysis}
                  disabled={!canSubmit || busy}
                  className={`${BTN.primary} flex-1 py-3`}
                >
                  {busy ? 'Analyzing…' : 'Run analysis'}
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
          <div ref={resultRef}>
            {busy && !result && <SkeletonRows rows={3} />}
            {result && <ResultReport analysis={result} />}
            {!result && !busy && (
              <div className={`${CARD} tl-grid-bg-light`}>
                <EmptyState
                  title="No analysis yet"
                  description="Submit a message, a link or a screenshot above and the full risk report will appear here."
                />
              </div>
            )}
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <section className={`${CARD} p-5`}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
                Recent analyses
              </h2>
              <button type="button" onClick={loadHistory} className={BTN.ghost}>
                Refresh
              </button>
            </div>

            {historyLoading ? (
              <SkeletonRows rows={5} className="mt-4" />
            ) : history.length === 0 ? (
              <p className="mt-4 text-sm text-muted">
                Nothing here yet. Your completed analyses will be listed below.
              </p>
            ) : (
              <ul className="tl-scroll mt-3 max-h-[520px] space-y-1.5 overflow-y-auto pr-1">
                {history.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openHistoryItem(item.id)}
                      disabled={busy}
                      className="w-full rounded-xl border border-border-default bg-background-subtle p-3 text-left transition-colors hover:border-brand/40 hover:bg-surface-muted disabled:opacity-60"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {item.threat_type}
                        </span>
                        <RiskBadge level={item.risk_level} score={item.risk_score} />
                      </div>
                      <p className="mt-1.5 truncate text-xs text-muted">{item.recommendation}</p>
                      <p className="mt-1 text-[11px] text-muted">
                        {item.input_type} · {relativeTime(item.created_at)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={`${CARD} mt-5 p-5`}>
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Risk scale</h2>
            <ul className="mt-3 space-y-2 text-xs text-muted">
              <li className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-risk-critical" aria-hidden />
                  Critical
                </span>
                <span className="tabular-nums">80–100</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-risk-high" aria-hidden />
                  High
                </span>
                <span className="tabular-nums">60–79</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-risk-medium" aria-hidden />
                  Moderate
                </span>
                <span className="tabular-nums">30–59</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-risk-low" aria-hidden />
                  Low
                </span>
                <span className="tabular-nums">0–29</span>
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