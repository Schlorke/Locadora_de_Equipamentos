# Registro de Perdas de Peças

> **⚠️ CRÍTICO**: Sistema para registrar perdas de peças dos equipamentos.
> Essencial para controle de equipamentos e gerenciamento do negócio.

## 1. Propósito

O sistema permite que administradores registrem perdas de peças dos
equipamentos, mantendo um histórico completo. Essas informações são relevantes
para cobrar taxas de avarias e fazer correções no orçamento final.

## 2. Lógica de Funcionamento

### 2.1. Fluxo de Registro

1. **Admin acessa** `/admin/equipamentos/[id]/editar`
2. **Admin visualiza seção** "Registro de Perdas de Peças"
3. **Admin adiciona registro**:
   - Data da perda
   - Descrição da perda
   - Quantidade perdida
4. **Sistema atualiza**:
   - `partsLossHistory`: Array com histórico completo
   - `partsLossCount`: Contador total de perdas
5. **Sistema exibe**:
   - Contador total de perdas
   - Histórico completo com data, descrição e quantidade

### 2.2. Regras de Negócio

- **Apenas para admins**: Informação relevante apenas para administradores
- **Histórico completo**: Mantém todas as perdas registradas
- **Contador automático**: Soma todas as quantidades automaticamente
- **Integração com ajuste de valor**: Usado para justificar ajustes no orçamento
  final
- **Visibilidade separada**: Fotos de avaria ficam apenas em
  `partsLossHistory[].images` (uso interno) e nunca devem ir para o array
  público `images` do equipamento

### 2.3. Casos de Uso

1. **Cobrança de Taxas**: Usado para justificar taxas de avaria no orçamento
2. **Controle de Equipamentos**: Ajuda a rastrear estado dos equipamentos
3. **Decisões de Manutenção**: Informa quando equipamento precisa de manutenção
4. **Análise de Custos**: Ajuda a calcular custos reais de locação

## 3. Arquitetura e Dependências

### 3.1. Schema Prisma

```prisma
model Equipment {
  partsLossHistory       Json?          // Histórico de perdas
  partsLossCount         Int?            // Contador total
}
```

**Estrutura do Histórico**:

```typescript
Array<{
  date: string // ISO date string
  description: string // Descrição da perda
  quantity: number // Quantidade perdida
  images?: string[] // URLs internas para admins (não exibidas publicamente)
}>
```

### 3.2. API Endpoints

- **PUT `/api/admin/equipments/[id]`**: Atualiza equipamento com histórico de
  perdas
  - Campos de perdas no body:
    `{ partsLossHistory: Array, partsLossCount: number }`, junto dos campos
    obrigatórios da edição (`name`, `pricePerDay`, `categoryId`). A rota
    `apps/services/api/src/app/api/admin/equipments/[id]/route.ts` exige
    permissão `EQUIPMENTS/WRITE`; `host/catalog.ts` compõe a atualização de
    `packages/backend/src/modules/catalog/equipments.ts` dentro da transação da
    locadora, sem usar `User.role` global para autorizar.

### 3.3. Componentes Frontend

- **`apps/clients/web/src/app/(admin)/admin/equipamentos/[id]/editar/page.tsx`**:
  host fino que consome `EditarEquipamentoPage` da entrada pública
  `@gb-locacoes/frontend/pages/equipamentos-admin`. A seção de perdas pertence a
  `packages/frontend/src/pages/equipamentos-admin/ui/Editar.web.tsx`.
- **`packages/frontend/src/pages/equipamentos-admin/ui/VerEquipamento.web.tsx`**:
  Visualização de perdas

## 4. Como Usar

### 4.1. Admin - Registrar Perda

1. Acesse `/admin/equipamentos`
2. Clique em equipamento e depois "Editar"
3. Role até seção "Registro de Perdas de Peças"
4. Preencha:
   - Data da perda
   - Descrição
   - Quantidade
5. Clique em "Adicionar Registro de Perda"
6. Salve o equipamento

### 4.2. Admin - Visualizar Perdas

1. Acesse `/admin/equipamentos`
2. Clique em equipamento para ver detalhes
3. Veja:
   - Contador total de perdas
   - Histórico completo

## 5. Armadilhas a Evitar

- ❌ **NUNCA** permita registro sem data, descrição ou quantidade
- ❌ **NUNCA** perca histórico ao editar equipamento
- ❌ **NUNCA** permita contador negativo
- ❌ **NUNCA** exiba perdas para clientes
- ❌ **NUNCA** adicione fotos de avaria ao array público `images`; mantenha-as
  somente em `partsLossHistory[].images`

## 6. Lições Aprendidas

- Histórico completo é essencial para rastreabilidade
- Contador automático evita erros manuais
- Integração com ajuste de valor facilita cobrança

## 7. Histórico de Alterações

| Data       | Descrição                                          | Autor   |
| ---------- | -------------------------------------------------- | ------- |
| 2025-12-17 | Isoladas fotos de avaria no histórico (admin-only) | Codex   |
| 2025-01-XX | Implementação inicial                              | Sistema |

## Paridade Expo e persistência (onda 77, 2026-10-03, sem commit)

O formulário Expo usa use-edit-equipment comum ao web: histórico/contador e
fotos da perda seguem no PUT completo por id. Snapshot explícito evita depender
da execução imediata de setters; falha restaura histórico e contador.
Cadastrar/editar/remover conserva mensagens e cálculo existentes. Calendário
recusa futuro; remover exige confirmação.

Fotos selecionadas após cancelar o rascunho ou trocar locadora/usuário/registro/
transporte são descartadas. Elas ficam só em partsLossHistory[].images, nunca em
images. Prova de separação do DTO não certifica proteção de URLs de storage.
Testes nativos exercitam falha/retry, contador, fotos e cancelamento; aparelhos
e fidelidade visual ainda não certificados. Ver [onda 77](shared-api-host.md).
