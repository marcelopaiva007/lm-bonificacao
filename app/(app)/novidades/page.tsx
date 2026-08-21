import { requireUser } from "@/lib/auth-guard";
import { CHANGELOG, type TipoMudanca } from "@/lib/changelog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const TIPO_LABEL: Record<TipoMudanca, string> = {
  adicionado: "Novo",
  corrigido: "Correção",
  alterado: "Mudança",
  removido: "Removido",
};

const TIPO_VARIANTE: Record<
  TipoMudanca,
  "default" | "secondary" | "outline" | "destructive"
> = {
  adicionado: "default",
  corrigido: "secondary",
  alterado: "outline",
  removido: "destructive",
};

/** "2026-08-21" → "21/08/2026" (a data já é o dia no fuso BR). */
function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default async function NovidadesPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Novidades</h1>
        <p className="text-muted-foreground">
          O que mudou no sistema, por versão e data. A versão em uso aparece no
          rodapé do menu e na tela de entrada.
        </p>
      </div>

      <div className="space-y-4">
        {CHANGELOG.map((versao) => (
          <Card key={versao.numero}>
            <CardHeader>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 className="text-lg font-semibold tracking-tight">
                  v{versao.numero}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {versao.titulo}
                  </span>
                </h2>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {formatarData(versao.data)}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {versao.mudancas.map((mudanca, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <Badge
                      variant={TIPO_VARIANTE[mudanca.tipo]}
                      className="mt-0.5 shrink-0"
                    >
                      {TIPO_LABEL[mudanca.tipo]}
                    </Badge>
                    <span className="leading-relaxed">{mudanca.texto}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
