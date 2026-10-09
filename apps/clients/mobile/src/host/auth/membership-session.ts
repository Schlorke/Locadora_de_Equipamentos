import type { MembershipRole } from "@gb-locacoes/frontend/app";

export interface HostSession {
  user?: { id?: string; email?: string | null; name?: string | null; role?: string | null };
}

/**
 * Sessão entregue às páginas de entrada (login, entrar, callback): o papel exposto é o do vínculo
 * na locadora selecionada, nunca `User.role` global. Sem seleção, o papel fica nulo e o destino
 * calculado pelo frontend é neutro.
 */
export function withMembershipRole<T extends HostSession>(
  getSession: () => Promise<T | null>,
  readRole: () => MembershipRole | null,
): () => Promise<T | null> {
  return async () => {
    const session = await getSession();
    if (!session?.user) return session;
    return { ...session, user: { ...session.user, role: readRole() } } as T;
  };
}
