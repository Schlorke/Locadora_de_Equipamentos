'use client'

import { Button, Input, Label, Switch } from '@gb-locacoes/ui'
import { faixasDoHorario, linhaDaFaixa } from '../../../entities/configuracao'
import {
  DIAS_DO_HORARIO,
  copiarParaDiasUteis,
  horarioParaSalvar,
  type HorarioDoFormulario,
} from '../model/horario'

/**
 * Horário de funcionamento da locadora (onda 134, B10): sete dias, "Fechado" por dia, abertura e fechamento HH:MM.
 * Dia sem horário não aparece no site. Só `@gb-locacoes/ui` e tokens.
 */
export function HorarioDeFuncionamento({
  horario,
  erros,
  onChange,
}: {
  horario: HorarioDoFormulario
  erros: Partial<Record<string, string>>
  onChange: (horario: HorarioDoFormulario) => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Deixe a abertura e o fechamento vazios para o dia não aparecer no site;
        marque &quot;Fechado&quot; para mostrar o dia como fechado.
      </p>
      {DIAS_DO_HORARIO.map(({ chave, rotulo }) => {
        const dia = horario[chave]
        const erro = erros[chave]
        const alterar = (parcial: Partial<typeof dia>) =>
          onChange({ ...horario, [chave]: { ...dia, ...parcial } })
        return (
          <fieldset key={chave} className="space-y-2">
            <legend className="text-sm font-medium text-foreground">
              {rotulo}
            </legend>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id={`horario-${chave}-fechado`}
                  checked={dia.fechado}
                  onCheckedChange={(valor) =>
                    alterar({ fechado: valor === true })
                  }
                />
                <Label htmlFor={`horario-${chave}-fechado`} className="text-sm">
                  Fechado
                </Label>
              </div>
              <Input
                type="time"
                aria-label={`${rotulo}: abertura`}
                value={dia.abre}
                disabled={dia.fechado}
                onChange={(event) => alterar({ abre: event.target.value })}
                className="w-32"
              />
              <Input
                type="time"
                aria-label={`${rotulo}: fechamento`}
                value={dia.fecha}
                disabled={dia.fechado}
                onChange={(event) => alterar({ fecha: event.target.value })}
                className="w-32"
              />
            </div>
            {erro ? (
              <p role="alert" className="text-sm text-destructive">
                {erro}
              </p>
            ) : null}
          </fieldset>
        )
      })}
      <Button
        type="button"
        variant="outline"
        onClick={() => onChange(copiarParaDiasUteis(horario, 'monday'))}
      >
        Copiar segunda-feira para os dias úteis
      </Button>
    </div>
  )
}

/** Como o horário aparece no rodapé e no contato do site (as linhas da produção). */
export function PreviaDoHorario({ horario }: { horario: HorarioDoFormulario }) {
  const faixas = faixasDoHorario(horarioParaSalvar(horario).horario)
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground">No site</h4>
      {faixas.length > 0 ? (
        faixas.map((faixa) => (
          <p key={faixa.diasCurto} className="text-sm text-foreground">
            {linhaDaFaixa(faixa, 'longo')}
          </p>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">
          Sem horário informado: o site não mostra o horário.
        </p>
      )}
    </div>
  )
}
