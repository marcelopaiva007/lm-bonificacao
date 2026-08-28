import { SidebarInner, type SidebarInnerProps } from "@/components/sidebar-inner";

/**
 * Sidebar fixa do desktop. No mobile ela some — a navegação vira o drawer de
 * {@link MobileNav}. O conteúdo é o mesmo ({@link SidebarInner}).
 */
export function AppSidebar(props: Omit<SidebarInnerProps, "onNavigate">) {
  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r bg-background lg:flex">
      <SidebarInner {...props} />
    </aside>
  );
}
