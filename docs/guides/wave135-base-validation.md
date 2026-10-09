# Onda 135 — validação local da base da primeira etapa

Este corte de 2026-10-09 registra a evidência local disponível para a primeira
etapa da modernização. A interface atual foi aceita explicitamente pelo usuário.
A publicação da primeira etapa foi autorizada em
`Schlorke/Locadora_de_Equipamentos`, com história limpa, sem publicar os pais ou
referências do repositório antigo. Infraestrutura final e provedores serão
preparados depois; os testes deste corte usam PostgreSQL local descartável e
ambientes controlados.

**Estado deste corte: validação local da primeira etapa concluída.** Captura e
comparação integral de estilos passaram, assim como a exportação native nos dois
motores. Docker Linux, P2 formal e retirada F permanecem pendentes.
Infraestrutura hospedada e provedores serão configurados depois.

O registro estruturado está em
[wave135-base-validation.ledger.json](./wave135-base-validation.ledger.json). Os
caminhos de evidência são relativos ao diretório retido `FINISH`; hashes
identificam os bytes, sem credenciais ou caminhos pessoais. Commit, tag e
publicação permanecem nulos neste corte anterior à criação desses objetos. O
relatório conserva os limites de cada prova.

## Fidelidade e escopo da decisão humana

A aceitação humana preserva a interface existente: markup, CSS, cores,
comportamento e sincronização 3D. Não autoriza fabricar estados, substituir
retornos contratuais por 200, relaxar catracas ou aceitar diferenças futuras em
bloco. A referência aceita tem 80 arquivos/536 seções de estilo; não são 536
testes funcionais nem 536 dispositivos.

`visual-human-acceptance.json` registra a decisão de 2026-10-09 e a composição
BA anterior: 78 páginas e dois catálogos completos,
`captureBuildId=R7kHAAzDS69RA5Yc0oQ1F`. O usuário não informou o BUILD_ID/SHA da
interface que examinou pessoalmente. A referência permanece separada da nova
captura integral e dos critérios de GPU, rede e dispositivo.

Credenciais potencialmente compartilhadas com GB não devem ser revogadas ou
alteradas nesta etapa. A história antiga fica recuperável localmente, sem ser
publicada ou anexada como pai da nova história. A autorização de commit/push não
é evidência de execução: o ledger mantém os campos de publicação/commit/tag sem
um resultado inventado.

## Suites principais: pass, skip e seleção

Os números abaixo são os logs **CURRENT** preservados, não as versões históricas
6199/3983. As suites se sobrepõem; não há soma apresentada como número de testes
únicos do produto.

| Seleção                                    |         Arquivos | Pass |            Skip |  Duração | Evidência FINISH                           |
| ------------------------------------------ | ---------------: | ---: | --------------: | -------: | ------------------------------------------ |
| Unit completa, output autêntico recuperado |         180 pass | 6256 |              13 | 380,64 s | `test-unit.full-recovered.json`            |
| Security completa com DB                   |          33 pass | 1681 |              36 |  97,84 s | `test-security.full.log`                   |
| Complemento security sem DB, bloco focal   |           1 pass |   36 | 44 fora do foco |   9,46 s | `test-security.tenant-conflicts-no-db.log` |
| Identity                                   |          27 pass |  855 |               0 | 177,41 s | `test-identity.full.log`                   |
| Contract                                   |           1 pass |  106 |               0 |  17,79 s | `test-contract.log`                        |
| Platform completa                          |         648 pass | 3771 |               2 | 334,09 s | `test-platform.full.log`                   |
| Mobile                                     |          17 pass |   99 |               0 |  11,63 s | `test-mobile.full.log`                     |
| Web normal                                 | 42 pass + 2 skip |  440 |              16 |  37,28 s | `test-web.full.log`                        |
| Integration                                |          13 pass |   65 |               0 |  88,96 s | `test-integration.log`                     |
| Visual tools                               |           6 pass |  101 |               0 |   5,85 s | `test-visual-tools.log`                    |

A unit completa foi recuperada do output realmente executado, não reexecutada
para reconstruir o log sobrescrito. A evidência identifica sessão
`01a11d65-60c4-78a1-9d5c-758234bb759d`, linha JSONL 10453, timestamp
`2026-10-09T19:15:47.459Z` e SHA do registro. Existe exit 0 do processo terminal
concluído que contém as saídas seriais; **não existe nessa extração um exit
direto separado do Vitest**, e o ledger deixa esse campo nulo. O `test-unit.log`
mais recente é um foco menor, portanto não substitui a prova recuperada da full.

