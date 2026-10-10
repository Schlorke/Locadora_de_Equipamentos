# 🔧 Service Worker - Cache Inteligente para Drei Assets

## 📋 Visão Geral

Registro da implementação de novembro de 2025 para reduzir rate limiting (429)
do GitHub ao carregar recursos do drei-assets. Após F, o host web não registra
Service Worker (M4): seus providers não montam registrador. O arquivo
`public/sw.js` permanece como asset, e o proxy Drei continua na API; isso não
prova cache ativo nos clientes atuais.

## 🎯 Problema da implementação histórica (Nov 2025)

- **Antes**: Requisições diretas ao GitHub → Rate limiting (429) → Aplicação
  quebrava
- **Depois**: Cache inteligente no navegador → Zero requisições após primeira
  vez → Aplicação sempre funciona

## 🏗️ Arquitetura

### Componentes da implementação antiga (retirada em F)

```
public/sw.js                          # Asset ainda presente; não registrado pelo host web atual
lib/sw-register.ts                    # Arquivo antigo retirado: registro/atualização
app/service-worker-register.tsx       # Componente antigo retirado
app/ClientLayout.tsx                  # Layout antigo retirado
app/api/drei-proxy/[...path]/route.ts  # Adapter antigo retirado
```

### Donos atuais

- `apps/clients/web/src/host/providers/{AppHostProviders,TenantSiteProviders}.tsx`
  compõem o shell/ScrollReveal, sem registrar SW.
- `apps/services/api/src/app/api/drei-proxy/[...path]/route.ts` compõe
  `createDreiAssetProxy` de `packages/backend/src/http/drei-assets.ts`. O proxy
  é independente do registro de um SW no navegador.
- `public/sw.js` conserva o código de cache/mensagens. Asset existente não
  confirma controlador ativo ou cache herdado em um navegador específico.

### Fluxo da implementação antiga, quando o SW estava registrado

```
1. Usuário acessa a página
   ↓
2. Service Worker é registrado automaticamente
   ↓
3. drei tenta buscar HDR do GitHub
   ↓
4. Service Worker intercepta a requisição
   ↓
5. Verifica cache local primeiro
   ├─ Se tem cache: ✅ Retorna imediatamente (instantâneo)
   └─ Se não tem cache:
      ├─ Tenta buscar do GitHub
      ├─ Se sucesso: Cacheia e retorna
      └─ Se falhar (429): Usa proxy local como fallback
```

## 📊 Estratégia do asset SW, quando registrado

### Cache First, Network Fallback

- **Ideal para**: Recursos estáticos que raramente mudam (HDRs)
- **Vantagem**: Performance máxima após primeiro acesso
- **Desvantagem**: Requer limpeza manual para forçar atualização

## 🚀 Uso

### Registro automático antigo e estado atual

Na implementação de 2025, o layout antigo registrava o SW automaticamente. Esse
registrador foi retirado em F; os providers atuais não o montam. Não adicionar
registro manual ao host para reproduzir esse documento. A presença de um
controller antigo no navegador precisa ser inspecionada naquele perfil e não
comprova que o aplicativo atual registrou o worker.

### Funções históricas e mensagens ainda presentes no asset

O arquivo antigo `lib/sw-register.ts`, retirado em F, exportava
`registerServiceWorker()`, chamado pelo componente antigo
`app/service-worker-register.tsx`, também retirado. Os utilitários
`unregisterServiceWorker`, `clearServiceWorkerCache`, `getCacheSize` e
`isServiceWorkerActive` não tinham chamador e saíram na faxina da onda 9
(entrada 225 de `docs/issues/known-issues.md`; referência histórica ao commit
4b02f52f do arquivo antigo, não disponível como comando de reprodução no
histórico limpo publicado). O `public/sw.js` continua respondendo às mensagens
`SKIP_WAITING`, `CLEAR_CACHE` e `GET_CACHE_SIZE` (as duas últimas respondem pela
porta do `MessageChannel`).

## 📈 Estimativas históricas com SW registrado (não medidas após F)

### Primeira Vez (Cold Start)

- Registro do SW: ~50-100ms (assíncrono, não bloqueia)
- Busca HDR: Tempo normal (vai ao GitHub ou proxy)
- Total: Imperceptível

### Próximas Vezes (Cache Hit)

- Registro do SW: Já está ativo
- Busca HDR: Instantâneo (cache local)
- Total: 0ms de requisições de rede ✅

### Comparação

| Cenário     | Sem SW     | Com SW (1ª vez) | Com SW (cache) |
| ----------- | ---------- | --------------- | -------------- |
| Tempo       | 2-5s       | 2-5s + 50ms     | ~0ms           |
| Requisições | Toda vez   | 1 vez           | 0              |
| Rate Limit  | Alto risco | Baixo risco     | Sem risco      |

