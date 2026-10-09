# Conformidade de Boletos Bancários - GB Locações

> **⚠️ CRÍTICO**: Este documento descreve os requisitos legais, normativos e
> fiscais para a emissão de boletos bancários por empresas de locação de
> equipamentos no Brasil. Consulte-o para garantir conformidade com FEBRABAN,
> Banco Central e legislação tributária.

---

## 1. Introdução

A emissão de boletos bancários no Brasil é rigorosamente regulamentada pela
**Federação Brasileira de Bancos (FEBRABAN)** e pelo **Banco Central do Brasil
(BCB)** para garantir segurança, transparência e conformidade fiscal. Desde
2018, com a implementação da **Nova Plataforma de Cobrança**, todos os boletos
devem ser registrados em uma base centralizada.

Este documento apresenta uma análise completa dos requisitos aplicáveis à GB
Locações, empresa de locação de equipamentos para construção civil.

---

## 2. Requisitos Normativos e Legais

### 2.1. Campos Obrigatórios no Boleto

Conforme as normas da FEBRABAN e BCB, todos os boletos devem conter as seguintes
informações:

| Campo Obrigatório                      | Descrição                                     | Status GB Locações                                              |
| :------------------------------------- | :-------------------------------------------- | :-------------------------------------------------------------- |
| **CPF/CNPJ do Beneficiário**           | Identificação fiscal de quem emite a cobrança | ⚠️ **Crítico** - Deve usar CNPJ da empresa (34.780.330/0001-69) |
| **Nome e Endereço do Beneficiário**    | Dados completos de quem emite a cobrança      | ⚠️ **Crítico** - Deve constar razão social e endereço fiscal    |
| **CPF/CNPJ do Pagador**                | Identificação fiscal de quem paga o boleto    | ✅ **Atendido** - Sistema exige e valida documento do cliente   |
| **Nome e Endereço do Pagador**         | Dados completos de quem paga o boleto         | ✅ **Atendido** - Sistema coleta e utiliza dados do cliente     |
| **Valor do Documento**                 | Valor exato da cobrança                       | ✅ **Atendido** - Sistema calcula valor total incluindo frete   |
| **Data de Vencimento**                 | Prazo final para pagamento sem encargos       | ✅ **Atendido** - Sistema define vencimento (padrão: 3 dias)    |
| **Linha Digitável e Código de Barras** | Padrão FEBRABAN para identificação            | ✅ **Atendido** - Gerado automaticamente pelo Asaas             |
| **Nosso Número**                       | Identificador único do boleto                 | ✅ **Atendido** - Gerado e controlado pelo Asaas                |

### 2.2. Espécie do Documento

A **espécie do documento** identifica a natureza da obrigação que originou o
boleto. Para operações de **locação de equipamentos**, a espécie correta é:

- **CT (Contrato)** - Recomendado para locação de bens móveis
- **DS (Duplicata de Serviço)** - Alternativa, mas menos precisa (locação não é
  serviço)

⚠️ **Importante**: O boleto de amostra analisado utilizava "DM" (Duplicata
Mercantil), que é adequada apenas para operações de **compra e venda de
mercadorias**, não para locação.

---

## 3. Requisitos Fiscais para Locação de Equipamentos

### 3.1. Incidência de Impostos

#### ISS (Imposto Sobre Serviços)

A locação **pura** de bens móveis (sem operador) **NÃO é fato gerador de ISS**.

**Base Legal**: Súmula Vinculante 31 do Supremo Tribunal Federal (STF), que
declara inconstitucional a cobrança de ISS sobre operações de locação de bens
móveis.

**Exceção**: Se a GB Locações oferecer equipamentos **com operador**, o ISS
incidirá apenas sobre o valor do serviço do operador, que deve ser discriminado
em documento fiscal separado.

#### ICMS (Imposto sobre Circulação de Mercadorias e Serviços)

A locação **NÃO é fato gerador de ICMS**, pois não se caracteriza como uma
operação de circulação de mercadoria (venda).

