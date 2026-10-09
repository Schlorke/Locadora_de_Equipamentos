// @vitest-environment jsdom
// Characterization of the DOM loading indicator around a genuinely suspended
// model. Three rendering is inert here; the owned production browser capture
// remains responsible for GPU, framing, animation and the removeChild defect.
import { act, cleanup, render, screen } from '@testing-library/react'
import type { CSSProperties, ReactNode } from 'react'
import { Group } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type ModelResource = {
  scene: Group
  ready: boolean
  promise: Promise<void>
  finish: () => void
}

const world = vi.hoisted(() => ({
  models: new Map<string, ModelResource>(),
  progress: 0,
  listeners: new Set<() => void>(),
  preload: vi.fn(),
  fit: vi.fn(),
  durations: [] as number[],
}))

vi.mock('@react-three/fiber', async () => {
  const { Children, createElement, isValidElement } = await import('react')
  return {
    Canvas: ({ children }: { children: ReactNode }) =>
      createElement(
        'div',
        { role: 'img', 'aria-label': 'Cena 3D' },
        Children.toArray(children).filter(
          (child) => !isValidElement(child) || typeof child.type !== 'string'
        )
      ),
    useFrame: () => {},
  }
})

vi.mock('@react-three/drei', async () => {
  const { createElement, Fragment, useSyncExternalStore } =
    await import('react')
  const passthrough = ({ children }: { children: ReactNode }) =>
    createElement(Fragment, null, children)
  const subscribe = (listener: () => void) => {
    world.listeners.add(listener)
    return () => {
      world.listeners.delete(listener)
    }
  }
  const bounds = { refresh: () => ({ fit: world.fit }) }
  return {
    Bounds: ({
      children,
      maxDuration,
    }: {
      children: ReactNode
      maxDuration: number
    }) => {
      world.durations.push(maxDuration)
      return createElement(Fragment, null, children)
    },
    Center: passthrough,
    // Does not manufacture a removal error. Restoring the old fallback places
    // its visible progress inside the Canvas boundary and fails the owner check.
    Html: passthrough,
    Environment: () => null,
    OrbitControls: () => null,
    useBounds: () => bounds,
    useProgress: () => ({
      progress: useSyncExternalStore(
        subscribe,
        () => world.progress,
        () => world.progress
      ),
    }),
    useGLTF: Object.assign(
      (url: string) => {
        const model = world.models.get(url)
        if (!model) throw new Error('Missing model fixture')
        if (!model.ready) throw model.promise
        return { scene: model.scene }
      },
      { preload: world.preload }
    ),
  }
})

vi.mock('framer-motion', async () => {
  const { createElement, Fragment } = await import('react')
  return {
    AnimatePresence: ({ children }: { children: ReactNode }) =>
      createElement(Fragment, null, children),
    motion: {
      div: ({
        children,
        className,
        style,
      }: {
        children?: ReactNode
        className?: string
        style?: CSSProperties
      }) => createElement('div', { className, style }, children),
    },
  }
})

import ModelViewer from './ModelViewer.web'

function model(url: string) {
  let resolve!: () => void
  const promise = new Promise<void>((finish) => {
    resolve = finish
  })
  const resource: ModelResource = {
    scene: new Group(),
    ready: false,
    promise,
    finish() {
      resource.ready = true
      resolve()
    },
  }
  world.models.set(url, resource)
  return resource
}

function progress(value: number) {
  act(() => {
    world.progress = value
    for (const listener of world.listeners) listener()
  })
}

async function complete(resource: ModelResource) {
  await act(async () => {
    resource.finish()
    await resource.promise
  })
}