## 🔍 Debug

### Console Logs históricos, somente com um worker ativo

O Service Worker imprime logs úteis no console:

```
[SW] Service Worker registrado com sucesso
[SW] Interceptando requisição: https://raw.githubusercontent.com/...
[SW] ✅ Servindo do cache: forest_slope_1k.hdr
[SW] ⚠️ Cache miss, buscando da rede: studio_small_03_1k.hdr
[SW] 💾 Cache atualizado: studio_small_03_1k.hdr
[SW] 🔄 Tentando proxy local devido a erro 429
```

### Chrome DevTools: inspeção de eventual worker herdado

1. Abra DevTools (F12)
2. Vá para **Application** → **Service Workers**
3. Verifique status: "activated and is running"
4. Vá para **Cache Storage** → **gb-locacoes-drei-assets-v1**
5. Veja todos os recursos cacheados

### Limpeza Manual: somente se houver controller ativo no perfil inspecionado

```javascript
// No console do navegador (o sw.js responde pela porta do MessageChannel):
const channel = new MessageChannel()
channel.port1.onmessage = (event) => console.log(event.data) // { success: true }
navigator.serviceWorker.controller.postMessage({ type: "CLEAR_CACHE" }, [
  channel.port2
])
location.reload()
```

Ou, no DevTools, **Application** → **Cache Storage** → apagar
`gb-locacoes-drei-assets-v1`.

## 🔄 Atualização

### Versionamento

O cache usa versão (`CACHE_NAME = 'gb-locacoes-drei-assets-v1'`).

Na instalação antiga com SW registrado, o procedimento de versionamento era:

1. Altere a versão em `public/sw.js`:
   ```javascript
   const CACHE_NAME = "gb-locacoes-drei-assets-v2"
   ```
2. Faça deploy
3. Navegadores detectarão automaticamente e atualizarão

### Comportamento histórico do registrador retirado

- **Desenvolvimento**: Atualizava automaticamente.
- **Produção**: Atualizava ao recarregar página.

O host atual não executa esse registrador; publicar só o asset não instala um
worker nos clientes novos.

## 🛡️ Segurança

### Requisitos

- ✅ HTTPS obrigatório (Vercel já fornece)
- ✅ Same-origin ou CORS configurado
- ✅ Sem avisos de segurança
- ✅ Tecnologia padrão e amplamente suportada

### Compatibilidade

| Navegador | Suporte                       |
| --------- | ----------------------------- |
| Chrome    | ✅ Sim                        |
| Firefox   | ✅ Sim                        |
| Safari    | ✅ Sim                        |
| Edge      | ✅ Sim                        |
| Opera     | ✅ Sim                        |
| IE 11     | ❌ Não (graceful degradation) |

## 🎯 Exemplo histórico da resolução com SW registrado

### Antes (com rate limiting)

```
Usuário 1: GitHub → 200 OK
Usuário 2: GitHub → 200 OK
Usuário 3: GitHub → 200 OK
...
Usuário 50: GitHub → 429 TOO MANY REQUESTS ❌ (quebra)
```

### Depois (com Service Worker)

```
Usuário 1: GitHub → Cache → 200 OK ✅
Usuário 1 (próximas): Cache → 200 OK ✅ (instantâneo)
Usuário 2: GitHub → Cache → 200 OK ✅
Usuário 2 (próximas): Cache → 200 OK ✅ (instantâneo)
...
Todos os usuários: Cache local ✅ (zero requisições ao GitHub)
```

## 📝 Notas da implementação antiga com SW registrado

1. **Cache Persistente**: O cache persiste entre sessões até ser limpo
   manualmente ou o navegador decidir limpar.

2. **Fallback para Proxy**: Se o GitHub retornar 429, o Service Worker
   automaticamente tenta usar o proxy local.

3. **Sem Impacto Visual**: O usuário não percebe o Service Worker funcionando.
   Tudo é transparente.

4. **Manutenção Zero**: Após a implementação, funciona automaticamente sem
   necessidade de manutenção.

5. **Graceful Degradation**: Se o navegador não suportar Service Worker, a
   aplicação continua funcionando normalmente (sem cache).

## 🔗 Recursos Adicionais

- [MDN: Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Google: Service Worker Lifecycle](https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle)
- [Can I Use: Service Workers](https://caniuse.com/serviceworkers)

## 📅 Histórico

- **v1.0.0** (Nov 2025): Implementação inicial com cache inteligente e fallback
  para proxy

---

**Implementado por**: GB-Locações Team **Data**: Novembro 2025 **Status atual
após F**: asset SW preservado, registro automático antigo retirado; proxy Drei
da API ativo por código, sem prova nova de cache/browser.
