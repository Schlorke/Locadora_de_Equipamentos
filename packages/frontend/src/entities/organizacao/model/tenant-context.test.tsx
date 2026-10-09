// @vitest-environment jsdom
import { createElement, type ReactNode } from "react";
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TenantProvider, useTenantContext } from "./tenant-context";

afterEach(cleanup);
describe("contexto de locadora explícito", () => {
  it("não escolhe locadora para uma seleção ausente", () => {
    const wrapper = ({ children }: { children: ReactNode }) => createElement(TenantProvider, { value: null, children });
    expect(renderHook(useTenantContext, { wrapper }).result.current).toBeNull();
  });
  it("usa a seleção validada, inclusive o papel do vínculo", () => {
    const value = { tenant: { id: "tenant-b", slug: "locadora-b", name: "Locadora B", status: "ACTIVE" as const }, membershipId: "membership-b", role: "OPERATOR" as const };
    const wrapper = ({ children }: { children: ReactNode }) => createElement(TenantProvider, { value, children });
    expect(renderHook(useTenantContext, { wrapper }).result.current).toEqual(value);
  });
});
