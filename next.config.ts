import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Data em que este build foi gerado. Avaliada UMA vez, aqui, durante a
  // compilação — se fosse calculada em lib/versao.ts, daria a hora em que a
  // pessoa abriu a tela, que não diz nada sobre quando a versão subiu.
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
