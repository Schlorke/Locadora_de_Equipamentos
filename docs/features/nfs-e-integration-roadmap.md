# Roadmap de Integração NFS-e - GB Locações

> **Planejamento para integração com Nota Fiscal de Serviço eletrônica (NFS-e)
> de padrão nacional, obrigatória a partir de 2026 conforme Reforma Tributária**

---

## 1. Contexto e Motivação

### 1.1. Reforma Tributária 2026

A **Reforma Tributária** brasileira estabeleceu, através da **Nota Técnica
SE/CGNFS-e nº 005/2025**, que a partir de **janeiro de 2026** (fase de testes),
as operações de **locação de bens móveis** passarão a ser obrigatoriamente
formalizadas pela **Nota Fiscal de Serviço eletrônica (NFS-e) de padrão
nacional**.

### 1.2. Impacto para GB Locações

Atualmente (até 2025), as operações de locação são formalizadas por:

- **Contrato de locação**
- **Fatura de locação**

A partir de 2026, será necessário:

- ✅ Emitir **NFS-e de padrão nacional** para cada operação de locação
- ✅ Vincular boletos bancários à NFS-e correspondente
- ✅ Adaptar sistema de faturamento para integração com webservices de NFS-e
- ✅ Atualizar processos contábeis e fiscais

---

## 2. Requisitos e Desafios

### 2.1. Requisitos Técnicos

| Requisito                    | Descrição                                         | Status          |
| :--------------------------- | :------------------------------------------------ | :-------------- |
| **Webservice NFS-e**         | Integração com webservice do município/prefeitura | 🔴 Não iniciado |
| **Estrutura de Dados**       | Modelo de dados para NFS-e no banco               | 🔴 Não iniciado |
| **Validação Fiscal**         | Validação de dados antes da emissão               | 🔴 Não iniciado |
| **Vinculação Boletos**       | Associar boletos à NFS-e emitida                  | 🔴 Não iniciado |
| **Emissão Automática**       | Emitir NFS-e ao gerar orçamento/locação           | 🔴 Não iniciado |
| **Consultas e Retificações** | Consultar status e retificar NFS-e se necessário  | 🔴 Não iniciado |

### 2.2. Desafios Identificados

1. **Municípios Diferentes**: Cada município pode ter webservice próprio (padrão
   nacional ainda em implementação)
2. **Certificado Digital**: Necessário certificado A1 ou A3 para assinatura
   digital
3. **Validações Complexas**: Dados fiscais, CFOP, códigos de serviço, etc.
4. **Integração com Boletos**: Garantir vinculação correta entre NFS-e e boletos
5. **Processo Contábil**: Adaptar processos internos para NFS-e

---

## 3. Fases de Implementação

### Fase 1: Pesquisa e Planejamento (Q1 2026)

**Objetivo**: Entender requisitos técnicos e legais, definir arquitetura

**Atividades**:

- [ ] Pesquisar padrão nacional de NFS-e (estado atual)
- [ ] Identificar webservices disponíveis (Porto Alegre/RS)
- [ ] Mapear campos necessários para emissão
- [ ] Definir arquitetura de integração
- [ ] Avaliar bibliotecas/frameworks disponíveis
- [ ] Estimar esforço de implementação

**Entregas**:

- Documentação técnica de requisitos
- Arquitetura proposta
- Estimativa de esforço

---

### Fase 2: Modelagem de Dados (Q2 2026)

**Objetivo**: Criar estrutura de dados para NFS-e no banco

**Atividades**:

- [ ] Criar model `InvoiceNfse` no Prisma
- [ ] Definir relacionamentos (Quote, Rental, Payment)
- [ ] Criar migrações de banco
- [ ] Implementar schemas de validação (Zod)
- [ ] Criar tipos TypeScript

**Entregas**:

- Schema Prisma atualizado
- Migrações aplicadas
- Schemas de validação

---

### Fase 3: Integração Básica (Q3 2026)

