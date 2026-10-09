'use client'

import { useState } from 'react'
import { useSignOut } from '../../../entities/sessao'
import { LogOut } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogHeaderIcon,
  AlertDialogTitle,
} from '@gb-locacoes/ui'
import { CloseButton } from '@gb-locacoes/ui'

interface LogoutConfirmationDialogProps {
  open: boolean
  onOpenChange: (_isOpen: boolean) => void
  callbackUrl?: string
}

export function LogoutConfirmationDialog({
  open,
  onOpenChange,
  callbackUrl = '/',
}: LogoutConfirmationDialogProps) {
  const signOut = useSignOut()
  const [isLoading, setIsLoading] = useState(false)

  const handleConfirm = async () => {
    setIsLoading(true)
    try {
      await signOut({ callbackUrl })
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
      setIsLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader className="relative pr-8">
          <CloseButton
            size="sm"
            variant="ghostWhite"
            className="absolute right-4 top-4"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar dialog"
          />
          <AlertDialogHeaderIcon>
            <LogOut className="h-4 w-4" />
          </AlertDialogHeaderIcon>
          <AlertDialogTitle>Confirmar saída</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="px-4 md:px-6 py-4 md:py-6">
          <AlertDialogDescription>
            Tem certeza que deseja sair da sua conta? Você precisará fazer login
            novamente para acessar sua área do cliente.
          </AlertDialogDescription>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? 'Saindo...' : 'Sair'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
