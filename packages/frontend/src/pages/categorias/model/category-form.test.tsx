// @vitest-environment jsdom
import { createElement } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiClientProvider, createHttpClient } from '../../../shared/api'
import { useCategoryForm, type CategoryDialogProps } from './category-form'
import { DEFAULT_DESIGN } from '../../../shared/lib/category-design-model'
vi.mock('../../../shared/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('../../../shared/storage', () => ({
  keyValueStorage: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  },
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
const props: CategoryDialogProps = {
  isOpen: true,
  mode: 'create',
  onClose: vi.fn(),
  onSave: vi.fn(),
  onStateChange: () => {},
}
const encode = (svg: string) =>
  'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
function setup(p = props) {
  const client = createHttpClient({ fetcher: async () => Response.json({}) })
  return renderHook(
    (options: CategoryDialogProps) => useCategoryForm(options, encode),
    {
      initialProps: p,
      wrapper: ({ children }) =>
        createElement(ApiClientProvider, { client, children }),
    }
  )
}
it('não lê arquivo errado/maior que 64kb; rejeita texto inválido e erro de leitura', async () => {
  const hook = setup(),
    read = vi.fn(async () => '<svg/>')
  await act(async () =>
    hook.result.current.handleSvgFile({
      name: 'bad.png',
      type: 'image/png',
      size: 5,
      read,
    })
  )
  expect(read).not.toHaveBeenCalled()
  expect(hook.result.current.uploadError).toContain('SVG válido')
  await act(async () =>
    hook.result.current.handleSvgFile({
      name: 'big.svg',
      type: 'image/svg+xml',
      size: 64 * 1024 + 1,
      read,
    })
  )
  expect(read).not.toHaveBeenCalled()
  await act(async () =>
    hook.result.current.handleSvgFile({
      name: 'bad.svg',
      type: 'image/svg+xml',
      size: 5,
      read: async () => '<html/>',
    })
  )
  expect(hook.result.current.uploadError).toContain('validar este SVG')
  await act(async () =>
    hook.result.current.handleSvgFile({
      name: 'err.svg',
      type: 'image/svg+xml',
      size: 5,
      read: async () => {
        throw Error('Falha na leitura')
      },
    })
  )
  expect(hook.result.current.uploadError).toBe('Falha na leitura')
  expect(hook.result.current.isProcessingUpload).toBe(false)
})
it('emoji e ícone são imediatos; SVG/URL ficam em rascunho; reset conserva placement', async () => {
  const hook = setup()
  act(() => hook.result.current.handleEmojiSelect('🚧'))
  expect(hook.result.current.design.customIcon).toEqual({
    source: 'emoji',
    emoji: '🚧',
  })
  act(() => hook.result.current.handleIconSelect('Hammer'))
  expect(hook.result.current.design.icon).toBe('Hammer')
  expect(hook.result.current.design.customIcon.source).toBe('none')
  act(() => hook.result.current.setSvgUrlInput('https://example.test/logo.svg'))
  act(() => hook.result.current.handleUrlApply())
  expect(hook.result.current.localDesign.customIcon).toMatchObject({
    source: 'url',
    name: 'logo',
  })
  expect(hook.result.current.design.customIcon.source).toBe('none')
  act(() => hook.result.current.handleSaveCustomIcon())
  expect(hook.result.current.design.customIcon).toMatchObject({
    source: 'url',
    url: 'https://example.test/logo.svg',
  })
  act(() =>
    hook.result.current.setDesign((prev) => ({ ...prev, placement: 'phases' }))
  )
  act(() => hook.result.current.handleReset())
  expect(hook.result.current.design).toEqual({
    ...DEFAULT_DESIGN,
    placement: 'phases',
  })
  expect(hook.result.current.category).toEqual({ name: '', description: '' })
})
it('cancelar origem/reset/fechar ignora SVG atrasado e bloqueia confirmação dupla', async () => {
  const onSave = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finishSave = resolve
      })
  )
  let finishSave!: () => void
  const hook = setup({ ...props, onSave })
  let finish!: (text: string) => void
  let pending!: Promise<void>
  act(() => {
    pending = hook.result.current.handleSvgFile({
      name: 'old.svg',
      type: 'image/svg+xml',
      size: 4,
      read: () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    })
  })
  act(() => hook.result.current.handleRemoveIcon())
  await act(async () => {
    finish('<svg/>')
    await pending
  })
  expect(hook.result.current.localDesign.customIcon.source).toBe('none')
  act(() => hook.result.current.setCategory({ name: 'Nova', description: '' }))
  act(() => {
    void hook.result.current.handleSubmit()
    void hook.result.current.handleSubmit()
  })
  expect(onSave).toHaveBeenCalledTimes(1)
  hook.rerender({ ...props, onSave, isOpen: false })
  await act(async () => finishSave())
  expect(props.onClose).not.toHaveBeenCalled()
})
