# Perfil comercial do cliente por locadora

> **Status**: Critical  
> **Last updated**: 2026-10-02

## 1. Purpose

Consultar e atualizar o cadastro comercial do usuário na locadora selecionada. A
conta de autenticação é global; o perfil comercial pertence à locadora e não é
substituído pelos dados globais de `User`.

## 2. Scope

- Leitura existente em `GET /api/user/profile`, no legado e no host
  compartilhado parcial.
- Atualização em `PUT /api/user/profile`, no legado e no host compartilhado
  parcial, usando o mesmo serviço de customers.
- Sem criação implícita, normalização nova, mudança de contrato ou troca da
  origem usada pelos clientes neste corte.

## 3. Entry Points

- Tela: `packages/frontend/src/pages/perfil/ui/PerfilPage.web.tsx`.
- Orçamento: `packages/frontend/src/pages/orcamento/ui/OrcamentoPage.web.tsx`.
- API legada: `app/api/user/profile/route.ts`.
- API compartilhada: `apps/services/api/src/app/api/user/profile/route.ts`.

## 4. Core Flow

1. O principal revalida sessão, seleção de locadora, organização e membership.
2. O serviço de clientes entra em `withTenantTransaction`, com contexto local de
   RLS, e consulta `ClientProfile` pela chave `(tenantId, userId)`.
3. GET devolve `{ user }` e `Cache-Control: no-store`. O DTO contém somente
   `id`, `name`, `email`, `phone`, `cpf`, `cnpj` e `company`; `id` é o `userId`.
4. Sem perfil na locadora, responde 404. Não cria cadastro nem usa um perfil de
   outra locadora ou usuário.
5. PUT valida a mesma origem e o schema estrito compartilhado; normalização e
   UPDATE pela chave `(tenantId, userId)` continuam no backend, sob RLS. Retorna
   `{ success: true, user }`, com `Cache-Control: no-store`.

## 5. Components and Files

- `packages/backend/src/modules/customers/profile.ts`: implementação única de
  leitura, DTO e atualização do perfil.
- `packages/backend/src/modules/customers/errors.ts`: erros do módulo.
- `packages/contracts/src/customer-profile.ts`: schema de entrada extraído do
  adapter legado, sem mudanças de validação; importado pelos dois hosts.
- `packages/backend/src/modules/identity/tenant-principal.ts`: contexto RLS.
- `apps/services/api/src/host/customers.ts`: composição do serviço com o banco
  do processo, sem consulta ou regra de negócio duplicada.
- `tests/unit/customer-profile-read-api.test.ts`: caracterização dos adapters.
- `tests/unit/customer-profile-update-api.test.ts`: caracterização antes da
  extração e mesma matriz de atualização nos dois adapters.
- `tests/api-host/profiles.http.test.ts`: paridade HTTP com banco e sessão
  reais.
- `tests/api-host/profile-update.http.test.ts`: efeitos, recusa sem escrita,
  rollback, conflito concorrente de documento e RLS de atualização.
- `tests/api-host/identity.ts`: login real compartilhado entre suites de
  paridade, preservando as asserções sobre cookies.

## 6. Data and State

`client_profiles` está sob RLS FORCE. `User`, `Membership`, `Organization` e
sessão fornecem identidade/acesso; seus dados não entram como fallback no DTO.
Email, telefone, empresa e documento nulos continuam nulos. O papel global ADMIN
não substitui membership. CLIENT, ADMIN, FINANCIAL e OPERATOR podem consultar
somente seu próprio perfil na locadora com vínculo ativo.

## 7. Constraints and Edge Cases

- Query de `userId`, `tenantId`, papel, documento ou projeção não altera o
  principal nem a consulta.
- Seleção por cookie/header/host segue o contrato de identidade, incluindo
  conflitos, preferência e 404 neutro do host desconhecido/inativo.
- **Dívida preservada de leitura**: o DTO classifica o documento pelo
  comprimento do texto armazenado, sem remover formatação. Comprimento 11 vai
  para `cpf`, 14 para `cnpj`, demais para nenhum dos dois. Um CPF formatado com
  14 caracteres aparece em `cnpj`; texto alfanumérico com 14 também. Corrigir
  isso exige um corte próprio com compatibilidade e dados caracterizados.
- PUT em ambos os hosts mantém schema estrito de `phone`, `cpf`, `cnpj`,
  `company`, validação numérica existente, guard de mesma origem e erro de
  unicidade. Não aceita mudar nome/email ou identidade por esse contrato.
- Os limites do corpo são 30 caracteres para phone, 20 para cpf/cnpj e 200 para
  company, antes da normalização. Chaves extras, nulls e tipos diferentes de
  string são recusados; campos omitidos permanecem intactos.
- O backend remove caracteres não numéricos de telefone/documento e espaços
  externos de company. Telefone/empresa vazios viram null; documento vazio ou
  sem dígitos não apaga o documento existente. CPF exige 11 dígitos e CNPJ 14;
  ambos não vazios são recusados. Suporte a documento alfanumérico e mudança
  dessas regras ficam fora da extração de transporte.
- Um corpo que não fornece campos graváveis, como `{}` ou somente documentos
  vazios/sem dígitos, preserva o `updatedAt`, como no legado.
- A unicidade de documento é por locadora. Conflito desfaz toda a atualização,
  incluindo telefone e empresa; a mesma identificação em outra locadora não
  conflita. O cadastro global de autenticação permanece intacto.
- O serviço monta GET/PUT e HEAD/OPTIONS implícitos. POST/PATCH/DELETE continuam
  405, sem encaminhamento ao legado.

## 8. Error Handling

