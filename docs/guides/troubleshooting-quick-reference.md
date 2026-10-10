# Troubleshooting - Referência Rápida

> **Propósito**: Este documento lista os problemas mais comuns e suas soluções
> rápidas. Para problemas detalhados e histórico completo, consulte
> `docs/issues/known-issues.md`.

---

## Problemas de Build e Dependências

### "Invalid url postgresql://...": Currently, only Data Proxy supported (P6001)

**Registro histórico (Prisma 6.15)**: a variável
`PRISMA_GENERATE_DATAPROXY="false"` ativava o modo Data Proxy naquele gerador,
pois a string não vazia era tratada como verdadeira. A análise está em
`docs/internal/prisma-6-15-engine-none-analysis.md`.

**Diagnóstico atual**: o workspace usa Prisma 7.10.0 com `@prisma/adapter-pg`.
`pnpm db:generate` chama `tools/generate-prisma-client.mjs` com
`--generator client`; o runtime está em
`packages/backend/src/runtime/database.ts`. Não use a antiga expectativa
`engine=binary` como critério do runtime atual nem migre para Data Proxy por
esta mensagem histórica. Confira as versões instaladas e
[dependências](../references/dependencies.md) antes de alterar a configuração.

---

### "Module not found: Can't resolve '@/lib/validations'"

**Causa histórica**: o `generator zod` regravava `lib/validations/` e apagava o
`index.ts` escrito à mão. O gerador saiu na onda 9; a saída gerada foi retirada
em 2026-09-30 (entrada 227).

**Após o Bloco F**: `lib/validations/` foi aposentado com a raiz; não restaure
essa pasta no checkout atual. `ContactSchema` e `QuoteRequestSchema` pertencem
ao export `@gb-locacoes/contracts/quotations`; os schemas públicos de
documentação estão em `@gb-locacoes/contracts/openapi`. Confira o import do
consumidor e o `exports` de `packages/contracts/package.json`. Não crie outra
cópia do contrato para eliminar o erro. `pnpm db:generate` gera somente Prisma
Client, sem regravar esses contratos;
`tests/unit/prisma-schema-generators.test.ts` guarda essa separação. A raiz
antiga só pode ser consultada no artefato fixado da tag de pré-exclusão ou no
arquivo local preservado.

---

### "TypeScript errors em massa (42+ erros)"

**Causa**: Tipos `unknown`, `any`, navegação insegura em objetos.

**Solução**: Use interfaces específicas, safe navigation (`?.`), type guards.

**Exemplo**: `req.headers?.['content-length']` em vez de
`req.headers['content-length']`.

---

### "ESLint overwhelming errors (31k+ problemas)"

**Registro histórico**: o lint incluía a antiga saída gerada de
`lib/validations/schemas/**`, aposentada com seu gerador; a entrada 227 registra
a retirada de suas exclusões de ESLint e TypeScript.

**Recuperação atual**: verifique o arquivo denunciado e as regras existentes de
`eslint.config.js`. Não acrescente um ignore amplo ou recrie o gerador para
esconder a falha; Prisma Client é gerado separadamente por `pnpm db:generate`.

---

### "Build failing com 'Did not initialize yet'"

**Registro histórico**: incompatibilidades de Prisma/Next motivaram tentativas
com outro gerenciador. Isso não é a receita atual de instalação.

**Recuperação atual**: use Node `>=24.21.0 <25`, pnpm `10.27.0` e o
`pnpm-lock.yaml` versionado. Confira
[dependências](../references/dependencies.md) e a seção "Limpeza segura" de
[troubleshooting](../getting-started/troubleshooting.md). Não substitua pnpm por
npm nem apague recursivamente `node_modules`, que pode conter links.

---

### "Swagger UI React errors com React 19"

**Registro histórico**: o guia antigo usava `swagger-ui-react` e
`app/api-docs/page.tsx`, entrada da raiz agora aposentada.

**Owner atual**: a rota fina
`apps/clients/web/src/app/(platform)/plataforma/api-docs/page.tsx` renderiza
`@gb-locacoes/frontend/pages/api-docs`. A tela customizada está em
`packages/frontend/src/pages/api-docs/ui/ApiDocsPage.web.tsx`, e
`use-api-docs.ts` lê `/openapi.json` pelo cliente HTTP compartilhado. Não
reinstale o componente antigo nem recrie a rota da raiz.

---

## Problemas de UI/UX

### "Autocomplete dropdown atrás de outras seções"

**Causa**: Z-index insuficiente ou stacking context incorreto.

**Solução**: Container com `z-[var(--layer-dropdown)]`, dropdown com
`z-[var(--layer-popover)]`, remover `overflow-hidden`.

**Prevenção**: Sempre criar novo stacking context com `relative`.

**Detalhes**: Consulte `docs/features/autocomplete-search.md`.

---

### "Input não atualiza após seleção no autocomplete"

**Causa**: React batching e timing de eventos com blur.

**Solução**: `useCallback` com `setTimeout`, mudar para `onMouseDown`.

**Força update**: `inputRef.current.value = equipment.name` quando necessário.

**Detalhes**: Consulte `docs/features/autocomplete-search.md`.

---

### "Erro pricePerDay.toFixed is not a function"

**Causa**: Prisma retorna Decimal como string/objeto.

**Solução**: `Number(equipment.pricePerDay).toFixed(2)`.

**Prevenção**: Sempre converter Decimal para Number antes de métodos numéricos.

---

## Problemas de Animação

### "Dessincronização de Animações Hero (Flash de imagem)"

**Causa**: Flash de imagem aparecia antes do conteúdo após reset de cache.

**Solução**: Evento customizado `scrollRevealReady` para sincronizar Framer
Motion com scroll-reveal-init.

**Detalhes**: Consulte `docs/issues/known-issues.md`.

---

## Compatibilidades Críticas

Versões conferidas nos manifests do workspace em 2026-10-09; mudanças exigem
consulta a [dependências](../references/dependencies.md).

| Dependência  | Versão atual  | Contrato                                        |
| ------------ | ------------- | ----------------------------------------------- |
| Node         | >=24.21.0 <25 | Engines dos hosts                               |
| pnpm         | 10.27.0       | Lockfile único do workspace                     |
| Prisma       | 7.10.0        | Driver adapter pg no servidor                   |
| Tailwind CSS | 4.3.3         | Paleta e escalas da produção 3.4.17 preservadas |
| Next.js      | 16.3.6        | Hosts web e API separados                       |
| React        | 19.3.0        | Versões dos hosts Next                          |

O alerta antigo para não adotar Tailwind 4 referia-se ao stack anterior,
aposentado. A paridade de classes continua documentada em
`tests/visual/README.md`; um build verde não autoriza mudar cores ou escalas.

---

## Comandos Úteis

```bash
# Verificar datas reais de commits
git log --pretty=format:"%h %ad %s" --date=short -10

# Regenerar cliente Prisma
pnpm db:generate

# Verificar tipos
pnpm typecheck

# Lint com auto-fix
pnpm lint:fix
```

---

_Para problemas não listados aqui, consulte `docs/issues/known-issues.md`._
