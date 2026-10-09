'use client'
import { useId } from 'react'
import { Building2 } from 'lucide-react'
import { Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@gb-locacoes/ui'
import { suggestionPrompt, type TenantSelectorProps } from './contract'

const ROW = 'flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 md:px-6'

/**
 * Seletor de locadora do painel no web: barra compacta no topo da área privada. O rótulo "Locadora" nomeia o seletor;
 * a pergunta do `?locadora=` (D8) e o erro ficam na própria barra. Só componentes do design system e cores de token.
 */
export function TenantSelector({
  memberships,
  selection,
  loading,
  error,
  onSelect,
  onRetry,
  suggestion = null,
  onConfirmSuggestion,
  onDismissSuggestion,
}: TenantSelectorProps) {
  const selectorId = useId()
  const pending = suggestion && onConfirmSuggestion && onDismissSuggestion ? suggestionPrompt(suggestion, selection) : null
  return (
    <div role="region" aria-label="Locadora do painel" className="border-b border-border bg-card text-card-foreground">
      <div className={ROW}>
        <Label htmlFor={selectorId} className="flex items-center gap-2 text-muted-foreground">
          <Building2 aria-hidden className="h-4 w-4" />
          Locadora
        </Label>
        <Select value={selection?.tenant.id ?? ''} onValueChange={onSelect} disabled={loading}>
          <SelectTrigger id={selectorId} className="h-9 min-w-0 flex-1 sm:w-72 sm:flex-none">
            <SelectValue placeholder={loading ? 'Carregando locadoras...' : 'Selecione uma locadora'} />
          </SelectTrigger>
          <SelectContent>
            {memberships.map((item) => (
              <SelectItem key={item.membershipId} value={item.tenant.id}>
                {item.tenant.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!loading && !error && !memberships.length && (
          <p className="text-sm text-muted-foreground">Nenhuma locadora está vinculada à sua conta.</p>
        )}
        {error && (
          <>
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
            <Button variant="outline" size="compact" onClick={onRetry}>
              Tentar novamente
            </Button>
          </>
        )}
      </div>
      {pending && (
        <div className={`${ROW} border-t border-border bg-muted`}>
          <p className="min-w-0 grow basis-64 text-sm">{pending.question}</p>
          <div className="flex gap-2">
            <Button size="compact" onClick={onConfirmSuggestion}>
              {pending.confirm}
            </Button>
            <Button size="compact" variant="outline" onClick={onDismissSuggestion}>
              Agora não
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
