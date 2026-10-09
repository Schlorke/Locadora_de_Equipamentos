import { Text, View } from 'react-native'
import { Button, Input, Textarea, useTheme } from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import type {
  CampoDoConteudo,
  ConteudoDoFormulario,
} from '../model/conteudo-do-site'

type Texto = Exclude<keyof ConteudoDoFormulario, 'timeline' | 'commitments'>

/** Conteúdo do site no app (onda 134, B10): o mesmo modelo e as mesmas regras da web. */
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
  const theme = useTheme()
  const titulo = (valor: string) => (
    <Text style={{ color: theme.text, fontWeight: typography.weight.semibold }}>
      {valor}
    </Text>
  )
  const erro = (campo: CampoDoConteudo) =>
    erros[campo] ? (
      <Text accessibilityRole="alert" style={{ color: theme.danger }}>
        {erros[campo]}
      </Text>
    ) : null
  const campo = (id: Texto, rotulo: string, multilinha = false) => (
    <View style={{ gap: space.xs }}>
      <Text style={{ color: theme.text }}>{rotulo}</Text>
      {multilinha ? (
        <Textarea
          aria-label={rotulo}
          value={conteudo[id]}
          onChangeText={(valor) => onChange({ ...conteudo, [id]: valor })}
        />
      ) : (
        <Input
          aria-label={rotulo}
          value={conteudo[id]}
          onChangeText={(valor) => onChange({ ...conteudo, [id]: valor })}
        />
      )}
    </View>
  )
  return (
    <View style={{ gap: space.md }}>
      <Text style={{ color: theme.textMuted }}>
        Só aparece no site o que você preencher aqui; campo vazio, bloco de
        fora.
      </Text>
      {titulo('Números')}
      {campo('experienceYears', 'Anos de mercado')}
      {erro('experienceYears')}
      {campo('fleetSize', 'Equipamentos na frota')}
      {erro('fleetSize')}
      {campo('clientsServed', 'Clientes atendidos')}
      {erro('clientsServed')}
      {campo('projectsCompleted', 'Projetos realizados')}
      {erro('projectsCompleted')}
      {campo('citiesServed', 'Cidades atendidas')}
      {erro('citiesServed')}
      {titulo('Sobre a locadora')}
      {campo('featuredClients', 'Construtoras clientes (uma por linha)', true)}
      {erro('featuredClients')}
      {campo('history', 'Nossa história', true)}
      {erro('history')}
      {titulo('Linha do tempo (Nossa Jornada)')}
      {conteudo.timeline.map((marco, indice) => {
        const alterar = (parcial: Partial<typeof marco>) =>
          onChange({
            ...conteudo,
            timeline: conteudo.timeline.map((item, atual) =>
              atual === indice ? { ...item, ...parcial } : item
            ),
          })
        return (
          <View key={indice} style={{ gap: space.xs }}>
            <Input
              aria-label={`Marco ${indice + 1}: ano`}
              value={marco.year}
              onChangeText={(valor) => alterar({ year: valor })}
            />
            <Input
              aria-label={`Marco ${indice + 1}: título`}
              value={marco.title}
              onChangeText={(valor) => alterar({ title: valor })}
            />
            <Textarea
              aria-label={`Marco ${indice + 1}: descrição`}
              value={marco.description}
              onChangeText={(valor) => alterar({ description: valor })}
            />
            <Button
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
          </View>
        )
      })}
      <Button
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
      {titulo('Destaques do rodapé')}
      {campo('footerHighlights', 'Destaques (um por linha)', true)}
      {erro('footerHighlights')}
      {onUsarCategorias ? (
        <Button
          variant="outline"
          disabled={carregandoCategorias}
          onClick={onUsarCategorias}
        >
          {carregandoCategorias
            ? 'Carregando categorias...'
            : 'Usar minhas categorias'}
        </Button>
      ) : null}
      {titulo('Local da loja no mapa')}
      {campo('latitude', 'Latitude')}
      {campo('longitude', 'Longitude')}
      {campo('placeId', 'Place ID do Google (opcional)')}
      {campo('addressLine1', 'Endereço (linha 1)')}
      {campo('addressLine2', 'Endereço (linha 2, opcional)')}
      {erro('storeLocation')}
      {titulo('Google Avaliações do Consumidor')}
      {campo('googleMerchantId', 'ID do Merchant Center')}
      {erro('googleMerchantId')}
      {titulo('Nota de avaliações')}
      <Text style={{ color: theme.textMuted }}>
        A nota só aparece no site com o nome e o link da fonte, e nunca entra
        nos dados estruturados para os buscadores.
      </Text>
      {campo('reviewsRating', 'Nota (1 a 5)')}
      {campo('reviewsCount', 'Quantidade de avaliações')}
      {campo('reviewsSourceName', 'Nome da fonte')}
      {campo('reviewsSourceUrl', 'Link da fonte (https)')}
      {erro('reviews')}
    </View>
  )
}
