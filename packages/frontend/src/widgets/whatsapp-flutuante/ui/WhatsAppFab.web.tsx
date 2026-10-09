'use client'

import { Button } from '@gb-locacoes/ui'
import { CloseButton } from '@gb-locacoes/ui'
import { Input } from '@gb-locacoes/ui'
import { MessageCircle, Send } from 'lucide-react'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { usePublicSettings } from '../../../entities/configuracao'
import { siglaDaLocadora, useIdentidadePublica } from '../../../entities/organizacao'

type MessageSender = 'bot' | 'user'

/** Verde do WhatsApp (fundo e hover), tokens --whatsapp e --whatsapp-hover do design-tokens. */
const WHATSAPP_GREEN =
  'bg-[var(--whatsapp)] hover:bg-[var(--whatsapp-hover)]'

/** Áreas roláveis do chat: barra de rolagem verde (WebKit) e sempre visível. */
const CHAT_SCROLL =
  'overflow-y-scroll [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:rounded-[var(--rounded-scroll-thumb)] [&::-webkit-scrollbar-track]:bg-[var(--whatsapp-scroll-track)] [&::-webkit-scrollbar-thumb]:rounded-[var(--rounded-scroll-thumb)] [&::-webkit-scrollbar-thumb]:bg-[var(--whatsapp)] [&::-webkit-scrollbar-thumb:hover]:bg-[var(--whatsapp-hover)] [&::-webkit-scrollbar-corner]:bg-[var(--whatsapp-scroll-track)]'

/** Largura e cores da barra (padrão CSS); inline porque a regra global de barra de rolagem vence classes. */
const CHAT_SCROLLBAR: React.CSSProperties = {
  scrollbarWidth: 'thin',
  scrollbarColor:
    'var(--whatsapp) var(--whatsapp-scroll-track)',
}

interface ChatMessage {
  id: number
  text: string
  sender: MessageSender
  timestamp: Date
}

/**
 * Número do WhatsApp da locadora para o `wa.me` (DDI 55 mais DDD e número). Sem número válido: `null`, e o botão não
 * aparece (achado 143: nunca o WhatsApp de outra locadora).
 */
export function numeroDoWhatsApp(valor: string | null | undefined): string | null {
  const digitos = (valor ?? '').replace(/\D/g, '')
  if (digitos.length < 10) return null
  return digitos.startsWith('55') && digitos.length >= 12 ? digitos : '55' + digitos
}

