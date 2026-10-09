# API compartilhada — aceite operacional e retirada do legado

Estado: ensaio local aprovado em 2026-10-02, sem commit ou publicação. Este
roteiro não autoriza cutover, remoção de app/ nem alterações em produção.
Evidências por onda: [API compartilhada](../features/shared-api-host.md).
Arquitetura: [ADR de extração](../architecture/adr-backend-extraction.md).

## Responsabilidades atuais

| Superfície            | Responsabilidade                                                            | Destino durante a transição                                              |
| --------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Web                   | Rotas de UI, bootstrap, arquivos públicos e proxy com borda validada        | WEB_API_ORIGIN configurado; o exemplo da raiz conserva o legado          |
| Mobile                | Bootstrap, plataforma, identidade e configuração de transporte              | EXPO_PUBLIC_API_URL; arquivos relativos podem usar EXPO_PUBLIC_ASSET_URL |
| Serviço compartilhado | Host HTTP e composição dos casos de uso                                     | apps/services/api; agenda da Vercel preparada, ativa só no corte         |
| Backend               | Regras, transações, identidade, RLS, storage, documentos, pagamentos e jobs | packages/backend, consumido pelos dois hosts HTTP                        |
| Legado                | Compatibilidade HTTP, páginas ainda presentes, callbacks e scheduler atual  | Raiz app/; mantém 149 rotas, 193 métodos e 46 páginas                    |

As URLs de assinatura, armazenamento e provedores não devem ser reconstruídas a
partir da origem da API. WEB_API_ORIGIN é configuração privada do web;
EXPO_PUBLIC_* não pode conter segredo. As variáveis do web não são requisitos do
backend. Mesmos contratos e dados continuam sendo usados no retorno ao legado.

## Evidências locais disponíveis

Os três arquivos abaixo executam 43 casos por motor de identidade: NextAuth e
Better Auth. A fixture anuncia o motor selecionado por API_AUTH_MODE no log; não
basta definir uma variável com nome parecido.

- tests/api-host/web-operations.http.test.ts: 14 casos. Multipart real, hash,
  path privado, URL de 300 segundos, falha do storage sem registro, CSRF,
  documento conservado após rollback, PDF e headers, OAuth/consumo único,
  autorização pendente conservada no retorno ao legado, cache por Host e HTML
  SSR do equipamento de cada locadora.
- tests/api-host/web-consumers.http.test.ts: 11 casos. Login/cookies reais,
  sessão após rollback, arquivos públicos idênticos, borda forjada substituída,
  allowlist, isolamento e cliente HTTP usado pelo mobile.
- tests/api-host/cron-jobs.http.test.ts: 18 casos. Autorização, estados de
  organização, checkpoints, idempotência, resultado dos runners e outbox.

O web roda com DATABASE_URL/DIRECT_URL inutilizáveis. O HTML contendo o h1 do
equipamento e as chamadas ao gateway demonstram composição HTTP sem consulta
direta do cliente ao banco. Scripts Flight/JSON-LD são removidos antes de
verificar o heading, para não confundir dados serializados com markup
renderizado.

PDFs conservam no-store; documentos privados usam private, no-store. A
comparação do PDF normaliza somente o instante e o identificador de documento
produzidos pelo PDFKit, mantendo conteúdo, fontes, layout e demais metadados.
Isso não substitui aprovação visual, acessibilidade ou testes de impressão.

Os provedores são dublês HTTP locais. A troca OAuth usa implementação e
transporte reais, mas não certifica aceitação do callback por uma conta externa.
O certificado TLS é temporário e confiado somente pelo processo filho; TLS não é
desabilitado. Os testes não acionam o agendador nem fazem chamadas pagas.

## Executar o ensaio

Usar Node/pnpm do projeto, PostgreSQL exclusivamente descartável e migrations
aplicadas conforme o CI. TEST_DATABASE_DISPOSABLE deve ser true e a URL deve ser
local, identificada como teste e distinta das origens reais. Não usar db push,
reset ou conexão de produção. Não reutilizar servidor externo como fixture.

