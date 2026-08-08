import { requireUser } from "@/lib/auth-guard";
import { redirect } from "next/navigation";
import { getAuditLogs } from "@/lib/auditoria";
import { AuditoriaView } from "./auditoria-view";

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ modulo?: string; acao?: string; busca?: string; periodo?: string }>;
}) {
  const user = await requireUser();
  if (user.role !== "ADMIN" && user.role !== "DIRETORIA") {
    redirect("/");
  }

  const params = await searchParams;
  const logs = await getAuditLogs({
    modulo: params.modulo,
    acao: params.acao,
    busca: params.busca,
    periodo: params.periodo,
  });

  return (
    <AuditoriaView
      logs={logs}
      filtros={{
        modulo: params.modulo ?? "TODOS",
        acao: params.acao ?? "TODAS",
        busca: params.busca ?? "",
        periodo: params.periodo ?? "",
      }}
    />
  );
}
