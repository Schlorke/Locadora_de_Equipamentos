# Análise de Performance do Supabase - Dezembro 2025

> **Caminhos atuais (conferidos em 2026-09-30)**: registro de dezembro de 2025;
> o arquivo `prisma/migrations/20251208_fix_supabase_performance_issues.sql`
> citado abaixo nunca foi versionado. Mudança de schema só por migration
> versionada (`pnpm exec prisma migrate deploy`).

## 📊 Resumo da Análise

Análise realizada em **08/12/2025** usando o Supabase Database Linter
identificou **16 sugestões de performance** (nível INFO).

## 🔍 Problemas Identificados

### 1. Foreign Keys Sem Índice (2 problemas) ⚠️

**Impacto**: Alto - Pode causar suboptimal query performance em operações de
JOIN e filtros.

#### Problemas:

1. **`quotes_approvedBy_fkey`**
   - Tabela: `public.quotes`
   - Campo: `approvedBy` (coluna 17)
   - Descrição: Foreign key sem índice cobrindo pode levar a performance
     subótima

2. **`quotes_rejectedBy_fkey`**
   - Tabela: `public.quotes`
   - Campo: `rejectedBy` (coluna 30)
   - Descrição: Foreign key sem índice cobrindo pode levar a performance
     subótima

**Solução Aplicada**: ✅

- Adicionados índices `quotes_approvedBy_idx` e `quotes_rejectedBy_idx`
- Migração: `20251208_fix_supabase_performance_issues.sql`

### 2. Índices Não Utilizados (14 problemas) ℹ️

**Impacto**: Baixo - Índices não utilizados ocupam espaço mas não afetam
performance negativamente.

#### Índices Identificados:

**Tabela `quotes`:**

- `quotes_startDate_idx` - Pode ser útil para filtros por data de início
- `quotes_endDate_idx` - Pode ser útil para filtros por data de fim
- `quotes_status_idx` - Pode ser útil para filtros por status
- `quotes_userId_idx` - Pode ser útil para filtros por usuário

**Tabela `accounts`:**

- `accounts_userId_idx` - Pode ser útil para joins com usuários

**Tabela `addresses`:**

- `addresses_userId_idx` - Pode ser útil para joins com usuários

**Tabela `cart_items`:**

- `cart_items_equipmentId_idx` - Pode ser útil para joins com equipamentos

**Tabela `equipments`:**

- `equipments_categoryId_idx` - Pode ser útil para filtros por categoria

**Tabela `quote_items`:**

- `quote_items_equipmentId_idx` - Pode ser útil para joins com equipamentos
- `quote_items_quoteId_idx` - Pode ser útil para joins com quotes

**Tabela `rental_items`:**

- `rental_items_equipmentid_idx` - Pode ser útil para joins com equipamentos
- `rental_items_rentalid_idx` - Pode ser útil para joins com rentals

**Tabela `rentals`:**

- `rentals_userid_idx` - Pode ser útil para filtros por usuário

**Tabela `sessions`:**

- `sessions_userId_idx` - Pode ser útil para joins com usuários

**Decisão**: ⚠️ **MANTER** os índices por enquanto

- Razão: Índices podem ser úteis em consultas futuras
- Impacto de remover: Baixo (apenas espaço em disco)
- Impacto de manter: Nenhum negativo (índices não utilizados não afetam
  performance)
- Monitoramento: Revisar após análise mais profunda de uso

## ✅ Correções Aplicadas

### Migração SQL

**Arquivo**: `prisma/migrations/20251208_fix_supabase_performance_issues.sql`

**Comandos Executados**:

```sql
-- Adicionar índices em foreign keys
CREATE INDEX IF NOT EXISTS "quotes_approvedBy_idx" ON "public"."quotes"("approvedBy");
CREATE INDEX IF NOT EXISTS "quotes_rejectedBy_idx" ON "public"."quotes"("rejectedBy");
```

### Atualização do Schema Prisma

**Arquivo**: `prisma/schema.prisma`

**Mudanças**:

- Adicionados `@@index([approvedBy])` e `@@index([rejectedBy])` no model `Quote`

## 🚀 Como Aplicar as Correções

> **Histórico (dez/2025).** O script `pnpm migrate:supabase-performance` e o SQL
> `20251208_fix_supabase_performance_issues.sql` nunca foram versionados e o
> script saiu em 2026-09-30. Os índices e as políticas atuais vêm das migrations
> em `prisma/migrations` (aplicadas com `pnpm exec prisma migrate deploy`; nunca
> `db push`).

## 📈 Resultados Esperados

Após aplicar as correções:

1. **Foreign Keys Indexadas**: ✅
   - `quotes_approvedBy_fkey` → Índice criado
   - `quotes_rejectedBy_fkey` → Índice criado

2. **Performance Melhorada**:
   - Queries envolvendo `approvedBy` e `rejectedBy` serão mais rápidas
   - JOINs com a tabela `users` através desses campos serão otimizados

3. **Supabase Linter**:
   - Após reexecutar o linter, os 2 problemas de foreign keys devem desaparecer
   - Os 14 índices não utilizados permanecerão (decisão consciente de manter)

## 🔄 Próximos Passos

1. **Monitorar Performance**:
   - Verificar se os índices criados melhoram a performance de queries
   - Monitorar uso dos índices "não utilizados" ao longo do tempo

2. **Análise Profunda** (Opcional):
   - Revisar queries do aplicativo para identificar uso real dos índices
   - Considerar remover índices realmente não utilizados após análise

3. **Reexecutar Linter**:
   - Após aplicar correções, reexecutar o Supabase Database Linter
   - Verificar se os problemas foram resolvidos

## 📚 Referências

- [Supabase Database Linter Documentation](https://supabase.com/docs/guides/database/database-linter)
- [PostgreSQL Index Best Practices](https://www.postgresql.org/docs/current/indexes.html)
- [Prisma Index Documentation](https://www.prisma.io/docs/concepts/components/prisma-schema/indexes)

## 📝 Notas Técnicas

### Por que Foreign Keys Precisam de Índices?

Foreign keys são frequentemente usadas em:

- JOINs entre tabelas
- Filtros WHERE
- Operações de DELETE/UPDATE com CASCADE

Sem índices, o PostgreSQL precisa fazer **full table scans**, o que é muito
lento em tabelas grandes.

### Por que Manter Índices "Não Utilizados"?

1. **Custo Baixo**: Índices não utilizados ocupam espaço mas não afetam
   performance negativamente
2. **Uso Futuro**: Podem ser úteis em queries futuras ou em queries complexas
   que o linter não detecta
3. **Análise Necessária**: Remover índices requer análise profunda do uso real
   do banco

---

**Última atualização**: 08/12/2025 **Status**: ✅ Correções aplicadas e
documentadas
