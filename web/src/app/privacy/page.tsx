'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background-subtle">
        <div className="mx-auto max-w-3xl px-5 py-16 lg:px-6 lg:py-20">
          <header className="mb-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-soft px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand mb-6">
              Legal
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">Privacy Policy</h1>
            <p className="mt-3 text-sm text-muted">
              Effective Date: <strong className="text-foreground">1 September 2026</strong> · Last updated: <strong className="text-foreground">16 September 2026</strong>
            </p>
          </header>

          <div className="prose prose-slate max-w-none space-y-8 text-sm leading-relaxed text-foreground">

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">1. What is TrustLayer?</h2>
              <p className="text-muted">
                TrustLayer is an AI-powered scam and fraud interception platform. It analyses text messages,
                URLs, and screenshots submitted by users and returns an explainable risk verdict. TrustLayer
                is developed as an academic Final Year Project and is not operated as a commercial service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">2. Data We Collect</h2>
              <div className="overflow-x-auto rounded-xl border border-border-default">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-muted text-xs uppercase tracking-wider text-muted">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Data Type</th>
                      <th className="px-5 py-3 font-semibold">Purpose</th>
                      <th className="px-5 py-3 font-semibold">Retention</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default">
                    {[
                      ['Email address', 'Account identification & authentication', 'Until account deletion'],
                      ['Bcrypt password hash', 'Secure authentication (plaintext is never stored)', 'Until account deletion'],
                      ['Submitted message text', 'Scam analysis & risk scoring', 'Linked to your account until deletion'],
                      ['Submitted URL', 'URL risk analysis', 'Linked to your account until deletion'],
                      ['Screenshot text (extracted)', 'OCR + scam analysis', 'Extracted text only — raw images are never stored on disk'],
                      ['Risk verdict & indicators', 'Show results in your history', 'Linked to your account until deletion'],
                      ['IP address & user-agent', 'Security audit logging, rate limiting', '90 days'],
                    ].map(([type, purpose, retention]) => (
                      <tr key={type} className="hover:bg-surface-muted/50">
                        <td className="px-5 py-3 font-medium text-foreground">{type}</td>
                        <td className="px-5 py-3 text-muted">{purpose}</td>
                        <td className="px-5 py-3 text-muted">{retention}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">3. What We Do NOT Do</h2>
              <ul className="mt-2 space-y-2 text-muted">
                {[
                  'We do NOT sell, rent, or share your data with third parties.',
                  'We do NOT store raw screenshot images — only the text extracted from them (OCR) is held in memory during processing.',
                  'We do NOT use submitted messages to train machine-learning models without your explicit consent.',
                  'We do NOT send submitted URLs to external services — URL analysis is fully static and offline.',
                  'We do NOT send any data to the LLM unless you have opted in and an API key is configured.',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-0.5 text-brand font-bold">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">4. Your Rights</h2>
              <p className="text-muted mb-3">You have the right to:</p>
              <ul className="space-y-2 text-muted">
                <li><strong className="text-foreground">Access</strong> — View all analyses stored against your account via the app history.</li>
                <li><strong className="text-foreground">Deletion</strong> — Permanently delete your account and all associated data via <em>Menu → Delete Account</em> in the mobile app, or by contacting us at <a href="mailto:privacy@trustlayer.app" className="text-brand underline">privacy@trustlayer.app</a>.</li>
                <li><strong className="text-foreground">Portability</strong> — Request an export of your analysis history by contacting us.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">5. Security</h2>
              <p className="text-muted">
                TrustLayer implements industry-grade security controls: JWT authentication, bcrypt password
                hashing (cost 12), sliding-window rate limiting, input validation, RBAC, object-level
                authorisation (BOLA defence), prompt-injection scanning, and an append-only audit log.
                All production traffic is served over HTTPS/TLS.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">6. Cookies & Third Parties</h2>
              <p className="text-muted">
                TrustLayer does not use analytics cookies or third-party advertising trackers. A session
                token (JWT) is stored locally on your device to keep you signed in. No third-party
                JavaScript SDKs are loaded on this site.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">7. Changes to This Policy</h2>
              <p className="text-muted">
                We will notify registered users of material changes via email before they take effect.
                Continued use of TrustLayer after notification constitutes acceptance of the updated policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">8. Contact</h2>
              <p className="text-muted">
                For privacy enquiries or data deletion requests, contact:{' '}
                <a href="mailto:privacy@trustlayer.app" className="text-brand underline font-medium">
                  privacy@trustlayer.app
                </a>
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
