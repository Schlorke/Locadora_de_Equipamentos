# 264-orcamento-publico

**Estado: bloqueado.** Nenhuma alteração de código nesta fatia.

`app/orcamento/page.tsx` já é shell fino: só importa e renderiza
`QuotePageWrapper` de `@gb-locacoes/frontend/pages/orcamento`. O slice
`packages/frontend/src/pages/orcamento` já é a tela inteira (UI web + testes).

Invariantes já presentes no destino (não reescritas nesta fatia): WhatsApp da
página `555198205163` (separado do FAB `5551998205163`); chaves de período sem
acento `diaria`, `semanal`, `quinzenal`, `mensal`; rótulos `Diário`, `Semanal`,
`Quinzenal`, `Mensal`.

`app/admin/orcamentos` e `pages/orcamentos-admin` permanecem fora do escopo e
não foram tocados. PARE.

```yaml
fatia:
  id: 264-orcamento-publico
  estado: bloqueado
  conceito: orçamento público (shell /orcamento)
  motivo: "rota já é shell; pages/orcamento já é a tela inteira"
  origem:
    - app/orcamento/page.tsx
  destino:
    - packages/frontend/src/pages/orcamento
  invariantes:
    - "WhatsApp desta página: 555198205163 (≠ FAB 5551998205163)"
    - "chaves período: diaria, semanal, quinzenal, mensal"
    - "rótulos: Diário, Semanal, Quinzenal, Mensal"
  comandos: []
  gate:
    arch: n/a
    tokens: n/a
    violacoes_conhecidas: []
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: vitest platform — fatia bloqueada sem mudança]"
    - "[NOT_VERIFIED: arch-check — fatia bloqueada sem mudança]"
    - "[NOT_VERIFIED: token-check — fatia bloqueada sem mudança]"
```
