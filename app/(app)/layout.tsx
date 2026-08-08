import { requireUser } from "@/lib/auth-guard";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { Providers } from "@/app/providers";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <Providers>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar role={user.role} nome={user.name ?? user.username} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader role={user.role} nome={user.name ?? user.username} />
          <main className="flex-1 overflow-y-auto p-6 md:p-8">{children}</main>
        </div>
      </div>
    </Providers>
  );
}
