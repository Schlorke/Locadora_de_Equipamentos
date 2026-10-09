# Recuperação de entregas Asaas

Estado em 2026-10-05, onda 128, sem commit. Procedimento de referência, não uma
autorização para executar operações reais. A retomada automática e a liberação
final de recebimentos ainda não estão implementadas.

## Evidências distintas

| Evidência                               | O que comprova                                            | O que ainda falta                                           |
| --------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| SNAPSHOT_COMPLETE                       | Tentativas vinculadas conferidas até o corte do incidente | Mudanças posteriores, correção do endpoint e novas entregas |
| Nova conferência confirmada             | Novo corte financeiro, preservando histórico              | Conclusão do job e revisão de divergências                  |
| Atualização da configuração do provedor | Configuração aceita                                       | Recebimento e processamento de eventos atuais               |
| Entrega atual correlacionada            | Comunicação e processamento daquela entrega               | Critérios de liberação operacional da conta                 |

O painel oferece somente consulta e pedido de conferência. Não disponibiliza
botão de reativação, escrita no provedor ou aprovação de conta.

## Sequência de recuperação

1. Confirmar locadora, ambiente, integração e chave atuais, sem copiar segredos
   para logs ou documentos. Conferir a situação restrita e o incidente atual.
2. Consultar logs do provedor e da aplicação; identificar causa, horário e
   configuração afetada. Não misturar eventos de contas irmãs.
3. Corrigir a causa e comprovar o caminho HTTP real, incluindo autenticação,
   persistência idempotente na inbox e processamento. Preservar recusas de
   origem e isolamento; não afrouxar guardas para obter sucesso.
4. Pedir nova conferência financeira e acompanhar o job. Revisar divergências;
   conferir emissões e mudanças posteriores ao incidente anterior. Pedido
   PENDING conserva sua agenda; PROCESSING/lease impedem substituição.
5. Com autorização operacional explícita para a conta e o ambiente, seguir o
   procedimento vigente do Asaas para retomar a configuração correta.
6. Correlacionar um novo evento monitorado com recebimento, inbox, processamento
   e logs do provedor. Registrar a evidência sanitizada. Conclusão financeira ou
   resposta do PUT isoladamente não libera recebimentos neste sistema.

O Asaas documenta interrupção após quinze falhas e retenção de eventos por
quatorze dias. Recomenda corrigir a causa antes de reativar pela interface ou
por PUT /v3/webhooks/{id} com interrupted=false. A resposta confirma a
configuração; a validação posterior exige nova entrega e HTTP 200 nos logs.
[Procedimento oficial, consultado em 2026-10-05](https://docs.asaas.com/docs/como-reativar-fila-interrompida).

## Preservação e interrupção do procedimento

Se houver chave trocada/expirada, conta bloqueada/desconectada, incidente
substituído, divergência de referência/valor ou ausência de evidência de
entrega, conservar a restrição e encaminhar revisão. Não apagar pagamentos,
recibos, tentativas ou checkpoints, nem repetir escrita externa incerta.

Eventos antigos removidos pelo provedor precisam de conciliação pelas
referências persistidas e revisão das lacunas; uma fila vazia não comprova
ausência de pendências. Não fazer pagamento real para testar sem autorização.

## Estado local e pendências

Ondas 123, 127 e 128 cobrem conferência por incidente/chave, recibos sanitizados
e pedido confirmado do dono. Ainda faltam a prova operacional de reparo e
entrega, o comando auditado de retomada/liberação e a homologação externa. Este
documento não escolhe silenciosamente a política de autorização do suporte nem o
corte de produção. API legada, scheduler e flags permanecem.

Referências: [conta de recebimentos](../features/conta-recebimentos.md),
[provas da extração](../features/shared-api-host.md),
[ADR SaaS](../architecture/adr-saas-subscription.md).
