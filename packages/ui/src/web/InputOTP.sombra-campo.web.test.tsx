// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "./InputOTP.web";

function Exemplo({ inputRef }: { inputRef?: React.Ref<HTMLInputElement> }) {
  return (
    <InputOTP maxLength={3} ref={inputRef}>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
      </InputOTPGroup>
    </InputOTP>
  );
}

describe("InputOTP: sombra de campo", () => {
  afterEach(cleanup);

  it("tira só o box-shadow inline do input-otp, para a sombra de campo do CSS valer sem !important", () => {
    const { container } = render(<Exemplo />);
    const input = container.querySelector<HTMLInputElement>("input[data-input-otp]");
    expect(input).not.toBeNull();
    expect(input?.style.getPropertyValue("box-shadow")).toBe("");
    // As outras declarações inline da biblioteca continuam (campo invisível sobre os slots).
    expect(input?.style.position).toBe("absolute");
    expect(input?.style.color).toBe("transparent");
  });

  it("repassa a referência do campo para quem usa o componente", () => {
    const objeto = React.createRef<HTMLInputElement>();
    const { container, unmount } = render(<Exemplo inputRef={objeto} />);
    expect(objeto.current).toBe(container.querySelector("input[data-input-otp]"));
    unmount();

    const recebidos: Array<HTMLInputElement | null> = [];
    const { container: segundo } = render(<Exemplo inputRef={(node) => void recebidos.push(node)} />);
    expect(recebidos[0]).toBe(segundo.querySelector("input[data-input-otp]"));
  });
});