**Objetivo**: Implementar integração básica com webservice de NFS-e

**Atividades**:

- [ ] Implementar cliente de webservice (SOAP/REST)
- [ ] Implementar autenticação (certificado digital)
- [ ] Criar serviço de emissão de NFS-e
- [ ] Implementar validações básicas
- [ ] Criar endpoints de API
- [ ] Testes em ambiente de homologação

**Entregas**:

- Serviço de emissão funcionando
- Endpoints de API
- Testes básicos

---

### Fase 4: Integração com Sistema Atual (Q4 2026)

**Objetivo**: Integrar NFS-e com fluxo atual de orçamentos e locações

**Atividades**:

- [ ] Emitir NFS-e ao converter orçamento em locação
- [ ] Vincular NFS-e aos boletos gerados
- [ ] Atualizar descrição de boletos para referenciar NFS-e
- [ ] Implementar consultas de status
- [ ] Criar interface administrativa para visualizar NFS-e
- [ ] Implementar retificações (se necessário)

**Entregas**:

- Integração completa com fluxo atual
- Interface administrativa
- Boletos vinculados à NFS-e

---

### Fase 5: Processos e Documentação (Q1 2027)

**Objetivo**: Finalizar processos, documentação e treinamento

**Atividades**:

- [ ] Documentar processos de emissão
- [ ] Criar guias de uso
- [ ] Implementar relatórios fiscais
- [ ] Treinamento da equipe
- [ ] Testes finais em produção
- [ ] Go-live

**Entregas**:

- Documentação completa
- Processos definidos
- Sistema em produção

---

## 4. Arquitetura Proposta

### 4.1. Componentes Principais

```
┌─────────────────────────────────────────────────────────────┐
│                    Sistema GB Locações                       │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │   Quotes/    │───▶│   NFS-e      │───▶│   Boletos    │ │
│  │  Rentals     │    │   Service    │    │   Service    │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
│                                │                            │
│                                ▼                            │
│                     ┌──────────────────┐                    │
│                     │  Webservice NFS-e│                    │
│                     │  (Município)     │                    │
│                     └──────────────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

### 4.2. Fluxo de Emissão

```
1. Orçamento Aprovado
   ↓
2. Converter para Locação
   ↓
3. Emitir NFS-e
   ├─ Validar dados fiscais
   ├─ Chamar webservice
   └─ Salvar NFS-e no banco
   ↓
4. Gerar Boleto
   ├─ Vincular à NFS-e
   └─ Incluir número NFS-e na descrição
   ↓
