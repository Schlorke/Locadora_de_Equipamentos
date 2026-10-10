# Compatibilidade de dependências do workspace

Estado documental de 2026-10-09. Os manifests de cada owner e `pnpm-lock.yaml`
são a fonte das versões. A tabela mostra declarações; o lockfile fixa as
resoluções. Instalação usa Node `>=24.21.0 <25` e pnpm `10.27.0`
(`packageManager`/`engines`).

## Versões declaradas

| Dependência        | Declaração |
| ------------------ | ---------- |
| Next.js            | `16.3.6`   |
| React              | `19.3.0`   |
| React DOM          | `19.3.0`   |
| Expo               | `~57.0.25` |
| React Native       | `0.86.3`   |
| TypeScript         | `5.9.3`    |
| Tailwind CSS       | `4.3.3`    |
| Prisma CLI         | `7.10.0`   |
| Prisma Client      | `7.10.0`   |
| PostgreSQL adapter | `7.10.0`   |
| NextAuth           | `4.24.15`  |
| Better Auth        | `1.7.6`    |
| Vitest             | `^5.0.2`   |
| Playwright         | `^1.63.0`  |
| Storybook          | `10.6.0`   |

## Responsabilidades

Web e API têm manifests próprios em `apps/clients/web` e `apps/services/api`.
Expo fica em `apps/clients/mobile`; UI, tokens, frontend, backend, domínio e
contratos mantêm seus próprios importers. Instalar uma dependência no owner real
evita ocultar um import por hoisting ou duplicar serviços na raiz.

O CSS atual entra por `packages/frontend/src/app/styles/globals.web.css`, com
`@import` dos tokens/paleta/escalas e `@config` do `tailwind.config.cjs` do
workspace. Tailwind 4 conserva a semântica da referência Tailwind 3.4.17 por
paridade explícita. Veja [design system](../features/design-system.md) e
[referência visual](../../tests/visual/README.md). O registro antigo de bloqueio
da migração não descreve o código atual.

## Instalação e alterações futuras

Para instalar sem escolher novas resoluções:

```powershell
pnpm install --frozen-lockfile
pnpm db:generate
```

`db:generate` gera o cliente; não cria nem migra um banco. Atualizações precisam
de escopo definido, leitura deste guia/known-issues, revisão dos importers e
diff do lockfile, testes apropriados e build de produção. Não existe categoria
de pacotes automaticamente segura para atualizar. Preserve o trabalho local
antes de qualquer recuperação; não execute checkout/reset genérico ou remoção
recursiva de instalações com links.

Os seis vínculos sem consumidor removidos da raiz em F não mudaram o grafo
restante de pacotes/snapshots. As dependências dos owners web/UI/backend ficam.
O compilador Tailwind 3 da reprodução manual é um runtime externo isolado e não
deve substituir o lockfile do produto.

## Validação

Use `pnpm typecheck`, `pnpm lint`, `pnpm lint:css`, `pnpm arch`, `pnpm tokens`,
`pnpm hygiene`, `pnpm check:test-names` e as suítes apropriadas. `pnpm build`
compila web e API. Testes que usam PostgreSQL exigem banco descartável próprio,
papéis/opt-in e migrations; não apontar os testes para dados reais.

## Histórico

O [guia anterior preservado](../archive/wave135-pre-f/dependencies.md.source)
registra as versões e receitas antigas integralmente. Não é uma instrução de
instalação, atualização automática ou configuração de provedores. As provas
atuais de validação são registradas por revisão em wave135-base-validation.md e
no handoff.
