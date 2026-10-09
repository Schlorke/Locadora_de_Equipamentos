'use client'
import { useRef } from 'react'
import {
  useSettingsData as useModel,
  type SettingsMessages,
} from './use-settings-data'
const messages: SettingsMessages = {
  saved: (name) => (
    <>
      Configurações de <strong>{name}</strong> atualizadas com sucesso.
    </>
  ),
  reset: (name) => (
    <>
      Apenas as configurações da seção <strong>&quot;{name}&quot;</strong> serão
      restauradas aos valores padrão. As demais configurações não serão
      afetadas.
    </>
  ),
  restored: (name) => (
    <>
      As configurações de <strong>&quot;{name}&quot;</strong> foram restauradas
      aos valores padrão e salvas com sucesso.
    </>
  ),
}
export function useSettingsData() {
  const model = useModel({ messages }),
    fileInputRef = useRef<HTMLInputElement>(null)
  const handleLogoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return
    const multipart = new FormData()
    multipart.append('file', file)
    const attempted = await model.uploadLogoFile({
      multipart,
      type: file.type,
      size: file.size,
    })
    if (attempted && fileInputRef.current) fileInputRef.current.value = ''
  }
  const handleSectionChange = (section: string) => {
    model.handleSectionChange(section)
    document
      .getElementById('settings-content-container')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const uploadHeroFile = async (file: File) => {
    const multipart = new FormData()
    multipart.append('file', file)
    return model.uploadHeroFile({ multipart, type: file.type, size: file.size })
  }
  return {
    ...model,
    fileInputRef,
    handleLogoUpload,
    handleSectionChange,
    uploadHeroFile,
  }
}