Os demais logs stdout registram suas summaries; campos de exit direto ausentes
não são preenchidos por inferência. O integrador pode vinculá-los aos eventos
reais retidos. Completions/commands que registram exits explicitamente aparecem
nas seções seguintes.

Os skips têm motivos verificáveis:

- **Unit, 13:** seis negativas missing-user de leitura Zoho, seis de mutação e
  um disconnect são exclusivas do braço da raiz. O principal do serviço sempre
  contém userId. O braço legado exercita as negativas; o skip não representa uma
  resposta fabricada ou uma chamada de provedor faltante.
- **Security, 36:** `tenant-request.test.ts` desabilita o bloco de recusa antes
  de qualquer acesso ao DB quando `TEST_DATABASE_URL` existe. O foco
  complementar sem DB executou esses 36; seus 44 skips ficam fora da seleção
  focal, sem constituir uma full security sem DB renovada.
- **Platform, 2:** o bloco de propagação de `Button.web` depende do sentinel
  `EXPECT_PRIMARY`. A execução normal não prova a propagação web; os três níveis
  NOT PROVEN continuam documentados abaixo.
- **Web, 16:** sete casos tenant-hosts e nove journeys são opt-in por
  `TENANT_HOSTS_E2E`/`JOURNEYS_E2E`. Os resultados de runtime ficam separados.
  Coletar um caso ou uma suite pulada não executa seu corpo.

Focos posteriores preservados: os dois testes atuais de gráficos passaram 10
casos (KPI seis, Revenue quatro) em 29,43 s; ScrollReveal/CSS passou 27 em
quatro arquivos em 17,32 s; no-network passou cinco em um arquivo em 379 ms.
Eles documentam alterações localizadas e **não são somados novamente** às fulls.
Platform inclui backend/domain/UI/frontend, e visual-tools testa o
comparador/harness, não a percepção visual da integral.

## P0 local — API compilada e matriz de paridade

As quatro rodadas usam API de produção compilada, fixture/DB descartáveis e
testes HTTP reais. “Com raiz” inicia raiz compilada + serviço; “sem raiz” inicia
somente o serviço, sem usar fallback da raiz. As 64 seleções compartilham a
superfície registrada
`b714d2e790402bfe86ce09c057589cb58da12105dc91f16d03df3674dcdae169`.

| Perfil                         | Arquivos | Pass | Skip |  Duração | Record FINISH                       |
| ------------------------------ | -------: | ---: | ---: | -------: | ----------------------------------- |
| Produção com raiz, legacy      |       64 | 3018 |    2 | 314,97 s | `records-v2-production-legacy`      |
| Produção sem raiz, legacy      |       64 | 2400 |    1 | 141,13 s | `records-v2-absent-legacy`          |
| Produção com raiz, Better Auth |       64 | 3014 |    0 | 257,08 s | `records-v2-production-better-auth` |
| Produção sem raiz, Better Auth |       64 | 2398 |    0 | 138,78 s | `records-v2-absent-better-auth`     |

Cada `completion.json` registra `ok=true`, conclusão final e zero erros não
tratados. O contrato do harness emite a conclusão após cleanup owned e
cobertura. Os skips legacy pertencem à verificação de e-mail em JSON sem
callback, exclusiva de Better Auth, uma vez por host; o redirect legado e seus
efeitos persistidos continuam testados.

Better Auth demonstra sucesso esperado em **164/173 rotas e 207/221 métodos**,
com **14 exceções justificadas**. Legacy demonstra **158/173 rotas e 201/221
métodos**, com **20 exceções**. As exceções são por contrato: catch-all 404,
históricos financeiros imutáveis, Merchant em quarentena, redirects OAuth/boleto
e, no legacy, contratos de identidade/onboarding indisponíveis nesse motor. Elas
estão motivadas em `tests/api-host/route-coverage-exceptions.json` e refletidas
nos records. Não significam que todos os métodos retornam 2xx.

Os records têm `missing=[]`, `problems=[]` e `coverage.ok=true`. Também
conservam 150 registros auxiliares fora da superfície de exports (por exemplo
HEAD/OPTIONS/verbos recusados); estes não ampliam a contagem de rotas/métodos
com sucesso nem viram exceções adicionais.

B11 compara **pares de casos**, não uma nova bateria de testes:

| Motor       | Comparados | Só com raiz, braços legítimos | Só sem raiz | Violações abertas | Evidência             |
| ----------- | ---------: | ----------------------------: | ----------: | ----------------: | --------------------- |
| Better Auth |       2398 |                           616 |           0 |                 0 | `b11-better-auth.log` |
| Legacy      |       2400 |                           618 |           0 |                 0 | `b11-legacy.log`      |

