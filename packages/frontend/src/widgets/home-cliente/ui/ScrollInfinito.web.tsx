'use client'

// 🚀 Lazy load do GSAP para reduzir bundle inicial e TBT
// Carrega apenas quando o componente está montado
import Image from 'next/image'
import { memo, useEffect, useMemo, useRef, useState } from 'react'

type Equipment = {
  id: string
  name: string
  description: string
  pricePerDay: number
  images: string[]
}

type EquipmentInfiniteScrollProps = {
  className?: string
}

export function EquipmentInfiniteScroll({
  className = '',
}: EquipmentInfiniteScrollProps) {
  const [equipments, setEquipments] = useState<Equipment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [reduceMotion, setReduceMotion] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const row1Ref = useRef<HTMLDivElement>(null)
  const row2Ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Buscar equipamentos da API
    const fetchEquipments = async () => {
      try {
        const response = await fetch('/api/equipments')
        if (response.ok) {
          const data = await response.json()
          setEquipments(Array.isArray(data) ? data : [])
        }
      } catch (error) {
        console.error('Erro ao carregar equipamentos:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchEquipments()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => {
      setReduceMotion(mediaQuery.matches)
    }

    updatePreference()

    mediaQuery.addEventListener('change', updatePreference)
    return () => {
      mediaQuery.removeEventListener('change', updatePreference)
    }
  }, [])

  useEffect(() => {
    if (!row1Ref.current || !row2Ref.current || equipments.length === 0) return

    // Configuração do carrossel infinito com interatividade
    const row1Carousel = new InfiniteCarousel(row1Ref.current, {
      direction: -1, // Esquerda
      baseSpeed: reduceMotion ? 0 : 0.5, // pixels por frame
    })

    const row2Carousel = new InfiniteCarousel(row2Ref.current, {
      direction: 1, // Direita
      baseSpeed: reduceMotion ? 0 : 0.5,
    })

    const pause = () => {
      row1Carousel.stop()
      row2Carousel.stop()
    }

    const resume = () => {
      if (document.hidden) return
      row1Carousel.start()
      row2Carousel.start()
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        pause()
      } else {
        resume()
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries.some((entry) => entry.isIntersecting)
        if (isVisible) {
          resume()
        } else {
          pause()
        }
      },
      { threshold: 0.1 }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    } else {
      resume()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    handleVisibilityChange()

    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      row1Carousel.destroy()
      row2Carousel.destroy()
    }
  }, [equipments, reduceMotion])

  const { row1Duplicated, row2Duplicated } = useMemo(() => {
    const limitedEquipments = equipments.slice(0, 18)
    const midPoint = Math.ceil(limitedEquipments.length / 2)
    const row1Equipments = limitedEquipments.slice(0, midPoint)
    const row2Equipments = limitedEquipments.slice(midPoint)

    return {
      row1Duplicated: [...row1Equipments, ...row1Equipments, ...row1Equipments],
      row2Duplicated: [...row2Equipments, ...row2Equipments, ...row2Equipments],
    }
  }, [equipments])

  // Retornar null enquanto carrega
  if (isLoading || equipments.length === 0) {
    return null
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden ${className}`}
      data-fade-only
      style={{ opacity: 0 }}
    >
      {/* Título */}
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">
          Nossos Equipamentos
        </h2>
        <p className="mt-2 text-base text-slate-600">
          Confira nossa linha completa de equipamentos para locação
        </p>
      </div>

      {/* Container unificado para ambas as linhas */}
      <div className="relative z-0 overflow-hidden pt-8 pb-16">
        {/* Fade-out overlays laterais */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[15%] bg-gradient-to-r from-gray-50 via-gray-50/80 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-[15%] bg-gradient-to-l from-gray-50 via-gray-50/80 to-transparent" />

        {/* Linha 1: Direita → Esquerda */}
        <div className="mb-6">
          <div
            ref={row1Ref}
            className="flex gap-6 cursor-grab active:cursor-grabbing"
            style={{ willChange: 'transform' }}
          >
            {row1Duplicated.map((equipment, index) => (
              <EquipmentCard
                key={`row1-${equipment.id}-${index}`}
                equipment={equipment}
              />
            ))}
          </div>
        </div>

        {/* Linha 2: Esquerda → Direita */}
        <div>
          <div
            ref={row2Ref}
            className="flex gap-6 cursor-grab active:cursor-grabbing"
            style={{ willChange: 'transform' }}
          >
            {row2Duplicated.map((equipment, index) => (
              <EquipmentCard
                key={`row2-${equipment.id}-${index}`}
                equipment={equipment}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Card de Equipamento
const EquipmentCard = memo(function EquipmentCard({
  equipment,
}: {
  equipment: Equipment
}) {
  return (
    <div className="group shrink-0 w-[270px] overflow-hidden rounded-xl bg-white shadow-lg transition-shadow duration-300 hover:shadow-2xl">
      {/* Imagem */}
      <div className="relative h-[170px] w-full overflow-hidden bg-slate-100">
        <Image
          src={equipment.images?.[0] || '/placeholder.svg'}
          alt={equipment.name}
          fill
          className="object-cover transition-transform duration-500 will-change-transform group-hover:scale-110"
          sizes="270px"
          quality={75}
        />
      </div>

      {/* Conteúdo */}
      <div className="p-3">
        <h3 className="mb-1 text-base font-bold text-slate-900 line-clamp-1">
          {equipment.name}
        </h3>
        <p className="text-xs text-slate-600 line-clamp-2">
          {equipment.description}
        </p>
      </div>
    </div>
  )
})

EquipmentCard.displayName = 'EquipmentCard'

/**
 * Classe InfiniteCarousel
 *
 * Implementa um carrossel infinito verdadeiro com:
 * - Loop seamless sem reset visual (conceito de "roda gigante retangular")
 * - Interatividade com física de inércia
 * - Retorno gradual ao fluxo original após interação
 */
class InfiniteCarousel {
  private element: HTMLElement
  private direction: number // -1 = esquerda, 1 = direita
  private baseSpeed: number
  private currentSpeed: number
  private velocity: number
  private position: number
  private isActive: boolean
  private animationFrame: number | null
  private containerWidth: number
  private resizeObserver: ResizeObserver | null

  // Interatividade
  private isDragging: boolean
  private startX: number
  private lastX: number
  private lastTime: number
  private touchIdentifier: number | null

  // Física
  private readonly FRICTION = 0.95 // Desaceleração da inércia
  private readonly RETURN_FORCE = 0.02 // Força de retorno ao fluxo original
  private readonly MIN_SPEED = 0.1 // Velocidade mínima antes de retornar ao fluxo

  constructor(
    element: HTMLElement,
    options: { direction: number; baseSpeed: number }
  ) {
    this.element = element
    this.direction = options.direction
    this.baseSpeed = options.baseSpeed
    this.currentSpeed = options.baseSpeed
    this.velocity = 0
    this.position = 0
    this.isActive = false
    this.animationFrame = null
    this.containerWidth = 0
    this.resizeObserver = null

    this.isDragging = false
    this.startX = 0
    this.lastX = 0
    this.lastTime = 0
    this.touchIdentifier = null

    this.setupEventListeners()
    this.updateContainerWidth()

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.updateContainerWidth)
      this.resizeObserver.observe(this.element)
    } else {
      window.addEventListener('resize', this.updateContainerWidth)
    }
  }

  private updateContainerWidth = () => {
    this.containerWidth = this.element.scrollWidth / 3
  }

  private setupEventListeners() {
    // Touch events (mobile)
    this.element.addEventListener('touchstart', this.handleTouchStart, {
      passive: false,
    })
    this.element.addEventListener('touchmove', this.handleTouchMove, {
      passive: false,
    })
    this.element.addEventListener('touchend', this.handleTouchEnd)
    this.element.addEventListener('touchcancel', this.handleTouchEnd)

    // Mouse events (desktop)
    this.element.addEventListener('mousedown', this.handleMouseDown)
    window.addEventListener('mousemove', this.handleMouseMove)
    window.addEventListener('mouseup', this.handleMouseUp)
  }

  private handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length > 1) return // Ignorar multi-touch

    const touch = e.touches[0]
    if (!touch) return

    this.touchIdentifier = touch.identifier
    this.startDrag(touch.clientX)
    e.preventDefault()
  }

  private handleTouchMove = (e: TouchEvent) => {
    if (this.touchIdentifier === null) return

    const touch = Array.from(e.touches).find(
      (t) => t.identifier === this.touchIdentifier
    )
    if (!touch) return

    this.moveDrag(touch.clientX)
    e.preventDefault()
  }

  private handleTouchEnd = (e: TouchEvent) => {
    if (this.touchIdentifier === null) return

    // Verificar se o touch que terminou é o que estávamos rastreando
    const touch = Array.from(e.changedTouches).find(
      (t) => t.identifier === this.touchIdentifier
    )
    if (touch) {
      this.endDrag()
      this.touchIdentifier = null
    }
  }

  private handleMouseDown = (e: MouseEvent) => {
    this.startDrag(e.clientX)
    e.preventDefault()
  }

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.isDragging) return
    this.moveDrag(e.clientX)
  }

  private handleMouseUp = () => {
    if (!this.isDragging) return
    this.endDrag()
  }

  private startDrag(clientX: number) {
    this.isDragging = true
    this.startX = clientX
    this.lastX = clientX
    this.lastTime = Date.now()
    this.velocity = 0
  }

  private moveDrag(clientX: number) {
    if (!this.isDragging) return

    const now = Date.now()
    const deltaTime = now - this.lastTime
    const deltaX = clientX - this.lastX

    // Calcular velocidade baseada no movimento
    if (deltaTime > 0) {
      this.velocity = (deltaX / deltaTime) * 16 // Normalizar para ~60fps
    }

    // Atualizar posição diretamente
    this.position += deltaX

    this.lastX = clientX
    this.lastTime = now
  }

  private endDrag() {
    this.isDragging = false
    // A velocidade já está calculada, será aplicada no próximo frame
  }

  private animate() {
    if (!this.isActive) return

    // Se estiver arrastando, não aplicar velocidade automática
    if (!this.isDragging) {
      // Aplicar fricção à velocidade de inércia
      this.velocity *= this.FRICTION

      // Aplicar velocidade de inércia à posição
      this.position += this.velocity

      // Quando a velocidade estiver baixa, retornar gradualmente ao fluxo original
      if (Math.abs(this.velocity) < this.MIN_SPEED) {
        const targetSpeed = this.baseSpeed * this.direction
        const speedDiff = targetSpeed - this.velocity
        this.velocity += speedDiff * this.RETURN_FORCE

        // Quando estiver muito próximo do fluxo original, fixar
        if (Math.abs(speedDiff) < 0.01) {
          this.velocity = targetSpeed
        }
      }
    }

    // Aplicar transformação usando CSS nativo (mais performático que GSAP)
    // 🚀 Otimização: Substituído gsap.set por transform CSS nativo para reduzir bundle
    this.element.style.transform = `translateX(${this.position}px)`

    // Loop infinito verdadeiro: reposicionar quando necessario
    // Calcula a largura de um "ciclo" completo (1/3 do total, ja que triplicamos)
    if (this.containerWidth === 0) {
      this.updateContainerWidth()
    }

    const containerWidth = this.containerWidth

    if (containerWidth > 0) {
      // Se moveu mais que um ciclo completo para a esquerda
      if (this.position < -containerWidth) {
        this.position += containerWidth
      }
      // Se moveu mais que um ciclo completo para a direita
      else if (this.position > 0) {
        this.position -= containerWidth
      }
    }

    this.animationFrame = requestAnimationFrame(() => this.animate())
  }

  public start() {
    if (this.isActive) return
    this.isActive = true
    this.updateContainerWidth()
    this.animate()
  }

  public stop() {
    this.isActive = false
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame)
      this.animationFrame = null
    }
  }

  public destroy() {
    this.stop()

    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    } else {
      window.removeEventListener('resize', this.updateContainerWidth)
    }

    // Remover event listeners
    this.element.removeEventListener('touchstart', this.handleTouchStart)
    this.element.removeEventListener('touchmove', this.handleTouchMove)
    this.element.removeEventListener('touchend', this.handleTouchEnd)
    this.element.removeEventListener('touchcancel', this.handleTouchEnd)
    this.element.removeEventListener('mousedown', this.handleMouseDown)
    window.removeEventListener('mousemove', this.handleMouseMove)
    window.removeEventListener('mouseup', this.handleMouseUp)
  }
}
