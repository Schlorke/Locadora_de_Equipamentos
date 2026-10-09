'use client'

import { Button } from '../../../shared/ui'
import { toastExamples } from '../model/examples'

export function TesteToastPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white rounded-2xl p-8 shadow-xl">
          <h1 className="text-4xl font-bold text-slate-800 mb-3">
            🎨 Teste Completo de Toasts Sonner
          </h1>
          <p className="text-slate-600 text-lg">
            Todos os tipos de notificações configuradas no projeto
          </p>
        </div>

        {/* Toasts Básicos */}
        <div className="bg-white rounded-2xl p-8 shadow-xl">
          <h2 className="text-2xl font-semibold text-slate-800 mb-6">
            📢 Toasts Básicos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Button
              onClick={toastExamples[0]!.run}
              className="bg-green-600 hover:bg-green-700 h-20"
            >
              ✓ Success Toast
            </Button>

            <Button
              onClick={toastExamples[1]!.run}
              variant="destructive"
              className="h-20"
            >
              ✕ Error Toast
            </Button>

            <Button
              onClick={toastExamples[2]!.run}
              className="bg-orange-600 hover:bg-orange-700 h-20"
            >
              ⚠ Warning Toast
            </Button>

            <Button
              onClick={toastExamples[3]!.run}
              className="bg-blue-600 hover:bg-blue-700 h-20"
            >
              ⓘ Info Toast
            </Button>

            <Button
              onClick={toastExamples[4]!.run}
              className="bg-gray-600 hover:bg-gray-700 h-20"
            >
              ⟳ Loading Toast
            </Button>

            <Button
              onClick={toastExamples[5]!.run}
              variant="outline"
              className="h-20"
            >
              Default Toast
            </Button>
          </div>
        </div>

        {/* Toasts Sem Descrição */}
        <div className="bg-white rounded-2xl p-8 shadow-xl">
          <h2 className="text-2xl font-semibold text-slate-800 mb-6">
            📝 Toasts Sem Descrição (Apenas Título)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Button
              onClick={toastExamples[6]!.run}
              className="bg-green-600 hover:bg-green-700"
            >
              Sucesso
            </Button>

            <Button onClick={toastExamples[7]!.run} variant="destructive">
              Erro
            </Button>

            <Button
              onClick={toastExamples[8]!.run}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Aviso
            </Button>

            <Button
              onClick={toastExamples[9]!.run}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Info
            </Button>

            <Button
              onClick={toastExamples[10]!.run}
              className="bg-gray-600 hover:bg-gray-700"
            >
              Loading
            </Button>
          </div>
        </div>

        {/* Toasts com Action Button */}
        <div className="bg-white rounded-2xl p-8 shadow-xl">
          <h2 className="text-2xl font-semibold text-slate-800 mb-6">
            🔘 Toasts com Botão de Ação
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Button
              onClick={toastExamples[11]!.run}
              className="bg-green-600 hover:bg-green-700 h-16"
            >
              Success com Ação
            </Button>

            <Button
              onClick={toastExamples[12]!.run}
              variant="outline"
              className="h-16"
            >
              Default com Ação
            </Button>

            <Button
              onClick={toastExamples[13]!.run}
              className="bg-orange-600 hover:bg-orange-700 h-16"
            >
              Toast com Action + Cancel
            </Button>
          </div>
        </div>

        {/* Promise Toast */}
        <div className="bg-white rounded-2xl p-8 shadow-xl">
          <h2 className="text-2xl font-semibold text-slate-800 mb-6">
            ⏳ Promise Toast (Loading → Success/Error)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={toastExamples[14]!.run}
              className="bg-purple-600 hover:bg-purple-700 h-16"
            >
              Promise Success (2s)
            </Button>

            <Button
              onClick={toastExamples[15]!.run}
              variant="destructive"
              className="h-16"
            >
              Promise Error (2s)
            </Button>
          </div>
        </div>

        {/* Exemplos Práticos do Sistema */}
        <div className="bg-white rounded-2xl p-8 shadow-xl">
          <h2 className="text-2xl font-semibold text-slate-800 mb-6">
            🎯 Exemplos Práticos do Sistema
          </h2>
          <div className="space-y-3">
            <Button
              onClick={toastExamples[16]!.run}
              className="w-full bg-green-600 hover:bg-green-700 h-16 justify-start px-6"
            >
              📦 Cadastrar Equipamento
            </Button>

            <Button
              onClick={toastExamples[17]!.run}
              className="w-full bg-green-600 hover:bg-green-700 h-16 justify-start px-6"
            >
              🏷️ Atualizar Categoria
            </Button>

            <Button
              onClick={toastExamples[18]!.run}
              variant="destructive"
              className="w-full h-16 justify-start px-6"
            >
              ❌ Erro de Validação
            </Button>

            <Button
              onClick={toastExamples[19]!.run}
              className="w-full bg-orange-600 hover:bg-orange-700 h-16 justify-start px-6"
            >
              ⚠️ Validação de Formulário
            </Button>

            <Button
              onClick={toastExamples[20]!.run}
              className="w-full bg-blue-600 hover:bg-blue-700 h-16 justify-start px-6"
            >
              💡 Anúncio de Feature
            </Button>
          </div>
        </div>

        {/* Teste de Limite */}
        <div className="bg-white rounded-2xl p-8 shadow-xl">
          <h2 className="text-2xl font-semibold text-slate-800 mb-6">
            🔢 Teste de Limite (Máx 3 Simultâneos)
          </h2>
          <Button onClick={toastExamples[21]!.run} className="w-full h-16">
            Disparar 5 Toasts Simultâneos
          </Button>
        </div>

        {/* Especificações Técnicas */}
        <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-2xl p-8 shadow-xl text-white">
          <h2 className="text-2xl font-semibold mb-6">
            ✨ Especificações Implementadas
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-lg mb-3">🎨 Design</h3>
              <ul className="space-y-2 text-sm">
                <li>✓ Cores suaves em tons pastéis</li>
                <li>✓ Ícones coloridos do Lucide React</li>
                <li>✓ Bordas arredondadas e sombras</li>
                <li>✓ Hover suave no botão close</li>
                <li>✓ Alinhamento perfeito dos elementos</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-3">⚙️ Funcionalidades</h3>
              <ul className="space-y-2 text-sm">
                <li>✓ Auto-dismiss após 4 segundos</li>
                <li>✓ Limite de 3 toasts simultâneos</li>
                <li>✓ Posicionamento top-center</li>
                <li>✓ Swipe to dismiss</li>
                <li>✓ Botão de fechar sempre visível</li>
                <li>✓ Suporte a Promise toasts</li>
                <li>✓ Action buttons customizáveis</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
