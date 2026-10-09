# CLAUDE → CODEX — recuperação de contexto e handoff

**Referência atual:** 09/10/2026, America/Sao_Paulo. **Projeto:**
`C:\Projetos\Locadora_Equipamentos`.

## Checkpoint atual — 2026-10-09

O dono confirmou o aceite da interface e autorizou a revisão dos testes, a
validação até o verde e o commit/push da primeira etapa. O destino autorizado é
o novo repositório público vazio `Schlorke/Locadora_de_Equipamentos`; a
publicação usa história inicial limpa, sem pais do histórico antigo. O histórico
anterior e suas referências ficam preservados localmente, sem publicação de
commits, tags ou ramos antigos que transportem segredos. Não alterar nem revogar
credenciais reais, pois elas podem ser compartilhadas com a GB.

O backend desta etapa usa PostgreSQL local descartável. Infraestrutura,
provedores e operação de produção serão tratados depois; essa decisão não
autoriza reset de banco real, mudança de DNS/TLS ou ativação de flags reais. A
continuação autorizada inclui a aposentadoria do app antigo pelo plano P0/P1/P2
e F. Preservar o estado com raiz, fixar a referência imutável de pré-exclusão e
aplicar F primeiro em clone independente, com as provas exigidas, antes de
importar e revalidar. Não apagar a raiz deste checkout antes do clone.

A fronteira do frontend foi explicitada por variantes web e contratos puros,
preservando a lógica e o visual. `arch.log` registra zero `UNIVERSAL-DOM-JSX` e
zero `UNIVERSAL-WEB-LIB`; restam 43 ocorrências em 16 arquivos, todas legadas.
Esse resultado não declara P0/P1/P2/F concluídos nem cobre produção, Docker ou
limites de dispositivo/rede ainda sem prova própria. As novas suítes estão em
validação serial; não há declaração de verde geral neste checkpoint.

Evidências correntes em
`C:\Users\harry\AppData\Local\Temp\locadora-wave135-finish-20261009` (`FINISH`):

- `visual-human-acceptance.json`: registro do aceite humano da interface atual.
- `arch.log`: fronteiras universais e saldo de legado descritos acima.
- `history-before-clean-publication.bundle` e `history-bundle-verification.log`:
  preservação local do histórico anterior; não são conteúdo para o novo remoto.
- `history-secrets-result.json`: a varredura do histórico alcançável registrou
  exit 1; não publicar os pais antigos nem tratar a história antiga como limpa.
- `reviews/tests-frontend-workflow.md` e `reviews/tests-backend.md`: revisão da
  utilidade, sensibilidade e custo dos testes.
- `reviews/frontend-web-boundary-final-mapping.json`: movimentos de variantes
  web e extração de contratos; `reviews/retirement-plan.md` mantém a sequência
  de P0/P1/P2/F, sujeita à decisão vigente de história inicial limpa.

Os resultados novos pertencem aos logs e à consolidação de FINISH. Os blocos de
2026-10-08 abaixo conservam a cronologia, os hashes e as provas da fonte de
então; não são resultados da fonte atual. A antiga proibição de commit/push e o
aceite visual então aberto foram substituídos pela decisão humana de 2026-10-09.
Pendências técnicas não se encerram apenas por essa autorização.

## Checkpoint histórico — 2026-10-08

HTTP v2 e comparação B11 passaram nos quatro perfis, com cobertura/exceções
explícitas. Na mesma fonte final, jornadas legacy passaram 7 casos +2 skips
contratuais em 32,56s; Better Auth, 8 +1 em 84,77s. T5/T6 original passou 7/7 em
ambos. Três hosts têm builds registrados; Android/iOS e Storybook foram
empacotados localmente. O web Better Auth atual `R7kHAAzDS69RA5Yc0oQ1F` é o
build visual; as jornadas BA conservam o build `r2B-vsczGQAqwkg72XsRq`.

A composição visual fechou **80 JSONs, 536 estados e 536 capturas**: 78
páginas/162 estados mais dois catálogos/374 estados. A rodada original passou 80
casos em 747,728s; a recaptura separada passou dois casos em 20,4min (187
estados por viewport). São duas origens com SHA por arquivo, não uma execução
integral única. Ferramentas 93/93 em seis arquivos, tipos 0/0 e lint focado
verde. Nos artefatos selecionados: zero erros de página, rede pendente, APIs sem
mapeamento, esperas instáveis e arquivos novos/ausentes/obsoletos.

O comparador terminou com **exit 1: 16.272 registros pendentes e 372 já
aprovados**. São propriedades CSS/presença de elementos/estados, não diferenças
de pixels. Captura/composição/comparação estão concluídas; o aceite visual
continua aberto. A triagem atribuiu 16.260 registros às oito telas antigas
(entrada 295) e doze a serializações de gradiente candidatas à equivalência, sem
nova aprovação. A baseline tem 528 estados; os oito adicionais são estados de
Configurações já documentados. Nenhuma baseline foi regravada.

P0 formal e P1 continuam parciais; P2 e F não foram realizados. A10 passou no
escopo local normal com GPU real; Slow 3G ficou inconclusivo aos 150s. Docker
está indisponível. Commit/tag de pré-exclusão, clone/F/M7 formal e corte real
continuam abertos, sob a proibição atual de commit/push/produção. As árvores
legadas permanecem no disco. A tag com-raiz histórica existe e não substitui a
tag de pré-exclusão da versão atual.

A auditoria executada antes deste fechamento documental,
`final-audit-before-checkpoint/audit.json`, terminou exit 0: as 478 entradas
iniciais foram contabilizadas (408 com bytes iguais, 68 alteradas no escopo e
dois D preexistentes), sem perda nova, staging ou nova exclusão. Três retornos
conhecidos ao HEAD nas fontes de paridade explicam a diferença do inventário:
506 arquivos dirty e 31 adições fora do baseline. HEAD `873d8fbc` e `.expo`
original preservados. `cleanupComplete=true`, zero recursos próprios
pendentes/não confirmados e `auditProblems=[]`; PostgreSQL próprio parado com
exit 0 e dados preservados. Essa prova antecede a última atualização Markdown; A
atestação após esta atualização Markdown é registrada em
`final-audit-docs-closed/audit.json`; os dois registros conservam a ordem real
das leituras. Gates de arquitetura/tokens/nomes/CSS/higiene, lint global e
tipagem ampla (14 tarefas) terminaram exit 0.

## Continuidade autorizada — 2026-10-08

Cronologia da retomada: resultados e pendências de cada etapa conservam sua
proveniência; o checkpoint acima é o estado corrente. A auditoria original
limitava-se a investigar, reconstruir, conferir e documentar; depois houve a
autorização de implementação local descrita a seguir.

Após este checkpoint, o dono pediu: "pode prosseguir de onde ele parou, por
favor?". A implementação local da onda 135 foi retomada: reconciliar as seis
dependências já declaradas, fechar as expectativas B2 e o comparador B11 e
provar os exports de SEO (A4). A raiz e os arquivos anteriores são preservados.
Commits, push, deploy e ações de produção continuam fora desta execução.

O lockfile recebeu somente as seis entradas dos importers; as resoluções e os
snapshots não mudaram. A instalação offline com lockfile travado passou, e
frontend, UI e mobile conservaram o mesmo caminho resolvido do React Native. Um
cluster PostgreSQL novo e descartável, fora do repositório e separado do serviço
existente, recebeu todas as migrations por `prisma migrate deploy`.

A4: SEO e home passaram 29/29; onze mutações reprovaram, com fontes restauradas
por bytes/hash. B11 recusa registros vazios/falhos/incompletos; 74 casos e
quatro mutações sensíveis. O encerramento de processos ganhou observação real,
limpeza dos irmãos e erro agregado: 32 casos, tipos/lint e quatro mutações
passaram. Nenhuma dessas provas isoladas declara P0/P1/P2 concluídos nem
autoriza retirar a raiz.

A primeira rodada integral nova, somente com a API compilada no motor legacy,
passou 2.388 casos, com doze falhas e um skip intencional. A cobertura registrou
201/221 métodos com sucesso e vinte exceções contratuais justificadas. As falhas
foram rastreadas a expectativas de DTO/cabeçalhos e a manutenções deixadas pelo
job preventivo na locadora compartilhada. Após as correções, **a rodada integral
sem legado no motor legacy passou: 64 arquivos, 2.400 casos e um skip
intencional**, com 201/221 métodos em sucesso e vinte exceções justificadas. A
conclusão final confirma limpeza e ausência de erros não tratados. HDR usa bytes
não UTF-8 e a ponte de teste preserva os bytes. O fingerprint foi ampliado para
helpers/configuração/SQL e a fixture Better Auth recebeu correções de ARN e
checklist; naquele checkpoint os quatro perfis ainda precisavam de registros
novos. Essa exigência foi cumprida pela matriz HTTP v2 descrita abaixo.

A primeira suíte unitária ampla com ambiente correto passou 6.153 casos, com
duas falhas e treze skips. As falhas eram ordem incidental de pagamentos com
`createdAt` empatado e mapa sem a migration SEO nova; provas corrigidas, e a
rodada final passou **6.199 casos em 179 arquivos, com treze skips**. O guard de
ACL também passou após usar o helper canônico nas jornadas e manter a fixture
SQL unitária fora do caminho de scripts de papéis. Produto e SQL não foram
alterados para acomodar as provas.

