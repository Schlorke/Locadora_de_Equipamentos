# Cobranças duplicadas e retorno tardio na modernização

Status: regressões locais corrigidas; publicação não realizada.

A origem tinha emissão acoplada à gravação, sobrescrita de cobranças na
regeneração e exemplos artificiais de boleto/PIX. A migração também revelou uma
corrida adicional: um worker com resposta atrasada podia tentar restabelecer a
referência externa de uma tentativa já cancelada.

As implementações se encontram em packages/backend/src/modules/billing e
quotations; lib/payment-request.ts, lib/payment-issuance.ts,
lib/payment-reissue.ts e lib/quote-boleto.ts compõem as dependências reais.
Obrigações são persistidas antes da rede, tentativas têm identidade própria e
todo resultado externo é validado novamente dentro da transação. Cancelamentos
desconhecidos não autorizam nova emissão. A atualização condicional da tentativa
precisa afetar exatamente um registro.

A suíte billing-database.test.ts reproduz a sequência worker A atrasado →
reconciliação por B → cancelamento → nova tentativa → resposta tardia de A. O
resultado conserva a tentativa antiga cancelada e a nova pendente, sem restaurar
o link antigo.

Validação: pnpm test:unit com TEST_DATABASE_URL local descartável explícita e
TEST_DATABASE_DISPOSABLE=true. Complemento HTTP em
tests/critical/quote-boleto.test.ts. Ver
[contrato de cobrança](../features/modernization-billing.md) para estados,
endpoints e pendências.

Na onda 40 de extração, pedidos PIX/boleto e leitura do PDF são compostos nos
dois hosts sobre a mesma implementação. Emissão/reconciliação ficam no backend,
mas sua execução operacional continua legada. Provas de rollback, concorrência,
FORCE RLS e contrato do provedor constam em
[API compartilhada](../features/shared-api-host.md); nenhum worker duplicado,
cutover ou emissão real foi executado.

Na onda 41, o serviço passa a receber PIX/Asaas usando a mesma inbox e os mesmos
consumidores da composição legada. Hash/conflito/dedupe, lease e gravação da
outbox precedem os efeitos; falha do consumidor libera o lease e conserva retry.
As provas HTTP incluem rollback da transação e recuperação com o mesmo evento,
sem tocar no provedor. PAYMENT_DELETED e pagamento de tentativa antiga não
quitam ou removem a obrigação atual indevidamente. Verificação de boleto mantém
credenciais explícitas por registro de recurso e FINANCIAL/WRITE.

O scheduler segue apenas legado; não agendar um segundo worker nem trocar
webhooks no Asaas antes do cutover operacional. A política existente de
integração/organização inativa continua sem mudança e exige revisão SaaS
separada. Evidências locais e limites em
[API compartilhada](../features/shared-api-host.md), onda 41.
