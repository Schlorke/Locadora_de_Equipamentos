'use client'

import {
  type ComponentProps,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react'
import { AdminFilterCard } from '../../../widgets/filtro-admin'
import { debounce } from '../../../shared/lib/debounce-fn'
const SEARCH_DEBOUNCE_MS = 350

export { generatePeriodOptions, getPeriodDateRange } from '../model/period'

/** Wrapper que mantém estado local do input e só propaga busca após debounce, evitando re-render da página inteira a cada tecla. */
export function FinanceiroFilterCardWithDebouncedSearch({
  searchTerm,
  onSearchChange,
  ...rest
}: Omit<
  ComponentProps<typeof AdminFilterCard>,
  'searchValue' | 'onSearchChange'
> & { searchTerm: string; onSearchChange: (_value: string) => void }) {
  const [inputValue, setInputValue] = useState(searchTerm)
  const debouncedOnSearch = useMemo(
    () =>
      debounce(
        (...args: unknown[]) => onSearchChange(args[0] as string),
        SEARCH_DEBOUNCE_MS
      ),
    [onSearchChange]
  )
  useEffect(() => {
    setInputValue(searchTerm)
  }, [searchTerm])
  const handleSearchChange = useCallback(
    (value: string) => {
      setInputValue(value)
      debouncedOnSearch(value)
    },
    [debouncedOnSearch]
  )
  return (
    <AdminFilterCard
      {...rest}
      searchValue={inputValue}
      onSearchChange={handleSearchChange}
    />
  )
}