5. Enviar para Cliente
```

---

## 5. Considerações Técnicas

### 5.1. Certificado Digital

**Requisito**: Certificado digital A1 ou A3 (ICP-Brasil) para assinatura da
NFS-e

**Opções**:

- **A1**: Arquivo (.pfx) - mais simples para servidor
- **A3**: Token/leitora - mais seguro, mas requer hardware

**Recomendação**: Começar com A1 para facilitar implementação inicial

### 5.2. Biblioteca/Framework

**Opções a avaliar**:

- Bibliotecas específicas para NFS-e (município de Porto Alegre)
- Frameworks genéricos de NFS-e (se padrão nacional estiver disponível)
- Implementação custom (SOAP/REST)

**Pesquisa necessária**: Verificar disponibilidade e maturidade das opções

### 5.3. Ambiente de Homologação

**Importante**: Sempre testar em ambiente de homologação antes de produção

**Atividades**:

- Obter credenciais de homologação
- Configurar ambiente de teste
- Validar integração completa
- Testar cenários de erro

---

## 6. Impacto nos Boletos

### 6.1. Vinculação NFS-e ↔ Boleto

**Atual (até 2025)**:

- Boleto vinculado apenas ao orçamento
- Descrição: `"Orcamento de equipamentos - {quoteId}"`

**Futuro (2026+)**:

- Boleto vinculado à NFS-e
- Descrição: `"Locação de equipamentos - NFS-e {numero} - Orçamento {quoteId}"`
- Campo `invoiceNfseId` no modelo `Payment`

### 6.2. Conformidade Legal

⚠️ **Obrigatório**: Boletos devem estar vinculados à NFS-e correspondente

**Benefícios**:

- Conformidade fiscal
- Rastreabilidade completa
- Facilita auditoria
- Preparação para novos tributos (IBS/CBS)

---

## 7. Dependências e Pré-requisitos

### 7.1. Infraestrutura

- [ ] Certificado digital A1 ou A3
- [ ] Ambiente de homologação configurado
- [ ] Credenciais de acesso ao webservice
- [ ] Documentação técnica do webservice

### 7.2. Conhecimento

- [ ] Entender padrão de NFS-e (nacional ou municipal)
- [ ] Conhecer webservices SOAP/REST
- [ ] Entender processo de assinatura digital
- [ ] Conhecer requisitos fiscais específicos

### 7.3. Processos Internos

- [ ] Definir processo de emissão
- [ ] Definir responsabilidades
- [ ] Criar procedimentos de retificação
- [ ] Treinar equipe

---

## 8. Riscos e Mitigações

| Risco                                       | Impacto | Mitigação                                                 |
| :------------------------------------------ | :------ | :-------------------------------------------------------- |
| **Padrão nacional ainda não disponível**    | Alto    | Implementar para padrão municipal primeiro, migrar depois |
| **Complexidade técnica maior que esperado** | Médio   | Fases incrementais, testes extensivos                     |
| **Certificado digital com problemas**       | Médio   | Ter backup/certificado alternativo                        |
| **Custos adicionais**                       | Baixo   | Incluir no planejamento orçamentário                      |
| **Prazo apertado (janeiro 2026)**           | Alto    | Iniciar planejamento o quanto antes                       |

---

## 9. Próximos Passos Imediatos

### Para 2026

1. **Q1**: Iniciar Fase 1 (Pesquisa e Planejamento)
2. **Q2**: Iniciar Fase 2 (Modelagem de Dados)
3. **Acompanhar**: Evolução do padrão nacional de NFS-e
4. **Decisão**: Padrão nacional vs padrão municipal

### Ações Preparatórias (Agora)

- [ ] Acompanhar notícias sobre Reforma Tributária e NFS-e
- [ ] Pesquisar webservices disponíveis (Porto Alegre/RS)
- [ ] Avaliar necessidade de certificado digital
- [ ] Incluir NFS-e no roadmap de desenvolvimento 2026

---

## 10. Referências

### Legislação

- **Nota Técnica SE/CGNFS-e nº 005/2025**: NFS-e obrigatória para locações
- **Reforma Tributária**: Novos tributos (IBS/CBS)

### Documentação Relacionada

- [`docs/features/boleto-conformity.md`](./boleto-conformity.md) - Conformidade
  de boletos
- [`docs/internal/company/README.md`](../internal/company/README.md) - Dados da
  empresa

### Recursos Externos

- Portal Nacional de NFS-e (quando disponível)
- Documentação técnica do município (Porto Alegre/RS)
- Comunidades e fóruns sobre NFS-e

---

## 11. Histórico de Versões

| Data       | Versão | Descrição                                          |
| :--------- | :----- | :------------------------------------------------- |
| 2026-01-12 | 1.0.0  | Roadmap inicial baseado em análise de conformidade |

---

## 12. Notas Finais

⚠️ **Importante**: Este roadmap é uma **visão preliminar** baseada nas
informações disponíveis em janeiro de 2026. A implementação real dependerá de:

- Disponibilidade do padrão nacional de NFS-e
- Documentação técnica dos webservices
- Requisitos específicos do município
- Evolução da Reforma Tributária

**Recomendação**: Revisar e atualizar este roadmap periodicamente conforme novas
informações forem disponibilizadas.

---

_Última atualização: 12 de janeiro de 2026_
