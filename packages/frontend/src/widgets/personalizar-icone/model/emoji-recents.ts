import { useStoredRecents } from './use-stored-recents'
const normalize = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null
export function useEmojiRecents() {
  const {recents, add, clear} = useStoredRecents('gb-locacoes-emoji-recents', 30, normalize)
  return {recents, addRecentEmoji: add, clearRecentEmojis: clear}
}
