# Contratos de locação

> **Status**: Critical **Última atualização**: 2026-10-02, onda 42, sem commit

## 1. Objetivo e escopo

Gerar o contrato da locação, solicitar assinatura de forma durável e
disponibilizar o documento somente ao principal autorizado da locadora.
Pagamento e assinatura são fatos distintos. Esta extração conserva o
comportamento existente, inclusive texto, valores, datas, estados e respostas
HTTP.

Geração, leitura, pedido de assinatura, download e recepção ZapSign estão
montados nos dois hosts. A execução de assinatura, reconciliação e arquivamento
permanece no scheduler legado. Esta implementação não certifica ZapSign ou
Supabase reais nem autoriza trocar a origem dos clientes ou remover a API
legada.

## 2. Entradas e contratos HTTP

As URLs abaixo existem em app/api e apps/services/api/src/app/api.

| Método e URL                                        | Acesso e comportamento preservados                                                                  |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| POST /api/contracts/generate                        | ADMIN/OPERATOR; rentalId e template opcional literal default; retorna 200 com contract              |
| POST /api/admin/rentals/[id]/contract               | ADMIN/OPERATOR; cria ou atualiza DRAFT, template default; retorna 200 com contract                  |
| GET /api/admin/rentals/[id]/contract                | ADMIN/OPERATOR; retorna contract com private, no-store ou 404                                       |
| POST /api/contracts/sign                            | ADMIN/OPERATOR ou CLIENT proprietário; contractId; retorna 202 com contract, queued e requestId     |
| GET /api/contracts/[rentalId]/download              | ADMIN/OPERATOR ou CLIENT proprietário; HTML protegido ou redirecionamento temporário ao PDF privado |
| POST /api/contracts/zapsign-webhook                 | URL obsoleta; resposta fixa 410 sem consultar dados                                                 |
| POST /api/contracts/zapsign-webhook/[integrationId] | Integração autenticada, inbox durável e consumidor vinculado ao tenant e recurso                    |

Sessão, seleção da locadora, recusa de origem cruzada e autorização usam a
composição compartilhada existente. Os schemas movidos para
packages/contracts/src/rental-contracts.ts conservam parsing e extras; a geração
administrativa por id conserva seu contrato sem acrescentar parsing de body. Não
há nova permissão granular para este bloco: a regra observada usa
ADMIN/OPERATOR, e FINANCIAL não recebe esse acesso.

## 3. Fluxo principal

1. A geração obtém locação e itens dentro da transação da locadora, com lock
   consultivo do contrato. Usa ClientProfile daquela locadora e Organization;
   cadastro incompleto responde 409. Cria DRAFT/default ou atualiza apenas o
   rascunho sem tentativa de assinatura.
2. Estado diferente de DRAFT ou qualquer tentativa de assinatura congela a
   geração. O renderer preserva escape de HTML, datas pt-BR, BRL, cláusulas e
   valores originais. Foro e local de assinatura continuam Porto Alegre/RS;
   personalização jurídica por locadora é trabalho separado.
3. O pedido de assinatura confirma ownership, trava e relê o contrato. Exige
   DRAFT com conteúdo e uma única integração ZAPSIGN ACTIVE de organização
   ACTIVE, com credenciais explícitas sandbox ou production.
4. ContractSignatureAttempt e outbox contract.signature.request são gravadas
   atomicamente. Tentativa QUEUED reaproveita requestId; outra tentativa ou
   estado não elegível responde 409. O pedido HTTP não chama ZapSign.
5. O worker legado executa assinatura e reconciliação. O callback autenticado
   resolve o contrato pelo registro de recurso da integração, tenant e
   zapSignId. SIGNED atualiza apenas DRAFT/SENT e enfileira
   contract.signed.archive na mesma transação; a deduplicação conserva uma
   solicitação de arquivo.
6. O worker legado arquiva o PDF no storage privado. O download assinado só usa
   ClientDocument correspondente ao contrato e caminho pertencente ao
   tenant/cliente; não segue uma pdfUrl externa recebida no callback.

## 4. Arquivos e responsabilidades

