# Melhorias de Acessibilidade - GB Locações

## Resumo das Correções Implementadas

### 🎯 Objetivo

Resolver problemas de acessibilidade e consistência identificados na
documentação do design system e README, garantindo conformidade com WCAG 2.1 e
melhor experiência para usuários com necessidades especiais.

### 📊 Status do registro anterior: correções documentadas

Os itens 1–4 registram a etapa anterior, não uma auditoria atual completa de
WCAG. Contratos/versões atuais ficam em design-system.md e dependencies.md;
conformidade de contraste, teclado e dispositivos exige sua própria evidência.

### 1. Problema do Storybook Resolvido ✅

**Problema**: Incompatibilidade de versões entre pacotes do Storybook

- **Storybook core**: 9.1.1
- **@storybook/addon-essentials**: 8.6.14 (incompatível)

**Solução histórica**: Atualização para versão compatível naquela etapa. O
comando abaixo é o registro executado então, não receita atual de instalar
@next; o workspace atual usa o lockfile e o guia de Storybook.

```bash
pnpm add -D @storybook/addon-essentials@next -w
```

**Resultado**: Build do Storybook funcionando corretamente

### 2. Consistência de Cores no Design System ✅

**Problema**: Button variant `ghost` usava cores cinza inconsistentes com a
paleta da marca

**Antes**:

```tsx
ghost: "hover:bg-gray-200 hover:text-gray-900 hover:text-slate-900"
```

**Depois** (Identidade Visual GB Locações):

```tsx
ghost: "hover:text-orange-600 hover:scale-105"
```

**Benefícios**:

- **Consistência**: Com a identidade visual laranja (#ea580c) da marca
- **Limpeza Visual**: Sem mudança de background, apenas texto e escala
- **Alinhamento**: Com a paleta de cores oficial do projeto
- **Micro-interações**: Hover com escala sutil para melhor feedback visual

### 3. Padrão de Foco para Acessibilidade ✅

**Problema**: Componentes não tinham padrão de foco visual consistente

**Solução Implementada**:

```tsx
// Padrão aplicado em Button e FilterResetButton
focus:outline-none focus:ring-2 focus:ring-ring
```

**Componentes Atualizados**:

- `packages/ui/src/web/Button.web.tsx`
- `packages/ui/src/web/FilterResetButton.web.tsx`
- `packages/ui/src/web/CloseButton.web.tsx`
- `packages/ui/src/web/CustomSelect.web.tsx`
- `packages/ui/src/web/ImageUpload.web.tsx`

**Benefícios**:

- **Navegação**: Melhor navegação por teclado
- **Conformidade**: Com WCAG 2.1
- **Experiência**: Visual consistente
- **Consistência**: Usa variável CSS `--ring` para consistência com tema

### 4. Padronização de Foco Implementada ✅

**Problema**: Componentes usavam padrões de foco inconsistentes (alguns com
`focus:border-blue-500`, outros sem foco visível)

**Solução**: Padronização completa para todos os componentes interativos

**Componentes Padronizados**:

- `packages/ui/src/web/Button.web.tsx` - ✅ Padrão de foco consistente
- `packages/ui/src/web/FilterResetButton.web.tsx` - ✅ Padrão de foco
  consistente
- `packages/ui/src/web/CloseButton.web.tsx` - ✅ Padrão de foco adicionado
- `packages/ui/src/web/CustomSelect.web.tsx` - ✅ Padrão de foco padronizado
- `packages/ui/src/web/ImageUpload.web.tsx` - ✅ Todos os botões de navegação
  padronizados

**Padrão Unificado**:

```tsx
focus:outline-none focus:ring-2 focus:ring-ring
```

### 5. Foco atual por owner e camada

A entrada atual é `packages/frontend/src/app/styles/globals.web.css`, com
camadas theme/base/components/utilities e imports de estilos com dono. A antiga
receita de reset universal em app/globals.css é histórica; a ponte CSS da raiz
foi aposentada em F. Nunca reintroduzir !important ou apagar todos os
indicadores de foco.

- `packages/ui/src/web/focus-ring.ts` define FOCUS_RING de teclado,
  MENU_FOCUS_RING por modalidade de entrada e HALO_FOCUS_OUTLINE para controles
  cuja sombra desaparece em forced-colors. Consultar o componente, não aplicar
  uma classe global indistintamente.
- `packages/frontend/src/app/styles/forms.web.css` trata controles nativos sem
  componente dono em base, com :where e tokens/halo próprios. Input, Checkbox e
  Select de packages/ui mantêm seus estilos.
- `outline.web.css` conserva a semântica Tailwind 3 da produção em Tailwind 4;
  `vendor/recharts.web.css` trata o foco da superfície do gráfico.

A inspeção destes owners descreve implementação e limitações; não certifica nova
auditoria de contraste, teclado, leitor de tela ou alto contraste real.

## Diretrizes de Acessibilidade

### 1. Contraste de Cores

- **Mínimo**: 4.5:1 para texto normal
- **Mínimo**: 3:1 para texto grande
- **Ferramentas**: Usar ferramentas como axe-core para verificação

### 2. Navegação por Teclado

- **Focabilidade**: Todos os elementos interativos devem ser focáveis
- **Ordem**: Ordem de tabulação lógica
- **Indicadores**: Indicadores visuais de foco

### 3. Semântica HTML

- **Elementos**: Usar elementos HTML apropriados
- **ARIA**: Atributos ARIA quando necessário
- **Labels**: Labels associados a controles

### 4. Anúncios de Estado

- **aria-live**: Para toasts e notificações
- **aria-busy**: Para estados de carregamento
- **aria-label**: Para elementos sem texto visível

## Testes de Acessibilidade

### Storybook

- Testes automáticos com axe-core
- Verificação de contraste
- Navegação por teclado

### Ferramentas Recomendadas

- **[axe-core](https://github.com/dequelabs/axe-core)**: Testes de
  acessibilidade automatizados
- **[WAVE](https://wave.webaim.org/)**: Avaliação de acessibilidade web
- **[Lighthouse](https://developers.google.com/web/tools/lighthouse)**:
  Auditoria de performance e acessibilidade

## Próximos Passos

### ✅ Concluído

1. **Padronização de Foco**: Todos os componentes UI principais padronizados
2. **Consistência de Cores**: Button variant `ghost` corrigido
3. **Storybook**: Compatibilidade resolvida
4. **Documentação**: Guias de acessibilidade criados

### 🔄 Em Andamento

1. **Auditoria Completa**: Revisar componentes restantes para padrões de
   acessibilidade
2. **Testes Automatizados**: Implementar testes de acessibilidade no CI/CD
3. **Monitoramento**: Implementar métricas de acessibilidade

### 📋 Pendente

1. **Componentes Específicos**: Verificar componentes de terceiros e
   customizados
2. **Validação de Contraste**: Auditoria completa de contraste de cores
3. **Navegação por Teclado**: Testes completos de navegação

## Referências

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Web Accessibility Initiative](https://www.w3.org/WAI/)
- [A11y Project](https://www.a11yproject.com/)
