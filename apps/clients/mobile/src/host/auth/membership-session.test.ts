import { describe, expect, it, vi } from "vitest";
import type { MembershipRole } from "@gb-locacoes/frontend/app";
import { withMembershipRole, type HostSession } from "./membership-session";

describe("withMembershipRole", () => {
  it("troca User.role global pelo papel da locadora selecionada", async () => {
    const getSession = vi.fn(async () => ({ user: { id: "u1", email: "pessoa@example.test", role: "ADMIN" } }));
    const read = withMembershipRole(getSession, () => "CLIENT");
    expect(await read()).toEqual({ user: { id: "u1", email: "pessoa@example.test", role: "CLIENT" } });
  });

  it("sem locadora selecionada entrega papel nulo, mesmo que o usuário legado seja ADMIN", async () => {
    const read = withMembershipRole(async () => ({ user: { id: "u1", email: "admin@example.test", role: "ADMIN" } }), () => null);
    expect((await read())?.user?.role).toBeNull();
  });

  it("lê o papel no momento da chamada", async () => {
    let role: MembershipRole | null = null;
    const read = withMembershipRole(async (): Promise<HostSession> => ({ user: { id: "u1" } }), () => role);
    expect((await read())?.user?.role).toBeNull();
    role = "ADMIN";
    expect((await read())?.user?.role).toBe("ADMIN");
  });

  it("não cria sessão onde não há usuário", async () => {
    expect(await withMembershipRole(async () => null, () => "ADMIN")()).toBeNull();
    expect(await withMembershipRole(async () => ({}), () => "ADMIN")()).toEqual({});
  });
});
