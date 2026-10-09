# 🎬 Equipment 3D Carousel - Sistema de Sincronização com ScrollReveal

> **⚠️ DOCUMENTAÇÃO CRÍTICA PARA IA**: Este componente possui uma lógica de
> sincronização explícita que **DEVE SER PRESERVADA** em todas as alterações.
> Leia esta documentação completamente antes de fazer qualquer modificação.

---

## 📋 Visão Geral

O `Equipment3DCarousel` é um carrossel de modelos 3D que exibe equipamentos em
rotação automática. Ele possui uma **sincronização explícita** com o sistema de
ScrollReveal para garantir que o primeiro modelo não execute animações de zoom
até que toda a animação do Hero termine.

---

## 🎯 Comportamento Esperado (NÃO ALTERAR)

### Regra Fundamental

> **O primeiro modelo 3D (índice 0) NUNCA deve executar a animação
> `Bounds.fit()`** **até que o ScrollReveal do Hero termine completamente.**

### Timeline de Comportamento

```
┌─────────────────────────────────────────────────────────────┐
│                    COMPORTAMENTO ESPERADO                     │
├─────────────────────────────────────────────────────────────┤
│ T=0s    │ Página carrega, currentIndex=0 (primeiro modelo)  │
│         │ delayBoundsFit=true, isRevealComplete=false        │
│         │ Modelo carrega, mas Bounds.fit() AGUARDA           │
├─────────┼───────────────────────────────────────────────────┤
│ T=0.3s  │ ScrollReveal inicia (delay + animação ~1.5s)      │
│         │ Elemento .hero-image-inner com opacity: 0 → 1     │
├─────────┼───────────────────────────────────────────────────┤
│ T=1.5s  │ ScrollReveal termina, evento 'scrollRevealReady'  │
│         │ isRevealComplete muda para true                    │
│         │ Primeiro modelo NÃO executa zoom (já está visível) │
│         │ Resultado: Primeiro modelo aparece apenas com fade │
├─────────┼───────────────────────────────────────────────────┤
│ T=6s    │ Auto-rotate troca para segundo modelo (index=1)   │
│         │ delayBoundsFit=false (passou do primeiro modelo)   │
│         │ Segundo modelo carrega → Bounds.fit() executa      │
│         │ Resultado: Segundo modelo exibe animação de zoom   │
└─────────┴───────────────────────────────────────────────────┘
```

### Por Que Esta Lógica Existe

1. **Primeira Impressão**: O primeiro modelo aparece suavemente com o
   ScrollReveal, sem conflito de animações
2. **Sincronização Visual**: Garante que o carrossel 3D só mostre animações
   visíveis após o Hero estar totalmente revelado
3. **Consistência**: Funciona independente da velocidade da rede ou tamanho do
   modelo

---

## 🏗️ Arquitetura Técnica

### Componentes Envolvidos

```
Equipment3DCarousel
  └── ModelViewer (recebe delayBoundsFit e isRevealComplete)
      └── SceneContent
          ├── Bounds (com maxDuration dinâmico) ← CRÍTICO
          └── ModelWrapper (executa Bounds.fit() condicionalmente)
```

### Fluxo de Dados

```
Hero Component
  ├── Escuta evento 'scrollRevealReady'
  ├── Estado: isScrollRevealReady (true quando evento dispara)
  └── Passa para Equipment3DCarousel:
      └── isRevealComplete={isScrollRevealReady}

Equipment3DCarousel
  ├── Estado: currentIndex (0 = primeiro modelo)
  ├── Lógica: hasPassedFirstModel = currentIndex > 0
  └── Passa para ModelViewer:
      ├── delayBoundsFit={!hasPassedFirstModel}  // true apenas no primeiro
      └── isRevealComplete={isRevealComplete}

ModelViewer → SceneContent
  ├── disableAutoFit={delayBoundsFit}
  └── Bounds com maxDuration dinâmico:
      ├── maxDuration={0} se disableAutoFit=true → Fit INSTANTÂNEO
      └── maxDuration={1} se disableAutoFit=false → Fit com animação

ModelWrapper
  └── useEffect que executa Bounds.fit():
      ├── Se delayBoundsFit=true E isRevealComplete=false → AGUARDA
      └── Caso contrário → EXECUTA após 200ms
```

### 🔴 CRÍTICO: Prop `maxDuration` do Bounds