A movimentação dos equipamentos é feita sob o amparo de uma **Nota Fiscal de
Remessa para Locação** (CFOP 5.949 para operações internas ou 6.949 para
interestaduais), que não destaca imposto.

### 3.2. Documentação Fiscal Apropriada

#### Período Atual (até 2025)

A operação de locação de bens móveis é formalizada por meio de:

- **Contrato de locação**
- **Fatura de locação**

Não é exigida uma nota fiscal de serviço para a cobrança.

#### Reforma Tributária (a partir de 2026)

⚠️ **ATENÇÃO**: Com a Reforma Tributária, a **Nota Técnica SE/CGNFS-e nº
005/2025** estabeleceu que, a partir de janeiro de 2026 (início da fase de
testes), as operações de locação de bens móveis passarão a ser obrigatoriamente
formalizadas pela **Nota Fiscal de Serviço eletrônica (NFS-e) de padrão
nacional**.

Este documento será a base para a apuração dos novos tributos (IBS e CBS) que
substituirão PIS, COFINS, ISS e ICMS.

**Impacto**: O sistema da GB Locações deverá ser adaptado para emitir a NFS-e
para todas as operações de locação. Consulte
[`nfs-e-integration-roadmap.md`](./nfs-e-integration-roadmap.md) para
planejamento detalhado.

---

## 4. Dados da Empresa para Boletos

### 4.1. Informações do Beneficiário

Para garantir conformidade, os boletos devem ser emitidos com os seguintes dados
da GB Locações:

| Campo             | Valor                                                              |
| :---------------- | :----------------------------------------------------------------- |
| **CNPJ**          | 34.780.330/0001-69 (MATRIZ)                                        |
| **Razão Social**  | GUSTAVO BARBOSA BRENNER                                            |
| **Nome Fantasia** | GB LOCACOES E MANUTENCAO                                           |
| **Endereço**      | R IRMAO FRANCISCO, 44 - HUMAITA - PORTO ALEGRE/RS - CEP 90.240-120 |

> **Fonte**: `docs/internal/company/README.md`

### 4.2. Configuração no Asaas

⚠️ **IMPORTANTE**: A configuração do beneficiário (CNPJ, razão social, endereço)
é feita na **conta do Asaas**, não no código do sistema.

O código apenas referencia **clientes (pagadores)**, não o beneficiário.
Portanto, é necessário:

1. Verificar se a conta do Asaas está configurada com o CNPJ da empresa
2. Confirmar que a razão social e endereço estão corretos
3. Validar que todos os boletos são emitidos com esses dados

Consulte
[`docs/guides/asaas-boleto-conformity-setup.md`](../guides/asaas-boleto-conformity-setup.md)
para guia prático de configuração e validação.

---

## 5. Análise de Conformidade do Sistema Atual

### 5.1. Pontos Positivos

✅ **Validação de CPF/CNPJ do Pagador**: O sistema exige e valida o documento do
cliente antes de gerar o boleto (`lib/quote-boleto.ts`)

✅ **Cálculo Correto de Valores**: O sistema calcula o valor total do orçamento,
incluindo frete, e utiliza na geração do boleto

✅ **Vinculação com Transação**: O sistema vincula o boleto ao orçamento através
do `externalReference`, facilitando rastreabilidade

✅ **Gateway Robusto**: Uso do Asaas como gateway, que garante conformidade
técnica com padrões FEBRABAN

### 5.2. Pontos que Requerem Atenção

⚠️ **Beneficiário no Asaas**: Deve ser verificado manualmente se a conta do
Asaas está configurada com o CNPJ da empresa (não CPF pessoal)

⚠️ **Espécie do Documento**: Verificar se a API do Asaas permite definir a
espécie como "CT" (Contrato). Se não permitir, pode ser uma limitação da
plataforma

⚠️ **Vinculação Fiscal Futura**: Preparar sistema para vincular boletos à NFS-e
quando a Reforma Tributária entrar em vigor

---

## 6. Checklist de Conformidade

Use este checklist para validar a conformidade dos boletos emitidos:

