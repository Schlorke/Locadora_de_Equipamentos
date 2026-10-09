import { Text, View } from 'react-native'
import { Input, useTheme } from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import {
  CAMPOS_DA_MEDICAO,
  type CampoDoConteudo,
  type ConteudoDoFormulario,
} from '../model/conteudo-do-site'

/** Medição e verificação no app (onda 135, A11): o mesmo modelo e as mesmas regras da web. */
export function MedicaoEVerificacao({
  conteudo,
  erros,
  onChange,
}: {
  conteudo: ConteudoDoFormulario
  erros: Partial<Record<CampoDoConteudo, string>>
  onChange: (conteudo: ConteudoDoFormulario) => void
}) {
  const theme = useTheme()
  return (
    <View style={{ gap: space.md }}>
      <Text
        style={{ color: theme.text, fontWeight: typography.weight.semibold }}
      >
        Medição e verificação
      </Text>
      <Text style={{ color: theme.textMuted }}>
        Só o identificador de cada serviço; o site monta a tag e as metas. Campo
        vazio, nada é adicionado ao site.
      </Text>
      {CAMPOS_DA_MEDICAO.map(({ campo, rotulo, exemplo, ajuda }) => (
        <View key={campo} style={{ gap: space.xs }}>
          <Text style={{ color: theme.text }}>{rotulo}</Text>
          <Input
            aria-label={rotulo}
            value={conteudo[campo]}
            placeholder={exemplo}
            onChangeText={(valor) => onChange({ ...conteudo, [campo]: valor })}
          />
          <Text style={{ color: theme.textMuted }}>{ajuda}</Text>
          {erros[campo] ? (
            <Text accessibilityRole="alert" style={{ color: theme.danger }}>
              {erros[campo]}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  )
}