**A solução final depende da prop `maxDuration` do componente `<Bounds>`:**

```typescript
// packages/frontend/src/widgets/hero/ui/ModelViewer.web.tsx - SceneContent
const boundsMaxDuration = disableAutoFit ? 0 : 1

return (
  <Bounds fit clip observe margin={1.2} maxDuration={boundsMaxDuration}>
    {/* ... */}
  </Bounds>
)
```

**Por que isso é crítico:**

- **`maxDuration={0}`**: O Bounds executa o fit **INSTANTANEAMENTE**, sem
  animação visível
- **`maxDuration={1}`**: O Bounds executa o fit com animação de 1 segundo
  (padrão)

**Para o primeiro modelo:**

- `disableAutoFit = true` → `maxDuration = 0` → Modelo aparece no tamanho
  correto **SEM animação**
- Isso garante que mesmo que o `Bounds.fit()` execute, não há animação visível
- `delayBoundsFit = true` mantém `disableAutoFit` ativo mesmo após o
  ScrollReveal, evitando pausa na auto-rotate quando o fit roda.

**Para modelos seguintes:**

- `disableAutoFit = false` → `maxDuration = 1` → Animação de zoom suave

---

## 🔒 Regras Críticas (NUNCA VIOLAR)

### ❌ NUNCA FAÇA

1. **Remover a prop `isRevealComplete`** do `Equipment3DCarousel`
2. **Remover a prop `delayBoundsFit`** do `ModelViewer`
3. **Remover a prop `maxDuration` do componente `<Bounds>`** - **CRÍTICO**
4. **Alterar `maxDuration={0}` para o primeiro modelo** - Isso elimina a
   animação
5. **Alterar a lógica `delayBoundsFit={!hasPassedFirstModel}`** sem entender o
   impacto
6. **Executar `Bounds.fit()` imediatamente** no primeiro modelo sem aguardar
   `isRevealComplete`
7. **Remover o listener do evento `scrollRevealReady`** nas páginas que usam o
   carrossel
8. **Alterar o delay de 200ms do `Bounds.fit()`** sem considerar a sincronização
9. **Remover a prop `disableAutoFit`** do `SceneContent` - Controla
   `maxDuration`

### ✅ SEMPRE FAÇA

1. **Mantenha a sincronização explícita** usando o evento `scrollRevealReady`
2. **Preserve a lógica de `hasPassedFirstModel`** para diferenciar primeiro vs
   demais modelos
3. **Documente qualquer mudança** que afete o timing ou sincronização
4. **Teste em rede lenta** (Slow 3G) para garantir consistência
5. **Valide que o primeiro modelo** não exibe zoom visível

---

## 🚀 Melhorias Permitidas (Sem Quebrar a Lógica)

### Performance

- ✅ Otimizar carregamento de modelos (preload, lazy loading)
- ✅ Reduzir re-renders desnecessários (memo, useMemo)
- ✅ Otimizar animações Three.js (frameloop dinâmico)
- ✅ Melhorar cache de modelos GLB

### UX

- ✅ Adicionar transições suaves entre modelos
- ✅ Melhorar feedback visual durante carregamento
- ✅ Adicionar controles de navegação
- ✅ Melhorar responsividade mobile

### Código

- ✅ Refatorar para melhor legibilidade
- ✅ Adicionar TypeScript types mais específicos
- ✅ Melhorar tratamento de erros
- ✅ Adicionar testes unitários

### ⚠️ Melhorias que REQUEREM CUIDADO

- **Alterar timing do ScrollReveal**: Se o delay ou duração mudarem, ajustar
  lógica de sincronização
- **Mudar estrutura do Hero**: Garantir que `isScrollRevealReady` continue
  funcionando
- **Adicionar novos modelos**: A lógica atual funciona para qualquer quantidade

---

## 📝 Exemplo de Implementação Correta

### Hero.tsx

```typescript
// ✅ CORRETO: Escuta evento e passa para carrossel
const [isScrollRevealReady, setIsScrollRevealReady] = useState(false)

useEffect(() => {
  const handleScrollRevealReady = () => {
    setIsScrollRevealReady(true)
  }
  window.addEventListener('scrollRevealReady', handleScrollRevealReady)
  return () => {
    window.removeEventListener('scrollRevealReady', handleScrollRevealReady)
  }
}, [])

<Equipment3DCarousel
  models={HERO_EQUIPMENT_MODELS}
  isRevealComplete={isScrollRevealReady} // ✅ Passa estado
/>
```

