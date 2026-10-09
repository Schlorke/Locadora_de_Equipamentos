# 📚 Documentação - GB Locações

Bem-vindo à documentação completa do projeto GB-Locações! Esta seção contém toda
a informação técnica e guias necessários para desenvolver, manter e contribuir
com o projeto.

## 📖 Índice Geral

### [ai/](./ai/) - Contexto para IA

- **[boot.md](./ai/boot.md)** - Ordem minima de leitura para contexto.
- **[context-map.md](./ai/context-map.md)** - Mapa tarefa -> documentacao.
- **[context-precision-protocol.md](./ai/context-precision-protocol.md)** -
  Protocolo de precisao de contexto e reasoning.
- **[context-capsule-template.md](./ai/context-capsule-template.md)** - Template
  de context capsule.
- **[context-capsules/README.md](./ai/context-capsules/README.md)** - Diretrizes
  para capsules persistentes por tarefa.
- **[context-intake-output-checklist.md](./ai/context-intake-output-checklist.md)** -
  Checklist de absorcao/geracao de contexto.
- **[prompt-templates/README.md](./ai/prompt-templates/README.md)** - Templates
  de prompt hibrido.

### 🚀 [getting-started/](./getting-started/) - Primeiros Passos

- **[installation.md](./getting-started/installation.md)** - Setup inicial e
  instalação
- **[development.md](./getting-started/development.md)** - Guia de
  desenvolvimento
- **[deployment.md](./getting-started/deployment.md)** - Deploy e produção
- **[troubleshooting.md](./getting-started/troubleshooting.md)** - Solução de
  problemas comuns

### 🏗️ [architecture/](./architecture/) - Arquitetura

- **[overview.md](./architecture/overview.md)** - Visão geral da arquitetura
- **[diagrams/README.md](./architecture/diagrams/README.md)** - Diagramas e
  templates Mermaid