A revisão visual encontrou uma classe híbrida inválida em Configurações. A
restauração usa somente os tokens/classes já existentes. Os três builds de
produção passaram novamente após ela; quatro capturas de produção passaram e
confirmaram fonte 12px, entrelinha 19,2px e cor secundária em 390/1440. As
respostas de notificações e onboarding ausentes da simulação continuam
registradas na primeira captura; os handlers fiéis das duas respostas foram
acrescentados à simulação e naquele checkpoint aguardavam recaptura. As
diferenças históricas do painel não foram aprovadas nem os baselines regravados.
C2/materialização passaram 51 casos; com B11 são 125 casos focados. O inventário
distingue o checkout pré-tag do snapshot fixado em SHA; a tag de pré-exclusão
ainda está ausente. A tag `checkpoint/onda-135-com-raiz` existe.

A rodada ampla passou contratos (106), plataforma (646 arquivos/3.983 casos,
dois skips), mobile (99), web (440, quinze skips), integração (105) e tipagem de
todos os workspaces. Segurança teve uma falha de sitemap, corrigida sem ampliar
a allowlist; identidade teve três falhas de fixture (relógio e provedor),
corrigidas mantendo contratos. A consolidação passou segurança (1.684, 36
skips), identidade (855), testes dos gates (280), tipagem da raiz, arquitetura,
tokens, nomes, documentação, CSS e lint. O controle de higiene encontrou uma
anotação de tipo de teste consumindo um export antes sem uso; ela passou a
derivar o contrato da função pública já usada, sem ampliar a API ou o baseline.
Higiene foi revalidada e passou. As dez classes sem fixture eram
canonicalizações contrárias à decisão existente de conservar sRGB e medidas em
px. Trinta ocorrências em sete fontes foram restauradas; o comparador conserva a
diferença Oklab/sRGB, e naquele estágio `test:visual-tools` passou 27 casos em
três arquivos. As validações posteriores do harness estão registradas abaixo. Os
três builds de produção foram renovados no modo `legacy` após a restauração:
raiz `-werVxPRS06Ml_NOsKpyY`, API `zWY7S7AvPwHTl8TUb4CeS` e web
`q_qL-hP87HrDszOcj6H0K`, conforme registro de 23:37:58 UTC. A rodada visual
completa foi interrompida por ambiente inválido e não constitui resultado;
naquele estágio a captura/comparação completa ainda estava pendente. O aceite
A10 avançou depois para prova local em rede normal, mantendo Slow 3G
inconclusivo, conforme registro abaixo. Nenhuma fixture, exceção ou baseline
visual foi regravada.

A captura de produção Better Auth
`visual-narrow/full-v4-better-auth-20261009T013001Z-84d4e6b9` fechou 80 casos
aprovados em 747,728s, mas os dois catálogos continham apenas `base`: foram
preservadas 78 páginas/162 estados válidos. O filtro vazio virava `[]` truthy e
pulava receitas. O parser/guard corrigido exige as 187 chaves canônicas por
viewport; ferramentas 93/93 em seis arquivos, tipos 0/0 e lint focado passaram.

A recaptura catálogo-only separada passou dois casos em 20,4min. A composição
`visual-narrow/composed-v4-pages-catalog-final` foi executada e fechou **80
JSONs/536 estados/536 capturas**, sendo 162 estados das páginas e 374 dos
catálogos. `composition-manifest.json` conserva origem/SHA-256 de cada arquivo,
ambos os reports/fingerprints e diferenças de spec/inputs; `summary.json` e
`coordinator-result.json` registram o inventário e o comparador. Zero erros de
página, rede pendente, APIs sem mapeamento, esperas instáveis e arquivos
novos/ausentes/obsoletos nos artefatos selecionados. Baseline: 80 JSONs/528
estados; atual: mais oito estados de Configurações já documentados.

A comparação terminou com **exit 1: 16.272 registros pendentes e 372 já
aprovados**. Registros são valores de propriedades CSS/presença de elementos,
estados ou seções; não são pixels. Captura/composição/comparação foram
executadas; a triagem abaixo não substitui inspeção ou aceite das diferenças. A
composição não é uma rodada integral única nem prova de repetibilidade. Produto,
build `R7kHAAzDS69RA5Yc0oQ1F`, ModelViewer `5c3c…`, fixtures, preparação e
baselines permanecem preservados.

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

O empacotamento P1 passou em Node 24.21.0, entre 23:39:56 e 23:41:22 UTC, com
ambiente sintético, leitura de `.env` isolada e telemetria desligada. Gerou
bundles Hermes Android/iOS e Storybook estático fora do repositório: seis
artefatos principais com bytes/SHA-256 conferidos e 172 entradas no catálogo
(156 stories e dezesseis páginas de documentação). O modo é `legacy`; isso
comprova empacotamento local, sem certificar aparelhos, distribuição, aparência
ou acessibilidade das stories. O log preexistente de `.expo` cresceu 1.505 bytes
durante o empacotamento; o coordenador o restaurou depois por guarda de hash
exato ao conteúdo original, com cópias anterior/posterior preservadas em
scratch. O inventário final registra zero arquivos adicionados/removidos e zero
links.

A primeira comparação B11 recusou corretamente os registros HTTP verdes de 3.018
casos com raiz e 2.400 sem raiz: nomes ambíguos, cinco títulos com telefone
aleatório e um percurso quadrático de hosts impediam equivalência verificável.
Doze tabelas em dez testes receberam labels semânticos estáveis, preservando os
47 cenários e expectativas. A recusa de unicidade atua agora no host cuja
fixture está sendo criada/limpa, com seis verificações por host. Comparador,
oracle, regras de asserções, skips/todos e braços legados permanecem. Os
registros anteriores ficam preservados.

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

O harness também neutralizava `NEXTAUTH_URL_INTERNAL` como string vazia. O
NextAuth usa `NEXTAUTH_URL_INTERNAL ?? NEXTAUTH_URL`, portanto não aplica o
fallback e falha no SSR com `new URL('')`. As origens internas e os segredos
sintéticos foram alinhados entre API/web; os runners locais declaram a URL
interna igual à URL NextAuth já existente, sem alterar produto ou `.env`. A
rodada legacy anterior à ampliação de J1 passou seis casos, com dois skips em
oito, em 22,41s (`journeys-legacy-pre-J1-green.log`, evidência em
`%TEMP%/locadora-journeys-TQYWBS`). Após ampliar J1, a rodada legacy passou sete
casos e dois skips em nove, em 29,34s (`journeys-legacy.log`, evidência em
`%TEMP%/locadora-journeys-z86UIe`). O fluxo visitante gerou um único orçamento
DELIVERY Standard: item 200, frete sintético 30, total 230, e carrinho vazio
após recarregar. Express comprova somente estimativa de UI; provedor real de
frete e entrega de notificações ficam fora dessa prova. Cada motor exige seu
próprio rebuild web. Após o loader, uma rodada legacy anterior passou sete casos
e dois skips em nove, em 50,84s (`journeys-legacy.log`, evidência em
`%TEMP%/locadora-journeys-SCdaSs`); os resultados anteriores permanecem
históricos. A primeira rodada Better Auth teve cinco passes, três falhas de
expectativa de percurso em J1/J4/J7 e um skip, em 146,47s
(`%TEMP%/locadora-journeys-XYtQXF`), preservada como histórico. A rodada final
Better Auth passou **oito casos e um skip contratual em nove, em 84,77s**, com
web `r2B-vsczGQAqwkg72XsRq` (`journeys-better-auth-final-coherent-dom.log`,
`journeys-better-auth-final-record.json`, artefatos em
`%TEMP%/locadora-journeys-2cWyfY`). O registro fixa a fonte por SHA-256. J1
observa atomicamente equipamento A presente/B ausente, dois controles,
quantidade um e dois dias, preservando os oráculos remotos/DB/orçamento/outbox:
item 200 + frete 30 = 230, um orçamento e carrinho vazio após reload. J4 passou
com o e-mail existente conferido no menu antes/depois de reload. J7 confirmou
callback, e-mail verificado, POST real de login 200/dono correto, sessão real,
etapa empresa e criação/checklist final.

Na mesma fonte final do teste (SHA-256
`9c3c1624e7789ffed2d02c687e9d187e1ec84558314119b18e6bb6b69c55c5ae`), a rodada
legacy passou **sete casos e dois skips contratuais em nove, em 32,56s**, com
web `qUsWUvj6ANYgIJAuWlNLR` (`journeys-legacy-final-coherent-dom.log`,
`build-legacy-final-coherent-dom.json`, artefatos em
`%TEMP%/locadora-journeys-N7wbsX`). J1 visitante confirmou item 200, frete 30,
total 230, um orçamento e carrinho vazio após reload. Depois, o web Better Auth
foi recompilado para o visual como `R7kHAAzDS69RA5Yc0oQ1F`
(`build-better-auth-final-coherent-dom.json`), com fonte de produto preservada e
ModelViewer no SHA `5c3c…`. A prova Better Auth 8/1 acima mantém a proveniência
do build `r2B-vsczGQAqwkg72XsRq`; o novo build ainda não constitui resultado
visual. O aceite integral P1/P2 e visual segue pendente.

O helper de login agora consulta sessão a cada 500ms, com limite total de 30s e
falha imediata em resposta não-200; nenhum limiter ou produto foi alterado.
Observadores passivos registraram 96 GETs de sessão do navegador, todos 200, e
owner-account 200/verificado, sem 429 nessa rodada. O polling antigo observou
429 em `hPjWdt`; isso não demonstra retrospectivamente a causa da falha de UI em
`tVke0w`. Uma rodada passiva ainda com 50ms também passou, com 91 GETs antes de
J7. Pressão sobre o bucket compartilhado permanece hipótese para aquela falha, e
o agregado do navegador não inventaria SSR/chamadas internas.

