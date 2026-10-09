'use client'
import { createContext, useContext, type ReactNode } from 'react'
export interface PickedTextFile {
  name: string
  type: string
  size: number
  text: string
}
export interface DeviceActions {
  copyText(value: string): Promise<void>
  pickSvgFile(): Promise<PickedTextFile | null>
}
const Context = createContext<DeviceActions | null>(null)
export function DeviceActionsProvider({
  value,
  children,
}: {
  value: DeviceActions
  children: ReactNode
}) {
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useDeviceActions() {
  const value = useContext(Context)
  if (!value) throw new Error('O host deve fornecer DeviceActionsProvider.')
  return value
}