- packages/backend/src/modules/documents/rental-contracts.ts: geração, leitura,
  ownership, locks e pedido durável; dependências de transação e credenciais
  recebidas pela factory.
- packages/backend/src/modules/documents/contract-rendering.ts: HTML original.
  Cores idênticas centralizadas em packages/design-tokens/src/documents.ts.
- packages/backend/src/modules/documents/zapsign-webhook.ts: consumidor do
  callback sobre transação e lookup do recurso injetados.
- packages/backend/src/modules/documents/private-documents.ts: validação de
  arquivos, paths, metadata e exigência de bucket explicitamente privado.
- packages/backend/src/http/contract-download.ts: resposta de download comum.
- packages/backend/src/runtime/document-storage.ts: SDK Supabase server-side,
  env e cliente lazy; autoRefreshToken e persistSession continuam false.
- apps/services/api/src/host/contracts.ts: composição e adapters HTTP finos.
- lib/contracts/service.ts, lib/security/private-documents.ts,
  lib/security/webhook-consumers/zapsign.ts e lib/supabase-admin.ts: fachadas e
  composição legadas. O renderer antigo sem consumidor produtivo foi retirado;
  todas as rotas legadas continuam presentes.
- packages/backend/src/modules/documents/contract-signature-effects.ts: emissão,
  reconciliação e arquivamento por factory com transação, credenciais, provedor
  e storage injetados (onda 43).
- packages/backend/src/modules/documents/zapsign.ts: adapter HTTP do provedor,
  com a autenticação, referência, timeout e classificação de falhas existentes.
- lib/contract-signature-effects.ts e lib/zapsign.ts: fachadas de composição.
  app/api/cron continua o único executor operacional; nenhum scheduler novo.

## 5. Dados, segurança e erros

Contract, ContractSignatureAttempt, ClientDocument, TenantIntegration, registro
de recurso, inbox e outbox conservam tenantId, FORCE RLS e vínculos compostos.
Os testes de banco continuam exigindo imutabilidade após envio/assinatura e
primeiro arquivo privado, inclusive recusa de exclusão e de vínculos cruzados.

Contrato sem assinatura é enviado como attachment HTML com CSP sandbox,
default-src none, style-src unsafe-inline, nosniff e private, no-store. Nome do
arquivo sanitiza o id. SIGNED sem arquivo privado responde 409; SDK sem URL
responde 502; URL assinada válida gera 303 privado com TTL de 300 segundos.

Webhook mantém autenticação sobre body bruto e integração, limite de 2 MiB,
dedupe da inbox e respostas 400/401/409/413/503 existentes. O schema aceita
somente data válida e pdf_url HTTPS; essa URL não é autoridade de download.
signedBy conserva o primeiro signer ou fallback existente ao nome do usuário.
Política de integração/organização suspensa continua a estabelecida, pendente de
revisão no bloco SaaS; esta onda não a altera.

## 6. Validação

- tests/api-host/rental-contracts.http.test.ts: 53 casos em cada motor real
  (Better Auth e NextAuth), builds locais de produção, SQL/FORCE RLS, CSRF,
  roles, ownership, imutabilidade, dedupe, concorrência e rollback.
- tests/api-host/private-storage.ts: servidor local acionado pelo SDK real;
  confere bucket privado, path, TTL e attachment, sem chamar storage externo.
- tests/security/documents-contracts.test.ts e external-endpoints.test.ts:
  proteções existentes sobre documentos, renderer e endpoints.
- tests/security/route-auth-inventory.test.ts: segue o predicado real nos dois
  hosts; substituições sintéticas por true ou CLIENT devem reprovar.
- tests/identity/contracts-database.test.ts: 10 invariantes de banco
  preservadas.
- tests/unit/outbox-cron-database.test.ts: 6 provas do fluxo/efeitos legados.
- Testes colocados de private-documents, webhook-auth e webhook-inbox: 30 casos
  na onda 42. A onda 43 acrescenta zapsign e contract-signature-effects; junto
  de private-documents são 48 provas de provedor, PDF, idempotência,
  reconciliação, SSRF e conflito de arquivo.

