import { requireUser } from "@/lib/auth-guard";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { Providers } from "@/app/providers";
import { versaoDoSistema } from "@/lib/versao";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const versao = versaoDoSistema();
  const nav = {
    role: user.role,
    nome: user.name ?? user.username,
    versao: versao.rotulo,
    versaoDetalhe: versao.detalhe,
  };

  return (
    <Providers>
      <div className="flex min-h-screen w-full">
        <AppSidebar {...nav} />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileNav {...nav} />
          <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </Providers>
  );
}
