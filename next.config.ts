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
};

export default nextConfig;
