# Validação do sistema de orçamentos

Este roteiro usa web/API/backend atuais e recursos locais próprios. O
[roteiro de fevereiro de 2026](../archive/wave135-pre-f/docs/testing/quote-system-validation.md.source)
foi arquivado: seus servidores, scripts de usuários, limites e receitas SQL não
são instruções atuais para atuar em um banco externo.

## Pré-condições

Ler a [regra de orçamentos](../features/quote-system.md), a
[regra de multa](../features/late-fee-calculation.md) e os contratos de
[API compartilhada](../features/shared-api-host.md). Usar somente banco
descartável criado para a execução, migrations por `prisma migrate deploy` e
credenciais sintéticas. Nunca `db push`, reset ou reaproveitamento de recursos
GB. Registrar a origem da fonte, o modo de autenticação, builds e ambiente.

Os donos ativos são:

- `apps/services/api/src/app/api/quotes/route.ts` e as rotas específicas de
  orçamento: borda HTTP, principal e respostas.
- `apps/services/api/src/host/quotations.ts` e
  `apps/services/api/src/host/rentals.ts`: composição das portas por locadora.
- `packages/backend/src/modules/quotations` e
  `packages/backend/src/modules/rentals`: casos de uso.
- `packages/domain/src/orcamento`: cálculos e regras puros.
- `packages/contracts`: contratos de entrada/saída compartilhados.
- `packages/frontend/src/pages/orcamento` e `pages/orcamentos-admin`: UI do
  cliente e do painel, sem banco ou credenciais servidor no bundle.

## Provas complementares

| Escopo              | Fontes de teste existentes                                                                                    | O que conferir                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Domínio             | `packages/domain/src/orcamento/multa.test.ts`                                                                 | Datas fixas, arredondamento e limites com resultados independentes do cálculo testado.   |
| Banco/fluxo crítico | `tests/critical/quote-flow.test.ts`, `quote-adjustment.test.ts`, `late-fee.test.ts`, `stock-blocking.test.ts` | Estado persistido, total, obrigações, estoque, tenant e ausência de efeitos indevidos.   |
| HTTP real           | `tests/api-host/quote-mutations.http.test.ts`, `quote-documents.http.test.ts`, `rental-cycle.http.test.ts`    | Status/DTOs e documentos com oracles literais, não a resposta atual usada como esperado. |
| Navegador           | `tests/e2e/journeys.spec.ts`                                                                                  | Carrinho, confirmação, reload, identidade e os efeitos remotos/DB correspondentes.       |

Comandos existentes, a executar somente na fila e no ambiente próprios:

```sh
pnpm test:unit
pnpm test:integration
pnpm test:api
```

`test:integration` usa `vitest.config.ts` e o setup do banco/API descartáveis;
`test:api` usa `vitest.api.config.ts` e o harness HTTP. Eles não iniciam um
servidor legado da raiz: o clone aposentou essa árvore. Preservar as negativas
de autorização/tenant, as fases e a idempotência real; não duplicar o mesmo host
sob dois rótulos para fabricar paridade ou volume.

## Checklist funcional

1. Criar o orçamento pela API ou UI real; conferir itens, quantidades, períodos,
   total e tenant no banco. Confirmar notificação durável sem cobrança antes da
   aprovação aplicável.
2. Repetir com outro usuário e outra locadora próprios: nenhuma query, body ou
   referência de objeto pode ampliar o principal ou ler dados alheios.
3. Exercitar ajustes, estados, obrigações e multa conforme as regras e fixtures.
   Conferir valores literais esperados e os registros persistidos, não apenas
   uma resposta 200.
4. Conferir documento/consulta do cliente, estoque e efeitos de pagamento com
   dublês locais. Integração real do provedor exige prova e autorização
   próprias.
5. No navegador, confirmar carrinho e identidade após reload. Não fazer polling
   agressivo nem apagar contadores para contornar o limite de autenticação.
6. Encerrar filhos, pontes, navegador e banco próprios e registrar o resultado
   do cleanup. Falha ou skip não contratual permanece visível no relatório.

Rate limiting pertence à composição `apps/services/api/src/host/rate-limit.ts` e
à identidade do backend. Não presumir Redis ou o limite fixo do guia antigo;
conferir a política do caminho efetivamente exercitado.

## Registro do resultado

Anotar comando, ambiente próprio, fonte/build, duração, exit code, casos
aprovados/falhos/skips e logs sanitizados. Separar domínio, DB, HTTP, navegador,
visual e provedor: um resultado local verde não certifica produção, conformidade
externa ou outro dispositivo. Este documento não é a aprovação da fila F ainda
em execução.

_Atualizado em 2026-10-09; roteiro pós-retirada, sem executar testes nesta
revisão._
