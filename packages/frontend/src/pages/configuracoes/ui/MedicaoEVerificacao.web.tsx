'use client'

import { Input, Label } from '@gb-locacoes/ui'
import {
  CAMPOS_DA_MEDICAO,
  type CampoDoConteudo,
  type ConteudoDoFormulario,
} from '../model/conteudo-do-site'

/**
 * Medição e verificação da vitrine (onda 135, A11; decisão do dono D4), na seção "SEO & Meta Tags": o ID do Google
 * Analytics 4, o do Google Ads e os códigos de verificação do Search Console e da Meta. Só o identificador: o site o põe
 * num modelo fixo. Campo vazio, nada no site. Só `@gb-locacoes/ui` e tokens.
 */
export function MedicaoEVerificacao({
  conteudo,
  erros,
  onChange,
}: {
  conteudo: ConteudoDoFormulario
  erros: Partial<Record<CampoDoConteudo, string>>
  onChange: (conteudo: ConteudoDoFormulario) => void
}) {
  return (
    <section className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground">
        Medição e verificação
      </h4>
      <p className="text-xs text-muted-foreground">
        Só o identificador de cada serviço; o site monta a tag e as metas. Campo
        vazio, nada é adicionado ao site.
      </p>
      {CAMPOS_DA_MEDICAO.map(({ campo, rotulo, exemplo, ajuda }) => (
        <div key={campo} className="space-y-1">
          <Label htmlFor={`medicao-${campo}`}>{rotulo}</Label>
          <Input
            id={`medicao-${campo}`}
            value={conteudo[campo]}
            placeholder={exemplo}
            onChange={(event) =>
              onChange({ ...conteudo, [campo]: event.target.value })
            }
          />
          <p className="text-xs text-muted-foreground">{ajuda}</p>
          {erros[campo] ? (
            <p role="alert" className="text-sm text-destructive">
              {erros[campo]}
            </p>
          ) : null}
        </div>
      ))}
    </section>
  )
}
