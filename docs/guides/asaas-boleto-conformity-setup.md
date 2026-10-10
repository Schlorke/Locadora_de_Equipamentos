# Boletos Asaas: limites de configuração e validação

Este guia localiza a implementação atual. A receita anterior de configuração da
conta GB foi
[arquivada](../archive/wave135-pre-f/docs/guides/asaas-boleto-conformity-setup.md.source).
Os dados daquela empresa e as conclusões legais daquele registro não definem o
beneficiário de uma nova locadora nem comprovam conformidade atual do provedor.

## Donos do fluxo

- `packages/backend/src/modules/billing/asaas.ts`: porta de cobrança, busca de
  cliente por documento, criação de cobrança PIX/BOLETO e leitura dos detalhes.
- `packages/backend/src/modules/quotations/boleto.ts`: leitura de boleto do
  orçamento e das obrigações correspondentes.
- `apps/services/api/src/host/payments.ts`: composição HTTP dos pagamentos.
- `@gb-locacoes/backend/billing` e `@gb-locacoes/backend/quotations`: entradas
  públicas para os consumidores servidor.

A assinatura remunera a plataforma; os recebimentos dos clientes pertencem à
locadora e usam a conta recebedora dela. Consulte a
[ADR de assinatura](../architecture/adr-saas-subscription.md) e a
[documentação de recebimentos](../features/INDEX.md) antes de configurar uma
integração. Credenciais permanecem no servidor e nunca entram no cliente ou
neste guia.

## O que o código envia e lê

A criação de cobrança envia cliente, `billingType`, valor, vencimento, descrição
e referência externa. A leitura de BOLETO busca a linha digitável e o código de
barras; a URL do PDF vem de `bankSlipUrl`, quando fornecida. A implementação
atual não envia `documentType`. Acrescentar um campo presumido ou trocar um dado
de beneficiário no código não comprova que o provedor o aceita.

## Validação necessária para uma integração futura

1. Identificar a locadora e a conta recebedora autorizadas, sem reutilizar
   contas GB ou copiar valores do registro histórico.
2. Validar primeiro com fixtures locais os valores, vencimentos, referências,
   isolamento por locadora e tratamento de resposta incerta.
3. Somente com autorização específica, conferir o documento efetivamente emitido
   em ambiente de teste do provedor: beneficiário, pagador, valor, vencimento e
   correspondência com a cobrança.
4. Registrar separadamente a evidência do provedor e a análise jurídica/fiscal
   aplicável. A aprovação dos testes locais não substitui nenhuma delas.

Provas locais relacionadas: `tests/critical/quote-boleto.test.ts`,
`tests/critical/verify-boleto-payments-cron.test.ts` e
`tests/api-host/payment-requests.http.test.ts`. A existência desses arquivos não
declara uma rodada executada ou produção aprovada.

Esta atualização documental não cria conta, emite cobrança ou habilita
integração. A hospedagem e os dados de acesso da nova plataforma ainda exigem
configuração própria.

_Atualizado em 2026-10-09; leitura do clone pós-retirada, validação final em
andamento._