T5/T6 legacy passou a especificação original `tests/e2e/tenant-hosts.spec.ts`:
sete casos em sete, sem skips, em 5,85s, com API/web compilados e banco próprio.
A prova cobre roteamento por host, isolamento de duas locadoras, catálogo,
detalhe e navegação no navegador, sem avisos de hidratação nem erros de página.
O diagnóstico continuou somente requisições locais próprias, sem fabricar
respostas ou autenticação. `tenant-hosts-legacy-ef0267e0e7/completion.json`
registra sucesso e limpeza concluída, todos os filhos encerrados e nenhum
banco/papel preservado; o navegador foi capturado antes do fechamento original.
Esta rodada usou API `zWY7S7AvPwHTl8TUb4CeS` e web `q_qL-hP87HrDszOcj6H0K`.
T5/T6 Better Auth também passou a especificação original: sete casos em sete,
sem skips, em 5,86s, com API `zWY7S7AvPwHTl8TUb4CeS` e web Better Auth
`r2B-vsczGQAqwkg72XsRq`. A mesma prova de hosts/catálogo/detalhe registrou zero
erros de página e de captura, sem fabricar respostas ou autenticação.
`tenant-hosts-better-auth-a99ccdf7a6/completion.json` confirma sucesso, término
observado dos filhos e limpeza concluída, sem banco/papéis preservados; os
artefatos do navegador antecedem seu fechamento original. O aceite visual
continua pendente; T5/T6 não certifica jornadas de identidade, carrossel 3D nem
alterações posteriores.

P1/A10 está **parcial**. O loader saiu da root Html adicional do Suspense para
DOM React irmão do Canvas, com `loadedUrl === url`; os contratos de fit,
ScrollReveal, espera de 200ms, timers e rotação foram preservados. Passaram 5/5
e tipagem focada; a fonte original falhou em dois casos, e a restauração por
hash voltou a 5/5. A captura normal no web compilado Better Auth
`2026-10-09T00-39-31-220Z` teve GPU real, zero erros de página/probe, cinco
marcos e análise radial completa: Compressor sem fit sustentado e Betoneira como
controle positivo. O coordenador revisou o contact sheet de 354 quadros
decodificados em 14,16s. O loader foi validado nesse escopo local normal. Em
Slow 3G (`2026-10-09T00-40-02-378Z`), não houve erro de página ou perda de
contexto ativo; vinte descartes foram comprovados. O Compressor apareceu em
6.874 quadros, mas a Betoneira não desenhou até o limite declarado de 150s:
controle positivo e dois marcos ausentes, resultado inconclusivo sem ampliar a
janela. `a10-temporal/manual-review-final.json` registra ambos. A fonte conserva
SHA-256 `5c3c525df965282b1ba0650282e2bcb4453b7eda09f85f60d9db9a915aaa6c2f`. HDR
neutro sintético, Draco local e backend de fixture não certificam CDN,
iluminação real, infraestrutura de produção ou autenticação. Nenhum baseline
visual foi aprovado. Entradas 167/321 referenciam 334, mantendo a pendência do
aceite integral A10 e sem declarar ausência universal do erro.

Evidências locais desta retomada: `%TEMP%/locadora-wave135-resume-20261008/`. Os
achados e contagens da auditoria nas seções seguintes permanecem como fotografia
anterior à implementação.

## 1. Resumo executivo

O Claude preparava a **Wave 135: fechar as lacunas antes de aposentar a raiz
legada**. “Wave 135 lots A (web product)” é parte de um workflow com três lotes:
A (produto web), B (harness/testes independentes da raiz) e C (publicação,
ferramentas e operação), cada um dividido em dois implementadores. Não é uma
declaração de conclusão do SaaS.

A conversa correta foi encontrada tanto no Desktop quanto em `.claude`,
vinculada por um mesmo ID. O workflow durou 6h58min28s e terminou às **12:49:27
de 08/10**; o limite semanal foi registrado às **12:49:28**. Quatro
implementadores retornaram relatórios; dois foram interrompidos. Os seis
verificadores ficaram sem veredito final, embora dois tenham executado
inspeções/mutações antes da interrupção. O rótulo `completed` do workflow
significa que a orquestração terminou, com erros de quota; não significa aceite
técnico.

O checkpoint local real é **`873d8fbc74e423d4bf2152cb8c8e64b1be297810`**,
preservado pela tag **`checkpoint/onda-135-com-raiz`**. Na fotografia inicial,
depois dele havia **478 caminhos dirty**: 382 modificados, 2 removidos e 94
arquivos novos, contando `git status -uall`. Nada estava staged. A raiz continua
presente. A tag de pré-exclusão não existe nesta coleta; a tag com-raiz não deve
ser confundida com ela.

A Wave 135 **não estava concluída nessa fotografia inicial**. Havia código,
testes e provas locais substanciais, mas o consolidado estava aberto:
dependências sem atualização do lockfile, HTTP vermelho/cobertura incompleta,
testes SEO insensíveis à retirada de metadados, comparação B11 que aprova
evidência inexistente, diferenças visuais pendentes e revisão interrompida.
Lockfile, SEO, B11 e HTTP foram posteriormente corrigidos/validados na
continuidade acima. Os critérios formais, visual/A10 integral e retirada
continuam condicionados ao checkpoint atual; a cronologia não reabre lacunas já
fechadas nem autoriza apagar a raiz.

## 2. Contexto recuperado e fontes do histórico

### Identificação conclusiva

| Campo                      | Evidência recuperada                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| Título                     | `Continuar conversa anterior`                                                            |
| Sessão CLI                 | `4ad21d5f-c5f8-406a-a9ff-f4292e9d1296`                                                   |
| Sessão Desktop             | `local_a9278bc7-91ba-4361-8059-83159cad975f`                                             |
| Modelo/esforço registrados | `claude-opus-5-5`, `xhigh`                                                               |
| Workflow / task            | `wf_f0492776-1d5` / `w78knv8u7`                                                          |
| Início/fim do workflow     | 08/10/2026 05:50:59–12:49:27 BRT                                                         |
| Plano original             | `SP\wave135\plano-aposentadoria.md`, revisão 2, com respostas humanas posteriores em §12 |

`SP` neste documento =
`C:\Users\harry\AppData\Local\Temp\claude\C--Projetos-Locadora-Equipamentos\4ad21d5f-c5f8-406a-a9ff-f4292e9d1296\scratchpad`.
`AUDIT` = `C:\Users\harry\AppData\Local\Temp\locadora-context-audit-20261008`.
`PARITY` = `C:\Users\harry\AppData\Local\Temp\locadora-api-parity`.

O Desktop guarda metadados e associação ao `cliSessionId`; as mensagens,
ferramentas e subagentes estão no transcript de `.claude`. Os dois
armazenamentos foram investigados separadamente. Não foram modificados,
reparados ou desbloqueados registros originais.

**Objetivo original:** uma plataforma SaaS para locadoras independentes, com
assinatura como receita da plataforma; pagamentos dos clientes pertencem à
locadora, via uma subconta Asaas por locadora. Painel em `app.<raiz>`, vitrine
em `{slug}.<raiz>`, Expo único e backend compartilhado. A etapa atual exige que
os substitutos funcionem e sejam comprovados antes da retirada do legado.

**Funcionalidades em continuidade:** catálogo, orçamento/carrinho, locação,
financeiro, logística, manutenção, comunicação, identidade, onboarding,
assinatura e recebimentos; conteúdo institucional, textos legais, SEO e medição
próprios de cada locadora. Preservar semântica de dinheiro, idempotência,
sessão/vínculo e isolamento entre locadoras.

**Requisitos não funcionais:** RLS com papéis canônicos sem bypass, revalidação
do principal no servidor, CSRF/origem, segredos fora dos bundles e relatórios,
contratos públicos estritos, acessibilidade e fidelidade visual; testes de
comportamento sensíveis à perda de função, builds e runtime reais. Teste
presente, inventário igual e gate verde não substituem prova de produto.

### Fontes investigadas

- `%USERPROFILE%\.claude\projects\C--Projetos-Locadora-Equipamentos`: título,
  transcript principal, subagents/workflows, ferramentas e resultados.
- `%USERPROFILE%\.claude`: inventário de sessões, planos/tarefas e referências
  relacionadas. O plano específico da 135 estava no scratch da sessão; não se
  presumiu que `plans/` fosse sua fonte.
- `AppData\Roaming\Claude\claude-code-sessions`: metadados Desktop que
  identificaram a conversa exata.
- `AppData\Local\Claude\Logs`, `Roaming\Claude\logs`,
  `local-agent-mode-sessions`, IndexedDB/Local Storage/Session
  Storage/Partitions, `Local\Packages\Claude_pzs8sxrjxfjjc`, git-shadow e
  git-worktrees: investigação restrita, resultados e limites em
  `AUDIT\desktop-findings.md`. Locks ativos não foram abertos para escrita;
  buscas brutas em caches comprimidos não permitem afirmar ausência absoluta.
- `SP\wave135`: plano, cinco inventários e resultados do planejamento;
  `SP\lote-A`, `lote-B`, `lote-C`, verificadores e `tasks\*.output`: provas de
  execução.
- Git, documentação, scripts/gates, código e testes atuais; registros HTTP em
  `PARITY`.

Não foram carregados valores de `.env`, cookies, tokens ou credenciais para o
relatório. A memória anterior serviu somente de orientação de
continuidade/segurança; o faturamento exato foi decidido e implementado depois
da nota antiga da onda 129, portanto não é decisão a reabrir.

## 3. Estado atual do projeto

