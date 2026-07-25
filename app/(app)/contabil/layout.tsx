import { Calculator } from "lucide-react";
import { requireContabilAccess } from "@/lib/contabil-auth-guard";
import { ContabilNav } from "./contabil-nav";

export default async function ContabilLayout({ children }: { children: React.ReactNode }) {
  const user = await requireContabilAccess();

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg border bg-muted/40 p-2">
          <Calculator className="size-6 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contabilidade</h1>
          <p className="text-muted-foreground">
            Resultado mensal, impostos e fechamento — por empresa.
          </p>
        </div>
      </div>

      <ContabilNav role={user.role} />

      {children}
    </div>
  );
}