export default function WhatsAppFAB() {
  const { settings } = usePublicSettings()
  const identidade = useIdentidadePublica()
  const whatsappNumber = numeroDoWhatsApp(settings.whatsappNumber)
  const nome = identidade?.nome ?? null
  const origem = nome ? `Vim do site da ${nome}` : 'Vim do site'
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      text: '👷‍♂️ Olá! Precisa de equipamentos para sua obra? Somos especialistas em locação de equipamentos para construção civil e serviços em altura!',
      sender: 'bot' as MessageSender,
      timestamp: new Date(),
    },
  ])
  const [unreadCount, setUnreadCount] = useState(1) // Contador de mensagens não lidas
  const [showQuickMessages, setShowQuickMessages] = useState(true)

  // Ref para scroll automático
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Função para rolar para baixo automaticamente
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      })
    }, 100)
  }

  // Função para detectar se é dispositivo móvel
  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    )
  }

  // Função para abrir WhatsApp corretamente em mobile e desktop
  const openWhatsApp = (message: string) => {
    const encodedMessage = encodeURIComponent(message)
    const whatsappURL = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`

    if (isMobile()) {
      // Para dispositivos móveis, usar window.location.href para abrir o app diretamente
      window.location.href = whatsappURL
    } else {
      // Para desktop, usar window.open como antes
      window.open(whatsappURL, '_blank')
    }
  }

  useEffect(() => {
    // Quando o chat é aberto, marcar mensagens como lidas
    if (isOpen) {
      setUnreadCount(0)
    }
  }, [isOpen])

  // Auto-scroll quando novas mensagens são adicionadas
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      scrollToBottom()
    }
  }, [messages, isOpen])

  const handleSendMessage = () => {
    if (!message.trim()) return

    // Add user message to chat
    const userMessage: ChatMessage = {
      id: messages.length + 1,
      text: message,
      sender: 'user' as MessageSender,
      timestamp: new Date(),
    }

    setMessages([...messages, userMessage])
    setShowQuickMessages(false) // Hide quick messages after user sends a message

    // Simulate bot response
    setTimeout(() => {
      const botResponse: ChatMessage = {
        id: messages.length + 2,
        text: 'Obrigado pela mensagem! Vou te redirecionar para o WhatsApp onde nossos especialistas podem te atender melhor. 📱',
        sender: 'bot' as MessageSender,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, botResponse])

      // Se o chat não estiver aberto, incrementar contador de não lidas
      if (!isOpen) {
        setUnreadCount((prev) => prev + 1)
      }

      // Redirect to WhatsApp after bot response
      setTimeout(() => {
        const whatsappMessage = `Olá! ${origem} e gostaria de solicitar informações sobre locação de equipamentos para construção civil. Minha mensagem: ${message}`
        openWhatsApp(whatsappMessage)
        setIsOpen(false)
        setMessage('')
        setShowQuickMessages(true) // Reset for next time
      }, 1500)
    }, 1000)

    setMessage('')
  }

  const handleQuickMessage = (quickMessage: string) => {
    // Add user message to chat (simulating what user selected)
    const userMessage: ChatMessage = {
      id: messages.length + 1,
      text: quickMessage,
      sender: 'user' as MessageSender,
      timestamp: new Date(),
    }

    setMessages([...messages, userMessage])
    setShowQuickMessages(false) // Hide quick messages after user selects one

    // Simulate bot response
    setTimeout(() => {
      const botResponse: ChatMessage = {
        id: messages.length + 2,
        text: 'Perfeito! Vou te redirecionar para o WhatsApp onde nossos especialistas podem te atender melhor. 📱',
        sender: 'bot' as MessageSender,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, botResponse])

      // Se o chat não estiver aberto, incrementar contador de não lidas
      if (!isOpen) {
        setUnreadCount((prev) => prev + 1)
      }

      // Redirect to WhatsApp after bot response
      setTimeout(() => {
        const whatsappMessage = `Olá! ${origem} e gostaria de ${quickMessage}`
        openWhatsApp(whatsappMessage)
        setIsOpen(false)
        setShowQuickMessages(true) // Reset for next time
      }, 1500)
    }, 1000)
  }

  const quickMessages = [
    'solicitar um orçamento de equipamentos',
    'saber sobre andaimes suspensos',
    'informações sobre cadeiras elétricas',
    'conhecer todos os equipamentos disponíveis',
  ]

  // Garante que o scroll do mouse atue dentro da área do chat,
  // sem “vazar” para o scroll principal da página
  const handleScrollWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.stopPropagation()
    const target = event.currentTarget
    target.scrollTop += event.deltaY
  }

  // Sem WhatsApp da locadora não há botão (nunca o número de outra locadora).
  if (!whatsappNumber) return null

  return (
    <>
      {/* Chat Window */}
      {isOpen && (
        <div
          className="fixed bottom-22.5 right-4 w-80 sm:w-96 rounded-xl shadow-2xl z-[99999] h-[500px] min-h-100 flex flex-col overflow-hidden"
          style={{ maxHeight: '90vh' }}
        >
          {/* Header - cor verde WhatsApp e sem bordas brancas */}
          <div className="bg-[var(--whatsapp)] text-white p-4 flex items-center justify-between rounded-t-xl shrink-0 relative">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                <span className="text-gray-900 font-bold text-lg">
                  {nome ? siglaDaLocadora(nome) : null}
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-lg">{nome ?? 'Atendimento'}</h3>
                <p className="text-sm text-green-100">
                  Equipamentos para Construção
                </p>
              </div>
            </div>
            <CloseButton
              onClick={() => setIsOpen(false)}
              className="absolute top-2 right-2 text-white hover:bg-green-600 hover:text-white border-0"
              variant="ghost"
              size="sm"
            />
          </div>

          {/* Messages + Quick Messages - área flexível */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Messages */}
            <div
              className={`flex-1 p-4 space-y-4 overscroll-y-contain bg-gray-50 ${CHAT_SCROLL}`}
              style={CHAT_SCROLLBAR}
              onWheel={handleScrollWheel}
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg text-sm shadow-sm ${
                      msg.sender === 'user'
                        ? `${WHATSAPP_GREEN} text-white rounded-br-none`
                        : 'bg-white text-gray-900 rounded-bl-none border'
                    }`}
                  >
                    {msg.text}
                    <div
                      className={`text-xs mt-1 opacity-70 ${
                        msg.sender === 'user'
                          ? 'text-green-100'
                          : 'text-gray-500'
                      }`}
                    >
                      {msg.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              ))}
              {/* Elemento invisível para scroll automático */}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Messages - apenas quando não há conversa */}
            {showQuickMessages && messages.length === 1 && (
              <div className="shrink-0 p-3 border-t bg-white">
                <p className="text-xs text-gray-600 mb-2 font-medium">
                  Mensagens rápidas:
                </p>
                <div
                  className={`space-y-1 max-h-20 overscroll-y-contain ${CHAT_SCROLL}`}
                  style={CHAT_SCROLLBAR}
                  onWheel={handleScrollWheel}
                >
                  {quickMessages.map((quickMsg, index) => (
                    <button
                      key={`quick-${index}-${quickMsg}`}
                      onClick={() => handleQuickMessage(quickMsg)}
                      className="block w-full text-left text-xs p-2 hover:bg-green-50 hover:text-green-700 rounded transition-colors border border-gray-200 hover:border-green-300"
                    >
                      • {quickMsg}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input - sempre visível no fundo */}
          <div className="whatsapp-input-area sticky bottom-0 shrink-0 p-4 border-t bg-white">
            <div className="flex gap-3 items-end">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Digite sua mensagem..."
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-1 h-12 text-base border-2 focus:border-green-500 rounded-lg px-4"
              />
              <Button
                onClick={handleSendMessage}
                size="lg"
                disabled={!message.trim()}
                className={`${WHATSAPP_GREEN} border border-green-400 text-white hover:border-green-500 h-12 w-12 rounded-lg hover:scale-105 transition-all`}
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* FAB Button - cor verde WhatsApp */}
      <div className="fixed bottom-6 right-6 z-[100000]">
        {/* Notification Badge - estilo numérico */}
        {unreadCount > 0 && !isOpen && (
          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1 animate-pulse border-2 border-white shadow-lg z-10">
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}

        {isOpen ? (
          <CloseButton
            onClick={() => setIsOpen(false)}
            variant="ghost"
            size="md"
            className="w-14 h-14 rounded-full text-white hover:text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 border-0 bg-green-500 hover:bg-green-600"
            aria-label="Fechar chat do WhatsApp"
          />
        ) : (
          <button
            onClick={() => setIsOpen(true)}
            className={`${WHATSAPP_GREEN} w-14 h-14 rounded-full text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 flex items-center justify-center`}
            aria-label="Abrir chat do WhatsApp"
          >
            <MessageCircle className="h-6 w-6" />
          </button>
        )}
      </div>
    </>
  )
}
