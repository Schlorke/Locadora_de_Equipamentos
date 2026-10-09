'use client'

import { Dialog } from '@gb-locacoes/ui'
import { Button } from '@gb-locacoes/ui'
import { Input } from '@gb-locacoes/ui'
import { Label } from '@gb-locacoes/ui'
import { User } from 'lucide-react'
import { formatCPFInput, formatCNPJInput } from '../../../entities/orcamento'

// ─── Types ────────────────────────────────────────────────────────

export interface EditCustomerDraft {
  startDate: string
  endDate: string
  email: string
  phone: string
  includeWeekends: boolean
  cpf: string
  cnpj: string
  company: string
}

interface EditCustomerDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  draft: EditCustomerDraft
  onDraftChange: (
    _updater: (_prev: EditCustomerDraft) => EditCustomerDraft
  ) => void
  onSave: () => void
  isSaving: boolean
  /** Customer name for the header avatar initials */
  customerName?: string
  /** Customer image URL for the header avatar */
  customerImage?: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────

function getInitials(name: string): string | null {
  const n = (name || '').trim()
  if (!n || n === '-') return null
  const parts = n.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const a = parts[0]?.[0]
    const b = parts[parts.length - 1]?.[0]
    const s = ((a ?? '') + (b ?? '')).toUpperCase().slice(0, 2)
    return s || null
  }
  const c = parts[0]?.[0]
  return c ? c.toUpperCase() : null
}

// ─── Component ────────────────────────────────────────────────────

export function EditCustomerDialog({
  open,
  onOpenChange,
  draft,
  onDraftChange,
  onSave,
  isSaving,
  customerName = '',
  customerImage,
}: EditCustomerDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup
          variant="default"
          className="max-w-md h-auto max-h-[70vh] md:h-auto md:max-h-[70vh]"
        >
          <Dialog.Content>
            <Dialog.Header className="flex-wrap items-start gap-2 pr-12 sm:items-center sm:gap-3 pb-3">
              <Dialog.HeaderIcon className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-orange-500 sm:h-8 sm:w-8">
                {customerImage ? (
                  <img
                    src={customerImage}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
                    {getInitials(customerName) || <User className="h-4 w-4" />}
                  </span>
                )}
              </Dialog.HeaderIcon>
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Editar dados do cliente
              </Dialog.Title>
              <Dialog.CloseButton aria-label="Fechar dialog" />
            </Dialog.Header>
            <Dialog.Body className="flex-none">
              <Dialog.BodyViewport
                style={{ scrollbarGutter: 'stable' }}
                className="max-h-[50vh] overflow-y-auto"
              >
                <Dialog.BodyContent className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label
                      htmlFor="edit-company"
                      className="text-sm font-medium text-gray-700"
                    >
                      Empresa
                    </Label>
                    <Input
                      id="edit-company"
                      type="text"
                      placeholder="Nome da empresa"
                      value={draft.company}
                      onChange={(e) =>
                        onDraftChange((prev) => ({
                          ...prev,
                          company: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="edit-cpf"
                        className="text-sm font-medium text-gray-700"
                      >
                        CPF
                      </Label>
                      <Input
                        id="edit-cpf"
                        type="text"
                        placeholder="000.000.000-00"
                        value={draft.cpf}
                        onChange={(e) =>
                          onDraftChange((prev) => ({
                            ...prev,
                            cpf: formatCPFInput(e.target.value),
                          }))
                        }
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="edit-cnpj"
                        className="text-sm font-medium text-gray-700"
                      >
                        CNPJ
                      </Label>
                      <Input
                        id="edit-cnpj"
                        type="text"
                        placeholder="00.000.000/0000-00"
                        value={draft.cnpj}
                        onChange={(e) =>
                          onDraftChange((prev) => ({
                            ...prev,
                            cnpj: formatCNPJInput(e.target.value),
                          }))
                        }
                        className="font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="edit-phone"
                      className="text-sm font-medium text-gray-700"
                    >
                      Telefone
                    </Label>
                    <Input
                      id="edit-phone"
                      type="tel"
                      placeholder="(00) 00000-0000"
                      value={draft.phone}
                      onChange={(e) =>
                        onDraftChange((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="edit-email"
                      className="text-sm font-medium text-gray-700"
                    >
                      Email
                    </Label>
                    <Input
                      id="edit-email"
                      type="email"
                      placeholder="email@exemplo.com"
                      value={draft.email}
                      onChange={(e) =>
                        onDraftChange((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                    />
                  </div>
                </Dialog.BodyContent>
              </Dialog.BodyViewport>
            </Dialog.Body>
            <Dialog.Footer className="flex flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                variant="default"
                onClick={onSave}
                disabled={
                  isSaving || !draft.email.trim() || !draft.phone.trim()
                }
                className="flex-1"
              >
                {isSaving ? 'Salvando...' : 'Salvar'}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
