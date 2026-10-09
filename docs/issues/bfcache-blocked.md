# 🐛 BFCache Bloqueado - Cache-Control: no-store

## Problema Identificado ⚠️

**Data da Ocorrência**: 2026-01-XX **Severidade**: Baixa (Performance)  
**Status**: ⚠️ Limitação Conhecida - Requer Decisão Arquitetural

### Descrição

O Lighthouse/Chrome DevTools reporta que o back/forward cache (bfcache) está
bloqueado na página principal:

```
Page prevented back/forward cache restoration 2 failure reasons

1. Pages whose main resource has cache-control:no-store cannot enter back/forward cache.
2. Back/forward cache is disabled because some JavaScript network request received resource with Cache-Control: no-store header.
```

### Causa Raiz

O bfcache está sendo bloqueado por duas razões:

1. **Recurso Principal (HTML) com `Cache-Control: no-store`**:
   - O layout (`app/layout.tsx`) usa `getServerSession()` para autenticação
   - Isso torna a página dinâmica no Next.js 16
   - Páginas dinâmicas são servidas com headers que bloqueiam cache por padrão
   - O Next.js adiciona `Cache-Control: no-store` para páginas dinâmicas

2. **Requisições JavaScript com `Cache-Control: no-store`**:
   - Algumas APIs podem estar retornando `no-store` em suas respostas
   - Quando qualquer requisição JavaScript recebe `no-store`, o navegador
     bloqueia o bfcache da página inteira
   - Já foi corrigido parcialmente (APIs usam `no-cache, must-revalidate` ou
     `public, max-age=60`)

#### Impacto

- **Performance**: Navegação back/forward não é instantânea
- **UX**: Usuários percebem delay ao voltar/avançar entre páginas
- **Métricas**: Pode afetar métricas de performance (LCP, TTI)

## Soluções Disponíveis

### ✅ Opção 1: Aceitar Limitação (Recomendado Atualmente)

**Justificativa**:

- O projeto usa autenticação server-side (`getServerSession`)
- A segurança e funcionalidade são prioridades
- O impacto no UX é mínimo comparado aos benefícios da autenticação server-side

**Quando Revisar**:

- Se métricas de performance se tornarem críticas
- Se usuários reportarem problemas de navegação
- Se houver necessidade de otimização extrema de performance

### ⚠️ Opção 2: Migrar para Autenticação Client-Side (Não Recomendado)

**O que envolveria**:

- Mover `getServerSession` para o cliente
- Implementar autenticação baseada em tokens/JWT
- Perder benefícios de segurança do NextAuth server-side
- Refatoração significativa do código

**Desvantagens**:

- ❌ Menor segurança (tokens expostos no cliente)
- ❌ Refatoração massiva
- ❌ Possíveis problemas de SSR/hydration
- ❌ Perda de funcionalidades do NextAuth server-side

### 🔄 Opção 3: Híbrido - Páginas Públicas Estáticas (Possível Futuro)

**O que envolveria**:

- Separar páginas públicas (sem auth) de páginas autenticadas
- Páginas públicas usariam ISR (`export const revalidate = 60`)
- Páginas autenticadas continuariam dinâmicas

**Limitações**:

- Layout ainda usa `getServerSession`, tornando tudo dinâmico
- Seria necessário criar layout separado para páginas públicas
- Complexidade arquitetural aumentada

## Status Atual das APIs

As seguintes APIs já foram ajustadas para **não bloquear bfcache**:

- ✅ `/api/equipments` - Usa `public, max-age=60, stale-while-revalidate=300`
- ✅ `/api/categories` - Usa `public, max-age=60, stale-while-revalidate=300`
- ✅ Erros - Usam `no-cache, must-revalidate` (não bloqueia bfcache)

**APIs que ainda usam `force-dynamic`** (mas não retornam `no-store`):

- `/api/admin/*` - APIs administrativas (precisam ser dinâmicas)
- `/api/auth/*` - Autenticação (precisa ser dinâmica)
- `/api/quotes/*` - Orçamentos (precisam ser dinâmicas)

## Verificação

Para verificar se o bfcache está habilitado:

1. **Chrome DevTools**:
   - Abra DevTools → Application → Back/forward cache
   - Navegue para a página principal
   - Navegue para outra página
   - Tente voltar (back)
   - Verifique se aparece "Restored from back/forward cache"

2. **Lighthouse**:
   - Execute auditoria de Performance
   - Verifique seção "Back/forward cache"
   - Deve mostrar razões de bloqueio se presente

## Referências

- [Chrome: Back/forward cache](https://developer.chrome.com/docs/web-platform/bfcache)
- [Chrome: BFCache and Cache-Control: no-store](https://developer.chrome.com/docs/web-platform/bfcache-ccns)
- [Next.js: Caching](https://nextjs.org/docs/app/building-your-application/caching)
- [Next.js: Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)

## Conclusão

**Decisão Atual**: Aceitar a limitação do bfcache como trade-off necessário para
manter autenticação server-side segura.

**Revisar Quando**:

- Performance se tornar crítica
- Usuários reportarem problemas de navegação
- Decisão arquitetural de migrar para client-side auth

---

**Última atualização**: 2026-01-XX  
**Próxima revisão**: Quando métricas de performance se tornarem críticas
