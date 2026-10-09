# Endereços do cliente por locadora

Status: serviço e contrato migrados; integração visual completa ainda em
andamento.

## Propósito e escopo

Permitir que o usuário mantenha seus endereços dentro da locadora selecionada.
Uma identidade com acesso a duas locadoras tem listas independentes. Não há
cópia automática dos dados globais históricos.

## Entradas

GET/POST /api/addresses e PATCH/DELETE /api/addresses/[id]. A sessão e o vínculo
ativo são resolvidos antes de ler ou alterar endereços. tenantId e userId vêm do
principal, nunca do formulário.

## Fluxo e estados

O primeiro endereço é principal. Marcar outro como principal desmarca os
anteriores do mesmo usuário e locadora. Excluir um endereço secundário preserva
a seleção. Excluir o principal promove o endereço restante mais antigo. As
operações usam a mesma transação e um lock por locadora/usuário; índice parcial
PostgreSQL impede dois principais.

## Componentes e arquivos

- packages/contracts/src/addresses.ts: validações públicas de campos, sem
  modelos Prisma.
- packages/backend/src/modules/customers/addresses.ts: serviço e transações,
  criado por createAddressService(prisma).
- lib/customer-addresses.ts: composição de compatibilidade, sem regras próprias.
- app/api/addresses: adaptação HTTP.
- Migration 013: restrição de endereço principal para registros atribuídos.

A interface existente foi preservada. Esta entrega removeu os logs que expunham
o corpo/endereço e detalhes de erro internos.

## Erros e restrições

Entrada inválida retorna 400; ausência de sessão/vínculo usa a política comum de
identidade. ID de outro usuário ou locadora retorna 404. Campos extras não
alteram ownership. Registros legados com tenantId nulo permanecem em quarentena.

Desde a onda 4 (commit `4b02f52f`), POST de `addresses` e PATCH/DELETE de
`addresses/[id]` chamam `rejectCrossOriginMutation` logo depois da guarda: com
borda de host validada, uma mutação vinda de outra origem (por exemplo, outra
locadora `{slug}.<raiz>`) responde 403 `no-store` sem efeito (entrada 190 de
`docs/issues/known-issues.md`;
`tests/security/same-origin-mutation.integration.test.ts`). Desde a onda 5 o
guard também roda dentro de `resolveTenantPrincipal` e, sem borda, compara com
`WEB_PUBLIC_ORIGIN` ou com a própria origem; requisição sem `Origin` e sem
`Sec-Fetch-Site` (app nativo) segue como antes (entrada 196).

## Validação

tests/unit/addresses-database.test.ts usa PostgreSQL descartável e cobre criação
concorrente, isolamento com a mesma identidade em duas locadoras, FK/índice,
ownership, promoção do principal e validação sem relações Prisma. A validação
visual e de dispositivo segue pendente.

## Extração do backend

O serviço agora é consumido por `@gb-locacoes/backend/customers`, sem imports da
raiz ou do Next. Os handlers e o contrato HTTP permanecem iguais. O piloto
passou 4 testes PostgreSQL e 13 testes HTTP, incluindo mass assignment,
propagação de acesso negado, ownership, 404 e erros sanitizados. O plano de
transferência do runtime está em
[ADR de extração do backend](../architecture/adr-backend-extraction.md). Nenhuma
rota foi instalada no host destino neste piloto.

### Leitura instalada no serviço HTTP (2026-10-01, sem commit)

O corte 13 instala apenas `GET /api/addresses` em `apps/services/api`, usando o
principal privado compartilhado e `createAddressService` já existente.
`src/host/customers.ts` injeta o runtime de banco; o handler só adapta HTTP. Não
há uma segunda regra de ownership. A consulta continua filtrando `tenantId`
**e** `userId` do principal, inclusive para ADMIN, FINANCIAL e OPERATOR. RLS
restringe a locadora; o predicado da aplicação restringe o usuário.

Envelope `{ addresses: [...] }`, DTO completo observado, ordenação por
`isPrimary DESC, createdAt DESC`, lista vazia, resposta da guarda e mensagem
`Erro ao buscar endereços` em falha de armazenamento foram preservados. Uma
falha do resolvedor de principal continua fora do catch de negócio. Naquele
corte, POST/PATCH/DELETE permaneciam exclusivamente no legado; não houve mudança
da origem dos clientes, cache explícito, cookies, proxy, schema ou scheduler.

Caracterizações e testes de produção local com os dois modos de autenticação
estão no [registro do corte 13](shared-api-host.md). A paridade HTTP não prova
entrega de cookies por navegador, aplicativo mobile ou produção.

