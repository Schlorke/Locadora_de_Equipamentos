// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SocialLoginButtons } from "./SocialLoginButtons.web";

afterEach(cleanup);
describe("SocialLoginButtons", () => {
  it("executa o adapter escolhido com callback preservado", async () => {
    const onSignIn = vi.fn().mockResolvedValue(undefined);
    const view = render(createElement(SocialLoginButtons, { onSignIn, callbackUrl: "/auth/callback" }));
    fireEvent.click(view.getByRole("button", { name: "Google" }));
    await waitFor(() => expect(onSignIn).toHaveBeenCalledWith("google", "/auth/callback"));
    await waitFor(() => expect(view.getByRole("button", { name: "Google" }).hasAttribute("disabled")).toBe(false));
  });
  it("apresenta erro e libera o controle quando o adapter recusa", async () => {
    const onSignIn = vi.fn().mockRejectedValue(new Error("fixture"));
    const onError = vi.fn();
    const view = render(createElement(SocialLoginButtons, { onSignIn, onError }));
    fireEvent.click(view.getByRole("button", { name: "Facebook" }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith("Falha ao fazer login com Facebook"));
    expect(view.getByRole("button", { name: "Facebook" }).hasAttribute("disabled")).toBe(false);
  });
});
