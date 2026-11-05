import path from "node:path";
import type { NextConfig } from "next";

/**
 * Browser hardening headers on every response (F12):
 * - no framing by other sites (clickjacking): X-Frame-Options plus CSP frame-ancestors;
 * - no MIME sniffing; referrers trimmed to the origin across sites (verify/reset links carry tokens in the query);
 * - powerful browser features the app never uses are switched off.
 * HSTS and a full script CSP are left to F14 (they need the production HTTPS host and a nonce setup).
 */
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  turbopack: {
    // The repo root holds the video pipeline's own lockfile; pin the web app as its own root.
    root: path.join(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
