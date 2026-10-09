"use client";

import { type FormEvent, type ReactNode } from "react";
import { Alert, AlertDescription, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, Label, Link } from "../../../shared/ui";
import { useEnrollment } from "../model/use-enrollment";

export interface VincularLocadoraPageProps {
  /** Nome da locadora do host (lido pelo host a partir do segmento da locadora). */
  tenantName?: string | null;
}

const LOGIN_HREF = `/login?callbackUrl=${encodeURIComponent("/vincular")}`;
const CONSENT_ID = "consentimento-vinculo";

/**
 * Vínculo explícito com a locadora do host, com consentimento (ADR adr-tenant-hosts D9). Desenho provisório: o texto
 * de LGPD e o visual definitivos são a decisão U3 da ADR. Só existe no host de locadora fora do modo `legacy`.
 */
export function VincularLocadoraPage({ tenantName }: VincularLocadoraPageProps) {
  const model = useEnrollment();
  const name = tenantName?.trim() || "esta locadora";
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void model.submit();
  };

  let content: ReactNode;
  if (model.status === "checking") {
    content = <p className="text-sm text-muted-foreground">Verificando seu vínculo...</p>;
  } else if (model.status === "signed-out") {
    content = (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{`Entre na sua conta para vincular seu cadastro a ${name}.`}</p>
        <Button asChild className="w-full">
          <Link href={LOGIN_HREF}>Entrar</Link>
        </Button>
      </div>
    );
  } else if (model.status === "enrolled" || model.status === "already-member") {
    content = (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {model.status === "enrolled" ? `Pronto! Sua conta está vinculada a ${name}.` : `Sua conta já está vinculada a ${name}.`}
        </p>
        <Button asChild className="w-full">
          <Link href="/area-cliente">Ir para a área do cliente</Link>
        </Button>
      </div>
    );
  } else if (model.status === "forbidden") {
    content = <p className="text-sm text-muted-foreground">{`Seu vínculo com ${name} está suspenso ou foi encerrado. Fale com a locadora.`}</p>;
  } else if (model.status === "error") {
    content = (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>{model.error ?? "Não foi possível verificar seu vínculo."}</AlertDescription>
        </Alert>
        <Button variant="outline" className="w-full" onClick={model.retry}>
          Tentar novamente
        </Button>
      </div>
    );
  } else {
    const submitting = model.status === "submitting";
    content = (
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {`Ao vincular, ${name} passa a ver os dados do seu cadastro (nome, e-mail, telefone e CPF ou CNPJ) para responder orçamentos, fazer locações e falar com você sobre eles. Outras locadoras não veem este vínculo.`}
        </p>
        <div className="flex items-start gap-3">
          <Checkbox
            id={CONSENT_ID}
            checked={model.consent}
            onCheckedChange={(value) => model.setConsent(value === true)}
            disabled={submitting}
          />
          <Label htmlFor={CONSENT_ID} className="text-sm leading-snug">
            {`Autorizo o compartilhamento dos meus dados de cadastro com ${name}.`}
          </Label>
        </div>
        {model.error && (
          <Alert variant="destructive">
            <AlertDescription>{model.error}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" className="w-full" disabled={submitting || !model.consent}>
          {submitting ? "Vinculando..." : "Vincular minha conta"}
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href="/">Agora não</Link>
        </Button>
      </form>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <CardTitle>Vincular sua conta</CardTitle>
          <CardDescription>{`Use sua conta também em ${name}.`}</CardDescription>
        </CardHeader>
        <CardContent>{content}</CardContent>
      </Card>
    </main>
  );
}
