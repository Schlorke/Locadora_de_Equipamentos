# RESUMO DA REUNIAO - Tarefas de Desenvolvimento

**Data:** 11/02/2026 **Cliente:** Locacoes GB (locacoesgb.com.br)
**Participantes:** Desenvolvedor (voce), Francisco (operacional), Gustavo, pai
do Francisco **Sistema:** Plataforma web de gestao de locacao de equipamentos
(balancas, andaimes, rompedores, etc.) **Contexto:** Empresa com ~125
equipamentos, operando desde 2021, migrando de controle via Excel para o sistema
web

---

## TAREFAS PRIORITARIAS (Prazo: ~1 semana)

### 1. PAINEL FINANCEIRO (NOVA PAGINA)

Criar uma pagina financeira dedicada e separada do painel principal.

**Campos necessarios:**

- Nome do cliente (com pesquisa)
- Codigo do orcamento (com pesquisa)
- Valor bruto
- Valor liquido (descontando impostos)
- Numero da nota fiscal
- Data de emissao do boleto
- Data de emissao da nota fiscal
- Data de pagamento
- Status: `Pago` | `Nao Pago` | `Aguardando Pagamento` | `Baixado`
- CNI/CNPJ da empresa (se tiver CNPJ, desconta menos imposto)

**Funcionalidades:**

- Pesquisa por nome do cliente OU codigo do pedido (mesmo campo de busca)
- Botao para baixar relatorio em formato oficio (PDF) com tudo discriminado
- Visualizacao por tabela e calendario
- Filtros por status de pagamento

### 2. REAJUSTE DE ORCAMENTO

Adicionar opcoes de reajuste no orcamento com categorias:

**Categorias de custo adicional a implementar:**

- Mao de obra
- Deslocamento (ida e volta)
- Manutencao
- Outros (aguardar lista do Gustavo)

**Fluxo:**

- Clicar em "Reajuste" no orcamento
- Selecionar tipo de custo adicional
- Informar valor e justificativa
- Reajuste enviado automaticamente ao cliente (por e-mail e WhatsApp)
- Formato de documento/oficio para download

### 3. SISTEMA DE PERMISSOES DE USUARIO

Implementar controle de acesso por perfil.

**Perfis necessarios:**

- **Administrador:** acesso total ao sistema
- **Financeiro (Adriana/Secretaria):** acesso SOMENTE ao painel financeiro
  (boletos, cobrancas, relatorios). NAO pode mexer em equipamentos, orcamentos,
  etc.
- **Cliente:** acesso apenas a area do cliente (orcamentos dele, status)

**Importante:** A secretaria (Adriana) ja estragou planilhas/relatorios mexendo
em coisas fora do escopo dela. As permissoes sao CRITICAS para evitar isso.

### 4. CAMPO DE PESQUISA - ID DO ORCAMENTO

- O campo de pesquisa de orcamentos atualmente usa o ID do equipamento
- **Corrigir para usar o ID do orcamento**
- Permitir busca por nome do cliente OU codigo do orcamento no mesmo campo

### 5. AREA DO CLIENTE - ARMAZENAMENTO DE DOCUMENTOS

Criar um "banco de dados" separado na area do cliente para:

**Dados a armazenar:**

- Foto do documento de identidade (tirada na entrega do equipamento)
- Foto/selfie do cliente
- Contrato assinado
- CPF ou CNPJ

**Fluxo na entrega:**

- Entregador leva contrato impresso
- Cliente assina o contrato na hora
- Entregador tira foto do documento do cliente pelo celular da empresa
- Foto vai direto para o sistema, salva na area do cliente

### 6. BOLETO - AJUSTES

**Problemas identificados:**

- Boleto pode expirar quando a obra atrasa (cliente paga depois da locacao, nao
  no inicio)
- Precisa permitir regerar boleto vencido facilmente
- **BUG:** Se clicar varias vezes no botao de gerar boleto, pode gerar 3-4
  boletos duplicados. Implementar protecao contra cliques multiplos
- Boleto emite mas NAO autentica o fechamento de contrato ainda (necessita
  documento do cliente)
- Configurar integracao com servico terceiro de boletos (taxa de R$2-3 por
  boleto)

### 7. TOOLTIPS/LEGENDA DE STATUS

- Adicionar icone com caixa explicativa (tooltip) em cada status
- Explicar o significado de: Pendente, Aprovado, Rejeitado, Concluido,
  Cancelado, Atrasado

