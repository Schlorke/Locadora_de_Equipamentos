"use client";

import { PLATFORM } from "@gb-locacoes/contracts/platform";
import type { ReactNode } from "react";

/**
 * Casca das páginas de conta no host `app` (console da plataforma, não uma vitrine): uma barra com o nome provisório
 * da plataforma (`PLATFORM.displayName`) e a página abaixo, ocupando o resto da tela. Sem a navegação, o rodapé e o
 * WhatsApp da vitrine, que apontam para páginas de locadora. Cores e medidas só de token.
 */
export function PlatformShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-card">
        <div className="flex h-14 items-center px-4 md:px-6">
          <span className="text-lg font-semibold tracking-tight text-card-foreground">{PLATFORM.displayName}</span>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
