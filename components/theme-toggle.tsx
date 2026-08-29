"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Alterna entre tema escuro e claro. A escolha é salva pelo next-themes.
 * Só decide o rótulo/ícone depois de montar, para não divergir do HTML do
 * servidor (que ainda não sabe o tema do navegador).
 */
export function ThemeToggle({
  className,
  compact = false,
}: {
  className?: string;
  /** Só o ícone (para cantos, ex.: tela de login). Padrão: botão com rótulo. */
  compact?: boolean;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  // `false` no servidor / primeiro paint, `true` após hidratar — sem setState
  // em efeito. Evita divergir o ícone/rótulo do HTML do servidor.
  const montado = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const escuro = resolvedTheme === "dark";
  const proximo = escuro ? "light" : "dark";
  const rotulo = montado ? `Mudar para tema ${escuro ? "claro" : "escuro"}` : "Mudar tema";
  // Antes de montar, ícone neutro para não “piscar” trocado no primeiro paint.
  const Icone = montado && !escuro ? Sun : Moon;

  if (compact) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(proximo)}
        aria-label={rotulo}
        className={cn("text-muted-foreground", className)}
      >
        <Icone className="size-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(proximo)}
      aria-label={rotulo}
      className={cn("w-full justify-start gap-2 text-muted-foreground", className)}
    >
      <Icone className="size-4" />
      <span>{montado ? (escuro ? "Tema claro" : "Tema escuro") : "Tema"}</span>
    </Button>
  );
}
