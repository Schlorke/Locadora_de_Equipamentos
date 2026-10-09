import type { AllIconNames } from '../../../shared/lib/constants/all-icons'
import { normalizeIconName } from '../../../shared/lib/icon-utils'
import { useStoredRecents } from './use-stored-recents'
const normalize = (value: unknown): AllIconNames | null => typeof value === 'string' ? normalizeIconName(value) ?? null : null
export function useIconRecents() {
  const {recents, add, clear} = useStoredRecents('gb-locacoes-icon-recents', 18, normalize)
  return {recents, addRecentIcon: add, clearRecentIcons: clear}
}