| Verificação atual         | Resultado                                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Branch / HEAD             | `modernizacao/multiempresa` / `873d8fbc…`                                                                                  |
| Último commit             | 08/10/2026 05:48:37 BRT, checkpoint das ondas 10–134                                                                       |
| Tag com-raiz              | Resolve para o mesmo commit; contém 34 migrations                                                                          |
| Migrations no disco       | 35; a adicional `202610080101_settings_seo_title_neutral_default` está sem commit e não foi aplicada nesta auditoria       |
| Upstream                  | Ausente nesta branch                                                                                                       |
| `origin`                  | Repositório `Schlorke/Locadora_de_Equipamentos`                                                                            |
| Remoto legado             | `gb-locacoes-legado`, push URL bloqueada; não foi usado para publicação                                                    |
| Inventário estático atual | Legacy e API: 173 rotas/221 métodos cada; web: 57 páginas; mobile: 45 arquivos de página segundo o inventariador existente |
| Diff rastreado            | 384 arquivos, 161.252 inserções/94.921 remoções; `public/openapi.json` domina o volume. Volume não mede progresso          |
| Integridade da coleta     | SHA-256 dos 478 caminhos dirty permaneceu igual durante a investigação, antes da documentação desta entrega                |

A topologia é `apps/clients/web` e `apps/clients/mobile` sobre
`packages/frontend` (FSD), `ui`, `design-tokens`; `apps/services/api` consome o
monólito modular `packages/backend`, domínio e contratos. `app/`, `lib/` e
fachadas legadas permanecem. Isso é a fase de expansão antes de contração, não
motivo para removê-los agora.

O Node padrão do terminal é 25.2.1, fora do `engines` do projeto. Para evidência
compatível, os seis gates foram repetidos **em série com Node 24.21.0** do
runtime portátil já existente e pnpm 10.27.0. Todos passaram: `arch`, `tokens`,
`check:test-names`, `docs:validate`, `lint:css`, `hygiene`. Logs/exit
individuais: `AUDIT\node24-*.log/.json`.

Limites desses verdes: `arch` aceita 983 ocorrências de dívida sob a catraca;
`hygiene` aceita 822 achados por 246 itens justificados. Nenhum deles certifica
P0/P1/P2, instalação frozen, produto visual ou operação. Não foram refeitos
builds, suítes completas, migrations, chamadas a provedores ou testes de
dispositivo nesta auditoria. Não foi iniciado servidor/navegador. Processos
preexistentes do Desktop e PostgreSQL foram preservados; uma trava
`SP\locks\hosts` ainda contém o dono histórico do lote B, e sua presença não
comprova processo ativo nem autoriza apagá-la.

## 4. Histórico das principais decisões

| Decisão                                                             | Estado e fonte                                                                                                                                                                   |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plataforma por assinatura, subconta por locadora                    | ADRs SaaS/tenant-hosts; permanece contrato do produto                                                                                                                            |
| Faturamento mensal exato, sem conversão de faixa                    | Decisão humana 06/10, transcript principal linha 6743; incorporada na 134                                                                                                        |
| Conteúdo/legal por locadora, páginas legais disponíveis na pausa    | Mesma decisão; promessas opt-in, nota só com fonte e frota configurável, linhas 7496–7506                                                                                        |
| Sites novos precisam Termos/Privacidade; versão aceita no orçamento | Decisão humana; lotes posteriores D-C(2)/D-F ainda pendentes                                                                                                                     |
| Tudo funcionar antes de apagar                                      | Transcript principal linha 9204                                                                                                                                                  |
| Checkpoint e tag locais, sem push                                   | Pergunta/resposta linhas 9294–9295; commit/tag comprovados no Git                                                                                                                |
| D0=b                                                                | Depois de P0/P1/P2, revisão e tag pré-exclusão, a retirada no repositório pode preceder o corte real; plano §12. A missão atual suspende qualquer execução até nova autorização  |
| D3/D4/D9                                                            | Better Auth no corte; Analytics/verificações por locadora; portar as quarentenas Merchant/imagens/avulsos, preservando restrições                                                |
| D8                                                                  | Logo da locadora ou ícone neutro, sem GB em outra locadora                                                                                                                       |
| D1/D2/D5/D6/D7/D10                                                  | Domínio/DNS, domínio antigo GB, origem pública da API, hospedagem, janela de estabilidade e autoridade do cron ficam para o corte. Não bloqueiam o trabalho local de recuperação |
| Validação da onda                                                   | Integrador único para arquivos compartilhados; gates/suítes em série, revisão independente, prova dupla e sem raiz antes da exclusão                                             |

A produção descrita no plano pertence ao repositório legado. Isso é evidência
documental/histórica, não inspeção atual do ambiente de produção. Nenhuma
conclusão de deploy ou saldo atual da conta Claude foi inferida do histórico.

## 5. Implementações confirmadas e ponto exato da interrupção

**Última etapa comprovadamente concluída como marco integrado:** Bloco 0,
commit/tag com-raiz. O conteúdo das ondas 10–134 está preservado nesse objeto; o
checkpoint não certifica novamente cada requisito funcional do produto.

**Última etapa parcialmente executada:** lotes A/B/C/K da 135 e início da
verificação independente. Implementações presentes incluem imagens remotas,
SEO/medição por locadora, moldura de conta, guard do painel/loading, expansão de
testes de rota/visual, harness absent, contrapartes da API, registro de
cobertura, onboarding HTTP, manifests/runbook/CI e porte de
ferramentas/quarentenas. A matriz da seção 8 distingue implementação de aceite.

| Implementador | ID de agente        | Último resultado verificável                                                                                                                                                          |
| ------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A.1           | `aa356b14eb5b0be8d` | Relatório às 08:47:35 BRT. A0/A1/A3/A4/A11; quatro falhas API por motor e lockfile pendente                                                                                           |
| A.2           | `a1a056a7148da72a2` | Relatório às 12:30:10. A2/A5/A6/A8/A9/A10; A7 parcial; rodada API com 412/413 falhas e validações ainda vermelhas                                                                     |
| B.1           | `a396eb8112efb3598` | Relatório às 09:42:37. B1/B4/B6/B8/B9, B5 com 69/81 contrapartes reportadas; absent integral vermelho                                                                                 |
| B.2           | `a01077bc16266cb6c` | Sem relatório final. Último comando às 12:39:33, espera de captura; timeout às 12:49:24, depois quota. Builds root/API/web anteriores terminaram exit 0; capturas finais não fecharam |
| C.1           | `a840992fceb6730bf` | Relatório às 07:12:03. Configuração/manifestos/scripts/runbook/K; Docker configurado, runtime Docker sem prova                                                                        |
| C.2           | `a1a02bbbc09c4732c` | Sem relatório final. OpenAPI/contratos e sondas locais avançaram; última espera da trava de hosts retornou às 12:40:20, ainda ocupada pelo B. Sem contrato HTTP final                 |

Os nomes dos implementadores A.1/A.2 não são os IDs A1/A2 do plano.

O orquestrador principal fez sua última chamada de ferramenta nas linhas
9563–9564 do transcript (leitura; retorno às 08:25:12 BRT). Recebeu o término do
workflow na linha 9713, às 12:49:27; a linha 9720 registra a quota. Não houve
integração final depois dessa entrega.

**Tarefas de fundo finais:** `b3ayzli6t`, `bphpwfl2q`, `bcpzmdmfq`, `bm9hmou19`
e `b1bn6u7ek` têm saída `[killed]`. `b03yws38v` contém dois `migrate failed`,
embora o script agregador tenha saído com código zero. Nenhuma dessas saídas
prova sucesso das capturas ou migrations.

Há provas históricas positivas de alcance limitado: integração 105 casos,
identidade 855, segurança 1.684 mais skips, mobile 99, e rodadas web/platform
anteriores; três hosts foram compilados em múltiplas rodadas. São snapshots de
lotes concorrentes e não a validação consolidada da árvore atual. Logs e
ferramentas/retornos, em vez das declarações de conclusão, sustentam esses
recortes.

## 6. Implementações pendentes

A prioridade imediata é a integração da 135: reconciliar manifests/lockfile sem
trocar a variante React Native; finalizar expectativas/harness/cobertura B;
fechar contrapartes e OpenAPI; tornar a prova SEO sensível aos wrappers;
resolver diferenças visuais; integrar documentação e revisão independente.
Depois vêm P0, tag pré-exclusão, P1 e P2 num clone limpo, com instalação
independente, duas autenticações e mutações negativas. A exclusão F e sua
revalidação dependem desses aceites.

Não começaram como bloco final comprovado: P0 aprovado, tag pré-exclusão, P1
integral aprovado, P2 aprovado e exclusão F. Não foram executados nesta missão:
staging, homologação externa, corte de tráfego, migração/flags reais, publicação
ou piloto.

O backlog SaaS posterior inclui contratos legais/versionamento, frete por
locadora, documentos/recuperação e operações de recebimentos, backoffice/saques,
aparelhos, homologação e piloto. A aposentadoria técnica da raiz não encerra
esse escopo.

## 7. Problemas identificados e dependências bloqueantes