- Recusas do principal são devolvidas imediatamente, antes da consulta.
- `CustomerError` mantém mensagem e status 400/403/404.
- Perfil ausente: 404 `{ error: 'Perfil da locadora não encontrado' }`.
- Falha inesperada de sessão/transação/consulta: 500
  `{ error: 'Erro ao buscar perfil' }`, sem detalhe de banco.
- PUT conserva o 409 de documento duplicado e o erro genérico de atualização.
- PUT com JSON ilegível conserva 500; null ou schema inválido é 400. Nenhuma
  dessas recusas modifica o perfil. Falhas reais de UPDATE e de trigger também
  retornam o erro genérico e preservam os registros anteriores.

## 9. Performance and Accessibility

Uma consulta por chave composta, sem join ao cadastro global ou escrita na
leitura. Respostas privadas não são armazenadas em cache. Este incremento não
modifica a interface ou acessibilidade; dispositivo mobile não foi validado.

## 10. Tests and Validation

Antes de instalar o adapter, caracterizar o GET legado com
`tests/unit/customer-profile-read-api.test.ts` e `customers-http.test.ts`.
Depois, repetir os mesmos casos nos dois adapters e executar `pnpm test:api` com
`API_HOST_MODE=production`, `API_LEGACY_MODE=production`, primeiro
`API_AUTH_MODE=legacy`, depois `better-auth`.

Banco somente local descartável, com `TEST_DATABASE_DISPOSABLE=true`. A suite
usa cookies emitidos pelo login HTTP legado e papel de runtime sem
bypass/ownership. Verifica DTO, mudanças após login, revogação, falta de perfil,
falha real de SELECT, isolamento SQL RLS e preservação de PUT no legado. O corte
25 acrescenta a matriz de PUT nos dois adapters e hosts: quatro papéis de
vínculo, transportes de seleção, CSRF, schema estrito, limites, normalização,
falta de perfil, unicidade por locadora, duas identidades, concorrência entre
hosts, rollback por trigger e falha de permissão SQL. `global-setup.ts` concede
SELECT/UPDATE de client_profiles somente ao papel descartável da suite, sem
ownership ou bypass; nenhum grant de produção muda. Resultados do corte:
[API compartilhada](shared-api-host.md).

## 11. Related Docs

- [Extração do backend](../architecture/adr-backend-extraction.md).
- [API compartilhada](shared-api-host.md).
- [Seleção de locadora](organization-selection.md).
- [Resolução de tenant](tenant-request-resolution.md).
- [Cadastro do cliente na locadora](tenant-client-enrollment.md).
- [Endereços do cliente](customer-addresses.md).

## 12. Change Log

- 2026-10-02: GET montado no serviço parcial, mantendo o serviço de clientes e o
  GET/PUT legado. Caracterização documenta a classificação histórica do
  documento, sem mudar seu comportamento. Alterações locais, sem commit.
- 2026-10-02: PUT montado no serviço parcial. Schema legado movido para
  contracts e consumido pelos dois adapters; normalização, DTO, transação e
  UPDATE continuam na implementação existente de customers. Clientes e endpoint
  legado ativos.

## Consumidor do orçamento conectado (onda 62)

O orçamento consulta/atualiza o perfil pelo HttpClient configurado, conservando
GET/PUT e o DTO. O bootstrap captura o ID da seleção em cada cliente, e o hook
da página cancela/descarta resultados anteriores. Trocar usuário/locadora
remonta o formulário; dados preenchidos e confirmação não atravessam esse par.
Falha do PUT conserva o formulário e impede o envio automático do pedido; há
nova tentativa ou escolha explícita de não salvar. O perfil de outra locadora
foi preservado no HTTP real de ambos os hosts/motores. A página de perfil
completa continua como próximo consumidor a migrar. Ver
[onda 62](shared-api-host.md).

## Tela de perfil conectada (onda 63, 2026-10-03)

PerfilPage usa createCustomerApi de entities/cliente, também consumida pelo
orçamento. Ciclo genérico em shared/api descarta respostas de clientes/escopos
encerrados; a página reinicia formulário/edição por locadora e usuário. PUT
conserva phone/cpf/cnpj/company formatados e somente não vazios; nome/email não
são gravados por esse endpoint. Releitura após sucesso e cancelar mantêm o fluxo
anterior. Falha do PUT mantém edição para nova tentativa; resposta antiga não
mostra sucesso nem inicia releitura na nova tela.

Provas renderizadas cobrem formatação, corpo parcial, restaurar, falha/retry e
leitura/escrita durante troca de usuário/locadora. HTTP real nos dois hosts e
motores comprovou a normalização e a preservação do perfil de outra empresa e do
registro global do usuário. Contratos do backend e legado intactos. Os status de
verificação e o botão de senha continuam placeholders; tela nativa e aceite
visual/dispositivos pendentes. Resultados: [onda 63](shared-api-host.md).

## Perfil Expo compartilhado (onda 75, 2026-10-03)

A rota nativa /area-cliente/perfil monta a slice perfil. use-profile.ts contém
as mesmas máscaras, carga, PUT parcial, releitura e cancelamento do web. Chave
inclui locadora, usuário e revisão do transporte; respostas encerradas não
preenchem a nova tela nem geram sucesso. A apresentação usa Input/Button/Card/
Badge nativos reais e tokens canônicos.

GET/PUT, ownership e ClientProfile não mudaram. Nome/email não são gravados.
Verificação de conta continua pendente; senha/aparelhos ainda não implementados
e seus controles nativos ficam desabilitados. Não certificar esse bloco por
existência dos controles. Renderização/modelo, tipos, gates e exports locais
aprovados; aceite visual/teclado em aparelhos pendente.
[Provas e limitações da onda 75](shared-api-host.md).