Pré-requisitos: artefatos atuais de pnpm build, pnpm build:api e pnpm build:web,
Prisma Client compatível com as migrations e OpenSSL disponível. A fixture
inicia e encerra seus próprios processos em portas livres, sem matar os demais.

```powershell
# Configurar antes TEST_DATABASE_URL para o banco local descartável preparado.
$env:TEST_DATABASE_DISPOSABLE = 'true'
$env:API_HOST_MODE = 'production'
$env:API_LEGACY_MODE = 'production'
$env:API_AUTH_MODE = 'legacy'
pnpm exec vitest run --config vitest.api.config.ts tests/api-host/web-operations.http.test.ts tests/api-host/web-consumers.http.test.ts tests/api-host/cron-jobs.http.test.ts
# Conferir exit 0 e o motor anunciado antes de executar a segunda variante.
$env:API_AUTH_MODE = 'better-auth'
pnpm exec vitest run --config vitest.api.config.ts tests/api-host/web-operations.http.test.ts tests/api-host/web-consumers.http.test.ts tests/api-host/cron-jobs.http.test.ts
```

Consolidar os demais testes ao fim do bloco, na cadência de boot.md. Nenhuma
baseline, sessão ou janela de limitador deve ser ampliada ou apagada durante o
ensaio para fazê-lo passar. Após o teardown, conferir que não sobraram fixtures,
papéis temporários, processos ou chaves TLS. Preservar logs fora do checkout.

## Callbacks e autoridade de jobs

| Caminho                                       | Regra de transição                                                                                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OAuth Zoho                                    | Callback no app conforme configuração e origem validada; state vinculado ao usuário/locadora, consumido uma vez. Não trocar redirect_uri no provedor implicitamente |
| OAuth da identidade                           | Validar origem, basePath, cookies, state e retorno entre hosts; aceite social real ainda pendente                                                                   |
| Webhooks de pagamentos, assinatura e WhatsApp | Chamam a origem de backend diretamente; não passar pelo cliente web. Credenciais são específicas da integração/locadora                                             |
| Crons                                         | Web bloqueia antes do encaminhamento, inclusive com segredo válido. Chamada direta ao backend exige CRON_SECRET; não criar outra agenda                             |

Em produção há hoje duas agendas, ligadas ao repositório GB-Locacoes: os três
crons da Vercel do projeto do `main` e o "External Cron Dispatch" do GitHub
(cinco jobs; o mesmo workflow existe nesta branch e roda em todo repositório
onde estiver, com o `CRON_BASE_URL` de lá). Os dez GETs de cron existem nos dois
hosts; existir não significa estar agendado. Desde a onda 135 (Bloco K), a
agenda da Vercel do corte mora em `apps/services/api/vercel.json`: `late-fees` e
`expire-quotes` às 00:00 UTC e `outbox` a cada minuto; `sync-google-merchant`
(sempre 503) e `platform` ficam fora. Ela só vale no deploy de produção do
projeto da API e é ligada no passo 7.2-9 do
[runbook do corte](../operations/runbook-corte-raiz-legada.md), depois que as
agendas do `main` foram paradas (7.2-2); o web nunca agenda. O `vercel.json` da
raiz serve só ao projeto `fallback-raiz`, com os Cron Jobs desligados nas
configurações. A prova local não inspeciona agendas externas: seu inventário
entra no aceite do ambiente.

## Critérios para um corte de tráfego

Antes de propor a troca em um ambiente, produzir um registro revisável:

1. Destinos reais e autoridade de cada host, DNS/TLS, callbacks registrados,
   storage, credenciais e uma única agenda inventariados; não inventar domínio,
   plano, preços ou credenciais.
2. Sessões dos dois motores e seleção multiempresa verificadas nos clientes do
   ambiente; cookies, e-mail e retorno social testados. Nenhum fallback de
   identidade, primeira locadora automática ou credencial global.
3. Fluxos completos de orçamento, cobrança/reconciliação, locação, documentos,
   assinatura, outbox/inbox e administração aceitos; garantir retries sem
   duplicação, isolamento, histórico e quitação em centavos.
4. Casos renderizados e dispositivos reais aceitos, incluindo cache, navegação,
   arquivos, upload/download, storage de sessão e conectividade. SSR e bundles
   não substituem esse aceite.
