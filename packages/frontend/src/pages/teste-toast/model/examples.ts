import { toast } from '../../../shared/lib/toast'
export const toastExamples = [
  {
    label: '✓ Success Toast',
    section: '📢 Toasts Básicos',
    variant: 'default' as const,
    run: () =>
      toast.success('Sucesso!', {
        description: 'Operação concluída com sucesso.',
      }),
  },
  {
    label: '✕ Error Toast',
    section: '📢 Toasts Básicos',
    variant: 'destructive' as const,
    run: () =>
      toast.error('Erro!', {
        description: 'Algo deu errado. Tente novamente.',
      }),
  },
  {
    label: '⚠ Warning Toast',
    section: '📢 Toasts Básicos',
    variant: 'default' as const,
    run: () =>
      toast.warning('Atenção!', {
        description: 'Cuidado com esta ação importante.',
      }),
  },
  {
    label: 'ⓘ Info Toast',
    section: '📢 Toasts Básicos',
    variant: 'default' as const,
    run: () =>
      toast.info('Informação', {
        description: 'Esta é uma informação útil para você.',
      }),
  },
  {
    label: '⟳ Loading Toast',
    section: '📢 Toasts Básicos',
    variant: 'default' as const,
    run: () =>
      toast.loading('Carregando...', {
        description: 'Por favor aguarde.',
      }),
  },
  {
    label: 'Default Toast',
    section: '📢 Toasts Básicos',
    variant: 'outline' as const,
    run: () => toast('Default', { description: 'Toast padrão neutro' }),
  },
  {
    label: 'Sucesso',
    section: '📝 Toasts Sem Descrição (Apenas Título)',
    variant: 'default' as const,
    run: () => toast.success('Salvo!'),
  },
  {
    label: 'Erro',
    section: '📝 Toasts Sem Descrição (Apenas Título)',
    variant: 'destructive' as const,
    run: () => toast.error('Falhou!'),
  },
  {
    label: 'Aviso',
    section: '📝 Toasts Sem Descrição (Apenas Título)',
    variant: 'default' as const,
    run: () => toast.warning('Cuidado!'),
  },
  {
    label: 'Info',
    section: '📝 Toasts Sem Descrição (Apenas Título)',
    variant: 'default' as const,
    run: () => toast.info('FYI'),
  },
  {
    label: 'Loading',
    section: '📝 Toasts Sem Descrição (Apenas Título)',
    variant: 'default' as const,
    run: () => toast.loading('Aguarde...'),
  },
  {
    label: 'Success com Ação',
    section: '🔘 Toasts com Botão de Ação',
    variant: 'default' as const,
    run: () =>
      toast.success('Arquivo deletado', {
        description: 'O arquivo foi removido permanentemente.',
        action: {
          label: 'Desfazer',
          onClick: () => toast.info('Ação desfeita!'),
        },
      }),
  },
  {
    label: 'Default com Ação',
    section: '🔘 Toasts com Botão de Ação',
    variant: 'outline' as const,
    run: () =>
      toast('Mensagem enviada', {
        description: 'Sua mensagem foi enviada com sucesso.',
        action: {
          label: 'Ver',
          onClick: () => toast.info('Abrindo mensagem...'),
        },
      }),
  },
  {
    label: 'Toast com Action + Cancel',
    section: '🔘 Toasts com Botão de Ação',
    variant: 'default' as const,
    run: () =>
      toast.warning('Confirmar exclusão?', {
        description: 'Esta ação não pode ser desfeita.',
        action: {
          label: 'Confirmar',
          onClick: () => toast.success('Item excluído!'),
        },
        cancel: {
          label: 'Cancelar',
          onClick: () => toast.info('Ação cancelada'),
        },
      }),
  },
  {
    label: 'Promise Success (2s)',
    section: '⏳ Promise Toast (Loading → Success/Error)',
    variant: 'default' as const,
    run: () => {
      const promise = (): Promise<{ name: string }> =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ name: 'Dados' }), 2000)
        )

      toast.promise(promise, {
        loading: 'Carregando dados...',
        success: (data) => `${data.name} carregados com sucesso!`,
        error: 'Erro ao carregar dados',
      })
    },
  },
  {
    label: 'Promise Error (2s)',
    section: '⏳ Promise Toast (Loading → Success/Error)',
    variant: 'destructive' as const,
    run: () => {
      const promise = () =>
        new Promise((_, reject) => setTimeout(() => reject(), 2000))

      toast.promise(promise, {
        loading: 'Processando...',
        success: 'Processado com sucesso!',
        error: 'Falha no processamento',
      })
    },
  },
  {
    label: '📦 Cadastrar Equipamento',
    section: '🎯 Exemplos Práticos do Sistema',
    variant: 'default' as const,
    run: () =>
      toast.success('Equipamento cadastrado!', {
        description: 'O equipamento foi adicionado ao catálogo.',
      }),
  },
  {
    label: '🏷️ Atualizar Categoria',
    section: '🎯 Exemplos Práticos do Sistema',
    variant: 'default' as const,
    run: () =>
      toast.success('Categoria atualizada!', {
        description: 'As alterações foram salvas com sucesso.',
      }),
  },
  {
    label: '❌ Erro de Validação',
    section: '🎯 Exemplos Práticos do Sistema',
    variant: 'destructive' as const,
    run: () =>
      toast.error('Falha ao salvar', {
        description: 'Verifique os campos obrigatórios e tente novamente.',
      }),
  },
  {
    label: '⚠️ Validação de Formulário',
    section: '🎯 Exemplos Práticos do Sistema',
    variant: 'default' as const,
    run: () =>
      toast.warning('Campos obrigatórios', {
        description: 'Por favor, preencha todos os campos antes de continuar.',
      }),
  },
  {
    label: '💡 Anúncio de Feature',
    section: '🎯 Exemplos Práticos do Sistema',
    variant: 'default' as const,
    run: () =>
      toast.info('Novo recurso disponível', {
        description: 'Agora você pode exportar relatórios em PDF!',
      }),
  },
  {
    label: 'Disparar 5 Toasts Simultâneos',
    section: '🔢 Teste de Limite (Máx 3 Simultâneos)',
    variant: 'default' as const,
    run: () => {
      toast.success('Toast 1', { description: 'Primeiro toast' })
      setTimeout(
        () => toast.success('Toast 2', { description: 'Segundo toast' }),
        100
      )
      setTimeout(
        () => toast.success('Toast 3', { description: 'Terceiro toast' }),
        200
      )
      setTimeout(
        () =>
          toast.warning('Toast 4', {
            description: 'Este deve empilhar ou substituir (limite de 3)',
          }),
        300
      )
      setTimeout(
        () =>
          toast.info('Toast 5', {
            description: 'Este também deve respeitar o limite',
          }),
        400
      )
    },
  },
]
