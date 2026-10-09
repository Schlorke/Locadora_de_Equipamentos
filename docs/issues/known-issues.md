# 🐛 Problemas Conhecidos e Soluções - GB Locações

## 336. Revisão de testes: duplicação, multa sem gabarito e captura visual vazia

**Data:** 2026-10-09. **Status:** correções aplicadas; fechamento integral da
etapa em validação. O usuário confirmou a fidelidade da interface e autorizou
versionar a primeira etapa no repositório do produto e continuar a retirada
local da raiz. A escolha e configuração dos serviços hospedados ficam para
depois.

A cópia `tests/critical/tax-engine.test.ts` repetia os 21 casos colocados em
`packages/domain/src/financeiro/tributo.test.ts`. Foi retirada a cópia. Upload
continua com os três casos de conteúdo/sanitização na suíte unitária; a segunda
coleta em security saiu. Schemas puros passaram de `tests/api` para
`tests/unit/schema-validation.test.ts`, com um sucesso simulado redundante
retirado. Não precisam iniciar um servidor para validar objetos literais.

O caso puro de multa não atingia os limites e usava duas leituras do relógio; o
teste persistente aceitava `undefined` como diferente de `null`. Os testes
colocados agora atingem o piso de 50 e o teto de 500 com datas fixas,
preservando arredondamento. A integração conserva os dois hosts e o banco real,
exige uma linha por locadora, multa literal de 100, nenhuma falha e aprovação
inalterada. Só Date é fixado; sockets e timers de transação continuam reais e o
relógio é restaurado em finally. Integração revisada: 65 casos em 13 arquivos
aprovados.

O comparador visual devolvia verde para duas pastas vazias. O writer podia
apagar arquivos ausentes numa captura parcial. Agora recusam pastas/JSONs sem
capturas e regravação que perderia arquivos ou estados; todos os JSONs são
validados antes da primeira escrita. As ferramentas têm 101 casos aprovados em
seis arquivos, incluindo preservação dos bytes após recusa.

`test:all` inclui contratos e ferramentas visuais; `test:gates` já é um recorte
da unitária, sem segunda execução integral. Platform e contract usam o guard
existente de rede de saída, conservando dublês e servidores locais. Contratos:
106 casos aprovados, coletados somente no perfil dedicado contract, sem repetir
a matriz no perfil platform. Testes sem banco excluídos no perfil com banco
exigem uma rodada focada complementar, não remoção do skip.

As jornadas Better Auth compartilham o IP de loopback. Uma execução rápida
acumulou 91 leituras de sessão antes de J7 e atingiu o limite real de 100
durante o cadastro independente. O harness agora lê somente os
timestamps/contagens do banco descartável e aguarda a janela móvel original de
60 segundos expirar antes de J7. Confere que os contadores não mudaram durante a
espera e registra a isolação sem chaves, IPs ou tokens. Não apaga contadores,
altera relógio, aumenta limites ou repete respostas 429; todas as expectativas
da jornada permanecem. Arquivo: `tests/e2e/journeys.spec.ts`; validar o perfil
Better Auth completo.

O gate de higiene identificou dois widgets antigos de categorias sem qualquer
consumidor de produção, exports default duplicados e reexports de multa sem uso.
Foram retirados com suas entradas antigas da baseline. O helper de rótulo de
período também era alcançado só pelo teste. O bloco de preço conserva props e
variantes universais; seu teste agora renderiza as três variantes, verifica
valores literais e exige o valor contratado depois da quantidade, em vez de
procurar strings de uma função morta. Três casos renderizados aprovados.

Crons herdados agora exigem repositório deste produto e opt-in explícito. O
teste avalia as condições reais do YAML para todos os quatro jobs, incluindo
GB-Locações com opt-in habilitado. A seleção da base no CI usa a primeira árvore
revisada somente quando não existe commit anterior. Fixtures Git reais provam
que o segundo commit passa a comparar com seu pai, além dos casos push e PR. Os
48 casos desse arquivo passaram; uma falha inicial do leitor de YAML foi
corrigida sem mudar as condições ou flexibilizar as expectativas.

A bateria platform encontrou expectativas que ainda procuravam imports sem o
sufixo `.web` depois dos movimentos de fronteira. Os três testes passaram a
conferir os módulos reais renomeados. O inventário da paleta também exigia mais
de cem tons usados: retirar widgets mortos deixou 99 tons, todos presentes na
paleta canônica. O mínimo arbitrário foi substituído pela presença de arquivos
essenciais nas três raízes do produto e dos tons essenciais, mantendo a
validação de cada tom encontrado. A rodada focada desses quatro arquivos passou
25 casos.

Cores literais de indicadores e receita agora consomem os tokens existentes, com
os mesmos valores. O nível interno das abas usa `--layer-inset`, de valor 10; a
compilação CSS compara os dois hosts e confirma a equivalência com a classe
anterior. Dez casos renderizados de gráficos e oito de CSS passaram.

A configuração local herdada foi retirada do checkout após cópia privada e
verificação de integridade. O histórico antigo também tem um bundle verificado
fora do repositório. Nenhuma credencial remota foi revogada, pois pode atender
ao GB-Locações; os modelos de configuração continuam sem valores reais. A
publicação usará história limpa, preservando a história anterior localmente.

**Aceite visual humano:** a mensagem de 2026-10-09 confirma a interface atual;
não especifica build ou inspeção de cada estado. A referência foi ancorada na
composição já conferida de 80 arquivos/536 estados (build de captura
`R7kHAAzDS69RA5Yc0oQ1F`). Referência e aprovações anteriores foram arquivadas
fora do repositório, com SHA por arquivo; aprovações antigas agora redundantes
foram retiradas. Comparação dessa referência: zero pendência. A origem é uma
composição de rodadas, não uma nova captura única. A limitação preexistente da
imagem Dialog/open 390 e o recorte Slow 3G da entrada 334 continuam registrados;
aceite de estilos não substitui provas de dispositivo, rede ou funcionamento.

**Como validar:** executar as suítes afetadas, `test:all`, gates, tipos e builds
pertinentes em banco descartável e source congelado. A rodada integral, Docker,
clone e retirada ainda precisam de seus resultados próprios. Cadência em
`docs/guides/testing.md`: foco durante edição; bateria consolidada no
fechamento.

## 335. Harness visual de produção dependia de chunks/prefetch/load e aceitava catálogo incompleto com filtro vazio

**Data:** 2026-10-08, America/Sao_Paulo, sem commit. **Status:** correções do
harness e guard de catálogo aplicados pelo coordenador; ferramentas finais 93/93
em seis arquivos e tipagem focada sem diagnósticos. Piloto parcial 4/4 validado.
A rodada posterior passou 80/80, mas seus dois catálogos ficaram base-only; 78
páginas/162 seções foram aproveitadas. Recaptura dos dois catálogos e composição
concluídas pelo coordenador: 80 JSON/536 seções/536 screenshots. Comparação
oficial saiu 1: 16.272 pendentes, 372 aprovados existentes e sete aprovações sem
uso. Não houve aprovação visual ou regravação de baseline.

O reconhecimento anterior retinha chunks cujo nome continha `three`/`drei`,
coerente com o dev. No build de produção observado, a dependência 3D recebeu
nome hash e escapava desse filtro. O contrato visual continua sendo conservar o
placeholder do Hero; este ajuste não muda Canvas, carrossel, autenticação,
fontes de produto, tokens, fixtures de dados, baseline ou aprovações.

`support/heavy-chunks.mjs` identifica o import client-only do Hero pelo loading
específico e pelo ID em `react-loadable-manifest.json`, deriva seus caminhos
exatos e exige os marcadores 3D caracterizados. Recusa formato desconhecido,
paths indevidos, arquivos ausentes e dependência usada como JS inicial pelas
demais rotas. A única exclusão é o manifest exato de `/sobre`, já fora de
`SCENARIOS` e documentado; incluir essa página exige revisar a retenção. O mesmo
matcher serve à retenção da request e ao tracker. Não há resposta 3D falsa nem
reconhecimento amplo de nomes hash. A produção exige BUILD_ID explícito e
relatório de hashes fora do repositório e da pasta de capturas; o wrapper gera
esse relatório antes do Playwright, e sua reutilização exige inputs idênticos. O
dev conserva o reconhecimento anterior.

O Next instalado faz prefetch automático de Link somente em produção. A primeira
rodada observou GET RSC pendentes para `/orcamento`, `/sobre`, `/contato` e
`/cookies` em `/catalog` 390, embora o snapshot DOM do catálogo estivesse
íntegro. O `error-context` não incluía headers; `_rsc` sozinho não demonstrava
prefetch, pois navegações reais também usam essa query. O relógio estava
pausado, e a espera de rede incluía essa antecipação de páginas antes de
avançá-lo. O diagnóstico não isolou qual timer ou stream mantinha cada request
aberta; o piloto posterior confirma o filtro literal e a prontidão no escopo
exercitado, sem transformar essa hipótese em defeito de produto.

O filtro puro `support/prefetch.mjs` exige conjuntamente: modo de captura de
produção, host local já validado pela route, GET, tipo fetch, nenhuma navegação
documental, pathname fora dos segmentos `/api` e `/_next`, `rsc: 1` e
`next-router-prefetch: 1`. A branch aborta de fato e anota somente pathname e
nomes dos headers em `aborted-prefetch`. O tracker continua recebendo a request
e esperando seu `requestfailed`; não ignora RSC genérico, queries ou requests
pendentes. Variantes `2`/`3`, Full sem marcador, Purpose/Sec-Purpose isolados e
navegações reais permanecem sujeitas às esperas originais. Os headers não
distinguem prefetch automático de uma chamada manual que produza o mesmo
contrato; a captura visual não certifica prefetch do produto.

Além disso, reter deliberadamente um import lazy assíncrono pode impedir
`window.load`. `open` agora aguarda `domcontentloaded`, conserva a asserção do
status HTTP e chama a mesma preparação explícita: rede ociosa para todos os
demais recursos, passos do relógio, `document.fonts.ready`, animações encerradas
e DOM estável. Não houve aumento de deadline nem substituição da prontidão por
uma espera fixa. O idle integral continua em 180s. `VISUAL_DIAGNOSTICS=1` usa
20s somente no piloto parcial, e o wrapper recusa diagnóstico ou limitação de
receitas sem filtro explícito de testes. O timeout registra `pending-network`
com metadados limitados, sem publicar headers sensíveis.

**Arquivos deste ajuste:** `tests/visual/visual-baseline.spec.ts`,
`tests/visual/support/heavy-chunks.mjs`, `heavy-chunks.test.ts`, `prefetch.mjs`,
`prefetch.test.ts` e `tests/visual/README.md`. A configuração/wrapper de
produção e os diagnósticos locais ficam fora do repositório. Não foi ampliado o
filtro para as variantes `2`/`3` ou para segmento isolado.

A rodada posterior revelou outro falso positivo do harness:
`VISUAL_CATALOG_RECIPES` chegava vazia ao processo. O split/filter produzia
`[]`, que é truthy; o loop pulava todas as receitas e gravava somente base,
embora o teste passasse. Esse resultado não certifica os estados do catálogo. O
helper aplicado `support/catalog-recipes.mjs` trata ausência/vazio/vírgulas sem
tokens como ausência de filtro, usa `only?.length` e exige antes da escrita base
mais cada chave canônica `receita:${recipe}/${state}`. A contagem e as chaves
precisam conferir: 70 receitas, 186 estados, 187 seções por viewport. Os 16
casos puros incluem base-only e chave errada com contagem igual; passaram na
suíte final de ferramentas (93/93 em seis arquivos), segundo o coordenador. Essa
mudança fica restrita ao bloco CATALOG e ao helper/import, mantendo prepare,
produto, build e fixtures inalterados.

**Provas disponíveis:** `visual-tools-final-prefetch.log` registra cinco
arquivos e 77 testes aprovados; `focused-types-J7-prefetch.log` registra zero
diagnósticos próprios/de dependências. O piloto Better Auth
`visual-narrow/pilot-v4-better-auth-20261009T012203Z-89e39018` terminou em
163,762s: expected 4, unexpected 0, flaky 0 e skipped 0. Ele cobriu somente
`vitrine/home` e `labs/catalog`, nos viewports 390/1440, com as receitas do
catálogo limitadas a Button. Suas anotações registram 96 abortos pelo contrato
literal, zero `pageerror` e zero `pending-network`. Contagem feita em um único
nível das anotações, sem duplicar sua cópia nos resultados; não são 96 URLs
distintas. Base dos artefatos: `%TEMP%/locadora-wave135-resume-20261008/`.

O relatório Playwright do piloto conserva SHA-256
`485487da512c30e362ba85957455247a88f113ec8ee33cc784b0395c1f6582e1`, e o
relatório de inputs heavy-chunks,
`57f137dbdbb94edd0f2cf8616803c03cb7a3c95bfce289104f23ac93e0e0120c`. O resultado
confirma esse escopo parcial, sem certificar os 80 testes, todas as receitas,
estabilidade entre duas capturas ou ausência de diferenças.

**Rodada integral de diagnóstico:**
`visual-narrow/full-v4-better-auth-20261009T013001Z-84d4e6b9` terminou com 80
expected, zero unexpected/flaky/skipped, em 747727,915 ms. O inventário real é
80 JSON/164 seções: 78 páginas/162 seções válidas mais dois catálogos de uma
seção cada. Nas 78 páginas: zero pageerror/pending-network, zero APIs não
mapeadas, zero esperas instáveis e 1453 anotações aborted-prefetch, contadas uma
vez por resultado. Os 80 caminhos conferem com os do baseline. O SHA do report
bruto é `73aed7e50dfa45bacfc680f4bac66450fd51806b754c5fa42cd8889ae15928da`.

**Plano proporcional de fechamento:** conservar as 78 páginas não-catalog,
excluir os dois catálogos base-only da prova de receitas e recapturar somente os
dois catálogos sem filtro, com 187 seções cada. O guard está aplicado e
validado; os snapshots antes/depois confirmam somente import/parser/guard no
bloco CATALOG. A composição prevista é de 80 arquivos/536 seções, condicionada à
conferência real na preparação e agora conferida pelo coordenador. A referência
atual tem 80 arquivos/528 seções, não 536. As oito adicionais atuais são quatro
estados de Configurações em cada viewport, com presença já documentada/aprovada,
sem referência de conteúdo por elemento. O manifesto de composição deve guardar
origem e SHA por arquivo/screenshot e preservar ambos os reports e fingerprints.
Os hashes distintos de spec/inputs entre os runs ficam explícitos. Não
apresentar a composição como uma rodada integral única ou prova de
repetibilidade completa, nem misturar arquivos stale.

`visual-narrow/composition-prepared/compose-visual.mjs` implementa essa seleção,
cópias físicas, relatório 78+2, ambos reports brutos e SHA por arquivo. Foi
somente revisado estaticamente por este agente; a execução foi exclusiva do
coordenador. Os sete hashes e timestamps em `composition-invariants.json`
corroboram o freeze declarado pelo coordenador, mas não são prova criptográfica
retroativa dos bytes no início da primeira rodada; o manifesto conserva esse
limite.

**Resultado composto fechado:** `visual-narrow/composed-v4-pages-catalog-final/`
conserva 78 páginas da full-v4 e dois catálogos da recaptura
`pilot-v4-better-auth-20261009T014504Z-d2c39253`, com 187 seções cada. O
manifesto confirmou mesmos inputs de build/produto/política exceto a mudança
restrita de import/parser/guard do catálogo, sete fontes corroboradas pelo
freeze, SHA por arquivo e cópias físicas; nenhum arquivo novo/ausente/stale. O
relatório selecionado tem 80 expected, zero unexpected/flaky/skipped,
pageerror/pending-network; os 80 JSON têm zero APIs não mapeadas e esperas
instáveis. Ambos os reports brutos permanecem preservados. Isso não transforma
os dois runs em uma execução integral única ou prova de repetibilidade atual.

O comparador oficial saiu1, com **16.272 pendentes/372 aprovados existentes/
sete aprovações sem uso**, sem problema de formato de aprovação. São registros
de propriedade CSS/presença de elemento/estado, não pixels. **16.260** ficam nos
oito cenários antigos do painel (referência anterior à moldura295); **12** ficam
fora deles: quatro em recuperar/resetar senha, dois em equipamento-editar A9 e
seis no detalhe público, distribuídos entre390/1440. Todos os12 são somente
`background-image`, de `to right` para `90deg` com os mesmos três stops. A
equivalência semântica é uma inferência limitada; seguem formalmente pendentes,
sem alterar comparador, oráculo, baseline ou aprovações para obter verde. Os
sete registros sem uso são todos D-A do checkbox de fins de semana no detalhe390
(cinco cores e dois elementos). A queda histórica16281→16260 no painel antigo
ocorre somente no dashboard (−14 em1440, −7 em390); ela não aprova em bloco a
moldura nem prova a causa de cada diferença.

SHA-256 do `summary.json`:
`8e67b5521d8cbf14ba54a4375df7163c09ec17fb2bf80cc7d34f15390a299e7e`. SHA-256 do
`comparison.json`:
`4c6bdb99b24a40c8ab90a6977590ad89fdf5ffd6f751c87c86883b07bd8d3469`. O
sumarizador declara repetibilidade não observada e não verifica sozinho
auth/build; o manifesto e os registros do coordenador são as fontes separadas
dessa proveniência. Textos/rótulos, pixels, movimento, hardware e geometria de
viewport não são avaliados pelo comparador de propriedades.

**Lacuna de imagem preexistente:** `Dialog--open.jpg`390 mostra overlay e a
receita sem a caixa do diálogo no viewport. O arquivo atual é idêntico byte a
byte aos históricos `lote-A/p2/visual-f1` e `visual-f2`, 13.975 bytes, SHA
`cb4a7e307978bdd1c5208bd77f44b6dfc69024b4e7a708c2a9c3aa6b2e267557`. JSON atual e
baseline registram o portal, título, conteúdo e controles com estilos iguais;
isso não prova interseção com viewport. O capturador inclui elementos fora da
área visível e não grava rect; a imagem scoped continua um screenshot do
viewport. A sequência abre o diálogo e depois rola ao marcador sob scroll lock.
A análise inicial não isolava rolagem/lock ou screenshot/animação; a sonda
abaixo acrescenta a geometria observada, sem atribuir bug ao produto. Não
aprovar essa lacuna nem chamar a imagem de prova do diálogo perceptível.

**Complemento de geometria:** a sonda externa passou um caso/quatro condições
(clock congelado/real × screenshot allow/disabled), sem erros de página, rede
pendente ou APIs sem fixture. A caixa/opacidade ficaram estáveis. Após rolar o
marcador, o VisualViewport de 390×844 passou à região [32,422]×[480,1324],
totalmente fora da caixa x591,406/y1350,406/w377,188/h675,188. O layout de
1560×3376 e a caixa permaneceram iguais. Isso demonstra uma limitação da
sequência de captura; a origem do viewport de layout ampliado continua aberta. A
interseção calculada com innerWidth/Height não prova percepção na imagem. A
sonda não certifica centralização/usabilidade ou aparelho e não mudou produto,
spec, baseline ou aprovação. Os quatro JPG continuam iguais aos históricos.
Artefatos:
`%TEMP%/locadora-wave135-resume-20261008/visual-narrow/dialog-diagnostic-v4-better-auth-20261009T021710Z-aad1f84b/`;
um teste em 10,9s, wrapper em 13,4s, filho encerrado com exit0 e portas próprias
livres. A tentativa anterior de CLI sem testes ficou preservada como falha de
seleção; somente a tentativa seguinte executou as quatro condições. Conferir
inventário, pageerrors, pending-network, unmapped APIs e instabilidade, e
comparar/revisar diferenças e imagens sem alterar baseline/aprovações para obter
verde. Essa captura com placeholder não substitui A10 temporal em GPU nem J1–J7
com autenticação, carrinho e orçamento reais. P1 formal continua parcial pelos
demais limites e pelo aceite visual ainda aberto.

## 334. Loader 3D criava uma root DOM adicional no fallback de Suspense

**Data:** 2026-10-08, sem commit. **Status:** correção aplicada; caracterização
5/5, tipagem focada sem diagnósticos e runtime local normal validado; P1/A10
parcial, com Slow 3G inconclusivo. As entradas 167/321 conservam seus limites.

O `removeChild` antes observado com SwiftShader também apareceu nas capturas A10
em Chrome com GPU real. O diagnóstico `2026-10-09T00-15-28-102Z` registrou duas
remoções falhas de DIV dentro de DIV, com o filho já sem pai, próximas ao
carregamento e à troca do modelo. O stack passa pela exclusão de filho em
container do ReactDOM; não houve `Element.remove` anterior registrado. O
`<Html center>` do loader mantinha uma root ReactDOM separada dentro do fallback
do Suspense 3D, sendo o candidato prioritário para o conflito de dono DOM. A
operação que retirou o filho primeiro ainda não foi demonstrada; não há causa
confirmada em metas, ScrollReveal ou sessão.

`ModelViewer.web.tsx` agora renderiza o percentual como DOM React normal, irmão
do Canvas no wrapper relativo existente. O fallback do Suspense da cena é nulo.
A apresentação permanece centralizada, com `text-yellow-500`, `text-lg` e o
percentual arredondado, sem novo token, cor, z-index ou controle. A visibilidade
usa `loadedUrl === url`, preenchido pelo `onLoaded` do GLTF atual; progresso
global em 100% não esconde o indicador antes dessa resolução. O preload não
reinicia a confirmação de um modelo em cache, e `onModelLoaded` mantém o
callback existente.

Continuam preservados `scrollRevealReady`, `delayBoundsFit`, `isRevealComplete`,
`hasPassedFirstModel`, `disableAutoFit`, `Bounds.maxDuration` (zero no primeiro
modelo, um nos seguintes), a espera de 200ms, os timers de troca e a rotação.
Não houve edição em dependências, tokens ou baselines.

`ModelViewer.web.test.tsx` caracteriza progresso fora da cena suspensa,
resolução atual, troca de URL, resolução antiga após troca rápida, cache e fit
somente após a revelação. Usa Promise real de Suspense e dublês 3D; não fabrica
o erro de DOM nem certifica GPU. Os cinco casos passaram. Com a fonte original,
dois falharam e três passaram; após restauração por SHA-256
`5c3c525df965282b1ba0650282e2bcb4453b7eda09f85f60d9db9a915aaa6c2f`, os cinco
passaram novamente. Tipagem focada registrou zero diagnósticos próprios e de
dependências. Evidências locais: `a10-loader-original-negative.log`,
`a10-loader-characterization.log`, `a10-loader-sensitivity.json` e
`focused-types-a10-loader.log`, em `%TEMP%/locadora-wave135-resume-20261008/`.

Os builds legacy da web e da raiz foram renovados e passaram; o build anterior
da API permanece aplicável ao backend não alterado. O web Better Auth também foi
compilado e usado na captura normal `2026-10-09T00-39-31-220Z`: GPU real, zero
erros de página/probe, cinco marcos e análise radial completa. Compressor sem
fit sustentado; Betoneira confirmou o controle positivo, com rotação preservada.
O coordenador revisou o contact sheet de 354 quadros decodificados em 14,16s. O
loader foi validado nesse escopo local normal.

Slow 3G (`2026-10-09T00-40-02-378Z`) terminou sem erros de página ou perda de
contexto ativo, com vinte descartes comprovados e 6.874 quadros do Compressor. A
Betoneira não desenhou até o limite declarado de 150s; controle positivo e dois
marcos faltaram. O resultado é inconclusivo, sem estender a janela ou forçar
troca. `a10-temporal/manual-review-final.json` registra a revisão, sem
reescrever os relatórios brutos. A fonte conserva o SHA-256 acima.

HDR neutro sintético, Draco local e backend de fixture limitam a prova: CDN,
iluminação real, infraestrutura de produção e autenticação não foram
certificados. Aceite visual e aceite integral A10 continuam pendentes. As
referências 167/321 não constituem fechamento universal do erro.

## 333. Canonicalizações de Tailwind mudavam degradês e medidas; comparador apagava a diferença

**Data:** 2026-10-08, sem commit. **Status:** ferramentas de paridade 27/27,
higiene e três rebuilds de produção locais verdes. A
captura/composição/comparação foi executada posteriormente (entrada 335); o
aceite visual continua pendente.

Dez nomes novos usados em Configurações e WhatsApp não tinham oráculo na fixture
de produção. `bg-linear-to-br/tr` usa interpolação Oklab, enquanto as utilities
históricas `bg-gradient-to-br/tr` preservam sRGB. `max-w-50/70`, `min-h-150/45`
e `min-w-50` usam rem, enquanto os valores anteriores eram 200/280/600/180px:
com fonte do navegador em 20px, os tamanhos deixam de coincidir. Essa troca já
era recusada pela decisão registrada no Changelog de 08/10.

Foram restauradas trinta ocorrências em sete fontes de `configuracoes/ui` e
`whatsapp-admin/ui`, incluindo os nomes anteriores de quebra de palavras e
variáveis de cor/entrelinha. Conteúdo, ordem, stops de cor, tokens e `shrink-0`
permanecem. Os dez oráculos já existem em `production.json`; nenhuma fixture,
exceção ou baseline foi regravada.

O comparador `canonicalGradient` também removia qualquer espaço de interpolação
e poderia esconder a regressão. Agora só trata sRGB explícito como equivalente
ao implícito; preserva Oklab. O teste novo distingue os dois resultados.
`test:visual-tools` passou 27 casos em três arquivos; higiene e os builds locais
da raiz, API e web passaram. A fixture conserva o SHA-256
`E99C1FB70945BA917D9A7721B4A6AC2CCAE3F8D6579788AA5306F545654C5297`.

A rodada visual completa foi interrompida por ambiente inválido e não é prova de
falha ou aprovação do produto. A neutralização deixava
`NEXTAUTH_URL_INTERNAL=''`: o NextAuth usa fallback por `??`, preserva a string
vazia e falha no SSR em `new URL('')`. O harness local passou a declarar a URL
interna igual à URL NextAuth sintética, sem alterar produto ou `.env`. A
captura/comparação completa em 390/1440 ainda precisa ser renovada; as
diferenças históricas do painel não foram aprovadas. Não normalizar a diferença
de espaço de cor nem regravar baselines para obter verde.

## 332. Fixtures de identidade dependiam de data fixa e provedor de chaves herdado

**Data:** 2026-10-08, sem commit. **Status:** identidade consolidada 855/855.

A suíte de identidade passou 852 casos e encontrou três falhas.
`subaccount-provisioning-database.test.ts` usava 07/10 como relógio injetado,
mas a outbox criada sem `availableAt` usa o relógio real do banco. Em 08/10,
duas entregas esperadas ainda estavam no futuro para a fixture. O relógio agora
começa após o setup do banco, com margem de um segundo, e cada caso mantém o
maior valor entre ele e o tempo atual com essa margem. Avanços de 15
segundos/dias, filtros de entrega devida e barreiras de cobrança permanecem.

`secrets-database.test.ts` também não declarava o provedor de chaves da
configuração sintética. Com ambiente neutralizado, um valor vazio não aciona o
default por `??` e o runtime corretamente recusava a configuração. A fixture
agora declara `PLATFORM_SECRETS_KEK_PROVIDER=env`. Nenhuma regra de produção,
SQL, configuração real ou expectativa de sucesso foi reduzida.

A anotação de credencial da fixture deriva agora de
`Parameters<typeof readAsaasConnectedAccount>[0]['credential']`: o contrato
público aceita segredos opacos estruturais, sem exigir a identidade privada de
uma classe concreta nem acrescentar consumidor de teste a um export sem uso. O
resultado runtime de identidade passou antes desse ajuste somente de tipo;
tipagem e higiene serão reconferidas. Nenhum baseline foi ampliado.

## 331. ARN KMS fictício inválido escondia o sucesso do onboarding Better Auth

**Data:** 2026-10-08, sem commit. **Status:** fixture corrigida, reexecução
consolidada pendente.

A rodada integral Better Auth passou 2.397 casos e falhou ao criar a locadora:
503 `ONBOARDING_UNAVAILABLE`, em vez de 201/TRIALING. O ARN sintético usava
`key/synthetic-onboarding`, mas o adaptador KMS exige UUID ou chave multi-region
no formato previsto. `createConfiguredSecrets` recusava a configuração antes da
transação. O perfil legacy não exercitava esse fluxo condicionado ao motor.

`tests/api-host/onboarding.http.test.ts` agora usa um UUID sintético válido;
nenhuma expectativa, validação KMS, regra de criação ou exceção de cobertura foi
reduzida. As jornadas de navegador precisam da mesma configuração válida. O
checklist também reconhece `CUSTOMIZE_SITE=true` quando o telefone fornecido no
cadastro já semeia `whatsappNumber`; a fixture do dono assistido sem esse dado
continua `false`. Não foram usados KMS, chave ou conta reais.

## 330. Inventário de segurança do sitemap conservava binding antigo e recusava reflexão

**Data:** 2026-10-08, sem commit. **Status:** segurança consolidada 1.684 casos,
36 skips; rebuild web posterior pendente.

O sitemap passou a consultar equipamentos e categorias por
`fetchPublicSitemapCatalog`; o inventário ainda exigia
`fetchPublicEquipmentIds`. Além disso, `PAGE_RANK[path]` contrariava a proibição
existente de chave computada em handlers públicos. O binding esperado foi
atualizado exatamente; o rank virou `ReadonlyMap` com os mesmos oito pares e
leitura por `get`.

Arquivos: `tests/security/route-auth-inventory.test.ts` e a rota de sitemap do
host web. Scanner, allowlist, rotas, métodos, URLs, frequências e prioridades
permanecem com os mesmos contratos. Validar inventário e build web; não
autorizar reflexão genérica para acomodar o acesso.

## 329. Classe híbrida removia cor e entrelinha do texto de ajuda em Configurações

**Data:** 2026-10-08, sem commit. **Status:** restauração mínima comprovada no
web compilado em produção.

`ConfiguracoesPage.web.tsx` juntava dois utilitários em
`leading-(--line-height-paragraph)-[var(--text-secondary)]`. O Tailwind não
gerava a cor e a entrelinha pretendidas. Nas capturas históricas de 390 e 1440,
o texto de ajuda do e-mail comercial perdia sua cor própria e tinha 16px de
entrelinha, enquanto a referência tinha `rgb(107,114,128)` e 19,2px.

A classe foi separada em `leading-(--line-height-paragraph)` e
`text-(--text-secondary)`, iguais às dos textos irmãos. Tokens, CSS global e
baseline permanecem intactos. A varredura de classes híbridas semelhantes
encontrou somente essa ocorrência no produto. As quatro capturas atuais
passaram; os valores computados do texto confirmaram cor, fonte de 12px e
entrelinha de 19,2px nos dois viewports, sem espera instável. As respostas de
notificações e onboarding ausentes da simulação continuam registradas.

As 16.281 diferenças históricas do painel são propriedades/elementos, não
pixels. A moldura administrativa muda caminhos DOM, mas esse defeito e o estado
de erro de onboarding da fixture impedem aprová-las em bloco como "somente
moldura". Ver `docs/features/admin-system.md`.

## 328. Manifesto confundia expiração operacional, famílias dinâmicas e fonte do fallback

**Data:** 2026-10-08, sem commit. **Status:** C2 e materialização passaram 51
casos; tag do projeto ainda ausente.

O token anterior do webhook raiz não tem expiração automática: é aceito enquanto
`PLATFORM_ASAAS_ROOT_WEBHOOK_TOKEN_PREVIOUS_SHA256` estiver definido. O prazo de
24 horas é uma obrigação operacional de retirar essa variável. Referências
`env:LOCADORA_INTEGRATION_<ID>` leem os sufixos `_SECRET`, `_VERIFY_TOKEN`,
`_API_KEY`, `_ENVIRONMENT` e `_USER_AGENT`, não a variável base; `_SECRET` vazio
impede a resolução. Manifesto e comentário do exemplo da API foram corrigidos
sem expor valores.

O teste também ignorava nomes curtos como `CI` e dizia conferir o fallback da
tag, mas lia a raiz atual e falharia na importação após sua exclusão. A prova
precisa distinguir o checkout pré-tag das fontes imutáveis da tag fixada por
SHA. Não pode ignorar a ausência de `app/` nem voltar silenciosamente ao
checkout quando uma tag presente é inválida. A tag de pré-exclusão ainda não foi
criada nesta execução; sua prova permanece prospectiva.

O snapshot fixa o SHA antes de ler, desliga replacement refs do Git e recusa
paths inseguros/colisões. Testes usam repositórios descartáveis, incluindo tag
movida, referência corrompida, substituição de commit/blob e limpeza sem
atravessar links. O inventário atual passou no estado explícito pré-tag; isso
não certifica uma tag de publicação ainda inexistente.

Ver `tests/unit/env-manifest.test.ts` e
`docs/operations/manifesto-variaveis.md`. Nenhuma configuração real foi lida ou
alterada.

## 327. Duas provas unitárias dependiam de ordem incidental e mapa de migrations antigo

**Data:** 2026-10-08, sem commit. **Status:** unidade consolidada 6.199 casos,
treze skips, 179 arquivos.

Na primeira rodada ampla com perfil correto, 6.153 casos passaram, dois falharam
e treze foram pulados. A prova de edição de orçamento ordenava pagamentos apenas
por `createdAt`; empate permitia inverter RENTAL e LATE_FEE, embora ambos
preservassem exatamente os valores esperados. A asserção agora ordena a projeção
por tipo antes da igualdade exata; nenhuma regra de cobrança foi alterada.

A prova de recuperação de migração descobre migrations com `lock_timeout`, mas
seu mapa de bloqueios ainda não incluía
`202610080101_settings_seo_title_neutral_default`. Ela falhava antes de tentar o
deploy dessa migration. O mapa agora mantém `ACCESS SHARE` em `settings`, para
testar de fato `55P03`/`P3018`, recusa `P3009`, resolução e novo deploy. SQL e
procedimento de recuperação permanecem intactos.

Arquivos: `tests/unit/quote-obligation-edits.test.ts` e
`tests/unit/migration-preflight-rls.test.ts`. Repetir as provas no PostgreSQL
local descartável; não usar dados ou migrations de produção.

## 326. Teardown podia aceitar taskkill falho e abandonar recursos irmãos

**Data:** 2026-10-08, sem commit. **Status:** correção de lifecycle em validação
consolidada da onda 135.

Os helpers antigos resolviam a limpeza quando o comando `taskkill` fechava,
ignorando seu código de saída e o estado do servidor. Além disso, uma falha no
primeiro filho abortava o loop e impedia o encerramento dos outros filhos e das
pontes locais. Isso poderia deixar processos próprios vivos e produzir evidência
B11 sem uma limpeza efetiva.

`tests/helpers/owned-process.ts` agora observa a saída real do `ChildProcess`
criado pela fixture, recusa PID inválido, limita a espera e propaga erros. No
Windows, o término do próprio auxiliar `taskkill` também é observado. Uma
corrida é aceita somente quando o filho já terminou comprovadamente. O cleanup
tenta todos os filhos, pontes, providers e logs locais; erros são agregados e
impedem a exclusão de dados, o drop do banco e a conclusão do registro. Pools
próprios são fechados também nesse caminho de falha.

Integrações: `tests/api-host/global-setup.ts`, `receiving-account.ts`,
`web-consumer.ts` e `tests/global-setup.ts`. A operação continua restrita aos
filhos criados pelas próprias fixtures; não procura processos por porta, nome de
executável ou PID externo.

Os testes cobrem erro do comando, timeout, corrida, saída por sinal, escalada
POSIX, continuidade da limpeza após falha e um filho Node real local. Os 32
casos focados, os tipos e o lint passaram. Quatro mutações foram detectadas, com
fonte restaurado por bytes/hash. A validação HTTP completa permanece necessária
para o ciclo dos hosts reais. Ver `docs/guides/testing.md`.

## 325. Expectativas HTTP provisórias e fixtures que interferiam entre si

**Data:** 2026-10-08, sem commit. **Status:** correções B2/B3 em validação
consolidada da onda 135.

Capturas do primeiro host e marcadores provisórios não constituíam uma prova
independente no perfil sem legado. As expectativas agora vêm dos dados semeados
e dos contratos dos handlers: DTOs completos, erros Zod, cabeçalhos, CSV e
conteúdo comercial de PDFs. O scanner AST acompanha capturas mutáveis por
símbolo e recusa seu uso como gabarito, incluindo helpers e nomes arbitrários;
comparações entre proxy e chamada direta ao mesmo destino continuam acompanhadas
de expectativas próprias.

A primeira rodada integral sem legado teve 2.388 casos aprovados, doze falhas e
um skip intencional. Dez falhas eram expectativas incorretas de dois DTOs
públicos e do `Allow` automático do Next: valores opcionais numéricos do
equipamento são zero, categorias públicas omitem `tenantId`, e somente
`OPTIONS`, não o `POST` recusado com 405, publica `Allow`.

As duas restantes vieram de interferência entre fixtures: o job preventivo
deixava onze manutenções na locadora alfa compartilhada. A suíte de manutenção
limpava somente seus equipamentos, mas consultava toda a locadora. A correção
usa uma locadora, categoria e vínculos próprios, preservando as consultas amplas
e os casos estrangeiros/sem locadora. Não apaga registros de outra suíte nem
afrouxa as expectativas de RLS.

O sucesso HDR também passou a usar bytes não UTF-8 e comparação integral de
`arrayBuffer`. Isso revelou uma conversão indevida para texto na ponte do
provedor de teste; a ponte agora preserva bytes. O proxy de produto já usava
`arrayBuffer` e não precisou mudar. Ver
`tests/api-host/platform-success.http.test.ts` e `receiving-account.ts`.

Validação consolidada e comparação dos quatro perfis ainda em andamento. Nenhum
comportamento de produto foi alterado para acomodar os testes. Ver
`docs/features/shared-api-host.md` e `docs/guides/testing.md`.

## 324. Dependências da onda 135 declaradas sem os importers do lockfile

**Data:** 2026-10-08, sem commit. **Status:** corrigido localmente.

Os manifests já declaravam Analytics e Speed Insights no web, Zod no backend e
Drei, Fiber e Three no frontend, mas os seis vínculos não estavam nos importers
do `pnpm-lock.yaml`. Uma instalação travada recusava essa integração. A
reconciliação reutilizou as versões e variantes já resolvidas; não mudou a seção
de pacotes nem os snapshots. A atualização foi conferida primeiro numa cópia de
manifests/lockfile fora do repositório, sem `node_modules` ligado.

Validação: `pnpm install --frozen-lockfile --offline --ignore-scripts` passou
com Node 24.21.0. Frontend, UI e mobile conservaram o mesmo caminho real do
React Native. `pnpm build`, `pnpm build:api` e `pnpm build:web` passaram em
série. Isso fecha a instalação e a compilação local, não o aceite da onda.

## 323. Oito páginas podiam perder os metadados sem reprovar o SEO

**Data:** 2026-10-08, sem commit. **Status:** prova A4 corrigida.

Causa: o teste exercitava o helper de SEO e a home, deixando os exports
`generateMetadata` das outras oito páginas sem execução. A remoção desses
exports sobreviveu à suíte na auditoria.

Solução: `(vitrine)/seo.test.ts` chama os exports das nove páginas reais com
`params` assíncronos e duas locadoras concorrentes. As expectativas conferem
título, descrição, canonical, Open Graph, Twitter e logo da própria locadora,
incluindo recusa de logo relativo, protocol-relative e data URI. Nenhum fonte de
runtime, estilo ou layout permaneceu alterado.

Validação: SEO e home passaram 29/29 em Node 24.21.0. Onze mutações reprovaram
(oito exports removidos, cartão fixo, origem fixa e logo relativo publicado);
fontes restaurados por bytes/hash. São provas do contrato de função de
metadados; SSR, navegador e o consolidado P0/P1/P2 conservam seus próprios
critérios. Ver `docs/features/seo-e-medicao-da-vitrine.md`.

## 322. Comparador de asserções aprovava evidência vazia ou incompleta

**Data:** 2026-10-08, sem commit. **Status:** correção B11 validada na matriz
HTTP local dos quatro perfis; aceite integral da onda 135 pendente.

Causa: `readRecord` devolvia uma lista vazia para arquivo ausente e
`compareAssertions` descartava casos que não passaram. Dois diretórios
inexistentes podiam produzir zero casos e exit 0; uma rodada interrompida ou com
falhas também podia parecer equivalente.

Solução: `tests/api-host/parity-report.mjs` exige registros não vazios,
superfície inteira e igual à atual, incluindo hash dos auxiliares de
`tests/api-host`, `tests/helpers`, SQL de papéis/migrations e da configuração
Vitest da API, perfis production/absent do mesmo motor, hosts de produção, casos
coerentes e conclusão ligada ao início da rodada. `startRecord` remove conclusão
anterior; `finishRecord` lê os estados finais do Vitest e os erros não tratados.
O teardown global só o chama depois da limpeza e da cobertura: erro nessa etapa
deixa a rodada sem conclusão válida. Falhas não são filtradas para produzir
aprovação. Skips/todos intencionais continuam distinguíveis e reconciliados.

Validação inicial: 25/25 testes do harness passaram com somente a API compilada,
banco descartável e registro final real. Os testes colocados em
`tests/unit/api-parity-report.test.ts` incluem os casos negativos e fixtures do
Vitest com falhas de hooks/cleanup: 69/69 passaram. Forçar o estado final dos
arquivos para `pass` provocou quatro falhas; o fonte foi restaurado por
bytes/hash. O contrato de tipos dos métodos reais do Vitest e o lint focado
passaram. Registros históricos sem a nova conclusão/superfície não são
certificados retroativamente; B11 depende de novas rodadas completas nos quatro
perfis. Ver `docs/guides/testing.md`.

O primeiro confronto completo `production/legacy` e `absent/legacy`, apesar de
3.018 e 2.400 casos aprovados, foi rejeitado: dezessete e quatorze grupos de
chaves duplicadas, cinco títulos instáveis de WhatsApp e um caso com 16/6
asserções. Nomes de tabela colapsavam depois de normalizar UUIDs, formatar tipos
distintos ou truncar objetos; cinco títulos incorporavam o telefone aleatório.
Doze tabelas de dez arquivos receberam labels semânticos estáveis, conservando
os 47 cenários e todas as expectativas.

O teste de unicidade percorria hosts e chamava um helper que os percorria de
novo. Agora a recusa é verificada no host cuja fixture está sendo criada/limpa,
com DTO completo e snapshot anterior/posterior intactos: seis verificações por
host, contagem prevista 12/6. Não houve preenchimento artificial de
expectativas, mudança do recorder ou relaxamento de duplicados, >=1/>=half,
skips/todos ou braços legados. Os registros antigos permanecem preservados e
rejeitados para B11. A matriz v2 passou nos quatro perfis, com 64 arquivos por
rodada: production/legacy 3.018 aprovados e dois skips; absent/legacy 2.400 e um
skip; production/better-auth 3.014 e absent/better-auth 2.398, ambos sem skips.
As comparações aceitaram 2.400 casos legacy e 2.398 Better Auth, zero violações
abertas e zero casos exclusivos sem raiz; 618/616 exclusivos com raiz são os
braços legados previstos. Cobertura: 201/221 sucessos + vinte exceções no
legacy, 207/221 + quatorze no Better Auth. Registros finais atuais e conclusão
de cleanup/cobertura não substituem jornadas Better Auth, provas visuais ou P2.

## 321. Hero sem os números no SSR e "|" fixo no telefone da vitrine

**Implementação:** 2026-10-07 e 2026-10-08, sem commit (onda 134, passada
final). **Status:** corrigido; pendências anotadas.

Sintoma: na vitrine do host web, o hero de toda locadora, inclusive a GB,
mostrava o ícone do telefone com um "|" sozinho (desktop) ou um link vazio
(celular); a produção mostrava "(51) 2313-6262 | (51) 99820-5163". O cabeçalho,
o contato, "Por que escolher" e a Sobre mostravam "|" e links vazios quando
faltava um dos números.

Causa: `buildHeroInitialSettings`
(`packages/frontend/src/pages/home/model/hero-settings.ts`) não levava os
números; com `initialData`, `usePublicSettings` não consulta a API e os deixa
vazios. O JSX tinha o separador e os dois links fixos — a produção da GB
escondia isso com padrões fixos que o T12 retirou.

Solução: o recorte do SSR leva os dois números aparados (rota
`(vitrine)/page.tsx` e a home da raiz legada `app/page.tsx`); hero, cabeçalho,
contato, "Por que escolher" e Sobre mostram só os números presentes, com " | "
só entre os dois; sem nenhum, o bloco sai; no celular, o WhatsApp ou, sem ele, o
telefone. Com os dois números a marcação é a da produção, byte a byte. Linha de
base: 10 aprovações por elemento no `/catalog` sem locadora. Validar:
`Hero.telefone.web.test.tsx`, `Cabecalho.telefone.web.test.tsx`,
`hero-settings.test.ts`, `ContatoPage.test.tsx`, o `page.test.tsx` da rota e a
linha de base visual. Pendências: as prévias do painel (`HeaderFooterPreview`,
`HeroCarouselPreview`, `SettingsPreviews.native`) e o laboratório ainda têm o
"|" fixo; o mock de `usePublicSettings` em `gb-site-content.textos.test.tsx`
junta as configurações da GB ao `initialData` (o hook real não), por isso o
golden não pegou o defeito; erro de hidratação intermitente (`removeChild`) na
home do host compilado, que não vem desta correção e pede investigação própria.
Lição: recorte de SSR que dispensa a consulta do hook precisa levar tudo o que o
componente lê, e o mock precisa imitar o hook real.

Atualização da onda 135: a pendência DOM também foi observada em GPU real e
recebeu a correção de loader da entrada 334. A prova local em rede normal passou
sem o erro; Slow 3G permaneceu inconclusivo por não desenhar a Betoneira em
150s. Isso não encerra as demais pendências desta entrada nem certifica ausência
universal do erro ou a comparação visual completa.

## 320. Infra de testes da onda 134: exports mortos escondidos, teste preso à data e testes nativos fora do typecheck

**Implementação:** 2026-10-07, sem commit (onda 134, terceira rodada e passada
final). **Status:** corrigido; pendência anotada abaixo.

- `pnpm hygiene` voltou a reprovar seis exports de
  `packages/contracts/src/onboarding.ts` como "só de teste". O contrato de erros
  do cadastro (`OnboardingError`, `OnboardingErrorSchema`,
  `SlugUnavailableErrorSchema`, `ONBOARDING_ERROR_STATUS` e cadeia),
  `SelfServiceSignupSchema` e os tipos sem consumidor saíram junto com o único
  teste que os usava e as entradas da linha de base; o servidor tem os próprios
  códigos em `packages/backend/src/http/onboarding.ts`, provados em
  `tests/unit/onboarding-http.test.ts`. Teste que importa um módulo inteiro
  (`import * as x` + `Object.keys`) faz o knip contar todo export como usado:
  `storefront-legal.test.ts` passou a ler a lista de exports do arquivo-fonte.
- `tests/identity/onboarding-database.test.ts` usava relógio sintético igual à
  data real (`2026-10-07`) e esgotava o balde diário do IP `unknown` do caso
  seguinte; ficou independente da data.
- Prazos explícitos medidos para casos pesados sob a carga do `pnpm test:unit`
  completo: `eslint-config`, `eslint-runtime-rewrite` e `retired-artifacts`
  (`REPO_SCAN`), no padrão de `KNIP_REAL` e `REAL_GIT`.
- Testes nativos do frontend e do ui não entravam no `pnpm typecheck` com a
  resolução nativa: `packages/{frontend,ui}/tsconfig.native.test.json`, ligados
  ao script; apareceu um erro real em `Form.native.test.tsx`. Pendência: tirar
  `**/*.native.test.ts(x)` do `tsconfig.json` web do frontend depende de tipar o
  mock de `setInterval` em `HistoricoDetalhePage.api.web.test.tsx:411`.
- Na corrida de duas confirmações com o mesmo CNPJ (entrada 319), a conta
  conectada perdedora registrava `WEBHOOK_CREATE_UNKNOWN` por herdar o estágio
  do POST; agora registra o código da própria falha depois que o webhook foi
  confirmado.

Validar: `pnpm hygiene`, `pnpm typecheck`, `pnpm test:unit` completo e
`pnpm test:identity`. Lição: papel de teste que sobra no cluster indica limpeza
que falhou; o cluster descartável tinha 69 papéis órfãos ao fim da onda.

## 319. Aprovação da conta se desfazia sem documento normalizado na organização

**Implementação:** 2026-10-07, sem commit (onda 134, terceira rodada do S9).
**Status:** corrigido; riscos residuais documentados.

Causa: na primeira aprovação completa, `payment-accounts/configuration.ts`
gravava `organizations.documentVerifiedAt` sem `documentNormalized`. Em
organização legada com `documentNormalized` NULL o CHECK
`organizations_document_verified` recusava (23514); com o CNPJ já verificado por
outra locadora, o índice único `organizations_verified_document` recusava
(23505). Nos dois casos a confirmação inteira era desfeita a cada inspeção: a
subconta ficava RESTRICTED com a integração PROVISIONING e a conta conectada
aprovada nunca chegava a ACTIVE.

Solução: a aprovação grava `documentNormalized = documentOf(account)` junto com
`documentVerifiedAt`; se outra locadora já verificou o mesmo CNPJ, esta não é
verificada, a confirmação comita e a auditoria de plataforma
`payment-account.document.in-use` é gravada uma vez, para revisão. Riscos
residuais: duas confirmações simultâneas com o mesmo CNPJ (a segunda recebe
23505 e se recupera na tentativa seguinte) e conta cujo CNPJ outra locadora
verificou continua ativa só com a auditoria (segurar depende do S12). Validar:
`tests/identity/subaccount-provisioning-database.test.ts` (casos B6 legados) e
`tests/unit/connected-account-configuration.test.ts`. Lição: escrita que liga
duas colunas por CHECK precisa gravar as duas; teste com organização legada
(`document` formatado, `documentNormalized` NULL) é o caso real da GB.

## 318. Corrida de catálogo nos testes: GRANT concorrente falhava com XX000

**Implementação:** 2026-10-07, sem commit (onda 134, lote acl-testes).
**Status:** corrigido.

Causa: arquivos de teste em paralelo no mesmo banco descartável concediam e
revogavam privilégios nos mesmos objetos (schema `public`, `organizations`,
`settings`...). GRANT, REVOKE, DROP OWNED e ALTER ... OWNER TO regravam a linha
do objeto no catálogo, e o PostgreSQL recusa a segunda regravação concorrente
com XX000 "tuple concurrently updated" em vez de esperar. A validação da onda
133 caiu em `organization-selection.test.ts`, no GRANT de
`tests/helpers/platform-fixture.ts`. No estresse, 261 a 269 de 640 operações
falhavam.

Solução: porta única `tests/helpers/shared-acl.ts` (`alterSharedAcl`,
`alterSharedAclInTransaction`), numa transação que começa por
`pg_advisory_xact_lock` de chave fixa; migraram os helpers, quatro testes de
`tests/unit`, o `global-setup` e 24 arquivos de `tests/api-host`. O gate
`tests/unit/shared-acl.gate.test.ts` reprova essas instruções fora do helper
(inclusive em `DO $$`, `EXECUTE` e variáveis), com exceções motivadas só para
arquivos de banco ou schema próprio (o lock consultivo vale por banco). Com o
helper: 0 de 640 e 0 de 1.280. Validar: `tests/unit/shared-acl.test.ts` (as três
formas de escritor param no meio e seguram o lock até o COMMIT) e o gate. Lição:
um lock consultivo só serializa quem o toma; a porta precisa ser única e
guardada por gate. Guia em `docs/guides/testing.md`.

## 317. Teste de concorrência da configuração falhava com a sonda global de transação

**Implementação:** 2026-10-07, sem commit (onda 134, S9, bloco B0). **Status:**
corrigido; nenhuma regra de produção mudou.

Causa: a sonda "idle in transaction" do fixture de
`tests/identity/secrets-database.test.ts` contava a transação de claim legítima
do segundo worker; a falha do `expect` virava
`ACCOUNT_CONFIGURATION_UNAVAILABLE` e nenhum dos dois concluía (21 de 30
execuções instrumentadas). Solução: caso determinístico (A parado no provedor, B
recusado com `ACCOUNT_BUSY`) e variante simultânea sem a sonda global; remover o
lease de `configuration.ts` derruba os dois. Validar: três execuções seguidas de
`pnpm test:identity`.

## 316. Subconta criada precisava de saúde, aprovação e barreira de emissão

**Implementação:** 2026-10-07, sem commit (onda 134, S9, parte B e segunda
rodada). **Status:** instalado com `PLATFORM_SUBACCOUNT_CREATION` desligada;
documentos, confirmação anual, recuperação assistida e barreira da conta
conectada pendentes.

Causa: a saúde só aceitava conta conectada e sempre ativava a integração; a
emissão só olhava a integração `ACTIVE`; o consumidor de eventos não distinguia
subconta em criação; não havia rota, composição nem tela. Estender só a saúde
abriria a emissão para uma subconta não aprovada.

Solução: saúde por modo com integração `ACTIVE` só na primeira aprovação, sem
rebaixar; eventos de subconta em criação viram recibo `IGNORED`; barreira 409
`PAYMENT_ACCOUNT_NOT_READY` antes da escolha da integração; rotas `create` nos
dois hosts; formulário que nunca envia valor não digitado; o aviso "Pedido
recebido" sai quando o pedido volta na mesma sessão; a varredura de vazamento
T-S3 lê o console como ele é impresso (objetos e erros). Lições: a fixture de
paridade do `test:api` precisa dos mesmos grants do `app_runtime.sql` canônico
(senão a rota devolve 500); `beforeEach(() => mock.mockClear())` vira teardown;
o `CurrencyInput` informa 0 no blur; marcadores de vazamento precisam ser
disjuntos. Validar: `tests/identity/subaccount-provisioning-database.test.ts`,
`tests/unit/billing-database.test.ts`, `tests/security/secret-leak.test.ts`, os
testes de `pages/recebimentos-admin` e
`tests/api-host/owner-payment-account-create.http.test.ts` nos dois motores.

## 315. Criação de subconta precisava de valor exato, intenção durável e selagem imediata

**Implementação:** 2026-10-07, sem commit (onda 134, S9, parte A). **Status:**
corrigido no backend; ver 316 para hosts, saúde e tela.

Causa: o transporte `POST /accounts` existia sem chamador; o contrato tinha
faixas, que o Asaas não aceita como `incomeValue`; não havia onde guardar o
valor só até o envio, nem regra para resultado incerto, recusa definitiva ou
recusa da chave raiz.

Solução: contrato com o valor exato (decisão de 2026-10-06); tabela de pedido só
da plataforma com purga única (D-2); oferta READ ONLY e pedido atômico; worker
que busca antes de criar, grava a intenção sob lock do CNPJ com a inspeção já na
fila e faz um único POST; chave selada na primeira transação depois da resposta
(1 + 3 tentativas; depois `KEY_RECOVERY_REQUIRED` sem segredo); incerto nunca
repete o POST; recusa definitiva volta ao dono (D-3); chave raiz recusada espera
1 h. Lições: preflight de migration em tabela com FORCE RLS usa CHECK, não
SELECT do dono; migration sem BEGIN/COMMIT explícitos mostra a causa no
`prisma migrate deploy`; nomes de índice seguem o truncamento de 63 caracteres
do Prisma; `dedupeKey` fixa na outbox de plataforma não reenfileira. Validar:
`tests/identity/subaccount-provisioning-database.test.ts` e
`tests/unit/{owner-payment-account-create-http,migration-preflight-rls,asaas-subaccounts}.test.ts`.

## 314. Vitrine sem conteúdo institucional, com promessas para qualquer locadora e textos legais da GB no código (U5)

**Implementação:** 2026-10-07, sem commit (onda 134, lote vitrine-conteúdo).
**Status:** corrigido. Pendentes: frota (D-B) e nota com fonte (D-A) da GB,
preenchidas pelo dono no painel; Termos para publicar (D-C(2)) e versão aceita
no orçamento (D-F) em lotes próprios; frete por locadora (P-1).

Sintoma: depois da onda 132 nenhuma locadora mostrava anos, frota, construtoras,
história, linha do tempo, mapa ou selo do Google; as promessas do modelo
("Entrega Gratuita", "Suporte 24h"...) valiam para qualquer locadora; Termos,
Privacidade e Devolução eram o texto da GB para todas; na pausa as legais
davam 503.

Causa: não havia campo por locadora e o texto legal morava no frontend.

Solução: `settings.siteContent` com 11 compromissos desligados por padrão e
documentos legais por locadora (migration `202610060201`), leitura pública e
rotas nos dois hosts, vitrine web e app só com o dado da locadora, documentos
renderizados só como texto, orçamento sem Termos sem caixa de aceite, legais
fora do 503 da pausa, painel web e nativo, script da GB uma vez por campo
(auditoria `GB_SITE_SETTINGS_APPLIED`; rodar de novo não desfaz o que o dono
mudou). Armadilhas: o contrato é universal (sem `TextEncoder` no app; teto em
bytes contado à mão); `Json?` nulo restaurado por `create` precisa de
`Prisma.DbNull`; `animationDelay` antes do atalho `animation` no mesmo estilo
inline vale na atualização. Limite aceito: a Sobre fica fora da captura visual
(carrossel 3D importado direto) e é provada pela marcação estática byte a byte e
pelos goldens de texto; as seções novas do painel só ganham referência visual
quando a moldura administrativa (entrada 295) regravar o painel. Validar:
`pnpm test:unit` (T12, compromissos, goldens, script), `pnpm test:platform`,
`test:mobile`, `test:api` nos dois motores (inclui
`storefront-legal-paused.http.test.ts`) e a linha de base visual.

## 313. Leituras de conta e GET dos motores de identidade aceitavam Origin de locadora irmã

**Implementação:** 2026-10-06, sem commit (onda 133, achado 149). **Status:**
corrigido.

Causa: a onda 132 aplicou `rejectExplicitCrossOrigin` só no principal privado.
`/api/auth/organizations`, `/current`, o GET de `/selection`, os GET do Better
Auth (`get-session`, `list-sessions`, `list-accounts`, `account-info`) e os GET
do NextAuth (`session`, que relia a credencial no banco, `csrf`, `providers`)
respondiam 200 a Origin de locadora irmã, do painel num host de locadora ou
`null`; o cookie host-only acompanha um `fetch` de mesmo site, e só o CORS
impedia a leitura.

Solução: recusa depois da sessão e antes dos dados nas rotas dos dois hosts e no
handler de seleção; regra única dos dois motores em
`packages/backend/src/modules/identity/engine-read-origin.ts`, aplicada por
`handleIdentityRequest` (Better Auth) e por `withSignInAvailability` (NextAuth)
antes do motor, com exceções para as navegações de OAuth, oauth-proxy, app e
links de e-mail. `/owner-account` e `/slug-availability` já recusavam
(`onboardingAppOrigin`). Validar: `pnpm test:security` (`account-read-origin`,
`identity-read-origin`, `nextauth-read-origin`, `route-auth-inventory`) e
`test:api` no perfil do CI nos dois motores. Lição: ao generalizar uma regra no
ponto central, inventariar as leituras que não passam por ele, inclusive as dos
motores de identidade; uma regra de leitura vale para os dois motores.

## 312. Vitrine sem CNPJ e horário, sigla "GB" nas telas de senha e catraca de tokens vermelha

**Implementação:** 2026-10-06, sem commit (onda 133, achados 146 a 148).
**Status:** corrigido; horário e CNPJ no app móvel e formulário do horário no
painel pendentes.

Sintomas: (146) `/recuperar-senha` e `/reset-password` de outra locadora
mostravam a sigla "GB" (web e app), e a prévia SEO do painel exibia "4.9 · 500+
avaliações" para qualquer locadora; (147) depois da onda 132 nenhuma vitrine
mostrava CNPJ nem horário (a produção da GB mostrava; Decreto 7.962/2013, art.
2º, I e II); (148) `pnpm tokens` reprovava 29 classes
`bg-/text-/border-[var(--color-*)]` em `AdminLayoutShell.web.tsx` e nos
`tipos.web.ts` de logística e manutenção.

Causa raiz: (146) `FRAME.storefront.mark: "GB"` e o literal "GB" do nativo, que
o T12 não procurava; nota fixa no JSX da prévia. (147) A leitura pública das
configurações não trazia `businessHours` nem dado legal da organização, e o
cartão do diretório proíbe CNPJ. (148) A divisão de arquivos trocou
`bg-blue-100` por `bg-[var(--color-blue-100)]`, grafia que a catraca da onda 132
passou a contar.

Solução: (146) sigla de `useMarcaDoAcesso` nas duas telas; linha de avaliações
fora da prévia; T12 com os padrões "sigla da GB como marca" e "contagem fixa de
avaliações". (147) `GET /api/settings/public` com `businessHours` e
`legalIdentity` (contrato em `packages/contracts/src/settings.ts`, regra em
`packages/backend/src/modules/catalog/public-settings.ts`), formatação em
`packages/frontend/src/entities/configuracao/model/{horario-de-funcionamento,identificacao-legal}.ts`;
sem dado = omissão. (148) tokens `--status-*` e `--surface-admin-canvas` em
`packages/design-tokens/src/tokens.css` com os valores da paleta; fixture de
paridade regenerada. Segunda rodada (147): a trava do `--apply` em
`checkGbOrganization` (`tools/gb-site-settings.mjs`) usa a ordem da vitrine
(`documentNormalized` antes de `document`, primeiro não vazio, só a máscara
`[./-\s]` sai), de modo que trava verde implica a linha "CNPJ:
34.780.330/0001-69" no site; antes, o legado da GB com o normalizado de outra
empresa liberava a gravação. Validar: `pnpm tokens`,
`tests/unit/gb-site-settings.test.ts` (banco descartável),
`tests/unit/t12-sem-dados-da-gb.test.ts`, `pnpm test:platform`, `test:api` no
perfil do CI e a linha de base visual (`tests/visual/README.md`).

## 311. Guarda do banco, ambiente da integração e catraca de paleta com escapes

**Implementação:** 2026-10-06, sem commit (onda 132, achado 145). **Status:**
corrigido; limites residuais aceitos e documentados.

Causas: a guarda do banco descartável supunha a porta 5432 e lia o primeiro
valor de chave repetida, mas o driver pg usa PGPORT/PGDATABASE/PGUSER e fica com
o último; o `next dev` de integração completava pelos `.env` do desenvolvedor
todo segredo ausente no shell; a catraca de paleta só via `var(--color-*)`
sozinho; casos pesados estouravam o prazo padrão sob carga.

Solução: `databaseTarget` espelha o pg (comparado com o pg instalado em 64
combinações); `TEST_DATABASE_URL` sem host ou porta na query; `.env` esvaziado
no servidor de teste; `readsPalette` provado contra o compilador do Tailwind
4.3.3; `fileParallelism: false` no `test:api`; prazos explícitos medidos.
Limites aceitos: grafias exóticas (`VAR(_--…)`) e URLs `socket:` com porta na
autoridade; o modelo é erro acidental. Validar:
`tests/unit/test-database.test.ts`, `tests/unit/global-setup.test.ts` e
`tests/unit/token-check.test.ts` (vitest unit).

## 310. GET privado aceitava Origin explícito de locadora irmã

**Implementação:** 2026-10-06, sem commit (onda 132, achado 144). **Status:**
corrigido no principal comum; leituras de conta na onda 133.

Desde a onda 97 a requisição real chega ao principal e a regra central aceitava
métodos seguros; a onda 131 recusou Origin explícito só em badges e WhatsApp (e
Zoho, entrada 285). As demais leituras privadas devolviam 200 com dados para
Origin de locadora irmã. Solução: `rejectExplicitCrossOrigin`
(`packages/backend/src/modules/identity/same-origin-mutation.ts`) chamada pelo
principal depois do vínculo e antes da assinatura e dos dados. Validar: builds
do legado e do serviço,
`API_HOST_MODE=production API_LEGACY_MODE=production pnpm test:api` com
`API_AUTH_MODE` legacy e better-auth, e `pnpm test:security`. Lição: a regra de
mesma origem para leitura mora no ponto central, não rota a rota.

## 309. Vitrine com dados e fatos da GB em locadora de outro dono (T12)

**Implementação:** 2026-10-06, sem commit (onda 132, achados 142 e 143).
**Status:** corrigido no código; CNPJ/horário públicos (onda 133), conteúdo
institucional (decisão D2) e textos legais (U5) pendentes.

Sintoma: uma locadora sem configurações mostrava o CNPJ, o endereço, os
horários, o WhatsApp, as construtoras clientes, os anos de mercado e a nota de
avaliações da GB; o formulário de configurações gravava os dados da GB em outra
locadora; a pausa aparecia dentro da navegação completa da vitrine. Causa: dados
e fatos da GB fixos em cerca de 60 arquivos do frontend, e o T12 só procurava
identificadores. Solução: identidade pela `IdentidadePublicaProvider` (cartão da
locadora), fatos sem fonte removidos, região pela cidade/UF, moldura neutra da
pausa, T12 ampliado e `tools/gb-site-settings.mjs` com trava de CNPJ para o
corte da GB (`docs/operations/gb-site-settings.md`). Validar:
`pnpm test:platform`, `tests/unit/t12-sem-dados-da-gb.test.ts` e
`tests/unit/gb-site-settings.test.ts` (banco descartável).

## 308. Checkpoint da onda 130: plataforma, web e paridade visual vermelhos

**Implementação:** 2026-10-06, sem commit (onda 131, achado 141). **Status:**
corrigido localmente.

Causas: parâmetro chamado `document` em `packages/contracts/src/onboarding.ts`
(trava léxica do contrato universal); varredura de cerca de 2 mil arquivos com o
prazo de 5 s de teste unitário sob carga; testes de texto da fonte afirmando
aspas duplas depois do Prettier; export novo `useNavigate` sem classificação no
catálogo; `AdminLayoutShell` reexportado pelo barril que o host de locadora
importa; classes `[var(--color-*)]` sem valor da produção e uma variável
`paused` lida pelo Tailwind como utilitário.

Solução: renomeação; prazo de disco de 60 s com pré-filtro; asserções que
aceitam os dois tipos de aspas; `useNavigate` em `navigation`; chamadas do menu
em `PANEL_ONLY` com teste do motivo (allowlist intocada); `toProduction` mapeia
o tom por variável; `pausedSite`; fixture de paridade regenerada sem alterar
valores existentes. Validar: `pnpm test:platform`, `test:web`, `test:mobile` e
`test:visual-tools`.

## 307. Suítes vermelhas no checkpoint: relógio da fixture, dublês e runbook da 0110

**Implementação:** 2026-10-06, sem commit (onda 131, achado 140). **Status:**
corrigido localmente; regras de produto, RLS e papéis inalterados.

- `owner-subscription-cancellation` criava a `PlanVersion` com `sellableFrom` no
  default `now()` e comandava no relógio sintético; a oferta virou "futura" e a
  reativação respondeu `PLAN_NOT_AVAILABLE`, corretamente. A fixture fixa a
  data.
- O dublê de `tests/security/webhook-inbox.test.ts` não tinha
  `organization.findUnique` (trava administrativa da onda 88): o TypeError
  virava 503. Agora devolve ACTIVE por padrão, com casos SUSPENDED e ausente.
- `tests/unit/database-runtime.test.ts` trocava `@prisma/client` inteiro; a
  entrada runtime avalia `Prisma.Decimal` no import. Mock parcial.
- A migration `202610030110` (não implantada) levantava código sem a recuperação
  Prisma exigida pela guarda do achado 110; só o texto do RAISE mudou.

Lição: fixture com relógio sintético precisa fixar toda data que o serviço
compara com o seu `now()`. Validar: `pnpm test:identity`, `test:security` e
`test:unit` com banco descartável.

## 306. Guarda do banco de teste recusava o valor gravado pelo próprio setup

**Implementação:** 2026-10-06, sem commit (onda 131, achado 139). **Status:**
corrigido sem afrouxar a guarda.

`pnpm test:integration` falhava em 11 de 15 arquivos com
`TEST_DATABASE_URL must not target the same database as DATABASE_URL`: a onda
130 passou a chamar a guarda dentro do worker (`publishTestOrganizations`)
depois de `tests/setup.ts` gravar DATABASE_URL/DIRECT_URL com o banco de teste,
e a guarda não distinguia esse valor de um DATABASE_URL real.
`applyTestDatabase` (`tests/helpers/test-database.ts`) registra os originais num
WeakMap por objeto de ambiente (símbolo do processo) e isenta só o valor exato
gravado.

Validar: `tests/unit/test-database.test.ts` e
`TEST_PORT=<porta> TEST_DATABASE_URL=<*_test migrado> TEST_DATABASE_DISPOSABLE=true pnpm test:integration`
(81/81). Não rodar junto com `pnpm test:api`: o Next 16 admite um `next dev` por
pasta.

## 305. Paridade HTTP vermelha com dois workers e GET de origem irmã nas leituras privadas

**Implementação:** 2026-10-06, sem commit (onda 131, achado 138). **Status:**
corrigido nas 8 rotas com contrato; generalização no principal na onda 132.

Causas: `--maxWorkers=2` sobrescreve o `maxWorkers: 1` de `vitest.api.config.ts`
e os arquivos de `tests/api-host` dividem servidores, papel e fixtures; a suíte
rodou em dev, mas várias asserções valem só em produção; desde a onda 97 a
requisição real chega ao principal e GET é método seguro, então badges e as
leituras de WhatsApp aceitavam Origin de locadora irmã; `whatsapp-write`
afirmava 503 para locadora SUSPENDED, contra a onda 89.

Solução: guarda de um worker no global-setup; `rejectExplicitCrossOrigin` no
`packages/backend/src/http`, aplicada nas 8 rotas dos dois hosts (padrão da
entrada 285); teste do webhook suspenso alinhado à onda 89. Validar: builds do
legado e do serviço, depois
`API_HOST_MODE=production API_LEGACY_MODE=production pnpm test:api` com
`API_AUTH_MODE` legacy e better-auth, sem `--maxWorkers`.

## 304. Crons de divulgação percorriam locadoras fora de FULL

**Implementação:** 2026-10-06, sem commit (onda 130, achado 137). **Status:**
corrigido localmente; fiscalização real continua off.

O runner de cron de tenant listava toda organização ACTIVE sem saber o tipo do
job: um job de divulgação rodaria em SETUP, RESTRICTED e ARCHIVED, contra a
matriz B.5 e a linha "Jobs" da B.10 da ADR SaaS.

Solução: catálogo `TENANT_CRON_JOBS` no runner compartilhado
(`packages/backend/src/http/tenant-cron.ts`) e declaração obrigatória de `job`
em cada rota de cron dos dois hosts. Divulgação segue
`PLATFORM_SUBSCRIPTION_ENFORCEMENT` (off sem efeito, shadow registra, on pula
fora de FULL); obrigação nunca lê a flag. A agenda (checkpoint, orçamento e
reserva) é tudo ou nada no tipo e em execução: a primeira rodada aceitava agenda
parcial com prazo `NaN`, corrigido na segunda.

Validar: `packages/backend/src/http/tenant-cron.test.ts` (vitest platform) e
`tests/unit/tenant-cron-jobs.test.ts` (com banco descartável). Lição de higiene:
`pnpm build:api` apaga `apps/services/api/.next` mesmo quando falha por EBUSY;
nunca rodar enquanto outro processo serve `.next/standalone`.

## 303. Vitrine pública ignorava pausa, publicação e indexação (S13)

**Implementação:** 2026-10-06, sem commit (onda 130, achado 136). **Status:**
corrigido localmente; despublicação, páginas legais em pausa e leitura do cartão
pelo proxy (D2) aguardam decisão.

O resolvedor público aceitava qualquer organização ACTIVE. Locadora com
assinatura suspensa (RESTRICTED), não publicada, em SETUP ou ARCHIVED continuava
com catálogo, carrinho e orçamento no ar e indexáveis.

Solução: `decidirModoDoSite` e `decidirAreaDoCliente`
(`packages/domain/src/assinatura/`), aplicadas pelo resolvedor do backend e, por
ele, pelos dois hosts, com superfícies storefront, identity, card e client-area.
Contrato `SITE_PAUSED` em `packages/contracts/src/subscription.ts`. O proxy do
host web entrega `/{slug}/site-pausado` com 503, Retry-After e noindex;
`robots.txt` e `sitemap.xml` por estado. A publicação não depende da
fiscalização; off e shadow nunca pausam. Organização de teste criada fora do
contexto de plataforma nasce sem publicação e fica OFF: publique pela fixture
`tests/helpers/public-site.ts` (papel restrito de plataforma).

Validar: `packages/backend/src/modules/identity/public-tenant.test.ts`,
`tests/security/public-site-state.test.ts`, os testes de `host/routing`,
`host/server` e `app/(public)/[locadora]` do web e a prova HTTP da onda 130 de
`docs/features/shared-api-host.md`. Arquivos em
`docs/features/site-por-estado.md`.

## 302. Subconta incerta precisa de inspeção sem repetir a criação

**Implementação:** 2026-10-05, sem commit. **Status:** ramo de consulta validado
localmente; provisionamento completo e homologação continuam parciais.

Após timeout/5xx, o provedor pode ter criado a conta e devolvido uma chave que
não chegou ao processo. Um GET vazio não prova ausência definitiva nem permite
repetir o POST. Faixas provisórias também não determinam a renda mensal que o
Asaas exige; a decisão humana foi apresentada antes de adaptar coleta/schema.

Billing/asaas-subaccounts limita a busca por CNPJ e exige confirmação por id,
documento e carteira. Payment-accounts/uncertain-provisioning usa somente find,
por runtime/fila existentes. UNKNOWN sem chave inspeciona; ausência/transiente
agenda nova leitura, inválido bloqueia e conta confirmada exige recuperação
manual. Locks, tenant/owner, versão de trabalho e chave são revalidados após
I/O. Integração continua PROVISIONING; binding, estado e auditoria têm commit
único. Referências de outra conta são recusadas. Não há leitura de chave remota
nem aprovação automática.

Validar: tests/unit/asaas-subaccounts.test.ts,
tests/unit/uncertain-subaccount-recovery.test.ts e
tests/identity/account-health-database.test.ts; matriz consolidada na onda 129
de shared-api-host.md. Papéis canônicos, rollback, concorrência e ambos os cron
hosts comprovados localmente com transporte sintético. Sem provedor real,
produção ou retirada do legado. Dois símbolos agora usados em produção saíram
das tolerâncias antigas de higiene; nenhuma tolerância nova.

> **Documento de Referência**: Problemas técnicos já enfrentados e resolvidos no
> projeto. Consulte este arquivo antes de investigar bugs similares.
>
> Atalho para IA: leia `docs/issues/known-issues.index.md` e use
> `rg -n "palavra" docs/issues/known-issues.md` para abrir apenas secoes
> relevantes.
>
> Cada entrada descreve o código da data dela: caminhos e APIs de entradas
> antigas podem ter mudado ou saído (por exemplo `components/`, `hooks/`,
> `lib/validations/schemas`); confira no código atual antes de seguir.

---

## 266. Configurações sem consumidor Expo e modelo acoplado ao DOM

**Implementação:** 2026-10-03, sem commit. **Status:** bloco funcional local
validado; aparelhos, fidelidade dos previews e operação pendentes.

O modelo de configurações misturava regras do formulário com HTMLInputElement,
scroll DOM e mensagens JSX. A página não tinha destino nativo. Upload de
carrossel precisava da mesma porta autenticada usada pelo restante da página.

Modelo comum preserva carga, payload integral, campos ocultos, defaults e reset;
fachada web mantém input/scroll/mensagens. Native compõe seis seções e recebe
picker/imagem do host. Transporte existente mantém autenticação; MIME/5 MiB e
quantidade são conferidos antes de upload. Revisão da seção impede retomar
seleção antiga ao sair e voltar. Permissões nativas existentes foram
caracterizadas; wrappers consideram status e dashboard liga destinos reais.

Arquivos: pages/configuracoes, wrappers/teste de pages/permissoes,
DashboardPage.native.tsx e host/settings-image-picker.native.ts/rotas Expo.
Validar com 50 focados, 64 mobile/183 web, doze TS, gates/builds/exports; onda
83 de docs/features/shared-api-host.md. AST mantém 137 atributos/40 callbacks,
seis previews web, defaults e HTML das três mensagens iguais.

Não cria regras de autorização no cliente, redes sociais adicionais ou execução
de código customizado no preview. Desenho/SVG/gestos/teclado/upload reais exigem
aceite em aparelho. API/RLS/scheduler/legado ficam ativos; não autoriza retirar
app/.

## 265. Operações Expo ausentes e contratos misturavam DTOs com ícones web

**Constatação/implementação:** 2026-10-03. **Status:** consumidor nativo e
contratos comuns implementados localmente; aparelho/visual/operação pendentes.

Os DTOs de logística/manutenção estavam em tipos.ts junto de lucide-react e
classes web; os calendários eram mapeados dentro das páginas DOM. Checklist e
formatação também precisavam de contratos comuns. Esses acoplamentos impediam um
consumidor native sobre a mesma lógica.

Contratos/rótulos, formatação, checklist e mapeadores foram separados dos
adapters web, preservando os corpos e a API pública. Native compõe os modelos de
carga existentes e calendário por recurso/dia. O upload do diálogo web agora
recebe porta HttpClient autenticada, também usada no native; picker e imagem
continuam no host. Escopo/revisão/seleção/cancelamento descartam conclusão
antiga.

Arquivos: pages/logistica, pages/manutencao, widgets/calendario,
Dashboard.native e rotas Expo logistics/maintenance. Validar por 76 focados, 62
mobile/183 web, doze projetos TS, gates, build web e exports Android/iOS; onda
82 de docs/features/shared-api-host.md. AST comprova 215 atributos/63 callbacks
web e corpos de calendário iguais. Nove badges computados/pixels iguais com
paleta canônica; 27 ocorrências eliminadas sem ampliar baseline.

Nova Entrega e Agendar Manutenção continuam pendentes como no web. A grade
native não certifica Gantt/sobreposição/gestos/visual em aparelho. API/RLS/
scheduler e implantação não mudaram; não autoriza remover app/.

## 264. Financeiro administrativo sem consumidor Expo e dependência indireta DOM

**Constatação/implementação:** 2026-10-03. **Status:** consumidor e modelos
comuns implementados localmente, sem commit; aparelho/visual/operação pendentes.

carga/detalhe importavam Next, confirmação bloqueante e exportação de navegador.
O tipo CalendarEvent vinha do barrel de UI do calendário: ao levar o modelo para
o programa nativo, TypeScript passou a verificar componentes DOM daquele barrel.
A solução é DTO financeiro puro em model/tipos.ts, modelos comuns e
facades/portas distintas; não se excluíram arquivos nem se relaxou o typecheck.

Confirmação nativa aguarda Alert, mantém exclusão por lançamento e revalida os
clientes após a resposta. Portas de arquivo recebem bytes e isCurrent, evitando
entrega tardia ou segunda chamada pública. 202/negativas, settings/snapshots,
seleção/ids, categorias exclusivas e sequência parcial de reajustes continuam.

Arquivos: pages/financeiro/model e ui, index.native; rota Expo financeiro,
rotas/modelos de orçamentos e dashboard para atalhos reais. Validar por 122
casos focados (incluindo confirmação tardia/duplicada e negativa de arquivo),
test:mobile, test:web, typecheck, arch, tokens, lint:css, hygiene, ratchet,
colocation, builds/exports e aceite em aparelho. Ver onda 81 de
docs/features/shared-api-host.md.

Não certifica aparência web/nativa, efeitos no provedor real ou retirada da API
legada. Agregados/CSV e política final de exclusão continuam pendentes.

## 263. Orçamentos administrativos sem consumidor Expo e modelos acoplados ao web

**Estado: implementado localmente na onda 80 (2026-10-03, sem commit); aparelho,
paridade visual e operação pendentes.**

Causa: dados/detalhe dependiam de Next, Sonner e evento DOM; o entry point
montava apenas componentes web. Copiar ações para mobile duplicaria condições de
aprovação, sequência de reajustes, feedback de emissão e guardas de ciclo.

Solução: modelos comuns com portas de search/quoteId e invalidação; facades web
preservam navegação/animação/evento. Rascunhos e calendário comuns, cinco
apresentações native e dois hosts finos. Compartilhamento recebe bytes/nome/
ciclo, não um endpoint público. Seleção/respostas antigas descartadas.

Validação: 47 casos focados, 62 mobile/183 web (sete skips anteriores),
tipos/gates/builds/exports; AST conserva 136 atributos visuais web e 21 ações.
Nenhuma baseline/proteção ampliada. Arquivos: slice orcamentos-admin, condição
do pacote, rotas Expo e contract-share.
[Resultados e limites](../features/shared-api-host.md), onda 80.

Agenda/pipeline são adaptações funcionais e datas usam AAAA-MM-DD; fidelidade,
aparelho, arquivo/URL real e operação exigem aceite. 202/409 e recusa parcial de
reajustes preservados; encerrar ciclo não desfaz efeito remoto. Backend e legado
intactos.

## 262. Locações administrativas e documentos privados sem consumidor Expo

**Estado: implementado localmente na onda 79 (2026-10-03, sem commit); aparelho
e paridade visual do calendário pendentes.**

Causa: entry point de locações importava UI DOM; tipos traziam ícones web e
modelo usava Sonner/File. Seleção de arquivo no Expo exige uma porta assíncrona
que não pode prosseguir após fechar seleção ou mudar contexto.

Solução: DTOs/formatadores compartilhados, toast por facade, FormData aceito
pelo modelo existente e porta de seleção com ciclo/bloqueio.
Lista/detalhe/agenda nativos reutilizam comandos; host só seleciona arquivo e
abre URL recebida. Wrappers reiniciam por contexto/sessão/revisão. API/ACL/RLS
não mudaram.

Validação: 23 casos focados, 61 host mobile/183 web (sete skips anteriores),
tipos/gates/builds/exports; 171 atributos visuais web iguais por AST. Nenhuma
baseline/proteção ampliada. Arquivos: slice locacoes, rental-documents.native e
rota Expo. [Resultados e limites](../features/shared-api-host.md), onda 79.

Agenda nativa não replica grade/colunas visuais web. Arquivo/link real,
TTL/aplicativo externo/aparelhos e operação externa ainda exigem aceite.

## 261. Categorias administrativas e seleção de SVG ausentes no Expo

**Estado: implementado localmente na onda 78 (2026-10-03, sem commit); aceite em
aparelho/visual pendente.**

Causa: o entry point de categorias importava DOM; carga.ts concentrava
window/document/confirm e Sonner. Bloco.native existia sem consumidor admin e
integração de arquivo. Respostas/seleções pendentes precisavam respeitar
contexto.

Solução: carga comum com portas de confirmação/scroll, adapter web,
category-form compartilhado e três apresentações nativas. Seleção/leitura SVG só
no host; mappers/comandos continuam os mesmos. Ciclos descartam seleção/
resposta/confirmacão antiga. SVG/URL só entram no payload após salvar o ícone.

Validação: tela/modelo/API/topologia/contrato, tipos/gates/builds/exports; 143
atributos visuais web idênticos por AST. Sem proteção ampliada; uma entrada de
higiene removida após eliminar export sem consumidor. Arquivos: slice
categorias, widget personalizar-icone, category-svg.native e rota Expo. Ver
[onda 78](../features/shared-api-host.md) para resultados/limites.

Apresentação em aparelho, SVG/overlays e preview/animação exigem aceite.
Sanitização/URLs históricas preservadas; esta onda não certifica essas
políticas.

## 260. Formulários de equipamento ausentes no Expo e salvamento de perdas dependente de setters

**Estado: corrigido localmente na onda 77 (2026-10-03, sem commit).**

Cadastro/edição web concentravam estado e integração Next; o upload genérico
usava fetch relativo, e ImageUpload nativo aceitava apenas URL. Destinos Expo de
cadastro/edição não existiam. Salvamento de perda usava variáveis preenchidas
dentro de setFormData e timer para obter o snapshot, dependência inadequada da
execução dos setters React.

Modelos comuns extraem carregamento, validação, DTO, preços/especificações,
carrossel e perdas. Snapshot explícito monta o PUT imediato; falha restaura
histórico/contador sem descartar outros campos. Perdas não acrescentam imagens
ao array público. Upload usa a origem/sessão/locadora do transporte configurado
e multipart file sem Content-Type manual; host Expo integra picker instalado, UI
recebe portas e mantém limite/ordenação/principal/remoção.

Scope mantém usuário, sessão, locadora/papel, registro e transporte. Ciclo
antigo não envia após fechar o picker nem apresenta URL antiga; revisão do
rascunho descarta seleção concluída depois de cancelar a perda. Confirmação
encerrada não grava. Switch/Select nativos recebem rótulos acessíveis.

Arquivos: modelos e apresentações em pages/equipamentos-admin; ImageUpload,
Switch/Select/CustomSelect em packages/ui; rotas/picker em apps/clients/mobile.
Validação: 60 casos/19 arquivos, 58 mobile, 183 web com sete skips anteriores,
doze projetos TS, gates e builds web/Android/iOS. AST: 293 atributos web
preservados; source maps sem formulários DOM da slice. Aparelhos/visual,
categorias/SaaS/operação e cutover continuam pendentes. Legado/agenda ativos.

## 259. Catálogo administrativo Expo ausente e estado preso a integrações web

Onda 76, 2026-10-03, sem commit. Listagem/detalhe de equipamento não tinham
rotas Expo. O modelo de lista dependia de Next, window e document; detalhe e
unidades misturavam estado com JSX e confirm global. Unidades moravam em arquivo
universal apesar de terem apresentação DOM. Textarea native ignorava o rótulo
acessível enviado pelo produto.

Modelos comuns preservam transporte, DTO, filtros, mensagens e ações. Portas de
navegação/confirmar e variantes nativas usam as mesmas operações. Unidades foram
movidas fisicamente para .web, com fachada .ts e contagens anteriores
transferidas por --rename, sem dívida nova. Condição de pacote específica mantém
default web e evita importar seus formulários no runtime nativo. Textarea
repassa aria-label ao RN. Chaves incluem sessão/transporte e a confirmação
assíncrona confere isCurrent depois da espera.

Arquivos: pages/equipamentos-admin/{model,ui,index}, package.json do frontend,
duas rotas Expo e host/equipment-image.native, Textarea native/contract e
registro de transferência. Validação: 46 casos focados, 183 host web/57 mobile,
doze projetos TS, lint/gates/builds; 357 atributos web preservados por AST e
source maps comprovam resolução nativa.

Criação/edição de equipamento e categorias nativas continuam pendentes,
inclusive links para esses destinos. Export não certifica aparelhos/fidelidade
visual. Backend/handlers/legado/scheduler intactos; sem cutover.
[Registro e limites da onda 76](../features/shared-api-host.md).

## 258. Destinos do cliente Expo ausentes e notificações presas ao navegador

Onda 75, 2026-10-03, sem commit. Perfil, endereços e notificações ainda não
tinham rotas nativas. Estado de perfil/endereços morava nas apresentações web; o
hook de notificações fazia fetch relativo e misturava contador DOM com carga.
Uma resposta de sessão/locadora anterior podia continuar o ciclo antigo.

Modelos comuns passam a atender os dois clientes. As três rotas Expo só montam
entrypoints da slice. Notificações usam HttpClient escopado/snapshots e mantêm
storage/evento somente no adapter web. Leitura/exclusão aguardam confirmação;
repetir read não reduz unread duas vezes e refresh antigo não reverte o
snapshot. Erro não é anunciado como caixa vazia. CEP tem revisão por
busca/formulário, ignorando resultado após outro CEP, cancelamento, edição ou
unmount.

Arquivos: pages/{perfil,enderecos,notificacoes}/{model,ui},
features/notificacoes, três rotas (account)/area-cliente e host/routes.test.ts.
Stub de criação sem consumidores retirado com duas exceções obsoletas de
higiene; nenhuma nova. Validação: 64 casos focados, 183 do host web e 57 do
mobile, tipos/lint/gates e builds locais. AST preserva 490 atributos web; source
maps resolvem native.
[Registro e limites da onda 75](../features/shared-api-host.md).

Perfil conserva status/senha/aparelhos ainda pendentes. Badge global web antigo,
push e aceite em aparelhos permanecem dívida; não inferir paridade final.
Backend/handlers, API legada, scheduler, produção e origens intactos.

## 257. Orçamento Expo ausente e continuação com estado anterior

Onda 74, 2026-10-03, sem commit. /orcamento não tinha rota Expo. A página web
misturava estado, regras já existentes e integrações DOM/localStorage; o
formulário alternativo de três passos também era somente web.

O modelo foi extraído para a slice orcamento, com portas de preferências,
parâmetros, foco, imagem e navegação. Variantes nativas usam os mesmos preços,
validações e transportes; o host só fornece AsyncStorage, imagem e parâmetros.
Leitura de preferências tem erro/retry e chave de locadora/usuário. Mudança de
contexto desmonta o ciclo anterior; suas respostas não limpam outro carrinho.

**Correções reproduzidas durante o corte:** a confirmação de fins de semana
esperava 150 ms e retomava handleSubmit com o carrinho anterior, reabrindo a
pergunta. A continuação agora usa o último render confirmado e é descartada no
unmount. Button.native também ignorava aria-label; passa a preservar o rótulo
explícito, mantendo o texto como fallback.

O gate do host web revelou ainda um descompasso da onda 73: a slice de detalhe
chamava GET /api/equipments/{id}, mas o proxy só autorizava a leitura por SSR. A
rota pública já existente voltou à allowlist, com slug do host na query e 400 em
conflito. Padrão de um segmento preserva o bloqueio de subrotas privadas e
administrativas; nenhum ignore ou proteção de teste foi ampliado.

Arquivos: pages/orcamento/{model,ui}, rota Expo (public)/orcamento.tsx,
ui/{contract/button,native/Button.native} e host/routing/{route-table,decide}.
Validação: 124 casos focados, 183 do host web, 57 do mobile, tipos/gates e
builds. 529 atributos web preservados por AST. Ver provas completas e limites na
[onda 74](../features/shared-api-host.md).

Sem aceite em aparelho. Frete e Google Customer Reviews conservam limitações
legadas; detalhes na documentação da onda. API, scheduler e produção intactos.

## 256. Detalhe Expo ausente e modelos de preço presos à apresentação web

Onda 73, 2026-10-03, sem commit. O detalhe não tinha rota Expo; seleção de
período/datas/confirmação vivia nos componentes web. Parser do DTO ficava no
host web e o JSON-LD era DOM alcançável pelo cliente nativo.

A slice existente agora compartilha os três modelos, contratos e parser com o
web, com fachadas/variantes. Host só integra imagem e compartilhamento. Native
reinicia por contexto/registro e descarta resposta antiga. Metadados HTML
continuam no web; native não renderiza script. Nenhum baseline ampliado.

Validar com os testes de equipamento-detalhe, parser/gateway e host Expo; tipos,
lint/gates/builds e source maps. 355 atributos web e 13 inicializadores de preço
preservados por AST. Provas completas na onda 73 de shared-api-host.md.

Orçamento Expo permanece pendente: o destino /orcamento não é declarado pronto.
Aparelho, gestos, Share/recebimento real e marca/scheme provisórios continuam
sem aceite. Backend/legado/scheduler/produção intactos. Feature:
equipment-detail.md.

## 255. Histórico Expo ausente e modelos de detalhe presos ao web

**Recorte implementado/validado localmente:** onda 72, 2026-10-03, sem commit.
Aceite em aparelho permanece pendente.

/area-cliente/historico e seu detalhe não tinham rotas Expo. Lista, timeline,
preços e pedidos viviam nos arquivos web, impedindo reúso nativo sem carregar
dependências de navegador. Polling usava visibilitychange diretamente.

Modelos extraídos nas slices existentes e reutilizados pelo web/native. Fachadas
.tsx resolvem .native.tsx no Expo; hooks de atividade usam AppState ou
visibilitychange. Mudanças de contexto/registro reiniciam páginas e diálogos.
Bloco de preço usa contrato puro; useNavigate existente exposto pelo UI. O
contrato autenticado é compartilhado por adapter do host, com arquivo exclusivo,
verificação de escopo e limpeza precisa. Coleta sem frete/endereço continua
visível quando há agendamento.

Validar por testes colocados de histórico/detalhe/ações/atividade, host
contract-share e rotas, tipos web/native/mobile, AST e source maps. 153 casos
focados, hosts e builds aprovados; resultados e limites na onda 72 de
docs/features/shared-api-host.md. Três nomes de tolerância de higiene saíram
porque agora têm consumidores reais; nenhum limite/allowlist ampliado.

Recebimento em outro app, uso em aparelho e demais destinos permanecem sem
aceite. Nome .html anterior para PDF preservado como dívida própria. Handlers,
origem, scheduler e legado não mudaram.

## 254. Destinos pós-login Expo ainda eram áreas indisponíveis

**Recorte corrigido:** dashboard e visão geral do cliente, onda 71, 2026-10-03,
sem commit. Paridade nativa completa continua pendente.

/admin/dashboard e /area-cliente montavam UnavailableArea apesar das consultas
compartilhadas existentes. O modelo da visão geral também estava preso ao
arquivo web; tipos do dashboard misturavam DTOs e configuração web de ícones.

As rotas finas renderizam variantes nativas das páginas existentes. Modelo da
área do cliente extraído e reutilizado pelo web; DTOs puros separados da
configuração web do dashboard. Wrappers reiniciam por contexto/transporte e
descartam respostas e restauração local antigas. Voltar/sair permanece no host.
As fachadas usam extensão .tsx: uma fachada .ts era preferida à variante
.native.tsx no TypeScript, carregando componentes web no programa mobile.

Validar pelos dois testes nativos colocados e pelos testes web/model/API das
slices, tipos web/native/mobile e source maps Android/iOS. 58 casos focados
únicos, tipos/lint/gates/builds aprovados; estilos e nove helpers web
preservados por AST. Nenhuma baseline/allowlist ampliada. Resultados: onda 71 de
docs/features/shared-api-host.md.

Outros destinos mobile ainda ausentes, imagens do carrinho, gráficos e aceite em
aparelho seguem pendentes. Storage mantém a chave global anterior; rever escopo
de dispensa é dívida própria. Legado, agenda e produção não mudaram.

## 253. Comunicações ignoravam o transporte e continuavam ações de um ciclo encerrado

**Corrigido no recorte:** onda 70, 2026-10-03, sem commit.

WhatsApp/Zoho chamavam fetch no host atual; upload de settings fazia o mesmo. Na
lista de mensagens WhatsApp, new URL recebia caminho relativo sem base e lançava
erro antes da requisição. Formulários/feedback de upload, mensagens, rascunhos,
permissões e reset podiam continuar após mudança de contexto.

Adapters privados das páginas usam HttpClient configurado. Wrappers reiniciam
por locadora/papel/usuário/transporte; ciclos próprios cobrem conversa,
compositor, perfil e pasta. Revisão de seleção impede detalhe atrasado; exclusão
em lote não começa a próxima chamada ao encerrar a pasta. Confirmar reset antigo
não grava. ID novo de rascunho não apaga a digitação. Provider mantém dados
durante refresh e limpa ao mudar transporte.

Validar pelas suítes api/model/UI das quatro páginas e shared/api; ver os
resultados e limites na onda 70 de docs/features/shared-api-host.md.
Classes/estilos/payloads do correio preservados por AST. Rotas/ACL/RLS legadas
não mudaram. Abort não desfaz efeitos remotos. Ponte tipada do correio,
nativo/aparelhos/provedores reais/SaaS/operação seguem pendentes.

## 252. Operações ignoravam transporte configurado e medidores textuais quebravam a apresentação

**Corrigido no recorte:** onda 69, 2026-10-03, sem commit.

Dashboard, manutenção e logística usavam fetch relativo ao host e podiam aplicar
resposta ou feedback após troca de contexto. Adapters privados das páginas usam
HttpClient; wrappers reiniciam por locadora/papel/usuário e a edição de entrega
captura ciclo próprio. Paralelismo, falhas, filtros/paginação, payloads e
estilos preservados. Rejeições secundárias do dashboard são observadas também
quando o principal falha, conservando notificação imediata de falha parcial.

Unidades chegavam com medidores Decimal textuais, mas a renderização chamava
toFixed diretamente. O tipo do consumidor aceita number|string|null e converte
somente na apresentação. Uma casa do horímetro, nenhuma do odômetro, zero e
ocultação de null preservados; backend e DTO não mudaram.

Arquivos: segmentos api/model/ui de dashboard/manutencao/logistica e tipos/UI de
equipamentos-admin. Validar com os testes colocados de carga/transporte e
ManutencaoPage.api.web/GerenciadorUnidades.api.web. 54 casos focados únicos, 12
projetos de tipos, lint/gates/builds aprovados. AST: 96 atributos de estilo,
três corpos e sete cores idênticos. Nenhuma baseline/allowlist ampliada.
Legado/agenda/produção intactos; provedor/aparelho/operação pendentes.

## 251. Catálogo administrativo ignorava o transporte configurado e mantinha efeitos antigos

### Corrigido no recorte da onda 68 (2026-10-03, sem commit)

Categorias, equipamentos e unidades físicas usavam fetch relativo. Respostas
podiam aplicar dados/sucesso/fechamento depois de trocar identidade, registro ou
formulário. Ownership, ACL e RLS continuavam presentes no backend.

Adapters nas páginas donas usam HttpClient. Páginas reiniciam por
locadora/papel/usuário/registro; lista e gravação de formulário têm ciclos
separados. Erro não JSON/statusText da edição preservado por text-response, com
corpo consumido antes de conferir ciclo. Cancelar não desfaz escrita remota.

Arquivos: api/model/ui de categorias e equipamentos-admin,
shared/api/http-client (e testes), fixture de sessão e três fixtures HTTP. 43
casos focados, três HTTP por motor nos dois hosts locais,
tipos/lint/gates/builds aprovados. AST conserva 478 atributos de estilo e sete
corpos. Nenhuma baseline/allowlist ampliada. Banco limpo/processos encerrados;
legado/agenda/produção intactos.

Pendência identificada: medidores Decimal são textuais no JSON dos dois hosts;
GerenciadorUnidades chama toFixed supondo número. Este corte conserva o DTO e a
limitação anterior; correção do renderizador e caso executado com texto são
próximos. Aparelhos/provedores/SaaS/operação pendentes. Provas/limites na onda
68 de docs/features/shared-api-host.md.

## 250. Carga/ações administrativas ignoravam transporte e mantinham continuações antigas

**Recorte corrigido:** onda 67, 2026-10-03, sem commit.

Carga/detalhe de financeiro e orçamentos ainda usavam fetch/window.open
relativos. Uma troca de transporte/registro durante rede ou callback podia
reaplicar dados/seleção, emitir feedback ou continuar uma sequência de POSTs na
tela nova, mesmo com autorização e RLS corretos no backend.

Adapters em api das páginas donas usam HttpClient configurado, sem barrels
públicos administrativos. O ciclo é conferido após rede e callbacks; lista de
orçamentos aborta busca anterior e históricos de reajuste são limpos ao trocar
registro. Flags de ação são reiniciadas no novo ciclo; locks de boleto são
liberados independentemente de o ciclo antigo ainda estar ativo. Abort não
desfaz efeitos remotos aceitos.

Exportação consome o corpo binário antes de liberar bytes e conserva nomes e
query. Erro fecha a aba vazia; não libera JSON negativo como relatório. DOM
simulado prova nome/bytes/revogação, mas download/popup/revogação efetivos
continuam exigindo navegador real.

Arquivos: api e model de financeiro/orcamentos-admin, Detalhe.web, testes
colocados e três fixtures HTTP. 82 casos focados, seis HTTP por motor nos dois
hosts locais, tipos/gates/builds aprovados; styles e corpos conferidos por AST.
POST de reajuste mantém 202 e DELETE mantém 409 para preservar histórico.
Reajustes em sequência conservam recusa parcial, sem transação/rollback de lote.
Nenhuma baseline, allowlist, regra de backend ou origem real foi alterada.
Provas, arquivos e riscos: onda 67 de
[API compartilhada](../features/shared-api-host.md).

## 249. Consumidores administrativos usavam transporte relativo e retinham respostas antigas

### Corrigido no recorte da onda 66 (2026-10-03, sem commit)

Boleto/vencimento, documentos e PDFs administrativos usavam fetch/window.open
relativos, ignorando HttpClient configurado. Respostas antigas podiam aplicar
documentos/contrato/toast após trocar seleção/locadora/usuário. Ownership/RLS do
backend continuavam presentes.

Adapter de boleto na entidade pagamento, exclusivos nas páginas donas. Multipart
sem cabeçalho manual e envelope JSON com status preservam 202 pendente. Páginas
reiniciam por locadora/papel/usuário, detalhes capturam registro; ciclo
conferido antes de aplicar resultado e após callbacks. Ofício abre aba no
clique, espera PDF e fecha a aba vazia em erro/escopo antigo. Abort não desfaz
escrita remota aceita.

Arquivos: shared/api/http-client/useScopedApiClient e testes; entidade
pagamento; api/model de locacoes, financeiro e orcamentos-admin,
wrappers/detalhes dessas páginas e três fixtures HTTP. Caminhos de frontend
relativos a packages/frontend/src.

Validação: 93 casos focados, oito HTTP por motor nos dois hosts locais,
incluindo multipart privado, PDF, papel e outra locadora recusados;
tipos/lint/gates/builds aprovados. Adapters exclusivos saíram dos barrels
públicos, sem ampliar allowlist. Nova expectativa da fila corrigida para zero
PaymentAttempt antes do worker e payment.issue persistido. Nenhuma regra de
backend ou teste anterior afrouxado. Banco limpo/cluster encerrado. Outros
consumidores, navegador/aparelho real e SaaS pendentes. Provas/limites na onda
66 de shared-api-host.md.

## 248. Detalhe/pedidos/download ignoravam transporte e diálogos não compunham o Portal

### Corrigido na onda 65 (2026-10-03, sem commit)

HistoricoDetalhePage e AcoesLocacao usavam fetch relativo. Leituras, ações e
downloads atrasados podiam aplicar dados ou efeitos locais depois de trocar
locadora/usuário/registro. Ownership/RLS do backend continuavam presentes. A
renderização real também expôs o defeito anterior das ações: Popup fora de
Dialog.Portal e botão aninhado no Trigger, impedindo a abertura correta.

Transporte e DTOs foram colocados nas entidades locação/orçamento. As telas usam
HttpClient configurado e useScopedApiClient, com chave da locadora/usuário/id. O
modo binary consome todo blob antes da checagem de escopo; resposta antiga não
libera arquivo, toast, navegação ou releitura. JSON permanece padrão. Abort não
cancela uma gravação já aceita no escopo original.

Diálogos agora usam Portal e Trigger renderizando o Button existente. Nenhuma
classe/estilo mudou. Extensão direta (extensionDays, 1–30) e pedido à equipe
(additionalDays, 1–365) continuam distintos. Coleta não ganhou corpo. 404,
cancelamento/soft delete, polling, totais e nome anterior do download
permanecem.

Arquivos: shared/api/http-client.ts/index.ts;
entities/locacao/api/client-rentals e client-rental-detail;
entities/orcamento/api/client-quotes e client-quote-detail;
pages/historico-detalhe/ui/HistoricoDetalhePage.web.tsx e AcoesLocacao.web.tsx,
seus testes, fixtures HTTP do portal/contratos e storage local.

Validação: 211 provas focadas; seis HTTP por motor nos dois hosts de produção
locais, com cookies, ownership/RLS e HTML/PDF privados completos. Provas cobrem
scope change com GET/DELETE/POST/download atrasados, incluindo corpo binário
pendente após chegada dos headers. Tipos, lint, guards e builds dos clientes
aprovados. A composição foi exercitada com Dialog/Button reais. Banco limpo e
cluster encerrado; legado/agenda intactos. Aceite de navegador/aparelho, demais
pagamentos/documentos e SaaS ainda pendentes. Resultados/limites: onda 65 de
docs/features/shared-api-host.md.

## 247. Visão geral e histórico usavam transporte relativo e retinham escopo antigo

### Corrigido na onda 64 (2026-10-03, sem commit)

AreaClientePage e HistoricoPage usavam fetch relativo, ignorando o transporte
configurado pelo bootstrap. Histórico recarregava pelo ID do usuário, sem
reiniciar filtros/dados ao trocar locadora. Leituras e exclusões atrasadas
podiam aplicar dados ou sucesso e iniciar outra leitura depois de trocar o
escopo. As regras de ownership/RLS no servidor continuavam ativas.

Os transportes ficam em entities/locacao/api/client-rentals.ts e
entities/orcamento/api/client-quotes.ts; activities pertence à entidade cliente.
As páginas usam o ciclo genérico useScopedApiClient e reiniciam por
locadora/usuário. Nenhum serviço de negócio ou regra de seleção foi copiado para
shared ou para os hosts. Resposta antiga é descartada mesmo quando o transporte
ignora abort; uma escrita já aceita pode terminar no escopo original.

Busca, filtros, deduplicação de orçamento convertido, totais, navegação,
confirmação e soft delete são os anteriores. Polling permanece em 30 segundos,
somente com aba visível; visibilitychange atualiza e desmontagem encerra o
intervalo/listener. HTTP recusado mantém o tratamento por recurso; falha de rede
e atualização silenciosa conservam a política existente. A remoção local de
atividades conserva sua chave de localStorage e não escreve na API.

Provas: testes colocados de transporte, AreaClientePage.api.web.test.tsx,
HistoricoPage.api.web.test.tsx e history-consumer.http.test.ts. Cookies reais,
dois hosts/motores e SQL/RLS mostram soft delete próprio, status/valores
preservados e 404 para outra locadora/usuário. Testes anteriores de carrinho,
texto, classes e rotas continuam; busca da palavra fetch foi substituída por
comportamento observado. Não houve teste removido, skip novo ou baseline
alterado. Detalhe/pedidos/downloads, telas nativas e aceite interativo/externo
continuam pendentes. Relatório: [onda 64](../features/shared-api-host.md).

## 246. Perfil e endereços retinham dados e operações de um escopo anterior

### Corrigido na onda 63 (2026-10-03, sem commit)

As telas usavam fetch relativo e não consumiam o cliente HTTP configurado pelo
bootstrap. O perfil mesclava dados novos com o formulário anterior, e endereços
dependiam somente do ID de usuário para recarregar. Trocar locadora com o mesmo
usuário podia conservar dados da locadora anterior. Uma leitura atrasada podia
substituir dados atuais, e uma escrita antiga podia notificar sucesso e iniciar
outra leitura após trocar usuário/locadora. O isolamento do servidor permanecia
ativo; o defeito estava no transporte e no estado do consumidor.

Perfil e endereços agora usam createCustomerApi de entities/cliente. O orçamento
delega suas operações privadas à mesma API, sem repetir os contratos. A fundação
useScopedApiClient, extraída do hook do orçamento, recebe uma chave opaca:
cancela/desconsidera respostas e impede a próxima chamada de um ciclo encerrado.
Não resolve identidade, locadora, preços ou ownership. Sinais de cancelamento
fornecidos pelo chamador também são respeitados.

As telas reiniciam formulário/lista/edição por locadora e usuário. Mantêm
formatação de documentos/telefone/CEP, payloads parciais, recarga após salvar,
cancelamento da edição, CRUD/principal, mensagens e layout. Uma falha de escrita
conserva o rascunho para nova tentativa. Uma mutação já recebida pelo servidor
pode concluir no escopo original; cancelamento do consumidor não promete
desfazer uma gravação confirmada. A consulta pública ao ViaCEP mantém seu
contrato.

Validação: customer-api.test.ts, useScopedApiClient.test.tsx,
PerfilPage.api.web.test.tsx e EnderecosPage.api.web.test.tsx; regressões do
orçamento/providers e HTTP real em customer-consumer.http.test.ts e
quote-consumer.http.test.ts. Cookies/RLS nos dois hosts/motores, ownership de
outro usuário/locadora, dados globais de identidade preservados e nenhuma sobra
no banco local descartável. Os testes anteriores de estilo/texto continuam;
asserções sobre a palavra fetch foram substituídas por provas de transporte e
handlers renderizados. Sem teste apagado, skip novo ou tolerância ampliada.
Aceite visual/aparelhos e controles de verificação/senha ainda são pendências.
Relatório: [onda 63](../features/shared-api-host.md).

## 245. Orçamento sem locadora explícita e respostas antigas do consumidor

### Corrigido na onda 62 (2026-10-03, sem commit)

A página de orçamento e seu formulário auxiliar chamavam fetch diretamente. O
pedido não incluía tenantSlug; fora de uma borda de locadora válida, o
resolvedor público não podia identificar a empresa e respondia TENANT_REQUIRED.
Catálogo e disponibilidade tinham o mesmo acoplamento ao host local. Perfil e
endereços dependiam da preferência implícita, e uma resposta antiga podia
hidratar ou limpar o carrinho após a troca de usuário/locadora.

O transporte da página fica em pages/orcamento/api/quote-api.ts e recebe o
HttpClient configurado. Operações públicas levam tenantSlug; operações privadas
usam o cliente do bootstrap com seleção capturada, sem trocar o header de uma
chamada antiga. No host de locadora, o bootstrap continua omitindo x-tenant-id.
Payloads, aliases, envelopes, preço e ownership permanecem no contrato anterior.

O hook universal de ciclo descarta respostas antigas e cancela requisições ao
desmontar ou trocar o cliente/escopo, inclusive se o transporte ignora abort. A
tela principal é remontada por locadora/usuário, e preferências de confirmação
também levam esse par. A atualização de preço usa os itens atuais: não recoloca
uma linha removida durante a consulta. Falha HTTP conserva o carrinho.
Salvamentos paralelos conservam sucesso parcial e não enviam o pedido após uma
falha. O timer de remoção animada é cancelado na desmontagem; preserva a espera
de 300 ms no escopo atual, sem remover o mesmo equipamento no carrinho de outra
conta ou locadora. O formulário auxiliar mantém seus campos públicos e alias
existentes.

Validação: quote-api.test.ts, model/quote-api.test.tsx,
OrcamentoPage.api.web.test.tsx e RuntimeBootstrap.client.test.tsx; transporte
real em tests/api-host/quote-consumer.http.test.ts, nos dois hosts e motores,
com cookies/RLS e isolamento do perfil de outra locadora. O formulário usa
seletores/endereço simulados no jsdom; aparelho, aceite visual e operação
externa continuam pendentes. Relatório: onda 62 de
[API compartilhada](../features/shared-api-host.md).

## 244. Fixture de páginas recebeu 404 por normalização de loopback no NextURL

**Constatação:** 2026-10-02, sem commit. **Estado:** corrigido na fixture;
nenhum comportamento do produto alterado.

API pelo proxy funcionava, mas página pública respondia 404 neutro sem chamada
ao gateway. NextURL normaliza 127.0.0.1 para localhost; resolve-routes só mantém
rewrite interno quando sua origem coincide com initURL. O Next start iniciado
explicitamente no IP produzia a origem inicial diferente. O rewrite era externo,
retornava ao web com Host localhost e era recusado pelo classificador.

Código instalado conferido: next/dist/server/web/next-url.js (parseURL),
server/lib/router-utils/resolve-routes.js e
shared/lib/router/utils/relativize-url.js. tests/api-host/web-consumer.ts usa
localhost tanto no Next start quanto nas requisições; a ponte TLS do backend
permanece no loopback, com verificação ativa. Não é motivo para aceitar Host
arbitrário, desabilitar TLS ou alterar a tabela de roteamento.

tests/api-host/web-operations.http.test.ts prova h1 renderizado para duas
locadoras, retirada dos scripts antes da asserção e chamadas ao gateway. O bloco
de 43 casos passou com legacy e Better Auth em artefatos de produção. Multipart,
cookies, PDF e retorno ao legado continuam protegidos. O motor da fixture
depende de API_AUTH_MODE; conferir também o motor anunciado no log.

## 243. Arquivos públicos estavam acoplados à origem da API

### Correção na migração dos consumidores (2026-10-02, sem commit)

O beforeFiles do web enviava public/ a WEB_API_ORIGIN, apesar de predev/prebuild
já copiarem os arquivos para o próprio host. O mobile também prefixava imagens
relativas com a origem da API. O serviço compartilhado não possui esses
arquivos; trocar o destino faria fontes, imagens e modelos dependerem do host
errado. Não é problema de domínio ou autorização.

Web passa a servir a cópia real sincronizada, sem rewrite de arquivos públicos.
API continua no proxy com validação de origem e borda. Expo concentra destinos
em host/api-config.ts: EXPO_PUBLIC_ASSET_URL opcional, somente origem HTTP(S),
sem credenciais; ausente mantém o fallback anterior. URLs absolutas de storage e
contratos HTTP permanecem intactos. Nenhum arquivo público ou estilo mudou.

Arquivos: apps/clients/web/next.config.mjs e declaração, proxy/route-table
(comentários), apps/clients/mobile/src/host/api-config.ts, auth/client.ts e tela
equipamentos. Exemplos de ambiente próprios dos clientes documentam a troca
local; ambientes existentes, callbacks e scheduler ficam intactos.

Validar test:web, test:mobile e tests/api-host/web-consumers.http.test.ts com os
dois motores: Next start real, certificado loopback temporário confiado só pelo
filho, hashes de favicon/fonte/modelo, sessão através do proxy e após rollback,
locadoras isoladas e CSRF sem escrita. OpenSSL é pré-requisito da fixture (Git
for Windows inclui o executável; no CI Linux é conferido).

Nota da prova: o fetch do Node 24 descarta a sobrescrita de Host. Uma sonda
loopback confirmou o endereço IP no servidor, causando 404 no classificador. As
requisições ao web usam http.request, que preserva Host; não se alterou a
validação de domínio para fazer o teste passar. O usuário da fixture pertence a
duas locadoras: seleção B deve trocar o escopo; vínculo revogado deve falhar.

Limpeza da prova: Better Auth normaliza o IPv6 por /64 e preenche os hextetos
com zeros. O teardown que buscava somente o endereço original deixava dois
registros de authRateLimit. tests/api-host/global-setup.ts agora reconhece o
prefixo normalizado do subnet reservado e exclusivo daquela execução, depois de
encerrar os hosts. Reexecução Better Auth: onze casos aprovados, nenhuma linha
de fixture ou papel temporário restante; 31 tabelas com FORCE RLS. Nenhum
limitador foi ampliado ou limpo durante os testes para fazê-los passar.

## 237. Store local do pnpm criou junção de volta ao checkout

### Diagnóstico e limpeza segura (2026-10-02, sem commit)

Instalação offline no sandbox escolheu .pnpm-store no checkout, diferente do
store externo registrado em node_modules/.modules.yaml. projects continha uma
junção à raiz; scanners de Git/docs passaram a recursar o repositório. O store
novo continha zero arquivos, 516 diretórios vazios e uma junção, conferidos com
lstat sem seguir links.

Só a junção recém-criada foi removida com Remove-Item -LiteralPath -Force, sem
-Recurse, após conferir tipo, destino e data. Diretórios vazios removidos de
baixo para cima sem recursão, recusando arquivos/reparsepoints. Store ausente,
retired-artifacts aprovado; node_modules e store externo intactos. Sem ignore ou
tolerância novos; sondas/logs em TEMP.

Antes de instalar em sandbox, conferir store-dir, .modules.yaml e links do
destino; avaliar qualquer recriação de node_modules. Regra de links:
entrada 171. Nunca apagar node_modules ou pastas com links recursivamente.

## 236. Ofício atribuía autoria à empresa legada e publicava detalhe interno

### Correção na extração de documentos (2026-10-02, sem commit)

PDFKit usava GB no Author/Creator mesmo para outra locadora. Catches das duas
rotas publicavam error.message em detail, inclusive falhas SQL. Renderer agora
usa razão social da Organization no Author e PLATFORM no Creator. Falha
inesperada retorna só error genérico com 500; diagnóstico fica no servidor.
Erros previstos, layout, valores, filenames e permissões preservados.

Arquivos: backend/documents/oficio-generator, adapters legados
admin/quotes/[id]/pdf-oficio e admin/financial/entries/[id]/pdf-oficio e seus
adapters no serviço. Validar quote-documents-api.test.ts e
quote-documents.http.test.ts: PDF real com autoria da locadora, 500 sob REVOKE
no papel descartável com grant restaurado, dinheiro/histórico intactos.

## 235. Exclusão administrativa de orçamento expunha a causa interna da falha

### Correção no bloco de orçamentos (2026-10-02, sem commit)

O catch de DELETE /api/admin/quotes/[id] retornava error.message no campo
message de um 500. Falhas SQL podiam publicar detalhes internos fora dos erros
de negócio previstos. Na extração, os dois adapters passam a devolver somente {
error: 'Internal server error' } com 500; diagnóstico permanece no servidor.
Sucesso e RentalMutationError mantêm status/mensagens; não há exclusão de
histórico financeiro.

Arquivos: app/api/admin/quotes/[id]/route.ts e seu adapter em apps/services/api.
Validar com tests/unit/quote-mutations-api.test.ts e
tests/api-host/quote-mutations.http.test.ts: exceção privada simulada e trigger
SQL AFTER DELETE provam envelope genérico e rollback que preserva orçamento e
itens. Evidências e limites na onda 36 de
[API compartilhada](../features/shared-api-host.md).

## 234. PUT administrativo de equipamento expunha detalhes internos de falha

### Correção na onda de catálogo/operações (2026-10-02, sem commit)

O catch de PUT /api/admin/equipments/[id] devolvia error.message em error e
details também em produção. Falhas de banco podiam expor dados internos mesmo
sem serem erros de validação ou CatalogError.

O legado e o adapter do serviço agora mantêm 500 com error e details genéricos
fora de development. CatalogError conserva status/mensagem; detalhes de
depuração ficam em development e no log do servidor. O DTO de sucesso não muda.

Arquivos: app/api/admin/equipments/[id]/route.ts e o adapter equivalente em
apps/services/api. Validar com tests/unit/catalog-operations-wave-api.test.ts,
que provoca erros privados nos dois hosts e compara production/development, e
com a paridade HTTP consolidada. Estado das provas em
[API compartilhada](../features/shared-api-host.md).

## 233. Hook do carrinho envia a chave de payload errada para mesclagem

### Resolvido na onda 61 (2026-10-03, sem commit)

O hook antigo `packages/frontend/src/features/carrinho/model/sincronizar.web.ts`
enviava `{ items: localCartItems }` a POST `/api/cart/merge`. O handler legado
passa `body.localCartItems` a customers/cart; array ausente responde 400
`Itens inválidos`. O mesmo contrato foi preservado no host compartilhado. No
corte 24, a ligação do hook à tela constava como pendência de higiene na
documentação de modernização; a onda 61 conferiu e corrigiu o consumidor.

Causa: o consumidor usava a chave de POST sync para chamar merge e não era
montado pela interface. A onda 61 move o hook para `model/sincronizar.ts`,
universal, e o liga no `RuntimeBootstrap` pelos índices web/native da feature.
Somente CLIENT confirmado, no escopo local já aberto e na mesma locadora da
rota, inicia HTTP. O cliente captura a seleção; respostas antigas são
descartadas pelo token do escopo e pelo cancelamento. Carrinho anônimo continua
separado, inclusive após login.

Mesclagem inicial envia `localCartItems`; restauração vazia usa GET. Edições e
remoções posteriores usam POST sync com `items`, debounce e escrita serial.
Marcas locais de sincronização e remoção sobrevivem à recarga: uma resposta
perdida após gravação não ressuscita itens nem apaga outros itens remotos. Falha
conserva o estado local e oferece tentativa explícita, sem loop de retry.
Metadata/preço, sem mudança de quantidade/dias, não gera escrita.

O mapper usa a base e as regras do catálogo, em vez de reaplicar desconto à taxa
já ajustada da linha. Preserva valores diretos decimais/zero e as datas e opções
locais; os totais continuam no motor único do domínio. O contrato HTTP, as
regras do backend e as duas APIs não mudaram.

Validação: `tests/api-host/cart.http.test.ts`, caso de chaves distintas, prova
400 sem efeitos nos dois hosts para `items` enviado a merge; payload correto
preserva/recalcula os itens da locadora. Ver
`docs/features/cart-pricing-sync.md` e relatórios do corte 24 e da onda 61 em
`docs/features/shared-api-host.md`. A onda 61 também prova o bootstrap e hook
renderizados, persistência, mudanças durante leitura/escrita e recuperação de
mesclagem efetivada com resposta descartada. HTTP real com cookies/RLS nos dois
hosts e motores; execução em aparelho e aceite visual continuam pendentes.

## 232. Paridade HTTP atingia o limite real de login do Better Auth

### Setup corrigido no corte 23 da API compartilhada

**Data**: 2026-10-02. **Causa**: quatro arquivos de paridade abriam três sessões
cada na mesma rodada. O servidor Next apresenta o peer loopback ao motor; a
regra existente de `/sign-in/email` admite dez chamadas por sessenta segundos. A
quarta suíte recebeu 429 no beforeAll: 968 casos passaram e os 30 de perfil não
puderam executar. O problema era o setup, não o limite de produto.

**Solução**: `tests/api-host/identity.ts` reutiliza somente cookies emitidos
pelo login HTTP real, em cache dentro do diretório temporário da rodada. Antes
de reutilizar, consulta a sessão no próprio motor e confere o usuário; revogação
exige login novo. `organizations.http.test.ts` força emissão nova para manter
sua caracterização do orçamento de login. `global-setup.ts` remove os arquivos
de cookie no cleanup. Não se forjam sessões, não se apagam janelas durante a
suíte e não se ampliam limites, timeouts ou baseline.

**Validação**: matriz completa de 998 casos/10 arquivos aprovada tanto em Better
Auth quanto em NextAuth, incluindo revogação real, cookies de host e asserções
existentes de rate limit. Cache ausente após cleanup; configuração de
autenticação de produção intacta. Evidências em
`docs/features/shared-api-host.md`, corte 23.

## 231. Serviço Next em workspace capturava o proxy de páginas da raiz

### Problema resolvido no primeiro corte da API compartilhada

**Data**: 2026-09-30. **Causa**: ao compilar `apps/services/api` sem proxy
próprio, Turbopack com root no workspace capturou `proxy.ts` da raiz e falhou ao
resolver `@/lib/identity`. O serviço não deve usar o middleware de páginas admin
do host legado.

**Solução**: `apps/services/api/src/proxy.ts` explícito, sem política de
páginas. Os dois handlers públicos mantêm a resolução autenticada da borda e as
guardas de tenant nos módulos compartilhados. Rotas privadas não foram montadas
no serviço. O proxy web e o proxy legado não mudaram.

**Validação**: build Next do serviço aprovado; comparação HTTP com o serviço
compilado e o legado, seleção por query/borda, conflito e borda forjada (20
testes), com banco descartável e papel sem bypass de RLS. Inventário de
segurança legado: 59 testes aprovados. Referência:
`docs/features/shared-api-host.md` e ADR de extração do backend.

## 230. Verificação externa saía 0 com cinco suítes reprovadas

### Procedimento corrigido no handoff

**Data**: 2026-09-30. **Causa**: o runner temporário `gates/run6.sh` anotava o
exit de cada comando, mas encerrava com `echo DONE`. A notificação da tarefa
`bbdktzyyx` registrou exit 0; `gates/out6/summary.txt` registrou exit 1 em
`unit`, `identity`, `security`, `platform` e `gates`, além de integração pulada.

Os bancos `gate_unit`, `gate_identity` e `gate_security` não satisfaziam a regra
de `tests/helpers/test-database.ts` (`test`, `test_*` ou `*_test`). As demais
falhas eram timeouts durante nove suítes simultâneas, com testes de gates
repetidos em `test:unit` e `test:gates`. Na retomada via PowerShell, faltava
também o `sh` do Git Bash no PATH dos testes do hook.

**Solução**: preservar os logs históricos; usar bancos novos com nomes válidos e
migrations versionadas; limitar a concorrência e conferir o exit real de cada
execução. O Codex repetiu as suítes que falharam e executou a integração em
porta própria. Nenhuma proteção, asserção ou timeout foi alterado. A parada
posterior do PostgreSQL pelo usuário é um evento separado.

**Validação**: plataforma 1.978 aprovados/2 pulados; identidade 134; segurança
657 aprovados/18 pulados; unitários 779 aprovados e os quatro testes restantes
do hook aprovados na repetição focada; integração HTTP 81. O servidor de
integração foi encerrado e a porta 3191 ficou livre.

**Documentos atualizados**: `docs/ai/claude-codex-handoff-2026-09-30.md`,
`docs/ai/boot.md`, `docs/architecture/modernization.md`,
`docs/features/ratchet-gates.md`, `docs/issues/known-issues.index.md` e
`CHANGELOG.md`. O runner histórico ficou intacto como evidência; os comandos da
retomada propagam o exit da suíte, em vez do último comando de leitura do log.

**Como evitar regressão**: conferir todas as etapas e os casos pulados; um
runner agregado precisa retornar erro quando qualquer comando falhar. Não
ampliar a allowlist de bancos nem os timeouts para esconder falha de
configuração ou sobrecarga.

## 229. `clean-install-windows.ps1` derrubava todo Node e apagava `node_modules`; trinco do `sync-web-public` dependia de rename atômico no Windows

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-30 **Severidade**: Alta (script) e Baixa
(trinco) **Status**: RESOLVIDO (lote fechamento-final, achados 133, 134 e 135 da
revisão) **Ambiente**: Windows, checkout compartilhado por pessoas e agentes;
`scripts/clean-install-windows.ps1`, `scripts/unblock-rollup.ps1`,
`tools/sync-web-public.mjs`

#### Descrição

- `scripts/clean-install-windows.ps1` rodava `taskkill /f /im node.exe`
  (derrubava os servidores e as ferramentas de todo mundo) e
  `Remove-Item -Recurse` no `node_modules` (atravessa as junções do pnpm, como
  no incidente da entrada 171). `scripts/unblock-rollup.ps1` mandava rodar o
  mesmo `Remove-Item -Recurse -Force node_modules` quando não achava o binário.
- `tools/sync-web-public.mjs` (predev/prebuild do host web) tirava o trinco
  abandonado com `renameSync` para um nome único, supondo que só um de dois
  processos venceria. No Windows os dois `renameSync` do mesmo arquivo podem
  reportar sucesso (68 de 200 na prova do verificador): o perdedor quebrava com
  `ENOENT` no `unlinkSync` do arquivo posto de lado. Com seis execuções juntas
  sobre um trinco de processo morto, a falha apareceu em todas as cinco
  execuções do teste novo contra o código antigo, e em 21 de 40 rodadas de dez
  processos num teste de carga.
- No Windows, criar (`wx`) ou ler o trinco no instante em que outro processo o
  apaga também falha com `EPERM` (medido: dezenas de vezes em 3 s com seis
  processos), e a ferramenta tratava isso como erro fatal.
- Textos desatualizados: a entrada 171 dizia que a junção de
  `apps/clients/web/public` (`pnpm link:web-public`) era "a única exceção
  existente", o comentário de `apps/clients/web/next.config.mjs` e a ADR de
  hosts falavam do link, e registros de `docs/internal/` e `docs/migration/`
  tratavam o `post-prisma-generate.js` e o `link-web-public` como vivos. Na
  segunda rodada, o gate novo (abaixo) ainda achou a tabela de
  `docs/features/design-system.md` com "Style Dictionary ✅ Implementado" e o
  aviso de `docs/architecture/overview.md` sem dizer que a pipeline saiu.

#### Causa raiz

- O script de "instalação limpa" foi escrito antes da regra 7 do `AGENTS.md` e
  nada reprovava comando perigoso em `scripts/`.
- O trinco dependia de uma garantia (rename atômico entre processos) que o
  Windows não dá, e não previa o `EPERM` passageiro de arquivo sendo apagado.
- Nada conferia docs e comentários contra o que a faxina aposentou: texto velho
  só aparecia na leitura da revisão, e cada rodada deixava sobra.

#### Solução

- `scripts/clean-install-windows.ps1` saiu (o procedimento seguro está na seção
  "Limpeza segura" de `docs/getting-started/troubleshooting.md`:
  `pnpm install --force`, `pnpm store prune`, encerrar só os próprios PIDs);
  `scripts/unblock-rollup.ps1` passou a sugerir `pnpm install --force`.
- `tests/unit/destructive-commands.test.ts` (no `pnpm test:gates`) reprova, em
  tudo que está em `scripts/`, `tools/`, `.husky/` e nos scripts dos
  `package.json` do workspace: `taskkill /im node`, `Stop-Process -Name node`,
  `Get-Process node | Stop-Process`, `pkill`/`killall node`, `wmic ... node.exe`
  e remoção recursiva de `node_modules` (`rm -rf`, `Remove-Item -Recurse`,
  `rmdir /s`, `rimraf`, `fs.rm*` com `recursive: true`). Tem controles das
  formas proibidas e das seguras (`Stop-Process -Id`, `Get-ChildItem -Recurse`).
  Limite: a leitura é por texto; um caminho montado em variável longe da chamada
  passa.
- Trinco do `sync-web-public` sem rename: cada geração do trinco (data e
  conteúdo, com o token único de quem o criou) tem um direito de retirada,
  `.sync-web-public.lock.<chave>.reap` ao lado dele, criado com exclusividade
  (`wx`). Só quem ganha o direito relê o trinco e o apaga, e só se ainda for a
  mesma geração; ninguém mais tira aquela geração nesse intervalo e uma geração
  apagada nunca volta, então o trinco novo de outra execução nunca é apagado.
  Direito de processo morto (execução que caiu no meio da retirada) é tirado do
  mesmo jeito, um nível acima. `EPERM`/`EBUSY` passageiros do Windows ao criar
  ou ler o trinco viram nova tentativa em 5 ms, dentro do limite de espera. O
  padrão `apps/clients/web/.sync-web-public.lock*` do `.gitignore` já cobre o
  direito de retirada.
- Textos: nota datada na entrada 171 (sem apagar o histórico), comentário do
  `next.config.mjs` do host web, ADR `adr-tenant-hosts.md`,
  `docs/architecture/modernization.md`, notas nos registros 351 de
  `docs/migration/` e nos de `docs/internal/` que mandavam não apagar o
  `post-prisma-generate.js`; na segunda rodada, a linha do Style Dictionary saiu
  da tabela de ferramentas de `docs/features/design-system.md` e o aviso de
  `docs/architecture/overview.md` diz que a pipeline saiu.
- `tests/unit/retired-artifacts.test.ts` (no `pnpm test:gates`) prova que cada
  artefato aposentado saiu de verdade (arquivo, script, dependência e link): a
  junção de `apps/clients/web/public` com `tools/link-web-public.mjs`, o gerador
  zod com `post-prisma-generate.js` e a saída de `lib/validations`, a pipeline
  do Style Dictionary e o `clean-install-windows.ps1`. Depois reprova citação
  deles sem uma frase que cite o mesmo artefato e diga que ele saiu, na mesma
  seção de nível 1 ou 2 do Markdown (a introdução vale para o arquivo) ou no
  mesmo arquivo de código. Palavra de retirada negada ou no futuro ("nunca deve
  ser apagada", "será removido") não vale. Fica de fora o que o `docs/README.md`
  declara histórico e o `CHANGELOG.md`; do known-issues contam as entradas que
  as instruções de agente citam como regra (`AGENTS.md`, `CLAUDE.md`,
  `AGENTS.md` dos hosts, `.cursor/rules` e `docs/ai/`), sem a introdução do
  arquivo cobri-las. Seis citações ficam de propósito, com motivo (entre elas o
  `tailwind.config.cjs` e o `scripts/safe-postinstall.js` que a entrada 227
  deixou para os donos), e exceção sem uso reprova. Limite: a leitura é por
  palavra; uma frase que cite o artefato e diga "saiu" por outro motivo passa.

#### Arquivos modificados

- `scripts/clean-install-windows.ps1` (removido), `scripts/unblock-rollup.ps1`,
  `tests/unit/destructive-commands.test.ts` (novo), `package.json`
  (`test:gates`), `tools/sync-web-public.mjs`,
  `tests/unit/sync-web-public.test.ts`, `apps/clients/web/next.config.mjs`
  (comentário), `tests/unit/retired-artifacts.test.ts` (novo),
  `docs/features/ratchet-gates.md` e os docs citados.

#### Como validar

- `pnpm test:gates` (inclui `destructive-commands` e `retired-artifacts`) e
  `pnpm exec vitest run --config vitest.unit.config.ts tests/unit/sync-web-public.test.ts`,
  repetido: o teste "trinco abandonado disputado por várias execuções no mesmo
  instante" roda 12 rodadas de seis processos que começam juntos sobre um trinco
  de processo morto e exige que todas terminem com 0, que uma copie tudo e as
  outras nada, destino igual à fonte e nada além de `public` em
  `apps/clients/web`.
- Mutações do lote (restauração conferida por sha256): ferramenta original
  (rename) reprova o teste de concorrência em toda execução e o da execução que
  cai no meio da retirada (sobra o `.stale`); sem a conferência de geração
  reprova "não apaga o trinco novo que outra execução criou depois da leitura
  desta"; o script apagado de volta ou a mensagem antiga do `unblock-rollup.ps1`
  reprovam `destructive-commands`.
- Mutações do achado 135 (texto de antes da correção, restauração conferida por
  sha256), cada uma reprovando `retired-artifacts` só pela linha dela: entrada
  171 sem a nota datada, comentário antigo do `next.config.mjs`, ADR de hosts e
  item da junção do `modernization.md` como estavam, "Style Dictionary ✅
  Implementado" de volta, aviso do `overview.md` sem a frase de retirada e o
  `apps/clients/web/AGENTS.md` dizendo "criado pelo `link-web-public`". Sem a
  exclusão de negação a entrada 171 antiga passava ("nunca deve ser apagada"
  contava como retirada): o controle do leitor reprova essa mutação, a
  introdução do known-issues cobrindo as entradas e o known-issues sem ler as
  entradas citadas.

---

## 228. Manutenção não bloqueia a disponibilidade: regra desligada na produção e implementação removida na faxina

### Regra de negócio REGISTRADA (decisão pendente)

**Data da Ocorrência**: 2026-09-30 **Severidade**: Média (equipamento em
manutenção pode ser orçado e reservado) **Status**: REGISTRADO (achado 129 da
revisão; religar é decisão de produto) **Ambiente**:
`packages/backend/src/modules/rentals/availability.ts`,
`lib/maintenance-automation.ts`, `lib/equipment-availability.ts`

#### Descrição

- A disponibilidade não consulta a tabela `maintenance`: o resultado traz sempre
  `blockedByMaintenance: false`, e `isEquipmentAvailableForRental` não dá motivo
  de manutenção.
- Na produção (`main`, `eb4c0098`) a checagem já estava desligada: em
  `lib/equipment-availability.ts` as chamadas de `isEquipmentInMaintenance` e
  `getMaintenanceBlockingInfo` ficavam comentadas com "TODO: Reativar quando o
  sistema de manutenção estiver completo".
- A faxina da onda 9 apagou as duas funções de `lib/maintenance-automation.ts`
  (sem chamador), e a regra só existia no código.

#### Causa raiz

- A regra foi desligada na produção sem registro fora do código; a migração para
  `packages/backend` manteve o comportamento desligado, e o código morto saiu
  com a higiene.

#### Solução

- Regra registrada em `docs/features/quote-stock-blocking.md`, seção 3.2.1: com
  período, `IN_PROGRESS` sempre bloqueia e `SCHEDULED` bloqueia se `scheduledAt`
  cai dentro do período (bordas inclusive); sem período, qualquer manutenção
  `SCHEDULED` ou `IN_PROGRESS` bloqueia; motivo "Manutenção em andamento" ou
  "Manutenção agendada para <data> interfere com o período de locação".
- Implementação recuperável (já com `TenantContext`, transação e `tenantId`):
  `git show 4b02f52f:lib/maintenance-automation.ts`. A seção 3.2.1 descreve como
  religar no módulo de disponibilidade e os testes que a religação exige. O bug
  antigo da mesma regra (manutenção futura bloqueava locação presente) está mais
  abaixo neste arquivo (`rg -n "isEquipmentInMaintenance"`).

#### Como validar

- `rg -n "blockedByMaintenance" packages/backend/src/modules/rentals/availability.ts`:
  hoje só `false`. Ao religar, os testes da seção 3.2.1 (banco descartável)
  passam a provar a regra.

---

## 227. Sobras da faxina: `ratchet:guard` vermelho, gates fora do `test:gates`, pre-commit com `git add .`, docs com APIs apagadas e o gerador zod

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-30 **Severidade**: Média (gate do CI vermelho,
commit misturando trabalho alheio, docs levando agentes a APIs inexistentes)
**Status**: RESOLVIDO (onda 9, lote higiene-final, achados 129 e 131; remoção
dos arquivos pelo dono e ajustes do lote fechamento-final em 2026-09-30,
achado 132) **Ambiente**: `tools/ratchet-transfers.json`, `package.json`,
`pnpm-lock.yaml`, `.husky/pre-commit`, `prisma/schema.prisma`,
`tools/hygiene-baseline.json`, `.cursor/rules/gb-locacoes.mdc`, `CLAUDE.md`,
`AGENTS.md`, `docs/**`

#### Descrição

- `pnpm ratchet:guard` falhava: os exports `./palette.css` e `./scales.css` do
  `@gb-locacoes/design-tokens` (ondas 8 e 9) não tinham aprovação.
- `tests/unit/eslint-runtime-rewrite.test.ts` (regra "o servidor não reescreve o
  runtime") e `tests/unit/stylelint-css-structure.test.ts` (plugin do
  `pnpm lint:css`) ficavam fora do `test:gates`, o job do CI sem banco.
- `.husky/pre-commit` formatava todo Markdown do repositório e rodava
  `git add .` quando sobrava qualquer diferença: o commit levava mudança não
  preparada e arquivo novo de quem divide o checkout.
- Docs vivos mostravam APIs apagadas (helpers `notify*` e `createNotification`,
  utilitários do service worker, `withErrorHandling`, `lib/telemetry.ts`, a
  estrutura `components/`/`hooks/`, Stripe) e mandavam apagar `node_modules` com
  `rm -rf`/`Remove-Item -Recurse` e derrubar todo processo Node com
  `taskkill /im node.exe`, contra a regra 7 do `AGENTS.md` (entrada 171).
- `.cursor/rules/gb-locacoes.mdc` e partes do `CLAUDE.md` e do `AGENTS.md`
  (seções 6 e 7) descreviam estrutura, pagamentos e versões que não valem mais.
- O bloco `generator zod` do `schema.prisma` gravava cerca de 2.800 arquivos em
  `lib/validations` que nada importa, e um `prisma generate` sem
  `--generator client` regravaria a pasta dos dois arquivos escritos à mão; a
  pipeline do Style Dictionary ficou sem consumidor desde a onda 8.
- `test-raw-prisma.mjs` (imprimia a `DATABASE_URL`) já tinha saído, sem
  referência no `arch.config.json`.

#### Causa raiz

- A faxina apagou código sem varrer docs e configs que o citavam; a lista do
  `test:gates` é manual e nada conferia que cada teste de gate estivesse nela; o
  hook foi escrito para um checkout de uma pessoa só.

#### Solução

- Aprovações `package.exports` com motivo em `tools/ratchet-transfers.json` (e o
  `$comment` descrevendo as três formas de registro): `ratchet:guard` verde
  contra `4b02f52f`.
- `test:gates` com `eslint-runtime-rewrite`, `stylelint-css-structure`,
  `ci-workflow` e `pre-commit-hook`. `tests/unit/ci-workflow.test.ts` deriva os
  gates das ferramentas que o CI roda (scripts do workflow, plugins do ESLint e
  do Stylelint e o que eles importam de `tools/`) e reprova teste de gate fora
  do `test:gates` ou arquivo listado que não existe.
- `.husky/pre-commit` formata só o Markdown preparado, pula arquivo com parte
  não preparada e re-adiciona só o que ele mesmo mudou
  (`tests/unit/pre-commit-hook.test.ts`, com prettier e markdownlint de verdade
  num repositório descartável). O markdownlint recebe só o que o
  `.markdownlintignore` não ignora (lido pelo próprio git): quando todo arquivo
  recebido estava ignorado (por exemplo, só uma cópia de skill em `.agents/**`),
  o markdownlint-cli imprimia a ajuda inteira no commit.
- Docs: seção "Limpeza segura" em `docs/getting-started/troubleshooting.md`
  (`pnpm install --force`, `pnpm store prune`, `pnpm db:generate`, encerrar só
  os próprios PIDs, apagar cache só depois de provar que não há link), aplicada
  em `installation.md`, `developer-guide.md` e nos guias do Storybook e do
  Supabase; `notification-system.md`, `service-worker-cache.md`, `security.md`,
  `api.md`, `overview.md`, `development.md` e `analytics-dashboard.md` com a API
  atual ou marcados como históricos; nota de caminhos atuais nos docs que
  citavam `components/`/`hooks/`; `docs/README.md` separa os registros
  históricos. `.cursor/rules/gb-locacoes.mdc` virou ponteiro para o `AGENTS.md`;
  `CLAUDE.md` e `AGENTS.md` (seções 6 e 7) com a estrutura, o stack e as versões
  reais.
- Gerador zod: saíram o bloco `generator zod`, o `prisma-zod-generator` e o
  override `prisma-zod-generator>ajv` (lockfile só com remoções, conferido com
  `pnpm install --frozen-lockfile`);
  `tests/unit/prisma-schema-generators.test.ts` reprova gerador de volta.
  `lib/validations/index.ts` e `contact-types.ts` ficam onde estão (escritos à
  mão, importados por `app/api/contact`, `app/api/quotes`,
  `lib/email-templates.ts` e `lib/openapi/schemas.ts`).
- Regra de manutenção desligada registrada (entrada 228).

#### Remoção dos arquivos e ajustes (RESOLVIDO em 2026-09-30, achado 132)

- Histórico: a remoção em massa (saída gerada de `lib/validations` e pipeline do
  Style Dictionary) foi bloqueada ao agente pela proteção contra apagamento
  irreversível, nas duas rodadas. Na segunda, os 2.805 arquivos chegaram a ser
  apagados um a um (antes, cópia em `tar` no scratchpad do agente), mas a
  proteção barrou o resto; os arquivos voltaram da cópia, byte a byte, e a
  remoção ficou com o dono.
- Em 2026-09-30 o dono autorizou e o orquestrador apagou com `git rm` os 2.805
  arquivos: `lib/validations/schemas/**`, `lib/validations/helpers/*`,
  `lib/validations/.prisma-zod-generator-manifest.json`,
  `scripts/post-prisma-generate.js`, `style-dictionary.config.js`,
  `scripts/build-design-tokens.js`, `scripts/watch-design-tokens-simple.js` e
  `design-tokens/output/*`. Ficaram `lib/validations/index.ts`,
  `lib/validations/contact-types.ts` (escritos à mão) e
  `design-tokens/base.json` (lido por `primitives.test.ts` e `web-sources.ts`).
  Não restaure os arquivos apagados.
- Ajustes do lote fechamento-final, na mesma mudança:
  - `tools/hygiene-baseline.json` sem os quatro itens que deixaram de acontecer
    (`lib/validations/helpers/**`, `lib/validations/schemas/**`,
    `scripts/post-prisma-generate.js` e `style-dictionary.config.js`);
  - `package.json` sem os scripts `design-system:build-tokens` e
    `design-system:watch-tokens` e sem a dependência `style-dictionary`. O
    `pnpm remove -w style-dictionary` re-resolvia os peers de pacotes do Expo
    (`@expo/metro-config`, `@expo/router-server`) de react-native 0.86.3 para
    0.87.1; esse lockfile foi descartado e o `pnpm-lock.yaml` ficou só com
    remoções (o importador e os 49 pacotes que só o `style-dictionary`
    alcançava), conferido com `pnpm install --frozen-lockfile`;
  - `arch.config.json` sem `style-dictionary.config.js` em `nonRuntimeRoots` (o
    `ratchet:guard` não pediu aprovação) e `knip.jsonc` sem
    `design-tokens/output/**` no `ignore`;
  - `tests/security/route-auth-inventory.test.ts` sem as exceções
    `lib/validations/schemas/` e `style-dictionary.config.js` de
    `RUNTIME_RULE_UNCOVERED` e sem a checagem de forma dos schemas gerados
    (`GENERATED_SCHEMAS`, `generatedSchemaProblem`, `RUNTIME_WORDS` e
    `schemas > 1000`);
  - `tests/security/public-surface.test.ts` sem o `SKIP_PATHS`: os dois arquivos
    à mão de `lib/validations` entram na varredura;
  - `.prettierignore`, `eslint.config.js`, `cspell.config.js`, `tsconfig.json` e
    `.stylelintrc.json` sem as entradas que não achavam nada; `README.md` da
    raiz com `pnpm tokens` e `pnpm check:tokens` no lugar dos comandos apagados;
  - docs vivos com o estado real (`docs/features/design-system.md`,
    `docs/references/dependencies.md`, `docs/architecture/modernization.md`,
    `docs/getting-started/troubleshooting.md`,
    `docs/guides/troubleshooting-quick-reference.md`) e notas datadas nos
    registros de `docs/internal/` que mandavam não apagar o
    `post-prisma-generate.js` (entrada 229).
- Referências que ficam de propósito:
  `tests/visual/support/tailwind-parity-fixture.mjs` lê
  `design-tokens/output/tokens-tailwind.json` da `main` com `git show` (é a
  fonte da produção); `tests/unit/hygiene-check.test.ts` usa
  `lib/validations/schemas/**` só como texto de glob; os registros históricos de
  `docs/` (ver `docs/README.md`) descrevem o código da época. Fora do escopo do
  lote, para o dono de cada arquivo: o comentário do `tailwind.config.cjs` que
  explica por que `design-tokens/output/tokens-tailwind.json` não entrava como
  cor, e o `scripts/safe-postinstall.js` (morto, na linha de base do hygiene),
  que ainda procura o `post-prisma-generate.js` com `existsSync`.

#### Como validar

- `RATCHET_BASE_REF=4b02f52f pnpm ratchet:guard`, `pnpm hygiene`,
  `pnpm test:gates`, `pnpm install --frozen-lockfile`,
  `pnpm exec prisma validate` e `prisma generate` (só o client).
- `pnpm test:security` (inventário de rotas sem as exceções dos arquivos
  apagados; a varredura de módulos aposentados lê `lib/validations`),
  `pnpm lint`, `pnpm typecheck`, `pnpm type-check` e `pnpm build`.
- `git grep -n -e style-dictionary -e design-tokens/output -e post-prisma-generate -e lib/validations/schemas -- ':!docs' ':!CHANGELOG.md'`
  só acha as referências que ficam de propósito e as duas sobras fora do escopo
  (acima).
- Cada teste novo falha com a correção revertida (mutações do lote
  higiene-final: hook com `git add .`, sem a checagem de parte não preparada,
  formatando o repositório inteiro ou passando ao markdownlint o Markdown que o
  `.markdownlintignore` ignora; `test:gates` sem um teste de gate ou com arquivo
  inexistente; gerador zod ou dependência de volta), com restauração conferida
  por sha256.

---

## 226. Mover `three` e `@react-three/*` para `packages/frontend` separa a variante do react-native do `packages/ui`

### Problema CONHECIDO (evitado; decisão pendente)

**Data da Ocorrência**: 2026-09-30 **Severidade**: Média (quebra o teste native
do catálogo) **Status**: EVITADO (onda 9, lote de configuração da faxina: a
mudança foi revertida) **Ambiente**: `package.json`,
`packages/frontend/package.json`, `pnpm-lock.yaml`,
`packages/frontend/src/pages/catalog/ui/CatalogRecipe.native.test.tsx`

#### Descrição

- Com `three` e `@react-three/*` declarados em `packages/frontend` (e fora da
  raiz), os peers opcionais do `@react-three/fiber` deixam de ser resolvidos na
  raiz, e o `packages/ui` passa a receber outra variante do react-native 0.86.3
  (`d9dd…` em vez de `a444…`).
- `CatalogRecipe.native.test.tsx` passou a carregar duas cópias do react-native
  e falhou com "Flow is not supported".

#### Causa raiz

- O pnpm cria uma variante de pacote para cada conjunto de peers resolvidos;
  mudar onde os peers opcionais do r3f são resolvidos muda a variante que o
  `packages/ui` recebe. O grafo ainda mistura react-native 0.86 e 0.87.

#### Solução

- Revertido: `three` e `@react-three/*` continuam na raiz, e as três variantes
  voltaram a ser a mesma (`a444…`), com `test:platform` verde. O motivo está em
  `docs/references/dependencies.md`.
- Mover exige antes colapsar o grafo react-native 0.86/0.87 (`pnpm dedupe`, com
  prova no mobile) e depois tirar o remendo de polyfills do `metro.config.js`
  (DC-26/DC-27, seção "Onda 9" de `docs/architecture/modernization.md`).

#### Como validar

- Depois de qualquer mudança de dependência que toque o react-native ou o r3f:
  `pnpm test:platform` (inclui `CatalogRecipe.native.test.tsx`) e o `realpath`
  do `react-native` visto de `packages/frontend`, `packages/ui` e
  `apps/clients/mobile` (a mesma variante nos três).

---

## 225. Higiene: código e configuração mortos, e gate permanente `pnpm hygiene`

### Problema RESOLVIDO (itens "decidir" pendentes)

**Data da Ocorrência**: 2026-09-30 **Severidade**: Baixa (sobras que confundem
manutenção e agentes) **Status**: RESOLVIDO em parte (onda 9, faxina)
**Ambiente**: `knip.jsonc`, `tools/hygiene-check.mjs`,
`tools/hygiene-knip-reporter.mjs`, `tools/hygiene-baseline.json`,
`tools/ratchet-guard.mjs`, `eslint.config.js`, `package.json`, `.gitignore`,
`.github/workflows/ci.yml`

#### Descrição

- O inventário de higiene da onda 9 (só leitura) mediu arquivos sem importador,
  exports nunca usados, dependências sem uso ou "fantasmas", scripts e configs
  mortos, código comentado, logs de depuração e saídas de ferramenta fora do
  `.gitignore`. Exemplos: 12 arquivos de `lib/`, `schemas/` e `types/` sem
  entrada; o exemplo do `storybook init`; o `DesignDialog` comentado em
  `CategoriaDialog.web.tsx`; `lib/validations` com 2.799 arquivos gerados, dos
  quais 2 são usados (e escritos à mão); 18 dependências sem uso; o `webpack()`
  do `next.config.mjs` da raiz, que o Turbopack ignora.
- Nada impedia sobra nova.

#### Causa raiz

- Migração incremental sem gate de código morto: a raiz legada e os pacotes
  novos coexistem, e o que ficava sem uso não reprovava nada.

#### Solução

- Remoções com prova (busca por nome, especificador, string e glob, e os gates
  verdes depois):
  - 75 arquivos mortos (59 de código, teste ou story, com 4.752 linhas, e 16
    imagens do exemplo do Storybook), 30 símbolos mortos em 8 módulos vivos de
    `lib`/`app` (845 linhas) e 630 linhas de código comentado;
  - cinco testes que eram a única cobertura de funções vivas de
    `@gb-locacoes/domain` (alíquota, tributo, código e validade do orçamento,
    vencimento do boleto) foram movidos para `packages/domain`, não apagados;
  - 18 dependências sem uso; cada pacote declara o que importa; especificadores
    `latest` fixados na versão travada, sem mudar nenhuma versão do lockfile;
  - scripts mortos do `package.json`, 11 arquivos de `scripts/` e configs mortas
    (`vitest.storybook.config.ts`, `vitest.shims.d.ts`,
    `next-openapi-gen.config.js`, `.swcrc`, `vercel-optimized.json`,
    `scripts/.eslintrc.json`, `test-raw-prisma.mjs`);
  - documentos do usuário movidos sem edição para `docs/archive/`;
  - linhas de base só baixaram (arquitetura de 1108 para 1050) e
    `tools/ratchet-transfers.json` ficou sem transferências obsoletas.
- Gate `pnpm hygiene` (knip 6.38 com `knip.jsonc`, `tools/hygiene-check.mjs`),
  no job `architecture` do CI. Reprova arquivo, export, tipo e dependência sem
  uso, variante `.native` órfã, CSS sem importador, tag JSDoc que esconde
  export, arquivo ou export que só teste mantém vivo e saída de ferramenta
  versionada ou fora do `.gitignore`. A linha de base
  (`tools/hygiene-baseline.json`) aceita só itens "decidir", cada um com motivo;
  item com glob lista cada arquivo; item que não acontece mais reprova. O
  `ratchet-guard` reprova item novo na linha de base, exceção nova no
  `knip.jsonc` e negação `!pasta/**` nova em `project`.
- `no-unused-vars` virou erro no ESLint (36 sobras locais corrigidas).
  `.gitignore` cobre as saídas das ferramentas (`test-results/`,
  `playwright-report/`, `.tmp/visual/current/`…). Regra 8 do `AGENTS.md`, "Não
  Deixe Sobras".
- Ficaram de fora: os itens "decidir" (seção "Onda 9" de
  `docs/architecture/modernization.md`) e dois apagamentos revertidos byte a
  byte porque os gates mostraram acoplamento (`widgets/categorias-publicas`,
  dono da classe `.category-card` do `ScrollRevealInit`, e
  `features/carrinho/model/sincronizar.web.ts`, único cliente de `/api/cart/**`
  na allowlist do host).

#### Como validar

- `pnpm hygiene`, `tests/unit/hygiene-check.test.ts` e
  `tests/unit/ratchet-guard.hygiene.test.ts` (em `pnpm test:gates`): um arquivo
  morto sintético reprova, e cada mutação do gate é pega.
- Referência: `docs/features/ratchet-gates.md` (gate de higiene).

---

## 224. Dados pessoais em log: e-mail do cliente no cron de boleto e `console.log` de depuração com endereço

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-30 **Severidade**: Média (dado pessoal em log do
servidor e no console do navegador) **Status**: RESOLVIDO (onda 9, faxina)
**Ambiente**: `app/api/cron/boleto-overdue-alerts/route.ts`,
`packages/frontend/src/pages/orcamento/ui/OrcamentoPage.web.tsx`,
`packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoPreco.tsx`,
`packages/frontend/src/widgets/home-cliente/ui/Vitrine.web.tsx`,
`packages/frontend/src/widgets/avaliacoes-google/ui/Avaliacoes.web.tsx`,
`test-raw-prisma.mjs` (removido)

#### Descrição

- O cron `boleto-overdue-alerts` gravava o e-mail do cliente num `console.log`.
- 16 `console.log` de depuração no frontend, dois deles com endereço e dados do
  cliente ("Salvando endereço" e "Salvando informações do cliente", no
  `OrcamentoPage.web.tsx`).
- `test-raw-prisma.mjs`, solto na raiz, imprimia a `DATABASE_URL`.

#### Causa raiz

- Logs de depuração que ficaram depois do desenvolvimento, fora do `logger` do
  projeto.

#### Solução

- O cron registra pelo `logger` (`lib/logger`) só o id do pagamento e a
  situação; a resposta JSON (contadores) não mudou. O import comentado com TODO
  e o envio de e-mail comentado saíram, com um comentário do motivo.
- Os 16 `console.log` saíram (`OrcamentoPage` 4, `EquipamentoPreco` 3, `Vitrine`
  7, `Avaliacoes` 2), e `test-raw-prisma.mjs` foi apagado.

#### Como validar

- `tests/unit/boleto-overdue-alerts.test.ts`: falha com a rota antiga (o
  `logger` não é chamado e o `console.log` leva o e-mail) e com o e-mail de
  volta na mensagem do `logger`.
- `rg -n "console\.(log|debug|info)\(" packages/*/src apps/clients/*/src -g '!*.test.*'`:
  nenhum resultado.

---

## 223. Paridade Tailwind 3 × 4: sombras, raios, contorno, breakpoints, `hover:`, `space-*` e classes que a produção ignorava

### Problema RESOLVIDO (restauração aplicada por padrão; aguarda aval do dono)

**Data da Ocorrência**: 2026-09-29 **Severidade**: Alta (achado 127: visual
diferente da produção em várias categorias de classe) **Status**: RESOLVIDO
(onda 9, lote css-paridade, duas rodadas) **Ambiente**:
`packages/design-tokens/src/scales.css`,
`packages/frontend/src/app/styles/{utilities,outline,base}.web.css`,
`packages/ui/src/web/{field,trigger}.ts`,
`tests/visual/tailwind-parity.test.ts`,
`tests/visual/support/tailwind-parity.mjs`,
`tests/visual/tailwind-parity/{production,exceptions}.json`

#### Descrição

- A onda 8 provou a paridade só de cor e tamanho de fonte (entrada 219). No
  resto, o Tailwind 4.3.3 renderizava diferente da produção (`main`, `eb4c0098`,
  Tailwind 3.4.17):
  - escalas: o `shadow-sm` do 4 é o `shadow` do 3 (52 arquivos usam
    `shadow-sm`), `blur-sm`, `drop-shadow-*`, `rounded-full`
    (`calc(infinity * 1px)`) e altura de linha de `text-*`; `ring` sem largura
    com 1px (3px no 3) e outra cor padrão;
  - comportamento: `hover:` só com `(hover: hover)`, `transform` separado de
    `translate`/`scale`/`rotate`, `space-*`/`divide-y` com outro seletor e
    especificidade, `text-*` com `--tw-leading`, ordem de variantes
    (`after:md:`) e preflight de botões e campos;
  - contorno: `outline-1` e `outline-2` passaram a desenhar sozinhos;
  - classes que o 3 não gerava e o 4 desenha: opacidade fora da escala
    (`from-orange-400/12 via-orange-500/6 to-orange-700/8`, o degradê do
    cabeçalho de 11 páginas, `bg-yellow-400/8`, `to-black/12`, `to-gray-900/98`,
    `border-current/20`), `border-l-3`, `duration-160`, `flex-2` e afins.
- Na primeira rodada, a correção de `outline-<n>` gravou
  `--tw-outline-style: none`, e os gatilhos com `TRIGGER_FRAME` (Popover,
  Accordion, Collapsible, Dialog, Sheet, Drawer, NavigationMenu) perderam o anel
  azul de 2px do foco por teclado que a produção mostra (WCAG 2.4.7). E os
  breakpoints do 4 são em rem: com a fonte do navegador em 20px, `md:` só valia
  a partir de 960px.

#### Causa raiz

- A migração para o Tailwind 4 mudou escalas, padrões e a semântica de
  utilitários e variantes, e passou a gerar classes que o 3 ignorava; a prova
  anterior só cobria cor e fonte.

#### Solução

- Semântica da produção no tema e nas camadas, sem reescrever consumidor um a um
  e sem `!important`:
  - `scales.css` (`@theme inline`): `shadow-sm`, `blur-sm`, `drop-shadow-*`,
    `rounded-full`, altura de linha de `text-*`, `outline` e `ring` sem largura
    (3px, azul 500 a 50%) e breakpoints `sm`…`2xl` em px (640 a 1536), com os
    valores em `primitives.ts`;
  - `utilities.web.css`: `hover:` sem `(hover: hover)` (`hover-always` igual a
    `hover`), `transform` único, `space-*`/`divide-y` a partir do segundo filho,
    `text-*` sem `--tw-leading`, listas de `transition`, `container` e
    `justify-self-end`; o preflight do 3 em `base.web.css`;
  - `outline.web.css` (novo): `outline-<n>` só dá a largura, como no 3
    (`outline-style: var(--tw-tw3-outline-style, revert-layer)`). Os utilitários
    de estilo (`outline`, `outline-solid`, `-dashed`, `-dotted`, `-double`,
    `-none`, `-hidden`) gravam a variável, registrada com `@property` sem
    herança nem valor inicial; sem utilitário de estilo, o `revert-layer`
    devolve o do navegador: nada em repouso e o anel `auto` no foco por teclado.
    É o único `revert-layer` aprovado (`index.styles.test.ts`). `outline-hidden`
    grava sólido nas cores forçadas, como o `outline-none` do 3;
  - `FIELD_FRAME` e `FILTER_FIELD_FRAME` ganharam `focus:outline-hidden` (a
    produção apagava o anel do campo e do seletor de filtro por regra global).
- As classes inertes na produção saíram do código. Sintaxe que vale daqui em
  diante: `outline-hidden` no lugar de `outline-none`; `[var(--x)]` no lugar de
  `[--x]`; `[transition-timing-function:…]` no lugar de `ease-[…]`; variante
  responsiva primeiro (`md:after:`); `[@media(max-width:N)]` no lugar de
  `max-[N]`; `_` no lugar de vírgula em valor arbitrário; `/50` no lugar de
  `ring-opacity-*`.
- Teste de paridade versionado, `tailwind-parity.test.ts`: um motor de cascata
  pequeno resolve o CSS atual (camadas, especificidade, `revert-layer`, `var()`,
  `@property`, `@media` a 1440 e 390 px, foco por teclado e por mouse, cores
  forçadas, fonte do navegador em 20px) e compara cada utilitário e cada cadeia
  de variantes usados no produto com o valor da produção gravado na fixture.
  Classe nova sem valor da produção reprova. Exceções só em `exceptions.json`,
  com motivo (moldura dos campos, anel de foco laranja, estado de erro
  `aria-invalid`, `sr-only` com `clip-path`, especificidade menor de
  `group-*`/`peer-*`).
- Linha de base visual regravada na 1ª rodada (6254 valores) e, na 2ª, só com o
  estado novo `foco-teclado-categoria`; histórico em `tests/visual/README.md`.
- Diferença que fica (decisão do dono): nas cores forçadas (alto contraste do
  Windows), a caixa de seleção do Radix e as abas mantêm o contorno no foco; a
  produção o apagava com `outline: none !important`, que o projeto proíbe.

#### Como validar

- `pnpm test:visual-tools` (`tailwind-parity.test.ts`). Regenerar a fixture:
  `node tests/visual/support/tailwind-parity-fixture.mjs` (precisa do Tailwind
  3.4.17 e dos plugins da `main` no armazenamento do pnpm).
- `packages/design-tokens/src/primitives.test.ts` (breakpoints em px,
  `--default-outline-width: revert-layer`),
  `packages/frontend/src/app/index.styles.test.ts` e os testes de `Input`,
  `Select` e `CustomSelect` (`focus:outline-hidden` depois do `tailwind-merge`).
- Linha de base visual (`tests/visual/README.md`): 0 diferenças.

---

## 222. Build da raiz lia `docs/` e `tools/`: 20 regras `!important` no CSS

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-29 **Severidade**: Baixa (achado 122; o CSS do
`build:web` estava limpo) **Status**: RESOLVIDO (onda 8, lote fech-css)
**Ambiente**: `packages/frontend/src/app/styles/globals.web.css`

#### Descrição

- O `next build` da raiz legada usava a detecção automática de fontes do
  Tailwind 4 a partir da pasta do build e lia `docs/*.md` (as entradas antigas
  desta página citam classes com `!` já removidas) e os comentários de
  `tools/token-check.mjs`: o CSS saía com 20 regras `!important`.

#### Causa raiz

- Detecção automática de fontes relativa à pasta de quem compila.

#### Solução

- A entrada usa `@import 'tailwindcss' source(none)` e declara as fontes
  (`packages/ui/src`, `packages/frontend/src` e `apps/clients/web/src`), mais a
  raiz legada pelo `content` do `tailwind.config.cjs`. O build da raiz e o
  `build:web` geram o mesmo CSS, com um único `!important` (o `[hidden]` do
  preflight do Tailwind) e nenhum `oklch`.

#### Como validar

- `packages/frontend/src/app/index.styles-build.test.ts`: compila a entrada como
  o `build:web` e como o build da raiz, exige CSS idêntico e nenhum `!important`
  além do `[hidden]`.

---

## 221. Anéis de foco próprios em `orange-500` e anel no clique do seletor de período

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-29 **Severidade**: Baixa (achado 120: foco fora
da decisão do usuário) **Status**: RESOLVIDO (onda 8, lote fech-css, duas
rodadas) **Ambiente**: `packages/ui/src/web/{Tabs,HoverActionMenu}.web.tsx`,
`packages/ui/src/web/focus-ring.test.ts`,
`packages/frontend/src/widgets/seletor-data/ui/DateRangePicker.web.tsx`,
`packages/frontend/src/pages/categorias/ui/CategoriaDialog.web.tsx`,
`packages/frontend/src/pages/email-admin/ui/email-layout-container.tsx`,
`packages/frontend/src/widgets/personalizar-icone/ui/Bloco.web.tsx`

#### Descrição

- Oito anéis próprios `focus-visible:ring-orange-500` ou `outline-orange-500`
  (painel das `Tabs`, `HoverActionMenu`, `CategoriaDialog`,
  `email-layout-container` e `Bloco` de `personalizar-icone`), fora do token
  `--focus-ring` (`#ea580c`), decisão do usuário da onda 5.
- O gatilho do seletor de período (filtro de e-mail do painel) tinha
  `focus:border-orange-500 focus:ring-2 focus:ring-orange-500`: anel laranja 500
  também no clique do mouse (a produção também o mostrava).
- 25 `focus:ring-orange-500` sem largura de anel (Endereços, Perfil, Alíquotas,
  `CartaoPeriodo`, `FiltroAdmin`) não desenhavam nada, nem na produção.

#### Causa raiz

- Anéis escritos em cada componente antes do `FOCUS_RING`, sem guarda.

#### Solução

- Todos passaram a `FOCUS_RING` (contorno de 2px no `--focus-ring`, afastado
  2px, só em `:focus-visible`); o seletor de período o importa de
  `@gb-locacoes/ui`; os 25 mortos saíram (o CSS compilado perdeu 3 regras e não
  ganhou nenhuma). Os anéis semânticos (verde do WhatsApp, rosa do `Bloco`)
  ficaram.
- Mudança intencional: no seletor de período, o clique não mostra mais anel;
  pelo teclado, só o anel da marca.
- Guarda `focus-ring.test.ts`: nenhum anel, contorno ou borda laranja em
  `:focus`, `:focus-visible` e `:focus-within` (com variantes encadeadas e o
  `!`) em `packages/ui/src`, `packages/frontend/src` e `apps/clients/web/src`.

#### Como validar

- `packages/ui/src/web/focus-ring.test.ts`, `Tabs.web.test.tsx`,
  `HoverActionMenu.web.test.tsx` (antes afirmavam o anel `orange-500`) e
  `DateRangePicker.foco.web.test.tsx` (render real: o gatilho tem as classes de
  `FOCUS_RING` e nenhuma classe `focus:`).

---

## 220. Molduras dos campos apagavam o erro de validação: estado por `aria-invalid`

### Problema RESOLVIDO (mudança visual intencional)

**Data da Ocorrência**: 2026-09-29 **Severidade**: Média (achado 121: a borda de
erro da validação nunca aparecia) **Status**: RESOLVIDO (onda 8, lote fech-css)
**Ambiente**: `packages/ui/src/web/field.ts`, `packages/ui/src/web/cn.ts`,
`packages/design-tokens/src/tokens.css`,
`packages/frontend/src/app/styles/globals.web.css`,
`packages/frontend/src/pages/orcamento/ui/QuoteForm.web.tsx`,
`packages/frontend/src/widgets/personalizar-icone/ui/Bloco.web.tsx`

#### Descrição

- As molduras (`FIELD_FRAME`, `FILTER_FIELD_FRAME`, `TEXTAREA_FRAME`) entram
  depois do `className` e anulavam a borda solta de erro dos consumidores:
  `border-red-500` em 7 campos do `QuoteForm` e `border-rose-400` no nome do
  ícone próprio do `Bloco`.
- Pelo mesmo motivo, o `focus:border-green-500` do campo do WhatsApp e o marcado
  em ardósia do Rejeitar nunca valeram; na produção também não valiam (regras
  globais, uma delas com `!important`).

#### Causa raiz

- Moldura sem estado: a regra "o consumidor muda tamanho, não borda" apagava
  também o estado de erro.

#### Solução

- `FIELD_INVALID` fecha as três molduras: com `aria-invalid="true"`, borda
  `--field-invalid` (`#ef4444`) e, no foco, o halo vermelho
  `--shadow-control-invalid-focus`. Tokens novos `--field-invalid`,
  `--field-invalid-halo` e `--shadow-control-invalid-focus` em `tokens.css`
  (mapeados em `primitives.ts`), ponte `--color-field-invalid` na entrada do CSS
  e a sombra registrada no `cn`.
- `QuoteForm` e `Bloco` usam `aria-invalid` no lugar da classe solta. Erro de
  validação é sempre `aria-invalid`, nunca uma borda solta.
- WhatsApp e Rejeitar ficaram como a produção (decisão pendente: variantes
  nomeadas, remover as classes mortas ou manter).

#### Como validar

- `packages/ui/src/web/field.test.ts` (as molduras terminam com `FIELD_INVALID`;
  `Input`, `CurrencyInput` e `Textarea` com `aria-invalid` mantêm as classes de
  erro depois do `cn`),
  `packages/frontend/src/pages/orcamento/ui/QuoteForm.web.test.tsx` (render
  real: a etapa 1 inválida marca nome, telefone e e-mail) e
  `packages/frontend/src/app/index.styles-build.test.ts` (regras
  `[aria-invalid="true"]` compiladas com o token).
- Linha de base visual: receita `Form`, estado `invalid`, do `/catalog`, com
  borda `rgb(239, 68, 68)`.

---

## 219. Tailwind 4 × produção: paleta OKLCH, `text-base` como cor e `line-height` sem unidade no `Text`

### Problema RESOLVIDO (restauração aplicada por padrão; aguarda aval do dono)

**Data da Ocorrência**: 2026-09-29 **Severidade**: Alta (achados 117 e 118: cor
da marca e tamanhos de texto diferentes da produção em todo o produto) e Média
(achado 119) **Status**: RESOLVIDO (onda 8, lote fech-css, duas rodadas; fecha
as entradas 169, 170 e 204) **Ambiente**:
`packages/design-tokens/src/{palette.css,primitives.ts}`,
`packages/frontend/src/app/styles/{globals,utilities}.web.css`,
`tailwind.config.cjs`, `packages/ui/src/web/Text.web.tsx`

#### Descrição

- 117: a paleta do Tailwind 4 é OKLCH. `orange-600` renderizava perto de
  `#f54a00`, não o `#ea580c` da produção e da marca, e o mesmo valia para
  `slate-700` e os demais tons; os degradês `bg-gradient-to-*` interpolavam em
  `oklab` (entrada 169).
- 118: o spread `...designTokens` do `tailwind.config.cjs` (de
  `design-tokens/output/tokens-tailwind.json`) registrava `base`, `small` e
  `h1`–`h3` como cores: `.text-base{color:clamp(...)}` e nenhum tamanho (entrada
  170). Na home, os títulos dos cartões saíam com 36px em vez de 18px.
- 119: o `Text` do design system gravava `line-height: 24` sem unidade no web:
  24 vezes a fonte, 384px (entrada 204).

#### Causa raiz

- A troca para o Tailwind 4 mudou a paleta padrão; o spread morto de tokens e o
  número do tema pensado para o React Native (pixels) viraram cor e
  multiplicador no web.

#### Solução

- Paleta completa do Tailwind 3.4.17 em hex no `@theme` de
  `packages/design-tokens/src/palette.css`, importada pela entrada do CSS. A
  fonte canônica é `primitives.tailwind` (`primitives.ts`), com impressão
  digital sha256 dos valores do 3.4.17. Os 40 tons homônimos de `color` são
  referências a ela (`orange600: tailwind.orange600`), porque
  `pnpm check:tokens` exige uma única definição hex de `orange600` (a 1ª rodada
  duplicou o hex e quebrou o gate). `white` continua separado (`#fff` na paleta,
  `#ffffff` nos consumidores; um teste confere que é a mesma cor).
  `bg-gradient-to-*` foi redefinido em `utilities.web.css` para interpolar em
  sRGB, como na produção.
- O spread saiu do `tailwind.config.cjs` (nada dependia dele): `text-base`,
  `text-small` e `text-h1`–`h3` voltam a ser tamanho fluido com a altura de
  linha da produção, e `pnpm design-system:build-tokens` não alimenta mais o
  Tailwind.
- `Text.web.tsx` grava a altura de linha em px; o nativo não mudou.
- Prova por classe contra a `main` compilada, a 1440 e 390 px: 476 classes de
  cor, 30 de tamanho de fonte e 6 degradês idênticos; exceções listadas com
  motivo. Linha de base visual regravada (histórico em
  `tests/visual/README.md`).

#### Como validar

- `packages/design-tokens/src/primitives.test.ts` (22 famílias × 11 tons,
  impressão digital e uma definição hex por tom) e `pnpm check:tokens`.
- `packages/frontend/src/app/index.styles-build.test.ts` (cada `--color-*` igual
  ao hex, degradês sem `in oklab`, `text-base` com `font-size`) e
  `packages/ui/src/web/Text.web.test.tsx` (altura de linha em px).

---

## 218. Inventário de rotas: da caça a fluxos à regra estrutural e ao contrato em camadas

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-29 **Severidade**: Média (achados 26, 27 e 30 da
revisão da onda 4; 108, 111, 112, 123 e 124 das revisões seguintes) **Status**:
RESOLVIDO (ondas 6 a 9) **Ambiente**:
`tests/security/route-auth-inventory.test.ts`,
`tests/security/route-auth-normalization.test.ts`,
`tools/eslint-runtime-rewrite.mjs`, `eslint.config.js`,
`tests/unit/eslint-runtime-rewrite.test.ts`,
`app/api/admin/rentals/[id]/contract/route.ts`,
`app/api/admin/zoho-mail/oauth/callback/route.ts`,
`docs/architecture/security.md`

#### Descrição

- O inventário prova, rota por rota, que nenhum acesso a dados roda antes do
  guard. Cada revisão achou um jeito de passar com o teste verde:
  - 26: acesso a dados por parâmetro de função, membro de objeto literal ou de
    classe, parâmetro de callback e `import()` dentro de função local; um GET
    anônimo devolvia a tabela inteira antes do guard;
  - 27: rotas da `PUBLIC_ALLOWLIST` (aposentadas, `test-login`, o catch-all
    `[...rest]`) com `import()` ou `require()` por namespace;
  - 30: dono `CLIENT` aceito quando o id da rota ia para qualquer efeito, mesmo
    com um `deleteMany` sem dono depois;
  - 108: métodos implícitos de objeto literal (getter, `toString`, `then`,
    `Symbol.toPrimitive`) e contêineres; depois, `.constructor` até o
    `Function`, escrita em protótipo nativo e chave computada;
  - 111: `instanceof` com classe importada antes do guard roda
    `Symbol.hasInstance`; 112: a carga do módulo rodava callbacks pelo zod
    (`parse`, `safeParse`, `refine`, `config`) e lia getters de valores
    entregues ao zod; na 2ª rodada, `@/zod` e `lib/catalog/index` se passavam
    por módulos das listas;
  - 123: classe alcançada por valor (`Object.getPrototypeOf(RangeError)`,
    `new CatalogError().constructor`, `Reflect`) ganhava `Symbol.hasInstance`, e
    `lib/catalog.tsx` ao lado de `lib/catalog.ts` enganava a resolução (o Next
    carrega arquivos diferentes do analisador); 124: defaults e chaves de
    padrões de desestruturação no topo do módulo rodavam na carga.

#### Causa raiz

- O inventário "caçava fluxos": analisava só o que via por nome ou por
  inicializador, e cada construção da linguagem abria outra brecha. Uma análise
  estática sozinha não fecha o que o runtime pode reescrever.

#### Solução

- Onda 6 (26, 27, 30): contaminação pelos argumentos, classes do arquivo, carga
  dinâmica de módulo no `reach` da allowlist e dono `CLIENT` só quando todo
  acesso depois da checagem recebe o dono.
- Onda 7 (108): regra estrutural no lugar da caça a fluxos. Todo método não
  público começa pelo guard; antes dele, só o `PROLOGUE` (lista fechada) e
  código INERT, uma gramática fechada (`INERT_SYNTAX`, `FORBIDDEN_MEMBERS`,
  `HOOK_KEYS`, `INERT_CALLS`, `INERT_METHODS`); a carga do módulo só com
  `LOAD_SYNTAX`; reflexão e escrita entram no `reach` como `<reflection>#` e
  `<write>#`; `OWNER_CLIENT` provado no argumento de cada acesso (`OWNER_SCOPED`
  ou `where`/`data` que nomeia o dono). Duas rotas foram normalizadas com o
  contrato HTTP caracterizado antes: `POST /api/admin/rentals/[id]/contract`
  (checagem `canManageContracts` logo após o guard, mesmo 403) e o callback
  OAuth do Zoho (guard primeiro, mesmas respostas).
- Onda 8 (111, 112): `instanceof` antes do guard só com `INERT_GLOBAL_CLASSES` e
  `INERT_CLASSES`, seladas em todo o código de servidor (`sealedClassProblems`);
  na carga, zod só com `ZOD_BUILDERS` e `ZOD_NAMESPACES`, e função só como
  primeiro argumento de `transform`/`refine` (`ZOD_CALLBACKS`), conferidos em
  execução contra o zod instalado; cada id de módulo nomeia um único arquivo ou
  pacote (`moduleBinding`).
- Onda 9 (123, 124): contrato fechado em camadas, com o modelo de ameaça em
  `docs/architecture/security.md`:
  1. regra de lint `runtime/no-runtime-rewrite`
     (`tools/eslint-runtime-rewrite.mjs`): o código de servidor não reescreve o
     runtime (reflexão, escrita em global, import ou protótipo, símbolos que
     mudam a linguagem, código dinâmico). Medida antes de ligar (1751 arquivos),
     com três exceções numa lista fechada com motivo (os singletons de
     `lib/prisma.ts`, o `Symbol.toPrimitive` do `AsaasSecretValue` e o console
     do `ClientLayoutShell` no navegador); exceção sem uso reprova;
  2. carga do módulo com gramática fechada sobre todos os nós das instruções de
     topo (padrões, defaults, chaves, decorators, blocos estáticos);
  3. especificador que nomeia mais de um arquivo (entre as extensões e índices
     que o Next, com webpack ou Turbopack, e o TypeScript aceitam) reprova;
  4. autoverificação: a regra ligada como erro em todo o código de servidor,
     nenhum comentário a desliga, e a lista de exclusões é fechada e só encolhe.
- Premissas para revisão humana: alias ou parâmetro que guarda um import,
  `node_modules` e código só do navegador; as funções de `INERT_IMPORTS` e de
  `GUARDS` são tratadas como código confiável.
- A regra ficou de propósito mais estrita que as rotas de hoje: rota nova com
  getter, thenable, tagged template ou classe do arquivo antes do guard, ou com
  leitura de membro de módulo na carga, reprova.

#### Como validar

- `pnpm test:security` (`route-auth-inventory.test.ts`, com os casos dos
  verificadores que precisam reprovar, os controles e o corpus diferencial
  contra o zod instalado; `route-auth-normalization.test.ts`, 17 casos).
- `pnpm lint` e
  `pnpm exec vitest run --config vitest.unit.config.ts tests/unit/eslint-runtime-rewrite.test.ts`
  (o teste roda no `pnpm test:unit`; entrar no `test:gates` é decisão pendente).

---

## 217. Migrations: `DROP INDEX` sem `IF EXISTS` e mensagens de preflight que levavam ao `P3009`

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-29 **Severidade**: Baixa (achados 23 e 24 da
revisão da onda 4 e achado 110) **Status**: RESOLVIDO (ondas 6 e 7)
**Ambiente**: `prisma/migrations/202609260001` a `202609260005`,
`tests/unit/migration-preflight-rls.test.ts`,
`docs/features/tenant-slug-policy.md`

#### Descrição

- 23: a `0004` removia o índice legado com `DROP INDEX` sem `IF EXISTS`; no
  banco sem ele (o caso em que o preflight dispara), a migration falhava com
  `42704` mesmo depois da reconciliação. O teste escondia isso apagando o
  histórico `CANCELLED` e recriando o índice legado.
- 24 e 110: as mensagens dos preflights e o runbook mandavam "rodar o deploy de
  novo"; depois de uma falha, o Prisma registra a migration como falha e recusa
  o deploy seguinte com `P3009`.

#### Causa raiz

- Passo final sem idempotência e runbook escrito sem ensaiar o
  `prisma migrate deploy` real.

#### Solução

- `DROP INDEX IF EXISTS`; o caminho de sucesso do teste reconcilia cancelando a
  cobrança excedente e mantém o histórico `CANCELLED`.
- Toda `RAISE EXCEPTION` de preflight (`0001` a `0005`) manda corrigir os dados,
  rodar `pnpm exec prisma migrate resolve --rolled-back <migration>` e só então
  `pnpm exec prisma migrate deploy`; a §8 de `tenant-slug-policy.md` também.
  Regra geral na entrada 192.
- O texto das migrations mudou (nunca foram implantadas): um banco que já as
  aplicou, inclusive descartável, acusa checksum diferente; recrie o banco.

#### Como validar

- `tests/unit/migration-preflight-rls.test.ts`: teste estático das mensagens e
  da §8, e `prisma migrate deploy` real para `0001`, `0002`, `0003`, `0004` e
  `0005` (`P3018`/`P0001`, depois `P3009`, depois a recuperação copiada da
  mensagem aplica a migration).

---

## 216. Gates: isenção escondia `!important`, escopo estreitado sem dívida passava, papel LOGIN sem senha e testes que podiam chamar a rede

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-29 **Severidade**: Média (achados 22, 28 e 29 da
revisão da onda 4) **Status**: RESOLVIDO (onda 6, lote travas-banco, duas
rodadas) **Ambiente**: `tools/ratchet-guard.mjs`,
`tests/unit/ratchet-guard.test.ts`, `tests/unit/database-roles.test.ts`,
`tests/helpers/no-network.ts`, `tests/unit/no-network.test.ts`,
`vitest.unit.config.ts`, `vitest.security.config.ts`,
`vitest.identity.config.ts`

#### Descrição

- 28: o `ratchet-guard` só comparava contagens de catraca; um arquivo novo com
  `!mt-0` escondido por `tokens.ignoreFiles` na mesma mudança passava em todos
  os gates (o `lint:css` só lê `.css`). Na 2ª rodada: aprovar a isenção antes de
  o arquivo existir e criá-lo na mudança seguinte também passava.
- 29: estreitar o escopo onde hoje não há dívida passava, e a dívida entrava no
  PR seguinte; uma transferência de configuração já aplicada na base deixava o
  CI seguinte vermelho.
- 22: dois testes de banco ainda criavam papel LOGIN sem senha e falhavam no CI
  com SCRAM (corrigido na onda 5; faltava a trava).
- Testes das suítes unit, security e identity podiam chamar a rede (um teste
  antigo chegava ao Asaas).

#### Causa raiz

- Guard que media só a dívida existente e confiava nas isenções da configuração;
  nenhuma trava contra rede nos testes.

#### Solução

- `ratchet-guard`: com a configuração alterada, compara todos os achados por
  arquivo e, por arquivo e regra, os de tolerância zero e os absolutos. Política
  declarada (`CONFIG_POLICY`): escopos não perdem entrada, isenções não ganham
  entrada sem aprovação, chave desconhecida precisa ser igual à da base e
  `canonical` novo não se sobrepõe ao escopo. O `css-important` é medido a cada
  execução sem as isenções do `arch.config.json` (só os padrões do
  `token-check`) e sobre a união dos escopos: nenhuma aprovação cobre tolerância
  zero. Transferência de configuração (`{config, from, to, reason}` em
  `tools/ratchet-transfers.json`) validada no git; a que a base já aplicou é
  obsoleta, ignorada e não cobre nada.
- `tests/unit/database-roles.test.ts`: varredura estática reprova papel LOGIN
  sem `PASSWORD` ou URL com senha em branco, e confere com banco que
  `createLoginRole` grava verificador SCRAM.
- `tests/helpers/no-network.ts`, no setup das três configurações: bloqueia
  `fetch`, `http`/`https` e `net.Socket#connect` para qualquer host fora de
  `localhost`, `127.0.0.1` e `::1`. Teste que precisa de provedor usa o dublê.

#### Como validar

- `pnpm test:gates` (`ratchet-guard.test.ts`),
  `tests/unit/database-roles.test.ts` e `tests/unit/no-network.test.ts` (reprova
  sem o setup).
- Limites conhecidos: o guard mede com as ferramentas da própria mudança (um PR
  que mude os padrões de `tools/token-check.mjs` depende de revisão), e o
  `ignoreDirs` do `token-check` compara o nome em qualquer profundidade.

---

## 215. Painel: sugestão `?locadora=` perdida no índice `/admin` e `/admin` sem sessão preso no portão

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-29 **Severidade**: Média (achado 32 da revisão
da onda 4; achados 114 e 115) **Status**: RESOLVIDO (ondas 6 e 8) **Ambiente**:
`packages/frontend/src/features/selecionar-locadora/model/use-tenant-suggestion.ts`,
`apps/clients/web/src/app/(admin)/admin/page.tsx`,
`packages/frontend/src/app/providers/RuntimeBootstrap.tsx`,
`packages/frontend/src/features/entrar/model/redirect.ts`

#### Descrição

- 32: com outra locadora já selecionada, o índice `/admin` trocava a URL por
  `/admin/dashboard` sem a query, e a pergunta do `?locadora=` sumia; sem
  sessão, o `?locadora=` também se perdia.
- 114: o `RuntimeBootstrap` tinha cópia própria de `signInHref` e
  `SIGN_IN_PATH`.
- 115: no host `app`, `/admin` sem sessão ficava em "Entre na sua conta para
  selecionar uma locadora." (o portão escondia o índice, que redirecionaria). A
  1ª correção redirecionava cedo demais: depois de um erro de sessão, "Tentar
  novamente" ou navegar levava ao login antes de a nova leitura responder.

#### Causa raiz

- O hook zerava a sugestão quando a nova URL não trazia o parâmetro; regra de
  login duplicada; o portão tomava o status de uma leitura anterior (o
  `refresh()` limpa o erro na hora, e numa troca de rota o efeito do filho roda
  antes do efeito do pai).

#### Solução

- `useTenantSuggestion` guarda a sugestão até ela ser confirmada ou dispensada;
  o índice `/admin` preserva a query inteira (para o dashboard e no
  `callbackUrl` do login).
- O `RuntimeBootstrap` importa `signInHref` do index público de
  `features/entrar`; `SIGN_IN_PATH` só existe em
  `features/entrar/model/redirect.ts`.
- Painel do host `app` (modo seleção): rota privada sem sessão confirmada vai
  direto a `/login?callbackUrl=<caminho visível + query>` com `location.replace`
  (sai do histórico), mostrando só "Redirecionando...". Só confirma o visitante
  uma leitura respondida para a rota atual (`answeredKey`, e `sessionPending` no
  portão); com leitura pendente, "Carregando...". Vitrine, telas do app, erro de
  sessão e "Sair" continuam como antes.

#### Como validar

- `TenantSelector.suggestion.test.tsx`,
  `apps/clients/web/src/app/(admin)/admin/page.test.tsx` (índice real dentro do
  portão, com `usePublicTenantRouting`), `RuntimeBootstrap.test.tsx` ("só a
  leitura já respondida confirma o visitante") e
  `RuntimeBootstrap.entrar.test.tsx`.

---

## 214. Diretório: `q` com caractere de controle respondia 500 depois de gastar a janela

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-29 **Severidade**: Baixa (achado 25 da revisão
da onda 4) **Status**: RESOLVIDO (onda 6, lote rotas-diretorio) **Ambiente**:
`packages/contracts/src/directory.ts`, `app/api/public/tenants/route.ts`,
`lib/rate-limit.ts`, `packages/backend/src/modules/directory/rate-limit.ts`

#### Descrição

- `GET /api/public/tenants?q=%00%00%00` passava pelo schema (o `trim` não tira
  U+0000), consumia a janela e chegava ao `ILIKE`; o PostgreSQL recusava com
  `22021`, e a rota respondia 500 com a pilha no log a cada chamada.
- Pendência da onda 5: o segredo do limitador do diretório ainda seguia
  `NODE_ENV`.

#### Causa raiz

- Schema sem recusa de caractere de controle; segredo calculado por um primitivo
  com padrão `process.env`.

#### Solução

- `DirectorySearchQuerySchema` recusa caractere de controle (`/^\P{Cc}*$/u`):
  C0, DEL e C1 dão 400 `INVALID_QUERY` antes do limitador e do banco.
- A rota usa `identityRateLimitSecret` de `lib/rate-limit.ts` (critério
  `isPlatformProduction`); o primitivo `platformRateLimitSecret` perdeu o padrão
  `process.env`, e um teste estático garante que só `lib/rate-limit.ts` o chama.
- Na extração de 2026-09-30, essas funções foram movidas sem mudança de
  comportamento para `backend/modules/directory/security-env.ts`; a raiz
  importa/reexporta a mesma implementação. O teste estático mantém um único
  chamador do primitivo, agora no módulo compartilhado, e inclui o serviço na
  varredura. IP confiável também saiu para
  `backend/modules/identity/client-ip.ts`.

#### Como validar

- `packages/contracts/src/directory.test.ts` e
  `tests/security/directory.test.ts` (seis queries de controle em
  `INVALID_QUERIES`, sem consumir a janela).

---

## 213. Host de locadora: API de conta nos dois `basePath`, regra do `basePath` repetida e `enroll` fora de host sem `TENANT_REQUIRED`

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-29 **Severidade**: Baixa (achados 9 e 10 da
revisão da onda 4; achados 107 e 113) **Status**: RESOLVIDO (ondas 6 e 8)
**Ambiente**: `packages/contracts/src/platform.ts`,
`apps/clients/web/src/host/routing/{route-table,decide,platform-proxy}.ts`,
`apps/clients/web/src/proxy.ts`,
`apps/clients/web/src/host/auth/{mode,client}.ts`,
`apps/clients/mobile/src/host/auth/client.ts`,
`packages/backend/src/modules/identity/configuration.ts`,
`app/api/client/enroll/route.ts`

#### Descrição

- 9: `TENANT_ACCOUNT_API` gerava cada endpoint nos dois `basePath` (`/api/auth`
  e `/api/auth/v2`) em qualquer modo. No `better-auth-v2`, `/api/auth` é o
  NextAuth, que ignora segmentos a mais:
  `POST /api/auth/callback/credentials/oauth-proxy` num host de locadora fazia o
  login por credenciais e gravava a sessão do NextAuth ali, contra a regra de
  que o callback só existe no `app`.
- 107 e 113: o mapeamento modo → `basePath` estava repetido no host web, na
  tabela de rotas, no app mobile e no backend.
- 10: `POST /api/client/enroll` fora de host de locadora respondia três
  contratos diferentes (409 sem `code`, 404 neutro depois de consultar o banco,
  ou 409 `TENANT_REQUIRED`), em vez do 409 `TENANT_REQUIRED` documentado.

#### Causa raiz

- O proxy recebia só um booleano (`tenantAccountEnabled`), sem o modo; cada
  cliente escrevia a própria regra; o `enroll` resolvia a locadora pelo corpo
  antes de olhar a borda.

#### Solução

- Regra única em `@gb-locacoes/contracts/platform`: `AUTH_MODES`, `AuthMode`,
  `BETTER_AUTH_BASE_PATHS`, `betterAuthBasePath` e `parseAuthMode`. Consomem o
  host web (`mode.ts`, `client.ts`), o proxy (`route-table.ts` reexporta a regra
  e monta `TENANT_ACCOUNT_API` por `tenantAccountApiOf(mode)`), o app mobile e o
  backend (`identity/configuration.ts`).
- O proxy recebe o modo (`DecideEnv.authMode`, de `NEXT_PUBLIC_AUTH_MODE` por
  `hostAuthMode` em `src/proxy.ts`): `legacy` sem API de conta, `better-auth` em
  `/api/auth`, `better-auth-v2` em `/api/auth/v2`. No v2, nenhuma entrada do
  host de locadora chega a uma ação do NextAuth além de `/api/auth/session`.
- `enroll` decide primeiro pela borda
  (`resolvePublicRequestTenant(hostOnly(request))`, o recorte de `/current`):
  fora de host de locadora, 409 `{error, code: 'TENANT_REQUIRED'}` com
  `private, no-store` e `Vary: Cookie, Host`, antes de ler o corpo ou o banco;
  `tenantSlug` de outra locadora dá 400 `TENANT_CONFLICT`.

#### Como validar

- `route-table.nextauth.test.ts`, `route-table.base-path.test.ts`,
  `decide.test.ts`, `tests/security/tenant-auth-api.test.ts` (endpoints reais do
  Better Auth por modo), `packages/contracts/src/platform.test.ts`
  (`/api/auth/v2` literal só no contrato),
  `apps/clients/web/src/host/auth/{mode,client}.test.ts`,
  `tests/identity/configuration.test.ts` e
  `tests/identity/enroll.integration.test.ts`.

---

## 212. Identidade: link de e-mail da conta global na origem de qualquer locadora, e-mail de verificação dentro da transação e falha de entrega depois do commit

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-29 **Severidade**: Média (achado 8 da revisão da
onda 4, a regressão da 1ª correção e o achado 106) **Status**: RESOLVIDO (ondas
6 e 7) **Ambiente**: `packages/backend/src/modules/identity/factory.ts`,
`lib/identity.ts`, `lib/rate-limit.ts`, `app/api/auth/register/route.ts`

#### Descrição

- 8: os links de redefinição de senha e de verificação saíam na origem do host
  do pedido para qualquer conta, inclusive de equipe de outra locadora: um
  script na locadora B pedia o reset do admin de A, lia o token no link
  `https://b.<raiz>/reset-password?token=…` e tomava a conta no `app`.
- Regressão da 1ª correção: o `sendVerificationEmail` rodava dentro da transação
  do cadastro, e a consulta da origem (`accountLinkOrigin`) esperava uma segunda
  conexão que o pool de produção não tem (1; 2 no pooler `:6543`): 5 s de
  espera, nenhuma conta criada e o e-mail enviado mesmo assim, tudo atrás do 202
  neutro.
- 106: falha de entrega do e-mail depois do commit virava `registration_failed`
  com a conta criada e sem reenvio (`/send-verification-email` fica desligado
  por HTTP).

#### Causa raiz

- Origem do link pelo pedido, não pela conta; efeito externo dentro da transação
  do motor; falha de entrega tratada como falha do cadastro.

#### Solução

- `accountLinkOrigin`: a origem da locadora só para cliente `ACTIVE` daquela
  locadora `ACTIVE`, com papel global `CLIENT` e sem vínculo de equipe em
  locadora nenhuma; qualquer outro caso, inclusive falha da consulta, usa o
  `baseURL` do `app`. Cadastro novo em host de locadora recebe o link do `app`
  (ainda não tem vínculo antes do `POST /api/client/enroll`).
- `runningAfterCommit` envolve o adaptador Prisma do motor com uma fila por
  transação (`AsyncLocalStorage`); `sendVerificationEmail` vai por
  `afterCommit`, depois do commit e com a conexão devolvida; transação desfeita
  descarta a fila. Regra: nada chamado de um callback do motor usa o cliente
  Prisma global dentro de uma transação do Better Auth.
- Falha de entrega depois do commit não é fatal: resposta neutra 202 e log só
  `verification_email_failed`, sem o endereço. Reenvio: repetir o cadastro de
  uma conta ainda não verificada manda um novo link (`onExistingUserSignUp`),
  com orçamento silencioso de 1 a cada 5 min e 3 por dia por conta
  (`consumeVerificationResend`), além das janelas por IP e por e-mail do
  cadastro. No modo legado não há reenvio.

#### Como validar

- `tests/identity/multi-host.integration.test.ts` ("achado 8"),
  `tests/identity/auth-email-routes.integration.test.ts` ("achado 106"),
  `tests/identity/sign-up-commit.integration.test.ts` (rota real com o pool de
  produção, `max 1`, cadastros concorrentes e COMMIT recusado) e
  `tests/security/auth-rate-limit.test.ts` ("verification resend").

---

## 211. Identidade: falha do limitador vazava no `?error=` do NextAuth e a rota real não respondia 503

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-29 **Severidade**: Baixa (achado 7 da revisão da
onda 4 e achado 104) **Status**: RESOLVIDO (ondas 6 e 7) **Ambiente**:
`lib/auth.ts`, `app/api/auth/[...nextauth]/route.ts`,
`packages/backend/src/modules/identity/factory.ts`, `lib/identity.ts`,
`lib/rate-limit.ts`

#### Descrição

- 7: o `authorize` chamava o limitador persistente fora de `try`; uma falha
  (banco fora, `PLATFORM_RATE_LIMIT_SECRET` ausente em produção) virava o
  redirect `…/error?error=<mensagem>` do NextAuth, com host, porta ou usuário do
  banco ou a mensagem de configuração, para um navegador não autenticado. O
  login v2 respondia 500.
- 104: o `withSignInAvailability` criado para o 503 não estava ligado na rota
  real do NextAuth (o teste montava o próprio wrapper), e a rota não declarava
  `revalidate = 0`.

#### Causa raiz

- Erro interno propagado ao NextAuth, que copia `error.message` para a URL;
  wrapper testado fora da rota.

#### Solução

- Contrato: 503 com `Retry-After: 60` e `no-store` significa "não foi possível
  contar"; 429 significa limite atingido.
- `authorize` captura falhas de limitador, configuração e banco e lança o código
  fixo `AuthUnavailable` (a causa fica no servidor; o log leva só nome, código e
  o detalhe de `PlatformEnvError`). A rota exporta
  `withSignInAvailability(NextAuth(authOptions))`, que troca esse 401 por 503
  com `Retry-After` e `no-store`, e declara `revalidate = 0`. O login v2 e o
  `handleIdentityRequest` respondem 503 com `Retry-After`.
- O inventário de rotas aceita o wrapper (`lib/auth#withSignInAvailability` em
  `GUARDS` e em `HANDLER_WRAPPERS`).
- Extração em 2026-09-30: opções e callbacks vivem em
  `packages/backend/src/modules/identity/legacy-auth.ts`, pela factory
  `createLegacyAuthentication`; `lib/auth.ts` fornece banco/guard reais e mantém
  o wrapper. Lifecycle e log do Better Auth ficam em `identity/runtime.ts`, com
  composição real em `lib/identity.ts`. A rota, códigos públicos e 503
  permanecem caracterizados, sem trocar autoridade ou flags de autenticação.
- Dependências compartilhadas em 2026-09-30: janelas persistentes e campos de
  log redigidos estão em `identity/rate-limit.ts`, com portas reais na fachada
  `lib/rate-limit.ts`. `identity/mail.ts` e `runtime/mail.ts` preservam os erros
  neutros de entrega e o prazo de 15 segundos. Validar também
  `tests/unit/identity-limiters.test.ts`, `tests/unit/identity-runtime.test.ts`
  e `tests/unit/resend-timeout.test.ts`; guards/rotas existentes continuam
  ativos.
- Pendente de UX: a tela de login mostra "Credenciais inválidas" para qualquer
  código, inclusive `AuthUnavailable` e `RateLimited`.

#### Como validar

- `tests/security/nextauth-route.test.ts` (importa a rota real),
  `tests/security/auth-unavailable.test.ts` (banco fora só na busca da conta:
  503, nunca 401) e `tests/identity/legacy-credentials.integration.test.ts` (v2
  com 503).

---

## 210. Identidade: cadastro e recuperação do better-auth sem resposta neutra, e login CSRF pelo `oauth-proxy` e pelo `expo-authorization-proxy`

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-29 **Severidade**: Alta (achado 105) e Média
(achados 5 e 6 da revisão da onda 4) **Status**: RESOLVIDO (ondas 6 e 7)
**Ambiente**: `app/api/auth/{forgot-password,register}/route.ts`,
`packages/backend/src/modules/identity/{factory,app-authorization}.ts`,
`docs/architecture/adr-tenant-hosts.md` (seção de identidade)

#### Descrição

- 5: no modo better-auth, `forgot-password` e `register` (liberados em todo host
  de locadora) respondiam fora do contrato neutro: o cadastro repassava o 422
  `FAILED_TO_CREATE_USER` de um CPF já cadastrado (o que dizia se aquele CPF
  tinha conta) e a recuperação rodava de forma síncrona. O limitador desses
  ramos entrou na onda 5 (entrada 191).
- 6: a conclusão do `oauth-proxy` (`/callback/:id/oauth-proxy` e o alias
  depreciado `/oauth-proxy-callback`) só conferia se o `state` existia no banco:
  o atacante iniciava o login social com a própria conta e, em até 60 s, levava
  a vítima à URL de conclusão, em qualquer host de locadora; a vítima ficava na
  conta do atacante.
- 105: o plugin `expo()` deixava
  `/api/auth/expo-authorization-proxy?authorizationURL=https://evil.example/…`
  plantar o cookie assinado de `state` de qualquer login no navegador da vítima;
  o callback seguinte dava à vítima a sessão do atacante no host `app`.

#### Causa raiz

- Ramos do better-auth devolviam a resposta do motor sem neutralizar; conclusão
  de login não presa ao navegador que o iniciou; proxy do app que aceitava
  qualquer URL e qualquer login.

#### Solução

- `forgot-password` responde o mesmo 200 nos dois modos e faz busca, token e
  envio fora da resposta (`after()`), com o orçamento silencioso por conta
  (`consumeAccountNotice`, 3 por janela). `register` no better-auth responde o
  202 neutro do legado antes de hash, escrita ou envio (e-mail existente, CPF em
  uso e falha do motor só vão para o log); senha acima do limite do motor
  dá 400.
- Hook antes da conclusão do `oauth-proxy` (`oauthProxyCompletionBound`, com as
  rotas de `OAUTH_PROXY_COMPLETIONS`, inclusive o alias): exige o cookie
  assinado `state` deste host igual ao do payload e a origem da conclusão igual
  à do início; senão, `state_mismatch`. Em https o cookie é
  `__Host-<plataforma>.state`, que uma locadora irmã não consegue plantar com
  `Domain=<raiz>`.
- Plugin `appAuthorization` (`app-authorization.ts`, registrado depois do
  `expo()`): o `expo-authorization-proxy` só leva à URL do provedor que o
  servidor emitiu para um login do app (SHA-256 registrado no fim de
  `/sign-in/social`, com `callbackURL`, `newUserCallbackURL` e
  `errorCallbackURL` no deep link); login web, outra URL, `link-social` e
  `oauthState` recebem 400 sem cookie. A resposta que entrega a sessão ao app
  pelo deep link não deixa sessão no navegador. O app não mudou.
- Risco residual (outro app que registre o mesmo esquema `locadora://` no
  Android): trocar por App Links/Universal Links quando os identificadores do
  app existirem.

#### Como validar

- `tests/identity/auth-email-routes.integration.test.ts`,
  `tests/security/account-flows-guard.test.ts` e
  `tests/identity/multi-host.integration.test.ts` ("achado 6" e "achado 105":
  fluxo completo do app, ataque do verificador, URL externa, `redirect_uri`
  adulterado e destinos web recusados).

---

## 209. Asaas: `paidAt` lido como meia-noite UTC e testes de assinatura que não provavam nada

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-29 **Severidade**: Baixa (achados 20 e 21 da
revisão da onda 4) **Status**: RESOLVIDO (onda 6, lote dinheiro) **Ambiente**:
`packages/backend/src/modules/billing/asaas-events.ts`,
`tests/helpers/fake-asaas/{fake-asaas,contract-suite}.ts`,
`tests/contract/asaas-fake.test.ts`

#### Descrição

- 20: `parseAsaasWebhook` e `readAsaasPayment` faziam `new Date('2026-01-20')`
  com o `paymentDate`/`clientPaymentDate` só de data: meia-noite UTC, 19/01 às
  21:00 em São Paulo. O pagamento aparecia no dia anterior.
- 21: os testes diziam que só as faturas pendentes mudavam e que
  `DELETE /subscriptions` era proibido, mas tinham uma fatura só e contavam só
  as chamadas do próprio teste.

#### Causa raiz

- `parseAsaasDate` existia no mesmo arquivo e não era usado; o dublê não tinha a
  regra e os testes afirmavam o vazio.

#### Solução

- `paidAt` por `parseAsaasDate`: data sem hora é a data civil de São Paulo
  (`T03:00Z`); formato desconhecido é ignorado no webhook e vira
  `INVALID_RESPONSE` no leitor.
- O dublê recusa `DELETE /subscriptions` por padrão (405, registrado em
  `forbiddenRequests`; `allowSubscriptionDelete: true` reproduz o Asaas), uma
  política da plataforma; os testes têm faturas `RECEIVED` e `OVERDUE` que não
  podem mudar, e um `GET` depois do `PUT INACTIVE`.
- Pendente: o cliente HTTP de produção (`asaas-http.ts`) ainda aceita
  `DELETE /subscriptions/**`; hoje nenhum código de produção chama
  `/subscriptions`.

#### Como validar

- `tests/unit/asaas-payment-reader.test.ts` e
  `tests/contract/asaas-fake.test.ts` (`pnpm test:contract`).

---

## 208. Emissão no Asaas: tentativa presa sem religação, pedido recusado em laço, leitura 400 tratada como recusa e cobrança aberta sem tentativa

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-29 **Severidade**: Alta (achado 125) e Média
(achados 116 e 126) **Status**: RESOLVIDO (ondas 8 e 9) **Ambiente**:
`lib/payment-issuance.ts`,
`packages/backend/src/modules/billing/{issue-payment,index}.ts`,
`app/api/cron/outbox/route.ts`

#### Descrição

- 116: três casos ficavam sem saída. A conciliação de `UNKNOWN` devolvia a
  tentativa a `QUEUED`, e uma falha passageira depois disso esgotava o evento (a
  varredura só olhava `UNKNOWN`); o `payment.issue` esgotado por falha
  passageira travava a chave `payment.issue:<paymentId>`, e nada reenfileirava;
  `PROCESSING` de um processo que morreu entre a reserva e o POST nunca saía.
- 116, 2ª rodada: um pedido que o Asaas sempre recusa (400, como vencimento no
  passado, `invalid_dueDate`) voltava à fila e era religado a cada 6 h para
  sempre: 256 POSTs recusados em 7 dias para uma cobrança.
- 125: todo 400 virava `PAYMENT_REQUEST_REJECTED`, inclusive numa leitura depois
  do `POST /payments` aceito (`pixQrCode`, `identificationField`, a busca pela
  referência): o evento terminava, a tentativa ficava `PROCESSING` e a cobrança
  existia no Asaas sem vínculo para sempre.
- 126: cobrança PIX ou boleto aberta sem tentativa (o `payment.boleto.issue` ou
  o `payment.issue` esgotou antes de a tentativa existir, por
  `BILLING_INTEGRATION_UNAVAILABLE` ou `TENANT_CUSTOMER_INCOMPLETE`) ficava sem
  emissão; a varredura só trabalhava sobre tentativas.

#### Causa raiz

- A emissão não separava a recusa definitiva do pedido da falha passageira, nem
  a escrita da leitura; a varredura de religação cobria só `UNKNOWN`; a chave do
  pedido impedia reenfileirar.

#### Solução

- Varredura no cron da outbox (`scheduleIssuanceReconciliation`), com rodadas
  numeradas e espera de 15 min que dobra a cada rodada até 6 h (`nextRound`: a
  última rodada decide; viva, nenhuma nova; esgotada por `DELIVERY_FAILED`, a
  seguinte; encerrada com código, nenhuma, salvo tentativa alterada depois):
  - `UNKNOWN` ou `PROCESSING` parada há mais de 15 min (`isSettledUnknown`):
    conciliação pela referência da tentativa
    (`payment.issue:reconcile:<tentativa>:<updatedAt>`, `:<n>` nas rodadas
    seguintes); cobrança achada, vincula; nada, volta a `QUEUED` e emite.
    Premissa: no máximo 3 chamadas ao Asaas depois da reserva, cada uma com teto
    de 2 min, e a função do cron vive no máximo 5 min;
  - `QUEUED` sem evento de emissão vivo: `payment.issue:resume:<tentativa>[:n]`;
  - cobrança aberta (`PENDING` ou `OVERDUE`, PIX ou BOLETO, sem `transactionId`
    e sem tentativa) cujo último evento de emissão morreu por `DELIVERY_FAILED`,
    sem nenhum vivo: `payment.issue:open:<paymentId>`. Cobrança sem pedido de
    emissão não é tocada (o PIX da taxa de extensão em `rentals/lifecycle.ts`
    nunca enfileira emissão).
- Recusa definitiva só pelo domínio: `ChargeRequestRejected` (subclasse de
  `BillingProviderError`) sai só da validação local (valor e
  `assertChargeRequest`) e do 400 da criação (cadastro do cliente ou
  `POST /payments`), sempre depois de `reject`; `lib/payment-issuance.ts` só
  converte esse erro em `PAYMENT_REQUEST_REJECTED`. A tentativa vai a `FAILED`
  com `response.rejection = {reason, status, providerCodes}` (só os
  `errors[].code` do Asaas) e sai das candidatas. 400 numa leitura é passageiro:
  a rodada seguinte acha a cobrança pela referência e vincula, sem outro POST.
  401, 403, 404, 429, 5xx, o interruptor e `AMBIGUOUS` continuam passageiros.
- Nenhuma religação cria cobrança duplicada: toda emissão busca pela referência
  da tentativa antes de reservar, e a reserva é atômica.
- Lacuna de produto: tentativa `FAILED` (ou recusa antes da reserva, que deixa a
  tentativa `QUEUED` com o evento `FAILED`) não tem fluxo de reemissão pelo
  lojista; a cobrança fica aberta até alguém agir.

#### Como validar

- `tests/unit/payment-issuance-database.test.ts` (describes "achado 116",
  "pedido que o Asaas sempre recusa", "achado 125" e "achado 126", em PostgreSQL
  descartável com o dublê), `tests/unit/outbox-cron-database.test.ts` (rota real
  do cron), `tests/unit/payment-issuance.test.ts` e
  `tests/contract/asaas-fake.test.ts`.

---

## 207. Emissão no Asaas: falha sem efeito deixava a tentativa `UNKNOWN` para sempre

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-29 **Severidade**: Média (achado 15 da revisão
da onda 4 e achado 102) **Status**: RESOLVIDO (ondas 6 e 7) **Ambiente**:
`packages/backend/src/modules/billing/{issue-payment,cancel-attempt,asaas}.ts`,
`lib/payment-issuance.ts`, `lib/payment-reissue.ts`,
`app/api/cron/outbox/route.ts`, `tests/helpers/fake-asaas/fake-asaas.ts`

#### Descrição

- 15: 429, 401, 400 ou o interruptor no `GET /customers` (nenhuma cobrança
  criada, `maybeApplied=false`) marcavam a tentativa `UNKNOWN`, e a execução
  seguinte exigia conciliação para sempre: o cliente nunca conseguia pagar. O
  mesmo no cancelamento. Na 2ª rodada: um 200 inutilizável no `GET /customers`
  também.
- 102: falha incerta no `POST /customers` (503, timeout, corpo inválido), antes
  do `POST /payments`, saía com `maybeApplied=true` e deixava a primeira
  cobrança `UNKNOWN` para sempre; nenhum job tirava a tentativa de lá.

#### Causa raiz

- O `maybeApplied` não era consultado; o gateway validava a forma da resposta de
  uma escrita com `maybeApplied=false`; o `maybeApplied` do `create` falava da
  escrita do cliente, não da cobrança; não havia conciliação para `UNKNOWN` sem
  cobrança vinculada.

#### Solução

- `provenNotApplied` olha só o `maybeApplied`: falha provada sem efeito devolve
  a tentativa a `QUEUED` (e o cancelamento a `REQUESTED`) e relança; o resto
  fica `UNKNOWN`. `IssuanceRepository.release` foi implementado em
  `lib/payment-issuance.ts`; o do cancelamento já estava ligado em
  `lib/payment-reissue.ts`.
- `asaas.ts`: resposta inutilizável depois de escrita aceita (`POST /customers`,
  `POST /payments`, `DELETE /payments/{id}`) sai com `maybeApplied=true`;
  leitura, `false`. O `maybeApplied` do `create` fala da cobrança: falha incerta
  antes do `POST /payments` volta a `QUEUED`, e o cliente já cadastrado é achado
  pela busca por CPF/CNPJ.
- Conciliação de `UNKNOWN` sem `externalId`: passada a janela de 15 min
  (`UNKNOWN_ISSUANCE_SETTLE_MS`), o cron da outbox agenda um `payment.issue` por
  episódio, em rodadas (entrada 208); a emissão consulta o Asaas pela referência
  da tentativa: acha, vincula; nada, volta a `QUEUED` e emite. Cobrança
  divergente na referência encerra o evento com
  `PAYMENT_RECONCILIATION_REQUIRED` (revisão manual, nunca reagendada). A
  resposta do cron ganhou `issuanceReconciliations`.
- O dublê ganhou a falha `body` (200 estragado, com ou sem aplicar a escrita).
- Pendente: clientes duplicados no Asaas com o mesmo CPF/CNPJ dão
  `AMBIGUOUS_MATCH` e seguram a emissão (decisão pendente).

#### Como validar

- `tests/unit/payment-issuance-database.test.ts` ("achado 102": duas
  conciliações ao mesmo tempo, Asaas fora do ar a rodada inteira, 201 episódios
  parados), `tests/unit/outbox-cron-database.test.ts`,
  `tests/unit/payment-issuance.test.ts`,
  `tests/unit/payment-cancellation.test.ts` e
  `tests/contract/asaas-fake.test.ts`.

---

## 206. Preço inteligente: meio centavo 1 centavo abaixo, tela em float contra servidor em Decimal e total do carrinho arredondando a unidade

### Problema RESOLVIDO (regra de arredondamento aguarda aval do dono)

**Data da Ocorrência**: 2026-09-29 **Severidade**: Média (achado 17 da revisão
da onda 4 e achado 103) **Status**: RESOLVIDO (ondas 6 e 7) **Ambiente**:
`packages/domain/src/equipamento/preco.ts`,
`packages/domain/src/orcamento/preco.ts`,
`packages/frontend/src/features/carrinho/model/carrinho.ts`,
`packages/frontend/src/pages/orcamento/ui/OrcamentoPage.web.tsx`,
`packages/frontend/src/pages/area-cliente/ui/AreaClientePage.web.tsx`

#### Descrição

- 17: `buildQuotePricing` arredondava o float do cálculo: 50,05/dia, 1 dia, 10%
  de desconto dá 45,045 exato, mas o float 45,044999… gravava e cobrava 45,04
  (29.353 de 1.080.120 combinações medidas saíam 1 centavo abaixo). Depois da 1ª
  correção, só o servidor ficou exato: a tela mostrava R$ 45,04, e o orçamento e
  o boleto saíam 45,05.
- 103: o "Total Estimado" do carrinho somava a unidade já arredondada ×
  quantidade (`finalPrice`): 3.471,42 no total contra 3.471,43 no subtotal do
  item e no servidor.

#### Causa raiz

- Duas funções de preço (float na tela, Decimal no servidor) e o total do
  carrinho em cima de um valor arredondado.

#### Solução

- Uma função só no domínio, `exactIntelligentPrice` (`equipamento/preco.ts`), em
  Decimal a partir do texto exato (valor direto = valor × dias ÷ período, numa
  só divisão; senão diária × dias − desconto percentual).
  `calculateIntelligentPrice` arredonda esse valor em centavos
  (`ROUND_HALF_UP`).
- Regra da linha: `buildQuotePricing` arredonda preço exato × quantidade uma vez
  (45,05 a unidade, 135,14 para 3). O subtotal das páginas de orçamento e da
  área do cliente é `buildQuotePricing(...).total`, e `getTotalPrice` do
  carrinho soma em Decimal esse total por linha, sem usar `finalPrice`.
- Consequência aceita por padrão (decisão do dono): numa linha com meio centavo
  e quantidade maior que 1, a unidade exibida × quantidade pode diferir 1
  centavo do subtotal. A alternativa (arredondar a unidade e multiplicar,
  135,15) muda o valor gravado e cobrado.
- Pendentes: `buildQuotePricing` ignora os períodos desligados
  (`enabledPeriods`) que a tela respeita; ainda somam em float a
  `HistoricoDetalhePage`, o cartão de `widgets/itens-orcamento` e
  `entities/orcamento/model/whatsapp-data.ts`; o carrinho vindo do servidor
  (`mapServerCartItem`) descarta desconto e valor direto.

#### Como validar

- `packages/domain/src/equipamento/preco.test.ts` (meio centavo, quantidade 3 e
  grades de desconto e de valor direto: tela = servidor = Decimal),
  `packages/domain/src/orcamento/preco.test.ts`, `carrinho.test.ts` e os testes
  de render `AreaClientePage.web.test.tsx` e `OrcamentoPage.web.test.tsx`.

---

## 205. Obrigação do orçamento: edição reprecificava cobrança emitida, somava a multa duas vezes e ignorava o valor final

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-29 **Severidade**: Alta (achados 11 a 13 da
revisão da onda 4) e Média (achados 14, 16 e 101) **Status**: RESOLVIDO (ondas 6
e 7) **Ambiente**: `packages/domain/src/orcamento/obrigacao.ts`,
`packages/backend/src/modules/quotations/{update,adjustments,base-charges}.ts`,
`app/api/admin/quotes/[id]/route.ts`,
`packages/frontend/src/pages/orcamentos-admin/model/detalhe.web.ts`

#### Descrição

- 11: o `PATCH` do orçamento (remover item, datas, frete) mudava o valor de uma
  cobrança `PENDING` já emitida no Asaas; o boleto antigo continuava com o valor
  anterior, e o pagamento nunca virava `PAID` (409 no webhook).
- 12: aprovar a multa somava sobre o `finalTotal`, que já a continha (um clique
  duplo levava de 40 a 50), e sobre um `originalTotal` antigo (o item removido
  voltava a ser cobrado); revogar não tirava a multa.
- 13: recalcular itens, datas ou frete ignorava o `finalTotal` (reajustes e
  multa) ou o sobrescrevia com o total; obrigação e cobrança divergiam (409 no
  pedido de pagamento, conversão recusada).
- 14: alterar o `finalTotal` ou aprovar a multa não reprecificava a cobrança
  pendente, e o `quote.boleto.ensure` enfileirado falhava com 409 em toda
  tentativa.
- 16: `total` entrava cru (128,5714), e a cobrança ficava fracionária (recusada
  pelo Asaas em toda rodada).
- 101: a trava `:issue:` da reprecificação não tinha teste de concorrência (a
  mutação sem a trava sobrevivia).

#### Causa raiz

- Cada edição somava sobre o valor gravado em vez de recalcular a obrigação a
  partir do estado atual, e reprecificava a cobrança sem olhar se ela já tinha
  sido emitida.

#### Solução

- Regra única no domínio, `quoteObligation`
  (`packages/domain/src/orcamento/obrigacao.ts`): itens + frete
  (`quoteItemsAndFreight`) + reajustes vigentes (o TRAVEL já está no frete) +
  multa aprovada uma vez, somados em Decimal e arredondados uma vez
  (`ROUND_HALF_UP`). Toda edição de dinheiro (`update.ts` e `adjustments.ts`)
  recalcula por ela: aprovar de novo não soma, revogar tira a multa, trocar a
  multa aprovada substitui. Edições estruturais mantêm o frete no `total` e
  atualizam o `originalTotal`.
- Valor final manual (`PATCH finalTotal`) vira reajuste `OTHER` da diferença,
  com a justificativa (aparece na lista de reajustes, no portal do cliente e no
  PDF de reajuste). Um valor final legado que a regra não explica
  (`quoteObligationResidual`) é preservado na próxima edição como reajuste
  `OTHER` "Ajuste anterior do valor final" (`preserveLegacyResidual`); não há
  migração nem relatório desses orçamentos.
- Cobranças base (`RENTAL`/`DEPOSIT`) pela regra do domínio
  `planQuoteBaseCharges`, aplicada em `base-charges.ts` sob a trava
  `:issue:<paymentId>` de cada uma: a única `PENDING` nunca emitida (sem
  `transactionId`, `boletoIssuedAt`, `pixCode` nem tentativa) passa a cobrar o
  saldo, com o detalhamento tributário; cobrança paga não muda (o saldo é
  cobrado à parte); emitida, vencida, mais de uma pendente, obrigação abaixo do
  que já foi pago ou saldo zerado com pendente viva respondem 409
  `PAYMENT_ADJUSTMENT_REQUIRES_RECONCILIATION` antes de qualquer escrita
  (orçamento convertido recusa também a pendente nunca emitida). A rota devolve
  `{error, code}`, e a tela mostra a mensagem do servidor quando a aprovação da
  multa falha.
- `quote.boleto.ensure` só é enfileirado para orçamento aprovado sem cobrança
  base de outro meio. `total`, frete e multa entram em centavos; valor inválido
  dá 400 ("Valor total inválido", "Valor de frete inválido", "Valor de multa
  inválido").
- Pendentes: orçamento convertido não recusa `lateFee`/`lateFeeApproved`; o
  vencimento do boleto depende do fuso do servidor.

#### Como validar

- `tests/unit/quote-obligation-edits.test.ts` (achados 11 a 14, 16 e 101; o 101
  espera no `pg_locks` pela chave advisory exata e exige 409 sem escrita),
  `packages/domain/src/orcamento/obrigacao.test.ts`,
  `tests/unit/quotes-http.test.ts` e
  `packages/frontend/src/pages/orcamentos-admin/model/detalhe.multa.web.test.ts`.

---

## 204. `Text` do design system no web: `lineHeight` sem unidade multiplica a altura da linha

### Problema RESOLVIDO (onda 8, entrada 219)

**Data da Ocorrência**: 2026-09-29 **Severidade**: Média (blocos de texto muito
altos no painel) **Status**: RESOLVIDO na causa pela onda 8 (lote fech-css,
achado 119: altura de linha em px no `Text.web.tsx`; entrada 219); na onda 5
estava só contornado no seletor de locadora do painel **Ambiente**:
`packages/ui/src/web/Text.web.tsx`, `packages/ui/src/contract/text.ts`

#### Descrição

- O `Text` aplica como estilo inline o resultado de `resolveTextStyle`. O
  `lineHeight` do tema é um número pensado para o React Native (pixels); no web,
  `line-height: 24` sem unidade vale 24 vezes o tamanho da fonte.
- Sintoma: o seletor de locadora do topo do painel ocupava um bloco de 466 px de
  altura. As mensagens do portão da área privada (`PrivateAreaGate`) também usam
  o `Text`.

#### Causa raiz

- O mesmo número do tema serve ao native (pixels) e ao web, onde vira
  multiplicador.

#### Solução

- Contorno (lote D2 da onda 5): no web o seletor virou `TenantSelector.web.tsx`,
  uma barra de 53 px (170 px no celular quando aparece a pergunta do
  `?locadora=`) feita com `Label`, `Select` e `Button`; o
  `TenantSelector.native.tsx` mantém o bloco. Os dois usam o contrato e os
  textos de `ui/contract.ts`.
- A correção na causa (unidade no `Text.web.tsx`) ficou fora do escopo do lote e
  pode mudar as capturas com `Text` visível: decisão pendente do usuário.
- Onda 8: `Text.web.tsx` grava a altura de linha em px (o nativo não mudou), com
  `packages/ui/src/web/Text.web.test.tsx`; a linha de base visual foi regravada
  (entrada 219).

#### Como validar

- `packages/frontend/src/features/selecionar-locadora/ui/TenantSelector.barra.web.test.tsx`
  e a linha de base visual (`painel/*`).
- Para a causa: o `line-height` computado de um parágrafo do `Text` no
  navegador.

---

## 203. Escapes `\u00XX` apareciam literalmente em textos de JSX

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-29 **Severidade**: Baixa (acentuação quebrada na
tela) **Status**: RESOLVIDO (onda 5, sem commit) **Ambiente**:
`packages/frontend/src/pages/equipamentos-admin/ui/SecaoEspecificacoes.tsx`,
`ModalZoomImagem.web.tsx`, `tools/token-check.mjs`

#### Descrição

- Textos de interface escritos com escapes de string JavaScript (`ç`, `ã`...) em
  texto JSX ou em atributo aparecem na tela como os próprios caracteres `ç`,
  porque o JSX só interpreta escape dentro de uma expressão `{'...'}`. Havia 6
  casos, em `SecaoEspecificacoes` e `ModalZoomImagem` (painel, cadastro de
  equipamento).

#### Causa raiz

- Texto copiado de string JavaScript para texto JSX, onde o escape não vale.

#### Solução

- Todos os `\u00XX` de interface viraram os caracteres reais. A exceção é o
  espaço sem quebra do `BlurText`, que fica dentro de uma string JavaScript,
  onde o escape é interpretado.
- Regra nova `jsx-text-escape` no `token-check`: absoluta, só no escopo do
  produto, com exceção do atributo `pattern`. Antes da correção ela acusava os 6
  casos.

#### Como validar

- `pnpm tokens` e `tests/unit/token-check.test.ts` (fixture
  `tests/unit/__fixtures__/tokens/escapes/`).
- Linha de base visual: `painel/equipamento-novo` grava "Especificações
  Técnicas" com acento.

---

## 202. Tailwind: config JS fora do `token-check` e testes lidos como fonte de classes

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-29 **Severidade**: Média (brecha na regra de
tolerância zero do `!important`) **Status**: RESOLVIDO (onda 5, sem commit)
**Ambiente**: `tools/token-check.mjs`, `tailwind.config.cjs`,
`packages/frontend/src/app/styles/globals.web.css`

#### Descrição

- O `token-check` não lia o `tailwind.config.cjs` carregado pelo `@config` nem
  os plugins locais: `important: true` (ou um seletor) no config, ou
  `!important` dentro de um `addUtilities`, tornaria utilitários `!important`
  sem reprovação.
- O Tailwind lia testes e fixtures como fonte de classes: o CSS do `build:web`
  levava classes que só existem em testes, como `.\!h-auto` (com `!important`,
  vinda de uma fixture do `token-check`).

#### Causa raiz

- A detecção automática de fontes do Tailwind 4 inclui qualquer arquivo, e o
  `@source not` do CSS não vale para o `content` do config JS.

#### Solução

- `token-check`: lê o config do `@config` (e o `tailwind.config.*` da raiz) e os
  plugins locais (`@plugin` e `require`/`import` relativos). Reprova
  `important: true` ou um seletor e `!important` em `addUtilities`, `addBase` e
  afins, com fixture própria
  (`tests/unit/__fixtures__/tokens/tailwind-config/`).
- `globals.web.css` exclui `*.test.*`, `*.spec.*` e `__fixtures__` com
  `@source not`. O `content` do config ficou só com a raiz legada (`app`,
  `components`, `lib` e `hooks`) e nega `*.{test,spec}.*`; o produto entra pelos
  `@source` da entrada do CSS. O CSS do `build:web` tem um único `!important`:
  `[hidden]{display:none!important}`, do preflight do próprio Tailwind.
- Config morto removido: keyframe e animação `slideInUp`, `fontFamily.heading`,
  `letterSpacing.normal`, as cores `ring` e `chart`, o plugin inline das classes
  `*-compat` e as entradas de `content` que repetiam o `@source`. Sem cada
  entrada, o CSS compilado saiu igual byte a byte.

#### Como validar

- `pnpm tokens`, `tests/unit/token-check.test.ts` e
  `packages/frontend/src/app/index.styles.test.ts` (`@source not` e negação no
  `content`).
- `pnpm build:web` e procurar `!important` no CSS de `.next/static`: só o
  `[hidden]` do preflight.

---

## 201. Revelação por rolagem: `slide-in-up` subia 30 px e o primeiro quadro ignorava o movimento reduzido

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-29 **Severidade**: Baixa (animação diferente da
produção; conteúdo escondido até a hidratação com movimento reduzido)
**Status**: RESOLVIDO (onda 5, sem commit) **Ambiente**:
`packages/frontend/src/app/styles/animations.web.css`,
`packages/frontend/src/app/providers/ScrollRevealInit.web.tsx`, `Hero.web.tsx`,
`Categories.tsx`, `Destaques.web.tsx`, `ContatoHome.web.tsx`, `SobrePage.tsx`

#### Descrição

- A animação `slide-in-up` subia 30 px; na produção (`main`, `slideInUp` de
  `app/globals.css`) sobe 60 px.
- Com `prefers-reduced-motion: reduce`, os elementos que o `ScrollRevealInit`
  mantém parados (`STILL_WHEN_REDUCED_MOTION`) nasciam escondidos (`opacity-0` e
  `opacity`/`transform` inline no JSX) até a hidratação (decisão pendente da
  entrada 194).

#### Causa raiz

- Na onda 3 o keyframe da camada recebeu o valor que valia no Tailwind 4 (30 px,
  do `slideInUp` do `tailwind.config.cjs`, entrada 179), e não o da produção.
- O estado inicial da revelação foi escrito no JSX sem variante de movimento.

#### Solução

- `slide-in-up` voltou a subir 60 px.
- Hero, Categorias, Destaques, Contato e Sobre: os elementos parados da lista só
  nascem escondidos com `motion-safe:`. Saíram o `opacity-0` puro e o
  `opacity`/`transform` inline. `ScrollRevealInit` e `scrollRevealReady` não
  mudaram (`docs/features/equipment-3d-carousel.md`).
- A exceção de `!important` dentro de `@media (prefers-reduced-motion: reduce)`
  saiu do `token-check`: `css-important` não tem mais exceção nenhuma.
- O `ScrollRevealInit` deixou de citar quatro classes sem elemento:
  `.animate-on-scroll`, `.category-card-animate`, `.animate-on-scroll-delayed` e
  `.hero-badge-bottom`.
- Continuam animando com movimento reduzido, como na produção, os elementos fora
  da lista (imagem, selos, borda e onda do hero, `[data-scroll-reveal]` e
  `[data-fade-only]`); a página Sobre mantém o fade de 100 ms contra FOUC.

#### Como validar

- `ScrollRevealInit.primeiro-quadro.web.test.tsx`,
  `ScrollRevealInit.seletores.web.test.tsx`,
  `ContatoHome.revelacao.web.test.tsx` e `Destaques.web.test.tsx`.
- No navegador, sem JS: com movimento reduzido, os títulos do hero ficam com
  opacidade 1; sem a preferência, com 0.

---

## 200. Diálogo aberto por clique mostrava o anel de foco no X, e o `Drawer` não soltava a trava de rolagem

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-29 **Severidade**: Baixa (anel sem teclado;
página travada com o `Drawer`) **Status**: RESOLVIDO (onda 5, sem commit)
**Ambiente**: `packages/ui/src/web/Dialog.web.tsx`, `Sheet.web.tsx`,
`Drawer.web.tsx`, `tests/visual/support/scenarios.ts`

#### Descrição

- Ao abrir um `Dialog` ou um `Sheet` com o mouse, o foco inicial vai para o
  botão de fechar (X), e o anel de foco aparecia como se a pessoa usasse o
  teclado.
- O `Drawer` era o único componente com a trava de rolagem do Radix fora do
  `useReleaseScrollLockRef` (entrada 178): aberto, deixava o `body` com
  `data-scroll-locked`, `overflow: hidden` e `pointer-events: none`.

#### Causa raiz

- O foco movido por código casa `:focus-visible` mesmo depois de um clique, e o
  X usava `FOCUS_RING`, que só olha `:focus-visible`.
- O `Drawer` ficou de fora quando a trava foi resolvida nos outros componentes.

#### Solução

- O X do `Dialog` e do `Sheet` usa `MENU_FOCUS_RING` com `trackInputModality`: o
  anel só aparece com `data-input-modality="keyboard"` no `<html>`, como nos
  menus (entrada 179). Aberto pelo teclado, o anel laranja aparece; aberto por
  clique, não. O `AlertDialog` não mudou: o foco inicial vai para o Cancelar,
  que já não mostrava anel no clique.
- O `Drawer` usa `useReleaseScrollLockRef`.
- Linha de base visual: o harness ganhou o gancho `check`. Os estados
  `dialog-orcamento-aberto` (orçamentos) e `dialog-nova-categoria` (categorias)
  reprovam se o foco inicial tiver contorno; com o anel antigo, a captura falha
  com "mostra anel: solid 2px rgb(234, 88, 12)".

#### Como validar

- `packages/ui/src/web/Dialog.foco.web.test.tsx`, `Sheet.foco.web.test.tsx` e
  `Drawer.trava-rolagem.web.test.tsx`.
- Captura e comparação da linha de base visual (`tests/visual/README.md`).

---

## 199. Cobrança anterior `CANCELLED` sem prova: leitor do provedor ligado, também no pedido de PIX e boleto

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-29 **Severidade**: Média (achado 8 da revisão da
onda 3 e pendência da onda 4) **Status**: RESOLVIDO (onda 5, sem commit)
**Ambiente**: `packages/backend/src/modules/billing/cancelled-charges.ts`,
`packages/backend/src/modules/quotations/boleto.ts`,
`lib/payment-obligation.ts`, `lib/quote-boleto.ts`, `lib/payment-request.ts`,
`scripts/ops/legacy-cents-report.ts`

#### Descrição

- Boleto do orçamento: a regra de prova da entrada 187 existia, mas
  `lib/quote-boleto.ts` não injetava o leitor do provedor. Todo boleto
  `CANCELLED` legado sem prova respondia 409, mesmo quando o provedor provaria a
  remoção.
- Pedido de PIX ou boleto (`requestPayment`, `lib/payment-request.ts`): não
  havia critério nenhum. Um `Payment` `CANCELLED` com `transactionId` e sem
  tentativa gerava cobrança nova sem consultar o provedor, e a anterior podia
  continuar aberta no Asaas (duas cobranças vivas).
- Valores antigos com fração de centavo (entrada 186) não tinham como ser
  listados para conciliação.

#### Causa raiz

- A regra de prova morava dentro de `quotations/boleto.ts`, e a composição não
  tinha uma leitura do provedor pela integração da locadora.

#### Solução

- Critério único no billing (`cancelled-charges.ts`): acha as linhas `CANCELLED`
  com `transactionId` e sem prova, dá o veredito do provedor, lê fora de SQL e
  concilia sob o lock de quem chamou (`withCancelledChargeProof`: preparar, ler,
  conciliar e preparar de novo). Vale para PIX e BOLETO; `quotations/boleto.ts`
  ficou só com a regra do orçamento.
- Política da onda 4 mantida:
  - aberta no Asaas: a linha volta a ser a cobrança vigente;
  - paga: volta a ser a vigente e `payment.provider.confirmed` vai para a
    outbox;
  - removida: a prova é gravada e sai uma única cobrança nova;
  - `REFUNDED`, outro valor ou meio, 404, mais de uma aberta ou outra cobrança
    vigente (de qualquer meio, inclusive `PAID` parcial): 409, nada muda.
- Composição: `readTenantProviderCharge` (`lib/payment-obligation.ts`) lê pela
  única integração `ASAAS` `ACTIVE` da locadora, com a credencial dela;
  integração ausente, ambígua ou sem chave é indisponibilidade, nunca prova de
  cancelamento. `lib/quote-boleto.ts` e `lib/payment-request.ts` usam o mesmo
  ciclo, e `cancelledChargeError` traduz a falha.
- Respostas, nenhuma com segunda cobrança: 409 para divergência; 503 para
  provedor indisponível ou integração não configurada; 502 para chave da
  locadora recusada (401/403) ou resposta fora do contrato (antes, 409). As
  mensagens passaram a "Cobrança anterior…", iguais para PIX e boleto.
- Relatório somente leitura dos valores fora de centavos por locadora
  (`scripts/ops/legacy-cents-report.ts`: transação `READ ONLY` desfeita no fim,
  `DATABASE_URL` explícita, sem modo `--apply`) e runbook
  `docs/guides/legacy-cents-reconciliation.md`.

#### Como validar

- `tests/unit/cancelled-charge-proof-database.test.ts` (17 testes em banco real,
  com a composição real contra o dublê `tests/helpers/fake-asaas` e o lock da
  locadora livre durante a leitura) e `tests/unit/legacy-cents-report.test.ts`
  (8 testes; uma escrita dentro da transação do relatório é recusada com
  `25006`).
- Pendente: `pnpm test:integration` completo, com o `next dev`
  (`quote-flow.test.ts`).

---

## 198. Retorno do login perdido: "Entrar" da área privada e "Solicitar Orçamento"

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-29 **Severidade**: Baixa (depois do login a
pessoa não voltava à página) **Status**: RESOLVIDO (onda 5, sem commit)
**Ambiente**: `packages/frontend/src/app/providers/RuntimeBootstrap.tsx`,
`current-query.ts`, `packages/frontend/src/features/entrar/model/redirect.ts`,
`packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoOrcamento.web.tsx`

#### Descrição

- O "Entrar" do `PrivateAreaGate` levava a `/login` sem `callbackUrl`: depois do
  login a pessoa não voltava à página em que estava.
- O link de login do "Solicitar Orçamento" montava o `callbackUrl` sem passar
  pelo `safeInternalCallback` do login.

#### Causa raiz

- Cada chamador montava o destino do login por conta própria, sem a regra que o
  login aplica ao retorno.

#### Solução

- Regra única: `callbackUrl` = caminho visível + query só se o
  `safeInternalCallback` devolver o valor sem mudar (o login decodifica de
  novo); senão, só o caminho; senão, `/login` sem retorno. `signInHref` de
  `features/entrar` serve ao "Solicitar Orçamento"; o `RuntimeBootstrap` aplica
  a mesma regra.
- `RuntimeBootstrap`: o caminho vem do `refreshKey` (o caminho visível que todo
  host preenche), ainda passado por `toVisiblePathname`. A query é lida no
  clique pela variante `current-query.ts`/`.web.ts`/`.native.ts`: no web,
  `window.location.search` só se a URL for a da rota; no app, vazia (o
  `tenantSlug` volta pelo resolvedor de links). Ler a query na renderização com
  `useSearchParams` exigiria um `Suspense` acima dos providers.
- `apps/clients/web/src/host/routing/decide.visible-routes.test.ts` lia o
  destino do "Entrar" com uma regex sobre o código do `RuntimeBootstrap`; passou
  a ler `const SIGN_IN_PATH='...'` e continua exigindo que `/login` seja página
  do host `app`.
- Onda 8 (achado 114, entrada 215): a cópia de `signInHref` e `SIGN_IN_PATH` do
  `RuntimeBootstrap` saiu; a regra só existe em
  `features/entrar/model/redirect.ts`, e o teste de rotas visíveis lê o
  `SIGN_IN_PATH` de lá.

#### Como validar

- `RuntimeBootstrap.test.tsx` (query, URL de outra rota, query que mudaria na
  nova decodificação, `//evil.example/...` e `%2e%2e`),
  `RuntimeBootstrap.host-tenant.test.tsx`,
  `packages/frontend/src/features/entrar/model/redirect.test.ts`,
  `EquipamentoOrcamento.web.test.tsx` e
  `apps/clients/mobile/src/app/_layout.test.tsx` (`callbackUrl=/area-cliente` e
  `tenantSlug`).

---

## 197. Troca de escopo do carrinho apagava o carrinho salvo do escopo anterior

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-29 **Severidade**: Média (carrinho perdido ao
entrar, sair ou trocar de locadora) **Status**: RESOLVIDO (onda 5, sem commit)
**Ambiente**: `packages/frontend/src/features/carrinho/model/carrinho.ts`

#### Descrição

- Quem montava um carrinho na vitrine da locadora A e depois entrava na conta,
  ou ia para a área de outra locadora, perdia o carrinho salvo de A: ao voltar,
  A estava vazio.
- Sair da conta apagava junto o carrinho salvo do usuário, pelo mesmo defeito.

#### Causa raiz

- O `persist` do zustand grava todo `setState` no nome atual. O
  `switchCartScope` esvaziava a memória (`setState({ items: [] })`) antes de
  trocar o nome, e o vazio era gravado no carrinho salvo do escopo anterior.

#### Solução

- Durante a troca, o carrinho usa um armazenamento que não lê nem grava
  (`detachedStorage`), pela API pública `persist.setOptions`, e esvazia a
  memória como antes. O nome novo e o armazenamento real voltam juntos só na
  troca mais recente, depois da leitura, seguidos do `hydrateItems`.
- O que muda no carrinho enquanto o novo escopo carrega não vai para o escopo
  anterior. Se a leitura falhar, o carrinho continua desligado do armazenamento
  até uma troca dar certo, para não misturar escopos.
- A ordem esperada pelo `RuntimeBootstrap` (`awaitSession` espera a troca) não
  mudou.
- Sair da conta: o carrinho salvo fica no escopo do usuário (locadora e id do
  usuário) e volta quando ele entra de novo; outra pessoa no mesmo aparelho não
  o vê. Apagar o carrinho salvo ao sair é decisão pendente
  (`docs/features/organization-selection.md`, seção 4).

#### Como validar

- `pnpm exec vitest run --config vitest.platform.config.ts packages/frontend/src/features/carrinho`
  (`carrinho.test.ts`, em jsdom: visitante → login e vitrine A → área de B,
  troca em andamento e leitura que falha).
- Os dois testes de troca de rota de `RuntimeBootstrap.test.tsx` provam que o
  carrinho salvo da locadora anterior continua salvo.

---

## 196. CSRF central: mutações do painel no host `app` e fluxos anônimos de conta sem conferência de origem

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-29 **Severidade**: Alta (mutações do painel
aceitas de outra locadora do mesmo site; decisões 4 e 5 da onda 4) **Status**:
RESOLVIDO (onda 5, sem commit) **Ambiente**:
`packages/backend/src/modules/identity/same-origin-mutation.ts`,
`lib/tenant.ts`, `middlewares/require-admin.ts`,
`lib/security/mutation-origin.ts`,
`app/api/auth/{register,forgot-password,reset-password}`, `app/api/quotes`,
`app/api/orcamentos`

#### Descrição

- No host `app`, só `admin/settings` conferia a origem. As outras mutações de
  `/api/admin/**` autenticadas por cookie aceitavam uma requisição de navegador
  vinda de `https://bravo.<raiz>`: todo `{slug}.<raiz>` e o `app.<raiz>` são o
  mesmo site (entrada 190).
- `requireAdmin` montava um `new Request` GET sintético para chegar ao
  principal, então toda mutação passava como leitura.
- `register`, `forgot-password` e `reset-password`, liberadas no host de
  locadora, não conferiam a origem: um script de outra locadora podia cadastrar
  em nome do visitante ou disparar e-mails de recuperação.
- Sem borda validada, o guard da entrada 190 não conferia nada.

#### Causa raiz

- O guard era aplicado rota a rota e só com borda.

#### Solução

- Regra única em `same-origin-mutation.ts`:
  - métodos seguros passam;
  - sem `Origin` e sem `Sec-Fetch-Site`, passa (app nativo, servidor-servidor);
  - a origem esperada é a da borda validada; sem borda, `WEB_PUBLIC_ORIGIN`; sem
    ela, a da própria requisição. `WEB_PUBLIC_ORIGIN` inválida recusa navegador;
  - `Origin` diferente ou `null` recusa; `Sec-Fetch-Site` fora de
    `same-origin`/`none` recusa.
- Quem só enxerga cabeçalhos (`next/headers`) passa `method: null` e
  `url: null`. Pela especificação Fetch, todo método que não é GET nem HEAD leva
  `Origin`; sem `Origin`, a requisição segue como leitura (o callback OAuth do
  Zoho, navegação GET de outro site, continua funcionando). Com `Origin`, vale a
  regra de mutação; sem URL, a comparação é com o authority do `Host`.
- Aplicação central: o guard é a primeira instrução de `resolveTenantPrincipal`
  (`lib/tenant.ts`), o que cobre `requireTenantPermission` e os middlewares de
  `requireAdmin`, que agora passam só os cabeçalhos. `isTrustedMutationOrigin`
  delega ao guard. Nenhuma rota de `app/api/admin/**` precisou mudar.
- `register`, `forgot-password`, `reset-password`, `POST /api/quotes` e o alias
  `POST /api/orcamentos` chamam `rejectCrossOriginMutation` como primeira
  instrução.
- Inventário (`tests/security/route-auth-inventory.test.ts`): uma passagem CSRF,
  com as regras de fluxo do analisador, exige que toda mutação com cookie passe
  pelo guard antes de qualquer efeito e confere no código que os helpers
  centrais o carregam. Duas listas exatas, que acusam entrada obsoleta:
  `OWN_CSRF_DEFENCE` (NextAuth e Better Auth, com defesa própria) e
  `CSRF_PENDING` (vazia).
- Ondas 6 e 7 (achado 109): em `POST /api/quotes` e `/api/orcamentos`, o guard é
  a primeira instrução, sem condição, antes do limite de taxa e da resolução da
  locadora, e entrou na lista do que pode vir antes do guard no inventário.
  `tests/security/tenant-request.test.ts` registrava a ordem antiga; agora exige
  que `/api/quotes` recuse a origem cruzada sem consultar a locadora e, com
  borda forjada, 201 com a origem da própria requisição e 403 sem escrita com a
  origem de outra locadora.

#### Como validar

- `tests/security/admin-same-origin.test.ts`: chama as mutações de
  `/api/admin/**` no host `app`; origem de locadora irmã recebe 403 sem sessão e
  sem banco, e mesma origem e cliente nativo chegam à sessão.
- `tests/security/account-flows-guard.test.ts` (29 casos, nos dois modos de
  identidade) e `pnpm test:security` (`route-auth-inventory.test.ts`,
  `same-origin-mutation.test.ts`).
- Decisões pendentes (seção "Onda 5" de `docs/architecture/modernization.md`):
  exigir `WEB_PUBLIC_ORIGIN` num `next start` atrás de proxy sem borda e a
  inferência de leitura sem `Origin`.

---

## 195. Tailwind 4: regras de elemento passaram a vencer as classes utilitárias

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Média (visual diferente da
produção desde a migração ao Tailwind 4) **Status**: RESOLVIDO (onda 5, sem
commit; contido na onda 4 pela camada `legacy`, commit `4b02f52f`) **Ambiente**:
`packages/frontend/src/app/styles` (`globals.web.css`, `base.web.css`,
`scrollbars.web.css`), `packages/ui/src/web`, `packages/design-tokens/src`

#### Descrição

- Na produção (`main`, `eb4c0098`, Tailwind 3.4.17, CSS sem camadas), as classes
  utilitárias venciam por especificidade as regras universais e de elemento:
  `* { border-color }`, `* { scrollbar-* }`, os tamanhos fluidos de `h1`, `h2`,
  `h3`, `p` e `small` e `section { overflow-x: hidden; max-width }`.
- Desde a migração ao Tailwind 4 (commit `0cff7b65`), os utilitários ficam em
  `@layer utilities`, e essas regras, fora de camada, passaram a vencê-los.
  Exemplos: `border-slate-700` do `Button` default (a borda saía `slate-200`),
  `border-transparent` do `ghost` (borda cinza), `text-sm` num `<p>` (18px em
  vez de 14px), título de diálogo com 48px e `scrollbar-none` sem efeito.
- A linha de base visual (`tests/visual`) foi gravada já com essa regressão.

#### Causa raiz

- Cascade layers: CSS fora de camada vence qualquer camada; no Tailwind 3 a
  disputa era só de especificidade.

#### Solução

- Onda 4 (contenção): as regras ficaram na camada `legacy`, a única depois de
  `utilities`, com especificidade zero e exceções por marcador
  (`data-own-border`, `data-own-type`). Nada mudou em relação à linha de base.
- Onda 5 (lote A1, opção (a) aprovada pelo usuário: restaurar a produção):
  - `* { border-color }`, a tipografia de `h1`, `h2`, `h3`, `p` e `small` e
    `section { overflow-x: hidden; max-width: 100vw }` voltaram para
    `@layer base` (`base.web.css`), onde as classes utilitárias vencem, como no
    Tailwind 3;
  - a barra de rolagem padrão (`* { scrollbar-* }`) foi para `@layer components`
    (`scrollbars.web.css`), porque o plugin `tailwind-scrollbar` zera
    `scrollbar-*` no fim da camada `base`;
  - `legacy.web.css` foi apagado; a ordem das camadas é
    `theme, base, components, utilities`;
  - saíram os marcadores `data-own-border` e `data-own-type` e as exceções com
    `revert-layer` de `packages/frontend` e `packages/ui`. O único uso que ainda
    fazia sentido, tirar botões da variante `controls:`, virou `data-own-frame`
    (`Button` `filter-reset`/`header-action`, `Cabecalho`, `Acoes`).
- No mesmo lote, o anel de foco por teclado passou ao laranja da marca (token
  `--focus-ring`, `#ea580c` nos dois temas), decisão do usuário.
- Linha de base regravada em 2026-09-29 (30 arquivos, `approved-changes.json`
  vazio; histórico em `tests/visual/README.md`).
- Prova contra a produção: o CSS da `main` compilado e aplicado ao mesmo DOM
  (400 capturas, 102.598 elementos). Das 29.625 bordas que o lote mudou, 29.587
  ficaram iguais à produção; das 6.288 tipografias, 6.221; barra de rolagem e
  `overflow` também. O resíduo é do Tailwind 4 em si (paleta OKLCH, entrada 169;
  classes sem equivalente no CSS da produção; `text-base`, entrada 170;
  `leading-*` com `text-*` responsivo), não da cascata.
- Armadilha de nome: a barra de rolagem usa `--scroll-thumb` e `--scroll-track`,
  porque `--scrollbar-*` é usado pelo plugin `tailwind-scrollbar`.

#### Como validar

- `packages/frontend/src/app/index.styles.test.ts` (ordem das camadas e ausência
  de `legacy` e dos marcadores), `pnpm lint:css` e a comparação da linha de base
  visual (`tests/visual/README.md`), com duas capturas seguidas sem diferença.

---

## 194. `!important` zerado: rolagem suave do Next, revelação por rolagem e Mapa no Shadow DOM

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Média (as 22 exceções da
entrada 177) **Status**: RESOLVIDO (onda 4, commit `4b02f52f`) **Ambiente**:
`packages/frontend/src/app/styles`,
`packages/frontend/src/app/providers/ScrollRevealInit.web.tsx`,
`packages/frontend/src/features/mapa-loja/ui`, `tools/token-check.mjs`

#### Descrição

- Restavam 22 `!important` (entrada 177): 6 no CSS global e 16 no Mapa.
- Rolagem suave: com `data-scroll-behavior="smooth"` no `<html>`, o Next 16
  grava `scroll-behavior: auto` inline durante a navegação; o CSS anulava isso
  com `scroll-behavior: smooth !important`.
- O `ScrollRevealInit` gravava `transition` inline nos cartões e no hero e
  `overflow` inline no `html` e no `body` da página Sobre; o CSS vencia com
  `!important`.
- Mapa: um `<style>` com 16 `!important` no Shadow DOM do `gmpx-store-locator`,
  porque o Lit adota a folha do componente, que vem depois do `<style>`.
- O último `!important` do CSS, no bloco de movimento reduzido, deixava 15
  elementos da revelação parados.

#### Causa raiz

- Estilo inline gravado pelo framework, pelo próprio código e por terceiros,
  vencido com peso em vez de resolvido na origem.

#### Solução

- Atributo `data-scroll-behavior` removido de
  `apps/clients/web/src/app/layout.tsx` e de `app/layout.tsx`;
  `html { scroll-behavior: smooth }` em `@layer base` (`base.web.css`). Em dev o
  Next mostra um aviso único sugerindo o atributo: é esperado.
- `ScrollRevealInit`: `setRevealTransition` não grava transição nos elementos de
  `CSS_OWNED_TRANSITION` (a transição fica em `components.web.css`); o
  `ContatoHome` deixou de gravar `transition: none`; a Sobre usa
  `html:has(.sobre-page)` e `body:has(.sobre-page)` em `layout.web.css`. O
  evento `scrollRevealReady` e os tempos (2700 ms na primeira visita, 200 ms na
  navegação interna) não mudaram e estão presos por teste.
- Movimento reduzido: `STILL_WHEN_REDUCED_MOTION` no `ScrollRevealInit` põe
  esses elementos em repouso (opacidade 1, sem transform e sem animação), sem
  mexer no `scrollRevealReady`. Até a hidratação eles apareciam como no
  carregamento normal; desde a onda 5 só nascem escondidos com `motion-safe:`
  (entrada 201).
- Mapa: folha construída no fim de `shadowRoot.adoptedStyleSheets`
  (`locator-shadow-style.web.ts`), repetindo com a mesma especificidade os
  seletores do componente que venceriam `*` (`button` e
  `#location-results-list .result-item`).
- `tools/token-check.mjs`: `css-important` passou a `ZERO_TOLERANCE_RULES`
  (reprova em todo escopo, sem baseline nem `allow`); `readBaseline` recusa
  contagem dela; `tools/token-baseline.json` a mantém em `rules` com cota zero
  para o `ratchet-guard` acusar se ela sair da lista.
- Diferença fora da identidade estrita (a confirmar como correção): ao sair da
  Sobre por navegação interna, o `overflow: auto` inline não fica mais no `html`
  e no `body`, então as páginas seguintes voltam ao CSS base (e o
  `position: sticky` volta a funcionar).

#### Como validar

- `pnpm tokens` (linha `zero tolerance ... css-important 0`), `pnpm lint:css` e
  `pnpm test:gates`.
- `ScrollRevealInit.web.test.tsx`, `ContatoHome.revelacao.web.test.tsx`,
  `locator-shadow-style.web.test.ts` e `Mapa.simplificado.web.test.tsx`.
- Linha de base visual sem diferença não aprovada. As sondas em Chromium (estilo
  computado do Mapa igual ao antigo em 38 elementos e 21 propriedades; primeiro
  modelo 3D sem zoom, com controle positivo) ficaram fora do versionamento. O
  Teste 1 do carrossel em GPU real continua pendente.

---

## 193. `/orcamento` montava com o carrinho da locadora anterior no web

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Média (achado 21 da revisão
da onda 3) **Status**: RESOLVIDO (onda 4, commit `4b02f52f`) **Ambiente**:
`packages/frontend/src/app/providers/RuntimeBootstrap.tsx`

#### Descrição

- Com a área do cliente aberta, ir para `/orcamento` montava a página com o
  carrinho ainda preso ao escopo da área (`cart:["locadora-b","user-1"]`, item
  `eq-B`). O caminho inverso (`/orcamento` → área) também montava antes da troca
  de escopo.

#### Causa raiz

- A exceção `opened` do `PrivateAreaGate`, que existe para a tela mobile que
  continua montada na pilha, valia também no web.

#### Solução

- `keepsOpenScreen = !followsRoute && opened.current`: a exceção vale só no
  mobile. No web, toda rota da área ou com `awaitSession` espera `scopeReady` em
  qualquer transição.

#### Como validar

- `packages/frontend/src/app/providers/RuntimeBootstrap.test.tsx` (área aberta →
  `/orcamento` e `/orcamento` → área). A exceção mobile continua coberta por
  `apps/clients/mobile/src/app/_layout.test.tsx` (entrada 161).

---

## 192. Gates burláveis: catraca, inventário de rotas, workflow inválido e migration que travava leituras

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Média (achados 5, 6 e 10 a 16
da revisão da onda 3) **Status**: RESOLVIDO (onda 4, commit `4b02f52f`)
**Ambiente**: `tools/ratchet-guard.mjs`,
`tests/security/route-auth-inventory.test.ts`, `.github/workflows/ci.yml`,
`prisma/migrations/202609260004_payment_active_charge_unique`,
`tests/unit/migration-preflight-rls.test.ts`

#### Descrição

- Catraca (10 e 11): apontar `ratchetBaseline` para outro arquivo inflado ou
  estreitar `universalSourceRoots` passava no `ratchet-guard`; uma transferência
  escrita à mão, com a origem ainda no disco ou para um arquivo novo sem
  relação, também passava.
- Inventário de rotas (12 a 15): `!auth` sobre um objeto sempre presente,
  `principal.userId === principal.userId` ou `=== body.userId`,
  `resolvePublicRequestTenant` antes de um `deleteMany` e `import()`,
  `require()` ou `globalThis.fetch` antes da guarda eram aceitos.
- CI (16): o nome de passo
  `Visual baseline tooling (capture runs manually: ...)` sem aspas tornava o
  `ci.yml` YAML inválido, e o GitHub rejeitava o workflow inteiro (nenhum job
  rodava desde `be859915`); um push cancelava o anterior; `tests/contract/**`
  não rodava.
- Banco (5 e 6): o teste de preflight criava papel LOGIN sem senha e falhava com
  SCRAM (`client password must be a string`); a migration `0004` pegava
  `ACCESS EXCLUSIVE` em `payments` sem `lock_timeout`, e as leituras ficavam na
  fila atrás dela.

#### Causa raiz

- Guardas que confiavam na configuração da própria árvore, analisador que não
  conhecia o formato do resultado de cada helper, YAML sem validação e migration
  sem limite de espera.

#### Solução

- `ratchet-guard`: a baseline da base é localizada pelo `arch.config.json` da
  base (`git show`); mudança de configuração que estreita a contagem reprova (a
  configuração pode ampliar o que é contado, nunca estreitar); transferência
  exige `counts`, origem fora da árvore, destino que não existia na base e
  renomeação detectada pelo git (`git diff --no-index -M` só no par); a cota
  movida é `min(base, counts)`.
- `route-auth-inventory`: cada helper de `GUARDS` declara o formato do resultado
  (`discriminated`, `denial`, `nullable`, `response` ou `opaque`), e só conta o
  teste que separa negado de autorizado; `CLIENT` dono só com o parâmetro de
  rota (`const` de `await params`) comparado a `principal.userId` e passado ao
  acesso a dados seguinte; `PUBLIC_TENANT_SURFACE` lista os 12 métodos que podem
  usar `resolvePublicTenant` e `resolvePublicRequestTenant`; `import()` e
  `require()` de módulo contam como import, e
  `globalThis`/`self`/`window.fetch`, como I/O.
- CI: nome do passo entre aspas, validado por `tests/unit/ci-workflow.test.ts`;
  `concurrency` agrupa push por `run_id` (nunca cancela) e cancela só em PR;
  passo `pnpm test:contract` (`vitest.contract.config.ts`).
- Banco: `tests/helpers/database-roles.ts` (`createLoginRole`) cria o papel com
  senha aleatória e é o padrão para papéis LOGIN em testes de banco. A `0004`
  usa `SET LOCAL lock_timeout = '5s'` e `statement_timeout = '60s'`; o
  `CREATE UNIQUE INDEX` virou a própria checagem (lock `SHARE`, leituras seguem)
  e o `NO FORCE` só roda no caminho de erro, para listar duplicatas.
- Onda 5 (lote security): a `0001` segue o padrão da `0004` (os mesmos timeouts
  e o índice único como a própria checagem, sem tirar o `FORCE` no início); a
  `0002` e a `0003` ganharam só os timeouts e mantêm o `NO FORCE`.
  `migrate deploy` do zero aplicou as 19 migrations.
  `tenant-slug-policy.test.ts` e `tenant-database.test.ts` também passaram a
  usar `createLoginRole`.
- Deploy: toda migration que falha no `prisma migrate deploy` para com `P3018`,
  seja qual for a causa: `55P03` (lock timeout, tabela `rentals` ou `payments`
  ocupada, nas migrations com `lock_timeout`, `202609260001` a `0004`), `P0001`
  (um preflight que achou dados a reconciliar, como os das `202609260001` a
  `0005`) ou outro erro. A transação inteira foi desfeita (nada mudou), mas o
  Prisma registra a migration como falha e todo `migrate deploy` seguinte recusa
  com `P3009`: rodar o deploy de novo não resolve, nem depois de reconciliar os
  dados. Corrija a causa (espere a tabela acalmar, ou reconcilie como a mensagem
  do preflight pede), marque essa migration como desfeita e só então repita o
  deploy: `pnpm exec prisma migrate resolve --rolled-back <migration>` (por
  exemplo `202609260004_payment_active_charge_unique`) e
  `pnpm exec prisma migrate deploy`. O comentário de cada migration com
  `lock_timeout` traz os dois comandos com o próprio nome, e as mensagens dos
  preflights de `0001` a `0005` também (a da `0004` na onda 6; as outras na onda
  7, entrada 217). `tests/unit/migration-preflight-rls.test.ts` executa esses
  comandos com um `prisma migrate deploy` real num schema descartável: com a
  tabela travada (`P3018`/`55P03`, depois `P3009`, depois aplicada) e, na
  `0004`, com cobranças duplicadas (`P3018`/`P0001`, depois `P3009` mesmo após a
  reconciliação, depois aplicada com os comandos que a própria mensagem dá). A
  `0004` remove o índice legado com `DROP INDEX IF EXISTS`: no banco sem ele (o
  caso do preflight), a reconciliação cancela a cobrança excedente e o histórico
  `CANCELLED` fica.

#### Como validar

- `pnpm test:gates` (inclui `tests/unit/ratchet-guard.test.ts`),
  `pnpm test:security` (`route-auth-inventory.test.ts`),
  `tests/unit/ci-workflow.test.ts` e
  `tests/unit/migration-preflight-rls.test.ts` (`pnpm test:unit`, banco
  descartável).

---

## 191. Limitadores de login: v2 fora da janela, sem teto por conta, IP do proxy e segredo opcional

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Média (achados 17 a 20 da
revisão da onda 3 e decisão H7a) **Status**: RESOLVIDO (onda 4, commit
`4b02f52f`) **Ambiente**:
`packages/backend/src/modules/identity/legacy-credentials.ts`, `lib/auth.ts`,
`lib/identity.ts`, `lib/rate-limit.ts`,
`packages/backend/src/modules/directory/rate-limit.ts`

#### Descrição

- 17: na coexistência, o login v2 (hook do Better Auth em `/api/auth/v2`) não
  passava pelo limitador e, com e-mail inexistente, respondia sem bcrypt (o
  tempo denunciava a conta).
- 18: a janela por conta só atrasava; 400 tentativas paralelas de 80 IPs
  chegavam todas à senha.
- 19: com borda validada mas sem `x-platform-client-ip`, o IP caía no
  `x-real-ip`, que é o IP do proxy: um usuário gastava o balde de todos.
- 20: todos os `rateLimit()` genéricos dividiam um store em memória com a chave
  do IP: `adminApiRateLimit` consumia o `strictRateLimit`, e um flood num
  limitador despejava as janelas dos outros.
- H7a: em produção sem `PLATFORM_RATE_LIMIT_SECRET`, cada instância usava chave
  própria (janela por instância).

#### Causa raiz

- Dois caminhos de verificação de credencial, limite por conta sem teto,
  fallback de IP que ignorava a borda e store compartilhado entre limitadores.

#### Solução

- `verifyLegacyCredential` é o único caminho (`authorize` do NextAuth e hook do
  Better Auth), sempre na mesma ordem: formato; tentativa contada antes da busca
  (porta `LegacySignInGuard`, entregue por `legacySignInGuard()` de
  `lib/rate-limit.ts`); `findLegacyAccountsByEmail` (escape de `\`, `%` e `_`,
  `take: 2`, igualdade normalizada, conta ambígua negada); bcrypt sempre, com
  hash fictício de custo 12 quando não há conta. v1 e v2 contam nas mesmas
  janelas; o v2 responde 429 com `Retry-After`, 401 ou 503. `createIdentity` em
  modo legacy sem o guard falha na criação.
- Teto rígido por conta: 100 tentativas a cada 15 min, contado no mesmo upsert
  atômico e antes da senha; o atraso progressivo continua.
- Com borda validada, `clientIpFromHeaders` devolve o `edge.clientIp` ou `null`,
  nunca `x-real-ip` nem `X-Forwarded-For`.
- Cada limitador genérico tem o próprio store limitado. Os de identidade já
  usavam `platform_rate_limits`, sem eviction.
- Extração de 2026-10-01 (corte 17, sem commit): o store e os limitadores
  genéricos agora têm uma implementação em
  `packages/backend/src/http/memory-rate-limit.ts`, composta por
  `createMemoryRateLimiters`. Fachadas conservam assinaturas e leitor real de
  IP; cada processo mantém seu estado. A lista administrativa foi instalada no
  serviço com a ordem original limite → permissão → consulta. Paridade HTTP,
  janelas/headers/eviction e proteção estrutural estão no corte 17 de
  [API compartilhada](../features/shared-api-host.md). Não mudou a política dos
  limitadores persistentes de identidade.
- `platformRateLimitSecret` lança `PlatformEnvError` em produção sem o segredo
  ou com menos de 32 caracteres, antes de contar; a mensagem não traz o valor.
  Fora de produção, chave local. Na onda 4 o critério era `NODE_ENV=production`;
  na onda 5 passou ao da plataforma (ver abaixo).
- Limitação: atingir o teto segura a conta, inclusive para o titular, até o fim
  da janela (exige pelo menos 20 IPs, a 5 por IP); aviso ao titular não foi
  implementado.

#### Atualização (onda 5, lote security, sem commit)

- Fluxos anônimos de conta: o ramo better-auth de `register` e `forgot-password`
  passa pela mesma contagem do legacy, antes de qualquer chamada a `auth.api.*`
  (`refuseAuthAttempt` em `lib/rate-limit.ts`). Janela gasta responde 429
  `no-store` com `Retry-After`; limitador que não consegue contar (banco fora ou
  produção sem o segredo) responde 503 `no-store` com `Retry-After: 60` (antes,
  500). A causa vai para um log estruturado `[auth-rate-limit]`, sem e-mail, IP,
  chave nem segredo.
- `handleIdentityRequest` (`lib/identity.ts`) registra `[identity]` com método,
  primeiro segmento do endpoint, nome e código do erro (e o texto só de
  `PlatformEnvError`, que nunca traz segredo). Nunca entram corpo nem o resto do
  caminho, que pode levar token. A resposta 503 continua neutra.
- Critério de produção do segredo: `isPlatformProduction` (`lib/rate-limit.ts`),
  que usa `resolvePlatformEnv`, a mesma função que exige `PLATFORM_EDGE_SECRET`.
  Ambiente inválido conta como produção (falha fechada);
  `PLATFORM_ENV=production` exige o segredo mesmo com `NODE_ENV=test`; preview
  da Vercel e `PLATFORM_ENV=development` usam chave local (janela por
  instância).
- `.env.example` documenta `TRUSTED_PROXY_HOPS`.
- Validar: `tests/security/auth-rate-limit.test.ts` (critério de produção),
  `tests/security/account-flows-guard.test.ts` e
  `tests/security/identity-request-log.test.ts`.

#### Como validar

- `tests/identity/legacy-credentials.integration.test.ts` (banco real: mesmas
  janelas no v1 e no v2, 429 igual para conta inexistente, bcrypt de custo 12,
  `_` e `%` sem alcançar outra conta).
- `tests/security/auth-rate-limit.test.ts` (teto de 100 com 400 paralelas, duas
  instâncias no banco, IP atrás do proxy, escopo por limitador) e
  `tests/security/legacy-auth-hardening.test.ts`.

---

## 190. CSRF entre locadoras irmãs nas mutações da área do cliente

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Média (achado 2 da revisão da
onda 3) **Status**: RESOLVIDO (onda 4, commit `4b02f52f`) **Ambiente**:
`packages/backend/src/modules/identity/same-origin-mutation.ts` e 14 arquivos de
rota em `app/api`

#### Descrição

- Todo `{slug}.<raiz>` e o `app.<raiz>` são o mesmo site: o cookie de sessão de
  `alfa` acompanha um `fetch` com `credentials: 'include'` disparado por um
  script de `bravo`, e um POST `text/plain` nem passa por preflight. 16 handlers
  de mutação com cookie executavam o efeito vindo de `https://bravo.<raiz>` no
  host `alfa` (no banco: esvaziar o carrinho e criar ou apagar endereço do
  cliente de A).

#### Causa raiz

- As mutações da área do cliente conferiam só sessão e locadora; a checagem de
  origem existia apenas em `quotes`, `contact` e `client/enroll`.

#### Solução

- Guard compartilhado `isSameOriginMutation`/`rejectCrossOriginMutation`
  (`@gb-locacoes/backend/identity`), logo depois do gate
  `resolveTenantPrincipal`. Com borda validada, responde 403 `no-store` quando o
  `Origin` difere da origem da borda (inclusive `null`) ou quando
  `Sec-Fetch-Site` não é `same-origin` nem `none`. Métodos seguros passam. Na
  onda 4, sem borda (backend direto, app mobile) o comportamento era o de antes;
  na onda 5 isso vale só sem cabeçalhos de navegador (entrada 196).
- Rotas: POST de `cart/sync`, `cart/merge` e `addresses`; PATCH e DELETE de
  `addresses/[id]` e `client/notifications/[id]`; POST de
  `client/notifications/mark-all-read`, `client/rentals/[id]/extend`,
  `request-extension` e `request-pickup`; DELETE de `client/rentals/[id]` e
  `quotes/[id]`; PUT de `user/profile`; POST de `contracts/sign` e
  `integrations/melhor-envio/calculate`.
- Decisões da onda 4 resolvidas na onda 5 (entrada 196): o guard é central
  (primeira instrução de `resolveTenantPrincipal`, o que cobre `/api/admin/**`
  no host `app`) e, sem borda, cai em `WEB_PUBLIC_ORIGIN` ou na origem da
  própria requisição.

#### Como validar

- `tests/security/same-origin-mutation.test.ts` (16 handlers com borda `alfa` e
  `Origin` de `bravo`, com controles positivos) e
  `tests/security/same-origin-mutation.integration.test.ts` (banco real).

---

## 189. Host `app`: login da equipe inexistente e API de conta aberta no host de locadora

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Alta (achados 25 a 28 da
revisão da onda 3) **Status**: RESOLVIDO (onda 4, commit `4b02f52f`)
**Ambiente**: `apps/clients/web/src/host/routing/route-table.ts`,
`apps/clients/web/src/app/(auth)`, `apps/clients/web/src/app/(admin)/admin`,
`apps/clients/web/src/proxy.ts`

#### Descrição

- 25: no host `app`, `/login` dava 404 neutro, e `/admin/login` e o índice
  `/admin` ficavam em "Redirecionando..." para sempre: a equipe não entrava no
  painel.
- 26: `'/api/auth/**'` inteiro estava na allowlist do host de locadora:
  `list-sessions`, `revoke-sessions`, `update-user`, `delete-user` e
  `change-email` (também em `/api/auth/v2`) respondiam a scripts da origem da
  locadora.
- 27: o teste da allowlist conferia só 3 rotas, e havia entradas sem chamador.
- 28: o teste do proxy só verificava `typeof`.

#### Causa raiz

- O host `app` não tinha página de login própria, e a allowlist foi escrita por
  prefixo, sem inventário de chamadores.

#### Solução

- `/login` em `APP_HOST_PATHS` e página
  `apps/clients/web/src/app/(auth)/login/page.tsx`: o `LoginPage` do produto com
  `hostAuth` (modos legacy e better-auth) e `allowSignUp={false}` (sem
  "Cadastre-se"). O retorno fica preso ao painel por `resolvePanelCallback`
  (`packages/frontend/src/pages/login/model/panel-callback.ts`): só `/admin` e
  `/admin/**` normalizados; nunca outra origem, a área do cliente,
  `/admin/login` ou caminho que mude numa segunda decodificação. O padrão é
  `/admin`.
- `/admin/login` redireciona para `ADMIN_LOGIN_REDIRECT` (`/login`) com o
  callback; `/admin` decide pela sessão do `hostAuth`.
- API de conta no host de locadora: a allowlist geral só tem `/api/auth/session`
  (NextAuth). `TENANT_ACCOUNT_API`, lista mínima comentada, vale só fora do modo
  legacy: `get-session`, `sign-in/email`, `sign-in/social`,
  `callback/*/oauth-proxy` e `sign-out` nos dois basePath, mais `register`,
  `forgot-password`, `reset-password`, `verify-email` e `organizations/current`.
  `TENANT_API_DENYLIST` vence qualquer padrão: sessões, perfil, e-mail, senha,
  exclusão, contas OAuth e tokens, callback do provedor, `oauth-proxy-callback`,
  `expo-authorization-proxy`, `organizations` e `organizations/selection`.
- O teste da allowlist deriva os chamadores reais (literais `/api`, métodos
  `authClient.*` por basePath e `getSession` do next-auth) e exige chamador ou
  entrada `INFRA` com motivo. Saíram três entradas sem chamador:
  `/api/equipments/*`, `/api/contracts/sign` e `/api/payments/boleto/*/pdf`
  (voltam junto com a tela que as chamar).
- `src/proxy.ts` testado com `vi.stubEnv` e `vi.resetModules`: 503 com modo ou
  ambiente inválidos (sem vazar o segredo), `/entrar` e `get-session` por modo,
  ambiente lido uma vez.
- Pendência de design da onda 4 (o login da equipe usava o shell da vitrine e o
  texto da GB): resolvida na onda 5 (lote D2). O layout `(auth)` do host `app`
  monta `AppHostProviders chrome="platform"`: no topo, só uma barra com o nome
  provisório da plataforma (`PLATFORM.displayName`, widget
  `widgets/casca-plataforma`), sem cabeçalho, rodapé e WhatsApp da vitrine,
  cujos links davam 404 ali. `LoginPage`, `RecuperarSenhaPage` e
  `ResetPasswordPage` ganharam a prop `shell` (`storefront`, o padrão, ou
  `platform`), no mesmo contrato para web e app; no host de locadora nada muda.

#### Como validar

- `pnpm test:web`: `decide.visible-routes.test.ts` (os destinos reais de login e
  painel abrem uma página do host `app`),
  `route-table.tenant-api-allowlist.test.ts`, `proxy.test.ts`,
  `app/(auth)/login/page.test.tsx`, `app/(auth)/admin/login/page.test.tsx` e
  `app/(admin)/admin/page.test.tsx`.
- `tests/security/tenant-auth-api.test.ts`: percorre todos os endpoints da
  instância real do Better Auth nos dois basePath.

---

## 188. Backend de produção sem `WEB_API_ORIGIN` desligava a borda de host

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Alta (achados 1 e 24 da
revisão da onda 3) **Status**: RESOLVIDO (onda 4, commit `4b02f52f`)
**Ambiente**: `packages/contracts/src/platform.ts`,
`apps/clients/web/src/proxy.ts`,
`apps/clients/web/src/host/server/public-api.ts`

#### Descrição

- `resolvePlatformEnv` exigia `WEB_API_ORIGIN` em produção. O backend usa essa
  função em `readPlatformEdgeContext`, em `identityConfiguration` e no cliente
  Zoho. Num backend de produção (`PLATFORM_ENV`, `NODE_ENV` ou `VERCEL_ENV` =
  production) sem a variável, que é só do web, a função lançava: a borda ficava
  nula em toda requisição (a locadora do host deixava de valer) e, no modo
  better-auth, `identityConfiguration` falhava.

#### Causa raiz

- Um único contrato de ambiente para dois processos com variáveis diferentes.

#### Solução

- `resolvePlatformEnv` (comum ao web e ao backend) não exige nem recusa
  `WEB_API_ORIGIN`: devolve `apiOrigin` `null` quando ela falta ou é inválida.
- `resolveWebPlatformEnv`, só no web (`proxy.ts` e `public-api.ts`), exige a
  variável em produção, aceita só a origem e exige https fora de development. O
  web continua falhando fechado: 503 em páginas e APIs.
- Na mesma área:
  - achado 3: o teste de borda forjada usava `beta`, subdomínio reservado, e
    passava mesmo com o segredo ignorado; agora usa `bravo`, com controles
    positivos;
  - achado 4: `GET /api/auth/organizations/current` fora de host de locadora
    (app, apex, sem borda ou borda forjada) responde sempre 409
    `{ error, code: 'TENANT_REQUIRED' }` com `private, no-store` e
    `Vary: Cookie, Host`, sem consultar o banco e ignorando `tenantSlug` na
    query.

#### Como validar

- `packages/contracts/src/platform.test.ts` (backend de produção sem a variável;
  bloco `resolveWebPlatformEnv`), `apps/clients/web/src/proxy.test.ts` (503 sem
  a variável ou com http) e, em `pnpm test:security`, `platform-edge.test.ts`,
  `tenant-request.test.ts` e `same-origin-mutation.test.ts` (backend de produção
  sem `WEB_API_ORIGIN` ainda aplica o host).

---

## 187. Boleto reemitido sobre cobrança `CANCELLED` local sem prova no provedor

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Média (achado 8 da revisão da
onda 3) **Status**: RESOLVIDO (onda 4, commit `4b02f52f`; leitor do provedor
ligado na composição na onda 5, entrada 199) **Ambiente**:
`packages/backend/src/modules/quotations/boleto.ts`, `lib/quote-boleto.ts`

#### Descrição

- `ensureQuoteBoletoPayment` tratava todo boleto `CANCELLED` como extinto e
  emitia outro. Uma linha `CANCELLED` local cuja cobrança seguia aberta no Asaas
  gerava dois boletos vivos para o mesmo orçamento.

#### Causa raiz

- O status local era tratado como prova de cancelamento no provedor (a entrada
  156 liberou a reemissão sem essa distinção).

#### Solução

- `CANCELLED` só conta como extinto com prova: sem `transactionId`, ou com
  tentativa desse `transactionId` em `CANCELLED` ou `cancellationStatus`
  `CONFIRMED`. `REFUNDED` continua encerrando a cobrança.
- Sem prova, a emissão consulta o provedor fora de SQL, entre duas transações,
  pela porta opcional `readProviderCharge` (`QuoteBoletoChargeReader`; o leitor
  é o `get` do `createAsaasGateway`):
  - removida e não paga: grava a prova numa tentativa `CANCELLED`/`CONFIRMED` e
    emite um único boleto novo;
  - aberta (`PENDING` ou `OVERDUE`) com o mesmo valor: reativa a linha local,
    cria a tentativa e o vínculo em `externalResourceTenant`, sem boleto novo;
  - já paga: reativa a linha e enfileira `payment.provider.confirmed` (o
    `processPayment` marca `PAID`);
  - divergência (outro valor, 404, estorno, mais de uma aberta, tentativa
    contraditória ou outro boleto vigente): 409 sem mudança;
  - provedor indisponível: 503.
- Idempotente: a segunda chamada não lê o provedor de novo.
- Sem leitor injetado, `CANCELLED` sem prova responde 409 e nunca emite um
  segundo boleto. Esse era o estado de `lib/quote-boleto.ts` até a onda 4; na
  onda 5 a composição passa o leitor da locadora, o critério foi para o billing
  e passou a valer também no pedido de PIX e boleto, com 502 para chave recusada
  ou resposta fora do contrato (entrada 199).

#### Como validar

- `tests/unit/quote-settlement-database.test.ts` (banco descartável, dublê
  `tests/helpers/fake-asaas`): removida, aberta, paga, divergente, 404 e 503.

---

## 186. Quitação e cobrança em centavos: total fracionário nunca quitava

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Alta (achados 7 e 9 da
revisão da onda 3) **Status**: RESOLVIDO (onda 4, commit `4b02f52f`)
**Ambiente**: `packages/domain/src/locacao/saldo.ts`,
`packages/domain/src/orcamento`,
`packages/backend/src/modules/{quotations,rentals}`, `lib/payment-obligation.ts`

#### Descrição

- Com semana direta de R$ 100 e 9 dias, `buildQuotePricing` devolvia
  128.57142857142858. A cobrança saía com 128.57 e, depois de paga,
  `isObligationSettled` continuava `false` (128.57 < 128.5714...): o orçamento
  pago não convertia, e `resolvePaymentObligation` tentava cobrar 0.00 (409).
- Multas e taxas também saíam fracionárias:
  `calculateRentalLateFee(1000, 7 dias, 3 de atraso)` dava 21.428571428571427 e
  `calculateLateFee(128.57, 3)` dava 7.7142.

#### Causa raiz

- A quitação comparava com o total sem arredondar, enquanto a cobrança usava o
  saldo arredondado; totais e taxas não eram arredondados na origem.

#### Solução

- Regra única de saldo em `packages/domain/src/locacao/saldo.ts`: `roundToCents`
  (2 casas, `ROUND_HALF_UP` explícito, sem depender do modo global do
  decimal.js) e `obligationBalance` (total em centavos menos o pago em centavos;
  a soma é feita em Decimal e arredondada uma vez).
- Os três lados usam essa regra: `isObligationSettled` (e por ela
  `hasCheckoutPayment` e `blocksRentalInventory`), `resolvePaymentObligation` e
  a conversão, que grava `rentals.total` em centavos e calcula o saldo do boleto
  por `obligationBalance`.
- Totais e taxas arredondados na origem: `buildQuotePricing` (total do item
  arredondado uma vez sobre preço unitário × quantidade), `quote-request` (soma
  em Decimal), `quotations/update.ts` (`finalTotal`, `lateFee`, multa aprovada,
  datas de item, remoção de item e frete), `adjustments.ts`, `boleto.ts`, multas
  do domínio, `applyRentalLateFee`, prorrogação do admin e do cliente, multa de
  check-in, avaria, locação manual e `updateRental.lateFee`.
- A taxa diária de referência (`pricePerDay`, `priceperday`) mantém a precisão
  original; só os valores cobrados são arredondados (a confirmar).
- Onda 6 (achados 16 e 17): em `update.ts`, o campo `total` do `PATCH` ainda
  entrava cru; agora `total`, frete e multa passam por centavos na entrada
  (valor inválido dá 400), e a obrigação sai da regra única `quoteObligation`
  (entrada 205). `buildQuotePricing` arredondava o float do cálculo; agora parte
  do preço exato em Decimal (entrada 206).

#### Como validar

- `tests/unit/quote-settlement-database.test.ts` (total legado 128.5714... pago
  por 128.57 converte, com estoque bloqueado e check-out liberado),
  `rental-reservation.test.ts`, `payment-creation.test.ts`,
  `quotes-http.test.ts` e `rentals-http.test.ts` (14.29, 1.67, 2.86, 10.01 e
  31.67 gravados e cobrados).
- Domínio: `saldo.test.ts`, `orcamento/preco.test.ts`, `locacao/multa.test.ts` e
  `orcamento/multa.test.ts`.

---

## 185. Modo host: widgets do cabeçalho liam o caminho interno `/{slug}` e links do native perdiam a locadora

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Média (navegação e estado
ativo errados no host de locadora) **Status**: RESOLVIDO (onda 3, commit
`be859915`) **Ambiente**:
`packages/frontend/src/widgets/{cabecalho,cabecalho-admin-barra,menu-admin}`,
`packages/frontend/src/pages/equipamentos/ui/EquipamentosPage.native.tsx`

#### Descrição

- No host de locadora, o roteador entrega o caminho interno `/{slug}/...`. Os
  widgets que ainda liam `usePathname` comparavam esse caminho:
  - o cabeçalho não marcava "Equipamentos" nem "Início" como página ativa, e a
    área do cliente não marcava "Meus Orçamentos";
  - a busca fechava quando o roteador trocava o caminho interno pelo visível;
  - a barra mobile do painel mostrava "WhatsApp" em vez de "Configurações" para
    o slug `whatsapp-sp`, porque o nome da locadora aparecia no caminho.
- `EquipamentosPage.native.tsx` montava os links sem passar pelo resolvedor de
  href e, sem resolvedor, sem `?tenantSlug=`.

#### Causa raiz

- Seis widgets ficaram fora do Lote 4a com a regra de lint em aviso; a variante
  native da página de equipamentos não seguia o padrão do web.

#### Solução

- `Cabecalho.web.tsx`, `Busca.web.tsx`, `AreaCliente.web.tsx`,
  `BarraMobile.web.tsx`, `BarraLateral.web.tsx` e `BarraLateralMobile.web.tsx`
  usam `useVisiblePathname`. Nenhuma classe ou estilo mudou.
- A página native usa `useHrefResolver()` e, sem resolvedor na árvore,
  `withPublicTenant(href, tenantSlug)`, igual ao web.
- Onda 4: o bloco de exceção em aviso do `eslint.config.js` saiu. Importar
  `usePathname` fora de `shared/lib/navigation/use-visible-pathname.web.ts` é
  erro em todo o `packages/frontend`.

#### Como validar

- `*.caminho-visivel.web.test.tsx` em `widgets/cabecalho/ui` e
  `widgets/cabecalho-admin-barra/ui`, com o prefixo interno `/{slug}`.
- `packages/frontend/src/pages/equipamentos/ui/EquipamentosPage.native.test.tsx`
  (modo host, legado com resolvedor e sem resolvedor).

---

## 184. Sanitização universal carregava o DOMPurify também no native

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Média (fronteira de runtime)
**Status**: RESOLVIDO (onda 3, commit `be859915`) **Ambiente**:
`packages/frontend/src/shared/lib/sanitize*.ts`

#### Descrição

- `shared/lib/sanitize.ts`, arquivo universal, importava `isomorphic-dompurify`,
  que depende de DOM. O `pnpm arch` contava a violação `UNIVERSAL-WEB-LIB`, e o
  app native não tinha sanitização utilizável.

#### Causa raiz

- Implementação web colocada no arquivo universal, sem variante `.native`.

#### Solução

- Contrato em `sanitize-contract.ts` (`SanitizeHtml`, `SanitizeHtmlStrict`,
  `SanitizeConfig` e `isSafeJsonLd`, sem DOM).
- `sanitize.web.ts`: o DOMPurify de antes, sem mudança de comportamento.
- `sanitize.native.ts`: devolve só o texto visível. Remove elementos ocultos
  (`script`, `style`, `iframe`, `svg`, mesmo sem fechamento), comentários e
  todas as tags, repetindo até estabilizar (`<<b>script>` também sai), converte
  blocos e `<br>` em quebras de linha e decodifica entidades uma vez.
- `sanitize.ts` só reexporta a variante web, no padrão de `toast.ts`.
- Regra: o resultado native é texto puro para `<Text>`; nunca injetar como HTML
  (WebView).
- `UNIVERSAL-WEB-LIB` caiu de 70 para 69; a baseline só travou a redução.

#### Como validar

- `sanitize.web.test.ts` e `sanitize.native.test.ts` (XSS; o teste native falha
  se a variante carregar o DOMPurify; as duas variantes expõem a mesma API).
- `pnpm arch`.

---

## 183. Dev do host web: `next dev` sem `--hostname localhost` trava as reescritas do proxy

### Problema CONHECIDO (orientação de ambiente)

**Data da Ocorrência**: 2026-09-26 **Severidade**: Baixa (só desenvolvimento)
**Status**: CONTORNADO **Ambiente**: `apps/clients/web` em `next dev` com hosts
`*.localhost`

#### Descrição

- Com outro hostname, a reescrita do proxy do host web
  (`http://localhost:<porta>/…`) não é tratada como interna pelo Next: vira
  proxy externo e a requisição trava.
- Na captura da linha de base visual, imagem local servida pelo `next/image` no
  host de locadora respondeu 400; a causa não foi investigada.

#### Causa raiz

- O Next só trata o rewrite como interno quando o destino é a origem do próprio
  servidor.

#### Solução

- Subir o host web com `next dev --port <porta> --hostname localhost` (como em
  `tests/visual/playwright.visual.config.ts`).
- A linha de base visual usa imagem `data:` nas fixtures
  (`tests/visual/support/fixtures.mjs`), que o `next/image` não otimiza.

#### Como validar

- Abrir `http://<slug>.localhost:<porta>/` com o servidor iniciado com
  `--hostname localhost`: a vitrine responde sem travar.

---

## 182. Prorrogação de locação respondia 500 para regra de negócio

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Baixa (resposta errada; sem
tela consumidora) **Status**: RESOLVIDO (onda 3, commit `be859915`)
**Ambiente**: `app/api/admin/rentals/[id]/extend/route.ts`

#### Descrição

- Um `RentalMutationError` (estado que não permite prorrogar, locação
  inexistente) caía no tratamento genérico e respondia 500.

#### Causa raiz

- A rota não tratava o erro de domínio, ao contrário das rotas irmãs de check-in
  e check-out.

#### Solução

- Responde `{ error: <mensagem do domínio> }` com o status do domínio: 409
  "Locação não pode ser prorrogada neste estado" e 404 "Locação não encontrada".
  Nenhuma tela chama esse endpoint hoje.

#### Como validar

- `tests/unit/rentals-http.test.ts` (casos 409 e 404 da prorrogação).

---

## 181. IP da auditoria vinha do `X-Forwarded-For` enviado pelo cliente

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Média (trilha de auditoria
forjável) **Status**: RESOLVIDO (onda 3, commit `be859915`) **Ambiente**:
`lib/audit-logger.ts`

#### Descrição

- A auditoria gravava a primeira entrada do `X-Forwarded-For` (ou `x-real-ip`),
  que o cliente controla.

#### Causa raiz

- A regra de confiança de proxy da entrada 154 não era usada fora do rate limit.

#### Solução

- `ipAddress = clientIpFromHeaders(request.headers) ?? 'unknown'`: borda
  validada, `TRUSTED_PROXY_HOPS` ou `VERCEL=1`, como no rate limit.
- Limitação: `clientIpFromHeaders` agrupa IPv6 por /64 e, em produção sem fonte
  confiável, a auditoria grava `unknown`. Guardar o IPv6 completo exigiria uma
  variante sem agrupamento em `lib/rate-limit.ts` (decisão pendente).

#### Como validar

- `tests/unit/audit-logger.test.ts`: salto do proxy com `TRUSTED_PROXY_HOPS`
  (não o valor forjado), `x-real-ip` na Vercel, `unknown` em produção sem fonte
  confiável e valor que não é IP nunca gravado.

---

## 180. Identidade multi-host: cookie de sessão renomeado e links de e-mail fora do host

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Alta (recuperação de senha no
host novo) **Status**: RESOLVIDO (onda 3, commit `be859915`; as três pendências
na onda 4, commit `4b02f52f`) **Ambiente**: `AUTH_MODE=better-auth`,
`packages/backend/src/modules/identity`, `lib/identity.ts`, host web e app
mobile

#### Descrição

- O Lote 6 trocou o cookie de sessão do Better Auth para `cookiePrefix`
  `locadora`: `locadora.session_token` em http e `__Host-locadora.session_token`
  em https (secure, `path=/`, sem `Domain`). Sessões Better Auth existentes
  deixam de valer no deploy, e todos entram de novo.
- O link de redefinição passou a ser `<origem do host>/reset-password?token=` (a
  página do frontend), no lugar do `GET /api/auth/reset-password/:token` do
  Better Auth.
- Pendências da onda 3, resolvidas na onda 4:
  1. `app/api/auth/forgot-password/route.ts` e `register/route.ts` chamavam
     `auth.api.*({ headers })` sem `request`; o Better Auth entregava
     `request=undefined` aos callbacks de e-mail e o link caía na origem do
     `app.`. As duas rotas usavam `PLATFORM_NAME`.
  2. As páginas `reset-password` do host web (`(auth)` e
     `(public)/[locadora]/(auth)`) renderizavam `<ResetPasswordPage />` sem o
     `?token=`: o link abria "Link inválido".
  3. O `expoClient` do mobile (`apps/clients/mobile/src/host/auth/client.ts`)
     não usava `cookiePrefix: PLATFORM.name` e não guardava o cookie novo: o
     login better-auth no app quebrava.

#### Causa raiz

- Cookie e links passaram a depender do host de origem (ADR de hosts, seção
  Identidade); os pontos acima ficaram fora do escopo do Lote 6.

#### Solução

- Aplicada: `configuration.ts` e `factory.ts` (origem confiável exata por
  requisição, `oAuthProxy` com 60 s, estado no banco, `__Host-` sem
  `crossSubDomainCookies`); `handleIdentityRequest` reconstrói a requisição com
  a origem da borda; links de reset e verificação na origem do host.
- Onda 4: `forgot-password` e `register` (modo better-auth) passam `request` e
  `redirectTo` relativo (`/reset-password`); os assuntos saem por
  `identitySubject` (`lib/identity.ts`, `PLATFORM.displayName`), e
  `PLATFORM_NAME` não é mais lido. As duas páginas `reset-password` repassam o
  `?token=` (token repetido conta como ausente). O `expoClient` recebe
  `cookiePrefix: PLATFORM.name`.

#### Como validar

- `tests/identity/multi-host.integration.test.ts` (T9 e T10, links na origem do
  host), `tests/identity/engine.integration.test.ts` (nome do cookie e formato
  do link) e `tests/identity/auth-email-routes.integration.test.ts` (links e
  assuntos das duas rotas).
- `page.test.tsx` das duas páginas `reset-password` do host web e
  `apps/clients/mobile/src/host/auth/client.test.ts`.
- Manual: pedir a recuperação num host de locadora e abrir o link recebido; a
  página aceita o token.

---

## 179. CSS em camadas: armadilhas encontradas na remoção do `!important`

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Média (regressões visuais
evitadas pela linha de base) **Status**: RESOLVIDO (onda 3, commit `be859915`)
**Ambiente**: `packages/frontend/src/app/styles`, `packages/ui/src/web`

#### Descrição e solução

- **`@keyframes slideInUp` duplicado.** O `tailwind.config.cjs` (fora de camada)
  emitia um `slideInUp` que vencia o da camada base. Ao remover a classe morta
  `.animate-slide-in-up`, o Tailwind deixou de emitir o do config e a animação
  mudou. O keyframe da camada recebeu os valores efetivos.
- **`box-shadow` inline do `input-otp`.** A biblioteca grava `box-shadow: none`
  inline no campo; um ref em `InputOTP.web.tsx` remove só essa declaração.
- **Transição do botão de fechar do Sonner.** O CSS do Sonner fica fora de
  camada; `!transition-colors` virou regra no `<style>` do próprio
  `SonnerToaster.web.tsx`. Com movimento reduzido vale o `transition: none` do
  Sonner.
- **Anel de foco nos menus do Radix.** O foco movido por código casa
  `:focus-visible` mesmo com mouse. `MENU_FOCUS_RING` só mostra o anel com
  `data-input-modality="keyboard"` no `<html>`, gravado por `trackInputModality`
  (`packages/ui/src/web/focus-ring.ts`).
- **Borda global.** O `*{border-color}` virou
  `:where(*:not([data-own-border],[data-sonner-toast]))`; componente com cor de
  borda própria leva `data-own-border`. Na onda 4 a regra foi para a camada
  `legacy` (entrada 195), e as camadas `overrides` citadas nesta entrada e na
  177 deixaram de existir. Na onda 5 a regra voltou para `@layer base`, e o
  marcador `data-own-border` e a camada `legacy` saíram (entrada 195). O anel de
  foco por teclado passou ao token `--focus-ring` (laranja da marca), e o X do
  `Dialog` e do `Sheet` também usa `MENU_FOCUS_RING` (entrada 200).

#### Causa raiz

- CSS fora de `@layer` vence qualquer camada, inclusive as utilities do Tailwind
  4; bibliotecas gravam estilo inline.

#### Como validar

- `packages/ui/src/web/focus-ring.test.ts`, `SonnerToaster.web.test.tsx` e a
  comparação da linha de base visual (`node tools/visual-baseline/compare.mjs`),
  que só aceita as diferenças de `tests/visual/approved-changes.json`.

---

## 178. Trava de rolagem do Radix corrigida com 22 `!important` globais

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Média (rolagem e cliques
presos com menus abertos) **Status**: RESOLVIDO (onda 3, commit `be859915`)
**Ambiente**: `packages/ui/src/web`, `packages/frontend/src/app/styles`

#### Descrição

- Select, menus, popover e diálogos do Radix marcam o `body` com
  `data-scroll-locked`, trava de rolagem e `pointer-events: none`. A correção
  antiga eram 22 declarações `!important` num wrapper global.

#### Causa raiz

- A trava do Radix grava estilo no `body`; o CSS global só conseguia vencer com
  `!important`.
- No Select, o Radix passa o mesmo ref ao conteúdo fechado dentro de um
  `DocumentFragment` e nunca solta o ref.

#### Solução

- `useReleaseScrollLockRef` (`packages/ui/src/web/release-scroll-lock.ts`) em
  Select, DropdownMenu, ContextMenu, Popover, AlertDialog, Sheet e
  HybridTooltip: tira `data-scroll-locked` do `body`, devolve `pointer-events` e
  marca `data-scroll-released` (mantém o `overflow-x: hidden` da correção
  antiga). O registro também termina quando o elemento sai da página (caso do
  Select).
- As 22 declarações e o wrapper foram removidos.

#### Como validar

- `packages/ui/src/web/release-scroll-lock.test.tsx`.
- Abrir Select e menu no navegador: sem trava, sem deslocamento e com o `body`
  restaurado ao fechar.

---

## 177. Escalada de `!important`: regra `css-important` na catraca e linha de base visual

### Problema RESOLVIDO (regra permanente)

**Data da Ocorrência**: 2026-09-26 **Severidade**: Média (dívida de CSS)
**Status**: RESOLVIDO (onda 3, commit `be859915`, com 22 exceções; zerado na
onda 4, commit `4b02f52f`, entrada 194) **Ambiente**: `tools/token-check.mjs`,
`packages/frontend/src/app/styles`, `tests/visual`

#### Descrição

- CSS fora de `@layer` vence as utilities do Tailwind 4, e cada conflito foi
  resolvido com mais `!important`. A medição inicial foi de 415 ocorrências em
  29 arquivos (249 em `globals.web.css`, 38 em código e 128 modificadores do
  Tailwind).
- O usuário proibiu `!important` em CSS, no Tailwind e em estilo inline.

#### Causa raiz

- Estilos globais legados fora de camada disputando com as utilities e com o CSS
  de bibliotecas.

#### Solução

- Regra `css-important` na catraca do `pnpm tokens`: `!important` e
  `! important` em CSS, SCSS, Sass e Less; strings e templates de código
  (inline, CSS-in-JS, `<style>`, `setProperty(p, v, "important")`,
  `@import "tailwindcss" important`); modificador `!` do Tailwind como prefixo
  ou sufixo, com variantes, em `@apply` e em contexto de classe (`className`,
  `cn`/`clsx`/`cva`/`tv`/`twMerge`, `classList`...). Textos como "Sucesso!" não
  contam.
- Exceção única: dentro de `@media (prefers-reduced-motion: reduce)`.
  `token-check-allow` e entradas `allow` não isentam a regra. Na onda 4 a regra
  virou de tolerância zero (todo escopo, sem baseline) e nenhum arquivo usa mais
  a exceção; o `stylelint` reprova qualquer `!important` em `.css`.
- Adoção pela baseline com `--adopt-coverage` (entrada 160), depois reduzida de
  415 para 22 pelo lote "CSS limpo":
  - camadas `theme, base, components, utilities, overrides` com
    `overrides.normal` e `overrides.forced` (o que era `!important` foi para
    `overrides.forced`);
  - estilos globais levados para os componentes; `globals.web.css` virou entrada
    com 595 linhas e os arquivos `base`, `typography`, `layout`, `components`,
    `animations` e `vendor` (`*.web.css`);
  - trava de rolagem do Radix e anel de foco resolvidos na origem (entradas 178
    e 179).
- As 22 restantes no commit `be859915` (6 em `globals.web.css`, ligadas ao
  `ScrollRevealInit` e ao `scroll-behavior` inline do Next, e 16 no Shadow DOM
  do `Mapa.web.tsx`) foram removidas na onda 4 (entrada 194).
- Linha de base visual (`tests/visual`, `tools/visual-baseline`): estilo
  computado de cada elemento visível em 30 arquivos (6 rotas de vitrine, 8 de
  painel e `/catalog`, em 390 e 1440 px), 476 capturas; duas execuções seguidas
  sem diferença. Pré-requisito de qualquer refatoração de CSS.

#### Como validar

- `pnpm tokens` (linha `zero tolerance ... css-important 0`), `pnpm lint:css`,
  `pnpm test:gates` e `pnpm ratchet:guard`.
- Linha de base: ver `tests/visual/README.md` (`pnpm visual:capture`, depois
  `pnpm visual:compare`). `pnpm test:visual-tools` passa 10 de 10 (o caso que
  exigia `approved-changes.json` vazio foi ajustado antes do commit `be859915`).

---

## 176. Limitador de autenticação contava por instância

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Média (limites contornáveis
com várias instâncias) **Status**: RESOLVIDO (onda 3, commit `be859915`, Lote
7a) **Ambiente**: `lib/rate-limit.ts`, `packages/backend/src/modules/directory`,
`prisma/schema.prisma`

#### Descrição

- Os limitadores de login, cadastro, recuperação e aviso ao titular
  (entrada 154) viviam em memória: cada instância da Vercel contava separado, e
  a chave HMAC usava um segredo aleatório por processo.
- A busca pública do diretório precisava de limite que valesse entre instâncias.

#### Causa raiz

- Armazenamento em memória por processo.

#### Solução

- Migration `202609260006_platform_directory_rate_limit`: modelo global
  `PlatformRateLimit` (`platform_rate_limits`) e `Organization.directoryListed`
  (padrão `false`).
- Porta `RateLimitCounter` e adaptador `prismaRateLimitCounter`: um único
  `INSERT ... ON CONFLICT DO UPDATE`, atômico entre instâncias. Janelas fixas
  alinhadas ao relógio; chave `<rota>:<hmac>:<janela>` com HMAC-SHA256 de
  `PLATFORM_RATE_LIMIT_SECRET` (32 caracteres ou mais).
- `consumeAuthAttempt`, `clearAuthAccountAttempts`, `resetAuthAccountAttempts` e
  `consumeAccountNotice` gravam em `platform_rate_limits` (agora são `async`).
  Falha do armazenamento: o consumo rejeita; a limpeza é best-effort; o aviso ao
  titular não sai.
- `clientIpFromHeaders` prefere o `edge.clientIp` da borda validada (na onda 4,
  com borda validada, nunca cai em outro cabeçalho; entrada 191).
- Limpeza das janelas vencidas no cron de outbox (folga de 60 s;
  `rateLimitsPurged` na resposta).
- Sem o segredo em produção, cada processo usava chave aleatória (janela por
  instância). Desde a onda 4 isso é erro: `platformRateLimitSecret` lança
  `PlatformEnvError` antes de contar (entrada 191). Na virada da janela fixa, um
  cliente pode fazer até o dobro do limite.

#### Como validar

- `tests/security/auth-rate-limit.test.ts` (inclui 40 tentativas concorrentes em
  duas instâncias com exatamente 3 permitidas) e
  `tests/security/directory.test.ts` (429 persistente entre instâncias), com
  banco descartável.

---

## 175. Mensagens de erro de orçamento com UTF-8 lido como cp850

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Baixa (texto corrompido em
respostas de erro) **Status**: RESOLVIDO (onda 3, commit `be859915`)
**Ambiente**: `packages/backend/src/modules/quotations/update.ts`,
`app/api/admin/quotes/[id]/route.ts`

#### Descrição

- Três mensagens de erro e nove comentários tinham sequências como `├º` (ç) e
  `├ú` (ã). Os testes de caracterização usavam regex permissivas para aceitar o
  texto corrompido.

#### Causa raiz

- Bytes UTF-8 decodificados como cp850. O texto já estava assim na rota
  `app/api/admin/quotes/[id]/route.ts` do commit base `eb4c0098` e foi levado
  para o módulo na extração da onda 2.

#### Solução

- Texto decodificado para o português correto; `tests/unit/quotes-http.test.ts`
  compara as strings exatas.
- Detecção: `rg -n "├[^─]" app lib packages` (o `├──` de árvores de pastas é
  legítimo). Em 2026-09-26 não há ocorrências em código.

#### Como validar

- `tests/unit/quotes-http.test.ts` e o `rg` acima.

---

## 174. Valor da cobrança comparado em `number` na emissão e no cancelamento

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Média (regra de dinheiro)
**Status**: RESOLVIDO (onda 3, commit `be859915`, lote S4) **Ambiente**:
`packages/backend/src/modules/billing/{issue-payment,cancel-attempt}.ts`

#### Descrição

- A reconciliação comparava o `value` do Asaas com o valor da tentativa por
  `!==`. Só funcionava com dois `number` idênticos; um valor em `Decimal` nunca
  seria igual e forçaria reconciliação, e o resultado dependia de ponto
  flutuante.

#### Causa raiz

- Valor da cobrança tratado como `number`, contra a regra de dinheiro em
  `Decimal`.

#### Solução

- `asaas-amount.ts`: `toMoney`, `toAsaasAmount` (recusa mais de 2 casas, valor
  negativo e perda de precisão), `fromAsaasAmount` e `sameAmount`, em
  `Prisma.Decimal`.
- `issue-payment` e `cancel-attempt` usam `sameAmount`; `number` continua aceito
  na entrada só por compatibilidade com `lib/`.
- `issuePayment` valida valor, vencimento e CPF/CNPJ antes da reserva: pedido
  inválido fica `QUEUED` em vez de virar `UNKNOWN`.

#### Como validar

- `tests/contract/asaas-fake.test.ts` e as suítes de billing de
  `pnpm test:unit`. A suíte de contrato ainda não está em nenhuma config do
  vitest (ver `docs/features/modernization-billing.md`).

---

## 173. Adapter do Asaas removia as letras do CNPJ alfanumérico

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Alta (cliente errado ou
cadastro recusado para CNPJ alfanumérico) **Status**: RESOLVIDO (onda 3, commit
`be859915`, lotes S1 e S4) **Ambiente**:
`packages/backend/src/modules/billing/asaas.ts`, `packages/domain/src/documento`

#### Descrição

- A busca e o cadastro de cliente no Asaas normalizavam o documento com
  `replace(/\D/g, '')`, que apaga as letras do CNPJ alfanumérico.

#### Causa raiz

- Normalização pensada só para CPF/CNPJ numérico.

#### Solução

- `normalizeAsaasDocument` tira só a máscara e passa as letras para maiúsculas;
  busca e cadastro preservam o CNPJ alfanumérico.
- `packages/domain/src/documento` (S1) valida CPF e CNPJ numérico e alfanumérico
  (valor = código ASCII − 48, pesos oficiais) e `orcamento/documento.ts` delega
  a ele. `validateCPF` e `validateCNPJ` ficaram mais estritos: caractere fora da
  máscara invalida o documento (`'529.982.247-25x'` era válido e agora não é).
- O aceite do CNPJ alfanumérico pelo Asaas ainda precisa ser confirmado no
  sandbox (risco R-9 da ADR SaaS, lote S15).

#### Como validar

- `tests/contract/asaas-fake.test.ts` ("o gateway busca e cadastra o cliente com
  o CNPJ alfanumérico sem remover letras").
- `packages/domain/src/documento/cnpj.test.ts` (vetor oficial `12ABC34501DE35`).

---

## 172. Curingas do `ILIKE` fora do login: categorias, CLI de manutenção e credencial do Better Auth

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Alta (credencial sincronizada
na conta errada) **Status**: RESOLVIDO (onda 3, commit `be859915`) **Ambiente**:
`packages/backend/src/modules/identity/legacy-credentials.ts`,
`packages/backend/src/modules/catalog/categories.ts`,
`scripts/security/maintenance.mjs`

#### Descrição

- Mesma causa da entrada 154, em outros três pontos:
  - `synchronizeLegacyCredential` achava a conta por `ILIKE` com `findFirst`:
    `_` e `%` no e-mail podiam casar outra conta;
  - a checagem de categoria duplicada tratava `Andaime%` ou
    `R_lo compactador curinga` como duplicatas de outros nomes (409);
  - `provision-admin` recusava `maint-a_b-…` por casar com `maint-axb-…`.

#### Causa raiz

- `{ equals, mode: 'insensitive' }` do Prisma vira `ILIKE` sem escape.

#### Solução

- Credencial: `findUnique` pelo e-mail normalizado (igualdade exata).
- Categorias: SQL parametrizado `lower(name) = lower($n) OR slug = $m`.
- CLI: `lower(btrim(email)) = $email`.
- Regra: nunca usar `mode: 'insensitive'` em comparação de identidade ou de
  unicidade; normalizar e comparar por igualdade.

#### Como validar

- `tests/identity/legacy-credentials.integration.test.ts`,
  `tests/unit/catalog-tenancy.test.ts` (banco),
  `tests/unit/catalog-http.test.ts` (SQL sem `ILIKE`) e
  `tests/security/maintenance-cli.test.ts` (`provision-admin --apply` real no
  banco descartável).

---

## 171. Incidente de ambiente: junção NTFS + `rmdir /s` esvaziou pacotes de `node_modules/.pnpm`

### Incidente RESOLVIDO (orientação obrigatória para agentes)

**Data da Ocorrência**: 2026-09-26 **Severidade**: Crítica (ambiente de todos os
agentes) **Status**: RESOLVIDO no ambiente; regra permanente **Ambiente**:
Windows, checkout compartilhado por vários agentes

#### Descrição

- Um agente de revisão extraiu um snapshot do repositório para o scratchpad e
  criou junções NTFS (`New-Item -ItemType Junction`) de `node_modules` da cópia
  para os `node_modules` reais do repositório. Na limpeza, rodou
  `cmd /c rmdir /s /q <pasta da cópia>`.
- O `rmdir /s` atravessou as junções e esvaziou diretórios reais do store: cerca
  de 230 dos 3016 pacotes de `node_modules/.pnpm` ficaram sem arquivos (entre
  eles `react`, `@testing-library/*`, `@types/react` e binários win32 do
  rollup/rolldown). Nenhum código-fonte foi afetado.
- Efeito: `require.resolve('react')` falhava na raiz e builds, typechecks e
  testes de qualquer agente passaram a falhar por motivo de ambiente.

#### Causa raiz

- No Windows, `rmdir /s` e ferramentas equivalentes seguem junções e apagam o
  conteúdo do alvo, não só o link.

#### Solução

- Reinstalação dos pacotes a partir do store do pnpm
  (`node_modules/.modules.yaml` regravado às 01:57 do mesmo dia);
  `require.resolve('react')` volta a resolver.
- Regras para agentes neste repositório:
  - Nunca criar junção NTFS ou symlink apontando para dentro do repositório
    (incluindo `node_modules`).
  - Nunca rodar `rm -rf`, `rmdir /s`, `Remove-Item -Recurse` ou equivalente em
    pasta que possa conter links.
  - Cópias de trabalho ficam no scratchpad da sessão, sem `node_modules`
    ligados; para rodar ferramentas sobre um commit, extrair só o que for lido
    (como faz o `tools/ratchet-guard.mjs` com `git ls-tree` + `git cat-file`).
  - A junção documentada de `apps/clients/web/public` (`pnpm link:web-public`) é
    a única exceção existente e nunca deve ser apagada recursivamente.
- **Atualização (2026-09-30)**: a exceção acima acabou. Na onda 9b (achado 130)
  a junção e `tools/link-web-public.mjs` (`pnpm link:web-public`) saíram, e
  `apps/clients/web/public` virou uma cópia real, fora do git, gerada por
  `tools/sync-web-public.mjs` no predev/prebuild do host web (recusa link, nunca
  apaga de forma recursiva; `apps/clients/web/AGENTS.md`). Não há mais junção ou
  symlink no repositório. O `scripts/clean-install-windows.ps1`, que rodava
  `taskkill /f /im node.exe` e `Remove-Item -Recurse` no `node_modules`, também
  saiu (achado 133), e `tests/unit/destructive-commands.test.ts` (no
  `pnpm test:gates`) reprova esses comandos em `scripts/`, `tools/`, `.husky/` e
  nos scripts dos `package.json` (entrada 229).

#### Como validar

1. `node -e "console.log(require.resolve('react'))"` na raiz resolve para
   `node_modules/.pnpm/react@*/node_modules/react/index.js`.
2. Nenhum diretório `node_modules/.pnpm/*/node_modules/<pacote>` vazio.

---

## 170. Tailwind v4: `fontSize` em tupla do `tailwind.config.cjs` vira `color`

### Problema RESOLVIDO (onda 8, entrada 219; aguarda aval do dono)

**Data da Ocorrência**: 2026-09-26 **Severidade**: Média (tamanho de texto sem
efeito) **Status**: RESOLVIDO na onda 8 (lote fech-css, achado 118: o spread
`...designTokens` saiu do `tailwind.config.cjs` e `text-base`/`text-small`
voltaram a ser tamanho fluido, como na produção; entrada 219) **Ambiente**:
`tailwind.config.cjs` com Tailwind 4.3.3

#### Descrição

- As entradas `fontSize` em tupla do `tailwind.config.cjs` (`h1`, `h2`, `h3`,
  `base` e `small`, no formato `['clamp(...)', { lineHeight }]`) saem do
  Tailwind 4.3.3 como `color: clamp(...)`, não como `font-size`.
- No CSS da build aparece, por exemplo,
  `.text-base{color:clamp(1rem, 2vw, 1.125rem)}`, e o mesmo em `.text-h1`,
  `.text-h2`, `.text-h3` e `.text-small`.
- Na prática essas classes não mudam o tamanho: herdam o 1rem do `body`, e a
  declaração de cor é inválida e ignorada.

#### Causa raiz

- Medido no CSS da build com o `tailwind.config.cjs` carregado via `@config`; o
  mecanismo interno do Tailwind que produz `color` não foi investigado.
- Achado da onda 5 (lotes A1 e A2): o `...designTokens` em `theme.extend.colors`
  do `tailwind.config.cjs` (lido de `design-tokens/output/tokens-tailwind.json`)
  registra `base` e `small` como **cores** com valor `clamp()`. Por isso
  `text-base` e `text-small` geram só `color: clamp(...)`, inválido, e nenhum
  tamanho. Na produção (`main`, Tailwind 3), `text-base` era fluido com
  `line-height` 1.6. Quase todo o resto desse spread é morto (provado), mas
  tirá-lo devolve o tamanho da produção a todo `text-base` e muda a linha de
  base; `fontSize.base`/`small` do config só estão mortos por causa disso.
  Decisão do usuário: restaurar a produção (remover o spread) ou manter.

#### Solução

- Nenhuma aplicada. Corrigir muda o tamanho de texto renderizado onde essas
  classes são usadas, o que altera a identidade visual e exige aprovação
  explícita.
- Os primitivos de `packages/design-tokens` registram os clamps
  (`typography.fluid.*`) com o valor pretendido, não com o renderizado.
- Onda 8 (decisão aplicada por padrão: o tamanho da produção): o spread saiu, e
  `text-base`, `text-small` e `text-h1`–`h3` compilam como `font-size` com a
  altura de linha de `typography.fluid` (`index.styles-build.test.ts`). O
  primeiro item acima descreve o estado anterior (entrada 219).

#### Como validar

1. `pnpm build:web` e procurar `.text-base{` no CSS gerado em `.next/static`.
2. Depois de uma correção aprovada, a regra deve conter `font-size`.

---

## 169. `orange-600` com dois valores: OKLCH do Tailwind v4 e hex `#ea580c`

### Problema RESOLVIDO (onda 8, entrada 219; aguarda aval do dono)

**Data da Ocorrência**: 2026-09-26 **Severidade**: Média (mesma cor nomeada com
dois valores na mesma tela) **Status**: RESOLVIDO na onda 8 (lote fech-css,
achado 117: paleta do Tailwind 3.4.17 em hex no `@theme`,
`packages/design-tokens/src/palette.css`, com `primitives.tailwind` como fonte
única; entrada 219) **Ambiente**: classes de paleta do Tailwind 4.3.3,
`design-tokens/legacy.css`, `design-tokens/base.json`, `packages/design-tokens`

#### Descrição

- As classes de paleta (`bg-orange-600`, `bg-slate-700`, `border-gray-200`...)
  renderizam os valores do Tailwind v4 em OKLCH. `orange-600` v4 é
  `oklch(64.6% 0.222 41.116)`, com fallback sRGB da build `#f05100`.
- `legacy.css`, `base.json` e a fachada `tokens.ts` usam o hex v3 `#ea580c` (a
  cor primária citada no `AGENTS.md`).
- O botão padrão (`bg-slate-700`) renderiza por volta de `#314158`, e não
  `#334155`.
- O React Native não renderiza `oklch()`; as duas formas de obter sRGB (fallback
  do lightningcss ou recorte de gamut) divergem em 40 dos 103 tons medidos.

#### Causa raiz

- O Tailwind v4 trocou a paleta padrão para OKLCH; os tokens do projeto
  continuaram com os hex da paleta v3.

#### Solução

- Nenhuma escolha aplicada. `packages/design-tokens/src/primitives.ts` guarda os
  dois: hex v3 nos primitivos e `primitives.tailwind` com o OKLCH v4 dos tons
  usados pelo código web.
- Decisão pendente: fixar a paleta v3 no tema do Tailwind ou migrar os hex para
  v4. Qualquer das duas muda o visual de uma parte do web.
- Tom de paleta novo no código web sem primitivo quebra
  `packages/design-tokens/src/primitives.test.ts` de propósito; a correção é
  acrescentar o OKLCH de `node_modules/tailwindcss/theme.css` em
  `primitives.tailwind`.
- Onda 8 (decisão aplicada por padrão: a paleta da produção): o tema do Tailwind
  usa a paleta v3 em hex (`palette.css`), `primitives.tailwind` guarda os
  valores do Tailwind 3.4.17 (22 famílias × 11 tons, com impressão digital
  sha256) e os tons homônimos de `color` apontam para ele. Os dois parágrafos
  acima descrevem o estado anterior (entrada 219).

#### Como validar

- `pnpm exec vitest run --config vitest.platform.config.ts packages/design-tokens`.

---

## 168. Tipo `ViewStyle` do Expo quebra o typecheck do mobile em `packages/ui` native

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Média (typecheck do mobile
vermelho) **Status**: RESOLVIDO (commit `0cff7b65`) **Ambiente**:
`packages/ui/src/native/overlay.native.tsx`, `apps/clients/mobile/tsconfig.json`

#### Descrição

- `pnpm exec tsc -p apps/clients/mobile/tsconfig.json --noEmit` falhava com
  TS2322 em `overlay.native.tsx`, enquanto `packages/ui/tsconfig.native.json` e
  `packages/frontend/tsconfig.native.json` passavam.

#### Causa raiz

- Só no programa do app mobile entra `expo/types/react-native-web.d.ts`, que
  redeclara `interface ViewStyle` dentro do módulo `react-native` (aceita
  `position: 'fixed' | 'sticky'` e não tem `top`). O `ViewStyle` importado deixa
  de bater com o tipo real de `style` do `View` do RN 0.86.

#### Solução

- Em `packages/ui/src/native`, derivar o tipo de estilo das props reais do
  componente em vez de importar `ViewStyle`/`StyleProp`:
  `type OverlayStyle = ComponentProps<typeof View>["style"]`.
- A mesma armadilha vale para `TextStyle` e `ViewProps`. O comportamento não
  mudou (`position: "absolute"` com `top` e `left`).

#### Como validar

- `pnpm exec tsc -p apps/clients/mobile/tsconfig.json --noEmit` (o erro só
  aparece no programa do mobile, não no tsconfig do pacote).

---

## 167. Carrossel 3D: `pageerror` `removeChild` no Chromium headless com SwiftShader

### Problema CONHECIDO (a investigar)

**Data da Ocorrência**: 2026-09-26 **Severidade original**: Baixa (observado
inicialmente só em GPU emulada) **Status**: ABERTO **Ambiente original**: host
web de locadora em `next start`, Chromium headless com `--use-gl=swiftshader`

#### Descrição

- Na verificação do Lote 4b, a página inicial do host de locadora registrou um
  `pageerror` de `removeChild` com o carrossel 3D, rodando com GPU emulada. O
  evento `scrollRevealReady` disparou normalmente.
- Na ocorrência original, não houve teste com GPU real. O teste visual do
  primeiro modelo sem zoom (`docs/features/equipment-3d-carousel.md`, Teste 1)
  ficou pendente; a atualização abaixo registra a prova local normal posterior.

#### Causa raiz no registro original

- Não investigada.

#### Atualização da onda 135 (2026-10-08, sem commit)

O erro também foi observado em Chrome com GPU real; a limitação a SwiftShader
descreve somente a ocorrência original. Ver diagnóstico e correção do loader na
entrada 334. Após a mudança, a captura local normal em GPU real passou sem erro
de página/probe, com primeiro Compressor sem fit sustentado e Betoneira como
controle positivo, incluindo revisão de quadros decodificados. Slow 3G terminou
sem erro de página/perda de contexto ativo, mas sem desenhar a Betoneira em
150s; controle positivo ausente mantém A10 parcial. O resultado normal valida a
correção naquele escopo local, sem fechamento universal desta entrada, sem
homologar CDN/HDR e sem aprovar baseline visual.

#### Como validar

1. Rodar o host web e abrir `http://<slug>.localhost:<porta>/` em navegador
   real, aba anônima, com Slow 3G.
2. Conferir o console e o Teste 1 do carrossel.

---

## 166. Soft 404 (status 200) no host web por `Suspense` ou portão acima da página

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Média (SEO e segurança de
roteamento) **Status**: RESOLVIDO (onda 2, commit `da19f601`) **Ambiente**:
`apps/clients/web/src/app`, `apps/clients/web/src/proxy.ts`

#### Descrição

- Um `notFound()` chamado num layout do host web podia sair com status 200 (o
  conteúdo de 404 aparecia, mas o status não).
- Em `AUTH_MODE=legacy`, `/area-cliente` no host de locadora saía 200 mesmo com
  o layout `(account)` chamando `notFound()`.

#### Causa raiz

- Com `Suspense` acima da página, a resposta começa a ser transmitida antes do
  `notFound()`, e o status 200 já saiu.
- O `PrivateAreaGate` não renderiza os filhos no SSR; o `notFound()` do layout
  da área privada ficava soft.

#### Solução

- Layout raiz do host web só com documento, fontes e CSS, sem providers e sem
  `Suspense`; a árvore `[locadora]` também não tem `Suspense` acima da página.
- Em `AUTH_MODE=legacy`, o proxy responde 404 para `TENANT_ACCOUNT_PATHS` (login
  e área do cliente) antes de chegar ao layout.

#### Como validar

- `tests/e2e/tenant-hosts.spec.ts` (requer `TENANT_HOSTS_E2E=1`) e
  `apps/clients/web/src/host/routing/decide.test.ts`.
- Com o host em `next start`: `curl -I` em `/area-cliente` e em
  `/equipamentos/<id de outra locadora>` no host `<slug>.localhost` deve
  dar 404.

---

## 165. `build:web` falhava: Turbopack usava o `proxy.ts` da raiz

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Alta (build do host web)
**Status**: RESOLVIDO (onda 2, commit `da19f601`) **Ambiente**:
`apps/clients/web`

#### Descrição

- `pnpm build:web` falhava com module-not-found em `./proxy.ts` enquanto o host
  web não tinha o próprio proxy; o checkpoint `0cff7b65` registrou o build como
  pendente por isso.

#### Solução

- `apps/clients/web/src/proxy.ts` (Lote 4b) passou a existir; o Turbopack usa o
  proxy do host em vez do da raiz.

#### Como validar

- `pnpm build:web` com exit 0. Não rodar em paralelo com outro build que use
  `apps/clients/web/.next`.

---

## 164. XSS no JSON-LD: `JSON.stringify` dentro de `dangerouslySetInnerHTML`

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Alta (V22) **Status**:
RESOLVIDO (onda 2, commit `da19f601`) **Ambiente**:
`packages/frontend/src/widgets/{dados-estruturados,seo-schemas}`,
`packages/frontend/src/pages/equipamento-detalhe`

#### Descrição

- Um nome de equipamento ou de locadora com `</script><script>...` fechava o
  bloco `application/ld+json` e injetava script na página; `<!--<script>` podia
  engolir o resto do HTML.

#### Causa raiz

- `JSON.stringify` não escapa `</script>` nem `<!--`. Comentários antigos
  afirmavam que ele era seguro contra XSS.

#### Solução

- `serializeJsonLd`
  (`packages/frontend/src/shared/lib/seo/serialize-json-ld.ts`) troca `<`, `>`,
  `&`, U+2028 e U+2029 pelo escape Unicode do próprio JSON; o `JSON.parse`
  devolve os mesmos dados. Aplicado em `StructuredData.tsx`, `SEOSchemas.tsx` e
  `EquipamentoTrilha.web.tsx`.
- Regra: todo JSON-LD novo usa `serializeJsonLd`, nunca `JSON.stringify` direto.
  Ver `docs/features/structured-data-json-ld.md`.

#### Como validar

- `pnpm exec vitest run --config vitest.platform.config.ts packages/frontend/src/shared/lib/seo packages/frontend/src/widgets/dados-estruturados packages/frontend/src/widgets/seo-schemas packages/frontend/src/pages/equipamento-detalhe`.

---

## 163. "Solicitar Orçamento" mandava usuário logado para `/login` durante `loading`

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Baixa **Status**: RESOLVIDO
(onda 2, commit `da19f601`) **Ambiente**:
`packages/frontend/src/pages/equipamento-detalhe/ui/EquipamentoOrcamento.web.tsx`

#### Descrição

- Com as rotas públicas liberadas enquanto a sessão está em `loading` (correção
  de SSR da onda 1), um usuário autenticado que clicava em "Solicitar Orçamento"
  antes do `getSession` resolver era mandado para `/login` (frontend-runtime#3).
- O teste de `awaitSession` dizia provar a espera do escopo do carrinho, mas
  passava sem ela (frontend-runtime#4).

#### Solução

- O clique durante `loading` fica pendente, com `aria-busy`, até a sessão
  resolver: autenticado segue para `/orcamento`, visitante para `/login`. Sem
  mudança visual.
- O teste deixa a leitura do escopo do carrinho pendente depois do `getSession`
  e prova que a rota não monta e que o item adicionado ao montar persiste em
  `cart:["locadora-a","anonymous"]`.

#### Como validar

- `EquipamentoOrcamento.web.test.tsx` e
  `packages/frontend/src/app/providers/RuntimeBootstrap.test.tsx`
  (`pnpm test:platform`).

---

## 162. Redirecionamento aberto no `callbackUrl` do login

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Média (frontend-runtime#2)
**Status**: RESOLVIDO (onda 2, commit `da19f601`) **Ambiente**:
`packages/frontend/src/features/entrar/model/redirect.ts`

#### Descrição

- `callbackUrl=%2F%5Cevil.test` virava `/\evil.test`, que passava na checagem
  "começa com `/` e não com `//`". O navegador resolve esse caminho para outro
  domínio. O mesmo acontecia com TAB (`/\t/evil.test`).

#### Solução

- `safeInternalCallback` exige uma única `/` inicial; recusa `//`, `/\`,
  qualquer barra invertida, controles C0/DEL, esquemas e codificação malformada
  (captura `URIError`) e confere a mesma origem com `new URL`.
- Onda 4 (achado 22 da revisão da onda 3): segmentos de ponto ainda escapavam,
  porque `new URL('/.//evil.test', base).pathname` é `//evil.test` e seguir esse
  caminho leva a outro domínio (o mesmo com `/..//`, `/a/..//` e `/%2e%2e//`).
  Agora também recusa `%2e`, `%2f` e `%5c` que sobram depois da decodificação
  (inclusive dupla, `%252e`), normaliza com `new URL` e recusa se a origem mudar
  ou se o caminho normalizado começar com `//` ou `/\`. O valor devolvido
  continua o decodificado.

#### Como validar

- Tabela de `packages/frontend/src/features/entrar/model/redirect.test.ts` (32
  recusas e 8 aceites, inclusive ponto no nome do segmento e `%2F` na query).

---

## 161. Portão da área privada desmontava o `<Stack/>` do Expo Router

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Alta (frontend-runtime#1)
**Status**: RESOLVIDO (onda 2, commit `da19f601`) **Ambiente**:
`packages/frontend/src/app/providers/RuntimeBootstrap.tsx`,
`apps/clients/mobile/src/app/_layout.tsx`

#### Descrição

- No mobile, `children` do `AppProviders` é o próprio `<Stack/>`. O
  `RuntimeBootstrap` trocava `children` por "Carregando...", pelo aviso de login
  ou pelo seletor de locadora na área privada. O navegador era desmontado: a
  rota privada se perdia e o botão "Entrar" ficava sem efeito.

#### Causa raiz

- Portão aplicado acima do navegador, trocando a árvore em vez de envolver cada
  tela.

#### Solução

- O `RuntimeBootstrap` não troca mais os filhos; o estado do portão vai por
  contexto. `PrivateAreaGate` (exportado por `@gb-locacoes/frontend/app`) aplica
  o portão dentro da área: no web, envolve o conteúdo da rota dentro do
  `ClientLayoutShell`; no mobile, `<Stack screenLayout={gatedScreen}>` decide
  por tela.
- Regra: nunca trocar ou reposicionar `children` do provider raiz no native.

#### Como validar

- `apps/clients/mobile/src/app/_layout.test.tsx` (onda 4, achado 23 da revisão
  da onda 3): monta o `_layout.tsx` real com o core de navegação e o
  `StackRouter` do expo-router, telas da árvore real de `src/app`. Substitui
  `RuntimeBootstrap.gate-navigation.test.tsx`, que copiava a lógica do host e
  importava `apps/clients/mobile/node_modules` a partir de `packages/frontend`
  (apagado). O `metro.config.js` bloqueia testes em `src/app` para que o
  expo-router não os trate como tela (`routes.test.ts` aplica a `blockList`
  real).
- A exceção da tela mobile que continua montada na pilha vale só no native; no
  web, ver a entrada 193.

---

## 160. Catracas de arquitetura e tokens: burla pelo JSON, ponto cego da raiz legada e como transferir dívida

### Problema RESOLVIDO (com procedimento permanente)

**Data da Ocorrência**: 2026-09-26 **Severidade**: Média (gates-tokens#0–#5)
**Status**: RESOLVIDO (onda 2, commit `da19f601`) **Ambiente**:
`tools/arch-check.mjs`, `tools/arch-runtime.mjs`, `tools/token-check.mjs`,
`tools/ratchet-guard.mjs`, `.github/workflows/ci.yml`

#### Descrição

- As catracas (`tools/arch-baseline.json` e `tools/token-baseline.json`)
  comparavam a árvore com a baseline da própria árvore: editar a contagem, ou
  apagar o arquivo e rodar `--init-baseline`, aumentava a dívida com CI verde.
- A raiz legada (`app/`, `lib/`...) era ponto cego: mover dívida de
  `packages/frontend` para `app/` contava como redução.
- O token-check não reconhecia formas de cor do Tailwind 4.3.3 (`/7.5`,
  `/(--var)`, `drop-shadow-*`, `inset-shadow-*`, `inset-ring-*`,
  `text-shadow-*`...); as listas web-only omitiam libs já usadas (vaul,
  `@dnd-kit/*`, three...); `hslTripleToHex('-120 100% 50%')` devolvia `#ff00ff`.
- `pnpm check:tokens` saía 1 por construção (níveis não executados entravam no
  veredito).

#### Solução

- `tools/ratchet-guard.mjs` (`pnpm ratchet:guard`, ligado no CI com
  `fetch-depth: 0`) lê as baselines no merge-base (`--base`, `RATCHET_BASE_REF`,
  `origin/main` ou `HEAD~1`) e reprova contagem que sobe, par arquivo/regra
  novo, baseline ou regra que some e baseline inválida.
- Raiz legada com regras próprias (`LEGACY-DEEP-IMPORT`, `LEGACY-DOM-JSX`,
  `LEGACY-WEB-LIB`) e `legacyScope` no token-check.
- `check:tokens` sai 0 quando o estado medido bate com
  `tools/token-propagation-expectations.json` e falha em regressão ou em nível
  que passou a ser provado sem sair da lista.

#### Como transferir dívida (mover ou renomear arquivo)

1. Depois de mover o arquivo, `pnpm arch` ou `pnpm tokens` mostram
   `RATCHET new file <novo>` e o caminho antigo "below baseline".
2. Registrar a transferência:
   `node tools/ratchet-guard.mjs --rename <caminho antigo> <caminho novo> --reason "<motivo com 8+ caracteres>"`.
   A origem precisa ter saído do disco e existir na baseline da base; a entrada
   é movida em todas as baselines que a têm e a transferência fica em
   `tools/ratchet-transfers.json`. O total nunca aumenta.
3. Rodar `pnpm arch`, `pnpm tokens` e `pnpm ratchet:guard`.
4. Regra nova ou padrão mais amplo:
   `node tools/ratchet-guard.mjs --adopt-coverage` grava só a dívida que as
   ferramentas atuais medem no código da base.
5. Nunca editar as baselines à mão nem apagar e recriar com `--init-baseline`;
   `--update-baseline` só serve para travar reduções.

#### Transferências registradas

- As três páginas de auth movidas para
  `apps/clients/web/src/app/(public)/[locadora]/(auth)/{cadastro,entrar,login}/page.tsx`
  tiveram a transferência registrada em `tools/ratchet-transfers.json` antes do
  commit `da19f601` (5 classes de paleta por página); `pnpm tokens` voltou a
  sair 0.
- A regra `css-important` (onda 3) entrou pelo passo 4 acima; ver a entrada 177.

#### Como validar

- `pnpm test:gates` (81 testes em 2026-09-26, com o teste do
  `check:test-names`), `pnpm arch`, `pnpm tokens`, `pnpm check:tokens` e
  `pnpm ratchet:guard`.

---

## 159. Guarda de autenticação por rota aceitava helper sem efeito

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Média (public-surface#0, #1,
#3) **Status**: RESOLVIDO (onda 2, commit `da19f601`) **Ambiente**:
`tests/security/route-auth-inventory.test.ts`

#### Descrição

- Qualquer leitura de `.role` satisfazia a checagem de papel em `/api/admin`:
  remover `if (context.role !== 'ADMIN')` de `PUT /api/admin/permissions` não
  derrubava o teste.
- O analisador era insensível ao fluxo: helper chamado só num ramo, dentro de
  closure nunca invocada, via `void` ou com resultado nunca verificado era
  aceito.
- Métodos exportados por desestruturação ou `export *` não entravam no
  inventário.

#### Solução

- Análise por caminho: o resultado do helper precisa ser retornado ou testado
  com saída antes de qualquer acesso a dados; só as chamadas de `PRE_AUTH` podem
  vir antes. Em `/api/admin`, o papel do principal precisa ser comparado com a
  allowlist de papéis de equipe (`ADMIN`, `FINANCIAL`, `OPERATOR`, sincronizada
  com o enum `Role`). Formas de export incomuns não resolvíveis falham de
  propósito. Padrões aceitos em `docs/features/admin-permissions-and-roles.md`.

#### Como validar

- `pnpm test:security`. Remover `if (!tenant.ok) return tenant.response` de
  qualquer rota pública nova faz o teste falhar.

#### Extração de `/current`: contexto não é autorização (2026-10-01, sem commit)

Um teste adversarial durante o corte 11 expôs uma lacuna estrutural: contar a
resolução pública como autorização aceitava remover a sessão de `/current`. A
rota real continuava exigindo identidade; o problema era a prova estática. Não
foi ampliada a lista pública para instalar a rota no serviço.

`resolveCurrentOrganizationTenant` é preparação PROLOGUE apenas nos dois
adapters exatos de `/current`, com argumento Request e recusa `.ok` imediata. A
análise continua até o guard de identidade. A entrada legada de `/current` saiu
de `PUBLIC_TENANT_SURFACE`; contexto sozinho nunca autoriza o vínculo. As
fachadas precisam delegar sem efeito adicional e retornar
`Promise<PublicRequestTenant>`. O transporte privado é conferido pela gramática
INERT existente. Nenhuma proteção ou baseline foi afrouxada.

Arquivos: `tests/security/route-auth-inventory.test.ts`, fachadas
`lib/tenant.ts` e `apps/services/api/src/host/runtime.ts`, adapters de
`/current` e módulos identity/http do backend. Validar com o inventário e
`tests/unit/current-organization-read.test.ts`: remover identidade, antecipar
consulta privada, ignorar `.ok` ou reutilizar preparação fora de `/current` deve
reprovar; o mesmo contrato HTTP nos dois modos é protegido por
`tests/api-host/organizations.http.test.ts`.

#### Delegação do principal após extração (2026-10-01, sem commit)

No corte 12, a recusa central saiu do corpo da fachada para a closure de
`createTenantPrincipalResolver`. Conferir apenas o texto da fachada deixaria de
verificar o guard real. O inventário agora segue a delegação exata, exige o
Request original, a factory aprovada, os leitores reais de sessão/banco e a
recusa como primeiro passo da closure. O formato discriminante é conferido na
implementação compartilhada após essa prova de composição.

Arquivos: `tenant-request-principal.ts` do backend, `lib/tenant.ts`,
`apps/services/api/src/host/private-identity.ts` e
`tests/security/route-auth-inventory.test.ts`. Validar com o inventário (63
testes), caracterização privada (105 casos incluindo listagem) e paridade HTTP
nos dois modos: remover/mover/ignorar a recusa, trocar sessão/banco, modificar a
requisição, acessar dados antes do guard ou remover papel ADMIN da rota do
serviço deve reprovar. Não houve redução de timeout, gramática, escopo ou
baseline para aceitar a extração.

---

#### Delegação da permissão após extração (2026-10-01, sem commit)

No corte 14, requireTenantPermission passou a ser uma fachada da factory
`createTenantPermissionResolver`. O inventário segue a chamada com os três
argumentos originais e confere a composição do principal real e do leitor lazy
de banco. Na closure, principal negado sai antes da consulta de Permission; essa
delegação segue até o guard central de mesma origem. O formato `.ok` é conferido
na implementação compartilhada, sem aceitar um resultado forjado na fachada ou
ampliar gramática/allowlists.

Arquivos: `identity/tenant-permission.ts`, `lib/tenant-permissions.ts`,
`apps/services/api/src/host/permissions.ts`, o adapter de categorias
administrativas e `tests/security/route-auth-inventory.test.ts`. Validar com o
inventário (64 casos), caracterização da política e paridade HTTP: alterar
factory, leitores ou Request/módulo/ação; antecipar consulta; remover recusa do
principal ou ignorar `.ok` deve reprovar. CLIENT continua recusado, ADMIN do
vínculo passa e outras funções exigem Permission exata por locadora/papel/
módulo/ação. Não foi feita correção funcional da política durante a extração.

#### Export público da classe catalog na extração (2026-10-01, sem commit)

O corte 15 importa CatalogError de `@gb-locacoes/backend/catalog` no adapter de
detalhe de unidade. Esse alias foi registrado no inventário, que resolve tanto o
export público quanto `lib/catalog` até a mesma definição
`modules/catalog/errors.ts`. A definição continua limitada a classe inerte de
Error, e os usos são selados para impedir efeitos via `Symbol.hasInstance`. O
caso adversarial novo confere identidade da definição e rejeita mutação da
classe através do alias público. A gramática e as allowlists públicas não
mudaram; não houve aumento de baseline ou timeout. Validar: inventário com 65
casos e caracterização/paridade de `equipment-units` (corte 15 de
`docs/features/shared-api-host.md`).

## 158. Fixtures de teste com slug fora da política após a migration `202609260005`

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Média (suítes vermelhas)
**Status**: RESOLVIDO (onda 2, commit `da19f601`) **Ambiente**: banco
descartável com a migration `202609260005_organization_slug_policy`

#### Descrição

- Com o CHECK `organizations_slug_dns_label`, estes arquivos falham no
  `beforeAll` com
  `23514 ... violates check constraint "organizations_slug_dns_label"`:
  - `tests/unit/addresses-database.test.ts`
  - `tests/unit/billing-database.test.ts`
  - `tests/unit/tenant-database.test.ts`
  - `tests/identity/contracts-database.test.ts`

#### Causa raiz

- As fixtures usam o id como slug e montam o id com `_` (por exemplo
  `'billing_' + randomUUID()`), o que a política D15 recusa.

#### Solução

- Só o slug das fixtures mudou para um rótulo DNS válido (minúsculas, dígitos e
  hífen, 2 a 63 caracteres, sem `--`; por exemplo `'billing-' + randomUUID()`),
  sem afrouxar asserções. `tests/critical/quote-boleto.test.ts` já seguia esse
  formato. A correção entrou no commit `da19f601`.

#### Como validar

- `pnpm test:unit` e `pnpm test:identity` com `TEST_DATABASE_URL` descartável e
  `TEST_DATABASE_DISPOSABLE=true`, depois de `prisma migrate deploy`.

---

## 157. Preflight de migration passava vazio sob `FORCE ROW LEVEL SECURITY`

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Baixa (diagnóstico;
data-integrity#1) **Status**: RESOLVIDO (onda 2, commit `da19f601`)
**Ambiente**: `prisma/migrations/202609260001` a `0004`

#### Descrição

- Com um papel de migração dono das tabelas mas sem superuser nem `BYPASSRLS`,
  os `SELECT count(*)` dos preflights viam zero linhas e passavam em silêncio,
  mesmo com dados inválidos. Em `0001` e `0004` o erro virava `23505` cru; em
  `0002` o `ADD VALUE` era confirmado.

#### Causa raiz

- Desde a `202609250005`, `rentals` e `payments` têm `FORCE ROW LEVEL SECURITY`
  e a política `tenant_isolation` compara `tenantId` com `app.tenant_id`, que
  fica vazio durante a migration.

#### Solução

- Cada bloco `DO` de preflight lê o `relforcerowsecurity` atual, faz
  `NO FORCE ROW LEVEL SECURITY`, conta, dá `RAISE` e restaura o `FORCE`, tudo no
  mesmo comando (atômico em qualquer modo do runner). Padrão e alternativas
  descartadas em `docs/features/tenant-slug-policy.md`, seção 9.
- Comportamento medido do Prisma 7.10: script com `$$` roda numa transação
  implícita; script sem `$$` é executado instrução por instrução, sem
  atomicidade.
- Regra: toda migration nova com preflight de dados em tabela com `FORCE` segue
  o mesmo formato e ganha um caso em
  `tests/unit/migration-preflight-rls.test.ts`.

#### Como validar

- `tests/unit/migration-preflight-rls.test.ts` (banco descartável; cria papel e
  schema próprios).
- O checksum de `0001` a `0004` mudou. Num banco descartável antigo,
  `prisma migrate deploy` aplicou só a `0005`, sem reclamar (medido em
  2026-09-26); recriar o banco garante que o SQL novo foi o aplicado.

---

## 156. Orçamento pago não convertia depois de cobrança CANCELLED/REFUNDED

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Alta (data-integrity#0)
**Status**: RESOLVIDO (onda 2, commit `da19f601`) **Ambiente**:
`packages/domain/src/locacao/reserva.ts`,
`packages/backend/src/modules/rentals`,
`packages/backend/src/modules/quotations/boleto.ts`

#### Descrição

- A `202609260004` passou a permitir nova cobrança para o mesmo orçamento quando
  a anterior está CANCELLED ou REFUNDED, preservando a linha antiga. O conversor
  calculava `payments.every(p => p.status === 'PAID')` sobre todo o histórico:
  com `[REFUNDED, PAID]` o orçamento pago nunca virava locação.
- `ensureQuoteBoletoPayment` respondia 409 quando o boleto anterior estava
  cancelado ou estornado.

#### Solução

- `isObligationSettled(total, payments)`: só RENTAL/DEPOSIT, ignora CANCELLED e
  REFUNDED, exige ao menos uma PAID, todas as vigentes PAID e soma PAID ≥ total
  (`finalTotal ?? total`), em Decimal. A mesma regra vale em
  `hasCheckoutPayment` e em `blocksRentalInventory`.
- O boleto é reemitido quando o anterior foi cancelado ou estornado, sem alterar
  a linha antiga. Desde a onda 4, um `CANCELLED` só permite reemissão com prova
  de fim no provedor; sem prova, a emissão reconcilia com o provedor ou responde
  409 (entrada 187).
- Uma cobrança PENDING/OVERDUE esquecida continua bloqueando a conversão mesmo
  com o total pago; cancelar essa cobrança destrava (regra conservadora, a
  confirmar).
- Desde a onda 4, "soma PAID ≥ total" é o saldo em centavos de
  `obligationBalance` (entrada 186).

#### Como validar

- `tests/unit/quote-settlement-database.test.ts` (banco descartável) e
  `tests/unit/rental-reservation.test.ts`.

---

## 155. SSR/SEO: rotas públicas saíam só com "Carregando..." no HTML do servidor

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Alta (SEO) **Status**:
RESOLVIDO (commit `0cff7b65`) **Ambiente**:
`packages/frontend/src/app/providers`, host web

#### Descrição

- As rotas públicas do host web saíam no HTML do servidor só com "Carregando..."
  e com `BAILOUT_TO_CLIENT_SIDE_RENDERING` envolvendo o `body`.

#### Causa raiz

- `RuntimeBootstrap` trocava toda a árvore por "Carregando..." até resolver
  sessão e carrinho.
- `useSearchParams` num provider raiz dentro de `<Suspense fallback={null}>`
  mandava o body inteiro para o cliente em rota pré-renderizada.
- O `SessionProviderWrapper` legado descartava a prop `session`.

#### Solução

- Rotas públicas renderizam os filhos no servidor com status `loading`; área
  privada e `/orcamento` esperam sessão e escopo do carrinho (`awaitSession`).
- Leitura da URL isolada num componente folha com `Suspense` próprio.
- Regra: nunca chamar `useSearchParams` em provider raiz.

#### Como validar

- `packages/frontend/src/app/providers/RuntimeBootstrap.ssr.web.test.tsx` (antes
  `ssr-public-bootstrap.web.test.tsx`, renomeado na onda 3) e busca por
  `BAILOUT_TO_CLIENT_SIDE_RENDERING` nos HTML de `.next/server/app` depois de
  `pnpm build:web`.

---

## 154. Identidade legacy: curingas do `ILIKE` e bloqueio de conta por terceiros

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-09-26 **Severidade**: Alta (identity#0–#6)
**Status**: RESOLVIDO (onda 2, commit `da19f601`) **Ambiente**: `lib/auth.ts`,
`lib/rate-limit.ts`, `app/api/auth/{register,forgot-password,reset-password}`

#### Descrição

- `%` e `_` no e-mail funcionavam como curingas: o limite por conta do login era
  contornado, um cadastro com `joao_silva@...` era tratado como existente quando
  havia `joao.silva@...`, e um e-mail OAuth com `_` podia se ligar à conta de
  outra pessoa.
- A janela por conta sem vínculo com IP permitia a qualquer anônimo bloquear o
  login de uma conta (inclusive administradores de outra locadora).
- O IP vinha do primeiro `X-Forwarded-For`, controlado pelo cliente.
- Chaves do limitador guardavam o e-mail bruto sem limite de memória.
- O cadastro sem limite enviava um aviso a cada POST para conta existente.
- Tempo e efeito denunciavam se a conta existia (login sem bcrypt para conta
  inexistente; envio no caminho da resposta).

#### Causa raiz

- `findFirst({ email: { equals, mode: 'insensitive' } })` vira
  `WHERE email ILIKE $1` sem escape no Prisma.
- Limitador desenhado por conta, não por requisitante; nenhuma noção de proxy
  confiável.

#### Solução

- `findAccountsByEmail`: e-mail normalizado (trim + minúsculas, até 254
  caracteres), curingas escapados, `take: 2` e comparação exata em memória.
  Desde a onda 4 é um invólucro de `findLegacyAccountsByEmail`
  (`packages/backend/src/modules/identity/legacy-credentials.ts`), e o login v1
  e v2 passam por `verifyLegacyCredential` (entrada 191).
- Política por escopo documentada acima de `AUTH_ATTEMPT_POLICIES` em
  `lib/rate-limit.ts` (valores no `CHANGELOG.md`, onda 2).
- `clientIpFromHeaders`: `TRUSTED_PROXY_HOPS` ou `VERCEL=1`; fora de produção,
  entrada mais à esquerda; em produção sem nenhum dos dois, `null` e aviso
  único.
- Chaves HMAC-SHA256 com teto de 50.000 entradas; bcrypt fictício; e-mails de
  identidade com `after()`.

#### Limitações conhecidas

- ~~Limitador em memória, por instância~~: resolvido na onda 3 (Lote 7a). Os
  limitadores de autenticação gravam em `platform_rate_limits` com chave HMAC de
  `PLATFORM_RATE_LIMIT_SECRET`; ver a entrada 176. Os limitadores genéricos
  (quotes, contact, admin) continuam em memória.
- Deploy fora da Vercel precisa de `TRUSTED_PROXY_HOPS` (Docker atrás de um
  nginx que acrescenta ao `X-Forwarded-For`: `1`). Sem ele, em produção o login
  cai no balde por conta e os limitadores genéricos (quotes, contact) dividem um
  balde único. A variável ainda não está no `.env.example`.
- O login não exige e-mail verificado: cadastrar com o CPF/CNPJ de outra pessoa
  e depois entrar revela se o documento estava livre (decisão de produto).
- Contas que diferem só pela caixa não entram até serem unificadas; o preflight
  de identidade conta `duplicateEmailGroups`.

#### Como validar

- `pnpm test:security` e `pnpm test:identity` (banco descartável).

---

## 153. Autocomplete da Hero não exibia dropdown (ou mostrava "risco" vertical no desktop)

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-02-21 **Severidade**: Alta (busca principal da home
indisponível) **Status**: ✅ RESOLVIDO **Ambiente**:
`components/ui/autocomplete.tsx`

#### Descricao

- Na busca da Hero (`/`), ao digitar 2+ caracteres, o usuário podia não ver
  nenhum dropdown.
- Em desktop, em alguns ciclos aparecia apenas uma linha/risco vertical no canto
  esquerdo da página.
- Estados esperados ("Buscando..." e "Nenhum equipamento encontrado") não eram
  exibidos de forma consistente.

#### Causa raiz

- O componente só abria o dropdown após a resposta da API e apenas quando
  `data.length > 0`, suprimindo os estados de loading e vazio.
- O portal desktop podia renderizar no primeiro frame com
  `dropdownPosition.width = 0`, produzindo o artefato visual (linha vertical).
- O listener global de `scroll` podia fechar o dropdown imediatamente após
  abrir, antes de estabilizar posição/render.

#### Solucao

- A busca passou a abrir o dropdown imediatamente para qualquer termo com 2+
  caracteres, preservando estados "Buscando..." e "Nenhum equipamento
  encontrado".
- O cálculo de posição agora retorna status válido e tenta recalcular no frame
  seguinte quando a largura inicial ainda não está pronta.
- O portal desktop só renderiza com `dropdownPosition.width > 0`.
- Foi adicionada janela de proteção de 150ms (`openedAtRef`) para ignorar
  `scroll` logo após abertura.
- O `click outside` passou a fechar corretamente mesmo quando o dropdown ainda
  não está montado.

#### Arquivos modificados

- `components/ui/autocomplete.tsx`

#### Como validar

1. Rodar `pnpm dev` e abrir `/`.
2. Digitar `anda` no campo da Hero.
3. Confirmar abertura imediata do dropdown com estado "Buscando...".
4. Confirmar exibição de sugestões quando houver resultados.
5. Buscar um termo inexistente e confirmar "Nenhum equipamento encontrado".
6. Confirmar que não aparece linha vertical no canto esquerdo em desktop.

#### Busca rapida

- `rg -n "autocomplete|dropdownPosition|openedAtRef|Buscando|Nenhum equipamento" docs/issues/known-issues.md`

---

## 152. Animação de altura do Kanban falhava na primeira busca e em busca cross-mês

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-02-19 **Severidade**: Alta (UX/animação)
**Status**: ✅ RESOLVIDO **Ambiente**: `app/admin/orcamentos/page.tsx`,
`components/admin/kanban-pipeline.tsx`

#### Descricao

- No Kanban de `/admin/orcamentos`, a primeira pesquisa digitada no input podia
  atualizar a coluna sem animação de altura (salto instantâneo).
- Em busca cross-mês (ex.: mês atual sem resultados, busca retorna mês
  diferente), a coluna podia colapsar para altura mínima e depois expandir,
  quebrando a transição suave.

#### Causa raiz

- Havia um estado transitório vazio entre dois renders:
  `setQuotes(normalizedQuotes)` e, depois, `setKanbanMonth(...)` em `useEffect`.
- Nesse intervalo, `kanbanFilteredQuotes` podia ficar `[]`, removendo os cards
  temporariamente e produzindo medições intermediárias de altura (~32px).
- O `AnimatedHeight` dependia de medição inicial via `ResizeObserver`; na
  primeira interação, o baseline podia não estar consolidado, reduzindo a chance
  de animar a primeira transição.
- O wrapper do Kanban usava `key` baseada em mês (`kanban-${year}-${month}`), o
  que remontava o `KanbanPipeline` ao trocar de mês na busca e descartava o
  estado anterior de altura (sem transição entre alturas).

#### Solucao

- A auto-navegação de mês do Kanban na busca foi antecipada para o
  `fetchQuotes`, no mesmo ciclo assíncrono do `setQuotes`, eliminando o render
  intermediário vazio.
- Foram adicionados helpers de data para manter a mesma regra de referência de
  mês (`startDate`/`createdAt`) entre filtragem, contagem e auto-navegação.
- O `AnimatedHeight` passou a fazer medição inicial no mount
  (`useLayoutEffect` + `commit()`), garantindo baseline já na primeira busca.
- O wrapper animado do Kanban passou a usar `key` estável
  (`key="kanban-stable"`), evitando remount da árvore do pipeline durante
  auto-navegação de mês em busca ativa.
- O `useEffect` de auto-navegação foi mantido como fallback defensivo.

#### Arquivos modificados

- `app/admin/orcamentos/page.tsx`
- `components/admin/kanban-pipeline.tsx`

#### Como validar

1. Abrir `/admin/orcamentos` em modo Kanban com cards visíveis.
2. Digitar a primeira busca no input e confirmar que a altura das colunas anima
   suavemente (sem salto instantâneo).
3. Estando em um mês sem resultado da busca, pesquisar um orçamento de outro mês
   (ex.: `OBRA-563`) e confirmar:
   - navegação para o mês correto;
   - sem colapso transitório para altura mínima;
   - animação suave direta para a altura final.
4. Buscar um termo que zere legitimamente uma coluna e confirmar animação
   natural de redução até o estado vazio.

#### Busca rapida

- `rg -n "AnimatedHeight|kanbanFilteredQuotes|setKanbanMonth|busca cross-mês|primeira busca" docs/issues/known-issues.md`

---

## 151. Busca no Kanban mostrava contagem no badge sem cards e recarregava tela ao digitar

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-02-19 **Severidade**: Alta (UX/operacional)
**Status**: ✅ RESOLVIDO **Ambiente**: `components/admin/kanban-pipeline.tsx`,
`app/admin/orcamentos/page.tsx`

#### Descricao

- Na busca da tela `/admin/orcamentos` em modo Kanban, o badge da coluna podia
  mostrar contagem correta (ex.: "Aprovado 1"), mas os cards não apareciam.
- Ao digitar no input de busca, a página entrava em loading global a cada
  refresh de dados, causando efeito de “recarregamento” completo.
- Em modo Kanban, havia divergência de exibição por mês durante busca.

#### Causa raiz

- O `KanbanPipeline` usava um buffer de animação em duas fases
  (`displayedItems` + `pendingItemsRef`) dependente de `onExitComplete`; em
  ciclos específicos, a coluna era esvaziada e não voltava a preencher.
- `fetchQuotes` executava `setLoading(true)` em todas as buscas/filtros,
  ativando o fallback de loading da página inteira após o primeiro carregamento.
- Em Kanban, o estado de mês da busca precisava ser sincronizado sem quebrar a
  segmentação mensal.

#### Solucao

- O `KanbanPipeline` passou a renderizar diretamente `itemsByStatus` e animar
  por card individual (`AnimatePresence`), removendo o buffer intermediário e a
  dependência de `onExitComplete`.
- O loading global da página passou a ocorrer apenas na carga inicial; buscas e
  filtros seguintes atualizam os dados em background sem desmontar a tela.
- No Kanban, a filtragem por mês foi preservada e, com busca ativa, o sistema
  auto-navega para o primeiro mês que contém resultados quando o mês atual não
  possui itens.
- Em Kanban, filtros ocultos de período/valor não são mais enviados para API.
- O termo de busca enviado para API passou a usar `trim()`.

#### Arquivos modificados

- `components/admin/kanban-pipeline.tsx`
- `app/admin/orcamentos/page.tsx`

#### Como validar

1. Abrir `/admin/orcamentos` em modo Kanban com um mês selecionado.
2. Digitar no campo de busca e confirmar que a página não exibe spinner de tela
   cheia a cada alteração.
3. Buscar por um orçamento conhecido (ex.: `OBRA-563`) e confirmar que coluna
   com badge > 0 renderiza os cards.
4. Buscar por um orçamento de mês diferente e confirmar que o Kanban navega para
   o mês correto no `KanbanMonthNavigator`.

#### Busca rapida

- `rg -n "kanban|busca|displayedItems|onExitComplete|kanbanFilteredQuotes" docs/issues/known-issues.md`

---

## 150. Busca no Kanban de orçamentos não exibia resultados nem atualizava o mês

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-02-19 **Severidade**: Média (UX) **Status**: ✅
RESOLVIDO **Ambiente**: `app/admin/orcamentos/page.tsx`

#### Descricao

- Ao buscar por código (ex.: OBRA-563), cliente ou e-mail no input de filtros, o
  modo Kanban não exibia os resultados nos blocos.
- O KanbanMonthNavigator não era atualizado para o mês que contém o resultado.
- O resultado existia na resposta da API, mas o Kanban filtra por mês; se o
  orçamento estiver em outro mês que o selecionado, era ocultado.

#### Causa raiz

- `kanbanFilteredQuotes` filtra `quotes` pelo `kanbanMonth` selecionado.
- Quando o usuário busca, a API retorna orçamentos filtrados (corretamente), mas
  o Kanban continua mostrando o mês anteriormente selecionado.
- Se o resultado (ex.: OBRA-563) está em Janeiro e o mês ativo era Fevereiro, o
  filtro por mês removia o resultado.

#### Solucao

- `useEffect` que, quando há busca ativa (`debouncedSearchTerm`), o modo é
  Kanban e o mês atual não tem resultados: navega automaticamente para o
  primeiro mês que contém resultados da busca.
- Assim o KanbanMonthNavigator e os blocos passam a exibir o mês e os cards
  corretos.

#### Arquivos modificados

- `app/admin/orcamentos/page.tsx` (useEffect de auto-navegação por busca)

#### Como validar

1. Abra `/admin/orcamentos` em modo Kanban com mês Fev selecionado.
2. Busque por um código de orçamento que esteja em outro mês (ex.: Jan).
3. O Kanban deve navegar para Jan e exibir o card do orçamento.

#### Busca rapida

- `rg -n "kanban|busca|search|debouncedSearchTerm" docs/issues/known-issues.md`

---

## 149. Warnings Three.js no console (Clock deprecation, WebGL Context Lost)

### Problema RESOLVIDO (supressão)

**Data da Ocorrência**: 2026-02-19 **Severidade**: Baixa (apenas ruído no
console) **Status**: ✅ RESOLVIDO (supressão) **Ambiente**:
`app/ClientLayout.tsx`, `components/ui/model-viewer.tsx`

#### Descricao

- Console exibia:
  `THREE.THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.`
- Console exibia: `THREE.WebGLRenderer: Context Lost`
- Warnings vêm de bibliotecas externas (@react-three/fiber, Three.js).

#### Causa raiz

- **Clock**: @react-three/fiber cria `new THREE.Clock()` internamente no store;
  a migração para Timer depende de atualização da biblioteca.
- **Context Lost**: Ocorre em dev com HMR ou ao trocar de aba; é esperado.

#### Solucao

- **ClientLayout**: Interceptação de `console.warn`/`error`/`log` para suprimir
  mensagens que contenham "three"+"clock"+"deprecated" ou
  "webglrenderer"+"context lost".
- **model-viewer.tsx**: Adicionado
  `canvas.addEventListener('webglcontextlost', e => e.preventDefault())` em
  `onCreated` do Canvas para suavizar recuperação.

#### Arquivos modificados

- `app/ClientLayout.tsx` (shouldSuppress)
- `components/ui/model-viewer.tsx` (onCreated)

#### Busca rapida

- `rg -n "three|clock|webgl|context lost" docs/issues/known-issues.md`

---

## 147. Orçamento aprovado permanecia na coluna "Pendente" do Kanban

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-02-18 **Severidade**: Média (UX incorreta)
**Status**: ✅ RESOLVIDO **Ambiente**: `app/api/admin/quotes/[id]/route.ts`

#### Descricao

- Ao aprovar um orçamento (status APPROVED), o card continuava na coluna
  "Aprovação Pendente" em vez de mover para "Aprovado" no Kanban.

#### Causa raiz

- A API PATCH de aprovação definia `updateQuoteData.status = 'APPROVED'` apenas
  para pagamento `AT_END`. Para `UPFRONT` e `ON_DELIVERY`, o status permanecia
  `PENDING` (comentário antigo: "mantém PENDING até pagamento").

#### Solucao

- **API**: Definir `updateQuoteData.status = 'APPROVED'` no início do bloco de
  aprovação, para todos os payment terms (UPFRONT, ON_DELIVERY, AT_END).
- **Frontend (dados legados)**: Em `normalizeQuote`, quando
  `status === 'pending'` mas `approvedAt` está preenchido e não há rejeição,
  tratar o status efetivo como `'approved'`. Corrige orçamentos aprovados antes
  da correção da API (que permaneciam com status PENDING no banco).

#### Arquivos modificados

- `app/api/admin/quotes/[id]/route.ts`
- `app/admin/orcamentos/page.tsx` (normalizeQuote)

---

## 148. Erro 500 "Erro ao carregar locações" - Unknown argument clientDeletedAt

### Problema RESOLVIDO (workaround)

**Data da Ocorrência**: 2026-02-18 **Severidade**: Alta (locações não
carregavam) **Status**: ✅ RESOLVIDO (workaround) **Ambiente**:
`app/api/client/rentals/route.ts`, `app/api/client/rentals/[id]/route.ts`

#### Descricao

- GET `/api/client/rentals` retornava 500.
- Console: "Erro ao carregar locações".
- Server log: `PrismaClientValidationError: Unknown argument 'clientDeletedAt'`.
  Available options are marked with ?.

#### Causa raiz

- O Prisma Client gerado (v7.4.0) não reconhece `clientDeletedAt` no
  `rentalsWhereInput`, apesar do campo existir no schema `prisma/schema.prisma`.
- Possível incompatibilidade entre Prisma 7 + adapter-pg e o schema gerado.

#### Solucao (workaround)

- Remover `clientDeletedAt: null` do `where` em `findMany`/`findFirst`.
- Filtrar em memória após a query:
  `const rentals = allRentals.filter((r) => r.clientDeletedAt == null)`.
- No GET por ID, retornar 404 se `rental.clientDeletedAt != null`.
- **Recomendacao futura**: executar `pnpm db:generate` e reiniciar o servidor;
  se o erro persistir, investigar se a coluna existe no banco
  (`prisma migrate status`).

#### Arquivos modificados

- `app/api/client/rentals/route.ts`
- `app/api/client/rentals/[id]/route.ts`

#### Busca rapida

- `rg -n "clientDeletedAt|rentals.*500|Unknown argument" docs/issues/known-issues.md`

---

## 146. Ajuste TRAVEL (Deslocamento/Frete) somava com frete calculado

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-02-18 **Severidade**: Alta (duplicação de valor)
**Status**: ✅ RESOLVIDO **Ambiente**:
`app/api/admin/quotes/[id]/adjustments/route.ts`,
`app/api/admin/quotes/[id]/adjustments/[adjustmentId]/route.ts`

#### Descricao

- Ao configurar reajuste com categoria "Deslocamento (Frete)" e informar valor
  manual (ex.: R$ 30,00), o sistema somava esse valor ao frete já calculado pelo
  sistema (ex.: R$ 50,00), resultando em R$ 80,00 em vez de R$ 30,00.

#### Causa raiz

- A API POST de adjustments sempre fazia `nextTotal = currentTotal + amount`
- O `currentTotal` já incluía o `deliveryFee` do quote
- Para TRAVEL, o valor informado deve **substituir** o frete, não somar

#### Solucao

- **POST** `adjustments/route.ts`: quando `category === 'TRAVEL'`, calcular
  `nextTotal = (currentTotal - deliveryFee - pickupFee) + amount + pickupFee`
- **DELETE** `adjustments/[adjustmentId]/route.ts`: ao recalcular total com
  remaining adjustments, tratar TRAVEL como substituição do frete, não aditivo

#### Arquivos modificados

- `app/api/admin/quotes/[id]/adjustments/route.ts`
- `app/api/admin/quotes/[id]/adjustments/[adjustmentId]/route.ts`
- `docs/features/quote-price-adjustment.md`

#### Documentacao

- `docs/features/quote-price-adjustment.md` — regra TRAVEL documentada

---

## 145. Warning recorrente do Recharts: width(-1)/height(-1) no dashboard

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-02-14 **Severidade**: Media (ruido de console +
instabilidade visual inicial) **Status**: ✅ **RESOLVIDO DEFINITIVAMENTE**
**Ambiente**: `components/ui/chart.tsx`,
`components/admin/financial/KPICard.tsx`, `/admin/dashboard`, dashboard do
`/admin/financeiro`

#### Descricao

- Ao abrir dashboard/admin financeiro, o console repetia:
  `The width(-1) and height(-1) of chart should be greater than 0`.
- **IMPORTANTE:** Warnings aparecem **APÓS dados carregarem**, não no mount
  inicial
- O erro vinha do `ResponsiveContainer` tentando medir container durante resize
  causado por atualizações de dados

#### Causa raiz

- **Race condition:** Quando dados carregam assincronamente, container pai
  redimensiona
- ResponsiveContainer com `width="100%"` tenta medir pai via
  `getBoundingClientRect()`
- Durante fase de resize, container retorna dimensões inválidas (-1)
- **State management não funciona:** React batching faz ResponsiveContainer
  renderizar antes das flags de estado atualizarem

#### ❌ Tentativas que NÃO funcionaram

1. Adicionar `minHeight`/`minWidth` props → Warnings persistiram
2. Conditional rendering com flags booleanas (`isMounted && hasValidSize`) →
   Warnings persistiram
3. Unmount durante resize + delay de estabilização → Warnings persistiram

#### ✅ Solucao Implementada (FINAL)

**PASSAR DIMENSÕES NUMÉRICAS EXPLÍCITAS ao invés de porcentagens**

1. `components/ui/chart.tsx`: Armazena `{width: number, height: number}` em
   state
2. Mede com `getBoundingClientRect()`, aguarda 50ms de estabilização
3. Passa valores numéricos para
   `<ResponsiveContainer width={dimensions.width} height={dimensions.height}>`
4. ResponsiveContainer **não precisa medir**, recebe dimensões via props
5. `components/admin/financial/KPICard.tsx`: mesmo padrão aplicado

**Por que funciona:** ResponsiveContainer nunca tenta medir container pai,
sempre recebe valores válidos ou não renderiza (se dimensions === null)

#### 📚 Documentação Completa

**VER:** `docs/issues/recharts-dimension-warnings.md` para:

- Explicação detalhada da causa raiz
- Todas as tentativas que falharam
- Código completo da solução
- Lições aprendidas

**REGRA:** NUNCA use `width="100%"` em ResponsiveContainer com dados assíncronos
→ sempre use dimensões explícitas

#### Arquivos Modificados

1. `components/ui/chart.tsx`
2. `components/admin/financial/KPICard.tsx`

#### Como validar

1. Abrir `/admin/dashboard` e navegar pelos cards com graficos.
2. Abrir `/admin/financeiro` (view dashboard) e validar
   receita/categorias/aging.
3. Confirmar ausencia do warning `width(-1)/height(-1)` no console.
4. Executar `pnpm type-check`.

#### Armadilhas a Evitar

- Renderizar `ResponsiveContainer` imediatamente em wrappers que podem iniciar
  com dimensao 0.
- Criar novos graficos fora do `ChartContainer` sem guarda de tamanho.

## 144. Dashboard e Financeiro divergiam por filtros e agregacoes duplicadas

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-02-14 **Severidade**: Alta (inconsistencia de
indicadores) **Status**: Resolvido **Ambiente**: `/admin/financeiro`,
`/api/admin/financial/*`, `/api/admin/dashboard`,
`/api/cron/verify-boleto-payments`

#### Descricao

- A view Dashboard do Financeiro podia exibir numeros diferentes da
  tabela/calendario/exportacao para o mesmo periodo e status.
- Parte das rotas financeiras repetia filtros com pequenas variacoes, gerando
  risco de divergencia (status, periodo, search e fallback de relacoes).
- O cron de verificacao de boleto atualizava `status` sem manter `billingStatus`
  sincronizado em todos os caminhos.

#### Causa raiz

- Ausencia de um builder compartilhado para escopo financeiro (`where`) entre
  endpoints.
- Agregacoes de dashboard/receita com regras diferentes da tela detalhada.
- Frontend do Financeiro carregava graficos sem aplicar os mesmos filtros da
  tabela.
- Cron tratava atraso com update parcial do pagamento.

#### Solucao Implementada

1. Criado `lib/financial-scope.ts` como fonte unica de filtros financeiros
   (status, periodo, search e escopo de boleto de locacao).
2. Rotas `entries`, `calendar`, `export`, `revenue` e `aging` foram alinhadas
   para usar o mesmo builder de escopo.
3. Dashboard admin passou a calcular receita mensal com o mesmo escopo
   financeiro base.
4. Frontend `/admin/financeiro` agora aplica filtros atuais (`search`, `status`
   e periodo) tambem em `revenue` e `aging`, mantendo graficos sincronizados.
5. Cron de boleto passou a sincronizar `status` + `billingStatus` em atraso e
   baixa (`OVERDUE/UNPAID`, `CANCELLED|REFUNDED/SETTLED`) e verificar boletos
   `PENDING` e `OVERDUE`.
6. Testes criticos adicionados para:
   - alocacao proporcional de receita por categoria (evita overcount)
   - sincronizacao de status no cron

#### Arquivos Modificados

1. `lib/financial-scope.ts`
2. `app/api/admin/financial/entries/route.ts`
3. `app/api/admin/financial/calendar/route.ts`
4. `app/api/admin/financial/export/route.ts`
5. `app/api/admin/financial/revenue/route.ts`
6. `app/api/admin/financial/aging/route.ts`
7. `app/api/admin/dashboard/route.ts`
8. `lib/financial-calculations.ts`
9. `app/admin/financeiro/page.tsx`
10. `app/api/cron/verify-boleto-payments/route.ts`
11. `tests/critical/financial-revenue.test.ts`
12. `tests/critical/verify-boleto-payments-cron.test.ts`

#### Como validar

1. Em `/admin/financeiro`, aplicar filtros de periodo/status/search e comparar:
   tabela, calendario, graficos de receita e aging.
2. Alterar status de um lancamento e confirmar atualizacao coerente nas 3 visoes
   (tabela, calendario, dashboard financeiro).
3. Executar:
   `pnpm vitest --run tests/critical/financial-entries.test.ts tests/critical/financial-due-date.test.ts tests/critical/financial-revenue.test.ts tests/critical/verify-boleto-payments-cron.test.ts`
4. Executar `pnpm type-check`.

#### Armadilhas a Evitar

- Reintroduzir `where` financeiro ad-hoc sem passar por
  `lib/financial-scope.ts`.
- Misturar `Payment.status` (gateway) com `billingStatus` (operacional) sem
  mapeamento explicito.
- Atualizar graficos do Financeiro sem reaplicar os filtros ativos.

## 143. Substituicao de boleto mantinha cobranca antiga ativa no Asaas

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-02-14 **Severidade**: Alta (cobranca duplicada)
**Status**: Resolvido **Ambiente**: `lib/quote-boleto.ts`, `/admin/financeiro`,
Asaas (`/v3/payments`)

#### Descricao

- Ao regenerar boleto com novo valor, o sistema atualizava o `transactionId`
  local, mas a cobranca anterior podia permanecer ativa no Asaas.
- Tambem nao havia acao dedicada no painel financeiro para alterar o vencimento
  da cobranca com sincronizacao no gateway.

#### Causa raiz

- Fluxo de regeneracao nao executava cancelamento da cobranca anterior no
  gateway antes de criar a nova.
- Painel financeiro permitia alterar status, mas nao permitia alterar `dueDate`
  com update remoto no Asaas.

#### Solucao Implementada

1. Regeneracao de boleto passou a tentar cancelar a cobranca anterior no gateway
   (Asaas) antes de substituir a transacao.
2. Gateway de boleto ganhou operacoes explicitas para:
   - cancelar cobranca (`DELETE /payments/{id}`)
   - atualizar vencimento (`PUT /payments/{id}`)
3. Novo endpoint financeiro: `PATCH /api/admin/financial/entries/[id]/due-date`.
4. Modal de detalhes em `/admin/financeiro` ganhou controle de "Alterar
   Vencimento" com input de data + salvamento.
5. Ao atualizar vencimento de cobranca vencida, o status financeiro volta para
   `AWAITING_PAYMENT` (`Payment.status -> PENDING`) para refletir renegociacao.

#### Arquivos Modificados

1. `lib/quote-boleto.ts`
2. `lib/payment-gateways/asaas.ts`
3. `lib/payment-gateways/boleto.ts`
4. `app/api/admin/financial/entries/[id]/due-date/route.ts`
5. `app/admin/financeiro/page.tsx`
6. `tests/critical/quote-boleto.test.ts`
7. `tests/critical/financial-due-date.test.ts`

#### Como validar

1. Gerar boleto de um orcamento e depois reajustar valor para forcar
   regeneracao.
2. Confirmar que a cobranca anterior foi cancelada no Asaas e a nova transacao
   ficou vinculada ao mesmo `Payment` local.
3. Abrir `/admin/financeiro`, entrar em "Exibir" de um lancamento de boleto e
   alterar o vencimento para data futura.
4. Confirmar no banco que `dueDate` foi atualizado e que status vencido voltou
   para pendente/aguardando pagamento.
5. Executar:
   `pnpm test tests/critical/quote-boleto.test.ts tests/critical/financial-due-date.test.ts`.

---

## 142. Pagamentos convertidos deixavam de aparecer no painel financeiro

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-02-14 **Severidade**: Alta (visibilidade de
cobranca) **Status**: Resolvido **Ambiente**: `/api/admin/financial/entries`,
`/api/admin/financial/calendar`, `/api/admin/financial/export`

#### Descricao

- Pagamentos de locacao convertidos de orcamento para rental sumiam do
  financeiro.
- O sintoma ocorria apos a conversao do fluxo de pagamento, quando
  `Payment.quoteId` ficava `null` e apenas `Payment.rentalId` permanecia.

#### Causa raiz

- Os endpoints financeiros filtravam somente pagamentos com `quoteId` presente.
- No fluxo de conversao (`Quote -> Rental`), o pagamento continuava valido para
  cobranca, mas sem `quoteId` direto.

#### Solucao Implementada

1. Endpoints financeiros passaram a incluir pagamentos com `quoteId` **ou**
   `rentalId`:
   - `GET /api/admin/financial/entries`
   - `GET /api/admin/financial/calendar`
   - `GET /api/admin/financial/export`
2. Busca por cliente/codigo passou a cobrir tanto `quote` direto quanto
   `rental.quote` e `rental.users`.
3. Mapeamento de retorno foi ajustado para resolver `quote`/cliente via fallback
   de `rental` quando `quoteId` estiver `null`.
4. Teste crítico adicionado para garantir que pagamento convertido continua
   retornando no financeiro.

#### Arquivos Modificados

1. `app/api/admin/financial/entries/route.ts`
2. `app/api/admin/financial/calendar/route.ts`
3. `app/api/admin/financial/export/route.ts`
4. `tests/critical/financial-entries.test.ts`

#### Como validar

1. Criar um orçamento, converter para locação e manter pagamento com
   `quoteId = null` e `rentalId` preenchido.
2. Buscar por `quoteCode` em `/admin/financeiro`.
3. Confirmar que o lançamento aparece em tabela/calendário/exportação com
   cliente e código corretos.
4. Executar:
   `pnpm test tests/critical/financial-entries.test.ts tests/critical/quote-boleto.test.ts`.

#### Armadilhas a Evitar

- Reintroduzir filtro estrito `quoteId: { not: null }` em qualquer endpoint
  financeiro.
- Buscar somente em `quote.*` sem fallback para `rental.quote`/`rental.users`.

---

## 140. pnpm test falhava com P2022 por schema nao sincronizado no banco de testes

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-02-12 **Severidade**: Alta (Testes/CI local)
**Status**: Resolvido **Ambiente**: `pnpm test` (`tests/global-setup.ts`)

#### Descricao

- A suite de testes falhava com erros Prisma `P2022` (`column does not exist`)
  para campos novos como `Quote.quoteCode` e `Payment.billingStatus`.

#### Causa raiz

- O Prisma Client estava atualizado, mas o `TEST_DATABASE_URL` podia estar com
  schema desatualizado.
- O setup de testes validava seguranca de banco, mas nao sincronizava schema
  antes de subir o servidor.

#### Solucao Implementada

1. `tests/global-setup.ts` passou a executar `prisma db push --accept-data-loss`
   no `TEST_DATABASE_URL` antes de iniciar o Next.js.
2. Mantida a validacao de seguranca para impedir uso do mesmo banco de
   `DATABASE_URL`.

#### Como validar

1. Executar `pnpm test`.
2. Confirmar que nao ha erro `P2022`/`column does not exist` para
   `quoteCode`/`billingStatus`.
3. Confirmar que a suite sobe o servidor normalmente apos sincronizar schema.

#### Armadilhas a Evitar

- Assumir que `prisma generate` atualiza estrutura de banco.
- Rodar testes sem garantir schema aplicado no banco de testes.

---

## 141. Geracao concorrente de boleto esgotava conexoes e causava timeout

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-02-12 **Severidade**: Alta (Financeiro/Testes)
**Status**: Resolvido **Ambiente**: `lib/quote-boleto.ts`,
`tests/critical/quote-boleto.test.ts`

#### Descricao

- Em cenarios concorrentes (multiplos cliques/requests), a geracao de boleto
  falhava com:
  - `Transaction API error: query cannot be executed on an expired transaction`
  - `timeout exceeded when trying to connect`

#### Causa raiz

- A funcao `ensureQuoteBoletoPayment` usa transacao com lock advisory por
  `quoteId`, mas estava com limites padrao de espera.
- Dentro da transacao, `getCurrentFinancialRates()` consultava o Prisma global
  (fora do `tx`), abrindo conexao extra e aumentando contencao do pool.

#### Solucao Implementada

1. `ensureQuoteBoletoPayment` recebeu configuracao explicita de transacao:
   `maxWait: 30000` e `timeout: 60000`.
2. `getCurrentFinancialRates` passou a aceitar client opcional, e no fluxo de
   boleto usa o `tx` da transacao em vez do Prisma global.

#### Arquivos Modificados

1. `lib/quote-boleto.ts`
2. `lib/financial.ts`
3. `tests/critical/quote-boleto.test.ts` (validacao existente coberta pela
   suite)

#### Como validar

1. Executar `pnpm test`.
2. Confirmar que `tests/critical/quote-boleto.test.ts` passa com o caso de 10
   cliques concorrentes.
3. Confirmar que `tests/critical/quote-flow.test.ts` cria boleto automaticamente
   sem timeout.

---

## 139. APIs admin retornavam 500 por schema Prisma fora de sincronia local

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-02-11 **Severidade**: Alta (painel admin)
**Status**: Resolvido **Ambiente**: `/api/admin/dashboard`, `/api/admin/quotes`,
`/api/admin/financial/aging`

#### Descricao

- Após alterações recentes no schema Prisma (ex.: `Quote.quoteCode`,
  `Payment.billingStatus`), o frontend do admin passou a registrar múltiplos
  `500 (Internal Server Error)` nas APIs principais do dashboard.

#### Causa raiz

- O Prisma Client já estava gerado com os novos campos, mas o banco local ainda
  não tinha recebido essas colunas/tabelas.
- Erro observado:
  `P2022 The column (not available) does not exist in the current database`.

#### Solucao Implementada

1. Sincronização do schema no banco local com:
   `pnpm prisma db push --accept-data-loss`.
2. Backfill de código operacional de orçamento (`quoteCode`) para registros sem
   valor.
3. Verificação de duplicidade lógica de boletos após push.

#### Como validar

1. Executar consultas Prisma que usem os novos campos (`quoteCode`,
   `billingStatus`) sem erro `P2022`.
2. Recarregar `/admin/dashboard` e confirmar ausência de `500` em:
   - `/api/admin/dashboard`
   - `/api/admin/quotes?limit=5`
   - `/api/admin/financial/aging`
3. Confirmar que endpoints admin sem sessão retornam `401` (não `500`).

#### Armadilhas a Evitar

- Aplicar mudança de schema sem rodar `db push`/migrations no ambiente local.
- Executar scripts `db:backfill:*` sem carregar variáveis de ambiente de banco.

---

## 138. Geracao de boleto duplicava com cliques rapidos (condicao de corrida)

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-02-11 **Severidade**: Alta (financeiro) **Status**:
Resolvido **Ambiente**: `/admin/orcamentos`, endpoint
`POST /api/admin/quotes/[id]/generate-boleto`

#### Descricao

- Cliques repetidos em "Gerar boleto" podiam criar cobrancas duplicadas para o
  mesmo orcamento.

#### Causa raiz

- Fluxo backend era suscetivel a corrida (`read-then-create`) sem serializacao
  transacional por orcamento.
- Frontend nao tinha trava explicita por `quoteId`.

#### Solucao Implementada

1. `lib/quote-boleto.ts`: geracao passou a ser transacional com
   `pg_advisory_xact_lock(hashtext(quoteId))`.
2. `Payment`: adicionado `@@unique([quoteId, method, type])` para dedupe logico
   no banco.
3. `app/admin/orcamentos/page.tsx`: lock por `quoteId` no clique de gerar
   boleto.

#### Arquivos Modificados

- `lib/quote-boleto.ts`
- `prisma/schema.prisma`
- `app/admin/orcamentos/page.tsx`
- `scripts/dedupe-quote-boleto-payments.ts`

#### Como validar

1. Abrir `/admin/orcamentos` e selecionar um orcamento.
2. Clicar rapidamente 10x em "Gerar boleto".
3. Confirmar no banco apenas 1 pagamento ativo de boleto para aquele orcamento.

---

## 137. Busca de orcamentos nao encontrava o codigo operacional

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-02-11 **Severidade**: Alta (operacional)
**Status**: Resolvido **Ambiente**: `/admin/orcamentos`, `GET /api/admin/quotes`

#### Descricao

- Busca usava basicamente `quote.id` tecnico e dados de contato, mas nao havia
  um campo de codigo operacional dedicado pesquisavel.

#### Causa raiz

- Modelo `Quote` nao possuia `quoteCode`.
- Filtro de busca nao incluia `legacyExternalCode`.

#### Solucao Implementada

1. `Quote` ganhou `quoteCode` (unico) e `legacyExternalCode` (opcional).
2. Criacao de orcamento passou a gerar `quoteCode` (`Q-ANO-SEQUENCIAL`).
3. Busca admin foi atualizada para cliente + `quoteCode` + codigo legado.
4. Script de backfill para preencher codigos historicos sem `quoteCode`.

#### Arquivos Modificados

- `prisma/schema.prisma`
- `lib/quote-code.ts`
- `app/api/quotes/route.ts`
- `app/api/admin/quotes/route.ts`
- `app/admin/orcamentos/page.tsx`
- `scripts/backfill-quote-codes.ts`

#### Como validar

1. Criar novo orcamento e confirmar `quoteCode` no formato `Q-2026-0001`.
2. Buscar por nome do cliente e por `quoteCode` no mesmo campo.
3. Executar backfill e validar que orcamentos antigos recebem codigo.

---

## 136. Inconsistencia de roles gerava autorizacao divergente entre telas e APIs

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-02-11 **Severidade**: Critica (seguranca de acesso)
**Status**: Resolvido **Ambiente**: auth/guards/admin layout

#### Descricao

- Parte do sistema considerava apenas `ADMIN|CLIENT`, enquanto outras telas
  citavam `FINANCIAL/OPERATOR`, causando bloqueios indevidos e risco de acesso
  fora de escopo.

#### Causa raiz

- Enum/tipagem/sessao/guards nao estavam alinhados no mesmo conjunto de roles.

#### Solucao Implementada

1. Padronizacao de roles em Prisma + NextAuth: `ADMIN`, `FINANCIAL`, `OPERATOR`,
   `CLIENT`.
2. Guards centralizadas (`requireRoles`, `requirePermission`,
   `requireFinancialAccess`) em `middlewares/require-admin.ts`.
3. Layout/sidebar aplicam restricao de navegacao para `FINANCIAL`.
4. Matriz default de permissoes atualizada em `lib/permissions.ts`.

#### Arquivos Modificados

- `prisma/schema.prisma`
- `types/next-auth.d.ts`
- `lib/auth.ts`
- `middlewares/require-admin.ts`
- `lib/permissions.ts`
- `app/admin/layout.tsx`
- `components/admin/admin-sidebar.tsx`
- `components/admin/mobile-sidebar.tsx`

#### Como validar

1. Login com role `FINANCIAL`: acesso permitido em `/admin/financeiro`.
2. Role `FINANCIAL`: bloqueio/redirecionamento em `/admin/equipamentos`,
   `/admin/orcamentos`, `/admin/settings`.
3. Role `CLIENT`: bloqueio em qualquer `/admin/*`.

---

## 135. Fechamento de contrato seguia sem documentos minimos do cliente

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-02-11 **Severidade**: Alta (risco de fraude)
**Status**: Resolvido **Ambiente**: conversao de orcamento, checkout e ativacao
de locacao

#### Descricao

- Era possivel avancar para fechamento/ativacao sem coletar evidencias de
  identidade/contrato.

#### Causa raiz

- Nao havia bloqueio server-side por documentos obrigatorios.

#### Solucao Implementada

1. Modelo `ClientDocument` para armazenamento privado de anexos sensiveis.
2. Regras obrigatorias centralizadas em `lib/client-documents.ts`.
3. Bloqueio em:
   - conversao de orcamento para locacao
   - checkout de locacao
   - mudanca de status para `ACTIVE`
4. Upload/consulta com URL assinada curta (bucket privado).

#### Arquivos Modificados

- `prisma/schema.prisma`
- `lib/client-documents.ts`
- `app/api/admin/rentals/[id]/client-documents/route.ts`
- `app/api/admin/clients/[id]/documents/route.ts`
- `app/api/admin/quotes/[id]/convert-to-rental/route.ts`
- `app/api/admin/rentals/[id]/checkout/route.ts`
- `app/api/admin/rentals/[id]/route.ts`
- `app/admin/rentals/page.tsx`

#### Como validar

1. Tentar fechar contrato sem anexos obrigatorios.
2. Confirmar retorno `400` com `missingDocuments`.
3. Subir os 4 tipos obrigatorios e repetir operacao.
4. Confirmar que a operacao passa e documentos continuam privados.

---

## 134. Upload de imagens em equipamentos (novo/editar) não abria o seletor de arquivos

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-02-11 **Severidade**: Alta (admin) **Status**:
Resolvido **Ambiente**: `/admin/equipamentos/novo`,
`/admin/equipamentos/[id]/editar`, componente `ImageUpload`

#### Descricao

- Em "Novo Equipamento" e "Editar Equipamento", ao clicar em "Escolher Arquivos"
  ou em "Adicionar" (URL), o usuário não conseguia adicionar imagens ao
  equipamento (seletor de arquivos não abria ou fluxo não respondia).

#### Causa raiz

- O botão "Escolher Arquivos" dependia de `ref` em um componente `Input`
  (type="file") e de `fileInputRef.current?.click()`. Em alguns contextos
  (hidratação, forwardRef do `Input`) a ref não estava disponível ou o clique
  programático não disparava o input corretamente.

#### Solucao Implementada

1. **Input nativo para arquivo**: Substituído o componente `Input` por um
   `<input type="file">` nativo com `className="sr-only"` e `ref={fileInputRef}`
   para garantir que a ref aponte sempre ao elemento DOM real.
2. **Label associado ao input**: Quando o upload está habilitado, o botão
   visível passou a ser um `<Label htmlFor={fileInputId}>` estilizado como
   botão. Assim, o clique no "Escolher Arquivos" ativa nativamente o input via
   associação label/input, sem depender de `click()` via ref.
3. **Estado desabilitado**: Quando `isUploading` ou limite de imagens atingido,
   exibe-se um `<Button disabled>` com a mesma aparência, em vez do label, para
   desabilitar corretamente a ação.

#### Arquivos Modificados

- `components/ui/image-upload.tsx` — input nativo, label para "Escolher
  Arquivos", botão desabilitado quando aplicável.

#### Como validar

1. Acessar `/admin/equipamentos/novo` ou editar um equipamento.
2. Clicar em "Escolher Arquivos": o seletor de arquivos do sistema deve abrir.
3. Selecionar uma ou mais imagens (JPG/PNG/WebP, até 5MB cada): o upload deve
   ser enviado e as imagens aparecer na prévia.
4. Opção por URL: preencher uma URL válida e clicar em "Adicionar"; a imagem
   deve ser adicionada à lista.

---

## 135. Preview do Equipamento e ícone HybridTooltip sumiam quando havia apenas 1 imagem

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-02-13 **Severidade**: Média (admin/UX) **Status**:
Resolvido **Ambiente**: `/admin/equipamentos/[id]/editar`,
`/admin/equipamentos/novo`, componente `ImageUpload`

#### Descricao

- Na seção "Imagens do Equipamento" (editar/novo equipamento), o título "Preview
  do Equipamento" e o ícone de informação (HybridTooltip) só apareciam quando o
  equipamento tinha **mais de uma imagem**. Com apenas 1 imagem, o header
  (título + tooltip) não era exibido, dando a impressão de que o preview
  "sumiu".

#### Causa raiz

- No `ImageUpload`, o bloco que contém o título (`sectionTitle`) e o
  `HybridTooltip` estava inteiro dentro da condição
  `{images.length > 1 && ( ... )}`, pensada para esconder o indicador "X de Y"
  quando há uma só imagem. Com isso, título e ícone de dica também ficavam
  ocultos com 1 imagem.

#### Solucao Implementada

- O header (título "Preview do Equipamento" + ícone com HybridTooltip) passou a
  ser exibido sempre que houver pelo menos 1 imagem (`images.length >= 1`).
- O indicador "X de Y" (ex.: "2 de 3") permanece exibido apenas quando
  `images.length > 1`.

#### Arquivos Modificados

- `components/ui/image-upload.tsx` — header fora da condição
  `images.length > 1`; indicador "X de Y" mantido condicionado a
  `images.length > 1`.

#### Como validar

1. Acessar edição de um equipamento que tenha **apenas 1 imagem**.
2. Verificar que o título "Preview do Equipamento" e o ícone (i) com tooltip
   estão visíveis acima da imagem.
3. Adicionar uma segunda imagem e verificar que o indicador "2 de 2" aparece à
   direita do título, mantendo título e tooltip visíveis.

---

## 133. CI: Build falhava com JavaScript heap out of memory (OOM) durante "Running TypeScript"

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-02-08 **Severidade**: Alta (CI) **Status**:
Resolvido **Ambiente**: GitHub Actions, `pnpm build`, Next.js 16, fase "Running
TypeScript"

#### Descricao

- No CI (Tests & Quality), o step "Build application" falhava após "Compiled
  successfully" durante a fase "Running TypeScript" com:
  `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`.
- O runner ubuntu-latest tem ~7GB RAM. Com Postgres em execução, testes e build
  no mesmo job, a memória disponível era insuficiente para o processo de build
  do Next.js.

#### Causa raiz

- O build do Next.js (compilação + type-check interno) consome memória
  significativa.
- Postgres, testes e build competiam pela RAM do runner.
- `ignoreBuildErrors: !!process.env.CI` já estava ativo, mas a fase de
  type-check do Next.js ainda executa e consome memória.

#### Solucao Implementada

1. **Job separado para build**: Criado job `build` que depende de `test`,
   rodando em runner sem Postgres, com ~7GB livres para o build.
2. **Otimizações no next.config.mjs**:
   - `productionBrowserSourceMaps: false` (reduz memória)
   - `experimental.webpackMemoryOptimizations: true`
   - `serverSourceMaps: false` em CI
3. **NODE_OPTIONS**: `--max-old-space-size=5120` (5GB) no build, deixando margem
   para processos filhos.

#### Arquivos Modificados

1. `.github/workflows/ci.yml` — job `build` separado, NODE_OPTIONS=5120
2. `next.config.mjs` — productionBrowserSourceMaps, webpackMemoryOptimizations,
   serverSourceMaps

#### Como validar

1. Push para branch com CI ativo; o job "Build" deve passar após "Tests &
   Quality".
2. Localmente: `pnpm build` deve continuar funcionando.

---

## 132. CI: Type check falhava com JavaScript heap out of memory (OOM)

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-02-06 **Severidade**: Alta (CI) **Status**:
Resolvido **Ambiente**: GitHub Actions, `pnpm type-check`, `tsc --noEmit`

#### Descricao

- No CI (Tests & Quality / test), o step "Type check" falhava com erro fatal:
  `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`.
- O processo `tsc --noEmit` excedia o limite de heap do Node.js (~2GB padrão) no
  runner do GitHub Actions (7GB RAM total). Em codebases grandes (Next.js +
  muitas dependências), o compilador TypeScript consome memória significativa.

#### Causa raiz

- Node.js usa por padrão ~2GB de heap. O `tsc` precisa carregar todo o projeto e
  suas tipagens em memória; projetos grandes podem ultrapassar esse limite em
  runners com recursos limitados.

#### Solucao Implementada

- Definido `NODE_OPTIONS: --max-old-space-size=6144` no step "Type check" de
  todos os workflows ativos (`.github/workflows/ci.yml`, `test.yml`,
  `ci-fallback.yml`).
- O valor 6144 (6GB) usa a maior parte da RAM disponível do runner sem deixar o
  sistema sem memória.

#### Arquivos Modificados

1. `.github/workflows/ci.yml`
2. `.github/workflows/test.yml`
3. `.github/workflows/ci-fallback.yml`

#### Como validar

1. Fazer push para uma branch com CI ativo e conferir que o job "Tests &
   Quality" passa, incluindo o step "Type check".
2. Localmente: `pnpm type-check` continua funcionando sem alteração
   (NODE_OPTIONS é opcional localmente).

---

## 131. Google Maps: InvalidKeyMapError no console

### Problema / Solução (configuração)

**Data**: 2026-02-06 **Severidade**: Média **Status**: Documentado **Ambiente**:
`components/google-store-locator.tsx`, Google Maps JavaScript API

#### Descricao

- No console do navegador aparece:
  `Google Maps JavaScript API error: InvalidKeyMapError`
- Referência:
  [Error Messages - Google Maps](https://developers.google.com/maps/documentation/javascript/error-messages#invalid-key-map-error)

#### Causas comuns

1. **Chave ausente ou placeholder**: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` vazia ou
   com valor de exemplo (ex.: "sua-chave-google-maps").
2. **Chave inválida**: chave apagada, expirada ou digitada errada no
   `.env.local`.
3. **APIs não habilitadas**: no Google Cloud Console a chave precisa ter
   habilitadas: **Maps JavaScript API**, **Places API**, **Directions API**,
   **Distance Matrix API**.
4. **Restrições da chave**: em Credenciais → sua chave → Restrições de
   aplicativo. Se "Referentes HTTP" estiver ativo, inclua a origem (ex.:
   `http://localhost:*` para dev, `https://seudominio.com.br/*` para produção).
5. **Faturamento**: conta Google Cloud precisa ter faturamento ativado (há
   crédito gratuito; o mapa pode exibir aviso "for development purposes only" se
   houver problema de cobrança).

#### Solucao

1. Em [Google Cloud Console](https://console.cloud.google.com/) → APIs e
   serviços → Credenciais, crie ou edite uma chave de API.
2. Habilite as APIs listadas acima (APIs e serviços → Biblioteca).
3. Em `.env.local` defina
   `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="sua-chave-real-aqui"` (valor real, não
   placeholder).
4. Reinicie o servidor de desenvolvimento (`pnpm dev`) para recarregar variáveis
   de ambiente.
5. Se a chave tiver restrições por referrer, adicione `http://localhost:*` e o
   domínio de produção.

#### Comportamento no código

- Se a chave estiver vazia ou for um placeholder conhecido (ex.: "sua-chave",
  "your-api-key"), o componente **não** carrega o script do Google Maps e exibe
  a mensagem: "Configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para exibir o mapa."
  Assim evita-se o `InvalidKeyMapError` no console quando a chave não é válida.

#### Arquivos relacionados

- `components/google-store-locator.tsx`
- `docs/guides/google-business-profile-map.md`

---

## 130. Mapa (Store Locator) não carregava ao alternar entre páginas (SPA)

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-02-05 **Severidade**: Média (UX) **Status**:
Resolvido **Ambiente**: `/`, `/contato`, `components/google-store-locator.tsx`

#### Descricao

- Ao alternar entre a homepage e a página de contato (ou sair e voltar para uma
  delas), a área do mapa aparecia em branco/cinza. Era necessário dar refresh na
  página para o mapa voltar a ser exibido.

#### Causa raiz

- O mapa usa o next/script com `strategy="lazyOnload"` para carregar o Google
  Maps Extended Component Library (ECL). Na primeira visita o script carrega e
  `onLoad` dispara, setando `scriptLoaded` e configurando o localizador.
- Em navegação SPA (client-side), ao voltar para a página o script ECL já está
  no documento; o next/script não injeta de novo e **não chama onLoad de novo**.
  Assim `scriptLoaded` permanecia false na nova instância do componente e o mapa
  nunca era configurado.

#### Solucao Implementada

- **Detecção de ECL já carregado**: No mount, um `useEffect` verifica se o
  custom element `gmpx-store-locator` já está definido
  (`customElements.get(...)`). Se estiver (script já carregado em visita
  anterior), seta `scriptLoaded(true)` para que a configuração rode em toda
  visita.
- **Layout antes de configurar**: A chamada a `configureFromQuickBuilder` passou
  a ser feita dentro de um duplo `requestAnimationFrame`, garantindo que o
  container tenha dimensões calculadas antes da inicialização do mapa (evita
  mapa em branco por layout ainda não concluído).

#### Arquivos Modificados

1. `components/google-store-locator.tsx`

#### Como validar

1. Abrir a homepage e rolar até a seção com o mapa; conferir que o mapa aparece.
2. Navegar para `/contato` (link no menu) e conferir que o mapa "Onde estamos"
   aparece.
3. Voltar para a homepage e conferir que o mapa da seção de contato aparece sem
   refresh.
4. Repetir ida e volta várias vezes; o mapa deve carregar corretamente em todas.

---

## 129. WhatsApp admin: apenas texto na primeira fase (limitação conhecida)

### Limitação CONHECIDA (não é bug)

**Data**: 2026-02-02 **Severidade**: Baixa **Status**: Limitação planejada
**Ambiente**: `/admin/whatsapp`, Meta WhatsApp Cloud API

#### Descricao

- No painel admin WhatsApp, o envio de respostas e a exibição de mensagens
  suportam apenas **texto** na primeira fase. Mensagens do tipo imagem, áudio,
  vídeo ou documento recebidas via webhook são persistidas (tipo e body
  armazenados), mas a UI exibe "(mídia)" ou o body bruto; o envio de mídia pelo
  painel não está implementado.

#### Solucao / Evolução

- Fase posterior: exibir preview de mídia (imagem, áudio, vídeo, documento) e
  permitir envio de mídia via API Meta. Documentação da feature:
  `docs/features/admin-whatsapp-ui-ux.md`.

---

## 127. CI: Type check falhava com TS1109/TS1160 em .next/dev/types/routes.d.ts

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-02-02 **Severidade**: Alta (CI) **Status**:
Resolvido **Ambiente**: GitHub Actions, `pnpm type-check`,
`.next/dev/types/routes.d.ts`

#### Descricao

- No CI (Tests & Quality / test push), o step "Type check" falhava com erros
  TypeScript no arquivo gerado pelo Next.js:
  - TS1109: Expression expected (linhas 228–230)
  - TS1160: Unterminated template literal (linha 236)

#### Causa raiz

- O Next.js gera `routes.d.ts` (typed routes) em `.next/dev/types/` ou
  `.next/types/`. O `tsconfig.json` incluía explicitamente esses paths no
  `include`, então o `tsc --noEmit` validava o arquivo gerado.
- Em alguns cenários (muitas rotas dinâmicas, ambiente CI), o gerador produz
  sintaxe inválida (bug conhecido, ex.: vercel/next.js#86001).

#### Solucao Implementada

- Removidos do `tsconfig.json` os paths de `include` que referenciam
  `.next/types` e `.next/dev/types` (e variantes Windows), para que o type-check
  não valide arquivos gerados.
- Adicionado `typedRoutes: false` em `next.config.mjs` para evitar geração
  desnecessária de typed routes.
- Script `scripts/patch-next-env-for-typecheck.cjs` executado pelo
  `pnpm type-check`: (1) se `next-env.d.ts` não existir (ex.: CI, onde o arquivo
  está no `.gitignore` e só é gerado no build), o script cria um arquivo mínimo
  com as referências de tipos do Next; (2) se existir, remove a linha
  `import "./.next/.../routes.d.ts"` para evitar que o tsc carregue o arquivo
  gerado (que pode não existir ou estar malformado antes do build).

#### Arquivos Modificados

1. `tsconfig.json`
2. `next.config.mjs`
3. `.github/workflows/ci.yml`

#### Como validar

1. Fazer push para uma branch com CI ativo e conferir que o job "Tests &
   Quality" passa, incluindo o step "Type check".
2. Localmente: `pnpm type-check` deve concluir sem erros (com ou sem pasta
   `.next`).

---

## 128. Mensagem marcada como lida não persistia ao navegar (admin e-mail)

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-02-02 **Severidade**: Média (UX) **Status**:
Resolvido **Ambiente**: `/admin/email`, `app/api/admin/zoho-mail/messages`,
`app/api/admin/zoho-mail/messages/update`

#### Descricao

- Ao clicar em uma mensagem ou em "Marcar como lido", a mensagem era exibida
  como lida na hora, mas ao navegar para outra página e voltar para
  `/admin/email`, a mesma mensagem aparecia novamente como não lida.

#### Causa raiz

- **Listagem**: A API Zoho Mail retorna o estado de leitura no campo `status`
  (string `"0"` = não lido, `"1"` = lido). A rota GET
  `/api/admin/zoho-mail/messages` repassava o objeto bruto sem mapear `status`
  para `isRead`. O frontend só lia `m.isRead` (boolean), então `isRead` ficava
  sempre `undefined` e a UI tratava como não lida.
- **Update (opcional)**: Em conversas (threads), a API Zoho de update pode
  exigir `threadId` além de ou em vez de `messageId` para persistir a ação. Só
  enviávamos `messageIds`; em alguns casos a Zoho retornava sucesso mas não
  alterava o estado no servidor.

#### Solucao Implementada

- Na rota GET `/api/admin/zoho-mail/messages`: normalizar cada mensagem mapeando
  `status` (string/number "0"/"1") para `isRead` (boolean), com fallback para
  `msg.isRead` se já existir.
- No frontend (`normalizeEmailMessages`): fallback para aceitar `status`
  ("0"/"1") quando `isRead` não vier preenchido.
- Ao marcar como lida (clique na mensagem, botão "Marcar como lido" ou ação em
  massa): enviar `threadIds` quando a mensagem tiver `threadId`, para que a Zoho
  persista a alteração em conversas.

#### Arquivos Modificados

1. `app/api/admin/zoho-mail/messages/route.ts`
2. `app/admin/email/page.tsx`

#### Como validar

1. Em `/admin/email`, abrir uma mensagem não lida (clique na linha) ou clicar em
   "Marcar como lido" no hover.
2. Verificar que a mensagem aparece como lida (sem barra laranja e sem negrito).
3. Navegar para outra página do admin (ex.: Dashboard) e voltar para E-mail.
4. A mesma mensagem deve continuar exibida como lida.

---

## 126. ScrollArea: espessura inconsistente entre scrollbar vertical e horizontal

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-02-01 **Severidade**: Baixa (UX) **Status**:
Resolvido **Ambiente**: `components/ui/scroll-area.tsx`, `/admin/email`

#### Descricao

- Na visualização de e-mails em `/admin/email`, quando as barras vertical e
  horizontal aparecem juntas, a vertical parecia mais grossa.

#### Causa raiz

- O Radix define o tamanho do thumb via `style` inline usando variáveis CSS. No
  eixo perpendicular, a variável pode não existir (vertical não define
  `--radix-scroll-area-thumb-width`, horizontal não define
  `--radix-scroll-area-thumb-height`).
- Ajustes de espessura via classes Tailwind não sobrepunham o `style` inline,
  causando colapso visual do thumb em alguns cenários.

#### Solucao Implementada

- Espessura do thumb definida explicitamente por orientação via `style` (`width`
  no vertical, `height` no horizontal), garantindo override do inline do Radix e
  mantendo o comprimento calculado por ele.
- O thumb passou a usar `flex-none`, fixando a espessura em 8px.

#### Arquivos Modificados

1. `components/ui/scroll-area.tsx`

#### Como validar

1. Acessar `/admin/email` com uma mensagem que force overflow horizontal.
2. Confirmar que as barras vertical e horizontal têm a mesma espessura visual.
3. Verificar a lista de mensagens e a lista de pastas para garantir que o visual
   foi preservado.

---

## 125. Imagens inline de assinatura no e-mail admin não apareciam (ImageDisplay 404)

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-02-01 **Severidade**: Média (UX/Email) **Status**:
Resolvido **Ambiente**: `app/api/admin/zoho-mail/messages/[messageId]/route.ts`,
`/admin/email`

#### Descricao

- Ao visualizar mensagens em `/admin/email` (incluindo “Expandir”), as imagens
  da assinatura do cliente não apareciam.
- O console exibia requisições `GET /mail/ImageDisplay?... 404`.

#### Causa raiz

- O HTML retornado pelo Zoho vinha com URLs relativas `"/mail/ImageDisplay?..."`
  (webmail). O app tentava buscar essas imagens no próprio domínio (404).
- A lógica de normalização só reescrevia referências `cid:` para o proxy inline,
  deixando `ImageDisplay` intacto.

#### Solucao Implementada

- Adicionada reescrita de URLs `mail/ImageDisplay` para o proxy inline
  `/api/admin/zoho-mail/messages/[messageId]/inline`, reutilizando `cid` e
  `fileName` presentes na query.
- Mantida a sanitização HTML e o fluxo de preview sem alterações visuais.

#### Arquivos Modificados

1. `app/api/admin/zoho-mail/messages/[messageId]/route.ts`

#### Como validar

1. Abrir `/admin/email` e selecionar uma mensagem com assinatura que contenha
   imagens.
2. Clicar em "Expandir" e confirmar que as imagens são renderizadas.
3. Verificar que não há 404 para `/mail/ImageDisplay` no console; as imagens
   devem ser servidas via `/api/admin/zoho-mail/messages/.../inline`.

---

## 124. Refresh em páginas admin redirecionava para login e voltava ao dashboard

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-02-01 **Severidade**: Média (Auth/UX) **Status**:
Resolvido **Ambiente**: `app/admin/layout.tsx`, `/admin/*`

#### Descricao

- Ao dar refresh em qualquer página do admin (ex.: `/admin/email`), o app
  redirecionava para `/admin/login` e, em seguida, para `/admin/dashboard`,
  mesmo com sessão válida.
- O usuário não precisava logar novamente, mas perdia a rota original.

#### Causa raiz

- O layout do admin criava um `SessionProvider` próprio sem sessão inicial.
- O `useSession` começava como `loading/unauthenticated` e o effect do layout
  disparava `router.push('/admin/login')`.
- A página de login detectava sessão existente e redirecionava para
  `/admin/dashboard` (sem callback).

#### Solucao Implementada

- Removido o `SessionProvider` aninhado em `app/admin/layout.tsx`.
- O admin passa a usar o `SessionProvider` global (em `app/layout.tsx`) com
  sessão inicial do servidor, evitando o estado "unauthenticated" momentâneo no
  refresh.

#### Arquivos Modificados

1. `app/admin/layout.tsx`

#### Como Validar

1. Autenticar como admin.
2. Acessar `/admin/email` (ou qualquer rota admin).
3. Dar refresh na página.
4. Confirmar que não há redirecionamento para `/admin/login` e que a rota
   permanece a mesma.
5. Deslogar e tentar acessar `/admin/email`; deve continuar redirecionando para
   `/admin/login`.

---

## 123. Desarquivar (e outras ações de update) não funcionavam: messageId em formato errado

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-02-01 **Severidade**: Alta **Status**: Resolvido
**Ambiente**: `app/api/admin/zoho-mail/messages/update/route.ts`

#### Descricao

- Ao clicar em "Desarquivar" (ou marcar lido, destacar, arquivar), a mensagem
  não era atualizada no Zoho: a mensagem não ia para a Caixa de entrada ao
  desarquivar.

#### Causa raiz

- **Threads do Zoho**: Em algumas mensagens (conversas), a API de update espera
  `threadId` em vez de `messageId`. Enviar apenas `messageId` pode retornar
  sucesso, mas sem mover a mensagem.
- **Precisão de inteiros em JavaScript**: Os IDs do Zoho (ex.
  "1709887058769100001") excedem `Number.MAX_SAFE_INTEGER` (2^53 − 1). Converter
  com `Number(id)` perde precisão e o ID enviado à API fica incorreto.
- **Unarchive inconsistente**: Mesmo com IDs corretos, `unArchiveMails` pode não
  mover a mensagem de volta à Caixa de entrada em alguns casos. O caminho mais
  estável é mover explicitamente para o folder Inbox.

#### Solucao Implementada

- Incluir `threadId` na normalização da lista de mensagens e, ao desarquivar,
  enviar `threadIds` quando disponível (fallback para `messageIds`).
- Na rota de update, aceitar `threadIds` para ações compatíveis e enviar
  `threadId` no payload quando fornecido. Para `move`, enviar **threadId e
  messageId** juntos quando ambos existirem.
- Ao desarquivar, se o folder **Caixa de entrada** for encontrado, usar
  `action: 'move'` com `targetFolderId` (Inbox) em vez de `unarchive`,
  garantindo que a mensagem realmente volte para o Inbox.
- Para mover mensagens arquivadas, enviar `isArchive: true` e `folderId`
  (sourceFolderId) no payload de `move`, pois a Zoho ignora itens arquivados sem
  esse flag.
- Gerar o payload como **JSON bruto** com IDs numéricos (sem conversão para
  `Number`), montando o corpo manualmente a partir de strings digit-only. Isso
  preserva o valor exato e mantém o tipo numérico exigido pela Zoho.
- Validar a resposta da Zoho: se `result.status.code` existir e for diferente de
  200, retornar 400 com a descrição do erro, para o frontend reverter a
  atualização otimista e exibir o toast de erro.

#### Arquivos Modificados

1. `app/admin/email/page.tsx`
2. `components/admin/email/email-message-list.tsx`
3. `app/api/admin/zoho-mail/messages/update/route.ts`

#### Como validar

1. Em `/admin/email`, ir para a pasta "Arquivado".
2. Clicar em "Desarquivar" em uma mensagem: ela deve sumir da lista e aparecer
   na Caixa de entrada ao trocar de pasta.
3. Marcar como lido, destacar e arquivar (em outras pastas) devem continuar
   funcionando.

---

## 122. Botão Arquivar na pasta Arquivado e necessidade de Desarquivar

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-02-01 **Severidade**: Média (UX) **Status**:
Resolvido **Ambiente**: `app/admin/email/page.tsx`,
`components/admin/email/email-message-list.tsx`, `email-layout-container.tsx`,
`/admin/email`

#### Descricao

- Na pasta "Arquivado", o botão "Arquivar mensagem" ainda aparecia nas ações
  rápidas. Ao clicar, a mensagem sumia (atualização otimista), mas ao navegar e
  voltar ela reaparecia, pois a mensagem já estava arquivada e a API não
  alterava o estado.
- O usuário esperava: na pasta Arquivado não mostrar "Arquivar"; ou mostrar
  "Desarquivar" para devolver a mensagem à Caixa de entrada.

#### Causa raiz

- A lista de mensagens sempre exibia o botão "Arquivar" (onQuickArchive),
  independentemente da pasta atual. Na pasta Arquivado, arquivar de novo não
  altera o lado do servidor e, ao refetch, a mensagem voltava.

#### Solucao Implementada

- **isArchiveFolder**: Na page, `isArchiveFolder` é derivado de
  `folders.some(f => f.folderId === selectedFolderId && f.folderName === 'Arquivado')`.
- **Na pasta Arquivado**: Em vez de "Arquivar", exibir o botão "Desarquivar"
  (ícone `ArchiveRestore`, aria-label "Desarquivar mensagem (voltar para Caixa
  de entrada)").
- **handleUnarchiveMessage**: Chama a API
  `PUT /api/admin/zoho-mail/messages/update` com `action: 'unarchive'`.
  Atualização otimista: remove a mensagem da lista; em erro, re-insere e exibe
  toast de erro.
- Props `onQuickUnarchive` e `isArchiveFolder` propagadas da page para o layout
  e para `EmailMessageList`.

#### Arquivos Modificados

1. `app/admin/email/page.tsx`
2. `components/admin/email/email-message-list.tsx`
3. `components/admin/email/email-layout-container.tsx`

#### Como validar

1. Abrir `/admin/email` e ir para a pasta "Arquivado".
2. Verificar que o botão de ação rápida é "Desarquivar" (ícone de restaurar),
   não "Arquivar".
3. Clicar em "Desarquivar" em uma mensagem: ela deve sumir da lista e um toast
   informar que voltou para a Caixa de entrada.
4. Ir para "Caixa de entrada" e confirmar que a mensagem aparece lá.
5. Em qualquer outra pasta (ex.: Caixa de entrada), o botão deve continuar sendo
   "Arquivar".

---

## 121. Ações rápidas na lista de e-mail admin demoravam para executar (lentidão ao clicar)

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-02-01 **Severidade**: Média (UX) **Status**:
Resolvido **Ambiente**: `app/admin/email/page.tsx`, `/admin/email`

#### Descricao

- Os botões de ação na lista de mensagens (Marcar como lido, Arquivar, Excluir,
  Destacar) em `/admin/email` demoravam para refletir a ação após o clique: a UI
  só atualizava depois da resposta da API, gerando sensação de lentidão.

#### Causa raiz

- Todas as ações (handleMessageUpdateById, handleArchiveMessage,
  handleDeleteMessage, handleToggleStar) faziam `await fetch(...)` e só então
  chamavam `setMessages` / `setCurrentMessage` / etc. Ou seja, não havia
  atualização otimista: o usuário esperava a latência da rede + Zoho API antes
  de ver qualquer mudança.

#### Solucao Implementada

- **Atualização otimista**: Em cada handler, a UI é atualizada imediatamente
  (setMessages, setCurrentMessage, setFullViewMessage, toasts) e em seguida a
  requisição é enviada. Se a API retornar erro ou houver falha de rede, o estado
  é revertido (mensagem volta à lista ou valor anterior) e um toast de erro é
  exibido.
- **Ref para revert em archive/delete**: `removedMessageForRevertRef` guarda a
  mensagem removida da lista para re-inseri-la em caso de erro.
- Aplica-se a: marcar como lido/não lido, arquivar, excluir, destacar.

#### Arquivos Modificados

1. `app/admin/email/page.tsx`

#### Como validar

1. Abrir `/admin/email` e carregar mensagens.
2. Clicar em Marcar como lido, Arquivar, Excluir ou Destacar: a mudança deve
   aparecer na lista de imediato.
3. Simular erro (ex.: desconectar rede) e clicar em uma ação: a UI deve reverter
   e exibir toast de erro.

---

## 120. Lista de e-mail admin: não era possível selecionar texto da mensagem (só o container)

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-02-01 **Severidade**: Baixa **Status**: Resolvido
**Ambiente**: `components/admin/email/email-message-list.tsx`, `/admin/email`

#### Descricao

- Na lista de mensagens do `/admin/email`, ao tentar selecionar o texto
  (remetente, assunto, resumo) para copiar, o usuário acabava selecionando o
  container inteiro ou o clique abria a mensagem em vez de permitir seleção de
  texto.

#### Causa raiz

- A área de conteúdo da linha usava `role="button"` e `onClick` para abrir a
  mensagem, sem `user-select: text`, e qualquer clique acionava a abertura.
- Não havia distinção entre “clique para abrir” e “arrastar para selecionar
  texto”.

#### Solucao Implementada

1. Adicionada classe `select-text` (user-select: text) na área de conteúdo
   (remetente, data, assunto) e no parágrafo de resumo, permitindo seleção de
   texto.
2. No `onClick` da área de conteúdo: só chama `handleRowActivate` (abrir
   mensagem) se não houver seleção de texto
   (`window.getSelection()?.toString().trim()` vazio). Assim, arrastar para
   selecionar não abre a mensagem; clique simples continua abrindo.

#### Arquivos Modificados

1. `components/admin/email/email-message-list.tsx`

#### Como validar

1. Abrir `/admin/email` e carregar mensagens.
2. Arrastar o mouse sobre remetente/assunto/resumo: o texto deve ser
   selecionável e copiável; ao soltar após selecionar, a mensagem não deve
   abrir.
3. Clicar (sem arrastar) na linha: a mensagem deve abrir no preview.

---

## 103. Composer e atalhos e-mail admin - activeDraftId, debounce, shortcuts

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-30 **Severidade**: Media **Status**: Resolvido
**Ambiente**: `components/admin/email/email-composer-dialog.tsx`,
`app/admin/email/page.tsx`

#### Descricao

1. **activeDraftId stale**: O effect síncronizava `activeDraftId` apenas quando
   `draftMessageId != null`. Ao cancelar (draftMessageId -> null), não limpava.
2. **Auto-save debounce**: O effect dependia de `handleSaveDraft`, que mudava a
   cada tecla, causando re-runs constantes e possíveis closures obsoletas.
3. **Filtro de data**: Limites do dia usavam `setHours` em datas que podiam ter
   formato ambíguo; construtor explícito evita isso.
4. **Atalhos de teclado**: O effect dependia de callbacks que mudam, gerando
   re-subscrições desnecessárias ao `keydown`.

#### Solucao Implementada

1. Effect de sync: `setActiveDraftId(draftMessageId ?? null)` sempre que
   `isOpen` (incluindo quando `draftMessageId` vira null).
2. `handleSaveDraftRef` guarda o callback; effect depende de campos do form (to,
   cc, subject, etc.) e chama `handleSaveDraftRef.current(true)` no timeout.
3. Construtor `new Date(y, m, d, 0,0,0,0)` e `(y, m, d, 23,59,59,999)` para
   limites explícitos do dia local.
4. `handlersRef` guarda callbacks; effect de keydown com `[]` deps, usa refs.

#### Arquivos Modificados

1. `components/admin/email/email-composer-dialog.tsx`
2. `app/admin/email/page.tsx`
3. `CHANGELOG.md`

---

## 104. DateRangePicker no e-mail admin nao concluia intervalo (start/end)

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-30 **Severidade**: Media (filtro nao aplicava)
**Status**: Resolvido **Ambiente**: `components/ui/date-range-picker.tsx`,
`app/admin/email/page.tsx`

#### Descricao

- Ao selecionar uma data inicial no filtro de periodo do `/admin/email`, a data
  nao permanecia selecionada visualmente e o segundo clique iniciava um novo
  inicio em vez de completar o intervalo.
- Resultado: o usuario nao conseguia definir data final (endDate), ficando com
  apenas uma data no input.

#### Causa Raiz

- O `DateRangePicker` redefinia `selectedRange` para `undefined` sempre que
  `endDate` era `null`, apagando a selecao do inicio. Como o `DayPicker` é
  controlado por `selected`, isso impedia a transicao para o estado de intervalo
  completo.

#### Solucao Implementada

- Manter `selectedRange` quando existe `startDate`, usando
  `{ from: startDate, to: endDate ?? undefined }`.
- Inicializar o estado interno do `DateRangePicker` com `startDate` mesmo sem
  `endDate`, preservando a selecao e permitindo completar o range no segundo
  clique.

#### Arquivos Modificados

1. `components/ui/date-range-picker.tsx`
2. `docs/issues/known-issues.md`
3. `CHANGELOG.md`

#### Como Validar

1. Abrir `/admin/email` e clicar em "Filtrar por período".
2. Selecionar uma data de inicio e, em seguida, outra data para o fim.
3. Confirmar que o range aparece no calendario e o input mostra `inicio - fim`.

---

## 105. DateRangePicker com navegacao de mes/ano travada no admin

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-30 **Severidade**: Media (UX bloqueada)
**Status**: Resolvido **Ambiente**: `components/ui/date-range-picker.tsx`

#### Descricao

- No filtro de periodo do `/admin/email`, os dropdowns de mes/ano e as setas de
  navegacao nao alteravam o calendario. Clicar nao mudava o mes exibido.

#### Causa Raiz

- O `DayPicker` estava controlado por `month={startDate || today}`. Isso travava
  a navegacao interna: qualquer tentativa de mudar mes/ano era sobrescrita pelo
  valor fixo.

#### Solucao Implementada

- Removido o prop `month` para permitir que o `DayPicker` gerencie a navegacao
  interna (mes/ano). Mantido `defaultMonth` para iniciar no mes desejado.

#### Arquivos Modificados

1. `components/ui/date-range-picker.tsx`
2. `docs/issues/known-issues.md`
3. `CHANGELOG.md`

#### Como Validar

1. Abrir `/admin/email` e abrir o filtro de periodo.
2. Usar as setas e os dropdowns de mes/ano.
3. Confirmar que o calendario muda para o mes/ano selecionado.

---

## 106. DateRangePicker no admin limitava anos ao ano atual

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-30 **Severidade**: Baixa (UX) **Status**:
Resolvido **Ambiente**: `components/ui/date-range-picker.tsx`

#### Descricao

- No filtro de periodo do `/admin/email`, o dropdown de anos não permitia
  selecionar o ano seguinte nem acessar anos anteriores quando `allowPastDates`
  estava ativo.

#### Causa Raiz

- Com `captionLayout="dropdown"` e sem `toYear`, o DayPicker limita o fim da
  navegacao ao fim do ano atual. O `fromMonth` continuava no mês atual mesmo
  quando `allowPastDates` era true, restringindo anos anteriores.

#### Solucao Implementada

- `fromMonth` agora parte do mês de `effectiveMinDate`, permitindo navegação a
  anos anteriores quando `allowPastDates` está ativo.
- Definido `toYear` quando `maxDate` não é informado (ano atual + 1), liberando
  o próximo ano no dropdown.

#### Arquivos Modificados

1. `components/ui/date-range-picker.tsx`
2. `docs/issues/known-issues.md`
3. `CHANGELOG.md`

#### Como Validar

1. Abrir `/admin/email` e abrir o filtro de periodo.
2. Verificar que o dropdown de anos inclui o ano seguinte.
3. Selecionar um ano anterior (com `allowPastDates`) e confirmar a navegação.

---

## 107. DateRangePicker exibia apenas toast final no filtro de periodo

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-30 **Severidade**: Media (UX) **Status**:
Resolvido **Ambiente**: `components/ui/date-range-picker.tsx`

#### Descricao

- Ao abrir o calendario e selecionar o intervalo no filtro do `/admin/email`,
  apenas a toast final de sucesso aparecia; as toasts guiadas de inicio/fim nao
  eram exibidas.

#### Causa Raiz

- As toasts estavam baseadas em `selectedRange`. No primeiro clique o
  `react-day-picker` define `from` e `to` no mesmo dia, fazendo o componente
  interpretar como intervalo completo e disparar a toast final.

#### Solucao Implementada

- As toasts passaram a usar `startDate`/`endDate` (estado real do filtro).
- A mensagem de sucesso foi alinhada ao mesmo texto usado no calendario de
  visualizar equipamentos.

#### Arquivos Modificados

1. `components/ui/date-range-picker.tsx`
2. `docs/issues/known-issues.md`
3. `CHANGELOG.md`

#### Como Validar

1. Abrir `/admin/email` e clicar no filtro de periodo.
2. Selecionar a data de inicio: deve aparecer a toast solicitando a data final.
3. Selecionar a data final: deve aparecer a toast de sucesso.

---

## 108. Toasts do admin sobrepunham o header

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-30 **Severidade**: Baixa (UX) **Status**:
Resolvido **Ambiente**: `components/ui/sonner-toaster.tsx`

#### Descricao

- No painel admin, as toasts Sonner apareciam parcialmente sobre o header fixo
  (ex.: saudacao "Bom dia" no desktop), dificultando a leitura.

#### Causa Raiz

- O toaster do admin estava com `top: 16px`, ignorando a altura do header
  desktop (64px) e a area de status + header no mobile.

#### Solucao Implementada

- Ajustado o offset do toaster no admin para considerar a altura do header:
  `calc(64px + 16px)` no desktop.
- No mobile, o offset considera a area de status + header:
  `calc(64px + max(44px, env(safe-area-inset-top, 0px)) + 16px)`.

#### Arquivos Modificados

1. `components/ui/sonner-toaster.tsx`
2. `docs/issues/known-issues.md`
3. `CHANGELOG.md`

#### Como Validar

1. Em `/admin/email`, acionar uma toast (ex.: abrir o filtro de periodo).
2. Confirmar que a toast aparece abaixo do header, sem sobreposicao.
3. Repetir em viewport mobile e verificar o offset abaixo do header mobile.

---

## 109. Bloco de mensagens no e-mail admin cortado no mobile

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-31 **Severidade**: Media (UX) **Status**:
Resolvido **Ambiente**: `components/admin/email/email-layout-container.tsx`

#### Descricao

- No mobile, o bloco de mensagens do `/admin/email` ficava cortado na base.
- O painel de pastas ocupava altura demais e o restante do card nao sobrava
  espaço suficiente para o bloco de mensagens.

#### Causa Raiz

- O container das pastas no layout mobile nao tinha limite de altura. Em telas
  menores, ele crescia conforme o conteudo e reduzia o espaço do painel de
  mensagens, que acabava truncado pelo `overflow-hidden`.

#### Solucao Implementada

- Limitada a altura do painel de pastas no mobile (`max-h-[45%]`) e reduzida a
  altura minima para liberar espaço para a lista de mensagens.

#### Arquivos Modificados

1. `components/admin/email/email-layout-container.tsx`
2. `docs/issues/known-issues.md`
3. `CHANGELOG.md`

#### Como Validar

1. Abrir `/admin/email` em viewport mobile.
2. Verificar que o bloco de mensagens não fica cortado e a área de mensagens
   permanece visível.
3. Confirmar que a lista de pastas continua rolável quando houver muitas pastas.

---

## 110. Ações rápidas na lista de e-mail admin geravam botão aninhado

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-31 **Severidade**: Media (hydration warning)
**Status**: Resolvido **Ambiente**:
`components/admin/email/email-message-list.tsx`

#### Descricao

- Ao renderizar a lista de mensagens do `/admin/email`, o console exibia: "In
  HTML, `<button>` cannot be a descendant of `<button>`."
- A linha da mensagem era um `<button>` e continha botões internos (estrela e
  ações rápidas), causando nesting inválido e hydration warning.

#### Causa Raiz

- A área clicável principal da mensagem era um `<button>` que continha outros
  `<button>` para ações rápidas, o que viola as regras de DOM do HTML.

#### Solucao Implementada

- A área clicável principal passou a ser um `<div role="button">` com
  `tabIndex={0}` e handler de teclado (Enter/Espaço), mantendo acessibilidade e
  removendo o nesting inválido.

#### Arquivos Modificados

1. `components/admin/email/email-message-list.tsx`
2. `docs/issues/known-issues.md`
3. `CHANGELOG.md`

#### Como Validar

1. Abrir `/admin/email` e observar o console: nenhum erro de botão aninhado.
2. Clicar em uma mensagem: preview abre normalmente.
3. Clicar na estrela e nas ações rápidas: funcionam sem abrir a mensagem.

---

## 111. Visualização de mensagem do Zoho Mail retornava 500 no /admin/email

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-31 **Severidade**: Alta (preview não carregava)
**Status**: Resolvido **Ambiente**:
`app/api/admin/zoho-mail/messages/[messageId]/route.ts`

#### Descricao

- Ao selecionar uma mensagem em `/admin/email`, a requisição
  `/api/admin/zoho-mail/messages/[messageId]` retornava 500.
- A lista carregava corretamente, mas o preview falhava para qualquer mensagem.

#### Causa Raiz

- A rota tentava buscar a mensagem pelo endpoint errado. A Zoho Mail API exige
  os endpoints específicos de **detalhes** e **conteúdo** dentro da pasta para
  obter metadados e o corpo da mensagem.

#### Solucao Implementada

- A rota passou a buscar:
  - `.../folders/{folderId}/messages/{messageId}/details` (metadados)
  - `.../folders/{folderId}/messages/{messageId}/content` (corpo HTML)
  - `.../attachmentinfo` quando houver anexos

#### Arquivos Modificados

1. `app/api/admin/zoho-mail/messages/[messageId]/route.ts`
2. `docs/issues/known-issues.md`
3. `CHANGELOG.md`

#### Como Validar

1. Abrir `/admin/email` e selecionar uma mensagem.
2. Confirmar que o preview carrega o conteúdo e o endpoint retorna 200.

---

## 112. Ações rápidas de leitura/arquivo/destaque no Zoho Mail retornavam 500

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-31 **Severidade**: Media (ações não funcionavam)
**Status**: Resolvido **Ambiente**:
`app/api/admin/zoho-mail/messages/update/route.ts`

#### Descricao

- Ao marcar como lida/não lida, mover mensagens ou clicar em "Destacar" no
  `/admin/email`, a rota `/api/admin/zoho-mail/messages/update` retornava 500.

#### Causa Raiz

- A rota usava o endpoint incorreto (`/messages/update`) e o modo/param de mover
  mensagens não seguia o padrão da Zoho Mail API.
- **Destacar/remover destaque**: a Zoho Mail API não possui modos
  `starMessages`/`unstarMessages`; usa `setFlag` com `flagid: "important"` ou
  `flagid: "flag_not_set"` (ver
  [Flag Emails](https://www.zoho.com/mail/help/api/set-flag-for-email.html)).

#### Solucao Implementada

- Ajustado o endpoint para `/accounts/{accountId}/updatemessage`.
- Corrigido o modo `move` para `moveMessage` e o parâmetro `destfolderId`.
- Corrigido star/unstar para usar `mode: "setFlag"` com `flagid: "important"`
  (destacar) ou `flagid: "flag_not_set"` (remover destaque).

#### Arquivos Modificados

1. `app/api/admin/zoho-mail/messages/update/route.ts`
2. `docs/issues/known-issues.md`
3. `CHANGELOG.md`

#### Como Validar

1. Em `/admin/email`, usar ação rápida "Marcar como lido".
2. Clicar no botão "Destacar" (estrela) em uma mensagem.
3. Confirmar que as ações retornam 200 e a UI atualiza corretamente.

---

## 113. Preview do e-mail com ações sobrepostas ao conteúdo

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-31 **Severidade**: Media (UX confusa)
**Status**: Resolvido **Ambiente**: `components/admin/email/email-viewer.tsx`

#### Descricao

- No preview de mensagem, os botões de ação ficavam sobrepostos aos metadados
  (De/Para/horário), deixando o layout desorganizado.

#### Causa Raiz

- O header agrupava todas as ações em uma única linha flexível, sem empilhamento
  responsivo, causando quebra visual em larguras menores.

#### Solucao Implementada

- Header reorganizado em duas linhas de ações (primárias e secundárias) e
  empilhamento responsivo para evitar sobreposição com os metadados.
- Largura dos dropdowns "Mover para" ajustada com min/max para manter
  alinhamento visual sem ocupar linha inteira.
- Estilo e altura dos dropdowns alinhados ao padrão de botões outline.
- Hover e sombra agora seguem o mesmo comportamento dos botões irmãos.

#### Arquivos Modificados

1. `components/admin/email/email-viewer.tsx`
2. `docs/issues/known-issues.md`
3. `CHANGELOG.md`

#### Como Validar

1. Abrir `/admin/email` e selecionar uma mensagem.
2. Confirmar que os botões não sobrepõem o conteúdo e o layout fica alinhado.

---

## 119. Preferencia de layout salvava campo "folders" inutil

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-31 **Severidade**: Baixa (higiene de dados)
**Status**: Resolvido **Ambiente**:
`components/admin/email/email-layout-container.tsx`

#### Descricao

- O `localStorage` do layout salvava `folders: 20`, mas esse valor não é lido ou
  usado em nenhum lugar.
- Isso gerava poluição de dados e confusão sobre o que é realmente persistido.

#### Causa Raiz

- Campo legado/debug foi mantido no `setItem` após ajustes no layout.

#### Solucao Implementada

- Removido `folders` das gravações no `localStorage`, mantendo apenas `messages`
  e `preview`.

#### Arquivos Modificados

1. `components/admin/email/email-layout-container.tsx`
2. `docs/issues/known-issues.md`
3. `CHANGELOG.md`

#### Como Validar

1. Abrir `/admin/email`.
2. Redimensionar os painéis.
3. Inspecionar `localStorage["email-panel-sizes"]` e confirmar que só existem
   `messages` e `preview`.

---

## 118. Mensagens sem maxSize permitia preview violar minSize

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-31 **Severidade**: Media (layout responsivo)
**Status**: Resolvido **Ambiente**:
`components/admin/email/email-layout-container.tsx`

#### Descricao

- O painel de mensagens tinha `minSize={30}`, mas nenhum `maxSize`, enquanto o
  preview tinha `minSize`/`maxSize` dinamicos.
- Esse desequilibrio permitia que mensagens crescesse demais (ex.: >70%),
  comprimindo o preview abaixo do minimo.

#### Causa Raiz

- A falta de `maxSize` no painel de mensagens nao refletia o limite minimo do
  preview.

#### Solucao Implementada

- Adicionado `maxSize` em mensagens como `100 - previewMin`, mantendo o preview
  acima do seu minimo e evitando estados invalidos.

#### Arquivos Modificados

1. `components/admin/email/email-layout-container.tsx`
2. `docs/issues/known-issues.md`
3. `docs/features/admin-email-ui-ux.md`
4. `CHANGELOG.md`

#### Como Validar

1. Abrir `/admin/email` em desktop.
2. Redimensionar a lista de mensagens e confirmar que ela nao passa do limite e
   o preview nao fica abaixo do minimo.

---

## 117. ResizablePanel interpreta numeros como px (percentual precisa de "%")

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-31 **Severidade**: Media (layout responsivo)
**Status**: Resolvido **Ambiente**:
`components/admin/email/email-layout-container.tsx`

#### Descricao

- `defaultSize`, `minSize` e `maxSize` estavam sendo passados como números (ex.:
  `30`), mas o `ResizablePanel` interpreta números como **pixels**.
- Isso travava o resize em determinados tamanhos, já que 30px/40px eram
  aplicados onde se esperava percentuais.

#### Causa Raiz

- Uso de números sem unidade; o `react-resizable-panels` trata números como px,
  então percentuais precisam ser strings com `%`.

#### Solucao Implementada

- Os tamanhos passaram a ser enviados como string com `%` (ex.: `"30%"`),
  mantendo os bounds calculados e a normalização de preferências.

#### Arquivos Modificados

1. `components/admin/email/email-layout-container.tsx`
2. `docs/issues/known-issues.md`
3. `docs/features/admin-email-ui-ux.md`
4. `CHANGELOG.md`

#### Como Validar

1. Abrir `/admin/email` em desktop.
2. Redimensionar o painel de preview e confirmar que o sizing responde
   corretamente em diferentes larguras.

---

## 116. Sync de bounds ignorava minSize do painel de mensagens

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-31 **Severidade**: Media (layout responsivo)
**Status**: Resolvido **Ambiente**:
`components/admin/email/email-layout-container.tsx`

#### Descricao

- O efeito de sincronização de bounds ajustava `preview` e calculava
  `messages = 100 - preview` sem garantir que o painel de mensagens respeitasse
  `minSize={30}`.
- Em `previewBounds.max` altos (ex.: 80%), o ajuste forçava `messages < 30%`,
  salvando valores inválidos no localStorage e podendo travar o resize.

#### Causa Raiz

- O clamp do preview ignorava o limite mínimo do painel de mensagens ao
  sincronizar e persistir tamanhos.

#### Solucao Implementada

- Bounds efetivos do preview passaram a considerar `messages >= 30%`, ajustando
  `max` para `100 - minMessages` e garantindo um range mínimo.
- O efeito de sincronização agora usa esses bounds efetivos antes de salvar os
  tamanhos no localStorage.

#### Arquivos Modificados

1. `components/admin/email/email-layout-container.tsx`
2. `docs/issues/known-issues.md`
3. `docs/features/admin-email-ui-ux.md`
4. `CHANGELOG.md`

#### Como Validar

1. Abrir `/admin/email` em desktop.
2. Forçar um `previewBounds.max` alto (ex.: largura ampla) e verificar que o
   painel de mensagens nunca fica abaixo de 30%.
3. Recarregar a página e confirmar que o layout não aplica tamanhos inválidos
   nem trava o resize.

---

## 115. Range de bounds do preview < 5% em container 500–600px

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-31 **Severidade**: Media (layout responsivo)
**Status**: Resolvido **Ambiente**:
`components/admin/email/email-layout-container.tsx`

#### Descricao

- Com largura do container entre 500–600px, o cálculo de bounds do painel de
  preview podia gerar intervalo inválido: quando `minPercent` ficava entre
  95–99%, o else do fallback definia `min = minPercent` e
  `max = Math.min(100, minPercent + MIN_BOUND_RANGE)`, resultando em
  `max - min < 5` (ex.: min=96, max=100 → range 4). O preview ficava com tamanho
  inválido ou irredimensionável.

#### Causa Raiz

- O else não garantia `max - min >= MIN_BOUND_RANGE` quando
  `minPercent + MIN_BOUND_RANGE > 100`, pois `max` era limitado a 100 e `min`
  permanecia `minPercent`.

#### Solucao Implementada

- Inclusão de ramo explícito: se `minPercent + MIN_BOUND_RANGE > 100`, definir
  `min = 100 - MIN_BOUND_RANGE`, `max = 100`, mantendo range de 5%. Caso
  contrário, `min = minPercent`, `max = minPercent + MIN_BOUND_RANGE`.

#### Arquivos Modificados

1. `components/admin/email/email-layout-container.tsx`
2. `docs/issues/known-issues.md`
3. `CHANGELOG.md`

#### Como Validar

1. Abrir `/admin/email` com viewport entre 500–600px de largura (área do
   ResizablePanelGroup).
2. Arrastar o handle entre lista e preview e confirmar que o preview respeita um
   range de pelo menos 5% e redimensiona corretamente.

---

## 114. Limites de resize do preview no e-mail admin usavam pixels sem conversao

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-31 **Severidade**: Media (layout responsivo)
**Status**: Resolvido **Ambiente**:
`components/admin/email/email-layout-container.tsx`

#### Descricao

- O painel de preview do `/admin/email` usava `minSize={500}` e `maxSize={800}`
  no `ResizablePanel`.
- O componente espera percentuais com unidade (ex.: `"30%"`). Números sem
  unidade são tratados como pixels, então os limites ficavam inválidos e o
  painel não respeitava o resize em diferentes larguras.

#### Causa Raiz

- Os limites de resize foram definidos em pixels e passados como número sem
  unidade, mas o `react-resizable-panels` interpreta número como px.

#### Solucao Implementada

- Convertidos os limites de 500px/800px para percentuais com base na largura
  atual do container, mantendo a intenção de tamanho em pixels sem quebrar o
  layout responsivo.
- Preferências salvas do layout agora são normalizadas e ajustadas aos limites
  calculados, evitando painéis presos quando houver valores fora do intervalo.
- Os limites e tamanhos padrão agora são enviados como string com `%` para que a
  lib interprete corretamente como percentual.

#### Arquivos Modificados

1. `components/admin/email/email-layout-container.tsx`
2. `docs/issues/known-issues.md`
3. `CHANGELOG.md`

#### Como Validar

1. Abrir `/admin/email` em viewport desktop.
2. Arrastar o handle entre lista e preview e confirmar que o preview respeita o
   mínimo (~500px) e o máximo (~800px) conforme a largura disponível.
3. Reduzir a largura da janela e verificar que o resize continua funcionando com
   limites ajustados por percentual.

---

## 100. Dropdown de notificacoes/usuario do admin desalinhado ou cortado no mobile

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-29 **Severidade**: Baixa (UX) **Status**:
Resolvido **Ambiente**: `components/admin/admin-header-actions.tsx`

#### Descricao

- No header admin em modo mobile, o dropdown de notificacoes e o menu do usuario
  ficavam deslocados ou cortados (bloco cortado pela metade na borda da tela).
- Largura fixa (w-80 / w-56) fazia o bloco ultrapassar a viewport em telas
  estreitas.

#### Causa Raiz

- Dropdowns com largura fixa e sem limite para viewport; sem `collisionPadding`
  para o Radix reposicionar dentro da tela.

#### Solucao Implementada

- **Mobile**: largura dos dois dropdowns (notificacoes e usuario) definida como
  `w-[calc(100vw-2rem)]` e `max-w-[calc(100vw-2rem)]` para caber na tela com
  margem de 1rem de cada lado.
- **CollisionPadding**: `collisionPadding={16}` no mobile (8 no desktop) para o
  Radix manter o conteudo dentro da viewport.
- Mantidos `align="end"`, `alignOffset` e `sideOffset` no dropdown de
  notificacoes para alinhamento ao sino.

#### Arquivos Modificados

1. `components/admin/admin-header-actions.tsx`
2. `docs/issues/known-issues.md`

#### Como Validar

1. Abrir `/admin/email` ou `/admin/dashboard` em viewport mobile (<= 767px).
2. Abrir o dropdown do sino (notificacoes) e o do avatar (menu usuario).
3. Confirmar que nenhum bloco e cortado; ambos devem caber na largura da tela.

---

## 101. Paginacao "Carregar mais" na lista de e-mail admin - offset correto

### Verificado (comportamento correto, nao alterar)

**Data**: 2026-01-29 **Ambiente**: `app/admin/email/page.tsx` — `handleLoadMore`

#### Contexto

- A lista de mensagens em `/admin/email` tem busca e filtros rapidos
  (client-side).
- O botao "Carregar mais" chama a API com `start` para paginacao.

#### Comportamento esperado

- O offset de paginacao **deve** ser `messages.length` (quantidade de mensagens
  ja buscadas do servidor), **nao** `filteredMessages.length`.
- A API `/api/admin/zoho-mail/messages` nao suporta filtros; retorna paginas da
  pasta inteira (`limit`, `start`). A filtragem (busca, nao lidas, destacadas,
  com anexos) e feita no client a partir de `messages`.
- Usar `filteredMessages.length` como offset pediria a pagina errada ao servidor
  (ex.: start=10 em vez de 50), gerando duplicatas ou mensagens faltando.

#### Como validar

- Com filtro ativo (ex.: "Nao lidas"), carregar mais: a lista deve ganhar mais
  itens sem duplicar nem pular mensagens; o offset na URL deve ser o numero
  total ja carregado (ex.: 50, 100).

---

## 102. Filtro por periodo no e-mail admin - timezone e timestamps

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-30 **Severidade**: Media (filtro incorreto)
**Status**: Resolvido **Ambiente**: `app/admin/email/page.tsx` — filtro por
`dateStart`/`dateEnd`

#### Descricao

- O filtro por periodo (data inicio/fim) na lista de mensagens em `/admin/email`
  usava `setUTCHours(0,0,0,0)` e `setUTCHours(23,59,59,999)` para definir o
  intervalo do dia.
- Isso fazia o intervalo ser o **dia em UTC**, nao o dia no fuso do usuario. Em
  fusos diferentes de UTC, mensagens podiam ser excluidas ou incluídas no dia
  errado (ex.: usuario em UTC-3 seleciona "30 Jan"; mensagens da noite de 29 Jan
  local apareciam no filtro de "30 Jan").

#### Causa Raiz

- Limites do intervalo definidos em UTC em vez do dia do calendario local do
  usuario. A API Zoho retorna `receivedTime`/`sentTime` em milissegundos UTC; a
  comparacao deve ser entre esse valor e o intervalo **do dia local** do usuario
  (inicio e fim do dia no fuso do cliente).

#### Solucao Implementada

- Usar `setHours(0, 0, 0, 0)` e `setHours(23, 59, 59, 999)` (hora local) para
  que o intervalo seja o dia do calendario no fuso do usuario. Os timestamps da
  API continuam em ms UTC; a comparacao fica correta.
- Normalizar `receivedTime`/`sentTime` na entrada: aceitar number (ms) ou string
  (ISO) via `parseMessageTimestamp`, para nao excluir mensagens quando a API
  devolver string. No filtro, tratar valor invalido com `Number.isFinite`.

#### Arquivos Modificados

1. `app/admin/email/page.tsx`
2. `docs/issues/known-issues.md`

#### Como Validar

1. Em `/admin/email`, definir filtro de periodo (ex.: um unico dia).
2. Em fusos diferentes de UTC (ex.: America/Sao_Paulo), conferir que as
   mensagens exibidas correspondem ao dia selecionado no calendario local.
3. Verificar que mensagens com `receivedTime`/`sentTime` em numero ou string ISO
   continuam sendo consideradas pelo filtro.

---

## 99. Zoho Mail OAuth - "URI de redirecionamento invalido" ao conectar

### Problema (configuracao / documentado)

**Data da Ocorrencia**: 2026-01-28 **Severidade**: Media (bloqueia conexao)
**Status**: Documentado / mitigacao em codigo **Ambiente**: Zoho API Console +
`NEXTAUTH_URL` / `ZOHO_REDIRECT_URI`

#### Descricao

- Ao clicar em "Conectar Zoho Mail" em `/admin/email`, o Zoho exibe "URI de
  redirecionamento invalido" ou "O URI de redirecionamento passado nao
  corresponde ao configurado".
- O redirect URI enviado pelo app (derivado de `NEXTAUTH_URL` ou
  `ZOHO_REDIRECT_URI`) nao coincide exatamente com o cadastrado no Zoho API
  Console (ex.: `www` vs sem `www`).

#### Causa Raiz

- O Zoho exige que o redirect URI da requisicao OAuth seja identico ao
  registrado no Client. Se em producao `NEXTAUTH_URL` for
  `https://www.locacoesgb.com.br` e no Zoho estiver apenas
  `https://locacoesgb.com.br/...`, ou o contrario, o fluxo falha.

#### Solucao / Mitigacao

1. **No Zoho API Console**: Em Client Details, adicionar em "Redirect URI" a URL
   exata que o app envia (a que aparece no parametro `redirect_uri` da URL de
   erro do Zoho). Ex.:
   `https://www.locacoesgb.com.br/api/admin/zoho-mail/oauth/callback` ou
   `https://locacoesgb.com.br/api/admin/zoho-mail/oauth/callback`.
2. **Ou no app**: Definir `ZOHO_REDIRECT_URI` no ambiente de producao com o
   mesmo valor cadastrado no Zoho (ex. sem `www`), para que o app envie esse URI
   em vez de derivar de `NEXTAUTH_URL`.

#### Arquivos Envolvidos

- `lib/zoho-mail/client.ts` — `getRedirectUri()` usa `ZOHO_REDIRECT_URI` se
  definido, senao `NEXTAUTH_URL` + caminho do callback.
- `docs/features/admin-zoho-mail-integration.md` — secao 6 "Configuracao OAuth e
  Redirect URI".

#### Como Validar

- Apos cadastrar o URI correto no Zoho (ou definir `ZOHO_REDIRECT_URI`), clicar
  em "Conectar Zoho Mail" em `/admin/email` e concluir o fluxo OAuth sem erro de
  redirect.

---

## 98. Mobile Sheet de e-mail chamava onSelectMessage('') ao fechar e gerava fetch com messageId vazio

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-26 **Severidade**: Media (API invalida/ UX)
**Status**: Resolvido **Ambiente**:
`components/admin/email/email-layout-container.tsx`, `app/admin/email/page.tsx`

#### Descricao

- Ao fechar o Sheet de preview de e-mail em mobile, `onOpenChange` invocava
  `onSelectMessage('')` com string vazia.
- O parent (`handleSelectMessage`) interpretava como "selecionar mensagem" e
  fazia fetch para `/api/admin/zoho-mail/messages/?accountId=...`, gerando
  requisicao invalida e possivel erro.

#### Causa Raiz

- O layout usava `onSelectMessage('')` como sinal de "limpar selecao" ao fechar
  o Sheet. O parent nao distinguia "limpar" de "selecionar mensagem vazia" e
  sempre disparava o fetch.

#### Solucao Implementada

- **Layout**: Adicionado callback opcional `onClearMessage?: () => void`. Ao
  fechar o Sheet em mobile, chama `onClearMessage?.()` se fornecido; senao
  mantem `onSelectMessage('')` (comportamento antigo).
- **Page**: Criado `handleClearMessage` que limpa
  `selectedMessageId`/`currentMessage`/`messageLoading` sem fetch. Passado
  `onClearMessage={handleClearMessage}` ao `EmailLayoutContainer` em mobile.

#### Arquivos Modificados

1. components/admin/email/email-layout-container.tsx
2. app/admin/email/page.tsx
3. docs/issues/known-issues.md

#### Passo manual (se `page.tsx` estiver bloqueado no IDE)

1. Adicionar `handleClearMessage` apos `handleCloseFullView`:

```ts
const handleClearMessage = useCallback(() => {
  setSelectedMessageId(null)
  setCurrentMessage(null)
  setMessageLoading(false)
}, [])
```

2. Passar `onClearMessage={handleClearMessage}` ao `EmailLayoutContainer`.

#### Como Validar

1. Em mobile (ou `useIsMobile` true), abrir /admin/email, conectar Zoho Mail.
2. Selecionar uma pasta e uma mensagem; o Sheet de preview abre.
3. Fechar o Sheet (clique fora, botao X, etc.). Nao deve ocorrer requisicao GET
   para `/api/.../messages/?accountId=...`. Console/rede sem erros.

---

## 97. Alertas do sync (notifications/sync) nao usavam dedupeKey e geravam uma notificacao por recurso

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-21 **Severidade**: Media (UX/ spam) **Status**:
Resolvido **Ambiente**: `app/api/admin/notifications/sync/route.ts`

#### Descricao

- O helper `notifyAdmins` nao passava `dedupeKey` para
  `createAdminNotifications`.
- A deduplicacao caia no fallback (type, title, message, actionUrl). As
  mensagens incluiam IDs (ex.: `Orcamento #ABC123...`, `Locacao #XYZ789...`),
  tornando cada mensagem unica por orcamento/locacao.
- Resultado: cada orcamento ou locacao pendente gerava uma notificacao separada
  para cada admin; nao havia coalescencia por tipo de alerta.

#### Causa Raiz

- Apenas `notifyAdminsQuoteCreated` usava `dedupeKey`; os alertas do sync nao.

#### Solucao Implementada

- `notifyAdmins` passou a exigir `dedupeKey` e repassar para
  `createAdminNotifications`. Para cada tipo de alerta do sync, definida uma
  chave estavel: `admin:sync:quote_pending`, `admin:sync:boleto_not_generated`,
  `admin:sync:boleto_not_sent`, `admin:sync:payment_pending`,
  `admin:sync:approved_no_rental`, `admin:sync:checkin_pending`,
  `admin:sync:return_pending`, `admin:sync:rental_overdue`,
  `admin:sync:contract_pending`.
- Mensagens alteradas para genericas (ex.: "Um ou mais orcamentos aguardando
  analise ha mais de 4h.") em vez de incluir o ID do recurso; `metadata`
  continua com quoteId/rentalId/paymentId do recurso que disparou a criacao.
- Removido `getShortId` (nao era mais usado).

#### Arquivos Modificados

1. app/api/admin/notifications/sync/route.ts
2. docs/issues/known-issues.md

#### Como Validar

1. Ter varios orcamentos pendentes ou locacoes com o mesmo tipo de problema
   (ex.: 5 orcamentos pendentes ha 4h+).
2. Chamar POST /api/admin/notifications/sync (como admin). O dropdown de
   notificacoes deve mostrar no maximo uma notificacao por **tipo** de alerta
   por admin na janela de 6h (ex.: uma "Orcamento pendente sem acao"), nao uma
   por orcamento.

---

## 96. Dropdown de notificacoes e menu do usuario compartilhavam um unico timeout (race)

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-21 **Severidade**: Baixa (UX/ race) **Status**:
Resolvido **Ambiente**: `components/admin/admin-desktop-header.tsx`

#### Descricao

- Um unico `dropdownCloseTimeoutRef` era usado para o fechamento atrasado
  (120ms) tanto do dropdown de notificacoes quanto do menu do usuario.
- Ao passar o mouse de notificacoes para o menu do usuario (ou vice-versa), o
  `onMouseEnter` de um limpava o timeout do outro. O timeout que poderia fechar
  o dropdown de origem era cancelado, ou o de destino era sobrescrito, gerando
  condicao de corrida: os dois dropdowns competiam pelo mesmo ref.

#### Causa Raiz

- Reutilizacao do mesmo ref para dois comportamentos independentes (fechar
  notificacoes vs fechar menu do usuario).

#### Solucao Implementada

- Dois refs: `notificationCloseTimeoutRef` e `userMenuCloseTimeoutRef`. Cada
  dropdown agenda e limpa apenas o proprio timeout no `onMouseLeave`.
- Funcao `clearAllCloseTimeouts()`: limpa ambos os refs. Usada em todo
  `onMouseEnter` (botao e conteudo dos dois dropdowns) para cancelar qualquer
  fechamento pendente ao entrar em qualquer area, evitando que o timer de um
  interfira no outro.
- `useEffect` de cleanup chama `clearAllCloseTimeouts()` no unmount.

#### Arquivos Modificados

1. components/admin/admin-desktop-header.tsx
2. docs/issues/known-issues.md

#### Como Validar

1. Abrir dropdown de notificacoes; mover o mouse para o botao/area do menu do
   usuario. O de notificacoes deve fechar e o menu abrir, sem comportamentos
   estranhos (ex.: ambos abertos, ou um fechando e reabrindo).
2. Abrir menu do usuario; mover para o botao de notificacoes. Idem.
3. Alternar rapidamente entre os dois: os timeouts de cada um nao devem
   interferir no outro.

---

## 95. Callback OAuth Zoho Mail ignorava validacao de state quando o cookie estava ausente

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-21 **Severidade**: Alta (seguranca/ CSRF)
**Status**: Resolvido **Ambiente**:
`app/api/admin/zoho-mail/oauth/callback/route.ts`

#### Descricao

- A condicao `if (savedState && state !== savedState)` so rejeitava quando
  `savedState` (cookie) existia e era diferente de `state`.
- Se o cookie `zoho_oauth_state` estivesse ausente ou expirado, `savedState` era
  falsy e o `if` nao executava; o fluxo seguia e trocava o `code` por tokens sem
  validar o state, bypassando a protecao CSRF do OAuth.

#### Causa Raiz

- A expressao so garantia (state !== savedState) quando savedState existia. Nao
  exigia a presenca de ambos nem rejeitava quando o cookie faltava.

#### Solucao Implementada

- Substituir por `if (!savedState || !state || state !== savedState)`: rejeitar
  quando o cookie nao existe, quando o parametro `state` nao vem na URL, ou
  quando os valores nao coincidem. A mensagem de erro permanece "Estado OAuth
  inválido".

#### Arquivos Modificados

1. app/api/admin/zoho-mail/oauth/callback/route.ts
2. docs/issues/known-issues.md

#### Como Validar

1. Iniciar fluxo OAuth Zoho (authorize) e, antes do redirect de volta, apagar o
   cookie `zoho_oauth_state` ou esperar expirar.
2. Acessar o callback com `code` e `state` quaisquer: deve redirecionar com erro
   "Estado OAuth inválido" e nao trocar o code por tokens.
3. Fluxo normal (cookie presente e state igual): deve concluir e redirecionar
   com success.

---

## 94. Notificacao admin de novo orcamento nao deduplicava entre orcamentos (mensagem unica por cliente/#)

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-21 **Severidade**: Media (UX/ spam) **Status**:
Resolvido **Ambiente**: Admin, `createAdminNotifications` /
`notifyAdminsQuoteCreated`

#### Descricao

- `notifyAdminsQuoteCreated` montava a mensagem com `Orcamento #${shortId} ...`
  e `Cliente ${customerName}`, gerando mensagem diferente a cada orcamento.
- `createAdminNotifications` deduplicava somente por (type, title, message,
  actionUrl) na janela de 6h. Como a mensagem era sempre distinta, nao havia
  coalescencia: cada novo orcamento criava novas notificacoes para todos os
  admins, resultando em muitas notificacoes repetidas (uma por orcamento) em
  picos de demanda.

#### Causa Raiz

- A deduplicacao dependia de match exato da mensagem. Incluir dados variaveis
  (shortId, customerName) na mensagem impedia o match.

#### Solucao Implementada

- Em `AdminNotificationInput`, adicionado `dedupeKey?: string`. Quando definida,
  `createAdminNotifications` busca existentes por (userId, type,
  `metadata.dedupeKey`) em vez de (type, title, message, actionUrl), e grava
  `dedupeKey` em `metadata` ao criar.
- Em `notifyAdminsQuoteCreated`: uso de `dedupeKey: 'admin:quote_created'` e
  mensagem generica `Um ou mais orcamentos aguardando analise.` Assim, na janela
  de 6h so e criada uma notificacao por admin para o tipo "novo orcamento";
  orcamentos seguintes nao geram notificacoes extras. `metadata` continua com
  `quoteId` do orcamento que disparou a criacao (o primeiro na janela).
- Assinatura de `notifyAdminsQuoteCreated` simplificada para
  `(quoteId: string)`; o nome do cliente deixou de ser usado na mensagem.

#### Arquivos Modificados

1. lib/notification-service.ts (`AdminNotificationInput`,
   `createAdminNotifications`, `notifyAdminsQuoteCreated`)
2. app/api/quotes/route.ts (chamada a `notifyAdminsQuoteCreated`)
3. docs/issues/known-issues.md

#### Como Validar

1. Criar varios orcamentos em sequencia (ou em poucos minutos).
2. Ver o dropdown de notificacoes no header admin: deve haver no maximo uma
   notificacao "Novo orcamento recebido" por admin na janela de 6h, com mensagem
   "Um ou mais orcamentos aguardando analise.".
3. Apos 6h, um novo orcamento deve gerar nova notificacao.

---

## 93. Dropdown de notificacoes e menu do usuario fechava ao sair do conteudo sem periodo de graca

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-21 **Severidade**: Baixa (UX) **Status**:
Resolvido **Ambiente**: Header admin, Header publico

#### Descricao

- O dropdown de notificacoes e o menu do usuario (trigger + conteudo) usavam
  periodo de graca (120ms) no `onMouseLeave` do **botao**, mas o `onMouseLeave`
  do **conteudo** (`DropdownMenuContent`) fechava imediatamente.
- Ao mover rapidamente do botao para o conteudo, o dropdown podia fechar antes
  de o cursor entrar no conteudo, por causa da assimetria e de possiveis
  condicoes de corrida.

#### Causa Raiz

- O `DropdownMenuContent` em `onMouseLeave` chamava `setIsXxxOpen(false)` em
  seguida, enquanto o trigger usava `setTimeout(..., 120)`.

#### Solucao Implementada

- No `onMouseLeave` do `DropdownMenuContent`, agendar o fechamento com
  `setTimeout(..., 120)` em vez de chamar `setIsXxxOpen(false)` na hora.
- Manter a limpeza do timeout existente e a logica de `onMouseEnter` (cancela o
  timeout). Assim, o conteudo passa a ter o mesmo padrao de fechamento atrasado
  do botao, permitindo reentrada sem fechar prematuramente.

#### Arquivos Modificados

1. components/admin/admin-desktop-header.tsx (dropdown notificacoes + menu
   usuario)
2. components/header.tsx (menu usuario)
3. docs/issues/known-issues.md

#### Como Validar

1. Admin: abrir dropdown de notificacoes; mover o mouse rapidamente do botao
   para o conteudo e vice-versa. O dropdown nao deve fechar ao cruzar.
2. Admin: idem para o menu do usuario (avatar).
3. Header publico: idem para o menu "Ola, [nome]!".

---

## 93. Sparkline do KPI Valor em Atraso desalinhado em relacao aos demais cartoes

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-31 **Severidade**: Baixa (visual) **Status**:
Resolvido **Ambiente**: /admin/dashboard

#### Descricao

- O grafico sparkline do cartao "Valor em Atraso" aparecia desalinhado (mais
  alto ou menor) em comparacao aos sparklines dos outros KPIs (Receita Mensal,
  Utilizacao da Frota, Ticket Medio, Lucro Liquido).

#### Causa Raiz

- Quando o sparkline tem todos os valores iguais (ex.: R$ 2.393,00 em cada dia
  dos ultimos 7), o Recharts calculava dominio Y [min, max] com min === max.
- Isso fazia o grafico renderizar com layout interno inconsistente, causando
  desalinhamento visual em relacao aos demais cartoes.

#### Solucao Implementada

- Adicionado YAxis oculto com funcao `domain` que trata o caso min === max:
  quando o range e zero, aplica padding proporcional para garantir dominio
  valido e layout consistente.
- Adicionadas margens explícitas ao LineChart e `min-h-[40px]` ao container do
  sparkline para garantir dimensoes estaveis.

#### Arquivos Modificados

1. components/admin/financial/KPICard.tsx

#### Como Validar

1. Abrir /admin/dashboard.
2. Verificar que os cinco cartoes de KPIs exibem sparklines alinhados na mesma
   altura dentro de cada card.
3. O cartao "Valor em Atraso" deve apresentar o grafico alinhado com os demais
   mesmo quando o valor nao varia entre os dias.

---

## 92. Bloco Orcamentos Recentes no dashboard admin com Cliente, Empresa, Itens e Valor vazios

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-20 **Severidade**: Media (dados) **Status**:
Resolvido **Ambiente**: /admin/dashboard

#### Descricao

- O bloco "Orcamentos Recentes" exibia linhas com Status e Data corretos, mas
  Cliente, Empresa, Itens e Valor apareciam como "-".

#### Causa Raiz

- O dashboard espera o formato `RecentQuote` (customerName, customerEmail,
  customerCompany, totalAmount, itemsCount).
- A API `/api/admin/quotes` retorna (name, email, company,
  totalPrice/finalTotal, items). Os dados eram repassados sem mapeamento,
  gerando campos vazios.

#### Solucao Implementada

- Em `fetchDashboardData`, apos obter `quotesData.quotes`, mapear cada item para
  RecentQuote: name->customerName, email->customerEmail,
  company->customerCompany, finalTotal ou totalPrice->totalAmount,
  items.length->itemsCount.

#### Arquivos Modificados

1. app/admin/dashboard/page.tsx

#### Como Validar

1. Abrir /admin/dashboard.
2. Se houver orcamentos, o bloco "Orcamentos Recentes" deve exibir Cliente,
   Empresa, Itens e Valor preenchidos.

## 91. Swipe do CategoryShowcase nao inicia ao tocar no card

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-18 **Severidade**: Media (UX) **Status**:
Resolvido **Ambiente**: Home (/)

#### Descricao

- Em dispositivos touch e desktop, o arraste horizontal nao iniciava quando o
  toque comecava sobre o card (botao).
- O swipe so funcionava quando o toque iniciava no bloco do icone.

#### Causa Raiz

- O Framer Motion nao inicia drag automaticamente quando o `pointerdown` vem de
  elementos acessiveis via teclado (como `button`).
- Como os cards sao `button`, o gesto nao era iniciado.

#### Solucao Implementada

- O painel agora inicia o drag manualmente via `dragControls.start` no
  `pointerdown`.
- `dragListener` foi desabilitado no painel e mantidas as propriedades de
  `touch-action`/`user-select` equivalentes ao comportamento automatico.

#### Arquivos Modificados

1. components/category-showcase.tsx
2. docs/features/tabbed-category-grid.md
3. docs/issues/known-issues.md
4. CHANGELOG.md

#### Como Validar

1. Abrir `/` em um dispositivo touch ou desktop.
2. Pressionar e arrastar horizontalmente em qualquer area do card (nao apenas no
   icone).
3. Confirmar que a troca de categoria ocorre e que o clique ainda funciona sem
   arrastar.

## 90. Pausa na rotacao do primeiro modelo 3D apos o ScrollReveal

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-18 **Severidade**: Alta (UX/Visual) **Status**:
Resolvido **Ambiente**: Home (/)

#### Descricao

- No carregamento inicial, o modelo 3D (compressor) pausava a auto-rotate por
  ~2s apos ~2-3s.
- A pausa ocorria logo depois do evento `scrollRevealReady`, e entao a rotacao
  retomava.

#### Causa Raiz

- O `ModelWrapper` executava `bounds.refresh().fit()` quando `isRevealComplete`
  mudava para true.
- Nesse momento, `disableAutoFit` ficava false (dependia de
  `!isRevealComplete`), entao o `Bounds` usava `maxDuration=1` e animava a
  camera.
- A animacao do fit sobrescrevia o `OrbitControls.autoRotate`, parecendo travar
  a rotacao.

#### Solucao Implementada

- `disableAutoFit` agora depende apenas de `delayBoundsFit`, mantendo
  `maxDuration=0` para o primeiro modelo mesmo apos o ScrollReveal.
- O fit apos o reveal continua ocorrendo, mas instantaneo e sem pausar a
  rotacao.

#### Arquivos Modificados

1. components/ui/model-viewer.tsx
2. docs/features/equipment-3d-carousel.md
3. docs/issues/known-issues.md
4. CHANGELOG.md

#### Como Validar

1. Abrir `/` em modo incognito.
2. Observar o compressor iniciar a rotacao e manter movimento continuo mesmo
   apos ~2-3s.
3. Aguardar 6s e confirmar que o segundo modelo ainda faz zoom suave.

## 89. Alertas de seguranca por dependencias nao utilizadas

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-17 **Severidade**: Alta (Seguranca/Dependencias)
**Status**: Resolvido **Ambiente**: Todos

#### Descricao

- Dependencias nao utilizadas mantinham alertas de seguranca ativos (ex:
  `@vercel/blob` -> `undici`).
- Pacotes de apoio nao usados aumentavam a superficie de ataque e o ruido do
  Dependabot.

#### Causa Raiz

- Dependencias adicionadas para testes/provas de conceito nao foram removidas.
- O projeto nao utilizava `@vercel/blob`, `@auth/prisma-adapter`,
  `jsonwebtoken`, `cmdk` e outras libs removidas.

#### Solucao Implementada

- Removidas dependencias nao utilizadas do `package.json` e sincronizado o
  `pnpm-lock.yaml`.
- Atualizadas dependencias usadas para as versoes mais recentes disponiveis.
- Removida referencia a `@radix-ui/react-toast` em `next.config.mjs`.
- Analise de alertas atualizada indicando resolucao do alerta `undici`.

#### Arquivos Modificados

1. package.json
2. pnpm-lock.yaml
3. next.config.mjs
4. docs/issues/security-alerts-analysis.md
5. docs/issues/known-issues.md
6. CHANGELOG.md

#### Como Validar

1. Rodar `pnpm install`.
2. Confirmar ausencia de `@vercel/blob` e outros pacotes removidos em
   `package.json`.
3. Rodar `pnpm run build` e `pnpm test`.
4. Confirmar que o alerta `undici` nao aparece mais no Dependabot.

## 88. Email de confirmacao de pagamento nao era enviado (Webhook Asaas)

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-13 **Severidade**: Alta (Comunicacao/Orcamentos)
**Status**: Resolvido **Ambiente**: Todos

#### Descricao

- O webhook de boleto atualizava o pagamento e convertia o orcamento em locacao,
  mas nao enviava email de confirmacao ao cliente.
- Clientes nao recebiam confirmacao de pagamento apos o status `PAID`.

#### Causa Raiz

- `app/api/payments/boleto/webhook/route.ts` nao disparava email apos
  `convertPaidQuotePayment`.
- O fluxo dependia apenas do email de criacao e do envio manual do boleto.

#### Solucao Implementada

- O webhook agora envia email de confirmacao ao cliente quando a conversao do
  pagamento e concluida com sucesso.
- O envio usa o template `generateQuoteStatusChangeEmailHTML` e respeita as
  configuracoes de `RESEND_API_KEY` e `FROM_EMAIL`.
- Falhas no envio nao interrompem o processamento do webhook.

#### Arquivos Modificados

1. app/api/payments/boleto/webhook/route.ts
2. docs/features/quote-email-system.md
3. docs/features/quote-status-tracking.md
4. docs/issues/known-issues.md
5. CHANGELOG.md

#### Como Validar

1. Criar um orcamento com boleto e aprovar no admin (approvedAt definido).
2. Simular webhook do Asaas com `status=paid` para o `transactionId` do
   pagamento.
3. Confirmar que o pagamento muda para `PAID` e o orcamento e convertido.
4. Verificar no painel do Resend ou logs que o email de confirmacao foi enviado
   ao cliente.

## 86. RLS Policy Auth UID Performance Warning (Supabase) - 60 POLÍTICAS

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-12 **Severidade**: Media (Performance/Database)
**Status**: Resolvido **Ambiente**: ⚠️ **APENAS AMBIENTE DE TESTES** (não
aparece em produção)

#### Descricao

- Supabase Performance Advisor detectou **60 políticas RLS** em **24 tabelas**
  no ambiente de **TESTES** que estavam usando `auth.uid()` diretamente.
- Isso fazia com que a funcao fosse re-avaliada para **cada linha** retornada,
  causando performance subotima em queries com muitos resultados.
- Warning: "Auth RLS Initialization Plan - Table has a row level security policy
  that re-evaluates current_setting() or auth.() for each row."
- **Nota**: Este problema aparece apenas no servidor de testes do Supabase, não
  em produção.

#### Causa Raiz

- Políticas RLS estavam usando `auth.uid()` diretamente em expressoes USING/WITH
  CHECK.
- PostgreSQL considera essas funcoes como "volatile" e as re-avalia para cada
  linha testada.
- Em tabelas grandes, isso causa chamadas desnecessarias e degradacao de
  performance.

#### Solucao Implementada

- Substituido `auth.uid()` por `(SELECT auth.uid()::text)` em **TODAS as 60
  políticas RLS**.
- O padrao `(SELECT ...)` faz com que o PostgreSQL avalie a funcao **uma vez por
  query** em vez de uma vez por linha.
- Migration criada:
  `prisma/migrations/20260112_fix_all_rls_auth_uid_optimization.sql`

#### Tabelas Corrigidas (24 tabelas, 60 políticas)

1. **accounts** - 1 política (Only admins can access accounts)
2. **sessions** - 1 política (Only admins can access sessions)
3. **verificationtokens** - 1 política (Only admins can access verification
   tokens)
4. **users** - 2 políticas (view, update own profile)
5. **addresses** - 4 políticas (view, insert, update, delete)
6. **carts** - 4 políticas (view, insert, update, delete)
7. **cart_items** - 4 políticas (view, insert, update, delete)
8. **categories** - 3 políticas (insert, update, delete)
9. **equipments** - 3 políticas (insert, update, delete)
10. **equipment_units** - 3 políticas (insert, update, delete)
11. **quotes** - 4 políticas (view, create, update, delete)
12. **quote_items** - 2 políticas (view, modify)
13. **rentals** - 2 políticas (view, modify)
14. **rental_items** - 2 políticas (view, modify)
15. **maintenances** - 1 política (Only admins can access)
16. **settings** - 1 política (Only admins can modify)
17. **vehicles** - 1 política (Only admins can access)
18. **drivers** - 1 política (Only admins can access)
19. **payments** - 2 políticas (view, modify)
20. **deliveries** - 2 políticas (view, modify)
21. **notifications** - 4 políticas (view, update, delete, insert)
22. **audit_logs** - 1 política (Only admins can access)
23. **permissions** - 1 política (Only admins can access)
24. **contracts** - 1 política (Only admins can access)

#### Arquivos Modificados

1. prisma/migrations/20260112_fix_all_rls_auth_uid_optimization.sql (novo)
2. docs/issues/known-issues.md
3. CHANGELOG.md

#### Como Validar

1. Aplicar a migration no Supabase SQL Editor do ambiente de TESTES:

   ```sql
   -- ⚠️ IMPORTANTE: Aplicar apenas no banco de TESTES (TEST_DATABASE_URL)
   -- Copiar conteudo de prisma/migrations/20260112_fix_all_rls_auth_uid_optimization.sql
   -- Executar no Supabase Dashboard > SQL Editor (ambiente de testes)
   ```

2. Verificar políticas atualizadas:

   ```sql
   SELECT
     schemaname,
     tablename,
     policyname,
     cmd,
     qual,
     with_check
   FROM pg_policies
   WHERE schemaname = 'public'
   ORDER BY tablename, policyname;
   ```

   - Todas devem mostrar `(SELECT auth.uid()::text)` em vez de `auth.uid()`

3. Re-executar Performance Advisor no Supabase:
   - Dashboard > Database > Performance Advisor > Refresh
   - **Todos os 60 warnings** "Auth RLS Initialization Plan" devem desaparecer

4. Testar comportamento funcional:
   - Autenticar como usuario e verificar acesso aos proprios dados
   - Autenticar como admin e verificar acesso administrativo
   - Confirmar que permissoes continuam funcionando corretamente

#### Impacto Esperado

- **Performance**: Queries em tabelas grandes podem ficar **até 90% mais
  rápidas**
- **CPU**: Reducao significativa na carga do banco de dados
- **Escalabilidade**: Melhor suporte a mais usuarios simultaneos

#### Referencias

- [Supabase RLS Performance Best Practices](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select)
- Documentacao do projeto: `docs/guides/supabase-performance-optimization.md`

---

## 87. Multiple Permissive Policies Warning (Supabase) - 5 TABELAS

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-12 **Severidade**: Media (Performance/Database)
**Status**: Resolvido **Ambiente**: ⚠️ **APENAS AMBIENTE DE TESTES** (não
aparece em produção)

#### Descricao

- Supabase Performance Advisor detectou **5 tabelas** no ambiente de **TESTES**
  com múltiplas políticas permissivas para a mesma role (`authenticated`) e ação
  (`SELECT`).
- Isso fazia com que o PostgreSQL avaliasse **todas as políticas** para cada
  query SELECT, causando performance subótima.
- Warning: "Multiple Permissive Policies - Table has multiple permissive
  policies for role authenticated for action SELECT."
- **Nota**: Este problema aparece apenas no servidor de testes do Supabase, não
  em produção.

#### Causa Raiz

- Algumas tabelas tinham duas políticas permissivas para SELECT:
  1. Uma política específica para SELECT (ex: "Users can view own X")
  2. Uma política `FOR ALL` que incluía SELECT (ex: "Only admins can modify X")
- O PostgreSQL precisa avaliar ambas as políticas para cada query SELECT, mesmo
  que o resultado seja o mesmo.

#### Solucao Implementada

- Separadas políticas `FOR ALL` em `FOR INSERT, UPDATE, DELETE` (removendo
  SELECT).
- Mantidas políticas SELECT consolidadas que já permitem tanto usuários quanto
  admins.
- Migration criada:
  `prisma/migrations/20260112_consolidate_multiple_permissive_policies.sql`

#### Tabelas Corrigidas (5 tabelas)

1. **deliveries** - Separada política "Only admins can modify deliveries" de
   `FOR ALL` para `FOR INSERT, UPDATE, DELETE`
2. **payments** - Separada política "Only admins can modify payments" de
   `FOR ALL` para `FOR INSERT, UPDATE, DELETE`
3. **quote_items** - Separada política "Only admins can modify quote items" de
   `FOR ALL` para `FOR INSERT, UPDATE, DELETE`
4. **rental_items** - Separada política "Only admins can modify rental items" de
   `FOR ALL` para `FOR INSERT, UPDATE, DELETE`
5. **rentals** - Separada política "Only admins can modify rentals" de `FOR ALL`
   para `FOR INSERT, UPDATE, DELETE`

#### Arquivos Modificados

1. prisma/migrations/20260112_consolidate_multiple_permissive_policies.sql
   (novo)
2. CHANGELOG.md
3. docs/issues/known-issues.md

#### Como Validar

1. Aplicar a migration no Supabase SQL Editor do ambiente de TESTES:

   ```sql
   -- ⚠️ IMPORTANTE: Aplicar apenas no banco de TESTES (TEST_DATABASE_URL)
   -- Copiar conteudo de prisma/migrations/20260112_consolidate_multiple_permissive_policies.sql
   -- Executar no Supabase Dashboard > SQL Editor (ambiente de testes)
   ```

2. Verificar políticas atualizadas:

   ```sql
   SELECT
     schemaname,
     tablename,
     policyname,
     cmd,
     qual
   FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('deliveries', 'payments', 'quote_items', 'rental_items', 'rentals')
   ORDER BY tablename, cmd, policyname;
   ```

   - Cada tabela deve ter **1 política SELECT** e **1 política INSERT, UPDATE,
     DELETE**
   - Não deve haver políticas `FOR ALL`

3. Re-executar Performance Advisor no Supabase:
   - Dashboard > Database > Performance Advisor > Refresh
   - **Todos os 5 warnings** "Multiple Permissive Policies" devem desaparecer

4. Testar comportamento funcional:
   - Usuários devem poder ver seus próprios dados (SELECT)
   - Admins devem poder ver todos os dados (SELECT)
   - Apenas admins devem poder modificar dados (INSERT/UPDATE/DELETE)

#### Impacto Esperado

- **Performance**: Queries SELECT **10-30% mais rápidas** (avaliação de 1
  política em vez de 2)
- **CPU**: Redução na carga de avaliação de políticas
- **Escalabilidade**: Melhor performance em queries frequentes

#### Referencias

- [Supabase Multiple Permissive Policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies)
- Documentacao do projeto: `docs/guides/supabase-performance-optimization.md`

## 85. pnpm test imprimia logs excessivos de dotenv e validacao

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-12 **Severidade**: Baixa (Testes/DX) **Status**:
Resolvido

#### Descricao

- O output do pnpm test exibia logs do dotenv a cada arquivo de teste.
- Erros de validacao Zod esperados eram logados como falha de API.

#### Causa Raiz

- dotenv era carregado sem `quiet: true`, gerando logs a cada setup.
- Rotas de API logavam `console.error` para todos os erros, inclusive ZodError.

#### Solucao Implementada

- O carregamento de dotenv nos setups de teste usa `quiet: true`.
- `TEST_MODE=true` indica ao servidor para silenciar logs de ZodError durante
  testes.

#### Arquivos Modificados

1. tests/global-setup.ts
2. tests/setup.ts
3. lib/api-response.ts
4. app/api/quotes/route.ts
5. docs/guides/testing.md
6. docs/issues/known-issues.md
7. CHANGELOG.md

#### Como Validar

1. Rodar `pnpm test`.
2. Confirmar ausencia de logs "injecting env".
3. Confirmar que erros de validacao esperados nao imprimem "API Error" ou "Erro
   ao criar orcamento".

## 78. Testes usavam gateway Asaas com chave invalida

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-12 **Severidade**: Media (Testes/Boleto)
**Status**: Resolvido

#### Descricao

- Alguns testes acionavam o gateway Asaas por causa de variaveis de ambiente.
- A execucao falhava com erro de chave invalida do Asaas.

#### Causa Raiz

- tests/setup.ts apenas definia BOLETO_GATEWAY_TYPE=direct quando a env nao
  estava setada.

#### Solucao Implementada

- tests/setup.ts agora força BOLETO_GATEWAY_TYPE=direct e limpa chaves externas.
- Mock do next-auth inclui export default para evitar erro de mock.

#### Arquivos Modificados

1. tests/setup.ts
2. tests/critical/quote-adjustment.test.ts
3. docs/guides/testing.md
4. docs/issues/known-issues.md
5. CHANGELOG.md

#### Como Validar

1. Manter BOLETO_GATEWAY_TYPE=asaas no .env.local.
2. Rodar pnpm test e confirmar que o gateway direto e usado nos testes.

## 79. RLS desabilitado em tabelas public do Supabase

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-12 **Severidade**: Alta (Seguranca) **Status**:
Resolvido

#### Descricao

- O Supabase linter reportava erros de RLS desabilitado nas tabelas public.
- Tabelas sensiveis ficavam expostas no schema public sem politicas.

#### Causa Raiz

- RLS nao estava habilitado nas tabelas public do novo projeto Supabase.
- Nao havia script centralizado para aplicar as politicas basicas.

#### Solucao Implementada

- Criado script `supabase-rls-fix.sql` com enable RLS + politicas basicas.
- Guia atualizado para executar o script no SQL Editor do Supabase.

#### Arquivos Modificados

1. supabase-rls-fix.sql
2. docs/guides/SUPABASE-RLS-FIX-GUIDE.md
3. docs/issues/known-issues.md
4. CHANGELOG.md

#### Como Validar

1. Executar `supabase-rls-fix.sql` no SQL Editor do Supabase.
2. Atualizar o Database Linter e confirmar 0 erros de RLS.

## 80. Cursor do CurrencyInput desalinhado apos formatacao

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-12 **Severidade**: Baixa (Admin/UX) **Status**:
Resolvido

#### Descricao

- Em digitacao rapida, o cursor podia ficar antes do ultimo digito.
- Apos aplicar formatacao, o cursor era calculado com o valor antigo.

#### Causa Raiz

- scheduleCursorToEnd executava antes do state renderizar o valor formatado.
- useImperativeHandle tinha dependencias inconsistentes.

#### Solucao Implementada

- Cursor agora e reposicionado apos o render do valor formatado.
- useImperativeHandle usa dependencia de inputRef.

#### Arquivos Modificados

1. components/ui/currency-input.tsx
2. docs/features/quote-price-adjustment.md
3. docs/issues/known-issues.md
4. CHANGELOG.md

#### Como Validar

1. Abrir o dialog "Ajustar Valor Final" em `/admin/orcamentos`.
2. Digitar `123456` e confirmar `R$ 1.234,56`.
3. Confirmar que o cursor permanece no final sem salto.

## 81. Metadados de envio do boleto eram perdidos na regeneracao

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-12 **Severidade**: Media (Admin/Pagamentos)
**Status**: Resolvido

#### Descricao

- Ao regenerar boleto por ajuste de valor, a metadata era sobrescrita.
- Campos de auditoria (boletoSentAt, boletoSentBy, boletoSentEmail) eram
  perdidos.

#### Causa Raiz

- ensureQuoteBoletoPayment substituia metadata pelo objeto do novo boleto.

#### Solucao Implementada

- Metadata agora e mesclada, preservando campos anteriores e atualizando
  barcode/digitableLine/pdfUrl/instructions.

#### Arquivos Modificados

1. lib/quote-boleto.ts
2. docs/features/quote-system.md
3. docs/issues/known-issues.md
4. CHANGELOG.md

#### Como Validar

1. Gerar boleto e enviar ao cliente (metadata de envio definida).
2. Ajustar valor final e regenerar boleto.
3. Confirmar que metadata de envio permanece junto ao novo boleto.

## 82. pnpm test falhava com spawn EINVAL no Windows

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-12 **Severidade**: Media (Testes/Infra)
**Status**: Resolvido

#### Descricao

- O setup global dos testes falhava ao iniciar o Next dev server.
- O erro era `spawn EINVAL` ao usar o executavel .cmd do Next.

#### Causa Raiz

- child_process.spawn com .cmd em Windows pode falhar com EINVAL.

#### Solucao Implementada

- O setup agora usa o entrypoint Node do Next (`next/dist/bin/next`).

#### Arquivos Modificados

1. tests/global-setup.ts
2. docs/issues/known-issues.md
3. CHANGELOG.md

#### Como Validar

1. Executar `pnpm test` no Windows.
2. Confirmar que o Next dev server inicia sem erro de spawn.

## 83. Multa por atraso sobrescrevia ajuste manual no mesmo PATCH

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-12 **Severidade**: Media (Admin/Pagamentos)
**Status**: Resolvido

#### Descricao

- PATCH com `finalTotal` e `lateFeeApproved: true` recalculava o total com base
  no valor antigo.
- O valor ajustado manualmente era perdido.

#### Causa Raiz

- O calculo da multa usava apenas `currentQuote.finalTotal` ao montar o novo
  total.

#### Solucao Implementada

- A multa agora soma sobre o `finalTotal` informado no mesmo PATCH, quando
  presente.
- A justificativa manual nao e sobrescrita pelo texto automatico da multa.

#### Arquivos Modificados

1. app/api/admin/quotes/[id]/route.ts
2. tests/critical/quote-adjustment.test.ts
3. docs/issues/known-issues.md
4. CHANGELOG.md

#### Como Validar

1. Enviar PATCH com `finalTotal`, `priceAdjustmentReason`, `lateFee` e
   `lateFeeApproved: true`.
2. Confirmar que `finalTotal = finalTotal + lateFee`.
3. Confirmar que a justificativa manual e mantida.

## 84. Ref do CurrencyInput nao apontava para o input real

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-12 **Severidade**: Baixa (UI) **Status**:
Resolvido

#### Descricao

- O ref do CurrencyInput nao apontava para o elemento input real.
- Isso quebrava comportamentos que dependem do ref do DOM.

#### Causa Raiz

- useImperativeHandle era usado junto com o ref do Input, causando conflito.

#### Solucao Implementada

- CurrencyInput agora compartilha o ref direto com o Input via callback.

#### Arquivos Modificados

1. components/ui/currency-input.tsx
2. docs/issues/known-issues.md
3. CHANGELOG.md

#### Como Validar

1. Renderizar CurrencyInput com ref.
2. Confirmar que ref.current aponta para o input real (focus/selection
   funcionam).

## 77. Testes podiam usar DATABASE_URL por engano

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-12 **Severidade**: Alta (Testes/Seguranca)
**Status**: Resolvido

#### Descricao

- `pnpm test` podia usar `DATABASE_URL` quando `TEST_DATABASE_URL` nao estava
  configurada.
- Isso permitia executar testes em banco nao isolado por engano.

#### Causa Raiz

- Fallback automatico para `DATABASE_URL` sem verificacao de seguranca.

#### Solucao Implementada

- `TEST_DATABASE_URL` passou a ser obrigatoria nos testes.
- O teste aborta se `TEST_DATABASE_URL` igual `DATABASE_URL` ou aponta para o
  mesmo host nao local.

#### Arquivos Modificados

1. tests/global-setup.ts
2. tests/setup.ts
3. docs/guides/testing.md
4. docs/issues/known-issues.md
5. CHANGELOG.md

#### Como Validar

1. Remover `TEST_DATABASE_URL` e executar `pnpm test` (deve falhar).
2. Configurar `TEST_DATABASE_URL` igual a `DATABASE_URL` (deve falhar).
3. Configurar `TEST_DATABASE_URL` apontando para banco de testes e executar
   `pnpm test` (deve passar).

## 76. Boleto divergente quando total muda sem CPF/CNPJ

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-10 **Severidade**: Media (Admin/Pagamentos)
**Status**: Resolvido

#### Descricao

- Com boleto pendente e valor diferente do total atual, sem CPF/CNPJ, o sistema
  retornava o pagamento antigo.
- Isso deixava o boleto com valor divergente do orcamento.

#### Causa Raiz

- ensureQuoteBoletoPayment retornava o pagamento existente quando faltava
  CPF/CNPJ, mesmo com valor divergente.

#### Solucao Implementada

- ensureQuoteBoletoPayment agora retorna erro quando o valor diverge e nao ha
  CPF/CNPJ.
- O fluxo nao reutiliza boleto antigo com total diferente.

#### Arquivos Modificados

1. lib/quote-boleto.ts
2. tests/critical/quote-boleto.test.ts
3. docs/features/quote-system.md
4. docs/issues/known-issues.md
5. CHANGELOG.md

#### Como Validar

1. Criar orcamento sem CPF/CNPJ com boleto pendente.
2. Forcar divergencia de valor (ajuste de total).
3. Tentar gerar/reutilizar boleto e confirmar erro por documento ausente.

## 75. Ajuste de valor final aceitava valor <= 0

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-10 **Severidade**: Media (Admin/Pagamentos)
**Status**: Resolvido

#### Descricao

- O PATCH /api/admin/quotes/[id] aceitava finalTotal <= 0.
- Com valor invalido, ensureQuoteBoletoPayment retornava o boleto existente sem
  regenerar.

#### Causa Raiz

- Faltava validacao de finalTotal > 0 no ajuste.
- ensureQuoteBoletoPayment retornava pagamentos existentes quando total <= 0.

#### Solucao Implementada

- PATCH /api/admin/quotes/[id] agora valida finalTotal > 0 e rejeita valores nao
  positivos.
- ensureQuoteBoletoPayment falha quando total <= 0, mantendo consistencia com a
  criacao de boletos.

#### Arquivos Modificados

1. lib/quote-boleto.ts
2. app/api/admin/quotes/[id]/route.ts
3. tests/critical/quote-adjustment.test.ts
4. docs/features/quote-price-adjustment.md
5. docs/issues/known-issues.md
6. CHANGELOG.md

#### Como Validar

1. Tentar ajustar finalTotal para 0 ou negativo.
2. Confirmar que a API retorna 400 com mensagem de valor invalido.
3. Ajustar finalTotal para valor positivo e confirmar regeneracao do boleto
   quando houver pendente.

## 74. Boleto nao atualizava valor ajustado

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-10 **Severidade**: Media (Admin/Pagamentos)
**Status**: Resolvido

#### Descricao

- Apos ajustar o valor final no admin, o botao "Abrir Boleto" continuava abrindo
  o PDF antigo com valor original.
- O boleto pendente permanecia vinculado ao valor anterior.

#### Causa Raiz

- `ensureQuoteBoletoPayment` retornava o pagamento existente mesmo quando o
  valor do boleto nao batia com `finalTotal`.
- O `PATCH /api/admin/quotes/[id]` nao disparava regeneracao do boleto apos
  ajuste.

#### Solucao Implementada

- `ensureQuoteBoletoPayment` agora regenera o boleto quando o valor atual do
  orcamento diverge e o pagamento nao esta pago.
- O ajuste de valor no admin dispara a atualizacao do boleto sem interromper o
  fluxo.
- Metadados de envio do boleto sao limpos ao regenerar.

#### Arquivos Modificados

1. `lib/quote-boleto.ts`
2. `app/api/admin/quotes/[id]/route.ts`
3. `docs/features/quote-price-adjustment.md`
4. `docs/features/admin-orcamentos-page.md`
5. `docs/features/quote-system.md`
6. `docs/issues/known-issues.md`
7. `CHANGELOG.md`

#### Como Validar

1. Criar orcamento com boleto gerado.
2. Ajustar valor final no admin.
3. Verificar que "Abrir Boleto" abre PDF com valor ajustado.
4. Confirmar que o boleto precisa ser reenviado (sem "Enviado em" antigo).

## 73. Boleto nao era gerado automaticamente na criacao do orcamento

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-10 **Severidade**: Media (Fluxo/Admin)
**Status**: Resolvido

#### Descricao

- Orcamentos criados via `POST /api/quotes` (status `PENDING`) nao geravam
  boleto automaticamente.
- O admin precisava clicar manualmente em "Gerar boleto" para visualizar o PDF.

#### Causa Raiz

- `ensureQuoteBoletoPayment` bloqueava a geracao sem `status === 'APPROVED'` ou
  `approvedAt`.
- O `POST /api/quotes` nao chamava a geracao automatica apos criar o orcamento.

#### Solucao Implementada

- Removida a validacao de aprovacao em `ensureQuoteBoletoPayment`.
- `POST /api/quotes` passou a tentar gerar o boleto apos criar o orcamento, com
  `try/catch` para nao interromper o fluxo.
- Botao "Baixar PDF" no admin foi ajustado para "Abrir Boleto" com abertura em
  nova aba.

#### Arquivos Modificados

1. `lib/quote-boleto.ts`
2. `app/api/quotes/route.ts`
3. `app/admin/orcamentos/page.tsx`
4. `docs/features/quote-system.md`
5. `docs/features/admin-orcamentos-page.md`
6. `docs/features/orcamento-page.md`
7. `docs/issues/known-issues.md`
8. `CHANGELOG.md`

#### Como Validar

1. Criar orcamento com CPF/CNPJ via `/orcamento` e confirmar boleto gerado
   (status `PENDING`).
2. Criar orcamento sem CPF/CNPJ e confirmar que o orcamento e criado sem erro.
3. Abrir `/admin/orcamentos` e verificar que o boleto aparece no modal.
4. Clicar em "Abrir Boleto" e confirmar abertura do PDF em nova aba.

## 72. CurrencyInput adicionava digitos ao usar backspace no webview do Cursor (Admin)

### Problema RESOLVIDO ?

**Data da Ocorrencia**: 2026-01-11 **Severidade**: Media (Admin/UX) **Status**:
? Resolvido

#### Descricao

- No dialog "Ajustar Valor Final" em `/admin/orcamentos`, o campo de valor final
  adicionava digitos ao usar backspace no browser tab do Cursor.
- No Chrome o comportamento era normal.

#### Causa Raiz

- O CurrencyInput reformatava a string a cada tecla e tentava restaurar a
  posicao do cursor com `selectionStart` + `setSelectionRange` + `setTimeout`.
- Em webviews, o cursor ficava desalinhado e a reformatacao empurrava digitos
  para a esquerda.

#### Solucao Implementada

- CurrencyInput passou a usar digitacao por digitos (centavos shift): extrai
  apenas numeros, converte para valor/100 e formata via `Intl.NumberFormat`.
- Cursor fica ancorado no final para evitar inconsistencias de caret.

#### Arquivos Modificados

1. `components/ui/currency-input.tsx`
2. `docs/features/quote-price-adjustment.md`
3. `docs/issues/known-issues.md`
4. `CHANGELOG.md`

#### Como Validar

1. Abrir `/admin/orcamentos` no browser tab do Cursor e abrir "Ajustar Valor
   Final".
2. Digitar `140000` e confirmar exibicao `R$ 1.400,00`.
3. Usar backspace repetidamente e confirmar que remove digitos sem adicionar
   numeros.
4. Repetir no Chrome para comparar.

## 71. Botão de envio do orçamento ajustado não aparecia após ajuste de valor (Admin)

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-01-10 **Severidade**: Média (Admin/Fluxo)
**Status**: Resolvido

#### Descrição

- Ao ajustar o valor final do orçamento, o footer continuava exibindo "Aprovar
  Orçamento".
- Não havia ação direta para enviar ao cliente o orçamento ajustado com
  justificativa.

#### Causa Raiz

- A UI não diferenciava orçamentos com `priceAdjustmentReason`/`finalTotal`
  ajustados.
- Não existia endpoint dedicado para envio do orçamento ajustado por email.

#### Solução Implementada

- Ação "Enviar Orçamento Ajustado" substitui o botão de aprovação quando há
  ajuste de valor.
- Novo endpoint `POST /api/admin/quotes/[id]/send-adjusted-quote` envia email
  com valores ajustados e justificativa.
- Template de email atualizado para suportar status `ADJUSTED`.

#### Arquivos Modificados

1. `app/admin/orcamentos/page.tsx`
2. `app/api/admin/quotes/[id]/send-adjusted-quote/route.ts`
3. `lib/email-templates.ts`
4. `docs/features/admin-orcamentos-page.md`
5. `docs/features/quote-price-adjustment.md`
6. `docs/features/quote-email-system.md`
7. `docs/issues/known-issues.md`
8. `CHANGELOG.md`

#### Como Validar

1. Abra `/admin/orcamentos` e selecione um orçamento PENDING.
2. Clique em "Ajustar Valor Final", informe valor e justificativa.
3. Verifique que o botão "Aprovar Orçamento" é substituído por "Enviar Orçamento
   Ajustado".
4. Clique em "Enviar Orçamento Ajustado" e confirme o envio (com
   `RESEND_API_KEY` e `FROM_EMAIL` configurados).
5. Confirme que o cliente recebe email com valor ajustado e justificativa.

#### Armadilhas a Evitar

- Não exibir "Enviar Orçamento Ajustado" sem ajuste de valor válido.
- Enviar email sem justificativa ou sem valor final definido.
- Aprovar orçamento automaticamente ao enviar o ajuste (status permanece
  PENDING).

## 68. Animação de zoom no primeiro modelo 3D em produção

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-01-04 **Severidade**: Média (UX Inconsistente)
**Status**: Resolvido Definitivamente

#### Descrição

- Em produção, o primeiro modelo 3D (compressor) exibia animação de zoom
  (bounce/pop-up) mesmo com a sincronização implementada.
- O modelo começava pequeno e terminava grande na posição original, causando
  efeito visual indesejado.
- Localmente funcionava corretamente, mas em produção o comportamento era
  diferente.

#### Causa Raiz REAL (Descoberta Final)

O problema tinha **duas causas**:

1. **Timing do evento `scrollRevealReady`**:
   - Evento estava sendo disparado **imediatamente** no início de `run()`
   - A animação do `.hero-image-inner` leva ~2.1s para terminar (delay 0.9s +
     duração 1.2s), mas o evento disparava antes

2. **Prop `maxDuration` do componente `<Bounds>`** (CAUSA PRINCIPAL):
   - O componente `<Bounds>` do `@react-three/drei` anima o zoom por padrão com
     duração de 1 segundo (`maxDuration={1}`)
   - Mesmo com toda a lógica de sincronização, a animação ainda acontecia porque
     o `maxDuration` padrão era > 0
   - Resultado: Modelo aparecia pequeno e "crescia" até o tamanho correto

### Solução Implementada (Duas Partes)

#### Parte 1: Timing do Evento `scrollRevealReady`

Ajuste do timing baseado no tipo de navegação:

1. **Primeira visita** (com animações):
   - Evento dispara após **2.6s** (1.9s delay + 0.6s duração + 100ms margem)
   - Garante que a animação mais longa (`.hero-badge-right`) terminou
     completamente

2. **Navegação interna** (sem animações):
   - Evento dispara após **200ms** (elementos já estão visíveis)
   - Delay pequeno apenas para garantir que elementos estão no DOM

**Código implementado**:

```typescript
// components/scroll-reveal-init.tsx
const dispatchScrollRevealReady = () => {
  if (shouldExecuteAnimations) {
    // Primeira visita: Aguardar animação mais longa terminar
    const scrollRevealDuration = 2600 // 1.9s + 0.6s + 100ms margem
    setTimeout(() => {
      window.dispatchEvent(new Event("scrollRevealReady"))
    }, scrollRevealDuration)
  } else {
    // Navegação interna: Disparar após pequeno delay
    setTimeout(() => {
      window.dispatchEvent(new Event("scrollRevealReady"))
    }, 200)
  }
}
```

#### Parte 2: Prop `maxDuration` do Bounds (SOLUÇÃO DEFINITIVA)

**Esta é a solução que realmente elimina a animação:**

```typescript
// components/ui/model-viewer.tsx - SceneContent
const boundsMaxDuration = disableAutoFit ? 0 : 1

return (
  <Bounds fit clip observe margin={1.2} maxDuration={boundsMaxDuration}>
    {/* ... */}
  </Bounds>
)
```

**Como funciona:**

- **`maxDuration={0}`**: O Bounds executa o fit **INSTANTANEAMENTE**, sem
  animação visível
- **`maxDuration={1}`**: O Bounds executa o fit com animação de 1 segundo
  (padrão)

**Para o primeiro modelo:**

- `disableAutoFit = true` → `maxDuration = 0` → Modelo aparece no tamanho
  correto **SEM animação**
- Isso garante que mesmo que o `Bounds.fit()` execute, não há animação visível

**Para modelos seguintes:**

- `disableAutoFit = false` → `maxDuration = 1` → Animação de zoom suave

#### Arquivos Modificados

1. `components/scroll-reveal-init.tsx`: Função `dispatchScrollRevealReady()` com
   timing correto
2. `components/ui/model-viewer.tsx`: Prop `maxDuration` dinâmico baseado em
   `disableAutoFit`
3. `CHANGELOG.md`: Documentação da solução

#### Como Validar

1. **Produção**:
   - Acesse a página inicial em produção (hard refresh)
   - Observe o compressor aparecer no tamanho correto, SEM animação de zoom
   - Aguarde 6s, observe a betoneira aparecer com animação de zoom

2. **Local**:
   - Teste em modo incógnito (sem cache)
   - Comportamento deve ser idêntico ao de produção

3. **Navegação interna**:
   - Navegue para outra página e volte
   - Comportamento deve ser consistente

#### ⚠️ Armadilhas Críticas a Evitar

- **NUNCA remover a prop `maxDuration` do componente `<Bounds>`**
- **NUNCA alterar `maxDuration={0}` para o primeiro modelo** - Isso reintroduz a
  animação
- **NUNCA remover a prop `disableAutoFit`** - Controla o `maxDuration`
  dinamicamente
- Disparar o evento `scrollRevealReady` imediatamente no início de `run()`
- Usar delay fixo sem considerar o tipo de navegação
- Reduzir o delay de 2.6s sem validar que a animação realmente terminou

#### 🚨 Regra Crítica para IA

**Esta solução depende de DUAS partes funcionando juntas:**

1. ✅ Timing correto do evento `scrollRevealReady` (2.6s para primeira visita)
2. ✅ **Prop `maxDuration={0}` no Bounds para o primeiro modelo** ← **CRÍTICO**

**Se você remover qualquer uma dessas partes, o problema volta!**

---

## 67. Sincronização entre ScrollReveal e animações 3D do carrossel

### Problema RESOLVIDO

**Data da Ocorrência**: 2026-01-04 **Severidade**: Baixa (UX Inconsistente)
**Status**: Resolvido

#### Descrição

- O primeiro modelo 3D no carrossel (compressor) às vezes exibia a animação de
  zoom (`Bounds.fit()`) durante ou após o ScrollReveal, causando comportamento
  inconsistente.
- Em redes lentas ou com modelos grandes, o zoom podia ocorrer visivelmente após
  o elemento estar visível, diferente do comportamento esperado.

#### Causa Raiz

- A lógica anterior dependia de "timing feliz": o modelo carregava rápido o
  suficiente para o `Bounds.fit()` ocorrer enquanto o elemento ainda estava
  invisível (durante o ScrollReveal).
- Não havia sincronização explícita entre o sistema de ScrollReveal e as
  animações do Three.js.
- A ordem era: modelo carrega → `Bounds.fit()` executa após 200ms → elemento
  pode ou não estar visível dependendo da velocidade da rede.

### Solução Implementada

Sincronização explícita usando o evento `scrollRevealReady`:

1. **ModelViewer**: Adicionadas props `delayBoundsFit` e `isRevealComplete` para
   controlar quando executar `Bounds.fit()`.
2. **Equipment3DCarousel**: Adicionada prop `isRevealComplete` e lógica para
   passar `delayBoundsFit=true` apenas para o primeiro modelo.
3. **Hero e Sobre**: Passam `isScrollRevealReady` para o carrossel.

**Fluxo após a correção**:

1. Página carrega, `currentIndex = 0` (compressor)
2. Compressor carrega, mas `Bounds.fit()` aguarda `isRevealComplete=true`
3. ScrollReveal termina, dispara evento `scrollRevealReady`
4. `isRevealComplete` muda para `true`, mas primeiro modelo não executa zoom
   (elemento já está visível)
5. Após 6s, troca para betoneira (segundo modelo) com `delayBoundsFit=false`
6. Betoneira executa `Bounds.fit()` normalmente com animação de zoom visível

#### Arquivos Modificados

1. `components/ui/model-viewer.tsx`
2. `components/equipment-3d-carousel.tsx`
3. `components/hero.tsx`
4. `app/sobre/page.tsx`
5. `CHANGELOG.md`

#### Como Validar

1. Recarregue a página inicial em modo incógnito (sem cache)
2. Observe o compressor aparecer apenas com fade-in do ScrollReveal
3. Aguarde 6s, observe a betoneira aparecer com animação de zoom
4. Repita o teste com throttling de rede (Slow 3G) para confirmar consistência

#### Armadilhas a Evitar

- Remover a prop `isRevealComplete` do carrossel, voltando ao comportamento de
  timing implícito.
- Não escutar o evento `scrollRevealReady` em páginas que usam o carrossel 3D.
- Modificar o delay do `Bounds.fit()` sem entender a lógica de sincronização.

---

## 66. A11y: avisos de ARIA no CategoryShowcase (tablist)

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-04 **Severidade**: Baixa (Acessibilidade)
**Status**: Resolvido

#### Descricao

- Edge Tools/Axe reportava avisos de tablist com filhos invalidos e tabs sem pai
  adequado.
- Alertas vistos: "Certain ARIA roles must contain particular children" e
  "Required ARIA parent role not present: tablist".

#### Causa Raiz

- `role="tablist"` estava em `nav`, mas os `tab` estavam encapsulados por
  `ul`/`li` com semantica de lista, impedindo o axe de reconhecer o parentesco.

### Solucao Implementada

- `ul` e `li` marcados como `role="presentation"` para que os `tab` sejam filhos
  diretos do `tablist` na arvore de acessibilidade.

#### Arquivos Modificados

1. `components/category-showcase.tsx`
2. `docs/features/tabbed-category-grid.md`
3. `docs/issues/known-issues.md`
4. `CHANGELOG.md`

#### Como Validar

1. Abra a home e rode o Axe/Edge Tools na secao de categorias.
2. Confirme que nao ha avisos de tablist/tab.

#### Armadilhas a Evitar

- Remover `role="presentation"` de `ul`/`li` e reintroduzir os avisos de ARIA.

## 65. Performance: swipe do CategoryShowcase com jank no mobile

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-04 **Severidade**: Media (Performance)
**Status**: Resolvido

#### Descricao

- Swipe horizontal do CategoryShowcase apresentava queda de FPS em dispositivos
  mobile.
- A troca de abas via gesto ficava com sensacao de travamento durante o arraste.

#### Causa Raiz

- Leitura de layout (`offsetWidth`) acontecia no inicio do swipe, forcando
  reflow.
- Faltavam hints de composicao para `transform` no painel e no overlay.
- Buscas lineares por tab/indice eram refeitas em handlers de drag.

### Solucao Implementada

- Largura do painel cacheada com `ResizeObserver`, evitando leitura de layout no
  swipe.
- `will-change: transform` aplicado ao painel e ao overlay para favorecer GPU.
- Mapeamento de tabs e indices memoizado para reduzir trabalho no drag end.

#### Arquivos Modificados

1. `components/category-showcase.tsx`
2. `docs/features/tabbed-category-grid.md`
3. `docs/issues/known-issues.md`
4. `CHANGELOG.md`

#### Como Validar

1. Abra a home em um dispositivo mobile ou emulador com throttling.
2. Arraste o grid para trocar de aba e observe que a animacao permanece fluida.
3. Confirme no Performance DevTools que nao ha leitura de layout no swipe.

#### Armadilhas a Evitar

- Voltar a ler `offsetWidth` durante o gesto de swipe.
- Remover `will-change` dos containers animados.
- Reintroduzir buscas lineares de tabs em handlers de drag.

## 64. Performance: infinite scroll reflow e contagem de dias pesada

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-04 **Severidade**: Baixa (Performance)
**Status**: Resolvido

#### Descricao

- O carrossel infinito calculava `scrollWidth` a cada frame, gerando reflow.
- A contagem de dias uteis no SmartEquipmentPricing percorria todas as datas,
  causando custo alto em ranges longos.

#### Causa Raiz

- `scrollWidth` era lido dentro do loop de animacao.
- A contagem de dias usava `eachDayOfInterval`.

### Solucao Implementada

- Largura do ciclo cacheada com atualizacao via ResizeObserver.
- Contagem de dias passou a usar calculo por semanas (O(1)).

#### Arquivos Modificados

1. `components/equipment-infinite-scroll.tsx`
2. `components/smart-equipment-pricing.tsx`
3. `docs/features/equipment-infinite-scroll.md`
4. `docs/features/equipment-booking-system.md`
5. `docs/issues/known-issues.md`
6. `CHANGELOG.md`

#### Como Validar

1. Abra uma pagina com `EquipmentInfiniteScroll` e verifique no Performance que
   nao ha leitura de layout a cada frame.
2. Selecione um intervalo longo no calendario e confirme resposta imediata.

#### Armadilhas a Evitar

- Voltar a ler `scrollWidth` no loop de animacao.
- Reintroduzir contagem dia a dia para ranges grandes.

## 63. Infinite scroll nao liberava listeners ao desmontar

### ✅ Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-04 **Severidade**: Baixa (Performance)
**Status**: Resolvido

#### Descricao

- O carousel de equipamentos mantinha listeners de touch/mouse e RAF ativos apos
  unmount, causando consumo de CPU em navegacao.

#### Causa Raiz

- Listeners eram registrados com `bind()` e removidos com novos `bind()`, nao
  removendo as referencias reais.

### ✅ Solucao Implementada

- Handlers convertidos para arrow functions com referencias estaveis.
- Pausa/resume do carousel quando fora da viewport ou aba oculta.

#### Arquivos Modificados

1. `components/equipment-infinite-scroll.tsx`
2. `docs/features/equipment-infinite-scroll.md`
3. `docs/issues/known-issues.md`
4. `CHANGELOG.md`

#### Como Validar

1. Navegue para uma pagina que usa o componente e abra o DevTools Performance.
2. Saia da pagina ou role para fora; confirme que o RAF para.
3. Retorne a pagina; a animacao deve retomar.

#### Armadilhas a Evitar

- Voltar a usar `bind()` na inscricao/remocao de listeners.
- Remover a pausa por interseccao/visibility e reintroduzir CPU em background.

## 62. Lighthouse falha com ECONNREFUSED ao conectar no Chrome

### ?? Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-04 **Severidade**: Media (Observabilidade)
**Status**: Resolvido

#### Descricao

- Alguns testes Lighthouse falhavam com `connect ECONNREFUSED 127.0.0.1:PORT`,
  gerando "ERROR" no relatorio consolidado mesmo com o servidor ativo.

#### Causa Raiz

- O chrome-launcher ocasionalmente recusava a conexao antes do Lighthouse
  iniciar a auditoria, gerando falhas intermitentes.

### ? Solucao Implementada

- Retry com backoff (2s, 5s) ao executar Lighthouse; apenas marca erro apos
  esgotar tentativas.
- Logs de retry mostram tentativa e atraso para facilitar diagnostico.

#### Arquivos Modificados

1. `scripts/lighthouse-batch.js`
2. `docs/guides/performance-testing.md`
3. `docs/issues/known-issues.md`
4. `CHANGELOG.md`

#### Como Validar

1. Execute `pnpm perf:lighthouse` e confirme que falhas intermitentes passam
   apos o retry.
2. Verifique `reports/performance/lighthouse-results.json` sem `ECONNREFUSED`.

#### Armadilhas a Evitar

- Remover o retry/backoff e reintroduzir falhas intermitentes.
- Tratar toda falha como retry (pode mascarar servidor fora do ar).

## 61. Testes de performance sem LCP real e Lighthouse com EPERM

### ?? Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-04 **Severidade**: Media (Observabilidade)
**Status**: Resolvido

#### Descricao

- LCP e TBT capturados pelo Puppeteer eram aproximados (FCP + 300ms e 30% do
  intervalo) por falta de PerformanceObserver registrado antes do load.
- Lighthouse falhava com `EPERM` ao tentar gravar em `%TEMP%` fora do workspace,
  deixando quase todos os relatórios como `ERROR`.

#### Causa Raiz

- O observer de LCP/long task nao era registrado com `buffered: true` antes da
  navegacao, e a emulacao mobile estava parcial (sem `isMobile/hasTouch`).
- O chrome-launcher usava o temp padrao do sistema, bloqueado pelo sandbox.
- O chrome-launcher criava diretorios temporarios (lighthouse.\*) e falhava ao
  limpar no Windows, gerando EPERM.
- Perfis de rede estavam inflados (Slow 3G ~4 Mbps), mascarando problemas reais.

### ? Solucao Implementada

- Registro antecipado de PerformanceObserver para LCP e long tasks
  (`evaluateOnNewDocument`) e calculo de TBT real (long tasks > 50ms apos FCP) +
  TTI pelo ultimo long task.
- Emulacao mobile completa no viewport (isMobile/hasTouch) e throttling de rede
  ajustado para valores realistas (Slow/Fast 3G, 4G).
- Lighthouse/chrome-launcher passam a usar `reports/performance/.tmp` como
  user-data-dir e TMP/TEMP forçados no workspace, evitando EPERM e cleanup
  automático.

#### Arquivos Modificados

1. `scripts/performance-test.js`
2. `scripts/performance-config.json`
3. `scripts/lighthouse-batch.js`
4. `docs/guides/performance-testing.md`
5. `CHANGELOG.md`

#### Como Validar

1. `pnpm perf:test` deve gerar LCP/TBT/TTI nao-N/A (sem FCP + 300ms) e valores
   coerentes por dispositivo.
2. `pnpm perf:lighthouse` deve gerar relatórios HTML em `reports/performance/`
   sem erros `EPERM`.
3. Verificar `reports/performance/performance-results.json` e
   `lighthouse-results.json` com métricas preenchidas.

#### Armadilhas a Evitar

- Remover o `evaluateOnNewDocument` ou desabilitar PerformanceObserver no
  runtime.
- Alterar perfis de rede para valores irreais que mascarem gargalos.
- Rodar Lighthouse apontando para `%TEMP%` fora do workspace em ambientes
  sandbox.

## 60. Botao "Excluir Aprovacao" nao aparece no modal (Admin)

### ?? Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-03 **Severidade**: Media (Admin/UX) **Status**:
Resolvido

#### Descricao

O botao **Excluir Aprovacao** nao era exibido no modal de detalhes do orçamento
mesmo quando havia aprovacao registrada (approvedAt/approvedBy).

#### Sintomas

- Orcamentos PENDING aprovados pelo admin nao mostravam o botao de exclusao
- Orcamentos APPROVED podiam esconder todo o footer de acoes quando o status
  vinha em maiusculo

#### Causa Raiz

- A UI comparava `status` apenas em minusculo; respostas da API podiam vir em
  maiusculo/variavel, escondendo o bloco de acoes
- `approvedAt` podia vir vazio/undefined e a condicao do botao falhava

### ? Solucao Implementada

- Normalizacao do quote no frontend (status para minusculo, limpeza de
  approvedAt/rejectedAt vazios ou como string)
- Helper unico hasApproval para decidir se ha aprovacao (case-insensitive e
  ignorando strings vazias/'null')
- Renderizacao do footer e do botao usa status normalizado, evitando esconder
  acoes quando a API retorna maiusculo
- O mesmo botao outline agora abre a confirmacao de exclusao permanente (DELETE)
  quando houver aprovacao, mantendo o estilo original

#### Arquivos Modificados

1. `app/admin/orcamentos/page.tsx`
2. `docs/features/admin-orcamentos-page.md`
3. `CHANGELOG.md`

#### Como Validar

1. Aprove um orcamento (status continua PENDING, mas approvedAt preenchido) e
   abra o modal: o botao **Excluir Orçamento** deve aparecer.
2. Clique em **Excluir Orçamento**: orcamento removido definitivamente e some do
   Kanban/lista.
3. Teste com um orcamento em status APPROVED: o footer permanece visivel e o
   botao segue disponivel. botao segue disponivel.

#### Armadilhas a Evitar

- Reintroduzir comparacoes de status sensiveis a maiusculo/minusculo
- Confiar em `approvedAt` sem normalizar strings vazias ou `'null'`

---

## 59. Scroll global pisca ao montar o Kanban de orcamentos (Admin)

### ✅ Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-03 **Severidade**: Baixa (UI/Admin) **Status**:
Resolvido

#### Descricao

Ao abrir a aba **Kanban** em `/admin/orcamentos`, a barra de scroll vertical da
pagina aparecia e desaparecia rapidamente mesmo com poucos cards. O flick
ocorria durante a montagem/atualizacao inicial das colunas.

#### Sintomas

- Barra de scroll global piscando por uma fracao de segundo ao montar o Kanban
- Efeito visivel mesmo com 1-2 cards em uma coluna
- Flick visual ao alternar filtros quando os cards eram re-renderizados

#### Causa Raiz

- O wrapper da coluna nao segurava o conteudo; durante as animacoes de
  entrada/saida, a altura variava e empurrava o layout global.
- O corpo da coluna nao tinha `max-height` dedicado, entao o scroll interno nao
  assumia antes de o layout global ganhar altura extra.

### ✅ Solucao Implementada

- Wrapper do Kanban segue com `overflow-hidden` e limita altura usando
  `max-height` (capado a 4 cards) combinado a `min()` com a viewport.
- Corpo da coluna ganhou `max-height` para 4 cards, `overflow-y-auto`
  **condicional (apenas 5+ cards)** e `scrollbar-gutter: stable` para que o
  scroll interno so apareca apos o 5o card e nao pisque na montagem.

#### Arquivos Modificados

1. `components/admin/kanban-pipeline.tsx`
2. `docs/features/admin-orcamentos-page.md`
3. `CHANGELOG.md`

#### Como Validar

1. Abrir `/admin/orcamentos` e selecionar a aba **Kanban**.
2. Observar a montagem inicial e alternar filtros/status rapidamente.
3. Confirmar que a barra de scroll global nao pisca; o scroll fica restrito ao
   corpo da coluna quando ha muitos cards.

#### Armadilhas a Evitar

- Remover `max-height`/`overflow-hidden` do wrapper do Kanban.
- Permitir que o corpo da coluna cresca sem limite (isso volta a forcar scroll
  global).

## 58. Status aprovado era aplicado antes do pagamento do Asaas

### ?? Problema RESOLVIDO

**Data da Ocorrência**: 2026-01-02 **Severidade**: Alta (Pagamentos/Admin)
**Status**: Resolvido

#### Descrição

Ao clicar em "Aprovar Orçamento" no admin, o status mudava para `APPROVED`
imediatamente. A regra correta é manter `PENDING` até o Asaas confirmar o
pagamento (status "paid").

#### Sintomas

- Orçamentos apareciam como aprovados antes do pagamento
- Kanban e métricas contavam como aprovados sem confirmação financeira
- Cliente/admin viam status aprovado sem retorno do Asaas

#### Causa Raiz

- O `PATCH /api/admin/quotes/[id]` atualizava `status = APPROVED` no clique de
  aprovação
- O sistema não diferenciava aprovação do admin de pagamento confirmado

### ✅ Solução Implementada

- Aprovação do admin passa a registrar `approvedAt/approvedBy` e mantém status
  `PENDING`
- Pagamento confirmado atualiza o status para `APPROVED` via
  `processPayment`/`convertPaidQuotePayment`
- UI libera boleto para orçamento aprovado pelo admin sem mudar status

#### Arquivos Modificados

1. `app/api/admin/quotes/[id]/route.ts`
2. `lib/payment-processor.ts`
3. `lib/quote-payment-conversion.ts`
4. `lib/quote-boleto.ts`
5. `app/api/admin/quotes/route.ts`
6. `app/admin/orcamentos/page.tsx`
7. `app/area-cliente/orcamentos/page.tsx`
8. `docs/features/admin-orcamentos-page.md`
9. `docs/features/quote-status-tracking.md`
10. `docs/features/quote-system.md`
11. `docs/features/quote-stock-blocking.md`
12. `docs/issues/known-issues.md`
13. `CHANGELOG.md`

#### Como Validar

1. Criar orçamento e abrir `/admin/orcamentos`.
2. Clicar em "Aprovar Orçamento": status permanece `PENDING` e `approvedAt` é
   preenchido.
3. Gerar/Enviar boleto; status continua `PENDING`.
4. Simular pagamento (webhook/cron): status muda para `APPROVED`.
5. Confirmar que o cliente vê o boleto mesmo com status `PENDING` quando há
   pagamento pendente.

#### Armadilhas a Evitar

- Voltar a alterar status para `APPROVED` no clique de aprovação
- Bloquear geração de boleto para `PENDING` com `approvedAt`
- Atualizar status sem confirmação de pagamento

## 57. Header admin desktop nao sincronizava com sidebar

### ?? Problema RESOLVIDO

**Data da Ocorrencia**: 2025-12-30 **Severidade**: Baixa (UI/Admin) **Status**:
Resolvido

#### Descricao

O header desktop do admin nao acompanhava a animacao do sidebar, causando
descompasso visual ao colapsar/expandir.

#### Sintomas

- Header atrasava em relacao ao sidebar durante a transicao
- Largura do header nao ocupava o espaco restante em md
- Sensacao de "desconexao" entre header e sidebar

#### Causa Raiz

- O `onCollapseChange` era disparado via `useEffect`, iniciando a animacao do
  header um tick depois do sidebar.
- Regras globais de `header` sobrescreviam `left`/`width` no desktop, impedindo
  sincronizacao em md.

### ? Solucao Implementada

- O `onCollapseChange` passou a ser chamado no clique de toggle, garantindo
  update sincronizado.
- O `header.admin-desktop-header` agora define `left`/`width` via
  `data-sidebar-collapsed`, alinhando com `w-20`, `w-56` e `lg:w-64`.

#### Arquivos Modificados

1. `components/admin/admin-sidebar.tsx`
2. `components/admin/admin-desktop-header.tsx`
3. `app/globals.css`
4. `docs/features/admin-desktop-header.md`
5. `docs/issues/known-issues.md`
6. `CHANGELOG.md`

#### Como Validar

1. Abrir `/admin` em md e em lg.
2. Alternar o colapso do sidebar.
3. Confirmar que o header acompanha sem delay e ocupa a largura restante.

#### Armadilhas a Evitar

- Reintroduzir `useEffect` para propagar o estado do sidebar.
- Sobrescrever `left`/`width` do header com regras globais de `header`.

## 56. Boleto nao incluia taxa de entrega no total

### Problema RESOLVIDO

**Data da Ocorrencia**: 2025-12-30 **Severidade**: Media (Pagamentos)
**Status**: Resolvido

#### Descricao

O boleto gerado a partir do orcamento aprovado ignorava a taxa de entrega
(deliveryFee), emitindo um valor menor que o total exibido no admin.

#### Sintomas

- Boleto com valor menor quando o frete estava selecionado
- Diferenca entre total do orcamento e valor do boleto

#### Causa Raiz

- A geracao do boleto usava apenas a soma dos itens, sem considerar
  `finalTotal`/`total` do quote.

### Solucao Implementada

- O calculo do boleto passou a usar `finalTotal` e `total` do orcamento
  (incluindo frete).
- A geracao do boleto ficou restrita ao fluxo de aprovacao no admin.

#### Arquivos Modificados

1. `lib/quote-boleto.ts`
2. `lib/rental-converter.ts`
3. `app/api/admin/quotes/[id]/route.ts`
4. `app/api/orcamentos/route.ts`

#### Como Validar

1. Criar orcamento com entrega e taxa de frete.
2. Aprovar no admin e gerar boleto.
3. Confirmar que o valor do boleto inclui a taxa de entrega.

#### Armadilhas a Evitar

- Voltar a somar apenas os itens do orcamento ao gerar boleto.
- Ignorar `finalTotal` quando houver ajuste de preco.

## 55. Boleto falhava com CPF/CNPJ invalido em chamadas diretas

### ?? Problema RESOLVIDO

**Data da Ocorrencia**: 2025-12-30 **Severidade**: Media (Pagamentos)
**Status**: ? Resolvido

#### Descricao

Chamadas diretas a `/api/quotes` ou `/api/orcamentos` aceitavam CPF/CNPJ
invalido e o Asaas rejeitava a criacao do cliente, impedindo a geracao de
boleto.

#### Sintomas

- Erro `Asaas request failed: ... CPF/CNPJ informado e invalido`
- Boleto nao e gerado mesmo com `ASAAS_API_KEY` configurada

#### Causa Raiz

- O `QuoteRequestSchema` nao validava CPF/CNPJ no servidor.

### ? Solucao Implementada

- Validacao de CPF/CNPJ no `QuoteRequestSchema` usando
  `validateCPF`/`validateCNPJ`.
- Exemplos de teste atualizados com CPF valido nos guias do Asaas.

#### Arquivos Modificados

1. `lib/validations/index.ts`
2. `docs/guides/asaas-boleto-testing.md`
3. `docs/guides/asaas-boleto-testing-iniciantes.md`
4. `docs/features/quote-system.md`
5. `docs/issues/known-issues.md`
6. `CHANGELOG.md`

#### Como Validar

1. Enviar um orcamento com CPF valido (ex: `39053344705`).
2. Confirmar que o boleto e gerado sem erro do Asaas.
3. Enviar um CPF invalido e confirmar resposta 400 de validacao.

#### Armadilhas a Evitar

- Remover a validacao server-side e depender apenas do front-end.
- Usar exemplos de CPF invalidos nos testes/guia.

## 54. ASAAS_API_KEY nao carrega quando a chave comeca com $

### ?? Problema RESOLVIDO

**Data da Ocorrencia**: 2025-12-30 **Severidade**: Critica (Pagamentos)
**Status**: ? Resolvido

#### Descricao

Ao iniciar o Next.js, o arquivo `.env.local` era reconhecido, mas o valor de
`ASAAS_API_KEY` ficava vazio quando a chave comecava com `$`, impedindo a
geracao automatica de boleto.

#### Sintomas

- `process.env.ASAAS_API_KEY` retorna vazio/undefined
- Erro `ASAAS_API_KEY nao esta configurada` ao gerar boleto automaticamente

#### Causa Raiz

- O loader de env do Next (`@next/env`) usa `dotenv-expand` e interpreta `$` nao
  escapado como expansao de variavel, resultando em valor vazio.

### ? Solucao Implementada

- Escapar `$` no valor de `ASAAS_API_KEY` em `.env` e `.env.local` usando `\$`.

#### Arquivos Modificados

1. `.env`
2. `.env.local`
3. `docs/issues/known-issues.md`
4. `docs/features/quote-system.md`
5. `CHANGELOG.md`

#### Como Validar

1. Reiniciar `pnpm dev`.
2. Criar um orcamento com `AUTO_GENERATE_BOLETO_ON_QUOTE="true"`.
3. Confirmar que o log indica `ASAAS_API_KEY` configurada e o boleto eh gerado.

#### Armadilhas a Evitar

- Manter `$` sem escape em `.env*`.
- Copiar a key para outro ambiente sem `\` no prefixo.

## 53. AlertDialog fica quadrado no mobile

### ? Problema RESOLVIDO

**Data da Ocorrencia**: 2025-12-28 **Severidade**: Baixa (UI) **Status**: ?
Resolvido

#### Descricao

No mobile, dialogs de confirmacao baseadas em AlertDialog apareciam com cantos
quadrados e o background interno parecia ultrapassar as bordas.

#### Sintomas

- Cantos quadrados no mobile
- Fundo do dialog nao acompanha o arredondamento do header/footer

#### Causa Raiz

- `AlertDialogContent` aplicava `sm:rounded-lg`, deixando o mobile sem
  arredondamento.

### ? Solucao Implementada

- `AlertDialogContent` passou a usar `rounded-2xl` em todos os breakpoints,
  mantendo o arredondamento consistente e clipando o background.

#### Arquivos Modificados

1. `components/ui/alert-dialog.tsx`
2. `docs/issues/known-issues.md`
3. `docs/features/alert-dialog.md`
4. `CHANGELOG.md`

#### Como Validar

1. Abrir o dialog de confirmacao de saida no mobile.
2. Confirmar que os cantos do dialog permanecem arredondados.
3. Verificar que o background nao "vaza" nas bordas.

#### Armadilhas a Evitar

- Voltar a usar arredondamento apenas em breakpoints maiores (`sm:`).
- Remover `overflow-hidden` do content e reintroduzir vazamento visual.

## 52. Botao "Log In" some por um instante ao recarregar (usuario deslogado)

### ? Problema RESOLVIDO

**Data da Ocorrencia**: 2025-12-28 **Severidade**: Baixa (UI/Auth) **Status**: ?
Resolvido

#### Descricao

Ao recarregar paginas publicas com usuario deslogado, o botao "Log In" sumia por
uma fracao de segundo e aparecia em seguida.

#### Sintomas

- Botao "Log In" nao aparece imediatamente no reload
- Canto direito do header fica vazio por um instante

#### Causa Raiz

- O `SessionProvider` nao recebia a sessao inicial do servidor no layout.
- O `useSession` iniciava em `loading` e o header nao renderiza o estado
  deslogado durante esse periodo.

### ? Solucao Implementada

- O layout passou a obter a sessao via `getServerSession` e fornece-la ao
  `SessionProvider`, eliminando o estado `loading` no primeiro paint.

#### Arquivos Modificados

1. `app/layout.tsx`
2. `components/session-provider-wrapper.tsx`
3. `docs/issues/known-issues.md`
4. `docs/features/header-user-menu.md`
5. `CHANGELOG.md`

#### Como Validar

1. Deslogar do sistema.
2. Recarregar qualquer pagina publica.
3. Confirmar que "Log In" aparece imediatamente, sem sumir.
4. Logar e recarregar; confirmar que nao aparece flash de "Sign In/Log In".

#### Armadilhas a Evitar

- Voltar a montar o `SessionProvider` sem a sessao inicial.
- Reintroduzir exibicao do estado deslogado durante `status === 'loading'`.

## 51. Flash de "Sign In/Log In" no header ao navegar para Equipamentos

### ? Problema RESOLVIDO

**Data da Ocorrencia**: 2025-12-28 **Severidade**: Baixa (UI/Auth) **Status**: ?
Resolvido

#### Descricao

Ao navegar para `/equipamentos` pelo header, o topo exibia rapidamente "Sign In"
e "Log In" antes do menu "Ola, [nome]!" aparecer.

#### Sintomas

- Links "Sign In/Log In" aparecem por uma fracao de segundo mesmo com usuario
  logado
- Menu "Ola, [nome]!" aparece somente depois da sessao carregar

#### Causa Raiz

- O header tratava `session` indefinida como usuario deslogado sem considerar
  `status === 'loading'` do NextAuth.
- Em navegacoes com reload completo (ex.: `window.location.href`), o estado
  `loading` fica visivel, expondo o layout de deslogado.

### ? Solucao Implementada

- O header passou a exibir "Sign In/Log In" apenas quando
  `status === 'unauthenticated'`.
- Durante `status === 'loading'`, o header nao renderiza o estado deslogado,
  evitando o flash.

#### Arquivos Modificados

1. `components/header.tsx`
2. `docs/issues/known-issues.md`
3. `docs/features/header-user-menu.md`
4. `CHANGELOG.md`

#### Como Validar

1. Logar no sistema.
2. Em qualquer pagina (ex.: `/orcamento`), clicar em "Equipamentos".
3. Confirmar que nao aparece flash de "Sign In/Log In" e o menu "Ola, [nome]!"
   surge direto.

#### Armadilhas a Evitar

- Voltar a renderizar o estado deslogado apenas checando `session`.
- Ignorar o `status` do `useSession` em elementos do header.

## 50. Menu do usuario no header nao exibia bolinha de notificacoes

### ? Problema RESOLVIDO

**Data da Ocorrencia**: 2025-12-27 **Severidade**: Baixa (Area do Cliente/UI)
**Status**: ? Resolvido

#### Descricao

No dropdown do usuario no header, o item "Notificacoes" nao mostrava a bolinha
vermelha de alerta quando havia notificacoes nao lidas.

#### Sintomas

- Item "Notificacoes" no dropdown nao exibe a bolinha vermelha
- Area-cliente sidebar exibe o alerta, mas o header nao

#### Causa Raiz

- O indicador do header era menor e sem borda, ficando praticamente invisivel no
  dropdown.

### ? Solucao Implementada

- O indicador do item "Notificacoes" no dropdown foi alinhado ao mesmo estilo
  usado no menu da area-cliente (tamanho e borda).

#### Arquivos Modificados

1. `components/header.tsx`
2. `docs/issues/known-issues.md`
3. `docs/features/header-user-menu.md`
4. `CHANGELOG.md`

#### Como Validar

1. Com notificacoes nao lidas, abrir o menu do header.
2. Confirmar a bolinha vermelha ao lado do icone de "Notificacoes".

#### Armadilhas a Evitar

- Alterar `components/ui/dropdown-menu.tsx` e impactar dropdowns do admin.

## 49. Menu do usuario no header no mobile nao alinhava scroll ao banner

### ? Problema RESOLVIDO

**Data da Ocorrencia**: 2025-12-27 **Severidade**: Baixa (Area do
Cliente/Mobile) **Status**: ? Resolvido

#### Descricao

No mobile, ao usar o menu do usuario no header para navegar entre paginas da
area do cliente, o scroll permanecia desalinhado e o topo do banner ficava
encoberto pelo header fixo.

#### Sintomas

- Ao clicar em itens como "Meus Orcamentos" no menu do header (mobile), a pagina
  abre sem alinhar o topo do banner
- O inicio do banner fica parcialmente escondido pelo header fixo

#### Causa Raiz

- Itens do dropdown do header navegavam com `router.push` sem marcar
  `adjustScrollAfterLoad`, usado pelo layout da area do cliente para aplicar
  `scrollToBanner` no mobile.

### ? Solucao Implementada

- O menu do usuario passou a marcar `adjustScrollAfterLoad` em navegacoes mobile
  para rotas `/area-cliente/*`, garantindo ajuste de scroll ao
  `#dashboard-banner`.

#### Arquivos Modificados

1. `components/header.tsx`
2. `docs/issues/known-issues.md`
3. `docs/features/header-user-menu.md`
4. `CHANGELOG.md`

#### Como Validar

1. Em um viewport mobile, abrir o menu "Ola, [nome]!" no header.
2. Clicar em "Meus Orcamentos" ou "Notificacoes".
3. Confirmar que o topo do banner aparece logo abaixo do header.

#### Armadilhas a Evitar

- Aplicar `adjustScrollAfterLoad` para rotas que nao possuem `#dashboard-banner`
  (ex.: `/contato`).
- Alterar `components/ui/dropdown-menu.tsx` e impactar dropdowns do admin.

## 48. Menu do usuario no header com scroll interno escondia itens

### ? Problema RESOLVIDO

**Data da Ocorrencia**: 2025-12-28 **Severidade**: Baixa (UI/UX) **Status**: ?
Resolvido

#### Descricao

No menu do usuario no header, o dropdown limitava a altura e criava scroll
interno, escondendo itens quando a lista era maior.

#### Sintomas

- Dropdown do header exibe barra de scroll com itens visiveis parcialmente
- Itens do menu (ex.: Suporte, Sair) ficam ocultos sem rolar

#### Causa Raiz

- `DropdownMenuContent` define `max-h-[300px]` por padrao e o header herdava
  esse limite.

### ? Solucao Implementada

- O menu do usuario no header passou a usar `max-h-none`, permitindo altura
  automatica para listar todos os itens.

#### Arquivos Modificados

1. `components/header.tsx`
2. `docs/issues/known-issues.md`
3. `docs/features/header-user-menu.md`
4. `CHANGELOG.md`

#### Como Validar

1. Logar como cliente e abrir o menu "Ola, [nome]!" no header.
2. Confirmar que todos os itens aparecem sem scroll interno.

#### Armadilhas a Evitar

- Alterar `components/ui/dropdown-menu.tsx` e impactar dropdowns do admin.

## 47. Exclusao do orcamento na area do cliente removia registro do admin

### ? Problema RESOLVIDO

**Data da Ocorrencia**: 2025-12-27 **Severidade**: Alta (Seguranca/Admin)
**Status**: ? Resolvido

#### Descricao

Ao excluir um orcamento em `/area-cliente/orcamentos`, o registro era apagado do
banco e sumia do painel admin em `/admin/orcamentos`.

#### Sintomas

- Orcamento some do admin apos o cliente excluir na area do cliente
- Historico do admin perde o registro do orcamento

#### Causa Raiz

- O DELETE de `/api/quotes/[id]` fazia `prisma.quote.delete`, removendo o
  registro definitivo.

### ? Solucao Implementada

- Exclusao do cliente passou a ser soft delete via `clientDeletedAt`.
- `GET /api/quotes` filtra `clientDeletedAt: null` para ocultar no historico do
  cliente sem afetar o admin.

#### Arquivos Modificados

1. `prisma/schema.prisma`
2. `app/api/quotes/route.ts`
3. `app/api/quotes/[id]/route.ts`
4. `docs/issues/known-issues.md`
5. `docs/features/quote-system.md`
6. `CHANGELOG.md`

#### Como Validar

1. Criar um orcamento e confirmar que aparece no admin.
2. Na area do cliente, excluir o orcamento em `/area-cliente/orcamentos`.
3. Confirmar que o orcamento some da lista do cliente.
4. Confirmar que o orcamento continua no admin em `/admin/orcamentos`.

#### Armadilhas a Evitar

- Voltar a usar `prisma.quote.delete` no endpoint do cliente.
- Remover o filtro `clientDeletedAt: null` da listagem do cliente.

## 46. Badge de notificacoes nao aparecia no header e sidebar sem abrir a pagina de notificacoes

### ? Problema RESOLVIDO

**Data da Ocorrencia**: 2025-12-27 **Severidade**: Media (Area do Cliente)
**Status**: ? Resolvido

#### Descricao

Ao rejeitar um orcamento no admin, a notificacao era criada, mas o badge de
notificacoes no header e na sidebar nao aparecia ate o usuario abrir
`/area-cliente/notificacoes`.

#### Sintomas

- Badge de notificacoes nao aparece no header (Minha conta) apos rejeicao
- Badge nao aparece na sidebar sem abrir a pagina de notificacoes
- Contador so aparece depois de visitar `/area-cliente/notificacoes`

#### Causa Raiz

- Header e layout da area do cliente apenas liam o contador do localStorage e do
  evento `notificationUpdate`, sem sincronizar com a API na entrada.
- O contador real so era carregado quando a pagina de notificacoes buscava os
  dados.

### ? Solucao Implementada

- Header passou a buscar `/api/client/notifications/stats` quando o usuario esta
  autenticado e a disparar `notificationUpdate` com o valor real.
- Contador e localStorage sao atualizados sem depender da pagina de
  notificacoes.

#### Arquivos Modificados

1. `components/header.tsx`
2. `docs/issues/known-issues.md`
3. `docs/features/notification-system.md`
4. `CHANGELOG.md`

#### Como Validar

1. Rejeitar um orcamento no admin.
2. Entrar no site como cliente e abrir qualquer pagina (ex.: `/` ou
   `/area-cliente`).
3. Confirmar que o badge aparece no header e na sidebar sem abrir
   `/area-cliente/notificacoes`.
4. Abrir `/area-cliente/notificacoes` e marcar como lida; o badge deve sumir.

#### Armadilhas a Evitar

- Depender apenas do localStorage sem sincronizar com a API.
- Atualizar o contador somente dentro da pagina de notificacoes.

## 45. Dropdown de mes/ano exibia opcoes passadas e ano nao alternava

### ? Problema RESOLVIDO

**Data da Ocorrencia**: 2025-12-27 **Severidade**: Baixa (UI/UX) **Status**: ?
Resolvido

#### Descricao

No calendario de selecao de datas da pagina de equipamentos, o dropdown de mes
listava meses anteriores e a troca de ano mantinha o mesmo mes (ex.: dezembro).

#### Sintomas

- Dropdown de mes mostra meses anteriores ao vigente
- Dropdown de ano lista anos anteriores ao vigente (quando nao limitado)
- Trocar o ano mantem o mes atual (ex.: dezembro -> dezembro)

#### Causa Raiz

- O `react-day-picker` usa um range padrao quando `captionLayout` esta em
  `dropdown`, e o calendario nao definia limites de mes/ano.
- O calendario era controlado por `month={startDate || today}` sem
  `onMonthChange`, impedindo a navegacao por ano/mes.
- A troca de ano usa o mes atual por padrao, sem resetar para janeiro.
- Opcoes desabilitadas do dropdown de meses ainda eram exibidas.

### ? Solucao Implementada

- Definidos `fromMonth`/`toMonth` e `fromYear`/`toYear` com base em `today` e
  `maxDate` para limitar meses/anos exibidos.
- `maxDate` passou a considerar 10 anos a frente para liberar anos futuros.
- Removido o controle fixo de `month` para permitir navegacao do dropdown.
- Dropdown passou a ocultar opcoes desabilitadas quando necessario.
- Troca de ano agora abre janeiro (ou o primeiro mes disponivel) do ano
  selecionado.

#### Arquivos Modificados

1. `components/ui/calendar.tsx`
2. `components/smart-equipment-pricing.tsx`
3. `docs/issues/known-issues.md`
4. `docs/features/equipment-booking-system.md`
5. `CHANGELOG.md`

#### Como Validar

1. Abrir a pagina de detalhes de um equipamento.
2. Abrir o calendario de selecao de datas.
3. Verificar que o dropdown de mes inicia no mes vigente e nao lista meses
   anteriores.
4. Selecionar o proximo ano (ex.: 2026) e confirmar que o calendario abre em
   janeiro (ou no primeiro mes disponivel).
5. Se o `maxDate` limitar o periodo (10 anos), confirmar que meses/anos alem do
   limite nao aparecem.

#### Armadilhas a Evitar

- Reintroduzir `month` fixo sem `onMonthChange`.
- Remover `fromMonth`/`toMonth` ou `fromYear`/`toYear`.
- Exibir opcoes desabilitadas no dropdown de meses.

---

## 44. Total nao listava desconto aplicado por equipamento

### ? Problema RESOLVIDO

**Data da Ocorrencia**: 2025-12-26 **Severidade**: Media (Area do Cliente)
**Status**: ? Resolvido

#### Descricao

No bloco "Total" de `/area-cliente/historico/[id]`, o cliente nao via o
**desconto aplicado** por equipamento, apenas o valor final.

#### Sintomas

- Bloco "Total" exibe apenas o valor final
- Cliente nao identifica o desconto aplicado por item

#### Causa Raiz

- O bloco nao renderizava a lista de descontos por equipamento.

### ? Solucao Implementada

- O bloco "Total" passou a listar o desconto aplicado por equipamento,
  priorizando `quote.items.appliedDiscount` e `quote.items.appliedPeriod`.

#### Arquivos Modificados

1. `app/area-cliente/historico/[id]/page.tsx`
2. `docs/issues/known-issues.md`
3. `docs/features/area-cliente-historico-detalhes.md`
4. `CHANGELOG.md`

#### Como Validar

1. Abrir `/area-cliente/historico/[id]` com 2 itens.
2. Confirmar que o bloco "Total" lista o desconto aplicado por equipamento.

#### Armadilhas a Evitar

- Remover a lista de descontos no resumo.

---

## 43. Runtime error ao exibir periodos por item no historico

### ? Problema RESOLVIDO

**Data da Ocorrencia**: 2025-12-26 **Severidade**: Alta (Area do Cliente)
**Status**: ? Resolvido

#### Descricao

Ao abrir `/area-cliente/historico/[id]` apos a mudanca de periodos por item, a
pagina quebrava com `ReferenceError: showItemizedPeriods is not defined`.

#### Sintomas

- Tela em branco na pagina de detalhes
- Erro no console apontando `showItemizedPeriods`

#### Causa Raiz

- Variaveis derivadas de periodo nao foram definidas antes do render.

### ? Solucao Implementada

- Adicionadas as variaveis `periodItems` e `showItemizedPeriods` antes do
  retorno do componente.

#### Arquivos Modificados

1. `app/area-cliente/historico/[id]/page.tsx`
2. `docs/issues/known-issues.md`
3. `CHANGELOG.md`

#### Como Validar

1. Abrir `/area-cliente/historico/[id]` com 2 itens em periodos diferentes.
2. Confirmar que a pagina carrega sem erro.
3. Verificar o bloco de periodo exibindo datas por item.

#### Armadilhas a Evitar

- Referenciar flags de UI antes de defini-las.

---

## 42. Periodo de locacao nao listava itens com datas diferentes

### ? Problema RESOLVIDO

**Data da Ocorrencia**: 2025-12-26 **Severidade**: Media (Area do Cliente)
**Status**: ? Resolvido

#### Descricao

Na pagina `/area-cliente/historico/[id]`, o bloco "Periodo de Locacao" mostrava
apenas o intervalo global, mesmo quando os itens tinham datas individuais
diferentes.

#### Sintomas

- Multiplos equipamentos com dias diferentes exibem um unico periodo
- Cliente nao consegue ver o periodo de cada item

#### Causa Raiz

- O bloco usava apenas `rental.startdate` e `rental.enddate`, ignorando
  `quote.items` com `startDate`/`endDate` por item.

### ? Solucao Implementada

- Quando existem itens com periodos diferentes, o bloco passa a listar o inicio
  e termino por equipamento.
- Mantem o intervalo global quando todos os itens compartilham o mesmo periodo
  ou nao ha dados de itens.

#### Arquivos Modificados

1. `app/area-cliente/historico/[id]/page.tsx`
2. `docs/issues/known-issues.md`
3. `docs/features/area-cliente-historico-detalhes.md`
4. `CHANGELOG.md`

#### Como Validar

1. Criar locacao com 2 equipamentos em periodos diferentes.
2. Abrir `/area-cliente/historico/[id]`.
3. Confirmar que o bloco lista datas por equipamento.
4. Criar locacao com itens no mesmo periodo e validar que o bloco exibe um unico
   intervalo.

#### Armadilhas a Evitar

- Remover a leitura de `quote.items` para periodos.
- Exibir apenas o periodo global quando os itens diferem.

---

## 41. Total a pagar 10x maior na pagina de detalhes da locacao

### ? Problema RESOLVIDO

**Data da Ocorrencia**: 2025-12-26 **Severidade**: Media (Area do Cliente)
**Status**: ? Resolvido

#### Descricao

Na pagina `/area-cliente/historico/[id]`, o bloco "Total a Pagar" exibia um
valor 10x maior do que o esperado (ex.: R$ 600,00 em vez de R$ 60,00).

#### Sintomas

- "Total a Pagar" aparece 10x maior
- "Total" exibe o valor correto

#### Causa Raiz

- Valores Decimal chegavam como string; a soma com `0` gerava concatenacao
  ("60" + 0 = "600").
- A pagina nao priorizava o total final do orcamento quando disponivel.

### ? Solucao Implementada

- `displayTotal` passa a priorizar o total final do orcamento
  (`quote.finalTotal` ou `quote.total`).
- Coercao numerica aplicada antes das somas para evitar concatenacao.

#### Arquivos Modificados

1. `app/area-cliente/historico/[id]/page.tsx`
2. `docs/issues/known-issues.md`
3. `docs/features/area-cliente-historico-detalhes.md`
4. `CHANGELOG.md`

#### Como Validar

1. Abrir `/area-cliente/historico/[id]` para uma locacao de 1 dia (R$ 60,00).
2. Confirmar que "Total a Pagar" exibe R$ 60,00 (ou o total final do orcamento).
3. Se houver multa, confirmar que a soma com o total esta correta.

#### Armadilhas a Evitar

- Somar valores Decimal como string.
- Ignorar `quote.finalTotal` quando existir.

---

## 40. Badge de notificacoes nao sincronizava ao rejeitar orcamento

### ? Problema RESOLVIDO

**Data da Ocorrencia**: 2025-12-26 **Severidade**: Media (Area do Cliente)
**Status**: ? Resolvido

#### Descricao

Ao rejeitar um orcamento no admin, a notificacao era criada no banco, mas o
badge da Area do Cliente e do header nao atualizava ate o usuario abrir
`/area-cliente/notificacoes`. Ao navegar pelo botao "Minha conta", o badge podia
desaparecer porque o contador vinha zerado do localStorage.

#### Sintomas

- Badge de notificacoes nao aparece no header/side bar apos rejeicao
- Badge some ao clicar em "Minha conta"
- Notificacao so aparece apos abrir `/area-cliente/notificacoes`

#### Causa Raiz

- Contador de nao lidas dependia apenas de localStorage/evento e nao era
  sincronizado com a API fora da pagina de notificacoes
- Simulacao de notificacoes nao lidas no layout sobrescrevia o valor real

### ? Solucao Implementada

- Header passa a buscar `/api/client/notifications/stats` quando o usuario esta
  autenticado e dispara `notificationUpdate` com o valor real
- Removida a simulacao de notificacoes nao lidas no layout da Area do Cliente

#### Arquivos Modificados

1. `components/header.tsx`
2. `app/area-cliente/layout.tsx`
3. `docs/features/notification-system.md`
4. `docs/issues/known-issues.md`
5. `CHANGELOG.md`

#### Como Validar

1. Rejeitar um orcamento no admin
2. Entrar no site como cliente e verificar o badge no header e na sidebar sem
   abrir `/area-cliente/notificacoes`
3. Confirmar que o badge continua visivel ao clicar em "Minha conta"
4. Abrir `/area-cliente/notificacoes` e marcar como lida; o badge deve
   desaparecer

#### Armadilhas a Evitar

- Reintroduzir simulacao de notificacoes no layout
- Atualizar o contador apenas na pagina de notificacoes

---

## 39. Recuperacao de senha nao enviava email e pagina de reset inexistente

### ? Problema RESOLVIDO

**Data da Ocorrencia**: 2025-12-24 **Severidade**: Alta (Auth) **Status**: ?
Resolvido

#### Descricao

A pagina `/recuperar-senha` retornava sucesso, mas o email nao era enviado em
ambiente local e o link apontava para `/reset-password`, que nao existia.

#### Sintomas

- Mensagem de "Email enviado" sem recebimento de email
- Link de recuperacao retornava 404
- Token criado sem UI para redefinir senha

#### Causa Raiz

- Envio de email condicionado a `NODE_ENV === 'production'`
- Rota `/reset-password` nao implementada

### ? Solucao Implementada

- Email de recuperacao enviado quando `RESEND_API_KEY` e `FROM_EMAIL` estao
  configurados
- Criada pagina `/reset-password` com formulario de nova senha e confirmacao
- Fluxo conectado ao endpoint `/api/auth/reset-password`

#### Arquivos Modificados

1. `app/api/auth/forgot-password/route.ts`
2. `app/reset-password/page.tsx`
3. `docs/features/password-recovery-system.md`
4. `docs/issues/known-issues.md`
5. `CHANGELOG.md`

#### Como Validar

1. Solicitar recuperacao em `/recuperar-senha` com email valido
2. Confirmar recebimento do link `/reset-password?token=...`
3. Redefinir a senha e fazer login

#### Armadilhas a Evitar

- Reintroduzir bloqueio de email fora de producao
- Alterar a rota do link sem atualizar o template do email

---

## 38. Clique em eventos do popover agregado nao abre dialog

### ? Problema RESOLVIDO

**Data da Ocorrencia**: 2025-12-23 **Severidade**: Alta (UI/UX) **Status**: ?
Resolvido

#### Descricao

Quando o usuario clicava em um evento dentro do popover agregado ("+N"), o
popover fechava mas a dialog de detalhes nao abria, mesmo com o clique direto no
EventBlock funcionando.

#### Sintomas

- Popover abre e lista eventos
- Clique no evento fecha o popover mas nao abre a dialog
- Logs indicavam onEventClick chamado
- Clique direto no calendario abria a dialog normalmente

#### Causa Raiz

- `EventBlock.onClick` aceitava `() => void`, enquanto o popover chama
  `onEventClick(event)`
- Daily/Weekly passavam um closure que capturava o evento agregador, ignorando o
  evento clicado no popover

### ? Solucao Implementada

- `EventBlock` agora recebe `onClick?: (event: CalendarEvent) => void` e repassa
  o evento clicado
- Daily/Weekly repassam `onEventClick` diretamente para o `EventBlock`
- Logs de debug removidos do `AggregatedEventsPopover`

#### Arquivos Modificados

1. `components/admin/advanced-calendar/event-block.tsx`
2. `components/admin/advanced-calendar/daily-view.tsx`
3. `components/admin/advanced-calendar/weekly-view.tsx`
4. `components/admin/advanced-calendar/aggregated-events-popover.tsx`
5. `docs/features/advanced-calendar-system.md`
6. `CHANGELOG.md`

#### Como Validar

1. Criar 4+ eventos simultaneos para gerar badge "+N"
2. Clicar no badge e selecionar um evento no popover
3. Confirmar que o popover fecha e a dialog abre com o evento correto
4. Confirmar que clique direto em um EventBlock continua abrindo a dialog

#### Armadilhas a Evitar

- Voltar `EventBlock.onClick` para `() => void` ou criar closures que ignoram o
  evento clicado
- Passar handlers que capturam o evento agregador em vez do evento individual

---

## 37. Dias alterados no orcamento nao atualizavam o fim do periodo

### ? Problema RESOLVIDO

**Data da Ocorrencia**: 2025-12-22 **Severidade**: Alta (Regras de negocio)
**Status**: ? Resolvido

#### Descricao

Quando o usuario alterava o numero de dias no `/orcamento` para um item que ja
possuia `startDate`/`endDate` definidos pelo calendario, o fim do periodo
permanecia com a data antiga. Isso gerava divergencia entre `days` e o intervalo
exibido/enviado para a API.

#### Sintomas

- Campo "Dias" atualizado, mas o texto "Periodo: DD/MM/YYYY ate DD/MM/YYYY"
  mantinha a data final antiga
- Payload enviado para `/api/quotes` carregava `days` diferente do `endDate`
- Validacao de disponibilidade e resumo exibiam um periodo inconsistente

#### Causa Raiz

- `updateItemDays` no `useCartStore` atualizava apenas `days`, sem recalcular
  `endDate`
- `resolveDateRange` em `/orcamento` prioriza `startDate`/`endDate` quando
  existem

### ? Solucao Implementada

- `updateItemDays` passou a recalcular `endDate` (e normalizar `startDate`)
  quando o item possui data inicial, usando `getAutoRentalDateRange` com base na
  data de inicio e na preferencia de finais de semana
- A pagina de orcamento passou a documentar que ajustes em `days` mantem o
  periodo sincronizado

#### Arquivos Modificados

1. `stores/useCartStore.ts`
2. `docs/features/orcamento-page.md`
3. `CHANGELOG.md`

#### Como Validar

1. Adicione um item ao carrinho com datas selecionadas no calendario (ex.:
   22/12/2025 a 31/12/2025)
2. Em `/orcamento`, altere o campo "Dias" para um valor maior (ex.: 59)
3. Confirme que o periodo exibido atualiza a data final conforme os dias
4. Envie o orcamento e verifique que `startDate`/`endDate` correspondem ao novo
   periodo

#### Armadilhas a Evitar

- Atualizar `days` sem sincronizar `endDate`
- Exibir datas salvas quando os dias ja foram alterados no carrinho

---

## 36. Datas automáticas ignoravam finais de semana quando não havia calendário

### ?? Problema RESOLVIDO

**Data da Ocorrencia**: 2025-12-22 **Severidade**: Alta (Regras de negócio)
**Status**: Resolvido

#### Descrição

Quando o usuário não selecionava datas no calendário da página de detalhes, o
sistema calculava start/end automaticamente a partir do dia da solicitação, mas
ignorava a preferência de finais de semana. Isso podia iniciar em sábado/domingo
mesmo com `includeWeekends=false` e gerava períodos corridos. Além disso, a
confirmação de finais de semana ocorria apenas na página de orçamento e itens
sem datas não exibiam um período estimado.

#### Sintomas

- Itens adicionados sem calendário não exibiam datas de início/fim no orçamento
- Solicitações feitas no fim de semana com `includeWeekends=false` iniciavam no
  próprio fim de semana
- Contagem de dias ignorava finais de semana mesmo quando o usuário não
  pretendia incluir
- Confirmação de finais de semana aparecia apenas no submit do orçamento

#### Causa Raiz

- A lógica de datas automáticas em `POST /api/quotes` somava dias corridos sem
  considerar `includeWeekends`
- Não existia flag de confirmação da preferência de finais de semana no carrinho
- A UI não calculava/exibia período estimado quando não havia calendário

### ✅ Solução Implementada

- Confirmação de finais de semana movida para o detalhe do equipamento antes de
  adicionar ao carrinho
- Introduzida flag `includeWeekendsConfirmed` no carrinho para evitar
  confirmações duplicadas
- Nova util `getAutoRentalDateRange` calcula datas automáticas respeitando
  `includeWeekends` e pula fins de semana quando necessário
- Página `/orcamento` passou a exibir período estimado quando não há datas
  explícitas

#### Arquivos Modificados

1. `components/smart-quote-button.tsx`
2. `components/smart-equipment-pricing.tsx`
3. `stores/useCartStore.ts`
4. `lib/rental-date-utils.ts`
5. `app/api/quotes/route.ts`
6. `app/orcamento/page.tsx`
7. `docs/features/quote-system.md`
8. `docs/features/orcamento-page.md`
9. `CHANGELOG.md`

#### Como Validar

1. Na página de detalhes, não selecione datas no calendário e clique em
   "Solicitar Orçamento"
2. Confirme **Não** para finais de semana e verifique no `/orcamento` a data de
   início no próximo dia útil
3. Repita confirmando **Sim** e confira que o período conta dias corridos,
   incluindo fim de semana
4. Se selecionar datas no calendário, confirme que o dialog não aparece e o
   período exibido respeita a seleção

#### Armadilhas a Evitar

- Remover `includeWeekendsConfirmed` e reintroduzir confirmação tardia no
  `/orcamento`
- Voltar a calcular datas automáticas sem considerar `includeWeekends`
- Exibir apenas o número de dias sem período estimado quando não houver
  calendário

---

## 35. Hover laranja da timeline semanal nao reagia ao peer

### ?? Problema RESOLVIDO

**Data da Ocorrencia**: 2025-12-21 **Severidade**: Baixa (UI) **Status**: ✅
Resolvido

#### Descricao

Na visao semanal (TimelineView) do calendario avancado, o hover esperado com
`peer`/`peer-hover` nos headers de dias e na lista de recursos nao aplicava o
background laranja nas colunas/linhas correspondentes.

#### Sintomas

- Hover em "SEG 15", "TER 16" nao destacava a coluna inteira
- Hover em recursos da sidebar (Pendente/Aprovado/Rejeitado) nao destacava a
  linha correspondente
- Hover em "Equipamentos" nao destacava todos os dias e recursos
- Apenas o background do proprio header/linha respondia ao hover

#### Causa Raiz

- Headers e swimlanes estavam em containers separados, impedindo o `peer` de
  afetar as colunas/linhas
- Overlays e linhas usavam `backgroundColor` inline que sobrepunha `peer-hover`
- `bg-slate-50` permanecia junto com `bg-orange-50`, e a ordem das classes
  mantinha o fundo cinza em alguns estados

### ✅ Solucao Implementada

- Reestruturado o layout da `TimelineView` para usar uma grade unica com camada
  de colunas, permitindo `peer`/`peer-hover` entre header e overlay
- Lista de recursos e swimlanes agora compartilham a mesma grade, garantindo
  hover sincronizado por linha
- Removidos estados de hover e estilos inline conflitantes
- Hover no header "Equipamentos" agora ativa destaque global de dias e recursos
- Classes de background agora alternam entre `bg-slate-50` e `bg-orange-50`,
  evitando conflito de estilos

#### Arquivos Modificados

1. `components/admin/advanced-calendar/timeline-view.tsx`
2. `docs/features/advanced-calendar-system.md`
3. `CHANGELOG.md`

#### Como Validar

1. Abrir o calendario avancado na visao semanal
2. Passar o mouse sobre um header de dia (SEG/TER/...) e confirmar o highlight
   na coluna
3. Passar o mouse sobre um recurso da sidebar e confirmar o highlight na linha
4. Confirmar que diario e mensal nao foram afetados
5. Passar o mouse sobre "Equipamentos" e confirmar o destaque em toda a grade

#### Armadilhas a Evitar

- Voltar a separar headers/linhas em containers diferentes e perder o
  `peer-hover`
- Reintroduzir estilos inline de background que sobrescrevam o hover

---

## 34. Borda preta (focus ring) no botão de fechar do Dialog

### ?? Problema RESOLVIDO

**Data da Ocorrência**: 2025-12-20 **Severidade**: Baixa (UI) **Status**: ✅
Resolvido

#### Descrição

Quando o dialog era aberto, o botão de fechar (DialogClose) exibia uma borda
preta ao redor ao receber foco, causando uma experiência visual indesejada. O
usuário já havia documentado anteriormente que não deseja focus rings em botões
sem seu conhecimento ou consentimento.

#### Sintomas

- Borda preta aparecendo ao redor do botão de fechar quando o dialog era aberto
- Focus ring visível no botão DialogClose
- Experiência visual inconsistente com as preferências do usuário

#### Causa Raiz

- O `CLOSE_BUTTON_BASE_CLASSES` no componente `dialog.tsx` não incluía estilos
  para remover o focus ring
- Falta de regras CSS globais específicas para remover focus ring de botões de
  dialog
- O navegador/Tailwind aplicava o focus ring padrão

### ✅ Solução Implementada

- Adicionado `focus:outline-none focus:ring-0` ao `CLOSE_BUTTON_BASE_CLASSES` em
  `components/ui/dialog.tsx`
- Criadas regras CSS globais em `app/globals.css` para remover focus ring de
  botões de fechar do dialog
- Regras específicas para botões com `aria-label` contendo "Fechar", "fechar",
  "Close" ou "close"
- Regras adicionais para botões posicionados no canto superior direito do dialog
  header

#### Arquivos Modificados

1. `components/ui/dialog.tsx` - Adicionado `focus:outline-none focus:ring-0` ao
   `CLOSE_BUTTON_BASE_CLASSES`
2. `app/globals.css` - Adicionadas regras globais para remover focus ring de
   botões de dialog

#### Como Validar

1. Abrir qualquer dialog no sistema
2. Verificar que o botão de fechar não exibe borda preta ao receber foco
3. Confirmar que não há focus ring visível em nenhum estado do botão

#### Armadilhas a Evitar

- **NUNCA** adicionar focus ring em botões sem consentimento explícito do
  usuário
- **NUNCA** remover os estilos `focus:outline-none focus:ring-0` do
  `CLOSE_BUTTON_BASE_CLASSES`
- **NUNCA** adicionar estilos de focus ring em botões de dialog sem consultar o
  usuário primeiro
- **SEMPRE** seguir as preferências do usuário documentadas sobre focus rings em
  botões

---

## 33. Linhas da timeline nao preenchiam a altura do bloco

### ? Problema RESOLVIDO

**Data da Ocorrencia**: 2025-12-20 **Severidade**: Baixa (UI) **Status**: ?
Resolvido

#### Descricao

Na visao Timeline (Equipamentos) do calendario avancado, quando havia poucos
recursos, as linhas ficavam com altura fixa (60px) e sobrava espaco vazio no
bloco. O objetivo era fazer as linhas ocuparem 100% da altura disponivel.

#### Sintomas

- Com poucos recursos, a area abaixo das linhas ficava vazia
- As linhas nao esticavam para preencher o container

#### Causa Raiz

- As swimlanes e a lista de recursos usavam `height` fixo com
  `TIMELINE_ROW_HEIGHT`
- O container nao distribuia o espaco livre entre as linhas

### ? Solucao Implementada

- Linhas passaram a ser distribuidas por CSS Grid com `minmax(60px, 1fr)`,
  permitindo expandir quando ha espaco livre
- Grid usa o mesmo template de linhas na lista e nas swimlanes para manter
  alinhamento e scroll quando necessario

#### Arquivos Modificados

1. `components/admin/advanced-calendar/timeline-view.tsx`

#### Como Validar

1. Abrir a visao "Equipamentos" do calendario avancado com poucos recursos
2. Confirmar que as linhas preenchem toda a altura do bloco, sem area vazia
3. Adicionar mais recursos e verificar que o scroll continua funcionando

#### Armadilhas a Evitar

- Voltar a usar `height` fixo nas linhas, impedindo o preenchimento do container
- Remover o template `minmax(60px, 1fr)` e perder a distribuicao de altura

## 32. Altura inconsistente no cabecalho da timeline (Equipamentos)

### ? Problema RESOLVIDO

**Data da Ocorrencia**: 2025-12-19 **Severidade**: Baixa (UI) **Status**: ?
Resolvido

#### Descricao

Na visao Timeline (Equipamentos) do calendario avancado, a linha do cabecalho de
dias tinha altura diferente das linhas de recursos, e a ultima linha parecia
mais alta por falta de separacao visual. Alem disso, havia uma linha residual
fina no fim da lista e um pequeno espaco no rodape (altura da barra horizontal).

#### Sintomas

- Cabecalho (SEG/TER/...) com altura diferente das linhas de recursos
- Ultima linha aparenta ficar maior por falta de borda inferior
- Linha residual fina no fim da lista
- Espaco pequeno (~7px) abaixo da ultima linha

#### Causa Raiz

- Cabecalho com altura fixa de 48px enquanto as linhas usam 60px
- Borda final sem controle consistente, causando percepcao de espaco extra ou
  linha residual no fim
- `overflow-x-auto` no grid reservava altura para scrollbar horizontal

### ? Solucao Implementada

- Padronizada a altura do cabecalho e das linhas com a mesma constante
- Borda inferior aplicada nas linhas com `last:border-b-0` para evitar linha
  residual no fim
- Grid da timeline agora usa `overflow-x-hidden` para evitar a reserva de altura
  no rodape

#### Arquivos Modificados

1. `components/admin/advanced-calendar/timeline-view.tsx`

#### Como Validar

1. Abrir a visao "Equipamentos" do calendario avancado
2. Confirmar que a linha do cabecalho tem a mesma altura das linhas
3. Verificar que a ultima linha nao aparenta altura extra e nao ha espaco no
   rodape

#### Armadilhas a Evitar

- Alterar altura do cabecalho sem ajustar a altura das linhas
- Remover `last:border-b-0` e reintroduzir a linha residual no fim
- Reintroduzir `overflow-x-auto` no grid e voltar o espaco extra no rodape

## 31. Equipamento bloqueado incorretamente por manutenção agendada

### ?? Problema RESOLVIDO

**Data da Ocorrencia**: 2025-01-XX **Severidade**: 🔴 CRÍTICA (Bloqueava criação
de orçamentos) **Status**: Resolvido

#### Descricao

Ao tentar criar um orçamento, o sistema retornava erro "Equipamento
indisponível: Equipamento está em manutenção" mesmo quando a manutenção estava
agendada para uma data futura que não interferia com o período de locação
solicitado.

#### Sintomas

- ❌ Erro ao criar orçamento: "Equipamento indisponível: Equipamento está em
  manutenção"
- ❌ Equipamentos bloqueados mesmo quando manutenção não interfere com período
  de locação
- ❌ Manutenções agendadas para o futuro bloqueavam locações no presente

#### Causa Raiz

A função `isEquipmentInMaintenance` verificava apenas se havia manutenção com
status `SCHEDULED` ou `IN_PROGRESS`, sem considerar se a manutenção realmente
interferia com o período de locação solicitado. Isso fazia com que qualquer
manutenção agendada bloqueasse o equipamento completamente, mesmo para locações
que aconteciam antes da manutenção.

**Código Problemático:**

```typescript
// lib/maintenance-automation.ts - ANTES
export async function isEquipmentInMaintenance(
  equipmentId: string
): Promise<boolean> {
  const activeMaintenance = await prisma.maintenance.findFirst({
    where: {
      equipmentId,
      status: {
        in: ["SCHEDULED", "IN_PROGRESS"]
      }
    }
  })

  return !!activeMaintenance // ❌ Bloqueava sempre, sem verificar período
}
```

### ✅ Solucao Implementada

#### 1. Modificada função para aceitar período de locação

```typescript
// lib/maintenance-automation.ts - DEPOIS
export async function isEquipmentInMaintenance(
  equipmentId: string,
  rentalStartDate?: Date,
  rentalEndDate?: Date
): Promise<boolean> {
  // Se não há período especificado, verifica se há manutenção ativa
  if (!rentalStartDate || !rentalEndDate) {
    const activeMaintenance = await prisma.maintenance.findFirst({
      where: {
        equipmentId,
        status: {
          in: ["SCHEDULED", "IN_PROGRESS"]
        }
      }
    })
    return !!activeMaintenance
  }

  // Manutenções em progresso sempre bloqueiam
  const inProgressMaintenance = await prisma.maintenance.findFirst({
    where: {
      equipmentId,
      status: "IN_PROGRESS"
    }
  })

  if (inProgressMaintenance) {
    return true
  }

  // Manutenções agendadas só bloqueiam se interferem com o período
  const conflictingMaintenance = await prisma.maintenance.findFirst({
    where: {
      equipmentId,
      status: "SCHEDULED",
      scheduledAt: {
        gte: rentalStartDate,
        lte: rentalEndDate
      }
    }
  })

  return !!conflictingMaintenance
}
```

#### 2. Atualizada chamada em `equipment-availability.ts`

```typescript
// lib/equipment-availability.ts
const inMaintenance = await isEquipmentInMaintenance(
  equipmentId,
  startDate, // ✅ Passa período de locação
  endDate
)
```

#### Arquivos Modificados

1. `lib/maintenance-automation.ts` - Lógica de verificação de conflito
2. `lib/equipment-availability.ts` - Passa período para verificação

#### Como Funciona Agora

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Cliente solicita orçamento para período 10/01 - 20/01  │
│ 2. Sistema verifica manutenções                           │
│ 3. Se manutenção IN_PROGRESS → Bloqueia sempre            │
│ 4. Se manutenção SCHEDULED para 15/01 → Bloqueia (dentro) │
│ 5. Se manutenção SCHEDULED para 25/01 → NÃO bloqueia      │
│ 6. Orçamento criado com sucesso ✅                         │
└─────────────────────────────────────────────────────────────┘
```

#### Como Validar

```bash
# 1. Criar manutenção agendada para data futura
# 2. Tentar criar orçamento para período anterior
# 3. Deve funcionar normalmente (não bloquear)

# 4. Criar orçamento para período que inclui data da manutenção
# 5. Deve bloquear corretamente
```

#### Armadilhas a Evitar

- ❌ **NUNCA** bloquear equipamento apenas por ter manutenção agendada sem
  verificar período
- ❌ **NUNCA** ignorar o período de locação na verificação de disponibilidade
- ✅ **SEMPRE** verificar se a data da manutenção interfere com o período
  solicitado
- ✅ **SEMPRE** bloquear se manutenção está `IN_PROGRESS` (em andamento)

#### Lições Aprendidas

1. **Verificações de disponibilidade devem considerar período**: Não basta
   verificar se há manutenção, é preciso verificar se interfere
2. **Manutenções em progresso sempre bloqueiam**: Diferente de manutenções
   agendadas
3. **Manutenções agendadas são condicionais**: Só bloqueiam se interferem com o
   período
4. **Sempre passar contexto completo**: Funções de verificação devem receber
   todas as informações necessárias

---

## 30. Prisma 7.1.0 - Erro "datasource property url is no longer supported"

### ?? Problema RESOLVIDO

**Data da Ocorrencia**: 2025-01-XX **Severidade**: 🔴 CRÍTICA (Build quebrado)
**Status**: Resolvido

#### Descricao

O build estava falhando com erro do Prisma 7.1.0:

```bash
Error: Prisma schema validation - (get-config wasm)
Error code: P1012
error: The datasource property `url` is no longer supported in schema files.
error: The datasource property `directUrl` is no longer supported in schema files.
```

#### Causa Raiz

No Prisma 7, as propriedades `url` e `directUrl` **não podem mais estar no
`schema.prisma`**. Elas devem estar **apenas no `prisma.config.ts`**.

**Código Problemático:**

```prisma
// prisma/schema.prisma - ❌ ERRADO no Prisma 7
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

### ✅ Solucao Implementada

#### 1. Removido do schema.prisma

```prisma
// prisma/schema.prisma - ✅ CORRETO no Prisma 7
datasource db {
  provider = "postgresql"
}
```

#### 2. Configurado no prisma.config.ts

```typescript
// prisma.config.ts - ✅ CORRETO no Prisma 7
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL")
    // directUrl não é suportado no datasource do prisma.config.ts
    // DIRECT_URL é usado automaticamente via variável de ambiente para migrations
  }
})
```

**Nota Importante**: No Prisma 7.1.0, `directUrl` **não é suportado** no
`datasource` do `prisma.config.ts`. O Prisma usa automaticamente a variável de
ambiente `DIRECT_URL` quando necessário para migrations. O Prisma Client usa
apenas `DATABASE_URL` via adapter.

#### Arquivos Modificados

1. `prisma/schema.prisma` - Removidas propriedades `url` e `directUrl`
2. `prisma.config.ts` - Adicionado `directUrl` na configuração

#### Como Validar

```bash
# Verificar se Prisma generate funciona
pnpm db:generate
# Deve completar sem erros

# Verificar build completo
pnpm build
# Deve completar com sucesso
```

#### Armadilhas a Evitar

- **NUNCA** adicionar `url` ou `directUrl` no `schema.prisma` no Prisma 7
- **SEMPRE** configurar URLs no `prisma.config.ts`
- **SEMPRE** manter apenas `provider` no datasource do schema

#### Referências

- [Prisma 7 Migration Guide](https://www.prisma.io/docs/orm/more/upgrade-guide/upgrading-versions/upgrading-to-prisma-7)
- [Prisma Config Documentation](https://www.prisma.io/docs/orm/reference/prisma-config-reference)

---

## 29. Deploy na Vercel falhando com "pnpm install" exited with 1

### ?? Problema RESOLVIDO

**Data da Ocorrencia**: 2025-01-XX **Severidade**: 🔴 CRÍTICA (Bloqueava deploy)
**Status**: Resolvido

#### Descricao

O deploy na Vercel estava falhando durante a etapa de instalação de dependências
com o erro:

```bash
Error: Command "pnpm install" exited with 1
ELIFECYCLE Command failed with exit code 1.
```

O problema ocorria porque o script `postinstall` executava `prisma generate`
durante o `pnpm install`, mas na Vercel:

1. As variáveis de ambiente (como `DATABASE_URL`) podem não estar disponíveis
   durante o install
2. O Prisma precisa compilar binários nativos que podem falhar no ambiente de
   build
3. O script falhava e quebrava todo o processo de instalação

#### Causa Raiz

O `postinstall` estava configurado para executar `prisma generate`
incondicionalmente:

```json
{
  "scripts": {
    "postinstall": "prisma generate && node scripts/post-prisma-generate.js"
  }
}
```

Isso causava falha quando:

- `DATABASE_URL` não estava disponível durante o install
- O ambiente de build da Vercel não conseguia compilar os binários do Prisma
- O script não tinha tratamento de erros adequado

### ✅ Solucao Implementada

#### 1. Script Seguro de Postinstall

Criado `scripts/safe-postinstall.js` que:

- **Detecta ambiente CI/Vercel** e verifica se `DATABASE_URL` está disponível
- **Pula Prisma generate** se estiver em CI sem `DATABASE_URL` (o `prebuild`
  fará isso)
- **Não falha o build** se Prisma generate der erro (sai com código 0)
- **Mantém funcionalidade** em desenvolvimento local

#### 2. Package.json Atualizado

```json
{
  "scripts": {
    "postinstall": "node scripts/safe-postinstall.js || true",
    "prebuild": "prisma generate && node scripts/post-prisma-generate.js"
  }
}
```

#### Arquivos Modificados

1. `package.json` - Script `postinstall` atualizado para usar script seguro
2. `scripts/safe-postinstall.js` - Novo script com lógica robusta

#### Como Funciona

```
┌─────────────────────────────────────────────────────────────┐
│ 1. pnpm install na Vercel                                   │
│ 2. postinstall executa safe-postinstall.js                 │
│ 3. Script detecta: VERCEL=1 e DATABASE_URL não disponível  │
│ 4. Script pula Prisma generate (exit 0)                    │
│ 5. Install completa com sucesso ✅                          │
│ 6. Durante build: prebuild executa Prisma generate         │
│ 7. Build completa com sucesso ✅                            │
└─────────────────────────────────────────────────────────────┘
```

#### Como Validar

```bash
# Testar localmente (deve funcionar normalmente)
pnpm install
# Deve executar Prisma generate normalmente

# Simular ambiente Vercel
VERCEL=1 pnpm install
# Deve pular Prisma generate mas não falhar

# Verificar build
pnpm build
# Deve executar Prisma generate no prebuild e completar com sucesso
```

#### Armadilhas a Evitar

- **NUNCA** fazer `postinstall` falhar o build - sempre usar `|| true` ou script
  seguro
- **NUNCA** assumir que variáveis de ambiente estarão disponíveis durante
  install
- **SEMPRE** garantir que `prebuild` execute Prisma generate (já está
  configurado)
- **NAO** remover o `|| true` do postinstall sem testar em ambiente CI

#### Lições Aprendidas

1. **Postinstall não deve ser crítico** - Use para otimizações, não para
   dependências do build
2. **CI tem limitações** - Variáveis de ambiente podem não estar disponíveis
   durante install
3. **Prebuild é o lugar certo** - Para comandos críticos que precisam rodar
   antes do build
4. **Scripts devem ser resilientes** - Sempre tratar erros e não quebrar o
   processo pai

---

## 28. Build falhando com erro 3221226505 no postbuild (patch-prisma.js)

### ?? Problema RESOLVIDO

**Data da Ocorrencia**: 2025-01-XX **Severidade**: Alta (Build quebrado)
**Status**: Resolvido

#### Descricao

O build do projeto estava falhando na etapa `postbuild` com o código de erro
`3221226505`:

```bash
> gb-locacoes@0.1.0 postbuild C:\Projetos\GB Locações
> node scripts/patch-prisma.js

ELIFECYCLE  Command failed with exit code 3221226505.
```

#### Causa Raiz

O código de erro `3221226505` no Windows indica um problema de execução ou
acesso de arquivos. O script `patch-prisma.js` estava usando `fs.cpSync()` que
pode falhar silenciosamente no Windows quando:

1. Há arquivos bloqueados ou em uso
2. Caminhos muito longos (problema comum no Windows)
3. Problemas de permissões
4. O método `fs.cpSync` não lida bem com erros individuais durante a cópia

#### Solucao Implementada

O script foi refatorado para:

1. **Encontrar o caminho correto do Prisma Client** - compatível com npm, yarn e
   pnpm
2. **Usar função `copyDirectory` customizada** - trata erros individuais de
   arquivos
3. **Melhor tratamento de erros** - não falha o build, apenas registra warnings
4. **Logging detalhado** - mostra caminhos sendo copiados para debug
5. **Verificacoes de seguranca** - verifica se diretorios existem antes de
   copiar

#### Arquivos Modificados

1. `scripts/patch-prisma.js` - Refatorado completamente com copia recursiva
   robusta

#### Como Validar

```bash
# Testar o script isoladamente (modo silencioso - apenas erros)
node scripts/patch-prisma.js
# Não deve mostrar nada se tudo estiver OK

# Testar em modo verbose para debug
PATCH_PRISMA_VERBOSE=true node scripts/patch-prisma.js
# Deve mostrar:
# [patch-prisma] Copying from: C:\Projetos\GB Locações\node_modules\.prisma\client
# [patch-prisma] Copying to: C:\Projetos\GB Locações\.next\server\.prisma\client
# [patch-prisma] ✅ Prisma engines copied to .next/server/

# Testar build completo
pnpm build

# Deve completar sem erros no postbuild (silencioso)
```

#### Modo Silencioso (Padrão)

Por padrão, o script roda em modo silencioso e só mostra:

- ⚠️ Warnings quando há problemas (arquivos não copiados, diretórios não
  encontrados)
- ❌ Erros quando algo falha

Para ver logs detalhados durante debug, use:

```bash
PATCH_PRISMA_VERBOSE=true pnpm build
```

#### Armadilhas a Evitar

- **NUNCA** usar `fs.cpSync` diretamente sem tratamento de erros individuais
- **SEMPRE** verificar se diretorios existem antes de copiar
- **SEMPRE** usar `process.exit(0)` no final para nao quebrar o build
- **NAO** assumir que o caminho do Prisma Client é sempre
  `node_modules/.prisma/client` (pnpm usa estrutura diferente)

---

## 27. Select de frete travava scroll e criava barra branca (Orcamento)

### ?? Problema RESOLVIDO

**Data da Ocorrencia**: 2025-12-18 **Severidade**: Alta (UX crítico) **Status**:
✅ Resolvido

#### Descricao

Ao abrir o dropdown de opcoes de frete em `/orcamento`:

- **Barra branca invisivel** aparecia na lateral direita, empurrando todo o
  conteudo para a esquerda
- **Scroll vertical bloqueado** - impossivel rolar a pagina enquanto o select
  estava aberto
- **Deformacao visual** - pagina de orcamentos ficava desalinhada

#### Causa Raiz

O Radix Select com `modal={false}` ainda acionava o `RemoveScroll` que:

1. Adicionava `data-scroll-locked="1"` ao body
2. Criava um wrapper `[data-radix-scroll-lock-wrapper]` que gerava a barra
   branca
3. Aplicava `margin-right: 10px !important` via variavel CSS
   `--removed-body-scroll-bar-size`
4. Bloqueava interacoes com `pointer-events: none`

### ✅ Solucao Implementada

#### 1. CSS com alta especificidade (`app/globals.css`)

- Seletor `body.min-h-screen.bg-background[data-scroll-locked]` para maior
  especificidade
- Forca `--removed-body-scroll-bar-size: 0 !important` (variavel que controla o
  margin-right)
- Zera todos os margins e paddings com `!important`
- Define wrapper como `display: contents !important` para tornar transparente

#### 2. JavaScript com `setProperty` + `!important` (`components/ui/select.tsx`)

- Remove wrapper de scroll lock completamente (move filhos de volta ao body)
- Remove `data-scroll-locked` do body
- Usa `setProperty(prop, value, 'important')` para sobrescrever estilos inline
  do Radix
- Executa a cada 10ms enquanto o select esta aberto (necessario para
  sobrescrever continuamente)

#### Arquivos Modificados

1. `components/ui/select.tsx` - Logica de remocao de scroll lock (refatorado e
   limpo)
2. `app/globals.css` - Regras CSS preventivas (consolidadas)

#### Como Validar

1. `pnpm dev`
2. Acessar `/orcamento` e preencher CEP para mostrar opcoes de frete
3. Abrir o select de opcoes de frete
4. **Verificar**:
   - ✅ Nao aparece barra branca na lateral direita
   - ✅ Scroll vertical funciona normalmente
   - ✅ Conteudo nao desloca para a esquerda
   - ✅ DevTools mostra `margin-right: 0` no body (nao `10px`)

#### Armadilhas a Evitar

- **NUNCA** remover a variavel `--removed-body-scroll-bar-size: 0` do CSS - esta
  e a chave para impedir o margin-right
- **NUNCA** remover o intervalo de 10ms do JavaScript - necessario para
  sobrescrever o Radix continuamente
- **SEMPRE** usar `modal={false}` em selects publicos
- **NAO** remover o `setProperty` com `'important'` - CSS normal nao sobrescreve
  os estilos inline do Radix

---

## 26. Hover do botao "Ver Detalhes" sem escala (Admin Orcamentos)

### 🤔 Problema

**Data da Ocorrencia**: 2025-12-17 **Severidade**: Baixa (UX) **Status**: ✅
Resolvido

#### Descricao

- O botao "Ver Detalhes" na visao Tabela de `/admin/orcamentos` e nos cards
  admin nao aplicava escala suave no hover e mantinha fundo acinzentado.
- O efeito de `hover:scale-105` configurado no componente era sobrescrito,
  deixando a interacao sem feedback visual.

#### Causa Raiz

- Regras globais em `app/globals.css` para
  `.admin-action-button.view-button:hover` usavam `transform: none` e
  `background-color: rgb(241 245 249)` com `!important`, anulando as classes do
  Tailwind definidas no botao.

### ✅ Solucao Implementada

- Ajustado o hover global para usar fundo branco e permitir transform,
  garantindo que `hover:scale-105` e `transition-all` aplicados no componente
  funcionem com animacao suave.

#### Arquivos Modificados

1. `app/globals.css`

#### Como Validar

1. `pnpm dev`
2. Acessar `/admin/orcamentos` em modo **Tabela** e `/admin/categorias`.
3. Passar o mouse sobre qualquer botao "Ver Detalhes":
   - Fundo fica branco.
   - Escala 1.05 ocorre com transicao suave.

#### Armadilhas a Evitar

- Nao reintroduzir `transform: none` ou fundo cinza nas regras de hover dos
  botoes de acao.
- Evitar `!important` que sobrescreva utilitarios `hover:scale-*` ou
  `hover:bg-*` aplicados diretamente nos componentes.

## 25. Botões Aprovar/Rejeitar mostravam loading simultâneo (Admin Orçamentos)

### 🔴 Problema

**Data da Ocorrência**: 2025-12-17 **Severidade**: Baixa (UX confusa)
**Status**: Resolvido

#### Descrição

Na página `/admin/orcamentos`, ao clicar em "Rejeitar Orçamento" ou "Aprovar
Orçamento", **ambos os botões** exibiam estado de loading simultaneamente
("Rejeitando..." e "Aprovando..."), causando confusão visual para o usuário.

#### Causa Raiz

- Ambos os botões usavam o mesmo estado `isUpdating` para controlar o texto de
  loading
- Quando `isUpdating` era `true`, ambos os botões mudavam para o texto de
  loading, independente de qual botão foi clicado

#### Código Problemático

```tsx
// Ambos usavam isUpdating para exibir loading
{
  isUpdating ? "Rejeitando..." : "Rejeitar Orçamento"
}
{
  isUpdating ? "Aprovando..." : "Aprovar Orçamento"
}
```

### ✅ Solução Implementada

- Adicionado novo estado `updatingAction` para rastrear qual ação está em
  andamento (`'approved' | 'rejected' | null`)
- Cada botão agora verifica se sua ação específica está em andamento antes de
  mostrar loading
- `isUpdating` continua sendo usado para desabilitar ambos os botões durante a
  operação

#### Código Corrigido

```tsx
const [updatingAction, setUpdatingAction] = useState<
  "approved" | "rejected" | null
>(null)

// Na função updateQuoteStatus:
setUpdatingAction(newStatus)
// No finally:
setUpdatingAction(null)

// Nos botões:
{
  updatingAction === "rejected" ? "Rejeitando..." : "Rejeitar Orçamento"
}
{
  updatingAction === "approved" ? "Aprovando..." : "Aprovar Orçamento"
}
```

#### Arquivos Modificados

1. `app/admin/orcamentos/page.tsx` - Linhas 160-161, 335-337, 365-366, 2019-2035

#### Como Validar

1. `pnpm dev`
2. Acessar `/admin/orcamentos`
3. Abrir um orçamento pendente
4. Clicar em "Rejeitar Orçamento" → Apenas esse botão deve mostrar
   "Rejeitando..."
5. Clicar em "Aprovar Orçamento" → Apenas esse botão deve mostrar "Aprovando..."
6. Ambos os botões devem ficar desabilitados durante a operação

#### Armadilhas a Evitar

- ❌ **NUNCA** use um único estado booleano para controlar loading de múltiplas
  ações distintas
- ❌ **NUNCA** assuma que o usuário entenderá qual ação está em andamento se
  todos os botões mudarem

#### Lições Aprendidas

- ✅ Para múltiplos botões de ação, use um estado que identifique QUAL ação está
  em andamento
- ✅ Mantenha um estado separado para desabilitar botões (`isUpdating`) e outro
  para identificar a ação (`updatingAction`)
- ✅ O padrão `'action1' | 'action2' | null` é mais expressivo que múltiplos
  booleanos

---

## 24. Dialog de exclusão de orçamento travava página (Admin)

### ?? Problema

**Data da Ocorrência**: 2025-12-17 **Severidade**: Alta (bloqueava fluxo admin)
**Status**: ? Resolvido

#### Descrição

Ao clicar em **"Excluir Permanentemente"** dentro do modal de detalhes de
orçamentos rejeitados em `/admin/orcamentos`, a confirmação não aparecia e toda
a interface ficava travada (nenhum clique respondia).

#### Causa Raiz

- Modal pai usa Base UI (`Dialog` com `z-[var(--layer-dialog)] = 90`)
- A confirmação era um `AlertDialog` com `z-50` renderizado fora do
  `Dialog.BodyContent`, ficando **atrás** do modal pai
- O focus trap do `AlertDialog` bloqueava interações mesmo sem exibir conteúdo

### ? Solução Implementada

- Migração das confirmações (exclusão, ajuste de valor e multa) para dialogs
  aninhadas Base UI dentro do `Dialog.BodyContent`, com
  `data-nested-parent={nestedDialogOpen ? "" : undefined}`
- Estados sincronizados para fechar dialogs filhas ao fechar o modal pai,
  evitando overlays órfãos
- `AlertDialog` atualizado para usar tokens de camada
  (`--layer-dialog-backdrop`/`--layer-dialog`) e evitar novos conflitos de
  z-index

#### Arquivos Modificados

1. `app/admin/orcamentos/page.tsx`
2. `components/ui/alert-dialog.tsx`

#### Como Validar

1. `pnpm dev`
2. Acessar `/admin/orcamentos`, abrir um orçamento **rejeitado** e clicar em
   "Excluir Permanentemente"
3. A confirmação deve aparecer acima do modal, permitir cancelar/confirmar e a
   página volta a responder ao fechar

#### Armadilhas a Evitar

- NÃO usar `AlertDialog` fora do `Dialog.BodyContent` quando o modal pai for
  Base UI
- Respeitar tokens de camada (`--layer-dialog*`) para overlays/modais

---

## 23. Deploy na Vercel falhando - Limite de Cron Jobs Excedido

### 🎯 Problema

**Data da Ocorrência**: Janeiro 2025 **Severidade**: 🔴 CRÍTICA (Bloqueava
deploy) **Status**: Resolvido

#### Descrição

O projeto estava configurado com **7 cron jobs** no `vercel.json`, mas o plano
**Hobby da Vercel permite apenas 2 cron jobs**. Isso causava falha silenciosa no
deploy, impedindo que o projeto fosse publicado em produção.

**Problemas Identificados:**

1. ❌ 7 cron jobs configurados (limite Hobby: 2)
2. ❌ buildCommand incorreto (não usava script completo do package.json)

### ✅ Solução Implementada

1. **Redução para 2 cron jobs** (compatível com plano Hobby):
   - `late-fees` - Multas por atraso (diário)
   - `expire-quotes` - Expirar orçamentos (diário)

2. **5 cron jobs movidos para comentário** (para upgrade futuro):
   - `verify-boleto-payments`, `boleto-overdue-alerts`, `auto-convert-quotes`,
     `preventive-maintenance`, `send-notifications`

3. **Correção do buildCommand**:
   - Alterado de `prisma generate && next build` para `pnpm run build`

#### Arquivos Modificados

1. `vercel.json` - Redução de cron jobs e correção de buildCommand
2. `docs/getting-started/troubleshooting.md` - Documentação adicionada

#### Documentação Completa

📄 **Relatório Completo**:
[`docs/issues/vercel-deploy-cron-jobs-limit.md`](./vercel-deploy-cron-jobs-limit.md)

#### Como Validar

```bash
# Verificar número de cron jobs ativos
cat vercel.json | grep -c '"path"' | head -1
# Deve retornar: 2 (para plano Hobby)

# Verificar buildCommand
cat vercel.json | grep buildCommand
# Deve mostrar: "buildCommand": "pnpm run build"
```

---

## 22. Dropdowns de filtros de Manutenções ficam atrás do calendário (Admin)

### 🎯 Problema

**Data da Ocorrência**: 2025-12-15 **Severidade**: Baixa (UX) **Status**: ✅
Resolvido

#### Descrição

Nos filtros da página `/admin/maintenance`, os dropdowns de tipo/status ficavam
atrás do card do calendário, dificultando a seleção de opções.

### ✅ Solução Implementada

- `CustomSelect` passou a renderizar o dropdown via portal com posicionamento
  `fixed` e camada `z-[var(--layer-popover)]`, evitando clipping por
  `overflow-hidden` dos cards.
- Reposicionamento acompanha scroll/resize para manter alinhamento ao trigger.

#### Arquivos Modificados

1. `components/ui/custom-select.tsx`

#### Como Validar

1. `pnpm dev`
2. Acessar `http://localhost:3000/admin/maintenance`
3. Alternar filtros de status/tipo com a visão **Calendário** ativada; o menu
   deve aparecer acima do calendário, sem ser coberto.

## 21. Direção da animação invertida na tabela de Orçamentos (Admin)

### 🎯 Problema

**Data da Ocorrência**: 2025-12-12 **Severidade**: Baixa (UX) **Status**: ✅
Resolvido

#### Descrição

No modo **Tabela** em `/admin/orcamentos`, as linhas entravam da direita para a
esquerda ao aplicar filtros, contrariando o fluxo esperado (entrada da esquerda
para a direita). O efeito ficava mais evidente em sequências rápidas de filtros.

#### Causa Raiz

- O offset horizontal não estava explícito para forçar entrada pela esquerda; em
  re-renderizações rápidas o slide parecia vir da direita.
- Ausência de easing dedicado na transição de saída aumentava a percepção de
  inversão de direção.

### ✅ Solução Implementada

- Entrada das linhas agora fixa `x: -32` com `easeOut`, garantindo percepção da
  esquerda para a direita.
- Saída usa deslocamento discreto para a direita (`x: 18`) com `easeIn`,
  evitando leitura de movimento invertido ao limpar a lista.

#### Arquivos Modificados

1. `app/admin/orcamentos/page.tsx`

### 🎯 Resultado

- Linhas entram consistentemente da esquerda para a direita ao aplicar qualquer
  filtro.
- Saída suave para a direita evita sensação de inversão durante a transição.

#### Como Validar

1. `pnpm dev`
2. Acessar `http://localhost:3000/admin/orcamentos` e alternar para **Tabela**.
3. Alterar filtros (status, valor, período) em sequência; verificar que as
   linhas entram da esquerda para a direita e saem apenas com leve deslocamento
   à direita.

## 20. Animação “bruta”/flash ao filtrar linhas na tabela e cards do Kanban (Admin)

### 🎯 Problema

**Data da Ocorrência**: 2025-12-12 **Severidade**: Média (UX) **Status**: ✅
Resolvido

#### Descrição

Ao aplicar filtros na tela de **Orçamentos** (`/admin/orcamentos`) em ambos os
modos (**Tabela** e **Kanban**), os itens removidos começavam a animar
corretamente (saindo), porém:

- Alguns itens “não sumiam 100%” por um frame
- A lista nova aparecia “de uma vez” e **sem animação de entrada**
- Itens que permaneciam entre filtros não reanimavam, quebrando a expectativa de
  “entrar um por um”
- Itens saíam de baixo para cima (invertido) em vez de cima para baixo

#### Causa Raiz

- Tanto a tabela quanto o Kanban renderizavam diretamente
  `filteredQuotes`/`items` dentro de `AnimatePresence`. Em mudanças rápidas de
  estado (select → close), o React atualizava o array no mesmo ciclo em que
  ocorria o exit de itens anteriores.
- `AnimatePresence` no modo padrão permite **enter/exit simultâneos** e, como os
  itens “persistentes” mantinham `key`, eles não remontavam — portanto **não
  executavam `initial`** novamente.
- O stagger de saída usava “reverse stagger” (`total - 1 - idx`), fazendo o
  último item sair primeiro.

### ✅ Solução Implementada

#### Arquivos Modificados

1. `app/admin/orcamentos/page.tsx` (modo Tabela)
2. `components/admin/kanban-pipeline.tsx` (modo Kanban)

#### Implementação

**Tabela:**

- Introduzida uma lista intermediária `tableQuotes` (estado) para renderização
  da tabela.
- Ao mudar os filtros:
  1. salvamos a lista “alvo” em `pendingTableQuotesRef`
  2. definimos `tableQuotes = []` para disparar o **exit** das linhas atuais
  3. no `onExitComplete`, montamos `tableQuotes = pending`
- Ajustado `AnimatePresence` para `mode="wait"` (garante que a entrada só ocorre
  após a saída terminar).
- Implementado stagger determinístico (entrada e saída) via `variants` +
  `custom` com `index`.
- Saída agora usa stagger normal (de cima para baixo): `delay: idx * 0.04`.

**Kanban:**

- Introduzido estado intermediário `displayedItems` por coluna (uma por status).
- Cada coluna controla sua própria saída/entrada independentemente.
- Refs `pendingItemsRef` armazenam itens pendentes por coluna.
- `AnimatePresence` com `mode="wait"` e `onExitComplete` por coluna.
- Stagger normal (de cima para baixo) tanto na entrada quanto na saída.

### 🎯 Resultado

- Itens saem **um a um de cima para baixo** ao filtrar (tanto na tabela quanto
  no Kanban).
- Itens entram **um a um de cima para baixo** após a saída terminar.
- Sem flash e sem “aparecer bruto” após selecionar filtros.
- Cada coluna do Kanban anima independentemente.

#### Como Validar

**Tabela:**

1. `pnpm dev`
2. Acesse `http://localhost:3000/admin/orcamentos`
3. Alterne para a aba **Tabela**
4. Aplique/alterne filtros (ex.: **Valor** “Acima de R$ 2.000”)
5. Confirme:
   - saída escalonada de cima para baixo
   - após terminar a saída, entrada escalonada de cima para baixo
   - nenhum frame com “lista inteira aparecendo sem animação”

**Kanban:**

1. Acesse a aba **Kanban** na mesma página
2. Aplique/alterne filtros
3. Confirme:
   - cards saem um a um de cima para baixo em cada coluna
   - após terminar a saída, novos cards entram um a um de cima para baixo
   - cada coluna anima independentemente

### ⚠️ Armadilhas a Evitar

- Renderizar `filteredQuotes`/`items` diretamente quando a UX exigir “exit
  completo → enter completo” com stagger.
- Depender de `delay` por `index` sem controlar o lifecycle (pode gerar
  concorrência de enter/exit em updates rápidos).
- Usar “reverse stagger” (`total - 1 - idx`) na saída quando a expectativa é
  sair de cima para baixo — sempre usar stagger normal (`idx * delay`).

---

## 19. Erro "params are being enumerated" no Cursor DevTools

### 🎯 Problema

**Data da Ocorrência**: Janeiro 2025 **Severidade**: Baixa (Apenas aviso do
DevTools) **Status**: ✅ Conhecido - Não afeta funcionalidade

#### Descrição

Ao usar a ferramenta "Select Element" do Cursor IDE para inspecionar componentes
React em páginas dinâmicas do Next.js 16, aparece o erro:

```
params are being enumerated. `params` is a Promise and must be unwrapped with `React.use()` before accessing its properties.
```

#### Sintomas

- ⚠️ Erro aparece no console quando o Cursor tenta inspecionar componentes
- ⚠️ Ocorre especificamente ao clicar em "Select Element" no webview do Cursor
- ✅ **NÃO afeta a funcionalidade da aplicação**
- ✅ O código está correto e funcionando normalmente

#### Causa Raiz

No Next.js 16, `params` em Server Components e API Routes é uma `Promise` que
precisa ser desembrulhada com `await` antes de usar. Quando o Cursor IDE tenta
inspecionar um componente React, ele tenta serializar as props fazendo
`Object.keys(params)`, o que causa o erro porque está tentando enumerar uma
Promise.

**Isso é um problema conhecido do Next.js 16 com ferramentas de
desenvolvimento** que tentam serializar props que são Promises.

#### Onde Ocorre

- Páginas dinâmicas: `app/equipamentos/[id]/page.tsx`
- API Routes dinâmicas: `app/api/**/[id]/route.ts`
- Qualquer componente que recebe `params: Promise<{ ... }>` como prop

### ✅ Solução

#### 1. Código Está Correto

O código já está implementado corretamente:

```typescript
// ✅ CORRETO - Server Component
interface Props {
  params: Promise<{ id: string }>
}

export default async function Page(props: Props) {
  const params = await props.params // ✅ Desembrulhando a Promise
  // ... usar params.id
}
```

```typescript
// ✅ CORRETO - API Route
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params // ✅ Desembrulhando a Promise
  // ... usar resolvedParams.id
}
```

#### 2. Ações Recomendadas

1. **Ignorar o erro**: Não afeta a funcionalidade da aplicação
2. **Aguardar atualização**: Cursor/React DevTools podem adicionar suporte para
   Promises em props no futuro
3. **Usar DevTools do navegador**: Para inspeção detalhada, use as ferramentas
   do navegador (F12) em vez do Cursor

#### 3. Verificação

Para confirmar que o código está correto, verifique:

- ✅ Todas as páginas dinâmicas fazem `await props.params` antes de usar
- ✅ Todas as API Routes dinâmicas fazem `await params` antes de usar
- ✅ Não há uso direto de `params.id` sem desembrulhar primeiro

### 📈 Resultado

- ✅ Aplicação funciona normalmente
- ⚠️ Erro aparece apenas no DevTools do Cursor (não afeta usuários)
- ✅ Código segue as melhores práticas do Next.js 16

#### Como Validar

1. A aplicação funciona normalmente em desenvolvimento e produção
2. Páginas dinâmicas carregam corretamente
3. API Routes respondem corretamente
4. O erro só aparece ao usar "Select Element" no Cursor

---

## 18. Speed Insights da Vercel não exibindo dados

### 🎯 Problema

**Data da Ocorrência**: Janeiro 2025 **Severidade**: Média (Monitoramento não
funcional) **Status**: 🔍 Investigando

#### Descrição

O Speed Insights da Vercel não está exibindo dados no dashboard, mostrando "No
data available. Make sure you are using the latest @vercel/speed-insights
package."

#### Sintomas

- ❌ Dashboard do Speed Insights mostra "No data available"
- ❌ Mensagem sugere verificar se está usando a versão mais recente
- ✅ Pacote está instalado (`@vercel/speed-insights@1.3.1`)
- ✅ Componente está importado e usado no layout (`app/layout.tsx`)

#### Causa Raiz Possível

1. **Speed Insights não habilitado no dashboard da Vercel**: O serviço precisa
   ser ativado manualmente no dashboard
2. **Versão desatualizada**: Pode haver versão mais recente disponível
3. **Bloqueadores de anúncios**: Extensões do navegador podem bloquear o script
4. **Deploy necessário**: Alterações podem precisar de novo deploy para produção
5. **Problemas conhecidos da Vercel**: Incidente em 07/12/2025 foi resolvido,
   mas pode haver resquícios

### ✅ Solução Implementada

#### 1. Verificação de Configuração

**Arquivo**: `app/layout.tsx`

```tsx
import { SpeedInsights } from "@vercel/speed-insights/next" // ✅ Importado corretamente

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <SpeedInsights /> {/* ✅ Componente adicionado */}
        <Analytics />
      </body>
    </html>
  )
}
```

**Status**: ✅ Configuração correta

#### 2. Verificação de Versão

```json
{
  "@vercel/speed-insights": "^1.3.1" // ✅ Versão atual
}
```

**Status**: ✅ Versão instalada

### 🔍 Checklist de Troubleshooting

#### 1. Verificar no Dashboard da Vercel

1. Acesse o dashboard da Vercel: https://vercel.com/dashboard
2. Selecione o projeto `gb-locacoes`
3. Vá em **Analytics** → **Speed Insights**
4. Verifique se o Speed Insights está **habilitado**
5. Se não estiver, clique em **"Enable Speed Insights"** ou **"Implementar"**

#### 2. Verificar no Código

```bash
# Verificar se o componente está no layout
grep -r "SpeedInsights" app/layout.tsx

# Deve retornar:
# import { SpeedInsights } from '@vercel/speed-insights/next'
# <SpeedInsights />
```

#### 3. Verificar no Navegador

1. Abra o DevTools (F12)
2. Vá na aba **Network**
3. Recarregue a página
4. Procure por requisições para `vitals.vercel-insights.com` ou
   `speed-insights.vercel.app`
5. Se não aparecer, o script pode estar sendo bloqueado

#### 4. Verificar Bloqueadores

- Desative temporariamente bloqueadores de anúncios (uBlock Origin, AdBlock,
  etc.)
- Teste em modo anônimo
- Verifique se há extensões bloqueando scripts de terceiros

#### 5. Fazer Novo Deploy

```bash
# Após verificar configuração, fazer deploy
git add .
git commit -m "fix: verificar configuração Speed Insights"
git push origin main
```

#### 6. Aguardar Coleta de Dados

- O Speed Insights precisa de **tráfego real** para coletar dados
- Pode levar algumas horas ou dias para aparecer dados
- Dados são coletados apenas em **produção** (não em desenvolvimento local)

### 🎯 Resultado Esperado

- ✅ Speed Insights habilitado no dashboard da Vercel
- ✅ Script carregando no navegador (verificar Network tab)
- ✅ Dados aparecendo após tráfego real em produção
- ✅ Métricas de performance sendo coletadas

### 📝 Lições Aprendidas

1. **Speed Insights precisa ser habilitado no dashboard** - não é automático
2. **Dados só aparecem em produção** - desenvolvimento local não coleta métricas
3. **Bloqueadores podem interferir** - testar sem extensões
4. **Pode levar tempo** - dados não aparecem imediatamente após deploy
5. **Vercel Agent pode ajudar** - usar "Implementar" no dashboard para
   configuração automática

### ⚠️ Armadilhas a Evitar

- ❌ **NÃO** assumir que está funcionando apenas porque o código está correto
- ❌ **NÃO** esperar dados em desenvolvimento local
- ❌ **NÃO** ignorar bloqueadores de anúncios como causa
- ✅ **SEMPRE** verificar se está habilitado no dashboard da Vercel
- ✅ **SEMPRE** fazer deploy após alterações

### 🔍 Como Validar

```bash
# 1. Verificar versão instalada
pnpm list @vercel/speed-insights

# 2. Verificar se está no código
grep -r "SpeedInsights" app/

# 3. Verificar no navegador (DevTools → Network)
# Procurar por: vitals.vercel-insights.com ou speed-insights.vercel.app
```

### 📚 Referências

- [Vercel Speed Insights Quickstart](https://vercel.com/docs/speed-insights/quickstart)
- [Vercel Speed Insights Package](https://vercel.com/docs/speed-insights/package)
- [Vercel Speed Insights Troubleshooting](https://vercel.com/docs/speed-insights/troubleshooting)
- [Vercel Agent Installation](https://vercel.com/changelog/vercel-agent-installation)
- [Vercel Speed Insights GitHub](https://github.com/vercel/speed-insights)

### 🔄 Status de Atualização

- **Última verificação**: 2025-12-19
- **Versão atual**: `@vercel/speed-insights@1.3.1`
- **Ação recomendada**:
  1. Verificar se está habilitado no dashboard da Vercel
  2. Fazer novo deploy se necessário
  3. Aguardar coleta de dados em produção
  4. Verificar Network tab no navegador para confirmar script carregando

---

## 17. Warning de Depreciação do Zustand (Vercel Analytics/Speed Insights)

### 🎯 Problema

**Data da Ocorrência**: Janeiro 2025 **Severidade**: Baixa (Warning de console)
**Status**: ✅ Mitigado (warning suprimido; aguardando atualização da Vercel)

#### Descrição

O console do navegador exibe múltiplos warnings:

```
[DEPRECATED] Default export is deprecated. Instead use `import { create } from 'zustand'`.
```

Este warning **NÃO vem do código do projeto**, mas sim de dependências externas
da Vercel (`@vercel/analytics` e `@vercel/speed-insights`) que ainda utilizam a
sintaxe antiga do Zustand internamente.

#### Sintomas

- ⚠️ Múltiplos warnings no console do navegador
- ⚠️ Warning aparece a cada carregamento da página
- ✅ **Não afeta funcionalidade** - é apenas um aviso de depreciação
- ✅ Código do projeto está correto (`stores/useCartStore.ts` usa
  `import { create }`)

#### Causa Raiz

- `@vercel/analytics@1.6.1` e `@vercel/speed-insights@1.3.1` (versões mais
  recentes) ainda utilizam internamente a sintaxe antiga do Zustand:

  ```javascript
  // Sintaxe antiga (usada internamente pela Vercel)
  import zustand from "zustand"

  // Sintaxe nova (usada no projeto)
  import { create } from "zustand"
  ```

- Zustand 5.x emite warnings quando detecta a sintaxe antiga
- O warning é emitido pelo código interno das dependências da Vercel, não pelo
  projeto

### ✅ Solução Implementada

#### 1. Verificação de Versões

As dependências já estão nas versões mais recentes disponíveis:

```json
{
  "@vercel/analytics": "^1.6.1", // ✅ Mais recente
  "@vercel/speed-insights": "^1.3.1" // ✅ Mais recente
}
```

#### 2. Supressão do Warning (Atualizado - 2025-01-XX)

Implementada solução em duas camadas para suprimir o warning de forma robusta:

**Arquivo 1**: `app/layout.tsx` - Script no `<head>` com
`strategy="beforeInteractive"` para rodar antes do script de instrumentação da
Vercel

```tsx
<Script id="suppress-zustand-warning" strategy="beforeInteractive">
  {`
    (function() {
      if (typeof window === 'undefined') return;
      if (window.__gbSuppressZustandWarning__) return;

      window.__gbSuppressZustandWarning__ = true;

      const shouldSuppress = function(...args) {
        // Converte todos os argumentos para string e junta
        const fullMessage = args
          .map(arg => {
            if (typeof arg === 'string') return arg;
            if (typeof arg === 'object' && arg !== null) {
              try {
                return JSON.stringify(arg);
              } catch {
                return String(arg);
              }
            }
            return String(arg);
          })
          .join(' ')
          .toLowerCase();

        // Verifica múltiplos padrões para capturar todas as variações
        const patterns = [
          '[deprecated]',
          'deprecated',
          'default export',
          'default export is deprecated',
          'import { create }',
          'zustand'
        ];

        // Deve conter pelo menos 3 dos padrões para ser o warning do Zustand
        const matches = patterns.filter(pattern =>
          fullMessage.includes(pattern)
        ).length;

        return matches >= 3 && fullMessage.includes('zustand');
      };

      const originalWarn = console.warn;
      const originalError = console.error;
      const originalLog = console.log;

      console.warn = function(...args) {
        if (shouldSuppress(...args)) {
          return; // Suprimir warning do Zustand
        }
        originalWarn.apply(console, args);
      };

      console.error = function(...args) {
        if (shouldSuppress(...args)) {
          return; // Suprimir warning do Zustand
        }
        originalError.apply(console, args);
      };

      // Alguns warnings podem vir como console.log
      console.log = function(...args) {
        if (shouldSuppress(...args)) {
          return; // Suprimir warning do Zustand
        }
        originalLog.apply(console, args);
      };
    })();
  `}
</Script>
```

- Executa antes do script `instrument.*` da Vercel, evitando que o warning
  apareça mesmo no carregamento inicial
- Flag `__gbSuppressZustandWarning__` impede reatribuir `console` em remounts
- **Melhorias (2025-01-XX)**:
  - Detecta mensagens em múltiplos formatos (string, objetos, arrays)
  - Intercepta também `console.log` (alguns warnings podem vir por esse canal)
  - Usa sistema de padrões múltiplos para maior precisão na detecção

**Arquivo 2**: `app/ClientLayout.tsx` - Interceptação no `useEffect` para
warnings assíncronos e como fallback no client

- Mantém cobertura para logs disparados após a hidratação do React
- Restaura `console.warn`/`console.error`/`console.log` no cleanup do efeito
- Usa a mesma lógica melhorada de detecção por padrões múltiplos

**Por que duas camadas?**

- `beforeInteractive` captura o warning logo no carregamento da Vercel
  Analytics/Speed Insights
- `useEffect` garante que warns/erros assíncronos também sejam suprimidos
- Não toca nas dependências da Vercel; apenas suprime o ruído de console até o
  upstream corrigir

### 🎯 Resultado

- ✅ Warning suprimido no console (opcional)
- ✅ Funcionalidade não afetada
- ✅ Código do projeto mantém sintaxe correta
- ⏳ Aguardando atualização da Vercel para resolução definitiva

### 📝 Lições Aprendidas

1. **Warnings de dependências externas** não podem ser corrigidos diretamente no
   projeto
2. **Verificar sempre** se o warning vem do próprio código ou de dependências
3. **Documentar warnings conhecidos** para evitar investigações desnecessárias
4. **Monitorar atualizações** das dependências para resolução futura

### ⚠️ Armadilhas a Evitar

- ❌ **NÃO** tentar corrigir o código interno das dependências da Vercel
- ❌ **NÃO** fazer downgrade das dependências (versões mais antigas podem ter
  outros problemas)
- ❌ **NÃO** ignorar completamente - documentar para referência futura
- ✅ **SEMPRE** verificar se o warning vem do próprio código antes de investigar

### 🔍 Como Validar

```bash
# 1. Verificar versões instaladas
pnpm list @vercel/analytics @vercel/speed-insights

# 2. Verificar se o código do projeto está correto
grep -r "import.*zustand" stores/

# Deve retornar:
# stores/useCartStore.ts:import { create } from 'zustand' ✅
```

### 📚 Referências

- [Zustand Migration Guide](https://github.com/pmndrs/zustand/blob/main/docs/migrations/migrating-to-v4.md)
- [Vercel Analytics GitHub](https://github.com/vercel/analytics)
- [Vercel Speed Insights GitHub](https://github.com/vercel/speed-insights)

### 🔄 Status de Atualização

- **Última verificação**: Janeiro 2025
- **Versões atuais**: `@vercel/analytics@1.6.1`, `@vercel/speed-insights@1.3.1`
- **Ação recomendada**: Monitorar atualizações futuras da Vercel

---

## 16. 🚨 CRÍTICO: Vulnerabilidade de Segurança CVE-2025-55182 e CVE-2025-66478

### 🔐 Vulnerabilidade de Segurança

**Data da Ocorrência**: 04/12/2025 **Severidade**: 🔴 CRÍTICA (CVSS Score: High)
**Status**: ✅ RESOLVIDO

#### Descrição

Vulnerabilidade crítica de segurança em React Server Components (CVE-2025-55182)
e Next.js (CVE-2025-66478) que poderia permitir **Remote Code Execution (RCE)**
sob certas condições através de requisições especialmente criadas.

**Versões Afetadas**:

- React: 19.0, 19.1.0, 19.1.1, 19.2.0
- Next.js: ≥14.3.0-canary.77, todas versões ≥15 e ≥16
- Pacotes específicos:
  - react-server-dom-parcel (19.0.0, 19.1.0, 19.1.1, 19.2.0)
  - react-server-dom-webpack (19.0.0, 19.1.0, 19.1.1, 19.2.0)
  - react-server-dom-turbopack (19.0.0, 19.1.0, 19.1.1, 19.2.0)

**Versões Corrigidas**:

- React: 19.0.1, 19.1.2, 19.2.1
- Next.js: 15.0.5, 15.1.9, 15.2.6, 15.3.6, 15.4.8, 15.5.7, 16.0.7

#### Causa Raiz

A implementação do React Server Components processava entrada não confiável de
forma inadequada, permitindo que um atacante executasse código remotamente
através de requisições maliciosas especialmente criadas. A vulnerabilidade
estava presente na serialização/deserialização de componentes do servidor.

### ✅ Solução Implementada

#### 1. Atualização Imediata de Dependências

```json
// package.json - Versões ANTERIORES (VULNERÁVEIS)
{
  "react": "19.2.0",        // ❌ VULNERÁVEL
  "react-dom": "19.2.0",    // ❌ VULNERÁVEL
  "next": "16.0.5"          // ❌ VULNERÁVEL
}

// package.json - Versões ATUALIZADAS (SEGURAS)
{
  "react": "19.2.1",        // ✅ SEGURO
  "react-dom": "19.2.1",    // ✅ SEGURO
  "next": "16.0.7"          // ✅ SEGURO
}
```

#### 2. Processo de Atualização

```bash
# 1. Atualizar package.json
pnpm install

# 2. Testar build
pnpm build

# 3. Verificar funcionamento
pnpm dev
```

#### 3. Proteção Adicional da Vercel

A Vercel criou regras específicas no WAF (Web Application Firewall) para
proteger automaticamente todos os projetos hospedados na plataforma, mesmo antes
da atualização. No entanto, **a atualização das dependências ainda é
obrigatória** para proteção completa.

### 🎯 Resultado

- ✅ React atualizado de 19.2.0 → 19.2.1
- ✅ Next.js atualizado de 16.0.5 → 16.0.7
- ✅ Build testado e funcionando corretamente
- ✅ Projeto protegido contra CVE-2025-55182 e CVE-2025-66478
- ✅ Vercel WAF fornece camada adicional de proteção

### 📚 Documentação e Referências

#### Avisos Oficiais de Segurança

- [React GHSA](https://github.com/facebook/react/security/advisories)
- [Next.js GHSA](https://github.com/vercel/next.js/security/advisories)
- [Vercel Blog Post](https://vercel.com/blog/security-update-react-server-components)

#### Arquivos Modificados

1. `package.json` - Versões do React e Next.js atualizadas
2. `pnpm-lock.yaml` - Lockfile atualizado (gerado automaticamente)
3. `CHANGELOG.md` - Documentação da correção de segurança
4. `docs/issues/known-issues.md` - Este documento

#### Como Validar

```bash
# 1. Verificar versões instaladas
pnpm list react react-dom next

# Deve retornar:
# react@19.2.1
# react-dom@19.2.1
# next@16.0.7

# 2. Testar build
pnpm build
# ✅ Build deve completar com sucesso

# 3. Testar aplicação
pnpm dev
# ✅ Aplicação deve funcionar normalmente
```

### 🛑 Armadilhas a Evitar

- ❌ **NUNCA** fazer downgrade para versões anteriores vulneráveis
- ❌ **NUNCA** ignorar avisos de segurança do GitHub/Vercel
- ❌ **NUNCA** assumir que apenas a proteção WAF é suficiente
- ⚠️ **SEMPRE** atualizar dependências quando houver vulnerabilidades críticas
- ⚠️ **SEMPRE** testar após atualizações de segurança
- ⚠️ **SEMPRE** documentar correções de segurança no CHANGELOG

### 🔍 Detecção e Monitoramento

#### Como Detectar se Você Está Vulnerável

1. **Verificação Manual**:

```bash
# Verificar versão do React
cat package.json | grep '"react"'

# Verificar versão do Next.js
cat package.json | grep '"next"'
```

2. **Ferramentas Automatizadas**:

- GitHub Dependabot (ativo neste projeto)
- Vercel Dashboard (avisos de segurança)
- `pnpm audit` para vulnerabilidades conhecidas

3. **Sinais de Alerta**:

- Banner laranja na Vercel Dashboard
- Email de segurança do GitHub/Vercel
- Dependabot Pull Request automático

### 🏆 Créditos

- **Descoberta**: Lachlan Davidson (pesquisador de segurança)
- **Correção**: Meta Security Team e React Core Team
- **Coordenação**: Vercel Security Team
- **Deploy de Proteção**: Vercel WAF implementou regras globalmente

### 📊 Timeline

- **Descoberta**: Lachlan Davidson identifica vulnerabilidade
- **Disclosure**: Reporte responsável para Meta/React Team
- **Patches Released**:
  - React 19.0.1, 19.1.2, 19.2.1
  - Next.js 15.0.5, 15.1.9, 15.2.6, 15.3.6, 15.4.8, 15.5.7, 16.0.7
- **Vercel WAF**: Regras de proteção deployadas globalmente
- **GB-Locações**: 04/12/2025 - Atualização aplicada e testada ✅

### ⚠️ Nota Importante

Esta vulnerabilidade afeta TODOS os projetos usando React 19 com Server
Components, incluindo:

- Next.js (todas versões recentes)
- Vite com React Server Components
- Parcel com React
- React Router com SSR
- RedwoodSDK
- Waku
- Qualquer framework que use `react-server-dom-*` packages

**Recomendação**: Se você mantém outros projetos React, verifique e atualize
IMEDIATAMENTE.

---

## 15. Salto do scroll ao sair do ScrollStack (Playground)

### 🐛 Problema

**Data da Ocorrência**: 2025-11-25 **Severidade**: Média (UX) **Status**: ✅
Resolvido

#### Descrição

Ao concluir a rolagem do componente `scroll-stack` em `/playground`, o scroll
principal da página dava um "estilingue": primeiro saltava para cima e logo em
seguida voltava ao ponto esperado, criando um bounce perceptível antes de seguir
para a próxima seção.

#### Causa Raiz

- O lock de scroll aplicava `position: fixed` + `top` no `body` para travar a
  página enquanto o stack rolava.
- Na liberação, o `body` retornava brevemente para o topo antes do
  `window.scrollTo` suave empurrar para o final da seção, gerando o salto
  visível.

### ✅ Solução Implementada

- Simplificamos o lock para usar apenas `overflow: hidden` e
  `overscroll-behavior: contain`, eliminando o uso de `position: fixed`/`top` no
  `body`.
- O release para o final da seção ocorre somente após o desbloqueio, evitando o
  deslocamento inicial que causava o bounce.

#### Arquivos Modificados

1. `components/ui/scroll-stack.tsx`

#### Como Validar

1. `pnpm dev`
2. Acesse `http://localhost:3000/playground`.
3. Role o `scroll-stack` até o final; o scroll deve seguir suave para a próxima
   seção, sem saltar para cima antes.
4. Role de volta para o topo da seção e repita para garantir que o bounce não
   reaparece.

### 🛑 Armadilhas a Evitar

- Reintroduzir `position: fixed`/`top` no lock do `body`.
- Disparar `window.scrollTo` antes de liberar o bloqueio do scroll global.

---

## 14. Hover do hero 3D sem transição suave após navegar e voltar

### 🧠 Problema

**Data da Ocorrência**: 2025-11-24 **Severidade**: Baixa (UX) **Status**: ✅
Resolvido

#### Descrição

Ao visitar a home pela primeira vez, o hover do bloco 3D funcionava. Depois de
navegar para outra página e voltar, o `hover:scale-105` começava a pulsar ou
parava de funcionar porque restavam estilos inline aplicados pelo
`showAllElementsImmediately`.

#### Causa Raiz

No fluxo de navegação interna, o scroll-reveal aplicava `transform` e
`transition: none` inline na `.hero-image` e não limpava o transform/animation,
o que resetava continuamente o scale de hover ou o bloqueava.

### ✅ Solução Implementada

- Helpers `clearInlineTransition`/`clearInlineMotion` passaram a limpar
  transform/animation da `.hero-image` também quando exibimos elementos sem
  animação, e só executam uma vez por elemento.
- Flags de limpeza (`data-inline-*`) são resetadas antes de cada rodada do
  scroll-reveal.

### 🎯 Resultado

- Hover scale do card 3D permanece suave após sair e voltar para a home.
- Sem pulsar/reiniciar o scale em navegações internas.

### ⚠️ Armadilhas a Evitar

- Reintroduzir `transform` inline na `.hero-image` sem limpar.
- Ignorar o reset das flags ao reprocessar elementos em navegação interna.

---

## 📋 Índice

1. [🚨 CRÍTICO: Vulnerabilidade de Segurança CVE-2025-55182 e CVE-2025-66478](#16--crítico-vulnerabilidade-de-segurança-cve-2025-55182-e-cve-2025-66478)
2. [Salto do scroll ao sair do ScrollStack (Playground)](#15-salto-do-scroll-ao-sair-do-scrollstack-playground)
3. [Hover do hero 3D sem transição suave após navegar e voltar](#14-hover-do-hero-3d-sem-transição-suave-após-navegar-e-voltar)
4. [Dessincronização de Animações Hero](#1-dessincronização-de-animações-hero)
5. [Scroll Vertical Travado no iOS Safari](#2-scroll-vertical-travado-no-ios-safari)
6. [Scroll Involuntário na Home](#3-scroll-involuntário-na-home)
7. [Flick no Category Showcase após swipe](#4-flick-no-category-showcase-após-swipe)
8. [Hover e sombras cortados no Category Showcase](#5-hover-e-sombras-cortados-no-category-showcase)
9. [Gradiente do Carrossel Sobreposto às Categorias](#6-gradiente-do-carrossel-sobreposto-às-categorias)
10. [Inputs do Dialog Lab cortados nas laterais](#7-inputs-do-dialog-lab-cortados-nas-laterais)
11. [Hydration mismatch no IconCustomization](#8-hydration-mismatch-no-iconcustomization)
12. [Como Usar Este Documento](#como-usar-este-documento)

---

## 1. Dessincronização de Animações Hero

### 🎯 Problema

**Data da Ocorrência**: Novembro 2025 **Severidade**: Alta (UX impactada)
**Status**: ✅ RESOLVIDO

#### Descrição

Ao carregar a página inicial (especialmente após reset de cache), a imagem de
fundo do Hero aparecia vários segundos **antes** do conteúdo (título, subtítulo,
botões, busca). Isso criava uma experiência ruim onde o usuário via apenas a
imagem sozinha por alguns segundos antes do resto aparecer.

#### Sintomas

- ✅ Primeira visita normal funcionava
- ❌ Reset de cache causava dessincronização
- ❌ Imagem aparecia 1-2 segundos antes do conteúdo
- ❌ Flash de imagem isolada prejudicava UX

#### Causa Raiz

**Problema de Timing de Hidratação:**

1. **Framer Motion** (flash da imagem) inicia imediatamente após hidratação do
   React
2. **Scroll Reveal Init** demora mais para inicializar (especialmente após reset
   de cache)
3. Não havia comunicação entre os dois sistemas
4. Flash disparava independentemente do scroll-reveal estar pronto

**Código Problemático:**

```tsx
// Hero.tsx - Flash disparava imediatamente após hidratação
const [isHydrated, setIsHydrated] = useState(false)

useEffect(() => {
  setIsHydrated(true) // ← Muito cedo!
}, [])

// Flash iniciava sem esperar scroll-reveal
<motion.div animate={isHydrated ? { opacity: 1 } : { opacity: 0 }}>
```

### ✅ Solução Implementada

**Sistema de Evento Customizado para Sincronização:**

#### Arquivos Modificados

1. `components/scroll-reveal-init.tsx`
2. `components/hero.tsx`

#### Implementação

**1. Scroll Reveal Dispara Evento (scroll-reveal-init.tsx)**

```tsx
const run = () => {
  // Disparar evento para avisar que scroll-reveal está pronto
  window.dispatchEvent(new Event("scrollRevealReady"))

  // ... resto do código de inicialização
}
```

**Localização**: Linha ~40 em `scroll-reveal-init.tsx`

**2. Hero Escuta e Aguarda Evento (hero.tsx)**

```tsx
const [isScrollRevealReady, setIsScrollRevealReady] = useState(false)

// Aguardar scroll-reveal-init estar pronto antes de iniciar animações do flash
useEffect(() => {
  const handleScrollRevealReady = () => {
    setIsScrollRevealReady(true)
  }

  window.addEventListener('scrollRevealReady', handleScrollRevealReady)

  return () => {
    window.removeEventListener('scrollRevealReady', handleScrollRevealReady)
  }
}, [])

// Flash só anima quando scroll-reveal estiver pronto
<motion.div
  animate={isScrollRevealReady ? { opacity: 1 } : { opacity: 0 }}
  transition={{ duration: 1.2, delay: 0.2, ease: 'easeInOut' }}
>
```

**Localização**: Linhas ~26-39 e ~135 em `hero.tsx`

#### Como Funciona

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Página carrega                                           │
│ 2. React hidrata                                            │
│ 3. Hero renderiza (flash invisível, aguardando)            │
│ 4. Scroll Reveal Init inicializa completamente             │
│ 5. Scroll Reveal dispara evento 'scrollRevealReady' ✨     │
│ 6. Hero recebe evento e libera animação do flash           │
│ 7. Título (delay 0.2s) + Flash (delay 0.2s) animam JUNTOS │
│ 8. Sincronização perfeita! 🎉                              │
└─────────────────────────────────────────────────────────────┘
```

### 🎯 Resultado

- ✅ Flash aguarda scroll-reveal estar 100% pronto
- ✅ Conteúdo já está animando quando imagem aparece
- ✅ Zero dessincronização mesmo após reset de cache
- ✅ Animação harmoniosa e profissional
- ✅ Funciona em todos os cenários (primeira visita, navegação, refresh)

### 📝 Lições Aprendidas

1. **Nunca confie apenas em hidratação do React** para sincronizar sistemas de
   animação
2. **Use eventos customizados** para comunicação entre componentes independentes
3. **Framer Motion é mais rápido** que sistemas de scroll reveal baseados em
   IntersectionObserver
4. **Sempre teste com reset de cache** para pegar problemas de timing
5. **Estado compartilhado via eventos** > Delays fixos estimados

### ⚠️ Armadilhas a Evitar

❌ **NÃO** use delays fixos grandes para "esperar" inicialização:

```tsx
// RUIM - delay fixo de 0.8s não garante sincronização
transition={{ delay: 0.8 }}
```

✅ **USE** comunicação via eventos:

```tsx
// BOM - aguarda sinal real de prontidão
animate={isScrollRevealReady ? { opacity: 1 } : { opacity: 0 }}
```

### 🔍 Como Diagnosticar Problema Similar

Se você encontrar animações dessincronizadas:

1. Verifique se há múltiplos sistemas de animação (Framer Motion + CSS +
   IntersectionObserver)
2. Teste com reset de cache completo (Ctrl+Shift+R)
3. Use `console.log` para verificar timing de inicialização
4. Considere evento customizado para sincronização

### 📚 Referências

- CHANGELOG.md: [2025-11-05] - Correção Animação Ondinha Hero e Sincronização
- Commit: [hash do commit]
- Arquivos: `components/hero.tsx`, `components/scroll-reveal-init.tsx`

---

## 2. Scroll Vertical Travado no iOS Safari

### 🎯 Problema

**Data da Ocorrência**: Novembro 2025 **Severidade**: Crítica (Funcionalidade
quebrada no iOS) **Status**: ✅ RESOLVIDO

#### Descrição

No iPhone/iPad (iOS Safari), ao tentar rolar a página verticalmente após a seção
"Nossos Equipamentos" (que contém scroll infinito horizontal com animações
GSAP), o scroll vertical ficava completamente travado. O usuário não conseguia
continuar scrollando para baixo para ver a seção "Categorias de Equipamentos" e
o restante do conteúdo da página.

#### Sintomas

- ❌ Scroll vertical travado/preso após seção de equipamentos no iOS
- ❌ Impossível acessar conteúdo abaixo da seção no iPhone
- ❌ Conteúdo aparecia "embaixo" da seção ao tentar scroll para cima
- ❌ Sensação de "chegou ao fim mas ainda tem mais conteúdo"
- ✅ Funcionava perfeitamente no desktop
- ✅ Funcionava perfeitamente no Android

#### Causa Raiz

**`position: sticky` no iOS Safari capturando eventos de touch:**

O componente `EquipmentInfiniteScroll` tinha `className="lg:sticky lg:top-8"`
aplicado, o que criava um elemento sticky no desktop. No iOS Safari,
`position: sticky` tem um bug conhecido onde captura eventos de touch/scroll,
especialmente quando combinado com:

1. **`overflow: hidden`** no mesmo contexto
2. **Animações horizontais** (GSAP movendo elementos com transform)
3. **Scroll containers** aninhados

**Código Problemático:**

```tsx
// equipment-showcase-section.tsx - Linha 87
<div className="order-2 lg:order-1">
  <EquipmentInfiniteScroll className="lg:sticky lg:top-8" />
  {/*                                   ^^^^^^^^^^^^^^^^^ CULPADO */}
</div>
```

**Como o bug ocorria:**

1. Usuário toca na tela para scrollar verticalmente
2. iOS Safari detecta o toque sobre o elemento sticky
3. Sticky tenta determinar: "scroll do elemento" ou "scroll da página"?
4. `overflow: hidden` + animações GSAP horizontais confundem o iOS
5. iOS "prende" o evento de scroll no elemento sticky
6. **Scroll vertical da página trava completamente**

### ✅ Solução Implementada

**Duas mudanças necessárias:**

#### Arquivos Modificados

1. `components/equipment-showcase-section.tsx` (linha 87)
2. `components/categories.tsx` (linha 158)

#### Implementação

**1. Remover `position: sticky` da seção de equipamentos:**

```tsx
// ANTES (com bug):
;<div className="order-2 lg:order-1">
  <EquipmentInfiniteScroll className="lg:sticky lg:top-8" />
</div>

// DEPOIS (corrigido):
{
  /* Sticky removido: causava bug de scroll vertical no iOS Safari */
}
;<div className="order-2 lg:order-1">
  <EquipmentInfiniteScroll />
</div>
```

**Localização**: Linhas 86-89 em `equipment-showcase-section.tsx`

**2. Adicionar `overflow-hidden` na seção de categorias:**

```tsx
// ANTES:
<section
  id="categorias"
  ref={sectionRef}
  className="bg-gray-50 py-12 md:py-16 lg:py-20"
>

// DEPOIS (corrigido):
<section
  id="categorias"
  ref={sectionRef}
  className="bg-gray-50 py-12 md:py-16 lg:py-20 overflow-hidden"
>
```

**Localização**: Linha 158 em `components/categories.tsx`

**Por que ambas as mudanças foram necessárias:**

- Remover sticky eliminou a captura de eventos
- Adicionar `overflow-hidden` na seção seguinte preveniu que o conteúdo
  "vazasse" e criasse scroll horizontal indesejado que interferia com o scroll
  vertical

### 🎯 Resultado

- ✅ Scroll vertical funciona perfeitamente no iOS Safari
- ✅ Todas as animações GSAP continuam funcionando
- ✅ Comportamento consistente entre iOS, Android e Desktop
- ✅ `overflow-hidden` na seção de categorias previne vazamento horizontal
- ⚠️ Trade-off: Elemento não fixa mais no desktop durante scroll (comportamento
  sticky removido)

### 📝 Lições Aprendidas

1. **iOS Safari tem bug grave com `position: sticky`** quando combinado com
   `overflow: hidden` e animações
2. **Sticky + scroll horizontal = problema no iOS** - evitar essa combinação
3. **Touch events no iOS são capturados por sticky** mesmo com `touch-action`
   configurado
4. **Remover sticky NÃO foi suficiente sozinho** - precisou adicionar
   `overflow-hidden` na seção seguinte
5. **`overflow-hidden` em sections adjacentes** ajuda a isolar contextos de
   scroll e prevenir interferências
6. **Bug conhecido do WebKit**:
   [WebKit Bug #179178](https://bugs.webkit.org/show_bug.cgi?id=179178)

### ⚠️ Armadilhas a Evitar

❌ **NÃO use `position: sticky` com:**

```tsx
// RUIM - combinação que quebra no iOS
<div className="sticky">
  <div className="overflow-hidden">{/* Animações horizontais GSAP */}</div>
</div>
```

✅ **Se precisar de sticky, isole completamente:**

```tsx
// BOM - sem overflow ou animações no contexto do sticky
<div className="sticky">
  <div>{/* Conteúdo estático simples */}</div>
</div>
```

❌ **NÃO tente corrigir com CSS:**

```css
/* INÚTIL - não resolve o problema do sticky no iOS */
.sticky-element {
  touch-action: pan-y !important;
  -webkit-overflow-scrolling: touch !important;
}
```

✅ **Solução real: remova o sticky:**

```tsx
// BOM - sem sticky = sem problemas
<div>
  <ComponenteComAnimacoes />
</div>
```

### 🔍 Como Diagnosticar Problema Similar

Se você encontrar scroll travado no iOS:

1. **Procure por `position: sticky`** nos componentes da área afetada
2. **Verifique se há `overflow: hidden`** no mesmo contexto
3. **Teste removendo temporariamente o sticky** - se resolver, esse é o problema
4. **Use DevTools do Safari iOS** para inspecionar eventos de touch
5. **Não perca tempo com `touch-action`** - não resolve bugs de sticky

### 🧪 Tentativas que NÃO Funcionaram

Durante a investigação, foram testadas (sem sucesso):

1. ❌ Adicionar `touch-action: pan-y pinch-zoom` em todos elementos
2. ❌ Adicionar `-webkit-overflow-scrolling: touch`
3. ❌ Mudar `overflow: hidden` para `overflow-x: hidden`
4. ❌ Usar `clip-path` em vez de `overflow`
5. ❌ Desabilitar animações GSAP no mobile
6. ❌ Adicionar `pointer-events: none`
7. ❌ Criar regras CSS globais específicas para iOS
8. ❌ Usar `isolation: isolate` para stacking context
9. ❌ Renderizar componente diferente no mobile
10. ❌ Adicionar propriedades no `body` e `html`

**Nenhuma dessas soluções funcionou. A única solução foi remover o
`position: sticky`.**

### 📚 Referências

- CHANGELOG.md: [2025-11-06] - Correção Bug de Scroll no iOS Safari
- WebKit Bug Report: https://bugs.webkit.org/show_bug.cgi?id=179178
- Stack Overflow: "iOS Safari sticky position scroll issues"
- MDN: Position Sticky - Known Issues
- Arquivos: `components/equipment-showcase-section.tsx`

---

## 3. Scroll Involuntário na Home

### 🎯 Problema

**Data da Ocorrência**: 2025-11-06 **Severidade**: Média (UX impactada)
**Status**: Resolvido

#### Descrição

Ao carregar ou recarregar a página inicial (Home), a viewport deslocava alguns
pixels para baixo sem nenhuma interação do usuário. O comportamento não era
reproduzido em outras rotas.

#### Sintomas

- ❌ Scroll vertical automático assim que a Home carregava
- ❌ Layout “pulava” para baixo antes de qualquer interação
- ✅ Outras páginas permaneciam estáticas
- ✅ Reproduzido em desktop e mobile

#### Causa Raiz

O componente `TabbedCategoryGrid` centralizava a tab ativa com
`scrollIntoView({ block: 'nearest', inline: 'center' })`. Apesar de indicar
somente alinhamento horizontal, alguns navegadores ajustavam também o eixo
vertical, provocando o scroll involuntário da página inicial (única rota que usa
o componente).

> **Atualização 2025-11-07**: O componente foi substituído por
> `CategoryShowcase`, que mantém a correção e elimina a dependência do wrapper
> de tabs anterior.

### ✅ Solução Implementada

#### Arquivos Modificados

1. `components/tabbed-category-grid.tsx` (REMOVIDO)
2. `components/category-showcase.tsx`

#### Implementação

- Substituído `scrollIntoView` por lógica manual usando `element.scrollTo`
  limitada ao eixo horizontal.
- Checagem de overflow garante que o ajuste só ocorra quando realmente
  necessário (evita alterações em desktop).
- Guarda que verifica se a tab já está totalmente visível antes de ajustar o
  scroll, prevenindo movimentos desnecessários.
- Adicionada flag `hasMountedRef` para evitar animação na primeira renderização.

### 🎯 Resultado

- ✅ Home permanece fixa no topo após carregar.
- ✅ Centralização das tabs continua funcional em telas menores.
- ✅ Nenhum impacto em outras páginas ou animações.

### 📝 Lições Aprendidas

- `scrollIntoView` pode alterar o eixo vertical mesmo com `block: 'nearest'`.
- Para controlar apenas um eixo, prefira cálculos manuais com `scrollLeft` /
  `scrollTo`.

### ⚠️ Armadilhas a Evitar

- ❌ Não reutilizar `scrollIntoView` para centralizar tabs horizontais.
- ❌ Evitar animação de scroll no primeiro render (previne jank visual).
- ✅ Priorizar lógica customizada quando o deslocamento deve ser restrito a um
  único eixo.

---

## 4. Flick no Category Showcase após swipe

### 🎯 Problema

**Data da Ocorrência**: 2025-11-06 **Severidade**: Média (UX impactada)
**Status**: Resolvido

#### Descrição

No showcase de categorias (atualmente disponível em `/playground`, antigo
`/test-components`), ao concluir o gesto de swipe as novas categorias surgiam
imediatamente em estado final, sem as animações escalonadas previstas. O usuário
percebia um “piscar” rápido no instante em que soltava o dedo/mouse, porque o
grid da nova aba aparecia em opacidade plena antes que os fades individuais
começassem.

#### Como Reproduzir

1. Abrir `/playground` e iniciar um swipe horizontal nas tabs.
2. Soltar o dedo/mouse antes do overlay terminar de deslizar.
3. Observar o frame logo após o release: dois conjuntos de botões aparecem
   simultaneamente (grid novo e overlay antigo), causando flick perceptível.

#### Sintomas

- Conteúdo das tabs carregava instantaneamente assim que o swipe terminava.
- Os botões ainda executavam animações com delay após o flick, gerando efeito
  duplo (flash + fade).
- Problema ocorria apenas em navegação por swipe; clique nas tabs funcionava.

#### Causa Raiz

Durante a animação de swipe, o estado `displayedTabId` era atualizado no mesmo
frame em que o overlay concluía a transição. Isso fazia com que as animações dos
cards fossem disparadas enquanto o grid ainda estava oculto
(`swipePhase === "animating"`). Quando o container voltava para `opacity-100`,
os cards já haviam atingido `opacity: 1`, causando o flash sem fade.

### ✅ Solução Implementada

#### Arquivos Modificados

1. `components/category-showcase.tsx`

#### Implementação

- Adicionada função `clearSwipeOverlay` e ajustado `commitTabChange` para
  diferenciar cliques de swipes.
- Para swipes, o update do grid (estado `displayedTabId` + `transitionKey`)
  agora acontece apenas no próximo `requestAnimationFrame`, garantindo que o
  container volte a ser visível no mesmo frame em que os cards são montados.
- O grid permanece oculto tanto em `"animating"` quanto em `"settling"`,
  evitando que o novo conteúdo apareça antes do overlay finalizar.
- A opacidade do grid deixa de utilizar transição durante o swipe, sumindo
  imediatamente e impedindo que o usuário veja o conteúdo “por trás” dos gaps do
  overlay.

### 🎯 Resultado

- Zero flick: o grid só reaparece quando o fade-in escalonado está pronto.
- Navegação por clique mantém comportamento original.
- Overlay cobre toda a transição, mantendo continuidade visual.

#### Como Validar

1. Abrir `/playground` e repetir os swipes rápidos em ambas direções.
2. Usar DevTools → “Slow 4x” opcionalmente para inspecionar frames: nenhum card
   deve aparecer antes do fade-in.
3. Confirmar que `swipePhase` retorna para `"idle"` enquanto o grid volta para
   `opacity-100` sem conteúdos duplicados.

### 📝 Lições Aprendidas

- Ao combinar overlay + grid animado, sincronize montagem dos itens com o frame
  em que o container volta a ser visível.
- Usar `requestAnimationFrame` é uma forma simples de alinhar estados visuais
  quando não há timeline compartilhada.

### ⚠️ Armadilhas a Evitar

- ❌ Não atualizar `displayedTabId` imediatamente em animações baseadas em
  overlay.
- ❌ Não limpar o overlay antes do grid estar pronto; isso expõe o frame sem
  animação.

---

## 5. Hover e sombras cortados no Category Showcase

### 🎯 Problema

**Data da Ocorrência**: 2025-11-06 **Severidade**: Baixa/Média (perda de
polimento visual) **Status**: Resolvido

#### Descrição

Os botões do showcase do CategoryShowcase eram renderizados dentro de um
container com `overflow-hidden`. Quando o usuário fazia hover (ou focus) os
cards cresciam `hover:-translate-y-1` e aplicavam sombra. Porém, as bordas do
container cortavam tanto o deslocamento quanto o blur, deixando o efeito com
aparência truncada — principalmente nas colunas externas.

#### Sintomas

- Hover/active não exibiam sombra completa nos cards laterais.
- Bordas superiores/inferiores também “cortavam” o movimento vertical dos
  botões.
- Mais perceptível em `Fases da obra`, quando os cartões têm sombra azul.

#### Causa Raiz

O wrapper que também controla o swipe overlay precisava de `overflow-hidden`
para evitar que o overlay animado escapasse visualmente. O grid principal,
entretanto, não precisava dessa restrição. Cada hover é executado dentro do grid
base, então bastava isolar o `overflow-hidden` apenas no overlay.

### ✅ Solução Implementada

#### Arquivos Modificados

1. `components/category-showcase.tsx`

#### Implementação

- Removido `overflow-hidden` do wrapper do grid.
- Overlay passou a ficar dentro de um container absoluto (`pointer-events-none`)
  dedicado, com `overflow-hidden` apenas para ele.
- Componentes reais permanecem com `overflow-visible`, liberando animações de
  hover/sombra.

### 🎯 Resultado

- Sombras e deslocamentos funcionam totalmente, inclusive nas extremidades.
- Overlay continua limitado ao container durante o swipe, sem vazar para fora.

### 📝 Lições Aprendidas

- Ao precisar de `overflow-hidden` por causa de animações temporárias, isole a
  restrição no elemento animado em vez de aplicá-la ao container que contém o
  conteúdo interativo.

### ⚠️ Armadilhas a Evitar

- ❌ Aplicar `overflow-hidden` diretamente no grid principal; isso corta hovers.
- ✅ Manter overlays auxiliares em wrappers dedicados com clipping específico.

---

## 6. Gradiente do Carrossel Sobreposto às Categorias

### 🎯 Problema

**Data da Ocorrência**: 2025-11-07 **Severidade**: Média (impacto visual claro)
**Status**: Resolvido

#### Descrição

O gradiente de fade do `EquipmentInfiniteScroll` (coluna esquerda da seção
`EquipmentShowcaseSection`) avançava sobre o grid de categorias na coluna
direita. Os botões das tabs e das categorias ficavam visivelmente desbotados, já
que o overlay com `z-index: 10` era renderizado acima deles.

#### Sintomas

- ❌ Aba ativa e cards das categorias apareciam esbranquiçados na borda esquerda
  da coluna direita
- ❌ Hover/focus dos botões ficava encoberto pelo gradiente
- ✅ Overlay funcionava normalmente sobre os cards do carrossel

#### Causa Raiz

O wrapper do carrossel não criava um contexto próprio de empilhamento, então o
overlay com `z-10` competia diretamente com os elementos da coluna vizinha. Como
o grid de categorias não possuía `z-index` definido, o gradiente vencia a
disputa e ficava “por cima” dos botões, mesmo estando em outra coluna do grid.

### ✅ Solução Implementada

#### Arquivos Modificados

1. `components/equipment-infinite-scroll.tsx`
2. `components/equipment-showcase-section.tsx`

#### Implementação

- Adicionado `z-0` ao container relativo do carrossel para criar stacking
  context isolado para os overlays do fade.
- Coluna das categorias passou a ser `relative z-20`, garantindo que tabs e
  cards fiquem sempre acima de elementos adjacentes.
- Mantido `pointer-events-none` nos overlays para preservar acessibilidade e
  interação do carrossel.

### 🎯 Resultado

- ✅ Gradiente permanece limitado ao carrossel, sem interferir no grid de
  categorias.
- ✅ Hover e foco dos botões voltam a ser exibidos com cores originais.
- ✅ Layout mantém o efeito de fade lateral desejado no carrossel.

### 📝 Lições Aprendidas

- Sempre que um overlay precisar de `z-index` elevado, isole o stacking context
  do componente para evitar interferência em colunas irmãs.
- Ajustar o `z-index` da coluna vizinha é uma solução rápida quando os elementos
  precisam permanecer acima visualmente.

### ⚠️ Armadilhas a Evitar

- ❌ Deixar overlays globais sem stacking context próprio em layouts de
  múltiplas colunas.
- ❌ Depender apenas de `pointer-events: none` quando o problema é ordem de
  empilhamento.

## 7. Inputs do Dialog Lab cortados nas laterais

### 🐛 Problema

**Data da Ocorrência**: 2025-11-09 **Severidade**: Média (UX interna)
**Status**: Resolvido

#### Descrição

As seções do fluxo "Criar/Editar Categoria" no Dialog Lab utilizam elementos
`<section>`, mas o estilo global definido em `app/globals.css` aplica
`overflow-x: hidden` para todas as seções do site. Dentro do dialog Base UI,
isso fazia os campos "Nome da Categoria" e "Descrição" perderem parte das bordas
e dos focus rings nas laterais, causando aparência de conteúdo cortado.

#### Sintomas

- Inputs e textarea aparentando estar "aparados" nas bordas laterais do popup.
- Estados de foco/hover não exibiam sombras completas em resoluções menores.

#### Causa Raiz

O CSS global (`section, .container { overflow-x: hidden; }`) é útil nas páginas
públicas para evitar scroll horizontal, mas dentro de uma modal esse overflow
impede que componentes com `box-shadow`/`outline` maiores que o container
renderizem totalmente.

### ✅ Solução Implementada

#### Arquivos Modificados

1. `app/playground/page.tsx`

#### Implementação

- Criado helper `DIALOG_FORM_SECTION` adicionando `overflow-visible` às seções
  do formulário.
- A seção que envolve inputs e textarea passou a usar o helper, sobrescrevendo o
  estilo global e liberando os focus rings dos campos.

### 🧪 Resultado

- Inputs, textarea e contêineres internos exibem suas bordas completas, sem
  cortes laterais.
- O layout segue alinhado com o restante do dialog, inclusive em nested dialogs.

### 🧠 Lições Aprendidas

- Sempre revisar utilitários globais aplicados a tags semânticas antes de
  reutilizá-las em modais/overlays.
- Dialogs Base UI precisam declarar explicitamente `overflow-visible` quando
  dependem de sombras externas ou animações de scale.

### 🚫 Armadilhas a Evitar

- Criar novas seções em dialogs sem sobrescrever `overflow-x: hidden` do
  stylesheet global.
- Confiar apenas em remover `overflow-hidden` de ancestrais; elementos sem
  override continuam herdando o corte.

---

## 8. Hydration mismatch no IconCustomization

### 🐛 Problema

**Data da Ocorrência**: 2025-11-13 **Severidade**: Alta (quebra UX) **Status**:
✅ Resolvido

#### Descrição

Ao acessar `/playground/icon-customization`, o console do navegador exibia:

> `Hydration failed because the server rendered text didn't match the client.`

No HTML SSR, a primeira seção da biblioteca de ícones era "Construção &
Ferramentas" (`🛠️`), mas logo após a hidratação o cliente substituía a seção por
"Recentes" (`🕒`). O React detectava a divergência e forçava a re-renderização
do bloco, quebrando animações e causando flick na navegação.

#### Causa Raiz

- `useIconRecents` lia `localStorage` durante a renderização inicial.
- No SSR, a lista de recentes era vazia; no cliente, era preenchida
  imediatamente.
- A ordem das seções mudava entre SSR e CSR, disparando o erro de hidratação.

#### Solução Implementada

1. `useIconRecents` (e o novo `useEmojiRecents`) passaram a iniciar estado
   vazio.
2. Os dados persistidos são carregados somente após o `mount` (`useEffect`),
   garantindo HTML idêntico no SSR e no cliente.
3. A lista de recentes agora só é exibida quando existe histórico real.

#### Arquivos Modificados

- `hooks/use-icon-recents.ts`
- `hooks/use-emoji-recents.ts`
- `components/dialogs/icon-customization-data.ts`
- `app/playground/icon-customization/page.tsx`
- `components/dialogs/category-dialog.tsx`

#### Como Validar

```bash
pnpm dev
# Abrir http://localhost:3000/playground/icon-customization
# Verificar console: nenhum hydration mismatch deve aparecer
```

#### Lições Aprendidas

- Evite ler `localStorage` (ou `window`) durante o SSR.
- Sempre garanta que dados "recentes" tenham fallback determinístico no SSR.
- Prefira carregar preferências do usuário após o `mount` quando a UI depende de
  browser APIs.

---

## Como Usar Este Documento

### Para Desenvolvedores

1. **Antes de investigar um bug**, procure aqui se já foi resolvido
2. **Ao resolver um bug novo**, documente aqui seguindo o template
3. **Mantenha atualizado** com data, causa raiz e solução completa

### Para IAs (Cursor, GitHub Copilot, etc.)

1. **Consulte este arquivo** quando usuário reportar bug
2. **Busque por palavras-chave**: "animação", "dessincronização", "flash",
   "hero"
3. **Referência `AGENTS.md`** para lembrar de consultar este arquivo
4. **Sugira soluções já validadas** antes de criar novas abordagens

### Template para Novos Problemas

```markdown
## X. [Nome do Problema]

### 🎯 Problema

**Data da Ocorrência**: [Data] **Severidade**: [Baixa/Média/Alta/Crítica]
**Status**: [🔍 Investigando / ✅ Resolvido / 🚧 Parcial]

#### Descrição

[Descrição detalhada]

#### Sintomas

- Sintoma 1
- Sintoma 2

#### Causa Raiz

[Explicação técnica da causa]

### ✅ Solução Implementada

#### Arquivos Modificados

1. arquivo1.tsx
2. arquivo2.tsx

#### Implementação

[Código e explicação]

### 🎯 Resultado

[Resultados após implementação]

### 📝 Lições Aprendidas

[Insights importantes]

### ⚠️ Armadilhas a Evitar

[O que NÃO fazer]
```

---

**Última atualização**: 04/01/2026 **Mantido por**: Equipe de Desenvolvimento GB
Locações **Versão**: 1.0.0

## 7. Flick no preview do Category Showcase no Dialog Lab

### 🧠 Problema

**Data da Ocorrência**: 2025-11-09 **Severidade**: Média (demonstração
inconsistente) **Status**: Resolvido

#### Descrição

O preview exibido dentro do fluxo "Criar/Editar Categoria" (`app/playground`)
usava um componente ad-hoc (`MiniCategoryShowcase`). As animações de swipe/fade
eram implementadas de forma diferente do `CategoryShowcase` real, o que fazia o
bloco "piscar" (overlay encerrava e, logo em seguida, o card único ainda
executava um fade-out). O resultado não representava as animações da homepage e
induzia teste errado dentro do Dialog Lab.

#### Como Reproduzir

1. Abrir `/playground`.
2. Acionar o botão "Nova Categoria" ou "Editar Categoria".
3. Alternar entre as tabs do preview ou realizar um swipe rápido.
4. Observar o flash antes do novo card aparecer.

#### Sintomas

- Card do preview fica invisível por um frame entre cada troca.
- Swipe overlay não cobre toda a animação (overlay some antes do novo conteúdo).
- Tabs do dialog exibem comportamento diferente da home.

#### Causa Raiz

- O componente prévio recriava manualmente as animações, sem `displayedTabId` e
  sem distinguir cliques de swipes.
- A lógica de overlay era simplificada e o grid voltava a ficar visível antes do
  fade-in iniciar, causando o flick conhecido.
- Dataset reduzido (1 card) impedia validar o grid real.

### ✅ Solução Implementada

#### Arquivos Modificados

1. `app/playground/page.tsx`
2. `docs/features/category-showcase-shell.md`

#### Implementação

- Substituído `MiniCategoryShowcase` pelo próprio `CategoryShowcase`, mantendo
  as animações oficiais e criando tabs com um único item (a própria categoria em
  edição) para que o bloco funcione como preview fiel do botão.
- Preview agora apenas injeta a cor/ícone selecionados (sem recriar animações
  duplicadas).
- Documentação do shell atualizada para registrar a mudança.

### 📈 Resultado

- Preview do dialog replica 100% das animações (fade + swipe + overlay).
- Nenhum "piscar" ao trocar tabs ou ao fazer swipe rápido.
- O botão exibido no dialog é exatamente o mesmo que aparece na home (mesmo
  ícone, cores e comportamento), atendendo ao objetivo de servir como preview
  único.

#### Como Validar

1. Abrir `/playground` e abrir qualquer dialog de categoria.
2. Alternar tabs rapidamente e realizar swipes em dispositivos touch / trackpad.
3. Confirmar que não há flash em branco entre overlay e novo grid.

### 🧠 Lições Aprendidas

- Pré-visualizações devem reutilizar exatamente o mesmo componente para evitar
  divergências difíceis de rastrear.
- Overlay + grid precisam compartilhar o mesmo lifecycle; duplicar animações
  aumenta o risco de perda de sincronismo.

### ⚠️ Armadilhas a Evitar

- ⚠️ Recriar versões "mini" de componentes complexos apenas para previews.
- ⚠️ Desacoplar dataset/testes do componente original sem documentar o motivo.

---

## 8. Loop de estado no Dialog Lab (Maximum update depth)

### 🎯 Problema

**Data da Ocorrência**: 2025-11-09 **Severidade**: Alta (bloqueia playground)
**Status**: Resolvido

#### Descrição

Ao abrir qualquer dialog dentro de `/playground` (especialmente o fluxo "Nova
Categoria"), o navegador exibia o erro `Maximum update depth exceeded` e o
componente travava antes de renderizar. A exceção acontecia logo após o
montagem, impedindo a validação dos nested dialogs documentados em
`docs/features/dialog-lab.md`.

#### Sintomas

- Erro imediato no console apontando para `CategoryDialogDemo` (linha 1173).
- Turbopack reiniciando constantemente enquanto `/playground` estava aberto.
- Scroll global permanecia travado por conta da tentativa de abrir a dialog.

#### Causa Raiz

- O callback `handleStateChange` definido em `PlaygroundPage` era recriado a
  cada renderização.
- Todos os dialogs chamavam `onStateChange` dentro de um `useEffect` com a
  dependência `[open, onStateChange]`.
- Como a referência mudava a cada render, os efeitos disparavam continuamente,
  cada um executando `setDialogStates`. Em Next.js 16 (React 19 + Strict + dev
  loops do Turbopack), essa sequência nunca estabilizava, resultando no limite
  de atualizações excedido.

### ✅ Solução Implementada

#### Arquivos Modificados

1. `app/playground/page.tsx`

#### Implementação

- `handleStateChange` agora é memoizado via `useCallback`, garantindo que o
  valor só mude quando realmente dependente (`setDialogStates`) se alterar (o
  que não acontece).
- Os efeitos dos dialogs passaram a reagir apenas a mudanças reais do `open`,
  impedindo que `setDialogStates` seja chamado em loop.

### 📈 Resultado

- `/playground` abre sem erros em Next.js 16 + Turbopack.
- Nested dialogs (Category / Design / Notifications) podem ser abertos e
  fechados repetidamente sem travar o scroll global.

#### Como Validar

1. `pnpm dev`
2. Navegar até `http://localhost:3000/playground`.
3. Clicar em "Nova Categoria" e "Editar Categoria" várias vezes.
4. Confirmar que não há erros `Maximum update depth exceeded` no console.

### 🧠 Lições Aprendidas

- Callbacks passados para efeitos em cascata devem ser memoizados para evitar
  disparos desnecessários.
- Em ambientes com Strict Mode duplicado (React 19 + Turbopack), loops que antes
  estabilizavam podem falhar rapidamente.

### ⚠️ Armadilhas a Evitar

- Evitar passar funções inline para props consumidas em `useEffect`.
- Não sincronizar bloqueio de scroll baseado em efeitos que disparam em todo
  render sem uma guarda clara.

---

## 9. Backdrop incompleto e scroll liberado no Dialog Lab

### 🎯 Problema

**Data da Ocorrência**: 2025-11-17 **Severidade**: Média (Impacta playground)
**Status**: Resolvido

#### Descrição

Ao abrir a dialog "Nova Categoria" em `/playground`, o backdrop preto exibido
pela Base UI não cobria toda a viewport e a página continuava rolando ao fundo,
quebrando o padrão descrito em `docs/features/dialog-lab.md`.

#### Sintomas

- Header e footer permaneciam visíveis fora da área escurecida.
- O usuário conseguia usar a roda do mouse ou o touch para mover a página atrás
  da dialog aberta.
- No DevTools, `html` e `body` apareciam com `overflow-hidden`, mas nada mudava
  no layout.

#### Causa Raiz

- As classes padrão do backdrop incluíam
  `supports-[-webkit-touch-callout:none]:absolute`. Em navegadores iOS (que
  suportam a propriedade), isso substituía `position: fixed` por `absolute`,
  fazendo o overlay rolar junto com a página e expondo o fundo.
- `app/globals.css` define `html { overflow-y: auto !important; }` e
  `body.min-h-screen { overflow: visible !important; }`. A classe
  `.overflow-hidden` adicionada dinamicamente não tinha especificidade
  suficiente para vencer essas regras, mantendo o scroll global liberado.

### ✅ Solução Implementada

#### Arquivos Modificados

1. `components/ui/dialog.tsx`
2. `app/globals.css`

#### Implementação

- Removido o modificador `supports-[-webkit-touch-callout:none]:absolute` de
  `BACKDROP_BASE_CLASSES`, garantindo que o backdrop permaneça `fixed` mesmo no
  Safari/iOS.
- Adicionadas regras específicas `html.overflow-hidden` e `body.overflow-hidden`
  logo após o helper global, forçando `overflow: hidden !important` (além de
  `overscroll-behavior: contain`) sempre que a classe for aplicada.
- Mantidos os utilitários existentes de `min-h-screen`, apenas garantindo que a
  trava de scroll tenha prioridade maior do que os resets globais.

### 🎯 Resultado

- O backdrop cobre 100% da viewport independentemente do tamanho da página.
- Não é mais possível rolar o conteúdo de fundo enquanto qualquer dialog do
  playground estiver aberta; somente o conteúdo interno do modal pode scrollar.
- Comportamento consistente para dialogs aninhadas (`DesignDialog`,
  `IconCustomizationBlock`) e para o fluxo "Editar Categoria".

#### Como Validar

1. `pnpm dev`
2. Acessar `http://localhost:3000/playground`.
3. Abrir "Nova Categoria" ou "Editar Categoria".
4. Tentar rolar a página fora do modal — nada acontece; apenas o conteúdo do
   dialog responde ao scroll.

### 📝 Lições Aprendidas

- Regras globais com `!important` devem considerar a especificidade das classes
  utilitárias aplicadas dinamicamente.
- Bloquear o scroll global exige tratar explicitamente `html` e `body` quando
  esses elementos recebem helpers como `min-h-screen`.

### ⚠️ Armadilhas a Evitar

- Definir `overflow: visible !important` em helpers globais sem prever exceções
  para dialogs/modal.
- Confiar apenas na ordem de declaração dos seletores quando envolvem níveis de
  especificidade diferentes.
- Usar modificadores condicionais que alterem `position: fixed` do backdrop sem
  validar o comportamento em navegadores mobile.

## 10. Rotação do equipamento 3D travando durante a troca do carrossel principal

### 🎯 Problema

**Data da Ocorrência**: 2025-11-19 **Severidade**: Média (experiência visual)

#### Descrição

O `Equipment3DCarousel` exibido no hero estava travando a rotação automática
sempre que o carrossel principal de imagens trocava o slide. Durante a transição
do background, o componente 3D congelava por 1–2 segundos e só retomava o
movimento após a nova imagem estabilizar, transmitindo a sensação de gargalo.

#### Sintomas

- A rotação do objeto 3D pausa exatamente no momento em que o background troca.
- Ao trocar manualmente de modelo 3D, a animação volta, mas volta a travar no
  próximo ciclo do carrossel do hero.
- O comportamento independe do navegador e ocorre mesmo com FPS alto.

#### Causa Raiz

- `components/hero.tsx` armazenava `currentImage` no mesmo componente que
  renderiza o `Equipment3DCarousel`. A cada 5s todo o hero era re-renderizado,
  forçando o `Canvas` do `react-three/fiber` a resincronizar o loop enquanto o
  Framer Motion animava a troca de imagem.
- O array de modelos era recriado inline a cada render e o carrossel não era
  memoizado, o que disparava novos cálculos de bounds/lights em cada ciclo.

### ✅ Solução Implementada

1. Extraímos o carrossel de imagens/bolinhas para um componente dedicado
   (`HeroBackgroundCarousel`), isolando o estado de `currentImage` para que o
   hero e o `ModelViewer` não sejam re-renderizados a cada 5 segundos.
2. Promovemos os modelos padrões do hero para `HERO_EQUIPMENT_MODELS`, evitando
   criar novos objetos em toda renderização.
3. O `Equipment3DCarousel` passou a ser exportado memoizado (`React.memo`),
   garantindo que mudanças no hero não reflitam em re-renderizações do canvas.

### 📈 Resultado

- As transições do carrossel principal não afetam mais o loop de rotação.
- Os modelos 3D continuam suaves enquanto o background troca ou enquanto as dots
  são clicadas.
- Redução perceptível de jank na hero section.

### 🔍 Como Validar

1. `pnpm dev`
2. Acesse `http://localhost:3000/`.
3. Observe a rotação automática do equipamento por dois ciclos completos do
   carrossel principal; não deve haver travamentos.
4. Clique nas dots do carrossel e verifique que o `ModelViewer` mantém a rotação
   durante o fade.

### ⚠️ Armadilhas a Evitar

- Reintroduzir estado global do carrossel dentro do hero principal.
- Criar arrays inline ao passar `models` para o `Equipment3DCarousel`.
- Desabilitar o memo do carrossel, o que voltaria a sincronizar renders com o
  background.

## 11. Altura do componente 3D destoando no mobile

### 🎯 Problema

**Data da Ocorrência**: 2025-11-19 **Severidade**: Baixa (UX visual)

#### Descrição

Após substituir a imagem estática (`Image` 500x500 apontando para
`/equipment-static.jpg`) por um carrossel 3D, o bloco no hero ficou
excessivamente alto no mobile, lembrando um retângulo vertical desconfortável
comparado ao quadrado original.

#### Sintomas

- No desktop o layout permanecia correto, mas em telas < 640px o bloco passava
  de 430px de altura.
- A comparação com o ambiente de produção mostrava a imagem antiga ocupando
  ~311px de altura dentro do mockup.

#### Causa Raiz

- O `Equipment3DCarousel` recebe um `height={500}` fixo e não respeitava o
  contexto responsivo, mantendo 500px em qualquer breakpoint.

- ### ✅ Solução Implementada

- O contêiner do hero passou a usar classes responsivas
  `h-[320px] sm:h-[360px] md:h-[544px]` (com `lg`/`xl` herdando 544px),
  preservando o tamanho desktop e aproximando o mobile do quadrado anterior.
- O carrossel passa agora `height="100%"`, preenchendo apenas a altura do
  wrapper, permitindo futuros ajustes via CSS utilitário.

### 📈 Resultado

- Em telas pequenas o bloco ocupa ~320px (vizinho aos 311px da imagem antiga).
- A partir de 768px o bloco volta a 544px, espelhando o asset estático antigo.

### 🔍 Como Validar

1. `pnpm dev`
2. Ajuste o viewport do navegador para 360px ou use o emulador mobile.
3. Confirme que o bloco 3D continua centralizado mas agora quadrado e alinhado à
   altura original.

### ⚠️ Armadilhas a Evitar

- Reintroduzir alturas inline fixas em pixels sem breakpoints.
- Remover as classes responsivas do wrapper ao ajustar animações futuras.

## 12. Indicadores do carrossel do hero escondidos atrás da onda

### 🎯 Problema

**Data da Ocorrência**: 2025-11-19 **Severidade**: Baixa (navegação visual)

#### Descrição

Os dots do carrossel principal (`div.flex.justify-center.space-x-3`) foram
movidos para dentro do componente `HeroBackgroundCarousel`, deixando de fazer
parte da coluna do hero. Como a `div` do background não compartilha o mesmo
contexto que o card 3D, os indicadores passaram a ficar depois das ondas, dando
impressão de que estavam "perdidos" no final da página.

#### Sintomas

- Em desktop, os dots surgiam dentro da área branca das ondas.
- Em mobile, os dots ficavam praticamente invisíveis, prejudicando a navegação
  manual do carrossel.

#### Causa Raiz

- Os dots estavam ancorados em um container externo ao hero principal, herdando
  o posicionamento das ondas em vez do wrapper do carrossel 3D.

### ✅ Solução Implementada

- Extraímos os dots do `HeroBackgroundCarousel` e os inserimos novamente dentro
  da `div` principal do hero, mantendo `bottom-0 left-1/2 -translate-x-1/2`
  exatamente como na versão em produção (`components/hero.tsx`).
- O estado `currentImage` voltou a ser controlado pelo componente `Hero`,
  garantindo que background e indicadores compartilhem a mesma fonte da verdade.

### 📈 Resultado

- Os dots agora permanecem alinhados ao card 3D, sem fugir para a área das
  ondas.
- O comportamento é idêntico ao ambiente em produção, tanto em mobile quanto em
  desktop.

### 🔍 Como Validar

1. `pnpm dev`
2. Visite `/` e role até o hero.
3. Verifique que os dots estão visíveis logo abaixo do 3D carousel tanto em
   mobile quanto desktop (não ficam escondidos pela onda).

### ⚠️ Armadilhas a Evitar

- Recolocar os indicadores dentro de `HeroBackgroundCarousel` ou criar novos
  estados locais que desincronizem a navegação.

## 13. Modelos 3D não rotacionam em dispositivos touch

### 🎯 Problema

**Data da Ocorrência**: 2025-11-19 **Severidade**: Baixa (UX visual)

#### Descrição

No iPhone (Safari) e em outros dispositivos com tela touch, os modelos GLB não
executavam a rotação automática ao carregar o hero. A animação só acontecia em
desktops.

#### Sintomas

- Em celulares, o objeto 3D permanecia estático mesmo após aguardar alguns
  segundos.
- Ao abrir a mesma página no desktop, a rotação automática funcionava como
  esperado.

#### Causa Raiz

- `components/ui/model-viewer.tsx` desabilitava `OrbitControls.autoRotate`
  quando `ontouchstart` estava disponível (`isTouch ? false : autoRotate`) para
  evitar conflitos em devices móveis.
- Com isso, toda a camada de auto rotação era desligada em iOS/Android.

### ✅ Solução Implementada

- Removemos o guard `isTouch ? false : autoRotate`, permitindo que a rotação
  automática ocorra independentemente do tipo de dispositivo.

### 📈 Resultado

- Os modelos retomam a rotação suave tanto no Safari/iOS quanto em navegadores
  desktop.
- Usuários mobile voltam a perceber que o cartão é interativo sem depender de
  gestos.

### 🔍 Como Validar

1. `pnpm dev`
2. Abrir `http://localhost:3000` em um dispositivo touch (ou no emulador de
   iPhone/Safari).
3. Verificar que o modelo inicia a rotação automática após o carregamento.

### ⚠️ Armadilhas a Evitar

- Reintroduzir lógica condicional ligada a `ontouchstart`/`maxTouchPoints` sem
  oferecer fallback.
- Esquecer de ajustar `frameloop` caso futuras alterações dependam de estados
  específicos.

---

## 69. BFCache Bloqueado - Cache-Control: no-store

### Problema CONHECIDO ⚠️

**Data da Ocorrência**: 2026-01-XX **Severidade**: Baixa (Performance)
**Status**: ⚠️ Limitação Conhecida - Requer Decisão Arquitetural

#### Descrição

O Lighthouse/Chrome DevTools reporta que o back/forward cache (bfcache) está
bloqueado na página principal devido a `Cache-Control: no-store` no recurso
principal e em requisições JavaScript.

#### Causa Raiz

1. **Layout dinâmico**: O `app/layout.tsx` usa `getServerSession()` que torna a
   página dinâmica, fazendo o Next.js adicionar `Cache-Control: no-store`
2. **Requisições JavaScript**: Algumas APIs podem retornar `no-store` (já
   corrigido parcialmente)

#### Solução Atual

**Decisão**: Aceitar a limitação como trade-off necessário para manter
autenticação server-side segura.

**Quando Revisar**:

- Se métricas de performance se tornarem críticas
- Se usuários reportarem problemas de navegação
- Se houver necessidade de otimização extrema de performance

#### Documentação Completa

Consulte `docs/issues/bfcache-blocked.md` para análise detalhada, opções
disponíveis e referências técnicas.

---

## 70. Historico do cliente nao atualizava automaticamente

### ? Problema RESOLVIDO

**Data da Ocorrencia**: 2026-01-09 **Severidade**: Media (Area do Cliente)
**Status**: ? Resolvido

#### Descricao

A lista e os detalhes de `/area-cliente/historico` carregavam apenas no mount,
entao mudancas de status (aprovacao, pagamento, conversao) exigiam refresh
manual.

#### Sintomas

- Status nao muda sem recarregar a pagina
- Pagamentos confirmados so aparecem apos refresh
- Linha do tempo em detalhes fica desatualizada

#### Causa Raiz

- Fetch inicial em `useEffect` sem polling ou refresh ao voltar para a aba
- Mesmo endpoint atualizado no backend nao era reconsultado

### ? Solucao Implementada

- Polling em background a cada 30s quando a aba esta visivel
- Refresh imediato ao voltar para a aba (visibilitychange)
- Atualizacao silenciosa (sem spinner/toast em background)

#### Arquivos Modificados

1. `app/area-cliente/historico/page.tsx`
2. `app/area-cliente/historico/[id]/page.tsx`
3. `docs/features/quote-status-tracking.md`
4. `docs/features/area-cliente-historico-detalhes.md`
5. `docs/issues/known-issues.md`
6. `CHANGELOG.md`

#### Como Validar

1. Abrir `/area-cliente/historico` com um orcamento PENDING.
2. Aprovar/rejeitar o orcamento no admin.
3. Sem recarregar, aguardar ate 30s ou trocar de aba e voltar.
4. Confirmar que o status e a timeline atualizam automaticamente.
5. Repetir em `/area-cliente/historico/[id]`.

#### Armadilhas a Evitar

- Reativar loading global em refresh de background (pisca a pagina).
- Fazer polling quando a aba esta oculta.

---

## 71. Barras do Safari iOS oscilando entre preto e azul no admin mobile

### Problema RESOLVIDO

**Data da Ocorrencia**: 2026-02-13 **Severidade**: Media (UX mobile/admin)
**Status**: Resolvido

#### Descricao

No iPhone (Safari), a area superior (status bar/notch) e a inferior (barra de
endereco) no painel admin mudavam de cor de forma intermitente, alternando entre
tons pretos e azul-escuro.

#### Sintomas

- Em algumas aberturas da rota admin, as barras ficavam azul-escuro.
- Em outras, apareciam pretas.
- O efeito era mais perceptivel ao abrir/fechar a barra inferior do Safari ou ao
  recarregar.

#### Causa Raiz

- Havia conflito de metadados globais e estilo de barra no iOS:
  - `theme-color` global claro (`#ffffff`) no layout raiz.
  - `apple-mobile-web-app-status-bar-style: black-translucent` no layout raiz.
- O admin precisava de contexto visual escuro, mas sem metadado dedicado por
  rota.
- A classe `admin-body-layout` era aplicada no cliente (hidratação), o que
  amplificava a percepcao de alternancia em cenarios de primeiro paint.

### Solucao Implementada

- Refatorado o layout admin para separar:
  1. **Layout server** (`app/admin/layout.tsx`) com metadados/viewport do admin.
  2. **Layout client** (`app/admin/admin-layout-client.tsx`) com logica de
     sessao, sidebar e headers.
- Definido `themeColor: '#334155'` no `viewport` do segmento `/admin`.
- Definido `apple-mobile-web-app-status-bar-style: 'default'` no metadata do
  segmento `/admin` para evitar conflito com `black-translucent` no contexto
  mobile Safari.
- **Ajuste complementar (persistencia apos navegacao client-side):**
  `app/ClientLayout.tsx` passou a sincronizar em runtime (por `pathname`) as
  metas `theme-color` e `apple-mobile-web-app-status-bar-style` para o contexto
  admin, removendo tags duplicadas quando existirem. Isso evita estados
  intermitentes no Safari quando o usuario entra no admin sem hard refresh.

#### Arquivos Modificados

1. `app/admin/layout.tsx`
2. `app/admin/admin-layout-client.tsx`
3. `app/ClientLayout.tsx`
4. `docs/issues/known-issues.md`
5. `docs/issues/known-issues.index.md`
6. `docs/features/admin-system.md`
7. `CHANGELOG.md`

#### Como Validar

1. Abrir `/admin/login` no Safari do iPhone.
2. Entrar no painel e navegar para uma tela interna (ex.: `/admin/rentals`).
3. Descer/subir a pagina para forcar a expansao/retracao da barra de endereco.
4. Confirmar que topo e rodape do Safari mantem cor consistente no admin (sem
   alternancia preto/azul).
5. Sem recarregar a aba, navegar entre rota publica e admin e confirmar que a
   cor das barras acompanha corretamente o contexto da rota.

#### Armadilhas a Evitar

- Reverter `app/admin/layout.tsx` para client component (isso impede viewport
  segmentado).
- Alterar `themeColor` do admin para valor diferente do header sem validacao em
  iOS real.
- Reintroduzir `black-translucent` no segmento `/admin`.
- Remover a sincronizacao em runtime de `theme-color` no `ClientLayout` sem
  validar transicoes client-side no Safari iOS.

## Modernização: cobrança durável e endereços por locadora

Correções e regressões: [emissão e reemissão](modernization-billing-recovery.md)
e [endereços](../features/customer-addresses.md). Sem backfill ou operações
financeiras reais.

## Modernização — documentos de orçamento e justificativas longas

Downloads de orçamento retornavam JSON de sucesso sem PDF; exportação de
reajustes consultava IDs globais, emitia identidade fixa e sobrepunha
justificativas por altura fixa. Renderizadores foram movidos para o módulo
documents do backend; consultas usam tenant/permissão, emissão usa Organization,
linhas continuam entre páginas e rodapé reserva espaço. Ver
`docs/features/quote-documents.md` e `tests/unit/quote-admin-database.test.ts`
para arquivos, regressões e evidência visual local.

## 238. Agregados parcialmente nulos e prefixos de fórmula no CSV financeiro

**Data da constatação:** 2026-10-02. **Status:** pendente; comportamento
anterior preservado durante a extração da onda 38, não é regressão do novo host.

### Evidência e causa

financial-entries escolhe SUM(grossAmount) ou SUM(amount) para a coluna inteira,
assim como netAmount. Fixture: linhas de 100,50, 25,10, 30,25 e 10,00, com
grossAmount nulo somente na segunda, produzem total gross 140,75; as linhas
exibidas somam 165,85. O fallback por linha e o agregado divergem.

financial-report-csv escapa aspas/separador/newline, mas conserva textos
começando com =. A saída não neutraliza esse prefixo para consumidores de
planilha. Isso foi identificado no código; não foi executada fórmula ou aberto
documento externo.

### Próxima correção

Caracterizar soma de valores por linha, snapshots parcialmente nulos e
exportação com prefixos de fórmula; corrigir queries/serialização no backend
único, nos dois hosts, com provas de contrato. Não mascarar a divergência
modificando testes ou aumentando baseline. Arquivos:
packages/backend/src/modules/billing/financial-entries.ts e
packages/backend/src/modules/documents/financial-report-csv.ts.

## 239. Programa TypeScript mobile carregava o runtime do backend

**Data:** 2026-10-02. **Status:** corrigido localmente na onda 44, sem commit.

apps/clients/mobile/tsconfig.json incluía types/next-auth.d.ts da raiz, cujo
import type do barrel backend/identity alcançava runtime/mail. O AbortSignal do
React Native não oferece timeout/any nessa declaração; duas TS2339 impediam a
compilação. tsc --explainFiles provou o encadeamento; não havia consumidor dessa
augmentação em src do mobile nem no frontend nativo.

Apenas a inclusão do arquivo sem uso foi retirada do tsconfig mobile. Não foram
alterados o runtime de email, bibliotecas, strict, skipLibCheck, API de sessão
ou tipos dos hosts servidores. tsc mobile e frontend nativo passaram;
listFilesOnly do mobile não contém packages/backend nem a augmentação da raiz.
Para validar:
`pnpm exec tsc -p apps/clients/mobile/tsconfig.json --listFilesOnly` e
`pnpm exec tsc -p packages/frontend/tsconfig.native.json`.

## 240. Desconexão Zoho local conserva autorização pendente e parsing de state aceita null

**Data da constatação:** 2026-10-02. **Status:** parcialmente corrigido na onda
60 (2026-10-03, sem commit); desconexão/revogação continua pendente.

DELETE oauth/disconnect remove somente zohoMailToken por tenantId/userId. Não
chama revogação no provedor nem remove authVerification do namespace
zoho-oauth:tenantId:userId. O teste HTTP confirma token próprio removido, token
da outra locadora intacto e state pendente conservado. Pela política existente,
um callback válido ainda pode concluir essa autorização posteriormente.

Na análise do callback, JSON.parse de um cookie com o literal null retorna null;
a leitura posterior de saved.state está fora do catch de parsing e lança erro.
Esse caso não foi certificado por HTTP na onda 48; o corpo foi preservado por
comparação AST. Cookie ausente, JSON malformado e escopo/nonce divergentes já
têm recusas caracterizadas e passam sem consultar a verificação SQL. Não existe
aceitação de state sem cookie ou de outra locadora.

Arquivos: packages/backend/src/http/zoho-oauth-disconnect.ts e
zoho-oauth-callback.ts. Correção futura deve caracterizar cancelar states
pendentes, validar o formato após parsing e definir revogação externa/retry,
preservando isolamento e documentando a mudança funcional. Não enfraquecer
consumo único, guard de origem ou testes para acomodar a correção.

### Validação do cookie corrigida (2026-10-03, sem commit)

O callback agora trata o JSON como unknown e exige objeto não nulo e não array
antes de ler state/tenantId/userId. null, arrays e primitivos recebem o redirect
307 de estado inválido, com o cookie limpo e sem consumir state SQL ou chamar o
provedor. Objeto ausente ou de outra locadora/usuário conserva a recusa
anterior. Os testes novos reproduziram a exceção de null antes da correção; não
se mudou a política de desconexão nem se implementou revogação externa
silenciosamente.

## 241. Recepção concorrente de webhook pode exigir retry após 503

**Data da constatação:** 2026-10-02. **Status:** causa reproduzida e corrida de
inserção corrigida na onda 60 (2026-10-03, sem commit).

Dois POSTs WhatsApp simultâneos com o mesmo evento produziram 200 `{ ok: true }`
e 503 `{ error: 'Webhook persistence unavailable' }`. Repetir o evento após o
processamento devolve 200 `{ success: true, duplicate: true }`. Inbox, outbox e
mensagem permanecem únicos, com processedAt preenchido. A prova também cobre
entrega simultânea ao mesmo host e ao par legado/serviço.

A resposta vem do catch externo de acceptTenantWebhook, em
packages/backend/src/modules/outbox/webhook-inbox.ts, compartilhado pelos dois
hosts desde antes da onda 50 e não alterado nesta onda. A transação registra a
inbox e enfileira a outbox antes da disputa de lease. O catch não expõe a
exceção; colisão no upsert é uma hipótese, ainda sem diagnóstico causal
certificado. Não atribuir silenciosamente o erro ao consumidor ou ao provedor.

tests/api-host/whatsapp-write.http.test.ts exige que ao menos uma entrega
termine em 200, valida o envelope exato de uma eventual 503, recusa outros
erros, confere persistência única e exige retry idempotente. Foi substituída
apenas a hipótese nova de que toda entrega concorrente obteria 200/202; nenhuma
proteção ou teste anterior foi enfraquecido. O consumidor, schemas e SQL
extraídos conservam os corpos originais por comparação AST.

Endurecer a concorrência exige reproduzir a exceção SQL e proteger a correção
com testes de banco, incluindo os outros provedores que usam esta inbox. Até lá,
retry do provedor e do scheduler legado continuam necessários. Não houve troca
de webhook público, scheduler, cliente ou implantação.

### Diagnóstico e correção (2026-10-03, sem commit)

Um trigger de barreira no banco descartável segurou dois INSERTs após a leitura
do upsert. Com dois pools independentes e papéis sem BYPASSRLS, PIX, Asaas,
ZapSign e WhatsApp produziram exatamente 200/503 e erro Prisma P2002. A disputa
era no upsert com update vazio: o Prisma fazia leitura e INSERT separados. Não
era falha do provedor nem da aplicação do efeito.

webhook-inbox.ts usa agora createMany/skipDuplicates (INSERT com ON CONFLICT DO
NOTHING) seguido de findUniqueOrThrow, dentro da mesma transação de locadora. A
leitura verifica tenantId e hash antes de enfileirar o efeito. Não se engole
P2002 numa transação abortada, não se sobrescrevem payloads e não se cria lock
global. Lease e consumidor continuam separados da transação de recepção.

tests/unit/webhook-inbox-concurrency.test.ts verifica a barreira nos quatro
provedores, conflito 409, FORCE RLS, chaves iguais em integrações diferentes,
rollback se a outbox falha, retry pelo worker e preservação do lease. A prova
HTTP WhatsApp exige 200/202 em concorrência, conservando inbox, outbox e
mensagem únicos. Falha real de persistência continua respondendo 503; isso não
elimina a necessidade de retry para indisponibilidade ou crash.

## 242. Transação esperando lock ocupa a única conexão e pode atrasar autenticação

**Constatação:** 2026-10-02. **Status:** pendente; comportamento anterior
preservado na extração da onda 54, sem commit.

packages/backend/src/runtime/database.ts mantém max 1 no PostgreSQL direto, max
2 no pooler identificado por :6543/ e connectionTimeoutMillis 10000. Na prova
HTTP de permissões, dois escritores (um por host) aguardavam um advisory lock
externo. Uma terceira requisição no processo do serviço tentou resolver a sessão
e recebeu 401 após cerca de dez segundos. O log registra '[AUTH] Credencial da
sessão indisponível: Error'.

Causa confirmada pelo caminho do código e pela prova: a transação ocupa a única
conexão do processo, a consulta de versão da credencial não consegue obtê-la e o
catch de legacy-auth nega essa resolução sem revogar o cookie. Não é recusa do
grant nem conflito entre as chaves de papéis distintos. A entrada 182 já
documenta outro incidente causado pela necessidade de uma segunda conexão.

A prova da onda mantém concorrência real entre hosts, leitura das duas esperas
em pg_stat_activity, grants anteriores intactos durante a espera e o resultado
final de uma única proposta. Uma conexão SQL separada confirma que a chave de
outro papel está livre. Não se alterou o pool nem se certificou que outra
requisição HTTP avançaria no mesmo processo bloqueado. Nenhum teste anterior foi
relaxado.

Arquivos: runtime/database.ts, modules/identity/legacy-auth.ts,
modules/identity/tenant-permissions-write.ts e
tests/api-host/permissions-retirement.http.test.ts. Reprodução somente no banco
descartável. Correção própria deve considerar limite de conexões do ambiente,
timeouts e autenticação sob carga, antes de mudar política do pool ou da sessão.
Não elevar o pool silenciosamente durante uma extração de compatibilidade.

## 267. Comunicações web misturavam controlador e capacidades DOM; consumidor Expo separado

2026-10-03, sem commit. Carga/compositor de mail e controlador de WhatsApp
estavam nas fachadas web com Next, atalhos DOM, localStorage, input e download
por anchor. Tipos vinham de componentes. Extração move tipos/modelos para a
slice; web conserva os adapters e JSX. Expo consome os mesmos contratos, com
picker/UUID/ storage/HTML isolado/compartilhamento no host e status no escopo
das páginas.

Validação: 59 casos frontend/80 host Expo/183 web, doze TS e gates locais. AST
conserva 294 atributos/133 callbacks web, 37 ações de mail idênticas. Falhas
iniciais de rótulo composto e tipos/dublê de download corrigidas, sem afrouxar
proteções. CSS important zero; baselines intactas.
[Onda 84](../features/shared-api-host.md).

Datas nativas são AAAA-MM-DD. OAuth Zoho continua pelo painel web autenticado;
EXPO_PUBLIC_WEB_URL não tem fallback de domínio, token ou callback novo. HTML/
arquivos/teclado/gestos/fidelidade/aparelho/provedor e operação não
certificados. O fechamento do compositor WhatsApp após recusa é comportamento
anterior, conservado neste corte. Legado e scheduler ativos; sem
cutover/produção.

## 268. Fundação SaaS precisa separar privilégios comerciais de dados operacionais

Data: 2026-10-03 (sem commit). Uma GUC sozinha não é autorização. A fundação S2
usa função sentinela de privilégios, FORCE RLS e perfis public/tenant/platform
nas 17 tabelas comerciais. As 31 tabelas de negócio mantêm tenant_isolation.
Scripts DBA separados concedem ao papel de plataforma somente quatro INSERTs de
sementes, sem RETURNING/SELECT, e view mínima de contato. Roles não herdam
privilégios, e o checker rejeita permissões de coluna e de tabela.

Campos de projeção/publicação em organizações são protegidos também na criação.
Owner requer ADMIN/ACTIVE, FK diferida e locks; equipe/vínculo ativo usam lock
advisory por usuário para fechar corrida em ambas as ordens. Histórico não se
apaga; plan version não se reescreve. Credencial nullable falha fechada enquanto
VAULT não foi composto. Fixtures usam papel restrito real, sem desligar guards.

Validação: tests/identity/platform-scope-database.test.ts e comandos
tenant:check para os dois papéis; preflight por PLATFORM_RUNTIME_DATABASE_URL
somente leitura. Migrations aplicam em banco novo e base antiga com dados;
recuperação de preflight informa resolve --rolled-back exato após reconciliação
autorizada. Registro/provas e pendências de runtime: onda 85 de
docs/features/shared-api-host.md.

Durante o fechamento, o harness de paridade revelou que next dev junta valores
repetidos de NODE_OPTIONS --require. O loader composto conserva as três
interceptações locais e é removido no teardown. O mock de identidade antigo não
exportava as duas dependências extraídas; agora declara ambas e mantém as
asserções. Timeouts e baselines foram preservados.

O reset de frete atualizava `postalCode` e `status` fora do papel de plataforma;
se ACTIVE era recusado, uma locadora suspensa contaminava casos posteriores. A
fixture agora usa o papel restrito sem desligar o guard. A prova HTTP exige
API_HOST_MODE e API_LEGACY_MODE em production e builds atuais: dev usa cookies e
erros diferentes. O CI foi alinhado. Expectativas de rotas ainda ausentes
pertenciam à extração parcial; a sessão e as mutações já montadas agora são
comparadas aos contratos reais do legado, inclusive 401 e métodos 405.

A prova do orçamento nativo do Better Auth ainda buscava localhost, mas o helper
de login usa o IPv6 reservado da rodada. A chave esperada passou a ser o /64
normalizado desse endereço. Contagem mínima de logins reais e timestamp
permanecem exigidos; nenhum orçamento foi relaxado ou contador zerado.

Na onda 86, o runtime comercial passa a exigir conexão própria de
PLATFORM_DATABASE_URL, sem fallback. O contexto LOCAL é validado contra o papel
real (também grants por coluna) antes da operação, e volta ao estado anterior em
commit/rollback. A fila só reivindica tópicos instalados e compara tentativa
para recusar confirmação de lease antiga, mesmo com worker id reutilizado. O
cron autoriza antes de compor o pool, retorna erros neutros/private/no-store e
não instala agenda. A regra PLATFORM-PRISMA evita importar o pool em módulos de
negócio; o harness de HTTP limpa explicitamente a conexão de plataforma não
provisionada. Arquivos/provas: platform-runtime-database.test.ts,
platform-cron.test.ts, platform-cron.http.test.ts e onda 86 de
shared-api-host.md.

Na mesma onda, o upsert do evento com update vazio reproduziu P2002 quando duas
instâncias enfileiraram a manutenção simultaneamente. O update da própria chave
ativa ON CONFLICT nativo do PostgreSQL, mantendo payload, estado e tentativa
originais. A prova registra dez chamadas concorrentes no mesmo minuto e exige um
único id e uma entrega. O cache do pool é privado ao módulo; não se abriu
exceção para reescrever globais nem se acrescentaram entrypoints públicos de
escopo/jobs para contornar o ratchet.

## 269. Cofre: lock retorna void, rotação precisa de transação e carga KMS deve ser lazy

Data: 2026-10-03, sem commit. A primeira prova real do cofre falhou porque
pg_advisory_xact_lock retorna void e $queryRaw tentava desserializá-lo. O lock
passa a usar $executeRaw, como os demais módulos, sem remover a serialização. As
provas exigem versões concorrentes distintas, uma ACTIVE e histórico PREVIOUS.
Rewrap troca apenas a DEK embrulhada/provider/KEK; ativação adulterada não
desloca a chave anterior e destroy conserva metadados, eliminando os blobs.

Resolver de credenciais dentro de pagamento/contrato empresta a transação
existente; outra transação em um pool de uma conexão poderia esperar pela
própria conexão. A prova usa papel de negócio com max=1 e o resolvedor
verdadeiro. SDK AWS carregado em todos os imports de runtime também elevava o
custo dos testes com vi.resetModules. O adapter/composição agora o carregam
somente para KMS; timeouts, asserções e isolamento dos testes não foram
relaxados.

O reset HTTP de uma fixture VAULT com credentialsRef null precisa restaurar
ENV_REF e a referência env na mesma atualização; separar as duas viola o CHECK
existente. O reset foi corrigido atomicamente, preservando a recusa. Campos
estruturados de credencial são redigidos no logger, e SECRET-VAULT-OWNERSHIP
protege o modelo/SQL fora do módulo secrets. Não há exceção de reflexão ou de
coerção nova na guarda do runtime. Testes/arquivos/resultados: onda 87 de
docs/features/shared-api-host.md. Importação de segredos reais, AWS/provedores e
aceite operacional continuam pendentes.

## 270. Importação do cofre exige auditoria atômica sem liberar tabelas de negócio

Data: 2026-10-03, sem commit. O papel de plataforma não pode inserir diretamente
no AuditLog da locadora, por decisão de isolamento. A migration 202610030108
instala uma função SECURITY DEFINER com evento fixo e ids derivados da
integração; PUBLIC não pode executá-la, e o script DBA concede EXECUTE ao papel
isolado. Não foram acrescentados SELECT/INSERT gerais em audit_logs. A prova de
um dono sem BYPASSRLS demonstrou também a necessidade de UPDATE em uma coluna da
tabela de integração para SELECT FOR UPDATE; o perfil de prova concede só
UPDATE(id), sem LOGIN nem CREATE permanente, além dos SELECT/INSERT estritamente
necessários.

Planos vinculam destino, papel, metadados e fingerprints; arquivos/DSNs/segredos
não aparecem na saída. Uma confirmação antiga é recusada antes do provider, e o
lock revalida o plano após aguardar concorrentes. Todas as escritas, inclusive
source e as duas auditorias, têm rollback conjunto. Repetição precisa de plano
novo e verifica o valor ACTIVE sem criar versões ou eventos.

O gate PLATFORM-PRISMA exigiu usar a composição de plataforma existente; nenhum
baseline ou exceção foi acrescentado. Arquivos/provas: onda 88 em
docs/features/shared-api-host.md. Nenhum segredo real foi migrado. MELHOR_ENVIO
permanece ENV_REF até definir a origem persistida do userAgent.

## 271. Credenciais de provider e bloqueio administrativo não podem perder recebimentos

Data: 2026-10-03, sem commit. O importador antes não tinha origem persistida
para userAgent do Melhor Envio. Agora _USER_AGENT explícito, com o formato
validado pelo adapter existente, é selado como PROVIDER_USER_AGENT. Propósito
entra em migration isolada; a allowlist da função de auditoria muda sem ampliar
ACL. Runtime decifra na transação da locadora e retorna accessor redigido;
relatórios e logger não expõem o contato. Ausência, corrupção e locadora
incorreta falham fechado, sem fallback para env.

HMAC antes aceitava só a versão ACTIVE. A leitura específica aceita no máximo um
predecessor e recusa a partir de 24 horas. Filtrar expiração antes de escolher a
versão histórica pode reativar uma versão ainda mais antiga; a seleção agora
examina o predecessor mais recente e só então sua elegibilidade. Leitura de API
key continua ACTIVE, sem grace. Provas em banco usam ISO UTC para valores de
TIMESTAMP sem timezone enviados pelo driver SQL: Date convertido pelo driver
para horário local não representa o mesmo instante armazenado pelo Prisma.

A autenticação antiga recusava a locadora administrativamente suspensa e o
worker marcava falha permanente. Agora ACTIVE/PROVISIONING/INBOUND_ONLY podem
autenticar; inbox/outbox são persistidas, mas o efeito espera o desbloqueio,
conforme B.5 da ADR. Não usar esta mudança para baixar pagamentos de uma
Organization.status SUSPENDED, relaxar gates manuais ou tratar inadimplência
comercial como bloqueio técnico. O cron continua só ACTIVE. HTTP prova a
persistência sem baixa e a retomada idempotente nos dois hosts.

Arquivos/provas: onda 89 em docs/features/shared-api-host.md. S5/S8/S9 e
operação real ainda pendentes; nenhuma credencial real, deploy, push ou retirada
do legado. Não alterar baselines/asserções para dispensar essa separação.

## 272. Recepção de Asaas precisa separar persistência, classificação e efeito

Data: 2026-10-03, sem commit. A URL antiga é síncrona e não trata os eventos de
conta/chave com a separação de privilégios da plataforma. Os novos endpoints nos
dois hosts usam backend/identity, http/asaas-webhook e
modules/platform-webhooks. Inbox/outbox/auditoria são gravadas juntas; 200 só
depois do commit. Plataforma usa pool/LOGIN separado, sem leitura dos dados de
clientes. Mesmo id em duas integrações tem namespaces separados; divergência de
bytes nunca sobrescreve o recibo original e gera auditoria de conflito.

Worker de recibo novo de locadora trata pagamento desconhecido como terminal e
409 como reconciliação com auditoria; erros transitórios/bloqueio continuam
retentáveis. O payload é reduzido por allowlist antes de armazenar e não guarda
chaves, cartão ou dados de cliente. As URLs antigas preservam headers e
respostas existentes. A guarda nova de raiz tem namespace exato e discriminante
obrigatório; não é uma exceção pública. Parser/classificador passaram a ter
consumidores reais; só as quatro tolerâncias test-only-export obsoletas saíram
da baseline de higiene. Não ampliar tolerância para acomodar novo código.

Validação: onda 90 em docs/features/shared-api-host.md. S5 continua parcial:
platform.webhook.process fica PENDING até S6/S9; não confundir receipt aceito
com mensalidade conciliada/conta atualizada. JSON/tamanho/auth inválidos ainda
são recusados antes de gravar. Alertas externos, recuperação UNROUTED e troca da
URL antiga exigem os próximos lotes e prova própria. Nenhum provedor ou ambiente
real foi alterado.

## 273. Saúde de conta não pode confiar no evento antigo ou só na aprovação geral

Data: 2026-10-03, sem commit. Aprovação do cadastro não prova que a confirmação
anual está vigente. Para subcontas, o adapter lê commercialInfoExpiration antes
de consultar o status; quando expirada, a consulta de status é evitada porque o
provedor restringe outras APIs. Conta conectada não ganha um falso negativo de
expiração. Só os fatos necessários são retornados, sem dados comerciais.

Consumidor payment-accounts recebe portas de transação/leitura; composição
resolve a credencial da locadora, nunca a chave raiz. Notificação é gatilho para
reconsulta, sem aplicar cegamente dados históricos. Correlação da chave ativa
usa somente metadados por secrets, com seu lock; nenhuma leitura direta de
ciphertext pelo módulo de conta. Eventos sem identidade da chave atual são
ignorados com auditoria, sem invalidar credencial diferente.

Durante a consulta, conflito pode chegar ou chave/conta podem mudar. A aplicação
revalida bindings e timestamps sob locks, faz CAS do recibo e grava projeção e
auditoria na mesma transação. Falha transitória libera lease com erro redigido;
bloqueio administrativo fica BLOCKED mesmo com chave inválida ou expirada. Um
conflito posterior ao commit não desfaz efeito anterior: conserva alerta e exige
conciliação. Não há transação distribuída com o Asaas.

A recuperação de jobs antigos deve filtrar só tópicos ainda não convertidos;
reexaminar os primeiros recibos FAILED já convertidos pode impedir o restante de
avançar. A prova com 21 eventos confirma duas páginas, mesmas identidades e
nenhuma duplicação. Provas/limites: onda 91 de shared-api-host.md. S6 e
operações restantes de S9 permanecem pendentes; legado e produção não foram
alterados.

## 274. Fatura comercial precisa de confirmação atual e projeção atômica

Data: 2026-10-03, sem commit. PAYMENT da raiz tinha recibo persistido, mas
nenhum consumidor comercial. modules/subscriptions usa o adapter HTTP de billing
com chave raiz explícita; pagamentos das locadoras não entram nesse consumidor e
a chave de locadora não é fallback. Ambiente/chave ausentes mantêm job PENDING.

O webhook apenas desperta a reconsulta. Binding, cliente, referência e valor
decimal são conferidos; divergências exigem conciliação com auditoria. Locks de
organização/assinatura, revisão e CAS do recibo impedem efeito antigo ou
conflitante. Uma transação atualiza PlatformInvoice, SubscriptionEvent,
Subscription, Organization.access/siteIndexable e outbox; falha SQL desfaz tudo.

Unknown não pode apagar pagamento ou dívida confirmada. Código bruto e alerta
permanecem; nova fatura desconhecida nasce PENDING, mas a existente conserva seu
estado. PAID só sai para estorno/chargeback; refund é final. Cancelamento é
terminal: pagamento atrasado da assinatura antiga não modifica a projeção da
substituta. Organization.status/adminHoldReason não são alterados pelo consumo.

As provas usam proprietário/vínculo ACTIVE real e papéis LOGIN sem bypass. O
app_runtime lê sua projeção de faturas sob RLS, mas não pode escrevê-la: não
confundir leitura por locadora com ausência de privilégio SELECT global. Falha
transitória, conflito durante consulta, revisão alterada, rollback,
idempotência, cron compartilhado e backlog antigo estão cobertos na onda 92 de
docs/features/shared-api-host.md.

S6 é parcial: subscriptions.notify e subscriptions.provider-deactivate têm
mensagens duráveis, mas ainda não têm consumidor. Emissão/UNKNOWN, eventos
SUBSCRIPTION, reconciliação periódica e fiscalização S8 faltam. Não afirmar que
um cancelamento local desativou o Asaas, nem que enfileirar enviou e-mail. API
legada e scheduler continuam ativos; nenhuma operação real ou cutover.

## 275. Assinaturas sem webhook e cancelamento externo incerto

**Data:** 2026-10-03, onda 93, sem commit.

**Causa:** webhook isolado não avança trial sem evento nem recupera fatos
perdidos. Cancelamento apenas local não desativa a recorrência; repetir DELETE
após timeout pode apagar uma cobrança cuja situação ficou desconhecida. Backoff
só na assinatura também deixa a fila consumir tentativas antes da hora.

**Solução:** subscriptions/jobs.ts reconcilia estado/faturas pelo provedor ou
relógio local, com binding/revisão/locks e invoice.ts compartilhado com webhook.
subscriptions.provider-deactivate confirma PUT INACTIVE. Somente cobranças
futuras elegíveis de OWNER_REQUEST são consideradas para DELETE; dívida anterior
e pagamentos permanecem. A migration 202610030111 acrescenta CHECK e
providerCancelState; intenção durável impede repetição cega após crash/timeout.
404 não comprova efeito. RetryDeliveryAtError adia a outbox junto do aggregate.

**Validação:** subscription-jobs-database.test.ts (21), faturas (20), runtime
(12), HTTP assinatura (16), HTTP fatura (22) e dispatcher (2) passaram. Gates,
tipos e builds API/legado passaram. Fixture PostgreSQL descartável com papéis
restritos e provider simulado. S6 permanece parcial, sem cutover ou produção.
UNKNOWN persistente exige conciliação; envio de e-mail, emissão e fiscalização
S8 não foram implementados nesta onda.

## 276. Evento comercial sem consumidor e recibo sem vínculo local

**Data:** 2026-10-03, onda 94, sem commit.

**Causa:** SUBSCRIPTION ficava pendente sem consumidor. Um evento recebido antes
do vínculo local permanecia UNROUTED; tentar recuperá-lo sem registrar o
ambiente de autenticação poderia misturar sandbox e produção. Cancelamento
durante criação UNKNOWN também ficava sem ID para desativar a recorrência.

**Solução:** subscriptions/events.ts persiste o handoff para os jobs existentes,
com validação do recibo/referências e revalidação após consulta externa. O ID
recuperado por referência é conferido antes de vincular, inclusive em assinatura
cancelada. platform-webhooks/routing.ts compartilha o resolvedor com ingress e
recovery.ts; lotes com SKIP LOCKED preservam payload/hash/dedupe. A migration
202610030112 acrescenta ambiente da raiz com CHECK/imutabilidade, sem adivinhar
valores históricos. PROCESSED é handoff, não prova de pagamento.

**Validação:** 94 casos de banco (47 jobs, 20 faturas, 15 ingresso e 12 runtime)
passaram em PostgreSQL descartável e papéis restritos, sem provedor real.
Tipos/lint/gates passaram. Sem afrouxar baseline, retirar legado ou produção.
UNROUTED antigo sem ambiente exige prova/replay controlado; o procedimento ainda
falta, assim como emissão, notificações/régua, S8 e aceite operacional.

## 277. Aviso comercial sem consumidor e retry ambíguo de e-mail

**Data:** 2026-10-03, onda 95, sem commit.

**Causa:** subscriptions.notify ficava PENDING sem consumidor. Um envio depois
de pagamento, mudança de contato ou retry incerto pode produzir aviso obsoleto,
exposição de destinatários ou duplicação após a janela de idempotência externa.

**Solução:** avisos.ts seleciona a régua pelos fatos existentes; facts.ts serve
projeção e seleção sem duplicar mapeamento. subscriptions/notices.ts faz fan-out
privado, revalida fatos/memberships, conserva leases e persiste
envelope/intenção antes do transporte. Locks seguem organização → assinatura.
Runtime usa a configuração Resend existente nos dois hosts; ausência mantém jobs
pendentes. Após 23h de tentativa incerta, audita conciliação obrigatória, sem
envio cego. Não há nova tabela, scheduler, privilégio de negócio ou promessa de
entrega.

**Validação:** 316 casos distintos, 52 novos, com domínio/render/SDK e
PostgreSQL descartável sob papéis restritos. Incluem revogação, concorrência,
rollback, backlog, fencing, timeout e cron configurado. Tipos/lint/gates e
builds dos dois hosts passaram; tolerâncias não foram ampliadas. Somente uma
entrada obsoleta de tipo ganhou consumidor real e saiu da higiene.

**Limites:** não houve envio real. Conciliação assistida, criação comercial,
saúde diária, tela de assinatura, S8/onboarding/backoffice e aceite em
provedores e aparelhos permanecem pendentes. Datas seguem a política do domínio
existente; a divergência histórica da ADR não foi decidida silenciosamente.

## 278. Cota de equipamentos sem admissão transacional

**Data:** 2026-10-04, onda 96, sem commit.

**Causa:** S0/S1 definiam direitos e funções puras, mas cadastro não consumia a
cota. Conferir somente antes da transação permitiria corrida de cadastro ou
mudança de acesso entre a decisão e INSERT. Shadow que engole erro SQL sem
savepoint pode deixar a transação abortada e bloquear o fluxo que deveria
observar.

**Solução:** equipment-admission.ts consome os direitos no cadastro do catálogo,
na conexão da mutação, com organização/cota travadas e leituras por tenant.
Plano cancelado não substitui o atual; exceções inválidas, futuras, revogadas ou
expiradas não relaxam o limite. Off não consulta; shadow usa savepoint e
registra somente código/id; on aplica os envelopes. Os dois handlers conservam
campos.

**Validação:** 51 casos novos (21 admissão, 14 HTTP, 16 banco) e 245 regressões
passaram; inclui 10 concorrentes/uma vaga/um sucesso, bloqueio de mudança de
acesso até INSERT, RLS, downgrade e recuperação de erro SQL em shadow.
Tipos/lint/gates/builds API/legado passaram. Só sete tolerâncias obsoletas com
consumidor real saíram da higiene, sem ampliar baseline ou teste.

**Limites:** primeiro corte S8 apenas. Matriz geral/ownership, módulos, equipe,
exceções financeiras, crons promocionais e site não foram certificados. Env real
continua off; legado/scheduler e produção preservados. Ver limites-plano.md e
onda 96 de shared-api-host.md.

## 279. Admissão de assinatura sem contexto HTTP real nos adapters

**Data:** 2026-10-04, onda 97, sem commit.

**Causa:** cotas já protegiam criação de equipamento, mas o principal privado
ainda não consumia acesso/dono/módulos comerciais. Helpers da raiz e seus pares
no serviço entregavam só headers e método/URL null. Isso não consegue distinguir
uma consulta de uma escrita, incluindo GET OAuth que grava credenciais, nem
conservar o corpo para exceções estritas.

**Solução:** política única em backend/entitlements, após CSRF/vínculo. Off não
consulta, shadow usa transação própria e não bloqueia, on aplica acesso/dono
atuais e módulos com overrides válidos por tenant. Os 20 pares de adapters
encaminham request real. Métodos e schemas estritos distinguem devolver,
encerrar, concluir, baixar e reemitir; billing conserva posse/permissão. Recusas
comerciais conservam códigos/campos e cache privado. Fallback sem HTTP não
inventa GET. Guard estrutural verifica forwarding e mantém suas mutações.

**Validação:** 337 casos distintos, 110 novos, aprovados. RLS com papéis
separados prova override estrangeiro sem efeito, troca de dono e recuperação SQL
em shadow. Paridade HTTP real dos dois hosts, CSRF, tipos/lint/gates passaram.
Três tolerâncias obsoletas de higiene ganharam consumidor real e saíram; nenhuma
proteção foi ampliada.

**Limites:** admissão HTTP não trava plano/acesso até a escrita. Revalidar na
transação dos comandos, principalmente nova cobrança de obrigação em curso;
equipe, promoção, site e demais lotes SaaS seguem pendentes. Enforcement real
off, legado/scheduler ativos, sem produção ou cutover. Ver limites-plano.md e
onda 97 de shared-api-host.md.

## 280. Plano alterado entre admissão HTTP e mutação

**Causa:** consulta anterior à escrita não conserva acesso/módulo até a
gravação; metadados FULL do principal podem estar desatualizados.

**Solução incremental:** guarda de backend/entitlements trava organização na
transação de logística/manutenção e PIX/boleto. Revalida direitos/exceções;
ownership fica no serviço financeiro. Shadow recupera SQL por savepoint; off
conserva legado. Hosts transportam recusas/cache. Futuros escritores de
overrides também precisam do lock da organização.

**Validação:** 422 casos distintos, 93 novos. Papéis restritos provam lock até
INSERT, mudança comercial bloqueada, zero cobrança/tentativa/outbox após recusa,
RLS, shadow e obrigação anterior à suspensão. Arquivos/provas: onda 98 de
shared-api-host.md.

**Limites:** S8 parcial. Boleto manual de orçamento precisa de fronteira própria
porque a mesma implementação atende jobs aceitos. Demais comandos/equipe/site/
SaaS/operação pendentes; fiscalização real off, legado/scheduler preservados.

## 281. Boleto manual e job aceito compartilhavam a mesma entrada

**Causa:** ensureQuoteBoletoPayment atende tanto o pedido HTTP como obrigações
aceitas pela outbox. Instalar admissão comercial nessa entrada indistintamente
bloquearia jobs, enquanto consultar apenas no HTTP permite mudança de plano
entre a admissão e a escrita.

**Solução:** um núcleo único com entrada manual requestQuoteBoletoPayment e
entrada de job preservada. Revalida toda preparação e o envio separado. Retorno,
fechamento estrito, PAID/SETTLED e reemissão vigente compartilham classificação
HTTP/transacional e preservam as exceções existentes de RESTRICTED. Hosts
transportam policy sem alterar os envelopes antigos de domínio.

**Validação:** 587 casos distintos, 80 novos, papéis RLS restritos, downgrade
durante leitura externa sem nova cobrança, idempotência, obrigações e paridade
dos doze adapters. Tipos/gates e builds aprovados; arquivos/provas na onda 99 de
shared-api-host.md. Imports dinâmicos das classes nas fixtures são
desestruturados explicitamente para não marcar a namespace inteira no Knip;
nenhum baseline foi modificado.

**Limites:** S8 parcial, fiscalização real off, legado/scheduler ativos. Demais
comandos/equipe/divulgação/site/SaaS e aceites externos ainda pendentes.

## 282. Comandos de orçamento, locação e perfil confiavam na admissão anterior

**Causa:** o principal HTTP pode conter FULL anterior à transação. Uma alteração
comercial entre essa consulta e a gravação não era revalidada nesses comandos.
Aplicar o gate manual indiscriminadamente à conversão bloquearia pagamentos já
aceitos; negar todo SETUP/RESTRICTED também quebraria a edição do perfil
próprio.

**Solução incremental:** admissão na conexão da escrita de orçamento/locação e
perfil, conservando o lock da organização até commit. Conversão manual e efeito
aceito compartilham um núcleo; somente o pedido manual recebe admissão. Perfil
próprio conserva sua exceção após lookup scoped. 28 adapters transportam policy
com private, no-store/Vary Cookie, Host e preservam envelopes antigos.

**Validação:** 760 casos distintos, 116 novos, incluindo 39 recusas
transacionais sem efeitos, controles FULL, ownership, perfil e conversão paga
idempotente com papéis restritos por RLS. Tipos/lint/gates e builds do serviço e
legado passaram; nenhum baseline alterado. Arquivos, comandos e limites: onda
100 de shared-api-host.md.

**Limites:** S8/equipe/comunicação/divulgação/site/SaaS e aceites externos
continuam parciais; fiscalização real off, API legada/proxy/scheduler ativos.

## 283. Comunicação e documentos dependiam de admissão anterior ao pedido durável

**Causa:** principal HTTP FULL pode ficar antigo antes de gravar mensagem,
rascunho, assinatura ou envio ajustado. Repetir o gate na resposta do provedor
ou no worker recusaria efeitos já aceitos e perderia seu resultado.

**Solução:** revalidação na transação anterior à escrita/outbox, pelos módulos
whatsapp e contractSignature quando aplicáveis. Geração local e e-mail de
sistema não recebem requisito de inbox/assinatura. Workers existentes e
atualizações sent/unknown mantêm efeitos aceitos. Hosts transportam policy com
cache privado e preservam respostas antigas, sem regra comercial duplicada.

**Arquivos e validação:** whatsapp-client.ts, whatsapp-send.ts,
rental-contracts.ts, adjusted-quote.ts e seis adapters pareados de contratos/
envio ajustado; testes e comandos na onda 101 de shared-api-host.md. 437 casos
distintos, 46 novos, tipos/lint/gates passaram, incluindo RLS, ownership,
ausência de efeitos na recusa e downgrade posterior à aceitação. A referência de
credencial da fixture foi corrigida para a constraint existente, que ficou
intacta.

**Limites:** Zoho externo sem intenção durável exige corte próprio; Merchant
continua em quarentena. S8/equipe/site/SaaS e aceites externos parciais,
fiscalização real off, legado ativo.

## 284. Zoho externo: admissão durável e resultado incerto

**Data:** 2026-10-04, sem commit. **Causa:** mutações externas podiam ocorrer
sem aceitação persistente; cache em memória não sobrevive ao processo. **Solução
incremental:** executor único no backend, migration aditiva com FORCE RLS,
participação/conexão scoped, fingerprint e estados PROCESSING, RESOLVED/UNKNOWN.
Admissão termina antes do provedor e resposta/auditoria confirmadas persistem
juntas. Off preserva o fluxo anterior.

**Arquivos:** prisma/schema.prisma, migration 202610040001,
modules/communications/zoho-command.ts, seis facades http/zoho-*.ts e composição
dos hosts; inventário/RLS e testes atualizados sem baselines permissivos.
**Validação:** 358 casos aprovados, 55 novos, incluindo concorrência, restart,
recusa sem efeito, bytes de upload e SQL/RLS/indexes. Gates e dois builds
passaram; 50 casos HTTP de mutação aprovados. A execução ampliada encontrou oito
falhas de origem em leituras/OAuth: política central aceita GET/HEAD,
caracterizações esperam recusa de Origin irmão. As proteções não foram
alteradas; o conjunto permanece parcial. **Limite:** UNKNOWN/crash sem
reconciliação, chave ausente sem dedupe garantido; S8/equipe/site/SaaS e aceites
externos parciais. Fiscalização off, legado ativo.
[Fronteira completa](../architecture/zoho-command-admission.md).

## 285. Leituras/OAuth Zoho ignoravam Origin explícito em GET

**Data:** 2026-10-04, sem commit. **Causa:** ao preservar a política central de
métodos seguros, os handlers privados de Zoho deixavam passar Origin de host
irmão. O authorize podia criar state e o callback podia consumi-lo mesmo nesse
cenário. Oito caracterizações HTTP da onda 102 expuseram a divergência.

**Solução:** guard compartilhado http/zoho-origin.ts verifica o Origin
explicitamente enviado antes de conta/token/provedor ou cookie/state/exchange.
Os dois hosts passam a Request real na leitura de contas. Sem Origin, a
navegação OAuth existente conserva seus checks de state/cookie/vínculo; a regra
geral de GET/HEAD permanece intacta. Nenhuma asserção anterior foi relaxada.
**Validação:** 502 casos distintos aprovados no bloco, incluindo 116 HTTP nos
dois builds locais; as oito recusas antes falhas passaram sem enfraquecer
testes. Provas na onda 103 de shared-api-host.md. **Limites:** aceite real de
OAuth/provedor, desconexão e reconciliação de UNKNOWN permanecem pendentes.
Legado ativo, fiscalização off e produção preservada.

## 286. Consultas do dono exigem propriedade atual e acesso de leitura em ARCHIVED

**Data:** 2026-10-04, onda 104, sem commit. **Causa:** ADMIN representa equipe;
o vínculo de propriedade é ownerUserId. Um principal já emitido pode anteceder
transferência de dono. A política genérica SETUP/ARCHIVED também impediria o
dono de consultar assinatura/faturas necessárias para regularizar a conta.
**Solução:** subscriptions/owner-read.ts revalida membershipId, usuário,
locadora, ADMIN ACTIVE e Organization.ownerUserId/status em snapshot RLS READ
ONLY. request-access.ts permite só GET/HEAD dos dois caminhos exatos do dono nos
estados de acesso restritos, sem abrir escritas ou subrotas. Os adapters são
finos e conservam guardas explícitas; o checker não mudou. **Validação:** 185
unitários, 126 de banco/RLS, 78 estruturais e os mesmos 24 cenários HTTP em
NextAuth e Better Auth nos dois hosts compilados. As fixtures cumpriram
CHECKs/roles e restauraram o dono da função SECURITY DEFINER antes de limpar seu
papel, sem DROP/CASCADE da função. Não há emissão ou ativação. **Arquivos:**
modules/subscriptions/owner-read.ts, modules/entitlements/effective-rights.ts,
request-access.ts, http/owner-subscription.ts, compositores/rotas dos dois
hosts. **Limites:** UI/ações/S6/aceites reais parciais; fiscalização off, legado
ativo. Detalhes: onda 104 de docs/features/shared-api-host.md.

## 287. Classes anteriores de logística/manutenção sem fixture de paridade

**Data:** 2026-10-04, encontrada na validação da onda 105, sem commit.
**Status:** aberto. **Causa observada:** tailwind-parity.test.ts encontra 12
classes bg/border/text com var(--color-*) em tipos.web.ts das pages logistica e
manutencao, sem entrada correspondente em tailwind-parity/production.json. São
as combinações blue/green/red/yellow com fundo 100, borda 200 e texto 800; os
arquivos antecedem a onda 105. Isso é lacuna de referência, não prova de
diferença de cor no navegador. Os outros dez testes de paridade passaram.

**Validação:** pnpm exec vitest run --config tests/visual/vitest.config.ts
tests/visual/tailwind-parity.test.ts reproduz a lista. Nenhum checker, exceção
ou fixture foi alterado para aprová-la. O dashboard afetado pela faixa do dono
passou em 390/1440 px com zero diferenças na baseline de estilos existente.
**Próximo passo:** conferir a origem semântica dessas classes e seus valores
contra a referência de produção antes de corrigir código ou acrescentar prova
canônica. Não aprovar visual diferente silenciosamente. **Arquivos:**
packages/frontend/src/pages/logistica/model/tipos.web.ts,
packages/frontend/src/pages/manutencao/model/tipos.web.ts,
tests/visual/tailwind-parity.test.ts e tailwind-parity/production.json.

## 288. Ações do dono precisam do instante real de autenticação

**Data:** 2026-10-04, onda 106, sem commit. **Causa:** a sessão comum preservava
expiração e usuário, sem o instante de autenticação. Usar renovação de cookie
para o limite de dez minutos permitiria uma sessão antiga executar ação
sensível. O principal também não pode fornecer ownership ou horário por flags.

**Solução:** NextAuth assina authenticatedAt apenas no sign-in user/account;
refresh/update não altera o valor e revogação por credencial permanece. Os dois
compositores Better Auth projetam createdAt validado da sessão. Cookies antigos
sem horário exigem reautenticação nas ações, sem perder as consultas comuns.
Cancelamento/desfazimento revalidam dono e vínculo em transação do papel de
plataforma, antes de replay e depois da trava verificam tempo novamente.

**Arquivos:** modules/identity/fresh-session.ts, legacy-auth.ts e tipos;
lib/application-session.ts e apps/services/api/src/host/session.ts;
modules/subscriptions/owner-cancellation.ts, facts.ts/projection.ts,
http/owner-cancellation.ts, runtime/platform-jobs.ts e quatro rotas dos hosts.
**Validação:** unidade prova renovação/forja; PostgreSQL sob papel isolado prova
troca de dono concorrente, expiração esperando trava, idempotência e rollback.
341 casos distintos do bloco passaram, mais tipos/gates/builds. Detalhes e
limites na onda 106 de docs/features/shared-api-host.md. Ainda sem controle na
UI ou aceite externo; legado/enforcement/produção preservados.

**Complemento onda 107:** o login comum redirecionava sessões existentes, o que
impedia reautenticação explícita após FRESH_SESSION_REQUIRED. Agora o modo
requireReauthentication só suprime esse atalho e exige identidade obtida após
sign-in; nunca fornece privilégio ao backend. As rotas web/raiz passam a flag
reauthenticate=1. Callback não leva ação/chave e não reenvia o pedido. Provas do
hook, rota real e Chromium cobrem cookie existente e retorno para revisar a
assinatura. Confirmar/cancelar/retry vivem na slice da página; validação
sensível continua nos serviços da onda 106. Detalhes na onda 107 de
shared-api-host.md.

## 289. Emissão de mensalidade precisa de duas fases duráveis

**Data:** 2026-10-04, onda 108, sem commit. **Causa:** POST de cliente e POST de
recorrência não são uma transação com o banco. Resposta incerta, queda antes de
persistir id ou workers simultâneos podem duplicar recursos; GET rejeitado após
POST bem-sucedido não prova que a criação falhou. Um cancelamento durante I/O
também não pode reabrir a assinatura ao receber a resposta.

**Solução:** reserva sob travas/contador e providerCustomerId commitado antes do
POST de assinatura. PROCESSING recuperado/UNKNOWN consultam somente referências
na fase incerta; não repetem o POST. Correspondência inclui documento/ref do
cliente e cliente/ref/ciclo/valor/estado da recorrência. Busca só por ref
detecta cadastro anterior com documento alterado. Predecessor incerto bloqueia
criação concorrente para a organização. Divergência fica FAILED, com código e
auditoria. Resposta tardia do recurso cancelado entra no histórico e agenda
inativação, sem restaurar acesso ou presumir pagamento.

**Arquivos:** subscriptions/owner-command.ts, owner-activation.ts,
issuance-profile.ts, issuance.ts/topics.ts; billing/asaas-platform-issuance.ts;
http/owner-cancellation.ts, runtime/platform-jobs.ts e duas rotas activate.
**Validação:** PostgreSQL isolado com RLS, dispatcher real, rollback, corrida,
UNKNOWN/crash, D-7, cadastro/ambiente alterados e cancelamento concorrente;
adapters/contratos com provedor falso; HTTP anônimo nos dois builds. Detalhes na
onda 108 de shared-api-host.md. Quarentena exige conciliação assistida futura;
Asaas/aparelho/aceites reais não certificados, fiscalização off/legado ativo.

## 290. Confirmação da ativação precisa preservar a intenção e distinguir pagamento

**Data:** 2026-10-04, onda 109, sem commit. **Risco prevenido:** accepted:true
confirma o pedido durável de emissão, não uma fatura paga. Compartilhar o modal
com cancelamento sem preservar a ação permitiria substituir uma tentativa
incerta por outro comando; dois gatilhos também podem devolver foco ao botão
errado quando o diálogo fecha.

**Solução:** transporte/modelo/diálogo únicos na slice assinatura-admin, chave e
ação scoped preservadas na repetição manual, outro comando indisponível durante
intenção pendente/incerta. Mudança do resumo/preço ou sessão/locadora descarta
confirmação e resposta antiga. accepted relê, mantendo a autoridade do backend;
mensagem separa solicitação e pagamento. Perfil/aceites/reauth não ecoam
detalhes privados. Fechamento restaura o foco ao gatilho real. Expo só
estado/link.

**Arquivos:** pages/assinatura-admin/api/owner-action.ts,
model/use-owner-action.ts, ui/SubscriptionActions.web.tsx e
ui/AssinaturaPage.web.tsx; testes colocados e
tests/visual/subscription-owner.spec.ts. **Validação:** 180 focados/18 Chromium,
tipos/gates e builds web/legado locais. Sem CSS/baseline/proteção alterados;
capturas 390/1440 inspecionadas. APIs/identidade simuladas não certificam Asaas,
aparelho ou login real; legado/enforcement permanecem.

## 291. Reativação precisa concluir a cobrança antiga antes de emitir a nova

**Data:** 2026-10-04, onda 110, sem commit. **Risco prevenido:** criar a nova
recorrência enquanto a anterior segue ativa ou uma exclusão está incerta permite
cobranças simultâneas. Reutilizar a assinatura CANCELED apaga a fronteira
histórica; perder o vínculo quando outra reativação acontece também permite
contornar a limpeza anterior.

**Solução:** nova Subscription sem teste, recibo scoped com plano e ligação
imutável à anterior. O worker concilia INACTIVE/vencidas antes de READY;
activate/cron e reativações consecutivas respeitam essa barreira. Perdão local
mantém CANCELED/REACTIVATION_WAIVER durante PENDING/OVERDUE remoto. UNKNOWN,
PROCESSING e 404 após DELETE só conciliam, sem repetir a exclusão. Restauração
confirmada exige conciliação manual; PAID/REFUNDED/CHARGEBACK não são apagados.
Pagamento antigo preserva o motivo do perdão e gera auditoria para tratamento
manual.

**Arquivos:** subscriptions/owner-command.ts, owner-reactivation.ts,
reactivation.ts, reactivation-state.ts, offers.ts, issuance.ts,
issuance-profile.ts, invoice.ts, binding.ts e jobs.ts; handler/composição
compartilhados, duas rotas reactivate e testes de comando/acesso/banco.
**Validação:** 480 casos distintos, dez verificações HTTP dos builds,
tipos/gates/builds locais; fixtures com campo obrigatório e encerramento entre
testes, sem afrouxar as asserções. Interface, backoffice e provedor real não
certificados; legado/enforcement permanecem.
[Provas](../features/shared-api-host.md#onda-110--reativacao-duravel-pelo-dono-2026-10-04-sem-commit).

**Consumidor web (onda 111, 2026-10-04, sem commit):** a página de assinatura
consulta ofertas mensais depois do resumo CANCELED autorizado, exige seleção e
confirmação, envia só a versão e relê após recibo. Plano/chave incertos não são
substituídos pelo catálogo novo; antes do envio, oferta alterada invalida
revisão. Login recente exige nova confirmação. 226 casos/20 Chromium e
tipos/gates/ builds locais aprovados. Provedor real/backoffice ainda pendentes;
mobile não compra e legado/enforcement permanecem.

## 292. Histórico inativo de equipe não deve bloquear o dono no onboarding

**Data:** 2026-10-04, onda 112, sem commit. **Causa:** a primeira implementação
do cadastro consultava a existência de qualquer registro platform_staff, embora
o ADR e o trigger memberships_forbid_platform_staff proíbam apenas equipe ativa.
Isso recusava um ex-integrante com registro histórico inativo.

**Solução:** a consulta de elegibilidade em modules/onboarding/provisioning.ts
inclui active=true. O operador assistido continua exigindo PLATFORM_ADMIN ativo
e não revogado. Nenhuma política ou trigger é alterado. **Validação:** teste
PostgreSQL com ex-integrante inativo cria vínculo ADMIN; três recusas de
operador VIEWER/revogado e dono da equipe ativa continuam passando. Arquivo de
prova: tests/identity/onboarding-database.test.ts. Cadastro público e provedor
real continuam pendentes; API legada/enforcement off preservados.

## 293. Recusas iniciais também precisam dos headers privados do onboarding

**Data:** 2026-10-04, onda 113, sem commit. **Causa observada:** os novos
handlers compartilhados já devolviam private/no-store/Vary Cookie, Host, mas
retornos antecipados dos guards de sessão/CSRF não passavam pelo handler. Nos
dois builds locais, GET status sem sessão retornou 401 sem Cache-Control e a
recusa de origem cruzada tinha somente no-store. Isso não prova armazenamento em
cache; mostra a ausência da política explícita prometida para essas rotas.

**Solução:** os adapters compõem Response com o corpo/status originais e os
headers privados nos retornos antecipados de status e criação. Conservam
Content-Type e os valores anteriores de Vary. A operação fica na gramática
inerte já aceita pelo inventário, sem chamar código novo antes da autorização.
Nenhuma decisão de acesso muda e o guard global legado não é alterado.
**Arquivos:** as quatro rotas organizations/status e
tests/unit/onboarding-routes.test.ts. **Validação:** as provas dos adapters
conferem 403 antes da sessão, corpo/status 409 intactos e preservação de Vary
Accept. Inventário e builds locais verificam a composição; a prova HTTP final
confere 401/403 e headers nos dois hosts. Não há claim de cadastro público,
sessão real de dono ou provedor homologados.

## 294. Visão de recebimentos precisava representar a saúde existente

**Data:** 2026-10-04, onda 120, sem commit. O consumidor de saúde já registra
KEY_EXPIRED e KEY_DELETED, mas o enum da visão do dono só reconhecia os outros
quatro problemas. A nova consulta estrita não poderia representar essas
pendências. O contrato passou a reconhecer os dois códigos; nenhuma escrita de
saúde, enum SQL ou política RLS mudou.

O reader usa seleção explícita e mensagens conhecidas. Não retorna erros
armazenados do provedor. APPROVED com integração não ACTIVE ou pendência é
projetado como RESTRICTED, sem corrigir dados por GET. Código desconhecido ainda
produz indisponibilidade neutra, nunca eco de payload.

**Arquivos:** contracts/payment-account, backend/payment-accounts/owner-read,
entidade conta-recebimentos e testes. **Validação:** seis códigos, integração
indisponível, dono revogado/transferido, seleção de outra locadora e ausência de
conta. PostgreSQL usa papéis reais sem BYPASSRLS; nenhuma proteção foi ampliada
para aceitar fixtures inválidas.

## 295. Moldura administrativa ausente no host web e seletor encoberto

**Data:** 2026-10-04, onda 120, sem commit. A prova compilada de recebimentos
mostrava a consulta mas nenhum menu: a composição ainda existia apenas em
app/admin/admin-layout-client.tsx. Reutilizar os cabeçalhos fixos também expôs o
seletor do gate fora da área útil, encoberto no desktop e no viewport estreito.
Testes isolados de página/menu não detectavam essa integração.

**Solução:** AdminLayoutShell em frontend/app compõe os widgets originais,
colapso desktop, menu mobile, rolagem do main e classe do body. Layouts legado e
web delegam sua apresentação; a autorização legada foi preservada. O gate
entrega o seletor existente à moldura só quando o conteúdo está aberto. Sem
seleção ele continua disponível fora da moldura e o conteúdo privado continua
fechado. Clientes mobile e demais gates preservam o posicionamento anterior. Não
há nova seleção, regra comercial ou leitura de identidade no layout.

**Validação:** seis provas da moldura com widgets reais, incluindo integração
com RuntimeBootstrap, ausência de seleção, colapso, Escape e rolagem. Provas
anteriores de sessão, carrinho, SSR e tenant-host continuam verdes. A prova
Chrome do build confere o seletor acessível e os menus desktop/web estreita.
Fundo original vem da variável canônica; camadas usam o token existente. Nenhum
baseline, grant, flag real ou guard de API foi alterado para aceitar a correção.

## 296. Fixtures do cofre precisam selecionar a integração e controlar o relógio

**Data:** 2026-10-04, onda 121, sem commit. **Causa:** a consulta de prova de
ativação selecionava qualquer segredo ACTIVE com propósito ASAAS_API_KEY. Com as
novas contas de recebimentos, havia outras integrações legítimas e a primeira
linha podia pertencer a outra fixture. A prova de tolerância do token anterior
também usava datas fixas no comando e o relógio real no resolver; a passagem do
dia tornava a janela expirada.

**Solução:** a consulta de ativação agora inclui o integrationId da fixture. A
prova de tolerância usa o mesmo relógio fixo durante a chamada real do resolver,
simulando apenas Date e restaurando o relógio no finally. Timers de conexão e
SQL continuam reais; a janela de produção e suas asserções não foram alteradas.

**Arquivo:** tests/identity/secrets-database.test.ts. **Validação:** os 17 casos
do arquivo passaram no PostgreSQL descartável, incluindo ativação, rotação, HMAC
anterior, concorrência, isolamento e rollback da conexão inicial. Nenhum segredo
real foi usado e nenhuma política ou grant foi ampliado.

## 297. Intenção de configuração e reconciliação não é resultado de saúde

**Data:** 2026-10-04, onda 122, sem commit. **Causa:** GET de webhooks não
comprova a autenticação remota. Uma criação que perdeu a resposta pode ter sido
aplicada. Apagar sua intenção após outra falha ou um evento de saúde permitiria
repetir POST. Uma fila interrompida também não pode ser liberada depois de uma
falha incidental de consulta ou indisponibilidade da chave.

**Solução:** autenticação recuperável derivada no cofre, com contexto e
separação de domínio; só o hash fica na integração. Intenção e hash têm commit
antes de POST/PUT. Configuração incerta retoma por GET e PUT do próprio webhook,
nunca outro POST com lista vazia. Configuração e consumidor de saúde preservam
os marcadores duráveis e mantêm a conta restrita. Reconciliação financeira ainda
não está implementada e não é presumida por um reinício externo da fila.

**Arquivos:** backend/secrets/vault, billing/asaas-account-webhooks,
payment-accounts/configuration, payment-accounts/webhook e
runtime/platform-jobs. **Validação:** resposta perdida, leitura seguinte
indisponível, processo/cofre recriados, chave indisponível, concorrência,
rollback depois do recibo e eventos de saúde intercalados; PostgreSQL com papéis
reais e HTTP do provedor simulado. As fixtures do cofre agora leem K1/K2 e
drenam páginas limitadas anteriores; contagens estritas de chamadas e limites de
produção foram conservados.

## 298. Aprovação geral não resolve pendências cadastrais contraditórias

**Data:** 2026-10-04, onda 122, sem commit. **Causa:** a projeção podia usar
general APPROVED mesmo com dados comerciais, banco ou documentação pendentes.
Essa contradição não comprova prontidão para receber.

**Solução:** projectAccountHealth exige os quatro estados atuais APPROVED.
REJECTED prevalece; pendência conhecida mantém análise e informação desconhecida
mantém ação do dono. Bloqueio manual, expiração anual e restrições operacionais
continuam prevalecendo. A configuração usa essa mesma projeção, sem outra regra
de aprovação.

**Arquivos:** backend/payment-accounts/health, configuration e testes.
**Validação:** cada estado não geral PENDING, AWAITING_APPROVAL, REJECTED e
UNKNOWN com general APPROVED; fluxo no PostgreSQL e proteção de restrições.
Nenhum enum, grant, baseline ou contrato público foi ampliado.

## 299. Reconciliação de fila exige prova financeira e não comprova entrega

**Data:** 2026-10-05, onda 123, sem commit. **Problema:** a configuração
anterior preservava corretamente a barreira de interrupção, mas não recuperava
fatos financeiros. O leitor compatível mapeia estados desconhecidos para
pending; esse fallback não é evidência adequada para liberar uma fila. Uma
fotografia financeira também não comprova que a causa da falha de entrega foi
corrigida.

**Solução incremental:** leitura estrita optativa, incidente durável e cursor
por chave em páginas de até cinco tentativas. Billing usa RLS/papel de negócio,
valores persistidos e o processador existente. Revalida vínculo e obrigação após
o I/O. Checkpoint e efeito têm commit conjunto; divergência ou emissão incerta
mantém revisão. Pagamento antigo não quita a obrigação nova, cancelamento só
confirma a tentativa e estorno conserva o histórico. Dados legados vinculados
sem tentativa não viram fotografia vazia completa.

**Limite:** a fotografia cobre somente referências vinculadas até seu corte
temporal. A fila continua restrita; liberação exige revisão, conciliação final
atualizada e prova de correção/entrega externa. Não existe PUT automático de
reativação neste incremento.

**Arquivos:** backend/billing/account-payment-reconciliation, asaas-events,
payment-accounts/configuration e runtime/platform-jobs. **Validação:** 251 casos
locais, incluindo PostgreSQL sem BYPASSRLS, cursor após falha, rollback de
efeito/checkpoint, duas composições de cron e chave scoped. Transporte simulado;
nenhum grant, baseline, flag real ou produção foi alterado.

**Complemento da onda 127:** payment-accounts registra recibos sanitizados do
incidente/chave e disponibiliza GET/POST privados de recovery. A interface
mostra progresso e confirma pedidos para o job existente; não repete escrita
incerta. Corpo financeiro inválido exige revisão, sem transformar falha em
sucesso. Locks, dono, sessão, backoff e isolamento permanecem; fotografia
concluída não libera fila. Provas consolidadas em shared-api-host.md, onda 127.

## 301. Nova conferência reutilizava a fotografia financeira antiga

**Data:** 2026-10-05, onda 128, sem commit. **Causa:** o pedido do dono podia
enfileirar outro job sem substituir o incidente concluído. Billing retoma
corretamente checkpoints completos sem novas consultas, então mudanças e
emissões posteriores ao corte antigo ficavam de fora. Uma inspeção PENDING
recorrente também impedia um novo pedido, mesmo com a fotografia completa.

**Solução:** payment-accounts/owner-recovery cria um incidente OWNER confirmado
quando o anterior está completo, preservando recibos e checkpoints. Reutiliza a
agenda PENDING sem alterar seu prazo; PROCESSING e lease vigente conservam o
incidente atual. Incompletos mantêm cursor. Locks serializam confirmação e
claims, e auditoria/enfileiramento são atômicos. Configuration revalida o
incidente depois do I/O para recusar a publicação de recibo tardio substituído.
O painel esclarece nova consulta, agenda e histórico, sem mudar estilos.

**Arquivos e validação:** owner-recovery.ts, configuration.ts e
AccountRecovery.web.tsx; testes unitários, componente, account-health-database e
owner-payment-account-connect.http. O banco descartável usa grants canônicos de
plataforma/negócio: nova conferência reconhece estorno posterior e emissão após
o corte; falha da auditoria reverte incidente/fila juntos. Provas HTTP e
resultados consolidados em shared-api-host.md, onda 128.

**Limite:** a nova fotografia não certifica endpoint reparado nem entrega
externa. Não reativa fila, aprova conta ou altera legado/flags/grants/baselines.

## 300. Host da sonda de conexão era substituído pelo fetch do Node

**Data:** 2026-10-05, ondas 124–125, sem commit. **Estado:** causa da sonda
comprovada; transporte de teste corrigido, sem alteração no proxy ou no guard.

**Observação local:** POST anônimo nos dois hosts responde 401 e
private/no-store. POST direto ao serviço com borda válida do app e Origin
correspondente também chega ao 401. A sonda tentou o mesmo caminho pelo host
web, informando Host/Origin de app.localhost, e recebeu 403
`Origem não permitida`. O adapter compilado, exercitado isoladamente, produz
destino, origem e autenticação de borda esperados; isso não comprova a
transmissão na requisição HTTP real. Nenhum guard de origem foi afrouxado.

**Causa comprovada:** no Node 24.21.0, fetch conectado a 127.0.0.1 substitui o
Host informado pelo authority do URL, mas mantém o Origin. O proxy classificava
o host realmente recebido, e a recusa de origem era correta. Um servidor de eco
local confirmou os dois cabeçalhos transmitidos por fetch e por http.request. O
helper requestWeb de tests/api-host/web-consumer.ts já preservava Host; a sonda
da onda 124 não o utilizou. Seu resultado histórico continua como falha, não
como evidência de defeito no proxy.

**Correção e validação:** tests/unit/web-consumer-transport.test.ts protege a
transmissão de Host/Origin/cookie/corpo. A nova suíte
tests/api-host/owner-payment-account.http.test.ts usa o helper e o proxy Next
real, com portas dinâmicas, ponte TLS local e PostgreSQL descartável sob RLS.
Vinte casos passaram em cada motor, legacy e Better Auth, para os dois backends:
401 privado/no-store sem sessão, 403 para origem cruzada/opaque ou metadados
same-site, borda forjada substituída e usuário autenticado com vínculo CLIENT
recusado apesar do papel global ADMIN. Dezessete casos unitários passaram.

**Limite da prova da onda 125:** a interface Chromium anterior usa fixtures. A
nova prova autentica um usuário real local e verifica sua recusa por papel, mas
não envia uma chave do dono com aceite 202 pelo proxy. Não certifica conexão
Asaas, KMS/IP de produção, aprovação ou habilitação comercial. Nenhuma flag foi
ligada.

**Histórico de execução:** na onda 124, duas tentativas de reinício de
servidores auxiliares foram rejeitadas pela revisão automática de aprovação com
`blocked by policy`, sem motivo específico; o bloqueio não foi contornado.
Código, configuração de produção e API legada permanecem preservados. A onda 125
utiliza a infraestrutura de teste existente, com configuração sintética,
destinos loopback e limpeza dos filhos.

**Complemento da onda 126:** tests/api-host/receiving-account.ts cria banco
descartável, aplica migrations e os scripts canônicos de papéis, e instala um
provedor sintético loopback sem liberar chamadas externas. A suíte
owner-payment-account-connect.http.test.ts usa sessões reais e o proxy compilado
para aceitar o dono nos dois backends. 38 casos HTTP passaram em cada motor,
incluindo os vinte anteriores; cifra, restrição, repetição, seleção, CNPJ,
ownership e isolamento são verificados. O serviço usa seu entrypoint standalone.
A prova continua local: não homologa Asaas/KMS/IP nem libera pagamentos. Nenhum
guard, grant existente, flag ou baseline foi relaxado.