5. Capacidade e segurança do runtime verificadas: FORCE RLS/papéis/grants,
   orçamento de conexões, autenticação sob carga, lock/timeout, observabilidade,
   logs sem segredos e alertas. A corrida de inserção da issue 241 foi corrigida
   na onda 60; a limitação de capacidade da 242 continua pendente.
   Indisponibilidade real e recuperação após crash continuam exigindo retries.
6. Rollback ensaiado no ambiente e registro da autorização humana para
   publicação ou operação. Nenhuma credencial, host, banco ou scheduler real foi
   alterado nas ondas 58/59.

## Retorno ao legado e exclusão de app/

O retorno local troca o destino privado do web e a configuração do mobile para o
backend anterior; não move dados, renomeia cookies nem muda a origem dos
arquivos públicos. Conservar contratos, segredos compatíveis e autoridade única
de jobs. Callback pendente e documentos persistidos sobreviveram ao retorno
local. Em produção, o retorno é o projeto `fallback-raiz` (a raiz da tag
`checkpoint/onda-135-pre-exclusao`, sem domínio e sem agenda): o domínio da
origem pública da API passa para ele e a agenda muda junto, sem trocar URL em
terceiros ([runbook do corte](../operations/runbook-corte-raiz-legada.md), 7.3).

Excluir app/ exige mais que trocar WEB_API_ORIGIN: substituir também suas
páginas/entrypoints restantes, provar os consumidores e revisar imports e
composição. Pela decisão D0 do dono (opção b, 2026-10-08), a exclusão no
repositório não espera o corte de produção: ela vem logo depois das provas P0
(rodada dupla final), P1 (só os hosts novos) e P2 (clone sem a raiz) verdes, da
tag `checkpoint/onda-135-pre-exclusao` e dos itens exigidos pela régua do dono.
A raiz da tag fica como oráculo (divergência achada no staging se investiga num
clone dela) e como o artefato implantável do `fallback-raiz`. A produção está no
repositório GB-Locacoes, então apagar aqui não desliga cron, webhook nem
domínio. Transferir callbacks e a única agenda continua sendo um corte próprio,
com aceite operacional, pelo runbook. Desligar scheduler ou webhook
antecipadamente interrompe efeitos mesmo quando todas as rotas da API nova
compilam. A exclusão retira fachadas/dependências sem consumidores e ajusta
build/deploy/docs com gates completos, mantendo uma estratégia de recuperação
revisável.

Pendências SaaS, paridade mobile, DNS/BaaS, planos e textos legais continuam
pertencendo ao escopo geral da modernização. 100% do inventário de métodos não
prova a conclusão desse escopo.

## Carrinho dos consumidores (onda 61)

Bootstrap web/native já monta o hook universal para CLIENT confirmado no escopo
da rota. Mesclagem, restauração, edições, remoções e retorno após falha usam os
mesmos endpoints nos dois destinos. Cookies reais, RLS, totais e recuperação de
resposta perdida foram comprovados em HTTP local; providers e troca de escopo
também foram renderizados em jsdom. Carrinho de visitante permanece separado,
sem transferência implícita após login.

No aceite interativo, conferir carrinho vazio e persistido, edição e remoção,
modo offline/reload/retry, troca de locadora/usuário, janela/aparelho adicional,
preços com desconto e valor direto, navegação e envio de orçamento. Build web e
bundles Android/iOS foram aprovados, mas não substituem esse aceite no navegador
ou aparelho. O contrato completo e as provas estão na onda 61 de
`docs/features/shared-api-host.md`. Nenhuma dessas provas autoriza retirar a
raiz ou transferir jobs/callbacks antecipadamente.

## Orçamento dos consumidores (onda 62)

O orçamento web já usa o destino configurado para catálogo/disponibilidade,
perfil/endereço e pedido. Conferir no aceite interativo seleção/host, retorno de
perfil, preenchimento manual, entrega/retirada, termos, confirmação de finais de
semana, endereço principal, salvar/não salvar, sucesso parcial e falha/retry.
Trocar locadora/usuário durante leitura/escrita não deve hidratar nem limpar o
carrinho seguinte. Preferências globais antigas não são copiadas entre
locadoras.

