'use client'

import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ChevronDown,
  DollarSign,
  Info,
  Landmark,
  Percent,
  RotateCcw,
  Save,
  Settings,
} from 'lucide-react'
import { Button } from '@gb-locacoes/ui'
import { Card, CardContent } from '@gb-locacoes/ui'
import { CustomSelect, CustomSelectItem } from '@gb-locacoes/ui'
import { Input } from '@gb-locacoes/ui'
import { Label } from '@gb-locacoes/ui'
import { Switch } from '@gb-locacoes/ui'
import { HybridTooltip } from '@gb-locacoes/ui'
import type { TaxRegime, FinancialSettings } from '../model/tipos'

interface TaxSettingsSectionProps {
  settings: FinancialSettings
  setSettings: React.Dispatch<React.SetStateAction<FinancialSettings>>
  showAdvancedTax: boolean
  setShowAdvancedTax: React.Dispatch<React.SetStateAction<boolean>>
  hasSettingsChanged: boolean
  savingRates: boolean
  saveRates: () => void
  resetSettings: () => void
}

export function TaxSettingsSection({
  settings,
  setSettings,
  showAdvancedTax,
  setShowAdvancedTax,
  hasSettingsChanged,
  savingRates,
  saveRates,
  resetSettings,
}: TaxSettingsSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <Card className="relative overflow-hidden border-0 shadow-xl bg-white backdrop-blur-sm transition-all duration-300">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-transparent to-gray-100/30" />
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-gray-50/40" />
        {/* Header com gradiente laranja */}
        <div className="relative z-10 px-6 py-4 border-b border-orange-800/25 bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-white/20 rounded-lg">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-white">
                  Configuração Tributária
                </h3>
                <HybridTooltip
                  content={
                    <div className="space-y-1.5">
                      <p className="font-semibold">Conformidade Fiscal</p>
                      <p>
                        Configure o regime tributário, alíquotas de retenção e
                        impostos aplicáveis à locação de equipamentos.
                      </p>
                      <p>
                        <strong>Locação pura</strong> é isenta de ISS (Súmula
                        Vinculante 31) e ICMS. Quando há serviço agregado
                        (operador, mão de obra), o ISS incide apenas sobre a
                        parcela de serviço.
                      </p>
                    </div>
                  }
                  side="right"
                  className="max-w-xs"
                >
                  <Info className="size-4 text-white cursor-help" />
                </HybridTooltip>
              </div>
              <p className="text-sm text-white/80">
                Regime, alíquotas e conformidade fiscal
              </p>
            </div>
          </div>
        </div>
        <CardContent className="relative z-10 p-6 space-y-6">
          {/* Section 1: Alíquotas de Retenção */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2 flex items-center gap-2">
              <Percent className="w-4 h-4 text-orange-500" />
              Alíquotas de Retenção
              <HybridTooltip
                content="Percentual retido na fonte por tipo de documento do cliente. Ex: CPF 6% — em R$ 1.000, governo retém R$ 60."
                side="right"
              >
                <Info className="size-3.5 text-gray-400 cursor-help transition-colors hover:text-orange-600" />
              </HybridTooltip>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(
                [
                  {
                    id: 'cpfRate',
                    label: 'CPF',
                    key: 'cpfRate' as const,
                    tooltip: 'Pessoa Física — retenção geralmente maior.',
                  },
                  {
                    id: 'cnpjRate',
                    label: 'CNPJ',
                    key: 'cnpjRate' as const,
                    tooltip: 'Pessoa Jurídica — retenção menor.',
                  },
                  {
                    id: 'cniRate',
                    label: 'CNI',
                    key: 'cniRate' as const,
                    tooltip: 'Cédula Nacional de Identidade.',
                  },
                ] as const
              ).map((field) => (
                <div key={field.id} className="space-y-1.5">
                  <Label
                    htmlFor={field.id}
                    className="text-sm font-medium text-gray-700 flex items-center gap-1.5"
                  >
                    {field.label} (%)
                    <HybridTooltip content={field.tooltip} side="right">
                      <Info className="size-3.5 text-gray-400 cursor-help transition-colors hover:text-orange-600" />
                    </HybridTooltip>
                  </Label>
                  <Input
                    id={field.id}
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={settings[field.key]}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        [field.key]: Number(e.target.value),
                      }))
                    }
                    className="transition-all duration-200"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Advanced Settings Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvancedTax((prev) => !prev)}
            className="w-full group"
          >
            <div className="relative flex items-center gap-3 py-2">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-sm text-gray-600 transition-all duration-200 group-hover:bg-orange-50 group-hover:border-orange-200 group-hover:text-orange-700">
                <Settings className="w-3.5 h-3.5" />
                <span className="font-medium">
                  {showAdvancedTax
                    ? 'Menos configurações'
                    : 'Configurações avançadas'}
                </span>
                <motion.div
                  animate={{ rotate: showAdvancedTax ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </motion.div>
              </div>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            </div>
          </button>

          {/* Advanced Settings (collapsible) */}
          <div
            className="grid transition-[grid-template-rows] duration-500 ease"
            style={{ gridTemplateRows: showAdvancedTax ? '1fr' : '0fr' }}
          >
            <div className="overflow-hidden">
              <div className="space-y-6 pt-1">
                {/* Regime Tributário */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2 flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-orange-500" />
                    Regime Tributário
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="taxRegime"
                        className="text-sm font-medium text-gray-700 flex items-center gap-1.5"
                      >
                        Regime
                        <HybridTooltip
                          content={
                            settings.taxRegime === 'SIMPLES_NACIONAL'
                              ? 'DAS unificado. Alíquota efetiva varia conforme faixa de faturamento (Anexo III).'
                              : settings.taxRegime === 'LUCRO_PRESUMIDO'
                                ? 'IRPJ 4,8% + CSLL 2,88% + PIS/COFINS 3,65% sobre receita bruta (~11,33% efetivo).'
                                : 'PIS/COFINS não-cumulativo 9,25%. IRPJ/CSLL sobre lucro real (informativo).'
                          }
                          side="right"
                        >
                          <Info className="size-3.5 text-gray-400 cursor-help transition-colors hover:text-orange-600" />
                        </HybridTooltip>
                      </Label>
                      <CustomSelect
                        triggerId="taxRegime"
                        value={settings.taxRegime}
                        onValueChange={(value) =>
                          setSettings((prev) => ({
                            ...prev,
                            taxRegime: value as TaxRegime,
                          }))
                        }
                        placeholder="Regime tributário"
                        className="w-full"
                      >
                        <CustomSelectItem value="SIMPLES_NACIONAL">
                          Simples Nacional
                        </CustomSelectItem>
                        <CustomSelectItem value="LUCRO_PRESUMIDO">
                          Lucro Presumido
                        </CustomSelectItem>
                        <CustomSelectItem value="LUCRO_REAL">
                          Lucro Real
                        </CustomSelectItem>
                      </CustomSelect>
                    </div>
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="issRate"
                        className="text-sm font-medium text-gray-700 flex items-center gap-1.5"
                      >
                        Alíquota ISS (%)
                        <HybridTooltip
                          content="Alíquota ISS do município da locadora (de 2% a 5%, conforme a lei municipal). Padrão: 2,5%."
                          side="right"
                        >
                          <Info className="size-3.5 text-gray-400 cursor-help transition-colors hover:text-orange-600" />
                        </HybridTooltip>
                      </Label>
                      <Input
                        id="issRate"
                        type="number"
                        min={0}
                        max={5}
                        step={0.1}
                        value={settings.issRate}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            issRate: Number(e.target.value),
                          }))
                        }
                        className="transition-all duration-200"
                      />
                    </div>
                    {settings.taxRegime === 'SIMPLES_NACIONAL' && (
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="simplesAliquota"
                          className="text-sm font-medium text-gray-700 flex items-center gap-1.5"
                        >
                          Alíquota Efetiva (%)
                          <HybridTooltip
                            content="Alíquota efetiva do DAS conforme faixa de faturamento (Anexo III). Varia de 6% a 33%. Deixe em branco se não aplicável. O DAS é calculado sobre o valor bruto da operação."
                            side="right"
                          >
                            <Info className="size-3.5 text-gray-400 cursor-help transition-colors hover:text-orange-600" />
                          </HybridTooltip>
                        </Label>
                        <Input
                          id="simplesAliquota"
                          type="number"
                          min={0}
                          max={33}
                          step={0.01}
                          value={settings.simplesAliquota ?? ''}
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              simplesAliquota:
                                e.target.value === ''
                                  ? null
                                  : Number(e.target.value),
                            }))
                          }
                          placeholder="Ex: 10.00"
                          className="transition-all duration-200"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      id="issExemptRental"
                      checked={settings.issExemptRental}
                      onCheckedChange={(checked) =>
                        setSettings((prev) => ({
                          ...prev,
                          issExemptRental: !!checked,
                        }))
                      }
                    />
                    <Label
                      htmlFor="issExemptRental"
                      className="text-sm text-gray-700 cursor-pointer flex items-center gap-1.5"
                    >
                      Locação pura isenta de ISS
                      <HybridTooltip
                        content="Súmula Vinculante 31 do STF: ISS não incide sobre locação de bens móveis. ISS aplica-se somente à parcela de serviço quando há operador/mão de obra."
                        side="right"
                        className="max-w-xs"
                      >
                        <Info className="size-3.5 text-gray-400 cursor-help transition-colors hover:text-orange-600" />
                      </HybridTooltip>
                    </Label>
                  </div>
                </div>

                {settings.taxRegime === 'LUCRO_PRESUMIDO' && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-orange-500" />
                      Lucro Presumido
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="irpjPresumidoRate"
                          className="text-sm font-medium text-gray-700 flex items-center gap-1.5"
                        >
                          IRPJ (%)
                          <HybridTooltip
                            content="Alíquota efetiva IRPJ sobre receita bruta. Padrão: 4,8% (presunção 32% x 15%)."
                            side="right"
                          >
                            <Info className="size-3.5 text-gray-400 cursor-help transition-colors hover:text-orange-600" />
                          </HybridTooltip>
                        </Label>
                        <Input
                          id="irpjPresumidoRate"
                          type="number"
                          min={0}
                          max={25}
                          step={0.01}
                          value={settings.irpjPresumidoRate ?? ''}
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              irpjPresumidoRate:
                                e.target.value === ''
                                  ? null
                                  : Number(e.target.value),
                            }))
                          }
                          placeholder="4.80"
                          className="transition-all duration-200"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="csllPresumidoRate"
                          className="text-sm font-medium text-gray-700 flex items-center gap-1.5"
                        >
                          CSLL (%)
                          <HybridTooltip
                            content="Alíquota efetiva CSLL sobre receita bruta. Padrão: 2,88% (presunção 32% x 9%)."
                            side="right"
                          >
                            <Info className="size-3.5 text-gray-400 cursor-help transition-colors hover:text-orange-600" />
                          </HybridTooltip>
                        </Label>
                        <Input
                          id="csllPresumidoRate"
                          type="number"
                          min={0}
                          max={15}
                          step={0.01}
                          value={settings.csllPresumidoRate ?? ''}
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              csllPresumidoRate:
                                e.target.value === ''
                                  ? null
                                  : Number(e.target.value),
                            }))
                          }
                          placeholder="2.88"
                          className="transition-all duration-200"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="pisCofinsRatePresumido"
                          className="text-sm font-medium text-gray-700 flex items-center gap-1.5"
                        >
                          PIS/COFINS (%)
                          <HybridTooltip
                            content="PIS 0,65% + COFINS 3,0% = 3,65% (cumulativo)."
                            side="right"
                          >
                            <Info className="size-3.5 text-gray-400 cursor-help transition-colors hover:text-orange-600" />
                          </HybridTooltip>
                        </Label>
                        <Input
                          id="pisCofinsRatePresumido"
                          type="number"
                          min={0}
                          max={15}
                          step={0.01}
                          value={settings.pisCofinsRate ?? ''}
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              pisCofinsRate:
                                e.target.value === ''
                                  ? null
                                  : Number(e.target.value),
                            }))
                          }
                          placeholder="3.65"
                          className="transition-all duration-200"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      Deixe em branco para usar os padrões (IRPJ 4,8% + CSLL
                      2,88% + PIS/COFINS 3,65% = ~11,33%).
                    </p>
                  </div>
                )}

                {settings.taxRegime === 'LUCRO_REAL' && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-orange-500" />
                      Lucro Real
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="pisCofinsRateReal"
                          className="text-sm font-medium text-gray-700 flex items-center gap-1.5"
                        >
                          PIS/COFINS (%)
                          <HybridTooltip
                            content="Regime não-cumulativo. PIS 1,65% + COFINS 7,6% = 9,25%. Pode variar com créditos."
                            side="right"
                          >
                            <Info className="size-3.5 text-gray-400 cursor-help transition-colors hover:text-orange-600" />
                          </HybridTooltip>
                        </Label>
                        <Input
                          id="pisCofinsRateReal"
                          type="number"
                          min={0}
                          max={15}
                          step={0.01}
                          value={settings.pisCofinsRate ?? ''}
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              pisCofinsRate:
                                e.target.value === ''
                                  ? null
                                  : Number(e.target.value),
                            }))
                          }
                          placeholder="9.25"
                          className="transition-all duration-200"
                        />
                      </div>
                      <div className="flex items-end">
                        <p className="text-xs text-gray-500 leading-relaxed">
                          IRPJ e CSLL são calculados sobre o lucro real
                          (informativo no sistema). Deixe em branco para usar o
                          padrão (9,25%).
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Reforma Tributária */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Reforma Tributária (IBS/CBS)
                    <span className="text-xs font-normal text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      Futuro
                    </span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                    <div className="space-y-1.5 sm:col-span-2">
                      <div className="flex items-center gap-3">
                        <Switch
                          id="ibsCbsActive"
                          checked={settings.ibsCbsActive}
                          onCheckedChange={(checked) =>
                            setSettings((prev) => ({
                              ...prev,
                              ibsCbsActive: !!checked,
                            }))
                          }
                        />
                        <Label
                          htmlFor="ibsCbsActive"
                          className="text-sm text-gray-700 cursor-pointer flex items-center gap-1.5"
                        >
                          IBS/CBS ativo
                          <HybridTooltip
                            content="Quando ativo, IBS+CBS substitui ISS, PIS e COFINS. Ative somente quando a Reforma Tributária estiver vigente."
                            side="right"
                            className="max-w-xs"
                          >
                            <Info className="size-3.5 text-gray-400 cursor-help transition-colors hover:text-orange-600" />
                          </HybridTooltip>
                        </Label>
                      </div>
                    </div>
                    {settings.ibsCbsActive && (
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="ibsCbsRate"
                          className="text-sm font-medium text-gray-700 flex items-center gap-1.5"
                        >
                          Alíquota IBS+CBS (%)
                        </Label>
                        <Input
                          id="ibsCbsRate"
                          type="number"
                          min={0}
                          max={35}
                          step={0.1}
                          value={settings.ibsCbsRate ?? ''}
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              ibsCbsRate:
                                e.target.value === ''
                                  ? null
                                  : Number(e.target.value),
                            }))
                          }
                          placeholder="26.50"
                          className="transition-all duration-200"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Save / Reset Buttons */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <div
              className="transition-[opacity,transform] duration-200 w-full sm:w-auto"
              style={{
                opacity: hasSettingsChanged ? 1 : 0,
                pointerEvents: hasSettingsChanged ? 'auto' : 'none',
                transform: hasSettingsChanged ? 'scale(1)' : 'scale(0.95)',
              }}
            >
              <Button
                type="button"
                variant="outline"
                onClick={resetSettings}
                disabled={savingRates}
                className="w-full sm:w-auto"
              >
                <RotateCcw className="w-4 h-4" />
                Desfazer
              </Button>
            </div>
            <Button
              variant="default"
              onClick={saveRates}
              disabled={savingRates || !hasSettingsChanged}
              className="w-full min-w-0 sm:min-w-[180px] sm:w-auto"
            >
              <Save className="w-4 h-4 mr-2" />
              {savingRates ? 'Salvando...' : 'Salvar configurações'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