| ID  | Constatação                                              | Evidência / implicação                                                                                                                                                                                                                                                                      |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I01 | Lockfile não acompanha seis dependências declaradas      | Web: Analytics/Speed Insights; backend: zod; frontend: three/fiber/drei. Comparação atual de `package.json` com os importers do lockfile. Instalação frozen/P2 ainda sem aceite; não foi tentada instalação nesta missão                                                                    |
| I02 | HTTP mais recente permanece vermelho                     | `PARITY\production-legacy\cases.jsonl`: 3.006 registros, 2.594 pass/412 fail; Better Auth: 3.000, 2.587 pass/413 fail. Metas iniciadas às 11:22/11:26 BRT, modo legacy presente. São registros históricos, não execução atual                                                               |
| I03 | Cobertura de sucesso incompleta                          | `coverage.json`: legacy 143/173 rotas e 181/221 métodos; Better Auth 147/173 e 185/221. Faltam 40/36 métodos; `ok=false`. Inventário montado 173/221 não prova esses desfechos                                                                                                              |
| I04 | `absent` integral não aprovado                           | Logs anteriores B: 35 arquivos/1.189 casos falharam por motor, incluindo URL `undefined/api/...`. Um recorte C teve sete casos absent verdes; isso demonstra progresso parcial, não P1                                                                                                      |
| I05 | SEO pode perder ligação das páginas sem reprovar a suíte | Verificador `a064f60dc7cbae04a`, linhas 206–207: retirar `generateMetadata` de oito páginas deixou 419 testes verdes. Restauração SHA-256 confirmada; lacuna de testes, não prova de defeito atual de produção                                                                              |
| I06 | B11 aprova ausência total de evidência                   | Sonda atual Node 24: `parity-report.mjs assertions` com dois diretórios inexistentes devolveu exit 0/zero casos comparados. `readRecord` retorna `[]`; `compareAssertions` aceita mapas vazios. Inputs permaneceram inexistentes; nenhum arquivo de produto foi alterado                    |
| I07 | Aceite visual global aberto                              | 38 baselines novos/19 cenários × 2 larguras, porém 16.281 diferenças antigas de painel descritas no README; duas capturas iguais não são aprovação contra baseline. Preservar identidade visual e obter aceite das diferenças                                                               |
| I08 | A7 e A10 têm limites explícitos                          | Sitemap sem lastmod de equipamentos por contrato sem updatedAt; carrossel preservado sem zoom animado, porém Slow3G exibiu primeiro compressor só na terceira volta, ~71 s, outros sem desenho na janela de 6 s. Não alterar automaticamente o contrato do carrossel                        |
| I09 | Validação de lote não consolidada                        | Há logs unit/platform/API/lint/visual-tools vermelhos em rodadas da 135; três builds verdes não os anulam. Alguns goldens divergem da troca `flex-shrink-0`→`shrink-0`, documentada separadamente. Falhas precisam ser reproduzidas/atribuídas, sem simplesmente aceitar novas expectativas |
| I10 | Revisão/integrador interrompidos                         | Quatro resultados, oito erros de quota; todos `verdicts=[]`, `repair=null`. Textos prontos em docNotes não chegaram ao registro integrado de modernization/shared-api-host/CHANGELOG                                                                                                        |
| I11 | Docker/dispositivos/provedores/corte sem prova atual     | Configuração CI não é execução; testes sintéticos não homologam Asaas/BaaS/KMS nem Android/iOS. Condições humanas/externas para operação continuam separadas                                                                                                                                |

As causas de todas as 412/413 falhas não foram diagnosticadas caso a caso nesta
missão. Não atribuir esse total automaticamente a defeitos do produto: o
harness, comparações, fixtures, timeouts e geração de metadados mudaram
simultaneamente.

## 8. Backlog: checkpoint atual e matriz histórica

### Matriz corrente de aceites — após as provas fechadas

O saldo abaixo usa o plano SP §§5.2/5.3/5.4/6.5/12. A auditoria de critérios em
scratch foi feita antes dos resultados finais de navegador/3D: seus limites
formais continuam válidos; seus estados antigos de jornadas/T5/A10 foram
superados pelas provas desta continuidade. Não há contagem atual de “35 itens a
terminar” nem necessidade de reabrir uma prova fechada sem mudança relevante.

| Marco/IDs                                         | Estado atual no escopo registrado                       | Prioridade        | Evidência/dependência e próximo trabalho                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A0/A4; B1/B2/B3/B11                               | CONCLUÍDA E VALIDADA, nas provas locais descritas acima | —                 | Frozen offline; SEO/mutações; HTTP v2 quatro perfis, cobertura com exceções e B11 sem violações. Não incluem F nem clone.                                                                                                                                                                                                                                                          |
| B7: jornadas J1–J7 e T5/T6                        | CONCLUÍDA E VALIDADA, com skips contratuais explícitos  | —                 | Legacy 7+2 e BA 8+1 na mesma fonte final; T5/T6 original 7/7 em cada motor, limpeza certificada. Não reservar repetição geral neste saldo.                                                                                                                                                                                                                                         |
| A2/P1: empacotamento mobile/Storybook; M8         | CONCLUÍDA E VALIDADA no recorte local                   | —                 | Seis artefatos SHA/172 entradas; M8 limitado às fontes/runtime revisados. Não certifica aparelhos, distribuição ou segurança universal.                                                                                                                                                                                                                                            |
| A9/P1: aceite visual                              | PARCIALMENTE IMPLEMENTADA                               | P0                | Composição completa: 80 JSONs/536 estados/536 capturas, duas origens/SHA; zero diagnósticos selecionados. Comparador exit 1: 16.272 registros pendentes/372 já aprovados, sem comparação de pixels. Triagem: 16.260 em oito telas antigas/295 + doze gradientes candidatos à equivalência, sem aprovação nova. Falta revisão/inspeção/aceite; guard 93/93, tipos 0/0 e lint verde. |
| A10/P1: manual 1/Slow 3G                          | PARCIALMENTE IMPLEMENTADA                               | P1                | Rede normal/GPU real aprovada no escopo local; Slow 3G sem desenho da Betoneira/controle positivo em 150s. Falta concluir essa prova, preservando fit/ScrollReveal.                                                                                                                                                                                                                |
| C3/P1: imagem API health/non-root                 | BLOQUEADA por ambiente                                  | P1                | Docker CLI não disponível; daemon não verificado. Executar imagem própria e verificar health200/usuário quando disponível; não basta Dockerfile/CI.                                                                                                                                                                                                                                |
| C7: fechamento documental/proveniência/recursos   | PENDENTE no fechamento final                            | P1                | Depende do aceite visual e da consolidação documental. Auditoria pré-checkpoint exit 0, 478 entradas contabilizadas/cleanup completo; renovar a atestação após estes docs e apenas checks afetados.                                                                                                                                                                                |
| P0: commit/tag e fallback imutável da fonte atual | PARCIALMENTE IMPLEMENTADA; marco Git BLOQUEADO          | P0                | Builds/HTTP locais fechados; falta commit exato autorizado, tag de pré-exclusão e vínculo/prova do fallback. Tag com-raiz histórica não substitui isso.                                                                                                                                                                                                                            |
| P1 formal                                         | PARCIALMENTE IMPLEMENTADA                               | P0                | Provas fechadas mantidas; saldo local acima, Docker e aceites finais ainda abertos. Não confundir API sem raiz rodando com raiz ausente no disco.                                                                                                                                                                                                                                  |
| P2/M7 e F                                         | BLOQUEADA pela autorização e pré-condições              | P0                | Clone da tag exata, instalação própria, F no clone, bateria/mutações e M7; depois aceite/importação/revalidação de F (§6.5). Sem commit/tag/clone/exclusão nesta execução.                                                                                                                                                                                                         |
| K/corte real e SaaS externo                       | BLOQUEADA para operação; saldo amplo não reestimado     | P0 antes do corte | Runbook/autoridade, staging, provedores e dispositivos têm critérios próprios. Provas locais não ligam cron nem autorizam produção.                                                                                                                                                                                                                                                |

### Matriz original — fotografia anterior à continuidade

Os estados, lacunas e horas das linhas seguintes são **históricos**, anteriores
às correções e provas da seção corrente. Conservam o inventário e sua
proveniência; não descrevem o saldo atual nem anulam os resultados fechados.

Estados usados: **CONCLUÍDA E VALIDADA**, **IMPLEMENTADA SEM VALIDAÇÃO**,
**PARCIALMENTE IMPLEMENTADA**, **PENDENTE**, **BLOQUEADA**, **ESTADO
DESCONHECIDO**. Validações pontuais aparecem como evidência e não promovem toda
uma linha ao aceite integrado. P0/P1/P2 são IDs de fases; na coluna prioridade
P0 significa prioridade máxima.

São **36 itens explícitos do plano**: Bloco 0 + 12 A + 11 B + 7 C + P0/P1/P2 +
K + F. Naquela auditoria havia um marco fechado e 35 itens que requeriam
finalização, prova ou revisão. Isso não significa 35 funcionalidades por
implementar. As estimativas por item são orientação; usar os grupos da seção 9
para evitar somar baterias repetidas.

