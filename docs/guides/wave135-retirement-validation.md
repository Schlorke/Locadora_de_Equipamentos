# Onda 135 — checkpoint da base preparada após F

**Alcance histórico das referências:** `.next`, `next-env.d.ts` e
`tsconfig.tsbuildinfo` da raiz foram retirados no Bloco F; os relatos
preservados registram a estrutura antiga e os resultados da época, sem instruir
recriar esses artefatos na raiz atual.

## Fechamento atual do código no clone — 10 de outubro de 2026

O fechamento 1003 encerrou os três passos exit 0; a nova unit tem recibo
próprio. Os checkpoints RED/pending abaixo são históricos; contagens sobrepostas
não são somadas. O ledger vincula os recibos e logs atuais por SHA-256; nenhum
horário de processo é inferido do filesystem. Aplicação, formatação e gates
afetados deste complemento ainda exigem recibo posterior. Validação no diretório
original, publicação F e CI F são posteriores, em recibos externos.

| Prova atual              | Resultado               | Arquivos |  Duração | Exit |
| ------------------------ | ----------------------- | -------: | -------: | ---: |
| Nova unit integral       | 4.104/4.104, zero skips |      179 | 406,99 s |    0 |
| Gates do fechamento 1003 | 12 comandos             |        — |        — |    0 |
| Regressões dos gates     | 324/324                 |       14 |  97,30 s |    0 |
| OpenAPI estrito          | 13/13                   |        1 |  33,79 s |    0 |

## Checkpoint pós-aplicação — 10 de outubro de 2026

A coorte V7 foi aplicada em 2026-10-10T02:13:43.030341+00:00 e sua formatação
encerrou exit 0 em 2026-10-10T02:14:50.440747+00:00. A conferência externa
`reviews/retirement-v7-post-format-history-proof.json` conserva os seis blocos
históricos por bytes exatos, o bloco de testing após somente CRLF→LF e os dois
documentos C por bytes exatos. Os recibos são eventos separados das provas de
código abaixo.

A tentativa `final-documentary-closure-20261010T0216` executou `final-gates`
entre 2026-10-10T02:14:55.8062286Z e 2026-10-10T02:19:07.3073770Z e encerrou
exit 1. O log `check-tokens.log` registrou zero definições hex de orange600: o
leitor aceitava somente aspas duplas, enquanto `primitives.ts` continha
`orange600: '#ea580c'` após formatação. O hex canônico permaneceu `#ea580c`;
esse resultado RED não reclassifica as provas verdes anteriores.

O executor aplicou em 2026-10-10T09:40:51.957148+00:00 a correção mínima de
`tools/token-propagation-check.mjs`: aspas simples ou duplas com fechamento
correspondente e hex no grupo 2. O gate real posterior
`token-quote-gate-20261010T0941` passou exit 0 em 5,20 s, conforme saída e
duração observadas pelo executor, sem inferir timestamp exato de início. O log
confirma `previous: #ea580c`, arquivo e árvore canônicos intactos, alias
temporário aplicado, propagação nativa e nenhuma outra assertion falha.

O Vitest interno conserva 10 passes e uma assertion de propagação web
deliberadamente vermelha: o Button.web usa classes literais e não contém a
sentinela. O gate exit 0 resulta da concordância com as expectativas existentes.
Os três níveis NOT_PROVEN — estilo web, render web e export mobile — continuam
declarados. Não se promove essa execução a propagação web ou export mobile.

A exigência de definição única, a sentinela só na cópia temporária, os hashes de
integridade e as expectativas permanecem estritos. Estilos do produto, oracle,
referência visual, baselines e skips não mudam por essa correção. A nova rodada
global de gates e regressões existentes ainda está pendente; o ledger vincula os
recibos RED e verde por SHA-256. Nenhum fechamento global futuro, commit/push F
ou CI final é antecipado.

A full unit posterior à correção, `final-unit-after-token-quote-20261010T0945`,
encerrou em 2026-10-10T09:51:08.3530158Z com exit 1: 4.103 passes e uma falha,
178 arquivos aprovados e um falho dos 179, sem skips, em 391,15 s. A única falha
foi a leitura de quatro referências históricas em `retired-artifacts`: duas no
handoff, uma neste guia e uma no ledger. O checker de tokens verde não é
promovido a full unit verde. O candidato documental acrescenta legendas factuais
de alcance histórico; os trechos, raw blocks, regras do detector, assertions,
oracle e baselines permanecem. A nova full unit e o fechamento global continuam
pendentes de recibos reais.

