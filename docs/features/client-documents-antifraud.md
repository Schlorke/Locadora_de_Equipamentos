# Documentos do cliente — antifraude

Status: crítico. Ponteiros pós-F revistos em 2026-10-09; evidências da extração
de 2026-10-02 preservadas nas seções correspondentes.

## 1. Objetivo e escopo

Registrar evidências de identidade e contrato da locadora, com armazenamento
privado e exigência de documentação mínima no fluxo operacional existente. Tipos
obrigatórios: ID_DOCUMENT, SELFIE, SIGNED_CONTRACT e CPF_CNPJ_PROOF. OCR,
biometria e consulta automática a bureaus não fazem parte deste módulo.

O envio manual de SIGNED_CONTRACT produz ClientDocument. Ele não cria Contract,
não altera seu status, não autentica um callback e não substitui a assinatura
durável ZapSign descrita em [Contratos](contracts.md).

## 2. Entradas e autorização

| Método e caminho                              | Regra existente                                                              |
| --------------------------------------------- | ---------------------------------------------------------------------------- |
| POST /api/admin/rentals/[id]/client-documents | ADMIN ou OPERATOR do vínculo da locadora selecionada                         |
| GET /api/admin/clients/[id]/documents         | ADMIN/OPERATOR, ou CLIENT somente quando o id corresponde ao próprio usuário |

Os handlers atuais ficam em `apps/services/api/src/app/api` e usam
`host/private-identity.ts` antes de conferir o papel/ownership. Os mesmos
caminhos foram caracterizados no legado e no serviço na onda 43; o adapter da
raiz foi aposentado no checkout pós-F. FINANCIAL não recebe esses acessos. O
principal real, a seleção por host/header/ cookie e a recusa de mutação de
origem irmã continuam nos adapters de identidade; sem seleção válida não se
escolhe uma locadora automaticamente.

A tela operacional permanece em packages/frontend/src/pages/locacoes, consumida
pelos hosts finos. A onda não altera tela, origem de API ou scheduler.

## 3. Fluxo e contratos

1. Autorizar o vínculo; Content-Length acima de 11 MiB retorna 413 antes da
   consulta da locação. Dentro do limite, verificar id e tenantId antes de ler o
   multipart. Referência de outra locadora retorna 404 sem parsing do arquivo.
2. Receber file, type e captureMetadata opcional. O enum dos quatro tipos,
   parsing e mensagens permanecem os existentes.
3. Validar tamanho, MIME e conteúdo; produzir SHA-256 dos bytes aceitos.
4. Exigir bucket explicitamente privado. Criar path aleatório sob
   tenants/{tenantId}/clients/{userId}, com upsert false e cacheControl zero.
5. Criar ClientDocument em transação de locadora com rentalId, autor, nome
   sanitizado, MIME, tamanho, hash e metadata. Se o banco falhar depois do
   upload, solicitar remoção do objeto e propagar o erro existente.
6. Responder 200 com document e signedUrl, sem filePath, com private, no-store.
   Falha de assinatura da URL conserva o registro e signedUrl null.

GET responde documents em ordem decrescente de createdAt, somente do usuário e
locadora consultados. Não expõe filePath. Só assina chaves do prefixo próprio;
uma chave estrangeira em registro local recebe signedUrl null. Cliente sem
ClientProfile na locadora retorna 404.

## 4. Responsabilidades e arquivos

- packages/backend/src/http/client-document-upload.ts: factory do fluxo HTTP de
  upload, com transação e storage injetados; uma implementação para os hosts.
- packages/backend/src/modules/documents/private-documents.ts: validação de
  arquivo/metadata/path e exigência de bucket privado.
- packages/backend/src/modules/customers/client-documents.ts: listagem,
  ownership e cálculo de documentos faltantes, já compartilhados.
- packages/contracts/src/client-documents.ts: enum puro existente, sem banco ou
  regra de negócio.
- apps/services/api/src/host/client-documents.ts e document-storage.ts:
  composição server-side, SDK lazy compartilhado com contratos.
- apps/services/api/src/app/api/admin/rentals/[id]/client-documents/route.ts:
  POST autoriza ADMIN/OPERATOR e delega upload; Zod/InvalidDocumentError viram
  400 e erros não classificados conservam 500.
- apps/services/api/src/app/api/admin/clients/[id]/documents/route.ts: GET
  autoriza ADMIN/OPERATOR ou CLIENT proprietário, traduz CustomerError e
  conserva private, no-store.
- No registro da onda 43, lib/client-documents.ts, lib/client-document-upload.ts
  e lib/security/private-documents.ts eram as fachadas legadas. Foram
  aposentadas no checkout pós-F; seus owners atuais são os módulos/backend e a
  composição API acima, sem SDK no cliente.

