# Runbook — conciliação manual de cobranças legadas

Dois casos antigos pedem uma pessoa, não uma correção automática:

1. valores gravados com fração de centavo (ex.: `128.5714…` de um orçamento de 9
   dias com semana direta, multas e prorrogações antigas);
2. cobrança PIX/boleto marcada `CANCELLED` só no sistema, que o provedor não
   confirma como removida (respostas 409/502/503 ao pedir cobrança nova).

Nada aqui altera dados sozinho. A ferramenta é somente leitura; qualquer ajuste
é uma mudança de dados revisada, feita por quem opera o banco.

## 1. Valores fora de centavos

### Gerar o relatório

```bash
# DATABASE_URL explícita (nenhum arquivo .env é lido); use um usuário de leitura.
DATABASE_URL="postgresql://<usuario-leitura>:<senha>@<host>:<porta>/<banco>" \
  pnpm exec tsx scripts/ops/legacy-cents-report.ts --tenant-id=<id-da-locadora> --format=csv > relatorio.csv
```

- Sem `--tenant-id`, o relatório percorre todas as locadoras, uma por vez.
- `--format` aceita `text` (padrão), `csv` ou `json`.
- A ferramenta abre uma transação `READ ONLY`, confere que o banco a mantém
  somente leitura e desfaz a transação no fim. Não existe modo `--apply`.
- Linhas em quarentena (`tenantId` nulo) não entram: não pertencem a nenhuma
  locadora.

### Colunas

| Coluna       | Significado                                                              |
| :----------- | :----------------------------------------------------------------------- |
| `origin`     | Tabela e coluna (`payments.amount`, `quotes.total`, `rentals.lateFee`…). |
| `id`         | Linha da origem.                                                         |
| `value`      | Valor gravado, com todas as casas.                                       |
| `cents`      | O mesmo valor em centavos pela regra do sistema (`roundToCents`).        |
| `difference` | `cents - value`.                                                         |
| `status`     | Status da linha (categoria, no caso de `quote_adjustments`).             |
| `reference`  | Obrigação: `quote:<id>`, `rental:<id>` ou `payment:<id>`.                |

### O que fazer com cada origem

- **Totais, multas e prorrogações** (`quotes.*`, `rentals.*`,
  `quote_adjustments.amount`): a cobrança e a quitação já usam o valor em
  centavos (`obligationBalance`). Só corrija se o valor aparecer em contrato ou
  relatório para o cliente.
- **`payments.amount` `PAID`, `CANCELLED` ou `REFUNDED`**: histórico. Não
  altere. Confira só se a obrigação aparece quitada.
- **`payments.amount` `PENDING`/`OVERDUE` sem `transactionId`**: nunca saiu para
  o provedor. A emissão recusa frações de centavo antes da rede, então a
  cobrança fica parada e um pedido novo responde "A cobrança existente exige
  ajuste e conciliação". Confirme o saldo da obrigação em centavos e troque a
  cobrança numa mudança revisada. Depois disso, o pedido normal cobra o saldo
  certo.
- **`payments.amount` `PENDING`/`OVERDUE` com `transactionId`**: a cobrança
  existe no provedor, e lá o valor está em centavos. Compare no painel do Asaas
  da locadora antes de qualquer ajuste, porque a confirmação de pagamento recusa
  valor divergente.
- **`payment_attempts.amount`**: acompanha a cobrança da linha `payment:<id>`.
  Resolva a cobrança primeiro.

## 2. Cobrança anterior `CANCELLED` sem prova no provedor

Ao pedir cobrança nova (boleto do orçamento, PIX ou boleto da obrigação), o
sistema lê no provedor cada cobrança `CANCELLED` com `transactionId` que não
tenha tentativa cancelada ou confirmada. Aberta, ela volta a ser a vigente;
paga, volta a ser a vigente e a confirmação segue pela outbox; removida, a prova
é gravada e a cobrança nova sai. Nos outros casos, nenhuma cobrança nova sai:

| Resposta | Causa                                                                                    | O que fazer                                                                     |
| :------- | :--------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------ |
| 409      | Divergência: outro valor ou meio, estorno, 404, mais de uma aberta ou pagamento parcial. | Abrir a cobrança (`transactionId`) no painel do Asaas e decidir com a locadora. |
| 502      | O provedor recusou a chave da locadora ou respondeu fora do contrato.                    | Conferir a integração Asaas da locadora (chave e ambiente).                     |
| 503      | Provedor indisponível ou integração não configurada.                                     | Tentar de novo; se persistir, conferir a integração.                            |

Uma cobrança criada na conta antiga, antes da subconta da locadora, responde 404
na chave da locadora e cai em 409. Concilie pela conta onde ela foi emitida.

## Registro

Para cada linha tratada, registre no chamado: locadora, origem, `id`, valor,
valor em centavos, decisão, responsável e data. Depois da mudança, rode o
relatório de novo para a mesma locadora e anexe a saída.