beforeEach(() => {
  world.models.clear()
  world.progress = 0
  world.listeners.clear()
  world.preload.mockClear()
  world.fit.mockClear()
  world.durations.length = 0
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('ModelViewer: progresso com um único dono DOM', () => {
  it('mantém o percentual fora da cena suspensa e só o retira quando o GLTF atual carrega', async () => {
    const compressor = model('/models/Compressor.glb')
    const onLoaded = vi.fn()
    render(
      <ModelViewer
        url="/models/Compressor.glb"
        environmentPreset="none"
        onModelLoaded={onLoaded}
      />
    )

    const initial = screen.getByText('0 %')
    expect(initial.closest('[role="img"]')).toBeNull()
    expect(screen.getByRole('img', { name: 'Cena 3D' }).contains(initial)).toBe(
      false
    )
    expect(initial.classList.contains('text-yellow-500')).toBe(true)
    expect(initial.classList.contains('text-lg')).toBe(true)
    expect(onLoaded).not.toHaveBeenCalled()

    progress(41.6)
    expect(screen.getByText('42 %')).toBeTruthy()
    progress(100)
    expect(screen.getByText('100 %')).toBeTruthy()
    expect(onLoaded).not.toHaveBeenCalled()

    await complete(compressor)
    expect(screen.queryByText(/\d+ %/)).toBeNull()
    expect(onLoaded).toHaveBeenCalled()
  })

  it('volta a mostrar progresso ao trocar a URL e aguarda a resolução do novo modelo', async () => {
    const compressor = model('/models/Compressor.glb')
    const betoneira = model('/models/Betoneira.glb')
    const view = render(
      <ModelViewer url="/models/Compressor.glb" environmentPreset="none" />
    )
    await complete(compressor)
    expect(screen.queryByText(/\d+ %/)).toBeNull()

    progress(23)
    view.rerender(
      <ModelViewer url="/models/Betoneira.glb" environmentPreset="none" />
    )
    const loading = screen.getByText('23 %')
    expect(loading.closest('[role="img"]')).toBeNull()
    progress(100)
    expect(screen.getByText('100 %')).toBeTruthy()

    await complete(betoneira)
    expect(screen.queryByText(/\d+ %/)).toBeNull()
  })

  it('a resolução de um modelo substituído não encerra o carregamento da URL atual', async () => {
    const compressor = model('/models/Compressor.glb')
    const betoneira = model('/models/Betoneira.glb')
    const view = render(
      <ModelViewer url="/models/Compressor.glb" environmentPreset="none" />
    )
    view.rerender(
      <ModelViewer url="/models/Betoneira.glb" environmentPreset="none" />
    )

    await complete(compressor)
    expect(screen.getByText('0 %')).toBeTruthy()
    await complete(betoneira)
    expect(screen.queryByText(/\d+ %/)).toBeNull()
  })

  it('um GLTF já em cache não volta a exibir progresso depois de confirmar onLoaded', async () => {
    const compressor = model('/models/Compressor.glb')
    compressor.finish()
    const onLoaded = vi.fn()
    render(
      <ModelViewer
        url="/models/Compressor.glb"
        environmentPreset="none"
        onModelLoaded={onLoaded}
      />
    )
    await act(async () => {
      await compressor.promise
    })
    expect(onLoaded).toHaveBeenCalled()
    expect(screen.queryByText(/\d+ %/)).toBeNull()
  })

  it('conserva o primeiro fit instantâneo e os 200ms após a revelação', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const compressor = model('/models/Compressor.glb')
    const view = render(
      <ModelViewer
        url="/models/Compressor.glb"
        environmentPreset="none"
        delayBoundsFit
        isRevealComplete={false}
      />
    )
    await complete(compressor)
    expect(world.durations.at(-1)).toBe(0)
    expect(world.fit).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(world.fit).not.toHaveBeenCalled()

    view.rerender(
      <ModelViewer
        url="/models/Compressor.glb"
        environmentPreset="none"
        delayBoundsFit
        isRevealComplete
      />
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(199)
    })
    expect(world.fit).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(world.fit).toHaveBeenCalledTimes(1)
    expect(world.durations.at(-1)).toBe(0)
  })
})
