'use client'
import { BRAZILIAN_STATES } from '@gb-locacoes/contracts/onboarding'
import {
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@gb-locacoes/ui'
import type { CompanyForm } from '../model/draft'

const fields = [
  ['cnpj', 'CNPJ'],
  ['legalName', 'Razão social'],
  ['tradeName', 'Nome fantasia'],
  ['phone', 'Celular ou WhatsApp'],
  ['postalCode', 'CEP'],
  ['addressLine', 'Endereço'],
  ['addressNumber', 'Número'],
  ['addressComplement', 'Complemento (opcional)'],
  ['district', 'Bairro'],
  ['city', 'Cidade'],
] as const
const companies = {
  MEI: 'MEI',
  LIMITED: 'Sociedade limitada',
  INDIVIDUAL: 'Empresário individual',
  ASSOCIATION: 'Associação',
}
export function CompanyFields({
  value,
  change,
  disabled,
}: {
  value: CompanyForm
  change(value: CompanyForm): void
  disabled: boolean
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map(([field, label]) => (
        <div className="space-y-2" key={field}>
          <Label htmlFor={'company-' + field}>{label}</Label>
          <Input
            id={'company-' + field}
            value={value[field]}
            maxLength={200}
            disabled={disabled}
            onChange={(event) =>
              change({ ...value, [field]: event.target.value })
            }
            autoComplete={
              field === 'phone'
                ? 'tel'
                : field === 'postalCode'
                  ? 'postal-code'
                  : 'off'
            }
          />
        </div>
      ))}
      <div className="space-y-2">
        <Label htmlFor="company-type">Tipo da empresa</Label>
        <Select
          disabled={disabled}
          value={value.companyType}
          onValueChange={(companyType) => change({ ...value, companyType })}
        >
          <SelectTrigger id="company-type">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(companies).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="company-state">Estado</Label>
        <Select
          disabled={disabled}
          value={value.state}
          onValueChange={(state) => change({ ...value, state })}
        >
          <SelectTrigger id="company-state">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {BRAZILIAN_STATES.map((state) => (
              <SelectItem key={state} value={state}>
                {state}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2 sm:col-span-2">
        <Checkbox
          id="representation"
          checked={value.representationDeclared}
          disabled={disabled}
          onCheckedChange={(checked) =>
            change({ ...value, representationDeclared: checked === true })
          }
        />
        <Label htmlFor="representation">
          Tenho poderes para representar a empresa.
        </Label>
      </div>
    </div>
  )
}
