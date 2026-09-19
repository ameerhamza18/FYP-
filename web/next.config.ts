import type { NextConfig } from "next";

/**
 * Response hardening for the web tier.
 *
 * A strict `Content-Security-Policy` is deliberately NOT set here: the app
 * ships a tiny inline bootstrap script that applies the stored theme before
 * first paint (see `app/layout.tsx`), so a script-src policy would have to be
 * nonce-based to avoid breaking it. These headers are the ones that are safe
 * and useful unconditionally.
 *
 * HSTS is only meaningful over TLS (the reverse proxy terminates it), so it is
 * restricted to production to avoid poisoning localhost for other projects.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

if (process.env.NODE_ENV === "production") {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  });
}

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle at .next/standalone so the runtime
  // image does not need node_modules (see infrastructure/docker/Dockerfile.web).
  output: "standalone",
  reactStrictMode: true,
  // Do not advertise the framework version to the internet.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
