# Área cliente isolada por locadora

## Causa e mudança

Histórico, atividades, notificações e perfil consultavam apenas a identidade
global, mesmo quando ela pertencia a várias locadoras. O perfil também alterava
User diretamente; fan-out administrativo selecionava User.role global.

Foram migrados17 métodos em13 rotas: client/rentals (lista, detalhe, remoção,
request-pickup e request-extension), client/activities, client/notifications
(lista, detalhe, mark-all-read e stats), user/profile, quotes/[id] e download,
mais admin/notifications/sync. O endpoint client/rentals/[id]/extend já pertence
ao serviço de domínio migrado e não é contado neste lote.

Todos exigem seleção explícita e membership vigente. As queries e mutações usam
tenantId mais o titular da sessão, dentro da transação que configura RLS. Um ID
de outro tenant/titular retorna404; status administrativo global não amplia o
acesso. Remoção do histórico continua sendo clientDeletedAt, sem eliminar o
registro operacional. Listagem e atividades omitem os registros removidos.

GET/PUT user/profile leem e gravam ClientProfile por tenantId/userId. O DTO
existente conserva id/name/email/phone/cpf/cnpj/company; document local é
mapeado para CPF ou CNPJ. User, credenciais e cadastro de outra locadora ficam
intactos. Perfil ausente recebe404, sem copiar silenciosamente dados globais.
Payload não pode modificar role, tenantId, nome ou e-mail da identidade.

## Notificações e solicitações

O serviço de notificações agora recebe TenantContext como primeiro argumento.
Destinatários precisam de membership ativa; fan-out seleciona ADMIN da própria
locadora. Dedupe e criação ocorrem sob o mesmo lock/transação, com tenant no
filtro e na escrita. As APIs de leitura e marcação continuam limitadas ao
destinatário. Sincronização administrativa faz somente consultas scoped e não
usa CPF/CNPJ do User global como fallback.

Solicitar coleta/prorrogação antes retornava sucesso sem persistência. Agora
registra CLIENT_RENTAL_REQUEST no AuditLog e notificações administrativas na
mesma transação com lock de locação. Retry do mesmo tipo/prazo/data final
reutiliza o requestId; falha ao gravar ou ausência de atendimento ativo não
confirma sucesso. Prorrogação retorna estimativa, sem alterar datas, pagamento
ou status. A confirmação operacional continua sob responsabilidade da equipe.
Não foi criado workflow de aprovação novo nem interface alternativa.

URLs privadas/provider IDs de contratos não são mais expostos pelo detalhe da
locação; documentos usam o endpoint de download autorizado já implementado. O
download de orçamento passou a gerar PDF real pelo serviço compartilhado
lib/quote-document.ts, com ownership e soft delete preservados no endpoint
cliente. A mesma implementação atende os documentos administrativos.

## Verificação

- `tests/security/client-portal.test.ts`:47 testes de handlers com mocks,
  abrangendo autenticação, seleção, ownership, perfil e persistência/fan-out.
- `tests/identity/client-portal-database.test.ts`:6 testes de handlers reais com
  Prisma/PostgreSQL descartável: identidade compartilhada A/B, perfil isolado,
  User.role ADMIN sem privilégio de locadora, revogação, contadores e
  concorrência com apenas uma solicitação/alerta persistido.
- Suíte de identidade após o lote operacional:31 testes/4 arquivos PASS. Guard
  compartilhado exige TEST_DATABASE_URL local e TEST_DATABASE_DISPOSABLE=true;
  fixtures próprias limpas ao final. Nenhum banco externo, e-mail, storage ou
  provedor real usado.
- Configurações: vitest.security.config.ts e vitest.identity.config.ts, ambas
  sem o setup global legado. Lint e typecheck sem erros no fechamento do lote.

## Bloqueio de publicação

Ainda existem handlers de outras áreas sem isolamento. Não há allowlist global
que os bloqueie automaticamente: a publicação multiempresa permanece impedida
até a migração integral e a validação de runtime/RLS. Não houve corte de auth,
deploy ou alteração em produção.
