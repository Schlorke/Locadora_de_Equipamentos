// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('react-native', () => import('./__tests__/native-test-host'))
vi.mock('react-native-svg', () => {
  const Shape = ({ children }: { children?: import('react').ReactNode }) => (
    <span>{children}</span>
  )
  return {
    default: Shape,
    Path: Shape,
    Circle: Shape,
    Rect: Shape,
    Line: Shape,
    Polygon: Shape,
    Polyline: Shape,
    Ellipse: Shape,
    G: Shape,
    Defs: Shape,
    ClipPath: Shape,
    RadialGradient: Shape,
    Stop: Shape,
  }
})
vi.mock('@gb-locacoes/ui', () => import('../../../../../ui/src/index.native'))
import { catalog, type CatalogRecipeId } from '@gb-locacoes/ui'
import { CatalogRecipe } from './CatalogRecipe'
afterEach(cleanup)
describe('native catalog recipes on a simulated host', () => {
  for (const [id, recipe] of Object.entries(catalog))
    for (const state of recipe.states)
      it(`${id}/${state} mounts the actual native composition`, async () => {
        const { container } = render(
          <CatalogRecipe recipe={id as CatalogRecipeId} state={state} />
        )
        await act(async () => {
          await Promise.resolve()
        })
        expect(container.firstElementChild?.firstChild?.nodeName).toBeTruthy()
        expect(container.firstElementChild?.childNodes.length).toBeGreaterThan(
          1
        )
      })
  it('validates through Controller and edits native text fields', async () => {
    render(<CatalogRecipe recipe="Form" state="default" />)
    fireEvent.click(screen.getByRole('button', { name: 'Validar' }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Preencha o nome'
    )
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Pessoa' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Validar' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })
  it('opens and closes the real native Dialog recipe', () => {
    render(<CatalogRecipe recipe="Dialog" state="closed" />)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir diálogo' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('loads avatar images and recovers the fallback after an image error', () => {
    render(<CatalogRecipe recipe="Avatar" state="image" />)
    expect(screen.getByText('AB')).toBeTruthy()
    fireEvent.load(screen.getByRole('img'))
    expect(screen.queryByText('AB')).toBeNull()
    fireEvent.error(screen.getByRole('img'))
    expect(screen.getByText('AB')).toBeTruthy()
  })
  it('formats currency edits and prevents disabled input', () => {
    const instance = render(
      <CatalogRecipe recipe="CurrencyInput" state="zero" />
    )
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: '12345' } })
    expect(input.value.replace(/\s/g, '')).toBe('R$123,45')
    instance.unmount()
    render(<CatalogRecipe recipe="CurrencyInput" state="disabled" />)
    expect((screen.getByRole('textbox') as HTMLInputElement).disabled).toBe(
      true
    )
  })
  it('renders chart values and reveals the selected point', () => {
    render(<CatalogRecipe recipe="Chart" state="data" />)
    fireEvent.click(screen.getByRole('button', { name: 'B: 18' }))
    expect(screen.getByText('Quantidade: 18')).toBeTruthy()
    expect(screen.getAllByText('Quantidade').length).toBeGreaterThan(0)
  })
  it('loads injected options and selects a native autocomplete result', async () => {
    render(<CatalogRecipe recipe="Autocomplete" state="results" />)
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'opção' },
    })
    fireEvent.click(
      await screen.findByRole('button', { name: /Resultado opção/ })
    )
    expect(screen.getByText('Ação executada')).toBeTruthy()
  })
  it('resizes adjacent native panels through accessibility actions', () => {
    render(<CatalogRecipe recipe="Resizable" state="horizontal" />)
    const handle = screen.getByRole('adjustable')
    expect(handle.getAttribute('aria-valuenow')).toBe('50')
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(handle.getAttribute('aria-valuenow')).toBe('55')
  })
  it('forwards sidebar actions and collapses its content', () => {
    render(<CatalogRecipe recipe="Sidebar" state="open" />)
    fireEvent.click(screen.getByRole('button', { name: 'Visão geral' }))
    expect(screen.getByText('Ação executada')).toBeTruthy()
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Toggle Sidebar' })[0]!
    )
    expect(screen.queryByRole('button', { name: 'Visão geral' })).toBeNull()
  })
  it('adds and removes images using the component controls', () => {
    render(<CatalogRecipe recipe="ImageUpload" state="empty" />)
    fireEvent.change(screen.getByPlaceholderText('URL da imagem'), {
      target: { value: 'https://example.invalid/image.png' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Adicionar imagem por URL' })
    )
    expect(screen.getByRole('img')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Remover imagem 1' }))
    expect(screen.queryByRole('img')).toBeNull()
  })
})