## 5. Dados, limites e invariantes

ClientDocument conserva tenantId, userId, rentalId opcional, type, filePath,
fileName, mimeType, fileSize, fileHash, captureMetadata, uploadedBy e createdAt.
FORCE RLS e vínculos compostos continuam nas migrations existentes.

O bucket gb-locacoes-client-documents deve ter public false. URLs são assinadas
por 300 segundos com download nomeado. JPEG/JPG, PNG, WebP e PDF são aceitos;
arquivo vazio ou acima de 10 MiB é recusado. Content-Length acima de 11 MiB
responde 413. Imagens são decodificadas, com limite de 25 milhões de pixels,
formato coerente e uma página; PDFs conservam as verificações de assinatura e
EOF existentes. Metadata aceita objeto JSON, até 16.384 caracteres; não array.

Nome do arquivo substitui caracteres fora de a-z/A-Z/0-9, ponto, hífen e
underscore e limita a 120 caracteres. Paths não usam o nome fornecido como
autoridade. O cálculo de faltantes considera documentos do cliente ou da locação
indicada, sempre na locadora; bloqueios operacionais existentes não foram
alterados nesta extração.

## 6. Erros e limites de recuperação

- 400: arquivo/tipo/metadata inválido, com as mensagens anteriores.
- 401/403: sessão ou papel/ownership recusado; origem irmã recusada na mutação.
- 404: locação ou cliente ausente da locadora.
- 413: Content-Length acima do limite.
- 502: upload retorna erro, sem criar registro no banco.
- 500: storage privado indisponível, erro de banco ou falha não classificada.

Compensação continua sendo uma solicitação de remoção do objeto; a onda não
introduz uma transação distribuída nem garante recuperação de falha simultânea
no banco e storage. Uma URL null pode ser renovada pela listagem. Não há URL
pública permanente.

## 7. Validação

Na caracterização da onda 43, tests/api-host/client-documents.http.test.ts
aplicou 44 casos aos dois hosts com Better Auth e NextAuth reais, builds de
produção locais, PostgreSQL descartável e role temporária sem BYPASSRLS. Prova
papéis, ownership, isolamento, CSRF, precedência da posse, validações,
DTO/hash/metadata, TTL, bucket público recusado, falhas de upload/assinatura e
compensação após INSERT recusado pelo banco.

O SDK Supabase real conversa apenas com tests/api-host/private-storage.ts,
servidor local que registra operações sem credenciais. Não prova o bucket ou
provedor de produção. A regressão de contratos e os invariantes SQL/RLS
passaram; resultados completos e limites na onda 43 de
[API compartilhada](shared-api-host.md). A API legada permanecia ativa naquele
checkpoint. Após F, o serviço API é o adapter corrente; os resultados antigos
não provam uma nova rodada nem o bucket de produção. Provas/limites da retomada
ficam em `docs/guides/wave135-base-validation.md`.

## 8. Histórico e referências

- 2026-02-11: módulo operacional de documentos obrigatórios.
- 2026-10-02: extração incremental de upload e montagem da listagem no serviço;
  documentação corrigida para CLIENT proprietário, 502 do upload e arquivos
  atuais. Sem mudança funcional ou cutover.
- [Contratos](contracts.md), [Admin](admin-system.md) e
  [Extração do backend](../architecture/adr-backend-extraction.md).

## 9. Consumidor administrativo (onda 66, 2026-10-03)

pages/locacoes/api/client-documents.ts usa transporte configurado para listagem
do cliente e upload pela locação. FormData conserva arquivo/tipo/captureMetadata
sem Content-Type manual. Seleção/locadora/usuário capturados; resposta antiga
não aplica documento/sucesso. Multipart/hash/metadata, outra locadora e papel
FINANCIAL recusados em HTTP nos dois hosts/motores com storage local.
DTO/ownership/antifraude do backend intactos; provedor/aparelho reais pendentes.
Resultados/limites na onda 66 de [API compartilhada](shared-api-host.md).

## 10. Consumidor Expo — onda 79 (2026-10-03, sem commit)

Rota de locações administrativas seleciona image/* ou PDF pelo host Expo.
URI/nome/MIME entram no campo file; modelo comum acrescenta type e metadata
histórica, sem Content-Type manual. Cancelar, fechar detalhe ou trocar contexto
antes da seleção finalizar não inicia upload. Falha mantém detalhe e permite
retry. Server/ownership/limites/storage privado permanecem os mesmos.

URL recebida pelo servidor abre por Linking, apenas http/https. TTL/recebimento/
aplicativo externo e aparelho não certificados por testes/bundles locais.
[Provas e limitações](shared-api-host.md), onda 79; nenhuma operação em
produção.