### Escritas instaladas no serviço HTTP (2026-10-02, sem commit)

O corte 23 acrescenta POST /api/addresses e PATCH/DELETE /api/addresses/[id]. O
host injeta getDatabaseRuntime().prisma em createAddressService; DTOs e
validações vêm de contracts/addresses. O serviço backend e os handlers legados
não foram alterados. Lock por locadora/usuário, RLS, ownership, índice de
principal, promoção na exclusão, guard central/explicitado e mensagens originais
são reutilizados, sem queries de negócio no host.

Preserva-se também o comportamento observado: primeiro endereço sempre
principal, PATCH vazio aceito, isPrimary=false não promove outro
automaticamente, DELETE repetido 404 e corpo do DELETE ignorado. São contratos
caracterizados, não novas decisões de produto. Campos extras de
ownership/relações são removidos; validação inválida devolve os mesmos detalhes
400 antes da transação.

Caracterização anterior: 96 casos nos handlers legados (109 com o piloto).
Depois: 192 casos nos dois adapters, 233 com as leituras/piloto. HTTP em
produção local: 998 casos em cada modo de autenticação, incluindo 123 casos
novos de escrita com cookies reais e banco descartável sem bypass/ownership.
Comparação inclui estado persistido, principal e secundários, outros usuários,
locadoras e registros sem tenant. Criação concorrente através dos dois hosts,
falha de privilégios e trigger após desmarcar o principal comprovam
lock/rollback. SQL direto comprova RLS de INSERT/UPDATE/DELETE e o índice
parcial impede dois principais.

O setup reutiliza cookies emitidos pelo motor real apenas quando GET da sessão
ainda confirma o usuário. Revogação invalida o cache e exige login novo; a
caracterização do orçamento de login força emissão nova. O limitador não mudou.
O cache só existe no diretório temporário da rodada e é apagado no cleanup.
Somente o role descartável recebe INSERT/UPDATE/DELETE de addresses; privilégios
e configuração de produção permanecem intactos.

Legado ativo/configurado, clientes sem cutover e validação visual/mobile ainda
pendente. Estado completo e gates: [registro do corte 23](shared-api-host.md).

## Consumidor do orçamento conectado (onda 62)

Leitura e salvamento pelo HttpClient configurado conservam GET/POST, DTO e o
envelope {address}. Perfil e endereço podem ser salvos em paralelo; os
resultados individuais são preservados. Uma falha mantém o dialog e impede envio
automático. Troca de escopo invalida a resposta e a sequência de escrita;
confirmações locais levam locadora/usuário. Contrato/backend não mudaram. Provas
de formulário e HTTP real nos dois motores/hosts na
[onda 62](shared-api-host.md); interface completa de endereços, aparelhos e
aceite visual continuam pendentes.

## Tela de endereços conectada (onda 63, 2026-10-03)

EnderecosPage usa a API universal da entidade cliente, compartilhada com perfil
e orçamento. Conserva envelopes, métodos, CEP e corpos de criação/edição,
principal e exclusão, incluindo releitura após sucesso e rascunho após falha.
Formulário/lista/edição reiniciam por locadora e usuário; cliente de um ciclo
encerrado não aplica respostas nem inicia sua próxima releitura.

Provas renderizadas executam CRUD/principal, cancelar, falha/retry, CEP somente
com oito dígitos e troca de escopo. ViaCEP é simulado na fixture. Transporte
real com cookies/RLS em ambos os hosts/motores comprova persistência,
normalização e recusas de acesso a outro usuário/locadora. Sem alteração do
serviço, schema, lock, agenda ou configuração real. Tela nativa e aceite
visual/aparelhos permanecem pendentes. Resultados/limites:
[onda 63](shared-api-host.md).

## Endereços Expo compartilhados (onda 75, 2026-10-03)

A rota /area-cliente/enderecos usa a variante nativa e use-addresses.ts comum ao
web. Carga, criação, edição, principal, exclusão, DTO e releitura são únicos. O
botão de envio exige os mesmos seis campos required do formulário web;
complemento continua opcional. As regras de principal/ownership ficam no backend
existente, sem validação duplicada no host.

CEP somente dispara busca completa com oito dígitos. Revisão por
pedido/formulário descarta resposta após outro CEP, cancelar, editar ou
desmontar; não repõe endereço antigo no novo formulário. Rascunho persiste após
recusa HTTP. Scope da página inclui locadora, usuário e transporte. Testes
web/native e bundles aprovados; ViaCEP simulado, teclado/visual e aparelho não
certificados. [Provas da onda 75](shared-api-host.md).