O teardown HTTP remove somente fixtures próprias no banco descartável. Contratos
assinados exigem bypass local de triggers nessa conexão administrativa de
limpeza; nenhum bypass é aplicado às conexões dos hosts ou às provas de
imutabilidade/RLS. Evidências consolidadas, gates e limites na onda 42 de
[API compartilhada](shared-api-host.md), ondas 42 e 43.

## 7. Próximo incremento

A extração dos efeitos, adapter e uploads foi implementada na onda 43.
Reconciliação UNKNOWN continua disponível na factory e fachada, mas ainda não
possui rota/job consumidor: ligar esse fluxo requer seu próprio desenho de
recuperação, não uma repetição automática da emissão. Migrar os demais endpoints
e integrações em blocos próprios. Manter um único scheduler e exigir paridade
operacional e validação do provedor antes do cutover.

## 8. Histórico e documentos relacionados

- 2026-10-02: onda 43 move emissão/reconciliação/arquivo e adapter ZapSign para
  backend, preservando a execução pelo cron legado. Upload e listagem de
  documentos operacionais montados nos dois hosts, sem mudar textos jurídicos,
  estados ou origem dos clientes.
- 2026-10-02: extração incremental da onda 42 e correção desta documentação, que
  ainda descrevia SENT/default-v1, ADMIN exclusivo e assinatura como futura. O
  código já implementava DRAFT/default, ADMIN/OPERATOR e integração durável;
  esta onda move essas regras sem mudá-las.
- [Extração do backend](../architecture/adr-backend-extraction.md).
- [Documentos do cliente](client-documents-antifraud.md).
- [API compartilhada](shared-api-host.md).

## Consumidor de download do histórico — onda 65 (2026-10-03)

HistoricoDetalhePage usa o transporte configurado da entidade locação.
HttpBinaryResponse conserva blob completo, status, ok, url e redirected; a
checagem de escopo ocorre depois de consumir o corpo, impedindo iniciar o
download por uma resposta antiga. Ownership e links privados continuam no
backend único, com os mesmos handlers nos dois hosts.

HTTP local confirmou HTML idêntico ao registro, 404 de outro usuário/locadora e
PDF completo após redirect de storage privado, nos dois motores/hosts. O nome
anterior contrato-[id].html foi mantido mesmo para PDF seguido pelo fetch. Esse
nome e CORS em navegador/aparelho são limitações ainda abertas. Nenhum provedor
externo, scheduler, callback ou origem real foi alterado. Resultados em
[API compartilhada](shared-api-host.md), onda 65.

## Compartilhamento Expo — onda 72 (2026-10-03, sem commit)

Detalhe nativo recebe blob completo do HttpClient/entidade locação. O host usa
File/Paths e expo-sharing ~57.0.22 para arquivo exclusivo em cache e shareAsync;
nenhuma chamada HTTP extra ou URL pública é usada. Escopo é conferido após
disponibilidade/leitura/compartilhamento, e somente o arquivo criado é apagado
no finally. Portas testadas: bytes/MIME/nome, indisponibilidade, ciclo
encerrado, erro e limpeza.

Nome contrato-[id].html anterior continua mesmo com MIME PDF. Testes e bundles
não certificam recebimento em aplicativo externo ou fidelidade em aparelho;
validar comportamento do cache após retorno de shareAsync nos alvos reais.
Backend/assinatura/ownership/storage privado não mudaram. Resultados:
[onda 72](shared-api-host.md).

## Admissão transacional — onda 101 (2026-10-04, sem commit)

Geração de rascunho revalida acesso após lookup da locação e antes da escrita.
Solicitação de assinatura verifica ownership/lock, acesso e módulo
contractSignature antes de registrar tentativa/outbox. A geração local não exige
assinatura premium. Contrato assinado permanece imutável; leitura, webhook e
efeito já aceito continuam pelo fluxo anterior. Os dois hosts conservam
status/DTO e erro antigo, transportando policy comercial com cache privado.
Aceite real de ZapSign/aparelho continua pendente.
[Provas consolidadas e limites](shared-api-host.md), onda 101.
