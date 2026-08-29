"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Provedor de tema (claro/escuro) via next-themes. Usa a classe `dark` no
 * <html> (mesma convenção do design system) e mantém o ESCURO como padrão —
 * o app sempre foi escuro; o claro é opt-in pelo botão de tema. A escolha
 * fica salva no navegador (localStorage) pelo próprio next-themes.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