## Histórico preservado — checkpoint de 9 de outubro de 2026

Checkpoint local de **9 de outubro de 2026**, America/Sao_Paulo. Os últimos
recibos usam UTC de 10 de outubro. A etapa C permanece publicada em
[978ceb9244c81c7cb2888b798fad8ce90edad25e](https://github.com/Schlorke/Locadora_de_Equipamentos/commit/978ceb9244c81c7cb2888b798fad8ce90edad25e),
com a tag `checkpoint/onda-135-pre-exclusao`. O
[relatório C](wave135-base-validation.md) fica histórico. Este suplemento
registra a base preparada no clone local após a retirada F, em um **checkpoint
anterior à publicação**. A full unit passou 4.104/4.104 sem skips; P2 formal,
B11 fresh e visual também estão fechados no escopo abaixo. Os gates documentais
ocorrerão após aplicar este texto. Commit/push, transferência/revalidação e CI
final F são passos posteriores, com recibos externos; nenhum SHA ou evento
futuro é antecipado aqui. Infraestrutura hospedada, banco de produção e
provedores serão escolhidos depois conforme o usuário; migrations locais não
provisionam conta ou banco de produção. O
[ledger](wave135-retirement-validation.ledger.json) guarda os eventos, hashes,
builds, exits e limites separadamente.

## Resultados atuais por evento

| Prova pós-F                           | Aprovados | Falhas | Skips | Arquivos aprovados |  Duração | Exit |
| ------------------------------------- | --------: | -----: | ----: | -----------------: | -------: | ---: |
| Unit final integral                   |     4.104 |      0 |     0 |                179 | 346,88 s |    0 |
| Gates focais                          |       324 |      0 |     0 |                 14 |  80,21 s |    0 |
| Detectores security selecionados      |       121 |      0 |     0 |                  2 |  45,72 s |    0 |
| Controles tenant sem DB               |        32 |      0 |     8 |                  1 |  11,94 s |    0 |
| Integração                            |        42 |      0 |     0 |                 13 | 102,09 s |    0 |
| API, raiz física ausente, legacy      |     2.400 |      0 |     1 |                 64 | 170,88 s |    0 |
| API, raiz física ausente, Better Auth |     2.398 |      0 |     0 |                 64 | 200,82 s |    0 |
| Tenant hosts, legacy                  |         7 |      0 |     0 |                  1 |   6,06 s |    0 |
| Tenant hosts, Better Auth             |         7 |      0 |     0 |                  1 |   5,25 s |    0 |
| Jornadas finais, legacy               |         7 |      0 |     2 |                  1 |  34,39 s |    0 |
| Jornadas finais, Better Auth          |         8 |      0 |     1 |                  1 | 105,71 s |    0 |

Lint também terminou exit 0 no recibo serial. As contagens podem compartilhar
casos: não são um total de testes únicos. Skips são coletados sem execução. Os
oito skips tenant pertencem ao bloco com DB, desligado nesta rodada sem DB; sua
aprovação não é inferida. As jornadas mantêm as condições específicas do motor e
os braços de cadastro mutuamente exclusivos.

A integração C tinha 65 execuções: duas instâncias físicas de 23 casos mais 19
casos restantes. F mantém uma instância canônica dos 23 e os mesmos 19,
resultando em 42. A comparação registrada preserva os corpos de casos,
assertions e fixtures da instância canônica após normalização apenas de EOL; não
remove o motor de autenticação legacy nem reduz seu contrato de serviço. A
primeira tentativa falhou no setup, antes dos casos, porque o servidor API não
estava compilado. O retry 42/42 é um evento separado.

## Compilações e navegação nos dois motores

O recibo final de navegação encerrou quatro etapas exit 0, em sequência:
compilar web legacy, executar suas jornadas, compilar web Better Auth, executar
suas jornadas. As identidades dessa sequência final de navegação são:

| Motor       | Web BUILD_ID final      | API BUILD_ID            |
| ----------- | ----------------------- | ----------------------- |
| Legacy      | `su5TP01nn7yVwD5T1o223` | `1fUqYvXf7UEjYiTV-Kddl` |
| Better Auth | `hL116oKB5L8ARlqFZExQA` | `1fUqYvXf7UEjYiTV-Kddl` |

Os jobs API e tenant anteriores usaram respectivamente web
`rEF56biJkNQNEpGWPkFj3` e `QmM0SgcvbVbJSSkD-H4Xi`, registrados em seus próprios
recibos. Não se relabelam esses jobs como execução dos builds finais. A API
compartilhada foi compilada em produção e ficou com o mesmo BUILD_ID.

Após o refresh de public/openapi.json, um novo build web Better Auth passou exit
0, BUILD_ID `CU_6NKo8BvCyf0t6xndXV`, para emitir os assets públicos atuais. É um
evento posterior separado: navegação, A10 e visual conservam os BUILD_ID de seus
próprios recibos, sem serem relabelados como execução desse build.

J3 recebeu somente uma espera de teste pelo origin do painel e pathname exato
`/admin/financeiro`: primeiro após selecionar a locadora, depois após tentar a
página proibida. Redirects, guards e assertions reais continuam. A primeira
Better Auth foi 7 pass/1 fail/1 skip; o retry após essa espera foi 8 pass/1
skip, 104,65 s. Ambos ficam históricos.

Uma tentativa posterior declarada legacy iniciou sobre o web compilado Better
Auth: 3 pass/4 fail/2 skip, 144,07 s. O ledger a classifica como
**INVALID_BUILD_PROFILE**, preservando o log falho. Ela não serve como prova
legacy nem como diagnóstico de regressão do produto. A sequência final compilou
cada motor antes de executar suas jornadas e passou nos dois.

## CSS compilado, packaging e A10

E22 comparou duas folhas CSS emitidas, **276.029 bytes**, contra o snapshot C:
zero diferenças raw, AST, ordem relativa ou ocorrências de utilitários; a ordem
dos hashes de stylesheets em 25 HTML prerenderizados também coincidiu. O recorte
legacy mede o build `rEF56biJkNQNEpGWPkFj3`; o recorte Better Auth mede o final
`hL116oKB5L8ARlqFZExQA`. A referência C é Better Auth, então a comparação legacy
atesta CSS compartilhado, não cookies ou sessão. CSS emitido idêntico não
substitui captura, pixels, SSR por tenant ou uso real.

O packaging legacy exportou Android e iOS em HBC, exit 0. O packaging Better
Auth terminou todos os comandos exit 0: Android HBC de 9.344.436 bytes, iOS HBC
de 8.970.202 bytes e Storybook com index JSON de 59.294 bytes. São provas de
export/build, sem instalação, dispositivo físico ou deploy.

A10 normal em F usa o build Better Auth final e Chrome headed com renderer
reportado como hardware. O wrapper terminou exit 0, fontes intactas, processos e
navegador fechados e três portas livres. O raw manteve zero pageerrors, falhas
de recurso crítico, milestones ausentes e probeerrors; duas perdas de contexto
foram classificadas como descarte confirmado de renderers desconectados. Três
erros de console brutos continuam no relatório: um bloqueio de cliente Inspector
e duas respostas 404. Não se declara zero erros de console.

O aceite scoped de root está em arquivo separado: seis PNG inspecionados e vídeo
amostrado a cada 250 ms. Compressor não apresentou a mudança radial sustentada;
Betoneira apresentou fit gradual e Andaime ficou visível ao fim. O raw continua
`captured-pending-manual-review`, sem ser reescrito. Essa revisão não prova
todos os frames instantâneos nem Slow 3G. HDR neutro sintético e Draco local
preservam a execução; não certificam iluminação ou disponibilidade/transferência
de CDN. Nenhuma baseline foi alterada.

## Visual F e P2 formal

O full visual F executou quatro comandos exit 0 e encerrou em
2026-10-10T00:50:01.6000534Z, com childExitObserved e portsReleased verdadeiros.
O guard confirmou **80 arquivos/536 estados** sem problemas. A comparação fresh
terminou exit 0: **80 arquivos, 536 capturas, 31.065 elementos**, com
pending/approved/unused/problems vazios. A referência humana
3a3d4402e72248a467575a67acc6502fd061f3060faaa979766b6a8295e164f3 permaneceu
intacta, sem --write-baseline ou aprovação automática.

O summary bruto da captura conserva capture-command-passed-comparison-pending; a
comparação posterior é um recibo separado. O comparador mede propriedades CSS e
estrutura de elementos, não diferenças de pixels. As fixtures de APIs e o 3D
deliberadamente retido não certificam modal perceptível, aparelho, GPU,
performance, banco hospedado ou provedor real. Dialog/open 390 mantém o limite
da sequência de captura anteriormente descrito; aceite humano C não o transforma
em prova universal de usabilidade. O cleanup observado é limitado aos children
próprios e portas reservadas, sem inventário de todo descendente Chromium.

P2 v6 terminou **PASS_WITH_STATED_SCOPE** no parecer separado do executor,
SHA-256 037fb60c97fd5bd26c18a38fa05020f0f0ed3d486a2934045a31e2e0401e9f9f. Os
cinco negativos falharam por asserções reais (1/1/5/1/1 casos); depois da
restauração, os positivos passaram nas mesmas contagens. Foram restauradas
exatamente 49 fontes, houve quatro builds API reais e todos os processos e
portas próprios encerraram; active.json ficou ausente. Os controles cobrem cart
Allow, cart body, recusa legacy no Better Auth, chamada do resolver público e
ausência da rota health retirada. Não são uma campanha exaustiva de mutação.

O raw series v6 conserva closed-restored-evidence-awaits-root-review,
operatorReviewed:false e mutantKilled:null. O parecer do executor é externo e
não reescreve esses campos. Históricos v3/v4/v5 permanecem sem promoção; o erro
de finalizer/collector v5 não é classificado como asserção do produto. Os focos
HTTP não substituem cobertura B3/B11 da superfície inteira.

## Unit e provas históricas

| Última rodada retida              | Aprovados | Falhas | Skips | Arquivos aprovados / coletados |  Duração |
| --------------------------------- | --------: | -----: | ----: | -----------------------------: | -------: |
| Unit antes da formatação final    |     4.104 |      0 |     0 |                      179 / 179 | 428,56 s |
| Unit pós-formatação anterior      |     4.102 |      2 |     0 |                      178 / 179 | 340,22 s |
| Unit integral posterior, OpenAPI  |     4.103 |      1 |     0 |                      178 / 179 | 365,53 s |
| Foco estrito OpenAPI após refresh |        13 |      0 |     0 |                          1 / 1 |  12,37 s |
| Security com DB                   |       948 |      0 |    18 |                        33 / 33 |  72,44 s |
| Identity                          |       797 |      0 |     0 |                        27 / 27 | 182,21 s |
| Platform                          |     3.768 |      0 |     2 |                      647 / 647 | 357,10 s |
| Web normal                        |       438 |      0 |    16 |                        42 / 44 |  32,56 s |
| Mobile                            |        99 |      0 |     0 |                        17 / 17 |  11,53 s |
| Contract                          |       106 |      0 |     0 |                          1 / 1 |   6,72 s |
| Visual tools                      |       101 |      0 |     0 |                          6 / 6 |   7,72 s |

A rodada 4.102/2 permanece histórica: o checker recriou tsconfig.tsbuildinfo e
overview manteve um diagrama superado. As duas correções passaram na rodada
integral seguinte, que fechou **4.103/1, exit 1**, apenas por divergência do
OpenAPI gerado em 36 paths, não timeout.

O executor gerou e revisou o documento final e atualizou somente
public/openapi.json sob preimage exato. O diagnóstico tem 637 folhas alteradas
somente por IDs opacos TypeScript __@word@integer, zero diferenças semânticas
fora dos contadores e documento público de schemas inalterado. Gerador, check,
testes estritos e código produtivo foram preservados. Esses IDs pertencem ao
programa final após consolidação de código/Prisma/type-config; não se atribui
causalidade exata a incremental sem prova. O foco estrito posterior passou 13/13
em 12,37 s. A full unit seguinte executou os 4.104 casos em 179 arquivos, sem
skips, exit 0 e 346,88 s. Esse evento novo fecha a unit vigente; os resultados
4.102/2 e 4.103/1 continuam históricos, sem mudança retroativa.

Os gates antigos de arquitetura, tokens, nomes, docs, CSS, 14 typechecks e
hygiene continuam datados. Arch mediu zero violações em nove pacotes; hygiene
manteve 667 findings aceitos em 173 entradas; tokens preservou as cotas e
`css-important=0`. O ratchet usou explicitamente a tag C. O sentinel web
deliberadamente vermelho e os três níveis `NOT_PROVEN` (estilo web, render web,
export mobile) permanecem declarados. Gates verdes não eliminam essa dívida ou
comprovam propagação/dispositivo.

Os 18 skips security eram controles sem banco desligados na rodada com DB. Web
normal não habilitou T5/T6 ou jornadas (16 skips); os jobs separados acima
executaram esses fluxos com seus próprios perfis. Os dois skips platform
continuam dependentes de `EXPECT_PRIMARY`. Logs e exits sem recibo independente
continuam distinguidos no ledger.

## B11 e próximos passos deste checkpoint pré-publicação

B11 recovery v3 fechou **PASS_WITH_STATED_SCOPE** no parecer independente do
executor, SHA-256
75fe3eda1e33a15afcb6473c4e62d7c7c85ef435c4e7cadd53b1f7432a50b82c. O controle
recompilou a fonte produtiva C com os 158 inputs atuais de F (151 diferenças
somente EOL, quatro comentários, três idênticos), preservando guards e oracle.
Esses registros fresh foram comparados aos registros full F de raiz ausente já
encerrados; os registros C originais não foram reescritos.

| B11 por motor | Controle com raiz: passes / skips | Casos comparados sem raiz | Somente com raiz | Violações abertas / justificativas da comparação | Cobertura de sucesso: rotas / métodos | Exceções de cobertura existentes |
| ------------- | --------------------------------: | ------------------------: | ---------------: | -----------------------------------------------: | ------------------------------------- | -------------------------------: |
| Legacy        |                         3.018 / 2 |                     2.400 |              618 |                                            0 / 0 | 158/173; 201/221                      |                               20 |
| Better Auth   |                         3.014 / 0 |                     2.398 |              616 |                                            0 / 0 | 164/173; 207/221                      |                               14 |

Não houve casos somente sem raiz, casos ausentes ou problemas de cobertura. As
exceções de cobertura existentes são distintas de justificativas para diferenças
na comparação; não foram criadas novas dispensas. O executor conferiu ao menos
uma assertion por caso ausente e ao menos metade das assertions do caso
correspondente no controle presente. Os 21 passos terminaram exit 0, sem
timeout, com saída observada dos entry processes próprios. O banco próprio foi
retirado, sessões ficaram em zero, inventário/papéis foram restaurados e o
sentinel permaneceu intacto, sem derrubar banco desconhecido.

O raw execution conserva operatorReviewedResult:false; o parecer independente
posterior não reescreve esse campo. Os setup failures anteriores permanecem:
tarball offline ausente e store pnpm v10/v10, ambos sem banco criado. O controle
atual não certifica provedor, banco de produção ou deployment.

Com as provas de código fechadas, aplicar o candidato guardado e executar os
gates documentais e os focos de referências afetados. Esses gates não são
pré-condição circular para aplicar um texto ainda ausente. As contagens Markdown
sozinhas não justificam uma nova rodada ampla sem outro motivo.

Transferência/revalidação, commit/push F e CI final F são ações posteriores, com
recibos externos ou na resposta final. Este documento salva o estado do
checkpoint antes delas: nenhum commit F existe no registro, nenhum SHA futuro é
inventado e a execução CI pré-F não se torna a prova final F.

Dispositivos físicos/instalação, Slow 3G completo e os três níveis de
foundations NOT_PROVEN (estilo web, render web, export mobile) continuam
explicitamente fora do atestado. As 173 entradas aceitas de hygiene são dívida
declarada, não uma declaração de zero código morto. Os 25 arquivos históricos
.source selados conservam os bytes raw com -text; somente testing.md tem CRLF→LF
explícito, preservando seu conteúdo histórico após essa normalização.

A infraestrutura é local e descartável. O inventário tem 35 migrations; cada
aplicação exige seu próprio recibo. Infraestrutura hospedada, banco de produção
e provedores serão escolhidos depois conforme o usuário. Migrations locais não
criam nem homologam conta, banco ou provedores de produção. Nenhuma credencial
externa compartilhada com GB é alterada ou revogada. O destino autorizado
continua Schlorke/Locadora_de_Equipamentos.
