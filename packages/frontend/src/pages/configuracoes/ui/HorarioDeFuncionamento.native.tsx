import { Text, View } from 'react-native'
import { Button, Input, Switch, useTheme } from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import { faixasDoHorario, linhaDaFaixa } from '../../../entities/configuracao'
import {
  DIAS_DO_HORARIO,
  copiarParaDiasUteis,
  horarioParaSalvar,
  type HorarioDoFormulario,
} from '../model/horario'

/** Horário de funcionamento no app (onda 134, B10): o mesmo modelo da web, com HH:MM digitado. */
export function HorarioDeFuncionamento({
  horario,
  erros,
  onChange,
}: {
  horario: HorarioDoFormulario
  erros: Partial<Record<string, string>>
  onChange: (horario: HorarioDoFormulario) => void
}) {
  const theme = useTheme()
  return (
    <View style={{ gap: space.md }}>
      <Text style={{ color: theme.textMuted }}>
        Deixe a abertura e o fechamento vazios para o dia não aparecer no site;
        marque &quot;Fechado&quot; para mostrar o dia como fechado. Use HH:MM.
      </Text>
      {DIAS_DO_HORARIO.map(({ chave, rotulo }) => {
        const dia = horario[chave]
        const alterar = (parcial: Partial<typeof dia>) =>
          onChange({ ...horario, [chave]: { ...dia, ...parcial } })
        return (
          <View key={chave} style={{ gap: space.xs }}>
            <Text
              style={{
                color: theme.text,
                fontWeight: typography.weight.semibold,
              }}
            >
              {rotulo}
            </Text>
            <Switch
              aria-label={`${rotulo}: fechado`}
              checked={dia.fechado}
              onCheckedChange={(valor) => alterar({ fechado: valor === true })}
            />
            <Input
              aria-label={`${rotulo}: abertura`}
              value={dia.abre}
              disabled={dia.fechado}
              onChangeText={(valor) => alterar({ abre: valor })}
            />
            <Input
              aria-label={`${rotulo}: fechamento`}
              value={dia.fecha}
              disabled={dia.fechado}
              onChangeText={(valor) => alterar({ fecha: valor })}
            />
            {erros[chave] ? (
              <Text accessibilityRole="alert" style={{ color: theme.danger }}>
                {erros[chave]}
              </Text>
            ) : null}
          </View>
        )
      })}
      <Button
        variant="outline"
        onClick={() => onChange(copiarParaDiasUteis(horario, 'monday'))}
      >
        Copiar segunda-feira para os dias úteis
      </Button>
    </View>
  )
}

/** Como o horário aparece no site. */
export function PreviaDoHorario({ horario }: { horario: HorarioDoFormulario }) {
  const theme = useTheme()
  const faixas = faixasDoHorario(horarioParaSalvar(horario).horario)
  return (
    <View style={{ gap: space.xs }}>
      <Text
        style={{ color: theme.text, fontWeight: typography.weight.semibold }}
      >
        No site
      </Text>
      {faixas.length > 0 ? (
        faixas.map((faixa) => (
          <Text key={faixa.diasCurto} style={{ color: theme.text }}>
            {linhaDaFaixa(faixa, 'longo')}
          </Text>
        ))
      ) : (
        <Text style={{ color: theme.textMuted }}>
          Sem horário informado: o site não mostra o horário.
        </Text>
      )}
    </View>
  )
}
