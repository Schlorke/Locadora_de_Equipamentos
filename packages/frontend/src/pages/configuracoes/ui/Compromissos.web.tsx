'use client'

import { Label, Switch } from '@gb-locacoes/ui'
import { SITE_CONTENT_COMMITMENTS } from '@gb-locacoes/contracts/settings'
import {
  COMPROMISSOS,
  frasesPorCompromisso,
} from '../../../entities/configuracao'
import type { ConteudoDoFormulario } from '../model/conteudo-do-site'

/**
 * "O que você garante aos clientes" (onda 134, B10; decisão do dono D-E): os 11 compromissos comerciais, desligados
 * por padrão. Cada um mostra as frases exatas que publica no site; ligado, vira promessa da locadora (CDC, art. 30).
 * As frases vêm de `entities/configuracao/model/compromissos.ts` (a única fonte). Só `@gb-locacoes/ui` e tokens.
 */
export function Compromissos({
  conteudo,
  cidade,
  onChange,
}: {
  conteudo: ConteudoDoFormulario
  cidade?: string | null
  onChange: (conteudo: ConteudoDoFormulario) => void
}) {
  const frases = frasesPorCompromisso(cidade ?? null)
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Cada item ligado aparece no seu site como promessa da sua locadora. Pelo
        Código de Defesa do Consumidor (art. 30), a oferta publicada obriga quem
        a faz: ligue só o que você cumpre.
      </p>
      {SITE_CONTENT_COMMITMENTS.map((chave) => (
        <div key={chave} className="space-y-2 border-t border-border pt-3">
          <div className="flex items-center gap-3">
            <Switch
              id={`compromisso-${chave}`}
              checked={conteudo.commitments[chave]}
              onCheckedChange={(valor) =>
                onChange({
                  ...conteudo,
                  commitments: {
                    ...conteudo.commitments,
                    [chave]: valor === true,
                  },
                })
              }
            />
            <Label htmlFor={`compromisso-${chave}`}>
              {COMPROMISSOS[chave]}
            </Label>
          </div>
          <div className="space-y-1 pl-12">
            <p className="text-xs font-medium text-muted-foreground">
              Publica no site:
            </p>
            <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {frases[chave].map((frase) => (
                <li key={frase}>{frase}</li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  )
}

/** O que o site promete hoje com os compromissos ligados (a prévia ao lado do formulário). */
export function PreviaDosCompromissos({
  conteudo,
  cidade,
}: {
  conteudo: ConteudoDoFormulario
  cidade?: string | null
}) {
  const frases = frasesPorCompromisso(cidade ?? null)
  const ligadas = [
    ...new Set(
      SITE_CONTENT_COMMITMENTS.filter(
        (chave) => conteudo.commitments[chave]
      ).flatMap((chave) => frases[chave])
    ),
  ]
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground">
        O site promete hoje
      </h4>
      {ligadas.length > 0 ? (
        <ul className="list-disc space-y-1 pl-4 text-sm text-foreground">
          {ligadas.map((frase) => (
            <li key={frase}>{frase}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nenhum compromisso ligado: o site não faz promessas de serviço em nome
          da sua locadora.
        </p>
      )}
    </div>
  )
}
