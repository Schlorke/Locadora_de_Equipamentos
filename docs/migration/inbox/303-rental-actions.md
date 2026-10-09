# 303-rental-actions

**Estado: intermediate.** Órfão `components/client/rental-actions.tsx` (zero
imports de produto; `next/navigation`) foi para o slice de histórico de locação
do cliente. Textos e endpoints preservados. Multas de locação (5% da diária) e
orçamento (2% ao dia) permanecem em entities distintas — este UI não as toca.
Pasta `components/client/` esvaziada e removida.

```yaml
fatia:
  id: 303-rental-actions
  estado: intermediate
  conceito: components/client/rental-actions.tsx → FSD (histórico cliente)
  origem:
    - components/client/rental-actions.tsx
  destino:
    - packages/frontend/src/pages/historico-detalhe/ui/AcoesLocacao.web.tsx
    - packages/frontend/src/pages/historico-detalhe/ui/AcoesLocacao.web.test.tsx
    - packages/frontend/src/pages/historico-detalhe/index.ts
  invariantes:
    - id: textos-acoes
      prova:
        "AcoesLocacao.web.test: Ver Boleto, Solicitar Prorrogação, Solicitar
        Coleta, Confirmar Solicitação"
    - id: endpoints-cliente
      prova:
        "request-extension + additionalDays; request-pickup;
        /area-cliente/pagamentos/"
    - id: web-next-navigation
      prova:
        "AcoesLocacao.web.tsx importa next/navigation; export RentalActions no
        index"
    - id: multas-separadas
      prova:
        "AcoesLocacao não importa calculateLateFee/calculateRentalLateFee;
        entities/locacao multa 0.05 e entities/orcamento DEFAULT_LATE_FEE_CONFIG
        intactas"
    - id: legado-apagado
      prova:
        "Test-Path components/client/rental-actions.tsx = False; pasta client
        removida"
  comandos:
    - cmd:
        "pnpm exec vitest run --config vitest.platform.config.ts
        packages/frontend/src/pages/historico-detalhe"
      exit: 0
      verificado_em: "2026-09-25 16:40"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:40"
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:40"
  gate:
    arch: pass
    tokens: pass
    vitest_platform: pass
  aposentado:
    - components/client/rental-actions.tsx
    - components/client/ (diretório vazio removido)
  callers_atualizados: []
  nao_verificado:
    - "[NOT_VERIFIED: wiring futuro em HistoricoDetalhePage (ações inline
      distintas: /extend vs request-extension)]"
    - "[NOT_VERIFIED: UI no browser]"
    - "[NOT_VERIFIED: pnpm build no host raiz]"
    - "[NOT_VERIFIED: pnpm build:web]"
```
