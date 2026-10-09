// Fixture de tools/token-check.mjs: css-important em código (modificador do Tailwind, estilo inline, CSS-in-JS).
import { cva } from "class-variance-authority";

declare function cn(...classes: unknown[]): string;
declare function toast(message: string): void;
declare function Panel(props: { contentClassName: string }): JSX.Element;

// Detectados: modificador important em contexto de classe (atributo, cn, chave de objeto, template, *ClassName, cva).
export function Detected({ active }: { active: boolean }) {
  return (
    <div className="p-4 !bg-card hover:!text-primary">
      <span className={cn("block", active && "md:!p-2", { "!mt-0": active })} />
      <span className={`flex ${active ? "gap-2!" : ""}`} />
      <Panel contentClassName="![position:static]" />
      <section className="!glass-panel" />
    </div>
  );
}

export const buttonVariants = cva("inline-flex !rounded-md", {
  variants: { size: { sm: "!h-8 px-2" } },
});

// Fora de um nome de classe, mas feita só de classes do Tailwind.
export const status = { pending: { color: "!bg-primary text-primary-foreground shadow-sm" } };

// Estilo inline, CSS-in-JS e setProperty com prioridade.
export const inline = { color: "var(--foreground) !important" };
export const css = `.x { display: none !important; }`;
export function Styled() {
  document.body.style.setProperty("overflow", "hidden", "important");
  return <style>{`.y { top: ${1}px ! important; }`}</style>;
}

// Sem exceção: o bloco de movimento reduzido também conta, inclusive dividido por uma substituição.
export const reduced = `@media (prefers-reduced-motion: reduce) { .z { animation: none !important; transition: ${"none"} !important; } }`;

// Um comentário de exceção não isenta a regra.
export const forced = "gap: 0 !important"; // token-check-allow: exceção pedida pelo fixture

// Negativos: texto de interface, comparação dentro de className, negação em JS e palavras soltas.
export function Negatives({ text, isReady }: { text: string; isReady: boolean }) {
  toast("Sucesso!");
  toast("Link copiado!");
  return (
    <p
      title="Endereço salvo com sucesso!"
      aria-label="copiada!"
      className={`p-2 ${text === "Link copiado!" ? "text-primary" : ""} ${!isReady ? "opacity-0" : "opacity-100"}`}
    >
      {"Tudo certo, flex!"} Atenção!
      <span className={cn("p-1", text === "copiado!" && "text-primary")} />
      <span className={text || "copiado!" ? "text-primary" : ""} />
    </p>
  );
}

export const messages = ["Sucesso!", "copiada!", "ok!", "Voltamos em breve!", "Olá! Precisa de ajuda?"];
export const words = ["important", "a != b", "importante"];
// Utilitário próprio (raiz desconhecida do Tailwind): só conta em contexto de classe, como na linha 15.
export const label = "!glass-panel";
