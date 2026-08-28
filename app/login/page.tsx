import { Activity, CalendarCheck, Trophy } from "lucide-react";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/logo";
import { versaoDoSistema } from "@/lib/versao";

const DESTAQUES = [
  { icon: Activity, label: "Painel em tempo real" },
  { icon: CalendarCheck, label: "Fechamento mensal" },
  { icon: Trophy, label: "Ranking de vendedores" },
];

export default function LoginPage() {
  const versao = versaoDoSistema();

  return (
    <div className="flex min-h-screen w-full flex-1 flex-col lg:flex-row">
      {/* Coluna de marca — só no desktop */}
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden border-r border-sidebar-border bg-sidebar p-10 lg:flex">
        {/* Base escura com um leve banho do gradiente de marca — mantém o painel
            navy para o logo/texto brancos lerem com nitidez, sem o gradiente
            claro chapado (que apagava o logo). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{ backgroundImage: "var(--gradient-brand)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(55rem 38rem at 15% -10%, oklch(0.62 0.19 260 / 35%), transparent 60%), radial-gradient(42rem 30rem at 110% 90%, oklch(0.82 0.13 208 / 22%), transparent 55%)",
          }}
        />

        <div className="relative z-10">
          <Logo width={200} height={52} className="h-11 w-auto" />
        </div>

        <div className="relative z-10 max-w-md">
          <h1 className="text-4xl leading-tight font-extrabold tracking-tight text-white">
            Bonificação de vendas, clara e no seu tempo.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/85">
            Acompanhe vendas, comissões e o desempenho da equipe em um só lugar, com a
            clareza que a diretoria precisa.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {DESTAQUES.map((d) => (
              <div
                key={d.label}
                className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white shadow-sm ring-1 ring-white/15 backdrop-blur-md"
              >
                <d.icon className="size-4" />
                {d.label}
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs font-medium tabular-nums text-white/60">
          {versao.rotulo} · {versao.detalhe}
        </p>
      </div>

      {/* Coluna do formulário */}
      <div className="relative flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-10">
        <div className="relative z-10 w-full max-w-[420px]">
          {/* Cabeçalho compacto da marca no mobile */}
          <div className="mb-8 flex flex-col items-center gap-2 text-center lg:hidden">
            <Logo width={200} height={52} className="h-12 w-auto" />
            <p className="text-sm text-muted-foreground">Sistema de Bonificação de Vendas</p>
          </div>

          <LoginForm />

          <p className="mt-6 text-center text-[11px] tabular-nums text-muted-foreground/60">
            {versao.rotulo} · {versao.detalhe}
          </p>
        </div>
      </div>
    </div>
  );
}