| ID  | Tarefa/descrição                                         | Estado conservador         | Evidência no checkout / lacuna                                                                                                                                                                                                                                                                         | Dependência                 | Prioridade | Esforço restante               |
| --- | -------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- | ---------- | ------------------------------ |
| 0   | Checkpoint todo trabalho 10–134 e tag com-raiz           | CONCLUÍDA E VALIDADA       | HEAD 873d8fbc e tag reportados pelo integrador; PLANO:782-783. Alterações posteriores estão dirty, preservadas                                                                                                                                                                                         | nenhuma                     | P0         | 0                              |
| A0  | Dependências por workspace e workspace-unlisted          | PARCIALMENTE IMPLEMENTADA  | frontend/package.json:74-75,91; backend/package.json:49; tools/hygiene-check.mjs:17-20,945-953; integrador encontrou seis dependências de importers sem correspondência no lockfile. Instalação frozen/clone ainda não provada                                                                         | 0                           | P0         | 1–4 h                          |
| A1  | Shim entrypoint e types só de tipos                      | IMPLEMENTADA SEM VALIDAÇÃO | arch.config.json:39-43,59,97; tools/token-check.mjs:76; tools/ratchet-transfers.json:236-249. .d.ts continua fora do leitor arch, limite conhecido                                                                                                                                                     | A0                          | P0         | 0,5–2 h                        |
| A2  | Storybook independente da raiz                           | IMPLEMENTADA SEM VALIDAÇÃO | .storybook/main.ts:18-24; preview usa CSS público; tests/unit/storybook-config.test.ts:23-65; docs/guides/storybook.md:7-17                                                                                                                                                                            | A0/A1                       | P1         | 0,5–2 h                        |
| A3  | Imagens remotas como a raiz                              | IMPLEMENTADA SEM VALIDAÇÃO | apps/clients/web/next.config.mjs:53-84,140-143; docs/features/tenant-hosts-web.md:237-244 narra next start e 400 anterior                                                                                                                                                                              | A0                          | P1         | 0,5–2 h                        |
| A4  | SEO próprio por página                                   | PARCIALMENTE IMPLEMENTADA  | (vitrine)/seo.ts:15-50; entities/configuracao/model/seo-da-vitrine.ts:135-160; nove páginas chamam helper. Integrador encontrou oito mutações metadata sobrevivendo à suíte web; a implementação existe, mas falta prova sensível à perda de wrappers                                                  | A1                          | P0         | 2–6 h                          |
| A5  | Moldura cliente com menu/notificação/saída               | IMPLEMENTADA SEM VALIDAÇÃO | AccountLayoutShell.web.tsx:4-13; (account)/layout.tsx:13-15; doc area-cliente-historico-detalhes.md:169-182; testes e cenários existem                                                                                                                                                                 | A1                          | P1         | 1–3 h                          |
| A6  | Papel do vínculo no portão e quatro loadings             | IMPLEMENTADA SEM VALIDAÇÃO | features/entrar-admin/model/redirect.ts:20-42; RuntimeBootstrap.tsx:330-332,484-487; RuntimeBootstrap.painel.test.tsx:104-125; quatro loading.tsx novos em admin                                                                                                                                       | A1                          | P0         | 1–4 h                          |
| A7  | Sitemap categoria/prioridade/frequência/data             | PARCIALMENTE IMPLEMENTADA  | [locadora]/sitemap.xml/route.ts:25-40,80-118; equipamentos sem lastmod por contrato público sem updatedAt, documentado                                                                                                                                                                                 | A3/A4                       | P1         | 0,5–2 h                        |
| A8  | Expandir 21 testes de rota para host web                 | IMPLEMENTADA SEM VALIDAÇÃO | Exemplos: AreaClientePage.web.test.tsx:47-52; CategoriasPage.web.test.tsx:41-66; Detalhe.web.test.tsx:226-238; WhatsAppAdminPage.web.test.tsx:60-70. As asserções da raiz ainda presentes são intencionais até F                                                                                       | A5/A6                       | P1         | 1–3 h                          |
| A9  | Cenários visuais faltantes                               | PARCIALMENTE IMPLEMENTADA  | 38 baselines novos (19 cenários × 2 viewports); tests/visual/README.md:43,65-82. 42 antigos não regravados; painel antigo mantém 16.281 diferenças da moldura, Sobre fora do harness. Não satisfaz critério final sem diferença não aprovada                                                           | A5/A6                       | P0         | 4–12 h                         |
| A10 | Primeiro modelo sem zoom em GPU real/Slow3G              | IMPLEMENTADA SEM VALIDAÇÃO | docs/features/equipment-3d-carousel.md:401-434 narra Chrome/GPU, controles positivos e capturas externas. Sem zoom animado no primeiro; Slow3G só desenhou compressor na 3ª volta (~71s), demais modelos não desenhados na janela 6s. Preservou contrato; aceitação final/carrossel no clone pendentes | A9/P2                       | P1         | 1–4 h                          |
| A11 | GA4/Ads/verificação/CSP/Analytics                        | IMPLEMENTADA SEM VALIDAÇÃO | medicao.ts:16-54; [locadora]/layout.tsx:37-99; next.config.mjs:94-127,163-174; app/layout.tsx:10-20; formulário web/nativo e migration neutral seo existem. Doc seo-e-medicao-da-vitrine.md:138-157 lista provas e limite JIT Zod                                                                      | A4                          | P0         | 2–6 h                          |
| B1  | Harness absent, targets, sessão/API, outbox API→API      | PARCIALMENTE IMPLEMENTADA  | targets.ts:20-21; global-setup.ts:143-151,999,1051-1052,1221-1228. Rodada absent anterior com 1.189 falhas, incluindo undefined/api/admin/permissions; últimas capturas completas presentes ainda com 412/413 falhas; não apto P1                                                                      | A0                          | P0         | 4–10 h                         |
| B2  | Expectativas explícitas e evitar prova vazia             | PARCIALMENTE IMPLEMENTADA  | api-host-parity-scan.test.ts:2-7,29; targets.ts:52-59; dezenas de arquivos convertidos. P0 histórico ainda vermelho; mutações P2 pendentes                                                                                                                                                             | B1/A4                       | P0         | 4–12 h                         |
| B3  | Registro cobertura sucesso 173 rotas/221 métodos         | PARCIALMENTE IMPLEMENTADA  | parity-report.mjs:12-17,265-268; global-setup.ts:189-201. Fonte existe; nenhuma cobertura integral aceita confirmada nesta auditoria                                                                                                                                                                   | B1/B2                       | P0         | 2–6 h                          |
| B4  | Integração usa API compilada                             | IMPLEMENTADA SEM VALIDAÇÃO | tests/global-setup.ts:210,297; comentários e importadores migrados; exige rodada com/sem raiz                                                                                                                                                                                                          | B1                          | P0         | 2–6 h                          |
| B5  | Contrapartes 53+28, assinatura HTTP e quotes pelo tenant | PARCIALMENTE IMPLEMENTADA  | tests/critical/* e unitários importam composição serviço; subscription-commands.http.test.ts existe; rodadas dirigidas/consolidadas falharam segundo integrador                                                                                                                                        | B1                          | P0         | 3–10 h                         |
| B6  | Segurança/sessão/superfície serviço e resolução NextAuth | PARCIALMENTE IMPLEMENTADA  | backend/identity/application-session.test.ts; web/host/architecture.test.ts; tests/security/fixtures/api-surface.json:3-4; mutações sensíveis e suíte integral não fechadas                                                                                                                            | B1                          | P0         | 3–8 h                          |
| B7  | E2E hosts e jornadas J1–J7 sem raiz                      | IMPLEMENTADA SEM VALIDAÇÃO | tests/e2e/journeys.spec.ts e tenant-hosts.spec.ts; tenant-hosts-web.md:299-324 descreve casos. T6 histórico usa BYPASSRLS: prova filtros/borda, não RLS. Dublês não homologam provedores                                                                                                               | B1/A5/A6                    | P1         | 2–6 h                          |
| B8  | Tenant-cron teste no runner serviço                      | IMPLEMENTADA SEM VALIDAÇÃO | tests/unit/tenant-cron-jobs.test.ts modificado; precisa suíte unit verde                                                                                                                                                                                                                               | B1                          | P1         | 0,5–2 h                        |
| B9  | Resend interceptado e links reais HTTP                   | IMPLEMENTADA SEM VALIDAÇÃO | resend-provider.ts:14-19; global-setup.ts:1038,1122; email-links.http.test.ts novo                                                                                                                                                                                                                     | B1                          | P1         | 1–4 h                          |
| B10 | Onboarding HTTP ligado/desligado                         | IMPLEMENTADA SEM VALIDAÇÃO | onboarding.http.test.ts:19-22,92-108,214-338,402-566; ligado/desligado e verificação por dublê presentes                                                                                                                                                                                               | B1                          | P0         | 2–6 h                          |
| B11 | AssertionCalls por caso P0×P1                            | PARCIALMENTE IMPLEMENTADA  | parity-setup.ts:5,58; parity-report.mjs:214-243; sonda atual aceita dois diretórios inexistentes com exit 0 e zero casos comparados (seção 7); absent integral sem prova verde                                                                                                                         | B1/B2/B3                    | P0         | 1–4 h                          |
| C1  | Vercel web e engines                                     | IMPLEMENTADA SEM VALIDAÇÃO | apps/clients/web/vercel.json novo; package.json:6; host-deploy-config.test.ts:63-73                                                                                                                                                                                                                    | A0                          | P1         | 0,5–2 h                        |
| C2  | Manifestos API/web/fallback                              | IMPLEMENTADA SEM VALIDAÇÃO | docs/operations/manifesto-variaveis.md novo; conteúdo por host; inventário process.env precisa revisão do verificador interrompido                                                                                                                                                                     | C1                          | P1         | 1–3 h                          |
| C3  | CI Docker API health e não-root                          | IMPLEMENTADA SEM VALIDAÇÃO | ci.yml:205-245; apps/services/api/Dockerfile:18-22. Declaração USER node não prova execução local nem CI remoto                                                                                                                                                                                        | C1                          | P1         | 1–4 h                          |
| C5  | OpenAPI no serviço/contracts                             | PARCIALMENTE IMPLEMENTADA  | packages/contracts/src/openapi novo; tests/unit/openapi-generation.test.ts:144-177,202-217,272-278; geração atual precisa check                                                                                                                                                                        | B4                          | P1         | 1–4 h                          |
| C6  | Scripts e quarentenas portados                           | IMPLEMENTADA SEM VALIDAÇÃO | scripts/ops/storage-utils.ts e google-merchant/* novos; scripts-root-independence.test.ts:2-11; hygiene-baseline razões COD-03/04 portadas. Merchant segue 503, decisão deliberada                                                                                                                     | A0/D9                       | P1         | 1–4 h                          |
| C7  | Runbook/ADRs/aceite corrigidos                           | IMPLEMENTADA SEM VALIDAÇÃO | runbook-corte-raiz-legada.md:3-7,17-26,66-113; shared-api-acceptance.md:144-154. Ainda falta registro integrado onda135 em shared-api-host/modernization/CHANGELOG                                                                                                                                     | C2                          | P1         | 1–3 h                          |
| C8  | Performance no host tenant                               | IMPLEMENTADA SEM VALIDAÇÃO | docs/guides/performance-testing.md:55; scripts config e tests/unit/performance-scripts.test.ts presentes; não rodar carga real nesta missão                                                                                                                                                            | B1                          | P2         | 0,5–2 h                        |
| P0  | Rodada dupla final verde e tag pré-exclusão              | PENDENTE                   | PLANO:308-316; todas rodadas integrais recuperadas pelo integrador estão vermelhas. Tag pré-exclusão não certificada                                                                                                                                                                                   | A/B/C                       | P0         | 3–8 h após correções           |
| P1  | Toda bateria só API em dois motores/builds               | PENDENTE                   | PLANO:318-338; absent histórico vermelho; não basta teste isolado ou fixture                                                                                                                                                                                                                           | P0                          | P0         | 5–12 h após correções          |
| P2  | Clone sem raiz, instalação limpa, bateria e 4 mutações   | PENDENTE                   | PLANO:340-360; nenhuma prova de clone independente verde localizada por este auditor                                                                                                                                                                                                                   | P0/P1/tag                   | P0         | 8–20 h                         |
| K   | Preparar agenda API e 404 web                            | IMPLEMENTADA SEM VALIDAÇÃO | api/vercel.json:4-16 contém late-fees/expire-quotes/outbox. Agendar localmente em arquivo não é ligar cron real; runbook:39-53 exige autoridade única                                                                                                                                                  | P/local + dono corte        | P1         | 1–3 h local; operação separada |
| F   | Exclusão controlada e revalidação                        | PENDENTE                   | app/lib/middlewares/schemas e APIs legadas permanecem; PLANO:414-491. Provas P0/P1/P2 e tag obrigatórias; missão atual proíbe executar                                                                                                                                                                 | P0/P1/P2 e autorização nova | P0         | 8–20 h                         |

### Backlog SaaS além da aposentadoria técnica

| ID          | Tarefa                                                        | Estado                                                                       | Evidência                                                         | Dependências/prioridade                                                             | Estimativa restante e confiança               |
| ----------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------- |
| SaaS-L1     | Exigir Termos+Privacidade para publicar sites novos D-C(2)    | PENDENTE                                                                     | ADR SaaS:2578-2581 e ADR hosts:744                                | Publicação/onboarding, P1                                                           | 6–14 h; média                                 |
| SaaS-L2     | Versão dos Termos aceita no orçamento D-F                     | PENDENTE                                                                     | ADR SaaS:2593-2596; hoje só hash de publicação no audit_logs      | Modelagem/versionamento/quotes/UI, P1                                               | 12–28 h; baixa-média                          |
| SaaS-L3     | Frete por locadora P-1                                        | PENDENTE                                                                     | ADR SaaS:2597-2599; conteúdo-vitrine:77                           | Origem CEP/rótulo tenant e integração frete, P1                                     | 8–20 h; média                                 |
| SaaS-S9a    | Documentos BaaS e confirmação anual                           | PENDENTE                                                                     | ADR SaaS:2430; conta-recebimentos.md:497-504,537-543              | Contrato S9/UI web, P1; homologação externa posterior                               | 20–48 h; baixa                                |
| SaaS-S9b    | Recuperação assistida chave, barreira conta conectada e T-P2  | PARCIALMENTE IMPLEMENTADA                                                    | ADR SaaS:2430; conta-recebimentos.md recovery atual só inspeciona | Cofre/conciliação/dono recente, P0 antes de habilitar recebimentos                  | 20–48 h; baixa                                |
| SaaS-S12    | Backoffice/suporte, liberação BLOCKED, revisão CNPJ duplicado | PENDENTE ou parcial a inventariar por operação                               | ADR SaaS:2400,2430; known-issues.md:86-96                         | Dono/staff/2FA/auditoria; P0 antes de operação comercial                            | 40–100 h; baixa                               |
| SaaS-S13    | Despublicação/republicação guiada e aceite estado completo    | PARCIALMENTE IMPLEMENTADA                                                    | ADR SaaS:2401,3164; LIVE/PAUSED/OFF já implementados              | Site/onboarding/contratos legais, P1                                                | 10–26 h; baixa-média                          |
| SaaS-S14    | Saldo/extrato/saque BaaS com 2FA e validação webhook          | PENDENTE                                                                     | ADR SaaS:2402; conta-recebimentos.md:539-543                      | S9/S12/acordo BaaS; P1                                                              | 40–96 h; baixa                                |
| SaaS-S15    | Sandbox+staging multi-host, carga, rollback, provedores       | PENDENTE / BLOQUEADA para partes externas                                    | ADR SaaS:2403,2407-2409; runbook:78-113                           | Credenciais sandbox PJ, BaaS suporte, domínio/DNS, hospedagem; P0 antes corte       | 24–64 h ativos + espera externa; baixa        |
| SaaS-S16    | Piloto produção e monitoramento 14 dias                       | BLOQUEADA                                                                    | ADR SaaS:2404; runbook:115+                                       | Acordo BaaS ou caminho conectado aprovado, KMS, IP fixo, aprovação humana; P0 corte | 16–40 h ativos + 14 dias de observação; baixa |
| SaaS-S17    | Remover env/flags temporárias/rotas antigas após adoção       | PENDENTE                                                                     | ADR SaaS:2405                                                     | Aceite piloto/produção; P2                                                          | 8–20 h; baixa                                 |
| SaaS-Mobile | Dispositivos, gestos, downloads/uploads, previews e visual    | ESTADO DESCONHECIDO quanto à matriz completa; aceites documentados pendentes | modernization.md:85-93,403; ADR hosts/aceite:121-123              | Aparelhos Android+iOS e cenários reais; P0 antes afirmar paridade                   | 24–64 h; baixa                                |
| SaaS-GB     | Dono preencher frota e nota com fonte, dados de corte         | PENDENTE do dono                                                             | ADR SaaS:2563-2577,2620-2622                                      | Dado real; não inventar números. Não bloqueia investigação/local                    | 0,5–2 h ativos; alta, espera não estimável    |

## 9. Estimativa de conclusão

### Saldo atual — horas ativas, sem percentual de conclusão

Estimativa do trabalho **conhecido** a partir da matriz corrente, sem incluir
espera por execução/ambiente/autorização. Implementação inclui ajustes de
harness/documentação; teste é produção e análise das provas, não só duração da
suíte. A captura/composição/comparação visual já executadas não recebem horas
novas; A9 agora cobre a triagem/inspeção/aceite. Os intervalos não são prazo
prometido. Reparos de regressões ainda não diagnosticadas exigem estimativa
própria após a triagem.

| Grupo restante                                                                           | Implementação/correção | Testes/provas | Revisão/validação |         Total | Confiança                                   |
| ---------------------------------------------------------------------------------------- | ---------------------: | ------------: | ----------------: | ------------: | ------------------------------------------- |
| A9: revisão da entrada 295, doze equivalências candidatas e inspeção/aceite visual       |                  0–2 h |         1–3 h |             1–3 h |         2–8 h | baixa, aceite/reparos ainda não definidos   |
| A10: diagnóstico/prova Slow 3G com controle positivo                                     |                  0–2 h |         1–3 h |           0,5–1 h |       1,5–6 h | baixa, comportamento lento não resolvido    |
| Fechamento local: docs/proveniência, atestação pós-docs e checks afetados                |              0,5–1,5 h |         0–1 h |         0,5–1,5 h |         1–4 h | média                                       |
| **Subtotal local já permitido**                                                          |          **0,5–5,5 h** |     **2–7 h** |       **2–5,5 h** |  **4,5–18 h** | baixa                                       |
| C3: Docker, quando CLI/daemon estiverem disponíveis                                      |                  0–1 h |       0,5–2 h |           0,5–1 h |         1–4 h | média após desbloqueio; espera desconhecida |
| P0 formal: commit/tag autorizado e fallback vinculado                                    |                0,5–1 h |       0,5–2 h |           0,5–1 h |       1,5–4 h | média, condicionado à autorização           |
| P2/F no clone: instalação própria, configurações/retirada, bateria, quatro mutações e M7 |                  3–8 h |        6–14 h |             2–5 h |       11–27 h | baixa, estado sem raiz ainda não exercitado |
| F no checkout: importação/limpeza e revalidação prescrita após aceite                    |                  1–3 h |        4–10 h |             1–2 h |        6–15 h | baixa, depende de P2/aceite/autorização     |
| **Subtotal Git/P2/F condicionado**                                                       |           **4,5–12 h** | **10,5–26 h** |       **3,5–8 h** | **18,5–46 h** | baixa                                       |

A ordem de grandeza até retirada local validada, **se desbloqueados Docker e
Git/P2/F**, passa a **24–68 h ativas** (4,5–18 + 1–4 + 18,5–46), confiança
baixa. Não é saldo todo executável agora. HTTP v2/B11, jornadas dos dois
motores, T5/T6, builds e empacotamento já fechados não recebem horas de
repetição geral. P2 e F reservam apenas as baterias exigidas para seus **estados
futuros sem raiz** (§§5.4/6.5); isso não reabre os resultados atuais nem manda
repetir toda a bateria local em ambos os motores antes desses marcos.

### Estimativa original — histórica, substituída para a Wave 135

Os seis grupos antigos eram A **10–26 h**, B **18–48 h**, C/K **5–16 h**,
P0/P1/P2 **14–36 h**, F **10–25 h** e documentação **2–7 h**, somando **59–158
h**. Todos esses intervalos, inclusive o total e a conversão em dias abaixo, são
da auditoria anterior às provas; não são o esforço restante atual.

**Wave 135 até retirada local validada: 59–158 horas ativas** de engenharia
(aproximadamente 8–20 dias de 8 h), confiança **baixa**. Inclui correções,
testes, revisão e F somente depois de autorização e aceites. Era o esforço então
estimado, não duração do workflow anterior nem promessa de calendário.

| Grupo Wave135 restante                                 | Implementação/correção | Testes/provas | Revisão/validação | Total    | Confiança   |
| ------------------------------------------------------ | ---------------------- | ------------- | ----------------- | -------- | ----------- |
| A: SEO testes sensíveis, visual antigo, restos produto | 3–9 h                  | 5–12 h        | 2–5 h             | 10–26 h  | média-baixa |
| B: harness absent, expectativas e contrapartes falhas  | 8–22 h                 | 7–18 h        | 3–8 h             | 18–48 h  | baixa       |
| C/K: revisão publicação, manifestos, scripts e Docker  | 1–5 h                  | 2–7 h         | 2–4 h             | 5–16 h   | média-baixa |
| P0/P1/P2: baterias finais e clone/mutações             | 1–4 h                  | 10–24 h       | 3–8 h             | 14–36 h  | baixa       |
| F: exclusão/reancoragem/limpeza e revalidação          | 4–10 h                 | 4–10 h        | 2–5 h             | 10–25 h  | baixa       |
| Integração docs e checkpoint revisável                 | 1–3 h                  | 0–1 h         | 1–3 h             | 2–7 h    | média       |
| Total Wave135 sem sobreposição deliberada              | 18–53 h                | 28–72 h       | 13–33 h           | 59–158 h | baixa       |

O cenário menor pressupõe falhas localizadas em harness/expectativas; o maior
cobre regressões cruzadas, instalação/clone independente, visual e reparos
revelados pela revisão. Paralelismo ajuda em arquivos disjuntos; não elimina as
rodadas seriadas nem a dependência das provas. Essa era a estimativa a refinar
após B2/B11; foi substituída pelo saldo corrente acima.

**Produto SaaS além da 135 — estimativa não reavaliada integralmente nesta
retomada:** 13 grupos identificados na tabela, com ordem de grandeza de
**250–650 h adicionais**, confiança baixa. É cenário de planejamento, não
orçamento fechado: backoffice, BaaS e aparelhos não tiveram inventário exaustivo
nesta auditoria. S15/S17 e validação mobile podem reutilizar provas da 135; não
somar linhas e baterias mecanicamente. Espera por acordos/credenciais,
homologação e decisões não é estimável em horas de engenharia. O piloto
documentado exige **14 dias de observação**, além de trabalho ativo.

Não existe denominador confiável para percentual geral de conclusão. Os “~60%”
antigos da documentação não foram adotados como estado atual.

## 10. Próxima etapa recomendada

1. Revisar as oito telas antigas da entrada 295, os doze gradientes candidatos à
   equivalência e a prova de visibilidade Dialog/open 390px. Preservar os 372
   registros já aprovados e os artefatos da composição; decidir diferenças por
   fonte/cenário, sem alterar oracle/baseline automaticamente. Captura e
   comparação já concluídas não entram como nova recaptura geral.
2. Manter A10 Slow 3G, Docker e os marcos Git/P2/F explícitos; renovar só provas
   afetadas por alterações posteriores, sem reabrir HTTP/jornadas/T5 fechados.
3. Concluir documentação/proveniência e renovar a atestação após os Markdown. A
   auditoria pré-checkpoint já passou: preservação contabilizada e cleanup
   próprio completo. P0/P1 formais continuam parciais; commit/tag, P2/F e
   produção dependem das pré-condições e da autoridade já descritas.

### Recomendação original — histórica, já superada pela continuidade

O bloco abaixo registra a proposta da auditoria inicial; sua estabilização
B2/B11/SEO/lockfile e as provas HTTP/navegador foram depois realizadas. Não é
uma ordem atual para refazer esse trabalho.

Após autorização, iniciar um bloco de **estabilização da integração da Wave
135**, com um integrador único e sem exclusão:

1. Confirmar novamente branch/HEAD/hashes e processos/trava dos lotes
   interrompidos; recuperar só os próprios recursos, sem matar processos por
   porta/nome.
2. Fechar I01 com Node 24: reconciliar os seis importers do lockfile em ambiente
   controlado, preservando a variante React Native e o grafo existente; provar
   instalação frozen num local isolado sem links para o checkout.
3. Concluir B2/B11: fazer o comparador recusar evidência vazia/incompleta ou de
   perfil errado, terminar expectativas/contrapartes e reproduzir as falhas no
   banco comprovadamente descartável. Preservar cobertura de comportamento e não
   converter falhas em skips/exceções sem justificativa.
4. Fechar a prova SEO I05, A7, visual e contrato OpenAPI C5; integrar os
   docNotes e repetir revisão independente. Corrigir goldens somente depois de
   comprovar equivalência da mudança aprovada.
5. Executar P0 integral nos dois motores, depois tag pré-exclusão autorizada, P1
   sem raiz rodando e P2 em clone limpo sem raiz no disco, com mutações que
   demonstrem sensibilidade. Registrar cada exit/cobertura; não confiar no exit
   do agregador.
6. Apresentar o aceite antes de F e das ações de produção. A missão atual
   termina no diagnóstico; nenhuma implementação foi iniciada por este handoff.

**Próxima tarefa concreta:** recuperar e estabilizar o bloco B2/B11 sobre um
grafo de dependências reproduzível; seu primeiro pré-requisito é fechar o
lockfile I01. A raiz permanece como oráculo até as provas finais.

## 11. Evidências, fontes consultadas e limites

### História primária

- `%USERPROFILE%\.claude\projects\C--Projetos-Locadora-Equipamentos\4ad21d5f-c5f8-406a-a9ff-f4292e9d1296\custom-title.json`:
  título.
- Mesmo projeto, `4ad21d5f-c5f8-406a-a9ff-f4292e9d1296.jsonl`: decisões
  6743/7496/7501/7506/9204/9294–9295; checkpoint 9354–9359; lançamento
  9380–9381; última ferramenta 9563–9564; entrega 9713; quota 9720. SHA-256
  amostrado: `4439aa97986a46aa8eba4b6babc180401521e5f91c645182a9e086b44379a186`.
- `...\subagents\workflows\wf_f0492776-1d5\agent-<ID>.jsonl`:
  implementadores/verificadores da seção 5. B2 últimas ferramentas 1485–1513; C2
  provas de scripts 1042–1047, 16 unitários 1099–1100 e espera final 1207–1208;
  verificador SEO 202–207.
- `AppData\Roaming\Claude\claude-code-sessions\a8cd32df-0ea3-4742-9c98-d95f279d8e2d\eaeddb86-379d-431d-8969-c96f1e6554f5\local_a9278bc7-91ba-4361-8059-83159cad975f.json:1`:
  associação Desktop/CLI e erro. `AppData\Local\Claude\Logs\main.log:6700`:
  confirmação independente do limite.
- `SP\wave135\plano-aposentadoria.md`: §3 lacunas, §5 provas, §6 exclusão, §8
  IDs/dependências e §12 decisões humanas; cinco inventários `inv-*.md`. Plano
  no scratch é fonte de planejamento, não comprovação de execução.
- `SP\lote-A/B/C\*.log` e `tasks\*.output`: testes, builds, mutações e
  interrupções. Exemplo: B `api-full_al.log:11816–11819` documenta a falha
  absent anterior; A `test-api-legacy.log:53–59` contém quatro falhas/exit 1.
- `PARITY\production-{legacy,better-auth}\{meta.json,coverage.json,cases.jsonl,files.jsonl}`:
  últimas capturas completas localizadas, HTTP vermelho e cobertura incompleta.
  Não há registro integral absent correspondente nessa raiz de evidências.

### Checkout e documentação

- `AGENTS.md`, `CLAUDE.md`, `docs/ai/boot.md`, `context-map.md`,
  known-issues/index e `docs/internal/documentation-security-guidelines.md`.
- `docs/architecture/{modernization,multiempresa,adr-saas-subscription,adr-tenant-hosts,adr-backend-extraction}.md`;
  `docs/features/shared-api-host.md`, `tenant-hosts-web.md`,
  `seo-e-medicao-da-vitrine.md`, `equipment-3d-carousel.md`,
  `conta-recebimentos.md`, `ratchet-gates.md` e `tests/visual/README.md`.
- `docs/operations/{runbook-corte-raiz-legada,manifesto-variaveis,gb-site-settings}.md`,
  `docs/guides/shared-api-acceptance.md`, CHANGELOG e configurações CI/hosts.
- Código/testes específicos estão identificados por arquivo/linha na matriz.
  Inventário atual foi produzido pelo `tools/modernization-inventory.mjs` em
  stdout e salvo só fora do repositório; presença de rota não prova
  autorização/paridade.

### Evidência produzida nesta auditoria

Em `AUDIT`: `baseline-worktree.json`, `inventory-current.json`,
`node24-*.log/.json`, `historical-log-summary.json`,
`b11-empty-evidence-probe.log`, `b11-empty-evidence-probe.exit.txt`,
`claude-cli-history-audit.md`, `desktop-findings.md`, `repo-wave135-audit.md`,
decisões/resultados/ferramentas sanitizados em JSON. Probes ficaram no scratch,
sem novos arquivos de produto. Diretórios temporários podem ser removidos pelo
sistema; as constatações essenciais estão incorporadas neste handoff.

**Fatos:** objetos Git, arquivos presentes, resultados/saídas persistidos e
sondas atuais explicitamente identificados. **Inferências:** risco de instalação
frozen diante dos importers divergentes, causa provável de algumas falhas e
estimativas de esforço. **Lacunas:** validade final da árvore atual, todas as
causas das falhas, P0/P1/P2 integral, Docker real, produção, provedores e matriz
completa de aparelhos.

As únicas alterações intencionais desta entrega são este documento e o registro
de auditoria no CHANGELOG. Sem commit, push, deploy, banco/flags de produção,
exclusão do legado ou implementação de funcionalidades.
