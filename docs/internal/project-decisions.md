# 🤖 Decisões de Projeto e Instruções para Agentes - GB Locações

## 📚 **DOCUMENTAÇÃO COMO FONTE DE VERDADE**

> ⚠️ **FUNDAMENTAL**: SEMPRE consulte a documentação em `docs/` antes de
> implementar qualquer funcionalidade

### **📁 Estrutura da Documentação (ATUALIZADA - DEZ 2024)**

```
📁 docs/                          # CONSULTAR SEMPRE PRIMEIRO
├── 📁 getting-started/           # Setup, desenvolvimento, deploy
├── 📁 architecture/              # Arquitetura técnica
├── 📁 features/                  # Funcionalidades específicas
├── 📁 guides/                    # Guias específicos
├── 📁 references/                # Referências técnicas
└── 📁 internal/                  # Documentação interna (este arquivo)
```

### **🧠 Anti-Alucinação Protocol**

1. **📖 LEIA PRIMEIRO**: `docs/architecture/overview.md` - Arquitetura completa
2. **🎨 DESIGN SYSTEM**: `docs/features/design-system.md` - Componentes oficiais
3. **⚠️ COMPATIBILIDADE**: `docs/references/dependencies.md` - Versões testadas
4. **🚨 NÃO ALUCINE**: Se não souber, consulte a documentação primeiro
5. **📝 DOCUMENTE**: Sempre atualize `CHANGELOG.md` após alterações

### **🚨 DECISÕES CRÍTICAS IMPLEMENTADAS (DEZ 2024)**

#### **🏗️ INFRASTRUCTURE AUTOMATION**

- **Decisão**: Criar script `scripts/post-prisma-generate.js` para recriar
  `lib/validations/index.ts` automaticamente
- **Problema**: Prisma generate deleta diretório completo, causando build
  failure
- **Implementação**: Automação em todos os scripts que rodam Prisma (`prebuild`,
  `postinstall`, `db:generate`)
- **Status**: ✅ Resolvido permanentemente - Build automation funcionando.
  Superada em 2026-09-30: o `generator zod` saiu na onda 9 e o script, com a
  saída gerada de `lib/validations`, saiu depois (entrada 227 de
  `docs/issues/known-issues.md`)

#### **🔒 TYPE SAFETY OBRIGATÓRIO**

- **Decisão**: Eliminar TODOS os tipos `any` e implementar type safety total
- **Problema**: 42 erros TypeScript, tipos `unknown`, navegação insegura
- **Implementação**:
  - Interfaces específicas (`RequestLike`, `ResponseLike`, `OpenAPIMethodSpec`)
  - Safe navigation (`trace.spans[0]?.name`, `req.headers?.['user-agent']`)
  - Type guards e casts seguros (`as NextResponse`, `as const`)
- **Status**: ✅ Zero TypeScript errors - 100% type safe

#### **🎯 ZERO TOLERANCE PARA LINTING ERRORS**

- **Decisão**: Resolver TODOS os 31,469 problemas de ESLint
- **Problema**: Arquivos auto-gerados incluídos, overwhelming developer
  experience
- **Implementação**:
  - `tsconfig.json`: Exclusão de `lib/validations/schemas/**/*.ts`
  - Automation scripts para unused imports
  - Ignore patterns refinados em `eslint.config.js`
- **Status**: ✅ Zero ESLint problems - Developer experience perfeita

#### **📦 DEPENDENCY MANAGEMENT**

- **Decisão**: Manter matrix rigorosa de compatibilidade para stability
- **Implementação**:
  - Prisma: Manter versão estável e funcional
  - React 19: Overrides para dependências incompatíveis
  - swagger-ui-react: REMOVIDO, implementação custom criada
  - node-domexception: Sem dependência direta; override apenas se warnings
    voltarem a incomodar
- **Status**: ✅ Dependency stability garantida

#### **🧭 Proxy (substitui middleware)**

- **Decisão**: Adotar o arquivo `proxy.ts` no lugar de `middleware.ts` seguindo
  a renomeação oficial do Next.js 16.
- **Implementação**: Arquivo raiz renomeado para `proxy.ts`, mantendo `withAuth`
  e `config.matcher` para `/admin` e `/debug`.
- **Motivação**: Remover warnings de build na Vercel e alinhar com a convenção
  futura.
- **Status**: ✅ Ativo e documentado

#### **🔐 SEGURANÇA EM DOCUMENTAÇÃO (DEZ 2025)**

- **Decisão**: Estabelecer diretrizes obrigatórias para evitar exposição de
  credenciais em arquivos de documentação
- **Problema**: Chaves de API do Asaas foram expostas em múltiplos arquivos de
  documentação versionados no Git
- **Implementação**:
  - Criação de `docs/internal/documentation-security-guidelines.md` com regras
    obrigatórias
  - Sanitização de todos os arquivos de documentação com credenciais expostas
  - Uso obrigatório de placeholders genéricos (`[SUA_API_KEY_AQUI]`,
    `your-production-token`, etc.)
  - Checklist de validação antes de commits
- **Regra de Ouro**: NUNCA exponha credenciais reais em documentação, mesmo que
  pareçam "exemplos"
- **Status**: ✅ Diretrizes implementadas e documentadas - Consulte
  `docs/internal/documentation-security-guidelines.md`

Este documento orienta colaboradores humanos **e agentes automatizados** sobre
como trabalhar neste repositório GB Locações.

---

## 🧱 Estrutura e estilo do código

- Projeto em **Next.js 15** (App Router) e **TypeScript**.
- Nomes de arquivos e pastas sempre em inglês e minúsculo.
- Rode **eslint** e **prettier** antes de enviar pull requests.
- Siga os utilitários **TailwindCSS** e o design system **ShadCN UI** já
  presentes.
