import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Congela a data/hora deste build para o selo de versão (lib/versao.ts).
  // Cada deploy da Vercel gera um build novo, então esta é a data em que a
  // versão publicada foi ao ar.
  env: {
    DATA_DO_BUILD: new Date().toISOString(),
  },
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core"],
  outputFileTracingIncludes: {
    "/api/cron/sync-elleven": [
      "./node_modules/playwright-core/**/*",
      "./node_modules/@sparticuz/chromium/**/*",
    ],
  },
  // Cabeçalhos de segurança aplicados a todas as respostas. A CSP é conservadora
  // de propósito: mantém 'unsafe-inline'/'unsafe-eval' no script porque o Next
  // injeta scripts inline (hidratação/RSC) — restringe as origens sem quebrar a
  // aplicação. Dá para endurecer depois com nonce.
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