Ambos registram zero violações justificadas. B11 exige evidência não vazia,
perfis/superfície compatíveis e conclusão; não obtém sucesso filtrando apenas os
pass e escondendo falhas. Os pares e braços da raiz não são somados como novos
casos únicos.

## P1 — jornadas, T5/T6 e artefatos compilados

O web Better Auth atual é `T-Qbiffln46vwsFDvOYAW`; o web legacy preservado é
`ets-lpI32e_hYU8NUDtfg`. A API é `90k7TmauECA5RzoPobLhH`; a raiz legacy de
comparação é `2CzG4P9eHamBfh1xt61uW`. Os IDs estão nos records de build do
ledger; não equivalem a uma tag imutável já criada.

| Percurso                                           | Resultado registrado                     | Seleção/limite                                              | Evidência                                             |
| -------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------- |
| Journeys Better Auth, fonte/helper atual           | 8 pass, 1 skip, 102,38 s                 | J7 signup-on executado; signup-off pulado                   | `journeys-better-auth.log`                            |
| Journeys legacy, antes da correção do helper atual | 7 pass, 2 skip, 39,21 s                  | J4 cliente multi-host e J7 signup-on exclusivos de BA       | `journeys-legacy.log`                                 |
| T5/T6 legacy                                       | Sete casos do spec original, spec exit 0 | API/web compilados, DB próprio migrado, HTTP/browser locais | `tenant-hosts-legacy-464b39ca09/completion.json`      |
| T5/T6 Better Auth                                  | Sete casos do spec original, spec exit 0 | Mesmo spec, sem resposta/auth mock                          | `tenant-hosts-better-auth-6cfb1dab11/completion.json` |

A correção J7 atual aguarda o fim da janela real de 60 s de rate-limit
compartilhada pelas jornadas e verifica que os contadores persistidos não foram
alterados. Não limpa/resetta nem desliga o limitador. **Somente Better Auth foi
reexecutado depois dessa correção**; o ledger não transforma o log legacy
anterior em uma nova execução da fonte atual.

T5/T6 preserva o spec original SHA
`a0709536d45877da9953d06ec45aca17d704e8182376a801bdc2792ebf4a305f`, com
`PLATFORM_ENV=development` para hosts HTTP locais e `NODE_ENV=production` para
os builds. Ambos os completions registram cleanup observado, DB/roles não
preservados e nenhum erro. Os filhos servidor encerraram com exit 1 no término
owned Windows; o resultado do spec é exit 0. Não se declara “todos os processos
exit 0”. Estes casos complementam as jornadas de identidade, sem substituir a
prova GPU/device.

O empacotamento em
`p1-packaging-20261009T202430Z-221c69a45e3e41d8b60a290fb75c4673` começou às
20:24:30 UTC e terminou `passed`, com exits explícitos 0 para export mobile e
build Storybook. Há dois bundles Hermes reais (Android/iOS), metadata e catálogo
estático com 172 entradas. São artefatos de compilação, **não 172 testes nem
execução em dispositivo**. O ambiente usou allowlist de sistema, valores
sintéticos, isolamento de leitura `.env` e telemetria desligada.

A exportação mobile desse record é Better Auth. A exportação **legacy também
passou**, em `p1-packaging-20261009T211132Z-6704b2f9743242bd9d2183dd7d237aec`:
começou às 21:11:32 UTC e terminou às 21:13:04 UTC, comandos exit 0, metadata e
dois HBC reais. Storybook é catálogo UI comum; não se duplicam stories por
motor. Warnings ficam retidos. Os hashes dos artefatos dos dois modos constam do
ledger.

## A10 — revisão manual local do carrossel real

`a10-temporal/captures/2026-10-09T20-29-40-600Z/manual-review.json` registra
`passed-local-first-and-subsequent-model-contract` no build BA atual e rede
normal. A revisão examinou quatro imagens integrais de marcos e uma contact
sheet a 4 fps do vídeo real. GPU foi reportada como hardware; 2464 frames
visíveis foram medidos, sem frames/marcos faltantes.

O primeiro Compressor não apresentou fit gradual; a Betoneira seguinte
apresentou fit gradual. Houve **um** context loss bruto, confirmado como
disposal de renderer desconectado, e **zero** perdas inesperadas. O record
confirma fontes inalteradas e recursos owned encerrados. Vídeo e frames têm
hashes no ledger. Esta é uma prova local registrada separadamente da captura de
estilos com movimento reduzido.

Os limites permanecem: HDR neutro sintético e Draco instalado preservam o
caminho local, sem certificar luz/CDN da produção; Slow 3G anterior continua
inconclusivo; mobile físico/Safari e performance dos três modelos não estão
certificados. A revisão A10 não é uma validação de login/sessão ou de todas as
telas.

