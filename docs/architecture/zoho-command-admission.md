# Admissão durável das mutações Zoho

Estado: incremento local, onda 102, 2026-10-04, sem commit. A fiscalização real
continua `off`. Complementa a ADR de extração, a ADR SaaS e a integração Zoho.

## Fronteira e compatibilidade

Enviar, responder, salvar rascunho, atualizar/excluir mensagem e enviar anexos
usam o mesmo executor em `packages/backend`. Os hosts fornecem a transação; não
copiam regras comerciais nem persistência. Rotas, payloads sanitizados, IDs
longos, limites de anexos e respostas anteriores continuam nos adapters.
Leituras e refresh de tokens não receberam o gate de mutação.

Em `off`, o efeito executa sem nova consulta ou registro; envio/resposta
conservam o cache e a auditoria anteriores. Em `shadow`, a política observa a
recusa e mantém o fluxo vigente, sem registrar comandos. Configuração inválida
falha fechada. Nenhuma variável de produção foi alterada.

## Aceitação com fiscalização ligada

A migration aditiva `202610040001_zoho_command_admission` cria
`zoho_mail_commands`. A transação bloqueia a organização, revalida acesso,
módulo `emailInbox`, participação ativa ADMIN/OPERATOR e conexão
locadora/usuário/conta. Grava PROCESSING e termina antes da chamada externa.
Efeito já aceito registra resultado mesmo após RESTRICTED/ARCHIVED; nenhuma
transação fica aberta no provedor.

A identidade combina locadora, usuário, operação e SHA-256 de
`x-idempotency-key`. O fingerprint inclui conta e payload normalizado,
messageId/pasta quando aplicáveis e conteúdo dos arquivos no upload. Payload
diferente com a mesma chave responde 409 IDEMPOTENCY_CONFLICT. Sem chave, cada
requisição tem identidade nova: dedupe entre requisições depende de chave
estável fornecida pelo consumidor.

Resposta/status confirmados ficam em RESOLVED; auditoria de envio/resposta
pertence à mesma transação de conclusão. Repetir a chave devolve resposta sem
outra chamada ou auditoria. PROCESSING recusa repetição simultânea. Falha
externa ou na conclusão produz UNKNOWN, quando o banco permite registrá-la.
Banco indisponível pode deixar PROCESSING, que também bloqueia reenvio.

## Isolamento e histórico

FORCE RLS, política tenant_isolation, FK de organização e FK composta de
participação protegem a tabela. Aplicação recebe SELECT/INSERT/UPDATE, sem
DELETE. Triggers proíbem remoção, reabertura terminal, mudança de identidade e
inserção concluída. A conexão é um identificador histórico sem FK que impeça
desconexão OAuth. O payload de entrada não é persistido, somente seu hash;
resposta HTTP conserva os metadados comerciais do contrato existente. Chave
original, credenciais e bytes de anexos não são gravados pelo executor.

Índices cobrem dedupe e busca ordenada por locadora/status/data. Inventário e
expectativas estritas de RLS incluem agora 32 tabelas de negócio; baselines de
tolerância não foram alterados.

## Provas e limites

358 casos passaram: 194 unitários/contratos/RLS geral e 164 de
identidade/transações, em oito arquivos. São 55 casos novos: recusas nos seis
adapters, plano/conexão/participação, replay após recriação, concorrência,
downgrade após commit, UNKNOWN, falha de auditoria, fingerprint de bytes,
imutabilidade e EXPLAIN dos dois índices. Migration somente em banco
descartável.

Tipos dos 12 projetos e legado, lint, arch, tokens, hygiene, nomes de testes e
ratchet somente em leitura passaram, sem alteração de baselines. Os dois builds
passaram; o novo ledger não apresenta drift em relação ao banco local. 50 casos
HTTP de mutações passaram nos dois hosts compilados. O bloco permanece parcial:
a execução ampliada encontrou oito falhas de origem em leituras/OAuth (26
leituras e 30 OAuth passaram). A política central atual aceita GET/HEAD, mas
esses testes esperam recusa de Origin irmão; a divergência não foi corrigida nem
os testes foram afrouxados naquela onda. A onda 103 resolveu a fronteira com
guard específico do Zoho para Origin explícito, sem alterar a política geral de
GET/HEAD. Os 116 casos HTTP ampliados passaram nos dois hosts, incluindo state
não consumido na recusa e navegação legítima; reconciliação de UNKNOWN continua
pendente.

Resultados e limitações na onda 102 de
[API compartilhada](../features/shared-api-host.md).

UNKNOWN e crash entre aceitação/envio ainda precisam de reconciliação
verificada, sem reenvio automático. Deduplicação no provedor não foi assumida.
OAuth/desconexão, equipe/site, SaaS/onboarding/backoffice e aceites reais
permanecem parciais. API legada/proxy/scheduler ativos, fiscalização real off,
sem commit/push/deploy/produção. Geral ~60% é estimativa de esforço.
