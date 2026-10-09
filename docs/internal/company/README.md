# 📄 Documentos da Empresa

Esta pasta contém documentos oficiais e importantes da empresa GB Locações.

> **⚠️ IMPORTANTE**: O arquivo PDF original **NÃO** deve ser versionado no Git
> por questões de segurança. Este README contém todas as informações
> necessárias.

## 📋 Arquivos Disponíveis

### CNPJ - Comprovante de Inscrição

**Arquivo Original** (local apenas, não versionado):
`cnpj-gustavo-barbosa-brenner.pdf`

**Emitido em**: 19/07/2024 às 15:26:51

**Informações Principais**:

- **Número de Inscrição**: 34.780.330/0001-69 (MATRIZ)
- **Nome Empresarial**: GUSTAVO BARBOSA BRENNER
- **Nome de Fantasia**: GB LOCACOES E MANUTENCAO
- **Data de Abertura**: 05/09/2019
- **Porte**: ME (Microempresa)
- **Situação Cadastral**: ATIVA (desde 05/09/2019)

**Natureza Jurídica**: 213-5 - Empresário (Individual)

**Atividade Econômica Principal**:

- 43.30-4-04 - Serviços de pintura de edifícios em geral

**Atividades Econômicas Secundárias**:

- 43.22-3-01 - Instalações hidráulicas, sanitárias e de gás
- 43.99-1-02 - Montagem e desmontagem de andaimes e outras estruturas
  temporárias
- 77.32-2-02 - Aluguel de andaimes

**Endereço**:

- Logradouro: R IRMAO FRANCISCO, 44
- CEP: 90.240-120
- Bairro/Distrito: HUMAITA
- Município: PORTO ALEGRE

**Contato**:

- Email: GUSTAVOBBRENNER@GMAIL.COM
- Telefone: (51) 9982-0516

**Aprovação**: Instrução Normativa RFB nº 2.119, de 06 de dezembro de 2022

---

## 🎯 Uso para IA/Desenvolvimento

Estes documentos podem ser consultados quando necessário:

- Preencher formulários com dados oficiais da empresa
- Gerar documentos legais ou contratos
- Configurar integrações que precisem de dados cadastrais
- Validar informações em sistemas externos
- Atualizar dados em registros ou configurações

**⚠️ IMPORTANTE**:

- Sempre use os dados oficiais deste documento quando precisar de informações
  cadastrais da empresa.
- O CNPJ é informação pública, mas email e telefone são dados sensíveis que
  devem ser protegidos.
- Em produção, considere usar variáveis de ambiente para dados de contato.

---

## 💳 Dados Fiscais para Boletos Bancários

### **Informações do Beneficiário**

Para conformidade legal de boletos bancários (FEBRABAN/BCB), os boletos devem
ser emitidos com os seguintes dados da empresa como beneficiário:

| Campo                 | Valor                                                              |
| :-------------------- | :----------------------------------------------------------------- |
| **CNPJ**              | 34.780.330/0001-69                                                 |
| **Razão Social**      | GUSTAVO BARBOSA BRENNER                                            |
| **Nome Fantasia**     | GB LOCACOES E MANUTENCAO                                           |
| **Endereço Completo** | R IRMAO FRANCISCO, 44 - HUMAITA - PORTO ALEGRE/RS - CEP 90.240-120 |

### **Configuração no Asaas**

⚠️ **CRÍTICO**: A configuração do beneficiário é feita na **conta do Asaas**,
não no código. O código apenas referencia clientes (pagadores).

**Importante**:

- A conta do Asaas deve estar configurada como **"Pessoa Jurídica"** (não
  "Pessoa Física")
- O CNPJ configurado deve ser `34.780.330/0001-69`
- Todos os boletos devem ser emitidos com esses dados

### **Documentação Relacionada**

Para mais informações sobre conformidade de boletos:

- [`docs/features/boleto-conformity.md`](../features/boleto-conformity.md) -
  Requisitos legais e fiscais completos
- [`docs/guides/asaas-boleto-conformity-setup.md`](../guides/asaas-boleto-conformity-setup.md) -
  Guia prático de configuração
- [`docs/guides/asaas-dados-empresa.md`](../guides/asaas-dados-empresa.md) -
  Dados para cadastro no Asaas

---

_Última atualização: janeiro 2026_
