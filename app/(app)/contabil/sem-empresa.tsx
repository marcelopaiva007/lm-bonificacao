import Link from "next/link";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Estado inicial do módulo: ainda não há empresa cadastrada. */
export function SemEmpresa({ podeCadastrar }: { podeCadastrar: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-muted/20 px-6 py-12 text-center">
      <Building2 className="size-8 text-muted-foreground" />
      <div>
        <p className="font-medium">Nenhuma empresa cadastrada</p>
        <p className="text-sm text-muted-foreground">
          O módulo trabalha por empresa — cadastre a primeira para começar a lançar.
        </p>
      </div>
      {podeCadastrar && (
        <Button render={<Link href="/contabil/cadastros" />}>Cadastrar empresa</Button>
      )}
    </div>
  );
}
