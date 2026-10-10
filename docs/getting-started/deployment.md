# 🚀 Preparação de Deploy e Produção

> **Escopo**: configuração dos hosts e pré-condições de uma futura implantação.
> Publicação Git e ensaios locais não criam hospedagem, banco cloud ou cron.

O web está em `apps/clients/web`, a API em `apps/services/api` e o cliente Expo
em `apps/clients/mobile`. A implementação compartilhada permanece nos packages;
não existe um novo deploy do Next da raiz após sua aposentadoria.

O origin deste produto é `Schlorke/Locadora_de_Equipamentos`. O repositório,
projetos, domínios, credenciais e dados de produção da GB-Locações são
referências preservadas e não devem receber publicação ou configuração deste
checkout. A primeira publicação limpa não tornou os pais antigos parte do novo
histórico.

A escolha de hospedagem, banco hospedado, serviços e domínios fica para etapa
posterior. Este guia não autoriza criar recursos ou acionar integrações. Para o
eventual corte externo, use o
[runbook do corte](../operations/runbook-corte-raiz-legada.md) e o
[manifesto de variáveis](../operations/manifesto-variaveis.md). O fallback é o
artefato fixado da tag de pré-exclusão, não o checkout posterior ao Bloco F nem
um `main` antigo escolhido implicitamente.

## 📋 Índice

