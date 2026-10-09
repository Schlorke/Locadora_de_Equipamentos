# 255-logistica-rota

**Estado: bloqueado.** Nenhuma alteração de código nesta fatia.

Não existe `app/admin/logistica/**`. A rota de produto é
`app/admin/logistics/page.tsx` e **já é shell fino**: só importa e renderiza
`AdminLogisticsPage` de `@gb-locacoes/frontend/pages/logistica`. O slice
`packages/frontend/src/pages/logistica` já é a tela inteira (carga, filtros,
tabela, diálogo, checklist e calendário). Entrega continua azul `#3B82F6` e
coleta continua roxa `#8B5CF6`. A migração equivalente já consta em
`152-logistica` … `156-checklist-logistica`.

PARE conforme contrato da fatia.

```yaml
fatia:
  id: 255-logistica-rota
  estado: bloqueado
  conceito: rota shell logística admin (/admin/logistics)
  motivo: "rota já é shell; pages/logistica já é a tela inteira"
  origem:
    - app/admin/logistica/**
    - app/admin/logistics/page.tsx
  destino:
    - packages/frontend/src/pages/logistica
  invariantes:
    - id: cores-entrega-coleta
      prova:
        "LogisticaPage.web.tsx: DELIVERY #3B82F6 e coleta #8B5CF6 (já no
        destino)"
  comandos: []
  gate:
    arch: n/a
    tokens: n/a
    violacoes_conhecidas:
      - "app/page.tsx continua dono da home e do Prisma"
      - "o carrossel 3D continua em components/equipment-3d-carousel.tsx"
  aposentado: []
  nao_verificado:
    - "[NOT_VERIFIED: vitest platform — fatia bloqueada sem mudança]"
    - "[NOT_VERIFIED: arch-check — fatia bloqueada sem mudança]"
    - "[NOT_VERIFIED: token-check — fatia bloqueada sem mudança]"
```