### Equipment3DCarousel.tsx

```typescript
// ✅ CORRETO: Diferencia primeiro modelo dos demais
const hasPassedFirstModel = currentIndex > 0

<ModelViewer
  url={currentModel.modelUrl}
  delayBoundsFit={!hasPassedFirstModel} // ✅ true apenas no primeiro
  isRevealComplete={isRevealComplete}   // ✅ recebe do Hero
/>
```

### SceneContent.tsx (ModelViewer)

```typescript
// ✅ CORRETO: maxDuration dinâmico elimina animação no primeiro modelo
const boundsMaxDuration = disableAutoFit ? 0 : 1

return (
  <Bounds fit clip observe margin={1.2} maxDuration={boundsMaxDuration}>
    {/* ... */}
  </Bounds>
)
```

### ModelWrapper.tsx

```typescript
// ✅ CORRETO: Aguarda sincronização antes de executar
useEffect(() => {
  if (hasFitted.current) return

  // Se delayBoundsFit está ativo, aguardar isRevealComplete
  if (delayBoundsFit && !isRevealComplete) {
    return // ✅ AGUARDA
  }

  const timer = setTimeout(() => {
    bounds.refresh().fit()
    hasFitted.current = true
  }, 200)
  return () => clearTimeout(timer)
}, [bounds, delayBoundsFit, isRevealComplete])
```

---

## 🧪 Como Validar que Está Funcionando

### Teste 1: Primeiro Modelo Sem Zoom

1. Recarregue a página inicial em modo incógnito (sem cache)
2. Observe o primeiro modelo (compressor) aparecer
3. **Esperado**: Apenas fade-in do ScrollReveal, SEM animação de zoom
4. Aguarde 6s para o auto-rotate

### Teste 2: Modelos Seguintes Com Zoom

1. Após o primeiro modelo aparecer, aguarde 6s
2. Observe o segundo modelo (betoneira) aparecer
3. **Esperado**: Animação de zoom visível (`Bounds.fit()` executando)

### Teste 3: Rede Lenta (Consistência)

1. Abra DevTools → Network → Throttle para "Slow 3G"
2. Recarregue a página
3. **Esperado**: Comportamento idêntico aos testes anteriores, mesmo com rede
   lenta

### Teste 4: Navegação Interna

1. Navegue para outra página
2. Volte para a home
3. **Esperado**: Em navegação interna, ScrollReveal mostra elementos
   imediatamente, mas a lógica de sincronização ainda funciona

---

## 🔍 Troubleshooting

### Problema: Primeiro modelo exibe zoom

**Causa**: `isRevealComplete` está `true` antes do ScrollReveal terminar

**Solução**: Verificar se o evento `scrollRevealReady` está sendo disparado
corretamente em `scroll-reveal-init.tsx`

### Problema: Modelos seguintes não exibem zoom

**Causa**: `delayBoundsFit` está `true` para todos os modelos

**Solução**: Verificar lógica `hasPassedFirstModel = currentIndex > 0`

### Problema: Zoom nunca executa

**Causa**: `isRevealComplete` nunca muda para `true`

**Solução**: Verificar listener do evento `scrollRevealReady` no componente pai

---

## Registro da modernização multiempresa (2026-09-26)

Nada da lógica deste documento mudou. Registro para quem mexer no entorno:

- **Fonte do caminho no `ScrollRevealInit`**:
  `packages/frontend/src/app/providers/ScrollRevealInit.web.tsx` passou a ler o
  caminho por `useVisiblePathname` (Lote 4a, commit `da19f601`). Só a fonte
  mudou: nos hosts sem prefixo o valor é o mesmo, e no modo host o navegador já
  informa o caminho visível. O disparo de `scrollRevealReady` não foi alterado.
- **Checklist estático** (conferido em 2026-09-26): `git diff HEAD` de
  `packages/frontend/src/widgets/hero` vazio; continuam presentes
  `hasPassedFirstModel = currentIndex > 0`,
  `delayBoundsFit={!hasPassedFirstModel}`, `isRevealComplete`,
  `boundsMaxDuration = disableAutoFit ? 0 : 1` e
  `maxDuration={boundsMaxDuration}`.
