'use client'

import type { ReactNode } from 'react'
import { Button, Input, Label, Textarea } from '@gb-locacoes/ui'
import type {
  CampoDoConteudo,
  ConteudoDoFormulario,
  MarcoDoFormulario,
} from '../model/conteudo-do-site'

type Texto = Exclude<keyof ConteudoDoFormulario, 'timeline' | 'commitments'>

/**
 * Conteúdo institucional do site da locadora (onda 134, B10): números, construtoras, história, linha do tempo,
 * destaques do rodapé, local no mapa, Merchant Center e nota de avaliações com a fonte. Campo vazio não aparece no site.
 * Só `@gb-locacoes/ui` e tokens.
 */
export function ConteudoDoSite({
  conteudo,
  erros,
  onChange,
  onUsarCategorias,
  carregandoCategorias = false,
}: {
  conteudo: ConteudoDoFormulario
  erros: Partial<Record<CampoDoConteudo, string>>
  onChange: (conteudo: ConteudoDoFormulario) => void
  onUsarCategorias?: () => void
  carregandoCategorias?: boolean
}) {
  const alterar = (campo: Texto, valor: string) =>
    onChange({ ...conteudo, [campo]: valor })
  const erro = (campo: CampoDoConteudo) =>
    erros[campo] ? (
      <p role="alert" className="text-sm text-destructive">
        {erros[campo]}
      </p>
    ) : null
  const campo = (
    id: Texto,
    rotulo: string,
    ajuda?: ReactNode,
    grupo?: CampoDoConteudo,
    textarea = false
  ) => (
    <div className="space-y-1">
      <Label htmlFor={`conteudo-${id}`}>{rotulo}</Label>
      {textarea ? (
        <Textarea
          id={`conteudo-${id}`}
          value={conteudo[id]}
          onChange={(event) => alterar(id, event.target.value)}
          rows={4}
        />
      ) : (
        <Input
          id={`conteudo-${id}`}
          value={conteudo[id]}
          onChange={(event) => alterar(id, event.target.value)}
        />
      )}
      {ajuda ? <p className="text-xs text-muted-foreground">{ajuda}</p> : null}
      {grupo ? null : erro(id as CampoDoConteudo)}
    </div>
  )
  const marco = (indice: number, parcial: Partial<MarcoDoFormulario>) =>
    onChange({
      ...conteudo,
      timeline: conteudo.timeline.map((item, atual) =>
        atual === indice ? { ...item, ...parcial } : item
      ),
    })
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Só aparece no site o que você preencher aqui; campo vazio, bloco de
        fora.
      </p>
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Números</h4>
        {campo('experienceYears', 'Anos de mercado')}
        {campo('fleetSize', 'Equipamentos na frota')}
        {campo('clientsServed', 'Clientes atendidos')}
        {campo('projectsCompleted', 'Projetos realizados')}
        {campo('citiesServed', 'Cidades atendidas')}
      </section>
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">
          Sobre a locadora
        </h4>
        {campo(
          'featuredClients',
          'Construtoras clientes',
          'Uma por linha, até 12.',
          undefined,
          true
        )}
        {campo(
          'history',
          'Nossa história',
          'Primeiro parágrafo da página Sobre; sem ele, o texto "Sobre nós".',
          undefined,
          true
        )}
      </section>
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">
          Linha do tempo (Nossa Jornada)
        </h4>
        {conteudo.timeline.map((item, indice) => (
          <fieldset
            key={indice}
            className="space-y-2 border-t border-border pt-3"
          >
            <legend className="text-sm text-muted-foreground">
              Marco {indice + 1}
            </legend>
            <Input
              aria-label={`Marco ${indice + 1}: ano`}
              placeholder="Ano"
              value={item.year}
              onChange={(event) => marco(indice, { year: event.target.value })}
            />
            <Input
              aria-label={`Marco ${indice + 1}: título`}
              placeholder="Título"
              value={item.title}
              onChange={(event) => marco(indice, { title: event.target.value })}
            />
            <Textarea
              aria-label={`Marco ${indice + 1}: descrição`}
              placeholder="Descrição"
              value={item.description}
              onChange={(event) =>
                marco(indice, { description: event.target.value })
              }
              rows={2}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                onChange({
                  ...conteudo,
                  timeline: conteudo.timeline.filter(
                    (_item, atual) => atual !== indice
                  ),
                })
              }
            >
              Remover marco
            </Button>
          </fieldset>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onChange({
              ...conteudo,
              timeline: [
                ...conteudo.timeline,
                { year: '', title: '', description: '' },
              ],
            })
          }
        >
          Adicionar marco
        </Button>
        {erro('timeline')}
      </section>
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">
          Destaques do rodapé (coluna Equipamentos)
        </h4>
        {campo(
          'footerHighlights',
          'Destaques',
          'Um por linha, até 8.',
          undefined,
          true
        )}
        {onUsarCategorias ? (
          <Button
            type="button"
            variant="outline"
            disabled={carregandoCategorias}
            onClick={onUsarCategorias}
          >
            {carregandoCategorias
              ? 'Carregando categorias...'
              : 'Usar minhas categorias'}
          </Button>
        ) : null}
      </section>
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">
          Local da loja no mapa
        </h4>
        {campo('latitude', 'Latitude', undefined, 'storeLocation')}
        {campo('longitude', 'Longitude', undefined, 'storeLocation')}
        {campo(
          'placeId',
          'Place ID do Google (opcional)',
          undefined,
          'storeLocation'
        )}
        {campo(
          'addressLine1',
          'Endereço (linha 1)',
          undefined,
          'storeLocation'
        )}
        {campo(
          'addressLine2',
          'Endereço (linha 2, opcional)',
          undefined,
          'storeLocation'
        )}
        {erro('storeLocation')}
      </section>
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">
          Google Avaliações do Consumidor
        </h4>
        {campo(
          'googleMerchantId',
          'ID do Merchant Center',
          'Mostra o selo do Google na página Sobre e a pesquisa depois do pedido de orçamento.'
        )}
      </section>
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">
          Nota de avaliações
        </h4>
        <p className="text-xs text-muted-foreground">
          A nota só aparece no site com o nome e o link da fonte (por exemplo, o
          seu perfil no Google), e nunca entra nos dados estruturados para os
          buscadores.
        </p>
        {campo('reviewsRating', 'Nota (1 a 5)', undefined, 'reviews')}
        {campo(
          'reviewsCount',
          'Quantidade de avaliações',
          undefined,
          'reviews'
        )}
        {campo('reviewsSourceName', 'Nome da fonte', undefined, 'reviews')}
        {campo(
          'reviewsSourceUrl',
          'Link da fonte (https)',
          undefined,
          'reviews'
        )}
        {erro('reviews')}
      </section>
    </div>
  )
}
