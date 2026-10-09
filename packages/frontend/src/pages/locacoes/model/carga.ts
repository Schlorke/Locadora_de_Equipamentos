'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { toast } from '../../../shared/lib/toast'
import { createAdminRentalsApi } from '../api/admin-rentals'
import { createClientDocumentsApi } from '../api/client-documents'
import { useScopedApiClient, isAbortError } from '../../../shared/api'
import type { Rental, ClientDocument, ClientDocumentType } from './contracts'

const TABLE_PAGE_SIZE = 10

export function useRentalsData() {
  const client = useScopedApiClient(null)
  const api = useMemo(() => createAdminRentalsApi(client), [client])
  const [rentals, setRentals] = useState<Rental[]>([])
  const [filteredRentals, setFilteredRentals] = useState<Rental[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null)
  const [contractLoading, setContractLoading] = useState(false)
  const [documentSelecting, setDocumentSelecting] = useState(false)
  const documentSelection = useRef(0)
  const selectionBusy = useRef<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('PENDING')
  const [periodFilter, setPeriodFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table')
  const [tablePage, setTablePage] = useState(1)
  const documentScope = JSON.stringify([
    selectedRental?.id,
    selectedRental?.users.id,
  ])
  const detailClient = useScopedApiClient(documentScope)
  const detailApi = useMemo(
    () => createAdminRentalsApi(detailClient),
    [detailClient]
  )
  const documentsApi = useMemo(
    () => createClientDocumentsApi(detailClient),
    [detailClient]
  )
  const [documentResult, setDocumentResult] = useState<{
    scope: string
    documents: ClientDocument[]
  } | null>(null)
  const clientDocuments =
    documentResult?.scope === documentScope ? documentResult.documents : []
  const [uploadingDocumentType, setUploadingDocumentType] =
    useState<ClientDocumentType | null>(null)

  const fetchRentals = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.list()
      setRentals(data.rentals || [])
    } catch (error) {
      if (isAbortError(error)) return
      console.error('Error fetching rentals:', error)
      toast.error('Erro', {
        description: 'Erro ao carregar locações. Tente novamente.',
      })
      setRentals([])
    } finally {
      if (client.isCurrent()) setLoading(false)
    }
  }, [api, client])

  useEffect(() => {
    void fetchRentals()
  }, [fetchRentals])

  const fetchClientDocuments = useCallback(
    async (userId: string) => {
      const data = await documentsApi.list(userId)
      setDocumentResult({
        scope: documentScope,
        documents: Array.isArray(data.documents) ? data.documents : [],
      })
    },
    [documentsApi, documentScope]
  )

  const handleUploadClientDocument = useCallback(
    async (
      rentalId: string,
      type: ClientDocumentType,
      file: Blob | FormData
    ) => {
      try {
        setUploadingDocumentType(type)
        if (!detailClient.isCurrent()) return
        const formData = file instanceof FormData ? file : new FormData()
        if (!(file instanceof FormData)) formData.append('file', file)
        formData.append('type', type)
        formData.append(
          'captureMetadata',
          JSON.stringify({
            capturedAt: new Date().toISOString(),
            source: 'admin-rentals-page',
          })
        )
        await documentsApi.upload(rentalId, formData)
        if (selectedRental?.users.id) {
          await fetchClientDocuments(selectedRental.users.id)
        }
        if (!detailClient.isCurrent()) return
        toast.success('Documento enviado com sucesso')
      } catch (error) {
        if (isAbortError(error) || !detailClient.isCurrent()) return
        console.error('Error uploading client document:', error)
        toast.error(
          error instanceof Error
            ? error.message
            : 'Erro ao enviar documento do cliente'
        )
      } finally {
        if (detailClient.isCurrent()) setUploadingDocumentType(null)
      }
    },
    [documentsApi, detailClient, fetchClientDocuments, selectedRental?.users.id]
  )

  const selectClientDocument = async (
    type: ClientDocumentType,
    pick: () => Promise<FormData | null>
  ) => {
    const rental = selectedRental
    if (
      !rental ||
      selectionBusy.current !== null ||
      uploadingDocumentType ||
      !detailClient.isCurrent()
    )
      return
    const cycle = ++documentSelection.current
    selectionBusy.current = cycle
    setDocumentSelecting(true)
    try {
      const body = await pick()
      if (
        !detailClient.isCurrent() ||
        documentSelection.current !== cycle ||
        !body
      )
        return
      await handleUploadClientDocument(rental.id, type, body)
    } catch (error) {
      if (
        isAbortError(error) ||
        !detailClient.isCurrent() ||
        documentSelection.current !== cycle
      )
        return
      toast.error('Erro ao selecionar documento do cliente')
    } finally {
      if (detailClient.isCurrent() && documentSelection.current === cycle) {
        selectionBusy.current = null
        setDocumentSelecting(false)
      }
    }
  }

  useEffect(() => {
    documentSelection.current++
    selectionBusy.current = null
    setDocumentSelecting(false)
    setUploadingDocumentType(null)
    setContractLoading(false)
    if (!selectedRental?.users.id) {
      setDocumentResult(null)
      return
    }
    void fetchClientDocuments(selectedRental.users.id).catch((error) => {
      if (isAbortError(error)) return
      console.error('Error loading selected rental documents:', error)
      toast.error('Erro ao carregar documentos do cliente')
    })
  }, [fetchClientDocuments, selectedRental?.users.id])

  useEffect(() => {
    if (!Array.isArray(rentals)) {
      setFilteredRentals([])
      return
    }

    const filtered = rentals.filter((rental) => {
      if (rental.quote?.status === 'REJECTED') return false
      if (rental.status === 'CANCELLED' && statusFilter !== 'CANCELLED')
        return false

      const matchesSearch =
        rental.users.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rental.users.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rental.users.phone?.includes(searchTerm) ||
        rental.quote?.company
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        rental.id.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesStatus =
        statusFilter === 'all' || rental.status === statusFilter

      let matchesPeriod = true
      if (periodFilter !== 'all') {
        const now = new Date()
        const startDate = new Date(rental.startdate)

        switch (periodFilter) {
          case 'today':
            matchesPeriod = startDate.toDateString() === now.toDateString()
            break
          case 'week': {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            matchesPeriod = startDate >= weekAgo
            break
          }
          case 'month': {
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            matchesPeriod = startDate >= monthAgo
            break
          }
        }
      }

      return matchesSearch && matchesStatus && matchesPeriod
    })

    setFilteredRentals(filtered)
  }, [rentals, searchTerm, statusFilter, periodFilter])

  // Pagination
  const tableTotalPages = Math.max(
    1,
    Math.ceil(filteredRentals.length / TABLE_PAGE_SIZE)
  )
  const tableCurrentPage = Math.min(tablePage, tableTotalPages)
  const paginatedRentals = useMemo(
    () =>
      filteredRentals.slice(
        (tableCurrentPage - 1) * TABLE_PAGE_SIZE,
        tableCurrentPage * TABLE_PAGE_SIZE
      ),
    [filteredRentals, tableCurrentPage]
  )

  useEffect(() => {
    setTablePage(1)
  }, [searchTerm, statusFilter, periodFilter])

  const handleGenerateContract = async (rentalId: string) => {
    try {
      setContractLoading(true)
      const data = await detailApi.generateContract(rentalId)
      toast.success('Contrato gerado com sucesso')
      setSelectedRental((prev) =>
        prev?.id === rentalId ? { ...prev, contract: data.contract } : prev
      )
      void fetchRentals()
    } catch (error) {
      if (isAbortError(error)) return
      console.error(error)
      toast.error('Erro ao gerar contrato')
    } finally {
      if (detailClient.isCurrent()) setContractLoading(false)
    }
  }

  const handleCheckIn = async (rentalId: string) => {
    try {
      await detailApi.checkIn(rentalId, new Date().toISOString())
      toast.success('Check-in realizado com sucesso')
      void fetchRentals()
      setSelectedRental(null)
    } catch (error) {
      if (isAbortError(error)) return
      toast.error('Erro ao realizar check-in')
    }
  }

  const handleCheckOut = async (rentalId: string) => {
    try {
      await detailApi.checkOut(rentalId, new Date().toISOString())
      toast.success('Check-out realizado com sucesso')
      void fetchRentals()
      setSelectedRental(null)
    } catch (error) {
      if (isAbortError(error)) return
      toast.error('Erro ao realizar check-out')
    }
  }

  return {
    rentals,
    filteredRentals,
    loading,
    selectedRental,
    setSelectedRental,
    contractLoading,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    periodFilter,
    setPeriodFilter,
    viewMode,
    setViewMode,
    paginatedRentals,
    tableCurrentPage,
    tableTotalPages,
    setTablePage,
    clientDocuments,
    documentSelecting,
    selectClientDocument,
    uploadingDocumentType,
    handleUploadClientDocument,
    handleGenerateContract,
    handleCheckIn,
    handleCheckOut,
  }
}
