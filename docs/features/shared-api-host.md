# API compartilhada — extração incremental

## Decisão vigente — primeira etapa publicada, F em clone local (2026-10-09)

O usuário aceitou a interface e autorizou a primeira etapa no destino separado
`Schlorke/Locadora_de_Equipamentos`. O commit
`978ceb9244c81c7cb2888b798fad8ce90edad25e` foi publicado em `main`, com a tag
`checkpoint/onda-135-pre-exclusao` apontando para esse mesmo snapshot. A
publicação usa um único commit inicial, sem os parents antigos; o arquivo de
recuperação do histórico fica local. Não houve deploy de provedor nem envio de
refs do projeto GB-Locações, conforme `stage1-publication-receipt.json` da
evidência externa de fechamento.

F está aplicado somente no clone independente de P2: os antigos adapters da raiz
`app/`, as fachadas `lib/` e o middleware `middlewares/require-admin.ts` saíram
desse clone. As rotas HTTP canônicas estão em `apps/services/api/src/app/api`; a
composição fica em `apps/services/api/src/host` e em
`packages/backend/src/runtime`. Os casos de uso continuam em
`packages/backend/src/modules`, com domínio e contratos universais nos pacotes
próprios. A árvore publicada de 978ceb é o retorno pré-exclusão; não usar uma
fachada na árvore sem raiz como fallback.

As provas finais desse clone ainda não estão fechadas. A rodada existente
`p2-validation/test-unit.log` terminou com 245 passes, duas falhas, seis
arquivos aprovados e um reprovado (247 casos; 56,75s; exit 1). Uma falha é o
inventário de citações vivas dos artefatos retirados; a outra reúne dois
controles negativos do leitor. Esses resultados não são a suíte unitária
integral nem certificam as correções documentais e de M7 preparadas depois
daquela rodada.

Hospedagem, banco contratado, KMS, homologação e ativação de provedores ficam
para a etapa posterior. PostgreSQL de validação é local e descartável, com
papéis próprios. `.github/workflows/cron-dispatch.yml` só despacha com o
repositório exato e `CRON_DISPATCH_ENABLED=true`; o despacho herdado está
desligado quando a variável está ausente. A retirada local não liga uma agenda
nem autoriza alterar ou revogar credenciais possivelmente compartilhadas com
GB-Locações.

A revisão da primeira etapa retirou duplicações de imposto, upload e cálculo
puro de multa; schemas sem HTTP passaram para a suíte unitária. A integração de
multa preserva efeito persistido, valores explícitos e datas determinísticas. As
ondas abaixo conservam seus resultados e limites da época. A evidência de
fechamento portátil está em `docs/guides/wave135-base-validation.md`; ela não
substitui o aceite e as provas pós-F do clone.

## Onda 135 — continuidade local após a recuperação de contexto (2026-10-08, sem commit)

Na recuperação de 2026-10-08, a antiga raiz permanecia presente. Esta fotografia
registrou as provas e pendências anteriores ao aceite humano e à publicação de
978ceb em 2026-10-09; as contagens abaixo pertencem àquela retomada:

- A0: seis dependências reconciliadas nos importers, sem alterar versões ou
  snapshots. Instalação offline travada e builds de produção da raiz, API e web
  passaram em Node 24.21.0; a variante do React Native permaneceu a mesma.
- A4: teste dos exports reais das nove páginas para duas locadoras; SEO/home
  29/29 e onze mutações detectadas, com fontes restaurados por bytes/hash.
- B2: expectativas de fixtures substituem capturas e o primeiro host como
  gabarito. Após corrigir DTOs/cabeçalhos e isolar a fixture de manutenção, a
  rodada integral `absent/legacy` passou 64 arquivos, 2.400 casos e um skip.
  PDFs têm valores de negócio explícitos; a prova não certifica pixels/fontes.
- B3: sucessos reais de plataforma, publicação, webhook, identidade, ativo HDR e
  reativação foram acrescentados; a lista antes inexistente documenta vinte
  exceções efetivas no legacy e quatorze no Better Auth. São contratos sem 2xx
  (redirecionamento, preservação de histórico, catch-all, quarentena e rotas
  exclusivas do motor), não dispensas para fixtures incompletas. A regra de
  sucesso não foi ampliada. A matriz v2 confirmou 201/221 métodos com sucesso e
  vinte exceções no legacy; 207/221 e quatorze no Better Auth, nos perfis com e
  sem raiz.
- B11: relatório recusa evidência vazia, falha, incompleta, antiga ou de
  perfil/superfície diferente. Conclusão do estado final do Vitest somente
  depois da limpeza/cobertura; 74 testes unitários, contrato de tipos e mutação
  sensível. O lifecycle observa o término real dos filhos/auxiliar, tenta irmãos
  e recursos locais e impede conclusão/drop na falha (32 casos e quatro mutações
  sensíveis). O fingerprint inclui helpers/configuração/SQL; naquele checkpoint
  a matriz dos quatro perfis precisava ser renovada, exigência depois cumprida
  pela v2 abaixo. O primeiro confronto integral legacy recusou corretamente
  registros de 3.018/2.400 casos aprovados por títulos duplicados/instáveis e um
  loop quadrático de hosts. Doze tabelas de dez testes ganharam labels
  semânticos, mantendo os 47 cenários; a recusa de unicidade agora atua no host
  corrente da fixture. Oracle, comparador e regras de evidência/asserções não
  foram relaxados. A matriz v2 passou nos quatro perfis, e as duas comparações
  finais tiveram zero violações abertas.

A matriz HTTP v2 passou nos quatro perfis, com 64 arquivos em cada rodada:

| Perfil                 | Casos aprovados | Skips | Duração |
| ---------------------- | --------------: | ----: | ------: |
| production/legacy      |           3.018 |     2 | 234,32s |
| absent/legacy          |           2.400 |     1 | 133,87s |
| production/better-auth |           3.014 |     0 | 220,92s |
| absent/better-auth     |           2.398 |     0 | 149,78s |

B11 comparou 2.400 casos legacy e 2.398 Better Auth, com zero violações abertas
e zero casos exclusivos sem raiz. Os 618/616 casos exclusivos com raiz são os
braços legados previstos. A cobertura registrou 201/221 métodos com sucesso e
vinte exceções no legacy; 207/221 e quatorze no Better Auth. Os registros v2
incluem a conclusão final e o fingerprint atual; os registros anteriores seguem
preservados. Esta matriz certifica o comportamento HTTP dos motores no servidor
e seus cookies. Os builds dos três hosts foram feitos em modo público legacy;
ela não substitui rebuild web Better Auth nem suas jornadas no navegador.

A rodada visual Better Auth
`visual-narrow/full-v4-better-auth-20261009T013001Z-84d4e6b9` passou 80 casos em
747,728s; seus catálogos só em `base` eram incompletos. Preservadas as 78
páginas/162 estados, o parser/guard foi corrigido e a recaptura separada passou
dois casos em 20,4min, com 187 estados por viewport. Ferramentas 93/93 em seis
arquivos, tipos focados 0/0 e lint focado verde.

A composição executada em `visual-narrow/composed-v4-pages-catalog-final` fechou
**80 JSONs/536 estados/536 capturas**: 78 páginas/162 estados mais dois
catálogos/374. Origem/SHA-256 por arquivo e os dois reports/fingerprints estão
em `composition-manifest.json`; `summary.json` registra zero erros de página,
rede pendente, APIs sem mapeamento, esperas instáveis e arquivos
novos/ausentes/obsoletos nos artefatos selecionados. A baseline tem 528 estados;
os oito adicionais são estados de Configurações já documentados.

Comparador **exit 1: 16.272 registros pendentes e 372 já aprovados**. São
propriedades CSS/presença de elementos/estados, não pixels. Captura e composição
completas não fecham inspeção ou aceite visual P1. Não é uma rodada integral
única nem prova de repetibilidade. Produto, build `R7kHAAzDS69RA5Yc0oQ1F`,
ModelViewer `5c3c…`, fixtures, preparação e baseline permanecem preservados.

A triagem atribuiu **16.260 registros às oito telas antigas da entrada 295**. Os
outros **doze** são serializações de `background-image`: `to right` versus
`90deg`, com as mesmas três cores RGB/stops (quatro em acesso recuperar/reset,
dois em equipamento-editar A9 e seis em vitrine-detalhe). São candidatos à
equivalência semântica, sem nova aprovação; o comparador literal conserva
exit 1. Os demais cenários A9 revisados não acrescentaram outra pendência.

Em 390px, a captura Dialog/open atual e as históricas f1/f2 são idênticas por
bytes/SHA-256 (`CB4A7E…`, 13.975 bytes), com a mesma árvore de 25 elementos e
CSS de diálogo/backdrop. O gap de visibilidade é preexistente, sem regressão
comprovada; posicionamento/causa de runtime ainda precisam de diagnóstico. Essa
identidade não encerra a prova de visibilidade. Entradas 295/335 conservam os
limites e nenhuma baseline/oracle foi alterada para eliminar diferenças.

A sonda externa posterior de Dialog executou um caso/quatro células (clock
congelado/real × screenshot allow/disabled), wrapper 13,4s, sem erros, APIs sem
mapeamento ou rede pendente; child saiu 0 e portas próprias ficaram livres.
Conforme `visual-narrow/dialog-geometry-readonly-analysis.md`, depois da rolagem
ao marcador o VisualViewport 390×844 ocupa [32,422]×[480,1324], totalmente fora
da caixa estável do popup (x591,406/y1350,406/w377,188/h675,188), nas quatro
condições. Isso explica a limitação da sequência de captura. A origem de
`innerWidth/Height` 1560×3376 permanece aberta; a sonda não certifica
usabilidade, percepção ou ausência universal de defeito do diálogo.
Produto/spec/baseline/oracle permanecem intactos.

M8 foi concluída como revisão limitada das políticas compiladas, chamadas
próprias e runtime exercitado em production/legacy. A raiz remove chamadas de
console exceto error/warn; a API não configura essa remoção. O inventário de
fonte encontrou 278 chamadas diretas (246 error, quinze warn e dezessete log); a
atribuição dos artefatos por prefixos próprios não encontrou log/info/debug
adicional, com limites para aliases, mensagens dinâmicas e dependências. Nos
logs fechados dos dois hosts, seis ocorrências por host eram falso positivo por
substring de mensagens SQL sintéticas, sem exposição de credencial demonstrada.
Valores e linhas brutas não foram publicados. A revisão não certifica segurança
universal nem altera a política de logs. M7 formal continua pendente do clone P2
e da análise após retirar a raiz nesse clone.

C2/materialização passaram 51 casos, incluindo inventário pré-tag, referências
inválidas, SHA fixo apesar de tag movida e Git replacement refs. Naquele ensaio
a tag real de pré-exclusão ainda estava ausente; a publicação posterior de
978ceb materializou `checkpoint/onda-135-pre-exclusao` (recibo na decisão
vigente). As jornadas usam HTTPS local, sessão/cookies reais, seleção e logout.
O harness neutralizava `NEXTAUTH_URL_INTERNAL` como string vazia: o fallback
`??` do NextAuth não a substitui e o SSR falhava em `new URL('')`. A URL interna
passou a acompanhar a URL sintética NextAuth, com origens/segredos
compartilhados entre API/web. A rodada legacy pré-ampliação de J1 passou seis
casos e dois skips em oito, em 22,41s; log `journeys-legacy-pre-J1-green.log` e
evidência em `%TEMP%/locadora-journeys-TQYWBS`. A rodada legacy ampliada passou
sete casos e dois skips em nove, em 29,34s (`journeys-legacy.log`, evidência em
`%TEMP%/locadora-journeys-z86UIe`). J1 visitante confirmou um orçamento DELIVERY
Standard, item 200 + frete local sintético 30 = total 230, e carrinho vazio após
recarregar. Express é somente estimativa de UI; não há homologação do provedor
real de frete nem da entrega de notificações. Após o loader, a rodada legacy
anterior passou sete casos e dois skips em nove, em 50,84s
(`journeys-legacy.log`, `%TEMP%/locadora-journeys-SCdaSs`); os resultados
anteriores permanecem históricos. Cada motor exige seu próprio rebuild web. A
primeira rodada Better Auth terminou com cinco passes, três falhas de
expectativa de percurso em J1/J4/J7 e um skip, em 146,47s
(`%TEMP%/locadora-journeys-XYtQXF`), preservada como histórico. A rodada final
passou **oito casos e um skip contratual em nove, em 84,77s**, com web Better
Auth `r2B-vsczGQAqwkg72XsRq`; log `journeys-better-auth-final-coherent-dom.log`,
registro de fonte/build `journeys-better-auth-final-record.json` e artefatos em
`%TEMP%/locadora-journeys-2cWyfY`. J1 usa leitura atômica do DOM (A presente, B
ausente, dois controles, quantidade um/dois dias), conservando expectativas
remotas/DB/orçamento/outbox: item 200 + frete 30 = 230, um orçamento e carrinho
vazio após reload. J4 conferiu e-mail no menu antes/depois do reload. J7 passou
callback, confirmação no banco, POST real de login 200/dono correto, sessão,
empresa e criação/checklist final.

Na mesma fonte final do teste (SHA-256
`9c3c1624e7789ffed2d02c687e9d187e1ec84558314119b18e6bb6b69c55c5ae`), legacy
passou **sete casos e dois skips contratuais em nove, em 32,56s**, com web
`qUsWUvj6ANYgIJAuWlNLR`; log `journeys-legacy-final-coherent-dom.log`, registro
`build-legacy-final-coherent-dom.json` e artefatos em
`%TEMP%/locadora-journeys-N7wbsX`. J1 visitante confirmou item 200 + frete 30 =
230, um orçamento e carrinho vazio após reload. O web Better Auth foi depois
recompilado como `R7kHAAzDS69RA5Yc0oQ1F` para o visual, com fonte de produto
preservada e ModelViewer no SHA `5c3c…`
(`build-better-auth-final-coherent-dom.json`). A prova Better Auth 8/1 permanece
atribuída ao build `r2B-vsczGQAqwkg72XsRq`; o novo build não aprova visual
completo nem P1/P2 integral.

O helper de login limita as consultas de sessão a 500ms/30s, falhando no
primeiro status não-200, sem alterar limiter ou produto. Observação passiva
final: 96 GETs de sessão do navegador, todos 200, e owner-account
200/verificado, sem 429. O 429 observado no polling antigo em `hPjWdt` não
demonstra a causa retrospectiva da falha de UI em `tVke0w`; uma rodada passiva
com 50ms também passou. A contagem de 91 GETs antes de J7 sustenta hipótese de
pressão compartilhada, sem certificar o bucket do banco ou chamadas
SSR/internas.

T5/T6 legacy passou a especificação original `tests/e2e/tenant-hosts.spec.ts`:
sete casos em sete, sem skips, em 5,85s. API/web compilados e banco próprio
provaram roteamento por host e isolamento de locadoras, incluindo catálogo,
detalhe e navegação Chromium sem avisos de hidratação ou erros de página. O
diagnóstico só permitiu tráfego local próprio, sem fabricar respostas ou
autenticação. `tenant-hosts-legacy-ef0267e0e7/completion.json` confirma sucesso,
limpeza concluída, término dos filhos e nenhum banco/papel preservado. Os
artefatos do navegador foram capturados antes de seu fechamento original. Builds
dessa rodada: API `zWY7S7AvPwHTl8TUb4CeS`, web `q_qL-hP87HrDszOcj6H0K`. T5/T6
Better Auth também passou a especificação original: sete casos em sete, sem
skips, em 5,86s. Builds: API `zWY7S7AvPwHTl8TUb4CeS`, web Better Auth
`r2B-vsczGQAqwkg72XsRq`. O mesmo contrato de hosts/catálogo/detalhe registrou
zero erros de página e de captura, sem fabricar respostas ou autenticação.
`tenant-hosts-better-auth-a99ccdf7a6/completion.json` confirma sucesso, término
observado dos filhos e limpeza concluída, sem banco/papéis preservados; a
captura do navegador antecede seu fechamento original. Naquela rodada o aceite
visual ainda estava pendente; o aceite humano posterior não amplia T5/T6 a
jornadas de identidade, carrossel 3D ou alterações posteriores.

P1/A10 está parcial, com o loader validado no escopo local de rede normal. O
percentual agora é DOM React irmão do Canvas, confirmado por URL carregada,
preservando fit, ScrollReveal, espera de 200ms, timers e rotação. Caracterização
5/5, tipagem focada sem diagnósticos e sensibilidade à fonte anterior passaram.
Na captura normal `2026-10-09T00-39-31-220Z`, com web compilado Better Auth e
GPU real, houve zero erros de página/probe, cinco marcos e análise radial
completa: primeiro Compressor sem fit sustentado e Betoneira positiva. O
coordenador revisou 354 quadros decodificados/14,16s. A captura Slow 3G
`2026-10-09T00-40-02-378Z` teve zero erros de página/perdas de contexto ativo,
vinte descartes comprovados e 6.874 quadros do Compressor; a Betoneira não
desenhou em 150s. Faltaram controle positivo e dois marcos: resultado
inconclusivo, sem estender o limite. Ver
`a10-temporal/manual-review-final.json`, na base local desta retomada, e
entrada 334. Fonte preservada em SHA-256
`5c3c525df965282b1ba0650282e2bcb4453b7eda09f85f60d9db9a915aaa6c2f`. HDR neutro
sintético, Draco local e backend de fixture não certificam CDN, iluminação real,
infraestrutura de produção ou identidade. Aceite visual e aceite integral A10
continuam pendentes; 167/321 não têm fechamento universal.

Os seis gates estáticos passaram; isso não substitui o comportamento HTTP. O
primeiro ensaio unitário amplo foi interrompido porque o runner neutralizou
opções como valores vazios inválidos e bloqueou também o transporte simulado.
Com o perfil ajustado ao CI, o ensaio de 77 casos passou, incluindo banco, Asaas
simulado, hook no Git Bash e a caracterização da Sobre. A suíte ampla passou
6.153 casos, com duas falhas e treze skips. As provas foram corrigidas (ordem
incidental de pagamentos e mapa sem a migration SEO nova); a rodada final passou
6.199 casos em 179 arquivos, com treze skips. Segurança passou 1.684 casos,
identidade 855 e testes dos gates 280. Tipagem da raiz, arquitetura, tokens,
nomes, documentação, CSS e lint passaram. Ferramentas de paridade visual
passaram 27/27 e higiene passou. Os três builds de produção locais foram
renovados no modo `legacy`, sem regravar fixture ou baseline visual. A rodada
visual completa foi interrompida por ambiente inválido e não certifica o
produto; era uma etapa histórica anterior à composição visual registrada acima.
Aceite visual e aceite integral do carrossel permanecem pendentes. Nenhuma
credencial ou serviço externo de negócio foi utilizado.

P1/empacotamento passou em Node 24.21.0, no modo `legacy`, com configuração
sintética, leitura de `.env` isolada e telemetria desligada. Bundles Android/iOS
e Storybook estático ficaram em scratch: seis artefatos principais com
bytes/SHA-256 conferidos, 172 entradas no catálogo (156 stories e dezesseis
docs). Evidência:
`p1-packaging-20261008T233956Z-97adb62ec1a44850be746df26b0c0cc0/summary.json` na
base local desta retomada. Isso não encerra aceite visual, A10, aparelhos,
homologação, distribuição ou aposentadoria da raiz.

As expectativas preservam comportamentos existentes que merecem revisão em outro
escopo: agregados financeiros não aplicam o fallback por lançamento; "Top 10
ROI" usa `slice` sem ordenar; receita mensal inclui data futura; o portal
devolve relações brutas de equipamento/orçamento. Não foram corrigidos
silenciosamente nem aprovados como regras novas. Ver testes financeiros,
dashboard e portal e as notas locais de evidência.

Evidências desta retomada: `%TEMP%/locadora-wave135-resume-20261008/`. Naquela
retomada os quatro registros v2 e as duas comparações B11 estavam concluídos,
mas não autorizavam retirar a antiga raiz. A autorização humana posterior levou
ao clone de P2; a evidência v2 pré-F permanece histórica e não certifica
mudanças nesse clone.

O saldo estimado no handoff daquela retomada, §§8–9, era: **4,5–18 h ativas** de
triagem/aceite visual, A10 e fechamento local; a captura/composição já executada
não entra novamente. Docker **1–4 h** após desbloqueio; Git/P2/F **18,5–46 h**
somente após autorização e aceites, condições históricas anteriores à decisão
humana de 2026-10-09 e à publicação inicial. Total condicionado **24–68 h**,
confiança baixa, sem espera externa ou reparos ainda desconhecidos. Os **59–158
h** anteriores são históricos. HTTP v2, jornadas e T5/T6 fechados não entram
como nova repetição geral; baterias do clone/P2 e pós-F pertencem a estados
futuros sem raiz. O backlog SaaS amplo não foi reestimado de forma exaustiva.

A auditoria executada antes deste fechamento documental,
`final-audit-before-checkpoint/audit.json`, terminou exit 0: as 478 entradas
iniciais foram contabilizadas (408 com bytes iguais, 68 alteradas no escopo e
dois D preexistentes), sem perda nova, staging ou nova exclusão. Três retornos
conhecidos ao HEAD nas fontes de paridade explicam a diferença do inventário:
506 arquivos dirty e 31 adições fora do baseline. HEAD `873d8fbc` e `.expo`
original preservados. `cleanupComplete=true`, zero recursos próprios
pendentes/não confirmados e `auditProblems=[]`; PostgreSQL próprio parado com
exit 0 e dados preservados. Essa prova antecede a última atualização Markdown; a
renovação da atestação era o próximo passo daquele checkpoint documental; esse
registro não atesta o clone pós-F. Gates de
arquitetura/tokens/nomes/CSS/higiene, lint global e tipagem ampla (14 tarefas)
terminaram exit 0.

## Onda 134 — conta de recebimentos com faturamento exato e conteúdo da vitrine por locadora (2026-10-07, sem commit)

### Lote S9 — criação da conta de recebimentos

**Rotas.** `app/api/admin/payment-account/create/route.ts` (caminho antigo) e
`apps/services/api/src/app/api/admin/payment-account/create/route.ts` seguem a
forma de `recovery`: `resolveTenantPrincipal`, 403 `OWNER_REQUIRED` para quem
não é ADMIN, `GET`/`POST` explícitos, `private, no-store` +
`Vary: Cookie, Host`, 503 genérico, `dynamic='force-dynamic'`,
`runtime='nodejs'`, `revalidate=0`. As duas delegam a
`handleConfiguredPaymentAccountCreation`
(`packages/backend/src/runtime/platform-jobs.ts`). O handler
(`packages/backend/src/http/owner-payment-account-create.ts`) exige origem exata
do painel, sessão recente (10 min) do mesmo usuário, corpo JSON até 16 KiB e
`CreatePaymentAccountInputSchema` estrito; responde 202 `{accepted:true}` sem
eco. O gate (`entitlements/request-access.ts`) trata a leitura e o `POST` de
`create` como configuração em SETUP; em RESTRICTED o pedido continua 402 e em
ARCHIVED, 403.

**Composição.** `runtime/subaccount-creation.ts` lê uma vez, para os dois hosts,
`PLATFORM_SUBACCOUNT_CREATION` (`on`, `off` ou inválido; ausente = `off`), o
modelo (só `STANDARD`), ambiente, chave raiz, `PLATFORM_WEBHOOK_ORIGIN`,
`PLATFORM_OPS_EMAIL`, cofre, site da locadora por `canonicalOrigin` e
`PLATFORM_SUBACCOUNT_REQUIRES_PAID` (ausente = `true`). O caso de uso do pedido
nunca recebe a chave raiz. `runConfiguredPlatformJobs` roda sempre a manutenção
dos pedidos e só instala o worker de criação com a configuração completa.

**Contrato e dados.** `packages/contracts/src/payment-account.ts`:
`CreatePaymentAccountInputSchema` (faturamento `MoneySchema` com duas casas,
`BrazilianMobilePhoneSchema`, confirmação e `companyDataVersion`, SHA-256 dos
dados da empresa exibidos) e `PaymentAccountCreationOfferSchema` estrito (nove
bloqueios, três desfechos do pedido anterior); `INCOME_RANGES` saiu. Migration
`202610060101_payment_account_provisioning_requests`: tabela de pedido no perfil
`platform` (`platform_runtime` com SELECT/INSERT/UPDATE, `app_runtime` sem
nada), FORCE RLS, sem DELETE, trigger de purga única; `incomeRange` sai com
preflight por CHECK (um SELECT do migrador veria zero linhas sob FORCE RLS).

**Worker e saúde.** `payment-accounts/subaccount-provisioning.ts` busca por
CNPJ, grava a intenção sob lock do CNPJ com a inspeção da onda 129 já na fila,
faz um único `POST /accounts` com o faturamento e o celular exatos e sela a
chave na primeira transação depois da resposta. Incerto segue só com a inspeção
GET; recusa definitiva sem conta cancela e devolve ao dono; chave raiz recusada
espera 1 h. `configuration.ts` faz a saúde por modo: integração da subconta
`ACTIVE` só na primeira aprovação completa, sem rebaixar; na aprovação grava
`documentNormalized` junto com `documentVerifiedAt` e, se outra locadora já
verificou o CNPJ, confirma sem verificar e audita
`payment-account.document.in-use` (terceira rodada). `webhook.ts` responde
`IGNORED`/`ACCOUNT_PROVISIONING` a evento de subconta em criação.
`billing/receiving-account-readiness.ts` é a barreira 409
`PAYMENT_ACCOUNT_NOT_READY`, chamada por `payment-request.ts` e
`quotations/boleto.ts`.

**Web.** `packages/frontend/src/pages/recebimentos-admin`: cartão "Criar conta
de recebimentos" antes da conexão própria; o faturamento só é enviado depois de
digitado (o `CurrencyInput` informa 0 no blur) e é limpo ao cancelar, enviar,
sair ou trocar de locadora. Com a criação desligada a página é idêntica à de
antes (comparação do HTML inteiro). Expo sem código novo.

**Provas.** Dublê `tests/helpers/fake-asaas`, PostgreSQL descartável com os
papéis canônicos, sem Asaas real:
`tests/identity/subaccount-provisioning-database.test.ts` (96 casos: oferta READ
ONLY, gravação atômica com falha injetada, replay, CNPJ em uso, matriz do
worker, saúde, barreira, aprovação legada), `tests/unit/billing-database`,
`connected-account-configuration`, `subaccount-creation-configuration`,
`owner-payment-account-create-{http,routes}`, `migration-preflight-rls`,
`tests/security/secret-leak.test.ts` (T-S3, console lido como é impresso) e
`tests/api-host/owner-payment-account-create.http.test.ts` pelo proxy compilado
nos dois hosts e motores (corpo do POST conferido). Cerca de 120 mutações em
três rodadas, restauro por sha256; a única sobrevivente (V22) é equivalente,
porque o banco recusa aviso retirado.

### Lote vitrine-conteudo — conteúdo institucional e textos legais por locadora

**Leitura pública.** `GET /api/settings/public` (os dois hosts, mesma composição
`createPublicCatalog`) ganha `siteContent` (lido chave a chave por
`parsePublicSiteContent`; chave fora do contrato sai e é registrada) e
`legalDocuments` (só booleanos de disponibilidade). Contratos em
`packages/contracts/src/{settings,storefront-legal}.ts`.

**Rotas novas, mesma composição nos dois hosts.**
`GET /api/settings/public/legal-documents/{terms|privacy|return-policy}`
(superfície `identity`: LIVE e PAUSED respondem, OFF dá o 404 do D10,
`no-store`) e `GET/PUT/DELETE /api/admin/settings/legal-documents/{kind}`
(`SETTINGS` READ/WRITE, mesma origem, até 256 kB, linha travada com FOR UPDATE,
auditoria `STOREFRONT_LEGAL_PUBLISHED`/`UNPUBLISHED` só com hash e tamanho).
Fábricas em `packages/backend/src/http/storefront-legal.ts`. Em RESTRICTED só
`PUT`/`DELETE` dessas rotas passam na admissão do S8 (D-D).

**Host web.** `/api/settings/public/legal-documents/*` em `TENANT_API_ALLOWLIST`
e `PUBLIC_TENANT_QUERY_ROUTES`; as páginas legais leem o documento no servidor
(`null` só no 404; 5xx lança). Na pausa o proxy deixa as legais no ar (200,
`X-Robots-Tag: noindex`, `no-store`) e o resto da vitrine segue no 503 com
`Retry-After: 3600`.

**Dados.** Migration `202610060201_settings_site_content_legal`: colunas em
`settings` (`siteContent` e os três documentos com `*PublishedAt`), CHECK de
forma e de tamanho, sem tabela, papel ou política nova.

**Provas.** `storefront-legal.http.test.ts` e
`storefront-legal-paused.http.test.ts` no perfil do CI nos dois motores,
`storefront-legal-rls.test.ts` (papel NOBYPASSRLS),
`settings-site-content-legal-columns.test.ts`, goldens de texto da GB
(`tests/unit/gb-site-content.textos.test.tsx`, Sobre byte a byte), script da GB
em banco descartável (simulação, `--apply`, repetição `upToDate` depois de o
dono mudar o painel, recusa em outra locadora) e linha de base visual 2x com a
GB sem frota (48 aprovações D-B por elemento).

### Lote acl-testes

`tests/api-host/global-setup.ts` e 24 arquivos de paridade alteram privilégios
do papel de runtime só por `alterSharedAcl` (`tests/helpers/shared-acl.ts`),
numa transação que começa por
`pg_advisory_xact_lock(hashtext('gb-locacoes:tests'), hashtext('shared-acl'))`.
Nenhuma rota, composição ou resposta mudou.

### Resultado consolidado do `test:api`

Perfil do CI, builds de produção dos três hosts: 60 arquivos em cada motor,
2.961 testes com `legacy` e 2.955 com `better-auth`, verdes na segunda rodada
dos dois lotes; a validação consolidada da onda roda de novo depois da terceira
rodada.

## Onda 133 — CNPJ e horário na vitrine e Origin nas leituras de conta (2026-10-06, sem commit)

**Leitura pública com horário e identificação legal (achado 147).**
`GET /api/settings/public` (os dois hosts, mesma composição
`createPublicCatalog` do `packages/backend`) devolve, além dos dez campos de
contato e destaque, `businessHours` (o horário de `settings.businessHours`, só
os dias com hora HH:MM válida ou fechados; `null` sem nenhum) e `legalIdentity`
(`legalName` de `organizations.legalName` e `cnpj` formatado: o primeiro CNPJ
válido entre `documentNormalized` e `document`; nunca CPF nem o documento cru),
lidos na mesma transação da locadora (RLS). Contrato em
`packages/contracts/src/settings.ts` (`PublicBusinessHoursSchema`,
`PublicLegalIdentitySchema`, `PUBLIC_SETTINGS_FIELDS`); regra em
`packages/backend/src/modules/catalog/public-settings.ts`. Superfície e cache
inalterados (`identity`: LIVE e PAUSED respondem, OFF dá o 404 do D10); o cartão
do diretório continua sem CNPJ. Nenhuma rota, coluna ou migration nova; a
resposta ganhou dois campos (aditivo). Rodapé, contato da home e página de
contato mostram as linhas da produção quando há dado. Provas:
`tests/api-host/public-catalog.http.test.ts` (alfa com horário e CNPJ, bravo sem
nenhum e sem os da alfa, corpo idêntico entre legado e serviço) no perfil do CI
nos dois motores (legacy 57 arquivos/2.897 testes; better-auth 57/2.891),
`tests/unit/catalog-http.test.ts`, `public-settings.test.ts` (coluna fora do
contrato nunca sai) e prova HTTP direta nos dois backends reais com papel sem
BYPASSRLS: GB com o horário do script e o CNPJ, Locadora Nova sem nenhum, corpos
idênticos. Segunda rodada: a trava do `--apply` de `tools/gb-site-settings.mjs`
(`checkGbOrganization`) passou a conferir o mesmo documento que a identificação
legal da vitrine mostra (o normalizado do cadastro da plataforma antes do
legado, primeiro não vazio, só sem a máscara `[./-\s]`), provado contra
`publicLegalIdentity` em `tests/unit/gb-site-settings.test.ts`. Antes conferia o
legado primeiro e tirava qualquer caractere que não fosse dígito: o legado da GB
com o normalizado de outra empresa liberava o `--apply` com o CNPJ da outra no
site.

**Sigla e avaliações (achado 146).** As telas de recuperar e redefinir senha
(web e native) usam a sigla de `useMarcaDoAcesso`; a prévia SEO do painel perdeu
a linha "4.9 · 500+ avaliações". O T12 ganhou os padrões "sigla da GB como
marca" e "contagem fixa de avaliações".

**Tokens (achado 148).**
`--status-{info,warning,success,danger}-{surface,text,border}` e
`--surface-admin-canvas` em `packages/design-tokens/src/tokens.css`, com valores
iguais aos da paleta (conferidos em `primitives.test.ts`), substituem as 29
classes `bg-/text-/border-[var(--color-*)]` do `AdminLayoutShell` e dos selos de
logística e manutenção. `pnpm tokens` verde sem baseline nova; duas capturas
visuais sem pendência nova em relação à onda 132.

**Leituras de conta (achado 149).** Fora do principal privado, as leituras de
conta seguiam a política de métodos seguros. Consumidores caracterizados antes
da recusa: o seletor do painel no `app.` e o app nativo
(`/api/auth/organizations` e o GET de `/selection`, que o proxy já nega no host
de locadora), a área do cliente no próprio host (`/current`) e o cadastro no
`app.` (`/owner-account`, `/api/onboarding/slug-availability`). Nenhum é de
outra origem: GET de mesma origem não leva `Origin`, e o app nativo não envia
`Origin`. As rotas `/api/auth/organizations` e `/current` dos dois hosts e o GET
de `createOrganizationSelectionHandler` chamam `rejectExplicitCrossOrigin`
depois da sessão (e do host, em `/current`) e antes de vínculo ou preferência:
403 `no-store` `{ "error": "Origem não permitida" }`, sem `Set-Cookie`; 409/404
de host e 401 mantêm ordem e envelope. `/owner-account` e `/slug-availability`
já recusavam por `onboardingAppOrigin`, agora provado nas rotas reais.

**Motores de identidade (achado 149).** `engine-read-origin.ts` é a regra única
dos dois motores. No Better Auth, `handleIdentityRequest` aplica
`refuseBetterAuthRead` em todo GET/HEAD antes de carregar o motor e o banco; no
NextAuth (modo `legacy`, o padrão, e `better-auth-v2`), o envoltório
`withSignInAvailability(NextAuth(authOptions))`
(`packages/backend/src/http/legacy-auth-response.ts`) aplica
`refuseNextAuthRead` antes do motor e da releitura da credencial. Ficam de fora
as navegações que chegam de outro site por desenho e se protegem por state, PKCE
ou token: no Better Auth `/callback/:id`, `/callback/:id/oauth-proxy`,
`/oauth-proxy-callback`, `/expo-authorization-proxy`, `/verify-email`,
`/reset-password/:token`, `/delete-user/callback` e `/error` (segmento variável
só `[A-Za-z0-9_-]`); no NextAuth `/callback/:provider` e `/error`. POST segue
com a defesa própria de cada motor. O inventário (`HANDLER_WRAPPERS`) só aceita
`refuseNextAuthRead(request) ??` antes do NextAuth. Provas in-process nas rotas
reais dos dois hosts: `tests/security/account-read-origin.test.ts` (84),
`identity-read-origin.test.ts` (126) e `nextauth-read-origin.test.ts` (146);
13 + 14 mutações de produção mortas, restauro conferido por sha256.

## Onda 132 — vitrine da própria locadora e Origin nas leituras (2026-10-06, sem commit)

**Pausa neutra (achado 142).** `TenantSiteProviders` monta o `ClientLayoutShell`
com `chrome="none"` quando o segmento renderizado é `site-pausado`
(`useSelectedLayoutSegments` acompanha o rewrite do proxy, não o caminho
visível). A `MolduraSitePausado` traz marca e nome da locadora, o aviso com
contato e área do cliente e um rodapé mínimo (nome, cidade/UF e copyright), sem
navegação da vitrine nem links legais (as páginas legais também estão em pausa).
Prova no build de produção: 66 verificações, 503 com Retry-After e noindex, só
os hrefs `tel:`, `wa.me`, `mailto:` e `/area-cliente`.

**Dados da GB fora do modelo (achado 143, T12).** A identidade pública vem do
cartão (`IdentidadePublicaProvider`, alimentado pelo layout `[locadora]`); a
sigla fica em `model/marca.ts` (módulo puro, chamado também pelo servidor).
Cabeçalho, rodapé, WhatsApp flutuante, "Por que escolher", contato, mapa,
avaliações, JSON-LD, SEO do equipamento, orçamento pelo WhatsApp e telas de
entrada usam só dados da própria locadora; o que falta fica de fora. Saíram os
fatos da GB sem fonte por locadora (região fixa, construtoras, anos de mercado,
números, nota fixa); a região vem da cidade/UF do cartão; a página Sobre ficou
neutra. O formulário de configurações perdeu os padrões da GB (salvar gravava os
dados da GB em outra locadora). O orçamento pelo WhatsApp abre no próprio clique
(bloqueador de pop-ups). `tests/unit/t12-sem-dados-da-gb.test.ts` varre
`packages/frontend/src`, `packages/ui/src` e `apps/clients/{web,mobile}/src`.
`tools/gb-site-settings.mjs` grava os dados da GB nas configurações da
organização GB no corte (simulação por padrão, `--apply` explícito, só campo
vazio, recusa organização com outro CNPJ), com teste em banco descartável e
runbook `docs/operations/gb-site-settings.md`. O site da GB não fica idêntico só
com o script: os fatos institucionais dependem da decisão D2 e os textos legais
seguem U5 (horário e CNPJ passaram a ter leitura pública por locadora na onda
133; D2 e U5 foram decididos em 2026-10-06 e entram na onda 134).

**Origin nas leituras privadas (achado 144).** O principal comum
(`createTenantPrincipalResolver`; por ele `requireTenantPermission` e os
middlewares de `requireAdmin`) chama `rejectExplicitCrossOrigin` logo depois do
vínculo revalidado e antes da admissão da assinatura e dos dados; a função mudou
para `packages/backend/src/modules/identity/same-origin-mutation.ts` e
`http/explicit-origin.ts` a reexporta. Origin de locadora irmã, do painel num
host de locadora, `null` ou `Sec-Fetch-Site` cross-site com Origin dão 403
`no-store` `{ "error": "Origem não permitida" }` em qualquer método; sem Origin
(navegação, app nativo, servidor) a leitura segue. Membro sem o papel da rota
que manda Origin estrangeira recebe o 403 de origem em vez do 403 de papel.
Provas: `tests/api-host/private-read-origin.http.test.ts` (46 casos nos dois
hosts), `tenant-principal-request.test.ts` (109), checagem estrutural no
inventário e `test:api` no perfil do CI 2.897 (legacy) e 2.891 (better-auth).
Leituras de conta fora do principal (organizations, owner-account,
slug-availability e os GET dos motores) seguem a política de métodos seguros:
onda 133.

**Infraestrutura de testes (achado 145).** `vitest.api.config.ts` com
`fileParallelism: false`; prazos explícitos medidos nos casos pesados
(`legacy-auth-composition`, `customers-http` com mocks isolados por caso, selo
de classes do inventário); a guarda do banco calcula o destino como o driver pg
8 (query, PGHOST/PGPORT/PGDATABASE/PGUSER, chave repetida conferida pelo
primeiro e pelo último valor) e exige host e porta escritos no
`TEST_DATABASE_URL`; o servidor de integração recebe vazias as chaves dos `.env`
que o shell não define; a catraca de paleta conta `var()` de paleta em fallback,
`color-mix`, gradiente, sombra, `theme()` e `--theme()`; `@source not` para
`apps/clients/web/src/proxy.ts`, `apps/clients/web/src/host/routing`,
`apps/clients/web/src/host/server` e as Route Handlers do host web. Limites
aceitos (modelo de erro acidental, não adversário): grafias como
`bg-[VAR(_--color-…)]` ainda fogem da catraca, e URLs `socket:` com porta na
autoridade divergem da leitura do pg na guarda.

**Pendente.** `pnpm tokens` vermelho: 29 classes de paleta mudaram de grafia em
arquivos divididos (`AdminLayoutShell.web.tsx` e os dois `tipos.web.ts`); troca
por tokens semânticos na onda 133. Sigla "GB" nas telas de recuperar e redefinir
senha e nota fixa na prévia SEO do painel: onda 133.

## Onda 131 — estabilização das suítes (2026-10-06, sem commit)

**Paridade HTTP (achado 138).** O vermelho de `test:api` na validação da onda
130 (34 arquivos, 158 testes) veio de rodar fora do perfil: `--maxWorkers=2`
sobrescreve o `maxWorkers: 1` de `vitest.api.config.ts`, e os arquivos de
`tests/api-host` dividem servidores, papel de runtime e fixtures (38 deles mudam
esse estado no meio do teste). Agora `tests/api-host/global-setup.ts` recusa
mais de um worker antes de qualquer escrita ou servidor. O perfil oficial é o do
CI: `pnpm exec next build` e `pnpm build:api`, depois
`API_HOST_MODE=production API_LEGACY_MODE=production pnpm test:api` com
`API_AUTH_MODE` legacy e better-auth, sem `--maxWorkers`; em dev, 49 asserções
só de produção (cookie `Secure`, erro genérico sem `details`) falham por
desenho. Duas falhas eram reais: desde a onda 97 a requisição real chega ao
principal e GET é método seguro, então GET com Origin de locadora irmã voltou a
ler `/api/admin/badges` e as leituras de WhatsApp nos dois hosts, contra as
ondas 45 e 49; `rejectExplicitCrossOrigin`
(`packages/backend/src/http/explicit-origin.ts`, com `zoho-origin.ts` delegando)
roda depois do papel e antes dos dados nas 8 rotas. E `whatsapp-write` afirmava
503 para locadora SUSPENDED, contra a onda 89: o teste novo prova recibo adiado
sem efeito e processado uma vez após o desbloqueio.

**Integração (achado 139).** A onda 130 fez `ensureTestTenant` publicar a
locadora de teste (`publishTestOrganizations`), que chama
`requireTestDatabase(process.env)` no worker depois de `tests/setup.ts` gravar
DATABASE_URL/DIRECT_URL com o banco de teste; a guarda comparava o banco consigo
mesmo. `applyTestDatabase(env)` (`tests/helpers/test-database.ts`) valida,
registra os originais num WeakMap por objeto de ambiente (símbolo do processo,
nunca variável de ambiente) e só então grava o banco descartável; a guarda
isenta só o valor exato gravado e continua recusando DATABASE_URL/DIRECT_URL
real igual ao de teste. `quote-boleto` deixou de contornar a guarda.
`test:integration` e `test:api` não rodam juntos na mesma árvore (o Next 16
admite um `next dev` por pasta).

**Identidade, segurança e unitários (achado 140).** Fixture de reativação com
`sellableFrom` fixo (o default do banco usa o relógio real e a oferta virava
"futura" no relógio sintético); dublê da inbox com `organization.findUnique` da
trava administrativa da onda 88, mais casos SUSPENDED e ausente; mock parcial de
`@prisma/client` (`importOriginal`) no teste do runtime; preflight da migration
`202610030110` (não implantada) com `migrate resolve --rolled-back` e `deploy`
na mensagem, só texto.

**Plataforma, web e paridade visual (achado 141).** `onboarding.ts` usava
`document` como nome de parâmetro (trava léxica do contrato universal); a
varredura do basePath ganhou prazo de disco de 60 s e pré-filtro; testes de
texto da fonte aceitam aspas simples ou duplas; `useNavigate` classificado como
infraestrutura `navigation`; as chamadas do menu do painel ficaram em
`PANEL_ONLY` (allowlist do host de locadora intocada, com teste do motivo); a
paridade compara o tom da paleta por variável com a classe da produção, e a
variável `paused` do proxy (que gerava o utilitário `.paused`) foi renomeada.

**Validação em série no perfil do CI** (bancos novos, uma suíte por vez):
lockfile, prisma, arch, typecheck, type-check, lint, lint:css, tokens,
check:tokens, hygiene, nomes, ratchet e docs verdes; identidade 693, plataforma
3.399, web 314, mobile 99, contrato 106, gates 185, visual-tools 22, integração
81/81, API compilada 2.851 (legacy) e 2.845 (better-auth); builds web, legado e
API verdes. Unit 4.798/4.803 e segurança 873/874: os casos restantes
(`legacy-auth-composition`, `customers-http` e o selo de classes do inventário)
estouram tempo só sob carga e passam sozinhos; tratados na onda 132. Nenhuma
baseline, allowlist, timeout ou asserção de segurança foi afrouxada.

**Decisão aberta.** As demais leituras privadas ainda aceitam Origin explícito
de locadora irmã (política genérica de métodos seguros); a onda 132 generaliza a
recusa no principal comum.

## Onda 130 — site por estado e jobs de divulgação (2026-10-06, sem commit)

**S13 (achado 136).** Regra única e pura em
`packages/domain/src/assinatura/site.ts` (`decidirModoDoSite`): bloqueio
administrativo ou site não publicado dão OFF em qualquer fiscalização; com
fiscalização on, FULL dá LIVE, RESTRICTED dá PAUSED, SETUP e ARCHIVED dão OFF;
off e shadow tratam o acesso como FULL (shadow registra `[site-shadow]` quando
on mudaria). Só LIVE com `siteIndexable` é indexável. A área do cliente segue
`decidirAreaDoCliente` (linha "Área do cliente final" da B.5), separada da
vitrine. O resolvedor público do backend aplica as duas regras para os dois
hosts, com a consulta tipada por `PublicOrganization`. Cada rota declara a
superfície:

- storefront (padrão): PAUSED dá 503 `SITE_PAUSED` com Retry-After 3600,
  no-store e noindex, sem transação da locadora; OFF dá o 404 do D10;
- identity (cartão e configurações): continua em pausa, com `x-site-mode` e
  `x-site-indexable`;
- card com `?scope=client-area`: responde enquanto a área do cliente existir;
- client-area (`/organizations/current` e enroll): regra da área do cliente.

Host web: a decisão do proxy segue pura (`decide.ts`); nas páginas da vitrine o
proxy lê o cartão (prazo de 3 s; sem resposta segue o rewrite normal) e, em
pausa, reescreve para `/{slug}/site-pausado` com 503 real; em LIVE não indexável
envia `X-Robots-Tag: noindex`. O layout `[locadora]` aplica noindex e o 404 do
D10; as páginas da vitrine ficaram no grupo `(vitrine)`. `robots.txt` e
`sitemap.xml` respondem por estado. Página de pausa FSD (`pages/site-pausado`,
`widgets/site-pausado`) com `@gb-locacoes/ui` e tokens. Web e Expo mostram a
mensagem neutra do 503. As fixtures publicam pelo papel restrito de plataforma
(`tests/helpers/public-site.ts`), como a migration 0104 fez com as locadoras
vivas. Nenhuma migration, grant, flag ou baseline nova; os dois handlers de SEO
foram declarados no inventário de autorização com referências exatas.

**S8, jobs de divulgação (achado 137).** O runner único `createTenantCron`
(`packages/backend/src/http/tenant-cron.ts`), usado pelas fachadas dos dois
hosts, exige `job` declarado no catálogo `TENANT_CRON_JOBS`: sete obrigações
(auto-convert-quotes, boleto-overdue-alerts, expire-quotes, late-fees,
preventive-maintenance, send-notifications, verify-boleto-payments) e uma
divulgação (sync-google-merchant, em quarentena). Job sem declaração é erro de
tipo e, em execução, 500 antes de qualquer consulta. Divulgação: off não lê
acesso; shadow registra `[tenant-cron-shadow]` e executa; on roda só FULL e
lista as demais em `skippedTenants`. Obrigação nunca lê a flag nem o acesso. A
agenda (checkpoint, orçamento e reserva) é tudo ou nada, no tipo e em execução.

**Validação.** S13: 130 casos (platform), 99 (web) e 123 (dois hosts reais)
focados, 28 de 28 mutações mortas e 70 de 70 verificações HTTP nos builds de
produção com fiscalização on (LIVE 200; PAUSED 503 com contato e link da área do
cliente; OFF igual ao 404 da locadora desconhecida; robots/sitemap e APIs nos
dois backends). S8: 21 casos do runner, 42 de banco, 171 de segurança e 13
mutações mortas. Tipos, lint, arch, nomes, higiene, ratchet e os três builds
passaram. A validação consolidada (todas as suítes com bancos novos) encontrou
falhas em test:api, test:integration, identidade, segurança, unitários,
plataforma, web e paridade visual, tratadas na onda 131. O cluster PostgreSQL de
teste local estava danificado (arquivos de template1/template0 ausentes) e foi
substituído por um cluster novo; o antigo ficou guardado sem apagar.

**Decisões abertas.** Leitura do cartão pelo proxy a cada página da vitrine (D2
da ADR de hosts previa proxy puro; cache curto ou ISR no Lote 9); páginas legais
(`/termos`, `/privacidade`, `/cookies`, `/politica-devolucao`) em pausa;
republicar organizações SUSPENDED na 0104 quando o bloqueio for revogado;
`PLATFORM_SUBSCRIPTION_ENFORCEMENT` inválido no site (hoje aplica on; a admissão
do S8 responde 503); valor do Retry-After (3600 s); despublicação
(`DELETE /api/admin/site/publish`) sem modelo de dados definido; ARCHIVED nas
obrigações (B.5 prevê só entrada e conciliação). Legado, scheduler e flags reais
preservados; sem commit, push, deploy ou produção.

## Onda 129 — consulta de subconta com criação incerta (2026-10-05, sem commit)

Billing fornece busca limitada por CNPJ com confirmação por id, transportando
somente referências sanitizadas. Payment-accounts consome apenas a porta de
consulta; runtime instala o tópico provisioning-recovery somente com credencial
raiz configurada. Cron legado e novo compartilham a mesma composição e fila, sem
scheduler adicional, regra no host, rota nova ou contrato HTTP alterado.

UNKNOWN nunca repete criação. Ausência/indisponibilidade agenda outra consulta;
dados inválidos/conflitos bloqueiam para revisão. Conta encontrada sem chave
local exige recuperação manual, mantendo integração PROVISIONING. Leases,
owner/documento, binding da integração/chave e versão do trabalho são
revalidados após I/O. Atualizações de referência/estado/auditoria são atômicas.

O POST do adapter aceita renda mensal explícita e webhook embutido, protegendo a
chave única da resposta e marcando sucesso inválido como incerto. Ele ainda não
é chamado pelo consumidor de criação: a decisão humana sobre faturamento mensal
ou faixas está pendente. Nenhuma faixa foi convertida silenciosamente; contratos
e schema persistido continuam iguais. S9 ainda não está concluído.

Validação consolidada: 117 unitários de adapter/recuperação/configuração e
recuperação financeira, 106 do contrato simulado Asaas e 57 PostgreSQL de
saúde/recebimentos passaram (280 casos). Os três novos casos de banco verificam
concorrência, tenant forjado, rollback da auditoria e os cron hosts reais com
transporte root GET-only. Não houve nova prova HTTP de servidor compilado nem
homologação externa neste bloco. Tipos dos doze projetos, raiz e testes novos,
lint afetado, arch, nomes, higiene, ratchet e builds da API/legado passaram.

Duas tolerâncias de higiene obsoletas encolheram por consumo real:
parseAsaasAccountCreation e OutboxMessage. Nenhuma proteção foi ampliada ou
suíte excluída. A diferença de fuso na primeira expectativa de teste novo foi
corrigida para preservar a semântica existente de data civil Asaas.

Legado/proxy/scheduler e flags reais preservados, sem commit, push, deploy,
produção ou Asaas real. Geral ~60% permanece estimativa sem denominador medido.
Próximo corte dependente: coleta/persistência da renda após decisão humana e
provisionamento completo com selagem imediata. Reparo/retomada auditada,
documentos/saque, S13/backoffice, aceites externos e retirada do legado seguem
pendentes.

Status: intermediário, atualizado localmente em 2026-10-05. Não publicado.
Inventário atual de fontes: 170 rotas/215 métodos explícitos em cada host, mais
ensaio local dos consumidores, rollback de sessão e aceite HTTP/SSR operacional
nas ondas 58/59. Os cortes abaixo registram a evolução; não certificam cutover,
paridade em dispositivo ou conclusão comercial.

## Onda 120 — consulta dos recebimentos (2026-10-04, sem commit)

GET /api/admin/payment-account é montado nos dois hosts sobre um único núcleo
payment-accounts/owner-read e a composição existente. O dono atual é revalidado
no snapshot READ ONLY/RepeatableRead sob RLS. Usa o papel de negócio que já
possui SELECT scoped; não exige conexão privilegiada extra, abre cofre ou faz
I/O com o provedor. POST não foi montado.

Web recebe /admin/recebimentos sobre página/entidade FSD e primitivas
existentes. Mostra estados, pendências e datas confirmadas, com atualização
explícita. O transporte permite `cache: 'no-store'`; dados antigos não passam
para a nova locadora/identidade. Menus desktop/web estreita usam a confirmação
existente do dono. Checklist aponta para a consulta; sua implementação original
ganhou prova real de aprovação e integração desativada.

A verificação compilada encontrou a moldura administrativa ausente no host web.
AdminLayoutShell agora compõe os widgets existentes em frontend/app, reutilizada
pelo layout legado e pelo host fino. O guard legado conserva sua política. O
seletor validado pelo PrivateAreaGate fica dentro do main, abaixo dos cabeçalhos
fixos; sem seleção continua visível e o conteúdo privado permanece fechado. Não
há segunda seleção, leitor de sessão ou regra de autorização na moldura.

460 casos distintos passaram em 20 arquivos: 158 unitários, 124 de plataforma,
nove do host web, 91 PostgreSQL e 78 do inventário de segurança. Reexecuções não
aumentam a contagem. Os 12 projetos TS, typecheck raiz, lint afetado, lint CSS,
arch, tokens, nomes colocados, higiene e ratchet contra 55763c1e passaram. A
higiene conserva 825 achados aceitos/242 itens; só saíram quatro exceções
obsoletas de tipos agora usados pelo produto. Zero css-important e nenhuma
tolerância nova. Builds web, API e legado passaram.

Os builds locais passaram em 42 verificações: 22 HTTP reais e 20 do Chrome com
fixtures de identidade/conta. GET/HEAD sem sessão devolvem 401 privado, HEAD sem
corpo, OPTIONS anuncia GET e POST é 405 nos dois backends. O proxy web real
preserva 401/private. A página compilada mostra estados e ambiente, faz quatro
leituras explícitas ao atualizar/repetir depois de erro neutro, e não envia POST
de recebimentos. Dois POSTs preexistentes de sincronização de notificações da
moldura foram simulados; não são comandos de conta. Não houve erro de página.
Seletor dentro do main está desobstruído nos dois viewports; colapso,
abertura/Escape e largura sem overflow foram conferidos. Capturas desktop, web
estreita e menu foram inspecionadas após as animações.

A leitura do dono com papéis PostgreSQL reais é provada separadamente nos testes
de banco. Chrome usa fixtures e não homologa sessão externa, conta Asaas real,
Expo em aparelho ou fluxo de provisionamento.

Documentação, links, Markdown e formatação passaram; os processos temporários
próprios e o PostgreSQL descartável foram encerrados. As portas da prova ficaram
livres. O checkout anterior foi preservado, sem commit, push ou produção.

Não entrega criação/conexão, documentos, confirmação anual, saque, saúde
periódica ou homologação Asaas. S9/S11b continuam parciais; Expo conserva seu
escopo aprovado, legado/agenda continuam ativos, flags reais off e nenhuma
publicação/cutover foi realizada. A contagem 168/212 descreve fontes, não o
percentual geral.

## Objetivo e limites do desenho incremental (fotografia até 2026-10-02)

`apps/services/api` é o host HTTP compartilhado de destino. Next.js 16.3.6
permanece o adapter, conforme a ADR; não foi introduzido outro framework. O
primeiro corte foi leitura pública de categorias, acompanhado do health check. O
segundo acrescenta equipamentos, busca e configurações públicas. Os cortes
seguintes acrescentam disponibilidade, detalhe, cartão público e busca do
diretório e leituras autenticadas de vínculos, da preferência e do vínculo da
locadora do host e leituras privadas de motoristas, endereços do cliente e
categorias administrativas, unidades físicas e lista/detalhe administrativo de
equipamento com permissão granular e permissões administrativas do vínculo
ADMIN, além do perfil comercial, da listagem e das estatísticas das notificações
do próprio usuário na locadora. O corte 22 acrescenta marcação individual,
exclusão e marcação das não lidas da caixa. O corte 23 instala criação, edição e
exclusão de endereços, usando customers e o contrato existentes. O corte 24
monta leitura, sincronização e mesclagem do carrinho, compondo customers sem
alterar seu comportamento. O corte 25 monta a atualização do perfil comercial,
com o serviço existente e o schema legado compartilhado. O corte 26 monta o
vínculo explícito com a locadora do host usando customers/enroll e consentimento
estrito compartilhado. O corte 27 acrescenta a criação administrativa de
motoristas, usando operations/drivers e o schema legado comum em contracts. O
corte 28 monta POST de categorias administrativas sobre catalog/createCategory e
compartilha o schema estrito legado em contracts/categories. O corte 29 monta
PUT/DELETE por id, delegando aos mesmos casos de uso do catálogo. O corte 30
monta POST de unidades físicas sobre catalog/createUnit, com o schema legado
comum em contracts/equipment-units. Naquele corte os clientes continuavam finos
e sua URL/base não havia sido alterada.

O corte 31 acrescenta PATCH/DELETE de unidades por id, delegando a
catalog/updateUnit e deleteUnit. Schema de atualização também compartilhado;
posse antes do corpo, medidores, status e recusa de exclusão em uso preservados.

O corte 32 monta POST /api/admin/equipments sobre catalog/createEquipment, sem
alteração do handler legado ou do caso de uso. Limitador antes de WRITE,
normalização, categoria da locadora, DTO e erros por ambiente preservados.

Na fotografia incremental desta seção, o serviço atendia 52 GETs:
`/api/categories`, `/api/health`, `/api/equipments`, `/api/equipamentos/search`,
`/api/settings/public`, `/api/equipments/[id]`,
`/api/equipments/[id]/availability`, `/api/public/tenants/[slug]`,
`/api/public/tenants?q=`, `/api/auth/organizations`,
`/api/auth/organizations/selection`, `/api/auth/organizations/current`,
`/api/admin/drivers`, `/api/addresses` e `/api/admin/categories`,
`/api/admin/equipment-units` e `/api/admin/equipment-units/[id]`,
`/api/admin/equipments` e `/api/admin/equipments/[id]`, `/api/admin/permissions`
e `/api/user/profile`, `/api/client/notifications` e
`/api/client/notifications/stats`, `/api/cart/sync`, `/api/admin/vehicles` e
`/api/admin/logistics`, `/api/client/rentals` e `/api/client/rentals/[id]`,
`/api/quotes/[id]`, `/api/admin/quotes` e `/api/admin/quotes/[id]`,
`/api/quotes`, `/api/client/activities`, `/api/admin/rentals` e
`/api/admin/rentals/[id]` e `/api/admin/quotes/[id]/adjustments`, downloads de
orçamento/reajustes e ofícios de orçamento/lançamento financeiro, consultas de
`/api/admin/financial/aging`, `/calendar`, `/entries`, `/revenue`, `/settings` e
`/export`, além de `/api/payments/boleto/[id]/pdf`,
`/api/admin/rentals/[id]/contract`, `/api/contracts/[rentalId]/download` e
`/api/admin/clients/[id]/documents` e `/api/admin/settings`, com HEAD e OPTIONS
implícitos do Next. Também monta PATCH/DELETE de
`/api/client/notifications/[id]` e POST de
`/api/client/notifications/mark-all-read`, POST de `/api/addresses` e
PATCH/DELETE de `/api/addresses/[id]`, POST de `/api/cart/sync` e
`/api/cart/merge`, PUT de `/api/user/profile`, POST de `/api/client/enroll` e
POST de `/api/admin/drivers`, `/api/admin/categories` e
`/api/admin/equipment-units` e `/api/admin/equipments`, PUT/DELETE de
`/api/admin/categories/[id]` e PATCH/DELETE de
`/api/admin/equipment-units/[id]`, PUT/DELETE de `/api/admin/equipments/[id]`,
POST de `/api/admin/vehicles` e `/api/admin/logistics` e PATCH de
`/api/admin/logistics/[id]`, DELETE de `/api/client/rentals/[id]` e
`/api/quotes/[id]`, POST de `/api/client/rentals/[id]/request-pickup` e
`/api/client/rentals/[id]/request-extension`, POST de `/api/admin/rentals`,
PATCH/DELETE de `/api/admin/rentals/[id]`, POST de seus subcaminhos checkout,
checkin, extend e calculate-late-fee e POST de
`/api/client/rentals/[id]/extend`, PATCH/DELETE de `/api/admin/quotes/[id]`,
POST de seus subcaminhos adjustments, calculate-late-fee, convert-to-rental e
send-adjusted-quote, DELETE de adjustments/[adjustmentId] e POST de /api/quotes;
PATCH de `/api/admin/financial/settings`, de `/entries/[id]/status` e
`/entries/[id]/due-date`, DELETE de `/entries/[id]`; POST de
`/api/payments/pix`, `/api/payments/boleto/generate` e
`/api/admin/quotes/[id]/generate-boleto`, e PUT de
`/api/payments/boleto/[id]/regenerate`; POST de verificação de boleto e dos
webhooks PIX/Asaas com/sem integrationId; POST de geração/pedido de assinatura e
callback ZapSign com/sem integrationId, além do contrato administrativo e POST
de `/api/admin/rentals/[id]/client-documents`, POST de `/api/upload` e PUT de
`/api/admin/settings`: 88 rotas/116 métodos declarados (52 GETs e 64 mutações).
O ciclo de locação grava cobranças e eventos usando o backend existente; emissão
externa, assinatura, arquivo, crons e login continuam executados pelo legado.
Efeitos de assinatura, reconciliação e arquivo e adapter ZapSign têm
implementação compartilhada na onda 43; o scheduler continua único no legado.
Recepção de pagamento e ZapSign já era compartilhada. Nesta fotografia não havia
fallback, redirect ou proxy para a antiga API legada, e a rota ainda não migrada
permanecia **no legado** então configurado para clientes e scheduler. Essa
arquitetura de dois hosts explica a prova incremental, não o destino operacional
pós-F.

## Caracterização do runtime da época (fotografia incremental até 2026-10-02)

**Onda 33 (2026-10-02):** sete operações implementadas em conjunto, antes da
validação consolidada: PUT/DELETE de equipamentos, GET/POST de veículos e
GET/POST/PATCH de logística. Veículos e entregas usam factories em
backend/operations e schemas comuns em contracts/operations; handlers legados
ativos. Evidências e limites na seção da onda 33. Correção de exposição de erro
no PUT documentada na entrada 234 de known-issues.

**Onda 34 (2026-10-02):** nove operações do portal e consultas administrativas
de orçamentos, compostas sobre rentals/quotations existentes. Soft delete,
pedidos duráveis, RLS, sessão e permissões preservados. Implementação em bloco
antes da validação consolidada; evidências e limites na seção da onda 34.

**Onda 35 (2026-10-02):** doze operações do ciclo de locação, lista de
orçamentos e atividades. Schemas existentes compartilhados em contracts/rentals;
consultas de orçamentos/atividades pertencem a quotations/customers. Composição
real de disponibilidade, documentos, conversão, lifecycle e administração, sem
implementar regras no host. Evidências e limites na seção da onda 35.

| Aspecto            | Evidência no código e decisão deste corte                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Entrypoints        | Inventário: raiz com 149 `route.ts` e 193 métodos declarados; serviço com 130 rotas e 170 métodos (77 GETs e 93 mutações); web/mobile com zero handlers de backend. HEAD/OPTIONS automáticos não entram na contagem.                                                                                                                                                                                               |
| Composição         | A antiga `lib/catalog.ts` ligava `createCatalogService` ao banco/lock de locação; a antiga `lib/tenant.ts` ligava identidade/sessão. O serviço compõe catálogo público, disponibilidade, cartão, busca/rate limit, resolução pública, probe SQL e sessão real, principal privado e leituras de motoristas, endereços, categorias, unidades físicas e detalhe administrativo de equipamento com permissão granular. |
| Dependências       | Next/React já usados no workspace; runtime Prisma 7.10, adapter pg e pg 8.23 declarados em backend. Nenhum provedor ou framework novo.                                                                                                                                                                                                                                                                             |
| Middleware         | O antigo `middlewares/require-admin.ts` resolvia principal a partir de `next/headers` e aplica papel/permissão. Continuava no legado naquele corte. Proxy próprio do serviço impede captura do proxy de páginas da raiz pelo Turbopack.                                                                                                                                                                            |
| Autenticação       | NextAuth ou Better Auth são compostos pelas factories compartilhadas, sem fallback entre modos. O serviço usa sessão real para vínculos/seleção; login, callbacks, POST/DELETE de seleção e demais endpoints de identidade continuam legados.                                                                                                                                                                      |
| Autorização/tenant | Público exige slug explícito ou borda autenticada; organização ACTIVE. Privado revalida membership e contexto; o guard central de mutação é compartilhado, com recusa antes da sessão.                                                                                                                                                                                                                             |
| Isolamento         | `withTenantTransaction` mantém `set_config('app.tenant_id', ..., true)` e filtro de tenant. Sem locadora padrão, com RLS FORCE e runtime sem bypass/ownership.                                                                                                                                                                                                                                                     |
| Scheduler          | Nove rotas nos antigos `app/api/cron`; o antigo `vercel.json` da raiz agendava quatro. Outbox mantém autorização cron, orçamento e `maxDuration=300`. O `apps/services/api/vercel.json` não agendava jobs.                                                                                                                                                                                                         |
| Env/config         | O serviço lê seu ambiente; `.env.example` próprio sem credenciais. Banco continua composto por processo. `PLATFORM_*` valida a borda; `WEB_API_ORIGIN` pertence ao web e não foi alterada.                                                                                                                                                                                                                         |
| Proxy              | O web já encaminha APIs com headers de borda e allowlist. O proxy raiz protege páginas admin. Ambos preservados; nenhuma configuração de cliente aponta automaticamente ao serviço parcial.                                                                                                                                                                                                                        |
| Deploy             | Legado conserva Next/Vercel/Docker e crons. O destino já tinha config Next standalone, Vercel sem crons e `apps/services/api/Dockerfile` com contexto de build no monorepo. Nenhum deploy executado.                                                                                                                                                                                                               |
| Consumidores       | Catálogo, Hero, configuração pública, diretório e bootstrap usam os contratos existentes; mobile mantém `EXPO_PUBLIC_API_URL` e seleção explícita. URLs/base dos clientes continuam apontando ao legado; DTOs, preços, ordenação e erros preservados.                                                                                                                                                              |
| Testes             | `catalog-http`, `tenant-request`, `public-surface`, inventário estrutural e suites de identidade/segurança. Nova caracterização executada antes de mover; nova suíte compara os hosts por HTTP real.                                                                                                                                                                                                               |

## Responsabilidades e movimentos do primeiro incremento (2026-09-30)

| Código                                       | Destino/estado                                                                                                                                                                                            |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regras de resolução pública de locadora      | Movidas de `lib/tenant.ts` (caminho antigo) para factory `identity/public-tenant.ts`; facade legada preserva nomes e assinaturas usadas. Lookup de organização é injetado.                                |
| Prisma/pool por processo                     | Movidos de `lib/prisma.ts` (caminho antigo) para `backend/runtime/database.ts`; flags, tamanhos e timeouts preservados. Facade legada continua expondo `prisma` e seu probe.                              |
| Catálogo e transação                         | Continuam em `packages/backend`; `createPublicCatalog` agora tem export público consumido pelo serviço. Nenhuma regra foi copiada ao host.                                                                |
| Adapters HTTP                                | Adapters legados permanecem com seus guards visíveis ao inventário. O serviço declara rotas finas e usa factories de `backend/http` para mapear Request/Response. A equivalência de transporte é testada. |
| Sessão e vínculos privados                   | Leitor real composto no serviço e consulta compartilhada em backend/identity; emissão de sessão, callbacks e POST/DELETE de seleção permanecem legados.                                                   |
| Billing, uploads, documentos, efeitos e jobs | Ciclo de locação compartilha consulta de documentos, cobranças e outbox; emissão externa, armazenamento e consumidores/jobs continuam legados.                                                            |

As duas exceções de escrita dos slots próprios `global.__pool/__prisma` foram
transferidas no lint para o arquivo que agora possui o singleton. Não se ampliou
a lista de formas permitidas: escrever esses slots na facade antiga agora
reprova; testes também cobram exceções obsoletas e mutação fora do arquivo dono.
`runtime/no-runtime-rewrite` foi ampliada para proteger `apps/services/**`.
Nenhuma baseline ou proteção de banco/teste foi relaxada.

Os exports novos `backend/http` e `backend/runtime` estão registrados por nome
em `tools/ratchet-transfers.json`, como exige o guard para um entrypoint novo.
São pontos de composição deste incremento autorizado; o pacote permanece
server-only, a dívida continua medida e não se adicionou tolerância às
baselines.

## Contratos preservados pelo primeiro incremento (2026-09-30)

- Categories: array, seleção de campos, ordenação por nome e
  `_count.equipments`.
- Sem tenant: 409; conflitos: 400 `TENANT_CONFLICT`; inválido/reservado/inativo:
  404 neutro; falha de consulta: 500 genérico, sem detalhe do banco.
- Borda de tenant: cache de navegador e `Vary: Host`, sem cache CDN. Chamada
  explícita mantém `max-age=60, stale-while-revalidate=300`.
- Cookies/header privados não escolhem catálogo público; borda forjada não
  concede tenant. Nenhuma nova política CORS foi introduzida.
- Health: corpo 200/503 e erro genérico; detalhe fica no log do servidor.
- Seleção autenticada: GET retorna o vínculo atual ou null, sem escolha
  implícita. Mantém 401/400/503, `no-store`, `Vary: Cookie, x-tenant-id` e
  cookie HttpOnly/SameSite/Secure; POST/DELETE permanecem apenas no legado.
- Equipments: projeção pública existente, preços numéricos, imagens, períodos,
  disponibilidade e ordem por `createdAt` decrescente; cache igual a categories.
- Search: primeiro `q`, mínimo de dois caracteres após trim para decidir se
  consulta, termo original na consulta, ordem por nome, somente disponíveis,
  limite oito e Decimal textual. A seleção de locadora precede o termo curto.
- Settings: slug normalizado com trim, `TENANT_REQUIRED` na ausência e 409
  `SETTINGS_NOT_CONFIGURED` quando a locadora ativa não tem configuração.
  Somente os dez campos públicos selecionados pelo catálogo, sem SMTP ou
  scripts.
- Disponibilidade: mês ou período normalizado em UTC, limite de 366 dias,
  precedência de tenant antes de datas, sobreposição inclusiva, reserva conforme
  estado/quitação e estoque zero. Mantém o cálculo existente em rentals, sem
  acrescentar manutenção ou mudar a política de `available`.
- Detalhe: seleção pública de equipamento/category, preços numéricos, padrões
  existentes, `updatedAt` ISO e 404 neutro para ID inválido/ausente/cruzado.
- Cartão: só slug, nome, cidade, UF e logo HTTPS da própria locadora; logo
  ausente/inválido vira null. Valida novamente organização/slug/estado durante a
  leitura; query/caminho/host conflitantes mantêm 400 `TENANT_CONFLICT`.
- Busca e settings conservam seus cabeçalhos existentes, sem aplicar a eles a
  política de cache de categories/equipments.

## Execução local e validação no clone sem raiz

Os clients continuam finos. `WEB_API_ORIGIN` do web e `EXPO_PUBLIC_API_URL` do
mobile apontam para o serviço compartilhado no ambiente local aprovado; os
assets continuam no host web, separados da API. Os exemplos dos hosts não contêm
credenciais. Configurar apenas ambiente sintético ou um banco local descartável
próprio; não reutilizar `.env` de operação real.

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm db:generate
pnpm build:api
pnpm build:web
# Shell local com TEST_DATABASE_URL descartável próprio, já migrado.
$env:TEST_DATABASE_DISPOSABLE = "true"
$env:API_HOST_MODE = "production"
$env:API_LEGACY_MODE = "absent"
$env:API_AUTH_MODE = "legacy"
pnpm test:api
$env:API_AUTH_MODE = "better-auth"
pnpm test:api
```

Esses comandos descrevem o perfil vigente de `.github/workflows/ci.yml`, não uma
execução já concluída no clone. A CI aplica `prisma migrate deploy` ao
PostgreSQL descartável antes das suítes; jamais `db push` ou reset do banco
principal. Cada modo público de UI exige seu próprio rebuild web; mudar
`API_AUTH_MODE` da suíte HTTP não recompila o client nem certifica sua jornada.

`tests/api-host/global-setup.ts` inicia somente a API própria quando
`API_LEGACY_MODE=absent`. O modo `production` do serviço usa o standalone
`server.js` construído por `apps/services/api/next.config.mjs`; o modo dev não é
prova de cookies Secure ou de envelopes de erro de produção. A suíte mantém
expectativas explícitas, sucessos reais, exceções contratuais por motor e RLS
com o papel NOLOGIN/NOBYPASSRLS temporário. As fixtures de plataforma usam seus
bancos/papéis próprios, sem herdar `PLATFORM_DATABASE_URL` do operador.

O teardown observa o término dos processos criados pela fixture e tenta os
recursos irmãos. Falha de lifecycle impede SQL de limpeza destrutiva e a
conclusão de paridade. `finishRecord` só sela a rodada depois do estado final do
Vitest e da cobertura; evidência ausente, vazia, parcial, falha ou com
fingerprint/motor/perfil diferentes não constitui sucesso. Os logs e registros
ficam em `%TEMP%/locadora-api-parity-*`, fora do checkout.

O serviço usa a porta 3002 por padrão (`apps/services/api/package.json`). Para
iniciar manualmente o serviço local: `pnpm --filter @gb-locacoes/api start`.
Para imagem Linux, o contexto é o monorepo:
`docker build -f apps/services/api/Dockerfile -t locadora-api .`. A configuração
é `apps/services/api/Dockerfile`, sem dependência do antigo Dockerfile da raiz.
Build Next local não prova imagem, health/nonroot nem deploy; consultar a prova
real de `.github/workflows/api-container.yml` antes de declarar Docker aprovado.

### Resultados do primeiro incremento (registro histórico, 2026-09-30)

| Verificação                                 | Resultado naquele incremento                                         |
| ------------------------------------------- | -------------------------------------------------------------------- |
| Caracterização antes de mover código        | 112 testes aprovados                                                 |
| Matriz pública nos dois adapters e catálogo | 128 testes aprovados                                                 |
| Suíte unitária completa                     | 57 arquivos, 819 testes aprovados                                    |
| Identidade completa                         | 13 arquivos, 134 testes aprovados                                    |
| Contratos de provedores, somente dublês     | 106 testes aprovados                                                 |
| Host web                                    | 182 aprovados, 7 casos anteriores pulados                            |
| Segurança completa                          | 27 arquivos, 660 aprovados, 18 condicionais pulados; sem novos skips |
| HTTP standalone/legado e PostgreSQL RLS     | 20 testes aprovados                                                  |
| Builds API, legado e web                    | Exit 0 nos três                                                      |
| Tipos, lint, arquitetura, ratchet e higiene | Exit 0; baselines intactas                                           |
| Nomes colocados                             | 430 testes; 3 exceções anteriores válidas; nenhum órfão novo         |

O build legado da época usou conexão fictícia e fallback de sitemap P1001; o
HTTP usou banco local real. Isso não provava SEO, conectividade externa ou
produção. Os avisos concorrentes de pg já existiam; nenhuma dependência foi
atualizada nesse incremento.

### Arquivos do primeiro incremento (registro histórico, 2026-09-30)

- Host: `apps/services/api/package.json`, `apps/services/api/next.config.mjs`,
  `apps/services/api/tsconfig.json`, `apps/services/api/.env.example`,
  `apps/services/api/vercel.json`, `apps/services/api/Dockerfile`,
  `apps/services/api/src/proxy.ts`, `apps/services/api/src/host/runtime.ts` e os
  handlers categories/health.
- Backend: `packages/backend/src/modules/identity/public-tenant.ts`,
  `packages/backend/src/http/{categories,health,index}.ts` e
  `packages/backend/src/runtime/{database,index}.ts`. As antigas fachadas
  `lib/tenant.ts` e `lib/prisma.ts` delegavam a esses owners e saíram em F.
- Testes: `tests/unit/public-api-characterization.test.ts`,
  `tests/unit/database-runtime.test.ts`, `tests/api-host/global-setup.ts`,
  `tests/api-host/categories.http.test.ts`, `vitest.api.config.ts`; expansão de
  `public-surface.test.ts` e `eslint-runtime-rewrite.test.ts`.
- Integração: manifesto/lockfile/workspace e `.env.example` da raiz; o antigo
  Dockerfile da raiz recebeu o manifesto do importer. CI, inventário, escopo de
  lint e dois exports registrados em `ratchet-transfers.json`.
- Documentação: ADR de extração, modernização, overview, esta especificação,
  resolução de tenant, boot/mapa/índice, índice de features, entrada 231 e
  changelog Unreleased; handoff canônico preservado.

## Segundo incremento: catálogo público (2026-09-30)

Antes de acrescentar as três rotas, passaram 128 testes unitários existentes e
73 testes HTTP com o legado. As fixtures passaram a incluir duas locadoras com
equipamentos, decimais, imagens, uma linha indisponível e dados internos, além
de locadoras suspensa e ativa sem settings. Uma expectativa de `Vary` foi
registrada conforme a resposta real do Next, que acrescenta seus headers RSC.

Os adapters `http/equipments.ts`, `http/equipment-search.ts` e
`http/public-settings.ts` em backend só mapeiam Request/Response e erros. As
três rotas novas no serviço apenas exportam GET/configuração; `host/runtime`
liga as factories ao `createPublicCatalog` e à mesma resolução de tenant.
Nenhuma regra de catálogo, projeção, transação, schema ou integração foi
duplicada ou alterada. Os três handlers legados continuam intactos.

Testes acrescentados: `tests/api-host/public-catalog.http.test.ts` compara os
dois hosts e verifica os DTOs e RLS; `tests/unit/public-catalog-api.test.ts`
injeta falhas na resolução e na leitura nos handlers reais, preservando erros
genéricos e precedência. `global-setup.ts` e o teste HTTP de categorias foram
adaptados às novas fixtures (a contagem inclui os equipamentos inseridos).

### Resultados do segundo incremento

| Verificação                                                | Resultado local                                                       |
| ---------------------------------------------------------- | --------------------------------------------------------------------- |
| Caracterização antes das novas rotas                       | 128 unitários e 73 testes HTTP aprovados                              |
| Comparação focada dos adapters reais/catálogo              | 137 testes aprovados                                                  |
| HTTP final: legado em dev e serviço standalone em produção | 178 aprovados em dois arquivos; status, corpo, headers, métodos e RLS |
| Suíte unitária completa com banco descartável              | 58 arquivos, 828 testes aprovados                                     |
| Segurança completa                                         | 27 arquivos, 660 aprovados e os mesmos 18 condicionais pulados        |
| Build API                                                  | Exit 0; cinco rotas GET dinâmicas                                     |
| Typecheck de pacotes/hosts e programa da raiz              | Exit 0                                                                |
| Lint, arch, ratchet, higiene e nomes de teste              | Exit 0; baselines intactas, nenhum órfão novo                         |
| Markdown e índices/links                                   | Aprovados                                                             |

Não houve commit, push, deploy, mudança de schema ou operação de provedor real.
Docker/CI remotos e paridade integral da API continuam sem validação deste
corte.

## Cortes 3 a 5: disponibilidade, detalhe e cartão (2026-09-30)

A disponibilidade foi caracterizada no legado antes da adaptação: sete testes
unitários novos e 24 HTTP novos, além de 50 regressões de reservas/quitação. O
serviço injeta o runner tenant no `createRentalAvailability` existente;
`http/equipment-availability.ts` preserva somente o transporte. Nenhuma regra de
calendário, reserva, dinheiro ou lock foi alterada. A suíte HTTP usa duas
locadoras, encontros no mesmo instante, datas de item e fallback de locação,
estados finais, orçamento AT_END, pagamento pendente e histórico REFUNDED.

O detalhe foi caracterizado com seis testes unitários e 15 HTTP no legado. Sua
consulta e projeção saíram da rota para `catalog/public-detail.ts`, publicadas
pelo `createPublicCatalog.getPublicEquipment`. A rota antiga mantém guard,
validação de ID, cache e erros, e chama a fachada `lib/catalog.ts` (caminho
antigo). O serviço usa `http/equipment-detail.ts`; não há uma segunda
consulta/DTO no host. Os 96 testes anteriores do catálogo continuam protegendo
seus métodos.

O cartão foi caracterizado com 11 testes unitários e 17 HTTP no legado antes da
nova rota. O serviço usa `readPublicTenantCard`, já existente em directory,
através de `http/tenant-card.ts`. A rota legada do cartão permanece intacta. Os
testes exercitam alteração de organização durante a leitura, logo inseguro,
locadora sem settings, borda tenant/app/apex, conflitos e borda forjada.

Arquivos novos desses cortes:

- `packages/backend/src/http/{equipment-availability,equipment-detail,tenant-card}.ts`.
- `packages/backend/src/modules/catalog/public-detail.ts`; método ligado em
  `catalog/public.ts` e fachada `lib/catalog.ts` (caminho antigo).
- Rotas correspondentes em `apps/services/api/src/app/api`, ligadas por
  `apps/services/api/src/host/runtime.ts` e exports explícitos em
  `backend/http`.
- `tests/unit/public-{availability,equipment-detail,tenant-card}-api.test.ts`.
- `tests/api-host/{availability,equipment-detail,tenant-card}.http.test.ts` e
  ampliação das fixtures/grants somente de leitura em `global-setup.ts`.

Resultados conferidos: 341 testes HTTP em cinco arquivos contra os dois hosts
compilados; build API com oito rotas e build legado aprovados; 48 testes focados
dos três adapters; 61 arquivos/876 testes na suíte unitária completa; 27
arquivos/660 testes na segurança completa, com os mesmos 18 condicionais
anteriores pulados. Tipos de todos os pacotes/hosts e raiz, lint, arch, ratchet,
higiene e nomes de teste aprovados; nenhuma baseline foi alterada. A primeira
rodada unitária teve um timeout do teste de higiene sob concorrência; a suíte
completa passou com `--maxWorkers=2`, sem mudar teste, timeout ou proteção.

O primeiro ensaio do detalhe usou legado dev e serviço standalone atual (292
HTTP). Depois, um dev externo passou a ocupar a raiz; ele foi preservado. Os
primeiros ensaios de produção usaram um build legado anterior, com as rotas
originais caracterizadas, e o serviço atualizado. Depois o legado foi
recompilado e os 341 testes foram repetidos com os artefatos atuais, sem
reutilizar o servidor externo. O build legado usou conexão fictícia e seu
fallback de sitemap existente; a comparação HTTP usou PostgreSQL descartável
real. Isso não certifica SEO, Docker, CI remoto nem produção.

## Corte 6: busca do diretório (2026-09-30)

Antes da adaptação, passaram 15 casos unitários novos, 47 testes existentes de
diretório/limitadores e 353 testes HTTP, com a busca ainda só no legado. Os
corpos de `clientIpFromHeaders`, `isPlatformProduction` e
`identityRateLimitSecret` foram movidos sem alterações para os módulos
identity/directory de backend; `lib/rate-limit.ts` (caminho antigo) importa e
reexporta IP e segredo para preservar os consumidores antigos. O critério de
produção e o primitivo de segredo deixaram de ser reexportados por fachadas sem
consumidores de produção; seus testes continuam nos módulos donos, com as mesmas
asserções. O teste estrutural de segredo continua exigindo um único chamador,
agora `directory/security-env.ts`, e passa a varrer também o serviço. Nenhuma
proteção ou baseline foi afrouxada.

`http/directory-search.ts` preserva a validação antes do consumo, os erros,
cache e Retry-After. A composição do host liga o adapter aos serviços existentes
de busca e contador. A rota legada permanece intacta; opt-in, projeção estrita,
escape de curingas, critério de produção, IP da borda e normalização IPv6 /64
continuam na implementação compartilhada.

A configuração do serviço documenta `PLATFORM_RATE_LIMIT_SECRET` e
`TRUSTED_PROXY_HOPS`. Durante a coexistência, ambos os hosts devem usar a mesma
chave e o mesmo banco do ambiente para dividir as janelas. A suíte HTTP usa
chave e IPs próprios por execução; cria locadoras listadas, oculta, suspensa e
com curingas literais. Seu papel continua sem permissão de escrita em tabelas de
negócio. O teste distribui 40 buscas entre os dois processos e exige 30
sucessos, 10 recusas e uma única linha com contador 40; a limpeza remove apenas
as linhas identificadas pelos HMACs dessa execução.

Arquivos: `backend/http/directory-search.ts`,
`backend/modules/identity/client-ip.ts`,
`backend/modules/directory/security-env.ts`, seus exports explícitos e a fachada
`lib/rate-limit.ts` (caminho antigo); rota/composição/env em
`apps/services/api`; testes `tests/unit/public-directory-api.test.ts`,
`tests/api-host/directory.http.test.ts`, fixtures/grants de `global-setup.ts` e
o inventário estrutural em `tests/security/directory.test.ts`.

Resultados locais deste corte:

| Verificação                           | Resultado                                                                        |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| Antes da adaptação                    | 15 unitários, 47 de segurança focados e 353 HTTP aprovados                       |
| Caracterização dos dois handlers      | 30 aprovados; repetidos após a limpeza das fachadas                              |
| HTTP nos dois artefatos finais        | 6 arquivos, 373 aprovados; inclui limite dividido entre processos                |
| Suíte unitária completa               | 62 arquivos, 906 aprovados antes da limpeza de reexports sem uso                 |
| Segurança completa após a limpeza     | 27 arquivos, 660 aprovados e os mesmos 18 condicionais pulados                   |
| Identidade completa após a limpeza    | 13 arquivos, 134 aprovados                                                       |
| Tipos                                 | Pacotes/hosts e raiz aprovados; os dois builds finais também passaram TypeScript |
| Builds serviço e legado               | Exit 0; serviço com nove rotas GET                                               |
| Lint                                  | Completo aprovado; arquivos da limpeza também conferidos depois                  |
| Arquitetura, ratchet, higiene e nomes | Aprovados; baselines intactas, nenhuma tolerância nova                           |
| Documentação                          | Markdown e índices/links aprovados                                               |

A higiene identificou três reexports que passaram a ter só consumidores de
teste. Eles foram removidos das fachadas, mantendo as implementações e todas as
asserções nos módulos donos. A porta do adapter HTTP usa o retorno do consumidor
existente, como os outros adapters; nenhuma entrada de baseline foi modificada.
O build legado usou conexão fictícia e o fallback de sitemap já existente; o
HTTP usou PostgreSQL real descartável. Docker, CI remoto, implantação e paridade
integral continuam sem validação neste corte.

## Riscos restantes e próximo corte da fotografia de 2026-09-30

Naquele corte, o host parcial ainda não podia assumir toda a origem `/api`. A
autenticação e seus cookies/CSRF/OAuth, a composição dos efeitos, o cache do
host web e a execução exclusiva do scheduler precisam de provas próprias antes
do cutover. O ciclo de shutdown do pool em um host com jobs longos também exige
validação; o corte atual é leitura e usa o lifecycle do Next.

O inventário estrutural de autorização ainda protege a raiz legada. Antes de
instalar rotas privadas no serviço, sua verificação precisa abranger também o
novo host, com os mesmos contratos de principal/guards e sem ampliar allowlists.

## Corte 7: preparação da composição de identidade (2026-09-30)

Sem endpoints novos no serviço. Antes dos movimentos, passaram 18 casos de
sessão, dez de opções/callbacks e oito de lifecycle/e-mail. Os mesmos 36 casos
continuam exercitando as fachadas reais após a extração.

- `identity/application-session.ts`: política de coexistência/corte com leitores
  injetados. A fachada mantém
  `getServerSession(options?): Promise<Session | null>`, Next headers, projeção
  e NextAuth reais. O inventário estrutural permanece intacto, inclusive sua
  exigência do retorno nullable explícito.
- `identity/legacy-auth.ts`: providers, opções, login, callbacks, HMAC e
  revalidação da senha, com banco/guard/ambiente injetados. Declarações NextAuth
  em `identity/legacy-auth-types.d.ts`; a versão 4.24.15 existente passou a ser
  declarada pelo backend, sem atualização de biblioteca.
- `identity/runtime.ts`: lifecycle e política HTTP do Better Auth, assunto da
  plataforma, origem validada da borda, falha fechada e logs redigidos.
  `lib/identity.ts` (caminho antigo) fornece as dependências reais de banco,
  e-mail e janelas.
- `lib/auth.ts` (caminho antigo), `lib/application-session.ts` (caminho antigo),
  `lib/identity.ts` (caminho antigo) e `types/next-auth.d.ts`:
  composição/compatibilidade. A rota NextAuth continua intacta e conserva o
  wrapper de disponibilidade e sua defesa CSRF.
- `tests/unit/{application-session,legacy-auth-composition,identity-runtime}.test.ts`:
  caracterização de opções, cabeçalhos, fallback, erro, projeção, cache e
  e-mail. Testes existentes de segurança continuam com as mesmas asserções;
  imports de implementações internas foram apontados aos módulos donos. O código
  externo `RateLimited` é afirmado como literal do contrato HTTP.

A higiene detectou exports que ficaram sem consumidor após a mudança de dono.
Foram enxugados apenas os reexports internos sem uso. O default de `lib/auth.ts`
(caminho antigo) criava uma segunda instância de NextAuth sem consumidor:
removido esse código, saiu apenas a sua entrada da baseline de higiene (COD-27).
Nenhuma tolerância, allowlist ou proteção de teste aumentou.

Resultados locais deste corte:

| Verificação                     | Resultado                                                       |
| ------------------------------- | --------------------------------------------------------------- |
| Caracterização das fachadas     | 36 aprovados antes e depois dos movimentos                      |
| Suíte unitária completa         | 65 arquivos, 942 aprovados (`--maxWorkers=2`)                   |
| Identidade completa, banco real | 13 arquivos, 134 aprovados                                      |
| Segurança completa              | 27 arquivos, 660 aprovados e 18 condicionais existentes pulados |
| HTTP, artefatos atuais          | 6 arquivos, 373 aprovados; legado e serviço em produção local   |
| Build API / build legado        | Aprovados; legado com conexão fictícia e fallback de sitemap    |
| Tipos pacotes/hosts e raiz      | Aprovados; lint completo também                                 |
| Arquitetura / ratchet / nomes   | Aprovados; nenhuma nova violação ou exceção                     |
| Higiene                         | Aprovada; 957 achados antigos em 278 itens, uma sobra resolvida |
| Markdown / índices              | Aprovados                                                       |

Mutações da política de corte e da comparação de versão de credencial derrubaram
seis e dois testes, respectivamente. Fontes restaurados byte a byte, com SHA-256
conferido. Os builds não certificam conectividade/SEO em produção, e os testes
HTTP ainda cobrem as nove leituras públicas, não identidade privada no serviço.
Docker, CI remoto e deploy não foram executados.

Estado: raiz com 149 rotas/193 métodos; serviço com nove GETs públicos/health.
Limitadores persistentes de autenticação, adapter de e-mail e resolução de
principal ainda têm composição na raiz. Próximo corte: compartilhar essas
dependências de runtime e montar a primeira leitura autenticada com cookies
reais nos dois modos. Antes de expor rotas privadas, ampliar o inventário de
autorização ao serviço; não montar callbacks ou mutações sem provar cookies,
guardas, origem, tenant e erros em ambos. A troca de tráfego continua separada.

## Corte 8 — limitadores persistentes e e-mail compartilhados

Preparação de dependências reais para a identidade do serviço. Nenhuma rota
legada, flag, callback, origem de cliente ou autoridade de jobs foi alterada.

Arquivos/responsabilidades:

- `packages/backend/src/modules/identity/rate-limit.ts`: políticas e execução
  das janelas de autenticação/notificações, por `createIdentityLimiters`; guard
  comum por `createLegacySignInGuard` e campos redigidos de log. Sem import da
  raiz ou do host. O contador é carregado lazily, uma vez para chamadas
  concorrentes; falhas de carga podem ser repetidas. Segredo é resolvido antes
  do contador, conforme o contrato existente.
- `lib/rate-limit.ts` (caminho antigo): composição do contador Prisma real,
  leitor de segredo e IP confiável; fachadas mantêm os caminhos das rotas. Os
  limitadores genéricos em memória permanecem nesse arquivo, com o inventário
  estrutural intacto.
- `packages/backend/src/runtime/mail.ts`: cliente Resend com prazo de 15
  segundos, incluindo envio com chave de idempotência e sinal de cancelamento do
  chamador. `lib/resend.ts` (caminho antigo) conserva a API e lê a configuração
  a cada chamada.
- `packages/backend/src/modules/identity/mail.ts`: payload e erros de e-mail por
  `createIdentityMailSender`. `lib/identity.ts` (caminho antigo) fornece
  cliente/remetente reais. A marca e o assunto continuam no runtime de
  identidade compartilhado.
- Entrypoints/manifest/lockfile: Resend 6.30.0 existente declarado no backend;
  reexports de primitivas internas sem consumidor removidos. Testes importam
  seus módulos donos sem remover casos/assertivas. Nenhuma baseline, allowlist
  ou proteção foi alterada neste corte.
- `tests/unit/identity-limiters.test.ts`: composição, segredo antes do banco,
  retry/carga concorrente, duas instâncias na mesma janela, portas por chamada e
  guard real. `tests/unit/resend-timeout.test.ts`: caracterização adicional de
  configuração por chamada e cancelamento do transporte SDK.

Contratos preservados: mesmos HMACs/janelas alinhadas, teto de 100 tentativas
por conta, limites por IP/conta, espera progressiva, limpeza seletiva, reset
após troca de senha, orçamento silencioso de e-mail, falha fechada, 429/503 com
`Retry-After`/`no-store`, logs redigidos e payload/remetente de identidade. Os
127 casos focados de segurança passaram antes e depois da extração das janelas;
os 11 casos de e-mail/runtime passaram antes de mover o transporte. As mutações
de ordem do segredo e prazo do e-mail reprovaram um e dois casos
respectivamente; fontes restaurados byte a byte, com SHA-256 conferido.

Estado legado: 149 rotas/193 métodos preservados; serviço permanece com nove
GETs públicos/health, sem identidade privada instalada. A resolução privada de
principal e os adapters HTTP correspondentes são o próximo corte, com inventário
e paridade por cookies reais antes de instalar o endpoint. Deploy, Docker, CI
remoto e envio real de e-mail continuam fora das provas locais.

Resultados finais deste corte, com o código restaurado após as mutações:

| Verificação                       | Resultado                                                      |
| --------------------------------- | -------------------------------------------------------------- |
| Suíte unitária completa           | 66 arquivos, 949 aprovados (`--maxWorkers=2`)                  |
| Segurança completa                | 27 arquivos, 660 aprovados; 18 condicionais existentes pulados |
| Identidade completa, banco real   | 13 arquivos, 134 aprovados                                     |
| Paridade HTTP, dois builds atuais | 6 arquivos, 373 aprovados                                      |
| Builds API / legado               | Aprovados; legado com conexão fictícia e fallback de sitemap   |
| Tipos pacotes/hosts e raiz        | Aprovados                                                      |
| Lint / arch / ratchet / higiene   | Aprovados; mesma dívida de arquitetura e higiene               |
| Nomes / Markdown / índices        | Aprovados                                                      |

Na execução paralela das suítes unitária e identidade no mesmo banco, o teste de
RLS de assinaturas encontrou duas tabelas com o mesmo nome em `pg_class`: a
tabela pública e a cópia de um schema temporário da prova de migration. A
consulta desse teste não filtra namespace. A suíte unitária terminou e limpou
seus schemas; uma leitura confirmou apenas a tabela `public`, com RLS habilitada
e forçada. Identidade repetida depois passou nos 134 casos, sem mudar a
assertiva. Até o teste de metadados ser isolado por namespace, executar unit e
identity sequencialmente quando usam o mesmo banco descartável. O aviso de
depreciação de consultas concorrentes do pg continua existente.

## Corte 9 — primeira leitura autenticada (2026-10-01)

### O que foi implementado

`GET /api/auth/organizations` foi montado no serviço com o leitor real de
sessão. `listActiveOrganizationMemberships` centraliza a consulta e a projeção
em backend/identity; os adapters exigem `session.user.id` antes do banco.
NextAuth e Better Auth são compostos pelas factories compartilhadas, com Prisma,
cabeçalhos Next, contador, segredo, IP e transporte de e-mail reais. Não há
leitor de sessão fictício, token de teste aceito pelo host ou import da raiz no
serviço/backend. Importar a composição não abre banco nem envia e-mail.

### Arquivos criados/modificados

- `packages/backend/src/modules/identity/organization-memberships.ts` e
  `identity/index.ts`: leitura compartilhada e export público explícito.
- `app/api/auth/organizations/route.ts` (caminho antigo): adapter legado, mesma
  sessão/recusa e transporte; consulta delegada ao módulo.
- `apps/services/api/src/host/session.ts` e
  `src/app/api/auth/organizations/route.ts`: composição e adapter HTTP privado.
- `apps/services/api/src/host/runtime.ts`: callbacks lazy para as factories
  públicas, conservando todas as opções de resolução (inclusive `trim`, código
  de erro obrigatório e slug do caminho).
- Manifest/lockfile do serviço: NextAuth 4.24.15 já existente declarado; sem
  upgrade. `.env.example` documenta configuração de sessão/dependências reais.
- `tests/unit/organization-memberships.test.ts`: mesmas caracterizações nos dois
  adapters. `tests/api-host/organizations.http.test.ts` e global setup: cookies
  emitidos pelo login HTTP, credenciais e vínculos reais por execução.
- `tests/security/route-auth-inventory.test.ts`: varredura dos três hosts,
  namespace auth e resultado do novo guard, nove GETs públicos exatos,
  invariantes de referências/carga e novos casos adversariais.
- `tests/api-host/categories.http.test.ts` identifica a rota real do engine
  selecionado: `/session` no legado e `/get-session` após corte Better Auth. Em
  ambos, 200 só no legado e 404 no serviço; nenhuma assertiva foi removida.
- CI executa a paridade nos dois modos; ADR, modernização, seleção, boot e
  changelog refletem o estado intermediário atual.

### Contratos preservados

401 sem identidade válida; mesmas respostas e erros do framework; `no-store` e
`Vary: Cookie` no adapter. Pelo HTTP, Next 16 acrescenta os campos de negociação
RSC ao `Vary`; os dois hosts devem devolver o cabeçalho completo idêntico. Lista
contém apenas vínculos ACTIVE da identidade e organizações ACTIVE, ordenadas por
nome, com `membershipId`, papel do vínculo e os quatro campos públicos da
organização. Papel global, query, headers e preferência não ampliam autorização.
Lista vazia não escolhe uma locadora. Revogação e suspensão são relidas; JWT com
credencial rotacionada ou sessão Better Auth revogada é recusado. Cookies
`__Host-` do engine preservam Secure/HttpOnly/Path sem Domain.

### Testes executados e resultados

Antes da movimentação, oito caracterizações e os sete testes existentes de
seleção passaram; depois, 16 caracterizações nos dois adapters e os mesmos sete
testes passaram. Remover `userId` da consulta fez duas caracterizações falharem;
a fonte foi restaurada byte a byte, com SHA-256 conferido.

Na primeira prova pública, oito casos existentes reprovaram o encaminhamento
incompleto das opções de settings. Corrigido o adapter, sem mudar suas
assertivas. A primeira prova privada registrou os campos RSC reais que Next
adiciona ao `Vary`; a expectativa nova usa o cabeçalho observado. O cenário
Better Auth prepara contas de credencial já migradas, pois esse modo não usa
senha legada como fallback. Esses ajustes são da prova local, sem alteração da
política de produção.

A conferência dos logs identificou `P2039` ao limpar as janelas de login: o
papel temporário da fixture não tinha DELETE em `platform_rate_limits`. Uma nova
prova HTTP reproduziu o problema (duas janelas de conta restantes após o login).
Corrigido apenas o GRANT/REVOKE do papel de teste, preservando
NOLOGIN/NOBYPASSRLS e ausência de ownership. A prova exige limpeza das janelas
legadas de conta e retenção do orçamento por IP; em Better Auth exige a janela
nativa persistente, atualizada pelo login desta execução, conforme o engine
instalado. Não se adicionou fallback nem se mudou a política dos limitadores.

Paridade final dos dois builds atuais: 7 arquivos/391 testes aprovados em cada
modo (`API_AUTH_MODE=legacy` e `better-auth`), com PostgreSQL e papel temporário
NOLOGIN/NOBYPASSRLS sem ownership. Os 18 casos privados cobrem cookies reais,
negação, DTO, identidade, tentativas de sobreposição, revogação/suspensão,
métodos não instalados e endpoints que continuam legados. O serviço standalone e
o legado passaram build; sitemap legado continua usando fallback com banco
fictício. Docker, CI remoto, navegador/dispositivo e deploy não foram provados.

| Verificação final local                  | Resultado                                                                     |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| Suíte unitária completa                  | 67 arquivos, 965 aprovados (`--maxWorkers=2`)                                 |
| Identidade completa, após os unitários   | 13 arquivos, 134 aprovados                                                    |
| Segurança completa com banco descartável | 27 arquivos, 661 aprovados e os 18 condicionais existentes pulados            |
| Gates de ferramentas                     | 13 arquivos, 183 aprovados                                                    |
| Inventário de autorização                | 60 aprovados, incluindo adapters/guard do serviço                             |
| Arquitetura                              | 9 packages; zero violações acima do baseline existente                        |
| Higiene                                  | 957 achados existentes em 278 entradas; zero achados novos                    |
| Nomes de testes                          | 430 colocados; 3 exceções existentes; zero órfãos novos ou exceções obsoletas |
| Ratchet contra `55763c1e`                | Aprovado; baselines de arquitetura/tokens sem aumento                         |

Tipos dos 12 projetos e da raiz (`pnpm typecheck` e `pnpm type-check`), lint
completo, Markdown, índices/links e `git diff --check` aprovados.

Após a prova, a leitura do banco confirmou zero papéis, organizações e usuários
temporários de paridade. Os servidores HTTP próprios foram encerrados pelo
setup; PostgreSQL iniciado para a validação foi encerrado, com suas portas de
teste sem listener. Logs permanecem somente no diretório temporário externo.

### Estado da API legada

Ativa, sem redirect/cutover. Mantém 149 rotas/193 métodos declarados, clientes,
login/callbacks, seleção, pagamentos, uploads e jobs. Serviço parcial com dez
GETs; nenhum segundo scheduler ou caminho autoritativo de escrita foi criado. A
pasta `app/` (caminho antigo) externa é o host legado e só será retirada depois
da paridade e troca operacional; `src/app` nos hosts e `frontend/src/app`
continuam legítimos.

### Dívida/risco restante

O replay de cookies entre processos em localhost prova os leitores reais; não
prova envio de cookies host-only pelo navegador para outra origem. A futura
troca depende do encaminhamento pela borda, das origens e da configuração já
definidos nas ADRs. O serviço ainda não atende o guard central das operações de
negócio nem seleção/callbacks. Baselines de arquitetura/higiene permanecem
dívida existente, sem nova tolerância; nenhuma proteção foi relaxada.

### Próximo corte recomendado naquela onda

Compartilhar a adaptação da preferência de locadora e a leitura
`GET /api/auth/organizations/selection`, com sessão real e revalidação de
vínculo/organização. Depois, `/current` por borda e resolução privada de
principal, antes de montar mutações. Preservar cookie de preferência como
preferência, nunca autorização, e provar origem/CSRF antes dos writes.

## Corte 10 — leitura da seleção validada (2026-10-01)

### O que foi implementado

`GET /api/auth/organizations/selection` instalado no serviço com a sessão real
já compartilhada. A política de leitura foi movida de
`lib/organization-selection.ts` (caminho antigo) para backend/identity, junto do
parser e do formatter da preferência. A consulta e a projeção do vínculo
continuam no backend. Os dois adapters exigem identidade antes de consultar
dados e delegam à mesma implementação. Não há regra copiada ao host.

### Arquivos criados/modificados

- `packages/backend/src/modules/identity/{organization-selection,tenant-preference}.ts`:
  política de leitura e cookie; `organization-memberships.ts`: consulta do
  vínculo atual; `identity/index.ts`: exports públicos explícitos.
- `packages/backend/src/http/organization-selection.ts` e `http/index.ts`:
  transporte Response compartilhado, sem consulta ou efeito de negócio.
- `lib/organization-selection.ts` (caminho antigo): adapter legado, com
  POST/DELETE e origem/JSON preservados. `lib/tenant.ts` (caminho antigo):
  principal continua usando o parser compartilhado; dois exports da fachada sem
  consumidor de produto foram removidos, sem acrescentar tolerância à higiene. O
  nome canônico do cookie está em contracts.
- `apps/services/api/src/app/api/auth/organizations/selection/route.ts`: somente
  GET, com sessão/consulta lazy e 503 genérico.
- `tests/unit/organization-selection-read.test.ts` e
  `tests/api-host/organizations.http.test.ts`: caracterizações e paridade real.
  Inventário de autorização: dois helpers INERT sujeitos à mesma gramática
  fechada, export/fonte reais e mutações de I/O, escrita e callbacks. A
  constante é resolvida pelo export de contracts e só aceita declaração const
  literal.
- `.github/workflows/ci.yml`: expressão existente de concorrência mantida em uma
  linha com `prettier-ignore`; o reflow anterior fazia o verificador ler apenas
  parte do grupo. Testes e regras de cancelamento não foram alterados.
- Env de exemplo, ADR, modernização, seleção, boot e changelog atualizados sem
  mudar URLs ou configuração operacional dos clientes.

### Contratos preservados

Cookie/header continuam preferências, não credenciais nem autorização. Não há
escolha implícita; query e papel global não ampliam acesso. Membership e
organização precisam estar ACTIVE e pertencer à identidade autenticada. DTO
conserva `membershipId`, papel do vínculo e os quatro campos públicos da
locadora. Revogação/suspensão são relidas em cada requisição.

Mantidos 401 sem sessão, 400 para seleção inválida/ambígua/conflitante, null com
limpeza quando não há vínculo e 503 genérico. Limpeza e gravação de cookie
mantêm Path, HttpOnly, SameSite=Lax, Max-Age e Secure em produção. Cache segue
`no-store`; o adapter usa `Vary: Cookie, x-tenant-id` e os hosts HTTP
acrescentam os mesmos campos RSC do Next. GET/HEAD são equivalentes; OPTIONS do
serviço anuncia apenas GET/HEAD/OPTIONS. POST/DELETE continuam instalados no
legado e retornam 405 no serviço.

### Testes executados e resultados

Antes da movimentação passaram 24 caracterizações da leitura legada. Depois, os
mesmos casos nos dois adapters (48), os 16 de listagem e os sete existentes com
PostgreSQL passaram: 71 focados. Paridade dos builds locais de produção: 7
arquivos/416 aprovados em cada engine, NextAuth e Better Auth. São 25 novos
casos HTTP de seleção, além dos 391 existentes. Cookies vêm do login legado
real; papéis, vínculos, revogação e suspensão vêm do banco descartável, com
runtime NOLOGIN/NOBYPASSRLS sem ownership.

A prova inclui POST legado, leitura do seu cookie pelo serviço e DELETE legado;
as escritas não foram montadas no serviço. Falhas de parser, sessão e consulta
ficam protegidas pelas caracterizações. Os logs HTTP mostram apenas os erros
esperados das sessões forjadas/revogadas nos cenários negativos, sem P2039 de
limpeza de orçamento. Compilações de raiz e serviço passaram; sitemap legado usa
o fallback existente com banco fictício. Não há prova de deploy ou CI remoto.

Remover temporariamente `userId` da consulta derrubou oito caracterizações nos
dois adapters; a fonte foi restaurada byte a byte, com SHA-256 conferido. As
provas do inventário também rejeitam constantes importadas que passam a ser
`let`, leitura de ambiente ou chamada de callback, sem ampliar a gramática.

| Verificação final local         | Resultado                                                                  |
| ------------------------------- | -------------------------------------------------------------------------- |
| Unitários completos             | 68 arquivos, 1.013 aprovados (`--maxWorkers=2`)                            |
| Identidade completa             | 13 arquivos, 134 aprovados, após os unitários                              |
| Segurança completa              | 27 arquivos, 662 aprovados e os 18 condicionais existentes pulados         |
| Gates de ferramentas            | 13 arquivos, 183 aprovados (`--maxWorkers=2`)                              |
| Inventário estrutural           | 61 aprovados na suíte de segurança                                         |
| Paridade HTTP de produção local | 7 arquivos, 416 aprovados por modo: legacy e better-auth                   |
| Arquitetura                     | 9 packages; zero violações acima do baseline existente                     |
| Higiene                         | 957 achados existentes em 278 entradas; zero achados novos                 |
| Nomes de testes                 | 430 colocados, 3 exceções existentes, zero novos órfãos/entradas obsoletas |
| Ratchet contra `55763c1e`       | Aprovado, sem aumento de baseline                                          |

A primeira execução dos gates reprovou o reflow da expressão de CI e um teste de
lint ultrapassou os 20 segundos sob concorrência excessiva. A expressão foi
restaurada em uma linha; a suíte passou com dois workers, sem alterar assertivas
ou prazos. Os unitários e a identidade registram o aviso existente de consultas
concorrentes do pg, sem falha. Tipos dos 12 projetos, lint e builds aprovados;
Markdown e índices/links também foram validados. Não há validação visual nesta
etapa, que não altera frontend ou CSS.

A conferência final do inventário reproduziu 149 rotas/193 métodos no legado,
11/11 no serviço e zero handlers de backend no web. A leitura do banco confirmou
zero papéis, locadoras e usuários temporários de paridade. Os servidores HTTP
próprios e o PostgreSQL iniciado para esta etapa foram encerrados; as cinco
portas de teste ficaram sem listener. Logs ficam somente no TEMP externo.

### Estado da API legada

Ativa, com 149 rotas/193 métodos declarados. Serviço parcial com onze GETs,
mantendo legados os writes de seleção, `/current`, login/callbacks, operações de
negócio, pagamentos, uploads e jobs. Nenhum redirect, switch de cliente,
scheduler novo, migração de dados, push ou mudança de produção.

### Dívida/risco restante

Paridade local entre processos não prova cookies host-only enviados por
navegadores a outra origem, interação web/mobile, Docker ou deploy. O guard
central de principal e as mutações ainda exigem cortes próprios; a futura troca
de autoridade depende de origem/borda/CSRF e paridade completa. A preferência
nunca pode virar fonte de papel ou autorizar acesso sem vínculo atual.

### Próximo corte recomendado naquela onda

`GET /api/auth/organizations/current`, com resolução do host pela borda
validada, recusas neutras e vínculo atual. Depois, compartilhar a composição do
principal privado antes de instalar operações de negócio e writes. `app/`
(caminho antigo) externo só sai quando o substituto estiver completo e a troca
operacional estiver comprovada.

## Corte 11 — vínculo da locadora do host (2026-10-01, sem commit)

### O que foi implementado

`GET /api/auth/organizations/current` instalado no serviço. A resolução do host
antes da sessão foi compartilhada por `createPublicTenantResolver`; a consulta
do vínculo atual foi movida à identidade no backend e mantém a transação da
locadora. Os adapters compõem sessão/banco e transportam a resposta privada, sem
regra de negócio duplicada. Login, cookies, principal de operações, jobs e
escritas continuam sob a autoridade legada.

### Arquivos criados/modificados

- `packages/backend/src/modules/identity/organization-current.ts`: consulta,
  validação de identidade/locadora/atividade e DTO. `public-tenant.ts`:
  preparação de host com a precedência original; `identity/index.ts`: export
  explícito da consulta.
- `packages/backend/src/http/organization-current.ts` e `http/index.ts`:
  resposta privada, sem consulta nem efeito de negócio.
- `app/api/auth/organizations/current/route.ts` (caminho antigo) e
  `lib/tenant.ts` (caminho antigo): fachada e adapter legados delegando às
  implementações compartilhadas.
- `apps/services/api/src/app/api/auth/organizations/current/route.ts` e
  `host/runtime.ts`: adapter GET e composição lazy da resolução do host.
- `tests/unit/current-organization-read.test.ts`: caracterização executada antes
  da movimentação; `tests/api-host/organizations.http.test.ts`: paridade real
  com as sessões existentes; inventário estrutural de autorização: contexto de
  `/current` é preparação, não guard.
- ADR, modernização, overview, boot, features de seleção/resolução, known issues
  159 e seu índice, comentário do env e changelog atualizados. O handoff
  canônico permanece inalterado.

### Contratos preservados

Host vem da borda validada. Fora de host de locadora, a resposta é 409
`TENANT_REQUIRED`, sem consulta de banco nem leitura de sessão, qualquer que
seja a query. No host válido, locadora desconhecida/suspensa responde com 404
neutro; query conflitante responde 400 `TENANT_CONFLICT`, ambos antes da
identidade. Query igual, repetida igual, vazia ou apenas espaços mantém o
comportamento caracterizado e a segunda consulta existente.

Após resolver o host, sessão sem identidade responde 401. A consulta usa
`tenantId_userId`, mantém a projeção explícita e roda em transação que define
`app.tenant_id`. Vínculo ausente ou incompatível responde 404 `NO_MEMBERSHIP`;
vínculo/organização inativos respondem 403. Sucesso devolve somente o vínculo da
locadora do host, com papel do Membership e quatro campos públicos da locadora.
Preferências, papel global e identidade enviada pelo cliente não ampliam acesso.

Erros de dependência continuam com log no servidor e 503 genérico. Respostas
privadas mantêm `private, no-store`, `Vary: Cookie, Host` e nenhum Set-Cookie.
As recusas públicas mantêm seu `no-store` canônico. O Next acrescenta os mesmos
campos RSC ao Vary em ambos os hosts. HEAD, OPTIONS e 405 dos demais métodos
permanecem equivalentes.

### Testes executados e resultados

Antes da movimentação passaram 48 caracterizações do adapter legado; depois, os
mesmos casos nos dois adapters passaram (96). A prova HTTP dos builds locais de
produção passou nos dois modos, com cookies emitidos pelo login legado real: 7
arquivos/447 testes em NextAuth e 7/447 em Better Auth. São 31 casos novos de
`/current` e a extensão do caso de revogação de sessão, além dos 416 existentes.
O runtime usa papel NOLOGIN/NOBYPASSRLS sem ownership, sem alterar grants para
este corte.

A prova estrutural detectou e corrigiu a lacuna que contava resolução pública
como autorização em `/current`. A entrada saiu de `PUBLIC_TENANT_SURFACE`.
Preparação é aceita apenas nos dois adapters exatos, seguida de recusa `.ok`; a
análise continua até a identidade. Remover sessão, antecipar consulta privada,
ignorar `.ok` ou usar o preparador fora desse namespace reprova. As fachadas são
conferidas contra suas fontes, sem ampliar a gramática INERT.

Trocar a identidade da consulta pela id da locadora derrubou dez
caracterizações; omitir a conferência de dono do vínculo derrubou duas. Cada
mutação foi restaurada byte a byte, com SHA-256 conferido, e as 96
caracterizações voltaram a passar após a restauração.

Unitários completos: 69 arquivos/1.109 aprovados; identidade: 13/134, executada
depois dos unitários. Segurança completa: 27/663 aprovados e os 18 condicionais
existentes pulados, com `--pool=threads --maxWorkers=1`; inventário: 62
aprovados. O pool forks excedeu os cinco segundos de uma varredura de classes
existente (primeiro sob concorrência e depois com um worker); o caso isolado e a
suíte completa passaram em threads, sem mudar prazo, cobertura ou assertivas.

Os dois builds passaram com banco fictício inacessível: o sitemap legado usa o
fallback existente, que não comprova SEO em produção. Logs HTTP mostram somente
os erros esperados das sessões forjadas/revogadas, sem P2039 ou falha de
permissão. Nenhuma validação visual é reivindicada nesta etapa sem frontend/CSS.

| Verificação final local   | Resultado                                                           |
| ------------------------- | ------------------------------------------------------------------- |
| Gates de ferramentas      | 13 arquivos, 183 aprovados, dois workers                            |
| Tipos                     | 12 projetos e raiz aprovados; backend/API também conferidos em foco |
| Lint                      | Exit 0, sem erros                                                   |
| Arquitetura               | 9 packages; 1.050 achados existentes, zero acima do baseline        |
| Higiene                   | 957 achados existentes em 278 entradas; zero novos                  |
| Nomes de testes           | 430 colocados, três exceções existentes, zero novos órfãos          |
| Ratchet contra `55763c1e` | Aprovado, sem aumentar baseline ou proteções                        |
| Documentação              | Prettier, markdownlint e índices/links aprovados                    |

O processo de checagens foi interrompido durante lint após aprovar os tipos. As
verificações restantes foram retomadas com exits registrados no TEMP. O
inventário final reproduziu as contagens abaixo; a consulta local confirmou zero
papéis, locadoras e usuários temporários de paridade. O PostgreSQL próprio foi
encerrado e as quatro portas HTTP usadas e a porta do banco ficaram sem
listener. Logs e sondas ficaram somente no TEMP externo. O handoff canônico
conservou seu SHA-256. Não há validação de CI remoto ou produção.

### Estado da API legada

Ativa com os mesmos 149 arquivos de rota e 193 métodos declarados. Serviço
parcial com 12 rotas/12 GETs; web sem handlers de backend. `/current` legado
continua instalado e compartilha implementação com o serviço. Nenhuma troca de
URL/proxy, push, deploy, migration ou desativação de endpoint.

### Dívida/risco restante

Paridade local não comprova entrega de cookies host-only pelo navegador a uma
nova origem, dispositivo mobile, Docker ou deploy. Guard central de principal,
permissões privadas, mutações, pagamentos, callbacks, uploads e scheduler ainda
exigem cortes próprios. O serviço não faz fallback nem autoriza rotas ainda
ausentes. A pasta `app/` (caminho antigo) externa só sai após cobertura completa
e troca operacional comprovada; `src/app` dos hosts e a camada FSD continuam
legítimos.

### Próximo corte recomendado naquela onda

Compartilhar a composição do principal privado com sessão real, preferências,
borda e vínculo atual, protegendo conflitos de locadora e mesma origem. Em
seguida, instalar uma leitura privada de negócio com papel/permissão explícitos
e RLS, antes de qualquer write ou mudança de autoridade. Nunca contar contexto
como autorização.

## Corte 12 — principal privado e motoristas (2026-10-01, sem commit)

### O que foi implementado

`createTenantPrincipalResolver` compartilha a composição de sessão, preferência,
borda, candidatos e vínculo atual entre os dois hosts. O guard de mesma origem é
o primeiro passo da closure; depois vêm sessão, parser do cookie, host e
política de candidatos. Essa ordem é caracterizada, inclusive quando há mais de
uma causa de recusa. A consulta composta de membership roda em
`withTenantTransaction`; papel global e preferência não concedem acesso.

`GET /api/admin/drivers` é a primeira leitura privada de negócio do serviço.
Exige papel ADMIN do vínculo atual antes de consultar dados. A consulta continua
única em `operations/createDriverService`; o host apenas fornece Prisma e adapta
o transporte. A rota legada e seu POST continuam instalados.

O inventário exige delegação exata, Request original, factory aprovada,
dependências reais e recusa antes de qualquer efeito. Seus casos adversariais
removem/movem o guard, trocam a sessão/banco/factory, modificam a requisição,
antecipam dados e retiram papel ADMIN. Nenhuma rota privada entrou em allowlist
pública. A criação da factory é conferida como livre de I/O.

### Arquivos criados/modificados

- Backend: `modules/identity/tenant-request-principal.ts` novo e exports
  explícitos em `modules/identity/index.ts`; a lógica de principal e a consulta
  de motoristas já existentes permanecem no pacote.
- Legado: `lib/tenant.ts` (caminho antigo) delega à factory com os leitores
  reais. O arquivo `app/api/admin/drivers/route.ts` (caminho antigo) não foi
  alterado.
- Serviço: `src/host/private-identity.ts` e `src/host/operations.ts` novos,
  `src/host/runtime.ts` com resolução pública usada na composição, e
  `src/app/api/admin/drivers/route.ts` novo (GET).
- Testes: `tests/unit/tenant-principal-request.test.ts` e
  `tests/unit/drivers-read-api.test.ts` novos; inventário, paridade HTTP/setup e
  imports dos testes de borda e resolução de locadora atualizados. Nenhuma
  asserção ou timeout removido.
- Higiene: reexports de `resolvePrincipal`, `selectedTenantCookie`,
  `readPlatformEdgeContext` e `TenantCandidate` ficaram internos após a
  extração. Implementações continuam usadas pelo backend; os testes importam seu
  arquivo dono. `DriverService` ganhou consumidor real, removendo dois achados
  obsoletos da baseline (um item e um nome), sem acrescentar dívida.
- Documentação: ADR, modernização, overview, boot, permissões, resolução de
  locadora, known-issues 159/index e CHANGELOG. O handoff canônico não mudou.

### Contratos preservados

- CSRF 403/no-store antes da sessão; `method: null` nos middlewares de cabeçalho
  não é transformado em GET. Métodos seguros e cliente nativo mantêm a regra.
- Cookie inválido/duplicado: 400 depois da sessão e antes do lookup do host;
  host inexistente/suspenso: 404 neutro antes da política de identidade;
  identidade ausente: 401; nenhuma seleção: 409; fontes distintas: 400; vínculo
  ausente/estranho/inativo ou organização suspensa: 403.
- Principal usa tenant e user da consulta composta, nunca o ADMIN global; o
  vínculo é revalidado em cada chamada. Sem escolha de locadora padrão.
- Motoristas: `{ drivers: [...] }`, campos completos, filtro pelo primeiro
  `status`, vazio sem filtro, ordenação por nome e envelope 500 genérico. Status
  inválido continua 500 observado no legado; não foi normalizado no move.
- GET/HEAD preservados. OPTIONS do serviço declara GET/HEAD/OPTIONS; POST do
  legado permanece e métodos de escrita no serviço continuam 405. Ausência de
  `Cache-Control` no GET legado de motoristas também foi preservada.
- Sem nova política CORS, cookies de sessão, URL de cliente, proxy, schema ou
  scheduler. O replay de cookie de teste não é prova de entrega pelo navegador.

### Testes executados e resultados

| Verificação                      | Resultado local                                                             |
| -------------------------------- | --------------------------------------------------------------------------- |
| Caracterização antes de mover    | 52 casos no legado passaram                                                 |
| Caracterização depois            | 105 casos nos dois hosts, incluindo criação sem I/O                         |
| HTTP produção local, NextAuth    | 7 arquivos, 473 testes passaram                                             |
| HTTP produção local, Better Auth | 7 arquivos, 473 testes passaram                                             |
| Unidade completa                 | 71 arquivos, 1.214 testes passaram                                          |
| Identidade completa              | 13 arquivos, 134 testes passaram                                            |
| Segurança completa               | 27 arquivos, 664 testes passaram; 18 skips condicionais existentes          |
| Inventário de autorização        | 63 testes passaram, com mutations em memória                                |
| Gates de verificadores           | 13 arquivos, 183 testes passaram                                            |
| Tipos                            | 12 projetos e raiz aprovados                                                |
| Builds serviço e legado          | Exit 0, com URL de banco fictícia                                           |
| Lint, arquitetura, nomes         | Exit 0; 0 acima da baseline de arquitetura, 0 órfãos novos                  |
| Higiene e ratchet                | Exit 0 após redução comprovada; 955 achados existentes aceitos em 277 itens |

HTTP usa cookies emitidos pelo login legado real em cada modo e papel de banco
NOLOGIN/NOSUPERUSER/NOBYPASSRLS/NOINHERIT, sem ownership. Os 26 casos novos de
motoristas verificam filtros, DTO, troca de locadora, papéis, conflitos,
revogação/suspensão depois da sessão e protocolos; a prova de revogação da
sessão também foi estendida. Uma consulta SQL sem filtro da aplicação só vê
motoristas do tenant configurado, nenhuma linha fora de contexto e nenhum
registro legado sem locadora. O setup limpa seus servidores, roles e fixtures.

### Estado da API legada

149 arquivos de rota/193 métodos declarados continuam na raiz. Serviço parcial
com 13 rotas/13 GETs; web sem handlers de backend. Não houve remoção ou
desativação de endpoint legado, alteração de cliente/proxy, push, deploy,
migration ou mudança de autoridade de escrita. A pasta `app/` (caminho antigo)
externa continua necessária até a paridade e a operação do substituto serem
provadas.

### Dívida/risco restante

Permissões granulares e os demais adapters privados ainda exigem extração.
Mutações, callbacks, pagamentos, arquivos, efeitos, jobs e composição
operacional permanecem legados. Builds locais e replay de cookies não provam
browser, Expo, Docker, staging multi-host ou produção. As dívidas preexistentes
dos gates continuam visíveis; este corte não conclui toda a modernização.

### Próximo corte recomendado naquela onda

Instalar a leitura privada de endereços do cliente, reutilizando o principal e o
serviço customers já existentes, com prova de propriedade por usuário e
locadora. Depois compartilhar a política granular de permissões e uma leitura
administrativa que a utilize, mantendo a autoridade de escrita no legado até os
seus próprios contratos e efeitos serem comprovados.

## Corte 13 — leitura de endereços do cliente (2026-10-01, sem commit)

### O que foi implementado

`GET /api/addresses` instalado no serviço compartilhado. A composição
`src/host/customers.ts` injeta o runtime de banco em `createAddressService`,
cuja consulta já existia no backend. O adapter delega ao principal privado
compartilhado antes do acesso e mantém `force-dynamic` e runtime Node. Nenhuma
regra de negócio ou filtro foi copiado ao host.

### Arquivos criados/modificados

- Novos: `apps/services/api/src/host/customers.ts`,
  `apps/services/api/src/app/api/addresses/route.ts` e
  `tests/unit/addresses-read-api.test.ts`.
- Paridade: setup e `organizations.http.test.ts` ganharam endereços de duas
  identidades, duas locadoras e histórico não atribuído, usando os cookies reais
  já emitidos. O role de banco ganhou apenas SELECT em addresses, com revogação
  e limpeza de seus fixtures no teardown.
- Higiene: `AddressService` ganhou um consumidor real; suas duas ocorrências
  obsoletas de dívida foram retiradas da baseline. Não houve novas exceções.
- Documentação: customer-addresses, esta página, ADR de extração, modernização,
  overview, boot e CHANGELOG. Handoff canônico preservado.

### Contratos preservados

- Principal obrigatório e recusa retornada sem alteração; preferência, header e
  borda não autorizam um vínculo ausente, suspenso ou revogado.
- `{ addresses: [...] }`, DTO completo observado e ordenação por principal
  primeiro e data de criação decrescente. Lista vazia permanece uma lista vazia.
- Query não altera user, tenant, role, filtros ou ordenação. O serviço mantém os
  dois predicados (`tenantId` e `userId`) do principal. ADMIN e outros papéis
  veem seus próprios endereços nesta rota, sem ampliação de ownership.
- Falha de armazenamento mantém 500 `{ error: 'Erro ao buscar endereços' }`.
  Falha do resolvedor permanece fora desse catch de negócio. Headers/cookies e
  comportamento HEAD foram comparados com o legado.
- OPTIONS do serviço declara somente GET/HEAD/OPTIONS; writes respondem 405.
  POST/PATCH/DELETE continuam instalados no legado, sem troca de autoridade.

### Testes executados e resultados

| Verificação final local                          | Resultado                                                                                                                    |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Unidade completa, incluindo gates de ferramentas | 72 arquivos, 1.242 testes aprovados                                                                                          |
| Identidade, depois dos unitários                 | 13 arquivos, 134 aprovados                                                                                                   |
| Segurança                                        | 27 arquivos, 664 aprovados e 18 skips condicionais existentes                                                                |
| Inventário de autorização em foco                | 63 aprovados; nenhuma exceção nova                                                                                           |
| Tipos                                            | 12 projetos e raiz aprovados                                                                                                 |
| Build do serviço                                 | Exit 0 com URL fictícia; build legado validado no corte 12 e sem mudança de fonte neste corte                                |
| Lint, arquitetura e nomes                        | Exit 0; nove packages, 1.050 achados existentes/zero novos; 430 testes colocados, três exceções existentes/zero novos órfãos |
| Higiene                                          | Exit 0; 953 achados existentes aceitos em 276 itens, após retirar duas ocorrências comprovadamente resolvidas                |
| Ratchet contra `55763c1e`                        | Aprovado; baselines de arquitetura/tokens não ampliadas                                                                      |

27 caracterizações passaram antes da instalação (14 novas e 13 existentes).
Depois da instalação, 41 passaram nos dois adapters. Produção local: sete
arquivos e 496 testes passaram com NextAuth e novamente com Better Auth. Os 23
casos novos de HTTP verificam ownership, quatro papéis, transportes, conflitos,
revogação/suspensão após login, vazio, ordenação, DTO, RLS, falha real de SELECT
e protocolos. A prova de revogação de sessão foi estendida.

RLS foi exercitado por role NOLOGIN/NOSUPERUSER/NOBYPASSRLS/NOINHERIT sem
ownership. Sem contexto ele vê zero endereços; no tenant A vê todas as linhas
**desse tenant**, incluindo outra identidade, e zero de B ou sem locadora. A
requisição HTTP vê somente as linhas do usuário atual. Essa distinção prova as
duas responsabilidades e não atribui ao RLS um filtro por usuário que ele não
contém.

O inventário repetido confirmou as contagens abaixo. Após as suítes, SQL
confirmou zero roles, locadoras, usuários, endereços e motoristas de paridade e
as 19 migrations preexistentes concluídas. Servidores do setup e o PostgreSQL
próprio (PID 6344) foram encerrados; as quatro portas HTTP da última paridade e
a porta do banco ficaram sem listener. Logs/sondas ficaram no TEMP externo. O
SHA-256 do handoff canônico permaneceu idêntico. Nenhuma validação visual, de CI
remoto, Docker ou produção é reivindicada.

### Estado da API legada

As 149 rotas e 193 métodos declarados da raiz continuam ativos. Serviço parcial
com 14 rotas/14 GETs; web permanece sem handlers de backend. O GET legado não
foi removido ou modificado; os writes continuam exclusivos dele. Não houve push,
deploy, migration, troca de proxy/origem ou produção.

### Dívida/risco restante

A consulta já existente retorna o DTO completo, incluindo userId e tenantId; a
extração preservou esse contrato. Não adiciona cache explícito. Qualquer mudança
desses contratos exige um corte funcional próprio. Cookies reproduzidos em HTTP
local não provam navegador, Expo, Docker ou origem de produção. Os demais
adapters privados, permissões, mutações, pagamentos, uploads e jobs seguem
pendentes. A antiga pasta `app/` permanecia necessária naquela transição.

### Próximo corte recomendado naquela onda

Compartilhar a composição granular de permissões e instalar uma leitura
administrativa que a utilize, preservando overrides do vínculo, políticas de
papel e revalidação, antes de extrair mutações. A API legada continua sendo a
autoridade configurada até a paridade e a operação completas serem comprovadas.

## Corte 14 — permissões e categorias administrativas (2026-10-01, sem commit)

### O que foi implementado

Política de `requireTenantPermission` extraída para
`backend/identity/createTenantPermissionResolver`. A fachada legada e a
composição do serviço usam o principal real e um leitor lazy de banco.
`GET /api/admin/categories` foi instalado no serviço; o host apenas compõe
catalog e a transação de locação existentes e adapta Request/Response. Nenhuma
regra de negócio foi copiada ao host, e o adapter legado não foi removido.

### Arquivos criados/modificados

- Backend: novo `identity/tenant-permission.ts`, com export explícito em
  `identity/index.ts`; `lib/tenant-permissions.ts` (caminho antigo) passa a
  delegar à factory.
- Host: novas composições `src/host/permissions.ts` e `src/host/catalog.ts` e
  adapter `src/app/api/admin/categories/route.ts`.
- Caracterização: `tenant-permission-request.test.ts` e
  `admin-categories-read-api.test.ts`. Inventário estrutural acompanha a
  composição e ganhou casos adversariais. Setup e HTTP de organizações incluem
  grants exatos/estrangeiros/sem tenant e a leitura administrativa.
- Higiene: duas ocorrências de dívida de CatalogService saíram da baseline, pois
  o tipo agora é consumido pelo host. Nenhuma exceção nova.
- Documentação: esta página, permissões admin, ADR, modernização, overview,
  boot, entrada 159 de known-issues e índice e CHANGELOG. Handoff canônico
  intacto.

### Contratos preservados

- Principal e membership ativos são revalidados por requisição. A recusa do
  principal é retornada sem alterar status/corpo. Não existe tenant padrão.
- CLIENT é recusado mesmo com Permission armazenada. ADMIN do vínculo passa sem
  consulta de Permission. FINANCIAL/OPERATOR exigem tenantId, role, module e
  action exatos na transação da locadora, sem cache ou grant global.
- Categorias exigem EQUIPMENTS/READ. Retorno é array sem envelope, com DTO
  completo e `_count.equipments`, em ordem de criação decrescente. Query não
  altera principal, grant, filtros ou ordenação. A consulta e o lock de locação
  permanecem no módulo catalog/rentals.
- `force-dynamic`, runtime Node, revalidate zero, headers/cookies, recusas e 500
  `{ error: 'Erro ao buscar categorias' }` preservados. O log de erro existente
  também foi preservado, sem alegar sanitização do log do servidor.
- HEAD mantém status e corpo vazio. OPTIONS do serviço oferece somente
  GET/HEAD/OPTIONS, e writes respondem 405; o POST legado continua instalado.
- Factory de permissão não executa I/O na criação. O inventário exige a
  delegação dos argumentos originais e os leitores reais, segue o principal e a
  recusa central de mesma origem, e confere o discriminante na closure.

### Testes executados e resultados

Antes da extração, 119 caracterizações passaram (18 da política, cinco do GET
legado e 96 de catalog existentes). Depois, 143 passaram: política e adapter nos
dois hosts e criação da factory sem efeitos, mantendo catalog existente.

| Verificação final local                          | Resultado                                                                                                             |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Unidade completa, incluindo gates de ferramentas | 74 arquivos, 1.289 aprovados                                                                                          |
| Identidade, depois dos unitários                 | 13 arquivos, 134 aprovados                                                                                            |
| Segurança                                        | 27 arquivos, 665 aprovados e 18 skips condicionais existentes                                                         |
| Inventário focado                                | 64 aprovados, incluindo composições e bypasses adversariais                                                           |
| Tipos                                            | 12 projetos e raiz aprovados                                                                                          |
| Builds                                           | Serviço e legado aprovados, com URL fictícia de banco                                                                 |
| HTTP de produção local com NextAuth              | Sete arquivos, 523 aprovados                                                                                          |
| HTTP de produção local com Better Auth           | Sete arquivos, 523 aprovados                                                                                          |
| Lint, arquitetura e nomes                        | Exit 0; nove packages, 1.050 achados existentes/zero novos; 430 colocados, três exceções existentes/zero novos órfãos |
| Higiene                                          | Exit 0; 951 achados aceitos em 275 itens, após retirar duas ocorrências resolvidas                                    |
| Ratchet contra `55763c1e`                        | Exit 0; arquitetura/tokens e proteções não ampliados                                                                  |

Os 27 novos casos HTTP e a extensão de revogação de sessão usam cookies emitidos
pelo legado, sem sessão fake. Verificam os quatro papéis, quatro dimensões da
concessão, grant revogado depois do login, seleção, conflitos, borda forjada,
membership revogada/suspensa, tenant suspenso, DTO completo, ordem, vazio, query
ignorada, erros reais de SELECT e HEAD/OPTIONS/405.

Runtime de prova: role NOLOGIN/NOSUPERUSER/NOBYPASSRLS/NOINHERIT sem ownership.
Sem contexto, a consulta de Permission vê zero linhas; no tenant A vê grants
somente de A, excluindo B e linhas sem locadora. Papel/módulo/ação são
predicados adicionais da aplicação. ADMIN continua funcionando quando SELECT de
Permission é retirado, enquanto o papel dependente de grant recebe o 500
original. Retirar SELECT de categories também reproduz o erro original.

Após as suítes, SQL confirmou zero roles, locadoras, usuários, endereços,
motoristas e permissões de paridade, zero permissões sem tenant e as 19
migrations preexistentes concluídas. Não houve migration neste corte. As quatro
portas HTTP ficaram sem listener; o PostgreSQL próprio (PID 9972) foi encerrado
e sua porta ficou sem listener. Logs/sondas estão no TEMP externo. O SHA-256 do
handoff canônico permaneceu idêntico. Os avisos de depreciação preexistentes de
pg durante suites de banco continuam visíveis.

### Estado da API legada

149 rotas e 193 métodos declarados da raiz preservados. Serviço parcial com 15
rotas/15 GETs; cliente web com zero handlers de backend. A fachada de permissão
mudou somente a delegação; os adapters e todas as escritas legadas continuam
instalados. Nenhum cliente, proxy, cookie, scheduler ou autoridade de escrita
foi alterado. Sem commit, push, deploy ou produção.

### Dívida/risco restante

Paridade local não prova browser, Expo, Docker, staging multi-host ou produção.
O log de erro e o DTO completo foram preservados como contratos observados;
qualquer revisão deles precisa de um corte próprio. Menus e helpers legados de
allowlist seguem seus contratos. Autorização atual por requisição não promete
atomicidade entre revogação concorrente de membership/grant e uma operação já
iniciada. Mutações, login/callbacks, pagamentos, arquivos, jobs e composição
operacional ainda dependem do legado, e a modernização completa segue pendente.

### Próximo corte recomendado naquela onda

Instalar leituras administrativas de unidades físicas, reutilizando catalog e o
resolver granular agora compartilhado. Caracterizar filtros, parâmetros,
ownership por locadora, DTOs, papel/concessão e falhas antes de montar adapters.
Continuar somente com cortes reversíveis; writes, cutover e remoção da raiz
dependem de suas provas próprias.

## Corte 15 — leituras de unidades físicas (2026-10-01, sem commit)

### O que foi implementado

Instalados `GET /api/admin/equipment-units` e `/[id]` no serviço. A composição
catalog existente foi reunida numa função privada, usada por categorias e
unidades: banco real, `withTenantTransaction`, `createRentalTransaction` e
`createCatalogService`. Nenhuma consulta ou regra de unidade foi copiada ao
host. Os adapters e a lógica catalog legados não foram alterados neste corte.

### Arquivos criados/modificados

- Host: dois `route.ts` novos em `src/app/api/admin/equipment-units` e
  composição `src/host/catalog.ts`.
- Caracterização: `tests/unit/equipment-units-read-api.test.ts`; fixtures,
  privilégios e limpeza em `tests/api-host/global-setup.ts`; casos de HTTP em
  `organizations.http.test.ts`, incluindo revogação de sessão.
- Inventário: `tests/security/route-auth-inventory.test.ts` reconhece o alias
  público de CatalogError, resolve até a mesma classe da fachada e rejeita
  mutações dessa classe por esse alias. A verificação de definição/usos, as
  allowlists públicas e os timeouts permanecem ativos.
- Documentação: esta página, ADR, modernização, overview, boot, admin-system,
  permissões admin, entrada 159/índice e CHANGELOG. Handoff canônico intacto.

### Contratos preservados

- EQUIPMENTS/READ e principal atual precedem consulta e params. CLIENT é
  recusado mesmo com grant; ADMIN do vínculo dispensa lookup; FINANCIAL e
  OPERATOR precisam da concessão exata por locadora/papel/módulo/ação.
- Lista sem envelope, ordenada por uniqueCode crescente. Primeiro valor de
  equipmentId/status/search, filtros vazios, conjunção e busca sem distinção de
  caixa preservados. `%` e `_` mantêm o comportamento observado de wildcard do
  PostgreSQL; nenhuma sanitização nova foi introduzida.
- DTO completo, equipamento e nome da categoria, null/zero e medidores Decimal
  textuais. Query não altera principal, grant, ordem ou ID da rota de detalhe.
- Transação e lock de locação existentes, tenantId explícito e RLS. Registro
  estrangeiro, inexistente ou sem locadora recebe o mesmo 404 de detalhe
  `{ error: 'Unidade não encontrada' }`, depois da autorização.
- Enum inválido mantém 500 na lista. CatalogError mantém status/mensagem no
  detalhe; erros genéricos e logs originais são preservados. Headers, cookies,
  force-dynamic, Node, revalidate zero e ordem dos erros não mudaram.
- HEAD tem corpo vazio; OPTIONS oferece GET/HEAD/OPTIONS. Writes recebem 405 no
  serviço; POST/PATCH/DELETE continuam declarados e disponíveis no legado.

### Testes executados e resultados

Antes da instalação, 116 caracterizações passaram: 20 do adapter legado e 96 de
catalog. Depois, 146 passaram: 40 dos dois adapters, catalog existente e dez
casos do GET de categorias, protegendo a composição reutilizada.

| Verificação final local                | Resultado                                                                                                             |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Unidade completa                       | 75 arquivos, 1.329 aprovados                                                                                          |
| Identidade                             | 13 arquivos, 134 aprovados                                                                                            |
| Segurança                              | 27 arquivos, 666 aprovados e 18 skips condicionais preexistentes                                                      |
| Inventário focado                      | 65 aprovados, com prova adversarial do alias público                                                                  |
| Tipos                                  | 12 projetos e raiz aprovados                                                                                          |
| Build do serviço                       | Aprovado; banco fictício, 17 GETs na saída                                                                            |
| HTTP de produção local com NextAuth    | Sete arquivos, 561 aprovados                                                                                          |
| HTTP de produção local com Better Auth | Sete arquivos, 561 aprovados                                                                                          |
| Lint, arquitetura e nomes              | Exit 0; nove packages, 1.050 achados existentes/zero novos; 430 colocados, três exceções existentes/zero órfãos novos |
| Higiene                                | Exit 0; 951 achados aceitos em 275 itens, sem alteração da baseline neste corte                                       |
| Ratchet contra `55763c1e`              | Exit 0; baselines e proteções não ampliadas                                                                           |

Os 38 casos HTTP novos comparam corpo/status/cache/Vary/cookies/Allow e estendem
a revogação real de sessão aos dois GETs. Exercitam DTO, filtros, transportes,
conflitos, grants revogados após login, papéis, membership revogada/suspensa,
tenant suspenso/vazio, ID estrangeiro/sem tenant e falha real de SELECT. Usam
cookies emitidos pelo legado; não há sessão fake.

O runtime de teste é NOLOGIN/NOSUPERUSER/NOBYPASSRLS/NOINHERIT, sem ownership.
SELECT em equipment_units não vê linhas sem contexto; no tenant A, vê somente
suas cinco unidades, excluindo B e histórico sem locadora; rollback limpa o
contexto. Privilégio de leitura retirado reproduz os 500 originais nos dois
hosts e é restaurado no finally. Não houve migration: as 19 existentes continuam
aplicadas.

O inventário inicialmente detectou o alias público ainda não registrado. A
correção exige resolução para a mesma definição, sem aceitar classe nova ou
efeitos no alias. Houve também timeout numa execução anterior do scan sob carga;
a execução sequencial e a suíte final passaram sem mudar o timeout. Avisos
preexistentes de pg permanecem visíveis. O build legado aprovado no corte 14 foi
reutilizado: os adapters legados e seu código catalog não mudaram neste corte;
ambos foram exercitados em produção local novamente.

Limpeza final por SQL: zero roles, locadoras, usuários, unidades, permissões,
motoristas e endereços de paridade, incluindo unidades/permissões sem tenant. As
quatro portas HTTP ficaram sem listener. O PostgreSQL próprio (PID 51636) foi
encerrado e sua porta ficou sem listener. Logs/sondas estão no TEMP externo.
SHA-256 do handoff canônico permanece idêntico.

### Estado da API legada

149 rotas/193 métodos declarados da raiz preservados; 17 rotas/17 GETs no
serviço parcial e zero handlers de backend no cliente web. A pasta `app/`
(caminho antigo) da raiz continua transitória e necessária. Clientes, proxy,
cookies, scheduler, escritas e autoridade configurada permanecem legados. Sem
commit, push, deploy ou alteração de produção.

### Dívida/risco restante

Paridade local não certifica browser, Expo, Docker, staging multi-host ou
produção. DTO completo e logs originais continuam sendo contratos observados,
sem revisão funcional. A interface frontend dos medidores usa number enquanto o
JSON legado é textual; a inconsistência preexistente não foi corrigida durante a
extração. Mutações, identidade de escrita, efeitos, pagamentos, arquivos, jobs e
operação/cutover continuam pendentes. O incremento não conclui a modernização
inteira nem autoriza remover a raiz.

### Próximo corte recomendado naquela onda

Detalhe administrativo de equipamento (`GET /api/admin/equipments/[id]`), que
reutiliza a composição catalog e EQUIPMENTS/READ. A lista administrativa deve
caracterizar também paginação e o limitador `adminApiRateLimit/checkRateLimit`
antes de instalar seu substituto; o limiter ainda é composto na raiz. Escritas e
cutover exigem provas próprias.

## Corte 16 — detalhe administrativo de equipamento (2026-10-01, sem commit)

### O que foi implementado

Instalado `GET /api/admin/equipments/[id]` no serviço, com adapter fino e a
delegação readEquipment na composição catalog existente. Consulta, DTO,
transação, lock e regras permanecem no createCatalogService do backend. Os
adapters e a lógica catalog legados não mudaram neste corte.

### Arquivos criados/modificados

- Novo `apps/services/api/src/app/api/admin/equipments/[id]/route.ts` e método
  readEquipment em `src/host/catalog.ts`.
- Novo `tests/unit/admin-equipment-read-api.test.ts`; fixtures, privilégio de
  leitura e limpeza em `tests/api-host/global-setup.ts`; casos de detalhe e
  revogação de sessão em `organizations.http.test.ts`.
- Esta página, ADR, modernização, overview, boot, admin-system, permissões admin
  e CHANGELOG. Handoff canônico e proteções/baselines intactos.

### Contratos preservados

- EQUIPMENTS/READ precede params e consulta. Principal, seleção, membership e
  concessão são revalidados por requisição; papéis seguem a política existente.
- ID vem dos params prometidos, sem override de query. DTO administrativo
  completo, categoria completa, imagens, campos privados autorizados,
  pricePerDay numérico, demais decimais textuais e isAvailable preservados.
- A contagem de detalhe mantém quoteItems e reviews zero; rental_items não passa
  a ser exposto nesse objeto. Equipamento indisponível continua acessível ao
  membro autorizado, com available/isAvailable false.
- Transação e lock de locação, tenantId explícito e RLS existentes. Equipamento
  estrangeiro, ausente ou sem locadora mantém 404
  `{ error: 'Equipamento não encontrado' }` depois da autorização.
- CatalogError preserva status/mensagem; erros genéricos mantêm 500
  `{ error: 'Erro interno do servidor' }` e log original. Force-dynamic, Node,
  revalidate zero, headers e cookies mantidos. HEAD tem corpo vazio; OPTIONS do
  serviço oferece somente GET/HEAD/OPTIONS; mutações recebem 405.
- A lista administrativa não foi instalada neste corte: usa o limitador em
  memória antes da permissão e precisa de extração/caracterização próprias.
  PUT/DELETE de detalhe continuam somente no legado.

### Testes executados e resultados

Caracterização anterior à instalação com banco descartável: 120 aprovados (14 do
GET legado, 96 de catalog HTTP e dez de catalog/tenancy). Depois, 184 aprovados:
os dois adapters, catalog, unidades físicas e categorias que usam a composição.
A primeira execução sem a configuração de banco teve dez skips; esses casos
foram reexecutados e aprovados antes de alterar produção.

| Verificação final local                | Resultado                                                                                                             |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Caracterizações focadas                | Cinco arquivos, 184 aprovados                                                                                         |
| Segurança completa                     | 27 arquivos, 666 aprovados e 18 skips condicionais preexistentes                                                      |
| Inventário focado                      | 65 aprovados; analisador e allowlists não modificados neste corte                                                     |
| Tipos                                  | 12 projetos e raiz aprovados; raiz repetida após ajustes das fixtures                                                 |
| Build do serviço                       | Aprovado com banco fictício; 18 GETs na saída                                                                         |
| HTTP de produção local com NextAuth    | Sete arquivos, 590 aprovados                                                                                          |
| HTTP de produção local com Better Auth | Sete arquivos, 590 aprovados                                                                                          |
| Lint, arquitetura e nomes              | Exit 0; nove packages, 1.050 achados existentes/zero novos; 430 colocados, três exceções existentes/zero novos órfãos |
| Higiene                                | Exit 0; 951 achados aceitos em 275 itens, baseline não modificada neste corte                                         |
| Ratchet contra `55763c1e`              | Exit 0; baselines e proteções não ampliadas                                                                           |

São 29 casos HTTP novos, além da extensão do teste de sessão revogada. Comparam
corpo/status/cache/Vary/cookies/Allow usando cookies emitidos pelo legado.
Cobrem DTO e contagens não zeradas distintas por locadora, disponibilidade,
query ignorada, seleção, conflitos, concessão revogada, membership suspensa ou
revogada, tenant vazio/suspenso, ID estrangeiro/sem tenant, HEAD/OPTIONS/405 e
erros reais de SELECT em equipments e quote_items.

O runtime de prova mantém NOLOGIN/NOSUPERUSER/NOBYPASSRLS/NOINHERIT, sem
ownership. Sem contexto, SELECT de equipamentos vê zero linhas; no tenant A, vê
seus 12 registros, dois quote_items e nenhum registro de B ou equipamento sem
tenant. Rollback limpa o contexto. O papel ganhou somente SELECT em quote_items,
necessário à contagem existente; retirar esse privilégio reproduz o 500 original
nos dois hosts, e o finally o restaura.

A primeira rodada HTTP teve 14 falhas porque faltava esse SELECT no papel
descartável. Ao preparar contagens não zeradas, uma tentativa posterior falhou
no setup por usar o nome incorreto da relação do Quote; o schema define `items`,
e a fixture foi corrigida. Os logs de falha permanecem no TEMP. As duas rodadas
completas finais passaram sem mudar a aplicação, o schema ou as asserções para
acomodar os erros de setup. Nenhuma migration foi criada.

Build legado aprovado no corte 14 reutilizado; os adapters e o backend catalog
legados não mudaram e foram exercitados novamente em produção local. Não se
repetiram as suítes completas unitária/identidade neste corte: as
caracterizações focadas e as duas rodadas HTTP validam o código alterado; os
resultados completos anteriores continuam registrados no corte 15.

Limpeza final por SQL: zero roles, locadoras, usuários, equipamentos,
quote_items, unidades, permissões, motoristas e endereços de paridade, incluindo
equipamentos/unidades/permissões sem tenant. Permanecem as 19 migrations
aplicadas. As seis portas HTTP usadas nas tentativas estão sem listener. O
PostgreSQL próprio (PID 50796) foi encerrado e sua porta ficou sem listener.
Logs/sondas externos ao repositório. Handoff canônico intacto.

### Estado da API legada

149 rotas/193 métodos declarados da raiz preservados; serviço parcial com 18
rotas/18 GETs; zero handlers de backend no cliente web. Clientes, cookies,
proxy, scheduler e autoridade de escrita continuam legados. Sem commit, push,
deploy ou alteração de produção. A antiga raiz app/ ainda era necessária naquele
corte.

### Dívida/risco restante

Paridade local não prova browser, Expo, Docker, staging ou produção. O DTO
administrativo completo, placeholders da contagem e logs originais foram
preservados; qualquer revisão funcional exige corte próprio. A lista ainda tem
rate limit em memória por instância; sua extração não pode ser usada para trocar
silenciosamente essa política. Escritas, identidade de escrita, pagamentos,
arquivos, jobs e cutover continuam pendentes. Modernização inteira ainda não
concluída.

### Próximo corte recomendado naquela onda

Extrair o limitador genérico compartilhável para backend, conservando os stores
por escopo/instância, limites, relógio, IP confiável, formatos de 429 e headers
e consumidores legados. Caracterizar a lista administrativa e instalar seu GET
com paginação/filtros/DTO atuais, mantendo a ordem limite → permissão →
consulta. O inventário deve seguir a nova composição, sem aceitar efeitos
adicionais antes da autorização ou afrouxar seus critérios.

## Corte 17 — limitador em memória e lista administrativa (2026-10-01, sem commit)

### O que foi implementado

Implementação genérica única em backend/http, composta separadamente pelos dois
hosts. O serviço instala GET /api/admin/equipments, reutilizando listEquipments,
transação de catálogo/locadora e EQUIPMENTS/READ. Ordem limite → permissão →
consulta preservada. Nenhum login, write, callback, pagamento ou job instalado.

### Arquivos criados/modificados

- packages/backend/src/http/memory-rate-limit.ts e index.ts: store limitado,
  factories, quatro janelas e formatação de 429, sem Next/Prisma/I/O.
- lib/rate-limit.ts (caminho antigo): fachada NextRequest dos consumidores
  administrativos e estritos; composição persistente da identidade preservada.
  Seis pontes sem consumidores de produção foram retiradas; os testes do store e
  das factories passam a importar sua implementação dona no backend.
- apps/services/api/src/host/rate-limit.ts e catalog.ts: ligação ao leitor real
  de IP e ao catalog compartilhado, sem consulta/regra duplicada no host.
- apps/services/api/src/app/api/admin/equipments/route.ts: adapter GET fino.
- tests/unit/admin-equipment-list-api.test.ts e memory-rate-limit.test.ts:
  caracterização; tests/security/route-auth-inventory.test.ts: prova da factory,
  exports/dependências e casos adversariais; organizations.http.test.ts:
  paridade.
- ADR, modernization, overview, boot, admin-system, permissões, known issues e
  CHANGELOG: estado documentado. Handoff canônico preservado.

### Contratos preservados

- Memória: um store por limitador e composição/processo; teto de 50 mil chaves,
  eviction das janelas mais antigas, sweep e expiração estritamente depois do
  reset, chave/IP confiável ou anonymous. Janelas de 5/15 min, 100/1 min, 200/1
  min e 10/1 min mantidas; consumeRateLimit conserva seu store próprio.
- Check: identidade da função determina X-RateLimit-Limit; custom limiter mantém
  fallback histórico 10. JSON 429, Retry-After e três X-RateLimit-* preservados.
  Sucesso da lista não ganha esses headers, como no legado.
- Lista: primeira ocorrência de cada query, page padrão 1/limit padrão 100,
  parseInt e filtros search/categoryId/isAvailable existentes, sem teto novo.
  DTO completo, pricePerDay numérico, demais decimais textuais, contagens e
  ordenação por createdAt desc. Erros/precedência/logs preservados.
- Cliente sem membership/grant exata não lê dados; CLIENT é recusado mesmo com
  Permission gravada; ADMIN do vínculo dispensa lookup. RLS FORCE e runtime sem
  bypass/ownership; sem locadora padrão ou ampliação da allowlist.
- Fachada legada conserva os limitadores administrativo/estrito e
  checkRateLimit, com suas assinaturas; GET e POST antigos usam o mesmo balde
  administrativo. Contadores entre processos continuam independentes.
  MemoryRateLimitStore, MAX_RATE_LIMIT_ENTRIES, consumeRateLimit, rateLimit,
  authRateLimit e apiRateLimit não tinham consumidores de produção na fachada:
  somente essas pontes foram retiradas. A implementação e suas provas permanecem
  no backend.

### Testes executados e resultados

| Verificação                                  | Resultado                                                                  |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| Caracterização antes de mover/instalar       | 24 testes passaram contra o legado intacto                                 |
| Foco após extração                           | 158 testes passaram, incluindo catalog HTTP e tenancy no banco descartável |
| Paridade HTTP em produção local, NextAuth    | 625 testes / 7 arquivos passaram                                           |
| Paridade HTTP em produção local, Better Auth | 625 testes / 7 arquivos passaram                                           |
| Unit completa                                | 1.409 testes / 78 arquivos passaram                                        |
| Identidade completa                          | 134 testes / 13 arquivos passaram                                          |
| Segurança completa                           | 667 passaram / 18 pulados condicionais existentes, 27 arquivos             |
| Tipos                                        | typecheck dos 12 projetos e type-check da raiz passaram                    |
| Builds API e legado                          | Aprovados com banco fictício; serviço com 19 GETs                          |

São 35 casos HTTP novos e a extensão do teste de sessão revogada. Comparam
status, corpo, cache, Vary, cookies e Allow. Exercitam filtros/paginação/DTO,
permissão e membership revalidadas, tenant vazio/suspenso, conflitos, falha real
de SELECT, HEAD/OPTIONS/405 e limite contado antes da identidade. O flood
alterna 100 GETs e 100 POSTs legados sem sessão, todos 401 antes da janela
esgotar; o serviço conserva suas 200 tentativas próprias. IPs falsos não
contornam o contador da borda. Reset/Retry-After absolutos são verificados em
seus intervalos reais por processo; relógio controlado cobre valores exatos e a
fronteira de expiração. Não foram alteradas asserções/timeouts para acomodar o
runtime.

A primeira unit completa teve somente quatro falhas do hook de commit: spawnSync
sh ENOENT, porque Git Bash não estava no PATH. A execução completa foi repetida
com o ambiente correto, sem mudar testes/código do hook. Avisos antigos de
concorrência do driver pg permanecem; nenhuma dependência foi atualizada. Logs
externos em TEMP (prefixo codex-cut17). As rodadas HTTP finais usam os builds
recompilados de ambos os hosts. Não foi criado schema/migration.

Uma rodada HTTP foi iniciada acidentalmente no perfil dev padrão e teve 610
casos aprovados e 15 falhas: a suíte exige cookies Secure e erros sanitizados de
produção. A rodada foi repetida com API_HOST_MODE=production e
API_LEGACY_MODE=production, sem adaptar expectativas ou timeouts ao perfil
incorreto. Essa rodada dev não constitui prova de paridade em produção local.

Higiene passou após retirar os exports sem uso; sua baseline perdeu somente a
entrada obsoleta de lib/rate-limit.ts (caminho antigo):consumeRateLimit. Nenhuma
exceção nova foi adicionada. As provas anteriores do limitador continuam na
implementação dona, com dois casos adicionais dos consumidores reais da fachada
legada.

Lint, arch, check:test-names, hygiene, ratchet:guard, markdownlint e validação
dos índices/links da documentação passaram. Os gates não ganharam tolerância.

### Estado da API legada

149 rotas/193 métodos declarados ativos. Serviço parcial com 19 rotas/19 GETs;
cliente web sem handlers de backend. a antiga raiz app/ ainda era necessária
naquele corte; `apps/services/api/src/app` e `apps/clients/web/src/app` dos
hosts Next e `packages/frontend/src/app` do frontend FSD são responsabilidades
diferentes. Clientes/proxies/jobs/cookies e autoridade de escrita continuam
legados. Sem commit, push, deploy, produção ou mudança de base URL.

### Dívida/risco restante

Rate limit em memória segue por instância e pode perder janelas por eviction ou
restart; não oferece quota global entre réplicas. OpenAPI legado diverge dos
parâmetros/limites observados da lista; não foi usado para alterar
comportamento. Paridade local não certifica browser, Expo, Docker, staging,
produção nem cutover. Escritas, documentos, comunicações, jobs e identidade de
escrita continuam pendentes. A modernização inteira não está concluída.

### Próximo corte recomendado naquela onda

Caracterizar GET /api/admin/permissions e extrair sua consulta para identidade
compartilhada, mantendo ADMIN do vínculo como condição explícita antes de ler
Permission, ordem/DTO, sessão atual e RLS. O PUT e a gestão de concessões
permanecem legados até prova própria; não criar endpoint novo de categoria ou
motorista que o legado não possui.

## Corte 18 — leitura da matriz de permissões (2026-10-02, sem commit)

### O que foi implementado

GET /api/admin/permissions instalado em adapter fino. O SELECT original foi
movido para listTenantPermissions em backend/identity; o GET legado delega à
mesma consulta dentro da transação existente. O host do serviço liga seu runtime
a withTenantTransaction, sem SQL ou regra nova no adapter.

### Arquivos criados/modificados

- packages/backend/src/modules/identity/tenant-permissions-read.ts e index.ts.
- apps/services/api/src/host/permission-rows.ts e
  src/app/api/admin/permissions/route.ts.
- app/api/admin/permissions/route.ts (caminho antigo): somente import e
  delegação do SELECT do GET. PUT, schema, lock e atualização permanecem
  intactos.
- tests/unit/admin-permissions-read-api.test.ts; organizations.http.test.ts.
- Esta página, ADR, modernization, overview, boot, admin-system, permissões e
  CHANGELOG. Handoff canônico preservado.

### Contratos preservados

- Principal original e sua resposta de recusa antes de qualquer consulta.
  Somente ADMIN da membership atual lê a matriz; o papel global e concessões de
  CLIENT/FINANCIAL/OPERATOR não substituem esse requisito.
- withTenantTransaction mantém app.tenant_id local e RLS FORCE; where tenantId
  explícito. Linhas de outra locadora ou sem tenant não entram na lista.
- Envelope permissions, todos os campos e role/module/action asc preservados.
  Query não escolhe identidade, locadora, papel, filtro, projeção ou ordenação.
- Falhas do principal/transação/consulta continuam propagadas ao framework, sem
  catch ou envelope novo. Erro real de SELECT é sanitizado pelo Next em produção
  local, como no legado; status/corpo/headers comparados por HTTP.
- Sessão, cookies, cache/Vary e HEAD observados preservados. OPTIONS do legado
  mantém PUT; o serviço anuncia somente GET/HEAD/OPTIONS e recusa mutações
  com 405. Nenhuma mutation do serviço, fallback ou redirecionamento foi
  instalado.

### Testes executados e resultados

- Antes da extração: 15 caracterizações passaram contra o GET legado intacto.
- Depois: 30 caracterizações passaram nos dois adapters. Remover where tenantId
  derruba quatro casos; retirar ADMIN de cada adapter derruba seus três casos de
  papéis recusados. Os três arquivos foram restaurados byte a byte, hash
  conferido, e os 30 casos passaram novamente.
- Inventário de autorização: 66 casos aprovados sem mudar regras/allowlists.
- HTTP dos builds em produção local: 649 casos / sete arquivos aprovados em
  NextAuth e 649 em Better Auth. São 24 casos novos e a extensão de revogação da
  sessão; cobrem DTO/ordenação/RLS, ADMIN do vínculo, concessões insuficientes,
  ausência/conflito de seleção, sessão forjada/revogada, membership revogada,
  suspensão, consulta vazia, falha real de SELECT e HEAD/OPTIONS/405.
- typecheck dos 12 projetos, type-check da raiz e builds API/legado aprovados.
  Nenhuma dependência ou migration foi acrescentada.
- Unit completa: 1.439 testes / 79 arquivos aprovados. Segurança completa: 667
  aprovados / 18 pulados condicionais existentes, 27 arquivos. Lint, arch,
  check:test-names, hygiene e ratchet:guard aprovados, sem ampliar baseline ou
  allowlist. Avisos existentes de concorrência do driver pg permanecem.

Limpeza verificada por SQL no banco descartável: zero roles/locadoras/usuários
de paridade, zero permissões de paridade e zero permissões/equipamentos/unidades
sem tenant; as 19 migrations aplicadas permanecem. Os dois servidores de cada
rodada foram encerrados pelo cleanup da suíte. O PostgreSQL iniciado nesta
execução foi encerrado após conferir seu PID, com a porta 55441 fechada.
Inventário final em TEMP: 149 rotas/193 métodos/46 páginas legados, vinte
rotas/vinte GETs no serviço, zero handlers backend no web (53 páginas) e 23
páginas mobile. Logs de validação fora do repositório, prefixo codex-cut18.

### Estado da API legada

149 rotas/193 métodos declarados continuam ativos; serviço parcial com vinte
rotas/vinte GETs. Clientes e jobs mantêm a configuração e a autoridade legadas.
a antiga raiz app/ ainda era necessária naquele corte durante a migração. Sem
commit, push, deploy, produção ou troca de base URL.

### Dívida/risco restante

Paridade local não certifica browser, Expo, Docker, staging ou produção. A API
de escrita da matriz continua no legado, com seu lock e transação; as demais
escritas, callbacks, pagamentos, arquivos, comunicações e jobs também dependem
de cortes próprios. A modernização inteira permanece incompleta.

### Próximo corte recomendado naquela onda

Caracterizar e instalar GET /api/user/profile usando o CustomerProfileService
existente. Preservar o perfil comercial por usuário e locadora, o 404 sem perfil
e a ausência de fallback para o cadastro global. O PUT deve continuar legado até
prova específica; não ampliar o DTO nem alterar a política de documentos.

## Corte 19 — perfil comercial do usuário (2026-10-02, sem commit)

### O que foi implementado

GET /api/user/profile instalado no serviço parcial. A composição customers liga
createCustomerProfileService à transação RLS e ao runtime de banco do processo.
Consulta, DTO e regras continuam na implementação existente em
backend/customers; nenhum SQL ou regra foi duplicado no host.

### Arquivos criados/modificados

- apps/services/api/src/host/customers.ts e src/app/api/user/profile/route.ts.
- tests/unit/customer-profile-read-api.test.ts e
  tests/api-host/profiles.http.test.ts.
- tests/api-host/identity.ts: helper de login/cookies extraído de
  organizations.http.test.ts, preservando suas asserções.
- tests/api-host/global-setup.ts: SELECT em client_profiles para o papel de
  runtime e limpeza dessas fixtures. Nenhuma permissão de escrita acrescentada.
- tools/hygiene-baseline.json: retiradas apenas as duas exceções de tipo
  CustomerProfileService sem consumidor, agora usado pela composição real.
- customer-profile.md, esta página, INDEX, ADR, modernization, overview,
  boot/context-map e CHANGELOG. Handoff canônico inalterado.

### Contratos preservados

- O principal revalida sessão, membership e locadora; query não escolhe usuário
  ou tenant. CLIENT, ADMIN, FINANCIAL e OPERATOR leem somente seu perfil.
- Chave composta tenantId/userId e app.tenant_id local permanecem. Perfil de
  outro usuário/tenant, sem vínculo ou sem usuário não substitui o solicitado.
- Envelope user e seus sete campos, id=userId, nulidade e no-store. Sem
  identificadores internos, dados de login global ou fallback.
- Documento continua classificado pelo comprimento bruto armazenado; a dívida de
  formatação/normalização está explícita em customer-profile.md.
- Perfil ausente conserva o 404; CustomerError conserva mensagem/status; falha
  inesperada conserva o 500 genérico. Nenhuma criação implícita.
- GET/HEAD e headers iguais aos do legado. O serviço anuncia GET/HEAD/OPTIONS,
  recusa writes com 405 e não encaminha ao legado; PUT legado segue instalado.

### Testes executados e resultados

- Caracterização antes da instalação: 84 aprovados em dois arquivos, incluindo
  25 casos novos contra o GET legado intacto e 59 existentes de customers-http.
- Depois: 109 aprovados nos mesmos dois arquivos, incluindo os 50 casos nos dois
  adapters. A consulta e o adapter legados não foram alterados.
- HTTP dos builds em produção local: 679 testes / oito arquivos aprovados em
  NextAuth e 679 em Better Auth. São 30 casos novos de perfil; os 649 anteriores
  continuam passando com o helper de login compartilhado.
- Os novos casos HTTP incluem cookies reais, DTO/nulos, seleções e conflitos,
  todos os papéis, mudança de perfil após login, sessão/membership revogadas,
  suspensão, 404 sem escrita, SELECT realmente negado, SQL RLS sem
  bypass/ownership e isolamento de contexto após rollback.
- typecheck dos 12 projetos, type-check da raiz e builds API/legado aprovados.
  Unit completa: 1.489 testes / 80 arquivos; segurança: 667 aprovados / 18
  pulados condicionais existentes / 27 arquivos. Sem dependência ou migration
  nova. Avisos preexistentes de concorrência do driver pg permanecem.
- Lint, arch (nove pacotes, zero acima da baseline), check:test-names (430
  colocados, três exceções existentes), hygiene e ratchet:guard aprovados.
  Higiene caiu de 950 achados aceitos/274 itens para 948/273: as duas exceções
  obsoletas foram retiradas, sem ampliar proteção ou tolerância.

SQL pós-testes confirmou zero roles/locadoras/usuários/perfis/permissões de
paridade, zero permissões/equipamentos/unidades sem tenant e 19 migrations
aplicadas. Os servidores de cada rodada foram encerrados pela suíte. O
PostgreSQL deste corte foi encerrado conferindo o PID próprio, porta 55441
fechada. Inventário: 149 rotas/193 métodos/46 páginas legados, 21 rotas/21 GETs
no serviço, zero handlers de backend no web (53 páginas) e 23 páginas mobile.
Logs fora do repositório, prefixo codex-cut19. Handoff canônico com o mesmo
hash.

### Estado da API legada

149 rotas/193 métodos declarados preservados; serviço parcial com 21 GETs.
GET/PUT de perfil da raiz e o serviço de clientes original permanecem intactos.
Clientes, base URL, login/callbacks e scheduler continuam legados. app/ (caminho
antigo) na raiz continua necessário durante a transferência. Sem commit, push,
deploy ou produção.

### Dívida/risco restante

O DTO legado usa comprimento bruto para CPF/CNPJ; PUT ainda tem a validação
numérica existente. Corrigir/modernizar documentos exige outro corte. Paridade
local não certifica browser, Expo, Docker, staging, produção ou cutover.
Escritas, pagamentos, arquivos, comunicações, callbacks e jobs continuam
pendentes; a modernização inteira não está concluída.

### Próximo corte recomendado naquela onda

Caracterizar GET /api/client/notifications: listagem paginada, filtros,
contagens e estatísticas possuem SELECTs ainda no adapter legado. Extrair a
consulta para um módulo de backend com ownership de usuário/locadora; preservar
parsing observado, validação, ordenação, DTO/erros e RLS. Marcar como lida,
excluir, sincronizar e criar notificações continuam legados até provas próprias.

## Corte 20 — leitura das notificações do destinatário (2026-10-02, sem commit)

### O que foi implementado

GET /api/client/notifications instalado no serviço. O módulo communications,
previsto na ADR, começa com listCustomerNotifications: os quatro SELECTs e a
resposta paginada saíram do adapter para uma implementação compartilhada. O
parser/schema existente foi movido para contracts/notifications; o backend não
recebeu zod ou dependência nova. O serviço liga o runner RLS ao seu runtime de
banco, sem SQL/regra de negócio ou segundo pool no host.

### Arquivos criados/modificados

- packages/backend/src/modules/communications/client-notifications.ts e
  index.ts; packages/backend/package.json: entrypoint ./communications.
- packages/contracts/src/notifications.ts e package.json: contrato puro e
  entrypoint ./notifications.
- apps/services/api/src/host/tenant-transaction.ts e
  src/app/api/client/notifications/route.ts.
- app/api/client/notifications/route.ts (caminho antigo): delegação ao
  parser/consulta compartilhados, mantendo o adapter e sua
  autorização/transação.
- apps/services/api/package.json e pnpm-lock.yaml: consumo workspace de
  contracts. Resolução do entrypoint conferida a partir do diretório do host,
  sem nova dependência externa.
- tools/ratchet-transfers.json: os dois entrypoints públicos reais registrados
  para a extração autorizada; sem exceção de segurança/baseline acrescentada.
- tests/unit/client-notifications-read-api.test.ts,
  tests/api-host/notifications.http.test.ts e global-setup.ts. Runtime recebe
  somente SELECT em notifications; limpeza cobre inclusive a fixture sem tenant.
- notification-system.md, esta página, INDEX, ADR, modernization, overview,
  boot/context-map e CHANGELOG. Handoff canônico preservado.

### Contratos preservados

- Recusa do principal antes de validar/consultar; contexto local de RLS antes da
  validação dentro da transação. Tenant e destinatário vêm do principal
  revalidado, sem fallback global ou alteração por query.
- DTO integral da Notification, createdAt desc, paginação/filtros e nulidade.
  Leitura não cria registros nem marca como lida.
- Primeiro valor de query e parseInt observados; padrões 1/20 e limite 1–100;
  tipos/booleanos sensíveis a caixa, vazios ignorados. Issues zod preservadas.
- Total da página/stat.total filtrado; unread/byType de todas as não lidas do
  destinatário na locadora, independentemente dos filtros da página. Chaves em
  minúsculas, tipos ausentes não preenchidos, totalPages zero com total zero.
- 400 de validação, 500 genérico/log sanitizado, recusas da identidade, ausência
  de cache header, HEAD/OPTIONS. Métodos não montados no serviço dão 405.

### Testes executados e resultados

- Antes: 56 caracterizações aprovadas no adapter legado intacto. Depois: 112
  aprovadas nos dois adapters; mesmas consultas, respostas e precedência.
- Mutações dirigidas: retirar userId ou tenantId da consulta derruba 50 casos
  cada; trocar parseInt por Number derruba 10. Fontes restauradas byte a byte,
  hash conferido, e os 112 casos aprovados novamente.
- Segurança focada: 112 testes aprovados em inventário e portal existentes, sem
  alterar qualquer regra/allowlist de autorização ou seus testes antigos.
- Builds HTTP em produção local: 745 testes / nove arquivos aprovados em
  NextAuth e 745 em Better Auth. São 66 novos casos; os 679 anteriores
  permanecem aprovados. Cookies são emitidos pelo login HTTP legado.
- Novos casos cobrem todos os tipos, paginação real, erros, filtro/estatísticas,
  quatro papéis, dois tenants/três identidades, nulidade/metadata, seleção e
  conflitos, revogação/suspensão, vazio sem escrita, SELECT realmente negado,
  SQL RLS sem bypass/ownership, rollback, HEAD/OPTIONS e 405. A
  marcação/exclusão legada continua instalada e o GET não altera o estado das
  fixtures.
- typecheck dos 12 projetos, type-check da raiz e builds API/legado aprovados.
  Unit completa: 1.601 testes / 81 arquivos; segurança: 667 aprovados / 18
  pulados condicionais existentes / 27 arquivos; identidade: 134 / 13 arquivos.
  Avisos de concorrência do driver pg são preexistentes; o paralelismo das
  consultas foi preservado.
- Lint, arch (nove pacotes, zero acima da baseline), check:test-names (430
  colocados, três exceções existentes), hygiene (948 achados/273 itens) e
  ratchet:guard aprovados. Este corte não alterou baseline ou regras de
  autorização; apenas registrou os novos entrypoints públicos nos transfers.

SQL pós-testes confirmou zero roles/locadoras/usuários/notificações/perfis de
paridade e zero notificações/permissões/equipamentos/unidades sem tenant. As 19
migrations continuam aplicadas. Inventário: 149 rotas/193 métodos/46 páginas
legados, 22 rotas/22 GETs no serviço, zero handlers de backend no web (53
páginas) e 23 páginas mobile. Os servidores HTTP das duas rodadas foram
encerrados pelo cleanup da suíte; PostgreSQL próprio encerrado após conferir o
PID, porta local 55442 fechada. A porta alternativa foi usada após startup
falhar em 55441; a configuração versionada não mudou. Logs ficam fora do
repositório, prefixo codex-cut20. Handoff canônico mantém seu hash.

### Estado da API legada

149 rotas/193 métodos declarados preservados; serviço parcial com 22 GETs.
Adapter GET legado permanece ativo usando a implementação compartilhada. Stats,
PATCH/DELETE, mark-all-read, sync, fan-out, login/callbacks, clientes e
scheduler continuam legados. Sem mudança de origem, schema, migration, produção,
commit, push ou deploy. app/ (caminho antigo) na raiz ainda participa do runtime
configurado.

### Dívida/risco restante

Parser legado permissivo por parseInt e campos integrais são compatibilidade
observada; endurecer/projetar campos exige outro contrato/corte. Comunicações
ainda só compartilham essa leitura; não se afirma que jobs, canais ou escritas
foram migrados. Paridade local não certifica browser, Expo, Docker, staging,
produção ou cutover. A modernização completa permanece em andamento.

### Próximo corte recomendado naquela onda

GET /api/client/notifications/stats: seus quatro SELECTs por destinatário e
locadora e agregados de tipo/prioridade ainda estão no adapter legado. Movê-los
para communications com caracterização prévia de total/unread, chaves, nulidade,
erros e isolamento; não reutilizar stats filtrado da listagem como se os dois
DTOs fossem o mesmo contrato. Em seguida, concluir marcação/exclusão com provas
de ownership, CSRF, transação e efeitos, antes de apontar clientes para o
serviço.

## Corte 21 — estatísticas de notificações (2026-10-02, sem commit)

### O que foi implementado

GET /api/client/notifications/stats montado em apps/services/api. As quatro
consultas e a montagem de seu DTO saíram do handler legado para
communications/client-notification-stats.ts. Os dois adapters usam o mesmo
módulo pelo entrypoint público existente; o serviço reutiliza seu runner RLS e
seu banco por processo. Sem consulta, parser ou regra de negócio duplicada no
host. Esta é uma etapa intermediária da extração, não sua conclusão.

### Arquivos criados/modificados

- packages/backend/src/modules/communications/client-notification-stats.ts e
  index.ts: agregados por tenant/destinatário e export nomeado.
- apps/services/api/src/app/api/client/notifications/stats/route.ts: adapter GET
  fino com principal, transação e transporte existentes.
- app/api/client/notifications/stats/route.ts (caminho antigo): adapter ativo
  delegando ao módulo compartilhado; assinatura, ordem de autorização e
  tratamento de erro mantidos.
- tests/unit/client-notification-stats-api.test.ts: caracterização anterior e
  posterior dos dois adapters, incluindo consultas e precedência.
- tests/api-host/notifications.http.test.ts: onze casos novos e asserções de
  stats nos cenários existentes de identidade, seleção, ownership e falha SQL.
  Mesmas fixtures, sessões, privilégios e cleanup; global-setup não mudou.
- notification-system.md, esta página, INDEX, ADR, modernization, overview,
  boot/context-map e CHANGELOG. Checkpoint canônico preservado.

### Contratos preservados

- Principal e recusas precedem RLS e consultas. Todos os SELECTs usam tenantId e
  userId do principal, inclusive com membership ADMIN. Query não substitui
  contexto, destinatário ou permissão; nenhuma locadora implícita.
- DTO `{ total, unread, byType, byPriority }`. Total de toda a caixa; mapas
  contam somente não lidas. Chaves em minúsculas, buckets sem registros
  ausentes. Caixa vazia e totalmente lida conservam seus resultados originais.
- Todos os parâmetros de query são ignorados: filtros e validação da listagem
  não foram aplicados a stats. As quatro consultas continuam concorrentes no
  mesmo Promise.all e na mesma transação da locadora.
- GET não escreve nem marca notificações. Erro inesperado mantém 500 genérico e
  log sanitizado; status/headers das recusas, ausência de cache/cookie,
  HEAD/OPTIONS e 405 de métodos não instalados preservados.

### Testes executados e resultados

- Antes da extração: 26 testes aprovados no adapter legado intacto. Depois: 52
  nos dois adapters; com os 112 da listagem, 164 aprovações focadas.
- Mutação: retirar userId ou tenantId das consultas derruba oito casos cada.
  Fontes restauradas byte a byte, hash conferido; 52 casos aprovados novamente.
- Segurança focada: 112 testes do inventário e portal existentes aprovados;
  nenhuma regra, allowlist ou teste anterior de autorização foi relaxado.
- Produção HTTP local: 756 testes / nove arquivos aprovados em NextAuth e 756 em
  Better Auth. Os 745 anteriores continuam aprovados. Cookies são emitidos pelo
  login legado real; o runtime PostgreSQL tem RLS FORCE e não possui
  bypass/ownership. Privilégios de notificações permanecem somente SELECT.
- Casos de stats cobrem quatro papéis, destinatários e locadoras diferentes,
  seleção por header/cookie/host e conflitos, memberships/organizações
  suspensas, sessão revogada, 404 neutro, vazio sem criação e SELECT realmente
  negado. Mudanças das fixtures provam todos os tipos/prioridades, atualização
  do unread, conservação do total e mapas vazios. Leitura não altera registros.
- typecheck dos 12 projetos, type-check da raiz e builds API/legado aprovados.
  Builds usam conexão fictícia; nenhum banco externo é usado. Unit completa:
  1.653 testes / 82 arquivos; segurança: 667 aprovados e 18 pulados condicionais
  existentes / 27 arquivos; identidade: 134 / 13 arquivos. Avisos preexistentes
  de concorrência pg não motivaram mudança de comportamento ou dependência.
- Lint, arch (nove pacotes, zero acima da baseline), check:test-names (430
  colocados, três exceções anteriores), hygiene (948 achados/273 itens) e
  ratchet:guard aprovados. Sem alterações de baseline, allowlist ou transfers.

Inventário atual: 149 rotas/193 métodos/46 páginas legados; 23 rotas/23 GETs no
serviço; zero handlers de backend e 53 páginas no web, 23 páginas no mobile. SQL
pós-testes confirmou zero roles/locadoras/usuários/notificações/perfis de
paridade e zero notificações/permissões/equipamentos/unidades sem tenant; as 19
migrations seguem aplicadas. Cleanup encerrou os servidores HTTP das duas
rodadas. PostgreSQL próprio encerrado após conferir seu PID, porta 55442
fechada; nenhum processo não pertencente a esta etapa foi encerrado. Logs,
scripts de sonda e inventário ficam fora do repositório, prefixo codex-cut21.
Handoff canônico conserva o hash original.

### Estado da API legada

Todas as 149 rotas/193 métodos continuam presentes e configurados. GET stats
permanece ativo, delegando à implementação compartilhada. PATCH/DELETE,
mark-all-read, sync, fan-out, login/callbacks, clientes e scheduler continuam
legados. Nenhum fallback no serviço, troca de origem, remoção do app/ (caminho
antigo) da raiz, schema, migration, produção, commit, push ou deploy.

### Dívida/risco restante

A migração completa continua pendente: leituras compartilhadas não comprovam
escritas, canais de comunicação, jobs ou cutover. Paridade HTTP local não
certifica browser, Expo, Docker, staging ou produção. A ausência original de
cache header e as queries ignoradas são compatibilidade observada; alterações
funcionais desses contratos exigem um corte específico.

### Próximo corte recomendado naquela onda

Marcação/exclusão das notificações do próprio usuário: PATCH/DELETE de [id] e
mark-all-read, com caracterização anterior de ownership, CSRF, validação,
transação, erros e efeitos. Compartilhar a implementação autoritativa em
communications e comparar mutações em fixtures equivalentes; manter os handlers
legados e os clientes configurados até a equivalência do substituto ser provada.

## Corte 22 — marcação/exclusão de notificações (2026-10-02, sem commit)

### O que foi implementado

PATCH/DELETE de /api/client/notifications/[id] e POST de mark-all-read montados
em apps/services/api. A consulta de ownership e seus efeitos saem dos handlers
legados para communications/client-notification-mutations.ts. Os adapters
conservam principal, guard explícito, transação RLS, params e transporte; usam o
mesmo módulo pelo entrypoint público existente. São as primeiras três mutações
do serviço parcial. Não se duplicaram queries/regras no host nem se concluiu a
migração completa.

### Arquivos criados/modificados

- packages/backend/src/modules/communications/client-notification-mutations.ts e
  index.ts: funções de marcação individual, exclusão e marcação de não lidas.
- apps/services/api/src/app/api/client/notifications/[id]/route.ts e
  mark-all-read/route.ts: adapters finos de PATCH/DELETE e POST.
- app/api/client/notifications/[id]/route.ts (caminho antigo) e
  mark-all-read/route.ts: delegação ao módulo compartilhado, mantendo os
  handlers ativos e a política original.
- tests/unit/client-notification-mutations-api.test.ts: caracterização antes e
  depois; testes usam o runner RLS real com transaction client controlado.
- tests/api-host/notifications.http.test.ts: 119 casos novos de escritas/efeitos
  e recusas, compartilhando fixtures, cookies e setup com as leituras.
- tests/api-host/global-setup.ts: role descartável recebe SELECT/UPDATE/DELETE
  em notifications e perde os três privilégios no cleanup. INSERT não foi
  concedido; nenhuma configuração de privilégios de produção mudou.
- notification-system.md, esta página, INDEX, ADR, modernization, overview,
  boot/context-map e CHANGELOG. Checkpoint canônico mantém o hash original.

### Contratos preservados

- Guard central de origem antes da identidade; guard explícito dos adapters
  depois do principal. 403 no-store para origem de locadora irmã, Origin null ou
  Sec-Fetch-Site incompatível; transporte nativo sem headers de navegador
  preservado. Principal revalida sessão, seleção, membership e organização.
- Params aguardados dentro da transação, após RLS. FindFirst e efeito usam
  id/tenantId/userId; nenhum papel global ou override por body/query amplia
  ownership. Registro inacessível, sem tenant ou inexistente mantém o mesmo 404.
- PATCH retorna Notification completa e sempre atualiza readAt, inclusive ao
  repetir sobre uma já lida. DELETE retorna mensagem original e repetição 404.
  POST retorna count/mensagem e altera somente não lidas do destinatário na
  locadora; repetir dá updated=0 e preserva as datas de registros já lidos.
- Bodies/queries são ignorados, inclusive JSON inválido. Não foi introduzido
  schema, validação de UUID ou mudança de parsing. Erros inesperados conservam
  500 e log sanitizados; cookies, cache, OPTIONS e 405 mantidos.
- SELECT e efeito permanecem na mesma transação. Falha após o write não deixa
  alterações parciais; demais usuários/tenants e linhas não atribuídas não
  mudam.

### Testes executados e resultados

- Antes da extração: 82 testes aprovados nos três handlers legados. Depois: 164
  nos dois adapters. Com as leituras já extraídas: 328 testes focados.
- Mutação: remover userId ou tenantId derruba 42 casos cada; remover
  isRead=false do bulk derruba 14. Fonte restaurada byte a byte, hash conferido;
  164 casos aprovados novamente.
- Segurança focada: 170 testes existentes de inventário, portal e CSRF
  aprovados, sem relaxar regras, allowlists ou testes anteriores.
- HTTP em produção local: 875 testes / nove arquivos aprovados em NextAuth e 875
  em Better Auth, incluindo os 756 anteriores. Artefatos dos dois hosts, cookies
  emitidos pelo login real e PostgreSQL descartável com RLS FORCE, runtime sem
  bypass/ownership. Nenhuma chamada de provedor/produção.
- Efeitos: fixtures equivalentes restauradas entre hosts; o estado inteiro da
  tabela é comparado antes/depois. readAt variável de PATCH é conferido contra
  relógio real, DTO e valor persistido; somente esse campo é normalizado para
  igualdade entre hosts. Bulk conserva datas já lidas; exclusão é verificada no
  banco e repetida; consultas e overrides não alteram o escopo.
- Recusas: sessões ausentes/forjadas/revogadas, CSRF antes da identidade, quatro
  papéis, seleção por header/cookie/host e conflitos, revogação/suspensão,
  destinatário/tenant diferente, linha sem tenant, id inexistente e caixa vazia.
  Privilegio de UPDATE/DELETE realmente revogado causa 500 sanitizado sem
  efeito.
- Rollback: triggers AFTER UPDATE/DELETE, somente no banco de teste e somente
  para fixture própria, lançam falha depois do write. Ambos os hosts respondem
  500 e conservam o snapshot inteiro. Triggers/funções são removidas em finally.
  SQL direto comprova RLS em UPDATE/DELETE e recusa WITH CHECK de troca de
  tenant; INSERT permanece sem grant. OPTIONS/405 e precedência das rotas
  mantidos.
- typecheck dos 12 projetos, type-check da raiz e builds API/legado aprovados;
  builds usam conexão fictícia. Unit: 1.817 testes / 83 arquivos; segurança: 667
  aprovados e 18 condicionais existentes pulados / 27 arquivos; identidade: 134
  / 13 arquivos. Avisos pg de concorrência permanecem preexistentes.
- Lint, arch (nove pacotes, zero acima da baseline), check:test-names (430
  colocados, três exceções anteriores), hygiene (948 achados/273 itens) e
  ratchet:guard aprovados. Sem alterar baselines, transfers ou proteções.

Inventário: 149 rotas/193 métodos/46 páginas legados; 25 rotas/26 métodos no
serviço (23 GETs, três mutações); web sem handlers backend e com 53 páginas,
mobile com 23 páginas. SQL pós-testes: zero
roles/locadoras/usuários/notificações/ perfis de paridade, zero triggers/funções
de falha e zero notificações/permissões/ equipamentos/unidades sem tenant. As 19
migrations seguem aplicadas. Cleanup encerrou os servidores HTTP das duas
rodadas; PostgreSQL próprio encerrado após conferir o PID, porta 55442 fechada.
Nenhum processo não pertencente à etapa foi encerrado. Logs/scripts/inventário
fora do repositório, prefixo codex-cut22.

### Estado da API legada

149 rotas/193 métodos continuam ativos/configurados. Os três handlers de escrita
legados usam o mesmo módulo compartilhado; os clientes continuam apontando à
origem legada. Fan-out, sync, login/callbacks, demais writes, pagamentos e
scheduler permanecem legados. Sem fallback no serviço, remoção do app/ (caminho
antigo) externo, cutover, produção, schema, migration, commit, push ou deploy.

### Dívida/risco restante

A extração completa permanece pendente. Este corte preserva lookup seguido de
write e as respostas originais de repetição; não redefine concorrência,
idempotência ou validação. Comunicações ainda não compartilham fan-out/sync e
canais externos. Evidência HTTP local não comprova browser, Expo, Docker,
staging, produção ou mudança de origem. Baselines existentes continuam dívida
medida, não certificado de conformidade final.

### Próximo corte recomendado naquela onda

POST/PATCH/DELETE de endereços do cliente, concluindo o fluxo já iniciado pelo
GET. O serviço de customers e os contratos de addresses já existem; compor os
adapters sem duplicar regras e caracterizar antes validação, ownership, CSRF,
lock por usuário/locadora e promoção do endereço principal. Provar efeitos e
concorrência em banco real, mantendo o legado configurado.

## Corte 23 — escritas de endereços (2026-10-02, sem commit)

### O que foi implementado

POST /api/addresses e PATCH/DELETE /api/addresses/[id] instalados no serviço.
Composição em host/customers injeta o runtime existente em createAddressService;
handlers só adaptam transporte e usam contracts/addresses. Backend, contratos e
handlers legados já compartilhados não precisaram mudar. Não há segunda query,
regra de principal ou implementação de negócio no host.

### Arquivos criados/modificados

- apps/services/api/src/host/customers.ts: composição de create/update/delete e
  reexport do erro de domínio existente.
- apps/services/api/src/app/api/addresses/route.ts: novo POST junto ao GET do
  corte 13; addresses/[id]/route.ts: novo adapter PATCH/DELETE.
- tests/unit/addresses-mutations-api.test.ts: caracterização anterior no legado
  e mesma matriz nos dois adapters com runner de transação/RLS existente.
- tests/api-host/address-mutations.http.test.ts: 123 casos novos de escrita,
  identidade/CSRF, DTO/validação, isolamento, concorrência e rollback.
- tests/api-host/global-setup.ts: grants/revokes de INSERT/UPDATE/DELETE apenas
  ao role descartável de addresses; diretório temporário/cache de sessões.
- tests/api-host/identity.ts: reutilização de cookie real somente após consulta
  ao motor da sessão. organizations.http.test.ts mantém login fresco para a
  asserção do orçamento e agora confere OPTIONS/POST efetivamente instalado.
- customer-addresses, esta página, ADR, modernization, overview, boot,
  context-map, INDEX, known-issues/index (232) e CHANGELOG Unreleased.

### Contratos preservados

- Mesmo principal e guards central/explicito; CSRF recusado antes de parsing,
  banco e identidade. Papéis globais não ampliam ownership, nenhum papel de
  membership autoriza escrever em outro usuário/tenant. Guardas conservam
  400/401/403/404/409, no-store de recusa e comportamento nativo sem Origin.
- Schemas de entrada e PATCH existentes: trim, state em maiúsculas, campos
  extras descartados; detalhes de 400 idênticos. JSON inválido vira a mesma
  validação nula. DELETE ignora body; query não redefine usuário/locadora.
- POST 201 e PATCH 200 com Address completo, DELETE 200 com mensagem original.
  Inacessível/inexistente/sem tenant mantém 404 neutro; repetir DELETE dá 404.
  Erros de armazenamento permanecem sanitizados com as mensagens originais.
  Exceção do resolvedor do principal permanece fora do catch de negócio.
- Primeiro endereço sempre principal. Selecionar outro desmarca somente os do
  mesmo usuário/tenant. Excluir secundário preserva principal; excluir principal
  promove o restante mais antigo, com desempate por id; último pode ser
  removido. PATCH vazio e isPrimary=false continuam aceitos sem promoção
  automática.
- Lock por locadora/usuário, transação RLS e índice parcial permanecem no
  backend. Privilégios e schema de produção não mudaram. Clientes e cookies não
  migraram.

### Testes executados e resultados

- Antes: 96 casos no legado, 109 incluindo piloto HTTP anterior. Depois: 192 nos
  dois adapters; 233 com as leituras/piloto, aprovados.
- Typecheck dos 12 projetos aprovado; type-check da raiz aprovado. Os dois
  testes novos e suas dependências também compilam em tsconfig estrito
  temporário, sem excluir erros ou mudar configuração do repositório.
- Produção HTTP local: 998 testes/10 arquivos em Legacy e 998 em Better Auth,
  incluindo 875 anteriores e 123 novos. Rodada final usa ambos os builds
  compilados e PostgreSQL com role NOLOGIN/NOSUPERUSER/NOBYPASSRLS/NOINHERIT,
  cookies emitidos pelo motor real e sessão revalidada por requisição.
- Efeitos comparados no banco inteiro dos usuários da rodada. CUID e datas de
  criação/atualização variáveis são conferidos contra DTO persistido e relógio
  antes de normalização; outros campos e linhas não podem mudar. Fixtures são
  restauradas entre hosts em finally. Sessão sem vínculo, forjada/revogada,
  membership revogado/suspenso, organização suspensa, quatro papéis e quatro
  transportes de seleção, conflitos, CSRF e mass assignment exercitados.
- Seis criações simultâneas, alternando hosts, deixam seis linhas novas e um
  único principal, sem alterar outro usuário/tenant. Índice parcial é testado
  independentemente. SQL direto prova RLS em INSERT/UPDATE/DELETE, incluindo
  WITH CHECK de troca de tenant. Revogar cada privilégio real retorna 500 sem
  efeitos. Trigger AFTER INSERT/UPDATE falha depois de desmarcar o principal:
  rollback conserva o snapshot completo. Trigger/função removidos em finally.
- Unit: 2.009 testes/84 arquivos; segurança: 667 aprovados e 18 condicionais
  existentes pulados/27 arquivos; identidade: 134/13 arquivos. Builds API e
  legado aprovados, com conexão fictícia na compilação. Nenhum provedor real.
- Lint, arch (nove pacotes, zero acima da baseline), check:test-names (430, três
  exceções anteriores), hygiene (948/273) e ratchet:guard aprovados. Baselines,
  transfers, asserções e timeouts não foram ampliados neste corte.

O novo arquivo inicialmente causou 429 no quarto grupo de login do Better Auth.
O setup agora consulta a sessão antes de reutilizar um cookie do próprio motor,
renova o inválido e força login fresco no teste de orçamento. Não desativa nem
limpa o limite durante a suíte. Cookies temporários foram removidos no cleanup;
ver entrada 232. Avisos pg de concorrência permanecem anteriores ao corte.

Inventário: legado 149 rotas/193 métodos/46 páginas; serviço parcial 26 rotas/29
métodos (23 GETs, seis mutações); web sem handlers backend e com 53 páginas;
mobile 23 páginas. SQL de cleanup: zero roles, locadoras, usuários, endereços do
corte, notificações/perfis de paridade, funções/triggers de falha e endereços
sem tenant. As 19 migrations continuam aplicadas. PostgreSQL próprio encerrado
após conferir PID; porta 55442 fechada. Logs, config de testes e inventário
ficam no TEMP, prefixo codex-cut23.

### Estado da API legada

Os handlers de addresses não foram alterados ou removidos. As 149 rotas/193
métodos seguem configurados e atendidos pelo runtime legado. Clientes continuam
na origem legada; login/callbacks, pagamentos, scheduler e demais rotas ainda
não extraídas permanecem lá. Sem fallback no serviço, cutover, push, commit,
deploy, alteração de produção, nova dependência ou migration. Checkpoint
canônico do handoff preservado byte a byte.

### Dívida/risco restante

A extração completa permanece em andamento. Paridade local de HTTP não prova
cookies em navegador, Expo, Docker, staging ou produção. A política atual que
aceita PATCH vazio/limpeza explícita do principal foi preservada; alterar esse
contrato exige um corte funcional próprio. Runtime de escrita usa o mesmo banco
somente no ensaio local; nenhuma autoridade de produção foi transferida.
Baselines existentes continuam dívida medida, não conformidade final.

### Próximo corte recomendado naquela onda

GET/POST /api/cart/sync e POST /api/cart/merge: customers/cart e fachada legada
já existem. Caracterizar antes parsing, papel CLIENT, substituição/mescla,
preços recalculados pelo catálogo, ownership, lock e atomicidade; compor no host
sem copiar regras. Manter legado e clientes configurados até provar paridade.

## Corte 24 — carrinho por locadora (2026-10-02, sem commit)

### O que foi implementado

GET/POST /api/cart/sync e POST /api/cart/merge instalados no serviço.
host/customers compõe createCustomerCartService com o runtime de banco do
processo. Parser, papel CLIENT, preço, RLS, ownership, lock e transação já
estavam no backend; não foram reimplementados. Os adapters mantêm os contratos e
importam CustomerError diretamente do entrypoint público backend/customers, como
a rota de perfil, preservando a análise de catch pelo inventário de auth.

### Arquivos criados/modificados

- apps/services/api/src/host/customers.ts: composição de read/writeCustomerCart.
- apps/services/api/src/app/api/cart/sync/route.ts: GET e POST finos.
- apps/services/api/src/app/api/cart/merge/route.ts: POST fino.
- tests/unit/cart-api.test.ts: mesma caracterização nos dois adapters, usando o
  serviço real sobre transação simulada.
- tests/api-host/cart.http.test.ts: 106 casos HTTP com efeitos em banco real,
  ambos os hosts e cookies emitidos pelo legado.
- tests/api-host/global-setup.ts: grants de carts/cart_items somente ao papel
  temporário do ensaio e limpeza de carrinhos antes de equipamentos/usuários.
- tools/hygiene-baseline.json: retirada dos dois achados de CustomerCartService
  sem consumidor (cart.ts/index.ts), agora usado pela composição real. Um bloco
  inteiro e um nome do bloco de index saíram; nenhuma tolerância foi ampliada.
- Cart-pricing-sync, ADR, modernização, overview, boot/context-map, índices,
  known-issues 233 e CHANGELOG atualizados. Handoff canônico preservado.

app/api/cart, (caminho antigo) lib/cart-service (caminho antigo) e
backend/customers/cart ficaram intactos. Não houve pacote, dependência, schema,
migration ou regra nova de domínio.

### Contratos preservados

- GET devolve o carrinho persistido completo com equipamento/categoria, ou
  items:[] sem criar cadastro ou recalcular preços antigos.
- POST sync recebe items, substitui o conjunto e responde com a mensagem
  original; POST merge recebe localCartItems, preserva os itens não enviados e
  atualiza quantidade/dias dos repetidos, sem somar quantidades. Retorna o
  carrinho completo.
- CLIENT do vínculo ativo, seleção explícita, CSRF central antes da sessão e
  guard explícito mantidos. ADMIN global não substitui vínculo. RLS FORCE,
  tenantId/userId, trava por locadora/usuário e FKs compostas preservados.
- Preços/identidade/relações enviados no corpo não prevalecem. Catálogo da
  locadora e motor de domínio determinam dinheiro em centavos. Limites de
  itens/quantidade/dias, duplicatas, array vazio, mensagens e status mantidos.
- Malformed JSON/null continua 500; erro de itens é 400; papel indevido 403;
  equipamento fora da locadora 404. Falhas genéricas conservam a mensagem do
  endpoint; recusa do principal é propagada com headers próprios.
- HEAD/OPTIONS/405 do framework preservados. A consulta existente não declara
  orderBy para items: os testes comparam cada campo dos itens por equipmentId,
  sem impor uma ordem incidental do plano SQL. A comparação entre execuções
  normaliza IDs e datas de carrinhos/itens; as respostas também são conferidas
  contra os registros reais correspondentes, com IDs/datas intactos nessa
  conferência.

### Testes executados e resultados

- Antes dos adapters novos: cart-api + customers-http, 148 casos aprovados no
  legado. Depois: 178 casos do novo arquivo (89 por host), com 237 focados
  aprovados incluindo os 59 de customers-http. Repetidos após o import direto.
- HTTP focado: 106/106 casos aprovados. Matriz completa no artefato final: 1104
  testes/11 arquivos em Legacy e 1104 em Better Auth. Processos próprios de
  produção local; login/cookies reais, papel SQL sem bypass/ownership e bloqueio
  de rede externa. Suítes de banco executadas em sequência.
- O POST descarta preço/tenant/user/cartId forjados. Casos literais provam meio
  centavo (135,14), período semanal proporcional (914,29), valor direto zero e
  limites. Merge vazio preserva cada registro; sync vazio remove apenas os itens
  do dono. Outros usuários/locadoras e quarentena ficam intactos.
- Trigger temporário faz falhar o segundo item: deletes/updates anteriores
  sofrem rollback. Seis merges pelos dois hosts preservam seis itens. pg_locks
  confirma que cada host espera pela trava real. SQL direto prova RLS e FKs, com
  recusa de escrita estrangeira e relações cruzadas.
- pnpm test:unit na árvore final: 2187/85 aprovados. Segurança: 667/27 aprovados
  e 18 pulados condicionais preexistentes. Identidade: 134/13 aprovados.
- pnpm typecheck (12 projetos), type-check, tipos estritos dos testes novos em
  config TEMP e tsc do serviço após o ajuste de import: aprovados. Build legado
  e build final da API aprovados, usando endereço fictício de banco no build.
- pnpm lint, arch, check:test-names, hygiene e ratchet:guard: aprovados. Arch: 9
  pacotes, 1050 achados antigos e zero acima do baseline. Colocation: 430
  testes, três exceções antigas, nenhuma nova. Higiene: 946 achados aceitos por
  272 itens; a redução corresponde aos dois tipos agora consumidos.

Inventário final: legado 149 rotas/193 métodos/46 páginas; serviço parcial 28
rotas/32 métodos (24 GETs e oito mutações); web zero handlers de backend e 53
páginas, mobile 23 páginas. Contagem de fonte não certifica paridade final.

Teardown conferido por SQL: zero papéis api_parity, usuários/organizações,
carrinhos/itens ou funções/triggers das fixtures. As 19 migrations continuam
aplicadas. PID do PostgreSQL próprio conferido antes do stop; porta 55442
fechada, zero processos Next relacionados e zero arquivos de cookie restantes
nos diretórios finais. Temporários/logs/inventários ficam no TEMP, prefixo
codex-cut24. Aviso preexistente de client.query concorrente do pg permanece.

### Estado da API legada

149 rotas/193 métodos ainda configurados e ativos. Os handlers de cart não foram
alterados, removidos ou redirecionados. Clientes, login/callbacks, pagamentos,
scheduler e demais APIs continuam usando a autoridade legada. Sem cutover,
commit, push, deploy ou operação em produção.

### Dívida/risco restante

Extração completa segue em andamento. O hook consumidor envia items a merge,
enquanto o contrato exige localCartItems; 400 reproduzido nos dois hosts e
registrado como pendência 233. Ligação do hook à tela e dívidas antigas de
pricing exigem cortes próprios, sem mudança silenciosa neste lote. Paridade
local não certifica navegador, Expo, Docker, staging ou produção; baselines
restantes não representam conformidade final.

### Próximo corte recomendado naquela onda

PUT /api/user/profile: updateCustomerProfile já existe em customers e a leitura
está no serviço. Caracterizar parsing estrito, CSRF, normalização, ownership,
404 sem perfil, conflito de documento/P2002, DTO/no-store e rollback;
compartilhar o schema de transporte quando necessário e compor a atualização sem
copiar regras. Legado e origem dos clientes permanecem até comprovar paridade
completa.

## Corte 25 — atualização do perfil comercial (2026-10-02, sem commit)

### O que foi implementado

PUT /api/user/profile instalado no host compartilhado. A composição usa
createCustomerProfileService e withTenantTransaction existentes; normalização,
DTO, chave composta e UPDATE continuam em backend/customers/profile, sem
modificação de sua implementação. O schema estrito de entrada saiu do adapter
legado para contracts/customer-profile e os dois hosts importam a mesma
validação. GET/PUT legados continuam atendendo.

### Arquivos criados/modificados

- Novo packages/contracts/src/customer-profile.ts e export explícito no
  package.json de contracts. O ponto específico foi registrado em
  tools/ratchet-transfers.json, conforme o guard de configuração; somente schema
  puro, sem wildcard, servidor ou tolerância nova. Baselines e verificadores não
  foram alterados neste corte.
- apps/services/api/src/host/customers.ts e
  apps/services/api/src/app/api/user/profile/route.ts: composição e adapter PUT.
- app/api/user/profile/route.ts (caminho antigo): import do schema compartilhado
  em lugar da declaração local; lógica, composição, erros e endpoint
  preservados.
- Novos tests/unit/customer-profile-update-api.test.ts e
  tests/api-host/profile-update.http.test.ts; profiles.http.test.ts atualiza a
  prova de OPTIONS/405 para a presença do PUT. global-setup.ts acrescenta UPDATE
  de client_profiles somente ao papel runtime descartável e revoga no cleanup.
- Documentação: customer-profile, shared-api-host, INDEX, ADR de extração,
  modernization, overview, boot/context-map e CHANGELOG Unreleased.

### Contratos preservados

- URL, PUT, parsing estrito de phone/cpf/cnpj/company, limites antes de
  normalização, campos opcionais e recusa de chaves extras. IDs, papel, nome e
  email não podem ser alterados pelo corpo; a query não escolhe outro usuário.
- Principal, seleção, CSRF, ownership, quatro papéis de vínculo e RLS. ADMIN
  global continua sem dispensar membership; não cria perfil ausente nem usa
  cadastro global como fallback.
- Normalização existente de dígitos e espaços; vazio de telefone/empresa vira
  null, documento vazio/sem dígitos mantém o anterior, CPF/CNPJ simultâneos são
  recusados. Corpo que produz data vazio preserva updatedAt. DTO e no-store
  mantidos.
- Status/mensagens: schema inválido/null 400; JSON ilegível 500; perfil ausente
  404; P2002 409 sem detalhe privado; demais falhas 500. Conflito ou erro de
  UPDATE desfaz a escrita inteira. Documento repetido em outra locadora passa;
  dois escritores na mesma locadora produzem um sucesso e um 409.
- HEAD/OPTIONS do framework e 405 para POST/PATCH/DELETE. Cookies de identidade
  não são emitidos pela rota.

### Testes executados e resultados

| Verificação                                         | Resultado local                                                       |
| --------------------------------------------------- | --------------------------------------------------------------------- |
| Caracterização antes de mudar produção              | 172 unitários focados; 74 HTTP sobre o PUT legado                     |
| Mesma matriz nos dois adapters                      | 235 unitários focados; backend real com banco simulado                |
| Paridade HTTP completa em builds de produção locais | 1.178 testes em 12 arquivos para legacy e 1.178 para better-auth      |
| Unidade completa com banco descartável              | 2.313 testes em 86 arquivos                                           |
| Segurança completa                                  | 667 aprovados; 18 casos condicionais anteriores pulados               |
| Identidade completa                                 | 134 aprovados em 13 arquivos                                          |
| Tipos                                               | 12 projetos, raiz e novos testes sob TypeScript estrito: exit 0       |
| Builds                                              | API e legado: exit 0, compilados com URL de banco fictícia            |
| Lint, arquitetura e nomes                           | exit 0; arch sem achados acima da baseline; nomes sem exceção nova    |
| Higiene e ratchet                                   | exit 0; higiene 946 achados anteriores em 272 entradas, sem ampliação |

HTTP usa login real e PostgreSQL local descartável, runtime sem bypass nem
ownership. A matriz compara corpos/headers e registros persistidos: nenhum
perfil de outro usuário/locadora nem conta global muda. Recusas deixam o estado
intacto; UPDATE sem grant retorna 500; um trigger AFTER força falha para provar
rollback; concorrência entre os hosts prova unicidade; SQL direto prova RLS de
UPDATE entre locadoras. Nenhum teste usa gateway real ou produção.

Cleanup conferido por SQL: zero fixtures/papéis temporários da API e zero
funções/triggers de falha. Os servidores HTTP próprios terminaram; o PostgreSQL
foi desligado depois de confirmar seu PID. Porta de teste fechada e nenhum
cookie de sessão de teste restante. O checkpoint canônico do handoff conserva
seu hash.

### Estado da API legada

149 rotas/193 métodos permanecem ativos, com 46 páginas. O serviço parcial tem
28 rotas/33 métodos (24 GETs, nove mutações), sem páginas; os 33 métodos têm
correspondente legado. Cobertura estrutural de métodos: 17,1%; faltam 160. Essa
medida não estima esforço nem autoriza retirar a raiz. Clientes, base URL,
cookies, login/callbacks e scheduler continuam usando sua configuração anterior.

### Dívida/risco restante

API inteira e operação ainda não foram transferidas. O contrato numérico do
documento, classificação histórica do GET e vazio que não limpa documento foram
preservados; revisão dessas regras exige corte próprio. Autenticação ativa,
mobile real, publicação, jobs, Docker/staging e rollback operacional continuam
etapas separadas. Gate arch verde continua contendo 1.050 violações antigas; a
higiene também conserva dívida registrada. Paridade local não certifica a
conclusão geral.

### Próximo corte recomendado naquela onda

POST /api/client/enroll, já apoiado em customers/enroll: caracterizar antes os
guards de host/origem, consentimento estrito, identidade global, vínculo CLIENT,
perfil/auditoria atômicos, idempotência e vínculos inativos. Compartilhar
somente transporte/composição necessários, mantendo a criação autoritativa no
backend e o endpoint legado ativo. Autorização para corte estrutural não
autoriza criar vínculos de equipe nem alterar decisões de produto.

## Corte 26 — vínculo explícito do cliente (2026-10-02, sem commit)

### O que foi implementado

POST /api/client/enroll no serviço, com a mesma sessão, resolução pública e
transação por locadora usadas pelo legado. O caso de uso customers/enroll não
foi alterado: criação de membership CLIENT, perfil e auditoria permanece nele. O
schema de consentimento foi movido do adapter legado para contracts e é
consumido pelos dois hosts. Nenhuma regra de negócio foi copiada para o host.

### Arquivos criados/modificados

- packages/contracts/src/customer-enrollment.ts e package.json: schema puro,
  estrito, sem IDs, papel ou dados de perfil aceitos do cliente. O ponto público
  específico foi registrado em tools/ratchet-transfers.json; sem wildcard ou
  nova tolerância de baseline.
- apps/services/api/src/app/api/client/enroll/route.ts: adapter POST que compõe
  customers/enroll, sessão e transação existentes. host/runtime.ts expõe somente
  a delegação para o resolvedor público compartilhado.
- app/api/client/enroll/route.ts (caminho antigo): substituição da declaração
  local pelo import do schema comum; comportamento e composição legados
  preservados.
- tests/unit/customer-enrollment-api.test.ts e
  tests/api-host/enrollment.http.test.ts: caracterização e paridade.
  global-setup concede INSERT apenas nas tabelas necessárias ao papel temporário
  e revoga no cleanup; nenhum grant de produção foi alterado.
- tests/security/route-auth-inventory.test.ts: classificação exata da nova
  superfície, prova da delegação pública e checagem adicional de sessão/ID antes
  da única criação de vínculo nos dois adapters. As mutações que removem origem,
  sessão ou sua recusa são rejeitadas; nenhuma exceção de segurança foi criada.
- Feature de enrollment, INDEX, overview, ADR, modernization, boot/context-map,
  ratchet-gates e CHANGELOG Unreleased atualizados. Handoff canônico intacto.

### Contratos preservados

- URL e POST; origem antes de qualquer consulta, host validado antes de
  corpo/query/sessão. Fora de host de locadora: 409 TENANT_REQUIRED mesmo com
  corpo inválido e slug enviado. Locadora indisponível: 404 neutro.
- JSON ilegível: 400 Dados inválidos; consentimento diferente de true ou chave
  extra: 400; body/query divergentes: 400 TENANT_CONFLICT, sem cache privado;
  header divergente: mesmo conflito com private, no-store e Vary Cookie, Host.
  Os campos Vary próprios do Next também são iguais nos dois hosts compilados.
- Sessão ausente: 401. Nova associação: 201; associação ativa: 200 sem alterar
  papel, reparar perfil ausente ou criar outra auditoria. Suspensa/revogada:
  403, sem reativação. Documento alheio: 409 PROFILE_CONFLICT, sem adoção.
- Papel CLIENT fixo na criação, dados provenientes do User, normalização
  histórica, IP da borda e user-agent limitado a 512 caracteres na auditoria.
  Nenhuma alteração de conta global, locadora ou usuário alheio.
- Perfil e auditoria sob FORCE RLS com GUC local; memberships é metadado global
  de identidade sem RLS, filtrado explicitamente por locadora e usuário no caso
  de uso. As três criações são atômicas. P2002 genuíno relê em nova transação;
  erros inesperados são 503 neutro sem detalhes privados.

### Testes executados e resultados

| Verificação                              | Resultado local                                                 |
| ---------------------------------------- | --------------------------------------------------------------- |
| Caracterização antes de alterar produção | 61 unitários; 43 HTTP no legado compilado                       |
| Mesma matriz nos dois adapters           | 122 unitários, usando customers/enroll real e banco simulado    |
| HTTP completo com identidade real        | 1.221 testes em 13 arquivos para legacy; 1.221 para better-auth |
| Unidade completa                         | 2.435 testes em 87 arquivos                                     |
| Segurança completa                       | 668 aprovados; 18 casos condicionais anteriores pulados         |
| Identidade completa                      | 134 aprovados em 13 arquivos                                    |
| Tipos                                    | 12 projetos, raiz e novos testes sob tipos estritos: exit 0     |
| Builds                                   | API e legado: exit 0, banco fictício durante a compilação       |
| Lint, arch, nomes, higiene e ratchet     | exit 0; nenhuma baseline ampliada                               |

HTTP compara status, corpo, headers e estado persistido nos dois hosts. Exercita
criação nas duas locadoras, papéis ativos/inativos, perfil existente, documento
alheio, ausência de sessão, consentimento, seleção, CSRF e corrida entre hosts.
Falha real de INSERT em cada uma das três tabelas produz 503 e desfaz todas as
criações. SQL direto prova INSERT recusado em perfil/auditoria sem GUC e com GUC
de outra locadora. Não se atribui RLS à tabela global memberships.

SQL final: zero organizações, memberships, perfis e auditorias da API e zero
papéis api_parity; 19 migrations aplicadas. Os servidores HTTP próprios foram
encerrados pelo teardown; PostgreSQL próprio encerrado após conferir PID e porta
55442 fechada. Nenhum cookie de teste ficou nos diretórios destas execuções.
Aviso anterior de client.query do pg continua registrado como dívida.

### Estado da API legada

149 rotas/193 métodos declarados e 46 páginas permanecem ativos/configurados.
Serviço parcial: 29 rotas/34 métodos, 24 GETs e dez mutações, zero páginas.
Cobertura estrutural da API: 17,6%; faltam 159 operações nessa contagem. Isso
não mede esforço, progresso do produto inteiro nem autorização para excluir
app/. (caminho antigo) Clientes, origem/base URL, cookies, autenticação e
scheduler não mudaram.

### Dívida/risco restante

Paridade local não certifica produção ou dispositivo. Auth/callbacks,
pagamentos, webhooks, jobs, demais mutações, staging, corte de tráfego e
rollback operacional permanecem etapas separadas. Consentimento/LGPD definitivo
e vínculo mediado de cliente de balcão continuam decisões humanas pendentes. Os
dois adapters mantêm seu transporte explícito protegido por paridade; negócio e
schema são comuns. Arch conserva 1.050 violações antigas; higiene conserva 946
achados em 272 entradas anteriores, sem aumento neste corte. Modernização geral
incompleta.

### Próximo corte recomendado naquela onda

POST /api/admin/drivers, cujo createDriver já pertence a backend/operations.
Caracterizar primeiro ADMIN da membership atual, principal/CSRF, parsing e erros
Zod, status padrão, efeitos sob locadora e RLS/rollback. O legado permanece
ativo e nenhuma permissão de equipe pode ser ampliada durante a extração.

## Corte 27 — criação administrativa de motoristas (2026-10-02, sem commit)

### O que foi implementado

POST /api/admin/drivers instalado no serviço parcial sobre o createDriverService
existente em backend/operations. A composição HTTP conserva principal, ADMIN do
vínculo atual, CSRF central, parsing, DTO e respostas do legado. O schema Zod
foi movido para contracts/drivers e é consumido pelos dois adapters; nenhuma
regra de negócio foi copiada ao host. Zod 4.6.5, já instalado e usado na
raiz/contracts, foi declarado diretamente no serviço para reconhecer a mesma
classe de erro de validação. Instalação offline e lockfile atualizado; sem novo
framework ou mudança de versão.

### Arquivos criados/modificados

- packages/contracts/src/drivers.ts e package.json: schema puro e ponto público
  explícito, sem wildcard ou import de servidor.
- app/api/admin/drivers/route.ts (caminho antigo): apenas troca do schema local
  por import compartilhado; handlers legados preservados.
- apps/services/api/src/host/operations.ts e src/app/api/admin/drivers/route.ts:
  composição do caso de uso e adapter POST. package.json e pnpm-lock.yaml:
  declaração da dependência já existente.
- tests/unit/drivers-create-api.test.ts e
  tests/api-host/drivers-create.http.test.ts: caracterização e paridade.
  global-setup.ts concede INSERT só ao papel descartável e remove motoristas
  criados pelas fixtures. organizations.http.test.ts verifica OPTIONS com POST,
  mantendo HEAD e 405 para PUT/PATCH/DELETE.
- tools/ratchet-transfers.json: registro explícito de contracts/drivers na
  extração autorizada. Nenhuma baseline ou guarda foi alterada neste corte.
- operations-tenancy, ADR, modernization, overview, boot, context-map,
  features/INDEX, ratchet-gates e CHANGELOG Unreleased atualizados.

### Contratos preservados

- URL/POST, sessão real e ADMIN da membership ativa da locadora atual; User.role
  global não autoriza. Recusas precedem parsing e escrita.
- Header, cookie e host são reconciliados pelo mesmo principal. Origem recusada
  com borda validada; contexto forjado não escolhe outra locadora.
- Name/phone exigem apenas comprimento mínimo um e não são normalizados. Chaves
  extras, incluindo tenantId/id, são descartadas. CNH/categoria opcionais
  preservam seus valores; ausência vira null no banco.
- Status ausente ACTIVE; valores admitidos ACTIVE, INACTIVE e ON_LEAVE. Sucesso
  201 com `{ driver }`, DTO completo e sem novo cookie/cache.
- ZodError genuíno mantém 400 com issues e mensagens; JSON malformado e falhas
  de banco mantêm 500 genérico e log sem detalhes. Repetição e concorrência
  criam registros distintos: nenhuma idempotência nova.
- GUC da locadora e escrita permanecem na transação existente do backend.
  Trigger de falha após INSERT prova rollback, sem efeito nas demais linhas.

### Testes executados e resultados

| Verificação                          | Resultado                                                                |
| ------------------------------------ | ------------------------------------------------------------------------ |
| Caracterização anterior do legado    | 38 unitários e 35 HTTP passaram antes da implementação                   |
| GET/POST nos dois adapters           | 102 testes focados, incluindo 76 de criação                              |
| HTTP compilado, modo legacy          | 1.262 testes / 14 arquivos passaram                                      |
| HTTP compilado, modo better-auth     | os mesmos 1.262 / 14 passaram                                            |
| Unidade completa                     | 2.511 testes / 88 arquivos passaram                                      |
| Segurança completa                   | 668 aprovados / 27 arquivos; 18 casos condicionais preexistentes pulados |
| Identidade completa                  | 134 aprovados / 13 arquivos                                              |
| Tipos                                | 12 projetos, raiz e novos testes estritos: exit 0                        |
| Builds                               | API e legado: exit 0, URL fictícia de banco durante compilação           |
| Lint, arch, nomes, higiene e ratchet | exit 0; baselines preservadas                                            |

A matriz de 41 HTTP novos compara respostas e estado persistido: locadoras A/B,
papéis, revogação, seleção, CSRF, validação, campos extras e criação
repetida/paralela. SQL direto rejeita INSERT sem GUC ou com GUC alheia. Revogar
INSERT ou provocar falha após inserir produz 500 sem registro persistido. Os
testes usam PostgreSQL descartável e papel sem BYPASSRLS, não o banco
administrativo para servir as rotas. Aviso antigo de pg sobre client.query
concorrente permanece registrado, sem mudança de dependência.

SQL final confirmou zero fixtures de organizações, usuários, memberships,
perfis, auditorias e motoristas da API, zero papéis api_parity, zero triggers e
funções de falha; 19 migrations aplicadas. Servidores próprios foram encerrados
pelo teardown e PostgreSQL próprio encerrado após conferir seu PID. Cookies
temporários desta rodada: zero. Evidência em TEMP, fora do repo. O hash do
handoff canônico permanece o mesmo.

### Estado da API legada

149 rotas/193 métodos declarados e 46 páginas preservados. O serviço parcial tem
29 rotas/35 métodos, 24 GETs e onze mutações, zero páginas. Os 35 métodos
coincidem com métodos legados; nenhum endpoint extra. Cobertura por contagem:
18,1%, faltando 158 métodos. Essa proporção não mede esforço, progresso do
produto inteiro ou prontidão para remover app/. (caminho antigo) Clientes e
scheduler mantêm sua autoridade configurada no legado; sem cutover, redirect ou
deploy.

### Dívida/risco restante

JSON malformado 500, validações mínimas de telefone/CNH, ausência de limite de
comprimento e repetição não idempotente são comportamentos observados
preservados; endurecê-los exige outro incremento de contrato. Paridade local não
certifica staging, produção, aparelho nativo ou rollback operacional.
Auth/callbacks, pagamentos, webhooks, jobs e demais escritas continuam fora do
serviço parcial. A modernização geral segue incompleta. Arch conserva as 1.050
violações antigas e higiene os 946 achados em 272 entradas anteriores, sem
aumento neste corte.

### Próximo corte recomendado naquela onda

POST /api/admin/categories: o createCategory já está no catálogo compartilhado e
o GET já está no serviço. Caracterizar antes a permissão EQUIPMENTS/WRITE,
schema estrito, pré-processamento do ícone, erros e unicidade por locadora.
Preservar as ACLs e validar persistência/rollback em ambos os modos antes de
montar o POST. As rotas e a origem legadas permanecem ativas.

## Corte 28 — criação administrativa de categorias (2026-10-02, sem commit)

### O que foi implementado

POST /api/admin/categories instalado no serviço parcial usando o
createCatalogService/createCategory existente. O host liga a transação e o
banco; normalização, unicidade, persistência e lock permanecem no backend. O
schema estrito saiu do adapter legado para contracts/categories e atende os dois
hosts. O adapter legado muda apenas o import desse schema, mantendo seu handler
e a autoridade configurada. Nenhuma regra ou dependência foi duplicada.

### Arquivos criados/modificados

- packages/contracts/src/categories.ts e package.json: schema puro de criação e
  export explícito, sem Prisma ou runtime.
- app/api/admin/categories/route.ts (caminho antigo): import do schema comum,
  sem retirar GET/POST.
- apps/services/api/src/host/catalog.ts e src/app/api/admin/categories/route.ts:
  composição de createCategory e adapter POST, com o mesmo erro CatalogError do
  entrypoint público.
- tests/unit/admin-categories-create-api.test.ts e
  tests/api-host/admin-categories-create.http.test.ts: caracterização e
  comparação real. global-setup.ts concede INSERT de categorias somente ao papel
  descartável e limpa as permissões criadas nas próprias fixtures.
  organizations.http.test.ts agora compara OPTIONS com POST em ambos os hosts;
  HEAD e 405 de PUT/PATCH/DELETE permanecem cobertos.
- tools/ratchet-transfers.json: registro específico de contracts/categories, sem
  mudança de baseline ou proteção. ADR, modernization, overview, admin-system,
  boot, context-map, features/INDEX, ratchet-gates e CHANGELOG Unreleased
  atualizados.

### Contratos preservados

- URL/POST, sessão, principal e EQUIPMENTS/WRITE da locadora atual. ADMIN do
  vínculo dispensa Permission; OPERATOR/FINANCIAL exigem concessão exata e viva;
  CLIENT é recusado mesmo com concessão. User.role global e query forjada não
  autorizam. Recusas e CSRF precedem parsing ou escrita.
- Seleção por cookie, header e host mantém conflito e isolamento. Organização
  inativa é recusada na resolução; a transação revalida ACTIVE antes do lock.
- JSON malformado: 400 JSON inválido; schema inválido ou campo extra no objeto
  principal: 400 Dados inválidos. Ícone falsy é removido antes do parse. Campos
  extras dentro de customIcon são descartados; fontes e valores válidos ficam.
- Trim, slug, cores padrão e campos opcionais continuam no catálogo. Sucesso 201
  devolve a categoria completa sem envelope, cookie ou cache novo.
- Nome/slug já existente na própria locadora: 409 Categoria já existente; nomes
  em locadoras distintas são admitidos. Comparação parametrizada exata, com
  percent/underscore literais. Corrida sob o lock gera uma criação e um 409.
- CatalogError preserva status/mensagem; P2002 genuíno mantém 409. Outros Error
  com code conservam 400 genérico, e falhas sem code conservam 500. Body null
  mantém o 500 observado, sem persistência ou exposição de detalhes.
- GUC, lock e INSERT ficam na mesma transação existente. Falha em AFTER INSERT
  desfaz a criação; INSERT sem GUC ou com GUC de outra locadora é recusado por
  RLS.

### Testes executados e resultados

| Verificação                          | Resultado                                                          |
| ------------------------------------ | ------------------------------------------------------------------ |
| Caracterização anterior do legado    | 51 unitários e 47 HTTP passaram antes da implementação             |
| GET/POST e catálogo focados          | 212 aprovados, incluindo 106 de criação nos dois adapters          |
| HTTP compilado, modo legacy          | 1.310 aprovados / 15 arquivos                                      |
| HTTP compilado, modo better-auth     | os mesmos 1.310 / 15 aprovados                                     |
| Unidade completa                     | 2.617 aprovados / 89 arquivos                                      |
| Segurança completa                   | 668 aprovados / 27 arquivos; 18 condicionais preexistentes pulados |
| Tipos                                | 12 projetos, raiz e novos testes estritos: exit 0                  |
| Builds                               | API e legado: exit 0, banco fictício na compilação                 |
| Lint, arch, nomes, higiene e ratchet | exit 0; baselines preservadas                                      |

Identidade completa: 134 testes / 13 arquivos aprovados. Markdownlint e
validação dos índices/links: exit 0.

Os 48 casos HTTP novos usam sessão real, papel PostgreSQL sem BYPASSRLS e banco
descartável. A fixture preexistente FINANCIAL/EQUIPMENTS/WRITE era válida para
este POST; foi isolada no teste de criação/revogação e restaurada exatamente no
teardown. Nenhuma ACL de produto foi alterada. Provas não inferem RLS para
memberships, tabela global: o isolamento da categoria foi também exercitado por
SQL direto. Aviso anterior de pg sobre client.query concorrente permanece como
dívida, sem atualização de dependência.

SQL final confirmou zero organizações, categorias, permissões, memberships,
perfis, usuários, auditorias, papéis api_parity e triggers/funções de falha
desta API; 19 migrations aplicadas. Teardown encerrou os servidores HTTP
próprios; PostgreSQL próprio foi encerrado após conferir PID. Todas as portas
destas execuções e a 55442 foram verificadas fechadas; cookies temporários
restantes: zero. Logs e sondas ficam em TEMP. Handoff canônico conserva seu
SHA256.

### Estado da API legada

149 rotas/193 métodos declarados e 46 páginas continuam preservados e
configurados. Serviço parcial: 29 rotas/36 métodos, 24 GETs e doze mutações,
zero páginas. Os 36 coincidem com operações legadas, sem endpoint extra. Por
contagem são 18,7%, faltando 157 métodos. Esse percentual não mede esforço,
progresso geral ou autorização para excluir app/. (caminho antigo) Sem cutover,
redirect, desativação, mudança de cliente/scheduler ou deploy.

### Dívida/risco restante

Validações mínimas de cores/nome, whitespace aceito, campos aninhados
descartados e body null 500 são comportamentos observados preservados.
Endurecimento exige incremento próprio de contrato. Paridade local não certifica
produção, staging, aparelho nativo ou rollback operacional. Auth/callbacks,
pagamentos, webhooks, jobs e demais escritas continuam fora do serviço parcial.
Arch conserva 1.050 violações antigas; higiene conserva 946 achados em 272
entradas anteriores, sem aumento deste corte. A modernização geral permanece
incompleta.

### Próximo corte recomendado naquela onda

PUT/DELETE /api/admin/categories/[id], usando os casos de uso já existentes em
backend/catalog. Caracterizar antes EQUIPMENTS/WRITE, autorização antes de
params/body, ownership de ID, erros, unicidade, efeitos e rollback. Preservar
ACLs e comprovar paridade nos dois modos; manter o legado configurado.

## Corte 29 — edição e exclusão de categorias (2026-10-02, sem commit)

### O que foi implementado

PUT/DELETE /api/admin/categories/[id] instalados no serviço parcial. A fachada
de composição chama updateCategory/deleteCategory do createCatalogService
existente, sobre a mesma transação de locação e o mesmo banco. Negócio,
normalização, posse e restrição de vínculo com equipamento permanecem em
backend/catalog e no banco; nenhum caso de uso ou schema foi copiado ao host. Os
handlers e a fachada legados não foram alterados neste corte.

### Arquivos criados/modificados

- apps/services/api/src/app/api/admin/categories/[id]/route.ts: adapters PUT e
  DELETE com permissão, resposta e tratamento de erro observados.
- apps/services/api/src/host/catalog.ts: duas funções de composição delegadas ao
  serviço já existente. Nenhum export de pacote ou dependência nova.
- tests/unit/admin-category-mutations-api.test.ts e
  tests/api-host/admin-category-mutations.http.test.ts: caracterização anterior
  e paridade de ambos os hosts. global-setup.ts concede UPDATE/DELETE de
  categorias somente ao papel temporário e revoga no teardown.
- ADR, modernization, overview, admin-system, boot, context-map, features/INDEX,
  CHANGELOG Unreleased e este checkpoint atualizados. Nenhuma baseline, ratchet,
  inventário de autorização ou proteção foi alterada.

### Contratos preservados

- PUT exige EQUIPMENTS/WRITE; DELETE exige EQUIPMENTS/DELETE. Mantém sessão,
  membership ativa, concessão exata e viva por locadora/papel e CSRF central.
  ADMIN global sem vínculo e CLIENT com concessão não autorizam. Header, cookie
  e host conservam reconciliação e recusa de conflito.
- O await de params anterior à autorização permanece como no legado. Rejeição de
  params propaga antes do try/catch, sem consultar principal ou banco.
  Autorização antecede qualquer operação do catálogo. Posse por id/tenant é
  confirmada antes de ler o corpo; alheio/ausente dá 404, inclusive com JSON
  ruim.
- PUT conserva DTO completo sem envelope e 200; campos ausentes não mudam. Trim,
  slug e cores padrão continuam no backend. Campos extras de primeiro nível são
  ignorados e JSON customIcon é preservado, sem acrescentar schema. Nome falsy é
  ignorado; whitespace pode produzir nome/slug vazios. Corpo escalar ou array
  sem propriedades gera atualização vazia, como antes.
- DELETE ignora o corpo e mantém 200 com message Categoria excluída. Categoria
  vinculada a equipamentos não é excluída; FK permanece intacta, com 500
  genérico observado e nenhum equipamento alterado.
- CatalogError mantém status/mensagem. JSON inválido/null, tipo incompatível,
  colisão de slug e falhas de banco permanecem 500 genéricos, sem código ou
  detalhes internos na resposta. Nenhuma validação ou mudança de erro foi
  introduzida nesta extração.
- GUC, revalidação da organização, lock, leitura de posse e escrita permanecem
  na mesma transação. AFTER UPDATE/DELETE com falha prova rollback integral. RLS
  impede alterar/apagar uma linha com GUC ausente ou de outra locadora; controle
  com a GUC própria comprova que a SQL não é vazia.
- DELETE simultâneo retorna um 200 e um 404 com uma única remoção. PUTs
  concorrentes mantêm serialização e último escritor, sem lock otimista novo.
  OPTIONS declara PUT/DELETE/OPTIONS; demais métodos conservam 405.

### Testes executados e resultados

| Verificação                          | Resultado                                                      |
| ------------------------------------ | -------------------------------------------------------------- |
| Caracterização anterior do legado    | 32 unitários e 46 HTTP aprovados antes de implementar          |
| Catálogo/adapters focados            | 276 aprovados / 4 arquivos, incluindo 64 mutações de categoria |
| HTTP compilado, modo legacy          | 1.356 aprovados / 16 arquivos                                  |
| HTTP compilado, modo better-auth     | os mesmos 1.356 / 16 aprovados                                 |
| Inventário de autorização            | 67 aprovados, sem novas exceções                               |
| Tipos                                | 12 projetos, raiz e novos testes estritos: exit 0              |
| Build API                            | exit 0; banco fictício durante compilação                      |
| Lint, arch, nomes, higiene e ratchet | exit 0; dívida e proteções preservadas                         |

Regressões completas: 2.681 testes de unidade / 90 arquivos, 668 de segurança /
27 arquivos (18 condicionais preexistentes pulados) e 134 de identidade / 13
arquivos aprovados. Markdownlint e índices/links: exit 0.

A matriz nova de 46 casos HTTP compara corpo, headers, DTO persistido e efeitos
nas duas locadoras. Usa sessão real e papel temporário sem BYPASSRLS. A
concessão FINANCIAL/WRITE da fixture anterior foi isolada e restaurada
exatamente; nenhuma ACL do produto foi alterada. O teste de recusa SQL envia
mudança real: Prisma devolve a linha em update vazio sem executar UPDATE. O
mesmo artefato compilado do legado, validado no corte 28, foi usado; seu código
não mudou. Sondas/logs estão em TEMP. Aviso preexistente de pg sobre
client.query continua.

SQL final confirmou zero fixtures API de organizações, categorias, permissões,
memberships, perfis, usuários e auditorias, zero papéis api_parity e zero
triggers/funções de falha; 19 migrations já aplicadas. O teardown encerrou os
servidores HTTP próprios. PostgreSQL próprio encerrado após conferir seu PID;
todas as oito portas HTTP desta rodada e a 55442 estão fechadas. Cookies nos
diretórios destas execuções: zero. Handoff canônico conserva o mesmo SHA256.

### Estado da API legada

149 rotas/193 métodos declarados e 46 páginas continuam preservados e
configurados. Serviço parcial: 30 rotas/38 métodos, 24 GETs e catorze mutações,
zero páginas. As 38 operações coincidem com as legadas, sem endpoint extra:
19,7% por contagem; faltavam 155 métodos naquele corte de 2026-10-02. Essa
proporção não media esforço ou progresso geral e não autorizava excluir a antiga
raiz app/, depois retirada somente no clone F. Clientes, scheduler, identidade
configurada e origem permaneciam iguais; sem cutover, redirect ou deploy nessa
rodada.

### Dívida/risco restante

PUT sem schema, JSON arbitrário, normalizações mínimas, conflitos de banco 500 e
ausência de lock otimista permanecem contratos observados. Revisão dessas regras
exige outro incremento. Paridade local não certifica staging, produção, aparelho
nativo ou rollback operacional. Demais escritas, auth/callbacks, pagamentos,
webhooks e jobs seguem fora do serviço. Arch conserva 1.050 violações antigas;
higiene conserva 946 achados em 272 entradas, sem aumento. A modernização geral
permanece incompleta.

### Próximo corte recomendado naquela onda

POST /api/admin/equipment-units: createUnit já pertence ao catálogo
compartilhado e o GET já está composto. Caracterizar primeiro EQUIPMENTS/WRITE,
schema Zod, ownership do equipamento, unicidade por locadora, medidores/DTO e
rollback. Manter disponibilidade, lock e regras de estoque existentes; preservar
legado.

## Corte 30 — criação de unidades físicas (2026-10-02, sem commit)

### O que foi implementado

POST /api/admin/equipment-units montado no serviço, delegando ao createUnit já
existente em backend/catalog. Apenas o schema de entrada saiu do adapter legado
para um contrato puro compartilhado. GET continua intacto, assim como os corpos
dos handlers GET/POST legados e a implementação dos casos de uso. Não houve
alteração de regra, estoque, cliente, banco ou scheduler.

### Arquivos criados/modificados

- packages/contracts/src/equipment-units.ts e package.json: schema Zod de
  criação e export explícito ./equipment-units. Continua removendo campos
  extras, sem trim ou validação adicional.
- app/api/admin/equipment-units/route.ts (caminho antigo): importa o mesmo
  schema compartilhado; funções GET/POST conservam o conteúdo anterior.
- apps/services/api/src/host/catalog.ts e
  src/app/api/admin/equipment-units/route.ts: composição do createUnit e adapter
  POST com a política granular existente.
- tests/unit/equipment-unit-create-api.test.ts e
  tests/api-host/equipment-unit-create.http.test.ts: caracterização anterior e
  paridade nos dois hosts. global-setup.ts concede INSERT de equipment_units
  somente ao papel descartável e limpa unidades nas próprias fixtures.
  organizations.http.test.ts compara OPTIONS com POST nos dois hosts e mantém
  PATCH/DELETE por id legados fora do serviço.
- tools/ratchet-transfers.json: registro específico de
  contracts/equipment-units, sem mudança de baseline ou proteção. ADR,
  modernization, overview, admin-system, boot, context-map, features/INDEX,
  ratchet-gates e CHANGELOG Unreleased atualizados.

### Contratos preservados

- URL/POST, sessão e EQUIPMENTS/WRITE do vínculo na locadora atual. ADMIN do
  vínculo dispensa Permission; OPERATOR/FINANCIAL precisam de concessão exata e
  viva; CLIENT é recusado mesmo com concessão. Papel global, query e concessão
  de outro módulo/ação/locadora não autorizam. CSRF e recusas precedem parsing.
- Seleção por cookie, header ou borda mantém conflitos e isolamento. Organização
  inativa é recusada na resolução; a transação revalida ACTIVE antes do lock.
  Body não escolhe tenantId, id ou status.
- Sucesso 201 devolve a unidade completa sem envelope, cookie ou cache novo,
  incluindo equipamento com apenas id/name/category.name. Status inicial é
  AVAILABLE. Cuid/datas são gerados pelo banco/client como antes; medidores
  Decimal positivos são textuais no JSON.
- Schema usa equipmentId string, uniqueCode não vazio, textos opcionais e
  medidores numéricos não negativos. Não faz trim: código só com espaço e textos
  vazios continuam aceitos. Campos extras são removidos. equipmentId vazio chega
  ao lookup e mantém 404; Zod inválido mantém 400 com details completos.
- JSON malformado mantém 500 Erro ao criar unidade. CatalogError conserva
  status/mensagem. Código repetido na locadora dá 400 Código único já existe
  antes de consultar o equipamento. Código igual em locadoras distintas é
  admitido; caixa e espaços conservam a comparação exata existente.
- Equipamento ausente, alheio ou em quarentena dá 404 Equipamento não
  encontrado. Unidade é criada sem alterar stock/maxStock/isAvailable. A
  política existente admite criação em equipamento indisponível ou com estoque
  zero.
- Medidor zero ou ausente fica nulo: o caso de uso existente só passa valores
  truthy ao INSERT. Não se corrigiu esse comportamento nesta extração.
- GUC, lock, unicidade e INSERT ficam na transação existente. Corrida com o
  mesmo código produz uma criação e um 400. RLS recusa INSERT sem GUC ou com
  outra locadora; FK composta recusa equipamento alheio mesmo com GUC própria.
  Falha AFTER INSERT desfaz a unidade, sem efeito sobre o equipamento.

### Testes executados e resultados

| Verificação                          | Resultado                                                   |
| ------------------------------------ | ----------------------------------------------------------- |
| Caracterização anterior do legado    | 36 unitários e 41 HTTP aprovados antes da implementação     |
| GET/POST e catálogo focados          | 208 aprovados / 3 arquivos; 72 de criação nos dois adapters |
| HTTP compilado, modo legacy          | 1.397 aprovados / 17 arquivos                               |
| HTTP compilado, modo better-auth     | os mesmos 1.397 / 17 aprovados                              |
| Tipos                                | 12 projetos, raiz e novos testes estritos: exit 0           |
| Inventário de autorização            | 67 aprovados, sem ampliar exceções                          |
| Builds                               | API e legado: exit 0, banco fictício na compilação          |
| Lint, arch, nomes, higiene e ratchet | exit 0; baselines preservadas                               |

Unidade completa: 2.753 testes / 91 arquivos aprovados. Segurança completa: 668
/ 27 aprovados e 18 condicionais preexistentes pulados. Identidade completa: 134
/ 13 aprovados.

Os 41 casos HTTP novos usam sessão real, papel PostgreSQL sem BYPASSRLS e banco
descartável. A concessão FINANCIAL/EQUIPMENTS/WRITE da fixture preexistente foi
isolada para testar criação/revogação e restaurada exatamente no teardown.
Nenhuma ACL de produto mudou. RLS e FK foram também exercitados por SQL direto,
com controle positivo e rollback. Aviso anterior de pg sobre client.query
concorrente permanece como dívida, sem atualização de dependência.

SQL final confirmou zero organizações, unidades, permissões, memberships,
perfis, usuários, auditorias, papéis api_parity e triggers/funções de falha
desta API; 19 migrations aplicadas. Teardown encerrou os servidores HTTP
próprios; o PostgreSQL próprio foi encerrado após conferir PID. As sete portas
destas execuções, incluindo 55442, foram verificadas fechadas; cookies
temporários restantes: zero. Logs e sondas ficam em TEMP. Handoff canônico
conserva seu SHA256.

### Estado da API legada

149 rotas/193 métodos declarados e 46 páginas permanecem preservados e
configurados. Serviço parcial: 30 rotas/39 métodos, 24 GETs e quinze mutações,
zero páginas. Os 39 coincidem com operações legadas, sem endpoint extra: 20,2%
por contagem, faltando 154 métodos. Esse percentual não mede esforço, progresso
geral ou autorização para excluir app/. (caminho antigo) Sem cutover, redirect,
desativação, mudança de cliente/scheduler, publicação ou push.

### Dívida/risco restante

Medidores zero gravados como nulos, código com espaços aceito, JSON malformado
500 e criação independente de estoque/disponibilidade são comportamentos
observados preservados. Uma revisão funcional exige corte próprio e decisão
quando afetar o produto. Paridade local não prova tráfego, deploy, mobile nativo
ou rollback operacional. PATCH/DELETE de unidades, demais escritas,
auth/callbacks, pagamentos, webhooks e jobs continuam fora do serviço. Arch
conserva 1.050 violações antigas; higiene conserva 946 achados em 272 entradas,
sem aumento. A modernização geral permanece incompleta.

### Próximo corte recomendado naquela onda

PATCH/DELETE /api/admin/equipment-units/[id]: updateUnit/deleteUnit já estão no
catálogo compartilhado e o GET está composto. Caracterizar primeiro ações
WRITE/DELETE distintas, posse antes do corpo, schema, medidores, status, código
único, recusa de unidade alugada e rollback. Preservar lock, estoque e legado.

## Corte 31 — edição e exclusão de unidades físicas (2026-10-02, sem commit)

### O que foi implementado

PATCH/DELETE /api/admin/equipment-units/[id] montados no serviço, delegando aos
casos de uso updateUnit/deleteUnit existentes em backend/catalog. O schema
legado de atualização foi movido para o contrato puro já existente, consumido
pelos dois adapters. GET, lógica de catálogo e corpos dos handlers legados
permanecem iguais. Não há mudança de estoque, cliente, banco ou scheduler.

### Arquivos criados/modificados

- packages/contracts/src/equipment-units.ts: UpdateEquipmentUnitSchema com os
  mesmos campos, enum, validação e descarte de extras do adapter legado. Sem
  novo export de pacote, dependência ou validação de negócio.
- app/api/admin/equipment-units/[id]/route.ts (caminho antigo): importa somente
  o schema comum; funções GET/PATCH/DELETE conservam o conteúdo anterior.
- apps/services/api/src/host/catalog.ts e
  src/app/api/admin/equipment-units/[id]/route.ts: composição de updateUnit e
  deleteUnit e adapters com WRITE/DELETE distintos.
- tests/unit/equipment-unit-mutations-api.test.ts e
  tests/api-host/equipment-unit-mutations.http.test.ts: caracterização anterior
  e comparação nos dois hosts. global-setup.ts concede UPDATE/DELETE de
  equipment_units somente ao papel descartável e revoga no teardown.
  organizations.http.test.ts compara OPTIONS com PATCH/DELETE nos dois hosts;
  POST/PUT por id permanecem 405.
- ADR, modernization, overview, admin-system, boot, context-map, features/INDEX,
  ratchet-gates e CHANGELOG Unreleased: estado e provas. Baselines e proteções
  preservadas.

### Contratos preservados

- URL, PATCH/DELETE, sessão e EQUIPMENTS/WRITE ou DELETE respectivamente. ADMIN
  do vínculo dispensa Permission; OPERATOR/FINANCIAL precisam da concessão exata
  e viva; CLIENT não obtém acesso por concessão. Papel global, query, outra
  ação/módulo/locadora não autorizam. Recusa e CSRF precedem a espera por params
  e leitura do corpo; a assinatura desestrutura params normalmente.
- Seleção por cookie/header mantém ausência e conflito. Membership ou
  organização inativa é recusada; a transação revalida ACTIVE e aplica GUC e
  lock antes do lookup. Unidade alheia, ausente ou em quarentena dá 404 antes de
  ler o body: Registro não encontrado no PATCH; Unidade não encontrada no
  DELETE.
- PATCH tem body diferido: só é validado após confirmar a posse. Campos ausentes
  preservam valores; campos extras não alteram id, equipamento ou locadora.
  Objeto vazio ou só com extras preserva inclusive updatedAt.
- Os cinco status existentes continuam aceitos sem nova regra de transição.
  Código permanece sem trim, único por locadora; o próprio código é aceito,
  assim como código usado só em outra locadora. Duplicado próprio mantém 400
  Código único já existe antes do UPDATE.
- Medidores zero são gravados e devolvidos como texto Decimal; serial e
  observações vazios viram nulos. Whitespace preserva seu valor. O DTO completo
  inclui equipamento apenas com id/name/category.name; createdAt não muda.
  Stock/maxStock/isAvailable do equipamento permanecem intactos.
- Schema inválido mantém 400 Dados inválidos com details Zod completos. JSON
  malformado mantém 500 genérico após posse. CatalogError preserva
  status/mensagem; outras falhas mantêm erro genérico, sem detalhes internos.
  DELETE não lê body, mesmo malformado.
- DELETE de AVAILABLE/MAINTENANCE/RETIRED devolve 200 Unidade deletada com
  sucesso. RENTED/RESERVED mantém 400 Não é possível deletar unidade em uso, sem
  efeito sobre a unidade ou o equipamento. Os envelopes de sucesso não
  acrescentam cache ou cookie.
- RLS de UPDATE/DELETE retorna zero linhas sem GUC ou com GUC alheia; controle
  com GUC própria altera uma linha e é desfeito. Falhas AFTER UPDATE/DELETE
  desfazem a operação. Corrida de código produz 200/400; exclusão concorrente
  produz 200/404. PATCH RENTED concorrente com DELETE permite somente a ordem
  serializada: unidade alugada preservada ou exclusão anterior ao PATCH 404.

### Testes executados e resultados

| Verificação                                 | Resultado                                                     |
| ------------------------------------------- | ------------------------------------------------------------- |
| Caracterização anterior do legado           | 59 unitários e 60 HTTP aprovados antes da implementação       |
| Leitura/criação/mutações e catálogo focados | 326 aprovados / 4 arquivos; 118 de mutações nos dois adapters |
| HTTP compilado, modo legacy                 | 1.457 aprovados / 18 arquivos                                 |
| HTTP compilado, modo better-auth            | os mesmos 1.457 / 18 aprovados                                |
| Tipos                                       | 12 projetos, raiz e novos testes estritos: exit 0             |
| Inventário de autorização                   | 67 aprovados, sem ampliar exceções                            |
| Builds                                      | API e legado: exit 0, banco fictício na compilação            |
| Lint, arch, nomes, higiene e ratchet        | exit 0; baselines preservadas                                 |

Unidade completa: 2.871 testes / 92 arquivos aprovados. Segurança completa: 668
/ 27 aprovados e 18 condicionais preexistentes pulados. Identidade completa: 134
/ 13 aprovados.

Os 60 casos HTTP novos usam sessão real, papel PostgreSQL sem BYPASSRLS e banco
descartável. As unidades são fixtures próprias, restauradas entre hosts para
comparar os mesmos ids/campos. A concessão FINANCIAL/EQUIPMENTS/WRITE
preexistente foi isolada para provar concessão/revogação e restaurada no
teardown. RLS foi também exercitado por SQL direto com rollback. Nenhuma ACL de
produto mudou. Aviso anterior de pg sobre client.query concorrente continua como
dívida, sem atualização de dependência.

SQL final confirmou zero organizações, unidades, permissões, memberships,
perfis, usuários, papéis api_parity e triggers/funções de falha desta API; 19
migrations aplicadas. Teardown encerrou os servidores HTTP próprios, inclusive
da execução inicial com asserções de caracterização corrigidas após observar o
legado. O PostgreSQL próprio foi encerrado após conferir PID. As nove portas
destas execuções, incluindo 55442, foram verificadas fechadas; cookies
temporários restantes: zero. Logs e sondas ficam em TEMP. O handoff canônico
conserva seu SHA256.

### Estado da API legada

149 rotas/193 métodos declarados e 46 páginas permanecem preservados e
configurados. Serviço parcial: 30 rotas/41 métodos, 24 GETs e dezessete
mutações, zero páginas. Os 41 coincidem com operações legadas, sem endpoint
extra: 21,2% por contagem, faltando 152 métodos. Esse percentual não mede
esforço, progresso geral ou autorização para excluir app/. (caminho antigo) Sem
cutover, redirect, desativação, mudança de cliente/scheduler, publicação ou
push.

### Dívida/risco restante

Status livre no PATCH, código sem trim, medidores nulos na criação mas zero na
edição, textos vazios convertidos em nulos e JSON malformado 500 são
comportamentos observados preservados. Revisão funcional exige incremento
próprio. Paridade local não prova tráfego, deploy, aparelho nativo ou rollback
operacional. Demais escritas, auth/callbacks, pagamentos, webhooks e jobs
continuam fora do serviço. Arch conserva 1.050 violações antigas; higiene
conserva 946 achados em 272 entradas, sem aumento. A modernização geral
permanece incompleta.

### Próximo corte recomendado naquela onda

POST /api/admin/equipments: createEquipment já está no catálogo compartilhado e
o GET já está composto. Caracterizar primeiro o limitador antes da permissão,
EQUIPMENTS/WRITE, body/normalização, associação à categoria da locadora,
estoque/DTO, erros de Prisma e diferenças de ambiente, concorrência e rollback.
Manter lock, regras existentes e legado, sem migrar uploads ou jobs em conjunto.

## Corte 32 — criação administrativa de equipamentos (2026-10-02, sem commit)

### O que foi implementado

POST /api/admin/equipments montado no serviço sobre createEquipment do catálogo
existente. Só transporte e composição foram adaptados. GET e POST usam o mesmo
limitador em memória de 200 requisições/minuto, antes da autorização. O host
passa o corpo bruto ao caso de uso; normalização, categoria, GUC, revalidação da
organização e lock de locação permanecem em packages/backend. Não houve mudança
no handler legado, no caso de uso, no schema, nos clientes ou no scheduler.

### Arquivos criados/modificados

- apps/services/api/src/host/catalog.ts: wrapper de createEquipment com os tipos
  da assinatura do catálogo existente.
- apps/services/api/src/app/api/admin/equipments/route.ts: POST com WRITE,
  delegação, 201 e os mesmos tratamentos de CatalogError, erro com code e erro
  genérico. GET preservado.
- tests/unit/admin-equipment-create-api.test.ts e
  tests/api-host/admin-equipment-create.http.test.ts: caracterização anterior do
  legado e execução das mesmas provas nos dois adapters.
- tests/api-host/global-setup.ts: INSERT em equipments concedido somente ao
  papel descartável sem BYPASSRLS, e revogado no teardown. Nenhuma ACL de
  produção mudou.
- tests/api-host/organizations.http.test.ts: OPTIONS compara GET/HEAD/OPTIONS/
  POST nos dois hosts. PUT/PATCH/DELETE da coleção permanecem 405.
- tests/security/route-auth-inventory.test.ts: auto-teste do limiter verifica
  GET e POST. Cada mutação é aplicada a um handler por vez e precisa produzir
  exatamente uma recusa e um handler intacto. Nenhuma regra, exceção ou baseline
  ampliada.
- ADR, modernization, overview, admin-system, boot, context-map, features/INDEX
  e CHANGELOG Unreleased: estado documentado atualizado.

### Contratos preservados

- URL, POST, sessão real e EQUIPMENTS/WRITE. ADMIN do vínculo dispensa
  Permission; OPERATOR/FINANCIAL precisam da concessão exata e viva. CLIENT é
  recusado mesmo com concessão. Papel global, query, outra ação/módulo/locadora
  não autorizam. CSRF e recusa do principal precedem o parsing do corpo.
- Ausência/conflito de seleção, herança da locadora do host e organização ou
  membership inativa conservam respostas e ordem. Campos tenantId/id do corpo
  não escolhem o destino.
- Nome e descrição são obrigatórios e aparados; preço usa parseFloat, aceita
  zero e sufixo numérico. Categoria alheia/ausente mantém 404. Imagens mantêm
  apenas strings não vazias, preservando whitespace das strings válidas.
- Tipos opcionais incorretos usam os defaults existentes; percentuais são
  limitados a 0–100. Frações em campos Int conservam a coerção observada no
  banco (maxStock ou dailyDiscount 1.5 vira 1). Não se criou nova validação.
- 201 devolve o DTO completo com categoria: pricePerDay numérico, valores
  diretos Decimal textuais e isAvailable espelhando available. Não cria unidades
  nem altera a categoria. Nomes/payloads repetidos são permitidos; dois POSTs
  concorrentes produzem duas linhas próprias, sem idempotência nova.
- CatalogError mantém status/mensagem. JSON malformado ou null mantém 500
  genérico. Error com propriedade code mantém 400 genérico; details só em
  development. Sucesso/erros de criação não acrescentam cookie ou cache.
- Tentativas recusadas também consomem a janela. GET/POST/HEAD compartilham o
  contador por processo; os hosts têm instâncias independentes. O IP da borda
  autenticada prevalece sobre headers IP forjados. 429 mantém corpo, Retry-After
  e X-RateLimit-* existentes.
- SQL direto confirma INSERT 42501 sem GUC ou com GUC alheia e FK 23503 para
  categoria de outra locadora. O controle próprio é desfeito por rollback. Falha
  AFTER INSERT desfaz a criação; revogar INSERT mantém 400 sem efeitos.

### Testes executados e resultados

Caracterização anterior: 32 unitários e 46 HTTP do legado aprovados antes de
implementar o adapter. A primeira execução HTTP revelou uma expectativa errada
no teste novo: frações Int são aceitas/convertidas, não recusadas. A prova foi
corrigida após observar DTO e gravação no banco, sem mudar produção.

Focados de criação/listagem e catálogo: 194 testes / 3 arquivos aprovados,
incluindo 64 de transporte nos dois hosts. HTTP compilado completo: 1.503 testes
/ 19 arquivos aprovados em legacy e os mesmos 1.503 em better-auth, com sessão
real e PostgreSQL RLS. Inventário estrutural: 67 aprovados.

Tipos dos 12 projetos, raiz e novos testes estritos: exit 0. Builds do serviço e
legado: exit 0, com origem de banco fictícia na compilação. Lint, arch,
check:test-names, hygiene e ratchet: exit 0. Baselines e proteções preservadas.

Unidade completa: 2.935 / 93 aprovados. Segurança: 668 / 27 aprovados, com 18
condicionais preexistentes pulados. Identidade: 134 / 13 aprovados. A primeira
execução unitária teve um timeout no teste preexistente do hook de commit; seus
quatro casos passaram isoladamente e a suíte completa passou na reexecução, sem
alterar timeout, código do hook ou asserções. O aviso preexistente de pg sobre
client.query concorrente permanece como dívida.

SQL final confirmou zero fixtures de API, papéis api_parity e triggers/funções
temporários de falha; 19 migrations aplicadas. Os servidores próprios foram
encerrados pelo teardown e o PostgreSQL próprio após conferir PID. As nove
portas destas quatro execuções, incluindo a caracterização inicial, foram
verificadas fechadas; cookies temporários restantes: zero. Logs e sondas
permanecem em TEMP. O handoff canônico conserva seu SHA256. Formato,
markdownlint, índices de documentação e git diff --check aprovados.

### Estado da API legada

149 rotas/193 métodos declarados e 46 páginas conservados. Serviço parcial: 30
rotas/42 métodos, 24 GETs e dezoito mutações, zero páginas. As 42 operações
coincidem com operações legadas, sem endpoint extra: 21,8% por contagem e 151
métodos restantes naquele corte de 2026-10-02. Esse percentual não media
esforço, progresso geral ou autorização para excluir a antiga raiz app/,
retirada depois no clone F. Nesse corte não houve cutover, redirect,
desativação, mudança de cliente/scheduler, publicação ou push.

### Dívida/risco restante

Coerção de preço/inteiros, strings de imagem sem trim, ausência de idempotência,
JSON malformado 500 e erros com code 400 são comportamentos observados. Sua
revisão funcional requer incremento próprio. O limite continua em memória por
processo; paridade não prova uma quota distribuída. Demais escritas,
auth/callbacks, pagamentos, webhooks e jobs ainda são legados. Arch conserva
1.050 violações antigas e higiene 946 achados em 272 entradas, sem aumento.
Paridade local não prova deploy, tráfego, aparelho nativo ou rollback
operacional. A modernização geral permanece incompleta.

### Próximo corte recomendado naquela onda

PUT/DELETE /api/admin/equipments/[id]: updateEquipment e deleteEquipment já
estão no catálogo. Caracterizar antes WRITE/DELETE, validação/posse, categoria,
DTO, disponibilidade, relações protegidas por FK, concorrência e rollback.
Avaliar a exposição de detalhes de erros no PUT legado antes de reproduzir esse
adapter no destino. Manter uploads, jobs e cliente fora do corte.

## Onda 33 — catálogo, veículos e logística (2026-10-02, sem commit)

### O que foi implementado

Sete operações implementadas antes da rodada de testes: PUT/DELETE de
equipamentos por id, GET/POST de veículos e GET/POST de logística, mais PATCH de
logística por id. updateEquipment/deleteEquipment permanecem no catálogo. As
regras existentes de veículos e entregas/coletas foram extraídas para
createVehicleService/createDeliveryService em backend/operations, com transações
injetadas. O host HTTP declara guards, parsing e transporte; não duplica regras.
Os handlers legados seguem ativos, compostos sobre as mesmas factories. Não
houve mudança de dependência, schema, migration ou UI.

Correção necessária de segurança: falhas inesperadas do PUT de equipamento agora
têm error/details genéricos fora de development, nos dois adapters. CatalogError
e respostas de sucesso permanecem iguais; entrada 234.

A decisão humana em boot.md substitui a validação por handler: implementar uma
onda relacionada inteira, depois consolidar a verificação. Preparar testes
durante a implementação continua permitido; nenhuma prova é presumida.

### Arquivos criados/modificados

- backend/operations: vehicles.ts, deliveries.ts, types.ts e index.ts;
  contracts/operations.ts e export explícito no package.json.
- lib/vehicles.ts (caminho antigo) e lib/logistics.ts (caminho antigo): facades
  de composição, sem segunda implementação. Helpers sem consumidores deixaram de
  ser reexportados.
- Serviço: host/operations.ts, host/catalog.ts e os adapters admin/equipments
  por id, admin/vehicles, admin/logistics e admin/logistics por id. Os três
  adapters legados de operações também passam a delegar.
- Legado e serviço: tratamento seguro do erro inesperado no PUT de equipamento.
- tests/unit/catalog-operations-wave-api.test.ts,
  tests/api-host/catalog-operations-wave.http.test.ts, global-setup.ts,
  organizations.http.test.ts, catalog-http.test.ts e
  route-auth-inventory.test.ts.
- Documentação arquitetural, features, contexto, CHANGELOG e known-issues;
  ratchet-transfers registra apenas o novo entrypoint contracts/operations.

### Contratos preservados

- EQUIPMENTS/WRITE ou DELETE; veículos LOGISTICS/READ ou WRITE; logística ADMIN
  do vínculo da locadora, sem usar papel global como concessão. Sessão,
  principal vivo e CSRF central continuam anteriores ao efeito.
- Edição de equipamento conserva espaços em nome/descrição, parseFloat do preço
  e estoque anterior quando maxStock zero é informado. DTO completo, categoria
  local, disponibilidade e relações protegidas na exclusão.
- Veículos: placa sem trim, unicidade por locadora, filtros e ordenação,
  defaults TRUCK/AVAILABLE; contrato Zod existente descarta extras.
- Logística: referências da locadora, DTO rental.users exclusivamente do
  ClientProfile local, ordenação e filtros. Distância zero vira null; COMPLETED
  sem completedAt recebe hora atual. Campos opcionais ausentes permanecem.
- Parsing de veículos/logística permanece dentro da transação. Veículos mantêm
  transação/lock de locação; logística conserva a transação tenant original, sem
  introduzir lock ou novas transições.
- Envelopes {vehicles}/{vehicle}, {deliveries}/{delivery}, status 200/201, Zod
  400, referência alheia 404 e JSON malformado 500. Clientes continuam usando os
  mesmos URLs na origem legada configurada.

### Testes executados e resultados

| Verificação consolidada                       | Resultado                                                                                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| HTTP compilado, sessão real, modo legacy      | 1.526 aprovados e uma expectativa nova incorreta; após corrigir somente a expectativa, os 24 casos do arquivo passaram                                       |
| HTTP compilado, sessão real, modo better-auth | 1.527 testes em 20 arquivos aprovados                                                                                                                        |
| Unidade completa                              | 3.072 aprovados e um teste antigo exigindo exposição do erro; atualizado para produção/development, com rechecagem dos dois arquivos afetados: 235 aprovados |
| Segurança completa                            | 669 aprovados e 18 pulados por condições preexistentes; 27 arquivos                                                                                          |
| Identidade completa                           | 134 aprovados; 13 arquivos                                                                                                                                   |
| Tipos                                         | 12 projetos, raiz e configuração estrita dos testes novos aprovados; raiz rechecada após ajustes dos testes                                                  |
| Builds                                        | API e legado aprovados, usando endereço fictício de banco no build                                                                                           |
| Gates                                         | lint, arch, higiene, nomes dos testes e ratchet aprovados; lint dos testes alterados rechecado                                                               |

A expectativa HTTP inicial copiava a normalização do POST para o PUT. O código
legado existente e a execução real confirmaram espaços preservados e estoque
positivo anterior quando zero é enviado; a implementação não foi alterada para
acomodar esse teste. O teste antigo que cobrava error.message em produção foi
substituído por exigência explícita dos envelopes de produção/development. As
suítes completas aprovadas não foram repetidas por ajuste.

O inventário reconhece três novos caminhos exatos de classes de erro que agora
vêm do pacote compartilhado. Continua verificando o arquivo dono e a ausência de
efeitos em instanceof. O novo auto-teste compara classes compartilhadas e
facades e recusa mutações de Symbol.hasInstance. Nenhuma rota, baseline ou
proteção de autenticação foi dispensada. Arch conserva a dívida anterior e
higiene aceita os mesmos 946 achados em 272 entradas.

SQL final confirmou zero fixtures de API, papéis temporários e triggers/funções
de falha; as 19 migrations permanecem aplicadas. Teardown encerrou os hosts HTTP
e o PostgreSQL próprio foi encerrado após conferir PID. As sete portas das três
execuções desta onda, incluindo 55442, estão fechadas; cookies temporários
restantes: zero. Logs, cópias e sondas ficam em TEMP. O handoff canônico
conserva seu SHA256; não houve commit ou push.

### Estado da API legada

149 rotas/193 métodos e 46 páginas conservados. Serviço: 33 rotas/49 métodos, 26
GETs e 23 mutações, zero páginas. Todos os 49 coincidem com operações legadas;
zero endpoint adicional. Cobertura por contagem: 25,4%; restam 144 métodos. Esse
percentual não media esforço nem conclusão geral e, na onda 33 de 2026-10-02,
não autorizava excluir a antiga raiz app/, retirada depois no clone F. Não houve
mudança de cliente/scheduler, cutover, redirect, desativação, push, deploy ou
operação de produção nessa onda.

### Dívida/risco restante

Logística mantém quirks antigos de distância/data/validação e a transação
original; não se presume uma nova máquina de estados ou idempotência.
Pagamentos, webhooks, callbacks, uploads e jobs ainda exigem seus próprios
cortes. Paridade local não prova tráfego, aparelho nativo ou rollback
operacional. A modernização geral permanece incompleta.

### Próximo corte recomendado naquela onda

Uma onda do portal de locações/orçamentos, começando pelas consultas e ações
locais já implementadas em backend/rentals e backend/quotations. Conferir
principal, posse, DTOs, soft delete, estoque e efeito de cada ação antes de
compor o transporte. Separar emissão de pagamento, documentos e provedores
quando a composição ainda depender do runtime legado. Consolidar os testes ao
final da onda inteira.

## Onda 34 — portal e consultas de orçamentos (2026-10-02, sem commit)

### O que foi implementado

Nove operações implementadas antes dos testes: GET de locações do cliente;
GET/DELETE do detalhe; POST de pedido de coleta e prorrogação; GET/DELETE do
orçamento do cliente; GET da lista e do detalhe administrativo de orçamentos. O
serviço compõe as factories existentes de rentals/quotations. Nenhuma regra ou
query foi copiada para o host. A única alteração do adapter legado é consumir o
schema estrito de prorrogação pelo contrato comum, com comportamento igual.

### Arquivos criados/modificados

- Serviço: host/portal.ts e sete route.ts finos em client/rentals, quotes/[id] e
  admin/quotes, incluindo os subcaminhos dos pedidos.
- contracts/rental-requests.ts e seu export explícito; registro do entrypoint em
  ratchet-transfers.json. Adapter legado de request-extension usa o schema.
- portal-wave.http.test.ts e os direitos mínimos do papel temporário em
  global-setup.ts, com REVOKEs correspondentes. notifications.http.test.ts
  amplia as provas reais de isolamento de INSERT.
- Documentação arquitetural, features, contexto e CHANGELOG.
- Dez exceções obsoletas de tipos na baseline de higiene foram retiradas após
  consumo real em host/portal.ts. A baseline encolheu de 946 para 936 achados,
  de 272 para 267 entradas; nenhum nome/tolerância foi acrescentado.

### Contratos preservados

Sessão real, seleção explícita, membership vigente, posse por tenant e usuário,
RLS FORCE e CSRF permanecem. DELETE oculta apenas o histórico, preservando
locação/orçamento operacional, itens e cobranças; admin continua lendo a linha.
Detalhe de orçamento mantém Decimal numérico, status lowercase e metadata de
pagamento nula quando REJECTED. Locações mantêm os DTOs, relações e filtro
existentes. Não foram instalados pagamentos ou downloads no serviço.

Pedido exige locação ACTIVE e visível do próprio cliente. Reutiliza a chave por
tipo/prazo/data final e gera audit e alerta para ADMIN ativo da mesma locadora
na mesma transação com lock. Prazo é inteiro 1–365, schema estrito. A estimativa
não é cobrança. Falha no alerta desfaz o audit; ausência de atendimento
recebe 503. Coleta ignora o corpo, como no legado; JSON malformado de prazo
mantém 500.

Lista administrativa conserva QUOTES/READ, filtros/paginação e no-store. O
detalhe conserva ADMIN/OPERATOR do vínculo; as políticas distintas não foram
unificadas silenciosamente. Demais métodos dessas rotas permanecem legados.

### Testes executados e resultados

HTTP local compilado aprovou os 36 casos novos, incluindo concorrência entre um
escritor legado e outro do serviço, rollback por falha de alerta, posse, soft
delete, revogação, CSRF e DTO. No modo legacy, a rodada completa aprovou 1.562
casos e encontrou uma expectativa antiga de privilégio de INSERT. A rechecagem
focada passou após reforçar RLS; no modo better-auth, 1.563 casos em 21 arquivos
passaram. Unidade completa: 3.074 casos em 94 arquivos; segurança: 669 casos em
27 arquivos e 18 pulados por condições preexistentes; identidade: 134 casos em
13 arquivos. Tipos, builds, lint, arch, higiene, nomes e ratchet aprovados. As
suítes completas aprovadas não foram repetidas por ajuste.

A prova de INSERT não foi apagada: o papel temporário agora precisa criar
alertas do pedido existente. SQL direto exige 42501 sem GUC e com tenant alheio;
com GUC correta, uma inserção local é permitida e revertida. As provas antigas
de UPDATE/DELETE continuam. Uma sonda inicial usava a coluna updatedAt,
inexistente em Notification; o SQL foi corrigido conforme o schema e a prova
focada passou. Nenhuma permissão de produção foi alterada.

A configuração estrita final cobre os três arquivos HTTP alterados. Tipos
imprecisos preexistentes no teste de notificações receberam anotações de headers
e id string; nenhum caso ou asserção foi removido e não houve mudança de
execução.

SQL final confirmou zero fixtures, papéis temporários e triggers/funções de
falha; 19 migrations aplicadas. O PostgreSQL descartável próprio foi encerrado
após conferir o PID. Os dois hosts de cada uma das quatro execuções foram
encerrados pelo teardown; nove portas fechadas, incluindo 55442, e zero cookies
temporários restantes. Logs e sondas permanecem em TEMP. Handoff canônico
preservado, sem commit ou push.

### Estado da API legada

Legado mantém 149 rotas/193 métodos e 46 páginas. O serviço implementa 40
rotas/58 métodos, 31 GETs e 27 mutações; todas coincidem com métodos legados,
zero endpoint extra. São 30,1% por contagem, com 135 métodos restantes; esse
percentual não mede esforço nem conclusão geral. Sem cutover, mudança de
cliente/scheduler, push, deploy ou desativação.

### Dívida/risco restante

Atividades do cliente, listagem geral de orçamentos, administração de locações,
pagamentos, documentos, callbacks, webhooks e jobs ainda têm cortes pendentes.
Provas locais não certificam deploy, tráfego, dispositivo ou rollback
operacional. O projeto segue intermediário, com a raiz necessária à migração.

### Próximo corte recomendado naquela onda

Outra onda de consultas relacionadas: administração de locações e atividades do
cliente, seguida da listagem de orçamentos do cliente. Extrair consultas ainda
nos handlers para módulos donos e compor os casos existentes sem substitutos
fictícios para dependências de pagamento/documento. Implementar todo o bloco
antes da rodada consolidada.

## Onda 35 — ciclo de locação, orçamentos e atividades (2026-10-02, sem commit)

### O que foi implementado

Doze operações implementadas antes dos testes: GET /api/quotes e
/api/client/activities; GET/POST /api/admin/rentals; GET/PATCH/DELETE do detalhe
administrativo; POST de checkout, checkin, extend e calculate-late-fee; POST de
/api/client/rentals/[id]/extend. Os adapters dos dois hosts usam as mesmas
implementações. Cliente, proxy, scheduler e configuração de tráfego preservados.

host/rentals.ts compõe disponibilidade, transação com lock, lifecycle, conversão
e administração existentes. A consulta real de documentos obrigatórios ganhou um
ponto explícito em customers, consumido pela composição e pelo serviço de
documentos legado; nenhum armazenamento ou provedor fictício. Listagem de
orçamentos foi extraída para quotations/client-portal e atividades para
customers/activities. As fachadas antigas delegam aos mesmos módulos.

### Arquivos criados/modificados

- Serviço: host/rentals.ts, host/portal.ts e nove route.ts relacionados às doze
  operações. Os handlers adaptam HTTP; não contêm queries ou regras copiadas.
- contracts/rentals.ts e package.json: cinco schemas existentes e um entrypoint
  explícito. Decimal usa a mesma versão 10.6.0 já instalada no workspace;
  dependência declarada e lock atualizado por instalação offline sem scripts.
  Registro correspondente em ratchet-transfers.json.
- Backend: customers/activities.ts, customers/client-documents.ts e seu index;
  quotations/client-portal.ts. Fachadas lib/client-activities.ts (caminho
  antigo) e lib/quote-request.ts (caminho antigo); adapters legados de
  atividades, lista de orçamentos e cinco rotas que passam a consumir os schemas
  comuns.
- rental-cycle-api.test.ts, rental-cycle.http.test.ts e global-setup.ts. O papel
  temporário recebeu apenas as capacidades necessárias para executar o ciclo,
  com REVOKEs e limpeza correspondentes. Nenhum ACL de produção alterado.
- Documentação arquitetural, features, contexto, CHANGELOG e baseline de
  higiene. Apenas duas exceções de tipos agora consumidos no serviço foram
  retiradas: RentalLifecycle e RentalAdministration. A baseline encolheu de 936
  para 934 achados, mantendo 267 entradas; nenhuma tolerância acrescentada.

### Contratos preservados

Sessão real nos dois modos, membership vigente, ADMIN da locadora nas operações
administrativas, posse do cliente, CSRF central e transações sob RLS FORCE.
Schemas conservam transforms Date/Decimal, descarte de extras e limites: prazo
do cliente 1–30; administrativo positivo, com boleto habilitado por padrão.
Responses, status, envelopes, ordenação e mensagens mantêm o comportamento
legado.

Criação manual mantém PENDING, datas dos itens e arredondamento em centavos;
criação com quoteId usa a conversão existente e reaproveita a locação já criada.
Checkout exige os quatro documentos, quitação e estoque; retry após a saída é
idempotente. Cancelamento altera status, conservando linha e itens; reabertura
recusa 409. Checkin completa a locação e registra danos em centavos.

Prorrogação administrativa grava datas, itens e cobrança/outbox atomicamente;
boleto enfileirado retorna 202, sem chamar o provedor. Sem boleto, conserva 200
e ausência de cobrança. A prorrogação direta do cliente altera datas e registra
PIX, como já fazia o legado. Ela é diferente de request-extension, que registra
um pedido de atendimento sem alterar datas ou cobrar. Multa mantém o cálculo
existente e uma única cobrança na corrida entre hosts. Falha SQL em payments ou
outbox_events desfaz todo o incremento.

Lista de orçamentos conserva números, datas ISO, status lowercase, itens e
pagamentos ordenados, excluindo linhas ocultas/de outro titular ou locadora.
Cache privado e Vary com Cookie/x-tenant-id preservados, além dos campos que o
Next acrescenta. Atividades conservam eventos, descrição BRL, limite 1–100,
ordenação por tempo e filtros existentes. A lista mantém a metadata antiga dos
pagamentos; a regra do detalhe REJECTED não foi estendida silenciosamente.

### Testes executados e resultados

47 novos testes de transporte passaram. Unidade completa executou 3.121 casos:
3.118 passaram e três testes antigos excederam 20 segundos sob carga simultânea.
Só os três arquivos foram reexecutados: 33 casos passaram, sem mudar timeouts,
provas ou implementação para acomodá-los.

HTTP compilado com sessão real: legacy completo teve 1.621 aprovações e uma
expectativa incorreta de Vary; o Next acrescenta seus próprios campos. O teste
passou a exigir Cookie/x-tenant-id e manteve a comparação completa dos hosts.
Rechecagem focada: 59 casos passaram. Better Auth completo: 1.622 casos em 22
arquivos passaram. Cobertura inclui concorrência, rollback por falha SQL,
documentos de outra locadora, quitação, ownership, CSRF, revogação e DTOs.

Segurança: 669 casos em 27 arquivos passaram, com 18 pulados por condições
preexistentes. Identidade: 134 casos em 13 arquivos passaram. Tipos dos 12
projetos, tipos da raiz, configuração estrita dos dois testes novos, builds dos
dois hosts, lint, arch, higiene, nomes e ratchet aprovados. Build legado usa
banco deliberadamente indisponível; mensagens de consulta de sitemap não
certificam conteúdo gerado a partir de um banco de produção. Identidade emite
aviso preexistente de consultas concorrentes do pg; nenhum erro de teste.

SQL final: 19 migrations aplicadas e zero organizações, orçamentos, locações,
pagamentos, documentos, eventos, papéis temporários e triggers/funções de falha.
Teardowns encerraram os seis hosts das três execuções HTTP; sete portas
fechadas, incluindo o PostgreSQL descartável próprio, encerrado após conferir
PID/diretório. Zero cookies temporários. Logs e sondas ficam em TEMP.

### Estado da API legada

Legado permanece com 149 rotas/193 métodos e 46 páginas. Serviço parcial com 49
rotas/70 métodos, 35 GETs e 35 mutações, todos correspondentes ao legado, sem
endpoint extra. São 36,3% por contagem, com 123 métodos restantes; isso não mede
esforço nem conclusão geral. Web/mobile mantêm zero handlers de backend e suas
origens configuradas. Sem cutover, commit, push, deploy ou produção.

### Dívida/risco restante

Emissão e reconciliação externa de pagamentos, downloads, callbacks, webhooks,
jobs e demais endpoints ainda dependem do legado. O novo host grava a mesma
outbox, mas não assume seu consumo. Provas locais não certificam tráfego real,
deploy ou recuperação operacional. Não há autorização técnica para retirar a
raiz app antes de concluir a paridade e a migração operacional.

### Próximo corte recomendado naquela onda

Onda das mutações administrativas de orçamentos já apoiadas em quotations,
incluindo conversão para locação. Separar emissão externa, documentos e jobs nos
respectivos cortes, usando dependências reais e preservando o legado.
Implementar todo o bloco relacionado antes da rodada consolidada.

## Onda 36 — mutações de orçamento (2026-10-02, sem commit)

### O que foi implementado

Nove métodos instalados no serviço parcial, em um bloco antes da validação:
PATCH/DELETE /api/admin/quotes/[id], GET/POST /adjustments, DELETE
/adjustments/[adjustmentId], POST /calculate-late-fee, POST /convert-to-rental,
POST /send-adjusted-quote e POST /api/quotes. Todos continuam disponíveis no
legado. Nenhuma URL de cliente ou configuração de tráfego mudou.

host/quotations.ts compõe as factories existentes de quotations/rentals com
Prisma, RLS, lock e disponibilidade reais. O host faz adaptação HTTP e
composição; não contém queries, cálculo, regra de aprovação ou chamadas de
provedor.

### Arquivos criados/modificados

- Sete adapters de rota no serviço, com nove métodos novos; host/quotations.ts e
  a exportação do strictRateLimit na fachada já existente.
- contracts/quotations.ts e package.json: quatro schemas existentes movidos, com
  transformações Date, defaults, trim, mensagens e descarte de extras
  preservados. lib/validations/index.ts (caminho antigo) conserva seu export e
  tipo públicos. Três adapters legados passam a importar o contrato comum.
- DELETE legado e novo: falha inesperada mantém 500 genérico e não publica
  error.message. Sucesso e erros de negócio não mudam. Entrada 235 de
  known-issues.
- quote-mutations-api.test.ts, quote-mutations.http.test.ts, global-setup.ts e
  teardown de rental-cycle.http.test.ts. Apenas grants necessários no papel
  temporário do banco descartável, com REVOKEs correspondentes.
- route-auth-inventory.test.ts reconhece os novos adapters e a mesma classe
  concreta de erro. A classificação pública exige o resolvedor de tenant
  validado; strictRateLimit continua verificado na mesma factory em memória.
  Recusas sintéticas cobrem tenant sem validação, limitador e classe
  adulterados. Nenhum wildcard, método isento ou proteção relaxada.
- Documentação, CHANGELOG e registro explícito do novo entrypoint puro em
  ratchet-transfers.json. Oito exceções de tipos agora consumidos pela
  composição retiradas da higiene: 934 para 926 achados, 267 para 263 entradas.
  Nenhuma tolerância acrescentada.

### Contratos preservados

ADMIN/OPERATOR em update e envio; ADMIN exclusivo em exclusão/conversão;
ADMIN/OPERATOR/FINANCIAL em reajustes; QUOTES/READ na simulação e QUOTES/WRITE
na consulta de exclusão do histórico. Sessão real, membership atual, permissão,
CSRF e ownership por locadora antecedem os efeitos.

Reajustes mantêm histórico imutável (DELETE responde 409), centavos HALF_UP,
substituição do frete TRAVEL e reprecificação da cobrança pendente nunca
emitida. Cobrança já emitida exige reconciliação e recusa tudo com 409. Falha da
outbox desfaz reajuste, valor do orçamento e cobrança na mesma transação.
Simulação de multa conserva no-store e não grava valores.

Aprovação UPFRONT não cria locação sem quitação; AT_END usa a conversão atômica
existente. Conversão concorrente entre hosts reaproveita a mesma locação,
transfere os pagamentos e preserva REFUNDED. generateBoleto recebido continua
forçado a false, como no legado. A notificação é quote.status.notify, vinculada
ao orçamento, com status COMPLETED; não foi inventado um tópico novo.

Envio ajustado retorna 202 e somente enfileira. A chave da outbox recebe o
prefixo tenantId e a deduplicação usa o instante do ajuste. Criação pública
ignora preços enviados, usa catálogo, datas/disponibilidade e sequência por
locadora, grava o orçamento e quote.created.notify atomicamente. Sessão é
opcional; quando presente, requer CLIENT da locadora e conserva 404
customer_not_found na recusa. Nenhum e-mail, gateway, cobrança externa ou job
foi executado.

### Testes executados e resultados

Unidade consolidada: 3.164 testes em 96 arquivos passaram. Após estreitar uma
importação ampla do mock, apenas o novo arquivo foi reexecutado: 43 passaram.
HTTP novo contém 68 provas com hosts compilados, sessão real e papel sem
BYPASSRLS. Abrange autorização, CSRF, locadora estrangeira, revogação, dinheiro,
concorrência, conversão, preço do catálogo e rollback por falha SQL.

HTTP legacy completo: 1.669 passaram e 21 falharam inicialmente. Três
expectativas novas estavam incorretas sobre tópico/aggregateId, prefixo da chave
de outbox e status de cliente não vinculado. Dezoito recusas no arquivo antigo
de unidades vinham da membership deixada REVOKED pelo teardown do ciclo de
locação. Sua limpeza agora restaura role/status capturados, mantendo a prova de
revogação. Rechecagem somente dos três arquivos: 186 passaram e restou a
expectativa do tópico; corrigida conforme o código autoritativo e reexecutada
com sucesso.

HTTP Better Auth completo: 1.689 passaram e apenas a mesma expectativa do tópico
falhou; a conversão foi reexecutada nos dois modos, passando. O filtro focado
seleciona uma prova entre 68, sem adicionar skips à suíte. Suítes completas não
foram repetidas por alteração de expectativa.

Segurança consolidada: 668 passaram e o inventário recusou dois adapters ainda
não classificados. O registro foi alinhado à composição real e ganhou prova
negativa; seus 69 testes passaram na rechecagem. As 18 condições de skip
preexistentes permanecem. Identidade: 134 testes/13 arquivos passaram.

Tipos dos 12 projetos, tipos da raiz, configuração estrita dos três arquivos de
teste alterados, builds dos dois hosts, lint, arch, higiene, nomes e ratchet
aprovados. Build legado usa banco deliberadamente indisponível; não comprova
conteúdo SSR de produção. Aviso de consultas concorrentes do pg permanece
preexistente, sem falha de identidade.

Comparação dos handlers por AST confirmou os contratos HTTP anteriores; a única
diferença de corpo é a correção documentada do 500 da exclusão. Formatação,
markdownlint, índices e links da documentação e git diff --check aprovados.
Auditoria final do banco descartável: 19 migrations aplicadas, sem fixtures,
papéis temporários ou triggers/funções de falha dos testes. As cinco execuções
HTTP próprias terminaram com seus dez listeners encerrados; o PostgreSQL foi
parado após conferir PID e diretório. As onze portas estão fechadas e nenhum
arquivo de cookie permaneceu. SHA-256 do handoff canônico conferido, sem
mudança.

### Estado da API legada

149 rotas/193 métodos e 46 páginas preservados. Serviço parcial: 54 rotas, 79
métodos (36 GETs e 43 mutações), todos correspondentes ao legado, sem endpoint
extra. Restam 114 métodos por contagem. Os 40,9% de métodos montados não medem
esforço, migração operacional nem conclusão geral. Web/mobile continuam finos e
apontados à origem configurada. Sem cutover, commit, push, deploy ou produção. O
handoff canônico permaneceu intocado.

### Dívida/risco restante

Emissão/reconciliação externa, boletos, documentos, callbacks, webhooks, crons,
consumidores da outbox e demais rotas seguem legados. Provas locais não
certificam produção, entrega real de mensagens ou gateways. O serviço não assume
scheduler nem consumo de eventos. A raiz app ainda não pode ser retirada.

### Próximo corte recomendado naquela onda

Documentos de orçamento (downloads e exportação de reajustes), usando o módulo
documents e os contratos existentes, com paridade de bytes, ownership,
permissões e falhas. Emissão externa e jobs permanecem em cortes próprios.
Implementar o bloco relacionado inteiro antes da validação consolidada.

## Onda 37 — PDFs de orçamento e ofício (2026-10-02, sem commit)

### O que foi implementado

Cinco GETs instalados no serviço: download do orçamento do titular, download
administrativo, reajustes, ofício do orçamento e ofício do lançamento
financeiro. Adaptação HTTP e composição no host; snapshot, queries, branding,
mapeamento e PDFKit em backend/documents e backend/communications. Legado ativo.

Os onze corpos de função do mapper foram comparados à captura anterior, após
normalizar formatação e o nome do loader injetado: iguais. Datas, retenções,
arredondamento, dados e textos preservados. Correções relacionadas: Author usa a
razão social da locadora; Creator usa PLATFORM; 500 inesperado não publica
detail/error.message nos dois hosts.

### Arquivos criados/modificados

- backend/documents: quote-documents, oficio-queries, oficio-data-mapper,
  oficio-generator, oficio-types, oficio-styles e index explícito.
- backend/communications/tenant-branding e index;
  backend/http/quote-pdf-response e index; service/host/documents e cinco
  adapters finos.
- lib/quote-document, (caminho antigo) email-branding e lib/pdf (caminho antigo)
  conservam fachadas legadas. Tipos/estilos internos de lib/pdf (caminho antigo)
  movidos; nenhuma rota removida. Dois adapters legados de ofício usam queries
  compartilhadas.
- design-tokens/documents: cores da paleta canônica e geometria A4 em pontos
  idênticas às anteriores, com dois testes. Entry ./documents puro e explícito,
  registrado no ratchet.
- Manifests/lockfile: date-fns e decimal.js declarados no backend; dependência
  de design-tokens. date-fns da raiz retirado após perder consumidor. 103
  declarações dos três manifests comparadas ao lockfile.
- quote-documents-api.test.ts, quote-documents.http.test.ts e inventário de
  autorização: handler delegado atravessado pela mesma gramática e classe
  concreta de branding reconhecida, sem allowlist ou guarda ampliada.
- Aliases financeiros sem uso retirados; teste fiscal importa domínio canônico,
  com as mesmas asserções. Quatro exceções resolvidas retiradas da higiene: 926
  para 922 achados, 263 entradas. Vinte e dois literais retirados: cores 193
  para 176, números 8 para 3. Nenhuma tolerância nova.

### Contratos preservados

QUOTES/READ nos downloads administrativos; FINANCIAL/READ nos ofícios;
titularidade e clientDeletedAt no download do cliente. Sessão real, vínculo
atual, permissão, tenant explícito e FORCE RLS antecedem leitura/renderização.
Recurso externo continua 404; erros previstos mantêm 401/403/404/409/422.

Snapshot lido em transação; PDF renderizado após encerrá-la. application/pdf,
no-store, attachment/inline, filenames, sanitização e nosniff existentes
preservados. preview=true, fallback payment → rental → quote, texto completo de
reajustes e truncamento histórico do ofício mantidos. Download não altera
dinheiro, status, cobranças, histórico nem outbox.

### Testes executados e resultados

- Unidade consolidada: 3.197 aprovados e três falhas na primeira rodada (3.200
  casos). Dois eram expectativas erradas de mês no teste novo: meia-noite UTC de
  01/01 corresponde a dezembro em São Paulo. A terceira era varredura de
  artefatos entrando na junção criada pelo pnpm; correção na entrada 237.
  Rechecagem somente dos dois arquivos afetados: 41/41, incluindo os 36 novos
  casos. Nenhum teste apagado ou afrouxado.
- HTTP compilado, legacy: 1.749/1.750 na rodada completa. Falha na leitura do
  papel temporário no teste SQL, passado em options. Rechecagem apenas do
  arquivo alterado: 60/60. Better Auth: 24 arquivos e 1.750/1.750.
- PDF real: cinco rotas, autoria da locadora, texto, bytes equivalentes entre
  hosts (normalizando apenas CreationDate e ID derivados do PDFKit), revogação,
  tenant externo, soft delete, falha SQL genérica, referências ausentes,
  preview, HEAD/OPTIONS e leitura sem mutação.
- Segurança: 670 aprovados, 18 pulados preexistentes; inventário focado 69/69.
  Identidade 134/134; fiscal 21/21; tokens de impressão 2/2.
- Tipos design-tokens/backend/serviço/raiz e dois testes novos aprovados. Builds
  API standalone e legado aprovados. Os traces das três rotas PDF verificadas
  contêm os 14 arquivos AFM do PDFKit; HTTP usa standalone real. lint, arch,
  tokens, higiene, nomes e ratchet aprovados.
- Build legado com banco deliberadamente indisponível não certifica SSR de
  produção. Aviso preexistente de queries concorrentes do pg, sem falha.
  Paridade binária/textual não certifica PDF/UA ou leitura assistiva.
- test:gates: 13 arquivos, 183/183 aprovados; Markdown e índices/links
  aprovados. Auditoria do banco descartável: 44 tabelas, zero dados de produto,
  papéis temporários e triggers de falha. Controles efêmeros de rate limit
  limpos somente nesse banco próprio, após confirmar os demais dados vazios.
  PostgreSQL encerrado após conferir PID/diretório; oito portas próprias
  fechadas e zero cookies. SHA-256 do handoff canônico idêntico ao checkpoint.

### Estado da API legada

Legado: 149 rotas/193 métodos e 46 páginas. Serviço: 59 rotas/84 métodos (41
GETs e 43 mutações), sem endpoint extra. Restam 109 métodos por contagem. Os
43,5% montados não medem esforço ou conclusão geral. Web/mobile mantêm zero
handlers de backend. Clientes/jobs continuam na origem legada configurada. Sem
cutover, commit, push, deploy ou produção. Handoff canônico preservado.

### Dívida/risco restante

Documentos privados de locação, contratos/storage, emissão e reconciliação
externa, demais consultas financeiras, callbacks, webhooks, crons e outbox
permanecem pendentes. Estes GETs não assumem scheduler/gateway. A raiz app ainda
não pode ser retirada. O truncamento do ofício continua histórico; alterá-lo
exige um lote funcional/visual próprio.

### Próximo corte recomendado naquela onda

Consultas administrativas financeiras (aging, calendar, entries, export, revenue
e settings), extraindo suas consultas para billing e separando leitura de
emissão/alteração no gateway. Caracterizar envelopes, centavos, permissões,
tenant e falhas; compor o backend existente em bloco e validar ao final. Manter
legado e URLs de clientes até paridade e migração operacional.

## Onda 38 — consultas financeiras compartilhadas (2026-10-02, sem commit)

### O que foi implementado

Seis GETs montados no serviço: aging, calendar, entries, export, revenue e
settings. Consultas, filtros e agregações em backend/billing; PDF, XLSX e CSV em
backend/documents. Hosts compõem a transação e adaptam autorização/HTTP, sem SQL
ou regras financeiras duplicadas.

O handler de exportação de aproximadamente 1.600 linhas foi separado em consulta
e três geradores. ExcelJS 4.4.0, já instalado, declarado no backend; o serviço o
externaliza e sua trace contém 176 arquivos de ExcelJS e 14 fontes AFM do
PDFKit. Não houve instalação ou mudança de versão.

### Arquivos criados/modificados

- backend/billing: financial-scope, financial-rates, financial-aging,
  financial-calendar, financial-entries, financial-revenue, financial-settings,
  financial-export, financial-report-types e index explícito.
- backend/documents: financial-report-pdf, financial-report-xlsx,
  financial-report-csv e index explícito.
- lib/financial-read (caminho antigo) e service/host/financial-read compõem as
  mesmas factories; os seis adapters legados e os seis novos adapters fazem
  autorização e resposta.
- lib/financial-scope (caminho antigo) mantém somente o builder ainda consumido
  por dashboard. Fachadas sem consumidores lib/financial, (caminho antigo)
  lib/tax-engine (caminho antigo) e lib/financial-customers (caminho antigo)
  retiradas; customers-http importa o módulo real. Nenhuma rota legada foi
  removida.
- design-tokens/documents e teste: cores originais do calendário, paletas dos
  relatórios, margens e fontes em pontos, com valores anteriores preservados.
- Manifest do backend, lockfile, configuração do serviço, testes
  financial-read-api e financial-read.http. Baselines só diminuíram: higiene 922
  → 907 achados, 263 → 259 entradas; tokens color-literal 176 → 158, sem novo
  caminho ou tolerância.

### Contratos preservados

FINANCIAL/READ, seleção explícita, revogação corrente, FORCE RLS e perfil da
locadora, sem fallback para dados globais do usuário. Scope BOLETO,
RENTAL/DEPOSIT, vínculo orçamento/locação, ordenação, paginação, busca,
normalização de status/datas e snapshots fiscais mantidos.

Calendar conserva start/end, cores e paidAt com fallback de vencimento; revenue
conserva paidAt, doze meses e PAID como padrão; aging conserva faixas, devedores
e seu atalho para status quitado. Defaults de settings não gravam registros. CSV
preserva BOM, separador, aspas, valores e datas; PDF/XLSX preservam dados,
textos, abas, estilos e impressão. Headers e nomes de download iguais.
HEAD/OPTIONS preservados para métodos já instalados; OPTIONS de settings no
legado também anuncia PATCH, que ainda não existe no serviço.

Comparação estrutural com captura anterior: corpos das cinco consultas JSON
iguais, descontadas somente entrada de query, JSON HTTP e referências de cores;
loadExportData e os quatro builders/parsers iguais; corpo do PATCH legado de
settings inalterado. Relatório de 45 linhas com relógio fixo: PDF de 6.546 bytes
e CSV de 6.130 bytes iguais byte a byte; modelo real das quatro abas XLSX
idêntico, incluindo estilos e impressão. Captura/sondas em TEMP, sem cópia
permanente de implementação nos testes.

### Testes executados e resultados

- Unitários iniciais: 38/42; quatro expectativas novas procuravam os filtros
  fora do AND existente. Ajustadas à estrutura original; rechecagem de
  financial-read-api + customers-http: 93/93. financial-tenancy: 8/8 na primeira
  execução, incluindo mutações legadas e suas invariantes.
- HTTP produção inicial interrompido no setup: o fixture supunha perfil
  pré-existente. Corrigido para criar seu próprio perfil; 76/79 depois, com três
  expectativas de contrato incorretas (categoryName e precisão RGB). Sem mudança
  de comportamento para satisfazê-las.
- HTTP final: 79/79 no modo legacy e 79/79 no modo better-auth, confirmados
  pelos logs dos motores reais. Sessão, seleção, revogação, READ, dados,
  impostos, filtros, fallback de locação, CSV/PDF/XLSX reais, HEAD/OPTIONS,
  falhas SQL com restauração do grant e ausência de escrita.
- Segurança: 670 passaram, 18 pulados pré-existentes; identidade: 134/134;
  gates: 183/183; tokens impressos: 4/4.
- Typecheck de backend, serviço, raiz e dos dois testes novos; builds do serviço
  standalone e legado; lint, arch, tokens, higiene e nomes. Provas focadas
  corrigidas foram reexecutadas, sem repetir suítes completas a cada ajuste.
  Warning antigo do pg sobre consultas concorrentes mantido.

Auditoria final: 114 declarações de dependência conferidas com lockfile; traces
de exportação com 1.191/532 arquivos no serviço/legado, nenhum ausente. Banco
local vazio de dados de negócio e sem roles/gatilhos de falha; 203 resíduos dos
limitadores de teste retirados após essa prova. Dez portas HTTP próprias e
PostgreSQL próprio encerrados; nenhum cookie remanescente. Sondas/logs só em
TEMP; nenhuma .pnpm-store criada no workspace. Docs/Markdown/índices e diff
check passaram.

### Estado da API legada

149 rotas/193 métodos/90 GETs e 46 páginas continuam ativos. Serviço parcial: 65
rotas/90 métodos, 47 GETs e 43 mutações; zero páginas e zero métodos extras. 103
métodos declarados ainda não foram transferidos. Clientes web/mobile mantêm zero
handlers backend e seguem consumindo a origem legada configurada. Handoff
canônico intacto; sem commit, push, deploy, cutover ou migração em produção.
Somente PostgreSQL descartável local foi usado.

### Dívida/risco restante

PATCH de settings, baixa/vencimento/exclusão, emissão/cancelamento externo,
consumidores e scheduler ainda legados. A decisão desse corte foi manter a
antiga raiz app/ e a origem então configurada.

Compatibilidade preserva uma inconsistência anterior demonstrada no fixture: o
agregado usa SUM(grossAmount) ou SUM(amount) para a coluna inteira; quando há
valores parcialmente nulos, o total diverge da soma dos valores exibidos por
linha. CSV conserva entradas começando com = sem neutralização. Ambos precisam
de correção própria e provas de comportamento, não foram escondidos por gate ou
alterados silenciosamente nesta extração (entrada 238).

### Próximo corte recomendado naquela onda

Transferir o bloco de mutações financeiras e contratos de settings/status/
vencimento, mantendo outbox, idempotência, provas do provedor e histórico.
Resolver a inconsistência de agregação e a saída CSV em uma correção explícita
com os mesmos dados de caracterização. Emissão e jobs exigem paridade de efeitos
e operação antes de qualquer cutover.

## Onda 39 — mutações financeiras compartilhadas (2026-10-02, sem commit)

### O que foi implementado

Quatro métodos compostos no serviço: PATCH de settings, PATCH de status e de
due-date de entries/[id], e DELETE de entries/[id]. Os adapters legados
continuam ativos e usam as mesmas factories de billing. A implementação de
confirmação e de pedido/consumo da reemissão foi movida para packages/backend;
lib conserva somente a composição com transações e credenciais existentes. O
worker ainda é executado pelos jobs legados.

### Arquivos criados/modificados

- packages/contracts/src/financial.ts e manifest: os três schemas existentes de
  settings, status e vencimento, sem mudança de validação.
- backend/billing: financial-mutations, payment-errors, payment-processor,
  boleto-reissue e index explícito. PaymentRequestError tem uma única definição;
  lib/payment-obligation (caminho antigo) reexporta a mesma classe.
- lib/financial-mutations, (caminho antigo) lib/payment-processor, (caminho
  antigo) lib/payment-reissue (caminho antigo) e
  service/host/financial-mutations compõem as dependências. Quatro adapters em
  cada host, sem SQL ou regra financeira duplicada no serviço.
- Testes financial-mutations-api, financial-mutations.http e grants mínimos de
  seu runtime temporário. Inventário de autorização acompanha a localização real
  da classe e verifica que a fachada mantém sua identidade e não admite
  Symbol.hasInstance malicioso; nenhuma permissão ou exceção foi ampliada.
- Testes de cancelamento e contrato Asaas importam a implementação que testam;
  exports públicos sem consumo produtivo foram retirados. Transferência do
  entrypoint puro contracts/financial registrada em ratchet-transfers; baselines
  e proteções inalterados neste bloco.

### Contratos preservados

FINANCIAL/WRITE ou DELETE, seleção explícita, vínculo/permissão correntes, CSRF
central, FORCE RLS e ownership por locadora. Settings continua append-only, com
autoria do principal e parse dentro da transação original, mesmos campos,
defaults, DTO e erros. Nenhum tenantId ou updatedBy fornecido pelo corpo é
usado.

Status conserva transições fechadas, invoiceNumber, datas e distinção entre
SETTLED e confirmação no gateway. PAID atualiza a tentativa, aprova o orçamento
e grava uma única conversão durável sob o mesmo lock/transação. Falha na outbox
desfaz a confirmação. CANCELLED/REFUNDED/PAID não podem ser reabertos, e OVERDUE
exige reemissão antes de AWAITING_PAYMENT.

Vencimento conserva o dia civil UTC, normaliza para 12:00Z e retorna 202 com
operationId. Exige boleto/tentativa/integração da locadora e grava um pedido
idempotente na outbox; não muda a data emitida nem chama o provedor no handler.
O worker só substitui após confirmação do cancelamento externo. Pedido com data
contraditória ou evento falho continua recusado. DELETE conserva 404 para item
ausente/estrangeiro e 409 FINANCIAL_HISTORY_PRESERVED para o existente, sem
apagar pagamento ou tentativa. Headers, mensagens e OPTIONS preservados.

Comparação semântica AST com capturas anteriores: seis corpos de funções, três
schemas, transação de status e criação/DTO de settings iguais. Sondas em TEMP,
sem cópia permanente de implementação nos testes.

### Testes executados e resultados

- Unidade financeira: 28/28 após preservar a ordem do parse de settings;
  cancelamento: 11/11; leituras financeiras existentes: 34/34.
- Banco descartável: 66/66 em financial-tenancy, billing-database,
  rental-concurrency e quote-settlement-database; contrato Asaas fake: 106/106.
  Nenhuma emissão real ou credencial externa usada.
- HTTP inicial: 70/82, com 12 falhas porque o papel temporário não possuía
  INSERT em financial_settings, UPDATE em payment_attempts ou SELECT em
  tenant_integrations. Grants mínimos de teste corrigidos sem BYPASSRLS ou
  mudança de política. Paridade passou nos dois motores reais.
- HTTP final em produção local: 82/82 no modo legacy, seguido de 2/2 casos novos
  de falha SQL (82 demais intencionalmente não repetidos); 84/84 em better-auth.
  Sessão, seleção, revogação, CSRF, FORCE RLS, concorrência entre hosts, outbox
  única e rollback de confirmação/reemissão comprovados. Grants de falha
  restaurados em finally.
- Segurança: 668 passaram e dois falharam na referência antiga da classe; após
  corrigir sua localização e os controles selados, inventário 69/69. Os outros
  26 arquivos já passaram; 18 skips anteriores não foram alterados.
- Gates 183/183; types de contracts/backend/serviço/raiz e dos testes novos;
  builds finais do serviço standalone e do legado aprovados. Arch, tokens,
  higiene, nomes e ratchet passaram. Higiene continua 907 achados aceitos em 259
  entradas; css-important zero. Warning anterior do pg mantido.

Fechamento: lint final, Prettier, Markdown, índices de docs e diff check
aprovados. Auditoria do banco local: 45 tabelas (42 de negócio, duas de rate
limit e migrations), zero dados de negócio, 19 migrations concluídas, 31 tabelas
do inventário com FORCE RLS, zero papéis temporários/gatilhos de falha. O
trigger produtivo de imutabilidade de contratos foi preservado. Um resíduo
efêmero do limitador foi limpo somente após confirmar o banco próprio vazio.
Doze portas HTTP próprias fechadas e zero cookies; PostgreSQL encerrado após
conferir PID/diretório/porta. Sondas e logs em TEMP; handoff canônico
preservado.

### Estado da API legada

149 rotas/193 métodos/90 GETs e 46 páginas preservados. Serviço parcial: 68
rotas/94 métodos, 47 GETs e 47 mutações; zero páginas e zero métodos extras.
Restam 99 métodos declarados por contagem. Os 48,7% montados não medem esforço
ou conclusão geral. Web/mobile continuam sem handlers de backend e na origem
legada configurada. Sem cutover, commit, push, deploy ou alteração de produção.

### Dívida/risco restante

Emissão, cancelamento externo, callbacks, webhooks, consumidores e scheduler
ainda dependem da composição legada. app/ (caminho antigo) não pode ser
retirado. Entrada 238 (agregado parcialmente nulo e CSV com prefixo de fórmula)
permanece pendente, sem mudança funcional nesta extração. A UI de exclusão ainda
promete apagar permanentemente, embora o contrato da API preserve o histórico
com 409; o desalinhamento anterior exige um lote de produto específico.

### Próximo corte recomendado naquela onda

Compartilhar a composição da obrigação/pedido de pagamento e montar seus
handlers de solicitação, preservando centavos, tentativas, idempotência e prova
do provedor. Manter emissão durável e jobs na origem operacional existente até
paridade de efeitos e execução; tratar a entrada 238 em correção explícita.

## Onda 40 — pedidos de PIX/boleto e documento do provedor (2026-10-02, sem commit)

### O que foi implementado

Cinco métodos montados no serviço: POST payments/pix, POST
payments/boleto/generate, PUT payments/boleto/[id]/regenerate, POST
admin/quotes/[id]/generate-boleto e GET payments/boleto/[id]/pdf. As rotas
legadas continuam operacionais. Os dois hosts compõem as mesmas factories de
billing/quotations; o serviço não contém SQL nem regras de cobrança duplicadas.

Obrigação, pedido, consulta ao provedor, emissão e reconciliação foram extraídos
de lib para backend/billing com dependências injetadas. O resolver de
referências env por locadora pertence a backend/runtime. A execução de emissão e
reconciliação continua nos consumidores/crons legados; nenhum job foi montado ou
agendado no serviço.

### Arquivos criados/modificados

- packages/backend/src/modules/billing: payment-obligation, payment-request,
  payment-issuance, payment-document e index explícito. PaymentRequestError
  conserva sua única definição compartilhada.
- packages/backend/src/runtime/integration-credentials.ts, seu teste e index:
  referência env existente e leitura a cada chamada, inclusive rotação.
- packages/contracts/src/payments.ts, manifest e ratchet-transfers: schema de
  pedido já existente, consumido pelos dois adapters. Sem dependência nova ou
  tolerância adicional.
- lib/payment-obligation, (caminho antigo) payment-request, payment-issuance,
  payment-documents e security/tenant-webhook: composição das dependências reais
  existentes. Autenticação e consumidores de webhook permanecem legados.
- apps/services/api/src/host/payments e os cinco adapters correspondentes em
  src/app/api. No legado, PIX/boleto usam o contrato comum e PDF delega a
  leitura compartilhada; geração/regeneração permanecem com seus contratos
  anteriores.
- tests/api-host/payment-requests.http.test.ts e global-setup: fixture real,
  INSERT mínimo em payment_attempts e acesso externo desabilitado. Testes de
  criação/obrigação e imports dos testes de emissão, cancelamento, outbox e
  contrato Asaas acompanham a implementação autoritativa.
- Inventário de autorização reconhece o guard existente somente no caminho exato
  de regeneração, com controles negativos para outro caminho e resultado não
  verificado. Exports públicos sem consumidor produtivo retirados; nenhum teste,
  baseline ou proteção foi removido ou afrouxado.

### Contratos preservados

Sessão real, seleção explícita, vínculo/permissões revalidados, CSRF central,
ownership por usuário/locadora e FORCE RLS. Geração administrativa e regeneração
continuam exigindo FINANCIAL/WRITE; consulta de PDF mantém ownership ou
permissão financeira de leitura. Mesmo tenantId fornecido no corpo não decide o
escopo.

Pedido mantém referências, valor positivo/finito, datas ISO e descarte de extras
do schema anterior. Obrigação e titular persistidos são autoritativos; centavos,
saldo, status, método concorrente, tentativas e lock mantidos. Pagamento,
tentativa e evento são gravados atomicamente. Repetição/concorrência nos dois
hosts conservam uma cobrança, uma tentativa e um evento. Cancelamento local
continua insuficiente sem a prova de término no provedor.

Envelope de pedido conserva 202/PENDING ou 200/ISSUED, DTO, pixCode/boletoCode,
mensagens e erros. Nenhum código ou PDF fictício é produzido. Documento não
disponível conserva 409/PENDING; URL inválida ou insegura conserva 409. A URL
aceita permanece https em asaas.com ou subdomínio, sem credenciais; resposta 302
private, no-store. O handler redireciona, sem buscar o conteúdo do provedor.
OPTIONS e métodos declarados mantidos.

Comparação AST com capturas anteriores: nove corpos de funções e os dois schemas
iguais, descontada formatação. Inclui requestPayment, obrigação, consulta ao
provedor, emissão, reconciliação e abertura de rodada. Sondas em TEMP, sem cópia
permanente de implementação nos testes.

### Testes executados e resultados

- Primeiro bloco de unidade/banco: 144/144 em sete arquivos. Após ajustar os
  imports dos exports sem uso e consolidar cancelamento/prova do provedor:
  172/172 em nove arquivos. Contrato Asaas fake: 106/106; credenciais: 9/9.
- HTTP produção local: 87/87 com NextAuth legado; depois 2/2 casos novos de
  ownership/RLS do PDF, com os 87 demais excluídos intencionalmente pelo filtro.
  Better Auth final: 89/89. Sessões emitidas pelo legado, revogação, seleção,
  permissão, CSRF, RLS, outbox única e rollback comprovados. Nenhuma chamada ao
  Asaas real; o bloqueio externo é explícito no ambiente dos servidores de
  teste.
- Segurança inicial: 669 passaram, uma falhou e 18 skips anteriores
  permaneceram. O inventário ainda não reconhecia o guard compartilhado na
  regeneração. Registro restrito ao caminho exato e controles sintéticos
  corrigidos; rechecagem final do inventário: 70/70. Um caso novo de PDF
  inicialmente ficou fora do describe por host; typecheck detectou o erro,
  corrigido antes do HTTP.
- Gates: 183/183. Types da raiz, contracts, backend, serviço e testes afetados;
  builds finais do serviço standalone e legado; lint direto pelo binário Node,
  arch, tokens, nomes, higiene e ratchet passaram. O launcher pnpm exec eslint
  não encontrou o comando; o binário instalado executou sem erros. Aviso antigo
  de consultas concorrentes do pg permanece.

Validação consolidada ao final da onda; rechecagens restritas ao que mudou ou
falhou. Não houve execução de todos os testes a cada adapter.

Auditoria final do banco descartável: 45 tabelas, 42 de negócio sem dados, 19
migrations, 31 tabelas com FORCE RLS e nenhuma role temporária ou gatilho de
falha. Trigger de imutabilidade dos contratos preservado. Um resíduo do
limitador de auth foi retirado após comprovar ausência de dados de negócio;
releitura confirmou banco limpo. Seis portas HTTP próprias e PostgreSQL próprio
encerrados, sem cookie remanescente. Logs/sondas somente em TEMP. Handoff
canônico preservado.

### Estado da API legada

149 rotas/193 métodos/90 GETs e 46 páginas permanecem. Serviço parcial: 73
rotas/99 métodos, 48 GETs e 51 mutações; zero páginas, zero métodos extras e
zero handlers backend nos clientes web/mobile. Restam 94 métodos declarados. Os
51,3% montados são contagem de métodos, não estimativa de esforço ou conclusão
geral. Clientes e scheduler continuam na origem legada configurada. Handoff
canônico intacto; sem cutover, commit, push, deploy ou produção.

### Dívida/risco restante

Execução operacional dos jobs, verificação externa, callbacks, webhooks e
consumidores ainda exigem extração/paridade própria. A composição legada não
pode ser desativada. Asaas real/sandbox e efeitos de rede não são certificados
pelas provas HTTP locais: elas mantêm saída externa bloqueada e usam o contrato
fake para as falhas do provedor. Entrada 238 e demais lotes SaaS/mobile
continuam pendentes; a contagem de métodos não certifica a modernização inteira.

### Próximo corte recomendado naquela onda

Extrair o bloco de verificação e recepção durável de eventos de pagamento,
preservando autenticação do webhook, assinatura, tenant, inbox, deduplicação,
transições e confirmação pela outbox. Manter consumidores e scheduler na
autoridade operacional existente até provar execução e efeitos, sem agendar
workers concorrentes durante a migração.

## Onda 41 — verificação de boleto e webhooks de pagamento (2026-10-02, sem commit)

### O que foi implementado

Cinco POSTs acrescentados ao host compartilhado: payments/boleto/verify,
payments/pix/webhook, payments/pix/webhook/[integrationId],
payments/boleto/webhook e payments/boleto/webhook/[integrationId]. Os dois
caminhos sem integrationId continuam respostas fixas 410, sem acesso a dados.
Nenhuma origem de cliente, proxy de produção ou agendamento foi alterado.

Factories de identidade recebem Prisma lazy e resolver de credenciais; a inbox
recebe transação de tenant e consumidores lazy; billing recebe transações,
processador, lookup do recurso e conversor de orçamento. Hosts fazem somente a
composição e os adapters HTTP. O worker compartilhado é chamado apenas pela
composição operacional legada, inclusive para ZapSign/WhatsApp ainda legados.
Não existe segundo scheduler no serviço.

### Arquivos criados/modificados

- packages/backend/src/modules/identity: webhook-auth, tenant-webhook e index.
  lib/security/external-request-auth (caminho antigo) e tenant-webhook
  compõem/reexportam somente o que tem consumidor produtivo. Autorização dos
  crons preservada.
- packages/backend/src/modules/outbox/webhook-inbox e index; a fachada
  lib/security/webhook-inbox (caminho antigo) conserva a seleção lazy dos quatro
  consumidores.
- packages/backend/src/modules/billing: pix-webhook, boleto-webhook,
  boleto-verification e index; as fachadas correspondentes em lib/security
  (caminho antigo) delegam com suas dependências reais. Parser/leitor Asaas
  seguem internos ao módulo; a fachada lib/payment-gateways/asaas, (caminho
  antigo) que só reexportava funções sem consumidor produtivo, saiu. Nenhum
  endpoint legado saiu.
- packages/contracts/src/payments: schemas existentes de verificação e dos dois
  eventos movidos, sem alterar validações, parsing de datas ou extras.
- apps/services/api/src/host: webhook-authentication e payment-webhooks;
  quotations expõe o conversor existente; tenant-transaction passa as opções
  originais de timeout/maxWait. Cinco adapters novos e verify legado adaptado.
- Testes colocados de webhook-auth, boleto-verification e webhook-inbox;
  tests/api-host/payment-webhooks.http.test.ts e global-setup; imports de
  external-endpoints, leitor e contrato Asaas acompanham a implementação.
- route-auth-inventory reconhece FINANCIAL/WRITE no caminho exato de verify e
  autenticação somente nos dois caminhos com integrationId. Respostas 410 usam a
  invariável inerte existente. O self-check verifica a factory, Prisma real,
  credenciais e encaminhamento dos três argumentos; mutações sintéticas que
  trocam essas dependências falham.
- tools/hygiene-baseline.json só encolheu: retiradas duas tolerâncias obsoletas
  de mapAsaasStatus, após remover os exports de fachada sem uso. Nenhuma
  baseline, exclusão de teste ou proteção foi ampliada.

### Contratos preservados

Verificação conserva FINANCIAL/WRITE, sessão, seleção, CSRF e FORCE RLS; busca
payment pelo tenant e método BOLETO. Sem referência externa: 202/PENDING. Valor
divergente: 409 antes dos efeitos. Cancelamento confirma a tentativa sem apagar
ou cancelar automaticamente a obrigação. PAID usa o processador e conversor
existentes; falhas continuam 503 no adapter. Consulta externa usa registro
ASAAS/tenant/recurso/referência e credenciais explícitas, mantendo a transação
com timeout 5000 e maxWait 3000.

Webhook deriva tenant somente da integração ACTIVE e de sua organização ACTIVE.
Assinatura HMAC e hash usam o texto bruto recebido; limite de 2 MiB, prefixos,
comparação de segredo e os três headers Asaas originais mantidos. Sem URL de
integração: 410; configuração ausente: 503; assinatura inválida: 401; JSON
inválido: 400; excesso: 413. O tenant extra no payload não autoriza acesso.

Inbox e evento webhook.process são gravados na mesma transação antes do efeito.
Reuso de id com outro hash responde 409. Duplicata processada: 200; lease já
ocupado: 202. Claim conserva 120 segundos e token aleatório, com liberação
condicionada ao token. Consumidor 400/403 é terminal; demais falhas permanecem
retryable. A política existente de PermanentDeliveryError para integração ou
organização desativada continua; sua revisão SaaS é dívida separada.

PIX/Asaas mantêm as transições, confronto do valor, lookup por integração e
registro de recurso. PAYMENT_DELETED confirma cancelamento da tentativa sem
remover a obrigação. Pagamento de tentativa antiga gera conciliação, sem quitar
a obrigação corrente. Refund preserva histórico. Comparação estrutural AST de 12
corpos com capturas anteriores passou, normalizando somente
NextResponse/Response e a injeção de Prisma, leitor e principal prevista no
corte. As sondas ficam em TEMP; não há implementação clonada nos testes.

### Testes executados e resultados

- Backend colocado: webhook-auth 13, boleto-verification 16 e retry worker 7:
  36/36. Unidade/banco de emissão, cancelamento e outbox: 114/114; leitor e
  quitação: 32/32; cron de verificação e processador: 4/4. Total desse grupo
  unidade/banco/cron: 150/150. Contrato Asaas fake: 106/106.
- HTTP real em builds locais de produção: 65/65 Better Auth e 65/65 NextAuth
  legado. Assinatura/token, integração indisponível, tenant errado, dedupe,
  identidade conflitante, refund/cancelamento, obrigação antiga, CSRF,
  FINANCIAL/WRITE, JSON/limite e OPTIONS cobertos. REVOKE temporário comprova
  rollback inbox/outbox e redelivery após falha do consumidor. Oito entregas
  simultâneas entre hosts conservam uma inbox e uma outbox. Asaas externo fica
  explicitamente desabilitado; não foi chamado o provedor real.
- Segurança consolidada: 673 passaram, 18 skips anteriores. Após a limpeza de
  imports, rechecagem somente de external-endpoints/inventário: 165/165; o
  inventário tem 72 casos. Gates: 183/183.
- Fixture nova teve chamada de login e campos de PaymentAttempt incorretos nas
  primeiras rodadas; corrigidos conforme a API real da fixture e o schema, antes
  da execução HTTP final. Nenhuma asserção de negócio foi afrouxada.
- Types configurados da raiz, contracts, backend e serviço, mais a fixture HTTP;
  builds do standalone e legado, lint focado, arch, tokens, nomes, higiene,
  ratchet, Markdown e links aprovados. Higiene: 905 achados aceitos/258 itens,
  abaixo dos 907/259 anteriores; css-important continua zero. Build legado usa
  URL local inacessível para impedir conexão produtiva; o warning do sitemap
  nesse ambiente não certifica sua execução com banco.

Validação consolidada ao fim do bloco; repetição apenas de checks afetados ou
que falharam. Banco descartável: 45 tabelas, 42 de negócio vazias, 19
migrations, 31 FORCE RLS, zero roles temporárias e zero triggers próprios de
falha. Um contador de auth retirado somente após comprovar banco de negócio
vazio. Logs, sondas e cookies somente em TEMP; recursos próprios conferidos e
encerrados. Handoff canônico intacto.

### Estado da API legada

149 rotas/193 métodos/90 GETs e 46 páginas preservados. Serviço parcial: 78
rotas/104 métodos, 48 GETs e 56 mutações; nenhum método extra e nenhum handler
backend nos clientes. Restam 89 métodos declarados. Os 53,9% da contagem não
representam percentual de esforço, paridade total ou conclusão geral. API legada
e scheduler continuam ativos; sem commit, push, deploy, cutover ou alteração em
produção.

### Dívida/risco restante

Recepção local e implementação compartilhada estão provadas para este bloco;
execução operacional no provedor real e migração de crons ainda não. Credenciais
permanecem no resolver env estabelecido, sem antecipar o vault SaaS. Política de
organização suspensa, entrypoints de identidade, demais integrações e contratos
continuam exigindo cortes próprios. Entrada 238 e lotes SaaS/mobile pendentes
não foram alterados. A decisão desse corte foi manter a antiga raiz app/:
contagens e builds não provavam cutover.

### Próximo corte recomendado naquela onda

Extrair geração, assinatura e documentos de contrato com a recepção durável
ZapSign, reutilizando a identidade/inbox já compartilhadas. Caracterizar
ownership, assinatura, efeito idempotente e callbacks; manter integração real e
scheduler sob a autoridade operacional existente até a prova e cutover próprios.

## Onda 42 — contratos e callback ZapSign (2026-10-02, sem commit)

### O que foi implementado

Sete métodos em seis arquivos de rota do serviço: geração, pedido de assinatura,
download por locação, GET/POST do contrato administrativo e callback ZapSign
com/sem integrationId. A URL antiga sem integração conserva 410. As regras
existentes foram movidas para factories compartilhadas de documentos; hosts
fazem somente composição e adapters. Efeitos de assinatura, reconciliação e
arquivo permanecem nos jobs legados, sem scheduler concorrente.

### Arquivos criados/modificados

- packages/backend/src/modules/documents: rental-contracts, contract-rendering,
  private-documents, zapsign-webhook e index; packages/backend/src/http:
  contract-download e index; packages/backend/src/runtime: document-storage e
  index. SDK Supabase e sharp já instalados foram declarados no manifest do
  backend/lockfile, nas mesmas versões existentes; não houve upgrade.
- packages/contracts/src/rental-contracts e export explícito; tokens impressos
  em packages/design-tokens/src/documents. Transferência do entrypoint contracts
  registrada na catraca, sem tolerância de violação.
- apps/services/api/src/host/contracts e payment-webhooks; seis adapters novos
  nos caminhos correspondentes a app/api/contracts (caminho antigo) e
  admin/rentals/[id]/contract.
- lib/contracts/service, (caminho antigo) lib/security/private-documents,
  (caminho antigo) lib/security/webhook-consumers/zapsign (caminho antigo) e
  lib/supabase-admin (caminho antigo) conservam composição/fachadas.
  Generate/sign legados usam schemas compartilhados; download delega ao adapter
  comum. Renderer legado sem consumidor produtivo retirado; nenhum handler
  legado removido.
- tests/api-host/rental-contracts.http.test, private-storage e global-setup;
  documents-contracts acompanha o renderer canônico. Inventário de autorização
  reconhece somente os caminhos exatos do webhook, a resposta inerte 410 e o
  predicado real movido; testa os dois hosts contra substituições por
  true/CLIENT.
- Documentação de contratos corrigida: já existiam DRAFT/default,
  ADMIN/OPERATOR, assinatura e storage privados, apesar do texto antigo. ADR,
  modernização, overview, contexto, índice e changelog atualizados.
- tools/token-baseline.json apenas encolheu a ocorrência resolvida do renderer
  antigo: color-literal de 158 para 157. Cores e HTML conservados por tokens.
  Arch/higiene, filtros e proteções de testes não ampliados.

### Contratos preservados

ADMIN/OPERATOR geram; CLIENT lê/solicita somente o próprio contrato da locadora.
FINANCIAL não recebe esse acesso. Geração cria DRAFT/default ou atualiza apenas
rascunho sem tentativa de assinatura; demais estados/tentativas respondem 409.
Perfil do tenant e Organization continuam fontes dos dados. Lock consultivo,
vínculos compostos, FORCE RLS, cláusulas/escape, datas e valores originais
mantidos.

Pedido de assinatura exige DRAFT com conteúdo, integração única ACTIVE de
organização ACTIVE e credencial com ambiente explícito. Tentativa/outbox são
atômicas; QUEUED reutiliza requestId e as demais tentativas exigem
reconciliação. Oito pedidos simultâneos distribuídos entre hosts conservam uma
tentativa e um evento. Nenhuma chamada ZapSign é feita pelo pedido HTTP.

Callback conserva body bruto/autenticação, inbox, dedupe e lookup por
integração, tenant, recurso e zapSignId. SIGNED atualiza somente DRAFT/SENT e
pede archive na mesma transação. Datas inválidas e pdf_url HTTP são recusadas;
pdf_url externa não é autoridade para baixar o documento. signedBy mantém o
fallback existente. Política de organização suspensa não alterada.

Download conserva HTML attachment com CSP sandbox/default-src none, style-src
unsafe-inline, nosniff e private, no-store. Assinado exige ClientDocument
correspondente e path privado do tenant/cliente. Sem arquivo: 409; SDK sem URL:
502; URL assinada: 303 privado/TTL 300. Bucket deve ser explicitamente privado.
SDK server-side conserva opções de sessão e nomes das variáveis; leitura runtime
por função evita inlining de env público no build.

Comparação estrutural AST de 12 corpos com capturas antes da mudança passou,
normalizando comentários, formatação, vírgulas finais, NextResponse/Response e
interpolação dos tokens com os mesmos valores. Sondas somente em TEMP; sem
clonar regras nos testes.

### Testes executados e resultados

- HTTP em builds locais de produção: 53/53 Better Auth e 53/53 NextAuth legado.
  Sessões reais, roles, CSRF, ownership, imutabilidade, dedupe, payload
  inválido, callback, transações e corrida entre hosts. REVOKE temporário
  comprova rollback de outbox/tentativa e recuperação. Storage local é chamado
  pelo SDK real, comprovando path/TTL/attachment e falha sem URL; não encaminha
  tráfego externo.
- Backend colocado: private-documents 10, webhook-auth 13, webhook-inbox 7:
  30/30. Invariantes SQL de contratos: 10/10. Outbox/cron: 6/6, com os efeitos
  legados preservados.
- Segurança consolidada: 673 casos existentes passaram e 18 skips anteriores. A
  primeira rodada detectou erro de escopo no novo self-check do inventário;
  corrigido somente o helper do teste. Inventário final 73/73, incluindo esse
  self-check; documents-contracts/external-endpoints já aprovados na rodada
  consolidada. Gates: 183/183. Nenhuma asserção de negócio afrouxada.
- Types configurados da raiz, contracts, backend, serviço e fixture HTTP, builds
  do serviço e legado, lint focado, arch, tokens, nomes, higiene, ratchet,
  Markdown e links conferidos. Validação consolidada ao fim da onda; rechecagens
  somente dos itens alterados ou que falharam. css-important zero.

Fixtures HTTP usam role temporária sem LOGIN/BYPASSRLS. Teardown de contratos
assinados usa bypass de triggers exclusivamente na conexão administrativa de
limpeza do banco descartável; não muda as conexões dos hosts nem a prova
separada de imutabilidade. Banco local auditado ao final; recursos próprios
encerrados, capturas/logs/cookies somente em TEMP. Handoff canônico intacto.

Auditoria final: 45 tabelas, 42 de negócio vazias, 19 migrations, 31 FORCE RLS,
zero roles temporárias e zero triggers próprios de falha. Contador de auth
retirado somente após comprovar negócio vazio. Higiene 905 achados aceitos/258
itens, sem aumento. PostgreSQL próprio desligado após conferir PID/data
dir/porta; portas HTTP próprias fechadas e cookies de fixture removidos. Nenhum
recurso externo ou servidor de outra sessão foi encerrado.

### Estado da API legada

149 rotas/193 métodos/90 GETs e 46 páginas preservados. Serviço parcial: 84
rotas/111 métodos, 50 GETs e 61 mutações; zero métodos extras e zero handlers
backend nos clientes. Restam 82 métodos declarados. Os 57,5% dessa contagem não
representam esforço, paridade geral ou conclusão da modernização. Legado, origem
dos clientes e scheduler continuam ativos, sem cutover, commit, push, deploy ou
produção.

### Dívida/risco restante

Efeitos de assinatura, reconciliação/arquivo, adapter ZapSign, uploads e demais
integrações/jobs precisam de seus cortes. ZapSign/Supabase reais e migração
operacional não certificados por testes locais; a decisão daquele corte era
manter a antiga raiz app/: contagens não bastavam. Texto jurídico, política de
organização suspensa, entrada 238 e lotes SaaS/mobile pendentes não foram
modificados nesta extração.

### Próximo corte recomendado naquela onda

Mover efeitos de assinatura/arquivo e adapter ZapSign para factories do backend,
mantendo idempotência, reconciliação, credenciais e storage privado. Provar
efeitos/falhas com fixtures próprias; depois montar uploads/documentos em corte
separado. Um único scheduler continua responsável até a paridade e autorização
de cutover operacional.

## Onda 43 — assinatura, arquivamento e documentos privados (2026-10-02, sem commit)

### O que foi implementado

Extração de emissão, reconciliação e arquivamento da assinatura e do adapter
ZapSign para backend/documents. A factory recebe transação, credenciais,
provedor e storage; as fachadas legadas preservam a composição e o cron continua
o único executor. Não foi instalado scheduler nem consumidor de recuperação
novo.

O upload operacional foi extraído para backend/http, com o enum existente em
contracts/client-documents e storage injetado. O serviço monta GET
/api/admin/clients/[id]/documents, usando customers existente, e POST
/api/admin/rentals/[id]/client-documents. Contratos e documentos do serviço
compartilham a composição lazy do bucket.

Os seis corpos de efeitos, adapter e corpo do upload foram comparados com o
snapshot anterior: oito provas iguais após normalizar somente formatação,
comentários, await de params e NextResponse para Response no upload. O adapter
do provedor permaneceu byte a byte igual. Mensagens, política de suspensão,
timeouts, limites e dados jurídicos não foram alterados.

### Arquivos criados/modificados

- packages/backend/src/modules/documents/{contract-signature-effects,zapsign}.ts
  e seus testes; index.ts publica só os consumidores produtivos.
- packages/backend/src/http/client-document-upload.ts e http/index.ts.
- packages/contracts/src/client-documents.ts, package.json de contracts e
  transferência exata de entrypoint em tools/ratchet-transfers.json.
- lib/contract-signature-effects.ts, (caminho antigo) lib/zapsign.ts, (caminho
  antigo) lib/client-document-upload.ts (caminho antigo) e
  lib/security/private-documents.ts (caminho antigo): composição/fachadas, com
  reexports sem consumidores retirados.
- app/api/admin/rentals/[id]/client-documents/route.ts (caminho antigo): adapter
  fino ativo.
- apps/services/api/src/host/{client-documents,document-storage,contracts}.ts e
  as duas rotas novas sob src/app/api/admin.
- packages/backend/package.json, package.json e pnpm-lock.yaml: DOMPurify no
  backend na mesma versão instalada, PDFKit e tipos retirados da raiz onde
  ficaram sem consumidor; versões/snapshots dos pacotes preservados, sem
  install.
- tests/api-host/{client-documents.http.test,private-storage,global-setup}.ts e
  tests/security/{route-auth-inventory,documents-contracts.test}.ts.
- tools/hygiene-baseline.json: retirados somente reconcileContractSignature da
  antiga forma de export e TenantTransactionRunner agora consumido; duas
  tolerâncias resolvidas. A disponibilidade da reconciliação na factory não
  significa que um job de recuperação foi instalado.
- Documentação desta API, contratos, documentos antifraude, ADR, modernização,
  overview, mapa de contexto, índice e CHANGELOG.

### Contratos preservados

ADMIN/OPERATOR enviam; CLIENT lista só os próprios documentos da locadora.
FINANCIAL recusado. Principal, seleção explícita, CSRF entre hosts irmãos,
ownership antes do multipart, transação, FORCE RLS e FKs compostas mantidos.

Upload mantém os quatro tipos, validação de bytes/MIME/tamanho, metadata objeto,
nome sanitizado, hash SHA-256, path próprio, bucket public false, upsert false e
compensação de objeto após falha de banco. Sucesso 200 privado sem filePath;
erro do upload 502; falha ao assinar URL mantém registro com signedUrl null. TTL
300 segundos. Listagem ordena por createdAt desc e não assina chave alheia.
Documento manual SIGNED_CONTRACT não altera o Contract nem simula ZapSign.

Emissão reclama QUEUED uma vez; tentativa interrompida ou resposta ambígua vira
UNKNOWN e exige reconciliação, sem nova emissão automática. Credencial vem da
integração/locadora, referência externa deve corresponder à tentativa. PDF usa o
conteúdo sanitizado e o perfil comercial do tenant. Arquivamento conserva a
allowlist HTTPS de S3 ZapSign, recusa credenciais/porta/redirect, timeout e
limite de 10 MiB, validação PDF, chave determinística e comparação de bytes
quando o objeto já existe. Atualização do contrato e registro continuam atômicos
sob escopo de locadora. Reconciliação valida referência/token e solicita arquivo
somente ao confirmar assinatura.

### Testes executados e resultados

- HTTP de documentos novos: 44/44 em Better Auth e 44/44 em NextAuth, ambos
  exercendo legado e serviço com sessões reais, builds de produção locais e
  PostgreSQL/FORCE RLS.
- Regressão HTTP de contratos: 53/53 em ambos os motores. Execução NextAuth
  consolidada: 97/97. Better Auth: 53 casos passaram na execução inicial e os 44
  novos passaram após corrigir a fixture de seleção.
- Backend: 48/48 entre effects, adapter ZapSign e private-documents. Provedor
  externo simulado; PDFKit e DOMPurify reais no caminho de geração.
- Banco/identidade: contracts-database 10/10; outbox-cron-database 6/6, mantendo
  a composição operacional legada.
- Segurança consolidada: 674 passaram e 18 skips anteriores. Os dois novos
  destinos de autorização receberam metadados exatos, sem ampliar roles ou
  aceitar predicado truthy. Rechecagem das suites afetadas: 110/110, incluindo
  inventário 73/73.
- Gates: 183/183. Tipos de contracts, backend, serviço, raiz e fixture, builds
  finais dos dois hosts, lint, arch, tokens, nomes, higiene e ratchet
  conferidos. Markdown, links, formatação e diff conferidos. css-important
  permanece zero.

As falhas iniciais de HTTP (409) vinham do header incorreto x-organization-id na
fixture nova. O contrato existente exige x-tenant-id; a correção ficou só no
teste, sem afrouxar autorização. As falhas do inventário eram ausência dos
metadados dos endpoints novos e foram corrigidas mantendo os testes adversários.

SDK Supabase real conversa exclusivamente com o servidor local da fixture. Falha
de INSERT induzida por REVOKE temporário no role sem BYPASSRLS confirma remoção
do objeto e recuperação após GRANT. Tudo restaurado no finally. Auditados 45
tabelas, 42 de negócio vazias, 19 migrations, 31 FORCE RLS, zero roles
temporárias e zero triggers próprios de falha. Um contador local de auth foi
removido somente após essa comprovação. Logs/capturas ficam em TEMP; cookies e
servidores próprios são limpos. Handoff canônico preservado.

Higiene 903 achados aceitos/257 itens, antes 905/258; proteção não ampliada.
Ratchet usa HEAD local como base explícita e passou com as transferências
autorizadas da extração. Nenhum teste removido, skip novo ou baseline aumentado.

### Estado da API legada

149 rotas/193 métodos/90 GETs e 46 páginas preservados. Serviço parcial: 86
rotas/113 métodos, 51 GETs e 62 mutações; zero métodos extras e zero handlers
backend nos clientes. Restam 80 métodos declarados. Os 58,5% dessa contagem não
medem esforço nem conclusão geral da modernização. Clientes, scheduler e origem
de API permanecem configurados para o legado. Nenhum cutover, commit, push,
deploy ou operação em produção.

### Dívida/risco restante

Supabase e ZapSign reais não certificados por fixtures locais. Reconciliação
UNKNOWN ainda não tem consumidor operacional; ativá-la exige fluxo de
recuperação explícito. Compensação de upload não garante uma transação
distribuída se a remoção no storage também falhar. Demais integrações, login,
jobs e endpoints restantes precisam de extração/paridade; a retirada do app/
(caminho antigo) depende da migração operacional. Política de suspensão, entrada
238 e lotes SaaS/mobile permanecem pendentes, sem alterações nessa onda.

### Próximo corte recomendado naquela onda

Upload público de imagens e endpoints administrativos correlatos, agrupando
validação, transformação e storage no backend com adapters finos. Caracterizar
limites, roles, tenancy, resposta e falhas existentes sem alterar política.
Manter scheduler único e URLs dos clientes até as provas de paridade e
autorização de cutover.

## Onda 44 — imagens e configurações administrativas (2026-10-02, sem commit)

### O que foi implementado

Três métodos instalados: POST /api/upload e GET/PUT /api/admin/settings.
Validação/transformação de imagem movida byte a byte para backend/catalog;
quota/upload em factory backend/http com transação/storage injetados. Settings
usa factory de catalog, preservando projeção pública, segredos, lock, escrita e
invalidação. Host só compõe dependências e adapta HTTP.

Schemas do legado e frontend eram idênticos; agora há uma fonte em
contracts/settings, com fachadas para importadores anteriores. Sem mudança da UI
ou da origem de API dos clientes. A cor padrão usa o primitivo canônico com o
mesmo valor #ea580c.

A checagem mobile identificou TypeScript carregando o backend pela inclusão sem
uso de types/next-auth.d.ts. Retirada somente essa inclusão do tsconfig; tipos,
sessão e composição dos servidores preservados. Entrada 239 de known-issues
registra a causa e a prova.

### Arquivos criados/modificados

- packages/backend/src/modules/catalog/{admin-settings,image-upload,index}.ts:
  regras únicas e exports usados.
- packages/backend/src/http/{image-upload,index}.ts e
  runtime/{document-storage,index}.ts: upload HTTP e cliente Supabase lazy.
- packages/contracts/src/settings.ts e package.json: schema puro e tipos usados.
  schemas/settings.schema.ts (caminho antigo) e model/settings.schema.ts da
  página configuracoes são fachadas.
- app/api/admin/settings/actions.ts, (caminho antigo) app/api/upload/route.ts
  (caminho antigo) e lib/{image-upload,image-upload-handler}.ts (caminho
  antigo): fachadas/composição anteriores.
- apps/services/api/src/host/branding.ts e rotas upload/admin/settings: adapters
  finos sobre as mesmas factories.
- apps/clients/mobile/tsconfig.json: inclusão de augmentação sem uso retirada,
  sem ampliar lib nem afrouxar strict ou exclusões de teste.
- tests/api-host/{branding.http.test,private-storage,global-setup}.ts,
  tests/unit/{image-upload,settings-service}.test.ts e metadados exatos de
  InvalidImageError em tests/security/route-auth-inventory.test.ts.
- tools/ratchet-transfers.json: transferência explícita de settings. Higiene
  reduzida em sete símbolos resolvidos, tokens em uma ocorrência. Documentação
  API/admin/frontend, ADR, modernização, overview, contexto, índices,
  known-issues e CHANGELOG.

### Contratos preservados

Upload exige ADMIN da locadora atual, com CSRF central. Permissão de settings
não concede upload a outro papel. Multipart mantém equipment por padrão ou logo;
payload inválido não consome quota. Registro UPLOAD_REQUEST/IMAGE ocorre antes
da validação de bytes/storage; essas falhas posteriores consomem quota. Limite
de 30 por usuário/locadora em dez minutos sob lock SQL, compartilhado pelos dois
hosts.

JPEG/PNG vira WebP, sem ampliar resolução, largura máxima 1200 e qualidade 80.
Limite de 5 MiB e 25 megapixels conservado. WebP/GIF preservam bytes validados;
SVG passa pela sanitização original. Nome/extensão saem dos bytes. Bucket
gb-locacoes-images, prefixo do tenant, cache de um ano e upsert false. DTO e
status 200/400/403/413/429/502/500 existentes mantidos; publicação autenticada.

Settings mantém SETTINGS READ/WRITE, principal explícito e no-store. GET sem
registro devolve padrões da organização sem criar linha. PUT descarta extras,
recusa credenciais em claro, preserva segredos SMTP/security persistidos e não
os devolve. Índice único e lock protegem concorrência; RLS e chaves compostas
continuam. Defesa adicional contra duplicatas preservada na unidade.

revalidatePath('/admin/settings') e revalidatePath('/') permanecem depois do
commit. Falha nessa etapa conserva o envelope de erro anterior apesar da escrita
confirmada. Invalidação do cache do web por escrita no serviço separado ainda é
requisito operacional de cutover; a chamada local não certifica isso.

### Testes executados e resultados

- HTTP novo: 58/58 em Better Auth e 58/58 em NextAuth, ambos os hosts de
  produção local, sessões reais, PostgreSQL e role sem BYPASSRLS.
- Regressão de documentos privados: 44/44 em NextAuth com a fixture Supabase
  ampliada; execução NextAuth consolidada 102/102.
- Unidade existente: 12/12 entre imagem, service e route settings. Duas provas
  adicionais de cache passaram junto com as cinco do service (7/7).
- Frontend configuracoes: quatro arquivos, cinco testes passando.
- Segurança inicial: 668 casos verdes, duas falhas de metadados de classe e
  skips por ambiente. Classe apontada para a implementação canônica; rechecagem
  com banco das seis suítes afetadas: 152 casos passaram, inventário 73/73; 18
  skips condicionais do cenário sem banco. Nenhum papel ampliado ou predicado de
  autorização flexibilizado.
- Gates 183/183; types contracts/backend/serviço/raiz/frontend, frontend native,
  mobile e fixture; builds dos dois hosts, lint, arch, tokens, check:test-names,
  hygiene e ratchet com base HEAD passaram.
- Comparação de 19 trechos/initializers passou normalizando formatação:
  validação de imagem byte a byte, sete schemas, regras settings e corpo de
  upload. Exceção explícita: literal de cor convertido ao primitivo idêntico.
- Markdown, links, formatação, handoff e diff conferidos. css-important zero.

Falha inicial dos PUTs: permissão insuficiente da fixture para SELECT FOR
UPDATE. Prova SQL reproduziu 42501 com SELECT e sucesso com UPDATE(id) na
organização. A fixture concede/revoga somente essa coluna para o lock. Teste de
duplicatas corrigido para provar P2002 do índice real e preservar a linha
original; defesa de leitura contra duplicatas continua na unidade. Nenhum índice
removido para tornar um cenário impossível executável.

SDK Supabase real usa exclusivamente servidor HTTP local. Sharp e sanitização
reais verificam bytes; concorrência entre hosts disputa a última vaga da quota e
cria uma só configuração. REVOKE/GRANT em settings prova rollback e recuperação,
restaurando permissões no finally.

Banco: 45 tabelas, 42 de negócio vazias, 19 migrations, 31 FORCE RLS, zero roles
temporárias e zero triggers próprios. Um contador local de auth limpo após
auditoria. Logs em TEMP; cookies, servidores próprios e PostgreSQL local
encerrados. Higiene 896 aceitos/256 itens, antes 903/257; color-literal 156,
antes 157. Proteções somente reduzidas pelas ocorrências resolvidas; nenhuma
dependência ou install novo.

### Estado da API legada

149 rotas/193 métodos/90 GETs e 46 páginas preservados. Serviço parcial: 88
rotas/116 métodos, 52 GETs e 64 mutações, zero métodos extras e zero páginas.
Restam 77 métodos declarados; 60,1% dessa contagem não mede esforço nem
conclusão geral. Clientes e scheduler seguem legados. Sem cutover, commit, push,
deploy ou operação em produção.

### Dívida/risco restante

Storage real e invalidação entre hosts não certificados. Envelope de falha
pós-commit conservado; tratar essa política em correção própria, sem confundir
rollback de banco e falha de cache. Reconciliação de assinatura UNKNOWN sem
consumidor, integrações/jobs/identidade e migração operacional pendentes.
Entrada 238, política de suspensão e lotes SaaS/mobile continuam pendentes.

check:tokens corresponde às expectativas existentes; ainda não prova resolução
de estilo web, render web ou export mobile. Esses três níveis estão explicitados
na saída, sem ampliar expectativas nesta onda.

### Próximo corte recomendado naquela onda

Comunicações administrativas e contadores correlatos: inventariar badges,
notifications sync e integrações, extrair regras para communications e compor
dependências por locadora. Separar pedidos HTTP da execução única de jobs,
preservar credenciais/transporte e caracterizar efeitos antes de mudar
comportamento. Legado só sai após paridade e migração operacional.

## Onda 45 — comunicações administrativas (2026-10-02, sem commit)

### O que foi implementado

GET /api/admin/badges e POST /api/admin/notifications/sync agora estão compostos
em apps/services/api. Contadores, seleção de alertas e fanout têm uma única
implementação em backend/communications. O cliente Zoho e seu leitor de tokens
também passam a factories compartilhadas; as fachadas legadas continuam ligadas
às dependências reais. Nenhum job foi transferido ou habilitado.

### Arquivos criados/modificados

- Backend: admin-badges.ts, admin-alerts.ts, admin-notifications.ts,
  zoho-client.ts, zoho-constants.ts, zoho-tokens.ts e index.ts, em
  packages/backend/src/modules/communications.
- Serviço: src/host/communications.ts e os dois adapters HTTP em
  apps/services/api/src/app/api/admin.
- Legado: os dois route.ts originais, lib/notification-service.ts (caminho
  antigo) e fachadas lib/zoho-mail/client.ts, (caminho antigo) constants.ts e
  get-access-token.ts.
- Provas: tests/unit/admin-communications.test.ts,
  tests/unit/zoho-shared-client.test.ts,
  tests/api-host/admin-communications.http.test.ts e global-setup.ts.
- Dois reexports de tipos sem consumidor saíram de lib/zoho-mail/index.ts
  (caminho antigo); o DTO OAuth que só servia à implementação antiga saiu de
  types.ts. Duas tolerâncias obsoletas removidas de tools/hygiene-baseline.json,
  sem adicionar exceção. Os DTOs HTTP e demais consumidores legados continuam.

### Contratos preservados

Badges admite ADMIN/OPERATOR do vínculo atual; sync admite ADMIN. O papel global
não concede acesso. O principal recebe method:null/url:null, preservando a
política do helper legado inclusive para GET com Origin de outra locadora. A
recusa do serviço transmite o corpo JSON do principal com o status original e o
Content-Type anterior; nenhum código de erro ou header novo foi introduzido.

Badge conserva email/quotes/rentals/whatsapp. Conta PENDING, locações
PENDING/PENDING_RETURN com orçamento e a direção da última mensagem por
timestamp. Zoho ou WhatsApp indisponíveis retornam zero; falha nas consultas de
orçamento/locação mantém o 500 anterior. A busca de pastas conserva timeout de
cinco segundos; refresh/OAuth/transporte conservam suas regras anteriores.

Sync conserva nove chaves de alerta, cortes de 2/4/24 horas, DTO
success/results/created/checks, textos, prioridades e metadata. checks conta os
recursos examinados que geram alerta, mesmo quando created é zero pelo dedupe.
Destinatários são memberships ADMIN ativas da locadora ativa. A janela de seis
horas ignora isRead; lock consultivo SQL por locadora serializa fanout nos dois
hosts. As transações por alerta e consultas separadas permanecem: esta extração
não transforma toda a sincronização numa única transação.

Tokens Zoho usam tenantId/userId e datacenter validado. Credenciais e datacenter
são capturados na composição; a origem fixa do callback continua sendo avaliada
pelo leitor de ambiente. Caminhos, redirect:error, expiração, refresh, IDs
numéricos grandes e multipart foram preservados. Login/callbacks e demais rotas
Zoho continuam legados; compartilhar o transporte não constitui seu cutover.

### Testes executados e resultados

- HTTP novo: 19/19 Better Auth e 19/19 NextAuth, legado e serviço em builds de
  produção local, cookies reais e PostgreSQL com role sem BYPASSRLS.
- A corrida entre hosts cria uma única linha por destinatário/chave; role
  revogada, destinatário inativo, locadora estrangeira e Origin irmã são
  recusados/filtrados. Leitura marcada não interrompe dedupe.
- Regressão HTTP de notificações do cliente: 196/196 em NextAuth.
- Unidade: 36/36, incluindo timeout real com timers controlados, fallback e
  transporte simulado. A unidade da composição foi reexecutada após seu ajuste:
  14/14. OAuth legado e banco/fanout existentes: 12/12.
- Segurança: client-portal 46/46; inventário 73/73 com suas mutações originais.
  Os adapters foram ajustados à gramática; nenhum guard ou teste foi afrouxado.
- Gates 183/183; types backend/serviço/raiz/frontend/native/mobile e dos testes;
  builds de ambos os hosts, lint, arch, tokens, check:test-names, hygiene e
  ratchet com base HEAD passaram.
- Comparação estrutural de 22 corpos de funções/queries originais passou,
  preservando operadores, literais e expressões; só envelopes/composição e
  argumento de contexto foram adaptados.
- Fixture inicial de pagamento não informava dueDate obrigatório: corrigida no
  teste, sem alterar schema ou código de aplicação. O ensaio foi repetido.
- Higiene 894 aceitos/256 itens, antes 896/256; duas tolerâncias removidas. Arch
  1050 sem aumento, css-important zero. Nenhuma dependência nova.

Auditoria final: 45 tabelas, somente as 19 migrations com registros, 31 tabelas
sob FORCE RLS e zero roles temporárias. Um contador do motor de autenticação
gerado nesta janela foi removido por id, timestamp e contagem exatos após
auditoria. Logs e sondas em TEMP; cookies e servidores HTTP próprios encerrados
pela fixture, PostgreSQL local encerrado no fim da validação. Handoff canônico
preservado.

### Estado da API legada

149 rotas/193 métodos/90 GETs e 46 páginas continuam ativos. Serviço parcial: 90
rotas/118 métodos, 53 GETs e 65 mutações, zero métodos extras e zero páginas.
Restam 75 métodos declarados. A cobertura de 61,1% dos métodos não mede esforço
nem conclusão geral. Clientes e scheduler continuam configurados para o legado.
Sem commit, push, deploy, produção ou remoção da API anterior.

### Dívida/risco restante

A prova HTTP desta onda mantém Zoho não configurado; integração configurada é
caracterizada na unidade com transporte simulado. OAuth/sincronização de caixas
reais, transporte WhatsApp e jobs precisam da sua própria paridade operacional.
A política de transações separadas da sincronização foi preservada e pode
confirmar alertas anteriores se uma etapa posterior falhar.

Continuam pendentes cache entre hosts, reconciliação de assinatura UNKNOWN sem
consumidor, entrada 238, política de suspensão e lotes SaaS/mobile. As três
camadas de prova de tokens ainda não certificadas na onda 44 permanecem
pendentes; nenhuma mudança de CSS nesta onda.

### Próximo corte recomendado naquela onda

Rotas administrativas Zoho: inventariar contas/pastas/leitura de mensagens e
OAuth por locadora, reaproveitar o transporte e leitor compartilhados, provar
state/callback e ownership. Manter env/secrets no servidor e a execução de jobs
no legado até cutover operacional.

## Onda 46 — leituras Zoho (2026-10-02, sem commit)

### O que foi implementado

Seis GETs de contas, pastas, lista/detalhe de mensagens, download de anexo e
imagem inline estão compostos em apps/services/api. As implementações saíram dos
handlers para factories em backend/http, sem importar Next ou a raiz.
Transporte, configuração, token por tenant/user e normalizador de remetente
pertencem a backend/communications. Os handlers legados delegam às mesmas
factories depois do guard. Nenhuma regra ou consulta de token foi duplicada.

### Arquivos criados/modificados

- Backend/http: zoho-mail-read.ts, zoho-message-read.ts, zoho-mail-content.ts e
  index.ts. Backend/communications: zoho-address.ts.
- Serviço: host/communications.ts e seis route.ts sob api/admin/zoho-mail.
- Inventário legado da onda 46 (2026-10-02): accounts, folders, messages,
  messages/[messageId], attachments/[id] e inline; a antiga fachada
  lib/zoho-mail/index.ts, depois retirada em F, compunha esses leitores.
  normalize-address.ts foi retirado naquela onda após perder todos os
  consumidores de produção; a implementação única permanece em
  packages/backend/src/modules/communications/zoho-address.ts. O entrypoint que
  só testes usavam também saiu naquela onda.
- Provas: tests/unit/zoho-mail-read-api.test.ts,
  tests/api-host/zoho-mail-read.http.test.ts e zoho-mail-provider.ts.
  global-setup.ts compõe o provedor local e seu preload isolado nos filhos. O
  preload temporário é removido pela fixture; não existe bypass no produto.
- Documentação: esta seção, integração Zoho, ADR, modernização e CHANGELOG.

### Contratos preservados

URLs e DTOs accounts/folders/messages/message, mensagens de erro, status, params
assíncronos, coerção de limit/start e IDs grandes permanecem. A lista de contas
conserva o conjunto retornado pelo provedor. As outras cinco operações exigem
accountId igual ao token armazenado para aquele tenantId/userId, antes de ler ou
renovar accessToken. ADMIN/OPERATOR vêm do vínculo ativo; ADMIN global com
vínculo CLIENT não recebe acesso.

O principal do serviço conserva method:null/url:null e headers originais como o
helper legado. Recusas conservam corpo, status e Content-Type anteriores. Origin
irmã é recusada antes do provedor, inclusive para GET. Token de outra locadora,
vínculo revogado ou datacenter divergente não concede acesso.

Remetente/destinatários, status de leitura, timestamps, anexos, fallback de
attachmentinfo, URLs cid/ImageDisplay e igualdade content/htmlContent são os
anteriores. HTML continua sendo sanitizado pelo consumidor existente; não houve
alteração de frontend. Download mantém stream, filename normalizado,
private/no-store, sandbox/nosniff e MIME. Inline conserva buffer Uint8Array e
Content-Length. redirect:error e timeout de quinze segundos permanecem.

### Testes executados e resultados

- Caracterização antes da extração: 52/52 no legado.
- Depois: 88/88 (52 leituras + 22 transporte/token + 14 comunicações). Após
  retirar o import obsoleto, somente os 52 afetados foram reexecutados: 52/52.
  Comparação estrutural de 17 corpos originais passou, incluindo
  operadores/literais; adaptação limitada a framework e argumento de contexto.
- HTTP de produção local, sessões reais e PostgreSQL com role sem BYPASSRLS:
  32/32 leituras em NextAuth e 32/32 em Better Auth. Regressão de alertas: 19/19
  NextAuth na mesma fixture configurada.
- Provedor local registra destino/token. Provas incluem conta estrangeira,
  Origin irmã, ausência de cookie, papel global sem vínculo autorizado,
  revogação, OPERATOR, FINANCIAL, JSON numérico de 19 dígitos, paginação,
  normalização, HTML inline, bytes/headers, erros e refresh persistido. O token
  da outra locadora permanece intacto.
- OAuth/state/callback existente: 6/6; inventário de autorização 73/73; gates
  183/183. Builds serviço e legado, tipos backend/serviço/raiz/testes e
  frontend/native/mobile, lint, arch, tokens, check:test-names, hygiene e
  ratchet com base HEAD passaram.
- Higiene 894/256 e arch 1050 inalterados, css-important zero. Nenhuma
  dependência, migration, ampliação de baseline ou proteção enfraquecida.

Auditoria final: 45 tabelas, somente as 19 migrations com registros, 31 tabelas
sob FORCE RLS e zero roles temporárias. O único contador do motor gerado na
janela foi removido por id, chave, timestamp e contagem exatos após auditoria.
Cookies e preload removidos; servidores HTTP e provedores locais encerrados pela
fixture. PostgreSQL próprio encerrado e portas dos hosts conferidas fechadas.
Logs/sondas permanecem em TEMP; handoff canônico preservado.

### Estado da API legada

149 rotas/193 métodos/90 GETs e 46 páginas continuam ativos. Serviço parcial: 96
rotas/124 métodos, 59 GETs e 65 mutações; nenhum método extra ou página. Restam
69 métodos. A cobertura de 64,2% dos métodos não mede o progresso geral nem o
esforço restante. Clientes, callback OAuth e scheduler continuam na composição
legada. Sem commit, push, deploy, produção ou remoção da API.

### Dívida/risco restante

O provedor é um dublê HTTP local, não uma caixa Zoho real. O preload existe
somente nos processos próprios da fixture e redireciona as origens Zoho para
loopback; tokens/credenciais do teste são fictícios. A prova valida transporte e
respostas observadas, não disponibilidade ou credenciais de produção.

OAuth e ações de envio/edição/desconexão continuam legados. A coerção antiga de
paginações negativas/fracionárias foi caracterizada e preservada. Não houve
mudança de política, sanitização, secrets, cache entre hosts ou execução de
jobs. Continuam pendentes entrada 238, reconciliação UNKNOWN, política de
suspensão, SaaS/mobile e três camadas de prova de tokens não certificadas na
onda 44.

### Próximo corte recomendado naquela onda

Extrair as ações Zoho de mensagem/rascunho/anexo no mesmo módulo e preservar
ownership, schemas, plainTextToHtml, multipart, status e erros. Depois compor
OAuth com provas de state ligado a tenant/user e callback fixo. Não remover a
API legada ou transferir scheduler antes da paridade operacional.

## Onda 47 — mutações Zoho (2026-10-02, sem commit)

### O que foi implementado

Seis métodos instalados localmente no serviço e preservados no legado: POST
messages/send, POST messages/[messageId]/reply, POST messages/drafts, PUT
messages/update, DELETE messages/[messageId]/delete e POST attachments/upload,
todos sob /api/admin/zoho-mail. Os handlers montam identidade e dependências;
adaptação HTTP, validação e efeitos anteriores permanecem únicos no backend.

O corte compartilha o cache em memória por composição e o logger pino existente.
As transações, transporte, token por tenantId/userId e limitadores reais não
foram substituídos por dublês no produto. Nenhum cliente ou scheduler mudou.

### Arquivos criados/modificados

- Backend/http: zoho-send.ts, zoho-reply.ts, zoho-draft.ts,
  zoho-message-update.ts, zoho-message-delete.ts, zoho-attachment-upload.ts,
  zoho-mutation-ports.ts, memory-idempotency.ts e index.ts.
- Backend/communications: zoho-content.ts preserva plainTextToHtml e a política
  de sanitização anteriores. Backend/runtime/logger.ts compõe o mesmo pino,
  nível LOG_LEVEL ou info; runtime/index.ts exporta a factory.
- Contracts: src/zoho-mail.ts e package.json. Alias exportado de resposta saiu;
  o adapter importa o mesmo SendEmailSchema como ReplyEmailSchema, sem nova
  validação. Ratchet-transfers registra somente esse entrypoint autorizado.
- Serviço: host/communications.ts e seis route.ts correspondentes. Legado: seis
  route.ts, fachadas lib/idempotency.ts (caminho antigo) e lib/logger.ts
  (caminho antigo) e index Zoho.
- schemas.ts, plain-text-to-html.ts e sanitize.ts da raiz saíram após perderem
  consumidores de produção. Pino 10.3.1 passou da declaração da raiz para
  backend; isomorphic-dompurify 4.4.0 já estava no backend e deixou de ser
  declarado inutilmente na raiz. Lockfile sincronizado offline, sem versão nova.
- Provas: zoho-mail-mutations-api.test.ts, memory-idempotency.test.ts,
  zoho-mail-mutations.http.test.ts e extensão do provedor HTTP local.
- Documentação: integração Zoho, ADR, modernização, esta seção e CHANGELOG. Três
  entradas obsoletas de higiene foram removidas; nenhuma tolerância nova.

### Contratos preservados

URLs, métodos, DTOs, status, erros e params assíncronos são os anteriores.
ADMIN/OPERATOR vêm do vínculo ativo; ausência de sessão, CLIENT, FINANCIAL,
revogação e Origin irmã recusam antes de usar tokens ou transportar e-mail. O
principal segue a mesma composição method:null/url:null do helper legado, com os
headers originais e o guard de mesma origem compartilhado.

Send/reply/draft usam o token e accountId armazenados para aquele usuário na
locadora atual. Delete compara accountId da query antes de ler o token. IDs
numéricos de 19 dígitos em update permanecem JSON bruto, sem passar por Number;
modo, flags, precedência de threadId e movimento de pasta não mudaram.

HTML continua texto escapado com quebras de linha, depois sanitizado pela mesma
política; plaintext segue bruto. Rascunhos conservam defaults, interpretação do
envelope do provedor e exclusão do rascunho anterior em melhor esforço. Upload
mantém multipart files no consumidor e attach no transporte, limite de 20 MiB
por arquivo e 50 MiB total, bytes e metadados. Segredos não chegam ao cliente.

Limitador estrito 10/min continua antes do cache/token/body em send/reply;
draft/upload continuam usando 200/min. Cache conserva TTL de cinco minutos,
chaves, limpeza probabilística e escrita antes da auditoria aguardada. Auditoria
continua tenantId/userId, SEND/EMAIL e entidade de usuário ou mensagem.

### Testes executados e resultados

- Antes da extração: 59/59 casos de escrita sobre handlers legados. Fixtures
  corrigidas para o comportamento observado dos campos opcionais; schemas não
  foram alterados para satisfazer o teste.
- Depois: 149/149 (59 escrita, 52 leitura, 22 transporte/token, 14 comunicações
  e dois cache). Treze comparações estruturais de corpos e schemas passaram,
  incluindo operadores e literais, após adaptação de framework/contexto e
  remoção do alias redundante.
- HTTP de produção local com sessões reais e role sem BYPASSRLS: NextAuth,
  primeira execução 81/82, com único erro na fixture multipart; correção do
  campo attach e reexecução apenas do caso afetado 1/1. Assim todos os 50 casos
  de escrita e 32 de leitura estão provados. Better Auth: 82/82 na execução
  completa com a fixture corrigida. Nenhuma asserção ou proteção afrouxada.
- Transporte registrado prova conta/token da locadora, ausência de efeitos na
  recusa, payload HTML/plaintext, bytes e metadados, auditoria SQL, IDs grandes,
  rascunhos, nove ações, falha do provedor, cache e limitador.
- OAuth existente 6/6; inventário de autorização 73/73; gates 183/183. Tipos
  backend, serviço, raiz e fixtures passaram. Lint completo teve somente um erro
  de tipo global na fixture; corrigido e os dois arquivos afetados passaram no
  lint. Higiene 891/253 (antes 894/256), arch 1050/9 pacotes, tokens com
  css-important zero, nomes 438/3 exceções existentes e ratchet com base HEAD
  passaram. Não houve ampliação de baseline.
- Builds finais do serviço e legado passaram após sincronizar dependências.
  Auditoria final: 45 tabelas, somente 19 registros de migrations, 31 tabelas
  sob FORCE RLS e zero roles temporárias. Dois contadores gerados pelo motor na
  janela foram removidos por id, chave, timestamp e contagem exatos.
  Cookies/preload ausentes, seis portas HTTP e PostgreSQL próprios fechados.
  Handoff canônico preservado. Formatação, Markdown, links e diff conferidos no
  fechamento.

### Estado da API legada

149 rotas/193 métodos/90 GETs e 46 páginas continuam ativos. Serviço parcial:
102 rotas/130 métodos (59 GETs/71 mutações), zero páginas ou métodos extras; 63
métodos restantes. Cobertura por método não mede progresso geral ou esforço
restante. Clientes, OAuth e scheduler continuam configurados para o legado. Sem
commit, push, deploy, produção, cutover ou exclusão da API legada.

### Dívida/risco restante

Idempotência ainda é um Map por processo e não é distribuída, atômica ou uma
prova de entrega externa. Reply mantém a chave anterior, que não inclui o
messageId concreto; reutilizar a mesma chave em respostas diferentes pode
reaproveitar o primeiro resultado. Auditoria é aguardada depois da chamada
externa e do cache: falha SQL pode devolver 500 após envio bem-sucedido; uma
repetição com chave pode retornar o sucesso armazenado. Esses comportamentos
foram caracterizados e preservados, não corrigidos nesta extração.

As listas de e-mail opcionais aceitam string vazia, mas não ausência da chave no
input; send/reply exigem ccAddress/bccAddress e draft também toAddress. PUT
update conserva a leitura JSON fora do catch, inclusive sua recusa pelo
framework quando o corpo é malformado. Não houve mudança funcional incidental.

Provedor e credenciais da prova são estritamente locais e fictícios; não há
certificação de caixa Zoho real, DNS, credenciais ou entrega de produção.
Persistem cache entre hosts, entrada 238, reconciliação UNKNOWN, suspensão,
SaaS/mobile e três camadas de prova de tokens ainda não certificadas.

### Próximo corte recomendado naquela onda

Extrair autorização, callback e desconexão OAuth Zoho, preservando state
vinculado a tenant/user, callback fixo, cookies, datacenter e transações. Manter
API e scheduler legados até paridade operacional e decisão de cutover.

## Onda 48 — OAuth Zoho (2026-10-02, sem commit)

### O que foi implementado

GET oauth/authorize, GET oauth/callback e DELETE oauth/disconnect, sob
/api/admin/zoho-mail, estão compostos no serviço e preservados no legado.
Factories únicas em backend/http conduzem state, redirects, consumo SQL e token;
communications mantém o cliente OAuth existente. Os hosts montam identidade,
transação, ambiente e a integração Next de cookies. Nenhum consumidor, proxy,
scheduler, configuração de produção ou callback público foi transferido.

### Arquivos criados/modificados

- Backend/http: zoho-oauth-authorize.ts, zoho-oauth-callback.ts,
  zoho-oauth-disconnect.ts, zoho-oauth-response.ts e index.ts.
- Backend/identity: tenant-request-principal.ts expõe o texto da recusa como
  metadado interno opcional, além da mesma Response. Isso permite o redirect
  OAuth sem ler um corpo de resposta após o guard; status e JSON não mudaram.
- Serviço: host/zoho-oauth.ts e os três route.ts correspondentes. Legado: os
  três handlers delegam às factories e lib/zoho-mail/oauth-cookies.ts (caminho
  antigo) adapta somente Response/cookie para NextResponse.
- Provas: zoho-oauth-api.test.ts, zoho-oauth.http.test.ts,
  tenant-principal-request.test.ts, route-auth-inventory.test.ts,
  global-setup.ts e zoho-mail-provider.ts. A fixture ganha grants/revokes
  mínimos nas duas tabelas necessárias e limpa somente seu namespace OAuth.
- Documentação: integração Zoho, ADR de extração, modernização, entrada 240 de
  known-issues e CHANGELOG. Nenhuma dependência ou baseline foi alterada nesta
  onda.

### Contratos preservados

ADMIN/OPERATOR continuam vindo do vínculo ativo, com guard central de mesma
origem e headers originais. Authorize/desconectar recusam antes de SQL/Zoho.
Callback conserva a precedência antiga: erro do provedor, falta do código,
depois erro de autenticação. Esses erros iniciais não leem nem apagam cookie. Os
redirects do callback continuam 307 relativos ao painel /admin/email.

A autorização gera nonce aleatório de 16 bytes, cookie JSON com nonce/tenantId/
userId e verificação SQL somente com SHA256 do nonce. Cookie HttpOnly,
SameSite=lax, Path=/, dez minutos e Secure em produção, sem Domain. O
redirect_uri continua fixo no host app da plataforma; não vem do Host do
backend. A ausência de configuração conserva a origem da requisição e a
codificação anterior da mensagem.

O callback apaga o cookie antes de parse/SQL, compara nonce e escopo com o
principal e exige exatamente uma verificação não expirada removida. Zero ou duas
verificações recusam; o consumo precede a troca do código. Falha da troca não
restaura state. Tokens são gravados por tenantId/userId sob FORCE RLS, expiry
conserva a margem de 60 segundos e descoberta de accountId continua em melhor
esforço: falha deixa null e conserva o redirect de sucesso. IDs longos
permanecem strings. Desconectar apaga somente o token local daquele escopo.

### Testes executados e resultados

- Antes da extração: 26/26 casos sobre os três handlers originais. Depois:
  254/254 unitários (OAuth, leituras/escritas, transporte, cache, helpers admin
  e principal); 6/6 contratos OAuth de identidade. Ajustes finais de tipos e
  transporte rechecados nos dois arquivos afetados, 105/105.
- Sete comparações AST confirmam política, SQL, precedência, operadores e
  literais após as adaptações explícitas de contexto e Response/cookie.
- HTTP com servidores de produção locais, cookies reais e role sem BYPASSRLS:
  27/27 casos nos dois hosts com NextAuth e 27/27 com Better Auth. Cobrem
  escopos/cookie/nonce inválidos, expiração, replay, duplicatas, revogação,
  callback sem Origin em navegação do provedor, falha de troca/descoberta,
  exclusão local e dois callbacks concorrentes: somente um troca o código.
- Regressão HTTP NextAuth: 82/82 de leitura/escrita. Na primeira execução OAuth,
  uma URI do .env local do host legado interferiu na fixture: 19 casos falharam.
  ZOHO_REDIRECT_URI vazio passou a ser explícito somente no processo de teste;
  os 27 casos OAuth foram reexecutados. Não foi alterada a configuração real.
- Inventário 73/73, gates 183/183, segurança afetada 84 com banco + 18 no ramo
  alternativo sem banco. O helper puro movido passa pela mesma gramática INERT e
  pelas mutações fetch/escrita/callback. As mutações que removem/atrasam CSRF
  foram ajustadas à presença do metadado literal e continuam reprovando; nenhuma
  chamada com efeito foi liberada antes do guard.
- Builds API/legado, tipos backend/API/raiz/fixtures, lint, arch (1050 violações
  existentes, zero acima do baseline), tokens (css-important zero), nomes (438/3
  exceções existentes), higiene (891/253), ratchet HEAD, CSSlint, formatação,
  Markdown, links de documentação e diff passaram.
- Auditoria: 45 tabelas, somente 19 linhas de migrations, 31 FORCE RLS, zero
  roles temporárias. Um contador de login da fixture foi removido somente pelo
  snapshot exato id/key/timestamp/count após auditoria local. Hosts, provedor,
  cookies/preload e PostgreSQL próprios foram encerrados. Handoff canônico
  preservado.

### Estado da API legada

149 rotas/193 métodos/90 GETs e 46 páginas permanecem ativos. Serviço parcial:
105 rotas/133 métodos, 61 GETs e 72 mutações, zero páginas/métodos extras.
Restam 60 métodos declarados; essa cobertura não mede a conclusão geral nem
esforço restante. Clientes, callback público e scheduler continuam configurados
para o legado. Sem commit, push, deploy, produção, cutover ou exclusão da API
legada.

### Dívida/risco restante

O provedor e credenciais da prova são estritamente locais; caixa real, registro
do callback no Zoho, sessão através do proxy público, DNS e entrega externa não
estão certificados. Tokens mantêm o armazenamento legado; não foi implantado
vault ou rotação nova. Desconectar não revoga no provedor nem invalida state
pendente (entrada 240); endurecimento é uma mudança funcional separada.

Continuam idempotência por processo, cache entre hosts, entrada 238,
reconciliação UNKNOWN, suspensão, SaaS/mobile e provas de tokens não
certificadas. A paridade local não autoriza remover app/ (caminho antigo) ou
transferir o scheduler.

### Próximo corte recomendado naquela onda

Compartilhar as três leituras administrativas de conversas/mensagens WhatsApp,
preservando DTOs, cursores, papel por vínculo, ownership e RLS. Tratar envio e
webhooks em bloco separado com transporte local e credencial por locadora, antes
de qualquer cutover. Scheduler deve continuar único no legado.

## Onda 49 — leituras administrativas WhatsApp (2026-10-02, sem commit)

### O que foi implementado

GET de conversas, detalhe e mensagens sob /api/admin/whatsapp/conversations
estão montados no serviço e preservados no legado. Communications concentra
consultas, isolamento, projeções e ordenação; backend/http adapta query,
parâmetros e respostas. Os dois hosts compõem o mesmo leitor, transação e guard,
sem copiar regras. As leituras usam somente dados persistidos, sem acesso à
Meta.

### Arquivos criados/modificados

- Backend: modules/communications/whatsapp-read.ts e seu index.ts;
  http/whatsapp-read.ts e seu index.ts.
- Composição: lib/whatsapp-read.ts (caminho antigo) e
  apps/services/api/src/host/whatsapp-read.ts.
- Legado e serviço: os três route.ts de conversations, [conversationId] e
  [conversationId]/messages. O corpo do POST legado de envio foi preservado.
- Provas: tests/unit/whatsapp-read-api.test.ts e
  tests/api-host/whatsapp-read.http.test.ts. A fixture SQL/HTTP existente foi
  reutilizada sem ampliar grants, baselines ou proteções.
- Documentação: esta página, admin-whatsapp-ui-ux.md, ADR de extração,
  modernization.md e CHANGELOG. Nenhuma dependência, schema ou migration nova.

### Contratos preservados

ADMIN/OPERATOR vêm do vínculo ativo da locadora atual. Headers originais e o
guard central continuam recusando origem irmã inclusive para estes GETs.
Autorização precede parâmetros e SQL. CLIENT/FINANCIAL e vínculo revogado
continuam recusados; o papel global ADMIN não concede acesso.

A lista mantém pesquisa aparada e insensível a caixa em phone/displayName, ordem
lastMessageAt descendente, paginação e total calculados na mesma transação.
Limite usa max(1, min(Number(valor) || 50, 100)); offset usa max(0,
Number(valor) || 0). DTO mantém id, phone, displayName, três datas ISO e
messageCount, sem expor tenantId ou colunas adicionais.

Detalhe e thread consultam id mais tenantId. Conversa estrangeira, sem locadora
ou inexistente recebe o mesmo 404. A thread verifica ownership em uma transação
antes da consulta de mensagens em outra, preservando a sequência original.
Limite da thread mantém min(Number(valor) || 50, 100), inclusive valores
negativos. Cursor inválido/vazio é ignorado; cursor válido usa timestamp lt,
estritamente anterior. SQL busca em ordem descendente e somente a página
projetada é invertida para ordem cronológica. Campos anuláveis, enum, datas e
envelopes vazios permanecem iguais. Error.message e os três fallbacks 500
continuam sendo os existentes.

O serviço parcial expõe apenas GET nestas rotas. POST /messages segue no legado,
com a mesma implementação de envio e validação; a origem dos clientes não foi
alterada. Webhooks, credenciais Meta e scheduler continuam legados.

### Testes executados e resultados

- Caracterização dos handlers originais: 30/30 antes da extração. Depois: 44/44
  unitários de leituras e contadores; rechecagem final das leituras, 30/30.
  Mensageria/guard estrutural: 81/81, incluindo inventário 73/73.
- Doze comparações AST confirmam POST legado, consultas, busca, cursor e DTOs
  após adaptação explícita de principal/contexto e Response.
- HTTP em dois servidores locais de produção, cookies reais e PostgreSQL: 54/54
  com NextAuth e 54/54 com Better Auth. SQL é executado por role sem
  superuser/BYPASSRLS; ambas as tabelas têm FORCE RLS. Cobrem sessão, papéis,
  revogação, origem irmã, troca de locadora, busca/paginação, contagem RLS,
  DTOs/datas/null, thread vazia, cursor estrito/inválido e limite negativo. Uma
  mensagem sem locadora ligada à conversa própria fica oculta. POST legado
  conserva 400 de JSON/texto inválido; o substituto parcial recusa POST com 405.
- Regressão HTTP dos alertas administrativos: 19/19 com NextAuth, no mesmo bloco
  de 73 casos. Nenhum envio ou webhook Meta real foi executado.
- Tipos backend, serviço, raiz e testes; builds serviço e legado; lint,
  arquitetura (nove pacotes, baseline 1050 inalterada), gates 183/183, tokens,
  nomes de teste, higiene 891/253, ratchet e CSS passaram. Formatação, Markdown,
  links e diff conferidos no fechamento.

Auditoria final do banco descartável: 45 tabelas, somente 19 registros de
migrations, 31 tabelas com FORCE RLS e nenhuma role temporária. O único contador
produzido pelo login Better Auth foi removido por id, hash da chave, timestamp e
contagem exatos, depois dos testes. Cookies/preload ausentes das duas fixtures;
suas quatro portas HTTP e o PostgreSQL desta onda foram encerrados após
conferência de ownership. O hash do handoff canônico permanece idêntico.

### Estado da API legada

149 rotas/193 métodos/90 GETs e 46 páginas continuam ativos. Serviço parcial:
108 rotas/136 métodos (64 GETs/72 mutações), zero páginas ou métodos extras; 57
métodos restantes. Esse inventário mede cobertura por método, não conclusão
geral ou esforço restante. Clientes, proxy, callback público e scheduler
continuam na configuração legada. Sem commit, push, deploy, produção ou cutover.

### Dívida/risco restante

Cursor por timestamp não tem desempate por id; o código conserva o risco de
empates atravessarem a paginação. Não foi introduzida nova ordenação. Coerções
fracionárias/infinitas continuam chegando ao Prisma como antes, caracterizadas
na fronteira por dublês; a prova HTTP cobre os limites documentados acima. Erros
de consulta ainda podem expor Error.message, comportamento legado explicitamente
preservado nesta extração estrutural.

Paridade HTTP local não certifica envio, assinatura/verificação de webhook,
credencial, conta ou entrega Meta real. A UI continua na fase de texto
documentada na entrada 129; ler enum/URL persistidos não habilita envio de
mídia. Permanecem os riscos operacionais anteriores, SaaS/mobile, reconciliação
UNKNOWN, cache entre hosts e corte definitivo da origem. Handoff canônico
preservado.

### Próximo corte recomendado naquela onda

Extrair envio WhatsApp e recepção/verificação de webhooks em bloco próprio, com
transporte simulado local, credencial por locadora, ownership, persistência e
assinaturas preservados. Manter um único scheduler e a origem legada até
paridade operacional e decisão de cutover.

## Onda 50 — envio e webhooks WhatsApp (2026-10-02, sem commit)

### O que foi implementado

Seis métodos adicionais foram compostos no serviço: POST administrativo de
mensagem, POST de envio por integração, GET/POST do webhook com integrationId e
GET/POST da URL antiga sem integração, que continuam respondendo 410. As rotas
legadas permanecem montadas e usam o mesmo backend. Nenhum endereço de cliente,
proxy, provedor ou scheduler foi trocado.

Communications concentra resolução da conta/token, envio Graph, normalização,
parsers e persistência do evento. Backend/http adapta os dois corpos de envio.
Os schemas existentes foram movidos ao contrato universal. Hosts conservam a
autorização, integração de runtime e o protocolo de verificação HTTP. O segredo,
a conta e o SQL não foram copiados para o serviço.

### Arquivos criados/modificados

- Backend: communications/whatsapp-client.ts, whatsapp-webhook.ts e index.ts;
  http/whatsapp-send.ts e index.ts.
- Contratos: contracts/src/whatsapp.ts e export explícito no package.json,
  registrado no ratchet-transfers com motivo da extração autorizada, sem
  baseline nova ou tolerância de teste.
- Composição: lib/whatsapp-write.ts, (caminho antigo) lib/meta-whatsapp.ts
  (caminho antigo) e a fachada legada do consumidor;
  service/host/whatsapp-write.ts, webhook-authentication.ts e
  payment-webhooks.ts. Registro WHATSAPP liga o consumidor à inbox
  compartilhada; nenhum worker ou cron novo foi iniciado.
- Rotas: POST integration/send e conversation/messages nos dois hosts; dois
  novos route.ts de webhooks no serviço. As rotas originais de webhook não
  precisaram mudar. O reexport legado do tipo AuthenticatedTenantWebhook saiu
  quando perdeu seu último consumidor; o tipo continua no backend/identity.
- Provas: unit/whatsapp-write-api.test.ts, api-host/whatsapp-write.http.test.ts
  e whatsapp-provider.ts; global-setup.ts, teste HTTP de leituras e inventário
  de autenticação adaptados ao novo estado. Grants de INSERT/UPDATE apenas nas
  duas tabelas WhatsApp da role descartável, revogados no teardown.
- Documentação: esta página, feature WhatsApp, ADR de extração, modernization,
  CHANGELOG e known-issues/index. Sem dependência, migration ou mudança de UI.

### Contratos preservados

Envio por integração exige ADMIN do vínculo atual. O envio administrativo
permite ADMIN/OPERATOR, preserva o guard de headers e verifica id/tenantId antes
de chamar a Meta. CLIENT, FINANCIAL, vínculo revogado e origem irmã não executam
efeito. Conversa estrangeira, sem tenant ou desconhecida devolve o mesmo 404.

O contrato de integração continua estrito: destinatário de 8–30 caracteres,
mensagem aparada de 1–4096 caracteres e campos opcionais existentes. Templates
continuam indisponíveis com 503; templateId vazio continua permitido. JSON
malformado conserva 502; configuração ausente/ambígua conserva 503. O endpoint
administrativo conserva text aparado, extras ignorados, 400 de JSON/texto
inválido, DTO original e Error.message no 500. JSON null nesse endpoint continua
lançando erro fora do catch de SQL, caracterizado por unidade, sem mudança
funcional incidental.

Sender exige uma única integração WHATSAPP ativa da locadora/organização, conta
numérica e apiKey resolvida pela referência de credencial. Graph v21.0, número
normalizado, redirect:error e timeout de 15 segundos permanecem iguais. Primeiro
persiste conversa e mensagem OUTBOUND/processing em transação RLS; somente
depois chama o provedor. Confirmação com id muda para sent. Recusa, JSON
inválido, resposta sem id ou falha de rede conservam unknown, sem id confirmado
falso ou retry automático. Trocar a locadora troca conta, token e persistência.

GET de verificação exige integração ativa, verifyToken comparado em tempo
constante, mode=subscribe e challenge; preserva 400/403/503 e corpo text/plain.
POST autentica sha256= do corpo bruto antes da inbox e do consumidor, conserva
limite de 2 MiB, parsing e recusa de conta divergente. O evento só grava na
locadora da integração; status de mensagem com o mesmo id em outra locadora ou
sem tenant permanece intacto. A URL antiga conserva 410 nos dois métodos.

Inbox/outbox preservam deduplicação, hash, lease e retry. Evento já processado
devolve success/duplicate. A concorrência pode produzir 503 transitório com
envelope exato e retry posterior idempotente; entrada 241 registra essa
limitação observada. O motor de inbox não mudou nesta onda.

### Testes executados e resultados

- Antes da extração: caracterização dos dois POSTs 22/22 e segurança relacionada
  159/159. Depois: caracterização de envio/leitura 52/52; inventário fechado
  74/74, total de segurança relacionado 233 casos aprovados. A nova prova
  estrutural recusa comparação removida, efeito anterior ao guard, ausência de
  return, binding de verificação misturado e namespace errado.
- Dezenove comparações AST confirmam corpos do sender/parsers, URL Graph,
  schemas, consumidor/SQL, DTOs, validação/erros e ambos os protocolos de
  webhook. Só contexto, composição e Response foram adaptados explicitamente.
- HTTP em dois builds locais de produção, PostgreSQL e cookies reais: escrita
  84/84 com NextAuth e 84/84 com Better Auth; leituras 54/54 em cada motor. O
  bloco Better Auth executou 138/138 em conjunto. Role sem superuser/BYPASSRLS e
  ambas as tabelas WhatsApp com FORCE RLS. Meta exclusivamente simulada local.
- Provas HTTP incluem estado processing antes da resposta do provedor,
  sent/unknown, DTO e credencial por locadora, autoria, papéis, CSRF, validação,
  assinatura do corpo bruto, handshake, suspensão, replay entre hosts,
  concorrência com retry e inbox/outbox únicos. O pressuposto novo de somente
  200/202 concorrentes falhou; a prova foi corrigida para o comportamento
  observado, exigindo persistência única e retry, sem alterar teste anterior.
- Tipos contracts/backend/serviço/raiz/fixtures; builds legado e serviço; lint,
  arch (nove pacotes, baseline 1050 intacta), tokens, nomes, higiene 891/253,
  ratchet contra HEAD, CSS e gates 183/183 passaram. Formatação, Markdown,
  links, diff e auditoria conferidos no fechamento.

As tentativas iniciais revelaram uma expectativa incompleta da chave da outbox:
o backend já prefixava dedupeKey com tenantId. Corrigiu-se apenas a expectativa
da fixture, mantendo esse escopo e a implementação original.

Auditoria final: 45 tabelas, somente 19 registros de migrations, 31 tabelas com
FORCE RLS e nenhuma role temporária. Dois contadores produzidos pelo login e
consulta de sessão Better Auth foram removidos somente após teardown, por id,
hash da chave, timestamp e contagem exatos. As cinco fixtures conservam apenas
logs locais; cookies e preloads foram retirados. Suas dez portas HTTP e o
PostgreSQL desta onda foram encerrados e conferidos. Handoff canônico com hash
inalterado.

### Estado da API legada

149 rotas/193 métodos/90 GETs e 46 páginas continuam ativos. Serviço parcial:
111 rotas/142 métodos (66 GETs/76 mutações), zero páginas ou métodos extras; 51
métodos restantes na onda 50 de 2026-10-02. A contagem media cobertura HTTP, sem
equivaler a progresso geral, paridade operacional ou autorização para apagar a
antiga raiz app/, depois retirada somente no clone F.

Clientes, proxy, webhook público, callbacks e scheduler conservam a configuração
legada. Não houve commit, push, deploy, produção ou cutover. O checkpoint
canônico do handoff foi preservado.

### Dívida/risco restante

Paridade local não certifica conta/credencial Meta real, registro de callback,
DNS, sessão através do proxy público ou entrega externa. A UI permanece na fase
de texto. UNKNOWN exige conferência/reconciliação; não se introduziu reenvio.
Atualizações de status conservam o comportamento legado, sem uma nova máquina de
estados monotônica. Normalização pode produzir outra conversa canônica, e o
sender não verifica count do updateMany de confirmação; ambos permanecem
comportamentos existentes.

A entrada 241 exige diagnóstico da exceção sob recepção concorrente e uma
correção separada protegida por testes dos demais provedores. A presença do
consumidor no serviço não muda o scheduler único do legado. Persistem as demais
dívidas de identidade/SaaS/mobile, cache entre processos e cutover.

### Próximo corte recomendado naquela onda

Caracterizar e compartilhar leituras operacionais de manutenção e auditoria, com
autorização granular, query/DTO, ownership e RLS. Manter os jobs no legado;
transferência de scheduler e retirada da raiz exigem paridade operacional e
decisões de implantação posteriores. Endurecimento da concorrência da inbox deve
diagnosticar a causa antes de mudar seu contrato.

## Onda 51 — manutenção e auditoria (2026-10-02, sem commit)

### O que foi implementado

Sete métodos em seis rotas compostos no serviço e preservados no legado:
GET/POST admin/maintenance, GET scheduled, POST preventive-schedule, PATCH por
id, POST complete e GET admin/audit-logs. Casos de uso únicos em
backend/operations, quatro schemas anteriores em contracts/operations e adapters
Request/Response em backend/http. Composição usa a mesma transação de locação e
o mesmo principal; nenhuma regra duplicada nos hosts.

### Arquivos criados/modificados

- Backend: operations/maintenance.ts, maintenance-automation.ts, audit-read.ts e
  index.ts; http/maintenance.ts e index.ts. Automação foi movida integralmente
  de lib/maintenance-automation.ts (caminho antigo); a facade antiga sem
  consumidores foi retirada. A API legada continua implementada pelos adapters
  ativos.
- Contrato: quatro schemas e tipos de entrada em contracts/src/operations.ts,
  sem pacote, export de package.json ou dependência novos.
- Legado: lib/maintenance-http.ts, (caminho antigo) lib/audit-log.ts (caminho
  antigo) e os seis route.ts. A escrita logAuditAction e lib/audit-logger.ts
  (caminho antigo) permanecem intactas.
- Serviço: host/maintenance.ts e seis route.ts correspondentes; somente
  composição, ACL e tradução de erros.
- Provas: tests/unit/maintenance-audit-api.test.ts,
  tests/api-host/maintenance-audit.http.test.ts e grants/teardown de
  tests/api-host/global-setup.ts. GRANT SELECT/INSERT/UPDATE em maintenances
  aplica-se exclusivamente à role temporária local e é revogado no teardown.
- Documentação: esta página, operations-tenancy.md, ADR de extração,
  modernization.md e CHANGELOG.md. Sem migration ou alteração de UI.

### Contratos preservados

ADMIN da membership ativa da locadora atual em todas as sete operações.
OPERATOR, FINANCIAL, CLIENT, vínculo revogado e identidade global ADMIN sem
vínculo permitido não executam efeito. Mutação com origem irmã é recusada pelo
principal central. Recursos estrangeiros, sem locadora ou desconhecidos
mantêm 404. Dados forjados de tenant/id/status são descartados pelos schemas
antigos.

Manutenção usa tenantId nas consultas e escritas, organização ativa e o lock
consultivo de mutações de locação, na mesma conexão RLS. Corpo é validado depois
do lock. PATCH consulta posse antes de ler JSON; complete resolve params e
valida JSON dentro da transação, antes da consulta. JSON malformado continua 500
genérico, erro Zod mantém 400/details, erro de locadora mantém status/texto.

Custos zero conservam os contratos distintos: criação usa null/recomposição;
PATCH grava zero e não recalcula total; complete com total zero conserva custo
anterior, mas grava parcelas/medidores zero. Strings vazias, opcionais, datas e
DTOs completos permanecem iguais. IN_PROGRESS recusa equipamentos em locações
PENDING/ACTIVE/OVERDUE/PENDING_RETURN e só então marca indisponibilidade.
Conclusão libera equipamento apenas sem outra manutenção ativa; CANCELLED não
libera. Falha na atualização do equipamento desfaz manutenção/custo/medidores.

Listagem comum ordena descendente; scheduled ordena ascendente e tem estados
ativos como padrão, substituíveis pelo status explícito. includeOverdue=true
retorna alertas de toda a locadora mesmo com filtro de equipamento. Regras
preventivas por dias, horas e quantidade de locações, primeira manutenção e
descrição padrão permanecem iguais. Horímetro anterior ainda é simplificado em
zero. Filtros inválidos de manutenção continuam devolvendo 500 pelo Prisma.

Auditoria conserva query e count na mesma transação tenant, filtros idênticos,
ordenação descendente, campos de user existentes, página 1/50 e limite 100.
Datas e paginação inválidas retornam 400; resultado vazio tem totalPages=0;
erros inesperados são 500 genéricos. Nenhum cookie ou campo novo foi
introduzido.

### Testes executados e resultados

- Caracterização antes da extração: 47/47. Depois: mesmos 47/47 com backend real
  e banco simulado, incluindo a execução real do runner/lock de locação.
- Segurança existente: operations-tenancy e route-auth-inventory, 132/132;
  regressão PostgreSQL de operações, 9/9. Nenhuma proteção modificada.
- Vinte e quatro comparações AST: cinco helpers/interface, quatro schemas,
  consultas/escritas Prisma, query/count da auditoria, ordem dos guards e
  envelopes de erro. Mudanças de parsing/composição e retorno foram explícitas.
- HTTP nos dois builds locais de produção: 47/47 com NextAuth e 47/47 com Better
  Auth. Cookies reais, role sem superuser/BYPASSRLS e FORCE RLS; ownership
  A/B/sem tenant, CSRF, papéis, vínculo revogado, filtros, DTOs, custos zero,
  disponibilidade, medidores, regras preventivas e rollback SQL.
- Tipos contracts/backend/serviço/raiz/fixtures, ambos os builds, lint, arch
  (nove pacotes, baseline 1050 intacta), tokens, nomes, higiene 891/253, ratchet
  contra HEAD e gates 183/183 aprovados. Baselines não foram ampliadas.

Auditoria de teardown: 45 tabelas, somente 19 registros de migrations, 31
tabelas com FORCE RLS e nenhuma role temporária. Um contador Better Auth da
fixture encerrada foi removido por id, hash da chave, timestamp e count exatos.
As três fixtures conservam somente logs; cookies/preloads não ficaram. Seis
portas HTTP próprias foram conferidas fechadas. Handoff canônico inalterado.

### Estado da API legada

149 rotas/193 métodos/90 GETs e 46 páginas continuam ativos. Serviço parcial:
117 rotas/149 métodos (69 GETs/80 mutações), zero páginas ou método extra; 44
métodos restantes. Isso mede cobertura HTTP, não progresso geral ou paridade de
implantação. Clientes, proxy, callbacks, webhooks públicos e scheduler mantêm
configuração legada. Sem commit, push, deploy ou alteração de produção.

### Dívida/risco restante

Cálculo preventivo por horas não possui snapshot histórico; diferenças de zero,
cancelamento e validação de filtro são comportamentos anteriores preservados,
não melhorias funcionais nesta extração. Auditoria permanece com dois helpers de
escrita legados e sua projeção original. Sem nova máquina de estados, paginação
de manutenção ou política de dados.

Paridade local não prova operação pelo proxy/DNS público, concorrência com
scheduler de produção ou rollout. Jobs continuam em um único host legado;
transferi-los exige caracterização e composição próprias. Restam outros métodos,
paridade operacional, dívida de identidade/SaaS/mobile e retirada autorizada da
raiz. A concorrência da inbox (entrada 241) permanece fora deste bloco.

### Próximo corte recomendado naquela onda

Caracterizar as integrações operacionais restantes (cálculo de frete e endpoints
Merchant bloqueados), compartilhando transporte/validação e os stubs atuais sem
ativar integração comercial ou ampliar permissões. Jobs e cutover permanecem
etapas posteriores protegidas por paridade operacional.

## Onda 52 — frete e quarentena Merchant (2026-10-02, sem commit)

### O que foi implementado

Cinco métodos em quatro rotas compostos no serviço e preservados no legado: POST
integrations/melhor-envio/calculate, GET admin/google-merchant/status, POST sync
e POST/DELETE products/[id]. Cálculo, consultas e transporte de frete têm
implementação única em backend/operations; parsing HTTP em backend/http e o
schema original em contracts/operations.

Merchant compartilha somente a resposta indisponível, com ACL nos adapters. Não
habilita publicação no Google nem reutiliza o cliente global histórico; a
feature comercial continua bloqueada. Não há schema Prisma, migration,
dependência, regra de domínio ou UI novos.

### Arquivos criados/modificados

- Backend: operations/shipping.ts e index.ts; http/shipping.ts, merchant.ts e
  index.ts. ShippingError pertence ao serviço e é traduzido pelo adapter;
  exceções inesperadas mantêm o catch genérico anterior no host.
- Contrato: ShippingCalculationSchema e seu tipo de saída em
  packages/contracts/src/operations.ts, sem entrypoint de pacote novo.
- Composição: lib/shipping.ts (caminho antigo) e
  apps/services/api/src/host/shipping.ts, com transação tenant e resolver de
  credenciais já existentes.
- Rotas: os quatro route.ts acima na raiz e seus correspondentes em
  apps/services/api/src/app/api. Guards e modos dynamic/runtime do Merchant
  permanecem visíveis e idênticos.
- Provas: tests/unit/shipping-merchant-api.test.ts,
  tests/api-host/shipping-merchant.http.test.ts, shipping-provider.ts e
  composição/teardown em global-setup.ts. Nenhum GRANT de produção foi criado; a
  prova reutiliza a role temporária local, sem superuser/BYPASSRLS.
- Docs: esta página, operations-tenancy.md, modernization-merchant-blocker.md,
  ADR de extração, modernization.md e CHANGELOG.md.

### Contratos preservados

Frete aceita qualquer principal ativo da locadora, inclusive CLIENT; Merchant
exige ADMIN da membership. Recusas do principal precedem body/SQL/provedor e são
preservadas. O principal central recusa mutações de origem irmã, e frete mantém
também o guard explícito anterior.

Entrada estrita na raiz, com remoção de campos extras dos objetos internos. CEP
perde caracteres não numéricos e exige oito dígitos. IDs, medidas, peso,
quantidade padrão 1, limites de produtos e seguro mantêm as regras originais.
IDs repetidos são deduplicados para a consulta de posse, preservando todos os
volumes no payload e no cálculo. Foreign, sem tenant e desconhecido continuam
404 antes de verificar configuração ou credencial. CEP divergente retorna 400.

SQL mantém tenantId, provider MELHOR_ENVIO, status ACTIVE, organização ativa e
take:2, exigindo exatamente uma integração. Equipamentos usam FORCE RLS na
transação tenant. TenantIntegration é um registro global de servidor sem RLS no
schema atual, consultado também antes da resolução de tenant nos webhooks: o
isolamento desta consulta depende dos filtros explícitos, e não se afirma FORCE
RLS para esse registro. A/B usam referências e chaves diferentes, provadas pelo
transporte local.

Ausência/ambiguidade de integração ou CEP retorna 503; referência inválida,
chave/ambiente/User-Agent inválidos retornam o 503 de credencial. O resolver
existente continua exigindo a referência env e seu _SECRET, sem fallback global.
URLs fixas sandbox/production, Bearer, User-Agent validado, JSON e Accept
preservados; redirect:error e AbortSignal.timeout(12000).

Preço e prazo numéricos ou strings decimais mantêm o parsing. Opções inválidas
são descartadas; custom_price/custom_delivery_time zero prevalecem; lista vazia
continua sucesso com shippingOptions:[], sem cotação inventada. DTO mantém id,
name, company, price, deliveryTime e estimatedDays. chargeableWeight permanece o
máximo entre peso e volume/1000, multiplicados pela quantidade.

Recusa HTTP do provedor retorna 502 genérico específico; objeto não-array tem
outro envelope 502; JSON malformado de entrada/provedor, timeout, redirect,
rede, SQL e exceções do guard continuam 502 genérico do catch. Não adiciona
cookie, reserva, escrita de equipamento ou contratação de transporte.

Merchant mantém 503 com success:false, configured:false e
TENANT_MERCHANT_ADAPTER_UNAVAILABLE; não consulta body/id nem chama provedor.
OPERATOR/FINANCIAL/CLIENT continuam 403. Factory histórica desativada, scripts e
cron intactos. Isso prova a quarentena, não funcionamento comercial.

### Testes executados e resultados

- Caracterização: 65/65 antes e os mesmos 65/65 depois da extração, incluindo
  merchant-retirement existente, sem enfraquecer seu bloqueio.
- Segurança existente: operations-tenancy e route-auth-inventory, 132/132.
  Regressão PostgreSQL de operações: 9/9. Nenhuma proteção modificada.
- Quarenta e oito comparações AST com os originais: schema, parsing do provedor,
  consultas, payload/fetch, peso/volume, guard/catch de frete e guard/envelope
  dos quatro métodos Merchant.
- HTTP em ambos os builds locais de produção: 43/43 com NextAuth e 43/43 com
  Better Auth. Cookies realmente emitidos pelo legado, membership revalidada,
  origem irmã, locadora suspensa/vínculo revogado, posse A/B/sem tenant,
  credenciais separadas, falhas/redirect do provedor, opções, custo zero e
  deadline real de 12 segundos nos dois servidores.
- SQL real comprova FORCE RLS de equipamentos e runtime sem superuser/BYPASSRLS;
  integração é filtrada por tenant no registro global. REVOKE temporário de
  SELECT no registro, restaurado em finally, prova o catch 502 anterior sem
  acesso ao provedor.
- Tipos contracts/backend/serviço/raiz/fixtures, dois builds, lint, arch (nove
  pacotes; baseline 1050 intacta), tokens (zero important), nomes, higiene
  891/253, ratchet contra HEAD e gates 183/183 aprovados. Baselines,
  configurações de proteção e contratos de teste não foram ampliados.

Provedor simulado em loopback intercepta exclusivamente as URLs fixas nos
processos de teste; produção não ganha override de endpoint. Nenhum envio real
ao Melhor Envio ou Google. Fixture não altera a implementação do timeout ou a
política de redirects. Logs/capturas ficam no TEMP.

Teardown auditado: 45 tabelas, somente 19 registros de migrations, 31 tabelas
com FORCE RLS e nenhuma role temporária. Um contador da fixture Better Auth já
encerrada foi removido por id/hash/timestamp/count exatos, sem reiniciar
orçamento durante os testes. As três fixtures conservam somente logs, sem
cookies/preloads; seis portas HTTP conferidas fechadas. Handoff canônico
inalterado. PostgreSQL próprio encerrado ao final.

### Estado da API legada

149 rotas/193 métodos/90 GETs e 46 páginas continuam ativos. Serviço parcial:
121 rotas/154 métodos (70 GETs/84 mutações), zero páginas ou método extra; 39
métodos restantes. Contagem mede cobertura HTTP, não conclusão geral.

Clientes, origem/proxy, callbacks, webhooks públicos e scheduler mantêm
configuração legada. Sem commit, push, deploy ou alteração de produção. API
legada não removida, redirecionada definitivamente ou desativada.

### Dívida/risco restante

Merchant precisa das decisões e do provisionamento descritos no bloqueio
existente; endpoints em quarentena não são implementação funcional. Registro de
integrações permanece global e exige filtros de servidor explícitos. Frete usa
medidas da simulação e preserva o fallback estimado no frontend, sem alterar
ligação da tela ou comportamento de consumidor.

Conta/token/provedor reais, proxy/DNS público e rollout não certificados. Jobs
continuam em um único host legado. Inbox concorrente da entrada 241, identidade,
SaaS/mobile e aposentadoria da raiz permanecem fora desta onda e pendentes.

### Próximo corte recomendado naquela onda

Caracterizar e compartilhar analytics/dashboard/kpis administrativos como um
bloco de leituras: preservar filtros, agregações, papéis e isolamento, sem
misturar migração de scheduler, login ou cutover.

## Onda 53 — dashboard, KPIs e endpoints aposentados (2026-10-02, sem commit)

### O que foi implementado

GETs de dashboard e KPIs montados em apps/services/api, com os handlers legados
ativos. Agregações e cálculos movidos integralmente para backend/billing;
factory createDashboardRead recebe a transação de locadora. Parsing de datas e
envelopes ficam em backend/http, e os dois hosts compõem as mesmas factories.
Não há lógica financeira duplicada no serviço nem mudança de
cliente/proxy/scheduler.

Analytics/security preservam exatamente as respostas 410 inertes nos dois hosts.
Não há chamadas a módulos, identidade, banco, provedor ou telemetria nesses
handlers. A pequena resposta HTTP estática permanece em cada adaptador porque a
proteção existente exige código inerte; ela não contém regras de negócio.

### Arquivos criados/modificados

- backend/billing: kpi-calculations.ts, financial-metrics.ts, dashboard-read.ts
  e export explícito da factory no index.ts; backend/http: dashboard-read.ts e
  index.
- Composição: lib/dashboard-read.ts (caminho antigo) e
  apps/services/api/src/host/dashboard-read.ts.
- Adaptadores: app/api/admin/dashboard/route.ts (caminho antigo) e
  kpis/route.ts; quatro rotas homônimas no serviço (dashboard, kpis, analytics,
  security). Analytics/security da raiz não foram alterados.
- lib/kpi-calculations.ts (caminho antigo) e lib/financial-calculations.ts
  (caminho antigo) foram movidos, sem consumidores remanescentes. A fachada
  lib/financial-scope.ts (caminho antigo) e seu reexport público sem uso foram
  removidos; o builder interno existente permanece usado por todos os módulos
  financeiros, incluindo estas consultas.
- Caracterização em tests/unit/dashboard-kpis-api.test.ts, prova HTTP/SQL em
  tests/api-host/dashboard-kpis.http.test.ts. Inventário de segurança estendido
  com duas entradas de serviço sob a MESMA invariante RETIRED, sem alterar seus
  limites; casos adversariais comprovam recusa de acesso SQL escondido pelo 410.
- Documentação: esta página, admin-system, analytics-dashboard, ADR de extração,
  modernization e CHANGELOG. Nenhuma baseline ampliada.

### Contratos preservados

Ambos os GETs operacionais exigem FINANCIAL/READ após sessão, seleção explícita
e membership ativa; ADMIN por membership tem acesso, CLIENT é sempre recusado.
Recusas, erros genéricos, transação tenant, filtros tenantId e FORCE RLS foram
preservados. Não foi substituída a autorização real pelos papéis citados no
comentário OpenAPI histórico.

Dashboard ignora query de datas e usa início do mês local e relógio atual.
Receita mensal usa o escopo financeiro BOLETO + RENTAL/DEPOSIT + vínculo com
orçamento/locação + billingStatus PAID, com limite inicial de paidAt e sem
limite final. Demais métricas do período têm limite final. Receita total dos
orçamentos COMPLETED mantém a string Decimal quando não nula e número zero
quando vazia; monthlyRevenue e os indicadores continuam numéricos.

KPI lê o primeiro startDate/endDate; vazio usa os padrões anteriores. Datas
invertidas não ganham nova validação; inválidas chegam ao Prisma e mantêm 500
Internal server error. Seus indicadores por status do gateway permanecem
distintos dos indicadores financeiros por billingStatus. Duração e inadimplência
são históricas, sem filtro de data; receita média e utilização aceitam o
período.

ROI mantém receita inteira da locação atribuída a cada item, custo de manutenção
COMPLETED e compra nula/zero resultando ROI zero. Dashboard mantém as primeiras
dez linhas sem ordenação acrescentada; KPI mantém arrays completos. Lucro mantém
cost + laborCost + partsCost e comparações do mês anterior; sparklines têm sete
dias locais. Nenhuma fórmula foi corrigida ou redefinida nesta extração.

### Testes executados e resultados

- Vinte caracterizações no legado antes da movimentação e os mesmos vinte
  depois, preservando DTO, datas, filtros, cálculos, fallback, permissões e
  falhas.
- Segurança: route-auth-inventory e public-surface, 115/115. A proteção inerte
  foi mantida e testada adversarialmente para as novas rotas aposentadas.
- Trinta e nove comparações AST dos originais: corpos de todos os cálculos,
  consultas/agregações de dashboard, guards/catches dos dois hosts e
  respostas 410.
- HTTP nos dois builds locais de produção: 18/18 com NextAuth e 18/18 com Better
  Auth; cada caso percorre ambos os hosts. Cookies reais, ADMIN/OPERATOR/CLIENT,
  READ/WRITE, vínculo revogado, suspensão, seleção/locadora estrangeira, tipos,
  pagamento PIX/BOLETO/FINE, status/billingStatus divergentes, pagamento futuro,
  manutenção, datas inválidas/invertidas/duplicadas, zeros e cabeçalhos.
- PostgreSQL: runtime temporário sem superuser/BYPASSRLS; sete tabelas da
  consulta com FORCE RLS. Leitura sem filtro sob SET LOCAL exclui dados
  estrangeiros e equipamentos sem tenant. REVOKE SELECT temporário em
  equipments, restaurado em finally, confirma 500 genérico nas consultas e 410
  independente de SQL. Contagens de dados, audit/outbox inalteradas após
  leitura.
- Tipos backend/serviço/raiz/fixtures, ambos os builds e ESLint aprovados.
  Higiene 891/253, com os dois itens mortos removidos em vez de aceitos por uma
  exceção. Gates finais: arch (nove pacotes, 1050 ocorrências pré-existentes
  intactas), tokens (zero important), nomes, ratchet contra HEAD, gates 183/183,
  Markdown, formato, links e diff aprovados. Nenhuma baseline ampliada.

Teardown auditado: 45 tabelas, somente 19 registros de migrations, 31 tabelas
com FORCE RLS, nenhuma role temporária. Um contador de login Better Auth da
fixture encerrada foi removido por id/key/timestamp/count exatos após os hosts
pararem, sem reset de orçamento durante os testes. Três fixtures mantêm somente
logs; seis portas HTTP conferidas fechadas. PostgreSQL próprio encerrado e porta
55442 fechada. Handoff canônico mantém o mesmo SHA256.

A prova usa apenas PostgreSQL/HTTP em loopback. Sem provedor real ou mudança de
produção. Os originais, logs e inventários de evidência estão no TEMP; nenhum
artefato de sondagem foi criado no repositório.

### Estado da API legada

149 rotas/193 métodos/90 GETs e 46 páginas continuam ativos. Serviço parcial:
125 rotas/158 métodos (74 GETs/84 mutações), zero páginas ou método extra; 35
métodos restantes. A contagem mede cobertura de métodos HTTP, não conclusão
geral. Dois métodos desta onda preservam quarentena, sem reativar uma
funcionalidade.

URLs/base dos clientes, proxy, callbacks, webhooks públicos e scheduler
continuam configurados para o legado. Sem commit, push, deploy, produção ou
cutover.

### Dívida/risco restante

Os indicadores preservam as limitações existentes: ROI pode atribuir
integralmente a mesma receita a equipamentos distintos; o comentário Top 10 por
ROI não corresponde a uma ordenação SQL; custos de manutenção podem somar total
e suas parcelas; o nome mrr representa a receita de boletos da locadora, não
assinatura SaaS. Revisar essas definições exige mudança funcional própria com
regras e contratos aprovados; a extração não certifica a precisão econômica
desses nomes.

Ainda faltam identidade, mutações da seleção, endpoints remanescentes,
scheduler, paridade SaaS/mobile e operação/cutover. Inbox concorrente da entrada
241 continua pendente. Analytics/security não devem voltar a expor dados
globais.

### Próximo corte recomendado naquela onda

Compor PUT de permissões e preservação dos endpoints operacionais aposentados e
do catch-all neutro, mantendo a invariante inerte. Depois, finalizar mutações
públicas, seleção e identidade antes da migração dos jobs e do corte
operacional.

## Onda 54 — permissões, endpoints aposentados e 404 neutro (2026-10-02, sem commit)

### O que foi implementado

Doze métodos adicionais montados no serviço: PUT de permissões, seis respostas
operacionais 410 e os cinco métodos do catch-all 404. A API legada permanece
ativa. Schema anterior movido para contracts/permissions; substituição
transacional única em backend/identity e parsing/DTO em backend/http. Os dois
hosts compõem essas implementações, sem copiar regra de negócio para o serviço.

As respostas estáticas de quarentena continuam no adaptador, sem importar ou
chamar identidade, dados, provisionamento ou storage. A mesma invariante RETIRED
do inventário protege os novos 410. O catch-all preserva a mensagem anterior
literal, inclusive a repetição, sem corrigir comportamento durante a extração.

### Arquivos criados/modificados

- packages/contracts/src/permissions.ts e export explícito no package.json;
  registro de responsabilidade em tools/ratchet-transfers.json, sem ampliar
  baseline.
- packages/backend/src/modules/identity/tenant-permissions-write.ts e index;
  packages/backend/src/http/permissions-write.ts e index.
- lib/permission-rows.ts (caminho antigo) e
  apps/services/api/src/host/permission-rows.ts; adaptadores de
  admin/permissions na raiz e no serviço.
- Novas rotas no serviço: admin/seed-admin (GET/POST), test-login (POST),
  fix-storage (POST), supabase-setup (GET/POST) e [...rest] (cinco métodos). Os
  quatro endpoints operacionais e o catch-all legados não foram alterados.
- Caracterização: tests/unit/permissions-update-api.test.ts; paridade real:
  tests/api-host/permissions-retirement.http.test.ts. Fixture do runtime ganha
  somente INSERT/DELETE em permissions além do SELECT anterior, com REVOKE no
  teardown; não é GRANT ou migration de produção.
- Inventário de autorização: entradas inertes correspondentes e mutação em
  memória da guarda ADMIN do serviço. Documentação de permissões, ADR,
  modernization, known-issues 242, esta página e CHANGELOG atualizados.

### Contratos preservados

Sessão, seleção explícita, organização/membership ativa, ADMIN do vínculo e CSRF
central precedem o parsing. Grants USERS/MANAGE de outros papéis não autorizam
essa administração. O corpo conserva uma lista de 1 a 100 entradas de um único
papel FINANCIAL, OPERATOR ou CLIENT, enums anteriores e descarte de campos
extras. tenantId sempre vem do principal.

Dentro da mesma transação tenant, aguarda-se o advisory lock por tenantId/papel
antes de deleteMany, createMany com skipDuplicates e findMany. Outros papéis,
outras locadoras e linhas sem tenant ficam intactos. O DTO conserva success,
linhas completas, ids e datas, sem ordenação, auditoria ou outbox acrescentadas.
Zod conserva 400 com issues; JSON malformado e falhas inesperadas conservam 500
genérico.

Endpoints aposentados conservam 410 { error: 'Endpoint retired' }, inclusive
anônimos ou com corpo malformado. Caminhos desconhecidos conservam 404 com error
'Not Found', message 'Endpoint não encontrado não encontrado' e code
'NOT_FOUND'. Não há cookie ou efeito. Rotas concretas têm precedência e métodos
não implementados nelas conservam 405.

### Testes executados e resultados

- Antes da extração: 41 caracterizações do legado passaram. Depois: 82 casos dos
  dois hosts e 30 regressões da leitura existente, 112/112.
- Segurança: route-auth-inventory e external-endpoints, 167/167; caso
  adversarial adicional confere que remover ADMIN no serviço reprova o mesmo
  inventário. As respostas inertes continuam recusando acesso SQL oculto.
- Vinte e quatro comparações AST: schema completo, papel/lock, quatro instruções
  da transação, guards/catches, parsing, GET legado inalterado e seis
  respostas 410.
- HTTP nos dois builds locais de produção: 28/28 com NextAuth e 28/28 com Better
  Auth. Cada caso percorre ambos os hosts, com cookies reais, principal, CSRF,
  revogação/suspensão, grants, campos extras, limites, erros e precedência.
- PostgreSQL: role temporária sem superuser/BYPASSRLS e permissions com FORCE
  RLS; leitura sem filtro exclui linhas estrangeiras e sem tenant. Falha real de
  INSERT por trigger temporário prova rollback integral do delete. Dois
  escritores, um por host, aguardam o mesmo lock e terminam com uma proposta
  completa, nunca a união das propostas. Outro papel tem uma chave de lock
  independente, comprovada em conexão SQL separada.
- Tipos contracts/backend/serviço/raiz/fixtures, builds dos dois hosts e ESLint
  passaram. Gates 183/183, arch nove pacotes (1050 ocorrências pré-existentes),
  tokens zero important, nomes 438/3 exceções existentes, higiene 891/253 e
  ratchet contra HEAD aprovados. Nenhuma baseline foi ampliada.

A primeira hipótese da nova prova concorrente, de que uma terceira requisição
HTTP poderia avançar no mesmo processo bloqueado, foi refutada: o runtime tem
pool max 1 e a autenticação esgota a espera de conexão, retornando 401. A prova
foi ajustada ao comportamento existente, mantendo os dois escritores reais e
documentando a limitação na entrada 242. Nenhum teste anterior foi relaxado e o
pool de produção não foi alterado.

Teardown auditado: 45 tabelas, somente 19 registros de migrations, 31 tabelas
com FORCE RLS, zero roles, triggers ou funções temporárias. O contador de login
da fixture Better Auth foi removido por id/key/count/timestamp exatos somente
após o encerramento dos hosts, sem reset de orçamento durante a prova. Três
diretórios de fixtures conservam apenas logs; seis portas HTTP fechadas.
PostgreSQL próprio encerrado. Handoff canônico com SHA256 inalterado.

### Estado da API legada

149 rotas/193 métodos/90 GETs e 46 páginas continuam ativos. Serviço parcial:
130 rotas/170 métodos (77 GETs/93 mutações), zero páginas ou métodos extras; 23
métodos declarados restantes. A cobertura é aproximadamente 88,1% dos métodos
HTTP, incluindo respostas inertes; não mede conclusão geral.

O catch-all não substitui endpoints concretos ainda ausentes: uma URL que existe
somente no legado continua sem paridade no serviço. Clientes, proxy, callbacks,
webhooks públicos e scheduler seguem configurados para o legado. Sem commit,
push, deploy, produção ou cutover.

### Dívida/risco restante

Identidade, mutações da seleção, contact/orcamentos, send-boleto, drei-proxy e
nove crons ainda precisam de composição/paridade. SaaS, mobile e operação final
continuam pendentes. A limitação do pool (242) e a recepção concorrente da inbox
(241) exigem diagnóstico/correção próprios; esta extração não as resolve.
Aposentados não devem voltar a executar provisionamento global.

### Próximo corte recomendado naquela onda

Compor seleção POST/DELETE e mutações públicas usando os módulos existentes,
seguido dos endpoints de identidade e assets. Depois migrar os jobs em bloco,
sem executar dois schedulers nem remover a API legada antes da prova integral e
da decisão operacional.

## Onda 55 — identidade, seleção e mutações públicas (2026-10-02, sem commit)

### O que foi implementado

Dez métodos adicionais foram montados no serviço: POST/DELETE de seleção de
locadora, POST contact, POST orcamentos, POST admin/quotes/[id]/send-boleto, GET
drei-proxy/[...path] e GET/POST de auth/[...nextauth] e auth/v2/[...all].
Nenhuma rota legada foi removida nem URL de cliente alterada.

A política de seleção anterior agora é uma factory HTTP compartilhada, ligada à
sessão, consulta de vínculo e origem reais de cada host. ContactSchema foi
movido, com as mesmas validações, para o contrato de orçamento; a transação que
cria o contato e seu evento ficou em backend/quotations. O alias localizado
delega ao handler de orçamento instalado, e o envio de boleto compõe o serviço
durável existente. Não há outra implementação das regras no host API.

Os engines de identidade usam as factories e os budgets existentes do backend. O
wrapper de indisponibilidade do NextAuth foi movido para backend/http. O proxy
HDR usa uma única allowlist e um fetch injetado, preservando o protocolo
binário. Exportações públicas sem consumidores após os movimentos foram
retiradas; os símbolos internos usados pelo produto permanecem.

### Arquivos criados/modificados

- packages/contracts/src/quotations.ts e lib/validations/index.ts (caminho
  antigo): schema anterior e fachada compatível.
- packages/backend/src/modules/quotations/contact.ts e index.ts: transação única
  de contato com outbox.
- packages/backend/src/http/organization-selection-handler.ts,
  legacy-auth-response.ts, drei-assets.ts, success-response.ts e index.ts:
  factories e envelopes compartilhados.
- lib/organization-selection.ts, (caminho antigo) contact-request.ts, auth.ts e
  quote-code.ts; app/api/contact/route.ts (caminho antigo) e
  drei-proxy/[...path]/route.ts: composição legada sobre o código compartilhado.
  Index de identity remove somente reexportações sem consumidor de produção.
- apps/services/api/src/host/organization-selection.ts, mutation-origin.ts,
  contact-request.ts, session.ts e payments.ts; adaptadores dos dez métodos
  acima: dependências reais, sem imports de implementação do cliente.
- tests/unit/public-identity-composition-api.test.ts e
  tests/api-host/public-identity-composition.http.test.ts: contratos e prova
  HTTP. organizations.http.test.ts conserva a caracterização anterior da seleção
  e passa a verificar as escritas instaladas nos dois hosts.
- route-auth-inventory, public-surface, auth-unavailable e nextauth-route:
  resolução do código movido e regressões de segurança. Documentação de seleção,
  boot, ADR, modernization, CHANGELOG e esta página atualizados.

### Contratos preservados

Seleção continua exigindo sessão antes de dados, origem própria nas mutações e
vínculo ativo da identidade com a organização ativa. Cookie host-only, HttpOnly,
SameSite=Lax, Secure em produção e duração de 30 dias representam preferência,
sem conceder acesso. Papel enviado pelo cliente é ignorado. GET revalida o
vínculo; DELETE limpa a preferência sem consultar dados de negócio. Códigos
401/400/403/415/503, cache, Vary e valores exatos do cookie são preservados.

Contato conserva limite antes do parsing, resolução da locadora, CSRF da borda,
Zod, quoteCode, dados anteriores e transação com notificação durável. Responde
202 com deliveryStatus queued; não confirma entrega de mensagem. Equipment
continua sendo campo informativo aceito, sem acrescentar armazenamento ou regra.
tenantId e preço não são confiados ao corpo.

Orcamentos conserva o pricing do servidor e só adapta a resposta 201 para
totalValue, com a representação Decimal anterior. Outras respostas passam
intactas. Send-boleto conserva FINANCIAL/WRITE, limite, origem, obrigação,
PaymentAttempt e notificação deduplicada; responde 202, sem emitir cobrança ou
chamar Asaas na prova com a tentativa já emitida.

NextAuth e Better Auth conservam os namespaces, modo configurado e sessão.
Indisponibilidade do callback de credenciais conserva 503, Retry-After e
no-store; `/v2` conserva 410 quando Better Auth é o motor primário. Instalação
local do endpoint não altera flags, callbacks de provedores ou origem pública.

Assets continuam aceitando somente hdri e nome HDR permitido, no revision
anterior do upstream. Caminhos inválidos são recusados antes de fetch. Cache,
octet-stream, nosniff, ausência de CORS e erros permanecem iguais. A prova HTTP
não acessou GitHub; conteúdo válido e URL fixa foram conferidos com fetch
injetado.

### Testes executados e resultados

- 119 casos consolidados de caracterização/regressão passaram, incluindo os 46
  novos contratos entre hosts, seleção anterior, composição legada e runtime de
  identidade. A nova caracterização exige explicitamente que o handler retorne
  uma Response; não usa non-null assertion para esconder ausência de resposta.
- 159 casos de segurança passaram: inventário estrutural, superfície pública,
  indisponibilidade e rota NextAuth real. O inventário segue o fechamento real
  das factories e os imports injetados dos hosts; remover a recusa de sessão ou
  origem, antecipar SQL ou reescrever portas em memória reprova as invariantes.
  Helpers privados são conferidos na origem real, sem manter exportações
  públicas artificiais só para o teste.
- Dezoito comparações AST conferiram schema, política de seleção, wrapper,
  quatro instruções da transação, aliases, engines, allowlist HDR e envelope.
  Somente chaves de um retorno simples e NextResponse/Response foram
  normalizados para a comparação de transporte; cálculos e mensagens intactos.
- HTTP nos builds locais de produção: 21 casos novos e 26 regressões de seleção
  com NextAuth; os mesmos 47 com Better Auth. Cookies são emitidos pelo serviço
  e lidos nos dois hosts. Sem sessão, vínculo estrangeiro/revogado, origem irmã,
  dados inválidos e seleção conflitante não produzem efeitos.
- PostgreSQL: role temporária sem superuser/BYPASSRLS e 31 tabelas com FORCE
  RLS. Contato e orçamento gravam somente na locadora validada; um trigger
  temporário que recusa a outbox prova rollback do contato, sem linha órfã.
  Repetir send-boleto nos dois hosts deixa um único evento para a tentativa.
  Controle SQL positivo na locadora própria e leitura sem filtro na estrangeira
  conferem a fronteira tenant.
- Tipos de backend, serviço, raiz e fixtures, builds dos dois hosts e ESLint
  passaram. Gates 183/183; arch nove pacotes, 1050 ocorrências anteriores;
  tokens zero important; nomes 438/3 exceções; higiene 891/253 e ratchet contra
  HEAD aprovados. Nenhuma baseline foi alterada neste incremento.

A primeira rodada HTTP encontrou três expectativas novas sem o prefixo de tenant
da dedupeKey. A chave existente da outbox é composta pela locadora e pela chave
fornecida; as expectativas foram corrigidas para essa política, sem alterar
produção. A verificação adicional de tipos encontrou ausência de estreitamento
de Response e inferência de maps de headers nas fixtures; somente as anotações e
a exigência de resposta foram ajustadas, sem remover asserções.

Teardown auditado: 45 tabelas, somente 19 registros de migrations, zero roles,
triggers, funções ou contadores de fixture. O contador expirado de login foi
removido por id/key/count/timestamp exatos após os hosts encerrarem. Os cinco
diretórios das provas contêm só logs e as dez portas HTTP estão fechadas.
PostgreSQL próprio encerrado. Handoff canônico preservado.

### Estado da API legada

149 rotas/193 métodos/90 GETs e 46 páginas continuam ativos. Serviço parcial:
136 rotas/180 métodos (80 GETs/100 mutações), zero páginas ou métodos extras; 13
métodos declarados restantes. Cobertura aproximada de 93,3% dos métodos,
incluindo respostas inertes; não representa progresso geral do produto.

Clientes, proxy, callbacks públicos e scheduler seguem usando o legado. Sem
commit, push, deploy, produção, cutover ou execução de um segundo scheduler.

### Dívida/risco restante

Quatro endpoints auxiliares de credenciais e nove jobs ainda precisam de
composição/paridade. Também faltam cutover operacional, validação integral dos
consumidores, SaaS, mobile e aposentadoria segura da estrutura antiga. As
limitações de concorrência da inbox (241) e do pool (242) permanecem; montar os
engines no novo host não as corrige. Não há autorização implícita para trocar o
scheduler ou remover `app/api` (caminho antigo) ao atingir a contagem total.

### Próximo corte recomendado naquela onda

Compor register, forgot-password, reset-password e verify-email sobre os
serviços existentes, preservando tokens, budgets, anti-enumeração, transações,
mailer e erros. Depois compor os nove jobs com scheduler legado ainda único,
usando provas locais que não façam entregas ou chamadas a provedores reais.

## Onda 56 — fluxos auxiliares de credenciais (2026-10-02, sem commit)

### O que foi implementado

POST register, forgot-password e reset-password e GET verify-email foram
compostos no serviço. Os handlers legados delegam às mesmas factories em
backend/identity e backend/http. Cada host injeta banco, motor configurado,
limitadores, execução após a resposta e remetente. Guard de origem e manutenção
recusam antes do corpo e dos efeitos. Não há fallback entre motores.

### Arquivos criados/modificados

- `packages/contracts/src/credentials.ts` e entrypoint: schemas e limite de
  e-mail anteriores. Usados no transporte e na busca exata de credenciais.
- `packages/backend/src/modules/identity/credential-accounts.ts`: criação da
  conta, emissão e consumo de tokens, com as transações anteriores.
- `packages/backend/src/http/credential-accounts.ts`: parsing, mensagens
  neutras, status e redirecionamentos. Factories exportadas pelos entrypoints
  existentes.
- `lib/credential-accounts.ts` (caminho antigo),
  `apps/services/api/src/host/credential-accounts.ts` e composição de sessão:
  dependências reais. Quatro adapters em cada host.
- Testes de unidade/HTTP, inventário de autorização e mocks antigos para as
  portas consumidas. Fixture concede privilégios necessários de users e
  verificationtokens, revogados no teardown; nunca BYPASSRLS.
- Fachadas de auth, identidade e branding deixam de reexportar símbolos sem
  consumidor de produto. Implementações internas continuam utilizadas.
  Transferência do entrypoint registrada sem ampliar baseline.

### Contratos preservados

Cadastro mantém trim/lowercase, limite 254, validação anterior e bcrypt 12 antes
da busca legada. Usuário e token UUID de 24 horas são atômicos; colisões P2002
continuam com o mesmo 202 neutro. A conta global não recebe membership nem
ClientProfile. Better Auth cria a conta após a resposta pelo próprio motor,
recebendo headers e Request.

Recuperação responde 200 neutro antes de busca/envio, com orçamento silencioso
anterior. Legado exige titular exato, conserva SHA-256 no banco e substitui
links com TTL de uma hora. Templates, assunto da plataforma e origens mantidos.
Redefinição consome token vigente condicionalmente e atualiza senha na mesma
transação legada; revoga sessões v2 e outros links. Better Auth administra suas
credenciais, tokens e revogação. Erro do motor passa intacto; sucesso conserva a
mensagem anterior. Verificação mantém redirects 307 na origem da Request e
consumo único. No Next, loopback é normalizado para localhost nos dois hosts; a
fixture exige esse endereço, preservando também path/query e status.

### Testes executados e resultados

- 95 caracterizações/regressões, incluindo 72 casos novos nos dois hosts:
  origem, pausa, validação, budgets 429/503, normalização, avisos silenciosos,
  P2002, expiração, ambiguidade e consumo condicional.
- 139 casos de segurança. Inventário rastreia factories até o módulo real e
  exige o guard nos três POSTs de ambos os hosts. Remover, antecipar um efeito
  ou descartar o resultado reprova os casos adversariais em memória.
- Onze regressões de e-mail com Better Auth real e PostgreSQL: resposta precede
  envio; marca, origem do host, equipe e orçamento silencioso preservados.
  Somente o transporte de e-mail é substituído localmente.
- HTTP nos builds locais de produção: 22 casos legacy e 16 Better Auth. Token
  consumido em um host é recusado no outro; senha conferida com bcrypt e sessões
  removidas. Triggers temporários seletivos comprovam rollback de usuário/token
  e senha/token/sessão no legado.
- 29 comparações AST de schemas, helpers, transações e configuração. Gates 183;
  tipos de contracts/backend/serviço/raiz/fixtures, builds de ambos os hosts,
  ESLint, arch, tokens, nomes, higiene e ratchet aprovados. Baselines intactas.

Um hook de import excedeu 10 segundos na rodada paralela; a execução consolidada
com um worker passou sem alterar timeout. Mocks foram completados para o novo
consumo de handleIdentityRequest. O teste tabular de conta desconhecida/ambígua
usa linhas com objeto, garantindo arrays reais em ambos os cenários. Nenhuma
mudança de produção foi feita para ajustar essas expectativas.

Teardown auditado: 45 tabelas, somente 19 registros de migrations, 31 tabelas
com FORCE RLS; zero roles, triggers, funções ou contadores de fixture. A
primeira execução deixou privilégios novos na role temporária; a revogação foi
alinhada ao grant e a role removida após conferir ausência de ownership e
conexões. Budgets foram removidos por chave/count/expiração exatos somente após
encerrar as provas; o contador de autenticação já estava expirado. Os quatro
diretórios HTTP contêm só logs, as oito portas estão fechadas e o PostgreSQL
próprio foi encerrado. Handoff canônico preservado.

### Estado da API legada

149 rotas/193 métodos/90 GETs e 46 páginas ativos. Serviço com 140 rotas/184
métodos (81 GETs/103 mutações), zero páginas ou métodos extras. Nove crons
restantes; cobertura dos métodos 95,3%, incluindo respostas inertes. Clientes,
proxy, callbacks externos e scheduler continuam no legado. Sem cutover, commit,
push, deploy ou alterações de produção. Essa contagem não mede progresso geral.

### Dívida/risco restante

Faltam aceite operacional, validação integral dos consumidores, SaaS e mobile.
E-mail externo não foi enviado na prova HTTP; o envio pelo motor real foi
conferido pela integração com transporte local. Limites concorrentes de
inbox/pool das entradas 241/242 permanecem. Instalar rotas não autoriza retirar
o legado ou criar outro scheduler.

### Próximo corte recomendado naquela onda

Compartilhar a composição dos nove jobs: autenticação de cron, escopo por
locadora, locks, outbox, tentativas e efeitos dos provedores. Instalar adapters
no serviço sem habilitar um segundo scheduler. Validar a onda consolidada antes
de discutir a substituição do host legado.

## Onda 57 — jobs e efeitos compartilhados (2026-10-02, sem commit)

### O que foi implementado

Os nove GETs de cron passam a ser compostos no serviço compartilhado. O legado
continua ativo e usa as mesmas implementações: conversão de orçamentos,
expiração, multas, alertas de boleto, manutenção preventiva, notificações,
verificação de boletos, outbox e quarentena do Google Merchant.

Autorização por CRON_SECRET e comparação constante vivem em backend/http, junto
do runner HTTP de tenants e seu orçamento de execução. Operações de negócio
ficam em billing, operations, communications e outbox. Os hosts injetam a
conexão única, transações RLS e os serviços já existentes; o serviço não importa
lib/ (caminho antigo) da raiz. Nenhuma nova agenda foi instalada. O antigo
vercel.json permanecia byte a byte igual naquele corte, com seus quatro jobs
legados configurados.

Os quatro efeitos de e-mail da outbox e os cinco renderizadores HTML foram
movidos para communications com portas explícitas. As fachadas da raiz mantêm as
funções usadas pelo produto. O tipo de contato foi movido para contracts.
Reexports que perderam consumidores reais foram retirados; implementações
internas e suas provas permanecem, importadas diretamente pelos testes.

### Arquivos criados/modificados

- Na onda 57 de 2026-10-02, nove adapters em apps/services/api/src/app/api/cron
  e os correspondentes da antiga raiz app/api/cron, depois retirada em F.
  Quarentena de Merchant conservada.
- backend/http: cron-authorization, tenant-cron e os três wrappers de jobs cujas
  operações de negócio já eram compartilhadas; runtime/scheduled-job guarda os
  tipos de transação, orçamento e resultado sem dependência do Next.
- backend/billing: boleto-overdue-alerts e verify-boleto-payments;
  backend/operations: preventive-maintenance; backend/communications:
  send-notifications, os quatro efeitos, suas portas e os cinco templates;
  backend/outbox: scheduled-dispatch.
- Composição de tenant-cron, outbox e notification-effects no host, com novos
  consumidores dos serviços existentes de pagamentos, contratos e orçamentos.
- Fachadas de lib/security (caminho antigo) e lib/*-effects, (caminho antigo)
  lib/email-templates (caminho antigo) e lib/email-branding (caminho antigo);
  tipo ValidatedContactData em contracts/quotations. A fachada de tipo
  lib/validations/contact-types (caminho antigo) perdeu seu único consumidor e
  foi removida; a implementação do contrato permanece no pacote universal.
- Caracterização cron-jobs-api, prova HTTP cron-jobs.http, inventário de
  segurança e global-setup HTTP; imports dos testes de componentes internos
  alinhados ao fechamento dos reexports sem consumidor produtivo.
- Exemplo de ambiente do serviço, boot, modernização, ADR e docs de templates.

### Contratos preservados

Bearer ausente/incorreto retorna 401; CRON_SECRET ausente/vazio retorna 503
antes de consulta ou efeito. A lista global lê somente organizações ACTIVE;
negócio e metadados de execução usam transações com contexto RLS. O runner
conserva fairness, checkpoints, isolamento de falhas e resultados por locadora.

Verificação continua limitada a 100 boletos por tenant, com cursor, comparação
Decimal do valor e mutações condicionais, preservando budget de 180 segundos,
reserva de 60 segundos e maxDuration 300. Manutenção conserva exatamente a regra
observada de 90 dias, exclusão de agenda existente e criação para sete dias
depois, inclusive o texto anterior para ausência de manutenção histórica. O cron
de notificações conserva suas etapas independentes e counters; o alerta de
boleto continua apenas registrando IDs, sem dados pessoais nem envio real.

Outbox conserva os treze consumidores, lease, dedupe, rotação, cinco entregas
por tenant, religação de emissões e erro persistido por código. Os efeitos
externos seguem fora das transações. Subjects, recipients, payloads de
renderização, chaves de envio e transações de efeitos são os anteriores. O
Google Merchant continua respondendo 503 após autenticação, sem ser ativado.

### Testes executados e resultados

- Caracterização e outbox SQL: 10 casos; manutenção cobre a fronteira de 90
  dias, bloqueio por agenda existente, prazo de sete dias e escopo; notificações
  cobrem atualização condicional e continuação após falha de uma etapa.
- E-mail e concorrência de conversão: 34 casos. Núcleo SQL de tenant/outbox,
  emissão e marca: 43 casos, incluindo as mesmas quatro provas de marca.
- Reconciliação crítica de boleto: dois casos com banco descartável e provedor
  local. Migrations já aplicadas, sem mudança de schema.
- Segurança: 170 casos. O inventário segue a delegação até a implementação
  compartilhada e confere por AST o wiring exato de guard, banco e runner.
  Mutações em memória que trocam o guard, executam o callback diretamente ou
  substituem o banco reprovam; não houve isenção genérica ou baseline ampliada.
- HTTP real nos builds locais de produção: 18 casos por modo (legacy e Better
  Auth), sempre com os dois hosts. Negativas autenticam antes de qualquer
  efeito; positivas conferem tenants ACTIVE, checkpoints RLS, respostas,
  manutenção idempotente entre hosts e entrega desconhecida consumida uma vez,
  com código persistido e sem payload na resposta. Saída externa real
  desativada.
- 41 provas AST: regras, queries, updates, tratamento de erro, response args,
  runner, autorização, efeitos, templates completos e configuração de cada
  adapter conservados. Inventário: 149 rotas/193 métodos nos dois hosts, 90
  GETs/103 mutações; zero páginas e zero métodos extras no serviço. Legado
  conserva suas 46 páginas; scheduler anterior idêntico.
- Gates 183; tipos de contracts/backend/serviço/raiz/fixtures, builds de ambos
  os hosts, ESLint, formatação, arch, tokens, nomes, higiene e ratchet
  aprovados.

A primeira expectativa HTTP contava só três locadoras de negócio, deixando fora
as organizações ACTIVE criadas para o diretório. A prova passou a comparar com a
consulta de organizações ACTIVE, incluindo seu controle negativo SUSPENDED.
Checkpoints sem userId também expuseram uma lacuna do teardown da fixture; a
limpeza agora inclui somente seus tenantIds. A fixture daquela rodada foi limpa
por IDs exatos, depois de verificar banco descartável, papel sem
ownership/privilégios elevados e nenhuma conexão. Não houve mudança do
comportamento de produção para ajustar as expectativas.

Teardown final auditado: 45 tabelas, somente os 19 registros de migrations, 31
tabelas com FORCE RLS; nenhuma role, contador ou linha de fixture restante. Os
três diretórios HTTP contêm só logs, as seis portas HTTP e a porta do teste
crítico estão fechadas. O PostgreSQL próprio foi encerrado após conferir PID,
diretório e porta; processos do usuário foram preservados. Handoff canônico e
agenda legada permanecem com o mesmo hash.

### Estado da API legada

149 rotas/193 métodos e 46 páginas continuam disponíveis. Serviço com o mesmo
inventário HTTP: a montagem dos métodos está em 100%, incluindo respostas
inertes e funcionalidades em quarentena. Isso não mede conclusão geral, aceite
comercial, deploy ou cutover. Clientes, proxy, callbacks externos e scheduler
continuam no legado. Nenhum commit, push ou operação de produção.

### Dívida/risco restante

Ainda faltam migração dos consumidores, aceite operacional do runtime, callbacks
e scheduler, plano de rollback e critérios de retirada da raiz. Testes com
transporte local não certificam credenciais ou execução comercial no provedor
real. SaaS, mobile e limites de inbox/pool das entradas 241/242 permanecem
pendentes. Dois schedulers não podem operar simultaneamente. Os jobs com canais
ainda não ligados e o Merchant em quarentena continuam assim.

### Próximo corte recomendado naquela onda

Validar a composição integral dos consumidores web/mobile e seus proxies, com
troca reversível e explícita do destino em ambiente local/descartável.
Caracterizar cookies, origem, callbacks, uploads, contratos, webhooks e jobs
antes de qualquer substituição operacional. Só retirar a raiz quando houver
paridade comprovada, aceite operacional e rollback exercitado.

## Onda 58 — consumidores e arquivos públicos independentes (2026-10-02, sem commit)

### O que foi implementado

Web serve public/ pela cópia real já sincronizada no predev/prebuild. A remoção
do rewrite de arquivos elimina sua dependência de WEB_API_ORIGIN; somente as
APIs seguem pelo proxy com a política existente. A validação da origem da API
continua única em resolveWebPlatformEnv, sem repetição em next.config.

Expo concentra apiBaseUrl e resolução das imagens relativas em host/api-config.
EXPO_PUBLIC_ASSET_URL é opcional: vazia preserva a origem antiga da API; quando
configurada exige somente origem HTTP(S), sem credenciais/caminho/query/hash.
URLs absolutas ficam intactas. Nenhuma regra de negócio foi para os clientes.
Exemplos próprios permitem API em 3002, arquivos no web e rollback para 3000. O
exemplo da raiz conserva o legado; não foram editados ambientes existentes.

### Arquivos criados/modificados

- Criados: apps/clients/web/.env.example, apps/clients/mobile/.env.example,
  mobile/src/host/api-config.ts e api-config.test.ts,
  tests/api-host/web-consumer.ts e web-consumers.http.test.ts.
- Modificados: web/next.config.mjs e next.config.d.mts; web/src/proxy.ts e
  host/routing/route-table.ts (comentários); next-config.test.ts;
  apps/clients/mobile/src/host/auth/client.ts e
  apps/clients/mobile/app/(public)/equipamentos.tsx; .env.example,
  API/.env.example, .github/workflows/ci.yml e tests/api-host/global-setup.ts
  (limpeza exclusiva dos registros da fixture depois de encerrar os hosts).
- Documentação: esta feature, tenant-hosts-web.md, ADRs de hosts/backend,
  modernization.md, boot.md, known-issues/index e CHANGELOG.

### Contratos preservados

Rotas, métodos, DTOs, cookies, paths dos motores, permissões, seleção de
locadora, allowlists, segredo da borda, CSRF e status permanecem. Auth/config
mantêm apiBaseUrl disponível aos consumidores atuais. Nenhum arquivo público,
CSS, componente do produto, template ou configuração visual foi alterado.
Favicon, fonte e modelo GLB são idênticos byte a byte no transporte real.

### Testes executados e resultados

- test:web: 182 aprovados; sete casos de e2e opt-in não executados nessa suíte.
  O transporte real abaixo foi executado separadamente, sem ativar os opt-ins.
- test:mobile: 52 aprovados, incluindo nove casos novos de configuração.
- web-consumers.http.test.ts: onze aprovados por motor (legacy e better-auth).
  Next start real encaminha à API por uma ponte TLS loopback. O certificado
  temporário é confiado somente pelo processo filho com NODE_EXTRA_CA_CERTS; a
  verificação TLS permanece ativa. OpenSSL é pré-requisito da fixture.
- Provas HTTP: arquivos sem chamada à API; Host real substitui borda forjada;
  query conflitante 400; jobs/admin bloqueados antes do transporte; login real e
  Set-Cookie através do proxy; mesma sessão aceita pelo serviço/legado e pelo
  web após rollback; GET de endereços isolado; origem irmã 403 sem escrita;
  origem própria alcança o schema; cliente HTTP compartilhado do mobile usa
  ambos os destinos, troca escopo sem mesclar e recusa vínculo revogado.
- Build web, tipos web/mobile/testes mobile/fixture e lint aprovados. Exportação
  Metro Android e iOS em TEMP: ambos os bundles aprovados; nenhuma prova de
  dispositivo é inferida disso. Arch, tokens, nomes e higiene verdes.
- test:gates: 183 aprovados; ratchet e validação da documentação aprovados.
  Auditoria após teardown: 45 tabelas, 31 com FORCE RLS, nenhuma linha de
  fixture ou papel temporário; somente as 19 migrations permanecem no banco
  descartável.
- O teardown passou a reconhecer também o prefixo IPv6 normalizado por /64 do
  Better Auth. A remoção se restringe ao subnet exclusivo da execução e ocorre
  depois de encerrar os processos; nenhuma janela foi apagada durante os testes
  nem política de limitação alterada.
- A primeira execução revelou erros na prova: Node fetch descarta Host e o
  usuário da fixture pertence às duas locadoras. Corrigidos pelo transporte
  http.request e pela seleção prevista; domínio/guardas não foram afrouxados.
  Entrada 243 descreve causa, correção e validação.

CI ganha build do consumidor web e verificação de OpenSSL antes de test:api. O
workflow foi verificado localmente; execução remota não realizada.

### Estado da API legada

149 rotas/193 métodos e 46 páginas ativos. Serviço mantém 149/193, sem páginas.
Sem corte de tráfego em ambiente existente, alteração de callback, agenda,
segredo, flags de identidade ou banco de produção. Nenhum commit/push/deploy.
Somente processos de teste próprios são iniciados e encerrados; certificados,
bundles e logs ficam em TEMP. O scheduler legado permanece o único configurado.

### Dívida/risco restante

O ensaio de transporte não certifica navegação renderizada completa, storage em
aparelho, OAuth social/provider real ou DNS/TLS de staging. Uploads, PDFs,
webhooks, callbacks, cache/revalidação entre hosts e execução única dos jobs
exigem aceite operacional integrado. Pendências SaaS/mobile e 241/242 continuam.
Não é autorização para remover app/ (caminho antigo) nem para ativar outro
scheduler.

### Próximo corte recomendado naquela onda

Preparar o aceite operacional local dos consumidores: uploads e downloads,
callbacks/webhooks, cache e composição das credenciais de identidade, com
rollback e uma única autoridade de jobs. Depois validar os fluxos renderizados e
os dispositivos. Manter o legado até as provas do corte inteiro e o aceite de
operação; não inventar domínio, credenciais ou decisão comercial.

## Onda 59 — aceite operacional HTTP/SSR e roteiro de retirada (2026-10-02, sem commit)

### O que foi implementado

Um bloco de provas no caminho completo do web, API/legado e provedores locais. O
transporte da fixture aceita multipart codificado por Request real e conserva
Host, bytes e cabeçalhos; suporta respostas sem corpo. Não foram copiadas regras
nem alterados handlers, composição, DTOs ou telas do produto.

Uploads chegam ao storage privado e produzem hash, path de locadora/usuário e
URL assinada de 300 segundos. Registro emitido pelo serviço continua disponível
quando o web volta ao legado; CSRF e referência estrangeira são recusados antes
do storage. Falha do upload conserva 502 e não cria ClientDocument.

PDF mantém bytes e headers nos dois caminhos; só instante/ID voláteis do PDFKit
são normalizados na comparação. OAuth atravessa o proxy com redirect_uri fixo,
cookie, state escopado, troca local e consumo único; autorização iniciada no
serviço também conclui depois do rollback. Cache público alterna Host sem
misturar dados. O h1 real do equipamento é renderizado pelo gateway para cada
locadora; remover scripts da prova evita confundir Flight/JSON-LD com markup.

Crons continuam bloqueados em todos os hosts web, inclusive com segredo válido,
sem encaminhamento ou checkpoint. Chamada direta aos dois backends conserva 401
sem segredo e execução sob RLS com a credencial da fixture. A raiz segue como
única agenda configurada: quatro entradas, não nove GETs agendados.

### Arquivos criados/modificados

- Criados: tests/api-host/web-operations.http.test.ts e
  docs/guides/shared-api-acceptance.md.
- Modificado: tests/api-host/web-consumer.ts, somente transporte e hostname da
  fixture; nenhuma alteração de servidor do produto.
- Documentação: esta feature, modernization.md, ADR de backend,
  boot/context-map, getting-started/deployment.md, README de docs,
  known-issues/index e CHANGELOG.

### Contratos preservados

Identidade, cookies, seleção, escopo, papéis, RLS, CSRF, conteúdo de multipart,
paths privados, TTL, compensação, erro de storage, PDF, cache e OAuth conservam
seus contratos. PDF usa no-store; ClientDocument usa private, no-store. Jobs e
webhooks continuam chegando diretamente ao backend, conforme a tabela do proxy.
Nenhum ambiente existente, callback externo, scheduler, segredo ou estilo mudou.

### Testes executados e resultados

- Bloco HTTP/SSR: três arquivos, 43 casos por motor (legacy/better-auth), todos
  aprovados. São 14 casos novos de operação, onze de consumidores e dezoito de
  jobs. API e legado usam artefatos de produção locais; o web usa Next start.
- Tipos da fixture e lint aprovados. Arch, tokens, nomes, higiene e ratchet
  aprovados, sem ampliar baselines; test:gates: 13 arquivos/183 casos aprovados.
- Builds anteriores permanecem os artefatos exercitados; não houve mudança de
  código de produção que exigisse repeti-los. Bundles não foram repetidos, pois
  mobile permaneceu intacto nessa onda. CI remoto não executado.
- A prova inicialmente presumiu private, no-store no PDF e 401 no web para cron.
  Código/testes anteriores confirmaram no-store e bloqueio 404 antes do
  transporte; as novas expectativas foram corrigidas sem alterar a aplicação.
- Renderização revelou normalização de 127.0.0.1 para localhost em NextURL.
  Servidor e requisições da fixture agora usam localhost, mantendo rewrite
  interno. Causa e validação na entrada 244; nenhum guard foi afrouxado.
- O motor é selecionado por API_AUTH_MODE. Uma tentativa com outro nome repetiu
  legacy e não foi contabilizada como prova Better Auth; a execução final
  anunciou better-auth explicitamente e aprovou os 43 casos.

### Estado da API legada

Ativa com 149 rotas/193 métodos e 46 páginas; serviço com o mesmo inventário e
sem páginas. Handoff e agenda preservados. Sem commit, push, deploy, corte de
tráfego ou operação em produção. Processos, TLS e dados pertencem à fixture
local.

### Dívida/risco restante

SSR não certifica hidratação/interações no navegador ou paridade nativa. Dublês
não certificam callbacks externos ou pagamentos reais. Cache aqui é a fase
dinâmica/no-store vigente; ISR/revalidação não foi implantado. Docker/staging,
DNS/TLS, observabilidade/capacidade e execução em dispositivos exigem provas
próprias. Issues 240–242, pendências SaaS/mobile e aceite comercial permanecem.

### Próximo corte recomendado naquela onda

Avançar o aceite dos fluxos renderizados e os problemas de recuperação e
concorrência existentes, conforme
[roteiro operacional](../guides/shared-api-acceptance.md). Antes da retirada da
raiz, revisar todos os consumidores/entrypoints e obter provas de callbacks e da
autoridade única de jobs no ambiente. Nenhuma igualdade de inventário ou ensaio
local autoriza excluir app/ (caminho antigo) antecipadamente.

## Onda 60 — recuperação da inbox e cookie OAuth (2026-10-03, sem commit)

### O que foi implementado

A recepção inicial de eventos concorrentes passa por inserção atômica no banco e
leitura do registro vencedor, na mesma transação de locadora. Isso elimina a
corrida do upsert vazio do Prisma. Hash e tenant continuam conferidos antes de
enfileirar a outbox; payloads anteriores não são substituídos. A aquisição do
lease e a execução do consumidor conservam o fluxo anterior.

O callback Zoho valida o formato do JSON antes de ler suas propriedades. null,
arrays e primitivos recebem o redirect 307 de estado inválido, sem consumir
autorização SQL, alterar tokens ou acessar o provedor; o cookie é limpo. States
válidos, replay, escopo de locadora/usuário e guard de origem permanecem iguais.

### Arquivos criados/modificados

- Criado: tests/unit/webhook-inbox-concurrency.test.ts.
- Produção: packages/backend/src/modules/outbox/webhook-inbox.ts e
  packages/backend/src/http/zoho-oauth-callback.ts; os hosts consomem a mesma
  implementação, sem cópia de regras ou novo handler.
- Provas: tests/security/webhook-inbox.test.ts,
  tests/unit/zoho-oauth-api.test.ts, tests/api-host/whatsapp-write.http.test.ts
  e tests/api-host/zoho-oauth.http.test.ts. tests/api-host/identity.ts usa
  endereço reservado da execução também nas sondas do cache de cookies.
- Documentação: esta feature, modernization.md, ADR de extração, roteiro de
  aceite, integração Zoho, known-issues/index e CHANGELOG.

### Contratos preservados

Identidade, RLS, credenciais por integração, chave externa, hash autenticado,
conflito 409, lease de 120 segundos, outbox durável, consumidores e resposta de
retry mantidos. Falha real de persistência ainda responde 503, sem causa
interna; recepção duplicada inicial não deve gerar esse erro por disputa da
chave única. Nenhum schema, grant, pool, agenda, URL pública, estilo ou ambiente
externo mudou. A desconexão Zoho ainda conserva state pendente conforme o
contrato vigente; revogação externa não foi escolhida implicitamente.

### Testes executados e resultados

- Antes da correção: dez regressões falharam. Barreira SQL com dois pools
  independentes produziu 200/503 e P2002 nos quatro provedores; conflito de
  payload também gerou 503. null lançou TypeError no callback.
- Depois: 40 casos de unidade/banco aprovados, incluindo nove de concorrência,
  RLS, lease, rollback e recuperação. Papéis de runtime sem SUPERUSER/BYPASSRLS;
  INSERTs concorrentes comprovadamente chegam à barreira, evitando teste vazio.
- Segurança: três arquivos/177 casos aprovados (inbox, endpoints externos e
  inventário de autorização).
- HTTP: cinco arquivos/252 casos aprovados com legacy e mais 252 com Better
  Auth, contra ambos os builds de produção locais. Cobrem WhatsApp, pagamentos,
  contratos/assinatura, OAuth e jobs; cookies reais e provedores locais.
- Lint, typecheck, type-check e builds do serviço/legado aprovados. Arch,
  tokens, nomes, higiene e ratchet aprovados sem ampliar baselines; gates: 183
  casos. O web/mobile não mudou; builds e bundles desses consumidores não foram
  repetidos. CI remoto e provedores externos não foram executados.
- Auditoria encontrou dois contadores Better Auth com chave de loopback, pois
  login/sonda sem IP explícito não pertenciam à rede reservada limpa pelo
  teardown. O código instalado do motor lê x-forwarded-for, separadamente do IP
  da borda usado pelo guard da plataforma. O helper fornece o mesmo endereço
  reservado nas duas camadas, preservando a escolha explícita do teste. Nenhum
  orçamento é limpo durante a suíte. O bloco HTTP foi repetido após essa
  correção.
- Auditoria final: 45 tabelas, somente 19 registros de migrations; zero dados,
  papéis ou funções da fixture restantes, com 31 tabelas em FORCE RLS.

### Estado da API legada

Ativa, com 149 rotas/193 métodos e 46 páginas. O serviço conserva o mesmo
inventário sem páginas. Ambos recebem as correções compartilhadas. Scheduler e
checkpoint canônico preservados; sem commit, push, deploy ou corte de tráfego.

### Dívida/risco restante

A entrada 241 registra agora a causa confirmada e a correção da disputa de
inserção. Retry para falhas reais, crash ou consumo pendente continua
necessário. A limitação do pool de conexão única (242) não foi resolvida
aumentando o pool: é necessário um orçamento de conexões compatível com o
ambiente e prova de carga. A desconexão/revogação Zoho (parte restante da 240),
aceite interativo, dispositivos, operação externa e etapas SaaS/mobile continuam
pendentes.

### Próximo corte recomendado naquela onda

Na recomendação da onda 60 (2026-10-03), avançar os fluxos interativos dos
clientes e a recuperação sob carga, conservando o roteiro de aceite e rollback;
resolver o dimensionamento com evidência do ambiente antes de transferir a
autoridade de jobs ou retirar a antiga raiz app/, depois aposentada apenas no
clone F. Os testes locais daquela onda não eram publicação nem conclusão geral
da modernização; capacidade e autoridade de jobs em ambiente externo continuam
exigindo prova própria.

## Onda 61 — integração do carrinho dos consumidores (2026-10-03, sem commit)

### O que foi implementado

O hook antigo, sem chamador e com payload incorreto, foi substituído por uma
implementação universal consumida pelo RuntimeBootstrap através dos índices
web/native da feature. Só inicia HTTP para CLIENT confirmado, com escopo local
pronto e vínculo correspondente à locadora da rota. O cliente captura a seleção
no host apps/clients/mobile; host de locadora não envia x-tenant-id.

Primeira mesclagem usa localCartItems e aplica a resposta completa; aparelho
vazio usa GET. Depois da carga, alterações e remoções usam items em POST sync,
com debounce de 300 ms e escrita serial. Carrinho já sincronizado, sem edição,
consulta o servidor, respeitando mudanças de outro aparelho. Preço/metadata
isolados não geram escrita. O carrinho anônimo continua separado após login.

Marcas persistidas distinguem carga inicial, edição pendente e remoção/limpeza
anterior à primeira resposta. Retry/reload não ressuscitam itens removidos,
inclusive após uma mesclagem que foi gravada mas cuja resposta se perdeu; itens
somente remotos continuam preservados. O token de abertura do escopo e
cancelamento protegem respostas tardias. Alterações durante a leitura são
conciliadas antes da hidratação única; falha conserva o estado local e oferece
tentativa explícita, sem loop automático de retry.

O mapper usa preço base, descontos e valores/flags diretos do catálogo. A taxa
diária da linha já é ajustada e não deve receber desconto novamente. Preserva
strings decimais, zero e datas/opções locais; os totais permanecem no domínio.

### Arquivos criados/modificados

- features/carrinho/model/sincronizar.web.ts foi movido para sincronizar.ts;
  teste do mapper acompanha o nome universal. Hook novo e provas de ciclo em
  sincronizar.hook.test.tsx, ambos dentro de packages/frontend/src.
- features/carrinho/model/carrinho.ts: metadata de sincronização persistida,
  confirmação da escrita e token de escopo; index.ts/index.native.ts compõem o
  mesmo hook.
- packages/frontend/src/app/providers/RuntimeBootstrap.tsx e
  RuntimeBootstrap.cart.test.tsx, no frontend compartilhado: composição, gate
  inicial e aviso/tentativa.
- tests/api-host/cart-consumer.http.test.ts: consumidor real conectado aos dois
  hosts com cookies e PostgreSQL RLS. A perda de resposta é simulada depois que
  a API real confirma a gravação, sem mock do handler ou da autenticação.
- tools/hygiene-baseline.json perde somente as exceções do hook agora usado;
  nenhum item/tolerância foi acrescentado. Contratos/ADRs/features/issues,
  roteiro de aceite e CHANGELOG atualizados.

### Contratos preservados

GET sync, POST sync com items e POST merge com localCartItems, inclusive suas
diferenças, permanecem idênticos nos dois hosts. Frontend envia apenas
equipmentId/quantity/days; catálogo, preços, identidade, limites, RLS e
validação continuam no backend. Não há nova regra de negócio ou dependency no
host HTTP. Carrinhos locais antigos continuam legíveis; separação
locadora/usuário e visitante foi conservada. Nenhum schema de banco, cookie,
secret, agenda, ambiente real, cor ou CSS foi alterado.

### Testes executados e resultados

- Carrinho/providers: 17 arquivos, 154 casos aprovados. Protegem wiring real do
  bootstrap, awaitSession, papéis, seleção divergente, login/escopo anônimo,
  payloads, preços, serialização, falha/retry, reload, remoções, edições durante
  leitura/escrita e respostas antigas, inclusive ida e volta ao mesmo escopo.
- HTTP: dois arquivos, 112 casos por motor (legacy e Better Auth), ambos contra
  o serviço e o legado em builds locais de produção. Consumidor usa HttpClient
  real, cookies e RLS. Inclui merge, totais, edição/remoção, retomada após
  reload e resposta descartada após gravação; contrato completo mantém as provas
  de validação, isolamento, CSRF, locks, FKs e rollback.
- Typecheck de todos os 12 projetos e verificação própria do novo teste HTTP
  aprovados; lint dos arquivos alterados aprovado. Build web e exports Android e
  iOS aprovados, com bundles somente em TEMP. Serviço/legado não mudaram; seus
  builds da onda 60 foram reutilizados.
- Arch, tokens, nomes, higiene e ratchet aprovados sem ampliar baseline. Dívida
  de higiene diminuiu de 891/253 para 889 achados/252 itens permitidos; arch
  conserva 1050, sem excesso, e css-important permanece zero.
- Hosts: web 182 casos aprovados/7 skips preexistentes; mobile 52 aprovados.
  Proteções: 13 arquivos/183 casos aprovados. A primeira execução dos hooks de
  commit falhou por sh ausente no PATH; repetição com Git Bash instalado no PATH
  passou, sem alterar testes, hook ou guardas.
- Auditoria do banco descartável: 45 tabelas, somente 19 registros de
  migrations, nenhuma sobra de dados/papéis/funções da fixture e 31 tabelas com
  FORCE RLS.
- Renderização automatizada usa jsdom, e export nativo certifica empacotamento.
  Não houve ensaio novo em aparelho, navegador interativo, provedor externo ou
  CI remoto. Não confundir essas provas com aceite visual/operacional.

### Estado da API legada

Ativa, 149 rotas/193 métodos e 46 páginas na raiz. Serviço conserva 149/193 sem
páginas. Implementação e contratos do carrinho não mudaram neste bloco. Agenda
única e handoff canônico permanecem intactos; sem commit, push, deploy ou troca
de tráfego externo.

### Dívida/risco restante

Issue 233 foi corrigida, com ligação ao consumidor comprovada. Falhas reais de
rede/banco continuam exigindo retry; edição simultânea em aparelhos mantém a
semântica de substituição vigente, sem novo controle de versão do servidor.
Datas/opções locais não foram acrescentadas ao contrato remoto. Aceite
interativo completo do orçamento, dispositivos e fluxos em outras telas ainda
faltam; capacidade/issue 242, revogação Zoho e demais etapas SaaS/mobile também.
Na onda 61 de 2026-10-03, o inventário montado não certificava conclusão geral
nem permitia excluir a antiga raiz app/, depois retirada no clone F.

### Próximo corte recomendado naquela onda

Avançar consumidores de orçamento/perfil/endereços/locações usando o cliente
HTTP e o escopo explícito, com prova interativa quando disponível. Conservar
contratos e regra única de domínio; revisar capacidade e operação antes de
transferir callbacks/jobs ou retirar a raiz legada.

## Onda 62 — consumidor do orçamento (2026-10-03, sem commit)

### O que foi implementado

Página de orçamento e formulário auxiliar passam pelo HttpClient configurado,
sem fetch relativo próprio. Transporte universal no segmento api da página;
catálogo/disponibilidade levam tenantSlug na query, pedido leva o slug no corpo.
Perfil e endereços conservam as rotas privadas e o header de seleção do
bootstrap. O cliente captura o ID da locadora; no modo host continua sem header.
Nenhuma regra foi acrescentada a shared/api ou ao host de servidor.

O hook de ciclo cancela e descarta respostas antigas, inclusive se o transporte
ignora abort. O formulário principal e as preferências de confirmação ficam
separados por locadora/usuário. Preferências globais antigas não são copiadas
para outra locadora. Uma consulta de preço usa os itens atuais, evitando
ressuscitar uma remoção local. O timer da remoção animada é cancelado ao
desmontar o formulário: os 300 ms preservam a animação no escopo atual, sem
apagar o carrinho da próxima conta ou locadora. Falhas HTTP conservam o
carrinho; o fluxo de salvar endereço e perfil mantém resultados parciais e só
envia após sucesso ou escolha explícita de não salvar. Preços, datas,
validações, WhatsApp, termos e layout continuam no fluxo anterior.

### Arquivos criados/modificados

- packages/frontend/src/pages/orcamento/api/quote-api.ts e quote-api.test.ts:
  transporte, contratos e uso da origem configurada.
- packages/frontend/src/pages/orcamento/model/quote-api.ts e quote-api.test.tsx:
  ciclo de requisições por cliente/locadora e descarte após desmontagem.
- packages/frontend/src/pages/orcamento/ui/OrcamentoPage.web.tsx,
  QuoteForm.web.tsx e OrcamentoPage.api.web.test.tsx: integração real da página,
  sucesso/falha, perfil/endereço e troca de escopo.
- packages/frontend/src/app/providers/RuntimeBootstrap.tsx e
  RuntimeBootstrap.client.test.tsx: captura da seleção do cliente.
- tests/api-host/quote-consumer.http.test.ts: transporte contra os dois hosts de
  produção local, cookies reais, RLS e efeitos de perfil/endereço/orçamento.
- tools/hygiene-baseline.json: somente três exceções de tipos agora consumidos
  foram retiradas; nenhuma tolerância nova. Issues, features, ADR, modernização,
  roteiro de aceite e CHANGELOG atualizados.

### Contratos preservados

GET equipments/availability e POST quotes identificam a locadora explicitamente,
como já exigido pelo backend. GET/PUT user/profile, GET/POST addresses e o alias
POST orcamentos conservam métodos, corpos, envelopes e validação. A criação de
endereço retorna {address}; o transporte preserva esse envelope. O builder de
pedido e os cálculos permanecem nas APIs existentes do domínio/frontend.
TenantId/userId privados continuam sendo revalidados pelo servidor, sem confiar
no formulário. Sessões, banco, pagamentos, outbox e scheduler não mudaram.

### Testes executados e resultados

- Orçamento/providers: 47 arquivos, 173 testes aprovados. Incluem formulário
  renderizado, falha/retry, salvamentos parciais, remoção durante consulta,
  resposta de pedido antigo, remoção animada após troca de conta/locadora,
  StrictMode e captura de seleção.
- HTTP: dois casos por motor (legacy e Better Auth), cada rodada contra ambos os
  hosts em artefatos locais de produção. Catálogo, perfil, endereço e pedido
  persistidos, listagem autenticada e perfil da outra locadora preservado.
- Typecheck dos 12 projetos, lint dos arquivos alterados e build web aprovados.
- Exportações nativas Android (6,5 MB) e iOS (6,2 MB) aprovadas, com saída no
  diretório temporário. Exportar o bundle não certifica paridade de tela ou
  funcionamento em aparelho.
- Host web: 182 aprovados e sete skips preexistentes. Gates: 13 arquivos e 183
  casos aprovados. Arch mantém 1050, sem excesso; tokens/nomes/ratchet verdes.
- Higiene caiu de 889 achados/252 itens para 886/251: três tipos usados pela
  implementação deixaram de ser dívida. Não houve ampliação de baseline.
- Banco descartável limpo após as provas: 45 tabelas, somente 19 registros de
  migrations, nenhuma sobra de dados/papéis/funções da fixture, 31 FORCE RLS.
- Formulário em jsdom usa seletor/endereço simulados; demais validações,
  handlers da página e estado são reais. O teste HTTP usa o transporte da
  página, cookies/RLS/servidores reais. Essas provas não certificam aparência,
  aparelho, entrega externa ou produção. Não houve novo aceite visual
  interativo.

### Estado da API legada

Ativa, sem retirada ou troca de tráfego. São 149 rotas/193 métodos e 46 páginas
na raiz; serviço conserva 149/193, sem páginas. Handoff canônico e agenda única
intactos. Sem commit, push, deploy ou alteração em ambiente real.

### Dívida/risco restante

Outras páginas ainda têm consumidores antigos. O orçamento nativo completo
continua pendente; criar um transporte universal não cria a tela mobile. Datas,
opções de carrinho, textos institucionais e estimativa local de frete continuam
com os contratos anteriores. O formulário auxiliar conserva seus campos/alias,
inclusive validações que exigem um corte próprio. Aceite visual/dispositivos,
capacidade (issue 242), revogação Zoho, etapas SaaS e retirada da raiz continuam
no escopo geral. Presença de rota ou build verde não representa conclusão total.

### Próximo corte recomendado naquela onda

Conectar perfil e área do cliente ao mesmo transporte configurado e ao escopo
explícito; completar os consumidores de endereços/orçamentos/locações e suas
provas de navegação. Continuar paridade mobile e SaaS; só retirar app/ (caminho
antigo) após composição, consumidores, callbacks/jobs e aceite operacional
comprovados.

## Onda 63 — consumidores de perfil e endereços (2026-10-03, sem commit)

### O que foi implementado

Perfil e gestão de endereços consomem o HttpClient configurado pelo bootstrap. A
entidade cliente reúne transporte privado usado por essas duas páginas e pelo
orçamento: nenhuma regra de backend foi copiada para um host ou para shared. O
hook genérico useScopedApiClient foi extraído do ciclo do orçamento e mantém
cancelamento/descarte após troca ou desmontagem, inclusive quando o transporte
ignora abort. Também respeita o signal explícito de uma chamada.

As páginas reiniciam dados, formulário e edição por usuário/locadora. Escrita
antiga não inicia a releitura nem apresenta sucesso na nova tela. Falhas de
salvamento conservam o rascunho e permitem nova tentativa. PUT/releitura e
cancelar do perfil, criação/edição/principal/exclusão de endereços, CEP,
mensagens e layout mantêm os contratos existentes. Não há mudança de regras de
documento, pagamento, identidade, banco ou scheduler.

### Arquivos criados/modificados

- packages/frontend/src/entities/cliente/api/customer-api.ts e teste colocado,
  com index.ts explícito: transporte/DTO de perfil e endereços compartilhados.
- packages/frontend/src/shared/api/useScopedApiClient.ts e teste colocado,
  index.ts: ciclo genérico, cancelamento, descarte e signal do chamador.
- pages/perfil/ui/PerfilPage.web.tsx e PerfilPage.api.web.test.tsx: leitura,
  formatação, PUT/releitura, cancelar, falha/retry e troca de escopo.
- pages/enderecos/ui/EnderecosPage.web.tsx e EnderecosPage.api.web.test.tsx:
  leitura/CRUD/principal, CEP, falha/retry e troca de escopo.
- Testes anteriores das duas páginas mantêm contratos de texto, status, senha,
  identidade visual e rotas. Busca de texto por fetch foi substituída por
  chamadas e handlers reais nos novos testes; nenhum teste foi retirado/pulado.
- pages/orcamento/api/quote-api.ts, model/quote-api.ts e
  ui/OrcamentoPage.web.tsx: delegação à entidade cliente e ao ciclo
  compartilhado, preservando o transporte público e as provas da onda 62.
- tests/api-host/customer-consumer.http.test.ts: cookie real, perfil e CRUD de
  endereços nos dois hosts, SQL/RLS e preservação de terceiros/identidade
  global.
- Issues/index, features, ADR, modernização, roteiro de aceite, contexto IA e
  CHANGELOG atualizados. Nenhum baseline/configuração de proteção foi alterado.

### Contratos preservados

GET/PUT /api/user/profile conservam {user} e {success,user}; PUT envia somente
phone/cpf/cnpj/company. Nome/email exibidos continuam vindo da sessão, sem
escrita por esse contrato. GET/POST /api/addresses e PATCH/DELETE /[id]
conservam {addresses}, {address} e a mensagem de exclusão. IDs de endereço são
codificados no caminho; seleção/cookies continuam no cliente e ownership no
servidor.

Formatação e envio parcial do perfil são os anteriores: campos vazios não são
incluídos. CEP continua com oito dígitos no corpo e a consulta ViaCEP pública
existente. A preferência de primeiro endereço e promoção na exclusão permanecem
no serviço backend, sem outra implementação no transporte. Mutação já recebida
pelo servidor pode terminar no escopo original; abort não promete rollback de
uma gravação confirmada.

### Testes executados e resultados

- pnpm exec vitest run --config vitest.platform.config.ts, focando shared/api,
  entities/cliente, pages/perfil, pages/enderecos, pages/orcamento e
  packages/frontend/src/app/providers: 55 arquivos, 197 casos aprovados.
- pnpm exec vitest run --config vitest.api.config.ts com
  customer-consumer.http.test.ts e quote-consumer.http.test.ts: quatro casos por
  motor, todos aprovados em legacy e Better Auth. API_HOST_MODE e
  API_LEGACY_MODE em production; ambos os hosts executaram seus artefatos
  locais. Catálogo/pedido e perfil/endereços persistidos, recusas 404 por
  ownership, identidade global e dados da outra locadora/usuário preservados.
- pnpm typecheck: os 12 projetos aprovados. A fixture HTTP também passou no tsc
  por configuração temporária que estende a raiz, sem exclusões adicionais.
- Lint dos arquivos alterados aprovado. pnpm arch: 1050 existentes, zero acima
  da linha de base; tokens, nomes, hygiene e ratchet: aprovados. Hygiene mantém
  886 achados/251 itens; nomes têm 449 colocados e três exceções anteriores.
- pnpm test:web: 182 aprovados, sete skips preexistentes. pnpm test:mobile: oito
  arquivos/52 casos aprovados. pnpm build:web aprovado; exportações Expo Android
  (6,6 MB) e iOS (6,2 MB) aprovadas, com saídas fora do repositório.
- Banco local descartável limpo: 45 tabelas, somente 19 migrations; nenhuma
  sobra de dados/papéis/funções de fixture e 31 FORCE RLS. Cluster que esta
  rodada iniciou encerrado depois da auditoria.
- Testes renderizam as páginas e os controles reais, com transporte/toasts
  simulados; endereços simula pathname/ViaCEP, sem chamar provedor externo. O
  HTTP usa o transporte da entidade, cookies e servidores/banco reais. Não é
  prova de aparência, navegador/aparelho ou funcionamento externo/produção.

### Estado da API legada

Ativa, sem retirada ou mudança de tráfego: 149 rotas/193 métodos e 46 páginas da
raiz continuam. Serviço compartilhado conserva 149/193, sem páginas; agenda
única e handoff canônico intactos. Sem commit, push, deploy ou operação de
produção. Builds da API/legado reutilizados das ondas anteriores, pois seus
handlers/backend não foram alterados.

### Dívida/risco restante

Visão geral, histórico/locações, pagamentos e outros consumidores ainda precisam
usar o transporte e o ciclo de escopo compartilhados. As telas nativas de
perfil, endereços e orçamento ainda precisam de paridade e aceite. Status de
verificação e botões de senha do perfil conservam os placeholders anteriores;
este corte não certifica esses fluxos. Aceite interativo/operacional, issues
238/240/241/242, etapas SaaS e retirada de app/ (caminho antigo) continuam
pertencendo ao escopo geral.

### Próximo corte recomendado naquela onda

Conectar a visão geral da área do cliente e os consumidores do histórico de
locações/orçamentos ao transporte configurado, preservando polling, refresh,
DTOs, dinheiro e ownership. Continuar telas nativas e etapas SaaS; retirar a
raiz somente com consumidores, callbacks/jobs e aceite operacional comprovados.

## Onda 64 — visão geral e histórico dos consumidores (2026-10-03, sem commit)

### O que foi implementado

AreaClientePage e HistoricoPage usam o HttpClient configurado pelo bootstrap.
Transportes universais de locação e orçamento pertencem às respectivas
entidades; atividades pertencem à entidade cliente. As páginas consomem APIs
explícitas e o ciclo genérico de cancelamento, sem replicar regras do backend.

Troca de locadora/usuário reinicia listas e filtros. Uma resposta antiga não
substitui a nova tela, não apresenta sucesso nem continua a releitura de um
DELETE. Consulta recusada conserva o tratamento anterior por recurso; rede e
atualização silenciosa preservam a política existente. Polling, busca, filtros,
totais, deduplicação de orçamento convertido e confirmação de remoção mantêm o
comportamento observado. Atributos de estilo das duas páginas comparados com
HEAD: iguais; não houve ajuste de classes, cores ou layout.

### Arquivos criados/modificados

- entities/locacao/api/client-rentals.ts e teste, index.ts: lista e remoção do
  histórico privado, com DTO já consumido pelas duas páginas.
- entities/orcamento/api/client-quotes.ts e teste, index.ts: lista nos envelopes
  existentes e remoção por ID codificado; endereço/DTO usados pelas páginas.
- entities/cliente/api/customer-api.ts, teste e index.ts: atividades com limite
  dez e dados existentes, usando a seleção privada capturada pelo bootstrap.
- pages/area-cliente/ui/AreaClientePage.web.tsx e testes: leituras, valores,
  navegação, remoção local de atividade, sessão e resposta pendente por escopo.
- pages/historico/ui/HistoricoPage.web.tsx e testes: listas, orçamento
  convertido, busca/filtro, polling/visibilidade/desmontagem, remoção/retry e
  descarte de leituras/escritas antigas.
- tests/api-host/history-consumer.http.test.ts: consumidores HTTP reais nos dois
  hosts, soft delete SQL, estado preservado e recusas de ownership.
- CHANGELOG, issue/index, feature, ADR, modernização, aceite e contexto IA.
  Nenhum baseline, proteção de teste, handler, schema ou scheduler alterado.

### Contratos preservados

GET /api/client/rentals conserva {rentals}; GET /api/quotes continua aceitando
array ou {quotes}; GET /api/client/activities?limit=10 conserva {activities}.
DELETE /api/client/rentals/[id] e /api/quotes/[id] não enviam corpo e conservam
{message}; exclusão continua em clientDeletedAt, sem alterar status/valores ou
apagar a linha para o admin. Cookies/seleção ficam no transporte e ownership no
servidor. HttpError preserva mensagem/status de recusa.

Polling do histórico: 30000 ms, somente em aba visível; retorno à aba consulta,
e desmontagem remove timer/listener. Atualização em background não mostra
spinner/erro de tela. Formatação de valores, precedência de finalTotal, filtros,
ordem, navegação e deduplicação permanecem. Atividades dispensadas continuam na
chave localStorage existente; não há DELETE remoto de atividades. Abort não
promete desfazer uma escrita já recebida pelo servidor.

### Testes executados e resultados

- pnpm exec vitest run --config vitest.platform.config.ts em shared/api,
  entities/cliente, entities/locacao, entities/orcamento, pages/area-cliente,
  pages/historico, pages/perfil, pages/enderecos, pages/orcamento e
  packages/frontend/src/app/providers: 77 arquivos, 261 casos aprovados. A
  primeira rodada revelou duas consultas incorretas nas fixtures e um toast
  incompleto; corrigidas sem mudar o produto.
- pnpm exec vitest run --config vitest.api.config.ts com
  history-consumer.http.test.ts, customer-consumer.http.test.ts e
  quote-consumer.http.test.ts: seis casos por motor aprovados em legacy e Better
  Auth. API_HOST_MODE/API_LEGACY_MODE em production, builds locais anteriores da
  API/legado reutilizados. Cookies reais, SQL/RLS, lista própria, soft delete,
  dados globais e dados da outra locadora/usuário preservados.
- pnpm typecheck: os 12 projetos aprovados. Fixture HTTP também passou no tsc
  por configuração temporária que estende a raiz, sem afrouxar suas opções. Lint
  dos arquivos alterados aprovado.
- pnpm arch: 1050 existentes, zero acima da linha de base; tokens: 1200 fontes e
  18 CSS; nomes: 453 colocados/três exceções anteriores/nenhuma nova ou
  obsoleta; hygiene: 886 achados/251 itens anteriores. Ratchet aprovado. Sem
  baseline modificado nesta onda.
- pnpm test:web: 182 aprovados/sete skips preexistentes. pnpm test:mobile: 52
  aprovados/oito arquivos. pnpm build:web aprovado; exportações Expo Android
  (6,6 MB) e iOS (6,2 MB) aprovadas em TEMP.
- Banco descartável limpo: 45 tabelas, somente 19 migrations, 31 FORCE RLS,
  nenhum papel/função/dado de fixture restante. Cluster iniciado nesta rodada
  encerrado depois da auditoria.
- Renderização usa os componentes e controles reais, com transporte/toasts e
  navegação simulados; não certifica navegador/aparelho ou aparência. HTTP usa
  consumidores, cookies, servidores e banco reais. Serviços externos/produção
  continuam sem novo aceite.

### Estado da API legada

Ativa: 149 rotas/193 métodos e 46 páginas da raiz. Serviço compartilhado mantém
149/193 sem páginas; não houve cutover, mudança de origem/callback, scheduler,
commit, push, deploy ou operação de produção. O handoff e o antigo vercel.json
conservavam os hashes anteriores. Nenhuma implementação legada foi removida.

### Dívida/risco restante

Detalhe de locação/orçamento, pedidos de prorrogação/coleta, documentos e
pagamentos ainda precisam usar transporte configurado e ciclo capturado. Telas
nativas completas, SaaS, aceite interativo/operacional e issues 238/240/241/242
continuam no objetivo geral. Textos de confirmação existentes falam em exclusão
permanente, embora o backend faça soft delete; esta onda preserva os textos e a
regra anterior. A chave local de atividades permanece compartilhada no
navegador, como antes. Na onda 64 de 2026-10-03, bundles gerados ou inventário
igual não provavam paridade visual/funcional completa nem autorizavam retirar a
antiga raiz app/, depois aposentada no clone F.

### Próximo corte recomendado naquela onda

Conectar o detalhe e as ações do histórico ao transporte compartilhado,
respeitando diferenças entre request-extension e extend, mensagens, polling,
valores, download binário e callbacks. Depois avançar telas nativas e etapas
SaaS. Retirar a raiz somente após consumidores, jobs/callbacks e aceite
operacional comprovados.

## Onda 65 — detalhe, pedidos e download do histórico (2026-10-03, sem commit)

### O que foi implementado

HistoricoDetalhePage e AcoesLocacao usam o HttpClient configurado pelo
bootstrap. Transporte e DTOs do detalhe pertencem às entidades
locação/orçamento; o ciclo HTTP permanece genérico em shared/api. Nenhum
handler, scheduler ou regra de backend foi copiado ou alterado.

A página reinicia por locadora/usuário/id da rota. O bloco de ações reinicia por
locadora/usuário/locação. Leitura, cancelamento, pedidos e download atrasados
são descartados antes de aplicar dados, mostrar toast, navegar ou iniciar
releitura. Abort não desfaz uma escrita já aceita pelo servidor.

HttpRequest aceita responseType binary opcional; JSON continua padrão.
HttpBinaryResponse contém blob já consumido, ok, status, url e redirected. O
corpo inteiro é aguardado dentro do transporte capturado, incluindo redirects
seguidos pelo fetch. Uma resposta HTTP negativa binária conserva status/corpo
para a política anterior da tela; o transporte JSON continua lançando HttpError.

A prova com componentes reais revelou defeito anterior em AcoesLocacao:
Dialog.Popup não tinha Dialog.Portal e Dialog.Trigger envolvia outro botão. Os
dois diálogos agora usam Portal e render com o Button existente. Textos, props,
classes e estilos são os anteriores; nenhum componente novo foi criado.

### Arquivos criados/modificados

- shared/api/http-client.ts, index.ts, http-client.test.ts e
  useScopedApiClient.test.tsx em packages/frontend/src.
- entities/locacao/api/client-rentals.ts e seu teste; novo
  client-rental-detail.ts; entities/locacao/index.ts.
- entities/orcamento/api/client-quotes.ts e seu teste; novo
  client-quote-detail.ts; entities/orcamento/index.ts.
- pages/historico-detalhe/ui/HistoricoDetalhePage.web.tsx,
  HistoricoDetalhePage.web.test.tsx e novo
  HistoricoDetalhePage.api.web.test.tsx.
- pages/historico-detalhe/ui/AcoesLocacao.web.tsx, AcoesLocacao.web.test.tsx e
  novo AcoesLocacao.api.web.test.tsx.
- tests/api-host/portal-wave.http.test.ts, rental-contracts.http.test.ts e
  private-storage.ts. O dublê local passou a servir os bytes do PDF assinado
  somente na URL/token de fixture; aceita o parâmetro download gerado pelo SDK.
- Documentação: este relatório, area-cliente-historico-detalhes.md,
  contracts.md, modernization.md, adr-backend-extraction.md,
  shared-api-acceptance.md, context-map.md, known-issues.md/index e
  CHANGELOG.md.

### Contratos preservados

- GET /api/client/rentals/[id] conserva envelope rental; GET /api/quotes/[id]
  conserva resposta direta e prefixo quote_ da rota.
- DELETE /api/quotes/[id] conserva soft delete, confirmação, mensagem e retorno
  ao histórico. Posse, membership e RLS continuam exclusivamente no servidor.
- POST /api/client/rentals/[id]/extend envia extensionDays, faixa 1–30:
  prorrogação direta, cobrança e datas do backend existentes.
- POST /api/client/rentals/[id]/request-extension envia additionalDays: pedido
  durável à equipe, sem alterar a locação automaticamente. A tela de pedidos
  conserva o input anterior e o backend admite 1–365.
- POST /api/client/rentals/[id]/request-pickup continua sem corpo; mensagens e
  refresh/releitura anteriores foram mantidos.
- GET /api/contracts/[id]/download conserva bytes HTML/PDF, ownership, redirects
  e tratamento de negativas. O nome local anterior contrato-[id].html permanece,
  inclusive para um PDF seguido pelo fetch; corrigir esse nome é dívida
  separada.
- Cookies/seleção vêm do transporte configurado; ids são encodeURIComponent.
  Nenhuma origem real, callback ou regra de autorização mudou.
- 404 mantém mensagem específica e retorno ao histórico; polling de 30 segundos
  só em aba visível e visibilitychange continuam silenciosos no background.
- finalTotal, frete já incluído, multa e coerção de Decimal mantêm os cálculos
  anteriores. Boleto externo e link de contato permanecem como antes.

### Testes executados e resultados

Validação consolidada ao fim do bloco; só falhas ou novas provas foram
repetidas.

- Vitest platform focado: 37 arquivos/211 casos aprovados ao combinar a execução
  inicial e o retry dos seis arquivos do detalhe (27 casos). As falhas iniciais
  eram os diálogos anteriores e a asserção textual sensível à quebra de linha;
  provas renderizadas/transportes protegem os endpoints e payloads substituídos.
- Provas reais dos consumidores: seis casos por motor (NextAuth e Better Auth),
  nos dois hosts locais de produção. Legado: quatro casos aprovados, mais dois
  de PDF aprovados após corrigir o dublê de storage. Better Auth: seis
  aprovados. Os 89 casos não selecionados nessas duas suítes ficaram fora deste
  recorte; nenhum teste foi desativado no código.
- RLS/ownership reais: detalhe de outro usuário, outra locadora e histórico
  oculto recusados; pedidos preservam datas, geram auditoria/notificação da
  locadora; prazo 31 da extensão direta recusado. Contrato HTML idêntico ao
  registro, negativos sem conteúdo privado, redirect privado com PDF completo.
- Tipos dos 12 projetos: aprovados ao combinar o comando inicial e os seis
  projetos restantes após corrigir this explícito no teste. Tipos dos fixtures
  HTTP conferidos por config em TEMP; nenhuma configuração do repo afrouxada.
- ESLint dos 21 arquivos de código/teste aprovado. Arch: 1050 ocorrências
  existentes, zero acima do baseline, nove pacotes. Tokens: 1202 fontes/18 CSS.
  Nomes: 455 colocados/três exceções anteriores, nenhuma nova/obsoleta. Hygiene:
  886 achados/251 itens anteriores. Ratchet aprovado.
- Host web: 182 casos aprovados/sete skips anteriores ao combinar execução e
  retry do inventário. A allowlist ficou intacta: URLs dinâmicas usam templates
  reconhecidos pelo scanner existente. Mobile: oito arquivos/52 casos aprovados.
- Build web aprovado. Exportações Expo Android (6,6 MB) e iOS (6,2 MB) em TEMP
  aprovadas; geração de bundles não prova interação em aparelho.
- AST comparando fontes anteriores/atuais: 376 atributos className/style no
  detalhe e dez nas ações idênticos. A composição dos diálogos foi corrigida;
  não há novo aceite visual de navegador/aparelho.
- Banco descartável limpo: 45 tabelas, somente 19 migrations, 31 FORCE RLS,
  nenhum papel/função/dado de fixture. Cluster próprio PID 44832 encerrado.
  Servidores HTTP encerrados pelo teardown; nenhuma saída de teste adicionada ao
  repositório.

### Estado da API legada

Ativa: 149 rotas/193 métodos e 46 páginas na raiz. Serviço mantém 149/193 sem
páginas. O handoff e o antigo vercel.json conservavam seus hashes. Não houve
cutover, commit, push, deploy, operação em produção, mudança de scheduler ou
retirada de implementação legada. Nenhuma baseline, allowlist ou proteção foi
ampliada.

### Dívida/risco restante

Pagamentos e demais consumidores de documentos ainda precisam do transporte
configurado. Paridade nativa completa, SaaS, operação externa e issues
238/240/241/242 permanecem no objetivo geral. O nome .html no download de PDF e
os DTOs anteriores do detalhe foram preservados; esta onda não redefine esses
contratos. Renderização simulou navegação/toasts/settings, enquanto HTTP usou
cookies, servidores e banco reais com storage externo substituído localmente.
CORS, SDKs e links externos em navegador/aparelho real continuam no aceite.

### Próximo corte recomendado naquela onda

Conectar a página de pagamentos e os consumidores restantes de documentos ao
transporte capturado, preservando emissão/verificação/segunda via e ownership.
Depois avançar a paridade nativa e os lotes SaaS/operacionais. Não aposentar
app/ (caminho antigo) antes do aceite completo dos consumidores, identidade,
callbacks e jobs.

## Onda 66 — pagamentos e documentos administrativos (2026-10-03, sem commit)

### O que foi implementado

Os fluxos existentes de orçamento, financeiro e locações usam HttpClient
configurado para boleto/vencimento, contrato, documentos do cliente e PDFs. Não
existe uma página própria de pagamentos neste corte; nenhuma tela foi criada.
Adapter de boleto, usado por duas páginas, fica em entities/pagamento. Adapters
exclusivos ficam no api da página dona, com DTOs de locações ainda na página.
Shared/api só transporta multipart/status/corpo e controla o ciclo opaco.
Nenhuma regra nova nos hosts ou backend.

As páginas reiniciam por locadora/papel/usuário e detalhes capturam o registro.
Respostas antigas não aplicam dados, contrato, toast, arquivo ou releitura; após
callbacks assíncronos o ciclo é conferido novamente. Abort não desfaz escrita já
recebida pelo servidor.

### Arquivos criados/modificados

- shared/api/http-client.ts, index.ts, useScopedApiClient.ts e testes.
- entities/pagamento/api/admin-payments.ts, teste e index.ts.
- pages/locacoes/api/admin-rentals.ts e client-documents.ts, testes;
  model/carga.ts e carga.test.ts; ui/LocacoesPage.web.tsx.
- pages/financeiro/api/documents.ts; model/detalhe.web.ts e testes,
  document.web.ts e teste; ui/Detalhe.web.tsx e FinanceiroPage.web.tsx.
- pages/orcamentos-admin/api/admin-documents.ts e teste; model/detalhe.web.ts e
  detalhe.boleto.web.test.ts; ui/Lista.web.tsx e Painel.tsx.
- tests/api-host/payment-requests.http.test.ts, client-documents.http.test.ts e
  quote-documents.http.test.ts.
- Relatório, ADR de extração, modernization, guia de aceite, context-map,
  features relacionadas, known-issues e CHANGELOG. Caminhos de frontend acima
  relativos a packages/frontend/src.

### Contratos preservados

- Geração POST e segunda via PUT sem corpo; vencimento PATCH com dueDate,
  inclusive null. 202 continua pendente mesmo sem processing no JSON, sem
  confirmar pagamento/data nova. Outbox e worker continuam responsáveis.
- HttpRequest.body continua string; multipart aceita FormData separadamente, sem
  Content-Type manual, recusando dois corpos. Arquivo/tipo/captureMetadata
  conservados; JSON padrão continua lançando HttpError em negativa.
- json-response retorna data/ok/status para mensagens anteriores; binary aguarda
  o corpo completo. Listagem/contrato/check-in/out preservam métodos, envelopes,
  status ACTIVE/COMPLETED e datas validados no backend.
- PDFs conservam bytes/recusas. Ofício abre aba no clique antes da rede, fecha a
  aba vazia em erro/escopo antigo e revoga URL após load; não cria URL se o
  popup foi bloqueado. Nome do PDF de reajustes permanece.
- Cookies/seleção vêm do bootstrap, IDs são encodeURIComponent. Mensagens,
  filtros, paginação, markup e estilos anteriores preservados.

### Testes executados e resultados

Validação consolidada no fim do bloco; repetidos somente arquivos afetados por
falha ou mudança posterior de responsabilidade/import.

- Platform focado: 55 arquivos/93 casos aprovados combinando execução inicial e
  retry de sete arquivos/31 casos após corrigir isCurrent no objeto retornado.
  Quatro arquivos/dez casos rechecados após mover adapters às páginas donas.
- HTTP dos consumidores: oito casos por motor (NextAuth e Better Auth), nos dois
  hosts de produção locais, com cookies/RLS reais. No legado, seis passaram
  inicialmente e dois após corrigir a nova expectativa: emissão enfileirada
  ainda não cria PaymentAttempt; conserva Payment e payment.issue na outbox.
  Better Auth: oito aprovados. Casos fora do filtro não executados; nenhum teste
  anterior desativado/afrouxado.
- Multipart privado/relistagem/metadata/hash, papel FINANCIAL e outra locadora
  recusados; PDFs próprios começam com %PDF, negativos não liberam PDF.
  Storage/provedores substituídos localmente, sem chamadas externas reais.
- Tipos dos 12 projetos aprovados combinando execução inicial/retry; frontend
  web/native e host web rechecados após mover imports. Fixtures HTTP aprovados
  por config em TEMP; configs do repo intactas.
- ESLint: zero erros, um aviso no useMemo que mantém ciclo por client/scope.
  Arch: 1050 ocorrências existentes, zero acima do baseline, nove pacotes.
  Tokens: 1208 fontes/18 CSS, css-important zero. Nomes: 462 colocados/três
  exceções anteriores, nenhuma nova/obsoleta. Hygiene: 886/251; ratchet verde.
- Host web: 182 casos aprovados/sete skips anteriores ao combinar execução e
  retry dos nove casos da allowlist. Adapters exclusivos saíram dos barrels
  públicos; nenhuma permissão ou proteção ampliada. Mobile: oito arquivos/52.
- Build web aprovado; bundles Expo Android 6,6 MB/iOS 6,2 MB em TEMP. AST contra
  snapshots: 131 atributos className/style em FinanceiroPage, LocacoesPage,
  Lista e Painel idênticos. Não há novo aceite de aparelho/visual.
- Banco descartável: 45 tabelas, somente 19 migrations, 31 FORCE RLS, nenhum
  papel/função/dado de fixture. Cluster próprio PID 37860 encerrado após
  conferir PID/diretório/porta; servidores HTTP encerrados pelo teardown.

### Estado da API legada

Ativa: 149 rotas/193 métodos e 46 páginas. Serviço mantém 149/193, sem páginas.
Handoff canônico/vercel.json conservam hashes. Sem cutover, commit, push,
deploy, mudança de scheduler, produção ou retirada do legado. Nenhuma baseline,
allowlist ou proteção ampliada.

### Dívida/risco restante

Outras leituras/mutações de financeiro/orçamentos ainda usam fetch relativo.
Popup/PDF em navegador real, load ausente e revogação de URL, provedores/CORS,
dispositivos, telas nativas, SaaS e operação continuam no objetivo geral. Issues
238/240/242, reconciliação UNKNOWN e política de suspensão permanecem.

### Próximo corte recomendado naquela onda

Migrar o restante de financeiro/orçamentos como bloco relacionado, preservando
filtros, datas, locks, status e processamento; depois demais consumidores
administrativos, paridade nativa e SaaS. app/ (caminho antigo) só sai após
aceite completo de consumidores, identidade, callbacks e jobs.

## Onda 67 — financeiro e orçamentos administrativos (2026-10-03, sem commit)

### O que foi implementado

Os cinco consumidores de carga/detalhe do financeiro e da listagem/detalhe dos
orçamentos agora usam o HttpClient configurado. Dois adapters finos ficam no
segmento api das páginas donas; não entram em barrels públicos ou shared. O
backend compartilhado continua responsável por autorização, locadora, valores,
pagamentos, histórico e outbox; nenhum host ou regra de negócio foi duplicado.

Exportação PDF/XLSX/CSV consome o corpo binário completo e conserva os nomes
existentes. Abre aba vazia no clique, libera arquivo somente no ciclo ativo e
fecha a aba/revoga a URL no caminho final. Não transforma resposta negativa em
arquivo. É validação de contrato e DOM simulado, sem novo aceite de navegador.

Leituras e ações capturam transporte/registro; após rede e callbacks, resultados
antigos não aplicam seleção, erro, sucesso ou continuação de escrita. Listagem
de orçamentos cancela a busca anterior; histórico de reajustes é limpo ao trocar
registro. Abort não desfaz escrita remota aceita e a sequência de reajustes não
se torna uma transação de lote.

### Arquivos criados/modificados

- packages/frontend/src/pages/financeiro/api/financial.ts
- packages/frontend/src/pages/financeiro/api/financial.test.ts
- packages/frontend/src/pages/financeiro/model/carga.web.ts
- packages/frontend/src/pages/financeiro/model/carga.web.test.ts
- packages/frontend/src/pages/financeiro/model/detalhe.web.ts
- packages/frontend/src/pages/orcamentos-admin/api/admin-quotes.ts
- packages/frontend/src/pages/orcamentos-admin/api/admin-quotes.test.ts
- packages/frontend/src/pages/orcamentos-admin/model/dados.web.ts
- packages/frontend/src/pages/orcamentos-admin/model/dados.web.test.ts
- packages/frontend/src/pages/orcamentos-admin/model/detalhe.web.ts
- packages/frontend/src/pages/orcamentos-admin/ui/Detalhe.web.tsx
- packages/frontend/src/pages/orcamentos-admin/ui/Detalhe.web.test.tsx
- packages/frontend/src/pages/financeiro/model/export.web.ts
- packages/frontend/src/pages/financeiro/model/carga.api.web.test.ts
- packages/frontend/src/pages/orcamentos-admin/model/dados.api.web.test.ts
- packages/frontend/src/pages/financeiro/model/export.web.test.tsx
- packages/frontend/src/pages/orcamentos-admin/model/detalhe.actions.web.test.ts
- packages/frontend/src/pages/financeiro/model/detalhe.actions.web.test.ts
- tests/api-host/financial-read.http.test.ts
- tests/api-host/financial-mutations.http.test.ts
- tests/api-host/quote-mutations.http.test.ts

Também atualizados modernization/ADR, aceite operacional, contexto/índice,
features de financeiro/orçamentos, known-issues/index e CHANGELOG. Configs,
baselines, allowlists e proteções de teste não foram ampliadas.

### Contratos preservados

- Financeiro: lista até 10000, paginação visual 10; filtros e aliases de datas
  startDate/endDate e start/end; totais, calendário, cores e default de status;
  gráficos, alíquotas e reset para o snapshot salvo; seleção de IDs na
  exportação.
- Orçamentos: tabela 20, Kanban 500/page 1 sem filtros ocultos; busca, meses e
  normalização; aprovação UPFRONT/ON_DELIVERY/AT_END, cliente, período, itens,
  entrega, multas e envio ajustado. Payloads/flags de e-mail e WhatsApp
  intactos.
- GET/PATCH/POST/DELETE e envelopes JSON com status, cookies e seleção explícita
  da locadora. POST de reajuste responde 202; DELETE de reajuste responde 409
  para conservar histórico, assim como exclusões com histórico financeiro.
- Exportação: relatorio-financeiro-oficio.pdf, relatorio-financeiro.xlsx e
  relatorio-financeiro.csv. Query format/search/status/datas/ids conservada.
- Comparação AST com os snapshots da árvore de trabalho: 58 atributos de
  className/style e 12 expressões body dos cinco fontes idênticos.

### Testes executados e resultados

Validação consolidada ao final do bloco. Repetidos somente arquivos com falha ou
alteração posterior; casos fora do filtro HTTP não foram executados.

- Platform: 49 arquivos/82 casos aprovados ao combinar primeira execução e
  retries. A rodada inicial encontrou cancelador não declarado e locks de boleto
  presos; corrigidos no código. Ajustados dois testes para aguardar a chamada
  assíncrona/normalizar whitespace e um fixture para declarar viewMode table.
  Quatro arquivos/13 casos rechecados após reiniciar flags por registro.
  Asserções antigas de fetch foram substituídas pelos adapters e por provas
  executadas de paths, métodos, payloads, filtros e recusa parcial.
- HTTP: seis casos por motor, NextAuth e Better Auth, nos dois hosts locais
  compilados de produção, com cookies, seleção e FORCE RLS. Financeiro/leitura e
  escrita passaram inicialmente no legacy; dois de orçamento passaram após
  corrigir expectativas novas para 202/409 reais. Não se mudou o backend para
  satisfazer expectativa de 200. Better Auth: seis aprovados na execução final.
- Tipos: 12 projetos aprovados combinando primeiro comando e os seis projetos
  restantes após reparar frontend. Os três fixtures HTTP passaram com config
  temporária explícita, sem modificar tsconfig do repositório.
- ESLint: zero erros/avisos. Arch: 1050 ocorrências existentes, zero acima do
  baseline. Tokens: 1211 fontes/18 CSS, css-important zero. Nomes: 469
  colocados, somente três exceções anteriores. Hygiene 886/251 e ratchet
  aprovados.
- Host web: 19 arquivos/182 casos aprovados, sete skips anteriores. Mobile: oito
  arquivos/52 casos aprovados. Build web e exports Expo Android 6,6 MB/iOS 6,2
  MB aprovados; exports/logs/configs/snapshots ficaram em TEMP.
- Banco: 45 tabelas, somente 19 migrations, 31 FORCE RLS, nenhum dado/papel/
  função de fixture. Cluster próprio PID 39356 encerrado após conferir PID,
  diretório, executável e porta 55442; HTTP encerrado pelo teardown.

### Estado da API legada

Ativa: 149 rotas/193 métodos e 46 páginas; serviço mantém 149/193, sem páginas.
O handoff e o antigo vercel.json conservavam hashes. Nenhum commit, push,
deploy, cutover, scheduler ou produção alterado. app/ (caminho antigo) não foi
retirado.

### Dívida/risco restante

Downloads/popup/revogação de URL em navegador real, aparelhos e provedores
externos ainda exigem aceite; bundles não certificam paridade nativa. Sequência
de reajustes pode deixar as primeiras alterações aceitas quando uma posterior é
recusada: preservado, sem rollback de efeitos remotos. Mensagens legadas de
exclusão permanente e políticas de edição/deleção do histórico seguem dívida.
Cancelamento de calendário/gráficos entre filtros no mesmo escopo não foi
redefinido por este corte. Issues 238/240/242, reconciliação e suspensão
continuam pendentes, assim como outros consumidores administrativos, SaaS e
retirada segura da raiz. Progresso geral ~60% é estimativa de esforço, não
percentual certificado pelo inventário de rotas.

### Próximo corte recomendado naquela onda

Conectar o catálogo administrativo e depois os demais consumidores ao transporte
compartilhado, em blocos relacionados com validação consolidada. Prosseguir com
paridade nativa, SaaS e aceite operacional antes de retirar app/ (caminho
antigo) e sua composição legada.

## Onda 68 — consumidores do catálogo administrativo (2026-10-03, sem commit)

### O que foi implementado

Categorias, lista/criação/edição/detalhe de equipamentos e unidades físicas
consomem HttpClient configurado, com adapters exclusivos no segmento api da
página dona. Não se copiou regra de catálogo para o cliente ou para o host HTTP.
Listas conservam formatos array/envelope; filtros, ordenação, paginação,
validações, preços por período, estoque e histórico de perdas permanecem.

Páginas reiniciam por locadora/papel/usuário/registro. Leituras e efeitos locais
antigos são descartados; formulário de categoria/unidade tem ciclo próprio, para
uma gravação atrasada não fechar um novo rascunho. Cancelar transporte não
desfaz escrita já aceita pelo servidor. Categoria duplicada continua rejeitando
a Promise com a mensagem existente. Exclusão recusada conserva a seleção.

Edição mantém tratamento de texto não JSON e statusText, através de modo
text-response opcional em shared/api: corpo consumido antes de liberar
resultado. JSON e binary existentes não mudaram. Corrigido o próximo corte
documentado na onda 67: locações já estava conectada na onda 66.

### Arquivos criados/modificados

Caminhos de produto relativos a packages/frontend/src:

- pages/categorias/api/categories.ts e categories.test.ts; model/carga.ts e
  carga.api.test.tsx; ui/CategoriasPage.web.tsx e seu teste.
- pages/equipamentos-admin/api/equipments.ts e equipments.test.ts;
  model/escopo.ts, tipos.ts, lista.web.ts e lista.api.web.test.ts.
- ui/Lista.web.tsx, Novo.web.tsx, Editar.web.tsx, Detalhe.web.tsx e testes;
  GerenciadorUnidades.tsx e GerenciadorUnidades.api.web.test.tsx.
- shared/api/http-client.ts, index.ts e http-client.test.ts.
- tests/helpers/frontend-session.tsx oferece provedores reais explícitos aos
  fixtures renderizados; três fixtures existentes tests/api-host de criação de
  categoria, operações de catálogo e mutações de unidade usam os adapters.
- Formatação dos demais arquivos dos dois slices e atualização dos testes de
  contrato para conservar entrypoints independentemente de aspas. Nenhuma regra
  de negócio, baseline, allowlist, ambiente real ou configuração de deploy
  mudou.

### Contratos preservados

GET/POST/PUT/DELETE de categorias e equipamentos; GET/POST/PATCH/DELETE de
unidades, query equipmentId e listagem limit=1000. JSON serializado preserva
preços, toggles, imagens, perdas, icon null, estoque e campos opcionais. IDs são
codificados como segmentos/query; transporte acrescenta sessão e seleção, sem
resolver autorização. DTO, status e erros continuam vindo do backend.

POST categoria mantém 201, duplicação 409; registro alheio mantém 404; PUT
conserva espaços e maxStock zero não substitui estoque. Unidade RENTED mantém
recusa 400 na exclusão. Medidores Decimal continuam textuais no JSON. Links
com/sem tenantSlug, confirmações, galeria, textos e classes preservados.

### Testes executados e resultados

Validação consolidada após implementar o bloco; retries só em arquivos com falha
ou mudanças posteriores:

- Platform: 18 arquivos/43 casos aprovados ao combinar execução inicial e
  retries. Últimos três arquivos/nove casos rechecados após ciclo do formulário
  e recusa HTML. Fixtures receberam sessão/locadora explícitas e opções de
  transporte; assertivas de método/corpo/rota permanecem.
- HTTP: três casos por motor, NextAuth e Better Auth, nos dois hosts locais
  compilados de produção; sessões reais, ACL e FORCE RLS. Casos fora do filtro
  consumidor não foram executados.
- Tipos: 12 projetos aprovados combinando os seis anteriores ao primeiro erro e
  os seis restantes; frontend rechecado ao final. Fixtures HTTP compilados
  explicitamente com configuração temporária.
- Lint sem erros. Arch: 1050 ocorrências existentes, zero acima do baseline;
  tokens: 1214 fontes/18 CSS, css-important zero. Nomes: 474 testes colocados,
  somente três exceções anteriores. Hygiene 886/251 e ratchet aprovados.
- Host web: 182 casos aprovados/sete skips anteriores; mobile: 52 aprovados.
  Build web e exports Expo Android 6,6 MB/iOS 6,2 MB aprovados.
- AST: 478 atributos style/className e sete corpos serializados idênticos em
  oito fontes, comparados à árvore de trabalho anterior, não à HEAD antiga.
- Banco: 45 tabelas, somente 19 linhas de migrations, 31 FORCE RLS, sem dados
  nem papéis de fixture. Cluster próprio PID 51044 na porta 55443 encerrado;
  HTTP encerrado pelo teardown. Logs, exports, scripts e snapshots em TEMP.

### Estado da API legada

Ativa: 149 rotas/193 métodos e 46 páginas; serviço mantém 149/193, sem páginas.
Composição e handlers não alterados neste bloco. Sem commit, push, deploy,
cutover, scheduler ou mudança em produção. O handoff e o antigo vercel.json
estavam preservados. app/ (caminho antigo) não foi retirado.

### Dívida/risco restante

Aceite em navegador/aparelhos, integrações externas, SaaS e operação pendentes.
Bundles não certificam paridade nativa. API retorna medidores Decimal como
texto, enquanto o renderizador legado de unidades ainda chama toFixed supondo
número: este bloco preserva o DTO e essa limitação; normalização no consumidor e
prova renderizada com medidor textual precisam de um corte corretivo.

Recusa de exclusão por relações e políticas do histórico permanecem no backend.
Updates otimistas das perdas conservam a política anterior, incluindo diferenças
de rollback entre adicionar e excluir registros. Abort não desfaz efeito remoto.
Percentual geral ~60% é estimativa de esforço, não cobertura certificada de
rotas.

### Próximo corte recomendado naquela onda

Tratar a representação textual dos medidores no renderizador e conectar os
consumidores de dashboard, manutenção e logística ao transporte, como bloco
relacionado. Depois comunicações/configuração, paridade nativa, SaaS e aceite
operacional; a retirada da antiga raiz app/ era condicionada à paridade e ao
cutover naquele corte.

## Onda 69 — dashboard, manutenção, logística e medidores (2026-10-03, sem commit)

### O que foi implementado

As três páginas usam HttpClient configurado por adapters finos exclusivos de
seus segmentos api. Leituras, PATCHs e feedback capturam o ciclo do transporte;
páginas reiniciam por locadora/papel/usuário e a edição de entrega tem ciclo
próprio. Nenhuma regra de negócio passou para o cliente.

GerenciadorUnidades aceita medidores number|string|null e converte somente na
apresentação, mantendo uma casa no horímetro, nenhuma no odômetro e ocultação de
null. O DTO e os handlers dos dois hosts não mudaram.

### Arquivos criados/modificados

- api/dashboard.ts, api/maintenance.ts e api/logistics.ts nas respectivas
  páginas, sem export administrativo em seus barrels públicos.
- model/carga.ts e testes de cada página, três wrappers web e prova renderizada
  de manutenção com providers reais de locadora/sessão.
- equipamentos-admin/model/tipos.ts, ui/GerenciadorUnidades.tsx e seu teste.
- Documentação de estado, operações, admin, aceite, contexto, issue 252 e
  CHANGELOG. Não há pacote, schema, migration ou dependência nova.

### Contratos preservados

Dashboard inicia quatro leituras paralelas: principal, cinco orçamentos, receita
de 12 meses e aging. O principal aparece antes dos secundários. Falha parcial
conserva o principal e informa o erro sem esperar uma consulta pendente;
rejeições secundárias são observadas mesmo quando o principal falha. Formatos
array/envelope, mapeamento do cliente/valor/itens e gráfico positivo permanecem.

Manutenção mantém scheduled?includeOverdue=true, lista vazia em falha de
qualquer consulta, filtros e página de dez. Logística conserva veículos
AVAILABLE, motoristas ACTIVE, campos opcionais, zeros, checklist/fotos/notas,
PATCH de edição/status e mensagens. JSON inválido nas leituras ainda produz
erro; writes não exigem resposta JSON. IDs são codificados como um segmento.

96 atributos style/className, três corpos JSON e sete cores são idênticos à
árvore de trabalho anterior em cinco fontes, por comparação AST. Nenhuma
baseline/allowlist foi ampliada. Anotação anterior de cores foi mantida na
expressão original, evitando deslocamento causado pelo formatter.

### Testes executados e resultados

54 casos únicos em 34 arquivos aprovados: bloco inicial 53/53, seguido somente
pelos dois arquivos do dashboard após o ajuste de falha parcial (seis casos,
incluindo um novo). Provas exercitam transporte configurado,
credenciais/headers, URLs, leitura paralela, falhas, filtros/paginação, payloads
e ciclos antigos. Providers reais comprovam reinício por locadora e usuário;
cinco renderizações com medidor textual/número/zero/null.

12 projetos TypeScript, ESLint sem erros e gates
arch/tokens/nomes/hygiene/ratchet aprovados. Arch conserva 1050 ocorrências
anteriores e zero acima do baseline; tokens 1217 fontes/18 CSS, css-important
zero; 478 testes colocados, somente três exceções antigas; hygiene 886
achados/251 itens anteriores.

Build web e exports Android/iOS aprovados; não certificam comportamento em
aparelho. Tipos/lint e build web final foram rechecados após o ajuste do
dashboard. Provas HTTP dos handlers das ondas 33/51/53 continuam como evidência
anterior; não foram repetidas neste bloco, que não altera servidor, auth, DTO ou
scheduler. Nenhum banco ou servidor HTTP foi iniciado; snapshots/exports/logs
ficam em TEMP.

### Estado da API legada

Ativa e intacta neste bloco: 149 rotas/193 métodos e 46 páginas. Serviço
compartilhado conserva 149/193. Sem commit, push, deploy, cutover, alteração de
produção ou agenda. O handoff e o antigo vercel.json estavam preservados; A
antiga raiz app/ permanecia presente naquele corte.

### Dívida/risco restante

Comunicações/configuração ainda têm consumidores por conectar. Paridade nativa,
SaaS, provedores reais, aceite interativo e operação continuam pendentes. O
destino mobile /admin/dashboard ainda monta UnavailableArea; sua implementação
nativa permanece pendente. Abort descarta continuação local e não desfaz PATCH
recebido pelo servidor. Medidores inválidos fora do DTO de Decimal não recebem
nova política de validação. Progresso geral continua aproximadamente 60%,
estimativa de esforço.

## Onda 112 — provisionamento assistido atômico (2026-10-04, sem commit)

O módulo compartilhado onboarding instala o primeiro incremento de S10. A CLI
platform:provision chama o mesmo caso pela composição única
runtime/platform-jobs; runtime/onboarding só lê configuração. Não há conexão
paralela na camada de regras nem mudança de rota, proxy, scheduler ou cliente. O
gate inicialmente recusou a conexão fora da composição; ela foi movida para a
composição já permitida, sem exceção ou alteração de proteção.

Organização/dono, assinatura, teste, evento, aceites, quatro sementes, auditoria
e outbox são atômicos. Identidade verificada, operador ADMIN ativo, plano mensal
público/vendável, documentos publicados, quota e política de slug são
revalidados. Locks e índice único impedem concorrência; recibo HMAC mantém
corpo/resultado original no replay, mesmo após mudanças de
catálogo/termos/estado. Contadores HMAC de tentativa persistem em transação
separada, inclusive na recusa. Teste por CNPJ/e-mail reutiliza hashes canônicos.
Vínculo de equipe inativo não bloqueia o dono; equipe ativa permanece impedida
conforme banco/ADR.

CLI padrão é prévia do payload sem banco, não valida elegibilidade. --apply
exige ambiente/operador/conexão isolada e metadados externos dos textos já
aprovados, pela nova PLATFORM_LEGAL_DOCUMENTS_FILE. Entrada/publicação são
arquivos absolutos de até 16 KiB. Não se produzem termos, planos, preços ou
consentimentos reais. O pool próprio fecha em sucesso/falha e códigos de erro
são explícitos. Sessão/MFA do futuro adaptador HTTP continuam necessários.

Site fica não publicado/não indexável/fora do diretório e CNPJ não ganha
verificação do provedor. TRIALING/FULL usa os dias persistidos; INCOMPLETE/SETUP
enfileira subscriptions.provider-sync existente. onboarding.welcome fica na
outbox durável, ainda sem consumidor. Nenhuma chamada Asaas ocorre na criação.

Validação consolidada: 196 casos distintos em sete arquivos, incluindo 48 de
onboarding PostgreSQL, 57 da composição/escopo existentes, 11 da CLI, sete de
publicação e 73 dos contratos/validação. O subprocesso da CLI é real sobre banco
descartável, com publicação sintética; não equivale a operação externa. Doze
falhas injetadas após gravações comprovam rollback do agregado; contadores
persistem. Corridas de replay, quota, teste e slug (também fora do advisory
lock) e papéis temporários sem BYPASSRLS comprovam isolamento. Quatro casos
dirigidos de equipe foram reexecutados após o ajuste final, sem duplicar a
contagem.

Tipos dos 12 projetos e da raiz, lint, arch (nove pacotes), tokens (zero
important), nomes e builds API/legado passaram. A higiene retirou somente nove
achados agora consumidos e uma exceção de dependência obsoleta; ratchet sem nova
tolerância. Nenhuma migration nova, alteração de produção, commit, push, deploy
ou cutover. Legado e enforcement real off preservados. Tailwind 287 continua
aberto, sem CSS novo nesta onda.

S10 é parcial. Próximo corte: adaptadores autenticados de
criação/disponibilidade, checklist e consumidor de boas-vindas, seguidos da UI e
publicação controlada. Backoffice, hierarquia comercial para troca e homologação
externa continuam necessários. Ver [onboarding-locadora](onboarding-locadora.md)
e o refinamento S10 no [ADR](../architecture/adr-saas-subscription.md).

### Próximo corte recomendado naquela onda

Conectar comunicações e configurações administrativas ao mesmo transporte em uma
onda relacionada, preservar contratos e validar ao final. Depois continuar
paridade nativa/SaaS/operação. Retirar app/ (caminho antigo) somente com
paridade e cutover provados.

## Onda 70 — comunicações, configurações e permissões (2026-10-03, sem commit)

### O que foi implementado

WhatsApp e Zoho Mail passaram a usar o HttpClient configurado, com adapters
privados das páginas. Configurações incluem agora o upload nesse transporte;
permissões mantêm GET/PUT pelo mesmo cliente, com adapter próprio. Wrappers
reiniciam estado por locadora/papel/usuário e por identidade do transporte.

Conversa, compositor, perfil de permissões e pasta do correio têm ciclos
próprios. Respostas/feedback antigos são descartados. Seleção de mensagem usa
uma revisão para impedir que a resposta anterior substitua a atual; lote de
exclusão para antes da próxima chamada ao encerrar a pasta; confirmações de
exclusão/spam da pasta anterior também são encerradas. Reset confirmado de
settings verifica o ciclo antes da escrita, inclusive depois da espera
existente.

### Arquivos criados/modificados

- Adapters api/mail.ts, api/whatsapp.ts e api/permissions.ts nas páginas donas;
  nenhum export administrativo adicionado aos seus barrels públicos.
- Modelos/wrappers de email-admin, whatsapp-admin, configuracoes e permissoes,
  incluindo o wrapper de permissões nativo. SettingsApi inclui uploadLogo;
  SettingsProvider preserva dados no refresh e limpa ao trocar o transporte.
- Shared/api acrescenta revisão opaca do cliente, sem conhecer identidade.
- Sete arquivos de testes novos e quatro existentes ajustados/ampliados.
  explorer.fileNesting de *.web.ts passa a incluir testes TSX do mesmo assunto,
  cobrindo carga.api.web.test.tsx; allowlist e algoritmo não mudaram.
- Relatório, ADR/modernização, features, aceite/contexto, issue 253 e CHANGELOG.
  Nenhum pacote, dependência, schema, migration ou handler novo neste bloco.

### Contratos preservados

WhatsApp conserva limite 50/offset zero, before e POST com texto aparado. A
query de mensagens agora é relativa e válida: new URL com caminho sem base
lançava erro antes da chamada. IDs são codificados como um segmento.

Zoho conserva accountId/folderId, paginação 50/start, ações, exclusão/expunge,
multipart, bytes do anexo, HTML, rascunhos e X-Idempotency-Key de
envio/resposta. O ID devolvido pelo autosave não reinicia os campos. A entrada
OAuth continua navegando pelo host web/proxy, preservando o fluxo de cookies
documentado.

Settings conserva envelopes success/data/error, formulário completo, defaults,
limites e mensagens. Upload envia file/type=logo sem Content-Type manual.
Permissões envia somente entradas do perfil selecionado; matriz ADMIN e regras
de autorização continuam no servidor.

AST comparada à árvore de trabalho anterior: 14 fontes, 218 atributos de estilo/
classes, três cores e oito corpos JSON do correio idênticos semanticamente.
Payloads deslocados para adapters têm provas de método/corpo/URL. Nenhuma
baseline, allowlist ou tolerância foi ampliada.

### Testes executados e resultados

49 casos únicos em 18 arquivos aprovados ao combinar execução consolidada e
retries somente de fixtures/arquivos alterados. Incluem transporte configurado,
credenciais/headers, erros não JSON, multipart/binário, rascunho sem reset,
seleção atrasada, lote interrompido, troca de usuário e callbacks encerrados. A
suíte estática do WhatsApp conserva as assertivas anteriores de UI/limites/
rotas legadas; somente a localização das chamadas mudou para o adapter, cujas
URLs são verificadas em execução.

12 projetos TypeScript aprovados combinando os seis anteriores ao erro de
fixture com os seis restantes; frontend web/native e lint rechecados após os
ajustes finais. ESLint sem erros. Gates arch/tokens/nomes/hygiene/ratchet
aprovados: 1050 ocorrências anteriores/zero acima, 1220 fontes/18 CSS e
css-important zero, 485 testes colocados/mesmas três exceções, hygiene 886/251.

Build web e exports Expo Android 6,6 MB/iOS 6,2 MB aprovados. Bundles não
certificam comportamento em aparelho. HTTP dos handlers não repetido: servidor,
DTOs, identidade, ACL/RLS, pagamentos e scheduler não foram alterados nesta
onda. Nenhum banco ou servidor HTTP iniciado; snapshots/exports ficam em TEMP.

### Estado da API legada

Ativa: 149 rotas/193 métodos e 46 páginas. Serviço permanece 149/193. Sem
commit, push, deploy, cutover, mudança de produção ou agenda naquele corte de
2026-10-03. O handoff canônico e o antigo vercel.json da raiz conservaram os
hashes anteriores nessa onda 70; esse arquivo foi retirado no clone F, sem
ativar uma agenda externa. A antiga raiz app/ permanecia ativa naquele corte.

### Dívida/risco restante

O adapter do correio é uma ponte temporária para leitores existentes, com
parsing/status preservados e corpo consumido no ciclo do transporte; tipagem
mais específica dos DTOs e divisão do modelo extenso ainda são dívida própria.
Políticas otimistas/rollback do correio foram preservadas. Abort não revoga
mensagem, upload, exclusão ou PUT recebido pelo servidor.

Navegador/aparelhos, provedores reais, telas nativas ausentes, SaaS e operação
seguem pendentes. Este bloco não cria telas nativas de correio, WhatsApp ou
settings. Conclusão geral continua aproximadamente 60%, estimativa de esforço,
não porcentagem certificada por contagem de rotas.

### Próximo corte recomendado naquela onda

Inventariar os consumidores administrativos residuais e as rotas mobile ainda
UnavailableArea; iniciar paridade nativa pelo menor conjunto com contratos já
protegidos. Depois fechar SaaS e aceite operacional. Retirar app/ (caminho
antigo) somente após paridade e cutover comprovados; conservar cadência de
validação por onda.

## Onda 71 — entradas pós-login nativas (2026-10-03, sem commit)

### O que foi implementado

As rotas Expo /admin/dashboard e /area-cliente passam a renderizar páginas do
frontend compartilhado em vez de UnavailableArea. O host fornece somente os
callbacks existentes de voltar/sair; telas e estado pertencem às slices donas.
As entradas públicas dos pacotes permanecem as mesmas, com resolução de
variantes .native.tsx e fachada .tsx para o web.

Dashboard nativo reutiliza useDashboardData e as quatro consultas do adapter
existente. Inclui indicadores, tendências, sete painéis de gráficos/tabelas,
expansão em Dialog, equipamentos mais solicitados, ROI, ações rápidas e
orçamentos recentes. Usa os componentes nativos do design system; apresentação
interativa dos gráficos ainda exige aceite visual em aparelho.

A visão geral do cliente extrai o modelo existente do arquivo web para
model/use-area-cliente.ts. Web e nativo compartilham consultas, carrinho, datas,
subtotal, preços por período, atividades e dispensa local. O storage usa a
fachada existente, com AsyncStorage no nativo. Os wrappers reiniciam por
locadora, papel, slug público, usuário e revisão do transporte. Respostas e
restauração de storage de um ciclo encerrado não alteram a tela nova.

### Arquivos criados/modificados

- Rotas finas Expo (admin)/admin/dashboard.tsx e
  (account)/area-cliente/index.tsx.
- pages/dashboard/ui/DashboardPage.native.tsx e Grafico.native.tsx, fachada
  DashboardPage.tsx e index.ts; types.ts universal separado da configuração web
  em tipos.ts. Carga/api passam a consumir os tipos universais; o toast usa o
  contrato multiplataforma de UI.
- pages/area-cliente/model/use-area-cliente.ts, ui/AreaClientePage.native.tsx,
  fachada AreaClientePage.tsx e index.ts. AreaClientePage.web.tsx conserva a
  apresentação e passa a consumir o mesmo modelo.
- Dois testes nativos novos e helper tests/helpers/native-screen.tsx; fixtures
  web/contratos existentes ajustados à extração, mantendo as provas anteriores.
  Formatação dos arquivos das duas slices alinhada ao Prettier.
- Relatório, ADR/modernização, features, contexto, issue 254 e CHANGELOG. Nenhum
  pacote, dependência, schema, migration ou handler adicionado.

### Contratos preservados

As consultas continuam no HttpClient configurado, com credenciais e locadora
capturadas pelo bootstrap. Guards, ownership, ACL/RLS e regras permanecem no
backend. Endpoints, DTOs, valores, filtros e critérios de prioridade entre
locações/orçamentos não mudaram. finalTotal zero é preservado; subtotal do
carrinho continua usando buildQuotePricing, sem regra de preço duplicada.

Dispensa de atividades mantém a chave local anterior e não cria escrita remota.
Voltar/sair usa os callbacks do host. Cancelamento de uma leitura não substitui
autorização nem desfaz escrita já recebida pelo servidor.

Comparação AST com a árvore anterior conserva 182 atributos de estilo/classes e
nove helpers de datas/valores/imagem da página web. Não houve alteração de CSS,
tokens, baselines, allowlists ou exports públicos do pacote.

### Testes executados e resultados

58 casos únicos em 24 arquivos aprovados ao combinar a execução consolidada com
retries somente dos arquivos corrigidos. As 15 provas nativas usam componentes
reais do design system sobre um host RN simulado: URLs/headers, valores zero,
preço semanal, storage assíncrono, erro/retry, expansão/fechamento pelo botão
voltar, navegação, callbacks de saída e descarte de respostas antigas ao trocar
usuário, slug ou transporte. Nenhum className chega ao host nativo.

Os 12 projetos TypeScript passaram nas últimas execuções pertinentes, combinando
os projetos anteriores ao erro com os restantes e rechecando os quatro projetos
afetados. ESLint sem erros. Testes dos hosts: mobile 52 aprovados; web 182
aprovados e sete skips anteriores, sem novo skip.

Gates arch/tokens/nomes/hygiene/ratchet aprovados: arquitetura 1049 ocorrências
anteriores e zero acima do baseline, 1227 fontes/18 CSS e css-important zero,
487 testes colocados/mesmas três exceções, hygiene 886/251. Nenhuma proteção
ampliada para acomodar o incremento.

Build web e exports Expo Android 6 MB/iOS 5,7 MB aprovados. Source maps dos dois
exports incluem DashboardPage.native, AreaClientePage.native, Grafico.native,
modelo compartilhado e storage.native; não incluem variantes web ou a
configuração de ícones web dessas duas slices. Tipos puros são apagados pelo
Metro. Isso prova seleção de módulos, não execução ou fidelidade em aparelho.

HTTP/banco não repetidos: handlers, regras e composição do servidor não mudaram.
Snapshots e exports ficaram em TEMP; nenhum banco ou servidor HTTP iniciado.

### Estado da API legada

Ativa: 149 rotas/193 métodos e 46 páginas da raiz. Serviço mantém 149/193. Sem
commit, push, deploy, cutover, mudança de origem/callback, scheduler ou
produção. O handoff e o antigo vercel.json estavam preservados; A antiga raiz
app/ ainda era necessária naquele corte.

### Dívida/risco restante

Este bloco entrega duas entradas nativas, sem certificar paridade completa do
produto. Vários links ainda levam a destinos mobile ausentes: orçamento, detalhe
do catálogo, histórico/detalhe, perfil, endereços, notificações e destinos
administrativos. Não esconder esses destinos nem retirar os contratos web para
contornar a ausência.

Gráficos nativos usam a representação interativa disponível no design system,
enquanto o web conserva Recharts. Fidelidade visual, gestos e apresentação em
dispositivos ainda exigem aceite. Imagens do carrinho permanecem ausentes na
apresentação nativa. Dispensa local mantém a chave global anterior, cuja revisão
por usuário/locadora é dívida separada.

SaaS, provedores reais, carga/pool de autenticação, aparelhos, operação e
retirada segura do legado continuam pendentes. Progresso geral permanece cerca
de 60%, estimativa de esforço, não percentual certificado por rotas ou arquivos.

### Próximo corte recomendado naquela onda

Completar destinos nativos do fluxo do cliente em uma onda relacionada:
orçamento/detalhe de catálogo e histórico/lista/detalhe, reutilizando os modelos
e transportes existentes. Depois destinos administrativos, lotes SaaS e aceite
operacional. Consolidar provas ao fechar a onda; retirar app/ (caminho antigo)
somente após paridade e cutover comprovados.

## Onda 72 — histórico e detalhes nativos (2026-10-03, sem commit)

### O que foi implementado

O Expo monta /area-cliente/historico e /area-cliente/historico/[id] com as
variantes nativas das slices existentes. Lista, busca, filtros, deduplicação de
orçamento convertido, confirmação de remoção, detalhe, reajustes, timeline,
totais, pedidos e download usam os contratos e transportes existentes.

Modelos anteriores do web foram extraídos para model nas próprias slices. Web e
native compartilham apresentação de preços e timeline; polling permanece em 30
segundos, com visibilitychange no web e AppState no native. Desmontagem encerra
timer/listener; mudança de locadora/papel/slug/usuário/transporte/registro
reinicia a tela e descarta respostas de ciclos encerrados.

Contrato chega como blob já autenticado. O host Expo integra File/Paths e
expo-sharing, sem nova requisição HTTP: confere escopo antes/depois das etapas,
cria arquivo de cache exclusivo e o remove no finally. Indisponibilidade ou
leitura de um ciclo encerrado não cria arquivo nem abre compartilhamento.

### Arquivos criados/modificados

- packages/frontend/src/pages/historico: model/use-history.ts, fachadas,
  variante nativa, delegação web, index e testes.
- packages/frontend/src/pages/historico-detalhe: modelos de detalhe/ações,
  apresentação/timeline/tipos, fachadas, duas variantes nativas, delegação web,
  index e testes.
- packages/frontend/src/features/bloco-preco: contrato puro e Bloco.native;
  implementação web anterior preservada.
- packages/frontend/src/shared/lib/activity: contrato/fachadas e hooks
  web/native de atualização em primeiro plano.
- apps/clients/mobile/src/app/(account)/area-cliente/historico: duas rotas
  finas; src/host/contract-share.ts e testes; package.json e pnpm-lock.yaml com
  expo-sharing ~57.0.22, compatível com o SDK 57 instalado.
- packages/ui/src/index.web.ts e index.native.ts: exposição do useNavigate já
  existente no contrato comum de navegação, sem duplicar sua implementação.
- tests/helpers/customer-history.tsx e native-screen.tsx: fixtures e host RN
  simulado, usando primitivas nativas reais do design system.

Três nomes saíram da tolerância de higiene porque agora têm consumidores reais:
semanticThemes em design-tokens/index e semantic, e
EquipmentQuotePriceBlockVariant em features/bloco-preco/index. O próprio gate
reprova exceção obsoleta. Somente remoções verificadas; nenhum novo item,
limite, ignore ou proteção de teste ampliado.

### Contratos preservados

URLs/envelopes e ownership/RLS no backend único; zero válido em finalTotal,
Decimal textual, frete já incluído, multa e precedência do total do orçamento.
quote_ conserva detalhe de orçamento e cancelamento confirmado. Extensão direta
envia extensionDays (1–30); pedido à equipe envia additionalDays; coleta segue
sem corpo. São operações diferentes e continuam diferentes.

O download conserva bytes completos e o nome contrato-[id].html anterior,
inclusive para PDF após redirect. MIME é repassado ao compartilhamento nativo.
Não se altera endpoint, assinatura, emissão, seleção ou origem da API.

Comparação AST contra a árvore imediatamente anterior confirmou 521 atributos de
apresentação web, 47 inicializadores de preço/formatação e as duas expressões de
timeline idênticos. Não equivale a novo aceite visual em navegador/aparelho.

### Testes executados e resultados

- Vitest focado nas duas slices, bloco de preço, atividade, visão geral,
  dashboard, entidades locação/orçamento e shared/api: 153 casos únicos em 48
  arquivos, aprovados no conjunto das execuções. Falhas de integração corrigidas
  e somente arquivos afetados reexecutados; nenhum teste removido/pulado.
- Host mobile: 9 arquivos, 57 testes; host web: 182 testes, 7 skips anteriores.
- TypeScript: 12 projetos aprovados; ESLint do bloco sem erros.
- arch: 1049 violações intermediárias existentes, zero acima da linha de base.
  tokens: 1249 fontes/18 CSS, css-important zero; nomes: 492 testes colocados,
  três exceções anteriores; higiene: 883 achados/250 itens anteriores restantes.
  Ratchet aprovado, com a redução de higiene descrita acima.
- Build web aprovado. Exports Android (6,1 MB) e iOS (5,8 MB) aprovados. Source
  maps incluem HistoricoPage.native, HistoricoDetalhePage.native, Bloco.native,
  use-active-refresh.native, contract-share e modelos puros; não incluem
  variantes web das duas slices de histórico.

Testes RN são renderização sobre host simulado, não execução em aparelho.
Compartilhamento usa portas controladas nos testes; nenhum recebimento por outro
app foi certificado. HTTP/banco não repetidos: handlers/backend/composição não
mudaram. Artefatos ficaram em TEMP; nenhum servidor HTTP/banco iniciado.

### Estado da API legada

Ativa: 149 rotas/193 métodos e 46 páginas da raiz; serviço mantém 149/193.
Scheduler, clientes configurados, callbacks, handoff canônico e produção
preservados. Sem commit, push, deploy ou cutover. A antiga raiz app/ ainda era
necessária naquele corte.

### Dívida/risco restante

Aparelhos/gestos/fidelidade visual, compartilhamento/recebimento real e
redirects privados em aparelho seguem sem aceite. Nome .html para PDF permanece
dívida compatível; limpar arquivo no retorno de shareAsync exige prova nos
aparelhos alvo. Não certifica paridade completa do produto nem elimina o legado.

Orçamento/detalhe de catálogo, perfil/endereços/notificações, destinos
administrativos, imagens do carrinho, gráficos, SaaS e operação continuam
pendentes. Conclusão geral permanece aproximadamente 60%, estimativa de esforço,
não cobertura certificada por arquivos/rotas.

### Próximo corte recomendado naquela onda

Completar orçamento e detalhe do catálogo nativos, reaproveitando modelos e
transportes existentes. Depois demais destinos do cliente/admin, lotes SaaS e
aceite operacional. Consolidar validação ao fechar cada onda relacionada; a
retirada da antiga raiz app/ era condicionada à paridade e ao cutover naquele
corte.

## Onda 73 — detalhe de catálogo e preços nativos (2026-10-03, sem commit)

### O que foi implementado

O host Expo monta /equipamentos/[id] com uma rota fina. A slice existente
equipamento-detalhe contém leitura, estado, galeria, calendário e apresentação
nativa. Imagem e compartilhamento são portas do host; o host não calcula preço
nem resolve ownership.

As três implementações web delegam seus modelos a use-equipment-period,
use-equipment-pricing e use-equipment-quote. Reutilizam o motor da entidade e
conservam períodos oferecidos, valores diretos (inclusive zero), calendário de
até dez anos, dias úteis/fins de semana, confirmação e espera da sessão. O
parser de GET /api/equipments/{id}, antes no host web, foi movido sem alterar
sua normalização para contracts/public-equipment, exposto pela entrada existente
de contracts e consumido pelo web e pelo mobile.

O estado nativo reinicia por locadora/identidade/transporte/registro. Leituras
encerradas não substituem o detalhe atual. JSON-LD permanece HTML no web; a
variante native do widget não cria script/DOM.

### Arquivos criados/modificados

- packages/frontend/src/pages/equipamento-detalhe: modelos, contratos, adapter
  público, fachadas/variantes, calendário, galeria e testes.
- packages/contracts/src/public-equipment.ts e index.ts: normalização pública
  única; nenhuma nova dependência ou nova entrada de package.exports.
- apps/clients/web/src/host/server/public-api.ts: consome o parser
  compartilhado.
- apps/clients/mobile/src/app/(public)/equipamentos/[id].tsx e
  src/host/routes.test.ts: rota e integrações de plataforma.
- packages/frontend/src/widgets/dados-estruturados: tipos puros e variante
  native sem script. Metadados HTML anteriores preservados.

### Contratos preservados

GET /api/equipments/{id}?tenantSlug, DTO/defaults e 404 neutro. Backend,
tenant/ACL/RLS, API legada, scheduler e composição não mudaram. Preço e carrinho
continuam usando as entidades existentes; o clique em loading aguarda a sessão.
Sem datas/confirmacão, a inclusão de fins de semana continua obrigatória.

Comparação AST com a árvore imediatamente anterior confirmou 355 atributos de
apresentação web e 13 inicializadores de preço idênticos semanticamente.
Compartilhamento nativo usa o deep link produzido pela configuração Expo atual,
incluindo tenantSlug. Não inventa domínio público nem troca o scheme existente.
Nome/marca, afirmações de entrega e avaliações legadas permanecem dívida
compatível; não são novas garantias comerciais.

### Testes executados e resultados

- 45 casos focados únicos em 15 arquivos: preços/SEO/calendário do web, modelo e
  tela nativos, transporte, direto zero, dias úteis, fim de semana, loading,
  galeria, compartilhamento por porta, 404, retry e resposta antiga.
- Host mobile: 57 casos em nove arquivos. Parser/gateway do host web: oito
  casos.
- Doze projetos TypeScript aprovados no conjunto das execuções; erros de
  integração corrigidos e somente projetos afetados reexecutados.
- ESLint, arch, tokens, lint:css, nomes, higiene e ratchet aprovados. arch
  mantém 1048 achados intermediários e zero acima da linha de base. tokens
  examina 1268 fontes/18 CSS, css-important zero. Nomes: 495 testes
  colocados/três exceções anteriores. Higiene: 883 achados aceitos pelos 250
  itens anteriores. Nenhum baseline, ignore, allowlist ou proteção ampliado.
- Build web aprovado. Android 6,1 MB e iOS 5,8 MB exportados em TEMP. Source
  maps dos dois bundles incluem as seis variantes nativas do detalhe/calendário
  e os três modelos compartilhados; não incluem as apresentações web da slice.

Testes RN usam um host simulado. Builds/source maps não certificam aparelho,
gestos, fidelidade visual nem recebimento do compartilhamento. Não houve nova
execução HTTP/banco: handlers e regras de backend permanecem intactos. Artefatos
fora do repositório; nenhum servidor iniciado.

### Estado da API legada

Ativa: 149 rotas/193 métodos e 46 páginas da raiz; serviço conserva 149/193.
Origem dos clientes, scheduler, callbacks, produção e handoff canônico intactos.
Sem commit, push, deploy ou cutover. A antiga raiz app/ ainda era necessária
naquele corte.

### Dívida/risco restante

O orçamento nativo ainda não existe. O botão conserva o destino /orcamento, mas
o fluxo Expo não deve ser considerado completo antes da próxima onda montar essa
página com seus modelos, termos e confirmações. Não foi criado substituto vazio
para ocultar a lacuna.

Aparelho, zoom/gestos, compartilhamento real, marca/scheme provisórios,
perfil/endereços/notificações, destinos administrativos, SaaS e operação seguem
pendentes. Conclusão geral continua ~60%, estimativa de esforço; esse incremento
não prova paridade final nem permite retirar o legado.

### Próximo corte recomendado naquela onda

Extrair o modelo atual da página de orçamento e montar a variante native:
itens/quantidade/dias, atualização de preço, disponibilidade, dados/documentos,
retirada/entrega/frete/endereço, termos e diálogos de confirmação/salvamento.
Preservar POST /api/quotes e validações existentes. Depois demais destinos, SaaS
e aceite operacional; A antiga raiz app/ só poderia sair após paridade/cutover
comprovados naquele corte.

## Onda 74 — orçamento nativo compartilhado (2026-10-03, sem commit)

### O que foi implementado

/orcamento no Expo monta a página da slice existente. Itens, quantidades/dias,
preço, disponibilidade, dados/documentos, entrega/retirada, endereço, frete,
termos e decisões de salvamento usam o modelo extraído do web. A rota fina
fornece AsyncStorage, parâmetros/navegação e imagem; nenhuma regra de negócio
foi copiada para o host. O formulário alternativo QuoteForm também compartilha o
modelo de três passos e possui apresentação native, testada pelo contrato.

Preferências conservam as duas chaves isoladas por locadora/usuário. Leitura
assíncrona precede o modelo e oferece erro/retry; falha de gravação é informada.
Contexto inclui locadora, identidade e transporte. Trocar contexto desmonta o
ciclo anterior; seus resultados não alteram outro carrinho nem geram feedback.

A confirmação de fins de semana retomava uma função do render anterior após 150
ms e reabria a pergunta. Agora continua com o último estado confirmado, sem
executar depois do unmount. O Button nativo preserva o aria-label explícito e
continua inferindo o rótulo a partir do texto quando ele não é fornecido.

O fechamento identificou uma lacuna da onda 73: o consumidor compartilhado do
detalhe público estava bloqueado no proxy web. A allowlist e a lista de GETs com
slug na query passam a incluir exatamente um segmento de equipamento. Conflito
de locadora continua 400; subrotas privadas/admin/internal continuam 404. Não
houve ampliação de ignore, baseline ou proteção de teste.

### Arquivos criados/modificados

- packages/frontend/src/pages/orcamento/model: contratos/portas, use-quote-page,
  use-quote-preferences e use-quote-form.
- A mesma slice, ui: fachadas, apresentações web/native e testes de página,
  formulário, transporte e index.contract; index.ts conserva a entrada pública.
- apps/clients/mobile/src/app/(public)/orcamento.tsx e host/routes.test.ts.
- packages/ui/src/contract/button.ts e native/Button.native.tsx/teste.
- apps/clients/web/src/host/routing/route-table.ts e decide.test.ts.
- Documentação do orçamento, hosts, extração, modernização, design system,
  issues, mapa de contexto e CHANGELOG.

### Contratos preservados

POST /api/quotes e POST /api/orcamentos, envelopes, validações, campos e
formatação anteriores. Catálogo/disponibilidade conservam tenantSlug; perfil e
endereços usam os adapters privados existentes. Preço, arredondamento, períodos,
estoque, membership/ownership e autorização continuam nas entidades/backend.
Falha HTTP conserva os itens; salvamentos paralelos mantêm os resultados
parciais.

Os modelos não importam Next, DOM ou React Native. A porta web mantém storage,
foco e navegação anteriores. Comparação AST com a árvore imediatamente anterior
confirmou 529 atributos das duas apresentações web preservados, ignorando a key
de remontagem por contexto. Isso é prova estrutural, sem substituir aceite
visual. Rotas/handlers/backend, scheduler e regras financeiras não mudaram.

### Testes executados e resultados

- 124 casos focados únicos passaram em 54 arquivos, com dois skips anteriores.
  Incluem os contratos web da slice/entidade, transporte escopado, UI/preço e
  página/formulário nativos. O fechamento reexecutou somente o subconjunto
  afetado pela continuação: 108 casos em 50 arquivos, todos passando.
- Provas novas: DTO do POST, centavos, limites, campos/termos, confirmação de
  fins de semana true/false, disponibilidade, retry, resultado parcial de
  endereço/perfil, descarte por locadora/usuário/transporte, leitura de
  preferências com retry, passos do QuoteForm e rótulo acessível do Button.
- Host mobile: 57 casos em nove arquivos. Host web final: 183 casos passaram,
  sete skips anteriores em um arquivo; o novo caso cobre detalhe, query
  conflitante e bloqueio de subrotas, sem enfraquecer o inventário de
  chamadores.
- Doze projetos TypeScript aprovados no conjunto das execuções. Projetos
  afetados foram reexecutados após correções de integração; não foi necessário
  repetir projetos de backend intactos.
- ESLint dos arquivos alterados, lint:css, arch, tokens, nomes, higiene e
  ratchet aprovados. arch conserva 1048 achados intermediários e zero acima do
  baseline em nove pacotes. tokens: 1277 fontes/18 CSS, css-important zero.
  Nomes: 497 colocados/três exceções anteriores. Higiene: 883 achados aceitos
  pelos 250 itens anteriores. Nenhuma tolerância ampliada.
- Build web final aprovado após o ajuste de proxy. Bundles Android 6,8 MB e iOS
  6,5 MB exportados em TEMP. Source maps de ambas as plataformas contêm
  OrcamentoPage.native e os modelos de página/preferências, sem as apresentações
  OrcamentoPage.web ou QuoteForm.web.

Testes nativos usam o host RN simulado; export e source maps não certificam
build Gradle/Xcode nem execução em aparelho. O QuoteForm alternativo tem prova
renderizada própria; não é um segundo fluxo montado pela rota /orcamento.
Backend/handlers não mudaram: HTTP/banco não foram repetidos neste corte.
Artefatos e logs estão em TEMP; nenhum servidor ou navegador novo iniciado.

### Estado da API legada

Ativa: 149 rotas/193 métodos e 46 páginas da raiz; serviço mantém 149/193.
Origem configurada dos clientes, scheduler, callbacks, produção e checkpoint
canônico preservados. Sem commit, push, deploy ou cutover. app/ (caminho antigo)
ainda necessário.

### Dívida/risco restante

Frete conserva o cálculo e a origem fixa anteriores; não certifica cotação real
de transportadora nem configuração por locadora. Google Customer Reviews fica no
web; não foi criada equivalência fictícia em native. Foco de campos e conclusão
dos diálogos de seleção de endereço ainda precisam de aceite interativo,
inclusive revisão do callback legado que preenche e envia no mesmo render.
WhatsApp do formulário alternativo exige prova de abertura em aparelho.

Paridade visual, gestos/teclado e persistência em aparelhos não certificados.
Perfil/endereços/notificações, destinos administrativos, gráficos, SaaS e
operação continuam pendentes. Progresso geral permanece ~60%, estimativa de
esforço; testes e inventário de rotas não provam conclusão geral.

### Próximo corte recomendado naquela onda

Completar os destinos nativos do cliente (perfil, endereços e notificações)
usando seus modelos/transportes existentes; consolidar provas de leitura/edição,
escopo e ciclos. Depois destinos administrativos, lotes SaaS e aceite
operacional. A antiga raiz app/ só poderia sair após paridade e cutover
comprovados naquele corte.

## Onda 75 — perfil, endereços e notificações Expo (2026-10-03, sem commit)

### O que foi implementado

Três rotas finas em (account)/area-cliente montam as apresentações nativas das
slices existentes. Perfil e endereços compartilham estado, máscaras, transporte
e ações com o web; regras de autorização, ownership e persistência continuam nas
entidades/backend. Cada página reinicia por locadora, usuário e revisão do
transporte, com TenantProvider explicitamente selecionado ou null.

Notificações deixam fetch relativo no consumidor: um modelo universal usa o
HttpClient configurado e descarta respostas de ciclos antigos. O contador
gb-locacoes-unread-count e o evento notificationUpdate permanecem no adapter
web. O native usa as estatísticas confirmadas e a navegação fornecida pelo host.
Leitura/exclusão só mudam a lista após confirmação; erros permitem nova
tentativa.

A busca de CEP compartilhada ignora respostas após outro CEP, cancelar, editar
ou desmontar o formulário. Ler uma notificação repetidamente não desconta duas
vezes. Um refresh anterior não desfaz a leitura nem deixa o loading preso.

### Arquivos criados/modificados

- pages/perfil e pages/enderecos: modelos universais, apresentações native,
  fachadas neutras, índices e testes web/native.
- features/notificacoes: contrato de tipos, modelo universal, adapters
  web/native, fachada, índice e testes de transporte/ciclo/contador.
- pages/notificacoes: helpers de apresentação puros, variante native, fachada,
  índice e testes; apresentação web preservada.
- apps/clients/mobile: três rotas em (account)/area-cliente e
  host/routes.test.ts.
- tools/hygiene-baseline.json: retirada de duas exceções obsoletas do stub sem
  consumidores createNotificationHelpers. Nenhuma entrada/nome/tolerância nova.
- Documentação de features, modernização, extração, issues, contexto e
  CHANGELOG.

### Contratos preservados

GET/PUT /api/user/profile conserva somente phone/cpf/cnpj/company no PUT, com
máscaras e omissão de vazios; nome/email não são gravados por esse endpoint.
Endereços mantêm GET/POST/PATCH/DELETE, DTO, primeiro principal, promoção,
releitura após sucesso e campos após falha; id é codificado no caminho.

Notificações mantêm GET com limit=50, sync antes da carga somente para o ADMIN
global já observado, PATCH/DELETE por id e POST mark-all-read. Tipos/prioridades
são normalizados e datas/metadata preservadas. clearAll continua local; nenhum
endpoint de criação em cliente foi inventado. O stub createNotificationHelpers
retornava vazio, não tinha consumidores de produto e foi retirado junto de suas
duas dívidas de higiene; não altera contrato HTTP nem cria notificação fictícia.

Comparação AST normalizando aspas preservou 490 atributos das três apresentações
web (186 perfil, 217 endereços, 87 notificações), ignorando key de remontagem.
Estilos e layout web conservados; AST não substitui aceite visual.

### Testes executados e resultados

- 64 casos focados em 16 arquivos passaram: máscaras/PUT parcial, cancelar,
  falha/retry, CRUD/principal, CEP atrasado, leitura/ação em troca de locadora,
  usuário/transporte/logout, ordem do sync, contadores idempotentes e adapter
  web.
- Host Expo: 57 casos em nove arquivos; host web: 183 passaram e sete skips
  anteriores em um arquivo. Nenhuma proteção foi afrouxada.
- Doze projetos TypeScript passaram; projetos frontend/web-native e mobile
  afetados rechecados no fechamento. ESLint dos arquivos próprios aprovado.
- arch, tokens, lint:css, check:test-names, hygiene e ratchet aprovados. A
  tolerância de css-important continua zero. Arquitetura: 1048 achados
  intermediários, zero acima do baseline em nove pacotes. Nomes: 501 testes
  colocados, três exceções anteriores. Higiene: 881 achados/248 itens restantes,
  duas exceções a menos por retirada do stub.
- Build web e exports Android/iOS aprovados. Source maps das duas plataformas
  contêm as três páginas native e modelos comuns, sem as três apresentações web
  nem o adapter DOM de notificações.

Primitivas nativas reais foram renderizadas sobre host RN simulado em DOM.
Exports não certificam Gradle/Xcode, teclado/gestos ou execução em aparelho.
Backend/handlers não mudaram; HTTP/banco não foram repetidos. Logs, snapshots,
source maps e bundles em TEMP. Nenhum servidor/navegador iniciado nesta onda.

### Estado da API legada

Ativa: 149 rotas/193 métodos e 46 páginas na raiz. Serviço com 149/193. Origem
configurada dos clientes, scheduler, callbacks e produção preservados. Sem
commit, push, deploy ou cutover. A antiga raiz app/ permanecia necessária até o
aceite daquele corte.

### Dívida/risco restante

Perfil conserva status de verificação pendentes e não implementa senha ou
aparelhos; botões dessas ações no native ficam desabilitados. Nome/email, CNPJ
alfanumérico e política de apagar campos continuam dívidas anteriores. Não
apresentar essas funcionalidades como concluídas.

A chave do badge web continua global por compatibilidade; o modelo novo limpa o
valor ao trocar contexto, mas consumidores antigos do header ainda exigem
revisão. clearAll não persiste exclusão no servidor. Push, recebimento em
aparelho e fidelidade visual não certificados. Destinos administrativos, SaaS e
aceite operacional continuam pendentes. Geral ~60% é estimativa de esforço;
contagem de rotas/testes não significa conclusão geral.

### Próximo corte recomendado naquela onda

Montar os destinos administrativos nativos sobre os modelos/transportes
existentes, agrupando catálogo/equipamentos/unidades e suas ações em uma onda.
Depois operações/financeiro/comunicações, lotes SaaS e aceite operacional.
Retirar app/ (caminho antigo) somente após paridade e cutover comprovados.

## Onda 76 — catálogo administrativo e unidades no Expo (2026-10-03, sem commit)

### O que foi implementado

As rotas /admin/equipamentos e /admin/equipamentos/[id] do Expo montam a slice
existente. Lista inclui pesquisa, categoria/disponibilidade, nove itens por
página, preview, galeria/zoom e confirmação de exclusão. Detalhe apresenta
metadados, especificações, contagens e unidades físicas. Unidades têm criação,
edição, cinco estados, medidores, série, notas e confirmação de exclusão.

Estado, transporte e mensagens das três apresentações foram extraídos para
modelos comuns. Navegação, confirmação assíncrona e integração de imagem são
portas; listeners e scroll do navegador permanecem exclusivamente web. Chaves de
tela incluem locadora, papel, usuário, estado da sessão, registro e revisão do
transporte. Confirmar depois que o ciclo acabou não envia a exclusão antiga.

### Arquivos criados/modificados

- pages/equipamentos-admin/model: tipos puros, escopo e modelos comuns
  use-equipment-list, use-equipment-details e use-equipment-units; adapters de
  lista web/native e testes.
- pages/equipamentos-admin/ui: variantes Lista/Detalhe/VerEquipamento/
  GerenciadorUnidades, galeria e confirmação nativas, fachadas e testes.
- packages/frontend/package.json e index.native.ts: condição react-native
  específica da slice. Default conserva os exports web anteriores; native expõe
  os dois destinos implementados, sem carregar formulários DOM.
- apps/clients/mobile: duas rotas finas, integração Image/resolvePublicAssetUrl
  e inventário real de rotas.
- Textarea native e contrato: repasse do rótulo acessível de Notas, sem alterar
  estilo, valor ou callback.
- tools/ratchet-transfers.json e baselines arch/tokens: somente transferência
  das mesmas contagens para a renomeação física de GerenciadorUnidades.tsx para
  .web.tsx. O arquivo antigo saiu; a fachada é .ts. Nenhuma tolerância nova. A
  entrada de pacote foi registrada pela adoção Expo autorizada; os checks
  web/universais e a tolerância zero permanecem.

### Contratos preservados

Lista mantém GET /api/admin/equipments?limit=1000 e GET /api/admin/categories,
ordenação pt-BR, pesquisa/availability e envelope array ou equipments. Detalhe e
exclusão usam os mesmos GET/DELETE por id, com erro do servidor, toasts e
navegação somente após sucesso.

Unidades conservam GET com equipmentId codificado, POST, PATCH e DELETE. O DTO
mantém uniqueCode.trim/status; medidores não negativos via parseFloat;
serialNumber/notes somente quando não vazios; equipmentId somente na criação.
Decimal textual aparece com uma casa em horas e zero em quilômetros; null é
ocultado. Falha mantém rascunho; cancelar encerra o ciclo da UI, sem desfazer
escrita remota aceita. ACL, RLS, estoque e regras continuam exclusivamente no
backend; nenhum handler foi alterado.

AST preserva 357 atributos visuais das quatro apresentações web: 110 lista, 61
detalhe, 138 preview e 48 unidades. A confirmação web continua usando confirm; a
native usa Dialog e checa o ciclo após a espera.

### Testes executados e resultados

- 46 casos focados em 14 arquivos passaram, incluindo as caracterizações web
  existentes, filtros/páginas/galeria, DTOs, falha/retry/cancelamento, estados e
  medidores, troca de usuário/locadora/registro/transporte e confirmação
  assíncrona concluída após encerramento.
- Host mobile: 57 casos/nove arquivos; host web: 183 passaram, sete skips
  anteriores em um arquivo. Inventário ganhou as duas rotas, sem relaxar
  comparações.
- Doze projetos TypeScript, ESLint dos arquivos próprios, arch, tokens,
  lint:css, check:test-names, hygiene e ratchet passaram. Arquitetura atual:
  1010/1050 achados intermediários, zero acima do baseline; css-important zero.
- Build web e exports Android/iOS passaram. Source maps incluem seis
  apresentações/helpers nativos e três modelos comuns, sem Lista/Detalhe/
  VerEquipamento/GerenciadorUnidades/Novo/Editar.web da slice.

Primitivas nativas reais renderizadas sobre host RN simulado em DOM; exports não
certificam aparelhos, teclado, gestos, Gradle/Xcode ou fidelidade visual.
HTTP/banco não repetidos porque backend e handlers ficaram intactos. Bundles,
logs e snapshot ficaram em TEMP. Nenhum servidor/navegador persistente criado.

### Estado da API legada

API legada ativa, com 149 rotas/193 métodos e 46 páginas da raiz; serviço também
possui 149/193. Origens configuradas, scheduler, autenticação, callbacks e
produção preservados. Sem commit, push, deploy ou cutover. A antiga raiz app/
permanecia presente naquele corte.

### Dívida/risco restante

Novo/editar equipamento e categorias ainda não têm destinos Expo implementados.
As ações conservam suas URLs; não considerar o fluxo completo de cadastro/
edição nativo aprovado. Configuração rica de ícones/categorias, upload,
estoque/perdas e preços por período exigem o próximo corte, sem formulários
simplificados que aparentem paridade.

Aceite em aparelhos/fidelidade visual, demais telas administrativas, SaaS,
operação e retirada do legado continuam pendentes. Geral ~60% permanece
estimativa de esforço, não certificação por contagem de rotas ou testes.

### Próximo corte recomendado naquela onda

Implementar criação/edição de equipamento e categorias no Expo com modelos
compartilhados, incluindo imagem/upload, preços por período, estoque/perdas e
configuração de ícones. Depois operações/financeiro/comunicações, SaaS e aceite
operacional. A retirada da antiga raiz app/ era condicionada à paridade e ao
cutover naquele corte.

## Onda 77 — cadastro e edição de equipamento no Expo (2026-10-03, sem commit)

### O que foi implementado

As rotas /admin/equipamentos/novo e /admin/equipamentos/[id]/editar do Expo
montam a slice existente. Nome, descrição, categoria, disponibilidade, estoque,
quatro períodos, desconto/valor direto, período popular, imagens, especificações
e perdas usam os modelos extraídos do web. Preview respeita períodos habilitados
e o mesmo cálculo sem datas do seletor web.

O host integra expo-document-picker já instalado; cada arquivo vira multipart
com campo file, URI, nome e MIME. A slice envia POST /api/upload pelo transporte
configurado. ImageUpload nativo recebe uma porta de seleção/upload, conserva
URL, principal, ordenação/remoção e limite de cinco. UI não importa backend ou
configuração de cliente. Upload web de equipamento também usa essa porta de
transporte; outros consumidores conservam o fallback anterior.

Perdas preservam data, descrição, parseInt da quantidade, fotos internas,
contador e PUT imediato do formulário completo. Calendário nativo recusa datas
futuras. Adicionar/editar/remover compartilham snapshot, rollback e mensagens;
remoção nativa exige confirmação. O salvamento deixa de depender de efeitos
laterais de setters React e de esperar um timer de zero milissegundos.

### Arquivos criados/modificados

- pages/equipamentos-admin/model: use-new-equipment, use-edit-equipment,
  use-equipment-upload, use-equipment-specifications e pricing-preview; API e
  tipos ampliados para portas multipart.
- ui: Formulario, Novo, Editar e CalendarioPerdas nativos; wrappers Novo/Editar
  web delegam ao modelo comum. SeletorPreco e SecaoEspecificacoes usam os mesmos
  helpers, preservando markup e estilos.
- index.native: quatro destinos do catálogo efetivamente implementados.
- apps/clients/mobile: duas rotas finas, equipment-upload.native e prova do
  multipart; inventário real do expo-router atualizado.
- packages/ui: ImageUpload native aceita seleção/upload; Switch e Select
  anunciam rótulos acessíveis. CustomSelect web aceita disabled/aria-label;
  ImageUpload web aceita uploadFile e o contrato das portas nativas.
- Testes: Formulario.native, use-equipment-upload e equipment-upload.native.
  Documentação de arquitetura, admin, perdas, contexto, issues e changelog.

### Contratos preservados

GET categorias/equipamento, POST equipamentos e PUT por id conservam caminhos,
DTOs, mensagens e navegação somente após sucesso. PUT principal conserva texto
não JSON, details/error/statusText; PUT de perda conserva o formulário completo.
Fotos de perda ficam somente em partsLossHistory[].images; images conserva
exclusivamente fotos públicas. Isso prova separação do DTO, sem certificar
sigilo ou publicação de objetos de storage.

POST upload mantém campo file e não fixa Content-Type: o runtime monta o
boundary. Sessão, locadora e origem continuam no cliente configurado; ACL,
estoque, validação de conteúdo/tamanho, storage e regras permanecem no backend.
Limite excedido e picker cancelado não fabricam imagens. Troca de ciclo durante
seleção/HTTP e cancelamento de rascunho de perda descartam a continuação antiga.

AST conserva 293 atributos visuais: 79 Novo, 155 Editar e 59 ImageUpload web.
Comparação usa estrutura semântica dos nós, desconsiderando apenas formatação e
comentários; textos/literais/expressões continuam comparados.

### Testes executados e resultados

- 60 casos em 19 arquivos passaram: caracterizações web anteriores, nativo com
  primitivas reais sobre host RN simulado, DTO/preços/estoque/especificações,
  upload configurado, perdas/fotos/contador, falha/retry, calendário,
  cancelamento, confirmação e resposta antiga.
- Host mobile: 58 casos/dez arquivos. Host web: 183 passaram, sete skips
  anteriores. Nenhum teste anterior apagado ou afrouxado.
- Doze projetos TypeScript, ESLint, arch, tokens, lint:css, check:test-names,
  hygiene e ratchet aprovados. Arquitetura permanece intermediária; nenhuma
  baseline, tolerância ou allowlist ampliada; css-important zero.
- Build web e exports Android/iOS passaram. Source maps incluem as apresentações
  nativas, calendário, modelos e picker, sem Novo/Editar.web, CartaoPeriodo ou
  SeletorPreco DOM desta slice.

HTTP/RLS não repetidos: nenhum handler, regra ou banco foi alterado. Exports e
host simulado não certificam aparelhos, galeria do sistema, teclado/gestos ou
fidelidade visual. Snapshots, bundles e logs somente em TEMP; nenhum servidor ou
navegador persistente iniciado.

### Estado da API legada

Legado ativo: 149 rotas/193 métodos e 46 páginas da raiz. Serviço mantém
149/193. Origens, scheduler, autenticação, pagamentos e produção preservados.
Sem commit, push, deploy ou cutover. A antiga raiz app/ permanecia presente
naquele corte.

### Dívida/risco restante

Categorias com ícones/configuração rica, demais destinos administrativos,
paridade visual em aparelhos, SaaS e aceite operacional continuam pendentes.
ImageUpload em outros fluxos web ainda tem fallback relativo. O calendário de
perdas e o preview nativos exigem aceite visual; export não substitui essa
prova. O parser histórico de data ISO e a política de quantidade não foram
redefinidos.

Geral continua aproximadamente 60%, estimativa de esforço, não medição exata ou
certificação de conclusão por rotas/testes. Excluir app/ (caminho antigo)
depende de paridade, cutover e rollback operacionais comprovados.

### Próximo corte recomendado naquela onda

Completar categorias administrativas e configuração de ícones no Expo, depois
operações/financeiro/comunicações, lotes SaaS e aceite operacional. Preservar o
legado até os critérios de retirada serem satisfeitos.

## Onda 78 — categorias administrativas e ícones no Expo (2026-10-03, sem commit)

### O que foi implementado

/admin/categorias no Expo monta lista, busca por nome/descrição, ordenação
pt-BR, página de nove, detalhe, criação/edição e exclusão confirmada. carga.ts
concentra os comandos comuns; carga.web mantém window/document/confirm.
category-form compartilha estados/recents/reset do formulário e personalização.
Bloco.native existente monta ícones/emoji, busca, SVG e URL, sem segundo
catálogo.

SVG/URL ficam no rascunho até salvar o ícone com nome; emoji/ícone aplicam de
imediato ao design da categoria. Seleção/leitura ficam no host Expo usando
DocumentPicker/FileSystem instalados. Arquivo errado, limite de 64kb e falha de
leitura têm erro explícito. Mudança de fonte, formulário/transporte/sessão e
cancelamento descartam seleção/resposta antiga; confirmação resolve false ao
desmontar. O formulário bloqueia submissão simultânea.

### Arquivos criados/modificados

- pages/categorias: carga comum/adapter web, category-form, apresentações de
  lista/diálogo/detalhe native, index.native e testes de
  modelo/tela/API/contrato.
- Host Expo: rota, category-svg.native e teste; inventário de topologia.
- package.json do frontend: condição específica para a slice; default web
  intacto.
- Widget personalizar-icone: contrato opcional do picker; export EMOJI_GROUPS
  sem consumidor removido, mantendo grupos base/busca. Uma tolerância de higiene
  correspondente removida. Facade category-design perde reexport de tipo sem
  uso.
- Teste CategoryBadge usa AST para exigir o mesmo import sem depender de aspas.
  Docs de admin/arquitetura/contexto, entrada 261 e CHANGELOG atualizados.

### Contratos preservados

GET /api/admin/categories aceita array/envelope; POST/PUT mantêm name,
description, bgColor/backgroundColor, fontColor, iconColor, icon, placement,
customIcon. Mapper da entity permanece único; ícone customizado envia icon null.
409 conserva Categoria já existente; DELETE conserva erro do servidor quando
categoria está em uso. Transporte configurado, credenciais/cabeçalhos e scope
preservados. Identidade/autorização/locadora continuam impostas pelo servidor.

Nenhum handler, regra de negócio, dependência ou configuração de deploy mudou.
Cores/placement/limites de 50 e 200 caracteres mantidos. Nenhuma baseline de
arquitetura/tokens ou proteção de teste ampliada; higiene encolhe um item real.

### Testes executados e resultados

Validação consolidada, com repetições apenas após falhas/ajustes:

- 25 casos focados/12 arquivos de categorias, entity e personalizar-icone;
  inclui quatro fluxos da tela nativa com componentes reais sobre host simulado
  e três casos do modelo de formulário. Sem teste anterior removido/relaxado.
- Host mobile 59/11 arquivos; host web 183 passaram com sete skips anteriores.
- TypeScript, ESLint, arch, tokens, lint:css, colocation, hygiene e ratchet
  aprovados; css-important zero. Hygiene 880 achados/247 itens aceitos.
- AST conserva 143 atributos visuais/animação das duas telas web.
- Build web e exports Android/iOS aprovados. Source maps incluem telas/modelos/
  picker e Bloco.native, sem apresentações ou carga.web da slice categorias.
  Bundles Android 6.993.520 bytes; iOS 6.668.764 bytes.

HTTP/RLS não repetidos: não houve alteração de handlers/banco. Logs, snapshots e
exports só em TEMP; nenhum servidor persistente iniciado. Export e host simulado
não certificam execução, teclado/gestos/SVG nem imagem em aparelho.

### Estado da API legada

Legado/scheduler ativos; raiz preserva 149 rotas/193 métodos e 46 páginas.
Serviço mantém 149/193. Sem commit, push, deploy, produção ou cutover. app/
(caminho antigo) permanece até paridade e rollback operacionais comprovados.

### Dívida/risco restante

Aceite em aparelhos/visual, demais destinos administrativos, SaaS e operação
pendentes. Preview nativo representa cartão/badge e placement; não certifica
animações/swipe do CategoryShowcase web. O sanitizador e política de URL são os
históricos: isValidSvgUrl aceita http/https apesar do texto pedir https. Não se
certifica sanitização completa nem se muda essa política silenciosamente.

Geral ~60% permanece estimativa de esforço, não medição/certificação.

### Próximo corte recomendado naquela onda

Completar orçamento/locação administrativos no Expo com modelos comuns; depois
operações/financeiro/comunicações, SaaS e aceite operacional. Preservar legado
até os critérios de retirada.

## Onda 79 — consumidor administrativo de locações no Expo (2026-10-03, sem commit)

### O que foi implementado

/admin/rentals no Expo monta a slice locacoes. Lista, filtros por
status/período, busca, página dez, detalhe, contrato, check-in/check-out e
documentos usam useRentalsData e os mesmos adapters do web. DTOs e
rótulos/documentos obrigatórios ficam em contracts.ts da página; ícones/classes
do status ficam na apresentação web. Formatadores existentes foram movidos sem
mudança de comportamento.

O calendário nativo apresenta agenda por dia/semana/mês com navegação, posição
dos pendentes pela criação e demais locações pelo intervalo. Abre o mesmo
detalhe. Não replica neste corte a grade/colunas/hierarquia visual do
AdvancedCalendar web; paridade visual e aceite em aparelho permanecem pendentes.

O host só monta a rota, seleciona um arquivo image/* ou PDF e abre URL
http/https recebida pelo servidor. Multipart mantém arquivo local, tipo e
captureMetadata. Modelo captura seleção/registro/transporte; cancelar, fechar
detalhe ou mudar sessão não inicia envio antigo. Uma seleção pendente bloqueia
outra seleção. Wrappers web/native reiniciam também pela sessão e revisão do
transporte.

### Arquivos criados/modificados

- pages/locacoes/model: contracts.ts, formatters.ts e calendar.ts novos;
  carga.ts compartilhado adaptado; tipos.ts mantém apresentação web.
- pages/locacoes/ui: LocacoesPage.native, Dialogo.native e Calendario.native;
  formatar.tsx delega aos formatadores; wrapper LocacoesPage.web captura ciclo.
- index.native e condição específica de package.json conservam default web.
- apps/clients/mobile: rota /admin/rentals, rental-documents.native e testes;
  inventário real do expo-router inclui o destino.
- Testes de modelo/agenda/tela/contrato/picker e caracterizações web ajustados
  para acompanhar os mesmos símbolos movidos, sem remover asserções.
- Aprovação específica do export em ratchet-transfers, sem aumentar baseline.
  Docs de admin/documentos/arquitetura/contexto, entrada 262 e CHANGELOG.

Caminhos de frontend relativos a packages/frontend/src; nenhum handler mudou.

### Contratos preservados

GET /api/admin/rentals e GET /api/admin/clients/[id]/documents mantêm envelopes.
POST /api/admin/rentals/[id]/contract conserva resposta contract. PATCH no
detalhe conserva checkInAt/status ACTIVE ou checkOutAt/status COMPLETED. Nenhuma
nova regra de locação, pagamento, estoque ou identidade foi criada no host.

Upload permanece POST /api/admin/rentals/[id]/client-documents, FormData com
file, type e captureMetadata.source admin-rentals-page, sem Content-Type manual.
O servidor continua impondo ADMIN, ownership/locadora, tipos/limites, storage
privado e quatro documentos obrigatórios. A seleção de locadora não autoriza.

Filtro inicial PENDING, exclusão de orçamento REJECTED, cancelados apenas na
seleção CANCELLED, página dez e reset de busca/período preservados. URLs
privadas vêm da listagem/contrato; o cliente não inventa URLs públicas. Botões
web Editar e Logística sem ação não viraram funcionalidades fictícias no app.

### Testes executados e resultados

Verificação consolidada no fim do bloco; retries só após falha/ajuste:

- 23 casos focados em 11 arquivos, combinando execução e retry de dois arquivos.
  Incluem cinco fluxos nativos, comandos/metadata/multipart, troca de contexto,
  fechamento/cancelamento, erro/retry, filtros/paginação e datas da agenda.
- Host mobile: 61 casos/12 arquivos. Host web: 183 passaram, sete skips prévios.
- TypeScript dos 12 projetos aprovado; após novo teste, correção apenas da
  anotação Rental do fixture e rechecagem do projeto frontend web.
- ESLint, arch, tokens, lint:css, colocation, hygiene e ratchet aprovados.
  css-important zero; 515 testes colocados/três exceções anteriores; hygiene 880
  achados/247 itens aceitos, nenhuma tolerância ampliada.
- AST: 171 atributos de classe/estilo/animação nas apresentações web de
  lista/tabela/detalhe permanecem iguais ao snapshot anterior ao corte.
- Build web e exports Android/iOS aprovados; mapas incluem as três telas
  nativas, picker e carga compartilhada, sem apresentações/ícones web da slice.
  Android 7.026.900 bytes; iOS 6.699.972 bytes.

RN foi simulado em DOM com componentes nativos reais do design system; corpo
multipart/contratos usam HttpClient real sobre fetcher local. Export não prova
recebimento em app externo, execução/SVG/gestos/teclado ou imagem em aparelho.
HTTP/banco não repetidos: handlers, regras, schema e migrations não mudaram.
Logs/snapshots/exports só em TEMP; nenhum servidor persistente iniciado.

### Estado da API legada

Ativa e intacta: 149 rotas/193 métodos e 46 páginas na raiz; serviço mantém
149/193. Scheduler não mudou. Sem commit, push, deploy, produção ou cutover.
app/ (caminho antigo) só pode sair após paridade, aceite dos consumidores/jobs e
rollback operacionais comprovados.

### Dívida/risco restante

Calendário nativo é agenda funcional, sem certificação da grade visual web.
Execução real, arquivo privado, link externo/TTL e aceite em aparelhos
pendentes. Orçamentos/financeiro/operações/comunicações administrativos, SaaS e
operação externa seguem no objetivo geral. Check-in/out espelham o PATCH
atualmente consumido pelo web; esta onda não redefine os comandos operacionais
do backend.

~60% geral continua estimativa de esforço, sem denominador medido ou
certificação.

### Próximo corte recomendado naquela onda

Compartilhar modelos de orçamentos administrativos com Expo, mantendo boleto,
reajustes/valores, aprovação/rejeição e isolamento. Depois concluir demais
consumidores, SaaS e aceite operacional antes de retirar a API legada.

## Onda 80 — orçamentos administrativos no Expo (2026-10-03, sem commit)

### O que foi implementado

/admin/orcamentos e /admin/orcamentos/[id] montam listagem/detalhe nativos sobre
os modelos existentes do web. Kanban por mês/status, tabela com página vinte e
agenda diária/semanal/mensal são navegáveis. Busca, filtros e abertura por
search/ quoteId permanecem no contrato anterior. O detalhe oferece cliente,
entrega, equipamentos, operação, aprovação/rejeição, boleto/vencimento,
reajustes, exclusão/remoções e multa. Comandos financeiros continuam no backend.

dados/detalhe foram extraídos para modelos comuns. Facades web mantêm Next,
double requestAnimationFrame e evento de badges. Rascunhos dos quatro editores e
intervalo do calendário são comuns; nenhuma regra HTTP/financeira foi copiada
para o host Expo. Wrappers usam sessão/locadora/revisão; documentos verificam o
ciclo antes/depois da porta de compartilhamento.

### Arquivos criados/modificados

- Slice orcamentos-admin: model/dados.ts, detalhe.ts, editors.ts, calendar.ts,
  documents.ts; facades dados.web/detalhe.web; apresentações Lista/Painel/Forms/
  Calendario/parts.native e index.native.
- Web: Lista.web preserva apresentação e reinicia por status/revisão; Painel usa
  rascunhos comuns; Calendario.web usa o intervalo comum. Tabela permaneceu
  igual.
- Host mobile: duas rotas finas, contract-share recebe título opcional para PDF
  de reajuste e mantém o padrão de contrato; topologia testada.
- package.json frontend ganha condição específica para a entrada existente;
  ratchet-transfers registra a fronteira autorizada sem ampliar baseline.
- Testes colocados de contrato, calendário, editores, documentos e tela native;
  caracterizações web existentes continuam executadas.

### Contratos preservados

Query Kanban page=1/limit=500; demais modos page/limit=20, search/status/period/
valueRange. Endpoints, métodos, payloads, flags sendEmail/sendWhatsapp, ordem/
recusa parcial dos reajustes, condição de pagamento e mensagens permanecem. 202
de boleto representa processamento; 409 não vira sucesso nem arquivo. Boleto
pago/cancelado/estornado não permite editar vencimento na UI. Backend conserva
validações, identidade, ACL, RLS, histórico e centavos.

PDF de reajuste usa bytes autenticados e nome Reajuste-{quoteCode|id}.pdf; host
não repete GET com URL pública. Cache próprio é removido no finally;
encerramento de ciclo impede compartilhar resposta tardia. Abertura de boleto
usa a URL devolvida pelo servidor.

### Testes executados e resultados

- Slice: 33 arquivos/47 casos aprovados, incluindo comandos web anteriores e
  sete casos da tela native. Modelos/arquivos usam HttpClient real sobre fetcher
  local; RN é simulado em DOM com primitivas nativas reais do design system.
- Host Expo: 62 casos; host web: 183 casos e sete skips anteriores.
- Doze projetos TS, lint focado, arch, tokens, CSS, ratchet, colocation e
  hygiene aprovados. css-important zero; 520 testes colocados/três exceções
  anteriores; hygiene 880 achados/247 itens aceitos, nenhuma tolerância
  ampliada.
- AST conserva 136 atributos de classe/estilo/animação em quatro apresentações
  web e 21 ações/callbacks iguais após a extração (evento DOM adaptado por
  porta).
- Build web e exports Android/iOS aprovados. Source maps incluem os modelos e
  cinco apresentações nativas da slice, sem Lista/Painel/Calendario/Tabela web
  nem os adapters Next de dados/detalhe. Android 7103492 bytes; iOS 6786320
  bytes.

Falhas iniciais foram corrigidas sem reduzir asserções: fixture de item sem data
inicial, mock de CurrencyInput ausente e tipos/setters. Guard de DOM recusou uma
prop chamada confirm; ela virou onConfirm sem mudar a proteção. Hygiene exigiu
consumidor real do detalhe, reutilizado também por quoteId na lista. HTTP/banco
não repetidos neste bloco: handlers, regras, schema e migrations não mudaram.
Logs/snapshots/exports apenas em TEMP; nenhum servidor persistente iniciado.

### Estado da API legada

149 rotas/193 métodos e 46 páginas da raiz permanecem. Serviço conserva o mesmo
inventário de rotas/métodos. Scheduler, origens, callbacks, produção e bancos
não mudaram. Sem commit, push, deploy ou cutover. app/ (caminho antigo) depende
do aceite operacional dos substitutos e rollback antes da retirada.

### Dívida/risco restante

Agenda e pipeline nativos são apresentações funcionais adaptadas; não certificam
a grade/colunas/gestos visuais web. Datas usam campos AAAA-MM-DD; calendário,
teclado, SVG, overlays, arquivo/URLs reais e compartilhamento exigem aparelho.
Link Ver no Financeiro não foi montado no mobile antes de existir o destino.
Detalhe nativo reutiliza o painel da lista, inclusive no caminho por ID.
Reajustes mantêm recusa parcial; abort não reverte efeito remoto aceito. Limite
500 e resultados paginados do calendário são o comportamento preservado.

Demais admins, SaaS, integrações/provedores e operação continuam no objetivo
geral. ~60% continua estimativa de esforço, sem denominador medido ou
certificação.

### Próximo corte recomendado naquela onda

Consumidor administrativo financeiro no Expo sobre os modelos/adapters comuns,
com documentos, vencimento, boleto e recusas preservados; depois operações/
comunicações, SaaS e aceite operacional antes da retirada do legado.

## Onda 81 — financeiro administrativo no Expo (2026-10-03, sem commit)

### O que foi implementado

/admin/financeiro monta consumidor nativo real: tabela de dez registros,
busca/filtros, seleção por item/página, exportação PDF/XLSX/CSV, calendário
diário/semanal/mensal, indicadores, configuração tributária e detalhe do
lançamento. Status, vencimento, reemissão, ofício, reajustes/edição/exclusão e
remoção confirmada usam os comandos existentes. Dashboard e orçamento abrem o
financeiro; o lançamento abre o orçamento com search/quoteId.

carga/detalhe passam a modelos comuns. Next/router/confirm/popup ficam nas
facades web; Alert e compartilhamento de bytes são portas do host Expo. O modelo
financeiro possui DTO de calendário universal, sem carregar o barrel de
apresentação DOM do calendário. Confirmação assíncrona mantém um pedido por
lançamento e revalida ambos os clientes antes de enviar a mutação.

### Arquivos criados/modificados

- Slice financeiro: model/carga.ts, detalhe.ts, tipos.ts, period.ts,
  calendar.ts, display.ts, export.ts e document.ts; facades web e index.native.
- UI native: FinanceiroPage, Detalhe, Aliquotas, Calendario, Indicadores e
  parts. Wrapper web reinicia também por status/revisão; estilos preservados.
- Host Expo: rota fina financeiro.tsx e topologia. Portas existentes de
  transporte/arquivo e navegação reutilizadas.
- Dashboard/orçamentos native e duas rotas de orçamento: navegação financeira
  real. Teste verifica search/quoteId do atalho.
- Entrada condicional exata no package.json frontend e aprovação da fronteira
  autorizada em ratchet-transfers; nenhuma baseline/tolerância ampliada.
- Testes colocados dos contratos, intervalo, períodos, confirmação, documento e
  tela native; caracterizações web preservadas.

### Contratos preservados

Lista limit=10000 e paginação local dez. Busca/status/período, seleção/ids,
campos/settings/snapshots, query dos gráficos e calendário ficam iguais. A busca
continua não sendo aplicada ao calendário; clicar em evento só abre lançamento
presente na lista atual, como no web.

Vencimento continua PATCH /api/admin/financial/entries/{id}/due-date; reemissão
PUT /api/payments/boleto/{id}/regenerate. 202 permanece em processamento, sem
atualizar vencimento confirmado nem declarar PDF pronto. 409/403/404 não viram
sucesso ou arquivo. Reajustes preservam flags sendEmail/sendWhatsapp, DELETE
antes de POST na edição e recusa parcial. Categorias usadas em outro item ficam
desabilitadas na UI, como no web.

Ofício/exportação usam bytes autenticados; o host não repete GET público.
Relatórios conservam nomes anteriores. Ofício nativo usa Oficio-{entryId}.pdf; a
aba web conserva o comportamento anterior. A porta de arquivo recebe isCurrent;
cache próprio é removido pelo compartilhador existente. Mudança de
sessão/locadora/revisão/lançamento descarta entrega ou confirmação tardia. Abort
não desfaz efeito remoto já aceito.

### Testes executados e resultados

- 72 arquivos/122 casos do financeiro, orçamentos e dashboard aprovados. Incluem
  sete fluxos da tela financeira native e quatro casos de confirmação. RN
  simulado em DOM com primitivas nativas reais do design system; APIs usam
  HttpClient sobre fetcher local. Não é aceite em aparelho.
- Host Expo: 62 casos. Host web: 183 casos e sete skips anteriores.
- Doze projetos TS aprovados.
- arch, tokens, CSS, lint, ratchet, colocation e hygiene aprovados; nenhum
  incremento das tolerâncias. css-important zero, 526 testes colocados/três
  exceções anteriores; hygiene 880 achados/247 itens aceitos.
- AST conserva 530 atributos de classe/estilo/animação das apresentações web e
  vinte ações/callbacks após extração. Reemissão foi adaptada explicitamente
  para a confirmação assíncrona e a guarda contra pedidos duplicados.
- Build web e exportações finais Android/iOS aprovados. Os source maps incluem
  as seis apresentações financeiras native e os seis modelos comuns, sem os oito
  módulos web de apresentação/adaptação verificados. Bundles Android: 7.188.852
  bytes; iOS: 6.858.780 bytes. Logs/snapshots/exports somente em TEMP; nenhum
  servidor persistente iniciado.

Erros iniciais foram corrigidos na causa: expectativas novas de URL/verbo,
rótulo de exportação, generics de escolhas, fixture de navegação opcional e
dependência indireta de tipos DOM pelo calendário. Nenhuma asserção anterior foi
removida; testes estáticos leem também os modelos/guard extraídos. HTTP/banco
não repetidos: handlers, transações, schema e migrations não mudaram.

### Estado da API legada

149 rotas em cada host continuam presentes. API legada, scheduler, origens,
callbacks, produção e bancos não mudaram. Sem commit, push, deploy ou cutover. A
retirada de app/ (caminho antigo) continua dependendo do aceite operacional e do
rollback do substituto, além de sua paridade. Não há autorização para remover o
legado.

### Dívida/risco restante

Calendário/gráficos/lista são apresentações funcionais adaptadas; não certificam
grade/colunas/animação/gestos visuais web. Datas usam campos AAAA-MM-DD.
Teclado, overlays, gráfico, Alert, MIME/compartilhamento/arquivos e URLs reais
exigem aparelho e aceite. Configuração fiscal conserva os contratos anteriores,
sem validar a adequação tributária de uma empresa.

Apenas os comandos/consumidores deste bloco foram validados. Demais admins,
SaaS, provedores e operação seguem no objetivo geral. Pendências anteriores dos
agregados parcialmente nulos/CSV e política final de exclusão permanecem
registradas, sem correção silenciosa. ~60% geral é estimativa de esforço, sem
denominador medido ou certificação.

### Próximo corte recomendado naquela onda

Operações administrativas no Expo: logística/manutenção sobre contratos e
modelos existentes; depois demais admins, SaaS e aceite operacional antes da
retirada do legado.

## Onda 82 — logística e manutenção no Expo (2026-10-03, sem commit)

### O que foi implementado

/admin/logistics e /admin/maintenance agora montam páginas nativas reais sobre
os modelos/API das slices existentes. Logística tem busca/status/tipo, lista de
dez registros, detalhe, edição de veículo/motorista/distância/checklist/fotos/
observações e transições existentes de status. Manutenção tem filtros,
paginação, custos/detalhe e agenda. Dashboard abre os dois destinos.

Calendário possui entrada native e contrato comum: quatro modos, navegação de
período e eventos agrupados por recurso/dia. Os mapeadores extraídos conservam
intervalo de entrega de duas horas, manutenção padrão de quatro horas, correção
de fim anterior ao início e limite de 24 horas. Não há escrita nova de agenda.

### Arquivos criados/modificados

- pages/logistica e pages/manutencao: model/contracts, calendar, display e
  carga; tipos.web conserva ícones/badges e index.native monta as páginas.
- Logística: model/checklist e photos; Checklist.native, LogisticaPage.native,
  adapter upload e porta autenticada do Dialogo.web. Definições do checklist são
  as mesmas no web/native.
- widgets/calendario: contrato, intervalos, index.native e
  AdvancedCalendar.native. O contrato público web de tipos permanece.
- Host Expo: routes logistics.tsx/maintenance.tsx, teste de topologia e portas
  de picker/imagem já existentes. Dashboard native tem atalhos reais.
- Entradas condicionais exatas no manifest frontend; aprovação dessas fronteiras
  em ratchet-transfers. Nenhuma baseline ou exclusão ampliada.
- Testes colocados e fixtures locais de operações; caracterizações web ajustadas
  apenas para ler os contratos/modelos extraídos.

### Contratos preservados

GETs de logística, veículos AVAILABLE, motoristas ACTIVE, manutenção e scheduled
com includeOverdue=true conservam URLs, DTOs, filtros e paginação local dez.
PATCH de logística mantém os corpos anteriores e os estados SCHEDULED →
IN_TRANSIT → COMPLETED. Checklist mantém itens/requisitos e valores booleanos/
textuais/numéricos; contagem e apresentação de zero conservam a semântica web.

Fotos usam POST /api/upload multipart pelo transporte configurado; ImageUpload
web recebeu a mesma porta, evitando o fetch relativo padrão nesse diálogo.
Apenas o host Expo escolhe arquivos.
Seleção/cancelamento/revisão/sessão/locadora são revalidados antes e depois do
picker/upload: conclusão antiga não aplica URLs nem dispara a continuação atual.
Recusas ou resposta sem URL não viram sucesso. Abort não desfaz upload remoto já
aceito.

Os wrappers web/native também reiniciam por status da locadora e revisão do
transporte. ADMIN, permissões, validação, ownership, CSRF e RLS continuam no
backend; nenhuma regra de negócio foi duplicada no host.

### Testes executados e resultados

- 46 arquivos/76 casos de logística, manutenção, calendário e dashboard
  aprovados. Incluem edição/payload, filtros/paginação, upload negativo, seleção
  tardia, troca de escopo e ausência de className nas primitivas native. RN é
  simulado em DOM; não é prova de aparelho.
- Host Expo: 62 casos. Host web: 183 casos e sete skips anteriores.
- Doze projetos TS aprovados. arch, tokens, lint, lint:css, ratchet, colocation
  e hygiene aprovados. 537 testes colocados/três exceções anteriores; hygiene
  880 achados/247 itens aceitos; css-important zero.
- AST conserva 215 atributos de classe/estilo/animação e 63 callbacks JSX nos
  dez arquivos web verificados. Os dois corpos dos mapeadores de calendário são
  idênticos aos anteriores.
- Nove badges usam equivalentes da paleta canônica: Chrome headless com o CSS
  compilado confirmou os mesmos estilos computados e pixels. Foram eliminadas 27
  referências diretas à paleta, sem transferência/aumento de cotas. É uma prova
  focal dos badges, não captura global ou aceite visual nativo.
- Build web e exports Android/iOS aprovados. Source maps incluem as três
  apresentações native e sete modelos comuns verificados, sem os oito módulos
  web verificados. Android: 7.235.060 bytes; iOS: 6.908.000 bytes.
- Logs, snapshot, imagens e exports ficam em TEMP. Navegador headless próprio
  encerrado; nenhum servidor persistente iniciado. Nenhum banco/provedor real
  acessado. HTTP/banco não repetidos: handlers/schema/migrations não mudaram.

### Estado da API legada

Inventário atual continua com 149 rotas em cada host. API legada, scheduler,
origens/callbacks, dados e produção permanecem ativos e inalterados neste bloco.
Sem commit, push, deploy, cutover ou retirada de app/. (caminho antigo)

### Dívida/risco restante

Nova Entrega e Agendar Manutenção continuam mostrando a indicação anterior de
funcionalidade em desenvolvimento; não se inventou criação onde o web ainda não
a implementava. Calendário native é uma apresentação funcional por recurso/dia:
não certifica grade mensal/Gantt, sobreposição, arraste, animação ou gestos web.
Callbacks opcionais fora dos fluxos usados nestas páginas não foram
certificados.

Visual, teclado, overlays, seleção/câmera/imagens e operação em Android/iOS
reais exigem aparelho e aceite. Demais admins, SaaS, provedores e operação
continuam pendentes. Geral ~60% permanece estimativa de esforço, sem denominador
medido; esse bloco não certifica a conclusão do produto.

### Próximo corte recomendado naquela onda

Configurações/permissões administrativas e comunicações no Expo, com portas de
host para capacidades locais e modelos compartilhados. Depois SaaS e aceite
operacional/rollback antes da retirada do legado.

## Configurações e permissões administrativas Expo — onda 83 (2026-10-03, sem commit)

### O que foi implementado

Configurações ganhou consumidor nativo das seis seções observadas no web:
empresa, carrossel, redes sociais, SEO, sistema e personalização. Carga,
formulário, máscara de telefone, sincronização da descrição, salvamento integral
e reset confirmado usam o modelo comum. A fachada web mantém input de arquivo,
scroll DOM e as mensagens JSX anteriores; native recebe mensagens de texto.

Logo e imagens do carrossel usam o transporte autenticado existente. O host Expo
seleciona arquivos e renderiza imagens, reutilizando o construtor multipart de
equipamentos. O modelo recusa MIME/tamanho inválidos e quantidade acima do
limite antes do envio. Revisão da seção descarta seleção antiga mesmo ao sair e
voltar à seção inicial. Cancelamento não desfaz um efeito já recebido pelo
servidor.

Permissões já tinha apresentação nativa. O bloco caracterizou a matriz de 45
escolhas, ADMIN desabilitado, gravação exclusiva do papel selecionado, 403 e
reinício do perfil ao trocar contexto. O wrapper também considera status da
organização. Dashboard liga os dois destinos reais; a rota de permissões deixa a
rolagem com a página, evitando ScrollView aninhado no host.

### Arquivos criados/modificados

- Configurações: model/use-settings-data.tsx (comum), sua fachada .web.tsx,
  model/media.ts, ui/ConfiguracoesPage.native.tsx,
  ui/SettingsPreviews.native.tsx, index.native.ts e testes colocados. O teste
  API do hook passou a use-settings-data.api.web.test.tsx porque caracteriza a
  fachada DOM. A página web passa a porta de upload autenticado ao ImageUpload.
- Permissões: wrappers web/native e PermissoesPage.native.test.tsx.
- Host Expo: host/settings-image-picker.native.ts e teste, rota
  (admin)/admin/settings.tsx, integração da rota permissions e routes.test.ts.
  DashboardPage.native.tsx acrescenta os dois atalhos.
- Manifest frontend e autorização exata de package.exports em
  tools/ratchet-transfers.json. Nenhuma baseline, exclusão ou proteção ampliada.
- Esta feature, admin-system.md, admin-permissions-and-roles.md,
  architecture/modernization.md, contexto IA, issues e CHANGELOG.

### Contratos preservados

GET/PUT /api/admin/settings, POST /api/upload e GET/PUT /api/admin/permissions,
envelopes, payload integral de settings e payload do perfil selecionado
mantidos. Upload de logo conserva type=logo; carrossel não o envia. Campo de URL
do logo, limite dez imagens, ordem/remoção e transformação em objetos imageUrl
continuam. Como no web, editar a lista de URLs substitui os metadados dos itens;
sem mudança de regra de negócio.

Reset continua com Confirmar/Cancelar, defaults apenas da seção, espera de 100
ms e salvamento integral. Padrões legados GB, campos ocultos e estados de erro
não foram substituídos. Redes sociais adicionais continuam em desenvolvimento
como no web; CSS/JS customizados são editados e exibidos como texto, sem
execução no preview nativo.

Principal, grants, CSRF, isolamento e storage continuam no backend. Upload
permanece exclusivo de ADMIN; UI/rotas não concedem acesso. O modelo puro usa
tipagem Promise<void> na espera do reset para os overloads de timer do Expo.

### Testes executados e resultados

- Configurações/permissões/dashboard: 27 arquivos, 50 testes passaram.
- Host Expo: 13 arquivos, 64 testes passaram, incluindo picker single/multiple,
  cancelamento e URI/MIME/tamanho. Host web: 183 passaram e sete skips
  anteriores.
- pnpm typecheck: doze projetos aprovados. Lint dos arquivos do bloco, arch,
  tokens, check:test-names, ratchet:guard --base HEAD, lint:css e hygiene
  passaram. A validação consolidada encontrou e corrigiu somente problemas de
  teste/tipo: opção exact inválida, import act sem uso e Promise do timer sem
  tipo explícito.
- pnpm build:web passou. Exports Hermes Android/iOS com source maps passaram,
  fora do repositório: 7.267.596 e 6.940.808 bytes. Seis fontes native/comuns
  presentes; cinco fachadas DOM de configurações/permissões ausentes em ambos.
- Comparação AST com a fotografia anterior: 137 atributos web de estilo/
  animação e 40 callbacks JSX iguais. Seis previews web e corpo dos defaults de
  reset sem alteração; três mensagens web produzem HTML idêntico.

Provas usam transporte dublado/primitivas native adaptadas ao DOM e exports
locais. Não são prova de uso em aparelho, upload real ou autorização concedida.

### Estado da API legada

Ativa: contagem atual de 149 rotas em cada host. Este bloco não muda handlers,
backend, banco, scheduler, origens, callbacks ou produção. Sem commit, push,
deploy, cutover ou retirada da pasta app/. (caminho antigo)

### Dívida/risco restante

Os previews nativos mostram os dados das seções e alternam imagens, mas não
certificam o desenho, SVG de onda, movimento, tipografia, teclado ou gestos do
preview web. Visual/fidelidade, picker, multipart e imagens exigem aparelho e
aceite. Campos e previews com padrões legados não definem nova marca/produto.

Comunicações nativas, demais pendências SaaS, provedores e aceite operacional/
rollback seguem pendentes. Geral ~60% continua estimativa de esforço, sem
denominador medido; este bloco não certifica conclusão geral.

### Próximo corte recomendado naquela onda

Comunicações administrativas Expo (e-mail/WhatsApp), mantendo modelos, contratos
e recusas existentes e isolando capacidades locais no host. Depois concluir os
lotes SaaS e aceite operacional antes de retirar o legado.

## Comunicações administrativas Expo — onda 84 (2026-10-03, sem commit)

### O que foi implementado

E-mail e WhatsApp ganharam consumidores nativos das slices existentes e rotas
finas no Expo. Dashboard abre os dois destinos. Tipos e controladores foram
extraídos das fachadas web, mantendo adapters HTTP, escopo e regras do backend.
Next, atalhos DOM, localStorage e input de arquivos continuam somente no web.

E-mail nativo apresenta conta, pastas, busca/filtros/período, lista, seleção e
ações em massa, preview HTML, anexos, expansão, resposta/encaminhamento,
rascunhos e confirmações de spam/exclusão/descarte/assunto vazio. Datas são
entradas AAAA-MM-DD neste incremento; o calendário/resize/teclado e desenho
Outlook do web não foram certificados no aparelho.

O host seleciona anexos, fornece UUID, armazenamento por usuário/locadora,
compartilhamento de bytes autenticados e HTML isolado. A WebView usa HTML
inline, scripts desativados, CSP antes do corpo recebido, cookies
compartilhados, armazenamento DOM e acesso a arquivos desativados. Sem
headers/tokens/baseURL da API ou ponte onMessage. Navegação é bloqueada; HTTP(S)
sem credenciais só abre após confirmação explícita. Isso caracteriza
configuração local, sem alegar execução em aparelho ou renderização visual
idêntica.

Conectar Zoho abre o painel web autenticado configurado por EXPO_PUBLIC_WEB_URL,
somente origem HTTP(S), HTTPS em produção. Não transfere tokens do Expo por URL
e não cria OAuth alternativo. Ao fechar o navegador, o modelo consulta novamente
a conta; fechar não significa conexão confirmada. Sem origem válida, há feedback
e nenhuma navegação. O operador ainda autentica no navegador; handoff OAuth
nativo direto permanece pendente.

### Arquivos criados/modificados

- email-admin: tipos/ports/native-ports, carga.ts comum e fachada carga.web.ts,
  use-email-composer.ts comum, format.ts, duas apresentações native e entrada
  index.native.ts. UI web reexporta os tipos anteriores; JSX preservado.
- whatsapp-admin: tipos, modelos use-whatsapp-page/use-reply-composer comuns,
  WhatsAppAdminPage.native.tsx e index.native.ts; fachadas web preservadas.
- Host Expo: mail-html/mail-files/mail-connect/mail-storage.native, duas rotas
  administrativas e seus testes. contract-share recebe fallback MIME opcional;
  contratos continuam com default HTML/PDF e anexos genéricos usam public.data.
- Manifest frontend com duas condições react-native exatas, inventário de rotas,
  atalhos de dashboard e autorizações de entrypoint em ratchet-transfers.
  Nenhuma baseline, exclusão, skip novo ou guarda afrouxada.
- Testes colocados native/host; provas web continuam nos mesmos módulos de
  consumo. Asserções estáticas de APIs passaram a ler os modelos extraídos,
  preservando as verificações anteriores.

### Contratos preservados

WhatsApp conserva conversas/messages com limite cinquenta, offset/before,
normalização e envio POST com texto aparado. Web e Expo chamam a mesma API.
Falha de envio não afirma sucesso. O fechamento/limpeza do compositor após
recusa continua com a semântica observada do web; não foi alterado
silenciosamente.

E-mail conserva accounts/folders/messages, payloads read/star/archive/spam/
notspam/move/delete, confirmações, optimistic rollback, draft/autosave 2500ms,
mailFormat html, anexos multipart files, limite 20MB/arquivo e 50MB total,
CC/BCC e X-Idempotency-Key. Resposta negativa mantém compositor aberto. Download
conserva query accountId/folderId/filename e headers autenticados;
compartilhamento não faz uma segunda requisição sem autenticação. Cache criado
pelo host é removido no finally. Picker tardio e storage anterior não revivem
contexto encerrado; status/usuário/locadora/transporte reiniciam as páginas.

### Testes executados e resultados

- Bloco frontend: 28 arquivos, 59 testes aprovados no agregado final. A primeira
  execução apontou um rótulo composto e o dublê de download com URL incorreta;
  corrigidos e quatro testes de e-mail nativo aprovados na reexecução focal.
- Host Expo: 16 arquivos, 80 testes passaram. Host web: 183 passaram, sete skips
  anteriores. Nenhum skip ou tolerância acrescido.
- Doze projetos TypeScript aprovados; erros iniciais estavam nos tipos de dublês
  de fetch/picker. Lint focal aprovado após corrigir catch vazio, variáveis não
  usadas e dependência de callback da fachada.
- arch, tokens, check:test-names, ratchet:guard --base HEAD, lint:css e hygiene
  passaram. css-important continua zero. Baselines intactas neste bloco.
- AST sobre a fotografia anterior conserva 294 atributos web de estilo/ animação
  e 133 callbacks JSX. Trinta e sete ações de e-mail têm inicializadores
  idênticos; download/connect apenas delegam às portas.
- pnpm build:web passou. Exports Hermes Android/iOS com source maps passaram,
  fora do repositório: 7.415.008 e 7.087.824 bytes. Onze fontes native/comuns
  presentes, oito fachadas DOM de comunicação ausentes em ambos. Dois
  normalizadores e 24 inicializadores do controlador WhatsApp são idênticos à
  fotografia anterior.

Provas usam transporte dublado e primitivas RN adaptadas ao DOM; não comprovam
entrega Meta/Zoho, OAuth real, anexos/HTML em aparelho, gestos ou fidelidade
visual.

### Estado da API legada

Ativa: contagem atual de 149 rotas em cada host. Nenhum handler HTTP, contrato
server, banco, scheduler, segredo, origem operacional ou callback foi trocado
por este bloco. Sem commit, push, deploy, cutover ou retirada de app/. (caminho
antigo)

### Dívida/risco restante

Aparelhos, WebView/picker/compartilhamento reais, layout/resize/gestos/teclado,
provedores e integração OAuth no navegador exigem aceite. Consulta e fluxo
funcional nativos não equivalem à certificação visual. Permanecem demais lotes
SaaS e aceite operacional/rollback. Geral ~60% continua estimativa de esforço,
sem denominador medido; não é conclusão geral nem autorização para retirar
legado.

### Próximo corte recomendado naquela onda

Inventariar os lotes SaaS restantes pelos consumidores reais e executar o
próximo bloco implementável, mantendo pendências de aparelho/provedor e aceite
operacional separadas. Retirada do legado somente após paridade e rollback
comprovados e autorização.

## Fundação de dados SaaS — onda 85 (2026-10-03, sem commit)

O schema passa a conter os 17 modelos comerciais/de operação da ADR SaaS,
separados das 31 tabelas de negócio. Sete migrations novas, sem editar o
histórico anterior a esta onda: enum isolado, função sentinela/view, catálogo e
assinaturas, ciclo da organização, contas/cofre, operação e locks de
invariantes. As seis primeiras seguem B.4; a sétima serializa vínculos/equipe e
alterações do dono, e fecha os CHECKs de motivo de cortesia e retirada de
consentimento.

O backfill cria plano interno não público com valor zero e assinatura
COMPLIMENTARY/ACTIVE para cada locadora existente; acesso FULL e publicação
atuais são preservados. Não cria preços comerciais nem chama o Asaas.
Organizações novas nascem SETUP. Campos de projeção/publicação não podem ser
forjados por INSERT/UPDATE do runtime de aplicação. Dono exige vínculo
ADMIN/ACTIVE, com FK diferida e preservação da associação. Equipe da plataforma
e vínculo ativo de locadora são mutuamente exclusivos, inclusive em corrida.

### Arquivos e limites de responsabilidade

- prisma/schema.prisma e prisma/migrations/202610030101…0107_*: DDL, índices
  parciais, FK composta, histórico, RLS e triggers. Faturas também têm
  settlesInvoiceId/debtWaivedAt para os fatos refinados de B.5.
- prisma/sql/roles/app_runtime.sql e platform_runtime.sql: scripts DBA
  idempotentes, fora das migrations. Novos papéis são NOLOGIN; LOGIN/senha ficam
  fora do código. O papel de plataforma não lê/altera/apaga negócio nem users;
  apenas insere quatro sementes sob a RLS existente e lê a view de contato com
  quatro campos. Não execute em produção sem aceite próprio.
- tools/tenant-models.json e tenant-database-check.mjs: classificam também
  PLATFORM; conferem políticas exatas, ausência de DELETE, guard habilitado,
  ownership e privilégios de coluna/tabela. As políticas tenant originais
  continuam exigindo exatamente tenant_isolation, sem exceção de plataforma.
- tools/platform-preflight.mjs: leitura explícita por
  PLATFORM_RUNTIME_DATABASE_URL; transação READ ONLY, contexto local, resultado
  com ids e nomes de variáveis ausentes, sem valores.
- backend/runtime/integration-credentials e consumidores billing/documents:
  credentialsRef nullable é recusada antes de ler env. ENV_REF mantém o
  comportamento; o resolvedor VAULT pertence a S3/S7 e não foi simulado.
- Fixtures de estado usam papel temporário restrito em
  tests/helpers/platform-fixture.ts; nenhum trigger é desligado. Referências sem
  env agora usam o formato aprovado.

### Operação DBA e recuperação

Aplicar migrations com a identidade migradora em ambiente autorizado. Depois,
executar os dois SQLs de papéis no mesmo banco. O script de plataforma transfere
o SECURITY DEFINER de verificação de equipe ao papel restrito; não conceder
SELECT em users/tabelas de negócio nem herança de outro papel. Configure as
conexões fora do Git. Verifique separadamente:

```powershell
pnpm tenant:check
pnpm tenant:check -- --platform
pnpm platform:preflight
```

O primeiro comando exige TENANT_RUNTIME_DATABASE_URL; os dois últimos exigem
PLATFORM_RUNTIME_DATABASE_URL. Bloqueio de preflight aborta sem modificar dados
e informa o resolve --rolled-back da própria migration. Corrigir os fatos
somente com autorização, marcar aquela tentativa revertida e aplicar de novo.
Não usar db push/reset. Depois de aplicada em ambiente compartilhado, não editar
a migration; correções posteriores são migrations novas.

### Provas e estado

As migrations aplicaram do zero em banco exclusivo local e sobre base antiga com
duas organizações. Backfill, preflights inválidos sem DDL/data persistidos,
papéis idempotentes, GUC sem elevação, 31 recusas de leitura/update/delete,
segredos/FKs/índices, dono, histórico, suporte e duas corridas de equipe/vínculo
são exercitados em tests/identity/platform-scope-database.test.ts.

A suíte de identidade passou em 14 arquivos/177 casos (43 S2). Doze projetos TS,
tsc raiz e hygiene passaram. O primeiro unit teve 3848 casos aprovados e cinco
falhas; os quatro arquivos afetados passaram depois em 50 casos, sem ampliar
timeouts. Segurança teve 698 aprovados/18 skips anteriores e um mock de
fronteira desatualizado; os 12 casos desse arquivo passaram após atualização. O
fechamento HTTP/gates está registrado abaixo.

Os dois artefatos (`pnpm exec next build` e `pnpm build:api`) passaram. Os
comandos operacionais `tenant:check`, `tenant:check -- --platform` e
`platform:preflight` passaram com conexões LOGIN dos papéis restritos em banco
local exclusivo. O resolvedor de credenciais ENV_REF passou em 11 casos; o
arquivo de proteção do CI passou em seis. Lint dos arquivos da onda, arch,
tokens, nomes de teste, ratchet, lint:css, hygiene, Markdown e índices/links
passaram sem aumentar baselines.

A primeira comparação HTTP usou o perfil dev por engano: 2621 aprovados e 130
falhas, sem constituir prova do perfil de produção. As falhas de cookies Secure
e detalhes de erros exigem os dois builds em produção local. Uma fixture de
frete com `postalCode` antes de `status` também precisava do papel de plataforma
para restaurar ACTIVE; o reset recusado deixava a locadora suspensa e afetava os
testes seguintes. O reset agora usa o mesmo helper restrito, com o guard ligado.
Quatro expectativas antigas de extração parcial foram atualizadas para a
montagem já existente: sessão nos dois hosts, PUT de permissões autenticado (401
sem sessão) e PATCH nas OPTIONS financeiras. POST/PATCH/DELETE não suportados
continuam 405; a comparação mantém status, corpo e efeitos, sem redirecionar
autenticação. O CI compila o legado e usa API_HOST_MODE e API_LEGACY_MODE em
production para os dois motores de identidade.

Na produção local com identidade legacy, 2750 casos passaram e uma fixture de
frete falhou ao tentar persistir referência literal, agora rejeitada pelo CHECK
novo. O arquivo passou depois nos 44 casos: referência literal é recusada sem
alterar a integração/chamar provedor; VAULT ainda sem resolvedor permanece 503.
O perfil ENV_REF válido sem chave mantém seus casos de indisponibilidade. Não se
retirou o CHECK para construir uma fixture inválida. Os resultados são da rodada
completa mais sua reexecução focada, sem afirmar um novo comando completo verde
em legacy.

A rodada Better Auth aprovou 2745 casos e revelou uma expectativa antiga do
teste de orçamento do motor nativo: procurava a janela de localhost, enquanto o
helper atual encaminha o IPv6 reservado da própria rodada. A asserção agora
exige a janela desse /64, contagem de todos os logins reais e timestamp
posterior ao início. Os 277 casos do arquivo passaram na reexecução em produção
local. Não se zerou contador, elevou orçamento ou desativou rate limit. A
cobertura HTTP desta onda é a das rodadas completas com suas reexecuções
focadas; não certifica aparelhos, provedores reais ou retirada do legado.

A integração aprovou 80 de 81 casos; um caso do cron de boleto atingiu seu
timeout de 20 segundos na execução paralela. Os dois casos desse arquivo
passaram na reexecução isolada, mantendo o timeout e as asserções. Antes disso,
uma invocação havia sido recusada pelo guard por usar DATABASE_URL e
TEST_DATABASE_URL iguais; foi corrigida a configuração para os dois bancos
descartáveis distintos, sem contornar o guard. Os servidores de HTTP/integração
e o PostgreSQL exclusivos da onda são encerrados ao fechar o bloco; os demais
processos do ambiente não são alvos de limpeza.

A auditoria dos leitores de Organization confirmou seleções/DTOs explícitos em
roteamento, principal, configurações e cartão público; não ampliamos essas
respostas com campos comerciais novos. Rótulos de locação receberam apenas
tipagem dos seis nomes existentes para o noUncheckedIndexedAccess da raiz, sem
mudar textos/cores/estilos. O harness HTTP usa um preload composto de Zoho,
WhatsApp e frete porque next dev serializa os requires repetidos em um valor.

S2 ainda exige composição do pool/transação de plataforma, outbox e runner/cron
sem scheduler duplicado. Os dados do cofre não são um cofre operante;
assinatura, onboarding, acesso/limites e backoffice continuam nos próximos
lotes. Não houve cutover, scheduler, ambiente, commit, push, deploy ou retirada
de app/. (caminho antigo) A API legada permanece ativa. Este é avanço local
intermediário da modernização geral.

## Onda 86 — runtime isolado de plataforma (2026-10-03, sem commit)

O S2 agora tem composição em `packages/backend/src/runtime`, consumida pelos
dois hosts. `PLATFORM_DATABASE_URL` é obrigatória apenas quando uma operação de
plataforma é executada. O pool lazy usa um cache próprio e nunca reutiliza o
cliente/pool de DATABASE_URL. O cache pertence ao módulo, sem reescrever objetos
globais do runtime. Uma identidade já em uso não é trocada dentro do processo;
rotação exige reinício. A composição converte erros de conexão/ configuração em
503 neutro, sem imprimir strings de conexão.

`platform-scope` injeta Prisma e verifica o papel efetivo em cada transação:
recusa administrador, negócio, ownership, poderes administrativos, associação a
outro papel e grants operacionais (inclusive SELECT de uma única coluna).
`app.platform_scope` e `app.tenant_id` são LOCAL, com tenant vazio no fluxo de
plataforma e explícito no provisionamento. Commit/rollback não deixam contexto
na conexão. O seed usa createMany sem RETURNING nas quatro tabelas autorizadas;
leitura ou escrita de outra locadora continuam recusadas pelo PostgreSQL. O
checker DBA completo da onda 85 continua obrigatório, sem substituir suas provas
de políticas pelo guard do runtime.

A outbox separada conserva tenantId informativo e nullable. O dispatcher
existente recebe tipos genéricos com o padrão de negócio inalterado (string).
Claim usa SKIP LOCKED e lease; acknowledgements comparam id, worker, estado e
número da tentativa, inclusive quando um worker id é reutilizado. Dedupe
preserva o primeiro evento e recusa a mesma chave para agregado/tópico/tenant
diferentes. A inserção concorrente usa upsert nativo do PostgreSQL: o update da
própria chave evita o fallback SELECT/INSERT do Prisma com update vazio, que
reproduziu P2002 em registros simultâneos. Payload, estado e tentativa do
primeiro evento ficam preservados. Retry/terminalização usam o dispatcher
existente e gravam códigos, sem texto do provedor. Só tópicos com consumidores
instalados podem ser reivindicados. O primeiro consumidor é
`platform.rate-limits.purge`: usa a limpeza existente de directory, conserva a
margem de 60 segundos e as contagens/janelas vigentes. A composição enfileira
uma vez por minuto por chave de dedupe; executar duas vezes conserva o mesmo
evento. O cron legado da outbox conserva sua limpeza atual; nenhum agendamento
foi instalado para o endpoint novo e ambas as operações são idempotentes. Esta
fase não entrega cobranças, reconciliação ou onboarding fictícios, nem consome
eventos comerciais futuros.

`GET /api/cron/platform` é novo nos dois hosts; autentica por CRON_SECRET antes
da composição e responde private/no-store. As recusas de cron no helper comum
também recebem no-store, mantendo status/corpo. Sem configuração própria ou
papel válido, responde 503 `{ error: 'Platform jobs unavailable' }`. Com papel
válido, responde 200 com contadores de entrega e registeredTopics=1. Uma nova
janela entrega o job de manutenção; uma chamada repetida no mesmo minuto
conserva o job concluído. Um registry injetado vazio também é provado sem
alterar eventos existentes. Nenhuma entrada de scheduler/vercel foi adicionada;
o legado continua ativo.

A composição usa o entrypoint existente backend/runtime; os módulos de escopo e
jobs continuam internos, sem ampliar exports do pacote ou proteções do ratchet.
A regra hard PLATFORM-PRISMA resolve imports locais/aliases e aceita o módulo de
banco apenas na composição de jobs. O harness HTTP limpa explicitamente
PLATFORM_DATABASE_URL porque ele provisiona apenas o papel de negócio; uma
variável do desenvolvedor não pode direcionar o cron de teste à produção.

Validação consolidada desta onda, no PostgreSQL local descartável:

- `pnpm test:identity`: 15 arquivos, 189 testes passaram, incluindo os 12 casos
  do runtime isolado e os dez registros concorrentes da mesma manutenção.
- `platform-cron.test.ts` e `route-auth-inventory.test.ts`: 85 testes passaram.
- `architecture-runtime.test.ts` e os casos de outbox de
  `tenant-database.test.ts`: 43 testes passaram. O import direto ou por alias do
  pool fora da composição é recusado; a outbox de negócio conserva seu contrato.
- `platform-database.test.ts`: seis casos de configuração e isolamento passaram.
- `platform-cron.http.test.ts`: passou com ambos os hosts compilados em
  production, com autorização real e respostas 401/503 private/no-store. A
  conexão comercial é explicitamente ausente no harness: esta prova HTTP
  certifica a recusa sem fallback. Entrega positiva, margem de limpeza e 200 dos
  dois handlers foram provados em processo com papel PostgreSQL restrito real.
- `pnpm build` e `pnpm build:api`: passaram após a correção da corrida. São
  compilações locais; nenhuma publicação foi executada.
- `pnpm typecheck` (12 projetos), `pnpm type-check`, `pnpm lint`, `pnpm arch`,
  `pnpm hygiene`, `pnpm tokens`, `pnpm check:test-names` e `pnpm ratchet:guard`:
  passaram. Nenhum baseline, tolerância ou aprovação foi ampliado nesta onda;
  css-important continua zero.
- Markdownlint, índices/links de documentação e diff-check com a configuração de
  normalização do repositório passaram. Os dois servidores HTTP do harness e o
  cluster PostgreSQL desta rodada foram encerrados após as provas.

A prova concorrente falhou inicialmente com P2002 e passou após a correção
atômica, conservando a exigência de um evento e uma entrega. O inventário local
tem 150 rotas/194 métodos declarados em cada host; essa contagem não representa
conclusão dos lotes SaaS. Inbox/consumidores comerciais, cofre S3, assinatura e
demais lotes, aparelhos/provedores/operação e retirada da raiz continuam
pendentes. Geral ~60% permanece estimativa de esforço, sem denominador medido.
API legada e scheduler continuam ativos; sem cutover, commit, push ou produção.
O próximo corte recomendado é o cofre S3 e seu resolvedor de credenciais,
preservando o caminho env legado até provas de paridade.

## Onda 87 — cofre e resolvedor de credenciais (2026-10-03, sem commit)

A fundação S3 fica em `packages/backend/src/modules/secrets`, atrás de uma
fachada interna explícita. O módulo recebe KEK, relógio e chave de fingerprint;
não consulta ambiente ou importa um host. A composição em runtime é consumida
pelas integrações dos dois hosts, sem duplicar regras de criptografia em
apps/services/api. O subpath público backend/secrets da ADR é reservado para um
consumidor comercial real; não acrescentamos um export sem uso para contornar o
ratchet. O schema/migrations da onda 85 permanecem intactos.

Cada segredo tem DEK aleatória de 32 bytes, IV de 12 bytes e tag de 16 bytes em
AES-256-GCM. AAD é exatamente
`v1|tenantId|integrationId|purpose|version|environment`, com `-` para ambiente
nulo. IDs/versão/ambiente são validados antes de montar essa cadeia, incluindo a
recusa de delimitadores. O fingerprint é HMAC-SHA256 sob chave própria e
estável; não mudar essa chave junto com a KEK. Plaintext só sai por um accessor
explícito; JSON, String/template e inspect não o expõem. Buffers temporários da
DEK e do plaintext são zerados em finally. Isso não promete apagar strings
imutáveis do heap JavaScript nem proteger valores deliberadamente extraídos para
uma mensagem.

O adapter env conserva um keyring para abrir versões antigas. AWS KMS usa ARN
imutável de chave em sa-east-1, SYMMETRIC_DEFAULT e EncryptionContext `{ aad }`
idêntico na abertura. AAD contém identificadores/contexto, nunca o segredo: o
contexto do KMS pode aparecer em logs de auditoria AWS. Resposta com outra chave
ou DEK inválida é recusada. O SDK só é carregado quando há uso KMS; a aplicação
ENV_REF não precisa carregar essa infraestrutura. Self-service on exige provider
aws-kms e federação explícita por AWS_ROLE_ARN/AWS_WEB_IDENTITY_TOKEN_FILE;
credentials estáticas não são passadas nessa composição. São adapters locais,
com testes de porta falsa: nenhuma conta, chave, política IAM/OIDC ou chamada
AWS real foi provisionada ou homologada. Referências consultadas:
[Node crypto](https://nodejs.org/api/crypto.html),
[AWS KMS Decrypt](https://docs.aws.amazon.com/kms/latest/APIReference/API_Decrypt.html)
e
[AWS SDK credentials](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/migrate-credential-providers.html).

Store cria PENDING; ativações autenticam o envelope antes de deslocar a ACTIVE
para PREVIOUS. Lock por integração/finalidade serializa criação de versões e
troca de estado. Reveal exige ACTIVE, validade e contexto de integração/ambiente
corretos. Escrita exige transação de plataforma; leitura tenant exige a locadora
da transação. Administrador/bypass e outra locadora são recusados. Destroy
recusa ACTIVE, zera os quatro blobs na base e conserva metadados; repetir é
idempotente. A validação da chave no provedor antes de ativá-la e a revogação da
chave anterior pertencem ao futuro caso de uso da conta, não a este módulo.

Rewrap preserva ciphertext/IV/tag/lifecycle/fingerprint: troca só a DEK
embrulhada, provider e KEK id. O tópico real secrets.rewrap usa a outbox e o
dispatcher existentes, com dedupe por minuto; abre uma transação por segredo,
com lotes pequenos e limite por chamada KMS. O cron instala esse consumidor
somente quando o cofre está configurado. Sem cofre, conserva a manutenção da
onda 86 e deixa outros tópicos pendentes. Nenhum scheduler novo foi criado.

O resolvedor mantém literal o argumento ENV_REF dos chamadores antigos. A flag
INTEGRATION_ENV_REFS_ALLOWED é optativa para compatibilidade, e false recusa o
caminho env. VAULT recebe metadados da integração já selecionada, abre somente a
ACTIVE correta e não cai para env quando falha. Pagamento/contrato que já está
numa transação empresta a própria conexão, inclusive com pool de uma conexão;
não abre uma transação concorrente e não muda a política do pool. Asaas VAULT
autentica SHA-256 do header asaas-access-token atual ou anterior não expirado,
sem depender da chave de saída/cofre/KMS. Os aliases antigos só continuam no
caminho ENV_REF. Organização/integracão suspensa continuam com o comportamento
legado: aceitação INBOUND_ONLY e classificação comercial de eventos ficam em S7.

O logger Pino redige recursivamente campos de credencial, headers, blobs e KEK,
sem ler valores de accessors com nomes sensíveis. Erros do cofre/KMS retornam
códigos neutros, sem raw SDK/Prisma cause. A guarda hard SECRET-VAULT-OWNERSHIP
recusa model access por ponto/chave/desestruturação e SQL, inclusive template
interpolado, fora de modules/secrets. Nenhuma tolerância ou proteção de teste
foi reduzida. O projeto não tem uma composição Sentry ativa encontrada neste
corte; beforeSend/telemetria externa precisa receber a mesma redação quando essa
composição existir, antes do aceite operacional.

Limites: S7 ainda não tem importador dry-run/apply, plano confirmado nem
migração de variáveis reais. Melhor Envio por VAULT ainda carece de fonte
explícita de userAgent; falha fechado, enquanto ENV mantém seu contrato. Não há
rotas/telas para armazenar ou revelar segredos, onboarding, assinatura ou contas
provisionadas. KMS/IAM/OIDC, rotação real no provedor, aparelhos e operação não
estão certificados. API legada/scheduler continuam ativos; sem cutover, commit,
push, produção ou retirada de app/. (caminho antigo) Geral ~60% continua
estimativa de esforço.

O próximo corte é completar S7 com importação assistida idempotente, conferência
do plano e do fingerprint e testes de rollback, antes de começar as contas de
recebimento. O desenho não autoriza remover variáveis nem trocar webhooks reais.

Validação consolidada local desta onda:

- Backend: 13 arquivos/141 testes passaram, com adulteração dos quatro blobs,
  todas as dimensões da AAD, perda da KEK antiga, redação e falhas KMS
  simuladas.
- PostgreSQL: dez casos do cofre passaram com LOGIN restrito real. A rodada
  conjunta cofre/runtime aprovou 22 casos. Confirma versões concorrentes,
  duplicação de chave entre locadoras recusada, ativação adulterada sem deslocar
  ACTIVE, rewrap env/env e env/porta KMS falsa, pool max=1 e crypto-shredding.
  Os 189 casos anteriores de identidade passaram na rodada ampla; a falha nova
  do lock foi corrigida e reexecutada com os casos do cofre. Não apresentamos a
  primeira rodada ampla, que falhou, como comando completo verde.
- Unidade: a rodada ampla executou 3855 casos, com 3851 aprovados e quatro
  falhas em dois arquivos sob custo de importação/carga. Após composição KMS
  lazy, os arquivos customers-http/legacy-auth-composition e a guarda de
  arquitetura passaram: três arquivos/107 casos. Nenhum timeout ou asserção foi
  relaxado. O resultado é da rodada ampla com reexecução focada, sem afirmar uma
  segunda execução completa verde.
- Ambos os hosts compilaram em production local. A comparação HTTP com motor
  legacy aprovou 68 casos em payment-webhooks/platform-cron, incluindo hashes
  VAULT atual/anterior, expiração e aliases recusados. O reset da fixture
  ENV_REF foi corrigido na mesma operação de credentialsRef, mantendo o CHECK.
  Não foi repetida nesta onda a matriz HTTP completa do Better Auth ou
  aparelhos.
- Types/lint/arch/hygiene/tokens/colocation/ratchet locais aprovados. Sem nova
  exceção ou expansão de baselines. Guardas de reflection/coerção foram
  respeitadas; os servidores HTTP do harness são encerrados pelo teardown.

As limitações operacionais acima continuam válidas mesmo com essas provas.

## Onda 88 — importação assistida de credenciais (2026-10-03, sem commit)

O caso de uso `modules/secrets/import.ts` prepara/aplica uma integração por
plano. Runtime de plataforma compõe transações e cofre; a CLI
`tools/integration-secrets-import.mjs` lê só o arquivo local indicado e chama o
entrypoint existente `backend/runtime`. Não há regra nova nos hosts HTTP nem
outro scheduler.

A simulação usa SET TRANSACTION READ ONLY, sem instanciar o provider, selar ou
alterar dados. O hash completo vincula banco/papel/endereço/porta efetivos,
metadados da integração, referência e fingerprints HMAC. A saída contém ids,
provider, IMPORT/NOOP, hash do plano e fingerprints truncados; não contém
valores, referências, caminhos locais, DSN ou mensagens brutas de erros. Arquivo
máximo 256 KiB, sem expansão de variáveis/comandos nem carregamento implícito de
.env.

Aplicação requer `--apply --confirm=<hash>`. Confirmação errada ou vencida é
recusada antes de chamar o provider. Após adquirir o lock da integração, o plano
é conferido novamente. Selagem, ativação, decifragem/conferência do fingerprint,
troca ENV_REF→VAULT e ambas as auditorias usam a mesma transação. Qualquer falha
reverte tudo. Ids, PaymentAttempt/ExternalResourceTenant, status e identidade da
integração permanecem. Repetição obtém novo plano NOOP e decifra/confere os
ACTIVE, sem acrescentar versões ou auditorias; o hash anterior é vencido pelo
primeiro commit. Este comando não faz rotação de credencial existente diferente.

Auditoria da locadora: migration 202610030108 cria uma função com evento fixo,
locadora derivada da integração e retorno booleano, sem payload arbitrário.
EXECUTE é revogado de PUBLIC e concedido no script DBA de plataforma. Não foram
liberados SELECT/INSERT gerais em audit_logs nem alteradas políticas/baselines.
O dono da função permanece separado do runtime; a prova também usa dono sem
LOGIN/BYPASSRLS, com SELECT nas tabelas de integração/cofre, UPDATE(id) para o
lock, INSERT em auditoria e sem CREATE permanente. Contexto de locadora é
restaurado ao sair, e PlatformAuditLog registra o mesmo plano sem segredo.

Operação local do operador (placeholders, não executar em produção nesta onda):

```powershell
pnpm platform:secrets-import '--integration=INTEGRATION_ID' '--reference=env:LOCADORA_INTEGRATION_EXAMPLE' '--env-file=C:\operator\credentials.env'
# Revisar o relatório; repetir com o hash retornado:
pnpm platform:secrets-import '--integration=INTEGRATION_ID' '--reference=env:LOCADORA_INTEGRATION_EXAMPLE' '--env-file=C:\operator\credentials.env' --apply '--confirm=<HASH_DO_PLANO>'
```

Configuração do processo: PLATFORM_DATABASE_URL precisa do papel restrito;
PLATFORM_SECRET_FINGERPRINT_KEY é obrigatória. Só a aplicação precisa das KEKs/
configuração KMS/OIDC da onda 87. O arquivo explícito fornece apenas as
variáveis de integração; não configura o banco nem a KEK. Nomes mantidos:
LOCADORA_INTEGRATION_EXAMPLE_API_KEY, _SECRET, _ENVIRONMENT e _VERIFY_TOKEN.
ASAAS exige ambiente conhecido sandbox/production, sela ASAAS_API_KEY e guarda
só hash de _SECRET. ZAPSIGN/WHATSAPP/PIX usam os propósitos de provider;
WhatsApp exige também VERIFY_TOKEN. Divergência de ambiente/referência ou
provider não suportado deixa o ramo ENV_REF funcionando. MELHOR_ENVIO continua
recusado enquanto não houver origem persistida do userAgent.

Na onda 88 de 2026-10-03, a API da antiga raiz app/ e a agenda então configurada
continuavam ativas; a retirada dessa raiz ocorreu depois apenas no clone F.
Nenhuma migration/credencial real foi aplicada fora do banco descartável nessa
onda; nenhum commit, push, deploy, cutover ou remoção da raiz. O plano aprovado
localmente não certificava AWS, permissões reais ou provedor. S7 ainda exige a
adaptação de Melhor Envio, rotação de HMAC e regras de inbound durante
suspensão; contas de recebimento/assinaturas/telas e aceite em
aparelhos/operação também continuam pendentes. Geral ~60% continua estimativa de
esforço, sem denominador medido.

Validação consolidada local:

- PostgreSQL: quatro arquivos/85 testes passaram, incluindo vinte casos do
  importador com LOGIN real restrito, CLI Node/tsx, simulação sem KEK, rollback,
  concorrência e dono da auditoria sem BYPASSRLS. Somente dados fictícios e
  banco descartável. Os testes removem apenas seus bancos/papéis/arquivos
  próprios.
- CLI/gate unitários: dois arquivos/42 testes passaram; backend existente: treze
  arquivos/141 testes passaram. A saída neutra também recusa mensagens
  arbitrárias que imitem um código de erro.
- Build local de produção: `pnpm build` (legado) e `pnpm build:api` passaram.
  Isso comprova compilação; a matriz HTTP completa, aparelhos, AWS e provedores
  reais não foi repetida nesta onda de ferramenta interna.
- Typecheck dos doze projetos, type-check da raiz, lint, arquitetura, higiene,
  tokens, nomes e ratchet passaram. Markdownlint, índices/links de docs e git
  diff --check passaram. Nenhum baseline, exceção ou timeout foi ampliado.

Próximo corte: concluir a preservação de userAgent de Melhor Envio e rotação/
inbound de S7 antes da composição das contas de recebimento S9. Não migrar
valores reais nem trocar webhooks antes do aceite próprio desse procedimento.

## Onda 89 — provider no cofre e recibos bloqueados (2026-10-03, sem commit)

Melhor Envio entra no mesmo importador confirmado. API key, assinatura e
userAgent são selados; o contato configurado não fica em metadados globais,
relatórios ou logs. O campo vem de _USER_AGENT no arquivo explícito, com a mesma
validação do adapter de frete. Ambiente conhecido é obrigatório. Decifragem e
auditorias continuam atômicas; ids, referências externas e ENV_REF compatível
permanecem. Migrations 202610030109/0110 são incrementais: propósito de segredo
em commit isolado e allowlist da ponte de auditoria sem mudar proprietário/ACL.

O resolvedor VAULT devolve o userAgent por accessor redigido. Leitura HMAC tem
porta específica: ACTIVE mais um predecessor, por menos de 24 horas desde a
substituição. A versão histórica mais recente é examinada antes dos filtros de
validade: não se volta a uma chave mais antiga se o predecessor expirou, foi
retirado/destruído ou tem data futura. Falta/expiração do ACTIVE falha fechado.
API keys continuam somente ACTIVE. ENV devolve só a assinatura atual, sem
ampliar a origem ou inventar contato da locadora.

A autenticação aceita ACTIVE, PROVISIONING e INBOUND_ONLY independentemente do
bloqueio administrativo. Isso permite persistir o recibo na locadora da
integração. Antes de aplicar o efeito, a inbox relê Organization.status:
SUSPENDED/DISABLED responde 200 accepted/deferred e não baixa o pagamento. O
worker não transforma esse bloqueio em falha permanente. A outbox agendada
continua enumerando só ACTIVE. Após desbloqueio, o mesmo recibo é processado sem
duplicar inbox/outbox. Principal, origem, autorização manual, pagamento e locks
de locação não foram relaxados.

Organization.status SUSPENDED é bloqueio administrativo; Subscription.status
SUSPENDED/access RESTRICTED é inadimplência. A onda segue a diferença em B.5,
sem liberar efeitos de uma locadora administrativamente bloqueada. Classificação
Asaas para PlatformWebhookInbox, aceitação assíncrona uniforme dos eventos,
gates de ARCHIVED/limites, contas de recebimento e assinatura ainda dependem dos
lotes S5/S8/S9/S6. Esta onda não conclui o produto SaaS.

Validação consolidada local, PostgreSQL 18 e valores fictícios:

- Cofre/importador/scope/runtime: quatro arquivos/92 testes passaram. Login
  realmente restrito, uma conexão emprestada, userAgent exato cifrado/redigido,
  corrupção recusada, fronteira de 24h, cross-tenant, grace sem reativar
  história, importação/NOOP/rollback e auditoria com dono não-bypass. Duas
  correções de fixture: listas passadas como objeto ao it.each; timestamps sem
  timezone enviados como ISO UTC ao driver SQL, e cross-tenant do leitor direto
  exige recusa do guard, não null.
- Backend focado: oito arquivos/83 testes passaram. Autenticação HMAC,
  hashes/headers Asaas, status de integração, bloqueio retryable e logging.
- Concorrência da inbox, cron de outbox, CLI e arquitetura: quatro arquivos/57
  testes passaram. Nenhum scheduler, baseline, exceção ou timeout ampliado.
- HTTP real em builds de produção dos dois hosts, modo legacy: um arquivo/75
  testes passaram. Recibo PAID de tenant bloqueado fica pendente sem efeito;
  repetir após desbloqueio processa exatamente o recibo guardado. Integração
  PROVISIONING/INBOUND_ONLY concilia pagamento existente de tenant ACTIVE;
  integração DISABLED, segredo incorreto, cross-tenant e divergência de valor
  continuam recusados. A matriz completa Better Auth, frete/provedor real e
  aparelhos não foi repetida nesta onda.
- Builds legado/serviço e typecheck dos doze projetos, type-check da raiz, lint,
  arch, hygiene, tokens, nomes e ratchet passaram. A primeira execução de
  hygiene foi impedida pelo sandbox ao iniciar knip; com execução local
  autorizada passou, sem alteração na guarda. Docs, índices e diff verificados.

Na onda 89 de 2026-10-03, a API da antiga raiz app/ e a agenda então configurada
continuavam funcionando; essa raiz foi retirada depois somente no clone F. Não
houve commit, push, deploy, migração ou troca de segredo em produção,
redirecionamento definitivo ou remoção da raiz nessa onda.
Processos/bancos/arquivos de fixture próprios foram encerrados ou removidos pelo
teardown. KMS/OIDC/BaaS/Asaas/Melhor Envio reais e aceite operacional permanecem
não certificados. Geral ~60% é estimativa de esforço, sem denominador medido;
não equivale à porcentagem de rotas copiadas.

Próximo corte: entrada durável/classificada de Asaas e consumidores comerciais
de plataforma (S5/S6/S9), mantendo a inbox de clientes e o legado; fiscalizar
access/limites em S8 antes de ativar self-service ou aposentar a raiz.

## Onda 90 — entrada Asaas durável e classificada (2026-10-03, sem commit)

Novos POST /api/webhooks/asaas/platform e /api/webhooks/asaas/[integrationId]
existem no legado e no serviço. Os adapters só autenticam e delegam. A raiz usa
exclusivamente asaas-access-token com hashes atual/anterior, comparação
constante e ambiente explícito. O endpoint novo de integração usa o mesmo
resolvedor de tenant/credencial/status, mas recusa HMAC e headers alternativos.
ENV_REF ainda usa o token configurado; VAULT mantém hash/grace existentes.
Nenhuma URL já configurada foi modificada.

Classificação e persistência ficam no backend:

- PAYMENT_* conhecido vai para WebhookInbox e webhook.process da locadora. O 200
  é assíncrono, posterior ao commit, sem baixar o pagamento na requisição.
  Eventos desconhecidos/inválidos ficam terminados como IGNORED_EVENT, sem fila.
  Worker usa o payload armazenado; 404 é ignorado e 409 encerra com
  RECONCILIATION_REQUIRED mais auditLog. 5xx e bloqueio administrativo continuam
  retryable; cron continua enumerando ACTIVE. As URLs antigas não mudaram.
- ACCOUNT_STATUS__/ACCESS_TOKEN__ vão para PlatformWebhookInbox, source
  ASAAS_ACCOUNT e routeKey da integração. Identidade inclui namespace derivado
  da integração, evitando colisão entre contas. O papel de plataforma revalida a
  integração; não lê pagamentos/clientes da locadora.
- Raiz usa source ASAAS_ROOT e resolve providerSubscriptionId, referência
  sub:/inv: ou conta, nessa ordem. Ambiente e modo de cobrança são conferidos.
  Sem destino: UNROUTED e auditoria; desconhecido/inválido: IGNORED. Evento
  roteado cria platform.webhook.process na mesma transação.
- Corpo persistido contém somente campos necessários dos recursos, sem API key,
  nomes/dados de cliente/cartão ou extras arbitrários. Hash continua dos bytes
  recebidos. Mesmo id com hash diferente mantém payload/hash originais, registra
  conflito/alerta e responde 200. Tenant usa lastError e processedAt; plataforma
  usa status CONFLICT. Falha de persistência responde 503; JSON malformado,
  tamanho e autenticação continuam recusados antes da persistência.

O módulo de plataforma recebe a porta PlatformTransaction; a conexão pertence à
composição já existente em runtime/platform-jobs. Gates PLATFORM-PRISMA e
ownership do cofre permanecem. Parser/classificador têm agora consumidores
reais: somente quatro entradas obsoletas de test-only-export foram removidas da
baseline de higiene. Nenhuma tolerância foi ampliada. O inventário reconhece o
novo guard pelo export/implementação exatos, limitado à rota da raiz, com
negativas de namespace e de discriminante; endpoints não viraram públicos.

Validação consolidada local usa PostgreSQL 18, papéis LOGIN sem bypass e dados
fictícios. Resultados finais e pendências ficam registrados abaixo; nenhuma
operação em produção.

- Backend focado: cinco arquivos, 55 testes únicos passaram, cobrindo token de
  raiz/integração, HMAC legado, classificação, redução de payload e worker.
- Banco real: 15 testes passaram com papéis PostgreSQL
  app_runtime/platform_runtime separados. Corridas, referências sub:/inv:/conta,
  identidade por integração, conflito, rollback, isolamento, worker terminal,
  conflito durante consumo sem apagar o alerta ou reter a lease e os dois
  adapters de raiz com persistência real. O caso novo foi executado isoladamente
  após os 14 anteriores.
- HTTP real em builds de produção, modo legacy: 87 testes passaram. Incluem
  todos os 75 casos anteriores e novas provas de fila sem baixa imediata,
  duplicidade, token estrito, ignorados, bloqueio e falha fechada de plataforma
  não configurada. HTTP positivo de raiz com pool de plataforma e a matriz
  Better Auth completa não foram ensaiados nesta onda; os adapters de raiz
  positivos foram chamados diretamente na prova com PostgreSQL.
- Inventário de autorização: 78 testes passaram; concorrência da inbox: nove;
  cron real de outbox: seis. Asserção de rollback foi reforçada para conferir o
  aggregateId realmente criado antes da falha, evitando uma aprovação vazia.
- Builds legado/serviço, typecheck dos doze projetos, type-check da raiz, lint,
  arch, tokens, nomes, hygiene e ratchet passaram. Ratchet precisou de execução
  local com subprocesso Git permitido; nenhum comando Git escreveu.
  Markdownlint, índices/links de docs e diff --check passaram. Quatro registros
  obsoletos de higiene saíram por uso real, sem relaxar guarda/teste.

Esta onda entrega parte de S5. O dispatcher preserva platform.webhook.process
como PENDING até instalar os consumidores S6/S9; ainda não emite mensalidade,
altera acesso comercial ou atualiza saúde de conta. Alertas são auditorias
duráveis; envio externo e operação do backoffice ainda dependem dos seus lotes.
A antiga rota de boleto ainda não delega ao handler novo: compatibilidade é
mantida até caracterizar/aprovar essa mudança. Recibos originalmente aceitos
pela URL antiga conservam sua política legada de replay; a duplicata pela URL
nova não reescreve a outbox antiga. Um worker em andamento pode ter aplicado o
evento original antes de receber um conflito posterior; o alerta permanece e
exige conciliação. Não há atomicidade entre efeito remoto e recepção de uma
segunda mensagem contraditória.

Na onda 90 de 2026-10-03, a API da antiga raiz app/ e o scheduler continuavam
ativos, sem cutover, commit, push, deploy, produção, segredos reais ou remoção;
essa raiz foi retirada depois somente no clone F. ~60% geral era estimativa de
esforço, sem denominador medido. Próximo corte recomendado naquela onda:
consumidor comercial S6 e saúde de conta S9, recuperação de UNROUTED, depois
unificar a URL antiga somente com provas; fiscalização comercial S8 continua
obrigatória antes de self-service.

Fonte oficial conferida para entrega repetida, token e confirmação após
persistência:
[recebimento de webhooks Asaas](https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook).

## Onda 91 — saúde de contas de recebimento (2026-10-03, sem commit)

O consumidor `payment-accounts.webhook` aplica os eventos ACCOUNT_STATUS_* e
ACCESS_TOKEN_* já persistidos à conta de recebimentos. O backend divide os
donos: payment-accounts contém projeção/consumo; billing contém o leitor HTTP;
secrets retorna somente identidade/expiração da chave ativa; runtime resolve
credencial e compõe as portas. Ambos os hosts usam o mesmo cron de plataforma.
Nenhuma regra nova vive em apps/services/api; não há migration ou agenda nova.

Notificação dispara leitura dos fatos atuais com a credencial da locadora, sem
chave raiz. Para subconta, GET commercialInfo verifica expiração anual antes de
GET status. Expirada a confirmação, não consulta status: outras APIs podem estar
bloqueadas. Conta conectada consulta status sem inventar flag anual. Retorno
guarda só estados/datas; dados comerciais pessoais não são persistidos. Evento
atrasado de desativação não invalida uma chave atual que funciona.

ACCESS_TOKEN exige correlação com providerCredentialId da versão ACTIVE.
Identidade ausente ou de outra chave termina com auditoria e nenhum fetch. Chave
ativa já expirada restringe a conta sem decifrar/chamar o provedor; 401
classificado pelo adapter resulta em KEY_DISABLED. Falha transitória libera
lease e retenta com erro redigido. Leitura válida pode recuperar problemas
anuais/de chave; outros problemas operacionais continuam. BLOCKED permanece
BLOCKED, inclusive em erro/expiração de chave.

Consulta externa ocorre fora da transação SQL. Antes do efeito, locks de conta,
integração e metadados do cofre revalidam binding/timestamps/versão. O recibo é
concluído por CAS de token/status, com projeção e auditoria na mesma transação.
Conflito recebido durante a consulta suprime o efeito e conserva CONFLICT sem
lease. Rotação, desconexão ou bloqueio durante a consulta descartam o resultado
antigo. Conflito depois do commit conserva alerta; não desfaz efeito anterior
nem oferece atomicidade distribuída com o provedor.

Novos eventos de conta já recebem o tópico próprio. Recuperação do backlog S5
altera só o tópico dos jobs PENDING ainda em platform.webhook.process, em lotes
de 20, preservando id, dedupe, tentativas e payload. FAILED já convertido não
ocupa a próxima página; concorrentes usam FOR UPDATE/SKIP LOCKED. Mensalidades e
eventos de assinatura continuam no tópico anterior PENDING para S6: esta onda
não cria faturas nem altera Subscription/Organization.access.

Validação local consolidada, PostgreSQL 18 e papéis LOGIN sem bypass:

- Leitor HTTP: sete testes passaram, com fetch simulado, credencial explícita,
  expiração independente, resposta inválida, conta conectada e kill switch.
- Consumidor: 21 testes de banco passaram. Cobrem root/account, idempotência,
  fatos atuais, expiração, falha/retry/401, bloqueio preservado, key-id
  incorreto, rotação, conflito durante consulta, tenant errado, auditoria, duas
  páginas de backlog, RLS/ACL e composição real dos dois adapters cron. O fetch
  do Asaas é simulado; os adapters são invocados diretamente, sem novo ensaio
  HTTP de servidor de produção nesta onda.
- Regressões de banco: 15 testes de ingress, 12 de runtime e 11 de cofre
  passaram. Os últimos 21 do consumidor e 11 do cofre passaram juntos após os
  ajustes finais; números são casos por arquivo, sem somar reexecuções.
- Typecheck dos doze projetos, type-check da raiz, lint, arch, tokens, nomes,
  hygiene, ratchet e builds de API/legado passaram. Build inicial do legado
  registrou P2022 no sitemap por datasource local antigo; repetição com
  DATABASE_URL explicitamente descartável passou sem essa falha. Nenhuma base
  externa foi migrada. Só duas tolerâncias de higiene ficaram obsoletas por uso
  real e foram reduzidas; nenhuma guarda, baseline ou teste foi afrouxado.

S9 permanece parcial. Faltam provisionamento, verificação/recriação periódica de
webhook, rotação operada de chave, fiscalização pré-emissão, tela/notificação do
dono e runbooks. ENV_REF sem providerCredentialId exige correlação assistida
antes de aplicar evento de chave. Recuperação de UNROUTED e alertas externos
continuam pendentes. Asaas/BaaS/KMS reais e aparelhos não foram certificados.
Próximo corte: consumidor comercial S6, com confirmação no provedor e projeção
derivada de faturas, antes de self-service e fiscalização S8.

URLs, API legada e scheduler permanecem ativos; nenhum commit, push, deploy,
produção ou retirada de app/. (caminho antigo) Processos e bancos de fixture
próprios têm teardown. Geral ~60% continua estimativa de esforço, sem
denominador medido.

Fontes oficiais conferidas:
[situação cadastral](https://docs.asaas.com/reference/consultar-situacao-cadastral-da-conta),
[confirmação anual de subcontas](https://docs.asaas.com/docs/confirma%C3%A7%C3%A3o-anual-de-dados-comerciais-para-subcontas),
[eventos de chaves](https://docs.asaas.com/docs/eventos-para-chaves-de-api).

## Onda 92 — primeiro consumidor comercial de faturas (2026-10-03, sem commit)

PAYMENT da raiz recebe o tópico subscriptions.invoice.webhook. O consumidor em
modules/subscriptions confirma fatos atuais pelo adapter billing com a chave
raiz explícita e ambiente válido; não lê payments de clientes nem usa chave de
locadora. A composição ocorre em runtime/platform-jobs, no cron já existente dos
dois hosts. Sem configuração explícita, o job permanece PENDING. Eventos
SUBSCRIPTION continuam no tópico anterior, sem consumidor.

Claim/lease precede a consulta externa; organização e assinatura são bloqueadas
na aplicação. Revisão do binding, identidade/valor do provedor e CAS do recibo
protegem resultado antigo e conflito. Fatura, histórico, estado, acesso,
siteIndexable e outbox têm commit conjunto. Falha externa/SQL libera o claim com
erro redigido e permite retry; divergência de valor/referência exige
conciliação, sem conceder acesso. Não há transação distribuída com o provedor.

O domínio mantém periodoMensal e derivarEstado; cálculos usam dias civis e
Decimal. PAID não volta a pendente/vencido/cancelado, refund fica final e
chargeback só volta a pago por confirmação atual. Status desconhecido guarda o
código/auditoria e preserva estado conhecido, inclusive dívida por chargeback.
Pagamento de assinatura cancelada não altera o acesso de uma substituta.
Bloqueio administrativo da Organization permanece. O contrato de billingType
aceita RECEIVED_IN_CASH; nenhuma migration SQL ou preço comercial foi criado.

Jobs PAYMENT antigos são convertidos em lotes de 20, conservando id/dedupe e sem
capturar SUBSCRIPTION. CANCEL_DUE grava cancelamento local e enfileira
subscriptions.provider-deactivate; transições enfileiram subscriptions.notify.
**Ambos continuam PENDING sem consumidor:** este corte não envia notificações
nem desativa a assinatura no Asaas. O acesso é projetado, mas a fiscalização de
limites/comandos S8 ainda deve ser instalada antes de self-service.

Validação local consolidada, PostgreSQL 18 descartável e LOGINs sem bypass:

- Domínio: 185 testes passaram, incluindo cinco casos do ciclo mensal civil.
- Leitor HTTP: 22 testes passaram, com transporte simulado e credencial
  explícita; contratos de assinatura: 37 passaram, sem expor IDs do provedor ou
  dados privados. RECEIVED_IN_CASH tem prova própria.
- Consumidor: 20 testes de banco passaram. Cobrem confirmação, valor/binding,
  desconhecido, dívida/reversão, monotonicidade, cancelamento e substituição,
  bloqueio administrativo preservado, conflito/revisão durante leitura,
  falha/retry e rollback de todos os efeitos, RLS/ACL e backlog. Composição real
  do runtime e ambos os cron adapters também passou, com fetch simulado.
- Regressões: 15 ingress, 21 saúde de conta e 12 runtime de plataforma passaram.
  Contagens são casos por arquivo, sem somar reexecuções de fixtures.
- Typecheck dos doze projetos, type-check da raiz, lint, arch, tokens, nomes,
  hygiene, ratchet e builds de API/legado passaram. Nove tolerâncias obsoletas
  de higiene foram reduzidas por uso real; nenhuma guarda ou baseline ampliada.

S6 permanece parcial: criação e recuperação UNKNOWN, eventos SUBSCRIPTION,
reconciliação diária, cancelamento no provedor e notificações faltam, assim como
S8/onboarding e aceite externo. Preços/planos continuam decisão do dono; testes
usam valores sintéticos. Asaas/BaaS/KMS reais e aparelhos não foram
certificados. URLs, API legada e scheduler permanecem ativos. Nenhum commit,
push, produção ou retirada de app/. (caminho antigo) Geral ~60% é estimativa de
esforço, sem denominador medido. Próximo corte: reconciliação periódica e
execução segura de subscriptions.provider-deactivate, sem DELETE de assinatura e
preservando cobranças/histórico existentes.

Fontes oficiais:
[consulta da cobrança](https://docs.asaas.com/reference/recuperar-uma-unica-cobranca)
e [eventos de cobrança](https://docs.asaas.com/docs/webhook-para-cobrancas).

## Onda 93 — reconciliação e cancelamento comercial (2026-10-03, sem commit)

O cron existente dos dois hosts compõe subscriptions.reconcile e, com raiz
configurada, subscriptions.provider-deactivate. Não há novo scheduler, URL ou
fallback para chave de locadora. Em lotes de 20, ordenados por reconciledAt, a
fila aplica dedupe por janela de cinco minutos e ignora jobs já pendentes.
Trials/cortesias locais avançam pelo relógio mesmo sem credencial externa.

O adapter billing lê assinatura e /payments paginado por subscription; fatura
local ausente na lista é reconsultada pelo seu ID. UNKNOWN busca a referência
sub:<id> e só vincula um resultado inequívoco, sem repetir criação. Identidade,
cliente, valor Decimal e ciclo mensal são conferidos. Divergência gera auditoria
e conserva acesso. Fatos do webhook e do job usam invoice.ts e a mesma projeção
de domínio; locks e revisão do binding impedem aplicação de resultado antigo.
Retry-After adia tanto o aggregate quanto a entrega da outbox.

Cancelamento externo usa PUT status INACTIVE e confirmação por GET, nunca DELETE
de assinatura. NON_PAYMENT conserva todas as cobranças. OWNER_REQUEST cancela
somente faturas não pagas a partir do fim do período, com reconsulta antes do
DELETE de cada cobrança. Histórico vencido/pago permanece; pagamento durante o
processo é preservado e auditado. Esta sequência não torna GET e DELETE atômicos
no provedor.

A migration aditiva 202610030111 registra providerCancelState interno:
NONE/PROCESSING/UNKNOWN/CONFIRMED, com CHECK. A intenção precede a escrita
externa; timeout ou crash não permitem um segundo DELETE cego. Confirmação atual
permite concluir; ausência/404 não provam cancelamento. Rejeição comprovadamente
sem efeito libera tentativa posterior. Estado incerto exige reconciliação, sem
alterar faturas manualmente para esconder a dúvida.

Validação consolidada local: 53 testes de banco (21 jobs, 20 faturas e 12
runtime) e 40 testes HTTP/retry (16 assinatura, 22 fatura e dois dispatcher)
passaram. PostgreSQL 18 descartável, papéis LOGIN sem bypass e transporte
simulado. Cobrem backlog limitado, recuperação, concorrência, atomicidade,
cancelamento incerto, pagamento concorrente, Retry-After, CHECK e composição
pelos dois cron adapters. Typecheck dos doze projetos, type-check da raiz, lint,
arch, tokens, nomes, hygiene, ratchet e builds API/legado passaram. Uma
tolerância obsoleta de higiene foi removida; nenhuma guarda foi ampliada.

S6 continua parcial: emissão, eventos SUBSCRIPTION, notificações/régua e saúde
diária do webhook faltam; UNKNOWN sem correspondência permanece pendente de
conciliação. S8, onboarding, backoffice, provedores reais, aparelhos e aceite
operacional também faltam. Sem produção, commit, push ou retirada de app/.
(caminho antigo) Estimativa geral continua ~60% de esforço; contagens de testes
não medem produto.

Próximo corte: processamento de eventos SUBSCRIPTION e régua/notificações,
seguido por criação comercial quando planos/preços estiverem explicitamente
definidos. Nenhum preço comercial ou decisão de produto foi inventado.

Fontes oficiais:
[atualizar assinatura](https://docs.asaas.com/reference/atualizar-assinatura-existente),
[listar cobranças](https://docs.asaas.com/reference/listar-cobrancas) e
[excluir uma cobrança](https://docs.asaas.com/reference/excluir-cobranca).

## Onda 94 — eventos comerciais e recuperação de rota (2026-10-03, sem commit)

SUBSCRIPTION da raiz usa subscriptions.event.webhook no cron existente dos dois
hosts. O consumidor valida origem, ambiente, locadora e referências e grava o
handoff para subscriptions.reconcile ou provider-deactivate na mesma transação
que encerra o recibo. PROCESSED significa que esse handoff foi persistido; a
confirmação financeira pertence ao job seguinte, cujo status/erro fica na
outbox. Status/valor do payload não concedem acesso nem confirmam cancelamento.
Jobs antigos são relabelados em lotes de 20 sem trocar identidade ou dedupe.

Os jobs revalidam o recibo antes da consulta externa e sob lock antes de gravar
fatura, histórico ou projeção. Conflito posterior ao handoff impede esses
efeitos. Quando a criação UNKNOWN é encontrada por referência, o ID encontrado
também deve corresponder ao evento. Cancelamento local que ocorreu durante uma
criação incerta pode recuperar o vínculo e confirmar PUT INACTIVE, sem novo POST
nem reativar acesso. A intenção local de cancelamento continua necessária; o
evento sozinho não cancela a assinatura. Não há atomicidade entre banco e
escrita no provedor.

Migration aditiva 202610030112 guarda sourceEnvironment sandbox/production nos
novos recibos autenticados da raiz. CHECK e trigger tornam o ambiente imutável;
subcontas e linhas antigas conservam null. Colisão de identidade entre ambientes
gera CONFLICT. O runtime recupera até 20 recibos comerciais UNROUTED que tenham
ambiente comprovado e agora possuam destino válido, usando o mesmo resolvedor do
ingresso. Payload, hash, identidade e chave de dedupe permanecem. SKIP LOCKED
protege concorrência; o filtro de vínculo evita que recibos antigos sem destino
bloqueiem os seguintes. Recibos antigos UNROUTED sem ambiente não são
preenchidos por suposição: exigem prova operacional/replay controlado ainda não
instalado.

Validação consolidada: 94 casos de banco passaram (47 jobs/eventos/recuperação,
20 faturas, 15 ingresso e 12 runtime), em PostgreSQL descartável com papéis
restritos e transporte simulado. Incluem os sete eventos conhecidos, duplicação
concorrente, conflito antes/durante consulta, rollback, leases, isolamento de
ambiente/locadora, UNKNOWN cancelado, backlog e os dois cron adapters. Contagem
sem somar reexecuções. Typecheck dos doze projetos, type-check da raiz, lint,
arch, tokens, nomes, hygiene e ratchet passaram; baselines/guardas preservados.
Builds API/legado também passaram localmente. Validação documental conferida
separadamente; a compilação não certifica provedores reais.

S6 permanece parcial: emissão, notificações/régua e saúde diária do webhook
faltam; S8, onboarding, backoffice e aceite de provedores/aparelhos também. Sem
nova agenda, mudança de URL, produção, commit, push ou retirada de app/.
(caminho antigo) Geral ~60% continua estimativa de esforço, sem denominador
medido. Próximo corte: consumidor de notificações/régua, preservando a
configuração de comunicação e sem inventar planos/preços comerciais.

## Onda 95 — avisos comerciais na outbox existente (2026-10-03, sem commit)

O domínio seleciona avisos de teste D-7/-3/-1/D0 e fatura
D-5/D0/D+1/+3/+6/+14/+21/+30, com dia civil e dinheiro decimal. Datas de
pausa/encerramento vêm da política existente, sem outra máquina de estados.
Canceled/cortesia não entram; ciclo PAID que cobre o fim do teste dispensa seu
aviso; fatura quitada deixa de ser elegível. subscriptionFacts é o mapeamento
comum de persistência para projeção e avisos. Os prazos históricos divergentes
na ADR não foram decididos por esta onda.

subscriptions.notify coordena transições atuais e passos de lembrete;
subscriptions.dunning varre até 20 assinaturas por lote, com ordem de locks
organização → assinatura, SKIP LOCKED, revalidação e chaves duráveis.
subscriptions.mail entrega um job privado por e-mail normalizado. Contatos são
billingEmail da assinatura/organização e memberships ACTIVE de FINANCIAL ou do
dono ADMIN, pela view platform_user_contacts. Papel global e outra locadora não
entram. Nenhuma permissão para tabelas de negócio foi acrescentada.

A primeira tentativa persiste envelope e intenção antes da chamada externa.
Retry conserva chave/conteúdo, inclusive após mudança do remetente. Contato
removido, transição superada, fatura paga, mudança de conteúdo ou lease antigo
impedem envio indevido. Teto conservador de 23h encerra retry cego de tentativa
ambígua e audita conciliação obrigatória; o Resend documenta retenção por 24h.
Runtime reutiliza RESEND_API_KEY/FROM_EMAIL e o SDK limitado a 15s. Aceite da
requisição não prova entrega na caixa postal.
[Fonte oficial](https://resend.com/docs/dashboard/emails/idempotency-keys).

O cron/platform existente dos dois hosts compõe o consumidor somente com chave,
remetente, ambiente explícito e host válido. Ausência mantém avisos PENDING. Não
há fallback para chave de locadora, scheduler novo, rota pública, tabela ou
migration. Fatura exige URL https sob Asaas; CTA geral usa /admin atual, sem
inventar tela de assinatura ou anunciar enforcement S8 como já instalado.

Arquivos: domain/assinatura/{avisos,index}.ts;
backend/modules/subscriptions/{facts,projection,notices,index}.ts;
backend/modules/communications/{subscription-email,index}.ts;
backend/runtime/{mail,platform-jobs}.ts. Testes novos colocados: avisos.test.ts,
subscription-email.test.ts e mail.platform.test.ts; suíte ampliada:
subscription-jobs-database.test.ts. Comentários de configuração nos dois
.env.example atualizados, sem credenciais reais.

Validação consolidada: 316 casos distintos passaram, sendo 52 novos. São 222
casos de domínio/render/transporte (30 de avisos, quatro de template, três de
transporte e 185 regressões do domínio) e 94 de banco (62 jobs, 20 faturas, 12
runtime). Papéis restritos, PostgreSQL descartável e transporte simulado;
incluem concorrência/fan-out, revogação, pagamento antes de aviso, rollback,
timeout, fencing, backlog maior que 20, dedupe e runtime configurado. Falhas
iniciais de fixtures/cenários foram corrigidas preservando contratos; apenas os
arquivos afetados foram reexecutados, sem somar suas contagens novamente.

Typecheck dos doze projetos, type-check da raiz e lint passaram; domínio/backend
e arquivos alterados foram rechecados após os ajustes. Arch, tokens, nomes,
hygiene e ratchet passaram; builds API/legado também. Export novo de tipo sem
consumidor retirado; uma entrada obsoleta de FatosDaAssinatura saiu da higiene
porque facts.ts passou a consumir o contrato. Nenhum limite, exclusão, baseline
de arquitetura/token ou tolerância cresceu.

S6 continua parcial: criação comercial, saúde diária e tela de assinatura
faltam. Conciliação assistida de e-mail ambíguo, certificado de entrega real,
Asaas/BaaS/KMS, aparelhos e operação permanecem pendentes, assim como S8,
planos/preços, onboarding, backoffice e retirada do legado. Legado/scheduler
ativos; sem commit, push, deploy ou produção. Geral ~60% é estimativa de
esforço, sem denominador medido. Próximo corte: política/fiscalização S8
compartilhadas, preservando recebimento de fatos financeiros.

## Onda 96 — primeiro corte de admissão e cotas S8 (2026-10-04, sem commit)

O módulo `entitlements/equipment-admission.ts` é chamado por
`catalog.createEquipment`, na mesma conexão e antes do INSERT. Ambos os hosts
usam essa regra única. FULL/SETUP respeitam a cota de modelos;
RESTRICTED/ARCHIVED recusam novas criações. Plano atual não cancelado, contrato
estrito e exceções válidas são lidos sob contexto da locadora. Unidades não
entram na contagem. Lock de organização e lock consultivo da cota conservam a
decisão até commit.

`off`/ausente conserva o fluxo sem novas consultas. `shadow` calcula e registra
somente tenantId/código; savepoint recupera erro SQL da observação, e uma falha
do logger não transforma diagnóstico em fiscalização. `on` aplica os envelopes
publicados. Modo inválido ou plano sem vínculo/contrato válido recusa com 503
genérico. Os adaptadores preservam resource/limit/used e as respostas anteriores
de validação e sucesso; não há nova rota ou regra copiada nos hosts.

**Validação consolidada:** 296 casos distintos aprovados, 51 novos: 21 de
admissão, 14 HTTP nos dois hosts e 16 PostgreSQL com papéis separados. As 245
regressões existentes do catálogo/operações/tenancy passaram. Provas incluem 10
cadastros concorrentes com uma vaga (um sucesso), downgrade sem perda,
RLS/contagem independente, exceção estrangeira, catálogo em SETUP, bloqueio de
criação RESTRICTED/ARCHIVED, savepoint após erro de permissão SQL em shadow e
suspensão aguardando o lock até INSERT. Preparação de fixtures foi corrigida
para usar o papel de plataforma real e corpo de edição completo; comportamento
existente e assertivas não foram afrouxados. Reexecuções afetadas não foram
somadas novamente.

Typecheck dos 12 projetos, type-check raiz, lint,
arch/tokens/nomes/hygiene/ratchet e builds API/legado passaram. Sete nomes
obsoletos saíram da higiene: três funções de direitos ganharam consumidores
reais (export e achado só-teste), assim como AccessError. Nenhuma tolerância,
exclusão ou baseline cresceu.

**Limites:** S8 permanece parcial. A política geral de principal/ownership,
módulos, cota da equipe, exceções das obrigações financeiras, jobs promocionais
e site S13 ainda precisam de implementação e matriz de paridade. Leituras e
edições atuais não receberam o bloqueio geral; isso conserva registros após
downgrade, mas não certifica o acesso ARCHIVED completo. Escritores futuros de
plano/exceções devem conservar organização → mudança antes de liberar a cota.
Fiscalização continua off, sem alteração de env real, scheduler, migrations,
deploy, produção, commit, push ou retirada do legado. PostgreSQL próprio e
fixtures da validação foram encerrados/removidos. Progresso geral ~60% continua
estimativa de esforço, sem denominador medido. Próximo corte: política central
de acesso para ambos os hosts, com requisição real nos helpers legados e
exceções estritas para obrigações já em curso.

## Onda 97 — admissão HTTP da assinatura (2026-10-04, sem commit)

**Implementado:** política privada em backend/entitlements/request-access,
consumida pela factory única de principal HTTP depois de CSRF, sessão e vínculo.
Off devolve o principal original sem consultas comerciais. Shadow consulta em
transação própria, registra tenant/código e não bloqueia nem sob erro SQL ou do
logger. On deriva access/isOwner/actor da organização atual; ADMIN global ou do
vínculo não é usado como prova de dono. Os serviços conservam seus gates de
papel, permissão e ownership.

FULL admite módulos conforme a versão atual e exceções válidas por tenant.
Leituras históricas continuam abertas quando um módulo sai do plano. SETUP
admite configuração/catalogação existentes e perfil próprio; novas cobranças de
clientes são recusadas. RESTRICTED admite leitura e as operações existentes
abaixo. ARCHIVED responde 403 TENANT_ARCHIVED; a exportação existente é admitida
somente ao dono atual, inclusive depois de troca de titular.

| Operação existente               | Método e limite da exceção                                         |
| -------------------------------- | ------------------------------------------------------------------ |
| Devolução                        | POST checkin, schema estrito de devolução                          |
| Encerramento de locação          | PATCH COMPLETED, somente status/notes                              |
| Conclusão de entrega             | PATCH COMPLETED, somente campos do comprovante/conclusão           |
| Baixa financeira                 | PATCH billingStatus PAID/SETTLED, schema estrito                   |
| Reemissão de boleto              | PUT regenerate, obrigação existente validada pelo serviço          |
| Conciliação de boleto            | POST verify, fatos e ownership continuam no backend                |
| Perfil próprio                   | GET/PUT existentes, ownership continua no serviço                  |
| Cobrança de locação em andamento | POST PIX/BOLETO, checkOutAt anterior a suspendedAt e sem checkInAt |

Exceções não são sinalizadas por header/query do cliente. Campos de preço,
prazo, novo veículo, status que não encerra ou método diferente não se tornam
uma exceção por compartilharem o caminho. GET OAuth de Zoho que grava
credenciais é classificado como escrita. Cobranças de orçamento não recebem a
exceção de obrigação em curso. A admissão financeira não substitui a permissão
FINANCIAL/WRITE ou a posse verificadas pelo serviço de billing.

Os 20 arquivos legados que usam helpers de papel e seus 20 pares no serviço
encaminham a requisição real (21 chamadas por host). Isso conserva método, URL e
corpo; handlers posteriores conseguem ler o corpo original. Helpers sem
requisição conservam o fallback com método/URL null: ele não inventa GET e, em
on, não classifica operação desconhecida. Recusas comerciais conservam o
envelope estrito, Cache-Control private/no-store e Vary Cookie/Host. OAuth
conserva seu redirect caracterizado. Regras permanecem no backend; nenhuma rota
ou scheduler foi criado, nem foi ligado enforcement em ambiente real.

**Validação consolidada:** 337 casos distintos aprovados, 110 novos:

| Conjunto                        | Casos | Novos |
| ------------------------------- | ----- | ----- |
| Política de admissão            | 76    | 76    |
| Adapters HTTP reais, dois hosts | 18    | 18    |
| Principal por requisição        | 91    | 12    |
| Regressões de admissão de cota  | 35    | 0     |
| Autorização/CSRF/inventário     | 98    | 1     |
| PostgreSQL/RLS/cotas            | 19    | 3     |

Banco descartável usa papéis separados sem bypass. Provas novas incluem exceção
de outra locadora sem efeito, módulo válido da própria locadora, troca de dono e
recuperação de REVOKE SELECT em shadow sem envenenar transações posteriores.
Mutações do inventário continuam rejeitando remoção/deslocamento do guard e
agora também perda de request, método sintético e headers falsos. Tipos de 12
projetos e da raiz, lint, arquitetura, tokens e nomes passaram. Higiene encolheu
em três nomes obsoletos com consumidor real; nenhuma tolerância foi
acrescentada. Ratchet permaneceu aprovado. Builds da API e do legado passaram.
Banco/roles/conexões temporários ficaram em zero e o PostgreSQL próprio foi
encerrado; nenhum servidor ou navegador foi deixado rodando.

**Limites:** este é um gate de admissão HTTP, não o S8 completo. Fora do
cadastro de equipamentos da onda 96, a decisão ainda não fica travada até a
mutação: acesso/plano podem mudar entre admissão e escrita. É necessário
revalidar módulos e a exceção de cobrança na transação do comando. Cota de
equipe, promotion jobs, site S13, onboarding/backoffice, faturas/reativação do
dono e aceite de provedores/aparelhos também permanecem pendentes. Jobs aceitos,
webhooks e conciliação não foram submetidos a esse gate de request. Não ativar
on ou aposentar o legado com base nesses testes.

Legado/scheduler e configurações reais preservados; sem migration, produção,
commit, push, deploy ou retirada de app/. (caminho antigo) Progresso geral ~60%
continua estimativa de esforço, sem denominador medido. Próximo corte:
revalidação transacional de módulos e obrigações financeiras, sem bloquear
efeitos já aceitos.

## Onda 98 — admissão transacional (2026-10-04, sem commit)

`backend/entitlements/command-admission.ts` confere acesso/módulo na conexão que
realiza a escrita. Organização fica travada até commit; escritores de projeção,
plano e futuras exceções devem usar o mesmo lock. Principal FULL anterior à
transação não substitui a consulta atual.

Corte: criar motorista/veículo/entrega, atualizar entrega, quatro comandos de
manutenção e PIX/boleto em `billing.requestPayment`. Cada preparação revalida,
inclusive depois da leitura externa de histórico cancelado. Runner genérico,
conciliação e efeitos já aceitos da outbox não receberam esse gate. Leitura
histórica permanece disponível.

Direitos, elegibilidade da obrigação anterior à suspensão e conclusão estrita de
entrega são comuns à admissão HTTP e aos comandos. RESTRICTED permite essa
conclusão e cobrança de locação não devolvida com checkout anterior à suspensão.
Titular/FINANCIAL WRITE continuam conferidos no serviço financeiro. SETUP e
ARCHIVED não ganham exceções. Off não consulta plano; shadow recupera SQL por
savepoint. 20 adapters conservam recusas/cache comerciais e erros antigos.

Validação consolidada: **422 casos distintos, 93 novos**. Unitários/HTTP: 267;
segurança: 94; RLS/banco: 30; cobrança/conciliação/jobs: 31. Novos arquivos:
`tests/unit/subscription-command-access.test.ts`,
`tests/unit/subscription-command-http.test.ts` e
`tests/identity/subscription-command-database.test.ts`. Banco com papéis
restritos prova isolamento de exceções, zero pagamento/tentativa/outbox após
recusa e recuperação SQL shadow. Escrita pausada antes do INSERT conserva lock;
mudança comercial espera, e a próxima escrita é recusada sem ocultar registros.

S8 parcial: `ensureQuoteBoletoPayment` também atende jobs aceitos; seu fluxo
manual precisa de fronteira explícita no próximo corte. Retorno/fechamento de
locação, baixas financeiras, perfil, comunicações, equipe, divulgação,
onboarding/backoffice e aparelhos/provedores ainda não têm toda a matriz
transacional certificada. Não ativar fiscalização ou retirar legado com base
neste corte. Configuração real, scheduler e API legada preservados. Sem
migration, commit, push ou deploy. Geral ~60% é estimativa de esforço, sem
denominador medido.

Gates aprovados: `pnpm typecheck` (12 projetos), `pnpm type-check`, `pnpm lint`,
`pnpm arch`, `pnpm tokens`, `pnpm hygiene`, `pnpm check:test-names` e
`pnpm ratchet:guard --base HEAD`. Builds do serviço e legado passaram.
Baselines/proteções não foram alterados. PostgreSQL próprio encerrado, zero
bases/papéis/conexões temporários de teste restantes.

## Onda 99 — boletos manuais e obrigações existentes (2026-10-04, sem commit)

O núcleo de `quotations/boleto.ts` continua único. A nova entrada
`requestQuoteBoletoPayment` recebe o principal do pedido manual e revalida
acesso/módulo em cada preparação transacional. `ensureQuoteBoletoPayment`
continua atendendo jobs já aceitos, sem essa nova admissão. Generate/send dos
dois hosts usam a entrada manual; o envio revalida novamente antes de enfileirar
a notificação. Se a emissão já foi aceita e o acesso muda entre as transações, a
emissão permanece durável, mas o novo envio é recusado.

Devolução, fechamento estrito, baixa PAID/SETTLED e reemissão de boleto
PENDING/OVERDUE da própria locadora revalidam na transação. Payloads estritos
são comuns à política HTTP e aos comandos. Em RESTRICTED essas obrigações
continuam disponíveis; extensão misturada ao fechamento, reabertura e cobrança
nova de orçamento não ganham exceção. SETUP/ARCHIVED continuam recusando.
Ownership, FINANCIAL WRITE, histórico, valores em centavos e regras de
conciliação são preservados; workers de reemissão/processamento não receberam
admissão manual. O HTTP passa a conferir onlinePayments também em send-boleto.

**Validação consolidada:** 587 casos distintos, 80 novos: 393 unitários/HTTP, 93
de segurança, 20 com papéis PostgreSQL restritos por RLS e 81 regressões
financeiras/jobs. Os 48 testes de adapters reexecutados não foram contados
novamente. Banco real prova obrigação idempotente, zero cobrança/outbox após
recusa, devolução com dívida de avaria, baixa, reemissão, escopo e alteração de
acesso durante a leitura externa: a conciliação anterior termina, mas não surge
nova cobrança. Essa atualização da organização dentro do leitor também prova que
a leitura externa não reteve o lock SQL.

Arquivos de provas: subscription-command-access.test.ts,
subscription-request-access.test.ts, subscription-quote-command.test.ts,
subscription-obligation-http.test.ts, subscription-command-database.test.ts,
rental-cycle-api.test.ts, financial-mutations-api.test.ts,
public-identity-composition-api.test.ts, quote-mutations-api.test.ts,
route-auth-inventory.test.ts, tenant-principal.test.ts,
billing-database.test.ts, cancelled-charge-proof-database.test.ts,
quote-settlement-database.test.ts, rental-concurrency.test.ts e
outbox-cron-database.test.ts. Doze adapters conservam erros/cache comerciais,
erros de domínio, missingDocuments e autorização anterior ao comando.

Tipos (12 projetos e legado), lint, arch, tokens, hygiene, check:test-names e
ratchet:guard --base HEAD passaram; builds do serviço e legado também. A fixture
inicialmente usava acesso direto à propriedade de import dinâmico, que o Knip
interpretava como uso de todos os exports da namespace. Desestruturar as duas
classes explicitamente corrigiu o grafo; baseline permaneceu com 853 achados
aceitos por 244 itens. Nenhuma proteção ou exceção foi alterada.

**Limites:** S8 permanece parcial. Demais comandos manuais, equipe, divulgação,
site, onboarding/backoffice e aceite de aparelhos/provedores/operação continuam
pendentes. A fiscalização real continua off; API legada, proxy e scheduler
preservados, sem migration, commit, push, deploy ou produção. Próximo bloco:
concluir admissão transacional dos demais comandos manuais e módulos, mantendo
separados os efeitos já aceitos. Progresso geral continua estimativa de esforço,
sem denominador medido.

## Onda 100 — comandos de orçamento, locação e perfil (2026-10-04, sem commit)

Admissão compartilhada agora alcança createQuoteRequest, updateQuote,
deleteQuote, createQuoteAdjustment, conversão manual, createManualRental,
checkoutRental, extendRental, applyRentalLateFee, pedidos do cliente e ocultação
do histórico. Lookup scoped precede a admissão nos comandos de recurso
existente; o lock da organização dura até a escrita/commit. Metadados FULL
antigos não substituem a projeção atual. Os 28 adapters apenas transportam
policy/cache privado, sem duplicar regras nem modificar erros/schemas antigos em
off.

Conversão manual e convertPaidQuotePayment compartilham um único núcleo. A
entrada de efeito aceito continua processando pagamentos e reutilizando a mesma
locação em RESTRICTED/ARCHIVED; o pedido manual é recusado. updateQuote admite
seu próprio comando antes da conversão na mesma transação. Perfil próprio usa a
exceção já existente de SETUP/RESTRICTED, após busca por tenantId/userId do
principal. ARCHIVED e ownership estrangeiro não ganham exceção.

**Validação consolidada:** 760 casos distintos, 116 novos. Unitários/HTTP: 522;
segurança: 94; PostgreSQL com papéis restritos: 63; regressões
financeiras/jobs: 81. A fixture de ownership foi corrigida para passar
customerId no objeto de opções, conforme a assinatura real; a suíte foi
reexecutada sem contar os mesmos casos novamente. Os 39 casos de recusa
transacional comparam antes/depois de orçamentos, locações, reajustes,
pagamentos, notificações, auditoria e outbox, e comprovam que a consulta de
disponibilidade não é executada. Controles FULL, ownership, conversão aceita
idempotente e perfil completam a cobertura.

Provas novas/estendidas: subscription-portal-command-http.test.ts,
subscription-command-access.test.ts, subscription-command-database.test.ts,
customer-profile-update-api.test.ts, rental-cycle-api.test.ts e
quote-mutations-api.test.ts. Regressões: customer-profile-read-api.test.ts,
subscription-obligation-http.test.ts, subscription-request-access.test.ts,
subscription-quote-command.test.ts, route-auth-inventory.test.ts,
tenant-principal.test.ts, subscription-route-context.test.ts,
rental-concurrency.test.ts, quote-settlement-database.test.ts,
cancelled-charge-proof-database.test.ts, billing-database.test.ts e
outbox-cron-database.test.ts.

Tipos (12 projetos e legado), lint, arch, tokens, hygiene, check:test-names e
ratchet:guard --base HEAD passaram. Builds do serviço e legado passaram; nenhum
baseline ou guard de teste foi alterado. Higiene permanece com 853 achados/244
tolerâncias.

**Limites e próximo corte:** S8 continua parcial. Não existe serviço de convite
ou gestão de equipe no inventário atual; enroll cria somente CLIENT, fora da
cota de funcionários. A cota staffSeats deve acompanhar o consumidor real, sem
guarda isolada usada apenas por teste. Comunicações, divulgação/site, UI SaaS,
onboarding/backoffice e aceite de aparelhos/provedores/operação seguem
pendentes. Concluir admissão dos consumidores de comunicação/divulgação e
revisar a interação com obrigações aceitas antes da ativação comercial.
Fiscalização real off, API legada, proxy e scheduler preservados. Sem migration,
commit, push, deploy ou produção. Geral ~60% permanece estimativa de esforço.

## Onda 101 — comunicação e documentos duráveis (2026-10-04, sem commit)

A admissão compartilhada entra no sendTextMessage antes do upsert da conversa e
do INSERT da mensagem processing; usa o módulo whatsapp e conserva o lock da
organização até commit. O POST à Meta continua fora do SQL. Uma restrição
comercial posterior não impede gravar sent ou unknown. Não há reenvio automático
de resultado ambíguo. Nenhuma mudança em webhook, templates ou credenciais
reais.

generateRentalContract revalida após encontrar a locação da locadora e antes de
alterar o rascunho. requestContractSignature revalida após ownership/lock e
antes de registrar tentativa/outbox; exige contractSignature. A geração local
não exige o módulo premium. requestAdjustedQuoteDelivery revalida após lookup
scoped e antes de enfileirar quote.adjustment.notify; o e-mail de sistema não
exige emailInbox. Workers já aceitos de assinatura e orçamento mantêm a entrada
existente, sem gate de novo pedido. Não foi criada exceção comercial nova.

Os quatro adapters de contratos e os dois de envio ajustado conservam o erro de
domínio anterior quando não existe policy; policy usa status/body original com
private, no-store e Vary Cookie, Host. O adapter HTTP compartilhado do WhatsApp
conserva 503 de configuração, 502 de envio ambíguo na integração e 500 anterior
do painel. Os hosts não duplicam regra de plano.

**Validação consolidada:** 437 casos distintos, 46 novos; 228 unitários/HTTP, 93
PostgreSQL, 22 efeitos e 94 segurança. As 12 recusas de comunicação sob
SETUP/RESTRICTED/ARCHIVED com principal FULL antigo comparam contratos,
tentativas, conversas, mensagens, outbox e notificações antes/depois. Controles
de módulo, FULL sem módulos opcionais, dedupe/ownership, downgrade após
processing e e-mail aceito em RESTRICTED/ARCHIVED completam as provas. A fixture
inicial usava env:LOCAL_FIXTURE, recusada pela constraint vigente; foi corrigida
para uma referência sintética no formato exigido e reexecutada, sem modificar o
banco ou a proteção.

Testes: whatsapp-write-api.test.ts, whatsapp-read-api.test.ts,
quote-mutations-api.test.ts, quote-documents-api.test.ts,
subscription-contract-command-http.test.ts, subscription-command-access.test.ts,
subscription-command-database.test.ts, contracts-database.test.ts,
contract-signature-effects.test.ts, route-auth-inventory.test.ts,
tenant-principal.test.ts e subscription-route-context.test.ts. Tipos dos 12
projetos e legado, lint, arch, tokens, hygiene, check:test-names e ratchet:guard
--base HEAD passaram sem alteração de baselines.

Builds do serviço e da API legada passaram. O prebuild gerou somente o client
Prisma; não aplicou migrations. As fixtures de banco/papéis foram removidas.

**Limites e próximo corte:** S8 não está completo. Mutações Zoho fazem POST/PUT
direto no provedor sem intenção durável anterior: precisam de um corte próprio
de aceitação/reconciliação que preserve respostas existentes e leituras com
refresh. Não foi instalado um check isolado que simule atomicidade. Merchant
continua em quarentena, sem credenciais por locadora; não foi reativado o
provedor global. Publicação/site, equipe, UI SaaS/onboarding/backoffice e aceite
de aparelhos/provedores/operação continuam pendentes. Fiscalização real off, API
legada/proxy/scheduler ativos, sem commit/push/deploy/produção. Progresso geral
permanece estimativa de esforço, não percentual de testes ou rotas.

## Onda 102 — admissão durável Zoho (2026-10-04, sem commit)

Seis mutações compartilham executor no backend: SEND, REPLY, DRAFT, UPDATE,
DELETE e UPLOAD. Admissão com plano, participação e conexão scoped termina antes
do provedor; resposta confirmada é reaproveitada pela chave estável,
PROCESSING/UNKNOWN não causam novo envio. Modo off e leitura/refresh
preservados. Migration aditiva, FORCE RLS e histórico imutável; 32 tabelas de
negócio classificadas, sem mudar baselines. 358 casos passaram, 55 novos; tipos
dos 12 projetos e legado aprovados. Lint, arch, tokens, hygiene, nomes e ratchet
somente em leitura passaram. Os dois builds passaram. O ledger novo não tem
drift de schema. 50 casos HTTP reais de mutações passaram com provedor loopback
e cookies/RLS nos dois hosts. A comparação ampliada de leituras/OAuth teve 56
casos aprovados e oito falhas de origem: a política central aceita GET/HEAD,
enquanto as caracterizações esperam recusa de Origin irmão. Testes e política
ficaram intactos; essa fronteira deve ser resolvida antes de declarar o conjunto
plenamente validado.

Reconciliação de resultados incertos, OAuth/desconexão, Merchant, equipe/site,
UI SaaS/onboarding/backoffice e aceites reais continuam parciais. Fiscalização
off, API legada/proxy/scheduler ativos, sem commit/push/deploy/produção.
Progresso geral continua ~60% de esforço.
[Desenho, provas e limites](../architecture/zoho-command-admission.md).

## Onda 103 — origem Zoho e catálogo público (2026-10-04, sem commit)

O guard compartilhado de Zoho valida Origin explicitamente enviado também em
GET. A recusa vem antes de refresh/transport e da leitura ou consumo do state
OAuth; callbacks de navegação sem Origin continuam válidos. A política genérica
de métodos seguros e os testes anteriores não foram relaxados.

GET /api/public/plans existe no serviço e na API legada. Os adapters apenas
chamam readConfiguredPublicPlans; consulta/projeção ficam em subscriptions e
composição em runtime. A conexão PLATFORM_DATABASE_URL é obrigatoriamente
separada do runtime de negócio e o escopo verifica o papel real em transação
READ ONLY. O contrato PublicPlansResponse preserva valores com duas casas e
direitos estritos, sem dados de locadoras, faturas ou credenciais.

Somente versões de planos públicos não arquivados, com valor positivo e
sellableFrom <= agora < sellableUntil (ou sem fim), são ofertas. Não há escolha
automática entre intervalos ou versões com janelas sobrepostas. Mais de dez
ofertas ou dado publicado inválido dão 503 neutro, sem truncamento. Catálogo
vazio é válido; nenhum plano/preço comercial foi criado. Cache compartilhado de
até 60 segundos; a futura criação da assinatura deverá revalidar a versão na
transação, não tratar o catálogo como autorização de compra.

O proxy libera o caminho exato no apex/app; não abre subrotas nem o host de
locadora. Sem papel de plataforma configurado, ambos os hosts dão 503 no-store,
sem fallback ao banco de negócio. 502 casos distintos passaram (27 novos): 189
unitários, 51 de banco/identidade, 68 de roteamento, 78 do inventário estrutural
e 116 HTTP com cookies/RLS e provedor loopback. Reexecuções dos arquivos
corrigidos não foram somadas. As oito recusas de origem antes falhas passaram;
callbacks legítimos e mutações permanecem aprovados. Tipos dos 12 projetos e
legado, lint, arch, tokens, hygiene, nomes, ratchet em leitura, documentação e
builds dos dois hosts passaram.

PublicPlansResponse passou a ser consumido no produto; só sua exceção obsoleta
foi removida da baseline de higiene, reduzindo tolerância sem ampliar proteções.
As fixtures conservaram triggers imutáveis: ofertas sintéticas foram arquivadas,
e bancos/papéis temporários saíram no teardown. Datas da fixture usam UTC
explícito e respostas HTTP simuladas são novas por chamada, sem alterar produção
para corrigir teste. Logs das execuções permanecem somente em TEMP.

Aceite HTTP positivo do catálogo com configuração real, telas,
onboarding/backoffice e operação externa permanecem pendentes; API
legada/proxy/scheduler e fiscalização off preservados. Progresso geral permanece
estimativa de esforço (~60%).

## Onda 104 — assinatura e faturas do dono (2026-10-04, sem commit)

GET /api/admin/subscription e GET /api/admin/subscription/invoices existem no
serviço e no legado. Os adapters fazem o gate de identidade/ADMIN e delegam;
consulta, propriedade e projeção ficam no backend compartilhado. Ser ADMIN ou
carregar isOwner na sessão não basta: a leitura revalida membershipId, locadora,
usuário, vínculo ADMIN ativo, Organization.status e ownerUserId no banco. Legado
sem dono não recebe um dono escolhido automaticamente.

A leitura usa uma transação de negócio com RLS, RepeatableRead e READ ONLY. O
papel de plataforma não lê equipamentos. Assinatura, vínculo, direitos e uso
ficam no mesmo snapshot; uso conta modelos Equipment e Membership ACTIVE não
CLIENT, incluindo o dono. Direitos usam o helper existente e a função pura de
exceções, sem outra regra. O resumo prefere a assinatura não cancelada; sem ela,
retorna a última cancelada. Sem assinatura responde 404 SUBSCRIPTION_NOT_FOUND,
sem inventar plano. Projeção inconsistente ou DTO inválido respondem 503 neutro,
sem corrigir fatos comerciais em um GET.

O dono pode ler estes dois caminhos exatos em SETUP, FULL, RESTRICTED e ARCHIVED
quando a fiscalização é on. A exceção não abre escritas ou subrotas;
fiscalização real permanece off. Valores são strings decimais com duas casas;
colunas DATE mantêm o dia civil, e timestamps usam ISO. Faturas incluem o
histórico da locadora, inclusive assinaturas anteriores, limitado às 100 mais
recentes por vencimento, criação e id. A consulta não apaga histórico; paginação
futura não está neste contrato. Links obedecem ao contrato https de Asaas, sem
credenciais. Sucesso e recusas são private, no-store com Vary Cookie, Host; não
há e-mail de cobrança, ids do provedor ou credenciais nos DTOs.

Validação consolidada final: 185 unitários, 126 de banco/RLS e 78 estruturais
passaram. Os mesmos 24 cenários HTTP passaram nos dois hosts compilados com
NextAuth e com Better Auth (24 em cada modo); reexecuções não foram somadas.
Provas incluem os seis estados, troca de dono com principal antigo, seleção
explícita, outra locadora, histórico cancelado, contagens, exceções vigentes,
limite de faturas e cache privado. Tipos dos 12 projetos e raiz, lint, arch,
tokens, hygiene, nomes, ratchet em leitura e os dois builds passaram.

A preparação HTTP usa papel de plataforma separado, sem bypass ou herança, e o
runtime usa apenas as permissões de leitura necessárias. CHECKs de plano/slug e
triggers foram preservados. A fixture restaura o dono anterior da função SQL de
segurança antes de remover seu papel; nunca usa CASCADE ou apaga a função.
Histórico imutável permanece até a remoção do banco descartável exclusivo.
Somente duas exceções obsoletas de tipos saíram da baseline de higiene, porque
SubscriptionSummary e PlatformInvoicesResponse passaram a ter consumo real. O
checker de autorização e suas tolerâncias não foram alterados.

Não há criação comercial de assinatura, cobrança, alteração de plano,
reativação, tela ou ativação neste bloco. S6/S8/onboarding/backoffice e aceite
de provedores, aparelhos e operação seguem parciais. API legada, proxy,
scheduler e configurações reais preservados; sem commit, push, deploy, migration
ou produção. Próximo corte: tela de assinatura/faturas no frontend
compartilhado, sobre estes contratos, sem inventar planos/preços ou autorizar
mutações ainda ausentes.

## Onda 105 — consulta da assinatura nos clientes (2026-10-04, sem commit)

/admin/assinatura monta a mesma slice de packages/frontend nos hosts web, Expo e
legado. No web, ela consulta os dois GETs da onda 104 e apresenta plano, seis
estados, datas civis, uso, direitos efetivos, alterações já agendadas e até 100
faturas históricas. Valores monetários permanecem strings, sem conversão a
Number. Links https validados de fatura abrem com noopener/noreferrer e
no-referrer. A tela não cria cobranças, não altera plano e não recalcula acesso.

O modelo compartilhado só admite usuário autenticado com vínculo ADMIN ativo;
isso habilita a consulta, não comprova propriedade. Somente resposta autorizada
do backend revela dados e habilita o item Assinatura no menu/faixa do dashboard.
403 não vira plano vazio; 404 SUBSCRIPTION_NOT_FOUND é o único caso sem
assinatura. Resumo e faturas são publicados juntos: uma recusa da segunda
leitura não revela o resumo anterior. Troca de usuário, locadora, vínculo ou
transporte invalida o snapshot imediatamente, aborta a consulta e descarta
respostas antigas mesmo quando o transporte ignora cancelamento. Não há cache
comercial global.

A ADR restringe o Expo a estado/faixa e link para o painel no navegador. A
variante nativa nunca consulta /invoices. O host valida EXPO_PUBLIC_WEB_URL como
origem, exige https em produção e abre /admin/assinatura com locadora como
indicação para seleção já existente. Não transporta sessão, token ou cookie do
app; a autenticação no navegador permanece própria. Configuração ausente ou
inválida gera erro neutro, sem fallback para a origem da API.

Validação consolidada: 94 testes focados, 95 do host mobile e 184 do host web
passaram; tipos dos 12 projetos e raiz, lint, arch, tokens, hygiene, nomes,
lint:css e ratchet em leitura passaram. Builds de produção web/raiz e exports
Android/iOS passaram; os dois source maps incluem a variante nativa da página e
excluem a web. Três exceções obsoletas saíram da baseline de higiene por consumo
real de tipos/helper, sem ampliar tolerância.

Chromium aprovou 14 cenários da tela em 390/1440 px: os seis estados e recusa de
dono em cada largura, sem overflow horizontal ou escrita na API. Mais duas
capturas do dashboard passaram; comparação de estilos com a baseline existente
resultou em zero diferenças, zero APIs não mapeadas e zero esperas instáveis. A
persona anterior é explicitamente equipe sem propriedade. As novas provas usam
dados sintéticos, não substituem a prova RLS da onda 104 ou aceite em
aparelho/provedor. Servidores próprios foram encerrados e saídas ficaram no
TEMP.

Pendência encontrada no teste global Tailwind: 10 de 11 passaram; faltam 12
referências de classes bg/border/text com variáveis de cor em tipos.web.ts de
logística/manutenção, arquivos anteriores a esta onda. Nenhuma dessas classes
foi adicionada pela tela de assinatura. Fixture/checker e baseline visual não
foram modificados para aprovar o teste. Entrada 287 de known-issues.md registra
a lacuna; a validação global de paridade não é declarada verde.

S11b/S11c continuam parciais: este bloco é consulta, sem compra, emissão,
troca/cancelamento/reativação, onboarding ou backoffice. API legada, proxy e
scheduler ativos, fiscalização real off, configurações reais preservadas; nenhum
commit, push, deploy ou produção. Geral ~60% continua estimativa de esforço, sem
denominador certificado. Próximo corte: resolver a lacuna de referência visual
anterior e implementar uma ação do dono com admissão, idempotência e serviço
compartilhado, antes de expor seu controle na tela.

## Onda 106 — cancelamento pelo dono (2026-10-04, sem commit)

Os dois hosts expõem POST /api/admin/subscription/cancel e /undo-cancel. Os
adapters só resolvem principal, guardam ADMIN e compõem o mesmo handler
HTTP/serviço em packages/backend. Propriedade não é inferida desse papel: a
transação do papel isolado de plataforma prende Organization e Subscription,
revalida ownerUserId e Membership ADMIN ACTIVE e relê os fatos depois da trava.

É obrigatória autenticação há no máximo dez minutos, com o erro existente
FRESH_SESSION_REQUIRED (401). NextAuth grava authenticatedAt no JWT somente em
sign-in com user/account e mantém a revogação por versão da credencial.
Renovação/update do cookie não muda esse instante. Better Auth usa createdAt
validado da sessão, preservado durante renovação, nunca updatedAt/expiresAt.
Cookies antigos sem esse dado continuam nas consultas usuais; a ação sensível
exige entrar novamente. Dados no corpo/header não fornecem esse privilégio. O
instante é conferido outra vez depois da espera pela trava.

Idempotency-Key é obrigatório, entre 8 e 128 caracteres ASCII permitidos. O
corpo aceita vazio ou objeto JSON vazio, com limite de 1 KiB. A chave persistida
é hash scoped por locadora e usuário; o recibo imutável diferencia as ações e
inclui no-op. Replay não desfaz uma ação posterior nem atinge assinatura
substituta; reutilizar a chave para a ação contrária retorna 409. A resposta
estrita {accepted:true} confirma a transação local, não o provedor. O consumidor
deve reler o resumo.

A projeção/domínio existentes decidem o encerramento. Cortesia/período pago
vigente são protegidos, inclusive um ciclo já pago ainda não reconciliado. Teste
sem período pago encerra imediatamente; o pedido e a projeção/outbox são
atômicos. Desfazimento vence no dia devido, mesmo antes do cron atualizar o
estado. ASAAS com recurso conhecido ou criação UNKNOWN enfileira o worker
existente de inativação/reconciliação; a requisição não chama o Asaas. Não
existe DELETE de assinatura nem remoção de histórico/dívidas neste incremento.

SETUP/RESTRICTED permitem somente os dois POSTs exatos do dono; subrotas e
outros métodos não recebem essa exceção. ARCHIVED preserva as consultas e
exportação, sem desfazer encerramento. A flag real/default off não foi alterada.

Validação consolidada: 170 unitários, 19 novos casos de banco sob papel sem
BYPASSRLS, 73 regressões de jobs/revogação e 79 estruturais: 341 casos
distintos, sem somar reexecuções. As 46 provas HTTP de handler/adapter foram
reconfirmadas após alinhar o código de erro ao contrato. Corridas reais
observaram a espera em pg_stat_activity: transferência de dono e expiração
durante a trava recusam a escrita, e quatro pedidos iguais geram um único
recibo. Rollback conserva recibo, flag, projeção e outbox. A primeira execução
teve timeouts de imports concorrentes e fixtures incompletas; não foram
ocultados: execução serial e fixtures com os mesmos CHECKs/roles passaram.

Tipos dos 12 projetos/raiz, lint focado, arch/tokens/hygiene/nomes/ratchet e
builds API/legado passaram. O compositor foi instalado em platform-jobs.ts, o
único leitor permitido do pool de plataforma, sem mudar o gate. Saiu somente a
exceção obsoleta de EmptyActionInputSchema da higiene, agora consumido de
verdade; tolerância reduzida, sem novos allows.

Limites: sem controle comercial na UI, troca/ativação/reativação, novo
scheduler, tráfego, provedor real ou aceite operacional. As provas dos novos
comandos executam handlers/adapters diretamente e o banco real; não certificam
uma nova sessão via HTTP contra os builds, nem o efeito externo. A lacuna
Tailwind 287 continua aberta; este bloco não modifica CSS. API
legada/proxy/scheduler mantidos, nenhum commit/push/deploy/produção. Geral ~60%
continua estimativa de esforço, sem denominador certificado. Próximo corte:
confirmação explícita do dono na tela web, reautenticação e releitura após a
ação, preservando o limite mobile de estado/link da ADR.

## Onda 107 — confirmação e reautenticação no web (2026-10-04, sem commit)

A página compartilhada /admin/assinatura compõe os POSTs da onda 106. API,
modelo e confirmação ficam na slice pages/assinatura-admin; nenhuma regra de
projeção/preço/cancelamento foi copiada para frontend/hosts. Usa AlertDialog e
Button do design system, sem CSS novo. Plano ausente ou CANCELED não oferece
comando. Agendamento oferece desfazimento, sujeito à validação atual do backend.

Abrir confirmação/Voltar não envia. Confirmar bloqueia duplo clique e fechamento
enquanto o transporte está pendente. Chave aleatória só nasce na intenção
explícita, permanece em memória e é reutilizada no retry manual da resposta
incerta, inclusive ao fechar/reabrir o diálogo. Não há envio automático,
localStorage/sessionStorage ou ação/chave na URL. Escopo de usuário, vínculo,
locadora e transporte e fingerprint do resumo revisado impedem confirmação
antiga; mudança de escopo aborta/descarta respostas, mesmo se fetch ignora
abort. Abort do cliente não desfaz um efeito já aceito pelo servidor.

O recibo estrito accepted:true só mostra pedido registrado e refaz os dois GETs.
Não afirma efeito no Asaas nem altera resumo otimisticamente. Erros não exibem
corpo privado. OWNER_REQUIRED/estado alterado levam à releitura. Sessão antiga
oferece /login?reauthenticate=1 com callback interno da assinatura e locadora
como indicação de seleção; propriedade continua sendo verificada no servidor.

O modo de reautenticação reaproveita o formulário existente e não pula para o
painel com o cookie antigo. Credenciais são enviadas pelo adapter atual e o
retorno exige identidade na sessão obtida. A flag da UI não comprova idade da
sessão: o backend continua verificando o instante assinado/createdAt da
onda 106. Depois do login, a pessoa relê e confirma novamente, sem reaplicar
pedido. Web e raiz legada montam a prop; Expo mantém estado/link e não ganha
comandos.

Validação consolidada: 179 testes focados passaram, 185 web (sete casos já
pulados pelo config) e 95 mobile; Chromium passou 16 cenários em 390/1440 px,
incluindo os seis estados, recusa de dono, confirmação, retry com mesma chave,
releitura e formulário de reautenticação mesmo com cookie. Capturas do diálogo e
login foram inspecionadas fora do repositório. Os novos cenários do navegador
usam identidade/API sintéticas: não provam cobrança real nem nova sessão nos
dois motores via HTTP compilado.

Na primeira execução, consultas por role não viam o botão atrás do modal
acessível e CardTitle é div, não heading; provas foram ajustadas aos elementos
reais. Esperas agora observam o transporte assíncrono antes de abortá-lo. A
prova existente de rota mantinha regex restrita a aspas duplas; agora aceita os
dois estilos sem mudar destinos esperados. As mesmas exigências passaram, sem
relaxar timeout, gate, baseline ou permitir órfão.

Tipos dos 12 projetos/raiz, lint, arch/tokens/CSS/nomes/higiene/ratchet e builds
web/raiz aprovados. EPERM do subprocesso Knip no sandbox exigiu execução fora
dele; ratchet foi conferido contra 55763c1e, checkpoint canônico local. Higiene
conserva 846 achados aceitos por 243 entradas; nenhuma proteção alterada.
Servidores do ensaio encerrados; API/proxy/scheduler legados e enforcement off
preservados, sem commit/push/deploy/produção.

Limites: referência Tailwind 287 continua aberta. Ativação, troca/reativação,
onboarding/backoffice, Asaas/BaaS/KMS reais, aparelhos e aceite operacional
permanecem parciais. ~60% geral é estimativa de esforço sem denominador
certificado. Próximo corte: serviço transacional de ativação da assinatura
usando plano/aceites já documentados, antes de expor sua confirmação no web.

## Onda 108 — ativação e emissão da mensalidade (2026-10-04, sem commit)

POST /api/admin/subscription/activate está montado nos dois hosts com o contrato
existente: corpo vazio ou {}, Idempotency-Key e accepted:true. Os adapters
reutilizam principal, CSRF/budget centrais e sessão de autenticação real
recente. owner-command compartilha a validação do dono/vínculo atual, ordem de
travas, frescor depois da espera e recibo imutável com cancel/undo-cancel. A
mesma chave não muda de ação; replay histórico não ativa outra assinatura.

O pedido só alcança a emissão ASAAS de INCOMPLETE/TRIALING, sem cancelamento
agendado. Cortesia, FAILED e ambiente conflitante são recusados. Plano já
selecionado precisa ser mensal/positivo; nenhum plano/preço público é inventado.
Perfil usa CNPJ validado pelo domínio, razão social e e-mail da assinatura,
organização ou view de contato do dono. Quatro aceites persistidos desse dono
devem ter versão/hash e data não futura. Este requisito não homologa textos
jurídicos nem inventa uma versão vigente: onboarding, versões comerciais e
aprovação jurídica ainda precisam de sua própria entrega.

O recibo, estado PENDING e outbox subscriptions.provider-sync são atômicos.
UNKNOWN/PROCESSING não são zerados por outro pedido. Cliente não é criado no
início do teste: o worker do cron existente encontra o pedido explícito ou
INCOMPLETE sem teste/TRIALING em D-7. Configuração da raiz continua exclusiva da
composição platform-jobs; sem chave/ambiente explícitos o consumidor não é
instalado, sem fallback para chave da locadora ou nova agenda.

Duas fases duráveis: procura cliente por documento/ref org:, reserva PROCESSING,
cria com notificationDisabled:true e persiste providerCustomerId antes de
qualquer POST de recorrência. Busca adicional só por ref impede que uma mudança
de documento esconda o cliente anterior. A referência da assinatura é sub:id;
UNDEFINED/MONTHLY, centavos exatos, primeiro vencimento no fim do teste ou hoje,
multa/juros zero, sem split/cartão. Cada criação usa 60 segundos no transporte
comum protegido.

PROCESSING após queda e UNKNOWN fazem somente GET na fase incerta. Cliente
confirmado permite iniciar a fase da recorrência porque nenhum POST dela podia
ocorrer antes do id do cliente durável. Recorrência incerta não é recriada.
Timeout/5xx/resposta inconclusiva exigem conciliação; GET falhando depois de
POST bem-sucedido continua incerto. Divergência de cliente, ref, ciclo, valor ou
estado fica FAILED com código/auditoria. Predecessor cancelado com criação de
cliente incerta bloqueia outro cliente para a mesma organização.

Travas da organização/assinatura, contador de tentativas e reserva antes de I/O
impedem dois workers de criar ao mesmo tempo. Cadastro/aceites são revalidados
antes da reserva. Cancelamento durante I/O conserva CANCELED, associa o recurso
confirmado ao histórico e enfileira a inativação existente; não reabre acesso.
Criar recorrência não prova pagamento nem deriva ACTIVE: conciliação/faturas da
onda 92 continuam responsáveis pela projeção.

Fontes oficiais conferidas nesta onda:
[criar cliente](https://docs.asaas.com/reference/criar-novo-cliente),
[listar clientes](https://docs.asaas.com/reference/listar-clientes) e
[criar assinatura](https://docs.asaas.com/reference/criar-nova-assinatura). A
documentação confirma que clientes podem duplicar e que criação da recorrência
não confirma pagamento; o fluxo usa referências e conciliação.

Validação consolidada: 179 unitários HTTP/admissão, 29 adapters, 123 de banco
(49 comandos/emissão, 62 regressões de jobs e 12 runtime), 78 de inventário de
rotas e 106 de contrato Asaas falso: 515 casos distintos, sem somar reexecuções.
No banco descartável, papel sem BYPASSRLS prova recibo/estado/outbox atômicos,
D-7, fila/dispatcher real, corrida, crash/UNKNOWN, cadastro alterado,
isolamento, vínculo divergente e cancelamento durante a chamada. Adapters não
chamam Asaas real. A preparação inicial das fixtures violou a proteção de
colunas da organização; corrigiu-se a preparação para usar a transação isolada,
sem mudar a proteção. A consulta D-7 ganhou cast explícito date após a prova
PostgreSQL.

Builds locais API/legado e tipos dos 12 projetos/raiz aprovados. Seis
verificações HTTP contra ambos os builds: POST activate/cancel anônimo com
corpo/identidade forjados é 401 privado/no-store e GET activate é 405. O Next
reordena diretivas de cache; a prova compara seu significado. Não foi
certificado login recente até emissão pela rede nos dois motores, sandbox real,
pagamento ou aparelho.

Lint, arch, tokens, nomes, higiene, ratchet 55763c1e, markdownlint, índices e
diff check aprovados. A única exceção de higiene retirada é normalizarDocumento,
agora consumido pelo adapter; 845 achados/243 entradas, sem novo baseline ou
relaxamento do checker. Não há migração nova, commit, push, deploy, ativação em
produção, troca de tráfego ou alteração da fiscalização real off. O antigo
app/api, seu proxy e scheduler permaneciam ativos naquele corte. Logs/sondas só
em TEMP e processos próprios encerrados.

S6/S11b continuam parciais: faltam consumidor web da ativação, troca/reativação,
onboarding/backoffice e conciliação assistida de estados em quarentena; planos,
textos jurídicos e aceite de provedor/operação não estão publicados/homologados.
A lacuna Tailwind 287 permanece. Próximo corte: confirmação de ativação no web
com releitura/idempotência, mantendo mobile com estado/link, seguida dos demais
comandos e provisionamento. Progresso geral continua estimativa, sem
certificação de conclusão do produto.

## Onda 109 — ativação confirmada no web (2026-10-04, sem commit)

O consumidor web de activate da onda 108 está instalado em assinatura-admin. Um
único transporte/modelo/diálogo atende activate, cancel e undo-cancel: os
arquivos owner-cancellation/use-cancellation/SubscriptionCancellation foram
movidos para owner-action/use-owner-action/SubscriptionActions, com seus testes
preservados e colocados sob o assunto. Hosts e APIs públicas não ganharam regras
de negócio; o backend continua sendo a autoridade do comando.

O resumo já validado habilita o botão de ativação em INCOMPLETE/TRIALING ASAAS,
mensal/positivo e sem cancelamento agendado. A oferta não comprova propriedade,
cadastro ou estado do provedor: o servidor revalida todos os requisitos. O
diálogo apresenta plano/mensalidade lidos, informa o vencimento no fim do teste
vigente e separa a solicitação da confirmação de pagamento. Corpo {}, chave
efêmera e recibo estrito accepted:true mantêm o contrato existente, sem novos
DTOs, preços, termos ou campos privados do provedor.

Uma intenção incerta conserva tanto a chave quanto a ação. Outro comando fica
indisponível até confirmar o resultado ou reler um resumo diferente; fechar e
abrir não troca o pedido. Repetição só após clique, sem retry automático. Duplo
clique/pedido pendente não duplica; mudança de sessão/locadora/transporte aborta
e descarta resposta antiga, e mudança do resumo/preço invalida a intenção.
accepted relê resumo e faturas; não grava ACTIVE ou PAID localmente. Respostas
de perfil/aceites/configuração incompletos têm mensagens públicas fixas, sem
ecoar detalhes do servidor. Sessão antiga exige entrar/revisar/confirmar de
novo, sem comando/chave no callback. Mobile continua somente estado/link, sem
comandos ou leitura de faturas por esta tela.

Com dois gatilhos para um único AlertDialog, o fechamento restaura o foco ao
botão que iniciou a ação, em vez de escolher o último gatilho registrado.
Reutiliza as variantes e estilos atuais do design system; nenhum CSS/tokens,
baseline visual ou proteção foi alterado.

Validação consolidada: 180 casos de assinatura-admin, entities/assinatura e
features/entrar passaram, incluindo os fluxos antigos de cancelamento e a
ausência de compra no nativo. As duas primeiras expectativas do web ainda
exigiam ausência de ativação; foram atualizadas para exigir o botão apenas nos
estados habilitados e conservar as recusas nos demais. A primeira prova do modal
procurava botão de fundo como elemento acessível; Radix o torna inerte, e o
teste passou a inspecionar o mesmo botão desabilitado no DOM. Os mocks foram
tipados e a fixture MANUAL inválida foi retirada: o contrato real aceita ASAAS
ou COMPLIMENTARY, sem novo modo de produto.

18 cenários Chromium passaram, 390/1440 px: ativação explícita, mensalidade,
Voltar/foco, repetição com a mesma chave, releitura de fatura PENDING sem
presumir ACTIVE, cancel/undo, reautenticação e seis estados de consulta. As
capturas de confirmação foram inspecionadas nos dois tamanhos, sem corte ou
overflow horizontal. São APIs/identidade sintéticas no host web real, não um
teste de Asaas, aparelho físico ou autenticação/comando contra os dois motores
compilados. Builds web/legado e tipos dos 12 projetos/raiz passaram; lint, arch,
tokens, nomes, higiene, ratchet 55763c1e, Markdown/índices e diff check
passaram. Saídas somente em TEMP e servidores/navegador próprios encerrados.

Não há migração, alteração de env real/enforcement, cutover, commit, push,
deploy ou produção. O antigo app/api, seu proxy e scheduler continuavam
configurados/ativos naquele corte; dois hosts reutilizam o backend instalado
anteriormente. S6/S11b permanecem parciais: troca de plano/reativação,
onboarding/backoffice, comunicação de quarentena e aceites jurídicos/comerciais,
provedor e operação reais faltam. A pendência Tailwind 287 continua. Próximo
corte: comandos de troca/reativação com planos persistidos e histórico
protegido, conforme a ADR, antes de seus consumidores e provisionamento.
Progresso geral continua estimativa de esforço.

## Onda 110 — reativação durável pelo dono (2026-10-04, sem commit)

POST /api/admin/subscription/reactivate foi instalado no legado e no serviço. Os
adapters só preservam identidade/ADMIN, headers e composição; caso de uso,
recibos, catálogo, conciliação e emissão continuam em packages/backend. O corpo
estrito existente aceita apenas planVersionId; idempotência, sessão real recente
e ownership/vínculo atuais são revalidados sob as mesmas travas de
cancel/activate. Replay conserva a assinatura/plano originalmente aceitos;
reutilizar a chave para outro plano ou ação retorna 409.

A assinatura CANCELED anterior permanece terminal. Uma oferta pública, mensal,
positiva e atualmente vendável cria outra Subscription INCOMPLETE, sem teste,
recurso remoto ou período pago. Perfil/CNPJ/contato e quatro aceites persistidos
são necessários. Recibo do dono, ligação imutável com a anterior, perdão de
vencidas, Organization.access SETUP e outbox são atômicos. A janela de venda é
compartilhada com GET /api/public/plans; não há catálogo ou preço inventado.
ARCHIVED aceita somente o POST exato do dono, sem abrir siblings, outros verbos
ou hints de papel.

subscriptions.reactivate usa o cron/dispatcher existentes e o mesmo executor de
inativação/exclusão. Primeiro confirma INACTIVE da recorrência anterior, depois
importa faturas ausentes e concilia as vencidas do momento do pedido.
REACTIVATION_WAIVER/debtWaivedAt preservam o perdão local; cobrança PENDING ou
OVERDUE não reabre link pagável enquanto o provedor ainda concilia. DELETE só é
tentado para cobrança não paga validada. PROCESSING/UNKNOWN só consultam; 404
após DELETE não prova exclusão e mantém a reserva. Restauração,
valor/cliente/escopo/estado desconhecido bloqueiam a nova emissão. Cobrança
paga, estornada ou em chargeback não é apagada; pagamento antigo preserva
histórico e gera auditoria para tratamento manual. A semântica da operação foi
conferida na
[referência oficial de exclusão de cobrança](https://docs.asaas.com/reference/excluir-cobranca).

REACTIVATION_READY só libera o worker de emissão de duas fases depois da
conciliação. Activate e o cron não contornam essa barreira. Cancelar e reativar
novamente mantém a dependência transitiva das pendências anteriores; o
encerramento durante I/O conclui limpeza, sem emitir para a assinatura
cancelada. A nova recorrência usa sub:<novoId>, sem reaproveitar a anterior.
Pagamento continua dependendo da conciliação de faturas.

Validação consolidada: 222 unitários (quatro arquivos); 171 casos de banco (77
comandos/emissão/reativação, 62 jobs, 20 faturas, 12 runtime); 87 de segurança
(três arquivos): 480 distintos, sem skips nessas execuções. Dispatcher e RLS
reais usam banco/roles descartáveis sem bypass; provedor injetado é falso.
Fixtures foram corrigidas para syncedAt obrigatório e encerradas entre testes
para não interferir no cron global; as asserções antigas foram preservadas.
Tipos dos 12 projetos/raiz, lint, arch, tokens, nomes, higiene, ratchet e builds
API/legado passaram. Dez verificações HTTP nos dois builds confirmaram POST 401
privado, GET 405 e origem externa 403. Só duas exceções obsoletas da higiene
saíram: planejarReativacao agora tem consumidores de produção. Nenhum
checker/tolerância aumentou.

Sem nova migration, dependência, scheduler, alteração de env real/enforcement,
produção, cutover, commit ou push. O antigo app/api continuava ativo naquele
corte. Interface web de reativação, onboarding/backoffice e homologação real
ainda pendentes. A classificação upgrade/downgrade precisa de decisão comercial:
a ADR não define hierarquia e sortOrder é apresentação; não foi usada uma regra
de preço ou ordem visual silenciosamente. Próximo corte independente:
confirmação web de reativação com escolha de oferta persistida; depois troca de
plano.

## Onda 111 — reativação confirmada no web (2026-10-04, sem commit)

A página existente em packages/frontend/pages/assinatura-admin consome POST
reactivate da onda 110. Nenhuma regra de emissão, perdão, prazo ou propriedade
foi transferida para o cliente. O resumo autorizado CANCELED habilita a consulta
estrita de GET /api/public/plans no ciclo da identidade/locadora; somente
ofertas mensais retornadas são apresentadas, sem catálogo, preço ou hierarquia
inventados.

A pessoa escolhe a oferta explicitamente e revisa nome/mensalidade, ausência de
novo teste, preservação do histórico e conciliação da anterior. Voltar não
envia. A confirmação transmite somente planVersionId e a chave efêmera de
idempotência, sem preço, locadora, comando na URL ou armazenamento persistente.
accepted:true relê resumo/faturas; a tela não presume cobrança emitida ou
pagamento confirmado.

owner-action/use-owner-action/SubscriptionActions continuam únicos para
activate/cancel/undo/reactivate. Mudança de oferta antes do envio invalida a
confirmação; comparação usa o contrato normalizado, sem depender da ordem das
chaves JSON. Após resultado incerto, mudar catálogo não substitui a intenção:
retry manual mantém plano/ação/chave originais, mesmo se a oferta sair de venda.
O backend revalida o recibo. Escolha fica travada enquanto há intenção incerta.
Mudança de escopo/resumo descarta confirmação e resposta tardia. Autenticação
recente exige login e outra revisão, sem execução automática no retorno.
Catálogo vazio/anual/indisponível não inventa fallback; retry de leitura é
manual.

Validação consolidada: 226 casos distintos em 19 arquivos de assinatura,
entidade, avisos/menu e entrada. Quatro falhas iniciais eram dois casos da
comparação de ordem JSON e dois casos de tabela vazia/anual mal definidos;
correções mantiveram as asserções. Os dois arquivos afetados passaram depois (39
casos), sem repetir os demais 187 já aprovados. Tipos dos 12 projetos e raiz,
lint, arch, tokens, nomes e builds web/legado passaram. A higiene retirou
somente os dois tipos agora consumidos pelo produto
(PublicPlan/ReactivateSubscriptionInput); nenhuma nova tolerância. Ratchet e
documentação também foram conferidos.

Vinte cenários Chromium no host web real passaram em 390/1440 px, incluindo
reativação, escolha da segunda oferta, foco após fechar, retry com mesma versão/
chave, histórico pago e ausência de ACTIVE presumido. As capturas foram
inspecionadas; a nova confirmação cabe nas duas larguras. APIs/identidade são
sintéticas: isso não homologa sessão real com Asaas ou aparelho. Expo continua
consulta/link, sem catálogo/faturas/compra dentro do app. Saídas em TEMP e
servidores próprios encerrados.

Uma mutação que retirou planVersionId do corpo derrubou a prova do transporte. O
fonte foi restaurado byte a byte com SHA256 conferido, e o mesmo caso passou;
essas duas execuções dirigidas não aumentam a contagem dos 226 casos distintos.

Legado, proxy, scheduler e fiscalização real off preservados. Nenhuma migration,
dependência, configuração real, commit, push, deploy ou cutover. A referência
Tailwind 287 continua aberta; não há CSS novo ou baseline visual relaxada.
S6/S11b, onboarding/backoffice, conciliação assistida, textos/planos comerciais
e homologação externa continuam parciais. Troca de plano aguarda o critério
comercial já solicitado: sortOrder e preço não foram usados como hierarquia.
Próximo corte independente: provisionamento/onboarding sobre contratos
persistidos, antes da UI pública e publicação do site. Progresso geral continua
estimativa de esforço.

## Onda 113 — HTTP autenticado e checklist de onboarding (2026-10-04, sem commit)

Três adaptadores paralelos em app/api/onboarding (caminho antigo) e
apps/services/api/src/app/api/onboarding instalam POST organizations, GET
slug-availability e GET status. A criação reutiliza o núcleo atômico da onda 112
e a única composição de plataforma em runtime/platform-jobs. As fachadas de
status dos hosts somente fornecem transação de locadora; nenhuma regra de
negócio está nos hosts. Contratos S0, assinatura, recibo e seeds são
preservados.

Sessão de conta é necessária para criação/disponibilidade. Os handlers exigem
borda app autenticada fora de development, origem exata no POST e queries
estritas; não confiam em host encaminhado ou identidade no corpo. O POST limita
JSON a 16 KiB lidos e conserva Idempotency-Key/201. O cookie host-only de
escolha é HttpOnly/SameSite=Lax/Secure em HTTPS e continua somente preferência.
Respostas compartilhadas são private/no-store/Vary Cookie, Host; erros privados
são neutralizados. O proxy existente já encaminha app e nega tenant/apex nesses
caminhos; não mudou. O inventário aceita getServerSession somente nos dois novos
caminhos exatos, com controles negativos para caminhos arbitrários e status.
Nenhuma rota anônima foi acrescentada à allowlist.

Signup real permanece off. On exige Better Auth, configuração AWS KMS/workload e
captcha, além do manifesto jurídico externo existente. Isso não atesta
permissões externas nem instala a proteção do cadastro de conta. O desafio da
criação vai ao Siteverify fixo, com hostname/action onboarding, timeout e
tamanhos limitados; não há redirect/retry automático nem persistência/log do
token. O núcleo chama essa porta somente após o contador de tentativa e antes da
transação do agregado. Recibo já confirmado revalida identidade e não repete
desafio de uso único. A prova de rejeição confirma contador persistido e nenhum
agregado parcial. A consulta de slug limita 30/minuto/IP HMAC, inclusive
contador comum sem IP, com Retry-After; duas instâncias compartilham o mesmo
orçamento.

Status do dono é independente da flag de signup. O snapshot READ ONLY existente
foi reutilizado para revalidar vínculo/organização/dono em Repeatable Read, sob
app_runtime sem BYPASSRLS. Checklist usa assinatura atual ou cancelada mais
recente, equipamento, logo/WhatsApp/cor, sitePublishedAt e
conta/integração/saúde reais. Não expõe configuração empresarial ou IDs privados
e não publica/ativa nada. Transferência de dono invalida o principal antigo.

Validação consolidada: 234 casos distintos em sete arquivos — 91 unitários de
HTTP/status/rotas/leitura de assinatura, 13 de captcha, 78 do inventário e 52 de
PostgreSQL. A primeira falha integrada foi de fixture: tentava transferir o dono
sem contexto de plataforma e o trigger recusou. A preparação passou a usar a
transação autorizada; o caso afetado passou sem relaxar o banco. O novo caso de
configuração vazia e a mudança da porta fetch tiveram reexecuções dirigidas;
essas reexecuções não aumentam a contagem.

A prova integrada percorre HTTP até a criação real, cookie e checklist sob papel
restrito, primeira inclusão de equipamento, host forjado e troca de dono.
Captcha e pré-requisitos são dublês nessa prova; não há sessão de navegador com
AWS/Cloudflare reais, homologação jurídica ou signup público certificado.
Tipagem dos 12 projetos e da raiz, lint final e gates arch/tokens/nomes/higiene
passaram. Somente SlugAvailabilityQuerySchema saiu da exceção de export sem uso
por consumo real: higiene 831 achados/242 itens, sem tolerância nova.

Os builds API e legado passaram. Dez verificações HTTP de loopback confirmaram
401 sem sessão nos três caminhos e 403 de origem cruzada nos dois hosts. A
leitura dessa primeira prova revelou ausência de headers explícitos nas recusas
iniciais de status/CSRF. Os adapters conservam corpo/status/Content-Type/Vary e
compõem private/no-store/Vary Cookie, Host somente nas rotas novas; provas
dirigidas e novo build verificam o ajuste (known issue 293). A gramática fechada
do inventário recusou um helper importado antes do gate; a composição final usa
somente Response e leitura dos headers já permitidas, sem ampliar proteções. Não
se alterou o guard global. O gate ratchet também passou contra 55763c1e. Dez
verificações finais no artefato standalone da API e no legado passaram com os
headers privados, inclusive nas recusas antecipadas. Os casos repetem a matriz
anterior e não ampliam a contagem de cenários. Tipos/lint afetados e ambos os
builds finais passaram. Servidores e cluster de teste próprios foram encerrados;
auditoria final confirmou zero PIDs/listeners próprios. Arquivos auxiliares
ficaram em TEMP.

UI, publicação de site, consumidor onboarding.welcome, cadastro de conta
protegido, homologação externa e backoffice ainda pendentes. Legado, proxy,
scheduler e flags reais continuam intactos. Nenhuma dependência/migration,
commit, push, deploy, cutover ou autorização para excluir app/. (caminho antigo)
~60% geral é estimativa de esforço, sem denominador certificado. Próximo corte
independente: consumidor durável de boas-vindas e fluxo web guiado sobre esses
contratos; publicação precisa de comando próprio protegido.

## Onda 114 — consumidor durável de boas-vindas (2026-10-04, sem commit)

O evento onboarding.welcome emitido na transação da onda 112 passa a ter
consumidor em backend/onboarding. A composição única runtime/platform-jobs
instala o tópico nos mesmos jobs dos dois hosts, com RESEND_API_KEY, FROM_EMAIL
e origem canônica existentes. A presença de chave Asaas ou de signup on não é
necessária. Configuração incompleta mantém o tópico sem consumidor, PENDING e
sem novas tentativas; não há scheduler paralelo.

A mensagem tem um destinatário: dono atual de organização ONBOARDING/ACTIVE,
ADMIN ativo, contato verificado/não descartável e sem equipe ativa. O consumidor
lê o payload persistido e vincula tenant, agregado, tópico, dedupe, worker,
tentativa e lease. Não confia no conteúdo trazido pelo dispatcher. Bloqueia
organização antes do evento também ao confirmar aceite, preservando a ordem de
locks. Não concede acesso a tabelas de negócio ao papel de plataforma.

O envelope completo e o dono são congelados em transação antes da chamada
externa. Retry conserva os cinco campos e a chave onboarding-welcome:eventId.
Renderer/envelope genéricos em communications são compartilhados com
subscriptionEmail, cuja interface e resultado permanecem compatíveis. Somente
onboarding decide destinatário/elegibilidade; runtime injeta o transporte Resend
existente, limitado a 15 segundos. Não há SMTP de locadora, novo SDK ou segunda
cópia de regra nos hosts.

Mudança de dono/endereço/conteúdo ou perda de elegibilidade persiste quarentena
e auditoria antes da falha terminal. Retry incerto com primeira tentativa há 23
horas também exige conciliação; não renova a chave automaticamente. O prazo é
conservador frente às
[24 horas do Resend](https://resend.com/changelog/idempotency-keys). Aceite do
provedor gera acceptedAt e auditoria duráveis. Se a gravação local falhar, a
retomada usa a mesma chave e o mesmo corpo. Se o recibo já existe, termina sem
novo envio. Aceitação pelo provedor não certifica entrega ao dono.

Validação consolidada: 162 casos distintos em seis arquivos, sendo 42 unitários
do consumidor/renderização/envelope/transporte, 58 no PostgreSQL de onboarding
(incluindo seis novos casos) e 62 dos jobs/notificações de assinatura
existentes. O banco usa papéis sem BYPASSRLS e o escopo real: congelamento antes
do I/O, aceite/replay, falha local pós-provedor, transferência de dono, janela
de 23 horas, duas instâncias concorrentes e conclusão pelo dispatcher. A
composição real atravessa o SDK e confere endpoint, chave, corpo e timeout com
fetch simulado; configuração vazia mantém attempts=0 e o cadastro permanece off.
Não houve envio externo real ou homologação de caixa de entrada.

Tipagem dos 12 projetos e da raiz, lint afetado, arch, tokens, nomes, higiene e
ratchet contra 55763c1e passaram; builds API/legado passaram. Higiene conserva
831 achados aceitos por 242 itens: export de tópico sem consumidor público foi
retirado, mantendo a constante usada dentro do módulo; nenhuma tolerância ou
baseline aumentou. Nenhuma migration, dependência, configuração real, commit,
push, deploy, cutover ou retirada de app/. (caminho antigo) Proxy, scheduler
real e flags permanecem como estavam.

S10 continua parcial: faltam comando de publicação e fluxo guiado S11a. Conta
protegida, backoffice, decisões comerciais já solicitadas e homologação
AWS/Cloudflare/Asaas/Resend e aparelhos permanecem pendentes. Próximo corte
independente: publicação explícita do site pelo dono com elegibilidade e locks
compartilhados; depois, UI guiada sobre contratos existentes. ~60% geral
continua estimativa de esforço, não percentual de rotas ou prova de lançamento.

## Onda 115 — comando de publicação pelo dono (2026-10-04, sem commit)

POST /api/admin/site/publish instalado no legado e no serviço, sem alterar o
proxy de clientes ou a agenda. Os adaptadores resolvem o principal e exigem
ADMIN; o módulo onboarding revalida membership ativa, organização ACTIVE,
ownerUserId atual, e-mail verificado e acesso FULL no banco. SETUP/RESTRICTED
recebem 402, ARCHIVED recebe 403; essa operação nova conserva a elegibilidade
mesmo com a fiscalização geral off. O handler exige origem exata do host app,
recusa query, lê no máximo 1 KiB e aceita corpo vazio ou objeto JSON vazio.
Locadora, timestamp e atributos de indexação não vêm do corpo. Respostas são
privadas/no-store, com Vary Cookie/Host e erros neutros.

O núcleo em modules/onboarding/site-publication.ts usa a composição única de
runtime/platform-jobs. lockTenantRentalMutations extrai exatamente o SQL
consultivo anterior de rentals/transaction.ts, sem mudar sua ordem ou
comportamento. Publicação adquire esse lock antes do lock da organização e o
mantém até o commit. O papel de plataforma não lê equipamentos: o papel de
aplicação consulta somente a contagem explícita da própria locadora em uma
transação READ ONLY. Com ao menos um equipamento, grava sitePublishedAt e
auditoria SITE_PUBLISHED juntos. Falha da auditoria desfaz a data. Repetição
revalida dono/acesso/e-mail e devolve a primeira data, sem nova auditoria; o
trigger existente torna o slug imutável depois da primeira publicação.

O recibo estrito SitePublicationResponseSchema vive em packages/contracts.
Nenhuma regra empresarial foi copiada para apps/services/api, nenhuma segunda
conexão de negócio ou de plataforma foi criada, nenhuma migration ou dependência
foi necessária. O comando não escreve siteIndexable/directoryListed nem ativa
recebimentos ou configuração real.

Validação consolidada: 277 casos distintos em nove arquivos — 81 de
contrato/núcleo/HTTP/lock, 50 de adaptadores e regressões de catálogo/locação,
68 do PostgreSQL de onboarding e 78 do inventário de segurança. Os casos de
publicação no banco usam papéis restritos sem BYPASSRLS e o escopo real:
contagem não cruza locadoras, timestamp/auditoria são atômicos, alteração de
slug é recusada e indexação/diretório permanecem false. A disputa contra a
exclusão do último equipamento usa conexões independentes e confirma no pg_locks
a espera consultiva; quando a exclusão vence primeiro, publicação recebe 409. A
composição real de runtime foi atravessada no banco, com envio de boas-vindas
ainda simulado.

O inventário inicialmente recusou a montagem de cabeçalhos com filter/join fora
de sua gramática fechada. Os adaptadores passaram a usar o ternário inerte já
existente; a proteção e suas tolerâncias permaneceram intactas. Tipagem dos 12
projetos e da raiz, lint afetado, arch, tokens, nomes, higiene e ratchet contra
55763c1e passaram. Higiene conserva 831 achados aceitos por 242 itens, sem
tolerância nova. Builds API/legado passaram.

Dezesseis verificações HTTP contra os dois servidores compilados em loopback
confirmaram POST anônimo=401, borda app genuína sem sessão=401, origem hostil,
locadora irmã e borda forjada=403; respostas de identidade são privadas/no-store
com Cookie/Host. GET/DELETE sem implementação receberam 405; OPTIONS automático
recebeu 204/Allow POST. Isso prova montagem e recusas reais, não um fluxo de
sessão autenticada em navegador ou aparelho. O sucesso autenticado foi provado
no caso de uso/composição PostgreSQL, e os adaptadores foram testados com
dublês. Os processos de validação próprios foram encerrados.

Inventário de fontes atualizado: 163 rotas/207 métodos explícitos em cada host;
presença de rota não certifica paridade geral. O legado continua ativo, sem
redirecionamento definitivo, cutover ou retirada de app/. (caminho antigo)
Cadastro público e fiscalização off, scheduler real e configurações reais
preservados; nenhum commit, push, deploy, produção ou parceiro real.

B.8/S13 continuam parciais: falta UI guiada, DELETE/despublicação preservando a
primeira publicação e comportamento público LIVE/PAUSED/OFF. O resolvedor
público atual ainda considera somente Organization.status=ACTIVE. O recibo não
certifica vitrine pública final, noindex ou lançamento comercial. Backoffice,
decisões comerciais pendentes, homologação AWS/Cloudflare/Asaas/ Resend e
aparelhos, operação, retirada do legado e Tailwind 287 permanecem. ~60% geral
continua estimativa de esforço sem denominador certificado.

## Onda 116 — primeiros passos no dashboard web/Expo (2026-10-04, sem commit)

S11b parcial: o dashboard existente monta widgets/checklist-primeiros-passos
sobre entities/onboarding e features/publicar-site. Hosts continuam finos;
contratos e fatos não foram copiados para eles. O backend revalida propriedade e
fatos. Papel ADMIN só habilita consulta; recusa de dono e ausência de assinatura
de locadora antiga escondem o widget. Ordem e passos opcionais vêm da resposta
estrita, sem calcular status comercial na UI.

Confirmação web usa AlertDialog do design system, avisa que o endereço fica
imutável e separa recebimentos da publicação. A ação envia somente objeto vazio,
impede duplo clique e não repete automaticamente pedidos incertos. Recibo válido
aciona nova leitura; somente os fatos lidos concluem a etapa. Escopo inclui
locadora, vínculo, papel, usuário, sessão e revisão do transporte. Resposta
atrasada, unmount ou troca de escopo não modifica a conta seguinte. Links de
equipamento/configuração/assinatura usam destinos existentes; a tela de
recebimentos não foi inventada.

Expo mostra os mesmos fatos e abre o dashboard do painel web com uma sugestão de
slug, sem cookie/token na URL. Não faz o POST de publicação. GET/HEAD
autenticado direto de aparelho é admitido pelo handler privado de status somente
sem Origin, Sec-Fetch-Site e nenhum dos cinco cabeçalhos x-platform-*. Qualquer
metadado de navegador ou borda fornecida conserva a validação de host app
genuíno e origem exata. Os adaptadores continuam resolvendo a sessão e o
principal; o leitor mantém ownership e RLS READ ONLY. Criação, disponibilidade e
publicação conservam as regras de origem existentes; flags reais off.

Validação consolidada: 273 casos distintos em 15 arquivos — 57 de plataforma
frontend/contratos/regressões, 50 unitários de HTTP/rotas, 69 PostgreSQL de
onboarding, 19 do host mobile e 78 do inventário de segurança. Três falhas
iniciais de sincronização em testes foram corrigidas aguardando a consulta real
e o checklist final; a reexecução dirigida de 11 casos passou e não aumenta a
contagem. Tipagem de 12 projetos e raiz, lint afetado, arch, tokens, lint:css,
nomes, higiene e ratchet contra 55763c1e passaram. O tipo público
OnboardingStatusResponse passou a ter consumo real no frontend; só sua exceção
obsoleta foi retirada, sem ampliar baselines. Higiene: 830 achados aceitos em
242 itens. Builds web/API/legado e export Android/iOS passaram.

Trinta verificações em Chrome, nas larguras 390 e 1440, usaram os componentes
reais e o CSS canônico em harness temporário. Conferiram ordem, responsividade,
aviso, foco após cancelar, confirmação explícita, recusa por e-mail, resultado
incerto, ausência de retry automático, repetição do corpo vazio, nova leitura e
pagamentos ainda pendentes. Capturas finais foram inspecionadas após a animação.
Sessão e HTTP são fixtures sintéticas: não certificam login real, publicação
autenticada em navegador ou aparelho físico. A prova PostgreSQL usa papel
restrito e percorre o handler/leitor real; não homologa o provedor.

S11a /comecar, recebimentos, S13 LIVE/PAUSED/OFF, despublicação que preserve a
primeira publicação, backoffice, decisões comerciais, aparelhos/provedores e
operação continuam pendentes. Legado, proxy e scheduler reais permanecem ativos;
nenhuma mudança em produção, commit, push, deploy ou cutover. Servidores e
navegador próprios de validação foram encerrados. ~60% geral continua estimativa
de esforço, sem denominador certificado.

## Onda 117 — opções aprovadas de onboarding (2026-10-04, sem commit)

GET /api/onboarding/options foi instalado em paralelo no legado e no serviço. Os
adaptadores finos delegam para handleConfiguredOnboardingOptions; contrato,
validação dos textos, leitura limitada de arquivos e políticas HTTP ficam no
backend compartilhado. É uma consulta anônima anterior à criação da conta, mas
exige contexto app genuíno e conserva a validação de origem exata. Host de
locadora, apex, borda forjada e origem irmã são recusados. Não há acesso ao
banco, segundo pool, chamada a provedor ou mutação.

Com signup off, o corpo estrito contém somente mode off e não lê arquivos
jurídicos ou credenciais de workload. Com signup on, exige a configuração segura
existente e confere o mapa externo de textos UTF-8 contra os metadados aprovados
de cada documento. Quatro documentos obrigatórios, marketing opcional, versão,
data e SHA-256 são preservados. O texto não é normalizado nem executado como
HTML. A resposta contém domínio raiz, chave pública do captcha e documentos;
segredos e caminhos não são publicados. Arquivo irregular, UTF-8/JSON inválido,
mais de 256 KiB, texto divergente ou documento ausente causa recusa neutra.

GET e HEAD conservam private, no-store e Vary Cookie, Host. Query não faz parte
do contrato; métodos de escrita não foram instalados. As duas entradas públicas
do inventário de segurança são exatas e limitadas ao GET, seguindo a referência
do handler compartilhado. Nenhum wildcard ou baseline foi ampliado.

Validação consolidada: 235 casos distintos em dez arquivos — 105 de plataforma,
52 unitários e 78 do inventário de segurança. Tipagem de 12 projetos e raiz,
lint afetado, arch, tokens, nomes, higiene e ratchet contra 55763c1e passaram.
Higiene permanece em 830 achados aceitos/242 itens. Builds API e legado
passaram. HTTP real dos dois hosts compilados passou em 50 verificações com
publicação sintética e signup on apenas nos processos de prova, mais 40 com
signup off. HEAD vazio, cache, hashes, conteúdo estrito, recusas de contexto,
query e métodos foram conferidos. As provas não criam conta, não acessam banco
ou parceiro, nem homologam login, captcha, aprovação jurídica ou operação
comercial. Os dois servidores próprios foram encerrados; não houve alteração das
flags reais.

Inventário de fontes: 164 rotas/208 métodos explícitos em cada host. Legado,
proxy e scheduler continuam ativos; nenhum commit, push, deploy ou cutover. Este
corte prepara S11a; /comecar ainda não foi entregue. Próximo corte: assistente
web de cadastro com conta mínima, e-mail verificado, plano vigente, textos
aprovados e criação explícita sobre os contratos existentes. Recebimentos, S13,
backoffice, aparelhos/provedores, operação e Tailwind 287 permanecem pendentes.
~60% geral continua estimativa de esforço, sem denominador medido.

## Onda 118 — conta mínima e confirmação de e-mail (2026-10-04, sem commit)

Os dois hosts montam POST /api/auth/owner-register, GET /api/auth/owner-account
e POST /api/auth/owner-verification em paralelo. As rotas só compõem sessão,
recusa antecipada de CSRF e headers privados. runtime/owner-account e
http/owner-account concentram admissão, validação e execução sobre o motor, pool
e limitadores já existentes; nenhum negócio foi copiado para o serviço.

O contrato mínimo fica na entrada existente contracts/credentials: nome, e-mail
normalizado e senha com dez caracteres no mínimo e até 72 bytes UTF-8, sem
truncamento silencioso pelo bcrypt. Nenhum telefone/documento, papel, tenantId
ou emailVerified fornecido pelo visitante é aceito. O cadastro de clientes e sua
exigência atual de telefone e CPF/CNPJ permanecem intactos. Somente o adapter
interno do servidor entra no AsyncLocalStorage da conta mínima; o hook do mesmo
motor continua recusando chamadas comuns sem esses campos. O teste concorrente
prova que o contexto não vaza entre pedidos.

A admissão exige app host genuíno, origem exata, signup on e configuração segura
e publicação jurídica válidas antes de efeitos. A flag real continua off. O
limitador persistente de cadastro antecede captcha e senha; o captcha conserva
hostname/action existentes. A consulta HIBP envia apenas cinco caracteres do
SHA-1, usa padding, recusa redirect, limita dez segundos e 128 KiB e falha
fechada com resposta neutra se o parceiro não responde corretamente. Ela é
restrita ao novo fluxo; não ativa plugins globais nem altera contas de clientes.

Cadastro responde 202 neutro e agenda o mesmo motor sem criar locadora,
assinatura, vínculo ou sessão automática. A leitura autenticada consulta
authEmailVerified do usuário atual, não infere confirmação da existência da
sessão. Reenvio aceita somente objeto vazio e envia apenas ao endereço obtido
daquele usuário, quando ainda não verificado. Usa limite silencioso de uma
tentativa por janela de minuto e o orçamento diário existente de três. Conta
verificada ou orçamento gasto conserva a resposta 202/Retry-After 60; políticas
existentes do cadastro repetido do cliente não foram alteradas.

Headers private, no-store e Vary Cookie, Host incluem recusas antecipadas. O
inventário recebeu somente duas entradas anônimas exatas de POST register; GET e
resend continuam sujeitos à sessão, e resend recusa origem cruzada antes de
lê-la. Nenhum wildcard, baseline, exclusão de teste ou tolerância foi ampliado.

Validação consolidada do bloco: 298 casos distintos passaram em 12 arquivos (71
plataforma, 116 unitários, cinco PostgreSQL e 106 segurança); quatro skips
preexistentes do arquivo de limitadores não certificam aqueles cenários.
Reexecuções dirigidas após ajustes não aumentam a contagem. O PostgreSQL local
descartável usou o motor real para criar a conta mínima, manter o cadastro de
cliente, reenviar e consumir um token de verificação e ler o fato atualizado,
com e-mail simulado. Limites persistentes foram conferidos em duas composições.
Captcha/HIBP/publicação foram dublês nas provas de composição, sem parceiro
real.

Tipos de 12 projetos e raiz, lint afetado, arch, tokens, nomes, higiene e
ratchet contra 55763c1e passaram; higiene permanece em 830/242. Builds API e
legado passaram. Os dois servidores compilados passaram em 84 verificações HTTP
com cadastro off, incluindo HEAD vazio, cache, falta de sessão, recusas de
contexto/origem e métodos. Essa prova não cria conta por navegador nem homologa
captcha, HIBP, e-mail, cookies ou operação externa.

Inventário confirmado: 167 rotas/211 métodos explícitos por host. Processos
próprios de prova e PostgreSQL foram encerrados. Flags reais, legado, proxy e
scheduler preservados; nenhum commit, push, deploy, cutover ou produção. Próximo
bloco: tela web /comecar com conta mínima, confirmação, plano vigente, textos
aprovados e criação explícita pelos contratos já instalados. Expo permanece
limitado a estados e link do painel. Recebimentos, S13, backoffice,
aparelhos/provedores, operação e Tailwind 287 seguem pendentes; ~60% geral é
estimativa de esforço, não conclusão medida pela contagem de rotas.

## Onda 119 — assistente web de cadastro (2026-10-04, sem commit)

S11a ganhou a página /comecar no host app. O host monta rota/metadata privados,
normaliza o retorno do login existente e fornece o adapter de captcha do
navegador. A jornada fica em pages/onboarding (FSD), sobre contratos e APIs já
instalados. Catálogo mensal foi reunido em entities/plano e é reutilizado pela
reativação de assinatura, sem import entre páginas ou nova regra no serviço.

As sete etapas seguem B.8: conta mínima, confirmação lida do servidor, empresa,
endereço, plano, aceites aprovados e criação explícita. Textos são escapados e
checkboxes começam desmarcados. Valores comerciais vêm do catálogo atual; o
cliente não fixa preço, plano ou prazo de teste. Identidade delimita rascunhos e
pedidos: callbacks antigos não repõem dados nem limpam aceites da nova sessão.
Reenvio conserva a janela do servidor, inclusive chamadas imediatas duplicadas.

Rascunho local separado por usuário guarda apenas dados da empresa/escolhas. Não
guarda senha ou token de captcha. Corpo confirmado e chave são persistidos antes
da criação para permitir retomada de uma entrega incerta sem gerar outro pedido.
Recarregar não reenvia automaticamente; edição fica bloqueada até confirmação
manual com novo desafio. Recibo limpa a chave desse dono e oferece o painel, sem
publicar, ativar recebimentos ou navegar sozinho. Links de confirmação e reenvio
do dono voltam a /comecar; cadastro comum de clientes preserva seu corpo e
callback anterior. Nenhuma entrada HTTP nova ou mudança de scheduler/proxy.

O adapter web usa renderização explícita e remove somente seu próprio widget;
expiração/erro descarta o token e oferece nova verificação. A integração segue
as
[instruções oficiais do Turnstile](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/).
Tokens não entram no rascunho. O provider SDK foi simulado nas provas; isso não
homologa Cloudflare ou configuração externa.

Validação consolidada: 117 casos distintos em dez arquivos passaram (21
plataforma, 11 host web, 80 unitários e cinco no PostgreSQL descartável).
Reexecuções dirigidas não aumentam a contagem. O motor real confirmou o retorno
ao assistente e a manutenção do cadastro comum, com e-mail simulado. Tipos de 12
projetos e raiz, lint afetado, arch, tokens, nomes, higiene e ratchet contra
55763c1e passaram. Higiene 829/242: somente a exceção obsoleta OnboardingStep
saiu porque o modelo do produto agora consome o tipo; nenhuma tolerância foi
ampliada. Zero css-important e inventário 167/211 por host preservados.

Builds web/API/legado passaram. Ambos os backends compilados passaram em 84
verificações HTTP com cadastro off. Chrome local fez 40 verificações da página
compilada, incluindo estado fechado pelo proxy/API reais, noindex, 404 no apex e
tenant, registro mínimo, confirmação, formulários, aceites, erro incerto,
reload/retry com mesmo corpo/chave e captcha novo. O fluxo on e login/captcha
nessa prova são fixtures de navegador; nenhuma conta ou empresa foi criada pelo
teste no navegador. Capturas de empresa, termos e recibo foram inspecionadas no
viewport desktop. Iniciar a fixture em localhost conserva o rewrite interno do
Next (entrada 244); todos os processos próprios e o banco de prova foram
encerrados ao final.

Cadastro real e enforcement permanecem off; API legada, proxy e scheduler
continuam ativos. Não houve commit, push, deploy, cutover ou produção. Próximo
bloco: configuração guiada de recebimentos sobre APIs existentes. S13,
backoffice, hierarquia comercial ainda não decidida, aparelhos/provedores,
operação, retirada segura do legado e paridade Tailwind 287 seguem pendentes.
Geral ~60% continua estimativa de esforço, sem denominador certificado.

## Onda 121 — conexão inicial de conta própria (2026-10-04, sem commit)

Os dois hosts montam POST /api/admin/payment-account/connect e delegam para o
mesmo handler/runtime. Os adapters só compõem identidade, papel ADMIN e headers
privados. O caso de uso mora em modules/payment-accounts; o transporte de
consulta é do módulo billing e usa o cliente Asaas existente. Não foi criado
pool, scheduler, motor de identidade ou regra comercial paralelos no serviço.

O contrato de entrada continua estrito, apenas apiKey; a resposta aditiva contém
somente accepted=true. Ambiente vem da configuração do servidor. App host e
origem exata são obrigatórios, inclusive em desenvolvimento; query, campos
extras, corpo maior que 16 KiB e sessão sem autenticação recente são recusados.
Headers private/no-store/Vary Cookie, Host também cobrem retornos antecipados.
Credencial e erros internos não aparecem no recibo.

Antes da consulta externa, a transação de plataforma revalida ADMIN ativo,
proprietário atual, e-mail confirmado, sessão recente, organização não arquivada
e CNPJ consistente. O provedor é consultado fora da transação por GET nos
endpoints documentados de dados comerciais e situação cadastral. Só CNPJ e
estados conhecidos são retidos. O CNPJ retornado deve corresponder ao da
locadora. status.id não é tratado como identificador da conta.

A autorização e o documento são conferidos novamente sob o lock da organização
antes de gravar integração, segredo cifrado, conta e auditoria atomicamente.
Repetir a mesma chave nessa conta usa fingerprint HMAC e não duplica registros;
chave já usada por outra locadora causa recusa e rollback. Integração legada ou
outra conta existente não é substituída silenciosamente. Nenhuma política, grant
ou migration foi acrescentado.

O resultado inicial é RESTRICTED/WEBHOOK_MISSING, com integração PROVISIONING.
Não há approvedAt, documentVerifiedAt, providerAccountId ou walletId inventados.
accepted=true é recibo de conexão inicial, não aprovação de recebimentos.
Configuração de webhook, saúde recorrente, identificação final, conclusão da
conexão e interface do dono ainda faltam. O comando não cria conta, chave ou
webhook no Asaas e não ativa cobrança. A consulta do dono e o painel entregues
na onda 120 continuam disponíveis.

Validação consolidada: 312 casos distintos em 12 arquivos passaram — 161
unitários, 56 de plataforma, 17 PostgreSQL e 78 do inventário de segurança.
Reexecuções dirigidas não aumentam a contagem. O PostgreSQL descartável usou
papéis restritos reais e provou concorrência, atomicidade, rollback, revogação
do dono durante o I/O e recusa da conexão empresarial no escritor de plataforma.
As duas fixtures antigas corrigidas estão na entrada 296 de known-issues.
Consulta Asaas foi simulada; não há homologação de parceiro.

Tipos de 12 projetos e raiz, lint afetado, arch, tokens, nomes, higiene e
ratchet contra 55763c1e passaram. Higiene fica em 823 achados/242 itens aceitos:
somente duas exceções obsoletas de exports agora usados em produção saíram;
nenhuma tolerância foi ampliada. Zero css-important. Builds API e legado
passaram. Dez requisições reais nos dois hosts compilados conferiram 401
privado, ausência de eco da chave, 405, OPTIONS e compatibilidade da leitura
existente. A primeira inicialização da prova não tinha o segredo local de
sessão; após fornecer um segredo sintético aos processos próprios, as recusas
esperadas passaram. Essa prova não certifica login real ou conexão com Asaas.

Inventário AST confirmado: 169 rotas/213 métodos explícitos em cada host, sem
usar contagem como prova de paridade funcional completa. Servidores próprios e
banco de prova foram encerrados. Flags reais de cadastro/enforcement, API
legada, proxy e scheduler preservados; nenhum commit, push, deploy, cutover ou
produção. Próximo corte: configurar e conciliar os eventos da conta conectada,
com recibo durável e falha fechada, antes de expor a conexão guiada ao dono. S9
continua parcial; S13, backoffice, decisão comercial pendente, homologação
externa, operação, retirada segura do legado e Tailwind 287 ainda faltam.
Progresso geral ~60% permanece estimativa de esforço.

## Onda 122 — configuração e inspeção da conta conectada (2026-10-04, sem commit)

O runtime compartilhado instala payment-accounts.health nos crons existentes,
com cofre, origem de webhook, e-mail operacional e ambiente configurados.
Payment-accounts guarda lease/intenção, billing usa a credencial scoped para
GET/POST/PUT e secrets deriva autenticação recuperável com contexto. Só o hash
vai à integração; job, auditoria e projeção pública não contêm chave ou token.
Nenhuma rota, pool ou scheduler foi acrescentado aos hosts.

O worker revalida CNPJ e vínculo, confirma a configuração própria por escrita e
releitura completas e reinspeciona em 24 horas. Todo I/O acontece fora de SQL.
Timeout/criação incerta não autoriza repetir POST; retomada usa o webhook
encontrado e PUT da mesma autenticação. Webhooks de terceiros não são alterados.
Fila interrompida e webhook ativo desaparecido exigem reconciliação financeira,
ainda pendente. Falhas incidentais, indisponibilidade da chave e eventos de
saúde não apagam a intenção ou essa exigência. Aprovação exige os quatro estados
atuais coerentes; sem inferir providerAccountId ou walletId a partir da
situação.

Validação consolidada: 230 casos distintos em 13 arquivos — 46 unitários, 53 de
plataforma, 53 PostgreSQL e 78 do inventário de segurança. Reexecuções dirigidas
não aumentam a contagem. Papéis reais sem BYPASSRLS provam isolamento, rollback,
concorrência, intenção durável, cofre recriado, proteção contra bloqueio/rotação
e integração da composição com os dois cron adapters. Transporte Asaas simulado
em todas essas provas; nenhum parceiro real foi acionado. Entradas 297–298
registram a recuperação e a correção da aprovação contraditória.

Tipos de backend, serviço e raiz, lint afetado, arch, tokens, nomes, higiene e
ratchet contra 55763c1e passaram. Nenhuma tolerância foi ampliada; higiene
permanece em 823 achados/242 itens aceitos, nomes em 616 testes colocados e zero
css-important. Markdown, formatação, links e whitespace também passaram. Builds
finais API e legado passaram; dez requisições reais nos dois hosts compilados
confirmaram recusas privadas, ausência de eco da chave, 405, OPTIONS e leitura
compatível. Essa prova não certifica login real ou escrita no Asaas. Inventário
AST permanece em 169 rotas/213 métodos explícitos em cada host, sem usar
contagem como prova de paridade funcional completa. Servidores próprios e banco
de prova foram encerrados.

S9 continua parcial: reconciliação financeira, identidade externa final, conexão
guiada, subcontas BaaS, confirmação anual, documentos e saque permanecem
pendentes. S13/backoffice, decisão comercial aberta, homologação de parceiros,
KMS/IP de produção, operação, retirada segura do legado e Tailwind 287 também
faltam. Flags reais de cadastro/enforcement, API legada, proxy e scheduler
preservados; nenhum commit, push, deploy, cutover ou produção. Progresso geral
~60% continua estimativa de esforço, sem denominador certificado.

## Onda 123 — reconciliação financeira da fila (2026-10-05, sem commit)

O runtime existente instala em sua configuração de conta própria uma porta de
recuperação financeira. Payment-accounts grava o incidente e a restrição no
papel de plataforma; billing consulta e aplica fatos com o papel de negócio, RLS
e lock existentes. Não há nova rota, scheduler, pool, migration ou grant. Os
dois crons continuam delegando à mesma composição.

Até cinco tentativas são lidas por entrega. O cursor por incidente/chave e o
limite temporal da fotografia ficam na auditoria da locadora; falha de rede
retoma a tentativa pendente. Leitura externa ocorre fora de SQL e não usa a
chave raiz. A variante estrita preserva o leitor legado por padrão, recusando
estados incertos, modalidade divergente, assinatura, valor ou data sem prova.
Depois do I/O, vínculo atual, referência, tentativa e obrigação precisam
continuar válidos. Pagamento vigente usa o processador/outbox existentes;
pagamento antigo exige revisão, cancelamento não apaga a obrigação e estorno
preserva o histórico. Efeito e checkpoint são atômicos.

Validação consolidada: 251 casos distintos em dez arquivos, sem novos skips — 51
unitários, 45 de plataforma, 77 PostgreSQL e 78 de segurança. Banco descartável
com papéis sem BYPASSRLS prova ausência de acesso cruzado, proibição de leitura
financeira ao papel de plataforma, retomada de páginas, falha do checkpoint,
pagamento antigo, cancelamento/estorno e alteração de chave ou vínculo durante
I/O. A composição real e ambos os cron adapters foram exercitados com cofre,
dois papéis e transporte Asaas simulado. Fixtures novas foram corrigidas para
usar o contexto de plataforma autorizado e os campos reais da conta; nenhuma
política foi afrouxada.

Tipos backend/API/raiz, lint afetado, arch, tokens, nomes, higiene, ratchet,
formatação/Markdown/links e builds API/legado passaram localmente. Não há nova
prova HTTP pública/visual neste bloco de jobs; as provas de socket da onda 122
permanecem históricas. Nenhuma baseline ou tolerância foi ampliada.

Uma fotografia completa não é autorização de reativação. Ela cobre tentativas
vinculadas até seu limite temporal; dados posteriores, legados não vinculados e
divergências ainda exigem revisão e uma reconciliação final atualizada. A fila
permanece bloqueada até comprovar a correção e entrega no endpoint real. O Asaas
orienta corrigir a causa antes de reiniciar e verificar novas entregas após a
reativação.
[Procedimento oficial](https://docs.asaas.com/docs/como-reativar-fila-interrompida).
Próximo corte: recuperação guiada com essas provas e ligação da conexão no
painel. S9, BaaS, S13/backoffice, homologação externa, decisões comerciais e
retirada segura do legado continuam pendentes. Legado, proxy/scheduler e flags
reais preservados; sem commit, push ou produção. Geral ~60% continua estimativa.

## Onda 124 — formulário de conexão própria (2026-10-05, sem commit)

A página FSD recebimentos-admin liga o POST inicial existente ao painel web. Não
cria rota, regra, integração ou configuração nos hosts. A entidade de consulta
expõe seu escopo opaco e slug para compor a ação e o retorno de login
existentes. Só ausência confirmada habilita o formulário; conta atual continua
consulta, sem substituição de acesso.

A chave fica no campo mascarado, sem estado persistido, storage, URL ou intenção
de retry. É apagada antes de enviar, ao cancelar, trocar escopo/transporte,
reconsultar, desmontar ou sair da página. O POST privado usa o contrato estrito
existente e no-store; envio simultâneo é recusado localmente. Resposta tardia é
descartada. 202 apenas confirma aceite e causa nova consulta. Autenticação,
CNPJ, e-mail e conflitos têm mensagens locais; transporte e payload do provedor
não entram no erro apresentado. Resultado incerto não retém chave nem reenvia.

Validação: 135 casos de plataforma em cinco arquivos e 67 unitários existentes
em cinco, mais 26 testes de secrets-database no PostgreSQL descartável — 228
distintos, onze arquivos, sem novos skips. Tipos frontend web/native e hosts
web/mobile, lint afetado, arch (993/1050), tokens (css-important zero), nomes
(618, três exceções anteriores), higiene (823/242) e ratchet passaram. Builds
web e legado final passaram; o primeiro build legado mostrou fallback de sitemap
com banco desligado e foi repetido com o banco descartável disponível.

Chromium na página compilada, com sessão e API sintéticas, passou 28 checks de
interface: desktop e 390 px, foco, máscara, cancelamento, aceite distinto de
aprovação, falha incerta, consulta sem retry e ausência de overflow/erros.
Quatro checks HTTP de recusa/cache passaram. O teste separado do proxy ficou
`observado: 403, esperado: 401, passed: false`; chamada direta com borda válida
chega ao 401. Não há prova completa do envio autenticado pelo proxy. A entrada
300 registra a diferença sem atribuir causa ainda não comprovada. Reinício
auxiliar foi bloqueado pela revisão automática; não houve contorno.

Servidores e PostgreSQL próprios são encerrados após o ensaio. Nenhuma conta
real, flag, baseline, grant ou produção foi alterada. Legado/proxy/scheduler
ativos; Expo conserva estados/link. Próximo corte é fechar essa prova de
integração mantendo origem exata, seguido da recuperação guiada de fila,
BaaS/S13 e aceites externos. Geral ~60% permanece estimativa de esforço.

## Onda 125 — transporte da prova de recebimentos (2026-10-05, sem commit)

A diferença 403/401 registrada na onda 124 veio da sonda: fetch do Node 24
substituía o Host informado pelo authority loopback, sem mudar Origin. Um eco
local confirmou o que chegava na rede. O helper requestWeb, já existente em
tests/api-host/web-consumer.ts, usa http.request e conserva ambos. Não houve
correção no proxy, no guard de origem, no contrato nem na regra de negócio.

Dois testes novos tornam a prova permanente:

- tests/unit/web-consumer-transport.test.ts verifica Host/Origin, cookie, método
  e corpo no servidor HTTP local, em vez de inspecionar opções de fetch.
- tests/api-host/owner-payment-account.http.test.ts usa a infraestrutura
  existente: Next web compilado, destinos legado/serviço compilados, ponte TLS
  local e PostgreSQL descartável. Vinte casos passaram no modo legacy e vinte no
  Better Auth, sem skips. GET privado e POST coerente chegam ao 401 sem sessão;
  origem irmã/null e metadados same-site permanecem recusados. Borda forjada não
  controla a origem. Uma sessão emitida pelo motor é lida pelo proxy; seu
  vínculo CLIENT impede a operação apesar do papel global ADMIN.

A verificação inicial esperava 403 para o POST anônimo sem Origin e com
Sec-Fetch-Site same-origin. O código existente passa esse caso pelo guard
central e recusa primeiro por ausência de sessão (401); a caracterização agora
registra essa ordem. O comando do dono continua exigindo Origin após identidade,
protegido pela suíte unitária existente. Nenhuma expectativa anterior ou
proteção de produção foi removida.

Dezessete testes unitários em três arquivos passaram, incluindo os adapters da
conexão. Typecheck da raiz, lint afetado, arch (993/1050), nomes (618 com três
exceções anteriores), higiene (823/242), formatação e documentação passaram.
Builds não foram repetidos: nenhum fonte/configuração de produção mudou, e a
suíte exercita seus artefatos compilados. Os dois testes novos são a única
alteração de código desta onda; não há mudança de grants, baselines ou flags.

Limites: o HTTP real comprova transporte e recusas com sessão local, não o
aceite 202 de uma chave do dono pelo proxy. Não chama Asaas, nem certifica
cofre/KMS/IP de produção, aprovação comercial ou dispositivo. Os 28 checks
Chromium da onda 124 continuam sendo interface com fixtures. Servidores de teste
e PostgreSQL próprios foram encerrados. API legada/proxy/scheduler ativos; sem
commit/push/deploy/produção. Próximo corte: fechar o aceite local do dono com
cofre e provedor sintético, seguido da recuperação guiada e dos aceites
externos. Geral ~60% permanece estimativa de esforço, sem denominador medido.

## Onda 126 — aceite do dono com cofre e HTTP real (2026-10-05, sem commit)

O comando existente de conexão própria agora tem prova integrada pelo proxy web
compilado para ambos os backends, com sessões emitidas por NextAuth ou Better
Auth. O serviço é iniciado pelo entrypoint standalone gerado no build. Não foi
necessário mudar código, composição ou contrato de produção.

Arquivos novos: tests/api-host/receiving-account.ts e
tests/api-host/owner-payment-account-connect.http.test.ts. A fixture gera um
banco descartável próprio, executa prisma migrate deploy e instala os scripts
canônicos de app_runtime e platform_runtime com nomes próprios. Os hosts HTTP
usam os papéis restritos; o administrador só prepara e observa a fixture. Não há
alteração de grant/política em banco existente. Banco, papéis, cookies e
processos próprios são removidos ao final.

O cofre existente usa KEK sintética de ambiente permitida no piloto. Um preload
somente dos filhos redireciona as duas leituras fixas do sandbox Asaas para um
servidor loopback; o guard de rede já existente bloqueia outras chamadas
externas. O provedor não aceita escrita nem chave real. Respostas e auditoria
são verificadas sem conter a chave; os registros de chamadas guardam apenas
índice da fixture, método e caminho.

O dono atual com vínculo ADMIN, e-mail verificado e sessão recente recebe 202
com o recibo estrito. Conta, cifra e auditoria são persistidas; a conta continua
RESTRICTED/WEBHOOK_MISSING, a integração PROVISIONING, sem approvedAt nem
identidade de conta inventada a partir do id de situação cadastral. Repetições
concorrentes da mesma chave conservam um registro/auditoria e não fazem outro
GET ao provedor. Seleção por cookie real funciona; conflito de cabeçalho/cookie,
CNPJ diferente, origem irmã, ambiente no corpo, ADMIN que não é dono e troca de
chave são recusados. Leitura por outra locadora não expõe a conta; o papel da
plataforma não pode ler pagamentos de negócio.

Validação final consolidada:

- 38 casos HTTP em dois arquivos passaram em legacy e 38 em Better Auth. São 18
  casos novos mais os vinte de recusa da onda 125, por motor; 76 execuções, sem
  apresentá-las como 76 contratos distintos.
- 32 unitários associados passaram em quatro arquivos de comando, adapter,
  montagem e transporte. Não foram reexecutados a cada edição.
- Tipos dos dois arquivos novos foram verificados por configuração temporária
  fora do repositório, pois o tsconfig da raiz exclui testes. Lint afetado,
  arquitetura, nomes, higiene e ratchet passaram sem alteração de baselines.
- A tentativa paralela dos motores no mesmo banco pai falhou no setup legado com
  tuple concurrently updated durante GRANT USAGE ON SCHEMA public, antes de
  executar testes. A execução final foi sequencial; nenhuma regra ou asserção
  foi relaxada para contornar a disputa de catálogo.

Nenhum build foi repetido, pois fontes/configuração de produção não mudaram; os
artefatos existentes foram exercitados por HTTP. A prova não é uma sessão de
interface completa em aparelho, nem homologação Asaas, KMS/IP de produção ou
aprovação comercial. O Chromium da onda 124 continua sendo interface com
fixtures. API legada, proxy/scheduler e flags reais permanecem ativos. Sem
commit, push, deploy, cutover ou produção.

Próximo corte: recuperação guiada de fila com conciliação final e provas de
correção/entrega, sem liberar pela fotografia financeira. BaaS,
documentos/saque, S13/backoffice, decisões comerciais abertas, homologação
externa, aparelhos, retirada segura do legado e Tailwind 287 permanecem. Geral
~60% continua estimativa de esforço, sem denominador certificado.

## Onda 127 — recuperação guiada de recebimentos (2026-10-05, sem commit)

GET/POST /api/admin/payment-account/recovery são adapters do mesmo núcleo em
payment-accounts/runtime. Inventário AST: 170 rotas/215 métodos explícitos por
host, iguais. Contratos antigos permanecem; o legado não foi redirecionado ou
retirado.

O consumidor grava recibos sanitizados de progresso/bloqueio ligados ao
incidente/chave. GET projeta apenas estado, contagem, data e disponibilidade,
sob papel de plataforma isolado e READ ONLY. Não lê pagamentos nem decifra
segredos. POST exige sessão recente do motor, origem app exata e dono atual;
locks revalidam vínculo, conta e chave. Outbox existente conserva leases e
nextAttemptAt; concorrência não duplica pedidos. Intenção concluída não engole
novo pedido explícito. Nenhum I/O externo ocorre no HTTP, nenhum grant mudou.

O painel confirma/cancela, consulta manualmente e descarta respostas de outro
escopo. Resultado incerto não repete POST. SNAPSHOT_COMPLETE conserva restrição:
fotografia financeira não certifica correção da entrega ou liberação da conta.
Revisão, nova fotografia final, retomada autorizada e novas entregas continuam
pendentes, assim como BaaS, S13/backoffice e homologação.

Validação consolidada local:

- 38 unitários de recuperação/configuração/rotas e 31 anteriores de conexão
  aprovados; 91 casos de contratos/painel e 51 de saúde/financeiro PostgreSQL.
- Inventário de autenticação: 78 casos aprovados. Tipos dos doze projetos, raiz
  e arquivos novos; lint afetado, CSS, tokens, arch, nomes, higiene, ratchet
  --base 55763c1e e builds legado/API/web aprovados.
- HTTP compilado: 44 casos aprovados em cada motor (legacy e Better Auth), com
  proxy, serviço standalone, sessões e papéis canônicos isolados. Inclui seis
  novas provas de recuperação e 38 anteriores por motor.

Provedor e credenciais sintéticos, destinos loopback e banco descartável. Não
houve Asaas real, produção, cutover, commit ou push. Geral ~60% permanece
estimativa, sem denominador certificado. Aposentar a raiz exige aceite
operacional e autorização de troca de consumidores/jobs.

## Onda 128 — nova fotografia de recebimentos (2026-10-05, sem commit)

O pedido confirmado após a conclusão cria um incidente OWNER ligado ao anterior.
O job confere novamente pagamentos e inclui emissões posteriores no corte atual.
Conferência incompleta mantém cursor; inspeção PENDING usa a agenda já
existente, sem antecipar availableAt ou nextAttemptAt. PROCESSING e lease
vigente impedem troca. Locks serializam pedidos/claims, e
incidente/auditoria/fila são atômicos. Resultados tardios de incidente
substituído não publicam recibos atuais.

O painel explica nova consulta e histórico antes da confirmação. Após aceite,
GET exibe WAITING/zero até o recibo do novo ciclo; histórico antigo permanece.
Não há regra duplicada nos hosts, nova rota ou método, grant ampliado ou
baseline alterado nesta onda. Inventário AST continua igual: 170 rotas e 215
métodos explícitos por host. API legada, proxy, scheduler e flags reais ativos.

Validação consolidada local: 75 unitários de recuperação/configuração/conexão,
92 de contratos/painel, 54 de saúde/financeiro PostgreSQL e 78 de inventário de
autorização passaram. Banco usa papéis canônicos: estorno posterior e emissão
após corte são recuperados no job real; claim bloqueia troca e falha da
auditoria reverte novo ciclo/fila. Tipos dos doze projetos, raiz e testes
afetados, lint, CSS, tokens, arch, nomes, higiene, ratchet e três builds
passaram. Formatação, markdown e links verificados. Resultado HTTP final é
registrado abaixo.

Runbook em
[operations/runbook-asaas-webhooks.md](../operations/runbook-asaas-webhooks.md)
separa fotografia financeira, reparo e entregas. Ele não autoriza nem executa
retomada. Homologação externa, comando final de retomada/liberação, BaaS,
documentos/saque, S13/backoffice e retirada operacional do legado permanecem.
Não houve provedor real, alteração de produção, commit, push ou cutover. Geral
~60% permanece estimativa aproximada sem denominador certificado.

HTTP pelo proxy real: 46 casos por motor passaram (legacy e Better Auth), para
os dois backends. A fixture de conexão/recovery usa o legado compilado, serviço
standalone compilado, papéis canônicos, cofre e sessões reais locais. A execução
Better Auth usa também os hosts de produção no setup geral. A primeira execução
legacy usou dev somente no setup geral das recusas antigas; a fixture nova
permaneceu compilada. Os vinte casos de recusa também passaram separadamente com
legacy/service de produção antes do fechamento do bloco. Provedor sintético
loopback; nenhuma escrita Asaas real. Componente testado em jsdom, sem nova
sessão Chromium/aparelho neste bloco.
