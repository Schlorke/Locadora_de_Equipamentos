# Configurações históricas da GB: operação preservada e estacionada

O
[runbook completo anterior](../archive/wave135-pre-f/docs/operations/gb-site-settings.md.source)
registra o corte planejado da GB nas ondas 132–135, os dados da época e suas
pendências. Ele não comprova execução do corte e não autoriza acesso ou escrita
em recursos da GB. A nova plataforma tem hospedagem e banco futuros próprios.

## Por que os utilitários permanecem

`tools/gb-site-settings.mjs` e `tools/gb-site-content.mjs` são utilitários
operacionais específicos mantidos por responsabilidade histórica. Não são seed
genérico, bootstrap de uma locadora nova, job de CI ou rotina automática.

O comportamento atual de `gb-site-settings.mjs` continua:

- Selecionar a organização pelo slug e recusar a escrita se o documento não
  corresponder à organização GB; essa trava evita contaminar outro tenant.
- Simular por padrão. `--apply` é uma decisão explícita, não ativada pela
  publicação da nova plataforma ou pela retirada da árvore antiga.
- Fazer a escrita em transação com `app.tenant_id`, lock da organização e
  condições que preservam os campos/documentos já definidos pelo dono.
- Registrar nomes dos campos conferidos e gravados e digests dos documentos,
  preservando a idempotência depois de edições ou despublicações do dono.
- Manter os itens declarados pendentes quando não há fonte, sem inventar frota,
  avaliações ou códigos de verificação.

## Caminhos atuais que recebem os dados

O painel grava pelo catálogo do backend, em
`packages/backend/src/modules/catalog/admin-settings.ts`, com composição em
`apps/services/api/src/host/branding.ts`. A leitura pública pertence ao mesmo
módulo de catálogo e à borda `apps/clients/web/src/host/server/public-api.ts`. O
frontend usa os dados da própria locadora em suas fatias; não usa os valores
históricos da GB como fallback.

Os IDs de medição e os caminhos de produção citados na receita antiga pertencem
àquela fonte histórica. Não precisam ser buscados em commits antigos para
inicializar o produto novo, nem devem ser copiados para outra locadora.

## Pré-condições de qualquer uso futuro

Exigir autorização específica do dono dos recursos, identificação exata de
organização/banco, janela e plano de retorno. Preservar uma simulação e revisar
o relatório sanitizado antes de permitir escrita. Não alterar a organização para
fazer a trava passar, não ampliar o utilitário a todos os tenants e não usar
credenciais reais em exemplos versionados.

Os testes locais `tests/unit/gb-site-settings.test.ts` e a família
`gb-site-content.*` caracterizam as funções/fixtures; não certificam o banco, o
domínio, a medição ou o corte real da GB. Nesta etapa esses recursos continuam
intocados. Consulte a [ADR de hosts](../architecture/adr-tenant-hosts.md) antes
de planejar qualquer transferência de tráfego.

_Atualizado em 2026-10-09; runbook histórico preservado, operação externa não
executada._
