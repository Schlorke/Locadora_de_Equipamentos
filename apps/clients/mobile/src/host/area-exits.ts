/** Router mínimo do expo-router usado pelas saídas das telas provisórias. */
export interface ExitRouter {
  canGoBack(): boolean;
  back(): void;
  replace(href: string): void;
}

export const HOME_HREF = "/";

/**
 * Saídas reais das telas que ainda não existem no app: voltar para onde a pessoa estava (ou ao
 * início, se a pilha estiver vazia) e encerrar a sessão. Depois de sair, a troca de rota faz o
 * runtime recarregar a sessão e limpar a locadora selecionada e o carrinho da identidade anterior.
 */
export function createAreaExits({ router, signOut }: { router: ExitRouter; signOut: () => Promise<unknown> }) {
  return {
    back() {
      if (router.canGoBack()) router.back();
      else router.replace(HOME_HREF);
    },
    async signOut() {
      await signOut();
      router.replace(HOME_HREF);
    },
  };
}