- **Host web por host** (Lote 4b): o `ScrollRevealInit` ficou na mesma posição
  (`publicExtras` do `ClientLayoutShell`, `dynamic` com `ssr: false`), agora
  dentro de `TenantSiteProviders` e `AppHostProviders`. O layout raiz deixou de
  ter `Suspense` acima da página, então o conteúdo chega junto com o shell. Em
  Chromium headless o `scrollRevealReady` disparou.
- **`/api/drei-proxy`** (commit `0cff7b65`): aceita só `hdri/<arquivo>.hdr`, sem
  CORS; está na allowlist de APIs do host de locadora.
- **Primeiro quadro com movimento reduzido (onda 5, sem commit; entrada 201 de
  `docs/issues/known-issues.md`)**: em `Hero.web.tsx` e nas outras seções da
  revelação, os elementos que o `ScrollRevealInit` mantém parados só nascem
  escondidos com `motion-safe:`. `Equipment3DCarousel.web.tsx`,
  `ModelViewer.web.tsx`, `scrollRevealReady`, `delayBoundsFit`,
  `isRevealComplete`, `maxDuration={0}` e `disableAutoFit` não mudaram.
- **CSS sem `!important` (onda 4, commit `4b02f52f`; entrada 194 de
  `docs/issues/known-issues.md`)**: o `ScrollRevealInit` não grava mais
  `transition` inline nos elementos de `CSS_OWNED_TRANSITION` (cartões, contato
  e `.hero-image`; a transição fica em `components.web.css`) nem `overflow` na
  página Sobre. Com `prefers-reduced-motion: reduce`, os elementos de
  `STILL_WHEN_REDUCED_MOTION` ficam em repouso. O disparo de `scrollRevealReady`
  e os tempos (2700 ms na primeira visita e na Sobre, 200 ms na navegação
  interna) não mudaram e estão presos em
  `packages/frontend/src/app/providers/ScrollRevealInit.web.test.tsx`.
  `Equipment3DCarousel.web.tsx` e `ModelViewer.web.tsx` não foram tocados; em
  `Hero.web.tsx` só saiu a classe `transition-transform ease-out` do
  `.hero-image-inner`, que o CSS já sobrescrevia.
- **Prova em navegador (onda 4)**: sonda em Chromium headless com SwiftShader,
  antes e depois: o primeiro modelo vai do tamanho inicial ao final em uma
  amostra (sem zoom visível). Controle positivo: com `maxDuration=1` forçado
  temporariamente no `ModelViewer`, o crescimento aparece ao longo de 5 amostras
  (arquivo restaurado e conferido por hash). A sonda ficou fora do
  versionamento.
- **Pendente até a onda 135** (executado no lote A, A10; registro abaixo): o
  Teste 1 de "Como Validar" (primeiro modelo sem zoom, aba anônima, Slow 3G, GPU
  real) não foi executado depois dessas mudanças. Com GPU emulada (SwiftShader)
  apareceu um `pageerror` de `removeChild` ainda não investigado (entrada 167 de
  `docs/issues/known-issues.md`).

- **Selos do hero de volta (onda 134, lote vitrine-conteúdo, sem commit)**: os
  selos "+N Equipamentos Disponíveis" (`.hero-badge-left`) e "N+ Anos de
  Experiência" (`.hero-badge-right`) voltaram ao `Hero.web.tsx`, só com a frota
  e os anos da própria locadora (`siteContent`). O `ScrollRevealInit` voltou a
  ter os seletores e as animações de `55763c1e`
  (`slide-in-left 0.6s ease-out 1.8s forwards` e
  `slide-in-right 0.6s ease-out 2.0s forwards`, com `clearInlineMotion` em 2400
  e 2600 ms), presos em `ScrollRevealInit.web.test.tsx` e
  `ScrollRevealInit.seletores.web.test.tsx`. O disparo de `scrollRevealReady`
  (2700 ms na primeira visita) não mudou. `Equipment3DCarousel.web.tsx` e
  `ModelViewer.web.tsx` não foram tocados (sha do `ModelViewer` conferido igual
  ao da sonda anterior). Com movimento reduzido, os selos seguem o caminho da
  produção; a linha de base visual da home (que captura com
  `prefers-reduced-motion: reduce`) saiu igual à da produção.