Provas automatizadas de handlers do formulário e transporte real foram aprovadas
nos dois hosts/motores. Seletores/endereço são simulados na renderização jsdom;
não é prova visual. O orçamento nativo completo e o aceite em aparelhos
continuam pendentes. A onda 62 de docs/features/shared-api-host.md registra
contratos, comandos/resultados e limites; app/ e scheduler continuam ativos.

## Perfil e endereços dos consumidores (onda 63)

Transporte configurado compartilhado com o orçamento. No aceite interativo,
conferir preenchimento/formatação, editar/salvar/cancelar, falha/retry, CRUD de
endereços, CEP, principal e promoção após exclusão. Trocar usuário/locadora
durante GET/PUT/POST/PATCH/DELETE não pode conservar dados privados na nova tela
nem iniciar uma releitura a partir de uma resposta antiga. Uma gravação já
recebida pode concluir no escopo original; abort não promete rollback remoto.

Provas automatizadas de páginas e HTTP real com cookies/RLS passaram nos dois
motores/hosts; pathname, ViaCEP e toasts são simulados na renderização. Não há
novo aceite de navegador/aparelho. Verificação e senha conservam placeholders
anteriores; telas nativas completas e o restante da operação ainda pendentes.
Resultados e limites na onda 63 de docs/features/shared-api-host.md.

## Visão geral e histórico dos consumidores (onda 64)

Aceite interativo: conferir cards/atividades/valores da visão geral, busca,
filtros, links e deduplicação de orçamento convertido no histórico. Polling
consulta a cada 30 segundos somente em aba visível; retorno à aba atualiza, sem
spinner de tela. Confirmar exclusão e releitura, recusa/retry sem perder a linha
e scope change durante GET/DELETE sem reapresentar dados/sucesso antigos. Soft
delete deve preservar status/valor e acesso do admin.

Provas automatizadas de páginas e HTTP real com cookies/RLS passaram nos dois
hosts/motores. Classes/estilos preservados; não há novo aceite de navegador,
aparelho ou operação externa. Detalhe/pedidos/downloads e telas nativas ainda
pendentes. Resultados/limites na onda 64 de docs/features/shared-api-host.md.

## Detalhe, pedidos e download do histórico (onda 65)

Aceite interativo: acessar locação e quote_[id], conferir totais/frete/multa,
404 e retorno ao histórico; confirmar cancelamento. Verificar polling visível e
atualização silenciosa. Testar extensão direta de 1–30 dias, pedido à equipe com
additionalDays, coleta e mensagens/refresh anteriores.

Os diálogos de pedidos agora compõem Portal e Trigger renderizando Button.
Conferir teclado/foco em navegador e aparelho. Durante GET/DELETE/POST/download,
trocar usuário/locadora/registro: nenhum dado, toast, arquivo ou releitura
antiga pode atingir a tela nova. Download espera o corpo completo, inclusive
após redirect. O nome .html anterior é conservado mesmo para PDF e permanece
dívida.

211 casos focados e seis HTTP por motor nos dois hosts locais passaram,
incluindo HTML/PDF privados, ownership e cookies/RLS, com storage local. Tipos,
guards e builds dos clientes aprovados; isso não comprova CORS/interaction dos
provedores reais ou paridade nativa completa. Legado e scheduler continuam
ativos. Resultados/limites na onda 65 de docs/features/shared-api-host.md.

## Pagamentos e documentos administrativos (onda 66)

No aceite interativo, gerar boleto e pedir segunda via/vencimento: 202 mostra
processamento, sem confirmar pagamento/data antes do worker. Conferir clique
duplicado, falha/retry e refresh. Em locações, listar/upload/relistar
documentos, gerar contrato e registrar check-in/out. Troca de
usuário/locadora/registro durante rede/callback não deve liberar dados, toast,
arquivo ou releitura antiga.