### Beneficiário

- [ ] CNPJ do beneficiário é 34.780.330/0001-69 (não CPF pessoal)
- [ ] Razão social do beneficiário é "GUSTAVO BARBOSA BRENNER"
- [ ] Endereço fiscal do beneficiário está completo e correto

### Pagador

- [ ] CPF ou CNPJ do pagador está presente
- [ ] Nome do pagador está completo
- [ ] Endereço do pagador está presente (quando aplicável)

### Documento

- [ ] Espécie do documento é "CT" (Contrato) ou adequada para locação
- [ ] Valor do documento está correto
- [ ] Data de vencimento está definida

### Vinculação

- [ ] Boleto está vinculado a um orçamento (através de externalReference)
- [ ] Descrição do boleto referencia o orçamento
- [ ] (Futuro) Boleto está vinculado à NFS-e correspondente

### Documentação Fiscal

- [ ] (Atual) Boleto está vinculado a fatura de locação
- [ ] (Futuro - 2026+) Boleto está vinculado à NFS-e de padrão nacional

---

## 7. Referências Legais

### Normativas

- **FEBRABAN**: Nova Plataforma de Cobrança (2018)
  - Disponível em:
    [https://portal.febraban.org.br/pagina/3150/1094/pt-br/servicos-novo-plataforma-boletos](https://portal.febraban.org.br/pagina/3150/1094/pt-br/servicos-novo-plataforma-boletos)

- **Banco Central do Brasil**: Regulamentação de cobrança bancária

### Jurisprudência

- **STF - Súmula Vinculante 31**: ISS sobre locação de bens móveis
  - Disponível em:
    [https://portal.stf.jus.br/jurisprudencia/sumariosumulas.asp?base=26&sumula=1286](https://portal.stf.jus.br/jurisprudencia/sumariosumulas.asp?base=26&sumula=1286)

### Reforma Tributária

- **Nota Técnica SE/CGNFS-e nº 005/2025**: NFS-e obrigatória para locações a
  partir de 2026

---

## 8. Recomendações de Implementação

### Imediatas

1. ✅ **Verificar Configuração do Asaas**: Confirmar que a conta está
   configurada com CNPJ da empresa
2. ✅ **Validar Espécie do Documento**: Verificar se API do Asaas permite
   definir como "CT"
3. ✅ **Documentar Limitações**: Se a API não suportar espécie, documentar
   limitação

### Curto Prazo

1. 📋 **Melhorar Descrição dos Boletos**: Incluir referência explícita a
   "Contrato de Locação"
2. 📋 **Validação Automática**: Implementar validação que garante CPF/CNPJ do
   pagador
3. 📋 **Auditoria de Conformidade**: Criar processo de validação periódica dos
   boletos gerados

### Médio/Longo Prazo

1. 🔮 **Integração com NFS-e**: Preparar sistema para emissão de NFS-e (Reforma
   Tributária 2026+)
2. 🔮 **Vinculação Fiscal**: Garantir que boletos estejam sempre vinculados a
   documentos fiscais válidos
3. 🔮 **Segregação de Serviços**: Se oferecer locação com operador, separar
   valores para fins de ISS

---

## 9. Documentação Relacionada

- [`docs/guides/asaas-boleto-conformity-setup.md`](../guides/asaas-boleto-conformity-setup.md) -
  Guia prático de configuração
- [`docs/features/nfs-e-integration-roadmap.md`](./nfs-e-integration-roadmap.md) -
  Roadmap para NFS-e
- [`docs/internal/company/README.md`](../internal/company/README.md) - Dados
  oficiais da empresa
- [`docs/guides/asaas-dados-empresa.md`](../guides/asaas-dados-empresa.md) -
  Dados para cadastro no Asaas

---

## 10. Histórico de Versões

| Data       | Versão | Descrição                                                     |
| :--------- | :----- | :------------------------------------------------------------ |
| 2026-01-12 | 1.0.0  | Documentação inicial baseada em análise de conformidade legal |

---

_Última atualização: 12 de janeiro de 2026_