---

## TAREFAS SECUNDARIAS (apos a primeira semana)

### 8. INTEGRACAO WHATSAPP + IA

**Objetivo:** Automatizar atendimento ao cliente via WhatsApp com inteligencia
artificial

**Fluxo desejado:**

1. Cliente envia mensagem no WhatsApp
2. IA pede CPF/CNPJ
3. IA consulta Serasa (se integrado) para verificar pendencias
4. IA consulta banco de dados para ver equipamentos disponiveis
5. IA gera orcamento automaticamente
6. Tudo pelo WhatsApp, sem precisar atender telefone

**Status:** Ainda nao implementado. Valor cobrado: R$200 pela ferramenta de IA.

### 9. NOTIFICACOES - CONFIGURACOES

- Implementar opcao de silenciar notificacoes por usuario
- Cada usuario pode escolher quais notificacoes quer receber
- Notificacoes ja funcionam para: orcamento reajustado, aprovado, recebido,
  locacoes, WhatsApp, e-mail

### 10. MIGRAR DADOS DO EXCEL

- Cliente tem dados desde 2021 em planilhas Excel
- Precisa importar historico de: clientes, equipamentos, orcamentos, notas
  fiscais
- Pedir acesso as planilhas para entender a estrutura atual
- Cada construtora tem um engenheiro responsavel
- Controle de presenca de pessoal por obra (checklist por dia do mes)

### 11. LOGISTICA

- Ainda nao implementada
- Precisa entender melhor o fluxo operacional antes de desenvolver
- Aprender com o Francisco como funciona na pratica

### 12. TRAFEGO PAGO / GOOGLE ADS

- Site ja foi aprovado pelo Google para campanhas
- Configurar Google Ads quando o sistema estiver estavel
- Atencao: se lancar campanha sem o sistema pronto, nao vao dar conta da demanda

---

## FLUXO DE STATUS DOS ORCAMENTOS (ja implementado)

```
Pendente --> Aprovado (pagamento confirmado) --> Em Locacao (ativo) --> Concluido
    |                                                                      |
    +--> Rejeitado                                              Cancelado --+
```

- Quando aprovado: equipamento fica INDISPONIVEL no site automaticamente
- Visualizacoes: Tabela | Calendario | Kanban
- Locacoes: Pendente | Ativo | Concluido | Cancelado | Atrasado

---

## REGRAS DE NEGOCIO IMPORTANTES

1. **Pagamento pode ser no FINAL da locacao** (nao necessariamente no inicio) -
   obras atrasam, equipamento fica mais tempo
2. **Equipamento em manutencao:** nao excluir, apenas marcar como "em
   manutencao" (fica indisponivel para locacao)
3. **Dar baixa no equipamento:** quando sai para locacao, atualizar contagem
   (ex: 125 balancas -> 124 disponiveis)
4. **Reajuste de contrato:** quando cliente estoura valor do contrato, precisa
   gerar aditivo com novo boleto
5. **Nota fiscal:** ja e enviada por e-mail automaticamente apos contratacao.
   Impressao fisica NAO configurada ainda
6. **Anexos:** sistema ja permite anexar qualquer arquivo (relatorio, foto) e
   enviar por e-mail ao cliente
7. **Problema de fraude:** ja tiveram calote (equipamento roubado, policia
   envolvida). Solucao: foto de documento + contrato assinado na entrega

---

## CONTATOS E ACESSOS

- **Francisco Pernier:** acesso de administrador configurado (conta Google)
- **Gustavo:** vai enviar tabela de custos para reajuste de orcamento
- **Adriana (Secretaria/TGD):** precisa de acesso restrito ao financeiro
- **Site:** locacoesgb.com.br
- Login via Google

---

## PENDENCIAS DO CLIENTE (cobrar)

- [ ] Gustavo enviar tabela de custos (mao de obra, deslocamento, manutencao)
- [ ] Francisco testar o painel admin no celular e dar feedback (prints do que
      quer ajustar)
- [ ] Enviar planilhas Excel para migrar dados historicos
- [ ] Definir como vai funcionar a verificacao anti-fraude (facial? documento?
      Serasa?)
- [ ] Documento necessario para autenticar fechamento de contrato no boleto
- [ ] Valor da propaganda/orcamento a ser enviado discriminado