- **[overview.md#-modelo-de-dados](./architecture/overview.md#-modelo-de-dados)** -
  Modelo de dados e banco
- **[api.md](./architecture/api.md)** - Documentação completa da API
- **[security.md](./architecture/security.md)** - Aspectos de segurança

### ✨ [features/](./features/) - Funcionalidades

- **[INDEX.md](./features/INDEX.md)** - Indice rapido de features e docs
  criticos.
- **[\_template.md](./features/_template.md)** - Template padrao para novas
  features.
- **[admin-system.md](./features/admin-system.md)** - Sistema administrativo
- **[admin-page-header-pattern.md](./features/admin-page-header-pattern.md)** -
  📋 **Padrão AdminPageHeader e Erros Comuns** (OBRIGATÓRIO para novos headers)
- **[equipment-booking-system.md](./features/equipment-booking-system.md)** -
  Sistema de agendamento de equipamentos (planejamento)
- **[quote-system.md](./features/quote-system.md)** - Sistema de orçamentos
- **[email-templates.md](./features/email-templates.md)** - 📧 **Sistema de
  Templates de Email v2.0** (Documentação Completa)
- **[email-templates-quick-reference.md](./features/email-templates-quick-reference.md)** -
  📧 **Referência Rápida de Email Templates**
- **[quote-email-system.md](./features/quote-email-system.md)** - Sistema de
  envio de emails para orçamentos
- **[design-system.md](./features/design-system.md)** - Sistema de design
- **[hero-section.md](./features/hero-section.md)** - Layout completo da seção
  Hero

### 📖 [guides/](./guides/) - Guias Específicos

- **[wave135-base-validation.md](./guides/wave135-base-validation.md)** —
  Resultados e limites da validação local da primeira etapa.

- **[shared-api-acceptance.md](./guides/shared-api-acceptance.md)** — Provas
  operacionais locais, retorno ao legado e critérios para retirada da raiz.

- **[ai-database-integration.md](./guides/ai-database-integration.md)** -
  Integração IA + banco de dados
- **[storybook.md](./guides/storybook.md)** - Documentação do Storybook
- **[testing.md](./guides/testing.md)** - Testes e controle de qualidade
- **[hero-loading-background-fix.md](./guides/hero-loading-background-fix.md)** -
  🐛 Correção do flash branco/laranja no Hero
- **[safari-ios-autocomplete-positioning-fix.md](./guides/safari-ios-autocomplete-positioning-fix.md)** -
  🐛 Correção de bug crítico no Safari iOS
- **[google-indexing-seo.md](./guides/google-indexing-seo.md)** - 🌐 **Indexação
  no Google e SEO** (Search Console, sitemap, verificação)
- **[google-business-profile-map.md](./guides/google-business-profile-map.md)** -
  🗺️ **Aparecer no mapa do Google** (Google Business Profile, endereço,
  checklist)

### 📋 [references/](./references/) - Referências

- **[api.md](./architecture/api.md)** - Referência completa da API
- **[dependencies.md](./references/dependencies.md)** - Dependências e
  compatibilidade
- **[.env.example](../.env.example)** - Variáveis de ambiente (exemplo)

### 🐛 [issues/](./issues/) - Issues e Investigações

- **[known-issues.index.md](./issues/known-issues.index.md)** - Indice curto
  para busca rapida.
- **[known-issues.md](./issues/known-issues.md)** - 🐛 Problemas conhecidos e
  soluções (resolvidos)
- **[README.md](./issues/README.md)** - Índice de issues ativas
- **[tooltip-arrow-loading-issue.md](./issues/tooltip-arrow-loading-issue.md)** -
  Investigação sobre ordem de carregamento da seta do tooltip

### 🔧 [internal/](./internal/) - Documentação Interna

- **[cursor-setup.md](./internal/cursor-setup.md)** - Setup específico do Cursor
  IDE
- **[project-decisions.md](./internal/project-decisions.md)** - Decisões
  arquiteturais
- **[tools.md](./internal/tools.md)** - Ferramentas e utilitários internos
- **[migrate-storage-script.md](./internal/migrate-storage-script.md)** - 🔄
  Script de migração de storage Supabase
- **[orcamento-e-progresso.md](./internal/orcamento-e-progresso.md)** - Status
  financeiro e progresso das etapas
- **[prisma-client-regeneration.md](./internal/prisma-client-regeneration.md)** -
  Procedimento obrigatório de regen do Prisma Client
- **[documentation-security-guidelines.md](./internal/documentation-security-guidelines.md)** -
  🔐 Diretrizes obrigatórias para segurança em documentação (NUNCA exponha
  credenciais)
- **[ai-documentation-system-analysis.md](./internal/ai-documentation-system-analysis.md)** -
  📊 Análise completa do sistema de documentação e janela de contexto para IAs
  (como funciona, onde cria/atualiza docs, como se orienta)
- **[ceo-google-seo-notes.md](./internal/ceo-google-seo-notes.md)** - Notas para
  o CEO: Google (10+, localização), Facebook oficial, Instagram (conta ainda não
  criada)
- **[prompt-facebook-servicos.md](./internal/prompt-facebook-servicos.md)** -
  Prompt para extensão Claude no navegador: atualizar seção Serviços da página
  GB Locações no Facebook
- **[prompt-google-search-console-seo.md](./internal/prompt-google-search-console-seo.md)** -
  Prompt para extensão Claude: configurar Google Search Console (indexação, SEO,
  geolocalização)

### 🗄️ [archive/](./archive/) - Arquivo (histórico, não é o estado atual)

- **[archive/](./archive/)** - Documentos do usuário que estavam soltos na raiz:
  [ANALISE_SAAS_COMPLETA.md](./archive/ANALISE_SAAS_COMPLETA.md) (análise de
  jan/2025, superada pela ADR de assinatura),
  [CLAUDE_APP_INSTRUCTIONS.md](./archive/CLAUDE_APP_INSTRUCTIONS.md) e os
  relatórios de pesquisa de [context-window/](./archive/context-window/).

### 🕰️ Registros históricos (código da época)

Os relatórios de `issues/` (exceto `known-issues.index.md`), as entradas antigas
de `issues/known-issues.md`, `internal/`, `audit/`, `migration/`, `archive/` e
`PROMPT_CURSOR_FINANCEIRO.md` registram o código de quando foram escritos:
caminhos como `components/`, `hooks/`, `stores/`, `lib/telemetry.ts` ou
`lib/stripe.ts` podem não existir mais. Não os use como mapa do código atual;
para isso, `AGENTS.md`, `CLAUDE.md`, `docs/ai/` e `architecture/overview.md`.
Para ver o arquivo citado, use `git show <commit>:<arquivo>` com o commit da
época (a faxina da onda 9 partiu de `4b02f52f`).

## 🎯 Navegação Rápida

### Para Novos Desenvolvedores

1. 📖 Comece com
   [getting-started/installation.md](./getting-started/installation.md)
2. 🔧 Configure o ambiente seguindo
   [getting-started/development.md](./getting-started/development.md)
3. 🏗️ Entenda a arquitetura em
   [architecture/overview.md](./architecture/overview.md)
4. 🎨 Explore o design system em
   [features/design-system.md](./features/design-system.md)

### Para Contribuidores

1. 📋 Leia [../CONTRIBUTING.md](../CONTRIBUTING.md)
2. 🧪 Configure testes seguindo [guides/testing.md](./guides/testing.md)
3. 🔄 Entenda o deploy em
   [getting-started/deployment.md](./getting-started/deployment.md)
4. 🎭 Use o Storybook conforme [guides/storybook.md](./guides/storybook.md)

### Para Arquitetos/Lead Developers

1. 🏗️ Revise [architecture/](./architecture/) completo
2. 🔐 Analise aspectos de segurança em
   [architecture/security.md](./architecture/security.md)
3. 📊 Entenda decisões em
   [internal/project-decisions.md](./internal/project-decisions.md)
4. 🔗 Configure dependências via
   [references/dependencies.md](./references/dependencies.md)

## 🛠️ Manutenção da Documentação

### ✅ Princípios

- **Atualização contínua**: Documentação evolui com o código
- **Clareza**: Linguagem simples e objetiva
- **Exemplos práticos**: Sempre incluir código e exemplos
- **Navegação intuitiva**: Links internos e estrutura lógica

### 📝 Como Contribuir

1. Identifique gaps ou informações desatualizadas
2. Crie/edite arquivos seguindo a estrutura existente
3. Mantenha formato Markdown consistente
4. Teste todos os links e exemplos de código
5. Submeta PR com descrição clara das mudanças

### 🔍 Checklist para Novos Documentos

- [ ] Título claro e descritivo
- [ ] Índice para documentos longos
- [ ] Exemplos de código funcionais
- [ ] Links para documentos relacionados
- [ ] Data de última atualização
- [ ] Revisão de português/gramática

## 🔗 Links Úteis

### 📚 Documentação Externa

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Radix UI](https://www.radix-ui.com/primitives/docs/overview/introduction)

### 🛠️ Ferramentas

- [Storybook](https://storybook.js.org/docs)
- [Vitest](https://vitest.dev/guide)
- [Playwright](https://playwright.dev/docs/intro)
- [Vercel](https://vercel.com/docs)

---

## 📞 Suporte

Encontrou algo confuso ou desatualizado?

- 🐛 [Abra uma issue](https://github.com/GBLocacoes/GB-Locacoes/issues)
- 💬
  [Inicie uma discussão](https://github.com/GBLocacoes/GB-Locacoes/discussions)
- 📧 Email: contato@locacoesgb.com.br

---

_Esta documentação é mantida pela equipe GB-Locações e pela comunidade.
Contribuições são sempre bem-vindas!_
