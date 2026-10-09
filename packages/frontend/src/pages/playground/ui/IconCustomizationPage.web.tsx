'use client'
import { useRef, type ChangeEvent } from 'react'
import { IconCustomizationBlock } from '../../../widgets/personalizar-icone'
import { useIconCustomization } from '../model/use-icon-customization'
export function IconCustomizationPage() {
  const { handleFileUpload, blockProps } = useIconCustomization()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    void handleFileUpload(event.target.files?.[0] ?? null)
  }
  return (
    <div className="min-h-screen bg-slate-100 py-10">
      <div className="mx-auto flex w-full justify-center px-4 sm:px-6 lg:px-8">
        <div className="w-[404px]">
          <IconCustomizationBlock
            {...blockProps}
            fileInputRef={fileInputRef}
            onFileInputChange={handleFileInputChange}
          />
        </div>
      </div>
    </div>
  )
}
