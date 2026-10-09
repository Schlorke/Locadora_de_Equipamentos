import { Button } from '@gb-locacoes/ui'
import type { useFinancialDataModel } from '../model/carga'
import type { FinancialSettings, TaxRegime } from '../model/tipos'
import { REGIME_LABELS } from '../model/tipos'
import {
  FinancialSection,
  FinancialChoices,
  FinancialField,
  FinancialText,
} from './parts.native'
type Model = ReturnType<typeof useFinancialDataModel>
export function FinancialTaxSettings({ model }: { model: Model }) {
  const field = (
    key: keyof FinancialSettings,
    label: string,
    nullable = false
  ) => (
    <FinancialField
      key={key}
      label={label + ' (%)'}
      value={String(model.settings[key] ?? '')}
      disabled={model.savingRates}
      onChange={(value) =>
        model.setSettings((previous) => ({
          ...previous,
          [key]:
            nullable && value === '' ? null : Number(value.replace(',', '.')),
        }))
      }
    />
  )
  return (
    <FinancialSection title="Configuração Tributária">
      {field('cpfRate', 'CPF')}
      {field('cnpjRate', 'CNPJ')}
      {field('cniRate', 'CNI')}
      <Button
        variant="outline"
        onClick={() => model.setShowAdvancedTax((value) => !value)}
      >
        {model.showAdvancedTax
          ? 'Menos configurações'
          : 'Configurações avançadas'}
      </Button>
      {model.showAdvancedTax ? (
        <>
          <FinancialChoices<TaxRegime>
            value={model.settings.taxRegime}
            options={
              Object.entries(REGIME_LABELS) as Array<[TaxRegime, string]>
            }
            disabled={model.savingRates}
            onChange={(taxRegime) =>
              model.setSettings((previous) => ({ ...previous, taxRegime }))
            }
          />
          {field('issRate', 'ISS')}
          <Button
            variant="outline"
            disabled={model.savingRates}
            onClick={() =>
              model.setSettings((previous) => ({
                ...previous,
                issExemptRental: !previous.issExemptRental,
              }))
            }
          >
            Isenção ISS locação:{' '}
            {model.settings.issExemptRental ? 'Ativa' : 'Inativa'}
          </Button>
          {model.settings.taxRegime === 'SIMPLES_NACIONAL'
            ? field('simplesAliquota', 'Alíquota Efetiva', true)
            : null}
          {model.settings.taxRegime === 'LUCRO_PRESUMIDO' ? (
            <>
              {field('irpjPresumidoRate', 'IRPJ Presumido', true)}
              {field('csllPresumidoRate', 'CSLL Presumido', true)}
            </>
          ) : null}
          {model.settings.taxRegime !== 'SIMPLES_NACIONAL'
            ? field('pisCofinsRate', 'PIS/COFINS', true)
            : null}
          <Button
            variant="outline"
            disabled={model.savingRates}
            onClick={() =>
              model.setSettings((previous) => ({
                ...previous,
                ibsCbsActive: !previous.ibsCbsActive,
              }))
            }
          >
            IBS/CBS: {model.settings.ibsCbsActive ? 'Ativo' : 'Inativo'}
          </Button>
          {model.settings.ibsCbsActive
            ? field('ibsCbsRate', 'IBS/CBS', true)
            : null}
        </>
      ) : null}
      <FinancialText>
        As configurações serão aplicadas a novos cálculos. Os lançamentos
        preservam seus snapshots tributários.
      </FinancialText>
      <Button
        disabled={!model.hasSettingsChanged || model.savingRates}
        onClick={() => void model.saveRates()}
      >
        {model.savingRates ? 'Salvando...' : 'Salvar alíquotas'}
      </Button>
      <Button
        variant="outline"
        disabled={!model.hasSettingsChanged || model.savingRates}
        onClick={model.resetSettings}
      >
        Restaurar alíquotas
      </Button>
    </FinancialSection>
  )
}