- [🎯 Visão Geral](#-visão-geral)
- [☁️ Deploy na Vercel](#️-deploy-na-vercel)
- [🐳 Deploy com Docker](#-deploy-com-docker)
- [🔧 Configuração de Produção](#-configuração-de-produção)
- [📊 Monitoramento](#-monitoramento)
- [🛡️ Segurança](#️-segurança)
- [🔄 CI/CD](#-cicd)

---

## 🎯 Visão Geral

Este guia identifica os artefatos atuais e o que precisa ser decidido antes de
uma implantação autorizada. Não certifica infraestrutura em produção.

### 🎯 Objetivos de uma futura implantação

- **Deploy Automatizado** - CI/CD pipeline completo
- **Performance Otimizada** - Core Web Vitals excelentes
- **Segurança Robusta** - Headers e validações adequadas
- **Monitoramento Completo** - Analytics e logs estruturados
- **Escalabilidade** - Preparado para crescimento

---

## ☁️ Deploy na Vercel

### Artefatos reais dos hosts

| Host | Root Directory a revisar no projeto futuro | Configuração versionada                                               | Build existente                        |
| ---- | ------------------------------------------ | --------------------------------------------------------------------- | -------------------------------------- |
| Web  | `apps/clients/web`                         | `apps/clients/web/vercel.json` e `apps/clients/web/next.config.mjs`   | `pnpm --filter @gb-locacoes/web build` |
| API  | `apps/services/api`                        | `apps/services/api/vercel.json` e `apps/services/api/next.config.mjs` | `pnpm --filter @gb-locacoes/api build` |

O install e a resolução de workspace precisam preservar `pnpm-lock.yaml`, Node
`>=24.21.0 <25` e pnpm `10.27.0`. Não conecte um projeto Vercel existente da GB
nem copie seu identificador CLI para este checkout. Os arquivos acima são a
fonte dos comandos; não adicione um segundo modelo JSON para a raiz.

### Ambiente e autenticação

Use os modelos `apps/clients/web/.env.example` e
`apps/services/api/.env.example` com o
[manifesto de variáveis](../operations/manifesto-variaveis.md). Banco,
credenciais de integração e segredos de sessão ficam no servidor. O web usa
origem da API e contexto de borda; somente as variáveis públicas previstas podem
chegar ao cliente. Uma chave de serviço nunca vira `NEXT_PUBLIC_*`.

`NEXT_PUBLIC_AUTH_MODE` é parte do build web: mudar só o ambiente de um processo
não altera o cliente já compilado. API e web também precisam de origens, domínio
e segredos coerentes no modo selecionado. A configuração isolada de NextAuth não
pode definir `NEXTAUTH_URL_INTERNAL` como string vazia; quando configurada, essa
URL interna deve ser uma URL válida do runtime correspondente.

### Agendas e publicação

`apps/clients/web/vercel.json` não declara crons. O arquivo da API declara
late-fees, expire-quotes e outbox. Essa declaração não é evidência de agenda
ativa e não autoriza habilitá-la. O despacho adicional de GitHub está em
`.github/workflows/cron-dispatch.yml`, protegido pelo repositório exato e
`CRON_DISPATCH_ENABLED == 'true'`. Não habilite ambas as agendas para o mesmo
job nem acrescente Merchant para eliminar a quarentena.

Publicar uma branch/tag no GitHub não é `vercel --prod`. Importar projetos,
definir variáveis e ligar agenda exigem a etapa de infraestrutura autorizada,
com destino conferido e rollback do runbook. Não use `git push origin main` como
receita de deploy: o `main` local antigo pode ser só referência preservada.

### Registro da configuração anterior da GB (aposentada)

O `vercel.json` da raiz e o glob `app/api/**/*.js` sugeridos no guia de dezembro
de 2024 foram aposentados como instruções deste produto, junto à receita de
install sem frozen lockfile e build de um único Next; não são substitutos dos
arquivos dos hosts. A configuração e o runtime antigos só podem ser consultados
no arquivo local preservado ou no fallback fixado da tag adequada, sem publicar
pais antigos ou alterar o projeto GB.

---

## 🐳 Deploy com Docker

O Dockerfile versionado do serviço é `apps/services/api/Dockerfile`, com
contexto na raiz do workspace. Ele usa Node 24.21, gera o Prisma Client, compila
`@gb-locacoes/api` e inicia `apps/services/api/server.js` da saída standalone na
porta 3002, como usuário `node`. O healthcheck consulta `/api/health`. Não há
Dockerfile próprio do web; não invente um caminho ou trate esse artefato API
como imagem dos dois hosts.

O `docker-compose.yml` preparado para a casa pós-retirada é um ambiente local
isolado da nova Locadora, com serviço API e PostgreSQL 18 em volume novo. Seu
nome de projeto é `locadora-equipamentos-saas` e o volume é
`locadora-equipamentos-saas-pg18`. A configuração não deve reaproveitar volumes
PostgreSQL 15, `.env.docker`, dados ou credenciais da GB. Ela não constitui um
plano de produção, migração de volume ou banco hospedado já contratado.

Antes de qualquer ensaio, confira a versão efetivamente aplicada do Compose, as
portas e volumes exclusivos, o ambiente sintético e as migrations do banco
próprio. Não inicialize containers ou um banco de produção apenas por seguir
este documento. A execução e seu cleanup precisam de evidência independente.

**Registro histórico:** o exemplo `docker-compose.prod.yml` com serviço `app`,
`Dockerfile` da raiz, PostgreSQL 16 e nginx era uma proposta do guia antigo. A
raiz e sua receita foram aposentadas; aquele exemplo não é um arquivo atual de
deploy e não deve ser recriado ou usado contra volumes existentes.

---

## 🔧 Configuração de Produção

### **1. Banco de Dados**

#### Banco e migrations: decisão posterior

Nenhuma conta PostgreSQL cloud é presumida por este guia. A escolha de provedor,
rede, backup e credenciais ocorre na etapa de infraestrutura. Uma futura
implantação deve distinguir o papel de migrations do papel runtime, preservar as
policies/RLS/triggers versionadas e validar o runtime por locadora.

O datasource de `prisma.config.ts` lê `DATABASE_URL`. Não presuma que configurar
`DIRECT_URL` sozinho troca o destino usado pela CLI. Confirme explicitamente o
banco próprio autorizado antes de qualquer comando. A aplicação recebe seu
runtime por `getDatabaseRuntime`, de `@gb-locacoes/backend/runtime`, que usa
`@prisma/adapter-pg`; não restaure `lib/prisma.ts` na raiz aposentada.

`pnpm db:generate` gera somente o client e não migra o banco. As migrations
moram em `prisma/migrations` e são aplicadas por `prisma migrate deploy` ao alvo
autorizado; nunca use `db push` ou scripts avulsos de FORCE/fix RLS.
`pnpm db:seed` altera dados e também exige alvo explícito, não é uma etapa
incondicional de deploy. Veja o manifesto e o runbook antes de operar.

**Registro histórico:** as receitas de Supabase/pooler e os parâmetros de
PostgreSQL do guia anterior não escolhem o provedor desta plataforma. Não
reutilize strings de conexão, grants ou volumes da GB. As referências originais
são preservadas para consulta, sem certificar a configuração atual:

- [Supabase: Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Prisma: Supabase Integration](https://www.prisma.io/docs/orm/overview/databases/supabase)
- [Supabase: Prisma Guide](https://supabase.com/docs/guides/database/prisma)

### **2. Otimizações de Performance**

#### **Next.js Config**

O web usa `apps/clients/web/next.config.mjs` e a API usa
`apps/services/api/next.config.mjs`. A API declara saída standalone e tracing na
raiz do workspace. O web transpila os packages compartilhados, tem CSP por host
de locadora, `noindex` no host `app` e fora de produção, e imagens
`unoptimized: true` com remotePatterns conferidos. Não copie o antigo exemplo
genérico de headers/otimizações para sobrescrever esses contratos.

### **3. Caching Strategy**

A autorização, o tenant e a resposta de cada handler determinam os headers. Não
aplique indiscriminadamente cache público a HTML privado, dados de sessão ou
respostas de outra locadora. O objeto `cacheHeaders` genérico do guia antigo era
ilustrativo; não implementava uma política atual do serviço.

---

## 📊 Monitoramento

### **1. Vercel Analytics**

A composição está em `apps/clients/web/src/app/layout.tsx`: carregamento sob
demanda de Analytics e Speed Insights. A medição da plataforma é distinta dos
IDs GA4/Ads por locadora no layout público. Não recrie `app/layout.tsx` na raiz
aposentada nem copie IDs fixos da GB. Presença do componente não prova dados
recebidos ou métricas do provedor em produção.

### **2. Logging Estruturado**

O logger do servidor é `createApplicationLogger`, em
`packages/backend/src/runtime/logger.ts`, exportado por
`@gb-locacoes/backend/runtime`. Ele usa `LOG_LEVEL` e a política de redação de
campos de segredo. Não restaure a antiga fachada `lib/logger.ts`, acrescente
emails/tokens ao log por exemplo de documentação ou declare segurança universal
por causa da existência da política.

### **3. Health Checks**

A rota `apps/services/api/src/app/api/health/route.ts` exporta o handler
composto por `src/host/runtime.ts` sobre `createHealthHandler`, de
`packages/backend/src/http/health.ts`. A composição consulta `SELECT 1` pelo
runtime de banco. Sucesso responde 200 com `status: healthy` e
`database: connected`; falha responde 503 com erro público genérico. Esse
readiness não aprova regras de negócio, sessão, integrações, jobs, produção ou
os demais endpoints. Não introduza o singleton `@/lib/prisma` do exemplo antigo,
aposentado, nem exponha a mensagem interna do banco no DTO.

---

## 🛡️ Segurança

### **1. Headers de Segurança**

A borda web está em `apps/clients/web/src/proxy.ts` e sua composição em
`src/host/routing/platform-proxy.ts`. CSP/noindex por host também estão no
`apps/clients/web/next.config.mjs`. A API usa `apps/services/api/src/proxy.ts` e
os handlers autorizam identidade/tenant no servidor. Não restaure `proxy.ts` da
raiz aposentada nem cole o CSP genérico permissivo deste guia antigo.

### **2. Rate Limiting e Autorização**

Confira o handler exercitado e as políticas de `@gb-locacoes/backend/identity`,
com composição em `apps/services/api/src/host/private-identity.ts` e
`src/host/session.ts`. O principal é resolvido por vínculo com a locadora; o
papel global do usuário não substitui essa fronteira. O Map em memória de
`lib/rate-limit.ts` apresentado no guia antigo foi aposentado como receita; não
é um limiter distribuído e não deve ser reintroduzido ou desabilitado para
facilitar uma prova. As permissões por módulo continuam específicas do handler.

### **3. Validação de Entrada**

```typescript
// Sempre usar Zod para validação
import { z } from "zod"

const apiSchema = z
  .object({
    name: z.string().min(1).max(100),
    email: z.string().email()
    // Sanitização automática
  })
  .strict() // Rejeitar campos extras
```

---

## 🔄 CI/CD

### **GitHub Actions**

Os workflows versionados são `.github/workflows/ci.yml`, `api-container.yml` e
`cron-dispatch.yml`. O CI valida arquitetura/testes/builds; o job de container
valida a API. Eles não contêm o deploy Vercel de exemplo `deploy.yml` mostrado
no guia antigo. O dispatch de jobs exige o repositório exato, opt-in
`CRON_DISPATCH_ENABLED == 'true'` e evento compatível.

Não crie um workflow de deploy por copiar a antiga receita Node 20 ou fornecer
segredos `VERCEL_TOKEN`/IDs de outro projeto. Um futuro CD precisa de projeto,
ambiente, branch/ref e credenciais aprovados para esta plataforma. O `main` GB e
a tag de pré-exclusão são referências distintas; o fallback depende do artefato
fixado, não de um pull de histórico antigo.

### **Deploy Checklist**

Somente depois de aprovar o alvo de infraestrutura:

- conferir repositório/branch/ref, host e configuração aplicados;
- revisar modelos de ambiente por host, banco próprio, papéis, migrations e
  serviços mantidos desligados até autorização;
- consolidar os gates/testes/builds previstos em
  [testing](../guides/testing.md), sem tratar `pnpm test` como toda a matriz;
- revisar agenda única, health/readiness, fluxos críticos e rollback depois da
  implantação autorizada, com prova real e sem expor segredos.

Este checklist não agenda outra implantação nem exige repetir provas aceitas sem
mudanças que justifiquem a reexecução.

---

## 🚨 Troubleshooting de Produção

### **Problemas Comuns**

#### **1. Build Timeout na Vercel**

Confira o log e o script do host afetado, incluindo o prebuild web que
sincroniza `public` por `tools/sync-web-public.mjs`. Não acrescente
`scripts/patch-prisma.js`: o patch/postbuild da raiz foi aposentado. A geração
atual é `tools/generate-prisma-client.mjs`, somente para o client.

#### **2. Memory Limit Exceeded**

Verifique o limite e a fase concreta do build antes de alterar recursos. O
comando genérico `NODE_OPTIONS=... pnpm build` do guia anterior não identifica o
host ou a causa e não é uma configuração aprovada de hospedagem.

#### **3. Prisma Connection Issues**

Confira as variáveis do processo API e os erros sanitizados, sem imprimir URL,
senha ou tokens. A implementação atual é
`packages/backend/src/runtime/database.ts`, com pool/PrismaPg por processo e
conexão adiada até seu uso. O singleton da fachada `lib/prisma.ts` foi
aposentado. Não o recrie, troque o banco, execute seed ou aplique scripts RLS
como tentativa automática de recuperar uma conexão.

---

## 📈 Performance Checklist

Metas ilustrativas preservadas do guia de dezembro de 2024, não resultados de
produção atual nem instruções para alterar UI/CSS. O aceite visual e as provas
de host/runtime precisam de evidência própria.

### **Core Web Vitals**

- [ ] **LCP** < 2.5s
- [ ] **FID** < 100ms
- [ ] **CLS** < 0.1

### **Otimizações**

- [ ] Imagens otimizadas (WebP/AVIF)
- [ ] Code splitting implementado
- [ ] Lazy loading em componentes
- [ ] CDN configurado
- [ ] Compression habilitada
- [ ] Cache headers configurados

---

_Guia original: dezembro de 2024. Revisão operacional preparada em 2026-10-09;
infraestrutura e corte externos continuam sujeitos à etapa autorizada._

---

## 🔗 Links Relacionados

- **[installation.md](./installation.md)** - Setup inicial
- **[development.md](./development.md)** - Desenvolvimento
- **[troubleshooting.md](./troubleshooting.md)** - Solução de problemas
