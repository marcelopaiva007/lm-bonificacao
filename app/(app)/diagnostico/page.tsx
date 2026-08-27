import { requireAdmin } from "@/lib/auth-guard";
import { getCronHealth } from "@/lib/cron-observability";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

function tempoRelativo(iso: string | null): string {
  if (!iso) return "nunca rodou";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
}

type Passo = {
  name?: string;
  screenshotBase64?: string | null;
  tela?: Record<string, unknown>;
};

// Extrai, dos wizardSteps guardados na última execução, o print e as pistas da
// tela (prioriza o passo de falha de login).
function extrairDiagnostico(detalhes: unknown): {
  screenshot: string | null;
  temMfa: boolean | null;
  temSenhaIncorreta: boolean | null;
  textoTela: string | null;
} {
  const d = detalhes as { wizardSteps?: unknown } | null;
  const passos: Passo[] = Array.isArray(d?.wizardSteps)
    ? (d!.wizardSteps as Passo[])
    : [];
  const alvo =
    passos.find((p) => p?.name === "login-nao-avancou" && p.screenshotBase64) ??
    [...passos].reverse().find((p) => p?.screenshotBase64) ??
    passos.find((p) => p?.name === "login-nao-avancou") ??
    null;
  const tela = alvo?.tela ?? null;
  return {
    screenshot: alvo?.screenshotBase64 ?? null,
    temMfa: tela && typeof tela.temMfa === "boolean" ? tela.temMfa : null,
    temSenhaIncorreta:
      tela && typeof tela.temSenhaIncorreta === "boolean"
        ? tela.temSenhaIncorreta
        : null,
    textoTela: tela && typeof tela.textoVisivel === "string" ? tela.textoVisivel : null,
  };
}

export default async function DiagnosticoPage() {
  await requireAdmin();
  const jobs = await getCronHealth();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Diagnóstico de sincronização
        </h1>
        <p className="text-muted-foreground">
          Última execução de cada automação. Quando uma falha, mostra o erro e —
          quando dá para capturar — um print da tela no momento da falha. O print
          aparece a partir da próxima rodada do sync.
        </p>
      </div>

      <div className="space-y-4">
        {jobs.map((job) => {
          const diag = extrairDiagnostico(job.detalhes);
          const status = job.nuncaRodou
            ? "nunca rodou"
            : job.ok
              ? "ok"
              : "falhou";
          const variante = job.nuncaRodou
            ? "outline"
            : job.ok
              ? job.atrasado
                ? "outline"
                : "secondary"
              : "destructive";
          const temDetalhe =
            job.erro ||
            diag.screenshot ||
            diag.textoTela ||
            diag.temMfa !== null ||
            diag.temSenhaIncorreta !== null;

          return (
            <Card key={job.job}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{job.label}</CardTitle>
                  <div className="flex items-center gap-2">
                    {job.atrasado && !job.nuncaRodou && (
                      <Badge variant="outline">atrasado</Badge>
                    )}
                    <Badge variant={variante}>{status}</Badge>
                  </div>
                </div>
                <p className="text-xs tabular-nums text-muted-foreground">
                  Última execução: {tempoRelativo(job.ultimaExecucao)}
                  {job.durationMs != null && ` · ${Math.round(job.durationMs / 1000)}s`}
                </p>
              </CardHeader>

              {temDetalhe && (
                <CardContent className="space-y-3">
                  {job.erro && (
                    <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                      {job.erro}
                    </p>
                  )}

                  {(diag.temMfa !== null || diag.temSenhaIncorreta !== null) && (
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {diag.temMfa !== null && (
                        <p>
                          Indícios de 2FA/MFA na tela:{" "}
                          <span className="font-medium text-foreground">
                            {diag.temMfa ? "sim" : "não"}
                          </span>
                        </p>
                      )}
                      {diag.temSenhaIncorreta !== null && (
                        <p>
                          Indícios de senha/credencial inválida:{" "}
                          <span className="font-medium text-foreground">
                            {diag.temSenhaIncorreta ? "sim" : "não"}
                          </span>
                        </p>
                      )}
                    </div>
                  )}

                  {diag.textoTela && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-muted-foreground">
                        Texto da tela no momento da falha
                      </summary>
                      <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                        {diag.textoTela}
                      </p>
                    </details>
                  )}

                  {diag.screenshot && (
                    <div className="overflow-hidden rounded-md border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`data:image/png;base64,${diag.screenshot}`}
                        alt={`Print da falha — ${job.label}`}
                        className="w-full"
                      />
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