- **Sonda repetida (onda 134)**: a mesma sonda em Chromium headless com
  SwiftShader, no `next dev` do host web com o backend simulado. Antes da
  mudança (2 execuções) e depois dela (2 execuções), o primeiro modelo chega ao
  tamanho final em até 2 amostras de 100 ms (sem zoom visível); o
  `scrollRevealReady` disparou em cerca de 3,4 s (servidor de desenvolvimento).
  Controle positivo (antes): com `maxDuration=1` forçado no `ModelViewer`, o
  crescimento aparece ao longo de várias amostras (arquivo restaurado e
  conferido por hash). A sonda ficou fora do versionamento.

- **Teste 1 em navegador real (onda 135, lote A, A10; 2026-10-08, sem commit)**:
  Google Chrome 154 com janela e GPU do aparelho (ANGLE/Direct3D 11, NVIDIA
  GeForce GTX 1070 Ti; não o SwiftShader do headless), contexto novo a cada
  execução (sem cache nem cookies, como a aba anônima), na home do host web
  compilado (`next build` + `next start`) com o backend simulado da linha de
  base visual. Nenhuma linha do carrossel mudou: a sonda lê a câmera de cada
  quadro pelo gancho de depuração do próprio three.js (`__THREE_DEVTOOLS__`) e
  mede o tamanho aparente do modelo (raio da esfera da cena / distância da
  câmera), que a rotação automática não muda. O HDR do drei-assets e o
  decodificador Draco foram servidos localmente (HDR sintético neutro; Draco de
  `three/examples`), sem rede externa; a iluminação não entra no enquadramento.
  - Rede normal: o Compressor (primeiro modelo) **não teve zoom animado** — zero
    quadros intermediários entre o enquadramento inicial e o final (tamanho
    aparente 0,225 → 0,475 de uma vez). O enquadramento acontece num único
    salto, cerca de 0,5 s depois do primeiro quadro desenhado, com a imagem do
    hero ainda no fade-in do ScrollReveal (opacidade de ~0,2 no primeiro quadro
    e de ~0,5 a ~0,8 no salto, conforme a execução) e antes do
    `scrollRevealReady` (~3,1 s). Entre os dois quadros o processo principal
    fica ocupado (~0,5 s, carga do modelo); o salto vem do `Bounds` com
    `maxDuration={0}` (o `fit`/`observe` dele), não do `ModelWrapper`, que só
    age depois da revelação. Controle positivo (Teste 2): a Betoneira teve o
    zoom animado do `Bounds` (`maxDuration={1}`), 77 quadros intermediários em
    ~330 ms; a sonda enxerga zoom quando ele existe.
  - Slow 3G (DevTools clássico: 2 s de latência, 400 kbit/s): a revelação
    terminou aos ~27 s e o carrossel trocou de modelo a cada 6 s sem nenhum
    modelo carregado; o primeiro modelo desenhado foi o Compressor só na
    terceira volta (~71 s), já com a página revelada, e de novo sem zoom animado
    (um único salto de enquadramento, depois de ~0,5 s no enquadramento
    inicial). A Betoneira e o Andaime não chegaram a ser desenhados dentro da
    janela de 6 s deles na medição. É o comportamento atual do componente (a
    troca automática não espera o carregamento); fica registrado para o dono,
    sem mudança na lógica crítica.
  - Capturas: `scratchpad/visual-review/36-carrossel-*.png` (fora do
    repositório); sonda e série de quadros fora do versionamento.

---

## Loader com um único dono DOM — onda 135 (2026-10-08, sem commit)

**Status:** loader validado no runtime local normal; P1/A10 parcial, com Slow 3G
inconclusivo. Os registros anteriores de captura permanecem históricos; as
entradas 167/321 de `docs/issues/known-issues.md` conservam seus limites.

Nas capturas atuais com Chrome/GPU real, o `removeChild` também apareceu,
próximo ao carregamento e à troca do modelo. O diagnóstico mostrou um filho DIV
já sem pai quando ReactDOM tentou removê-lo; o `<Html>` do Drei criava uma root
DOM adicional dentro do fallback de Suspense. Esse é o candidato prioritário
para o conflito de dono DOM; a primeira remoção ainda não foi demonstrada. Ver
entrada 334.

O progresso agora fica no DOM React normal, como irmão do Canvas no wrapper
relativo existente; o Suspense da cena usa `fallback={null}`. Conserva o
percentual arredondado, `text-yellow-500`, `text-lg` e centralização. A
visibilidade compara `loadedUrl === url`, confirmada pelo `onLoaded` do GLTF
atual, preservando `onModelLoaded`. Chegar a 100% no progresso global não
dispensa a resolução do modelo. O preload não apaga a confirmação de um GLTF em
cache; resolver uma URL antiga depois da troca não confirma a URL atual.

