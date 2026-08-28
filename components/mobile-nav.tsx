"use client";

import { useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { SidebarInner, type SidebarInnerProps } from "@/components/sidebar-inner";

/**
 * Barra superior + drawer da navegação no mobile. Só aparece abaixo de `lg`
 * (onde a {@link AppSidebar} fixa some). O drawer reaproveita o
 * {@link SidebarInner} e fecha ao navegar.
 */
export function MobileNav(props: Omit<SidebarInnerProps, "onNavigate">) {
  const [open, setOpen] = useState(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/95 px-3 supports-backdrop-filter:bg-background/80 supports-backdrop-filter:backdrop-blur lg:hidden">
        <DialogPrimitive.Trigger
          render={
            <Button variant="ghost" size="icon" aria-label="Abrir menu" />
          }
        >
          <Menu className="size-5" />
        </DialogPrimitive.Trigger>
        <Logo width={140} height={34} className="h-7 w-auto" />
      </header>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/50 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 lg:hidden" />
        <DialogPrimitive.Popup className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-background shadow-xl duration-200 outline-none data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left lg:hidden">
          <DialogPrimitive.Close
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute top-3 right-3 z-10"
                aria-label="Fechar menu"
              />
            }
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
          <DialogPrimitive.Title className="sr-only">
            Menu de navegação
          </DialogPrimitive.Title>
          <SidebarInner {...props} onNavigate={() => setOpen(false)} />
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
