import { View } from 'react-native'
import { space } from '@gb-locacoes/design-tokens'
import { IconCustomizationBlock } from '../../../widgets/personalizar-icone'
import { useDeviceActions } from '../../../shared/device'
import { toast } from '../../../shared/lib/toast'
import { useIconCustomization } from '../model/use-icon-customization'
export function IconCustomizationPage() {
  const { blockProps, handleFileUpload } = useIconCustomization(),
    device = useDeviceActions()
  const pick = async () => {
    try {
      const file = await device.pickSvgFile()
      if (file) await handleFileUpload({ ...file, text: async () => file.text })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível abrir o arquivo'
      )
    }
  }
  return (
    <View style={{ padding: space.md, flex: 1 }}>
      {' '}
      <IconCustomizationBlock {...blockProps} onPickFile={() => void pick()} />
    </View>
  )
}
