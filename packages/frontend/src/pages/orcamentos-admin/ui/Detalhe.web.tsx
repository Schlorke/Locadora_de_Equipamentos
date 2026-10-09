'use client'

import {
  useTenantContext,
  usePublicTenantSlug,
} from '../../../entities/organizacao'
import { useSession } from '../../../entities/sessao'
import { useScopedApiClient, isAbortError } from '../../../shared/api'
import { createAdminQuotesApi } from '../api/admin-quotes'
import { use, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@gb-locacoes/ui'
import { Card, CardContent } from '@gb-locacoes/ui'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type Quote = {
  id: string
  quoteCode: string | null
  legacyExternalCode: string | null
  name: string
  email: string
  phone: string | null
  company: string | null
  totalPrice: number
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  createdAt: string
  startDate: string | null
  endDate: string | null
  items: Array<{
    id: string
    quantity: number
    days: number
    pricePerDay: number
    total: number
    startDate: string | null
    endDate: string | null
    equipment: {
      id: string
      name: string
      images: string[]
    }
  }>
}

function QuoteDetailPageContent({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const apiClient = useScopedApiClient(id)
  const quoteApi = useMemo(() => createAdminQuotesApi(apiClient), [apiClient])
  const router = useRouter()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchQuote() {
      try {
        setLoading(true)
        const response = await quoteApi.get<Quote>(id)
        if (!apiClient.isCurrent())
          throw Object.assign(new Error('Escopo encerrado.'), {
            name: 'AbortError',
          })

        if (!response.ok) {
          if (response.status === 404) {
            toast.error('Orçamento não encontrado')
          } else {
            toast.error('Erro ao carregar orçamento')
          }
          router.push('/admin/orcamentos')
          return
        }

        const data = response.data

        setQuote(data)
      } catch (error) {
        if (isAbortError(error) || !apiClient.isCurrent()) return

        console.error('Error fetching quote:', error)
        toast.error('Erro ao carregar orçamento')
        router.push('/admin/orcamentos')
      } finally {
        if (apiClient.isCurrent()) {
          setLoading(false)
        }
      }
    }

    fetchQuote()
  }, [id, router, quoteApi, apiClient])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    )
  }

  if (!quote) {
    return null
  }

  const statusColors = {
    pending: 'bg-orange-100 text-orange-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    completed: 'bg-blue-100 text-blue-800',
  }

  const statusLabels = {
    pending: 'Pendente',
    approved: 'Aprovado',
    rejected: 'Rejeitado',
    completed: 'Concluído',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-3 sm:p-4 lg:p-6 xl:p-8 pb-24 md:pb-12 max-w-7xl mx-auto">
        {/* Header com botão voltar */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Orçamentos
          </Button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Orçamento {quote.quoteCode || quote.id}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Detalhes completos do orçamento
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[quote.status]}`}
            >
              {statusLabels[quote.status]}
            </span>
          </div>
        </div>

        {/* Informações do Cliente */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4">
              Informações do Cliente
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Nome</p>
                <p className="font-medium">{quote.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">E-mail</p>
                <p className="font-medium">{quote.email}</p>
              </div>
              {quote.phone && (
                <div>
                  <p className="text-sm text-gray-600">Telefone</p>
                  <p className="font-medium">{quote.phone}</p>
                </div>
              )}
              {quote.company && (
                <div>
                  <p className="text-sm text-gray-600">Empresa</p>
                  <p className="font-medium">{quote.company}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Período e Valores */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4">Detalhes da Locação</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {quote.startDate && (
                <div>
                  <p className="text-sm text-gray-600">Data de Início</p>
                  <p className="font-medium">
                    {new Date(quote.startDate).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              )}
              {quote.endDate && (
                <div>
                  <p className="text-sm text-gray-600">Data de Término</p>
                  <p className="font-medium">
                    {new Date(quote.endDate).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">Valor Total</p>
                <p className="font-medium text-lg text-green-600">
                  {quote.totalPrice.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Itens do Orçamento */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4">
              Equipamentos ({quote.items.length})
            </h2>
            <div className="space-y-4">
              {quote.items.map((item) => (
                <div
                  key={item.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {item.equipment.images?.[0] && (
                      <img
                        src={item.equipment.images[0]}
                        alt={item.equipment.name}
                        className="w-20 h-20 object-cover rounded-md"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        {item.equipment.name}
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                        <div>
                          <p className="text-gray-600">Quantidade</p>
                          <p className="font-medium">{item.quantity}x</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Dias</p>
                          <p className="font-medium">{item.days} dias</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Diária</p>
                          <p className="font-medium">
                            {item.pricePerDay.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Subtotal</p>
                          <p className="font-medium text-green-600">
                            {item.total.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            })}
                          </p>
                        </div>
                      </div>
                      {item.startDate && item.endDate && (
                        <div className="mt-2 text-sm text-gray-600">
                          Período:{' '}
                          {new Date(item.startDate).toLocaleDateString('pt-BR')}{' '}
                          até{' '}
                          {new Date(item.endDate).toLocaleDateString('pt-BR')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Informações Adicionais */}
        <Card className="mt-6">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4">
              Informações Adicionais
            </h2>
            <div className="text-sm text-gray-600">
              <p>
                <span className="font-medium">Criado em:</span>{' '}
                {new Date(quote.createdAt).toLocaleString('pt-BR')}
              </p>
              {quote.legacyExternalCode && (
                <p className="mt-2">
                  <span className="font-medium">Código Legado:</span>{' '}
                  {quote.legacyExternalCode}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const tenant = useTenantContext()
  const slug = usePublicTenantSlug()
  const { data: session } = useSession()
  const scope = JSON.stringify([
    tenant?.tenant.id,
    tenant?.role,
    slug,
    session?.user?.id,
    id,
  ])
  return <QuoteDetailPageContent key={scope} params={params} />
}
