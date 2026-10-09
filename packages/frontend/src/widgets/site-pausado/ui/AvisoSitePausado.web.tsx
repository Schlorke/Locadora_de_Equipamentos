import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@gb-locacoes/ui'
import { linksDeContato, type ContatoDaLocadora } from '../model/contato'

export interface AvisoSitePausadoProps {
  /** Nome público da locadora (cartão público). */
  readonly nome: string
  readonly contato: ContatoDaLocadora
  /** Entrada da área do cliente no host da locadora; `null` quando o host não tem conta (modo legacy). */
  readonly areaDoClienteHref: string | null
}

/**
 * Aviso neutro do site em pausa (S13): não cita assinatura, cobrança nem plataforma. Mostra o contato da locadora e
 * a entrada da área do cliente, que continua funcionando. Só componentes de `@gb-locacoes/ui` e cores de token.
 */
export function AvisoSitePausado({
  nome,
  contato,
  areaDoClienteHref,
}: AvisoSitePausadoProps) {
  const links = linksDeContato(contato)
  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle role="heading" aria-level={1}>
          Site temporariamente indisponível
        </CardTitle>
        <CardDescription>
          O site de {nome} está fora do ar no momento. Para falar com a
          locadora, use os contatos abaixo.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {links.length > 0 ? (
          <ul className="flex flex-col gap-2 text-foreground">
            {links.map((link) => (
              <li key={link.rotulo}>
                <span className="font-medium">{link.rotulo}:</span>{' '}
                <a
                  href={link.href}
                  className="underline underline-offset-4"
                  {...(link.rotulo === 'WhatsApp'
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                >
                  {link.valor}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">
            Os contatos da locadora ainda não foram informados.
          </p>
        )}
        {areaDoClienteHref ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Já é cliente? Seus contratos e cobranças continuam disponíveis.
            </p>
            <Button asChild variant="outline" className="self-start">
              <a href={areaDoClienteHref}>Acessar a área do cliente</a>
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