Conferir reajustes/ofício, popup bloqueado, erro, fechamento da aba vazia e
viewer do PDF. Negativas não são documentos. Oito HTTP por motor nos dois hosts
locais passaram com cookies/RLS e storage local; builds não certificam
navegador/aparelho/provedor real. Demais consumidores/SaaS/mobile/operação
pendentes, legado/agenda ativos. Resultados na onda 66 de
[API compartilhada](../features/shared-api-host.md).

## Financeiro e orçamentos administrativos (onda 67)

Conferir tabela/Kanban/calendário e filtros de busca/status/período/valor;
Kanban deve ignorar filtros ocultos e atualizar meses sem colapso. Em
financeiro, conferir totais/gráficos e reset de alíquotas; exportar
PDFs/XLSX/CSV com IDs selecionados, popup bloqueado, erro e troca de locadora
durante download. A revogação de blob URL e download efetivo exigem navegador
real.

Editar cliente/período/itens/entrega, aprovar AT_END, simular/aprovar multa,
enviar ajustado e criar múltiplos reajustes. Respeitar 202 pendente e recusas
409; uma recusa parcial não desfaz as anteriores. Trocar usuário/locadora/
registro durante rede/callback não deve liberar dados, toast ou próximo POST
antigo. Histórico não pode desaparecer em DELETE recusado.

82 casos focados e seis HTTP por motor nos dois hosts locais, tipos/gates/builds
aprovados; não certificam aparelho, provedor real ou retirada do legado. Provas
e riscos na onda 67 de docs/features/shared-api-host.md.

## Catálogo administrativo (onda 68)

No aceite interativo, confirmar categorias: criação, nome duplicado, edição,
exclusão com vínculo e outra locadora. Em equipamentos, conferir filtros,
paginação, valores/toggles por período, imagens, perdas de peças e exclusão
referenciada. Trocar locadora/usuário/equipamento durante a rede não deve
aplicar resposta, fechar rascunho, navegar ou mostrar sucesso antigo.
Fechar/reabrir formulário de unidade durante uma gravação também deve conservar
o novo rascunho.

Unidades: código repetido, campos opcionais, medidores zero/fração, vínculo
imutável e exclusão recusada para RENTED/RESERVED. HTTP preserva medidores
textuais; renderizador legado ainda precisa adaptar toFixed a esse contrato.
Erro HTML da edição deve manter a mensagem statusText. Provas automatizadas
locais não substituem navegador/aparelhos/provedores reais. Legado/agenda
permanecem ativos; consultar onda 68 de docs/features/shared-api-host.md.

## Operações administrativas e medidores (onda 69)

No aceite interativo, conferir dashboard principal e secundários com
carregamento independente, erro de rede/JSON e retry. Manutenção conserva
filtros, agenda com atrasos e paginação; logística conserva auxiliares e PATCH
de campos/status. Trocar locadora/usuário/transporte ou cancelar/reabrir edição
durante rede não deve reaplicar dados, feedback ou seleção anteriores. Abort não
desfaz escrita remota.

Medidores textuais agora são apresentados com a precisão original, inclusive
zero; null permanece oculto. Correção da pendência da onda 68 comprovada em
cinco renderizações. 54 casos focados únicos e tipos/gates/builds aprovados
localmente não substituem navegador/aparelho. HTTP anterior dos handlers não
repetido neste bloco sem mudança de servidor. Consultar onda 69 de
shared-api-host.md.

## Comunicações, configurações e permissões (onda 70)

No aceite interativo, testar conversas/paginação/envio, leitura de correio e
seleção rápida, ações/rollback/expunge, rascunhos sem apagar campos e anexos
multipart/download. OAuth deve começar no web/proxy e manter cookies de retorno.
Trocar usuário/locadora/transporte/pasta/perfil ou fechar/reabrir compositor
durante rede não deve reaplicar resultados/feedback. Abort não desfaz efeito
remoto.

Settings: validar logo de imagem/5 MB, save completo e reset da seção; confirmar
um toast de tela encerrada não pode escrever. Permissões mantém matriz ADMIN
travada e grant do servidor. Provas automatizadas e bundles locais não
substituem provedor real/aparelhos. Legado e scheduler seguem ativos. Ver onda
70 em docs/features/shared-api-host.md.