- ❌ **NÃO** alterar design, animações ou responsividade já implementados.
- ✅ Padrão de foco: `focus:border-blue-500` **e/ou**
  `focus:outline-blue-500 focus:outline-2` para todos os elementos interativos.

---

## ⚙️ Configurações e scripts

- Variáveis de ambiente documentadas em **`.env.example`**.
- Rodar localmente:

```bash
pnpm install
pnpm dev
```

- Lint e testes:

```bash
pnpm lint
pnpm test
```

### ⚠️ **CRÍTICO: Compatibilidade de Dependências**

#### **🚨 NUNCA ATUALIZAR estas dependências:**

```bash
# ❌ Prisma 6.14.0+ causa erro de inicialização
@prisma/client@latest  # Manter versão estável
prisma@latest          # Manter versão estável

# ❌ Tailwind 4.x quebra o design system
tailwindcss@3.4.17     # MANTER nesta versão
```

#### **✅ Processo OBRIGATÓRIO para atualizações:**

```bash
# 1. SEMPRE verificar compatibilidade primeiro
pnpm outdated

# 2. Atualizar APENAS dependências seguras
pnpm update @radix-ui/react-*  # UI components - OK
pnpm update @testing-library/* # Testing - OK

# 3. SEMPRE testar build após qualquer atualização
pnpm run build  # <- CRÍTICO! Detecta problemas

# 4. Se build quebrar, reverter IMEDIATAMENTE
git checkout package.json pnpm-lock.yaml
pnpm install
```

#### **📚 Documentação:**

- **[DEPENDENCY_COMPATIBILITY_GUIDE.md](./DEPENDENCY_COMPATIBILITY_GUIDE.md)** -
  Guia completo
- **[PRISMA_TROUBLESHOOTING.md](./PRISMA_TROUBLESHOOTING.md)** - Problemas do
  Prisma

---

## 🗂️ Estrutura recomendada de pastas

- `app/` – rotas da aplicação (Next.js App Router)
- `components/` – componentes visuais reutilizáveis
- `lib/` – funções auxiliares e integrações externas
- `types/` – tipos globais TypeScript
- `schemas/` – validações com Zod
- `middlewares/` – autenticação, logs, proteção
- `prisma/` – schema do banco de dados e seeds
- `public/` – arquivos estáticos

---

## 🔐 Variáveis de ambiente críticas

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `ZAPSIGN_API_KEY`
- `SENDGRID_API_KEY`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 🚀 Comandos úteis

| Comando                     | Descrição                                    |
| --------------------------- | -------------------------------------------- |
| `pnpm dev`                  | Rodar o projeto localmente                   |
| `pnpm lint`                 | Verificar estilo e formatação                |
| `pnpm test`                 | Executar testes criticos (Vitest + integra)  |
| `docker-compose up --build` | Subir ambiente local com Docker + PostgreSQL |
| `prisma migrate dev`        | Aplicar migrations localmente                |
| `prisma studio`             | UI visual do banco de dados                  |

---

## 🔄 Política de branches e commits

- Use branches descritivas, ex.: `feature/add-login`, `fix/navbar-bug`.
- Commits curtos, claros e no imperativo. Ex.: `feat: implement budget button`.

---

## 📥 Revisão e Pull Requests

- PRs devem conter **objetivo**, **passos de teste** e checklist:

```md
## Objetivo

[Descreva brevemente o que foi feito.]

## Como testar

[Explique os passos para validar as alterações.]

## Checklist

- [ ] Código limpo
- [ ] Testes passando
- [ ] Sem alteração de design
- [ ] Foco azul (`focus:border-blue-500` ou `focus:outline-blue-500`)
```

---

## 🤖 Agentes e responsabilidades automatizadas

| Agente           | Responsabilidade                              |
| ---------------- | --------------------------------------------- |
| `quote-agent`    | Gera orçamentos a partir do catálogo          |
| `contract-agent` | Dispara assinatura digital (ZapSign)          |
| `email-agent`    | Envia e‑mails transacionais (Resend/SendGrid) |
| `logger-agent`   | Registra ações sensíveis (Pino)               |
| `cleanup-agent`  | Remove dependências obsoletas                 |

---

## 🔒 Regras obrigatórias para **agentes de IA**

1. **Foco acessível em azul:**
   - Implementar `focus:border-blue-500` **e/ou**
     `focus:outline-blue-500 focus:outline-2`.
   - `focus:ring` deve permanecer **desativado** (`focus:ring-0`), salvo
     exceções aprovadas.
2. **Proibição de alteração visual existente:**
   - Não modificar estilos, animações, delays ou identidade já aplicada.
3. **Não sobrescrever componentes reutilizáveis existentes.**
4. **Não adicionar dependências** sem justificativa técnica.
5. Priorizar **modularidade, segurança** e **legibilidade**.
6. Usar **Zod** em todas as validações de entrada/saída.
7. Utilizar **middlewares** para controle de acesso (admin/cliente).

### Snippet global recomendado (Tailwind Layer Base)

```css
@layer base {
  input:not([type="checkbox"]):not([type="radio"]),
  select,
  textarea {
    @apply border-gray-200 focus:border-blue-500 focus:outline-blue-500 focus:outline-2 focus:ring-0;
  }
}
```

---

## ✅ Em caso de dúvida

A IA (ou contributor) deve:

- Priorizar segurança, clareza e organização.
- Criar novos arquivos ou componentes **sem alterar** estilos existentes.
- Solicitar **aprovação** antes de qualquer mudança sensível.
