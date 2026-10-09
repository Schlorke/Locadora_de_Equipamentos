import { useState } from 'react'
import { Text, View } from 'react-native'
import {
  Button,
  Card,
  CurrencyInput,
  CustomSelect,
  CustomSelectItem,
  ImageUpload,
  Input,
  Switch,
  Textarea,
  useTheme,
} from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import type { useNewEquipment } from '../model/use-new-equipment'
import type { EquipmentFormPageProps, PricingPeriod } from '../model/tipos'
import { PRICING_PERIOD_CONFIG } from '../model/tipos'
import { useEquipmentSpecifications } from '../model/use-equipment-specifications'
import { standardPeriodPrice } from '../model/pricing-preview'
import {
  pickEquipmentImages,
  useEquipmentUpload,
} from '../model/use-equipment-upload'
import { EquipmentGallery } from './Galeria.native'
export function EquipmentForm({
  model: m,
  image,
  pickImages,
  busy,
  editing = false,
}: EquipmentFormPageProps & {
  model: ReturnType<typeof useNewEquipment>
  busy: boolean
  editing?: boolean
}) {
  const theme = useTheme(),
    f = m.formData,
    s = useEquipmentSpecifications(m.handleAddSpecification)
  const periods = Object.keys(PRICING_PERIOD_CONFIG) as PricingPeriod[]
  const [preview, setPreview] = useState<PricingPeriod>('weekly')
  const selected = f[(preview + 'RentalEnabled') as keyof typeof f]
    ? preview
    : (periods.find((p) =>
        Boolean(f[(p + 'RentalEnabled') as keyof typeof f])
      ) ?? preview)
  const upload = useEquipmentUpload(m.api, m.apiClient)
  const choose = pickImages
    ? (remaining: number) =>
        pickEquipmentImages(pickImages, upload, remaining, () =>
          m.apiClient.isCurrent()
        )
    : undefined
  const text = { color: theme.text },
    heading = {
      ...text,
      fontSize: typography.size.lg,
      fontWeight: typography.weight.bold,
    }
  const multipliers = { daily: 1, weekly: 7, biweekly: 15, monthly: 30 }
  const amount = (period: PricingPeriod) =>
    standardPeriodPrice(f.pricePerDay, {
      useDirectValue: f[
        (period + 'UseDirectValue') as keyof typeof f
      ] as boolean,
      directValue: f[(period + 'DirectValue') as keyof typeof f] as number,
      multiplier: multipliers[period],
      discount: f[(period + 'Discount') as keyof typeof f] as number,
    })
  const money = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const change = <K extends keyof typeof f>(key: K, value: (typeof f)[K]) =>
    m.setFormData((prev) => ({ ...prev, [key]: value }))
  return (
    <View style={{ gap: space.md }}>
      <Card>
        <View style={{ padding: space.md, gap: space.sm }}>
          <Text accessibilityRole="header" style={heading}>
            Informações Básicas
          </Text>
          <Text style={text}>Nome do Equipamento</Text>
          <Input
            aria-label="Nome do Equipamento"
            value={f.name}
            disabled={busy}
            onChangeText={(value) => change('name', value)}
          />
          <Text style={text}>Descrição</Text>
          <Textarea
            aria-label="Descrição"
            value={f.description}
            disabled={busy}
            onChangeText={(value) => change('description', value)}
          />
          <Text style={text}>Categoria</Text>
          <CustomSelect
            value={f.categoryId}
            disabled={busy}
            placeholder="Selecione uma categoria"
            onValueChange={(value) => change('categoryId', value)}
          >
            {m.categories.map((c) => (
              <CustomSelectItem key={c.id} value={c.id}>
                {c.name}
              </CustomSelectItem>
            ))}
          </CustomSelect>
          <Text style={text}>Disponível para locação</Text>
          <Switch
            aria-label="Disponível para locação"
            checked={f.isAvailable}
            disabled={busy}
            onCheckedChange={(value) => change('isAvailable', value)}
          />
          <Text style={text}>Estoque Máximo</Text>
          <Input
            type="number"
            aria-label="Estoque Máximo"
            value={String(f.maxStock)}
            disabled={busy}
            onChangeText={(value) => change('maxStock', parseInt(value) || 1)}
          />
        </View>
      </Card>
      <Card>
        <View style={{ padding: space.md, gap: space.sm }}>
          <Text accessibilityRole="header" style={heading}>
            Configuração de Preços
          </Text>
          <Text style={text}>
            Preço por Dia (R$)
            {m.hasAnyPercentageDiscount ? ' — obrigatório' : ''}
          </Text>
          <CurrencyInput
            aria-label="Preço por Dia (R$)"
            value={f.pricePerDay}
            disabled={busy || !m.hasAnyPercentageDiscount}
            onValueChange={(value) => change('pricePerDay', value)}
          />
          <Text style={text}>Período Popular</Text>
          <CustomSelect
            value={f.popularPeriod}
            disabled={busy}
            placeholder="Período popular"
            onValueChange={(value) => change('popularPeriod', value)}
          >
            {periods.map((p) => (
              <CustomSelectItem key={p} value={p}>
                {PRICING_PERIOD_CONFIG[p].label}
              </CustomSelectItem>
            ))}
          </CustomSelect>
          {periods.map((period) => {
            const enabledKey = (period + 'RentalEnabled') as keyof typeof f,
              directKey = (period + 'UseDirectValue') as keyof typeof f,
              discountKey = (period + 'Discount') as keyof typeof f,
              valueKey = (period + 'DirectValue') as keyof typeof f,
              enabled = Boolean(f[enabledKey]),
              direct = Boolean(f[directKey])
            return (
              <View key={period} style={{ gap: space.sm }}>
                <Text accessibilityRole="header" style={heading}>
                  {PRICING_PERIOD_CONFIG[period].label}
                </Text>
                <Text style={text}>
                  {PRICING_PERIOD_CONFIG[period].disableLabel}
                </Text>
                <Switch
                  aria-label={PRICING_PERIOD_CONFIG[period].disableLabel}
                  checked={!enabled}
                  disabled={busy}
                  onCheckedChange={(value) => change(enabledKey, !value)}
                />
                <Text style={text}>Usar desconto percentual</Text>
                <Switch
                  aria-label={period + ' — Usar desconto percentual'}
                  checked={!direct}
                  disabled={busy || !enabled}
                  onCheckedChange={(value) => change(directKey, !value)}
                />
                <Input
                  aria-label={period + ' — Desconto (%)'}
                  type="number"
                  value={String(f[discountKey])}
                  disabled={busy || !enabled || direct}
                  onChangeText={(value) =>
                    change(
                      discountKey,
                      Math.min(100, Math.max(0, parseInt(value) || 0))
                    )
                  }
                />
                <Text style={text}>Usar valor direto</Text>
                <Switch
                  aria-label={period + ' — Usar valor direto'}
                  checked={direct}
                  disabled={busy || !enabled}
                  onCheckedChange={(value) => change(directKey, value)}
                />
                <CurrencyInput
                  aria-label={period + ' — Valor direto (R$)'}
                  value={f[valueKey] as number}
                  disabled={busy || !enabled || !direct}
                  onValueChange={(value) => change(valueKey, value)}
                />
              </View>
            )
          })}
        </View>
      </Card>
      <Card>
        <View style={{ padding: space.md, gap: space.sm }}>
          <Text accessibilityRole="header" style={heading}>
            Preview de Preços
          </Text>
          {periods.map((p) => (
            <Button
              key={p}
              variant={selected === p ? 'default' : 'outline'}
              disabled={!f[(p + 'RentalEnabled') as keyof typeof f]}
              onClick={() => setPreview(p)}
            >
              {PRICING_PERIOD_CONFIG[p].label}
              {f.popularPeriod === p ? ' — Popular' : ''}
            </Button>
          ))}
          <Text style={text}>
            {money(amount(selected))} / {multipliers[selected]} dia(s)
          </Text>
          <Text style={text}>
            {money(amount(preview) / multipliers[preview])} por dia
          </Text>
        </View>
      </Card>
      <Card>
        <View style={{ padding: space.md, gap: space.sm }}>
          <EquipmentGallery
            images={f.images}
            name={f.name || 'Equipamento'}
            image={image}
          />
          <ImageUpload
            sectionTitle="Imagens do Equipamento"
            images={f.images}
            maxImages={5}
            disabled={busy}
            chooseImages={choose}
            renderImage={
              image ? (src, alt) => image({ src, alt, height: 120 }) : undefined
            }
            onImagesChange={(images) => change('images', images)}
          />
        </View>
      </Card>
      <Card>
        <View style={{ padding: space.md, gap: space.sm }}>
          <Text accessibilityRole="header" style={heading}>
            Especificações Técnicas
          </Text>
          {Object.entries(f.specifications || {}).map(([key, value]) => (
            <View key={key}>
              <Text style={text}>
                {key}: {value}
              </Text>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => m.handleRemoveSpecification(key)}
              >
                Remover Especificação {key}
              </Button>
            </View>
          ))}
          <Input
            aria-label="Nome da Especificação"
            value={s.specKey}
            disabled={busy}
            onChangeText={s.setSpecKey}
          />
          <Input
            aria-label="Valor da Especificação"
            value={s.specValue}
            disabled={busy}
            onChangeText={s.setSpecValue}
          />
          <Button disabled={busy} onClick={s.handleAddSpecification}>
            Adicionar Especificação
          </Button>
        </View>
      </Card>
      <Button disabled={busy} onClick={() => void m.submit()}>
        {busy
          ? 'Salvando...'
          : editing
            ? 'Salvar Alterações'
            : 'Criar Equipamento'}
      </Button>
    </View>
  )
}