## Visual integral concluído

Rodada `visual-full-ba-20261009T203607Z-2ff7be773bc64db4a86c04dde480899a`, build
web BA `T-Qbiffln46vwsFDvOYAW`. Captura e guarda de escopo encerraram com exit
0: **80 arquivos, 536 estados**. O comparador oficial executou e passou com
**31065 elementos**, zero diferenças pendentes, zero aprovações usadas, zero
aprovações sobrando e zero problemas. Nenhuma referência ou aprovação foi
alterada.

As portas reservadas foram liberadas; o comando filho encerrou. Os onze
processos descendentes registrados durante a captura já não estavam vivos com a
mesma criação na revisão final. Essa verificação cobre o conjunto observado, sem
afirmar um inventário retroativo de todos os processos históricos. A limitação
Dialog/open 390 foi confirmada na imagem atual: estilos capturados não
demonstram painel visível dentro do viewport.

A guarda verifica os hashes raw da fonte original aceita e a igualdade semântica
estrita do `readCaptureFile` com o baseline materializado pelo writer/formatter.
Só a ordem de propriedades de objetos é representação; arrays, labels,
metadados, seções e estilos literais permanecem iguais. O manifesto externo
registra SHA raw/semânticas, sem alterar referência, aceite ou aprovações.

Sete cenários de conta/entrada do tenant são 404 por contrato em legacy (14
JSON/17 seções). A integral 80/536 pertence à referência BA e não pode ser
simulada em legacy por filtro, adaptação para 200 ou dados fabricados. O
comparador oficial continua literal, com aprovações por propriedade em lista
vazia, e não é um pixel diff nem uma prova de percepção. Dialog/open 390
conserva uma lacuna conhecida de visibilidade no harness; o usuário não alegou
inspeção de todos os estados. Nenhuma reancoragem automática é feita pelo
relatório.

## Gates e dívida declarada

`arch.log` passou a catraca com **43 ocorrências legadas em 16 arquivos** (6
imports profundos, 31 DOM/JSX, 6 libs web), zero acima do baseline. Nos
universais FSD atuais há **zero DOM/JSX, zero imports web e zero escapes de
workspace**. A dívida da raiz permanece explícita até F; arch verde não apaga
esses 43 fatos.

`tokens.log` passou a catraca e manteve `css-important=0`. `check-tokens.log`
corresponde às expectativas, mas conserva **três NOT PROVEN**: resolução de
estilo web, render web e export mobile com token alterado. A prova do alias
temporário e do estilo native não demonstra propagação web; `Button.web` ainda
consome classes literais da paleta. Runtime native não é coberto por esse
script.

`hygiene.log` passou com **811 achados aceitos por 237 itens motivados** de
baseline. Não é higiene sem dívida. Colocation registra 708 testes colocados,
três órfãos permitidos, zero não listados e zero entradas stale. Ratchet guard
registra pass. Os logs de tipos cobrem 14 tsconfigs do workspace mais a raiz;
lint/Stylelint têm saída sem erro, e o índice/links de documentação registra
pass. Exits diretos não presentes nesses stdout ficam nulos no ledger até
ligação aos eventos reais.

As caracterizações puras de gates já pertencem à seleção unit
(`package.json:test:gates` usa a mesma configuração/glob unit). Não foram
reexecutadas ou contabilizadas como uma suite adicional nesta revisão. Tipos,
builds, B11, estados de estilo e frames também não viram “testes funcionais” por
soma.

## Pendências preservadas para a continuidade

- Docker Linux: execução do workflow após primeiro commit limpo/push em main,
  com saúde literal 200, usuário nonroot e somente DB descartável. Revisão de
  YAML/Dockerfile não é execução Linux nem prova de produção.
- P2 formal: cinco sondas reais em quatro classes, com rebuild nos mutantes
  HTTP, falha esperada sensível, restauração byte-hash e rerun positivo. Somente
  no clone independente fixado à tag real de pré-exclusão.
- F: preparar/validar a retirada de raiz e seus consumidores no clone. O payload
  frontend de 23 testes e demais ports preparados não demonstram exclusão
  concluída; não remover o checkout ativo por este relatório.
- Infraestrutura/provedores, produção, Slow 3G conclusivo e dispositivos físicos
  ficam como escopos posteriores, sem alterar credenciais compartilhadas para
  satisfazer testes locais.

A continuidade registra Docker, P2, F e os objetos Git somente após suas
execuções reais. Novos resultados precisam de seleção, perfil, fonte/build,
hashes, exits e limites próprios; o documento não substitui esses eventos por um
resumo geral de sucesso.
