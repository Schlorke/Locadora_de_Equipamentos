# 265-contato

**Estado: bloqueado.** Nenhuma alteração de código nesta fatia.

`app/contato/page.tsx` já é shell fino: só importa `GoogleStoreLocator` (mapa) e
renderiza `ContatoPage` de `@gb-locacoes/frontend/pages/contato`. O slice
`packages/frontend/src/pages/contato` já é a tela inteira (formulário, cards de
telefone/e-mail/endereço, horários, diferenciais). Telefones e e-mails já vivem
em `ContatoPage` via `usePublicSettings`.

Widgets `contato-home` / `contato-empresa` não foram tocados. PARE conforme
contrato da fatia.

```yaml
fatia:
  id: 265-contato
  estado: bloqueado
  conceito: página pública de contato (shell /contato)
  motivo: "rota já é shell; pages/contato já é a tela inteira"
  origem:
    - app/contato/page.tsx
  destino:
    - packages/frontend/src/pages/contato
  invariantes: []
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
