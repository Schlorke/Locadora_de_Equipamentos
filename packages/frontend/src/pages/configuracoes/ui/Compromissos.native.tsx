import { Text, View } from 'react-native'
import { Switch, useTheme } from '@gb-locacoes/ui'
import { space } from '@gb-locacoes/design-tokens'
import { SITE_CONTENT_COMMITMENTS } from '@gb-locacoes/contracts/settings'
import {
  COMPROMISSOS,
  frasesPorCompromisso,
} from '../../../entities/configuracao'
import type { ConteudoDoFormulario } from '../model/conteudo-do-site'

/** "O que você garante aos clientes" no app (onda 134, B10; D-E): os mesmos 11 compromissos e frases da web. */
export function Compromissos({
  conteudo,
  cidade,
  onChange,
}: {
  conteudo: ConteudoDoFormulario
  cidade?: string | null
  onChange: (conteudo: ConteudoDoFormulario) => void
}) {
  const theme = useTheme()
  const frases = frasesPorCompromisso(cidade ?? null)
  return (
    <View style={{ gap: space.md }}>
      <Text style={{ color: theme.textMuted }}>
        Cada item ligado aparece no seu site como promessa da sua locadora. Pelo
        Código de Defesa do Consumidor (art. 30), a oferta publicada obriga quem
        a faz: ligue só o que você cumpre.
      </Text>
      {SITE_CONTENT_COMMITMENTS.map((chave) => (
        <View key={chave} style={{ gap: space.xs }}>
          <Text style={{ color: theme.text }}>{COMPROMISSOS[chave]}</Text>
          <Switch
            aria-label={COMPROMISSOS[chave]}
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
          <Text style={{ color: theme.textMuted }}>Publica no site:</Text>
          {frases[chave].map((frase) => (
            <Text key={frase} style={{ color: theme.textMuted }}>
              • {frase}
            </Text>
          ))}
        </View>
      ))}
    </View>
  )
}

/** O que o site promete hoje com os compromissos ligados. */
export function PreviaDosCompromissos({
  conteudo,
  cidade,
}: {
  conteudo: ConteudoDoFormulario
  cidade?: string | null
}) {
  const theme = useTheme()
  const frases = frasesPorCompromisso(cidade ?? null)
  const ligadas = [
    ...new Set(
      SITE_CONTENT_COMMITMENTS.filter(
        (chave) => conteudo.commitments[chave]
      ).flatMap((chave) => frases[chave])
    ),
  ]
  return (
    <View style={{ gap: space.xs }}>
      <Text style={{ color: theme.text }}>O site promete hoje</Text>
      {ligadas.length > 0 ? (
        ligadas.map((frase) => (
          <Text key={frase} style={{ color: theme.text }}>
            • {frase}
          </Text>
        ))
      ) : (
        <Text style={{ color: theme.textMuted }}>
          Nenhum compromisso ligado: o site não faz promessas de serviço em nome
          da sua locadora.
        </Text>
      )}
    </View>
  )
}