Esta mudança não altera a sincronização: `scrollRevealReady`, `delayBoundsFit`,
`isRevealComplete`, `hasPassedFirstModel`, `disableAutoFit`,
`Bounds.maxDuration={0}` no primeiro modelo e duração um nos seguintes, a espera
de 200ms, os timers de troca e a rotação permanecem. Não foram criados tokens,
cores, z-index, controles ou baselines.

`ModelViewer.web.test.tsx` usa Promise real de Suspense e dublês 3D para
caracterizar progresso, resolução, troca de URL, resolução antiga, cache e a
barreira de revelação/200ms. Passou 5/5. O controle negativo com a fonte
original falhou em dois casos e passou em três; após restauração pelo SHA-256
`5c3c525df965282b1ba0650282e2bcb4453b7eda09f85f60d9db9a915aaa6c2f`, voltou a
5/5. A tipagem focada teve zero diagnósticos próprios e de dependências. Logs
`a10-loader-*.log`, `a10-loader-sensitivity.json` e
`focused-types-a10-loader.log` ficam em
`%TEMP%/locadora-wave135-resume-20261008/`.

Os builds legacy da web e da raiz foram renovados e passaram; a API conserva o
build aplicável ao backend não alterado. Os testes não reproduzem o erro do Drei
nem validam GPU; essa prova vem das capturas seguintes, com web compilado Better
Auth (`r2B-vsczGQAqwkg72XsRq`) e fonte no SHA-256 acima.

- Rede normal, `2026-10-09T00-39-31-220Z`: GPU real, zero erros de página/probe,
  cinco marcos e análise radial completa. O Compressor não teve fit sustentado,
  e a Betoneira confirmou o controle positivo; a rotação foi preservada. O
  coordenador revisou o contact sheet de 354 quadros decodificados em 14,16s. O
  loader está validado nesse escopo local normal.
- Slow 3G, `2026-10-09T00-40-02-378Z`: zero erros de página/perdas de contexto
  ativo, vinte descartes comprovados e 6.874 quadros do Compressor sem fit
  radial sustentado. A Betoneira não desenhou até o limite declarado de 150s;
  controle positivo e dois marcos ausentes. Resultado inconclusivo, sem estender
  o prazo ou forçar uma troca.

`a10-temporal/manual-review-final.json` registra a revisão; relatórios brutos
foram preservados. HDR neutro sintético, Draco local e backend de fixture não
certificam CDN, iluminação real, infraestrutura de produção ou autenticação. O
aceite integral A10, os demais cenários dos Testes 1–4 e a comparação visual
completa continuam pendentes. Não fechar universalmente 167/321 a partir da
prova local normal; nenhum baseline visual foi aprovado.

---

## 📚 Referências Relacionadas

- `docs/features/hero-section.md` - Documentação do Hero que usa o carrossel
- `docs/guides/scroll-reveal.md` - Sistema de ScrollReveal
- `docs/issues/known-issues.md#67` - Problema #67 documentando esta solução
- `packages/frontend/src/widgets/hero/ui/Equipment3DCarousel.web.tsx` - Código
  fonte do componente
- `packages/frontend/src/widgets/hero/ui/ModelViewer.web.tsx` - Componente
  Three.js que executa zoom

---

## 🎯 Resumo para IA

**Ao modificar este componente, você DEVE:**

1. ✅ **PRESERVAR** a lógica de sincronização com ScrollReveal
2. ✅ **MANTER** `delayBoundsFit` e `isRevealComplete` funcionando
3. ✅ **GARANTIR** que o primeiro modelo não exibe zoom
4. ✅ **TESTAR** em rede lenta para validar consistência
5. ✅ **DOCUMENTAR** qualquer mudança que afete timing

**Você PODE:**

- ✅ Melhorar performance (sem quebrar sincronização)
- ✅ Adicionar features (preservando lógica existente)
- ✅ Refatorar código (mantendo comportamento)

**Você NÃO PODE:**

- ❌ Remover sincronização explícita
- ❌ Fazer primeiro modelo exibir zoom
- ❌ Depender de timing implícito em vez de eventos

---

_Última atualização: 2026-10-08 | Versão: 1.1 | Status: Crítico para Preservar;
P1/A10 parcial_
