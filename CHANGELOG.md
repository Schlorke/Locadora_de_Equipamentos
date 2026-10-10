# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em
[Keep a Changelog](HTTPS://keepachangelog.com/pt-BR/1.0.0/), e este projeto
adere ao [Versionamento Semântico](HTTPS://semver.org/lang/pt-BR/).

## [Unreleased]

### Organização da referência de tokens — 2026-10-10

- A referência original `design-tokens/base.json` saiu da raiz e passou para
  `packages/design-tokens/src/__tests__/fixtures/base.json`, com conteúdo
  integralmente preservado. Os tokens canônicos continuam no mesmo pacote;
  cores, medidas, estilos e exports do produto permanecem.
- Leitor de paridade, declarações de arquitetura e guardas acompanham o novo
  caminho; uma exceção documental obsoleta foi retirada. Guias e instruções do
  Storybook apontam para os owners atuais, preservando registros históricos.

### CI G e preparação H — 2026-10-10

- A primeira tentativa Linux de G passou os 4.107 testes unitários, mas o job
  terminou RED por erro não capturado `57P01` durante a limpeza forçada de uma
  fixture PostgreSQL exclusiva. Na segunda, a unit passou; a plataforma reprovou
  a leitura do hex canônico com aspas simples. Ambos ficam históricos.
- H prepara correções somente em três testes: gramática hex com aspas pareadas
  em `primitives.test.ts` e espera limitada por zero sessões da fixture antes de
  `DROP DATABASE` simples em `migration-preflight-rls.test.ts`. Valores,
  definição única, assertions de negócio, código produtivo e referências
  permanecem; erros de limpeza continuam reprovando. O bootstrap do primeiro
  caso de e-mail nativo usa act assíncrono antes do clique, mantendo todas as
  verificações de HTML, download autenticado e arquivamento e os timeouts.
- Duas tentativas locais H ficam preservadas: a primeira passou a plataforma e
  falhou em leituras Git de fixtures por TEMP profundo no Windows; a segunda,
  com TEMP curto, encontrou o caso intermitente de bootstrap de e-mail. Sem
  alterar configuração Git, sleep, guardas ou assertions para aceitar falhas.
- Focos, unit/plataforma integrais, controles obrigatórios, formatação dos seis
  arquivos H, OpenAPI estrito e build de produção ainda exigem recibos reais.
  Fechamento no original e CI H são posteriores; nenhum verde ou SHA H é
  antecipado. Receita e limites na continuidade da entrada 341.

### CI F no Linux — 2026-10-10 (correções em validação)

- A execução 38046450904 terminou RED na unit do job `tests`, com três falhas;
  `architecture`, `builds` e `api-docker` passaram. Esse evento fica histórico.
- Correções preparadas: checkout com histórico/tag para o fallback imutável,
  datas locais explícitas na fixture de ofício e estabilização dos três nomes
  internos TypeScript no OpenAPI, com `required` correspondente e recusa de
  colisões. O hook cobre generate, check e watch; comparador e conteúdo público
  continuam estritos.
- O check integral de formatação revelou CRLF normal do checkout Windows;
  `endOfLine: "auto"` conserva esse final de linha sem mudar as demais regras, a
  configuração Git ou os bytes das referências seladas. Nova execução pendente.
- A repetição global ainda aponta 839 arquivos antigos, todos com blob canônico
  igual a F; dívida histórica registrada, sem green global. O check dos arquivos
  desta entrega e todos os controles obrigatórios do plano seguem exigidos.
- O teste colocado do normalizador, focos sob UTC/America/Sao_Paulo, geração
  real, unit e gates afetados ainda exigem validação. A aprovação do CI Linux
  posterior terá recibo externo; nenhum resultado verde é antecipado. Causa,
  arquivos e receita na entrada 341 de `docs/issues/known-issues.md`.

### Fechamento de código no clone — 2026-10-10

Nova unit 4.104/4.104 em 179 arquivos, sem skips, exit 0, em 406,99 s.
Fechamento 1003: três passos exit 0, 12 gates, 324 regressões em 14 arquivos e
13 casos OpenAPI. Os checkpoints RED/pending abaixo ficam históricos; recibos e
hashes atuais estão no guia F e ledger.

Aplicação, formatação e gates afetados deste complemento ainda terão recibo
próprio. Validação no diretório original, publicação F e CI F são posteriores,
em recibos externos; nenhum SHA F é antecipado.

### Checkpoint pós-aplicação da base após F — 2026-10-10 (fechamento em curso)

- Coorte documental V7 aplicada e formatada. A rodada posterior dos gates
  terminou RED: `check:tokens` não reconheceu o literal com aspas simples,
  embora a cor canônica continuasse `#ea580c`.
- Correção mínima aplicada ao leitor para aceitar aspas simples ou duplas com
  fechamento correspondente e extrair o hex pelo grupo 2. Definição única,
  sentinela temporária, integridade e expectativas permanecem estritas; estilos,
  oracle e baselines conservam seus valores.
- Gate real posterior passou exit 0 em 5,20 s observados pelo executor:
  arquivo/árvore canônicos intactos, alias aplicado e propagação nativa
  conferidos. A assertion web esperada e os três NOT_PROVEN permanecem.
  Regressões existentes e fechamento global posterior ainda pendentes.
- Full unit posterior terminou RED: 4.103 passes/uma falha em 179 arquivos,
  391,15 s e exit 1. Quatro referências históricas foram interpretadas como
  estrutura vigente. Legendas factuais de aposentadoria preparadas no handoff,
  guia e ledger, mantendo trechos históricos e detector intactos. Nova full unit
  e fechamento global ainda pendentes.

- Este checkpoint conserva o bloco de 2026-10-09 e o RED anterior. Não antecipa
  commit/push F ou CI final.

### Checkpoint pré-publicação da base preparada após F — 2026-10-09

- Unit final integral 4.104/4.104 em 179 arquivos, sem skips; P2 v6 e B11 v3
  scoped e visual F 80/536/31.065 fechados. Rodadas RED e raw verdicts
  permanecem históricos, separados dos eventos posteriores.
- B11 comparou 2.400 casos legacy e 2.398 Better Auth, sem violações abertas ou
  novas justificativas; exceções de cobertura existentes continuam declaradas.
  Gates documentais após aplicar a coorte. Commit/push,
  transferência/revalidação e CI final F terão recibos posteriores; nenhum SHA
  próprio ou publicação é antecipado neste checkpoint.
- Receitas/ponteiros usam os owners atuais. testing.md recebe LF por CRLF→LF
  explícito, preservando o conteúdo histórico; C e 25 .source selados mantêm
  seus registros/bytes. Hygiene 173 continua dívida declarada.
- Dispositivos, Slow 3G completo e foundations NOT_PROVEN não são promovidos por
  esses resultados. Infraestrutura hospedada, DB produção e provedores serão
  escolhidos depois conforme o usuário; migrations locais não homologam conta ou
  banco de produção.

### Preparação pós-F — 2026-10-09 (validação em curso)

- Corrigidos consumidores de teste da composição canônica, preservando
  cancelamento M31, portas reais de Zoho, wrapper NextAuth e controles de
  segurança. Quatro comparações redundantes com a raiz retirada foram encerradas
  com a evidência anterior; nenhum serviço foi comparado consigo mesmo.
- Inventário da arquitetura exige ausência das sete raízes retiradas e preserva
  assets/tokens/shim. O leitor de referências distingue ponto final de extensão
  `.map`; comentários e documentação identificam cada histórico ou fixture, sem
  novos ignores.
- Gerador manual Tailwind usa quatro blobs canônicos verificados, independentes
  do histórico privado, e saída externa para revisão. A referência visual e o
  algoritmo de comparação permanecem os mesmos.
- CI usa mirrors públicos das mesmas imagens oficiais com digest fixo. O
  candidato pré-F passou no Linux com saúde HTTP 200 e uid 1000; a publicação
  final precisa de prova própria.
- Seis dependências sem consumidor saíram do importer da raiz. O lockfile
  conserva todo o grafo restante; a tentativa de resolução que alterava peers
  foi rejeitada e a instalação offline travada passou.

### Casa preparada: retirada dos atalhos antigos de banco

- Retirada no Bloco F da família avulsa de RLS/Supabase e do atalho db:push:26
  arquivos e18 comandos, conforme inventário revisado. Policies/schema continuam
  em migrations; geração do cliente e operações atuais com runbook são
  preservadas.
- Retiradas somente12 allowances dos arquivos excluídos e a exceção
  safe-postinstall, mantendo todas as asserções do detector. Cinco guias
  conservam os procedimentos antigos como históricos e apontam comandos atuais.
- Nenhum banco, volume, integração, template, credencial ou ambiente de produção
  foi alterado por esta retirada. Validação do clone e do corte registrada
  separadamente.
- Retirada física local protegida por guards de caminhos exatos, hashes, backup
  e preservação dos hosts/Prisma/types; teste de artefatos aposentados mantém31
  expectativas anteriores e distingue roots antigos de src/app. Aplicação não
  declara P2/F verde.

### Revisão e fechamento da base — 2026-10-09

- Aceite humano da interface registrado; referência visual existente ancorada
  com 80 arquivos/536 estados e preservação da referência anterior fora do
  repositório. Isso não certifica aparelhos, provedores ou o recorte Slow 3G.
- Removidas execução tributária integral duplicada, segunda coleta de upload e
  simulação redundante de resposta. Schemas puros executam na suíte unitária;
  limites de multa e persistência real têm gabaritos monetários explícitos.
- Retirados widgets de categorias sem uso, exports redundantes e helper de
  período alcançado só por teste. As três variantes do bloco de preço agora têm
  valores e ordem de exibição conferidos pela renderização real.
- Comparador e writer visual recusam captura vazia e regravação parcial antes de
  alterar a referência. Contratos e ferramentas visuais entram em `test:all`;
  platform/contract bloqueiam rede externa por padrão.
- Código DOM e bibliotecas de navegador separados em variantes web; contratos
  puros e APIs nativas preservados. Validação integral das fronteiras em curso.
- Verificação manual da imagem API em CI preparada, sem deploy. Crons externos
  exigem o repositório do produto e ativação explícita; ficam inativos enquanto
  os serviços deste produto não forem configurados.
- Bootstrap do CI compatível com uma história inicial limpa; quatro fixtures Git
  reais protegem a comparação com o pai nos commits seguintes.
- Cores dos gráficos e camada interna das abas passam pelos tokens existentes,
  com os mesmos valores e conferência por renderização e compilação CSS. O
  inventário de cores valida a paleta usada sem exigir cores desnecessárias.
- Configuração local herdada isolada em cópia privada verificada; histórico
  anterior preservado em bundle local antes da publicação com história limpa.
  Nenhuma credencial ou integração remota do GB-Locações foi alterada. Clone e
  indicadores do README apontam para o repositório deste produto.
- Jornada de cadastro aguarda a janela real de autenticação após cenários
  independentes que compartilham loopback, sem zerar contadores ou afrouxar os
  limites de produção; mantém a recusa imediata diante de resposta 429.

### Continuidade da onda 135 — 2026-10-08, sem commit

- Backlog/estimativas do handoff atualizados após as provas fechadas: saldo
  local conhecido 4,5–18 h ativas (triagem/aceite visual, A10 e fechamento);
  Docker 1–4 h após desbloqueio; Git/P2/F 18,5–46 h condicionados à
  autorização/aceites. Total condicionado 24–68 h, confiança baixa, sem espera
  externa ou reparos desconhecidos. Os antigos 59–158 h e estados
  pré-continuidade ficaram históricos. HTTP v2, jornadas e T5/T6 conservam os
  resultados; visual/A10 Slow 3G, Docker e marcos formais continuam abertos.
  Nenhum percentual de conclusão ou autorização de retirada.
- Reconciliadas as seis dependências dos workspaces no lockfile, preservando
  versões/snapshots e a variante do React Native. Instalação travada offline e
  builds de produção da raiz, API e web passaram em Node 24.21.0.
- A4: os testes chamam os metadados das nove páginas da vitrine para duas
  locadoras. SEO/home 29/29; onze regressões deliberadas detectadas e fontes
  restaurados por bytes/hash.
- B11: registros vazios, incompletos, falhos ou de perfis/superfícies diferentes
  deixam de certificar equivalência. Conclusão pelo estado final do Vitest,
  depois da limpeza/cobertura; a matriz HTTP v2 dos quatro perfis passou.
- O hash B11 também cobre helpers, configuração e SQL da fixture; C2 separa
  checkout pré-tag de snapshot Git imutável, com pinning, falha explícita para
  ref inválida e limpeza própria. C2/materialização passou 51 casos; B11, 74.
- Restaurada uma classe híbrida inválida do texto de ajuda em Configurações;
  produção confirmou cor, fonte e entrelinha nos dois tamanhos de tela,
  preservando tokens e baselines. Sitemap usa Map com os mesmos ranks para
  respeitar o inventário de segurança, sem ampliar suas permissões.
- Restauradas trinta classes em sete fontes de Configurações/WhatsApp conforme a
  decisão de manter sRGB e medidas em px. O comparador preserva a diferença de
  interpolação Oklab; paridade 27/27, sem regravar fixture ou baseline.
- P1: bundles Android/iOS e Storybook estático gerados em scratch com Node
  24.21.0 e ambiente sintético; seis artefatos com SHA-256 conferidos e 172
  entradas (156 stories e dezesseis docs). Aparelhos e aceite visual pendentes.
- B11: labels semânticos em doze tabelas de dez testes e recusa de unicidade no
  host corrente preservam cenários/expectativas sem relaxar o comparador. Matriz
  v2: production/legacy 3.018 aprovados + dois skips; absent/legacy 2.400 + um;
  production/better-auth 3.014 e absent/better-auth 2.398, sem skips, 64
  arquivos em cada rodada. Comparações finais aceitaram 2.400/2.398 casos, com
  zero violações abertas; os 618/616 exclusivos com raiz são braços legados
  previstos.
- URL interna NextAuth sintética explícita corrige falha SSR do harness por
  string vazia. A rodada legacy ampliada passou sete casos e dois skips em nove;
  J1 visitante confirmou orçamento DELIVERY Standard de 230 e carrinho limpo
  após reload. Uma rodada legacy anterior passou sete casos, com dois skips, em
  50,84s. A primeira rodada Better Auth teve cinco passes, três falhas de
  expectativa J1/J4/J7 e um skip; esse resultado permanece histórico.
- Jornadas Better Auth finais passaram oito casos e um skip contratual em nove,
  em 84,77s, no web `r2B-vsczGQAqwkg72XsRq`. J1 observa item/controles/valores
  atomicamente, preservando provas remotas/DB/orçamento/outbox e total 230; J4
  confere o menu antes/depois de reload; J7 exige login e sessão reais,
  confirmação e criação/checklist. Polling de login limitado a 500ms/30s, falha
  imediata em não-200, sem mudar limiter. Diagnóstico passivo final: 96 GETs de
  sessão, todos 200; 429 antigo observado não prova a causa de outra falha de
  UI. Aceite visual ainda em validação.
- Jornadas legacy finais passaram sete casos e dois skips contratuais em nove,
  em 32,56s, no web `qUsWUvj6ANYgIJAuWlNLR`, na mesma fonte final do teste
  Better Auth. J1 visitante preserva item 200 + frete 30 = 230, um orçamento e
  carrinho vazio após reload. Web Better Auth recompilado como
  `R7kHAAzDS69RA5Yc0oQ1F` para o visual, com fonte de produto preservada; a
  prova anterior 8/1 continua atribuída ao build `r2B-vsczGQAqwkg72XsRq`.
- T5/T6 passou a especificação original nos dois modos: legacy 7/7 em 5,85s e
  Better Auth 7/7 em 5,86s, sem skips. No Better Auth, web
  `r2B-vsczGQAqwkg72XsRq`, zero erros de página/captura e limpeza certificada
  sem banco/papéis preservados. Prova local de hosts, isolamento, catálogo,
  detalhe e navegação; não certifica jornadas de identidade ou carrossel 3D.
- Captura visual Better Auth full-v4: 80 casos passaram em 747,728s, com
  catálogos inicialmente só em `base`. Após corrigir filtro/guard, recaptura
  separada passou dois casos em 20,4min. Composição executada: 80 JSONs, 536
  estados e 536 capturas (78 páginas/162 estados + dois catálogos/374), contra
  528 estados da baseline mais oito de Configurações documentados. Manifesto
  conserva origens/SHA por arquivo e ambos os reports; zero erros de página/rede
  pendente/APIs sem mapeamento/esperas instáveis/arquivos novos, ausentes ou
  obsoletos nos artefatos selecionados. Ferramentas 93/93 em seis arquivos,
  tipos 0/0 e lint focado verde. Comparador exit 1: 16.272 registros pendentes e
  372 já aprovados, de propriedades/presença, sem comparar pixels. Triagem
  registrada abaixo; inspeção/aceite visual continuam abertos. Não é execução
  integral única nem repetibilidade; produto/build/fixtures/ preparação/baseline
  preservados. P0/P1 parciais e P2/F abertos; auditoria pré-checkpoint aprovada,
  com renovação após os docs; sem commit, push, retirada ou produção.

- Triagem visual: 16.260 registros nas oito telas antigas da entrada 295; doze
  restantes são serializações de gradiente `to right`/`90deg`, com as mesmas
  três cores/stops (quatro acesso recuperar/reset, dois equipamento- editar A9,
  seis vitrine-detalhe). Equivalência semântica candidata, sem nova aprovação ou
  mudança de oracle/baseline; comparador literal conserva exit 1. Demais
  cenários A9 revisados sem outra pendência. Dialog/open 390px atual e f1/f2 são
  byte/SHA idênticos (`CB4A7E…`, 13.975 bytes), mesma árvore de 25
  elementos/CSS: gap preexistente, sem regressão comprovada; posicionamento/
  causa e prova de visibilidade seguem em diagnóstico. Aceite visual aberto.
- Auditoria executada antes do fechamento documental:
  `final-audit-before-checkpoint/audit.json`, exit 0, 478 entradas
  contabilizadas (408 bytes iguais, 68 alteradas no escopo, dois D
  preexistentes), zero perda/ exclusão nova/staging; 506 dirty/31 adições e três
  retornos conhecidos ao HEAD em fontes de paridade. HEAD 873d8fbc/`.expo`
  preservados, cleanup completo, zero recursos próprios pendentes/não
  confirmados e nenhum problema de auditoria. PostgreSQL próprio parado exit
  0/dados preservados. Atestação será renovada pelo coordenador após estes
  Markdown. Arch/tokens/nomes/CSS/higiene, lint global e tipagem ampla (14
  tarefas) terminaram exit 0.
- Sonda diagnóstica Dialog: um caso/quatro células em wrapper de 13,4s, zero
  erros/ APIs sem mapeamento/rede pendente, child exit 0/portas próprias livres.
  Após scroll ao marcador, VisualViewport 390×844 em [32,422]×[480,1324] fica
  fora da caixa x591,406/y1350,406/w377,188/h675,188 nas quatro condições de
  relógio/ screenshot. Origem de inner 1560×3376 aberta; explica limitação de
  captura, sem certificar usabilidade nem ausência universal de defeito.
  Produto/spec/ baseline/oracle preservados; análise em
  `dialog-geometry-readonly-analysis.md`.

- A10/loader: percentual de carregamento no DOM React irmão do Canvas, sem root
  Html adicional dentro de Suspense; resolução vinculada à URL atual
  (`loadedUrl === url`). Apresentação, fit, evento ScrollReveal, espera de
  200ms, timers e rotação preservados. Caracterização 5/5 e tipagem focada sem
  diagnósticos; fonte original falhou em dois casos, e a restauração por hash
  voltou a 5/5. Builds legacy da web/raiz renovados e verdes; o backend mantém o
  build aplicável da API. Prova normal local em GPU real, no web Better Auth,
  passou sem erros de página/probe, com cinco marcos, Compressor sem fit
  sustentado e Betoneira positiva; revisão de 354 quadros/14,16s. Slow 3G sem
  erros de página/perdas ativas, mas Betoneira ausente em 150s: inconclusivo.
  P1/A10 parcial, com HDR neutro/Draco local/backend de fixture; sem certificar
  CDN, iluminação ou infraestrutura real, sem fechar universalmente 167/321 ou
  aprovar baseline visual.
- B2/B3: expectativas explícitas de fixtures e cobertura consolidadas na matriz
  HTTP v2, sem ampliar a regra de sucesso: 201/221 métodos + vinte exceções no
  legacy e 207/221 + quatorze no Better Auth. Caracterizações HTML mantêm os
  goldens históricos e traduzem só a grafia aprovada `flex-shrink-0` para
  `shrink-0` ao comparar a referência.
- M8: revisão limitada concluída das políticas compiladas, chamadas próprias e
  runtime production/legacy. As ocorrências de substring eram mensagens SQL
  sintéticas, sem vazamento de credencial demonstrado; nenhuma política de logs
  mudou. M7 formal, aceite P0/P1/P2 e aposentadoria da raiz continuam pendentes.

### Recuperação de contexto Claude → Codex — 2026-10-08, sem commit

- `CLAUDE_TO_CODEX_HANDOFF.md` reconstrói a sessão e o workflow da onda 135,
  confronta histórico, checkout e provas, e registra backlog, bloqueios e
  estimativas. Seis gates estáticos passaram em Node 24; o aceite consolidado da
  onda permanece pendente. Nenhuma funcionalidade, produção ou legado foi
  alterado pela auditoria.

### Classes canônicas do Tailwind que não mudam o valor — 2026-10-08, sem commit

- `flex-shrink-0` passou a `shrink-0` no produto (213 ocorrências). Os dois
  nomes já estavam na prova visual com o mesmo `flex-shrink: 0`.
- No preview do carrossel do hero, `inset-[-0.5rem]` passou a `-inset-2` (os
  dois valem −0,5rem). `bg-gradient-to-*`, `max-w-[200px]` e `min-h-[180px]`
  ficam: o nome novo do degradê interpola em oklab, e a escala numerada é rem
  (muda com a fonte do navegador em 20px).
- O editor deixa de analisar `.tmp/` no Tailwind. O CSS compilado de
  modernização em `.tmp/modernization/styles/compiled.css` repetia esses
  seletores e enchia o painel de Problems.

### Conta de recebimentos com faturamento exato, conteúdo e textos legais por locadora — onda 134 (2026-10-07, sem commit)

Decisões do dono de 2026-10-06 e 2026-10-07 (ADR SaaS B.18 e B.8; ADR de hosts
U5).

#### Adicionado

- Conta de recebimentos (S9): o dono pede a criação em `/admin/recebimentos` com
  o faturamento mensal exato (string com duas casas, sem mínimo nem teto), o
  celular e a confirmação dos dados da empresa; a conexão de conta própria
  continua oferecida logo abaixo (D-1).
  `GET`/`POST /api/admin/payment-account/create` nos dois hosts, com a mesma
  composição, respondem 202 sem chamar o provedor. Exige primeira mensalidade
  paga, aviso do parceiro aceito pelo dono atual e o módulo `onlinePayments` no
  plano (D-4). Desligada por padrão (`PLATFORM_SUBACCOUNT_CREATION` ausente vale
  `off`).
- Worker `payment-accounts.provisioning`: busca por CNPJ antes de criar,
  intenção durável sob lock do CNPJ com a inspeção já na fila, um único
  `POST /accounts`, chave selada na primeira transação depois da resposta (1 + 3
  tentativas; depois `KEY_RECOVERY_REQUIRED` sem segredo). Resultado incerto
  nunca repete o POST; recusa definitiva sem conta volta ao dono com o motivo
  (D-3); faturamento e celular são apagados em todo desfecho (D-2). Tabela de
  pedido só da plataforma (migration `202610060101`, FORCE RLS, purga única) e
  saída de `payment_accounts.incomeRange` com preflight que enxerga todas as
  linhas sob FORCE RLS.
- Saúde da subconta selada e barreira de emissão: integração `ACTIVE` só na
  primeira aprovação completa; cobrança nova (PIX, boleto e boleto manual de
  orçamento) recebe 409 `PAYMENT_ACCOUNT_NOT_READY` enquanto a subconta não está
  aprovada. Runbook `docs/operations/runbook-asaas-subaccount.md`.
- Conteúdo da vitrine por locadora: `settings.siteContent` (anos, frota,
  clientes, projetos, cidades, construtoras, história, linha do tempo, destaques
  do rodapé, local da loja, Merchant Center, nota só com fonte e os 11
  compromissos comerciais, desligados por padrão) e Termos, Privacidade e
  Devolução como documentos da locadora (migration `202610060201`). Leitura
  pública aditiva e rotas do documento e do painel nos dois hosts; publicação
  auditada só com hash.
- Painel (web e app): Horário de Funcionamento, Conteúdo do Site, "O que você
  garante" (compromissos com as frases exatas e o aviso do CDC, art. 30) e
  Textos Legais.

#### Alterado

- Vitrine web e app mostram conteúdo e compromissos só com o dado da própria
  locadora; a nota de avaliações nunca vai para o JSON-LD (D-A). Páginas legais
  mostram o documento publicado pela locadora; sem Termos publicados, o
  orçamento segue sem a caixa de aceite (D-C).
- Pausa (S13): as páginas legais continuam no ar (200, `noindex`, `no-store`) na
  moldura neutra; em RESTRICTED o painel só aceita editar e retirar os textos
  legais (D-D).
- Script da GB: grava conteúdo e textos uma vez por campo (auditoria
  `GB_SITE_SETTINGS_APPLIED`, só nomes); rodar de novo não desfaz o que o dono
  mudou. Frota (D-B) e nota com fonte (D-A) ficam para o dono preencher no
  painel; a linha de base visual registra a GB sem elas.

#### Corrigido

- A aprovação completa de uma conta gravava `documentVerifiedAt` sem
  `documentNormalized`: em organização legada (CHECK 23514) ou com CNPJ já
  verificado por outra locadora (índice único 23505) a confirmação inteira era
  desfeita a cada inspeção. Agora grava o documento normalizado junto e, com o
  CNPJ de outra locadora, confirma sem verificar e audita
  `payment-account.document.in-use` uma vez.
- Recebimentos: o aviso "Pedido recebido" sai quando o pedido é devolvido na
  mesma sessão; na corrida de duas confirmações com o mesmo CNPJ, a conta
  conectada perdedora registra o código da própria falha, não
  `WEBHOOK_CREATE_UNKNOWN`.
- Vitrine: o hero volta a mostrar o telefone e o WhatsApp da locadora desde o
  SSR (antes, toda locadora, inclusive a GB, via um "|" sozinho); hero,
  cabeçalho, contato, "Por que escolher" e Sobre mostram só os números
  informados, com " | " apenas entre os dois, e no celular o WhatsApp ou, sem
  ele, o telefone. Com os dois números, a marcação é a da produção.

#### Testes

- Corrida de catálogo (XX000 "tuple concurrently updated"): GRANT, REVOKE, DROP
  OWNED, DROP ROLE e scripts de papel no banco de teste compartilhado passam por
  `tests/helpers/shared-acl.ts`, com gate `tests/unit/shared-acl.gate.test.ts`.
- Teste "two configuration workers" determinístico; `onboarding-database`
  independente da data real; prazos explícitos medidos nos testes de ESLint e de
  `retired-artifacts`; testes nativos do frontend e do ui entram no
  `pnpm typecheck` com a resolução nativa.
- `pnpm hygiene` verde: saiu o contrato de erros do cadastro sem consumidor
  (`OnboardingError` e cadeia) e os tipos só de teste, com as entradas da linha
  de base.
- Provas com o dublê do Asaas, PostgreSQL com os papéis canônicos e o proxy
  compilado nos dois hosts e nos dois motores; mutações com restauro por sha256.

### CNPJ e horário na vitrine, sigla da locadora e Origin nas leituras de conta — onda 133 (2026-10-06, sem commit)

- Vitrine: rodapé, contato da home e página de contato voltam a mostrar horário
  de funcionamento e CNPJ (Decreto 7.962/2013, art. 2º, I e II), lidos das
  configurações e da organização da própria locadora; locadora sem dado não
  mostra a linha. `GET /api/settings/public` ganhou `businessHours` e
  `legalIdentity` nos dois hosts (aditivo; nunca CPF nem documento cru).
- Script de corte da GB: a trava do `--apply` confere o mesmo CNPJ que a vitrine
  mostra (o normalizado antes do legado); antes, o legado da GB com o
  normalizado de outra empresa liberava a gravação.
- Telas de recuperar e redefinir senha (web e app) mostram a sigla da própria
  locadora, não mais "GB"; a prévia SEO do painel perdeu a nota e a contagem de
  avaliações inventadas.
- `pnpm tokens` verde: selos de estado da logística e da manutenção e fundo do
  painel em tokens semânticos (`--status-*`, `--surface-admin-canvas`) com os
  mesmos valores da paleta da produção.
- Segurança: `/api/auth/organizations`, `/organizations/current`, o GET de
  `/organizations/selection`, os GET do Better Auth e os GET do NextAuth
  (`session`, `csrf`, `providers` e demais leituras) recusam, nos dois hosts,
  Origin de locadora irmã, do painel num host de locadora ou `null` (403
  `Origem não permitida`, sem Set-Cookie). Sem Origin ou com a própria origem
  nada muda; as navegações de OAuth, oauth-proxy, app e links de e-mail ficam de
  fora. Regra única dos dois motores em `engine-read-origin.ts`.
- Testes: T12 pega a sigla "GB" como marca e notas/contagens fixas de
  avaliações; `account-read-origin`, `identity-read-origin` e
  `nextauth-read-origin` (356 casos nas rotas reais dos dois hosts); os testes
  de ponta a ponta do `hygiene-check` e do `ratchet-guard` (git e knip reais)
  ganharam prazo explícito de 60 s, medido (até 11,5 s isolados; passavam dos 20
  s sob a carga do `pnpm test:unit` completo).

### Vitrine só com dados da locadora e Origin nas leituras — onda 132 (2026-10-06, sem commit)

- Vitrine: página de pausa com moldura neutra (marca, aviso com contato e área
  do cliente, rodapé mínimo), sem navegação para catálogo, orçamento ou
  carrinho; o 503 continua.
- Multiempresa (T12): saíram do código os dados e fatos da GB (nome, CNPJ,
  endereço, telefones, WhatsApp, redes, Merchant ID, mapa, região, construtoras,
  anos de mercado, números e nota fixa de avaliações); a identidade vem do
  cartão da própria locadora e o que falta fica de fora. O formulário de
  configurações não grava mais dados da GB em outra locadora.
- `tools/gb-site-settings.mjs` (simulação por padrão, `--apply` explícito, só
  preenche campo vazio, só na organização com o CNPJ da GB) e runbook
  `docs/operations/gb-site-settings.md` para o corte da GB.
- Segurança: o principal privado comum dos dois hosts recusa GET/HEAD com Origin
  de locadora irmã, do painel num host de locadora ou `null` (403
  `Origem não permitida`); sem Origin a leitura segue.
- Testes: guarda do banco descartável lê PGHOST/PGPORT/PGDATABASE/PGUSER como o
  driver pg; servidor de integração sem segredos dos `.env`; catraca de paleta
  conta `var()`, `theme()` e `--theme()` de paleta; prazos explícitos medidos
  nos casos pesados; `@source not` para o código só de servidor do host web.

### Estabilização das suítes — onda 131 (2026-10-06, sem commit)

- Segurança: leituras administrativas de badges e WhatsApp voltam a recusar GET
  com Origin de locadora irmã nos dois hosts (regressão herdada da onda 97,
  padrão da entrada 285, `rejectExplicitCrossOrigin`).
- `pnpm test:api` exige um worker (o global-setup recusa mais) e o perfil
  oficial é o do CI: hosts compilados em produção nos dois motores de
  autenticação. O webhook de locadora suspensa fica adiado sem efeito, conforme
  a onda 89.
- Integração: a guarda do banco descartável aceita o valor que o próprio setup
  gravou (`applyTestDatabase`) e continua recusando DATABASE_URL/DIRECT_URL real
  igual ao de teste; `pnpm test:integration` voltou a 81/81.
- Fixture de reativação com data de venda fixa (o relógio real a tornava
  "futura"), dublê da inbox com a trava administrativa, mock parcial do Prisma
  Client e preflight da migration 0110 (não implantada) com a recuperação
  Prisma.
- Plataforma, web e paridade visual verdes: contrato de cadastro sem nome de
  global do navegador, `useNavigate` classificado, chamadas do menu do painel
  documentadas como só do painel (allowlist intocada) e paridade do tom da
  paleta por variável.
- Validação em série no perfil do CI: gates, builds, integração 81/81, API
  2.851/2.845 e demais suítes verdes; três casos estouram tempo só sob carga
  (tratados na onda 132). Sem baseline, allowlist ou flag nova.

### Site por estado e jobs de divulgação — onda 130 (2026-10-06, sem commit)

- Vitrine LIVE, PAUSED ou OFF por regra única do domínio (`decidirModoDoSite`),
  aplicada pelo resolvedor público dos dois hosts. Em pausa: 503 `SITE_PAUSED`
  com Retry-After e noindex no catálogo, busca, disponibilidade, orçamento e
  contato; cartão, configurações e área do cliente continuam.
- Host web: página de pausa neutra com contato e área do cliente e 503 real pelo
  proxy; noindex até a 1ª fatura paga; `robots.txt` e `sitemap.xml` por estado;
  OFF com o 404 do D10. Web e Expo mostram a mensagem neutra do 503.
- Jobs de tenant declaram obrigação ou divulgação no runner único; com a
  fiscalização on, divulgação pula SETUP, RESTRICTED e ARCHIVED; obrigação nunca
  é pulada; agenda de cron tudo ou nada.
- Provas focadas, 41 mutações mortas, 70 verificações HTTP locais e os três
  builds passaram. Sem migration, grant, baseline ou flag nova; sem commit, push
  ou produção. A validação consolidada abriu a onda 131 de estabilização.

### Consulta de criação incerta — onda 129 (2026-10-05, sem commit)

- Consumer de subconta UNKNOWN no scheduler existente, compartilhado pelos
  hosts; consulta root por CNPJ/referência, sem repetir POST ou aprovar conta.
- Lease, binding, dono/chave e auditoria atômica protegem recuperação manual.
  Transporte de criação preparado/testado; coleta de faturamento depende da
  decisão humana e criação completa não foi instalada neste bloco.
- 280 provas focadas, tipos/gates e builds API/legado passaram. Duas tolerâncias
  obsoletas de higiene encolheram por consumo real. Legado/flags reais
  preservados; sem commit, push, produção ou provedor real.

### Nova fotografia de recebimentos — onda 128 (2026-10-05, sem commit)

- Pedido confirmado depois da conclusão cria novo incidente auditado, mantendo
  histórico e consultando novamente pagamentos. Conferência incompleta mantém
  cursor; agenda PENDING, backoff e leases são preservados.
- Recibo tardio de incidente substituído é recusado. Painel explica agenda e
  histórico; runbook separa conferência financeira da retomada operacional.
- Provas consolidadas em shared-api-host.md, onda 128. Legado, grants, baselines
  e flags reais preservados; sem operação real, commit ou push.

### Recuperação guiada de recebimentos — onda 127 (2026-10-05, sem commit)

- GET/POST privados compartilhados de recovery e painel com confirmação
  explícita; sessão recente, dono e escopo revalidados.
- Recibos de progresso/bloqueio vinculados ao incidente e à chave atuais, sem
  segredos. Pedido usa o job existente e conserva espera/travas, sem retomar
  fila, chamar provedor no HTTP ou aprovar pagamentos.
- Resultados consolidados e limites em shared-api-host.md, onda 127. Legado,
  scheduler, flags reais, grants e baselines preservados; sem commit ou push.

### Aceite local do dono pelo proxy — onda 126 (2026-10-05, sem commit)

- Fixture HTTP com banco descartável migrado, scripts canônicos dos papéis,
  sessões reais e provedor sintético local. Serviço usa o entrypoint standalone.
- Aceite 202 persiste conta, cifra e auditoria mantendo restrição. Repetição,
  seleção por cookie, CNPJ, ownership, origem e RLS são verificados nos dois
  backends/motores: 38 casos por motor, mais 32 unitários associados.
- Tipos dos arquivos novos e lint afetado passaram. Sem alteração de código de
  produção, flags, grants existentes, baselines ou legado. Homologação Asaas e
  aprovação comercial continuam pendentes; sem commit ou push.

### Prova HTTP da conexão — onda 125 (2026-10-05, sem commit)

- Diagnóstico da sonda anterior: fetch do Node substituía Host e preservava
  Origin. A prova agora usa o helper HTTP existente, sem alterar proxy/CSRF.
- Proxy real para ambos os backends conserva recusa privada sem sessão,
  isolamento de origem e papel da locadora nos dois motores: vinte casos em cada
  motor, mais dezessete unitários. Tipos/lint/gates afetados passaram.
- Aceite 202 do dono pelo proxy e homologação Asaas continuam pendentes. API
  legada, flags, baselines e produção preservadas; sem commit ou push.

### Formulário de conta própria — onda 124 (2026-10-05, sem commit)

- Recebimentos oferece conexão inicial depois de confirmar ausência da conta,
  usando o POST existente. Conta atual não ganha substituição de chave.
- Campo mascarado e efêmero é apagado antes do envio, no cancelamento e na
  mudança de escopo/saída da página. Não entra em URL, storage ou retry.
- Aceite 202 relê o estado sem presumir aprovação. Falha incerta permite
  consulta, sem reenvio automático; mensagens conhecidas não ecoam segredos.
- 228 testes focados, tipos/gates e builds web/legado passaram. Interface
  compilada em Chromium usa fixtures. A prova HTTP pelo proxy ainda falha com
  403 de origem em vez de 401; integração completa não certificada. Legado,
  flags e produção preservados; sem commit ou push.

### Recuperação financeira de fila — onda 123 (2026-10-05, sem commit)

- Conta própria interrompida inicia incidente durável e conciliação em páginas
  de até cinco tentativas, com chave scoped e papel de negócio sob RLS.
- Leitura estrita optativa conserva o contrato legado. Valor, modalidade,
  vínculo e datas precisam de prova; estados incertos mantêm a restrição.
- Processador/outbox existentes e checkpoint têm commit conjunto. Pagamento
  histórico não quita a cobrança nova; cancelamento e estorno conservam a
  obrigação e o histórico.
- 251 casos distintos, gates e builds API/legado passaram localmente. Uma
  fotografia completa não autoriza reativar a fila; aceite operacional e
  reconciliação final continuam pendentes. Sem push ou produção.

### Configuração da conta conectada — onda 122 (2026-10-04, sem commit)

- Runtime compartilhado instala configuração inicial e inspeção diária de
  eventos da conta própria conectada, no scheduler existente e com a credencial
  scoped do cofre. Nenhuma chave raiz, novo pool ou regra foi adicionada aos
  hosts.
- Hash e intenção são gravados antes da escrita externa. Token recuperável por
  HMAC permite retomada sem armazená-lo em claro; criação incerta não repete
  POST e exige leitura/atualização do webhook próprio. Fila interrompida
  permanece restrita até reconciliação, inclusive após falha de leitura ou
  chave.
- Eventos de saúde preservam as intenções de configuração. Aprovação exige os
  quatro estados cadastrais atuais, além das restrições anteriores.
- Provas usam transporte simulado e PostgreSQL descartável. Subcontas BaaS,
  reconciliação, interface de conexão e homologação permanecem pendentes; API
  legada e flags reais foram preservadas. Sem commit, push ou produção.

### Conexão inicial de recebimentos — onda 121 (2026-10-04, sem commit)

- POST /api/admin/payment-account/connect nos dois hosts usa um único caso de
  uso no backend. Confere dono/vínculo atuais, autenticação recente, e-mail e
  CNPJ antes da consulta ao provedor e novamente antes da gravação.
- A prova da empresa usa somente GET do Asaas. Chave cifrada, conta e auditoria
  têm commit conjunto; repetição não troca chave nem duplica conta. Integrações
  existentes e o índice de fingerprint continuam protegidos.
- Recibo 202 não libera emissão: integração PROVISIONING e conta RESTRICTED com
  WEBHOOK_MISSING preservam a pendência. Configuração de eventos, identidade
  externa, interface e homologação real ainda faltam. Não houve push ou
  produção.
- Fixtures do cofre agora selecionam a integração correta e controlam o relógio
  da janela HMAC. Duas exceções de higiene obsoletas saíram por consumo real;
  nenhuma proteção foi ampliada.

### Consulta da conta de recebimentos — onda 120 (2026-10-04, sem commit)

- GET /api/admin/payment-account nos dois hosts compõe uma leitura comum em
  backend/payment-accounts. Dono/vínculo atuais, RLS e snapshot READ ONLY
  protegem a projeção sem chaves, identificadores do provedor ou dados
  bancários.
- Página FSD /admin/recebimentos e menus web mostram os estados atuais e
  permitem atualização explícita. Troca de locadora, identidade ou transporte
  descarta dados anteriores. Checklist aponta para a consulta; criação, conexão,
  documentos e saque ainda não têm botões de execução.
- Moldura administrativa extraída para frontend/app e usada pelos dois hosts; os
  widgets existentes e a política do guard legado permanecem. O seletor
  confirmado pelo gate fica no main, acessível abaixo dos cabeçalhos fixos, sem
  novo leitor de sessão ou decisão de locadora.
- Contrato reconhece KEY_EXPIRED e KEY_DELETED já usados pelo consumidor de
  saúde. Quatro exceções antigas de tipos sem consumidor saíram da higiene pelo
  uso real; nenhuma proteção foi ampliada. Legado, agenda e flags reais
  permanecem; homologação operacional e demais comandos continuam pendentes.

### Assistente web de cadastro — onda 119 (2026-10-04, sem commit)

- /comecar instalado no host app sobre página FSD compartilhada e APIs
  existentes. Host contém rota, adapter de login e integração de captcha;
  negócio permanece no backend. Expo conserva estados e link do painel.
- Confirmação de e-mail protege a progressão; planos mensais e textos aprovados
  vêm das fontes atuais. Aceites começam desmarcados. Rascunho separado por dono
  não guarda senha/captcha; pedido incerto conserva corpo/chave após recarregar
  e só é reenviado com confirmação explícita e novo desafio.
- Links de confirmação do dono retornam a /comecar; cadastro comum de clientes
  preservado. Recibo não publica o site, ativa recebimentos ou navega sozinho.
- Tipos, testes focados, gates, três builds, HTTP local e navegador com fixtures
  passaram. Uma exceção obsoleta de tipo saiu por consumo real no produto;
  nenhuma proteção foi ampliada. Cadastro real off, legado ativo; recebimentos,
  S13, backoffice e homologação externa seguem pendentes.

### Conta mínima do dono e verificação de e-mail — onda 118 (2026-10-04, sem commit)

- Os dois hosts montam POST /api/auth/owner-register, GET
  /api/auth/owner-account e POST /api/auth/owner-verification sobre uma única
  composição de identidade. O cadastro mínimo não cria locadora, assinatura ou
  vínculo e não substitui o cadastro de clientes com telefone/documento.
- Cadastro exige contexto genuíno do painel, publicação jurídica aprovada,
  limitador persistente, captcha e consulta limitada de senha comprometida. O
  contexto interno para conta mínima não pode ser acionado por flag HTTP.
- Verificação é lida da conta autenticada; reenvio só usa seu endereço, com
  orçamento silencioso por minuto e por dia. Respostas privadas e neutras, CSRF,
  motor existente e envio após commit permanecem.
- Provas locais de identidade, regressões e ambos os builds passaram. Flags
  reais off, API legada e operação preservadas; wizard /comecar e homologação
  externa ainda pendentes.

### Opções aprovadas para o cadastro guiado — onda 117 (2026-10-04, sem commit)

- GET /api/onboarding/options instalado em paralelo nos dois hosts, com uma
  única composição no backend. A leitura anônima exige contexto genuíno do
  painel e responde com cache privado; não cria conta ou locadora.
- Textos jurídicos externos são entregues somente quando seus hashes UTF-8
  coincidem com a publicação aprovada. A resposta contém a chave pública do
  captcha, nunca sua credencial secreta. Cadastro desligado devolve apenas
  `mode: off`, sem ler os arquivos de publicação.
- Contratos existentes, API legada e flags reais preservados. Wizard S11a,
  recebimentos, S13, backoffice e homologação externa continuam pendentes.

### Primeiros passos no dashboard compartilhado — onda 116 (2026-10-04, sem commit)

- Web e Expo mostram o checklist confirmado pelo servidor. Locadora, sessão,
  vínculo e transporte delimitam os dados; ADMIN sem propriedade e locadoras
  antigas sem assinatura não recebem estados inventados.
- Web confirma a publicação explicitamente, impede duplo clique e só atualiza a
  etapa após nova leitura. Resultado incerto permite retry manual do mesmo
  pedido. Expo abre o painel configurado sem transportar credenciais.
- GET/HEAD privado de status admite chamada direta autenticada de aparelho;
  cabeçalhos de navegador/borda conservam a exigência de contexto app genuíno.
  Ownership, RLS e no-store permanecem. Uma exceção obsoleta de tipo saiu da
  higiene por consumo real no produto; nenhuma tolerância foi ampliada.
- Wizard, recebimentos, S13, backoffice, aparelhos/provedores e operação ainda
  pendentes. Legado, proxy, scheduler e flags reais preservados.

### Publicação confirmada pelo dono — onda 115 (2026-10-04, sem commit)

- POST /api/admin/site/publish instalado em paralelo no legado e no serviço,
  sobre um caso de uso compartilhado. Exige dono ADMIN atual, origem app, e-mail
  verificado, acesso FULL e equipamento da própria locadora. Corpo não escolhe
  locadora, data ou indexação; resposta privada com recibo estrito.
- Reutiliza o lock de catálogo/locação; consulta equipamentos pelo papel de
  aplicação READ ONLY. Data e auditoria confirmam juntas ou são desfeitas.
  Repetição devolve a data original; indexação/diretório não são ativados.
- 277 casos focados distintos, tipagem, lint e gates passaram, sem relaxar
  baselines. UI, despublicação, vitrine S13 e homologação externa pendentes. API
  legada, proxy, scheduler e flags reais permanecem como estavam.

### Boas-vindas duráveis do onboarding — onda 114 (2026-10-04, sem commit)

- onboarding.welcome tem consumidor no backend compartilhado, instalado na
  composição de jobs existente. Revalida organização, dono ADMIN, e-mail
  verificado e equipe ativa; usa uma mensagem da plataforma para um
  destinatário. Conteúdo/chave estáveis são gravados antes do envio. Aceitação
  do provedor é um recibo durável; mudança de destinatário/conteúdo ou retry
  incerto após 23 horas exige conciliação, sem renovar o envio automaticamente.
- Renderer e envelope de plataforma são reutilizados por assinatura e
  onboarding; transporte Resend limitado existente permanece único em runtime.
  Configuração incompleta mantém eventos PENDING sem consumir tentativas.
- 162 casos distintos em seis arquivos, tipos, lint, gates e builds locais de
  API/legado passaram. Envio foi simulado, sem homologar entrega real. Cadastro
  público, fiscalização, proxy, scheduler real e legado preservados; UI,
  publicação, operação/backoffice e retirada da raiz continuam pendentes.

### HTTP de onboarding e checklist do dono — onda 113 (2026-10-04, sem commit)

- Os dois hosts instalam criação, disponibilidade e status usando o mesmo
  backend. Sessão identifica o futuro dono; criação exige origem app, flag e
  configuração segura, corpo estrito limitado e recibo idempotente. A flag real
  continua off. Desafio no servidor só roda em pedidos novos; replay confirmado
  conserva o recibo sem repetir um token de uso único.
- Disponibilidade tem contador persistido por IP HMAC; checklist revalida dono,
  vínculo e fatos da própria locadora em snapshot READ ONLY. Preferência de
  locadora é host-only e não autoriza acesso. Nenhuma regra empresarial foi
  copiada para os hosts.
- 234 casos focados distintos; tipos, lint e gates locais. Uma exceção de export
  sem uso foi retirada por consumo real, sem tolerância nova. API legada, proxy,
  scheduler e flags reais preservados. UI, publicação e consumidor de
  boas-vindas seguem pendentes; dublês de captcha não homologam provedor real.

### Provisionamento assistido atômico — onda 112 (2026-10-04, sem commit)

- Caso de uso em packages/backend cria organização, dono, assinatura, teste,
  aceites, sementes neutras, auditoria e outbox na mesma transação. Reutiliza
  catálogo/validação/limites existentes; locks e recibo HMAC protegem
  concorrência e replay. Equipe ativa não pode ser dona; histórico inativo segue
  a regra do banco. Site e conta de recebimentos não são
  publicados/provisionados.
- CLI platform:provision oferece prévia sem conexão e execução assistida
  explícita, com operador ADMIN e dono verificado. Metadados jurídicos aprovados
  vêm de arquivo externo limitado, sem inventar textos ou planos. A conexão
  permanece na composição única; mensagens privadas não chegam à saída.
- 196 casos focados distintos, tipos/lint/gates e builds locais API/legado.
  Higiene remove nove achados agora consumidos e uma exceção de dependência
  obsoleta, sem tolerância nova. S10 parcial: faltam HTTP/UI, checklist,
  publicação e consumidor de boas-vindas. Legado, proxy, scheduler e flags reais
  preservados; nenhum push, deploy ou cutover.

### Reativação confirmada no web — onda 111 (2026-10-04, sem commit)

- Página compartilhada de assinatura consulta ofertas publicadas após confirmar
  o dono e o estado CANCELED. Exige escolha e confirmação de plano/mensalidade,
  sem novo teste. Envia somente planVersionId; recibo relê resumo/faturas sem
  presumir pagamento. Retry incerto conserva ação, versão e chave; mudança de
  escopo/resumo ou oferta não enviada invalida a confirmação.
- 226 casos focados e 20 cenários Chromium em 390/1440 px, tipos, lint, gates e
  builds web/legado passaram. Duas exceções de tipos sem consumidor saíram da
  higiene por uso real. Expo segue com estado/link. Homologação real, troca de
  plano, onboarding/backoffice e cutover permanecem pendentes; legado ativo,
  fiscalização off, sem publicação.

### Reativação durável do dono — onda 110 (2026-10-04, sem commit)

- Reactivate nos dois hosts cria assinatura nova sem teste, com oferta mensal
  publicada, perfil/aceites e dono/sessão recente. Recibo scoped preserva plano
  e histórico. Worker concilia a assinatura antiga antes da emissão, inclusive
  entre reativações consecutivas; cobrança paga não é apagada.
- 480 casos distintos e dez verificações HTTP, tipos/gates/builds locais
  aprovados. Duas exceções de higiene obsoletas removidas por consumo real;
  nenhuma tolerância ampliada. UI/backoffice/Asaas real e classificação de
  upgrade/downgrade pendentes. Legado ativo, fiscalização off, sem
  commit/push/deploy/produção.
  [Provas e limites](docs/features/shared-api-host.md#onda-110--reativacao-duravel-pelo-dono-2026-10-04-sem-commit).

### Ativação confirmada no web — onda 109 (2026-10-04, sem commit)

- Assinatura-admin confirma plano/mensalidade persistidos e reutiliza a
  infraestrutura de cancelamento para activate. Pedido incerto conserva
  ação/chave; accepted relê resumo/faturas, sem presumir pagamento. Cadastro,
  aceites e sessão recente têm tratamento público; foco retorna ao botão certo.
- 180 focados e 18 Chromium em 390/1440 px, tipos/gates e builds web/legado
  aprovados. Nenhuma proteção/baseline/CSS relaxada. Mobile continua só
  estado/link; provedor/aparelho/fluxo autenticado real, troca/reativação e
  onboarding/backoffice pendentes. Legado ativo, sem
  commit/push/deploy/produção.
  [Provas e limites](docs/features/shared-api-host.md#onda-109--ativacao-confirmada-no-web-2026-10-04-sem-commit).

### Ativação e emissão da mensalidade — onda 108 (2026-10-04, sem commit)

- Activate nos dois hosts reutiliza dono/sessão recente/recibo sob trava. Worker
  compartilhado persiste cliente antes da recorrência; UNKNOWN/crash só
  conciliam, divergência fica FAILED e cancelamento concorrente preserva
  histórico/acesso. Cron existente, sem nova agenda ou mudança funcional alheia.
- 515 casos distintos, tipos/gates/builds e seis verificações HTTP locais
  aprovados. Uma exceção de higiene retirada por consumo real; nenhum checker
  relaxado. Provedor/operação, consumidor web, onboarding/backoffice e demais
  comandos ainda pendentes. Legado ativo, sem produção, tráfego,
  commit/push/deploy.
  [Provas e limites](docs/features/shared-api-host.md#onda-108--ativacao-e-emissao-da-mensalidade-2026-10-04-sem-commit).

### Confirmação de cancelamento no web — onda 107 (2026-10-04, sem commit)

- /admin/assinatura confirma cancelamento/desfazimento sobre o serviço
  existente, relê plano/faturas após o recibo e conserva a chave no retry manual
  de resposta incerta. Troca de locadora/identidade/resumo invalida a
  confirmação anterior.
- Login existente tem modo explícito de reautenticação, sem redirecionar pelo
  cookie antigo nem levar ação/chave no callback. Backend segue responsável por
  verificar autenticação recente e propriedade. Mobile permanece consulta/link.
- 179 focados, 185 web, 95 mobile e 16 Chromium passaram; tipos/gates e builds
  web/legado aprovados. Sem baseline novo, produção, push ou retirada de app/.
  [Provas e limites](docs/features/shared-api-host.md#onda-107--confirmacao-e-reautenticacao-no-web-2026-10-04-sem-commit).

### Cancelamento da assinatura pelo dono — onda 106 (2026-10-04, sem commit)

- POST de cancelamento/desfazimento nos dois hosts usa um único serviço:
  autenticação real recente, dono/vínculo revalidados sob trava e recibo
  imutável scoped. Renovar cookie não avança a autenticação.
- Período pago/cortesia protegido, teste com efeito imediato e worker existente
  para reconciliar/inativar; sem Asaas no request ou remoção do histórico.
- 341 casos distintos, tipos/lint/gates e builds API/legado aprovados. Uma
  exceção obsoleta de higiene removida por consumo real; nenhum gate relaxado.
- UI de confirmação e operação externa continuam pendentes. Legado/scheduler
  ativos, enforcement off, sem tráfego/produção/commit/push/deploy.
  [Provas e limites](docs/features/shared-api-host.md#onda-106--cancelamento-pelo-dono-2026-10-04-sem-commit).

### Consulta da assinatura no web e Expo — onda 105 (2026-10-04, sem commit)

- Tela compartilhada /admin/assinatura: web consulta plano, estado, uso,
  recursos e histórico de faturas; Expo mostra estado e abre o painel web,
  conforme a ADR. Rotas finas dos clientes e do legado usam a mesma slice.
- Leitura estrita por usuário/vínculo/locadora/transporte; mudança de escopo
  descarta respostas antigas. ADMIN não implica propriedade. Faixa do dashboard
  e item de menu aparecem somente após resposta autorizada do backend.
- 94 testes focados, 95 mobile e 184 web passaram; Chromium aprovou 14 casos da
  nova tela e duas capturas de dashboard sem diferenças de estilos. Tipos,
  builds/exportações e gates constam no checkpoint. O teste de paridade Tailwind
  registra 12 classes anteriores sem fixture, sem relaxar a baseline.
- Sem ações comerciais, mudanças de tráfego, fiscalização, produção ou retirada
  da API legada. [Provas e limites](docs/features/shared-api-host.md).

### Consultas da assinatura e faturas — onda 104 (2026-10-04, sem commit)

- GET de assinatura e faturas do dono nos dois hosts, com regra compartilhada,
  revalidação de ownerUserId/vínculo, snapshot READ ONLY com RLS e DTOs
  existentes.
- Acesso de leitura do dono em SETUP/RESTRICTED/ARCHIVED, sem ampliar escritas,
  mudar o modo real off, criar cobranças ou alterar o legado/scheduler.
- 185 unitários, 126 de banco e 78 estruturais; 24 cenários HTTP em cada modo
  NextAuth/Better Auth nos dois builds. Gates e tipos passaram; nenhum commit,
  push, deploy ou produção. Duas exceções de tipos obsoletas removidas da
  higiene, reduzindo tolerância por consumo real; checker de autorização
  preservado.

### Origem Zoho e catálogo da assinatura — onda 103 (2026-10-04, sem commit)

- Leituras privadas/OAuth Zoho validam Origin explícito antes de efeitos,
  mantendo navegação legítima sem Origin e a regra geral dos métodos seguros.
- GET /api/public/plans nos dois hosts, com consulta compartilhada, DTO estrito,
  dinheiro decimal e READ ONLY no papel de plataforma. Nenhum preço/plano
  comercial ou ativação foi introduzido; API legada e produção preservadas.
- 502 casos distintos passaram (27 novos), incluindo 116 HTTP; tipos, gates e
  builds dos dois hosts aprovados. As oito falhas de origem foram resolvidas.
  [estado e limites](docs/features/shared-api-host.md).

### Admissão durável Zoho — onda 102 (2026-10-04, sem commit)

- Seis mutações Zoho compartilham admissão transacional no backend quando a
  fiscalização está ligada. Plano, identidade e conexão são revalidados antes do
  efeito; modo off, leitura/refresh e contratos anteriores são preservados.
- Chave estável evita novo envio na repetição; concorrência, payload diferente e
  resultado incerto são bloqueados. Migration aditiva com FORCE RLS e histórico
  imutável foi aplicada somente em bancos descartáveis.
- 358 casos passaram, incluindo 55 novos; gates e dois builds passaram. As 50
  comparações HTTP de mutação passaram, mas oito verificações ampliadas de
  origem em leitura/OAuth falharam; o bloco permanece parcial, sem afrouxar
  testes. reconciliação e aceites reais ainda pendentes.
  [Fronteiras e provas](docs/architecture/zoho-command-admission.md).

### Comunicação e documentos — onda 101 (2026-10-04, sem commit)

- WhatsApp, geração de contrato, pedido de assinatura e envio do orçamento
  ajustado revalidam a assinatura na transação que grava o pedido. Assinatura
  digital e WhatsApp usam seus módulos do plano; geração local e e-mail de
  orçamento não exigem esses módulos.
- Mensagem já aceita registra sent/unknown mesmo após restrição comercial;
  assinatura e e-mail já enfileirados continuam pelos efeitos existentes. Os
  dois hosts preservam DTOs, ownership, erros anteriores e cache privado das
  recusas comerciais.
- 437 provas distintas (46 novas), tipos/lint/gates e os dois builds passaram.
  S8, Zoho, divulgação/site, SaaS e aceites externos seguem parciais;
  fiscalização real off, legado/proxy/scheduler ativos. Provas: onda 101 de
  shared-api-host.md.

### Orçamentos, locações e perfil — onda 100 (2026-10-04, sem commit)

- Criação/alteração/exclusão de orçamento, reajuste, conversão manual, criação,
  checkout/prorrogação/multa de locação, pedidos e remoção do histórico
  revalidam acesso na transação. Os 28 adapters conservam recusas/cache e
  contratos antigos.
- Conversão manual e efeito de pagamento aceito compartilham um único núcleo;
  restrição comercial não interrompe esse efeito. Perfil próprio conserva a
  exceção já prevista para SETUP/RESTRICTED, com escopo por usuário/locadora.
- 760 casos distintos, 116 novos, passaram. Tipos, lint e gates aprovados sem
  alterar baselines; builds do serviço e legado aprovados.
  S8/equipe/divulgação/SaaS e aceites externos continuam parciais; fiscalização
  real off e legado ativo.

### Boleto manual e obrigações — onda 99 (2026-10-04, sem commit)

- Um núcleo financeiro com entradas distintas para pedido manual de boleto e
  jobs aceitos. Preparação/envio, reemissão, devolução/fechamento e baixa
  revalidam na transação; RESTRICTED conserva as obrigações documentadas.
- Doze adapters preservam contratos/cache. 587 casos distintos, 80 novos,
  tipos/gates e builds dos dois hosts passaram, sem alterar baselines.
- Fiscalização real off; S8/demais comandos/SaaS e aceites externos pendentes.
  API legada/scheduler ativos, sem migration ou publicação.

### Admissão transacional — onda 98 (2026-10-04, sem commit)

- Logística, manutenção e PIX/boleto revalidam acesso/módulo na transação da
  escrita, conservando o lock da organização até commit. Direitos/exceções são
  comuns ao gate HTTP; ownership financeiro permanece independente. Hosts
  preservam envelopes/cache comerciais. Off e jobs aceitos preservados.
- 422 casos distintos passaram, 93 novos, incluindo concorrência, RLS, shadow e
  regressões de cobrança/conciliação/jobs. Fiscalização real não ativada.
- Boleto manual de orçamento, demais comandos/equipe/SaaS/aparelhos/operação
  continuam pendentes. Legado/scheduler ativos, nenhuma migration/publicação.

### Admissão HTTP da assinatura — onda 97 (2026-10-04, sem commit)

- Política única no backend revalida acesso e dono após CSRF/vínculo. Escritas
  respeitam módulos; operações existentes em RESTRICTED têm método/corpo
  estritos. Off e shadow conservam o fluxo anterior; fiscalização não ativada.
- 20 pares de adapters conservam a requisição real e envelopes/cache de recusas
  comerciais. Testes estruturais verificam forwarding e continuam rejeitando
  bypass; nenhum baseline de arquitetura/token ou proteção foi relaxado.
- 337 casos distintos (110 novos), com paridade HTTP, RLS e troca de dono. Três
  tolerâncias obsoletas de higiene ganharam consumidor real e foram retiradas.
  Revalidação transacional de módulos/cobranças, equipe, site e restante do S8
  permanecem pendentes; legado e scheduler preservados.

### Cota transacional de equipamentos — onda 96 (2026-10-04, sem commit)

- Guarda compartilhado confere acesso, plano atual, exceções e contagem na
  conexão de criação; locks conservam a decisão até INSERT. Off conserva o
  legado; shadow observa com savepoint; on recusa com os envelopes publicados.
- Cadastro concorrente respeita a cota. Downgrade conserva leitura e registros.
  Os dois adaptadores preservam códigos/campos. Sem nova rota, migration,
  scheduler ou ativação de fiscalização; demais partes de S8 ainda pendentes.
- 51 provas novas incluem papéis restritos/RLS, concorrência, savepoint e
  paridade HTTP. Funções do domínio e tipo de erro ganharam consumidores reais;
  sete tolerâncias obsoletas saíram da higiene, nenhuma nova foi acrescentada.

### Avisos da assinatura — onda 95 (2026-10-03, sem commit)

- Régua pura de teste/fatura e avisos de transição usam os fatos existentes,
  dias civis e dinheiro decimal. Um mapeamento comum serve projeção e avisos.
- Outbox existente faz fan-out privado para contatos de cobrança e memberships
  financeiras atuais. Conteúdo/destinatário são revalidados antes do transporte;
  envelope e intenção da primeira tentativa são duráveis, com chave estável.
- Configuração Resend existente compõe o consumidor nos dois hosts. Ausente,
  jobs ficam pendentes. Retry incerto depois de 23h exige conciliação, sem
  reenvio cego. Não há nova tabela, migração, scheduler ou rota pública.
- 316 casos distintos passaram localmente, sendo 52 novos. Tipos, lint, gates e
  builds API/legado passaram. Uma tolerância obsoleta de tipo ganhou consumidor
  real e foi removida; nenhum baseline foi ampliado. S6 parcial, sem produção.

### Eventos comerciais e recuperação — onda 94 (2026-10-03, sem commit)

- SUBSCRIPTION da raiz persiste handoff para os jobs existentes; recibo e
  referências são revalidados antes de gravar fatos. Payload não concede acesso.
- Recibos UNROUTED com ambiente comprovado são recuperados pelo mesmo resolvedor
  do ingresso. Migration 202610030112 é aditiva e torna o ambiente imutável;
  linhas antigas sem ambiente não são preenchidas por suposição.
- Cancelamento durante criação UNKNOWN recupera o vínculo antes de confirmar
  INACTIVE, sem novo POST. 94 casos de banco, tipos/lint/gates passaram.
  Baselines e legado preservados; S6 parcial, sem commit, push ou produção.

### Reconciliação de assinaturas — onda 93 (2026-10-03, sem commit)

- Jobs compartilhados recuperam fatos pelo provedor e avançam estados locais;
  UNKNOWN busca referência sem repetir criação. Webhook e job usam a mesma
  aplicação/projeção; backoff também adia a entrega da outbox.
- Desativação confirmada usa PUT INACTIVE e conserva histórico. Cancelamento do
  dono considera somente cobranças futuras elegíveis; intenção persistida
  protege timeout/crash sem repetição cega. Migration 202610030111 é aditiva.
- 53 testes de banco e 40 HTTP/retry, tipos, gates e builds API/legado passaram
  localmente. Uma tolerância obsoleta de higiene foi removida. S6 permanece
  parcial; sem commit, push, produção, nova agenda ou retirada do legado.

### Faturas da assinatura — onda 92 (2026-10-03, sem commit)

- Consumidor comercial compartilhado confirma cobranças pela chave raiz e grava
  fatura, histórico, acesso e outbox na mesma transação de plataforma.
  Valor/referências divergentes exigem conciliação; recibos conflitantes ou
  resultado antigo não alteram a assinatura.
- Ciclos mensais usam dias civis e dinheiro decimal. Pagamento antigo não
  reativa assinatura cancelada; status desconhecido preserva dívida confirmada.
  O contrato aceita o billingType RECEIVED_IN_CASH do provedor.
- Eventos PAYMENT da raiz usam tópico próprio; sem chave/ambiente explícitos,
  permanecem pendentes. Notificação e desativação do provedor só são
  enfileiradas: seus consumidores e a reconciliação periódica ainda faltam. S6 é
  parcial.
- Nove tolerâncias de higiene ficaram obsoletas por uso real e foram reduzidas.
  API legada e scheduler preservados; sem produção, commit ou push. Provas e
  limites na onda 92 de shared-api-host.md.

### Faturas da assinatura — onda 92 (2026-10-03, sem commit)

- Consumidor comercial compartilhado confirma cobranças pela chave raiz e grava
  fatura, histórico, acesso e outbox na mesma transação de plataforma.
  Valor/referências divergentes exigem conciliação; recibos conflitantes ou
  resultado antigo não alteram a assinatura.
- Ciclos mensais usam dias civis e dinheiro decimal. Pagamento antigo não
  reativa assinatura cancelada; status desconhecido preserva dívida confirmada.
  O contrato aceita o billingType RECEIVED_IN_CASH do provedor.
- Eventos PAYMENT da raiz usam tópico próprio; sem chave/ambiente explícitos,
  permanecem pendentes. Notificação e desativação do provedor só são
  enfileiradas: seus consumidores e a reconciliação periódica ainda faltam. S6 é
  parcial.
- Nove tolerâncias de higiene ficaram obsoletas por uso real e foram reduzidas.
  API legada e scheduler preservados; sem produção, commit ou push. Provas e
  limites na onda 92 de shared-api-host.md.

### Saúde de contas Asaas — onda 91 (2026-10-03, sem commit)

- Consumidor compartilhado de eventos de conta/chave, com fatos atuais lidos
  usando a credencial da locadora. Expiração comercial é independente da
  aprovação; bloqueio administrativo é preservado, inclusive numa falha de
  chave.
- Recibo, projeção e auditoria são atômicos; conflito, desconexão ou rotação
  durante a consulta não aplicam resultado antigo. Metadados da chave pertencem
  ao módulo secrets; o consumidor não seleciona material cifrado ou segredo.
- Eventos antigos de conta recebem o tópico próprio sem duplicar jobs. Lotes com
  falhas não bloqueiam o restante. Eventos comerciais continuam pendentes para
  S6; API legada e agenda permanecem. Provas/limites em shared-api-host.md.
- Duas tolerâncias obsoletas de higiene foram reduzidas por uso real, sem nova
  exceção. Não houve cutover, produção, commit ou push.

### Entrada durável de Asaas — onda 90 (2026-10-03, sem commit)

- Novos endpoints de raiz e integração nos dois hosts, sobre uma classificação
  única no backend. Pagamentos usam inbox/outbox da locadora; eventos de conta e
  chave usam as tabelas de plataforma com papel restrito e pool separado.
- Resposta após commit, payload reduzido sem chaves/dados de cliente,
  duplicidade idempotente, conflito com auditoria e rollback atômico. Root só
  aceita o hash do token configurado; novo endpoint de integração só aceita
  asaas-access-token. As URLs antigas continuam com o contrato existente.
- Parser/classificador deixam de ser exclusivos de teste: quatro tolerâncias
  obsoletas foram removidas da baseline de higiene, sem aumento de tolerância.
  Consumidores S6/S9 e troca das URLs de provedores permanecem pendentes.

### Credenciais de provider e recebimento durante bloqueio (2026-10-03, sem commit)

- Melhor Envio entra no importador assistido: API key, assinatura e userAgent
  configurado ficam cifrados por locadora. Contato não aparece em relatórios ou
  logs estruturados; referência/ambiente inválidos continuam sem escrita.
- HMAC aceita a chave atual e um único predecessor por menos de 24 horas, sem
  reativar histórico expirado/retirado. Leitura de API key continua só ACTIVE.
- Webhooks autenticados de integração PROVISIONING/INBOUND_ONLY são aceitos.
  Bloqueio administrativo persiste o recibo e adia o efeito até o desbloqueio;
  não relaxa autorização manual nem habilita outro scheduler. Provas e limites
  na onda 89 de shared-api-host.md; nenhuma operação em produção.

### Importação assistida para o cofre (2026-10-03, sem commit)

- CLI com arquivo local explícito, simulação somente leitura e aplicação por
  plano confirmado. Confirmação vencida, conflito, falha de criptografia ou de
  auditoria preservam ENV_REF; nenhuma variável ou credencial real foi migrada.
- Caso de uso em backend/secrets e composição no runtime de plataforma. Uma
  integração por transação, com verificação do fingerprint, auditoria nos dois
  escopos e repetição sem criar versões ou eventos adicionais.
- Ponte SQL restrita para o AuditLog da locadora, sem acesso geral da plataforma
  aos dados operacionais. Provas locais com LOGIN restrito, concorrência,
  rollback e CLI real. Detalhes e limites: onda 88 em shared-api-host.md.

### Cofre de credenciais compartilhado (2026-10-03, sem commit)

- Envelope AES-256-GCM, contexto autenticado por locadora/integração/finalidade/
  versão/ambiente; KEK env ou porta AWS KMS sa-east-1. Self-service exige KMS e
  federação OIDC. SDK lazy, sem consultas AWS nesta implementação local.
- Estados/ativação/rotação/crypto-shredding sob papel restrito; job idempotente
  secrets.rewrap no cron existente, sem scheduler. Ciphertext permanece intacto.
- Resolvedor VAULT sem fallback para env; referências ENV_REF e seus contratos
  preservados. Credenciais dentro de uma transação reutilizam essa conexão.
- Asaas VAULT autentica hashes atual/anterior pelo header próprio, sem precisar
  da chave de saída. ENV conserva os headers antigos. Logger redige campos
  estruturados; guarda hard limita o acesso ao armazenamento ao módulo secrets.
- Importador S7, operação AWS real, assinatura/onboarding/backoffice e retirada
  do legado continuam pendentes. Resultados/limites: onda 87 de API
  compartilhada.

### Composição de plataforma SaaS (2026-10-03, sem commit)

- Pool separado/lazy por PLATFORM_DATABASE_URL, transações com papel restrito e
  contextos locais; quatro sementes de provisionamento continuam insert-only.
- Outbox comercial usa o dispatcher existente, com dedupe, claim concorrente e
  confirmação protegida contra lease vencida. Tópicos futuros ficam pendentes.
- Primeiro job reutiliza a limpeza existente de janelas vencidas de rate limit;
  margem de 60 segundos e contagens vigentes preservadas, sem scheduler novo.
- GET /api/cron/platform nos dois hosts, autenticado antes do banco e no-store;
  conexão ausente ou indevida responde 503. Nenhum scheduler foi acrescentado.
- Guarda PLATFORM-PRISMA limita o pool à composição. Consumidores SaaS/cofre e
  retirada do legado continuam pendentes. Provas: onda 86 de API compartilhada.

### Fundação de dados SaaS (2026-10-03, sem commit)

- Schema, sete migrations e 17 modelos comerciais; backfill gratuito interno
  preserva locadoras atuais. Papéis DBA separados, RLS/histórico/owner/segredos
  e locks de vínculo/equipe, com provas em PostgreSQL descartável.
- Checker classifica PLATFORM sem relaxar as 31 políticas tenant; preflight
  somente leitura. S2 runtime/outbox/cron e demais lotes ainda pendentes; API
  legada ativa, sem cutover/produção/publicação. Registro: onda 85 de API
  compartilhada.

### Comunicações administrativas Expo (2026-10-03, sem commit)

- E-mail/WhatsApp nativos usam modelos/API comuns, com rotas finas e atalhos de
  dashboard. Web mantém JSX/estilos/ações; arquivos, UUID, storage e HTML
  isolado ficam no host. Zoho conecta pelo painel web autenticado, sem tokens em
  URL ou OAuth alternativo.
- 59 casos frontend/80 Expo/183 web, doze TS e gates locais aprovados; AST
  conserva 294 atributos/133 callbacks web e 37 ações de mail.
  Visual/aparelho/provedor/gestos/SaaS/operação seguem pendentes; legado ativo,
  geral ~60% é estimativa. Provas na onda 84 de API compartilhada.

### Configurações/permissões administrativas Expo (2026-10-03, sem commit)

- Seis seções de settings nativas sobre modelo/API comuns; fachada web conserva
  DOM/mensagens. Picker/imagem no host, upload autenticado, reset e seleção
  antiga protegidos. Permissões nativas existentes caracterizadas e atalhos
  reais.
- 50 focados/64 Expo/183 web, doze TS/gates/builds/exports aprovados. AST
  conserva 137 atributos/40 callbacks, seis previews/defaults e três mensagens
  web. Previews nativos/aparelho/visual/SaaS/operação pendentes. Legado ativo;
  provas e limites na onda 83 de API compartilhada.

### Operações administrativas Expo (2026-10-03, sem commit)

- Logística/manutenção nativas sobre DTOs/carga/checklist/calendário comuns;
  edição/status/fotos de logística, filtros/paginação/detalhes e agenda. Host só
  rota/picker/imagem; upload autenticado protege seleção antiga.
- 76 focados/62 Expo/183 web, tipos/gates/builds/exports aprovados. AST conserva
  215 atributos/63 callbacks e dois mapeadores; nove badges têm cores/pixels
  iguais. 27 ocorrências de paleta eliminadas sem ampliar baseline. Criação dos
  fluxos segue pendente como no web; grade/Gantt/gestos/aparelho/ SaaS/operação
  aguardam aceite. Legado ativo; onda 82 de API compartilhada.

### Financeiro administrativo Expo (2026-10-03, sem commit)

- Consumidor nativo real com tabela/filtros/seleção/exportação, calendário,
  indicadores, alíquotas e detalhe/ações sobre modelos/contratos comuns.
  Next/popup/Alert/arquivo são adapters; DTO financeiro de calendário é puro.
- 122 casos do bloco/62 mobile/183 web e gates locais aprovados; AST conserva
  530 atributos web e vinte ações. Atalhos reais de dashboard/orçamento;
  202/recusas/recusa parcial/escopo preservados. Sem baseline ampliada.
  Aparelho/visual/arquivos/SaaS/operação pendentes; legado ativo, ~60% é
  estimativa de esforço. Provas na onda 81 de API compartilhada.

### Orçamentos administrativos Expo (2026-10-03, sem commit)

- Lista/filtros/paginação/agenda e detalhe, aprovação/rejeição,
  boleto/vencimento, reajustes/multa/edições compartilham modelos com web; hosts
  só parâmetros, URLs e bytes autenticados. Facades web mantêm
  navegação/animação/badges.
- 47 focados, 62 mobile/183 web (sete skips anteriores), tipos/gates/builds/
  exports aprovados; AST conserva 136 atributos e 21 ações. Sem baseline
  ampliada. Agenda/pipeline/datas adaptados; visual/aparelho/arquivos reais,
  demais admins/ SaaS/operação pendentes. Legado ativo; ~60% continua estimativa
  de esforço.

### Locações administrativas Expo (2026-10-03, sem commit)

- Lista/filtros/página dez, detalhe/contrato/check-in/out e documentos usam os
  modelos/DTOs/adapters comuns. Picker e URLs recebidas ficam no host; seleção
  antiga não envia. Agenda diária/semanal/mensal funcional.
- 23 casos focados, 61 mobile/183 web (sete skips anteriores),
  tipos/gates/builds e exports aprovados; 171 atributos visuais web iguais.
  Nenhuma baseline ampliada. Grade visual web/aparelhos/documentos reais, demais
  admins/SaaS/ operação pendentes; legado ativo. Ver onda 79 de API
  compartilhada.

### Categorias administrativas Expo (2026-10-03, sem commit)

- Lista/CRUD/detalhe, confirmação e ícones/emoji/SVG/URL em modelos comuns;
  picker/leitura só no host. Payload/409/página nove/contexto preservados.
- 25 casos focados, 59 mobile, 183 web (sete skips prévios), tipos/gates/builds
  aprovados; 143 atributos visuais web preservados por AST. Higiene reduz um
  export/tolerância, sem proteção ampliada. Aparelho/visual, demais destinos,
  SaaS e operação pendentes; legado ativo. Ver onda 78 de API compartilhada.

### Formulários de equipamento Expo (2026-10-03, sem commit)

- Cadastro/edição completos de configuração: modelos comuns, períodos/preços,
  estoque, especificações, imagens com picker/upload real e perdas com
  calendário, contador, fotos separadas e remoção confirmada.
- Snapshot explícito de perdas substitui dependência de setters/timer; falha
  reverte histórico/contador. Seleção/continuação antigas descartadas por ciclo.
  Switch/Select nativos preservam rótulos; AST mantém 293 atributos web.
- 60 casos focados, 58 mobile/183 web, doze projetos TS, gates e builds
  web/Android/iOS aprovados. Sem relaxar baseline/testes.
- Categorias/aparelhos/visual, SaaS/operação e cutover seguem pendentes.
  Legado/agenda ativos; provas na onda 77 em shared-api-host.md.

### Catálogo administrativo Expo (2026-10-03, sem commit)

- Lista/detalhe com modelos comuns, filtros/paginação, preview/galeria e
  exclusão confirmada; unidades têm criação/edição/exclusão e campos completos.
  Hosts finos integram rotas/imagens, sem alterar regras ou HTTP.
- Confirmações e respostas antigas encerradas por ciclo; Textarea native
  preserva rótulo de Notas. 357 atributos web conservados por AST.
- 46 casos focados, 183 web/57 mobile, doze projetos TS, lint/gates e builds
  web/Android/iOS aprovados. Transferência real de arquivo, sem tolerância
  ampliada; css-important continua zero.
- Criação/edição/categorias nativas, aparelhos/SaaS/operação e cutover ainda
  pendentes. Legado/scheduler ativos. Ver onda 76 em shared-api-host.md.

### Perfil, endereços e notificações Expo (2026-10-03, sem commit)

- Três rotas finas montam variantes nativas e modelos compartilhados. Perfil e
  endereços conservam os contratos privados; notificações usam transporte
  configurado e contador DOM apenas web. CEP e respostas anteriores descartados.
- Read confirmado é idempotente, refresh não desfaz mutações e erros permitem
  retry. Stub de criação sem consumidores retirado; higiene encolhe dois itens,
  sem aumento de tolerância.
- 64 casos focados, 183 web/57 mobile, tipos/lint/gates e builds locais
  aprovados. AST preserva 490 atributos; aparelhos e blocos SaaS/operação
  pendentes. Issue 258 e onda 75 registram limites. Legado e scheduler ativos;
  geral ~60% estimado.

### Orçamento Expo e modelos compartilhados (2026-10-03, sem commit)

- /orcamento monta a página nativa da slice: itens, preços, disponibilidade,
  dados/documentos, entrega/retirada, endereço, termos e confirmações. Host
  integra somente persistência, parâmetros e imagem. Formulário alternativo de
  três passos também tem modelo comum e variante nativa.
- Continuação de fins de semana usa o carrinho atualizado. Button.native
  preserva rótulo acessível explícito; proxy autoriza o detalhe público já
  consumido, sem liberar subrotas privadas ou ampliar proteções de teste.
- 124 casos focados, 183 do host web e 57 do mobile, tipos/lint/gates e builds
  web/Android/iOS aprovados. AST preserva 529 atributos; source maps comprovam
  resolução nativa. Issue 257 e onda 74 registram limites de aparelho/frete,
  SaaS e operação. Legado/scheduler ativos; geral ~60% é estimativa de esforço.

### Detalhe de catálogo e preços Expo (2026-10-03, sem commit)

- Rota fina de detalhe usa variantes nativas da slice e modelos de preço, datas
  e confirmação comuns ao web. DTO normalizado em contracts, sem ampliar
  configuração dos gates. Host integra galeria/Share por portas.
- 45 casos focados únicos, 57 do host Expo/oito do gateway, tipos/lint/gates e
  builds web/Android/iOS aprovados. AST preserva 355 atributos e 13 fórmulas;
  source maps confirmam variantes nativas. Issue 256 e onda 73 registram
  orçamento Expo/aparelhos/gestos/Share pendentes. Legado e scheduler ativos.

### Histórico e detalhes Expo (2026-10-03, sem commit)

- Rotas finas montam variantes nativas com modelos de lista/detalhe/ações, preço
  e timeline compartilhados com o web. Contratos, totais e estilos web
  preservados; polling nativo em primeiro plano.
- Host compartilha bytes autenticados do contrato com cache exclusivo e limpeza;
  expo-sharing ~57.0.22. Três tolerâncias de higiene resolvidas por consumo real
  removidas, sem ampliar proteções.
- 153 casos focados únicos, hosts/tipos/lint/gates e builds web/Android/iOS
  aprovados. Issue 255 e onda 72 registram limitações de aparelho/recebimento e
  destinos pendentes. Legado/scheduler ativos; geral ~60% estimativa de esforço.

### Entradas pós-login Expo (2026-10-03, sem commit)

- Dashboard e visão geral do cliente usam páginas nativas compartilhadas;
  callbacks de saída ficam no host. Modelo de carrinho/preços/datas/atividades
  reutilizado no web; DTOs do dashboard separados da configuração web.
- 58 casos focados únicos, tipos/lint/gates, testes dos hosts e builds
  web/Android/iOS aprovados. Source maps confirmam resolução nativa; estilos e
  helpers web preservados. Issue 254 e onda 71 registram destinos ausentes,
  imagens/gráficos/aparelhos e demais limites. Legado/agenda ativos; sem
  cutover.

### Comunicações/configurações/permissões no transporte (2026-10-03, sem commit)

- WhatsApp/Zoho, upload de settings e permissões conectados ao HttpClient,
  preservando contratos, estilo e OAuth pelo web. Query relativa de mensagens
  corrigida; ciclos descartam efeitos antigos e rascunhos preservam digitação.
- 49 casos únicos, tipos/lint/gates/builds aprovados; issue 253 e onda 70
  documentam limites. Nenhuma baseline/allowlist ampliada; nesting de hooks web
  inclui testes TSX. Legado e scheduler ativos; nativo/SaaS/operação pendentes.

### Operações administrativas e medidores (2026-10-03, sem commit)

- Dashboard, manutenção e logística conectados ao HttpClient configurado;
  filtros, payloads, mensagens e estilos preservados. Ciclos descartam efeitos
  antigos por contexto/formulário; backend mantém regras e autorização.
- Medidores Decimal textuais apresentados com a precisão anterior, sem alterar o
  DTO. Falha secundária do dashboard não deixa rejeição sem tratamento.
- 54 casos focados únicos, tipos/gates/builds aprovados; sem repetição do HTTP
  de handlers intactos. Issue 252 e onda 69 registram provas/limites.
  Comunicações/configuração, nativo/SaaS/operação e retirada segura de app/
  continuam pendentes.

### Catálogo administrativo no transporte compartilhado (2026-10-03, sem commit)

- Categorias, lista/criação/edição/detalhe de equipamentos e unidades físicas
  usam adapters nas páginas donas e HttpClient. Preços/perdas/filtros/payloads,
  links/estilos e regras do backend preservados.
- Ciclos por identidade/registro/formulário descartam continuação antiga. Texto
  não JSON/statusText da edição preservado; abort não desfaz escrita remota.
- 43 casos focados, três HTTP por motor nos dois hosts, tipos/gates/builds
  aprovados; legado/agenda/produção intactos. Issue 251 e onda 68 registram
  provas/limites. Medidores textuais e operações são próximos; nativo/SaaS/
  aceite operacional e retirada segura da raiz pendentes.

### Financeiro/orçamentos no transporte compartilhado (2026-10-03, sem commit)

- Carga, detalhe, ações e exportação usam adapters nas páginas donas e
  HttpClient configurado. Filtros, payloads, valores, estilos e status 202/409
  preservados; regras continuam no backend.
- Ciclo descarta resultados e continuação antigos após rede/callback; flags
  reiniciam por registro e locks sempre são liberados. Bytes/nomes PDF/XLSX/CSV
  preservados; aceite de download/popup em navegador real permanece pendente.
- 82 casos focados, seis HTTP por motor nos dois hosts locais,
  tipos/gates/builds web/Android/iOS aprovados. Legado/agenda/produção intactos.
  Issue 250 e onda 67 de docs/features/shared-api-host.md registram provas e
  limites. Próximo: catálogo administrativo (locações já conectado na onda 66);
  demais consumidores/aparelhos/SaaS/operação pendentes.

### Pagamentos/documentos administrativos no transporte compartilhado (2026-10-03, sem commit)

- Boleto em entidade pagamento; documentos exclusivos no api da página dona.
  Multipart/status 202/corpos PDF preservados, com HttpClient configurado.
- Escopo por locadora/papel/usuário/registro descarta dados, contrato, arquivo
  ou sucesso antigo, inclusive após callbacks. Backend/estilos intactos.
- 93 casos focados, oito HTTP por motor nos dois hosts locais, tipos/lint/gates
  e builds web/Android/iOS aprovados. Legado/agenda/produção intactos. Issue 249
  e onda 66 de docs/features/shared-api-host.md registram provas/limites; demais
  consumidores, aparelhos, SaaS e operação ainda pendentes.

### Detalhe, pedidos e contrato pelo transporte compartilhado (2026-10-03, sem commit)

- Detalhe do histórico e ações usam transporte configurado e escopo por
  locadora/usuário/registro. DTOs nas entidades; JSON padrão e download binário
  com corpo completo antes de liberar dados/arquivo. Extensão direta e pedido à
  equipe conservam payloads e regras distintos.
- Diálogos de ações corrigidos com Portal e Trigger renderizando Button;
  textos/classes/estilos anteriores preservados. Respostas antigas não mostram
  sucesso, navegam ou recarregam. Nome .html do download anterior preservado.
- 211 casos focados, seis HTTP por motor nos dois hosts locais, tipos/lint/gates
  e builds web/Android/iOS aprovados. Legado, agenda e configurações reais
  intactos. Issue 248 e onda 65 de docs/features/shared-api-host.md registram
  resultados, dívidas e limites; aparelhos/SaaS/operação ainda pendentes.

### Visão geral e histórico conectados à API compartilhada (2026-10-03, sem commit)

- Área do cliente e histórico usam transporte configurado nas entidades de
  locação, orçamento e cliente, com seleção/cookies do bootstrap. Listagem,
  atividades, busca, filtros, totais e soft delete conservam os contratos.
- Troca de usuário/locadora reinicia as páginas e descarta respostas antigas.
  Polling de 30 segundos, refresh ao retornar à aba e releitura após remover
  permanecem; erro de exclusão conserva a linha e permite nova tentativa.
- 261 casos focados, seis HTTP por motor nos dois hosts locais de produção,
  tipos, guards e builds web/Android/iOS aprovados. API legada e agenda ativas,
  sem publicação ou cutover. Issue 247 e onda 64 registram evidências e limites.

### Perfil e endereços conectados à API compartilhada (2026-10-03, sem commit)

- Transporte privado único em entities/cliente, consumido pelo orçamento, perfil
  e endereços. GET/PUT do perfil e GET/POST/PATCH/DELETE de endereços conservam
  corpos, envelopes, ownership e seleção capturada pelo bootstrap.
- Ciclo de cancelamento extraído para shared/api, sem regras de negócio.
  Formulários/listas reiniciam ao trocar usuário/locadora; respostas antigas não
  preenchem a nova tela nem iniciam sua releitura. Falha conserva rascunho.
- Provas renderizadas, HTTP real nos dois hosts/motores, tipos, guards e builds
  web/Android/iOS aprovados. Identidade global e dados de terceiros preservados;
  API legada e agenda continuam ativas. Issue 246 e onda 63 de
  docs/features/shared-api-host.md registram contratos e limites.

### Consumidor de orçamento na API compartilhada (2026-10-03, sem commit)

- Página e formulário auxiliar usam HttpClient configurado; catálogo,
  disponibilidade e pedido identificam explicitamente a locadora. Perfil e
  endereços continuam privados, com o header capturado pela seleção.
- Respostas antigas não hidratam/limpam outro carrinho nem iniciam a próxima
  escrita. Preferências de confirmação e formulário principal isolados por
  usuário e locadora; remoção animada cancelada na troca de escopo. Falhas e
  salvamentos parciais conservam o estado para nova tentativa.
- Contratos e regras do servidor preservados, sem troca de tráfego. Três
  exceções de tipos agora consumidos foram retiradas da higiene. Provas e
  limites na onda 62 de docs/features/shared-api-host.md.

### Carrinho conectado à API compartilhada (2026-10-03, sem commit)

- Hook universal ligado ao bootstrap web/native, somente no escopo CLIENT
  confirmado. Mesclagem usa localCartItems; edições/remoções usam items, com
  debounce, escrita serial e cliente fixado na locadora.
- Persistência conserva remoções após falha/reload/resposta perdida e descarta
  resultados de escopos antigos. Carrinho anônimo continua separado; falha
  oferece tentativa explícita e conserva os itens locais.
- Mapper preserva regras/valores diretos do catálogo e evita desconto duplo na
  taxa ajustada. Totais continuam no domínio; contratos HTTP/backend intactos.
- Provas de providers, HTTP real nos dois motores/hosts e builds web/native.
  Dívida de hook sem consumidor retirada da higiene, sem ampliar proteções.
  Relatório e limites na onda 61 de docs/features/shared-api-host.md.

### Concorrência da inbox e formato do cookie OAuth (2026-10-03, sem commit)

- Recepção duplicada usa INSERT atômico e leitura na transação de locadora.
  Barreira SQL reproduziu P2002 nos quatro provedores; correção preserva evento,
  hash, inbox/outbox únicos, lease, rollback e retry do consumidor.
- Callback Zoho recusa JSON null, arrays e primitivos antes de SQL/provedor,
  mantendo cookie limpo, redirect seguro e contratos de state/escopo.
- Helper de identidade associa login e sondas ao IP reservado da fixture;
  teardown conserva limites durante os testes e remove somente seus registros
  após encerrar os hosts. Não altera o motor ou o limitador do produto.
- Correções compartilhadas pelos dois hosts, sem alteração de schema, pool,
  scheduler, estilo, ambiente externo ou API legada. Provas e limites na onda 60
  de docs/features/shared-api-host.md; issues 240/241 atualizadas.

### Aceite operacional HTTP/SSR da API (2026-10-02, sem commit)

- Proxy web real cobre multipart privado, PDF, OAuth, cache por locadora e HTML
  do equipamento pelo gateway, sem banco no cliente. Documento e autorização
  pendente sobrevivem ao retorno ao legado. Nenhuma regra, tela ou estilo mudou.
- 43 casos por motor aprovados (legacy/Better Auth), mais 183 testes de gates;
  tipos/lint/arch/tokens/nomes/higiene/ratchet verdes sem ampliar baselines.
  Fixture usa localhost coerente com a normalização do NextURL e multipart real.
- Roteiro de aceite/corte/rollback documentado. Jobs seguem diretamente no
  backend, com a única agenda configurada na raiz. Guia de deploy distingue o
  legado e aponta o repositório autorizado. Sem push, deploy ou produção;
  dispositivos e aceite externo continuam pendentes. Ver onda 59 da feature.

### Consumidores web/mobile e origem de arquivos públicos (2026-10-02, sem commit)

- O cliente web serve sua cópia pública sincronizada, independente da API. O
  host Expo separa API e imagens relativas com EXPO_PUBLIC_ASSET_URL, com
  fallback compatível. Exemplos próprios dos clientes permitem ensaio local em
  3002 e rollback para 3000, sem mudar ambientes existentes.
- Proxy Next real: arquivos idênticos, borda forjada substituída, allowlist,
  login/cookies, seleção multiempresa, CSRF e sessão conservada no rollback.
  Onze casos por modo, incluindo cliente HTTP mobile, em banco descartável.
  Build web, bundles Android/iOS, tipos e testes dos hosts aprovados. Provas e
  limites na onda 58 de docs/features/shared-api-host.md.
- CI passa a compilar o consumidor web antes do teste real de proxy e verificar
  OpenSSL para a fixture TLS local. Sem deploy, push, cutover ou novo scheduler.
- Teardown reconhece as chaves IPv6 normalizadas do Better Auth e remove só os
  registros da fixture após encerrar os hosts. Banco descartável sem resíduos;
  183 testes de gates aprovados, sem ampliar baselines ou limitadores.

### Jobs e efeitos compartilhados (2026-10-02, sem commit)

- Os nove GETs de cron completam a montagem de 149 rotas/193 métodos no serviço.
  Regras, RLS, budgets, checkpoints, outbox e efeitos ficam no backend. Cinco
  renderizadores e quatro efeitos de e-mail compartilhados, com HTML e contratos
  conservados. Fachadas do legado mantidas; reexports sem consumidor fechados.
- HTTP local dos dois hosts: 18 casos por modo de identidade. Segurança 170,
  gates 183 e 41 comparações AST aprovados, sem ampliar baselines. Tipos,
  builds, lint, higiene e ratchets passaram. Teardown de checkpoints da fixture
  corrigido.
- Legado ativo e scheduler idêntico, sem trocar clientes, proxy ou callbacks.
  100% dos métodos montados não mede conclusão geral. Provas e pendências na
  onda 57 de docs/features/shared-api-host.md. Sem push, deploy ou produção.

### Fluxos auxiliares de credenciais compartilhados (2026-10-02, sem commit)

- Cadastro, recuperação de senha, redefinição e verificação de e-mail montados
  nos dois hosts sobre factories únicas de backend/identity e backend/http.
  Schemas anteriores em contracts/credentials; nenhuma regra duplicada no host.
  Origem, pausa de escritas, respostas neutras, bcrypt, tokens, TTLs, sessões e
  transações preservados. Exportações sem consumidor removidas sem excluir suas
  implementações internas.
- 95 caracterizações/regressões, 139 testes de segurança, 11 de e-mail com o
  motor real, 29 comparações estruturais e paridade HTTP local (22 legacy, 16
  Better Auth) aprovados. Falhas SQL injetadas comprovam rollback do cadastro e
  da redefinição legada. Gates 183; builds, tipos, lint, higiene e ratchets
  aprovados. Nenhuma baseline ampliada.
- Serviço parcial 140/184, nove crons restantes; legado 149/193 ativo. Contagem
  de métodos não mede conclusão geral. Provas e limites na onda 56 de
  docs/features/shared-api-host.md. Sem cutover, commit, push, deploy ou
  produção.

### Identidade, seleção e mutações públicas compartilhadas (2026-10-02, sem commit)

- Dez métodos montados no serviço: seleção POST/DELETE, contato, alias de
  orçamento, envio enfileirado de boleto, assets HDR e GET/POST dos dois
  namespaces de identidade. Schema, transação de contato, política de seleção,
  wrapper de indisponibilidade e proxy restrito compartilham implementações em
  contracts/backend; hosts apenas compõem as dependências existentes.
- Paridade preserva sessão, membership, CSRF, RLS, cookies, DTOs, pricing,
  limites, outbox e erros. 119 caracterizações/regressões, 159 de segurança, 18
  comparações AST e 47 casos HTTP por motor nos dois hosts passaram. Gates 183,
  tipos, builds, lint, higiene e ratchets aprovados sem ampliar baselines.
  Serviço parcial 136/180, 13 métodos restantes. Detalhes e limites na onda 55
  de docs/features/shared-api-host.md. API legada ativa; sem cutover, scheduler
  novo, commit, push, deploy ou produção.

### Permissões e respostas inertes compartilhadas (2026-10-02, sem commit)

- Doze métodos montados no serviço: PUT de permissões e respostas existentes de
  seis métodos operacionais 410 e cinco métodos 404. Schema anterior em
  contracts, substituição transacional com lock em backend/identity e parsing em
  backend/http. ADMIN, CSRF, RLS, DTO, rollback e erros preservados; API legada
  ativa, sem mudança de cliente ou reativação de provisionamento.
- 41 caracterizações anteriores, 112 casos após extração com regressões, 167
  testes de segurança, 24 comparações AST e 28 casos HTTP por motor, nos dois
  builds locais de produção. Gates 183, tipos/builds/lint e ratchets aprovados
  sem ampliar baselines. Serviço parcial 130/170, 23 métodos restantes;
  catch-all não certifica URLs concretas ausentes. Limitação anterior do pool de
  conexão única registrada em known-issues 242. Detalhes na onda 54 de
  docs/features/shared-api-host.md. Sem commit, push, deploy ou produção.

### Dashboard e KPIs compartilhados (2026-10-02, sem commit)

- Dois GETs operacionais e dois GETs aposentados montados no serviço, com todas
  as rotas legadas ativas. Cálculos únicos em backend/billing e
  parsing/envelopes em backend/http, sem alterar fórmulas, filtros, DTOs ou
  permissões. Analytics e security continuam 410 inertes; nenhum produtor global
  reativado.
- Provas: 20 caracterizações antes/depois, 115 de segurança, 39 comparações AST,
  18 casos HTTP por motor de identidade, cada um nos dois builds locais de
  produção. PostgreSQL/RLS, falhas SQL, datas, cabeçalhos e quitação por estados
  anteriores preservados. Tipos, builds, lint e higiene aprovados sem ampliar
  baselines; serviço parcial 125/158, 35 métodos restantes. Detalhes e limites
  dos indicadores na onda 53 de docs/features/shared-api-host.md.

### Frete e quarentena Merchant compartilhados (2026-10-02, sem commit)

- POST de cálculo Melhor Envio e quatro métodos Merchant montados no serviço,
  preservando os endpoints legados. Frete tem serviço único em
  backend/operations, schema anterior em contracts/operations e adapter em
  backend/http. Merchant compartilha somente a resposta 503 atual; integração
  comercial e cron permanecem bloqueados, sem ativar cliente global.
- Sessão, membership, origem, filtros da locadora, CEP, credenciais, timeout,
  redirects, DTOs e erros preservados. Provas locais: 65 caracterizações antes e
  depois, 132 testes de segurança, nove de PostgreSQL, 48 comparações AST e 43
  casos HTTP por motor (NextAuth e Better Auth). Builds e gates aprovados, sem
  ampliar baselines. Serviço parcial 121/154, 39 métodos restantes; sem cutover,
  commit, push, deploy ou produção. Detalhes na onda 52 de
  docs/features/shared-api-host.md.

### Manutenção e auditoria compartilhadas (2026-10-02, sem commit)

- Sete métodos montados no serviço sobre backend/operations e backend/http:
  listagem/criação, scheduled, preventive-schedule, PATCH, complete e auditoria.
  Schemas anteriores comuns em contracts/operations. ADMIN por membership,
  ownership, CSRF, RLS, lock e atomicidade preservados; sem duplicar regras ou
  alterar custos, disponibilidade, filtros ou DTOs.
- Helper de automação movido integralmente ao backend; facade interna sem
  consumidores retirada. Rotas legadas, escritor de auditoria, clientes e jobs
  continuam ativos. Serviço parcial 117/149, 44 métodos restantes, sem commit,
  push, deploy ou produção. Provas na onda 51 de
  docs/features/shared-api-host.md.

### Envio e webhooks WhatsApp compartilhados (2026-10-02, sem commit)

- Seis métodos adicionais compostos no serviço e preservados no legado:
  mensagens administrativas, envio por integração, verificação/recepção do
  webhook específico e stubs 410 da URL antiga. Regras, transporte e SQL únicos
  no backend; schemas existentes em contracts; identidade, CSRF, RLS e HMAC
  preservados, sem envio externo ou mudança da origem pública.
- Caracterização 22 antes/52 depois, 19 provas AST, segurança 233, gates 183,
  escrita HTTP 84 por motor e leitura HTTP 54 por motor com cookies reais e role
  sem BYPASSRLS; tipos e ambos os builds passaram. Higiene 891/253, baselines e
  dependências intactas. Concorrência pode exigir retry após 503 (entrada 241).
- Serviço parcial 111 rotas/142 métodos, 51 restantes; legado 149/193 e 46
  páginas ativo. Sem commit, push, produção, cutover ou scheduler novo. Provas e
  limites na onda 50 de docs/features/shared-api-host.md.

### Leituras WhatsApp compartilhadas (2026-10-02, sem commit)

- Três GETs de conversas/detalhe/mensagens montados nos dois hosts sobre
  communications/whatsapp-read e adapter backend/http. Busca, paginação,
  cursores, DTOs, ADMIN/OPERATOR, CSRF central, contagem e RLS preservados.
- Caracterização 30/30 antes, unidade 44/44 depois, HTTP 54/54 por motor com
  cookies reais e FORCE RLS, regressão alertas 19/19 NextAuth, inventário 73/73
  e gates 183/183. Provas e limites na onda 49 de
  docs/features/shared-api-host.md. Nenhuma baseline ou dependência ampliada.
- Serviço parcial 108 rotas/136 métodos, 57 restantes; legado 149/193 e POST de
  envio ativos. Clientes, webhooks e scheduler seguem legados, sem Meta real,
  cutover, publicação ou produção.

### OAuth Zoho compartilhado (2026-10-02, sem commit)

- Autorizar/callback/desconectar montados nos dois hosts sobre factories únicas
  em backend/http. State por tenant/user, cookie, callback fixo, precedência de
  erros, consumo único SQL e chave de token sob RLS preservados. Metadado
  interno da recusa mantém o mesmo texto HTTP; nenhuma autorização ampliada.
- Unidade 254/254, OAuth HTTP 27/27 por motor nos dois hosts, regressão NextAuth
  82/82, identidade 6/6, inventário 73/73 e gates 183/183. Detalhes da fixture,
  sete comparações AST e limites na onda 48 de docs/features/shared-api-host.md.
  Higiene 891/253, baselines inalteradas.
- Serviço parcial 105 rotas/133 métodos, 60 restantes; legado 149/193 ativo.
  Clientes/callback público/scheduler seguem legados. Desconexão local conserva
  state pendente e não revoga no provedor (entrada 240). Sem cutover, publicação
  ou produção.

### Mutações Zoho compartilhadas (2026-10-02, sem commit)

- Seis operações send/reply/draft/update/delete/upload nos dois hosts sobre
  adapters únicos backend/http. Contratos Zoho, sanitização, cache por processo,
  logger, identidade, ownership, RLS, IDs grandes e multipart preservados.
- Caracterização 59/59, unidade 149/149, HTTP 50 escritas e 32 leituras por
  motor, OAuth 6/6, inventário 73/73 e gates 183/183; detalhes da correção
  pontual da fixture e limitações na onda 47 de
  docs/features/shared-api-host.md. Higiene encolhe para 891/253, sem nova
  tolerância. Dependências existentes passam à responsabilidade do backend, sem
  versão nova.
- Serviço parcial 102 rotas/130 métodos, 63 restantes; legado 149/193 e 46
  páginas ativo. OAuth e scheduler continuam legados. Sem cutover ou publicação.
  Riscos de idempotência/auditoria explicitamente preservados.

### Leituras Zoho compartilhadas (2026-10-02, sem commit)

- Seis GETs de contas, pastas, mensagens, detalhe, anexo e inline montados no
  serviço sobre factories únicas de backend/http e integração em
  backend/communications. Legado, DTOs, ownership, CSRF, RLS e bytes
  preservados.
- Caracterização 52/52 antes, unidade 88/88 depois, HTTP 32/32 por motor com
  provedor local, regressão alertas 19/19 NextAuth, OAuth 6/6, inventário 73/73
  e gates 183/183. Higiene 894/256 sem nova tolerância. Provas e limites na onda
  46 de docs/features/shared-api-host.md.
- Serviço parcial 96 rotas/124 métodos, legado 149/193 e 46 páginas ativo, 69
  métodos restantes. OAuth, ações e scheduler legados. Sem cutover, commit,
  push, deploy ou produção.

### Comunicações administrativas compartilhadas (2026-10-02, sem commit)

- GET admin/badges e POST admin/notifications/sync montados sobre regras únicas
  em backend/communications, com fachadas legadas, papel por vínculo, CSRF, RLS,
  contadores e dedupe de seis horas preservados. Zoho passa a factories
  compartilhadas; OAuth e demais rotas/jobs seguem legados.
- HTTP 19/19 por motor, regressão cliente 196/196 NextAuth, unidade 36/36,
  OAuth/banco 12/12, inventário 73/73 e gates 183/183. Provas/limites na onda 45
  de docs/features/shared-api-host.md. Higiene 894/256, duas tolerâncias
  removidas; nenhuma proteção ampliada ou dependência nova.
- Serviço parcial 90 rotas/118 métodos, legado 149/193 e 46 páginas ativo, 75
  métodos declarados restantes. Sem cutover, publicação ou produção.

### Imagens e configurações administrativas compartilhadas (2026-10-02, sem commit)

- POST upload e GET/PUT admin/settings montados sobre regras únicas em
  backend/catalog/http, storage lazy em runtime e schema contracts/settings.
  Fachadas e API legada preservadas; ADMIN, permissões, CSRF, quota, segredos,
  locks, DTO e transformação de imagens mantidos.
- HTTP 58/58 por motor de identidade; regressão privada 44/44 em NextAuth,
  unidade 12/12, cache 7/7, frontend 5/5, segurança afetada 152/152 e gates
  183/183. Types/builds e gates verdes. Provas e limites na onda 44 de
  docs/features/shared-api-host.md.
- Serviço parcial 88 rotas/116 métodos; legado 149/193 e 46 páginas ativo, 77
  métodos restantes. Sete símbolos de higiene e um literal de cor resolvidos.
  Mobile sem inclusão de tipos que carregava o backend (entrada 239), sessão
  preservada. Cache entre hosts, provedores reais e cutover pendentes; sem
  publicação.

### Assinatura e documentos operacionais compartilhados (2026-10-02, sem commit)

- Efeitos de assinatura/reconciliação/arquivo e adapter ZapSign movidos para
  backend/documents, com fachadas e executor cron legados. Upload comum em
  backend/http, tipo puro em contracts/client-documents; GET de documentos do
  cliente e POST de documentos da locação montados no serviço, sem scheduler
  duplicado ou mudança da origem dos clientes.
- HTTP local: 44 novos casos por motor real de identidade; regressão dos 53
  casos de contratos passou nos dois motores. Backend 48/48, banco 10/10, cron
  6/6, segurança 674 passaram e 18 skips anteriores, inventário 73/73 e gates
  183/183. Evidências e limites na onda 43 de shared-api-host.md.
- Serviço parcial 86 rotas/113 métodos; legado 149/193 e 46 páginas preservados,
  80 métodos declarados restantes. PDFKit pertence só ao backend; DOMPurify
  declarado nele na versão existente. Removidos exports sem consumidores e duas
  tolerâncias resolvidas de higiene; nenhuma proteção ampliada. Supabase e
  ZapSign reais e cutover operacional não certificados; sem publicação.

### Contratos e callback ZapSign compartilhados (2026-10-02, sem commit)

- Sete métodos montados em apps/services/api: geração, leitura administrativa,
  pedido de assinatura, download e callback ZapSign com/sem integrationId.
  Regras únicas em backend/documents, download em backend/http, storage em
  backend/runtime e schemas em contracts/rental-contracts. Rotas legadas
  preservadas; scheduler e efeitos de assinatura/arquivo continuam legados.
- Paridade HTTP local: 53/53 em cada motor real de identidade; backend 30/30,
  banco de contratos 10/10, outbox/cron 6/6, segurança existente 673 passaram e
  18 skips anteriores; novo self-check e inventário 73/73, gates 183/183.
  Evidências e limites na onda 42 de docs/features/shared-api-host.md.
- Serviço parcial 84 rotas/111 métodos; legado 149/193 ativo, 82 métodos
  declarados restantes. Documentação de contratos corrigida para o comportamento
  já existente. Cota de color-literal reduzida de 158 para 157 ao centralizar as
  cores idênticas do renderer; nenhuma proteção ampliada. Sem cutover,
  publicação, provedor externo ou produção.

### Verificação de boleto e webhooks de pagamento compartilhados (2026-10-02, sem commit)

- Cinco POSTs montados no serviço: verificação de boleto e recepção PIX/Asaas,
  com e sem integrationId. Os caminhos obsoletos conservam 410. Autenticação,
  inbox durável, consumidores e verificação pertencem ao backend compartilhado;
  adapters e composição permanecem nos hosts. Scheduler continua legado.
- HTTP local: 65/65 em cada motor de identidade; backend 36/36,
  unidade/banco/cron 150/150, contrato fake 106/106, segurança 673 passaram e 18
  skips anteriores, gates 183/183. Evidências e limites na onda 41 de
  docs/features/shared-api-host.md.
- Serviço parcial 78 rotas/104 métodos; legado 149/193 preservado, 89 métodos
  declarados restantes. Retirados exports internos e uma fachada de reexports
  sem consumidor produtivo; as duas tolerâncias correspondentes saíram da
  baseline de higiene. Sem novas tolerâncias, cutover, publicação ou produção.

### Pedidos de PIX/boleto e PDF compartilhados (2026-10-02, sem commit)

- Cinco métodos montados no serviço sobre billing/quotations compartilhados.
  Obrigação, pedido, consulta ao provedor, emissão/reconciliação e credenciais
  extraídos para backend; execução dos jobs continua legada. Schema existente
  compartilhado em contracts/payments; API legada preservada.
- HTTP local: 89/89 em Better Auth; 87/87 e dois casos novos de PDF em NextAuth.
  Unidade/banco 172/172, contrato fake 106/106, credenciais 9/9, inventário de
  autorização 70/70, gates 183/183, builds e proteções aprovados. Evidências e
  limitações na onda 40 de docs/features/shared-api-host.md.
- Serviço parcial 73 rotas/99 métodos; legado 149/193 ativo, 94 métodos
  pendentes. Sem mudança da origem dos clientes, baseline ampliado, cutover,
  publicação ou produção.

### Mutações financeiras compartilhadas (2026-10-02, sem commit)

- PATCH de settings/status/vencimento e DELETE de lançamento montados no
  serviço, com schemas comuns e uma implementação em backend/billing.
  Confirmação e reemissão compartilham transações, locks e outbox; exclusão
  continua recusada para preservar o histórico.
- Paridade em produção local: 84/84 HTTP em better-auth; 82/82 e rechecagem dos
  dois casos SQL novos em legacy. Concorrência entre hosts e rollback
  comprovados; unidade, banco, contrato Asaas fake, builds e gates passaram.
  Evidências e limitações na onda 39 de docs/features/shared-api-host.md.
- Serviço parcial 68 rotas/94 métodos; legado 149/193 ativo e 99 métodos ainda
  pendentes. Worker permanece na composição legada, clientes na mesma origem;
  nenhum baseline ampliado, cutover, push, deploy ou operação em produção.

### Consultas financeiras compartilhadas (2026-10-02, sem commit)

- Seis GETs no serviço com consultas/filtros únicos em backend/billing e
  renderers PDF/Excel/CSV em backend/documents. Legado e PATCH de alíquotas
  preservados; tokens de impressão/calendário com valores anteriores.
- PDF/CSV idênticos ao renderer anterior e quatro abas XLSX preservadas. HTTP:
  79/79 em cada motor real; segurança, identidade e gates verdes. Falhas
  iniciais e rechecagens na onda 38 de shared-api-host.md.
- Fachadas sem consumidores removidas; higiene reduzida em 15 itens e tokens em
  18 literais, sem proteções afrouxadas. Serviço 65/90; legado 149/193. Dívida
  anterior de agregação/CSV registrada na entrada 238, sem cutover.

### Onda de PDFs compartilhados (2026-10-02, sem commit)

- Cinco GETs no serviço; snapshot, queries, branding, mapper e PDFKit no backend
  compartilhado. Permissões por locadora e autoria correta. Ofícios não publicam
  detail interno de 500. Legado ativo.
- Tokens A4 canônicos com cores/medidas preservadas; quatro aliases resolvidos
  retirados da higiene e 22 literais removidos, sem tolerância nova.
  Dependências reais declaradas no backend e lockfile consistente.
- PDFs reais nos dois modos, FORCE RLS, falhas SQL, HEAD/OPTIONS e imutabilidade
  financeira. Rodadas consolidadas e rechecagens na onda 37 de
  docs/features/shared-api-host.md. Serviço 59/84, legado 149/193 e 46 páginas.
  Sem cutover, push, deploy ou produção.

### Onda de mutações de orçamento (2026-10-02, sem commit)

- Nove métodos adicionais no serviço, sobre quotations/rentals existentes;
  quatro schemas legados comuns em contracts/quotations. Criação pública,
  reajustes, simulação, aprovação, conversão e envio preservam isolamento,
  sessão, dinheiro, histórico e outbox, sem chamada a provedores.
- DELETE de orçamento mantém 500 genérico e não publica a causa interna nos dois
  hosts. Provas de rollback SQL, concorrência e quitação com histórico REFUNDED.
  Teardown do teste anterior restaura membership, evitando vazamento de estado
  entre arquivos. Inventário de autorização alinhado aos adapters concretos, com
  recusas sintéticas e sem relaxar proteção.
- Unidade consolidada: 3.164 aprovados. Rodadas HTTP nos dois modos e
  rechecagens focadas registradas na onda 36 de
  docs/features/shared-api-host.md; segurança, identidade, tipos, builds e gates
  verificados ao final do bloco.
- Oito exceções de tipos consumidos retiradas da higiene. Serviço parcial com 54
  rotas/79 métodos; legado conserva 149/193 e 46 páginas. Sem cliente
  redirecionado, cutover, commit, push, deploy ou produção.

### Onda do ciclo de locação e atividades (2026-10-02, sem commit)

- Doze operações adicionais no serviço: ciclo administrativo de locações,
  prorrogação do cliente, lista de orçamentos e atividades. Composição real de
  rentals/customers/quotations; cinco schemas legados comuns em
  contracts/rentals, com Decimal já usado no workspace.
- Regras, lock, RLS, documentos, dinheiro, outbox e contratos preservados. O
  pedido de atendimento e a prorrogação direta conservam comportamentos
  distintos. Emissão externa e consumidores continuam legados.
- Rodada consolidada de tipos, builds, transporte, HTTP com sessão real nos dois
  modos, unidade, segurança, identidade e gates concluída; rechecagens focadas e
  resultados na onda 35 de docs/features/shared-api-host.md.
- Duas exceções de tipos retiradas da higiene após consumo real. Serviço
  parcial: 49 rotas/70 métodos, 35 GETs e 35 mutações; legado mantém 149/193 e
  46 páginas. Sem mudança de cliente, cutover, commit, push ou deploy.

### Onda do portal e consultas de orçamentos (2026-10-02, sem commit)

- Nove operações no serviço, compostas sobre rentals/quotations existentes:
  portal de locações, ocultação do histórico, pedidos de coleta/prorrogação,
  detalhe do orçamento do cliente e consultas administrativas. Schema de prazo
  comum, sem duplicação de regras, pagamento ou documento.
- Sessão real nos dois modos, posse, soft delete, CSRF, RLS, concorrência entre
  hosts e rollback dos alertas protegidos pela rodada consolidada. Tipos,
  builds, unidade, segurança, identidade e gates aprovados; resultados na onda
  34 de docs/features/shared-api-host.md.
- Dez exceções obsoletas de tipos retiradas da higiene após consumo real no
  host; a baseline encolheu, sem novas tolerâncias. Prova de INSERT de alertas
  reforçada com SQL direto, sem alterar permissões de produção.
- Serviço parcial: 40 rotas/58 métodos, 31 GETs e 27 mutações. Legado mantém
  149/193 e 46 páginas. Sem mudança de cliente, cutover, deploy ou push.

### Onda de catálogo e operações (2026-10-02, sem commit)

- Sete operações montadas no serviço: PUT/DELETE de equipamentos, GET/POST de
  veículos e GET/POST/PATCH de logística. Veículos e entregas/coletas extraídos
  para backend/operations, schemas comuns em contracts/operations e facades
  legadas ativas; sem nova dependência ou alteração de produção.
- Falhas inesperadas no PUT de equipamento deixam de expor detalhes internos
  fora de development nos dois adapters; contratos de sucesso e CatalogError
  preservados. Entrada 234 de known-issues.
- Cadência alterada por decisão humana: implementação de uma onda maior antes da
  validação consolidada, sem suítes completas por ajuste ou handler. HTTP
  compilado nos dois modos, RLS, segurança e identidade aprovados ao final;
  resultados e rechecagens focadas na onda 33 de
  docs/features/shared-api-host.md.
- Serviço parcial: 33 rotas/49 métodos, 26 GETs e 23 mutações. Legado conserva
  149/193 e 46 páginas, sem mudança de cliente, cutover, deploy ou push.

### Criação de equipamentos no host compartilhado (2026-10-02, sem commit)

- POST /api/admin/equipments montado em apps/services/api sobre createEquipment
  do catálogo existente. Preservados limitador anterior à autorização, WRITE,
  CSRF, categoria da locadora, normalização, DTO completo e erros por ambiente.
  Handler legado e regras de backend intactos; sem dependência ou schema novo.
- Caracterização anterior e paridade HTTP compilada com sessão real nos dois
  modos, banco descartável, RLS, FK, concorrência e rollback após INSERT. O
  auto-teste do inventário cobra GET e POST separadamente; sem ampliar exceções
  ou alterar baselines.
- Serviço parcial: 30 rotas/42 métodos, 24 GETs e dezoito mutações. Legado
  conserva 149/193 e 46 páginas; sem mudança de cliente, cutover ou deploy.
  Resultados no corte 32 de docs/features/shared-api-host.md.

### Edição/exclusão de unidades no host compartilhado (2026-10-02, sem commit)

- PATCH/DELETE de /api/admin/equipment-units/[id] montados em apps/services/api
  sobre updateUnit/deleteUnit do catálogo existente. Schema de atualização
  legado comum em contracts/equipment-units; preservados WRITE/DELETE distintos,
  posse antes do corpo, DTO, medidores, unicidade, estoque e recusa de exclusão
  de unidade RENTED/RESERVED. Corpos dos handlers legados permanecem iguais.
- Caracterização anterior e paridade HTTP compilada com sessão real, ambos os
  modos de identidade, PostgreSQL, RLS, concorrência e rollback após
  UPDATE/DELETE. Nenhuma baseline ou proteção afrouxada.
- Serviço parcial: 30 rotas/41 métodos, 24 GETs e dezessete mutações. Legado
  conserva 149/193 e 46 páginas; sem mudança de cliente, cutover ou deploy.
  Resultados no corte 31 de docs/features/shared-api-host.md.

### Criação de unidades físicas no host compartilhado (2026-10-02, sem commit)

- POST /api/admin/equipment-units montado em apps/services/api sobre createUnit
  do catálogo existente. Schema legado comum em contracts/equipment-units;
  preservados EQUIPMENTS/WRITE, CSRF, unicidade por locadora, medidores, DTO,
  AVAILABLE, erros e ausência de alteração de estoque.
- Caracterização anterior e paridade HTTP compilada com sessão real, ambos os
  modos de identidade, PostgreSQL, RLS, concorrência e rollback após INSERT.
  Nenhuma baseline ou proteção afrouxada.
- Serviço parcial: 30 rotas/39 métodos, 24 GETs e quinze mutações. Legado
  conserva 149/193 e 46 páginas; sem mudança de cliente, cutover ou deploy.
  Resultados no corte 30 de docs/features/shared-api-host.md.

### Edição/exclusão de categorias no host compartilhado (2026-10-02, sem commit)

- PUT/DELETE de /api/admin/categories/[id] montados em apps/services/api sobre o
  catálogo existente. Preservados WRITE/DELETE distintos, ownership antes do
  corpo, DTO, erros, transação e proteção de categoria ligada a equipamentos. Os
  handlers legados e os casos de uso não foram alterados.
- Caracterização anterior e paridade HTTP compilada com sessão real, ambos os
  modos de identidade, PostgreSQL, RLS, concorrência e rollback após
  UPDATE/DELETE. Nenhuma baseline ou proteção afrouxada.
- Serviço parcial: 30 rotas/38 métodos, 24 GETs e catorze mutações. Legado
  conserva 149/193 e 46 páginas; sem mudança de cliente, cutover ou deploy.
  Resultados no corte 29 de docs/features/shared-api-host.md.

### Criação de categorias no host compartilhado (2026-10-02, sem commit)

- POST /api/admin/categories montado em apps/services/api sobre o catálogo
  existente. Schema estrito movido para contracts/categories e consumido pelos
  dois adapters; EQUIPMENTS/WRITE, CSRF, DTO, normalização e erros preservados.
- Caracterização anterior e paridade HTTP compilada nos dois modos de identidade
  com PostgreSQL, RLS, unicidade, concorrência e rollback após INSERT. Nenhuma
  baseline, ACL ou proteção de teste foi afrouxada.
- Serviço parcial: 29 rotas/36 métodos, 24 GETs e doze mutações. Legado conserva
  149 rotas/193 métodos e 46 páginas, sem cutover ou deploy. Resultados no corte
  28 de docs/features/shared-api-host.md.

### Criação de motoristas no host compartilhado (2026-10-02, sem commit)

- POST /api/admin/drivers montado em apps/services/api sobre o caso de uso
  operations/drivers existente; schema legado movido para contracts/drivers e
  consumido pelos dois adapters. ADMIN da locadora, CSRF, DTO e erros permanecem
  iguais. Zod já instalado é declarado diretamente no serviço.
- Caracterização anterior e paridade HTTP nos dois modos de identidade com
  PostgreSQL, RLS, recusas sem efeitos e rollback após INSERT. GET e OPTIONS
  permanecem compatíveis; nenhuma baseline ou proteção foi afrouxada.
- Serviço parcial: 29 rotas/35 métodos, 24 GETs e onze mutações. A raiz conserva
  149 rotas/193 métodos e 46 páginas; sem cutover ou deploy. Resultados no corte
  27 de docs/features/shared-api-host.md.

### Vínculo explícito no host compartilhado (2026-10-02, sem commit)

- POST /api/client/enroll montado em apps/services/api usando customers/enroll
  existente. Schema estrito de consentimento movido para contracts e consumido
  pelos dois adapters, preservando host-first, sessão, origem, erros e headers.
- Perfil, vínculo CLIENT e auditoria continuam atômicos; papéis ativos são
  devolvidos sem alteração, vínculos inativos não são reativados e documento
  alheio não é adotado. Inventário verifica sessão além do host público e CSRF.
- Serviço parcial com 29 rotas/34 métodos (24 GETs e dez mutações); legado com
  149/193 e 46 páginas preservado. Nenhuma troca de origem, auth, jobs ou
  deploy.
- Caracterização anterior e paridade HTTP nos dois modos com login real, banco
  descartável, RLS, concorrência e rollback; evidências no corte 26 de
  docs/features/shared-api-host.md.

### Atualização do perfil no host compartilhado (2026-10-02, sem commit)

- PUT /api/user/profile montado em apps/services/api, com a implementação
  existente de customers. Schema estrito movido de seu adapter legado para
  contracts/customer-profile e usado pelos dois hosts, sem mudança funcional.
- Caracterização anterior e HTTP real nos dois modos de identidade protegem
  ownership, normalização, CSRF, RLS, rollback e conflito de documento,
  inclusive concorrência entre hosts. Cadastro global e perfis de outros
  usuários/locadoras permanecem intactos.
- Serviço parcial com 28 rotas/33 métodos (24 GETs, nove mutações). API legada,
  clientes, identidade e scheduler continuam configurados. Evidências no corte
  25 de docs/features/shared-api-host.md; sem schema de banco, dependências,
  tolerância ampliada, commit, push, deploy ou produção.

### Carrinho no host compartilhado (2026-10-02, sem commit)

- GET/POST /api/cart/sync e POST /api/cart/merge montados em apps/services/api,
  compondo createCustomerCartService existente. Sem consultas ou regras de
  negócio duplicadas; backend, domínio e handlers legados intactos.
- Caracterização anterior e paridade HTTP com banco/auth reais protegem CLIENT,
  ownership, CSRF, preços autoritativos, centavos, RLS, FKs, rollback e lock
  entre hosts. Sincronização substitui; mesclagem preserva itens não enviados.
- CustomerCartService agora tem consumidor real na composição do serviço; os
  dois achados obsoletos de tipo sem consumidor saíram da baseline de higiene,
  sem novos itens ou ampliação de tolerância.
- Serviço parcial com 28 rotas/32 métodos: 24 GETs e oito mutações. Clientes,
  scheduler e API legada continuam configurados. Sem schema, dependências,
  baselines relaxadas, commit, push, deploy ou produção. Evidências no corte 24
  de docs/features/shared-api-host.md.

### Escritas compartilhadas de endereços (2026-10-02, sem commit)

- POST de addresses e PATCH/DELETE por id montados em apps/services/api, usando
  customers e contracts existentes. Sem regra de negócio ou query duplicada;
  backend e handlers legados permanecem intactos.
- Caracterização anterior e HTTP com banco/auth reais protegem validação,
  ownership, CSRF, principal, concorrência entre hosts, rollback e RLS.
- Serviço parcial: 26 rotas/29 métodos (23 GETs, seis mutações). Clientes
  continuam na origem legada; sem produção, schema, dependência, baseline
  ampliada, commit, push ou deploy. Evidências:
  docs/features/shared-api-host.md, corte 23.

### Marcação/exclusão compartilhadas de notificações (2026-10-02, sem commit)

- PATCH/DELETE de notificações por id e POST mark-all-read instalados no serviço
  parcial; consultas/efeitos extraídos para backend/communications. Os handlers
  legados delegam ao mesmo módulo, com guard e transação mantidos.
- Ownership, CSRF, DTOs, mensagens, repetição, datas, erros e rollback
  protegidos por caracterização anterior, testes dos dois adapters e HTTP com
  banco real.
- Serviço parcial com 25 rotas/26 métodos: 23 GETs e três mutações. Clientes,
  fan-out, sync, jobs e API legada permanecem configurados. Sem dependência,
  schema, migration, baseline relaxada, commit, push, deploy ou produção.
  Evidências: docs/features/shared-api-host.md, corte 22.

### Estatísticas compartilhadas de notificações (2026-10-02, sem commit)

- GET /api/client/notifications/stats instalado no serviço parcial. Quatro
  consultas e DTO extraídos para backend/communications; ambos os adapters
  preservam principal, transação RLS, total da caixa e não lidas por
  tipo/prioridade, com query ignorada e erros originais.
- Caracterização antes/depois, mutações de tenant/destinatário e HTTP real nos
  dois modos de identidade protegem o contrato; a leitura não altera registros.
- 23 GETs locais; API legada e mutações permanecem ativas. Sem nova dependência,
  schema, migration, baseline, cutover, commit, push, deploy ou produção.
  Evidências: docs/features/shared-api-host.md, corte 21.

### Leitura compartilhada de notificações (2026-10-02, sem commit)

- GET /api/client/notifications instalado no serviço. Consultas e resposta
  extraídas para backend/communications; parser/schema existente para
  contracts/notifications. Os dois hosts usam os entrypoints públicos, sem
  consulta/regra duplicada. O host declara o consumidor workspace de contracts.
- Paginação/filtros, DTO, RLS, ownership, validação dentro da transação, erros e
  estatísticas de não lidas preservados por caracterização e paridade HTTP.
- Serviço parcial com 22 GETs; stats, writes, sync e origem dos clientes seguem
  legados. Sem dependência externa nova, migrations, proteção relaxada, push,
  deploy ou produção. Evidências: shared-api-host.md, corte 20.

### Leitura compartilhada do perfil comercial (2026-10-02, sem commit)

- GET /api/user/profile instalado no serviço parcial usando a factory de
  customers já existente, sem duplicar consulta/DTO no host. Leitura por usuário
  e locadora, nulidade e 404 sem fallback global preservados.
- Caracterização e paridade HTTP nos dois modos de identidade protegem seleção,
  ownership, RLS, revogação e erros. O helper de login real das suites foi
  compartilhado com as mesmas asserções de cookie.
- 21 GETs locais; GET/PUT legado, clientes, jobs e origem configurada intactos.
  Sem schema, migration, baseline ampliada, commit, push, deploy ou produção.
  Resultados: docs/features/shared-api-host.md, corte 19.
- Higiene: duas exceções obsoletas de tipo CustomerProfileService retiradas
  porque o host passou a consumi-lo; nenhuma tolerância acrescentada.

### Leitura compartilhada de permissões (2026-10-02, sem commit)

- SELECT de permissões por locadora extraído para identidade em backend; GET
  legado delega na mesma transação e o serviço monta um adapter GET fino.
- ADMIN do vínculo atual é exigido antes da consulta; concessões de outros
  papéis não substituem esse requisito. DTO, ordenação, filtro e erros
  observados permanecem iguais. PUT, locks e escrita continuam legados.
- Vinte GETs instalados localmente no serviço parcial. Sem mudar clientes, URLs,
  schema, baselines de segurança, jobs ou checkpoint canônico; sem commit, push,
  deploy ou produção.

### Lista administrativa e limitador compartilhado (2026-10-01, sem commit)

- Limitador genérico em memória extraído para backend/http. Fachada legada
  preserva seus consumidores administrativos/estritos, stores por
  escopo/processo, IP confiável, limites, expiração e respostas 429; limitadores
  persistentes de identidade continuam compostos. Seis pontes sem consumidores
  de produção foram retiradas, mantendo as provas na implementação dona e
  removendo somente a entrada de higiene obsoleta de consumeRateLimit.
- GET /api/admin/equipments instalado em adapter fino, reutilizando catalog,
  transação e EQUIPMENTS/READ, com paginação/filtros/DTO/erros existentes.
- Inventário acompanha a composição real, com provas adversariais de wiring,
  argumentos e I/O antes do guard. Sem ampliar baselines ou allowlist pública.
- Serviço parcial com dezenove GETs. Legado, writes, clientes e jobs continuam
  ativos. Sem schema, cutover, commit, push ou produção. Evidências no corte 17
  de docs/features/shared-api-host.md.

### Detalhe administrativo de equipamento no serviço (2026-10-01, sem commit)

- `GET /api/admin/equipments/[id]` instalado em adapter fino, reutilizando
  readEquipment, transação e EQUIPMENTS/READ. Preserva DTO completo, preços,
  decimais, disponibilidade, contagens, params, erros e isolamento.
- Caracterização anterior à instalação e 29 casos HTTP novos comparam os dois
  hosts nos dois modos de autenticação, incluindo sessão revogada, concessões,
  RLS, histórico sem locadora e falha real de SELECT nas duas tabelas lidas.
- Serviço parcial com dezoito GETs. Lista, PUT/DELETE, clientes e API legada
  permanecem ativos. Sem schema, cutover ou produção.

### Leituras de unidades físicas no serviço compartilhado (2026-10-01, sem commit)

- `GET /api/admin/equipment-units` e `/[id]` instalados em adapters finos,
  reutilizando catalog, transação e EQUIPMENTS/READ. Mantêm filtros, ordem,
  array/DTO completo, medidores decimais textuais, erros e isolamento.
- Inventário acompanha CatalogError pelo entrypoint público até a mesma classe
  legada, com caso adversarial de mutação do alias. Sem aumento de baseline,
  allowlist pública ou timeout.
- 38 casos HTTP novos e revogação de sessão cobrem os dois GETs nos dois modos
  de autenticação. Serviço parcial com dezessete GETs; escritas, clientes,
  scheduler e API legada continuam ativos. Sem schema, cutover ou produção.

### Permissões e categorias administrativas no serviço compartilhado (2026-10-01, sem commit)

- Política de `requireTenantPermission` extraída para factory compartilhada em
  backend/identity, consumida pelas fachadas da raiz e do serviço. Mantém
  principal atual, CLIENT recusado, ADMIN do vínculo sem lookup e concessão
  exata por locadora/papel/módulo/ação para FINANCIAL e OPERATOR.
- `GET /api/admin/categories` instalado no serviço com consulta catalog única,
  array, DTO completo, contagem, ordem, transação e erros preservados. O serviço
  tem quinze GETs; POST e demais escritas, clientes e jobs continuam legados.
  Sem schema, cutover ou produção.
- Inventário estrutural acompanha a composição de permissão até o principal
  real, com casos adversariais adicionais. A baseline de higiene somente
  encolheu dois achados de CatalogService agora consumidos. Evidências e
  limitações no corte 14 de `docs/features/shared-api-host.md`.

### Endereços do cliente no serviço compartilhado (2026-10-01, sem commit)

- `GET /api/addresses` instalado em `apps/services/api`, com principal privado e
  serviço customers compartilhados. Preserva propriedade por usuário e locadora,
  papel do vínculo, DTO, ordenação, erros e protocolo do legado.
- Apenas composição de banco e adapter HTTP novos; POST/PATCH/DELETE e origem
  dos clientes permanecem legados. Serviço parcial com quatorze GETs, sem
  mudança de schema, política de cache, cookies, proxy ou scheduler.
- Caracterização anterior à instalação e paridade com cookies reais nos dois
  modos de autenticação, incluindo outro usuário da mesma locadora, RLS e recusa
  por revogação. Provas no corte 13 de `docs/features/shared-api-host.md`.

### Principal privado e motoristas no serviço compartilhado (2026-10-01, sem commit)

- Composição de principal extraída para `createTenantPrincipalResolver` em
  backend/identity: guard de mesma origem antes da sessão, borda/preferência,
  conflitos e vínculo atual com transação da locadora preservados. As fachadas
  legada e do serviço usam os mesmos leitores reais de sessão e banco.
- Serviço instala `GET /api/admin/drivers`, com papel ADMIN do vínculo, consulta
  compartilhada, filtro, ordem, DTO e erros iguais ao legado. POST continua
  apenas no legado; clientes, jobs e configuração de produção não mudaram. O
  serviço permanece parcial com treze GETs.
- Inventário segue a delegação até a closure compartilhada e confere a
  composição real; mutations de bypass são reprovadas. Caracterização e paridade
  HTTP sob RLS descritas no corte 12 de `docs/features/shared-api-host.md`.
  Baselines não foram ampliadas.

### Vínculo da locadora do host no serviço compartilhado (2026-10-01, sem commit)

- `GET /api/auth/organizations/current` montado no serviço. Resolução do host e
  consulta do vínculo atual extraídas ao backend, com identidade obrigatória,
  transação da locadora e transporte privado preservados. O legado continua
  atendendo a mesma rota e os clientes mantêm sua origem.
- Inventário distingue preparação de contexto de autorização: remover sessão,
  consultar vínculo antes dela, ignorar `.ok` ou usar o preparador fora de
  `/current` reprova. Sem ampliação de baseline, writes, scheduler ou deploy.
- Serviço parcial com doze GETs. Provas e limites no corte 11 de
  `docs/features/shared-api-host.md`.

### Leitura da seleção no serviço compartilhado (2026-10-01, sem commit)

- `GET /api/auth/organizations/selection` montado no serviço com sessão real.
  Política de preferência, parser/formatter e consulta de vínculo compartilhados
  no backend; adaptação legada conserva os contratos e as escritas POST/DELETE.
- Caracterização antes/depois e paridade HTTP cobrem a preferência sem valor
  autorizativo, papel do vínculo, revogação, suspensão, cookies, erros e cache.
  Inventário estrutural mantém sua gramática fechada, com prova adversarial dos
  novos helpers puros e resolução da constante canônica do contrato.
- Serviço parcial com onze GETs; sem push, produção, schema, scheduler ou troca
  de tráfego. Provas e limites no corte 10 de
  `docs/features/shared-api-host.md`.

### Primeira leitura autenticada no serviço compartilhado (2026-10-01, sem commit)

- `GET /api/auth/organizations` montado no serviço com a leitura real de sessão
  nos dois modos. Consulta/projeção de vínculos ativos movidas para
  backend/identity; rota legada conserva guard e contrato. NextAuth 4.24.15
  existente declarado no host, sem atualização de biblioteca.
- Inventário estrutural ampliado aos três hosts, com allowlist pública exata e
  novas provas adversariais. Caracterização e paridade HTTP protegem cookies,
  identidade, papéis de vínculo, revogação, suspensão e ausência de seleção
  implícita. CI ganha execução da paridade também em Better Auth.
- Serviço ainda parcial; legado, clientes, callbacks, scheduler e produção
  preservados. Sem push, cutover ou alteração de baseline. Arquivos, resultados
  e limites no corte 9 de `docs/features/shared-api-host.md`.

### Dependências de identidade compartilhadas (2026-09-30, sem commit)

- Políticas persistentes de tentativas/notificações e composição do guard
  legados movidas para backend/identity; fachadas usam o mesmo contador
  PostgreSQL, segredo e IP confiável. Janelas, teto, atraso e 429/503
  preservados.
- Transporte Resend e payload de identidade compartilhados, com prazo de 15
  segundos, cancelamento e idempotência conservados. Resend 6.30.0 já instalado
  declarado no backend, sem atualizar a biblioteca. Reexports sem uso removidos;
  nenhuma baseline ou proteção de teste alterada neste passo.
- Legado segue atendendo; serviço ainda público/parcial. Resultados e dívida
  restante no corte 8 de `docs/features/shared-api-host.md`; sem push ou deploy.

### Composição de identidade para a API compartilhada (2026-09-30, sem commit)

- Política de sessão, opções/callbacks NextAuth e lifecycle Better Auth movidos
  a factories do backend, com composição real preservada nas fachadas legadas.
  Revogação da credencial, ausência de fallback após corte, guardas, origem,
  e-mail, erros e contratos existentes protegidos por caracterização/regressão.
- Declarações de sessão junto do adapter; NextAuth 4.24.15 declarado no backend,
  sem atualização de versão. Reexports internos sem uso enxugados; default
  NextAuth sem consumidor retirado, removendo só sua entrada resolvida da
  baseline de higiene, sem nova tolerância. Rota legada permanece intacta.
- Serviço continua parcial, com nove GETs e nenhuma rota privada instalada; sem
  troca de tráfego, schema, scheduler, produção ou push. Provas e próximo corte
  em `docs/features/shared-api-host.md`.

### Busca do diretório na API compartilhada (2026-09-30, sem commit)

- `GET /api/public/tenants?q=` instalado no serviço com os serviços existentes
  de busca e rate limit persistente. Helpers de IP e segredo movidos ao backend,
  com fachadas legadas e o teste de chamador único preservados.
- Caracterização anterior e comparação entre dois processos HTTP; contador
  compartilhado, opt-in, DTO público, curingas, cache e métodos protegidos.
  Legado, origens dos clientes e scheduler continuam ativos; sem migração de
  schema, provedor real, push ou deploy. Resultados em
  `docs/features/shared-api-host.md`.

### Disponibilidade, detalhe e cartão na API compartilhada (2026-09-30, sem commit)

- Três leituras adicionais em `apps/services/api`, com runners/factories de
  backend e contratos caracterizados antes da adaptação. Disponibilidade e
  cartão reutilizam módulos existentes; consulta/DTO do detalhe foram movidos ao
  catálogo, mantendo a rota legada ativa como adapter.
- Comparação HTTP com banco descartável, RLS e fixtures de reservas/pagamentos;
  sem alteração de domínio, schema, jobs, URLs dos clientes ou produção. Suíte
  permite legado `next start` em porta própria para preservar um dev aberto.
  Resultados e limites em `docs/features/shared-api-host.md`.

### Segundo corte da API compartilhada (2026-09-30, ainda sem commit)

- Equipamentos, busca e configurações públicas montados em `apps/services/api`,
  com adapters HTTP em backend e reutilização do catálogo existente. Contratos,
  cache, preços, ordenação, erros e seleção de locadora preservados.
- Caracterização HTTP antes da adaptação, comparação entre hosts com PostgreSQL
  RLS e testes de falha nos handlers reais. Legado, configuração dos clientes,
  schema, pagamentos e scheduler preservados. Estado e provas em
  `docs/features/shared-api-host.md`.

### Primeiro corte da API compartilhada (2026-09-30, ainda sem commit)

- `apps/services/api`: Next HTTP compartilhado parcial, com categories/health,
  proxy próprio, build standalone, Dockerfile e Vercel sem scheduler. Legado e
  origens dos clientes permanecem ativos/configurados como antes.
- Resolução pública de locadora e runtime Prisma/pg movidos para
  `packages/backend`, com composição legada preservada; catálogo/RLS e contratos
  HTTP sem mudança. As duas exceções específicas do singleton foram transferidas
  para o arquivo dono; lint de servidor ampliado a `apps/services/**`.
- Caracterização anterior e comparação HTTP real com PostgreSQL RLS: serviço
  compilado e legado atendem o mesmo catálogo de cada locadora. Suites e tipos
  do serviço ligados ao workspace/CI. Detalhes em
  `docs/features/shared-api-host.md` e na ADR de extração.

### Handoff Claude → Codex (2026-09-30)

- Reconstrução da sessão persistida, conferência do checkpoint `55763c1e` e
  retomada das verificações que falharam no encerramento anterior. O comando
  externo saiu 0, mas cinco suítes saíram 1 e a integração foi pulada; esse
  resultado não é uma aprovação da suíte completa.
- Contexto de IA atualizado para os checkpoints existentes e para a proibição de
  `!important` sem tolerância. ADR de backend corrigida para a decisão do
  usuário: API compartilhada em `apps/services/api`, ainda não extraída.
- Cronologia, fontes, resultados e pendências em
  `docs/ai/claude-codex-handoff-2026-09-30.md`.

### Ondas 6 a 9 da modernização multiempresa (commit `55763c1e`, 2026-09-30)

Registradas no commit local `55763c1e`, de 2026-09-30, em
`modernizacao/multiempresa`, sobre `4b02f52f`; confira a data com
`git log --pretty=format:"%h %ad %s" --date=short`. Corrige os achados da
revisão adversarial da onda 4 que a onda 5 não fechou e os resíduos 101 a 127
das revisões seguintes, e faz a faxina de higiene da onda 9. Achados por número,
provas, execução, pendências e as decisões que aguardam o dono:
`docs/architecture/modernization.md`, seções "Revisão adversarial da onda 4",
"Revisões dos resíduos" e "Ondas 6 a 9"; causa e solução nas entradas 205 a 226
de `docs/issues/known-issues.md`.

#### Security

- **Login CSRF pelos proxies de OAuth (known-issues 210)**: a conclusão do
  `oauth-proxy` exige o cookie assinado `state` do próprio host
  (`__Host-<plataforma>.state`) e a mesma origem do início; o plugin
  `appAuthorization` só deixa o `expo-authorization-proxy` levar à URL do
  provedor emitida para um login do app, e a sessão do app sai só pelo deep
  link.
- **Respostas neutras e 503 da identidade (known-issues 210 e 211)**: `register`
  e `forgot-password` no better-auth respondem como o legado (202 e 200), sem
  revelar e-mail ou CPF cadastrado; falha do limitador vira `AuthUnavailable` e
  503 com `Retry-After`, também na rota real do NextAuth, nunca a mensagem
  interna no `?error=`.
- **Links de e-mail da conta global (known-issues 212)**: redefinição e
  verificação só saem na origem da locadora para cliente ativo dela sem vínculo
  de equipe; o resto vai para o host `app`.
- **Host de locadora (known-issues 213 e 214)**: a API de conta só no `basePath`
  do modo de autenticação (no `better-auth-v2`, nenhuma ação do NextAuth além da
  sessão); `q` com caractere de controle dá 400 antes do limitador.
- **Inventário de rotas em camadas (known-issues 218)**: regra estrutural com
  `PROLOGUE` e código INERT em gramática fechada, `instanceof` só com classes
  seladas, zod na carga só com construtores, resolução ambígua de módulo
  reprovada e a regra de lint `runtime/no-runtime-rewrite` (o servidor não
  reescreve o runtime); modelo de ameaça em `docs/architecture/security.md`.
- **Gates (known-issues 216)**: o `ratchet-guard` mede `css-important` sem as
  isenções da configuração e reprova escopo estreitado mesmo onde ainda não há
  dívida; as suítes unit, security e identity não saem para a rede
  (`tests/helpers/no-network.ts`).
- **Dados pessoais em log (known-issues 224)**: o cron de boleto vencido
  registra só o id do pagamento; 16 `console.log` de depuração saíram do
  frontend; `test-raw-prisma.mjs`, que imprimia a `DATABASE_URL`, foi apagado.

#### Fixed

- **Obrigação do orçamento (known-issues 205)**: regra única `quoteObligation`;
  edição não reprecifica cobrança emitida (409
  `PAYMENT_ADJUSTMENT_REQUIRES_RECONCILIATION`), aprovar a multa de novo não
  soma, revogar tira a multa, `finalTotal` e frete seguem os reajustes e `total`
  entra em centavos.
- **Preço (known-issues 206)**: `exactIntelligentPrice` em Decimal na tela e no
  servidor (meio centavo em `ROUND_HALF_UP`); total do carrinho pela regra da
  linha.
- **Emissão no Asaas (known-issues 207 e 208)**: falha provada sem efeito volta
  à fila; `UNKNOWN`, `PROCESSING` abandonada, `QUEUED` sem evento e cobrança
  aberta sem tentativa são religadas pelo cron da outbox (espera de 15 min a 6
  h, sem cobrança duplicada); só `ChargeRequestRejected` encerra o pedido
  (tentativa `FAILED`), e 400 numa leitura é falha passageira.
- **Asaas (known-issues 209)**: `paidAt` só de data é a data civil de São Paulo.
- **Cadastro (known-issues 212)**: o e-mail de verificação vai depois do commit
  (em host de locadora, o cadastro travava o pool de produção); falha de entrega
  não derruba o cadastro, e repetir o cadastro reenvia o link (1 a cada 5 min, 3
  por dia).
- **Painel (known-issues 215)**: sugestão `?locadora=` guardada até ser tratada
  e query preservada no índice `/admin`; no host `app`, rota privada sem sessão
  vai direto ao login com `callbackUrl`, só depois de a leitura da sessão
  responder.
- **`enroll` fora de host de locadora (known-issues 213)**: sempre 409
  `TENANT_REQUIRED`, antes de ler o corpo ou o banco.
- **Migrations (known-issues 217)**: `DROP INDEX IF EXISTS` na `0004`; as
  mensagens dos preflights de `0001` a `0005` mandam rodar
  `prisma migrate resolve --rolled-back` antes de repetir o deploy.
- **Estilo (known-issues 219 a 222)**: paleta do Tailwind 3.4.17 em hex
  (`#ea580c` de volta), `text-base`/`text-small` fluidos, `Text` com altura de
  linha em px, erro de validação visível por `aria-invalid`, anéis de foco só
  pelo `FOCUS_RING` e build da raiz sem o `!important` que vinha de `docs/`.
- **Paridade Tailwind 3 × 4 (known-issues 223)**: escalas, contorno
  (`outline-<n>` só dá a largura), `ring`, breakpoints em px, `hover:`,
  `transform`, `space-*` e preflight como na produção; o anel do navegador
  voltou aos gatilhos no foco por teclado.

#### Added

- `packages/domain/src/orcamento/obrigacao.ts` (`quoteObligation`,
  `quoteItemsAndFreight`, `planQuoteBaseCharges`) e
  `packages/backend/src/modules/quotations/base-charges.ts`.
- `packages/backend/src/modules/identity/app-authorization.ts` (plugin
  `appAuthorization`) e a regra única de modos e `basePath` em
  `packages/contracts/src/platform.ts` (`AUTH_MODES`, `betterAuthBasePath`,
  `parseAuthMode`).
- `packages/design-tokens/src/palette.css` e `scales.css`,
  `packages/frontend/src/app/styles/outline.web.css`, `FIELD_INVALID` e os
  tokens `--field-invalid`, `--field-invalid-halo` e
  `--shadow-control-invalid-focus`.
- `tools/eslint-runtime-rewrite.mjs` (regra `runtime/no-runtime-rewrite`), o
  gate `pnpm hygiene` (`knip.jsonc`, `tools/hygiene-check.mjs`,
  `tools/hygiene-knip-reporter.mjs`, `tools/hygiene-baseline.json`) e
  `tests/helpers/no-network.ts`.
- Testes: `tests/unit/quote-obligation-edits.test.ts`,
  `payment-issuance-database.test.ts`, `outbox-cron-database.test.ts`,
  `database-roles.test.ts`, `no-network.test.ts`,
  `eslint-runtime-rewrite.test.ts`, `hygiene-check.test.ts`,
  `ratchet-guard.hygiene.test.ts` e `boleto-overdue-alerts.test.ts`;
  `tests/security/nextauth-route.test.ts`, `auth-unavailable.test.ts` e
  `route-auth-normalization.test.ts`;
  `tests/identity/sign-up-commit.integration.test.ts`;
  `tests/visual/tailwind-parity.test.ts` com a fixture da produção;
  `packages/frontend/src/app/index.styles-build.test.ts`;
  `packages/ui/src/web/field.test.ts`, `focus-ring.test.ts` e
  `Text.web.test.tsx`; `packages/domain/src/equipamento/preco.test.ts` e
  `orcamento/obrigacao.test.ts`; `route-table.nextauth.test.ts` e
  `route-table.base-path.test.ts`; `RuntimeBootstrap.entrar.test.tsx` e
  `DateRangePicker.foco.web.test.tsx`.
- `AGENTS.md`, regra 8 ("Não Deixe Sobras").

#### Changed

- Inventário de rotas: regra estrutural no lugar da análise de fluxo;
  `POST /api/admin/rentals/[id]/contract` e o callback OAuth do Zoho passaram a
  chamar o guard primeiro, com o mesmo contrato HTTP.
- `POST /api/quotes` e `/api/orcamentos`: o guard de mesma origem é a primeira
  instrução, sem condição.
- Valor final manual vira reajuste `OTHER` da diferença; valor final legado é
  preservado como "Ajuste anterior do valor final" na próxima edição.
- Cada pacote declara as dependências que importa, os `latest` foram fixados na
  versão travada, o `.gitignore` cobre as saídas das ferramentas e
  `no-unused-vars` virou erro.
- Linha de base visual regravada nas ondas 8 e 9 (histórico em
  `tests/visual/README.md`); as linhas de base de arquitetura (1108 → 1050) e de
  tokens só baixaram.
- Sintaxe de classe: `outline-hidden` no lugar de `outline-none`, `[var(--x)]`
  no lugar de `[--x]` e a variante responsiva primeiro (`md:after:`).

#### Removed

- 75 arquivos mortos, 30 símbolos mortos e 630 linhas de código comentado
  (known-issues 225); cinco testes do domínio foram movidos para
  `packages/domain`, não apagados.
- 18 dependências sem uso, scripts mortos do `package.json`, 11 arquivos de
  `scripts/`, configs mortas (`vitest.storybook.config.ts`, `vitest.shims.d.ts`,
  `next-openapi-gen.config.js`, `.swcrc`, `vercel-optimized.json`,
  `scripts/.eslintrc.json`, `test-raw-prisma.mjs`) e o `webpack()` do
  `next.config.mjs` da raiz, que o Turbopack ignorava.
- O spread de `design-tokens/output/tokens-tailwind.json` no
  `tailwind.config.cjs`; as classes que a produção ignorava (opacidade fora da
  escala, `border-l-3`, `duration-160`, `flex-2`); 25 `focus:ring-orange-500`
  sem efeito.
- Documentos do usuário da raiz e de `context_window/` foram movidos, sem
  edição, para `docs/archive/`.

#### Pendente

- Decisões aplicadas por padrão que aguardam o dono (regras de assinatura da ADR
  SaaS B.5, casca do host `app`, carrinho mantido ao sair, conciliação
  conservadora, arredondamento da linha, paleta, tipografia e escalas da
  produção, classes removidas e itens "decidir" da faxina):
  `docs/architecture/modernization.md`, seção "Ondas 6 a 9".
- `pnpm test:integration` com servidor, `ratchet:guard` vermelho pelos exports
  CSS novos do design-tokens e a reemissão pelo lojista de tentativa `FAILED`.

### Onda 5 da modernização multiempresa (commit `55763c1e`, 2026-09-30)

Sem data de commit: os lotes abaixo existem só na árvore de trabalho local de
`modernizacao/multiempresa`, sobre o commit `4b02f52f`. A data entra aqui quando
o commit existir (`git log --pretty=format:"%h %ad %s" --date=short`). Cobre
seis lotes: segurança pendente da onda 4, conciliação de cobranças com o
provedor, dois defeitos do frontend sem mudança visual, cascata da produção com
o anel de foco laranja, higiene final do estilo e casca do host `app`. Provas,
decisões e pendências: `docs/architecture/modernization.md`, seção "Onda 5".
Outros lotes da onda 5, em andamento durante esta consolidação (por exemplo, o
plugin `appAuthorization` do login social do app, a API de conta do host de
locadora por modo de autenticação e a revisão das regras do domínio da
assinatura), registram as mudanças nos próprios documentos
(`docs/architecture/adr-tenant-hosts.md`,
`docs/architecture/adr-saas-subscription.md`,
`docs/features/tenant-slug-policy.md`, entrada 192 de
`docs/issues/known-issues.md`); a entrada deles aqui fica para o fechamento da
onda.

#### Security

- **CSRF central (known-issues 196)**: uma regra só em `same-origin-mutation.ts`
  (`@gb-locacoes/backend/identity`), aplicada como primeira instrução de
  `resolveTenantPrincipal`. Com isso as mutações de `/api/admin/**` no host
  `app` (antes só `admin/settings` conferia a origem) e os middlewares de
  `requireAdmin` (que montavam um GET sintético) recusam com 403 a origem de uma
  locadora irmã. Sem borda validada, a origem esperada é `WEB_PUBLIC_ORIGIN` ou
  a da própria requisição; sem `Origin` e sem `Sec-Fetch-Site` (app nativo,
  servidor-servidor), segue como antes. `register`, `forgot-password`,
  `reset-password`, `POST /api/quotes` e `POST /api/orcamentos` chamam o guard
  como primeira instrução. O inventário de rotas ganhou uma passagem CSRF.
- **Fluxos anônimos de conta (known-issues 191)**: o ramo better-auth de
  `register` e `forgot-password` conta a tentativa na mesma janela do legacy
  (`refuseAuthAttempt`); janela gasta responde 429 com `Retry-After`, limitador
  que não consegue contar responde 503 (antes, 500), com log `[auth-rate-limit]`
  sem e-mail, IP nem segredo. `handleIdentityRequest` registra `[identity]` sem
  corpo nem caminho completo.
- **Segredo do limitador**: `PLATFORM_RATE_LIMIT_SECRET` segue o critério de
  produção da plataforma (`isPlatformProduction`, por `resolvePlatformEnv`), não
  mais `NODE_ENV`: `PLATFORM_ENV=production` sempre exige; preview da Vercel e
  `PLATFORM_ENV=development` usam chave local; ambiente inválido conta como
  produção.

#### Fixed

- **Cascata do Tailwind 4 (known-issues 195)**: as regras de elemento (cor de
  borda padrão, tipografia de `h1`–`h3`, `p` e `small`, `section`) voltaram para
  `@layer base`, e as classes utilitárias voltam a vencê-las, como na produção
  (`main`, Tailwind 3.4.17); a barra de rolagem padrão foi para `components`.
  Prova contra a produção no mesmo DOM: 29.587 de 29.625 bordas e 6.221 de 6.288
  tipografias iguais.
- **Carrinho salvo apagado na troca de escopo (known-issues 197)**: entrar, sair
  ou trocar de locadora não apaga mais o carrinho salvo do escopo anterior;
  durante a troca o carrinho fica desligado do armazenamento.
- **Retorno do login (known-issues 198)**: o "Entrar" da área privada leva
  `callbackUrl` (caminho visível mais a query) e o "Solicitar Orçamento" passa o
  retorno pelo `safeInternalCallback`.
- **Cobrança anterior `CANCELLED` sem prova (known-issues 199)**: o leitor do
  provedor está ligado no boleto do orçamento e o mesmo critério vale no pedido
  de PIX ou boleto, que antes gerava cobrança nova sem consultar o Asaas.
  Divergência 409, indisponibilidade 503, chave recusada ou resposta fora do
  contrato 502; nunca uma segunda cobrança.
- **Diálogos (known-issues 200)**: o X do `Dialog` e do `Sheet` aberto por
  clique não mostra mais o anel de foco; o `Drawer` solta a trava de rolagem do
  `body`.
- **Revelação por rolagem (known-issues 201)**: `slide-in-up` sobe 60 px, como
  na produção; com movimento reduzido, o primeiro quadro não esconde mais os
  elementos parados (`motion-safe:` no JSX).
- **Escapes no JSX (known-issues 203)**: textos com `\u00XX` que apareciam
  literais no cadastro de equipamento ("Especificações Técnicas").
- **Seletor de locadora do painel**: bloco de 466 px virou uma barra de 53 px no
  web (a causa, `line-height` sem unidade no `Text`, continua aberta:
  known-issues 204).
- **Migrations `202609260001` a `0003`**: `lock_timeout` e `statement_timeout`
  como na `0004`; a `0001` usa o índice único como a própria checagem
  (known-issues 192).

#### Added

- `packages/backend/src/modules/billing/cancelled-charges.ts`,
  `readTenantProviderCharge` e `cancelledChargeError`
  (`lib/payment-obligation.ts`), `scripts/ops/legacy-cents-report.ts` (somente
  leitura) e o runbook `docs/guides/legacy-cents-reconciliation.md`.
- `widgets/casca-plataforma`, a prop `chrome` do `ClientLayoutShell` e do
  `AppHostProviders`, a prop `shell` de `LoginPage`, `RecuperarSenhaPage` e
  `ResetPasswordPage`, e `TenantSelector.web.tsx`/`.native.tsx` com
  `ui/contract.ts`.
- `app/providers/current-query.ts`/`.web.ts`/`.native.ts` e `signInHref`
  (`features/entrar`).
- Token `--focus-ring` (e `--color-focus-ring` na ponte `@theme`) e tokens
  nomeados no `tokens.css` no lugar das variáveis com nome de hash.
- `token-check`: leitura do config JS do Tailwind e dos plugins locais e regra
  absoluta `jsx-text-escape`; gancho `check` no harness da linha de base visual.
- Testes: `tests/security/admin-same-origin.test.ts`,
  `account-flows-guard.test.ts`, `identity-request-log.test.ts`,
  `tests/unit/cancelled-charge-proof-database.test.ts`,
  `legacy-cents-report.test.ts`, `Dialog.foco.web.test.tsx`,
  `Sheet.foco.web.test.tsx`, `Drawer.trava-rolagem.web.test.tsx`,
  `ScrollRevealInit.primeiro-quadro.web.test.tsx`,
  `ScrollRevealInit.seletores.web.test.tsx`,
  `TenantSelector.barra.web.test.tsx`, `ClientLayoutShell.casca.web.test.tsx`,
  `app/(auth)/layout.test.tsx`, `app/(auth)/recuperar-senha/page.test.tsx` e os
  `*.casca.native.test.tsx` das três páginas de conta.
- `.env.example`: `TRUSTED_PROXY_HOPS`, com comentário.

#### Changed

- **Arquitetura do CSS**: camadas `theme, base, components, utilities` (sem
  `legacy`); `data-own-frame` tira botões da variante `controls:`; anel de foco
  por teclado no laranja da marca (`#ea580c`, decisão do usuário); linha de base
  visual regravada em 2026-09-29 e `approved-changes.json` vazio. Ver
  `docs/features/design-system.md`, seção "Arquitetura do CSS".
- **Páginas de conta do host `app`**: `/login`, `/recuperar-senha`,
  `/reset-password`, `/auth/callback` e `/admin/login` usam a casca da
  plataforma (barra com o nome provisório, sem cabeçalho, rodapé e WhatsApp da
  vitrine); o host de locadora não muda.
- **`css-important`**: sem exceção de movimento reduzido e cobrindo o
  `important` do config JS e os plugins locais. O Tailwind não lê mais testes
  nem fixtures, e o CSS do `build:web` só tem o `!important` do preflight do
  próprio Tailwind.
- **Classes sem efeito**: 161 removidas em 79 consumidores de 23 arquivos (a
  moldura do componente já as descartava).
- **Cobranças**: mensagens "Cobrança anterior…" iguais para PIX e boleto;
  conflito conta cobrança vigente de qualquer meio.
- `createLoginRole` também em `tenant-slug-policy.test.ts` e
  `tenant-database.test.ts`.

#### Removed

- `packages/frontend/src/app/styles/legacy.web.css` (camada `legacy`) e os
  marcadores `data-own-border` e `data-own-type`.
- `packages/design-tokens/src/legacy.css`, com o import e o export.
- Config morto do `tailwind.config.cjs` (`slideInUp`, `fontFamily.heading`,
  `letterSpacing.normal`, cores `ring` e `chart`, plugin das classes `*-compat`
  e entradas de `content` repetidas).
- Classes sem elemento citadas pelo `ScrollRevealInit` (`.animate-on-scroll`,
  `.category-card-animate`, `.animate-on-scroll-delayed` e
  `.hero-badge-bottom`).

### Onda 4 da modernização multiempresa (commit `4b02f52f`, 2026-09-26)

Registrada no commit local `4b02f52f` de `modernizacao/multiempresa` (data do
`git log --pretty=format:"%h %ad %s" --date=short`). O texto abaixo foi escrito
antes do commit, sobre `be859915`. Corrige os 28 achados da revisão adversarial
da onda 3 e tira o último `!important` do código. Achados por número, provas,
execução das suítes e pendências: `docs/architecture/modernization.md`, seções
"Revisão adversarial da onda 3" e "Onda 4".

#### Security

- **Borda do backend sem `WEB_API_ORIGIN` (achados 1 e 24)**: um backend de
  produção sem essa variável, que é só do web, tinha a borda de host desligada
  em toda requisição e, no modo better-auth, `identityConfiguration` falhando.
  `resolvePlatformEnv`, comum aos dois processos, não exige nem recusa mais a
  variável (`apiOrigin` null); `resolveWebPlatformEnv`, usado só pelo `proxy.ts`
  e pelo `public-api.ts`, a exige em produção, com https fora de development
  (known-issues 188).
- **CSRF entre locadoras irmãs (achado 2)**: guard `rejectCrossOriginMutation`
  (`@gb-locacoes/backend/identity`) em 16 handlers de mutação com cookie (cart,
  addresses, notificações, locações, orçamento, perfil, assinatura de contrato e
  frete). Com borda validada, `Origin` diferente da borda ou `Sec-Fetch-Site`
  fora de `same-origin`/`none` dão 403 `no-store` (known-issues 190).
- **API de conta no host de locadora (achados 26 e 27)**: `'/api/auth/**'` saiu
  da allowlist. Fica só a lista mínima `TENANT_ACCOUNT_API` (fora do modo
  legacy), e `TENANT_API_DENYLIST` bloqueia sessões, perfil, e-mail, senha,
  exclusão, contas OAuth, callback do provedor e a lista e seleção de
  organizações. Saíram três entradas sem chamador: `/api/equipments/*`,
  `/api/contracts/sign` e `/api/payments/boleto/*/pdf` (known-issues 189).
- **Limitadores de login (achados 17 a 20 e decisão H7a)**:
  `verifyLegacyCredential` é o único caminho de credencial legada (NextAuth e
  Better Auth), com a tentativa contada antes da busca e bcrypt sempre; teto de
  100 tentativas por conta a cada 15 min; com borda validada, o IP nunca vem do
  `x-real-ip` do proxy; cada limitador genérico tem o próprio store;
  `PLATFORM_RATE_LIMIT_SECRET` obrigatória em produção (`PlatformEnvError`)
  (known-issues 191).
- **`callbackUrl` (achado 22)**: `safeInternalCallback` recusa segmentos de
  ponto e codificação dupla que levavam a outra origem (`/.//evil.test`)
  (known-issues 162).
- **`GET /api/auth/organizations/current` (achado 4)**: fora de host de locadora
  responde sempre 409 `{ error, code: 'TENANT_REQUIRED' }` com
  `private, no-store` e `Vary: Cookie, Host`, sem consultar o banco e ignorando
  `tenantSlug` na query.

#### Fixed

- **Quitação em centavos (achados 7 e 9)**: um total fracionário (ex.:
  128.5714...) pago pelo valor cobrado (128.57) nunca quitava. Saldo único em
  `@gb-locacoes/domain/locacao` (`roundToCents`, `obligationBalance`, com
  `ROUND_HALF_UP`) para quitação, cobrança e conversão; totais, multas e taxas
  arredondados na origem (known-issues 186).
- **Reemissão de boleto (achado 8)**: um boleto `CANCELLED` local só é tratado
  como extinto com prova; sem prova, a emissão reconcilia com o provedor (porta
  opcional `readProviderCharge`) ou responde 409, e nunca emite um segundo
  boleto vivo (known-issues 187).
- **Login da equipe no host `app` (achados 25 e 28)**: `app.<raiz>/login` com o
  `LoginPage` do produto e retorno preso a `/admin/**`; `/admin/login` leva a
  ele e `/admin` decide pela sessão. `proxy.ts` ganhou testes de verdade
  (known-issues 189).
- **Carrinho no `/orcamento` (achado 21)**: no web, a página montava com o
  carrinho da locadora anterior; agora espera a troca de escopo em qualquer
  transição (known-issues 193).
- **Identidade multi-host (pendências do H6)**: `forgot-password` e `register`
  no modo better-auth passam `request` e `redirectTo` relativo (link na origem
  do host); as páginas `reset-password` repassam o `?token=`; o `expoClient` usa
  `cookiePrefix: PLATFORM.name`; assuntos por `identitySubject`
  (`PLATFORM.displayName`) (known-issues 180).
- **Gates e CI (achados 5, 6 e 10 a 16)**: o `ci.yml` de `be859915` era YAML
  inválido (nome de passo com `: ` sem aspas) e nenhum job rodava; push não é
  mais cancelado; `ratchet-guard` localiza a baseline pela configuração da base
  e exige prova de renomeação nas transferências; o inventário de rotas conhece
  o formato do resultado de cada guarda; a migration `0004` usa `lock_timeout` e
  não trava mais leituras; testes de banco criam papel LOGIN com senha (SCRAM)
  (known-issues 192).
- **Teste de borda forjada vazio (achado 3)**: usava o subdomínio reservado
  `beta`; agora usa `bravo`, com controles positivos.

#### Added

- `packages/domain/src/locacao/saldo.ts`; `same-origin-mutation.ts` em
  `packages/backend/src/modules/identity`;
  `apps/clients/web/src/app/(auth)/login/page.tsx` e `resolvePanelCallback`
  (`pages/login`); prop `allowSignUp` do `LoginPage` (padrão `true`).
- `pnpm test:contract` (`vitest.contract.config.ts`, `tests/contract/**`) e
  `pnpm lint:css` (`.stylelintrc.json` estrito e
  `tools/stylelint-css-structure.mjs`), os dois com passo no CI.
- `tests/helpers/database-roles.ts` (papel LOGIN com senha para testes de
  banco), `tests/unit/ci-workflow.test.ts`, `tests/unit/ratchet-guard.test.ts`
  (em `test:gates`), `tests/security/tenant-auth-api.test.ts`,
  `apps/clients/web/src/proxy.test.ts` e
  `apps/clients/mobile/src/app/_layout.test.tsx` (layout real do expo-router).
- `@gb-locacoes/design-tokens/theme.css` e `/tokens.css`; em `packages/ui`,
  `field.ts`, `trigger.ts` e `cn.ts`, as exportações `FOCUS_RING`, `FILTER_CARD`
  e `HEADER_MENU_TRIGGER` e as variantes `filter-reset` e `header-action` do
  `Button`.

#### Changed

- **Arquitetura do CSS**: `!important` zerado e regra `css-important` de
  tolerância zero (todo escopo, sem baseline); camadas
  `theme, base, components, utilities, legacy`, sem `overrides`; tokens `:root`
  e `.dark`, camadas de `z-index` e tokens nomeados em `packages/design-tokens`;
  estilos de formulários, botões e gatilhos nos componentes; `globals.web.css`
  só como entrada e 12 arquivos de uma responsabilidade (`typography.web.css` e
  `vendor.web.css` saíram); keyframes em kebab-case. Comparação visual sem
  diferença não aprovada. Ver `docs/features/design-system.md`, seção
  "Arquitetura do CSS" (known-issues 194 e 195).
- **Rolagem suave**: sem o atributo `data-scroll-behavior` nos layouts;
  `html { scroll-behavior: smooth }` em `@layer base`. O `ScrollRevealInit` não
  grava transição inline nos elementos com transição do CSS nem `overflow` na
  página Sobre, e respeita `prefers-reduced-motion`; `scrollRevealReady` e os
  tempos não mudaram.
- **Mapa**: o estilo do Shadow DOM do `gmpx-store-locator` vai numa folha
  adotada no fim de `adoptedStyleSheets`, sem `!important`.
- **Inventário de rotas**: formatos de resultado dos `GUARDS`,
  `PUBLIC_TENANT_SURFACE` (12 métodos), dono `CLIENT` só pelo parâmetro de rota
  e `import()`/`require()` como acesso a dados.
- **ESLint**: importar `usePathname` fora de `use-visible-pathname.web.ts` é
  erro em todo o `packages/frontend` (a exceção dos seis widgets saiu).
- **Mobile**: `metro.config.js` bloqueia testes em `src/app`, e
  `tsconfig.test.json` inclui esses testes com a lib DOM.
- `PLATFORM_NAME` não é mais lido pelas rotas de identidade; o comentário de
  `PLATFORM_RATE_LIMIT_SECRET` no `.env.example` diz que ela é obrigatória em
  produção.

#### Removed

- `packages/frontend/src/app/providers/RuntimeBootstrap.gate-navigation.test.tsx`
  (copiava a lógica do host e importava `node_modules` do mobile; substituído
  pelo teste do layout real).

#### Pendente

- `pnpm tokens` sai 1: 5 classes de paleta no fallback do `Suspense` de
  `apps/clients/web/src/app/(auth)/login/page.tsx` (arquivo novo).
- Leitor do provedor não ligado em `lib/quote-boleto.ts` (boleto `CANCELLED`
  legado sem prova responde 409).
- Decisões do usuário listadas em `docs/architecture/modernization.md`, seção
  "Onda 4": camada `legacy` do CSS, movimento reduzido sem JS, CSRF em
  `/api/admin/**`, shell do login da equipe, leitor do provedor, teto por conta
  e critério de produção do segredo do limitador.

### Onda 3 da modernização multiempresa (commit `be859915`, 2026-09-26)

Registrada no commit local `be859915` de `modernizacao/multiempresa` (data do
`git log --pretty=format:"%h %ad %s" --date=short`). O texto abaixo, inclusive a
lista "Pendente", foi escrito antes do commit; o destino de cada pendência está
em `docs/architecture/modernization.md`, seção "Onda 3".

#### Security

- **Identidade multi-host com Better Auth (Lote 6 da ADR de hosts)**: `baseURL`
  fixo na origem do `app.` fora de development; origens confiáveis por
  requisição (estáticas mais a origem exata da borda de locadora ou `app`, nunca
  curinga; `BETTER_AUTH_TRUSTED_ORIGINS` é recusada); estado OAuth no banco e
  `oAuthProxy` com 60 s; cookie `__Host-locadora.session_token` sem `Domain` em
  https e `crossSubDomainCookies`/`trustedProxyHeaders` desligados.
  `handleIdentityRequest` reconstrói a requisição com a origem da borda, sem
  `x-forwarded-*`. T9 e T10 em `tests/identity/multi-host.integration.test.ts`.
- **Curingas do `ILIKE` fora do login**: `synchronizeLegacyCredential` passou a
  `findUnique` pelo e-mail normalizado; a checagem de categoria duplicada e o
  `provision-admin` da CLI de manutenção usam `lower(...) = lower($1)`
  parametrizado (known-issues 172).
- **Limitador de autenticação persistente (Lote 7a)**: login, cadastro,
  recuperação e aviso ao titular gravam em `platform_rate_limits` (upsert
  atômico, janela fixa, chave HMAC-SHA256 com `PLATFORM_RATE_LIMIT_SECRET`) e
  valem entre instâncias; falha do armazenamento nunca libera a tentativa.
  `clientIpFromHeaders` prefere o `edge.clientIp` da borda validada
  (known-issues 176).
- **IP da auditoria**: `lib/audit-logger.ts` usa `clientIpFromHeaders` em vez do
  `X-Forwarded-For` cru (known-issues 181).
- **Cliente HTTP único do Asaas (S4)**: origem fixa por ambiente,
  `redirect: 'error'`, ids codificados por `asaasPath`, interruptor
  `PLATFORM_ASAAS_OUTBOUND_DISABLED`, saída por IP fixo que falha fechada
  (`PLATFORM_ASAAS_EGRESS_PROXY_URL`), chave em `AsaasSecretValue` e nenhum
  corpo, header, query ou `description` do Asaas em erro ou log.
- **Sanitização por plataforma**: `sanitize.web.ts` (DOMPurify) e
  `sanitize.native.ts` (só texto visível, nunca HTML), atrás de
  `sanitize-contract.ts` (known-issues 184).

#### Fixed

- **CNPJ alfanumérico no Asaas**: busca e cadastro de cliente não apagam mais as
  letras (`normalizeAsaasDocument`; known-issues 173).
- **Valor da cobrança em `Decimal`**: `issue-payment` e `cancel-attempt`
  comparam com `sameAmount` em vez de `!==` em `number`; `issuePayment` valida
  valor, vencimento e documento antes da reserva (known-issues 174).
- **Prorrogação de locação**: `RentalMutationError` responde 409 ou 404 com a
  mensagem do domínio, não 500 (known-issues 182).
- **Mensagens de orçamento corrompidas** (UTF-8 lido como cp850) em
  `quotations/update.ts` (known-issues 175).
- **Redefinição de senha legacy**: `bcrypt.hash` assíncrono (custo 12) no lugar
  de `hashSync`.
- **Modo host**: `Cabecalho`, `Busca`, `AreaCliente`, `BarraMobile`,
  `BarraLateral` e `BarraLateralMobile` usam `useVisiblePathname`; os links de
  `EquipamentosPage.native.tsx` passam pelo resolvedor de href (known-issues
  185).
- **Trava de rolagem do Radix** resolvida na origem por
  `useReleaseScrollLockRef`, sem as 22 declarações `!important` globais
  (known-issues 178).

#### Added

- **Contratos da plataforma SaaS (S0)**:
  `@gb-locacoes/contracts/{subscription,entitlements,onboarding,payment-account,backoffice}`
  (zod estritos e universais); reservados `backoffice`, `console`, `ops`,
  `comecar`, `planos` e `vincular`; `blockedSlugTerms` (palavra inteira entre
  hífens), `hasBlockedSlugTerm`, `isSignupSlug`, `disposableEmailDomains` e
  `isDisposableEmail` em `platform.json`/`platform.ts`; variáveis do B.14 com
  placeholders no `.env.example`. Docs em `docs/features/` (assinatura, limites,
  onboarding, recebimentos e backoffice).
- **Domínio da assinatura e de documentos (S1)**:
  `@gb-locacoes/domain/assinatura` (`derivarEstado` puro em dia civil de São
  Paulo, política comercial, troca de plano sem pró-rata, reativação, direitos
  efetivos) e `@gb-locacoes/domain/documento` (CPF, CNPJ numérico e
  alfanumérico). `orcamento/documento.ts` delega ao módulo novo.
- **Adapter do Asaas (S4)**: `billing/asaas-http.ts`, `billing/asaas-amount.ts`,
  eventos tipados em `asaas-events.ts`, parser da criação de subconta nos dois
  formatos de chave, dublê de contrato em `tests/helpers/fake-asaas/**` e
  `tests/contract/asaas-fake.test.ts` (73 testes).
- **Diretório público (Lote 7a)**: `GET /api/public/tenants?q=` (no máximo 10
  locadoras ACTIVE com opt-in, só slug, nome, cidade e UF; 30 buscas por minuto
  por IP), migration `202609260006_platform_directory_rate_limit`
  (`Organization.directoryListed` e `PlatformRateLimit`) e limpeza no cron de
  outbox. Ver `docs/features/tenant-directory-search.md`.
- **Vínculo do cliente (Lote 6)**: `POST /api/client/enroll` (consentimento,
  `Membership(CLIENT)`, `ClientProfile` e `AuditLog` `CLIENT_ENROLLED`), página
  `/vincular` no host de locadora, `RuntimeBootstrap` em modo host com
  `/api/auth/organizations/current` e confirmação do `?locadora=` no painel. Ver
  `docs/features/tenant-client-enrollment.md`.
- **Gates**: regra `css-important` na catraca do `pnpm tokens` (CSS, Tailwind e
  inline; só o bloco de movimento reduzido é exceção); `pnpm check:test-names`
  (`tools/test-colocation-check.mjs`, allowlist com motivo em
  `tools/test-colocation-allowlist.json`), com passo no job `architecture` do CI
  e teste em `test:gates`.
- **Linha de base visual do web**: `tests/visual/**` e
  `tools/visual-baseline/**` (estilo computado de cada elemento visível em 390 e
  1440 px, 476 capturas, comparação com aprovações em
  `tests/visual/approved-changes.json`).

#### Changed

- **CSS em camadas**: `@layer theme, base, components, utilities, overrides`
  (`overrides.normal`, `overrides.forced`); estilos globais levados para os
  componentes; `globals.web.css` dividido em `base`, `typography`, `layout`,
  `components`, `animations` e `vendor`. `!important` caiu de 415 para 22, cada
  exceção com motivo (known-issues 177 e 179).
- **Anel de foco** só por teclado (`:focus-visible`, 2px, token `--ring`,
  afastado 2px; `FOCUS_RING` e `MENU_FOCUS_RING` em `packages/ui`), no lugar da
  remoção de contorno. Aprovação visual pendente.
- **Testes colocados renomeados** para o nome do arquivo testado (41 arquivos,
  conteúdo idêntico salvo 2 caminhos): 23 `contrato.migracao.test.ts` viraram
  `index.contract.test.ts`; os de `app/providers` viraram `RuntimeBootstrap.*`,
  `SessionProviderWrapper.web` e `public-tenant-routing.host-mode.web`;
  `Dica.test.tsx` virou `packages/ui/src/web/HybridTooltip.web.test.tsx`; os de
  rotas do host web viraram `decide.visible-routes` e
  `route-table.tenant-api-allowlist`. `lib/formatters.test.ts` foi removido (as
  mesmas asserções existem em `shared/lib/moeda.test.ts`).
- **Cookie de sessão do Better Auth** passa a `locadora.session_token` (http) e
  `__Host-locadora.session_token` (https): sessões existentes terminam no
  deploy. O link de redefinição no modo better-auth vai para
  `<origem do host>/reset-password?token=`.
- **Zoho**: com a plataforma multi-host, o redirect é fixo em
  `https://app.<raiz>/api/admin/zoho-mail/oauth/callback` e o callback volta ao
  painel por caminho relativo.
- **Asaas**: 429 passou de `REJECTED` para `UNAVAILABLE`/`RATE_LIMITED`
  (retentável); `BillingProviderError` ganhou `reason`, `status`,
  `providerCodes`, `retryAfterSeconds` e `maybeApplied`.
- **Documento**: `validateCPF` e `validateCNPJ` ficaram mais estritos (caractere
  fora da máscara invalida); CNPJ em minúsculas vira maiúsculas.
- `consumeAuthAttempt`, `clearAuthAccountAttempts`, `resetAuthAccountAttempts` e
  `consumeAccountNotice` agora são `async`.

#### Pendente

- Testes vermelhos entre lotes: `decide.visible-routes.test.ts` (2 casos; falta
  `/vincular`, 48 URLs e 13 páginas de conta) e `tests/visual/compare.test.ts`
  (1 caso; exige `approved-changes.json` vazio, e o lote de CSS registrou ali 30
  aprovações do anel de foco).
- Identidade: links de e-mail de `forgot-password` e `register` na origem do
  `app.`; páginas `reset-password` sem o `?token=`; `cookiePrefix` no
  `expoClient` do mobile (known-issues 180).
- `tests/contract/**` fora de qualquer config do vitest e do CI; scripts
  `visual:capture`, `visual:compare` e `test:visual-tools` ainda não existem no
  `package.json`.
- Bloco de exceção de `usePathname` em `eslint.config.js` ficou obsoleto.
- Decisões do usuário listadas em `docs/architecture/modernization.md` (anel de
  foco, exceções de `!important`, segredo do rate limit em produção,
  divergências da ADR SaaS, transporte com `undici`).

### Onda 2 da modernização multiempresa (commit `da19f601`, 2026-09-26)

Registrada no commit local `da19f601` de `modernizacao/multiempresa` (data do
`git log --pretty=format:"%h %ad %s" --date=short`). Estado dos gates e
pendências: `docs/architecture/modernization.md`.

#### Security

- **Identidade legacy (achados identity#0–#6 da revisão da onda 1)**:
  - A conta é localizada por e-mail exato normalizado (`findAccountsByEmail` em
    `lib/auth.ts`). `%`, `_` e `\` deixam de funcionar como curingas do `ILIKE`
    no login, no OAuth, no cadastro e na recuperação. Contas que diferem só pela
    caixa contam como ambíguas e a operação é negada.
  - Bloqueio só por requisitante: login com 20 tentativas por IP e 5 por (conta,
    IP) a cada 15 min. Acima de 10 tentativas por conta (somando todos os IPs)
    em 15 min, cada tentativa espera de 0,5 s a 5 s, sem bloqueio e com a senha
    ainda verificada.
  - Cadastro: 10 por IP e 5 por e-mail-alvo a cada 15 min; aviso "Tentativa de
    cadastro" no máximo 1 a cada 6 h por conta. Recuperação: 5 por IP e 3 por
    (conta, IP), com no máximo 3 e-mails por conta a cada 15 min, sem erro
    visível.
  - IP do cliente só de fonte confiável (`clientIpFromHeaders`):
    `TRUSTED_PROXY_HOPS=N` (N-ésima entrada do `X-Forwarded-For` pela direita)
    ou `VERCEL=1` (`x-real-ip`). Em produção sem nenhum dos dois não há janela
    por IP. IPv6 é agrupado por /64.
  - Chaves do limitador em HMAC-SHA256, sem e-mail ou IP cru, e teto de 50.000
    entradas no `MemoryRateLimitStore`.
  - bcrypt fictício para conta inexistente ou sem senha; e-mails de identidade
    enviados com `after()`; os três ramos do cadastro respondem 202 com o mesmo
    corpo.
- **JSON-LD escapado (V22)**: `serializeJsonLd`
  (`packages/frontend/src/shared/lib/seo`) escapa `<`, `>`, `&`, U+2028 e U+2029
  em `StructuredData`, `SEOSchemas` e `EquipamentoTrilha`. Um nome com
  `</script>` não fecha mais o bloco.
- **`callbackUrl` sem redirecionamento aberto (frontend-runtime#2)**:
  `safeInternalCallback` exige uma única `/` inicial e recusa `//`, `/\`,
  qualquer barra invertida, controles C0/DEL (TAB/CR/LF), esquemas e codificação
  malformada, conferindo a mesma origem com `new URL`.
- **Guarda de autenticação por rota segue o fluxo (public-surface#0, #1, #3)**:
  `tests/security/route-auth-inventory.test.ts` exige que o resultado do helper
  seja retornado ou testado com saída (`return`/`throw`) em todo caminho antes
  de qualquer acesso a dados. Em `/api/admin`, `resolveTenantPrincipal` só
  autoriza com comparação do papel do principal contra uma allowlist de papéis
  de equipe. O inventário passa a cobrir `export const { GET } =`,
  `export { x as GET }`, `export { GET } from` e `export * from`. `getIdentity`
  deixou de ser helper aprovado; cadastro, recuperação, redefinição e
  verificação de e-mail entraram no `PUBLIC_ALLOWLIST` com a invariante
  `IDENTITY_FLOW`.
- **Borda de host validada no backend**: `readPlatformEdgeContext` compara
  `x-platform-edge-auth` com `PLATFORM_EDGE_SECRET` e
  `PLATFORM_EDGE_SECRET_PREVIOUS` em tempo constante e revalida a origem com
  `classifyHost`. O proxy do host web remove todo `x-platform-*` recebido do
  cliente.
- **Jobs de orçamento**: `expire-quotes` e `auto-convert-quotes` filtram
  explicitamente por `tenantId` (sob RLS FORCE o resultado é o mesmo; sem RLS o
  código antigo atravessava locadoras).

#### Fixed

- **Conversão paga após cobrança CANCELLED/REFUNDED (data-integrity#0)**: a
  quitação considera só cobranças vigentes (`isObligationSettled` em
  `packages/domain/src/locacao/reserva.ts`): tipos RENTAL/DEPOSIT, ignora
  CANCELLED e REFUNDED, exige ao menos uma PAID, todas as vigentes PAID e soma
  PAID ≥ `finalTotal ?? total`, em Decimal. A mesma regra vale no check-out e no
  bloqueio de estoque. O boleto do orçamento é reemitido quando o anterior foi
  cancelado ou estornado, sem alterar a linha antiga.
- **Preflights de migration sob FORCE RLS (data-integrity#1)**: os blocos `DO`
  de `202609260001` a `0004` suspendem e restauram o `FORCE ROW LEVEL SECURITY`
  no mesmo comando e passam a ver todas as linhas quando o dono das tabelas não
  tem `BYPASSRLS`.
- **Portão da área privada (frontend-runtime#1)**: `PrivateAreaGate` substitui a
  troca de filhos no `RuntimeBootstrap`; o `<Stack/>` do Expo Router e a árvore
  de rotas web ficam sempre montados.
- **"Solicitar Orçamento" durante `loading` (frontend-runtime#3)**: o clique
  fica pendente com `aria-busy` até a sessão resolver; usuário autenticado não é
  mais mandado para `/login`. O teste de `awaitSession` passou a provar a espera
  do escopo do carrinho (frontend-runtime#4).
- **Gates (gates-tokens#0–#5)**: `check:tokens` compara o estado medido com
  `tools/token-propagation-expectations.json`; a raiz legada entrou nas
  catracas; o token-check reconhece as formas de cor do Tailwind 4.3.3; listas
  web-only completadas; `hslTripleToHex` normaliza matiz negativa.
- **`pnpm build:web` volta a passar**: o Turbopack usa
  `apps/clients/web/src/proxy.ts` em vez do `proxy.ts` da raiz.

#### Added

- **Contrato da plataforma por host (Lote 0)**:
  `packages/contracts/src/platform.json` (nome provisório `locadora` e
  subdomínios reservados), `platform.ts` (política de slug, `classifyHost`,
  `resolvePlatformEnv`, origens e cabeçalhos de borda) e `directory.ts` (schemas
  estritos do diretório público), exportados em
  `@gb-locacoes/contracts/{platform,platform.json,directory}`. ADR
  `docs/architecture/adr-tenant-hosts.md`. `.env.example` com as variáveis
  `PLATFORM_*` e sem a duplicata de `WEB_API_ORIGIN`.
- **Política de slug no banco (Lote 3)**: migration
  `202609260005_organization_slug_policy` (CHECK `organizations_slug_dns_label`
  com preflight que aborta sem alterar dados) e `pnpm tenant:slug-preflight`
  (`tools/tenant-slug-preflight.mjs`, somente leitura). Ver
  `docs/features/tenant-slug-policy.md`.
- **Resolução pública por requisição (Lote 2)**: `resolvePublicRequestTenant`
  (400 `TENANT_CONFLICT`, 409 sem locadora, 404 neutro idêntico),
  `resolvePrincipal` por candidatas host/header/cookie, módulo
  `@gb-locacoes/backend/directory` e rotas `GET /api/equipments/[id]`,
  `GET /api/public/tenants/[slug]` e `GET /api/auth/organizations/current`. Ver
  `docs/features/tenant-request-resolution.md`.
- **Host web por host (Lote 4b)**: `apps/clients/web/src/proxy.ts` puro (tabela
  de decisão por host, allowlist do host de locadora, remoção do cookie
  `selected-tenant-id`, 404 neutro, www→apex, labs com flag), árvore
  `(public)/[locadora]`, `(platform)/plataforma` e grupos do host `app`,
  providers por grupo, gateway server-only `host/server/public-api.ts`,
  `tools/generate-public-entries.mjs`, `vitest.web.config.ts` e
  `tests/e2e/tenant-hosts.spec.ts`. Ver `docs/features/tenant-hosts-web.md`.
- **Frontend em modo host (Lote 4a)**:
  `usePublicTenantRouting({ mode: 'host' })`, `useVisiblePathname` com regra de
  lint contra `usePathname` em `packages/frontend`, `HrefResolverProvider` e
  `PrivateAreaGate` (exportado por `@gb-locacoes/frontend/app`).
- **Módulos backend `rentals` e `quotations`** em `packages/backend`, com testes
  de caracterização HTTP (`tests/unit/rentals-http.test.ts` e
  `tests/unit/quotes-http.test.ts`, 27 cada) e
  `tests/unit/quote-settlement-database.test.ts`.
- **Âncora das catracas**: `tools/ratchet-guard.mjs` (`pnpm ratchet:guard`), com
  `--rename` (registra em `tools/ratchet-transfers.json`) e `--adopt-coverage`.
  Scripts novos: `ratchet:guard`, `test:gates`, `test:mobile` e
  `tenant:slug-preflight`.

#### Changed

- **Cotação e locação extraídas** para `@gb-locacoes/backend/rentals` e
  `/quotations`. `lib/*` virou fachada de composição e as rotas de
  `admin/quotes`, `admin/rentals`, `client/rentals`, `quotes/[id]` e
  `cron/auto-convert-quotes` viraram adaptadores. O contrato HTTP não mudou.
- **Raiz legada nas catracas**: regras `LEGACY-DEEP-IMPORT`, `LEGACY-DOM-JSX` e
  `LEGACY-WEB-LIB` no arch-check e `legacyScope` no token-check. As baselines
  foram estendidas só com a cobertura nova medida no código de HEAD
  (`--adopt-coverage`). Arquitetura hoje: 1109 ocorrências em 92 arquivos
  (`WORKSPACE-ESCAPE` caiu de 3 para 0 com o gateway do host web).
- **CI e Docker**: `ci.yml` é a fonte única (Node de `.node-version`,
  `migrate deploy`, jobs `architecture`, `tests`, `builds` e `docker`).
  `test.yml`, `ci-fallback.yml`, `ci-simple.yml` e os `*.disabled` foram
  removidos; o job `storybook-build` saiu junto com o `test.yml`. Dockerfile com
  `node:24.21-alpine`, manifests do workspace, corepack por estágio e usuário
  não-root; `.dockerignore` reescrito.
- **Contratos HTTP em entrada contraditória**: query e corpo com locadoras
  diferentes, ou `tenantSlug` repetido com valores distintos, respondem 400
  também sem borda; slug só de espaços em `availability` responde 409; slugs
  reservados ou fora da política D15 respondem 404. `GET /api/quotes` responde
  `private, no-store` com `Vary: Cookie, x-tenant-id`.
- **Host de locadora em `AUTH_MODE=legacy`**: login e área do cliente respondem
  404 no proxy (`TENANT_ACCOUNT_PATHS`); no modo legacy não há login de cliente
  em subdomínio (risco R3 aceito até o corte do Better Auth).

#### Pendente

- Resolvidos antes do commit: a transferência de dívida das três páginas de auth
  movidas para `(public)/[locadora]/(auth)/{cadastro,entrar,login}` foi
  registrada em `tools/ratchet-transfers.json`, e as fixtures de
  `test:unit`/`test:identity` passaram a gravar slug dentro da política.
- Sem validação local: teste visual do primeiro modelo 3D sem zoom,
  `docker build` e health 200 (ficam no job `docker` do CI), T16 em preview da
  Vercel e T6 com papel sem `BYPASSRLS`.
- Lotes 5 a 12 do plano de hosts; até o Lote 5, `robots.txt`, `sitemap.xml` e
  `manifest.json` respondem 404 no host de locadora e no apex.

### Onda 1 da modernização multiempresa (commit `0cff7b65`, 2026-09-26)

- **Dados**: migrations `202609260001` a `0004`. Conversão orçamento→locação
  idempotente (savepoint e reaproveitamento em P2002); `rentals.status` virou o
  enum `RentalStatus` (com `PENDING`), NOT NULL, DEFAULT `PENDING`, em duas
  migrations porque `ADD VALUE` só pode ser usado depois do commit; índice
  parcial `payments_quote_method_type_active_unique` permite nova cobrança após
  CANCELLED/REFUNDED sem sobrescrever o histórico.
- **Superfície pública**: `/api/health` responde 503 genérico e registra o
  detalhe só no log; `/api/drei-proxy` aceita só `hdri/<arquivo>.hdr`, sem CORS,
  com `application/octet-stream` e `nosniff`; `/api/admin/analytics` e
  `/api/admin/security` aposentadas (410); seis módulos órfãos de `lib/`
  removidos (entre eles os que chamavam `exec_sql` e `createBucket`); guarda
  estrutural `tests/security/route-auth-inventory.test.ts`.
- **Identidade legacy**: versão de credencial no JWT (HMAC truncado com
  `NEXTAUTH_SECRET`; trocar a senha invalida os JWTs anteriores e JWTs sem o
  claim são recusados uma vez). Token de reset com 32 bytes e só o SHA-256 no
  banco (links emitidos antes da mudança foram invalidados). Cadastro com
  resposta neutra 202. Layout de `/admin/settings` exige membership ADMIN;
  `lib/admin-auth.ts` removido. E-mails de identidade usam `PLATFORM_NAME`.
- **SSR**: rotas públicas voltam a sair completas no HTML do servidor
  (`RuntimeBootstrap` sem troca global por "Carregando...", `useSearchParams`
  isolado num Suspense próprio, `SessionProviderWrapper` repassa a sessão); hook
  `usePublicTenantRouting`.
- **Gates com catraca**: `WORKSPACE-ESCAPE`, `UNIVERSAL-DOM-JSX` e
  `UNIVERSAL-WEB-LIB` (`tools/arch-baseline.json`, 1062 em 76 arquivos);
  `tailwind-palette-class`, `arbitrary-color`, `arbitrary-dimension`,
  `hsl-triple` e `z-index-literal` (`tools/token-baseline.json`).
  `--update-baseline` só reduz e `--init-baseline` só cria. `check:tokens` não
  reescreve mais `packages/design-tokens`.
- **Tokens em níveis**: `primitives`, `semanticThemes` e `componentSpecs` com
  paridade 1:1 ao web aprovado; fachada `tokens.ts` inalterada
  (`palette.blue100` novo, `palette.blue50` mantido como alias depreciado).
- **Backend**: `@gb-locacoes/backend/catalog` e ampliação de `customers`; 17
  rotas viraram adaptadores, com 155 testes de caracterização HTTP.
- **Mobile**: rotas Expo em `(public)`, `(auth)`, `(account)`, `(admin)` e
  `(labs)` com as mesmas URLs do web; destino pós-login pelo papel de membership
  (a regra de e-mail fixo de administrador saiu; sem seleção, o destino é `/`).
- Gates no commit: `test:unit` 369, `test:identity` 43, `test:security` 342,
  `test:platform` 956 e `test:integration` 81 verdes em PostgreSQL descartável;
  `build:web` e `check:tokens` pendentes naquele momento.

### Changed

- Seleção explícita de locadora com vínculo ativo e cookie protegido; sete
  regressões PostgreSQL cobrem troca, revogação e recusa de contextos cruzados.
  Obrigações e tentativas de cobrança separadas, reemissão durável e endereços
  isolados por locadora/titular. Testes exigem opt-in descartável; limpeza
  recusa tenant ausente. Build volta a verificar TypeScript também no CI.
  Integração visual, release e publicação seguem pendentes.

- Modernização em andamento para plataforma com várias locadoras: identidade
  global com vínculos por organização, contexto obrigatório, migrations de
  expansão e RLS, tentativas de cobrança/outbox e grupos de rotas no novo host.
  GB-Locações permanece apenas como origem do legado. Produção e migração
  histórica não executadas; gates e paridade completa ainda pendentes.
- TypeScript fixado em 5.9.3 para compatibilidade do compilador AST/ESLint e um
  único client Prisma entre pacotes. Lint retorna falhas reais. Testes de banco
  exigem URL descartável local explícita e não reutilizam servidor desconhecido.

- **Atualização de dependências (2026-09-25)** - Todas as dependências diretas
  do monorepo foram para a versão estável mais recente do `pnpm outdated`.
  Destaques: Next.js 16.3.6, React 19.3.0, TypeScript 7.0.2, Tailwind CSS 4.3.3
  (`@tailwindcss/postcss` + `@config`), Vite 8.3.1, Vitest 5.0.2, Prisma ORM
  7.10.0 (`@prisma/client`, `@prisma/adapter-pg` e CLI). O pacote
  `prisma@8.0.0-rc.17` (tag `latest`) não entra: é um CLI de plataforma em
  release candidate, sem `@prisma/client` correspondente e sem o comando
  `generate`. Expo permanece no SDK 57.0.25, com React Native 0.86.3, que é a
  versão que esse SDK publica.

### Added

- **link-web-public #351 (2026-09-25)** - Script `tools/link-web-public.mjs` (e
  `pnpm link:web-public`) cria junction Windows ou symlink relativo para
  `apps/clients/web/public` → `public/` da raiz quando faltar; no-op se já
  apontar certo; não apaga pasta real com arquivos. Junction local existente
  preservada. Sem symlink versionado. Migração não concluída.
- **tokens hex native #345 (2026-09-25)** - Em `category-helpers.native.tsx`,
  fallbacks do ícone `Tag` passam a usar `palette.gray400` (mesmo `#9ca3af` /
  gray-400 do design-tokens) em vez do literal hex. `.web.tsx` e legado `lib/`
  intactos. `pnpm tokens` exit 0; `pnpm check:tokens` exit 0. Sem remoção de
  `customConditions`/`moduleSuffixes`. Migração não concluída.
- **category-helpers native #341 (2026-09-25)** -
  `packages/frontend/src/shared/lib/category-helpers`: `.web.tsx` (visual
  intacto com className/Tailwind), `.native.tsx` (Badge sem className; sem
  Tailwind no selo), `.tsx` reexporta web. `category-design` e legado `lib/`
  intactos. Typecheck mobile 1→0 (exit 0). `pnpm typecheck` exit 0. `pnpm arch`
  exit 0. Sem remover `customConditions`/`moduleSuffixes`. Migração não
  concluída.
- **Resto native #340 (2026-09-25)** - `packages/frontend/tsconfig.json` exclui
  `**/*.native.{ts,tsx}` (não `.web`). Widgets `Cartao` (cartao-admin),
  `FiltroAdmin`, `Bloco` (personalizar-icone): `.web.tsx` intacto, `.native.tsx`
  sem props rejeitadas pelo UI native, `.tsx` reexporta web. Typecheck mobile
  24→1 (exit 1; resto `category-helpers` Badge). Cadeia `pnpm typecheck` exit 1
  (1 erro mobile). Sem remover `customConditions`/`moduleSuffixes`. Migração não
  concluída.
- **Cinco páginas native #339 (2026-09-25)** - `PrivacidadePage`,
  `RecuperarSenhaPage`, `ResetPasswordPage`, `TermosPage` (só 4 pages/* restavam
  no grafo pós-338): `.web.tsx` (visual intacto), `.native.tsx` sem props
  rejeitadas pelo UI native, `.tsx` reexporta web. Typecheck mobile 96→24 (exit
  1); zero erros nessas quatro. Cadeia `pnpm typecheck` exit 1 (~36; natives
  tipados com contrato web no package frontend). Sem remover
  `customConditions`/`moduleSuffixes`. Migração não concluída.
- **Cinco páginas native #338 (2026-09-25)** - `EntrarPage`, `EquipamentosPage`,
  `LoginPage`, `PermissoesPage` (`AdminPermissionsPage`),
  `PoliticaDevolucaoPage`: `.web.tsx` (visual intacto), `.native.tsx` sem props
  rejeitadas pelo UI native, `.tsx` reexporta web. Typecheck mobile 163→96 (exit
  1); zero erros nesses cinco. Cadeia `pnpm typecheck` não rodada (mobile >30).
  Sem remover `customConditions`/`moduleSuffixes`. Migração não concluída.
- **Cinco páginas native (2026-09-25)** - `ContactForm`, `ApiDocsPage`,
  `CadastroPage`, `ContatoPage`, `CookiesPage`: `.web.tsx` (visual intacto),
  `.native.tsx` sem props rejeitadas pelo UI native, `.tsx` reexporta web.
  Typecheck mobile 258→163 (exit 1); zero erros nesses cinco. Cadeia
  `pnpm typecheck` não rodada (mobile >30). Sem remover
  `customConditions`/`moduleSuffixes`. Migração não concluída.
- **Grafo native sem .web no mobile (2026-09-25)** - Entries `react-native` em
  `@gb-locacoes/frontend/app` e `pages/playground`; `index.native.ts` em
  cartao-equipamento/carrinho; `moduleSuffixes` no tsconfig mobile. Typecheck
  mobile 314→258 (exit 1); `.web` no programa 13→0. Sem remover
  `customConditions`. Migração não concluída.
- **Typecheck nativo mobile (2026-09-25)** - `apps/clients/mobile/tsconfig.json`
  restaura `customConditions: ["react-native"]` e declara `exclude` de
  `**/*.web.tsx` / `**/*.web.ts`. `tsc -p` mobile: 314 erros (contrato UI native
  vs props web); `pnpm typecheck` exit 1. Sem remoção de `customConditions` para
  mascarar. Migração não concluída.
- **Lock raiz workspace @gb-locacoes (2026-09-25)** - `pnpm install` registrou
  `workspace:*` de frontend/ui/design-tokens no importer `.` do `pnpm-lock.yaml`
  (`link:packages/...`). Links pnpm em `node_modules/@gb-locacoes/*`. Junction
  `apps/clients/web/public` mantida. Exits: install 0, arch 0, `build:web` 0.
  Sem Prisma novo; `pnpm test` bloqueado (`TEST_DATABASE_URL` ausente). Migração
  não concluída.
- **Dev raiz resolve @gb-locacoes/frontend (2026-09-25)** - Raiz declara
  `workspace:*` para frontend/ui/design-tokens; `next.config` com
  `transpilePackages` + `resolveAlias` relativo (Turbopack Windows); tsconfig
  paths; junction local `apps/clients/web/public` → `public/` (GLB 200). Sem
  `pnpm install` nesta fatia (junctions manuais em `node_modules/@gb-locacoes`).
  Home sem Module not found do pacote. arch exit 0. Migração não concluída.
- **Host reveal + SW fora de components/ (2026-09-25)** - `scroll-reveal-init` e
  `service-worker-register` saíram de `components/` para `app/` (ao lado de
  `ClientLayout`); lazy `ssr:false` e registro único do SW mantidos. Pasta
  `components/` vazia removida. Carrossel 3D intacto. arch/token exit 0.
  Migração não concluída.
- **Carrossel 3D no widget hero (2026-09-25)** - `equipment-3d-carousel`,
  `model-viewer` e `lazy-3d-carousel` saíram de `components/` para
  `packages/frontend/src/widgets/hero/ui` (`.web.tsx`); export no index do hero
  e reexport em `pages/sobre`. `scroll-reveal-init` permanece no host. Legados
  apagados. arch/token exit 0. Migração não concluída.
- **arch-check metro.config.js (2026-09-25)** - `tools/arch-check.mjs` ignora só
  o basename `metro.config.js` (ferramenta Node do Metro); RUNTIME-NODE residual
  da 324 some. Exit arch 0; bundle não reexecutado (polyfill intacto). Sem
  device. Migração não concluída.
- **check:tokens propagation (2026-09-25)** - Vitest via
  `vitest.platform.config.ts`; webRender aceita `<button class>`/`bg-slate-700`
  do Button existente (sem botão novo). Exit `check:tokens` 0; arch 1
  (`metro.config.js` RUNTIME-NODE residual); token-check 0. Sem device. Migração
  não concluída.
- **Build web / polyfills / tokens (2026-09-25)** - Suspense local em
  `/equipamentos`; `check:tokens` lê `orange600` (#ea580c); Metro resolve
  `rn-get-polyfills` via store RN 0.86. Exits: `build:web` 0, `bundle:mobile` 0,
  `check:tokens` 1 (vitest path + webRender). Sem device. Migração não
  concluída.
- **Prova builds pós-typecheck (2026-09-25)** -
  `pnpm test`/`build:web`/`bundle:mobile` exit 1 (`TEST_DATABASE_URL`; Suspense
  em `/equipamentos` após fix de `SessionProviderWrapper` no host web;
  `rn-get-polyfills`). Limitação: mobile sem `customConditions` pode tipar
  export web do UI. arch/token-check 0. Migração não concluída.
- **Typecheck resto frontend/web/mobile (2026-09-25)** - Paths/shims para
  schema, filters, settings actions (Prisma não puxado) e carrossel 3D (só
  tipos); mobile sem `customConditions: react-native` (causa dos 291× TS2322).
  Contagens: frontend 19→0, web 17→0, mobile 316→0; ui 0. arch/token exit 0.
  Migração não concluída.
- **Aliases @/lib → shared/lib (2026-09-25)** - Módulos CLIENT-SAFE de `lib/`
  copiados para `packages/frontend/src/shared/lib` (`cn`, formatting,
  category-design/helpers, icons, boleto-validator, sanitize DOMPurify, cep,
  debounce-fn). Imports só no frontend; legado `lib/` mantido. Sem unificar
  moeda/debounce/getInitials/labels. Contagens typecheck: frontend 122→19, web
  112→17, mobile 339→316; ui 0. arch/token exit 0. Carrossel 3D continua.
- **Typecheck Alert/sessão/react-native (2026-09-25)** - Export explícito de
  `Alert`/`AlertTitle`/`AlertDescription` em `@gb-locacoes/ui`; paths dos types
  de `react-native` já instalados no mobile; augment `next-auth` no typecheck
  dos pacotes/hosts. Contagens: ui native 61→0, frontend 204→122, web 182→112,
  mobile 415→339. arch/token exit 0. Carrossel 3D continua.
- **token-check TS7 (2026-09-25)** - `tools/token-check.mjs` deixa de crashar
  com `ScriptKind` undefined no TypeScript 7 (entry só com version); resolve API
  clássica já presente no tree. Gate exit 0; cores de produto intactas.
  Carrossel 3D continua.
- **Typecheck UI FilterSelectGroup/HoverActionMenu (2026-09-25)** -
  `FilterSelectGroup` passou a usar tipos locais `Filter`/`FilterOption` no
  contrato do pacote (sem `@/types/filters`); `HoverActionMenu` omite
  `children`/`onClick` de `ButtonHTMLAttributes` para alinhar o contrato.
  `tsc -p packages/ui` exit 0; typecheck completo ainda exit 1. Carrossel 3D
  continua.
- **Typecheck rotas host (2026-09-25)** - Typecheck parou em `packages/ui`
  (`FilterSelectGroup` e `HoverActionMenu`); as rotas novas do host não foram o
  motivo. Hosts não chegados. Carrossel 3D continua.
- **Adaptadores host web produto (2026-09-25)** - `/`, `/sobre` e
  `/equipamentos/[id]` viraram adaptadores finos em `apps/clients/web`
  (Prisma/metadata no host; 3D só via slot relativo em `/sobre`). Sem mobile.
  arch/token exit 0. Carrossel 3D continua.
- **Rotas finas admin/cliente web (2026-09-25)** - Treze rotas finas em
  `apps/clients/web` (`/admin/maintenance`, `/admin/orcamentos`,
  `/admin/orcamentos/[id]`, `/admin/rentals`, `/admin/settings`,
  `/admin/whatsapp`, `/area-cliente`, `/area-cliente/enderecos`,
  `/area-cliente/historico`, `/area-cliente/historico/[id]`,
  `/area-cliente/notificacoes`, `/area-cliente/perfil`, `/equipamentos-scroll`);
  todas `.web`, sem espelho mobile. arch/token exit 0. Carrossel 3D continua.
- **Rotas finas admin web (2026-09-25)** - Oito rotas finas em
  `apps/clients/web` (`/admin/categorias`, `/admin/email`,
  `/admin/equipamentos`, `/admin/equipamentos/novo`, `/admin/equipamentos/[id]`,
  `/admin/equipamentos/[id]/editar`, `/admin/financeiro`, `/admin/logistics`);
  todas `.web`, sem espelho mobile. arch/token exit 0. Carrossel 3D continua.
- **Rotas finas host web (2026-09-25)** - Oito rotas finas em `apps/clients/web`
  (`/api-docs`, `/admin/teste-toast`, `/grid-motion`,
  `/playground/icon-customization`, `/admin/permissions`, `/playground`,
  `/orcamento`, `/admin/dashboard`); espelho mobile nas 5 universais; 3 `.web`
  sem mobile. arch/token exit 0. Carrossel 3D continua.
- **Inventário components (2026-09-25)** - Inventário de `components/` não moveu
  os arquivos do carrossel 3D nem o service worker.
- **Cabeçalhos admin (2026-09-25)** - `admin-header`, `admin-desktop-header`,
  `admin-mobile-header` e `admin-header-actions` foram para
  `widgets/cabecalho-admin-barra`
  (`Barra`/`BarraDesktop`/`BarraMobile`/`Acoes`). Host compõe `MobileSidebar`
  via `onMenuOpen`. Legado apagado. Vitest/arch/token exit 0. Carrossel 3D
  continua.
- **Gantt e calendário logística (2026-09-25)** - `gantt-view` e
  `logistics-calendar` foram para `pages/logistica/ui`; `mini-carousel` para
  `widgets/mini-carousel`; `hero-carousel-manager` para `pages/configuracoes`.
  Calendar via `widgets/seletor-data`. Legado apagado. token exit 1 em
  `cabecalho-admin-barra` (fora desta fatia). Carrossel 3D continua.
- **Shim ícones removido (2026-09-25)** - `components/icons/custom/index.tsx` e
  a pasta `components/icons` foram apagados; implementação permanece em
  `packages/ui/src/icons/custom.tsx`. arch-check exit 1 por FSD em mini-carousel
  e pages/logistica (fora desta fatia). Carrossel 3D continua.
- **Sidebars admin (2026-09-25)** - `admin-sidebar` e `mobile-sidebar` foram
  para `packages/frontend/src/widgets/menu-admin` (`BarraLateral.web.tsx` e
  `BarraLateralMobile.web.tsx`). rgba intactos com `token-check-allow`. Headers,
  gantt, hero-carousel-manager, logistics-calendar e mini-carousel continuam
  legado. Carrossel 3D continua.
- **Logistics utils/types admin (2026-09-25)** -
  `components/admin/logistics/utils.tsx` e `types.ts` foram para
  `pages/logistica/ui/Utilidades.tsx` e `model/tipos.ts`. Sidebars com rgba e
  headers/gantt/hero/calendar/mini-carousel continuam legado. Carrossel 3D
  continua.
- **Ícones custom (2026-09-25)** - Implementação em
  `packages/ui/src/icons/custom.tsx`, exportada nos index web e native. Widget
  `personalizar-icone` importa `CUSTOM_ICONS` do pacote, sem unificar com emoji.
  Shim em `components/icons/custom/index.tsx` continua. Carrossel 3D continua.
- **Rental-actions (2026-09-25)** - `components/client/rental-actions.tsx` foi
  para `packages/frontend/src/pages/historico-detalhe/ui/AcoesLocacao.web.tsx`
  (export `RentalActions`). Pasta `components/client` removida. Multa de locação
  (5% da diária) separada da de orçamento (2% ao dia). Carrossel 3D continua.
- **Category-badge (2026-09-25)** - O selo saiu de
  `components/ui/category-badge.tsx` para
  `packages/frontend/src/entities/categoria/ui/CategoryBadge.tsx`.
  `lib/utils/category-helpers` continua legado (compartilhado).
  `CATEGORY_PAGE_SIZE` 9 intacto. Carrossel 3D continua.
- **Primitivos UI restantes (2026-09-25)** - `carousel`, `form`, `sidebar`,
  `social-login-buttons` e `whatsapp-button` saíram de `components/ui` para o
  pacote de UI (contrato + web + native). Web preserva Embla, React Hook Form,
  `signIn` e o verde do WhatsApp. Native sem Tailwind. Legados apagados.
  Carrossel 3D continua.
- **Hover-action-menu e grid-motion (2026-09-25)** - Os dois saíram de
  `components/ui` para o pacote de UI (contrato + web + native).
  `category-badge` ficou (negócio). Restam reexports: carousel, form, sidebar,
  social-login-buttons, whatsapp-button. Carrossel 3D continua.
- **Subpastas components (2026-09-25)** - `equipment-units-manager` foi para
  `pages/equipamentos-admin/ui/GerenciadorUnidades.tsx`; `boleto-display` e
  `boleto-section` para `entities/pagamento/ui`. Pasta `components/payment`
  removida. Ainda há `.tsx` em admin, client e icons. Carrossel 3D continua.
- **Órfãos da raiz de components (2026-09-25)** - `theme-provider`,
  `quote-form`, `legal-page-layout`, `categories`, `categories-with-animation` e
  `mdx` saíram para o frontend (providers, pages/orcamento, widgets). SW,
  carrossel 3D e scroll-reveal não movidos.
- **Context-menu, navigation-menu e filter-indicator (2026-09-25)** - Os três
  saíram de `components/ui` para o pacote de UI (contrato + web + native).
  Legados apagados. Carrossel 3D continua.
- **Date-range legado removido (2026-09-25)** -
  `components/ui/date-range-picker.tsx` foi apagado; o widget `seletor-data` já
  tinha o mesmo `DateRangePicker` e não restava import do caminho antigo.
  `Calendario.web` e carrossel 3D intactos.
- **Icon customization playground (2026-09-25)** - O corpo de
  `/playground/icon-customization` foi para
  `packages/frontend/src/pages/playground/ui/IconCustomizationPage.tsx`; a rota
  virou shell. Hooks de recentes em `widgets/personalizar-icone` com
  `gb-locacoes-icon-recents` e `gb-locacoes-emoji-recents`. Widget não recriado.
  Carrossel 3D continua.
- **Rotas playground, grid-motion e equipamentos-scroll (2026-09-25)** -
  `/playground`, `/grid-motion` e `/equipamentos-scroll` foram para
  `packages/frontend/src/pages/playground`, `grid-motion` e
  `equipamentos-scroll`; as rotas viraram shells. `icon-customization` ainda
  gorda. Carrossel 3D intacto.
- **Drawer, input-otp e menubar (2026-09-25)** - Os três saíram de
  `components/ui` para o pacote de UI (contrato + web + native). Native sem
  Tailwind da web. Legados apagados.
- **Componentes raiz (2026-09-25)** - `image-carousel-zoom` foi para
  `pages/equipamentos-admin/ui/ImageCarouselZoom.web.tsx`;
  `session-provider-wrapper` para
  `app/providers/SessionProviderWrapper.web.tsx`; `seo-schemas` para
  `widgets/seo-schemas`. Legados apagados. Carrossel 3D e scroll-reveal
  continuam no legado.
- **Rotas teste-toast e api-docs (2026-09-25)** - `/admin/teste-toast` e
  `/api-docs` foram para `packages/frontend/src/pages/teste-toast` e `api-docs`;
  as rotas viraram shells. Playground, grid-motion e equipamentos-scroll ainda
  gordas.
- **Tipos do formulário de equipamento admin (2026-09-25)** -
  `components/admin/equipment-form/types.ts` foi para
  `packages/frontend/src/pages/equipamentos-admin/model/tipos.ts`. Campos não
  unificados com orçamento; legado apagado.
- **ClientLayout shell (2026-09-25)** - A composição de `app/ClientLayout.tsx`
  foi para `ClientLayoutShell.web` em `@gb-locacoes/frontend/app`.
  `scroll-reveal-init` e `ServiceWorkerRegister` ficaram no host; carrossel 3D e
  `maxDuration` 0 intactos.
- **Toggle, toggle-group e resizable (2026-09-25)** - Os três saíram de
  `components/ui` para o pacote de UI (contrato + web + native). Email e
  WhatsApp admin importam Resizable de `@gb-locacoes/ui`. Legados apagados.
- **Sobras do formulário de equipamento admin (2026-09-25)** -
  `pricing-period-card`, `specifications-section` e `image-zoom-modal` saíram de
  `components/admin/equipment-form` para o slice `equipamentos-admin`
  (`CartaoPeriodo`, `SecaoEspecificacoes`, `ModalZoomImagem.web`). `types.ts`
  continua legado.
- **Hover-card, radio-group e slider (2026-09-25)** - Os três saíram de
  `components/ui` para o pacote de UI (contrato + web + native). Legados
  apagados.
- **Previews de configurações (2026-09-25)** - `hero-carousel-preview` e
  `header-footer-preview` foram para o slice configuracoes. Não importavam o
  carrossel 3D; o real continua em `components/equipment-3d-carousel.tsx`.
- **Toast Sonner (2026-09-25)** - `use-toast` e `use-toast-sonner` saíram de
  `hooks/` para `shared/lib/toast`. API `toast`/`useSonner` e lib Sonner
  intactas; legados removidos.
- **Hook use-settings (2026-09-25)** - `use-settings` saiu de `hooks/` para
  `pages/configuracoes/model`. Sem Prisma e sem `next/*`; telefones, e-mails,
  fuso e `maxQuoteItems` não foram duplicados.
- **Recentes de ícone (2026-09-25)** - `use-icon-recents` saiu de `hooks/` para
  `pages/categorias/model/icon-recents`. Chave e máximo 18 preservados; legado
  removido.
- **Hooks de listagem e emoji (2026-09-25)** - `use-equipment-list-data` e
  `use-emoji-recents` saíram de `hooks/` para os slices de equipamentos-admin e
  categorias. Os demais hooks legados continuam no lugar.
- **Componentes de e-mail admin (2026-09-25)** - Sete arquivos saíram de
  `components/admin/email` para o slice `email-admin`. O `loading.tsx` da rota
  permanece; a pasta legada foi removida.
- **Cartão de equipamento (2026-09-25)** - O card saiu de
  `components/equipment-card.tsx` para o widget `cartao-equipamento` (web +
  native). O CTA não foi unido a este widget.
- **Aspect ratio, collapsible e progress (2026-09-25)** - Os três saíram de
  `components/ui` para o pacote de UI. Na web, o Radix e as classes do Progress
  continuam iguais; no nativo não repetem Tailwind.
- **Componentes WhatsApp admin (2026-09-25)** - Layout, listas, visualizador e
  diálogos saíram de `components/admin/whatsapp`. Sem telefones fixos; o FAB
  flutuante continua intacto.
- **Blocos de configurações (2026-09-25)** - Hook e blocos saíram do legado para
  o slice de configurações. Telefones, e-mails, fuso e o limite de 50 itens no
  orçamento continuam iguais.
- **Home (2026-09-25)** - A home saiu do corpo de `app/page.tsx`. Prisma
  continua no host.
- **Gráfico sem reexport (2026-09-25)** - Gráficos financeiros e do dashboard
  importam de `@gb-locacoes/ui`. `components/ui/chart.tsx` foi removido.
- **Botão de chamada (2026-09-25)** - O botão saiu de
  `components/ui/cta-button.tsx`. O laranja `bg-orange-600` e as variantes
  continuam iguais.
- **Gráfico base (2026-09-25)** - O gráfico saiu do corpo de
  `components/ui/chart.tsx` para o pacote de UI. O arquivo antigo só reexporta.
- **Categorias admin (2026-09-25)** - A listagem saiu do corpo de
  `app/admin/categorias/page.tsx`. A página continua com 9 itens.
- **Equipamentos admin (2026-09-25)** - Lista, novo, detalhe e edição saíram do
  corpo das rotas. A listagem admin continua com 9 itens, separada do catálogo
  público.
- **Abas e acordeão (2026-09-25)** - Os dois saíram de `components/ui/tabs.tsx`
  e `components/ui/accordion.tsx`. Na web, a aba ativa continua laranja; o
  nativo não repete essas classes.
- **Cartão admin (2026-09-25)** - O cartão saiu de
  `components/admin/admin-card.tsx`. As variantes default, elevated, glass e
  flat continuam iguais.
- **E-mail admin (2026-09-25)** - A tela e o hook saíram de
  `app/admin/email/page.tsx` e `hooks/use-email-page.ts`. Zoho e as rotas da API
  continuam iguais.
- **Configurações admin (2026-09-25)** - A tela saiu do corpo de
  `app/admin/settings/page.tsx`. Telefones, e-mails, fuso e o limite de 50 itens
  no orçamento continuam iguais.
- **WhatsApp admin (2026-09-25)** - A tela saiu do corpo de
  `app/admin/whatsapp/page.tsx`. O telefone continua vindo da conversa, sem
  número fixo.
- **Permissões admin (2026-09-25)** - A tela saiu do corpo de
  `app/admin/permissions/page.tsx`. Os papéis ADMIN, OPERATOR, FINANCIAL e
  CLIENT continuam iguais.
- **Debounce (2026-09-25)** - O hook saiu de `hooks/use-debounce.ts`. O atraso
  padrão continua 350 ms, separado da função em `lib/utils.ts`.
- **Cabeçalho admin (2026-09-25)** - O cabeçalho saiu de
  `components/admin/admin-page-header.tsx`. O gradiente laranja e a entrada com
  `y: -20` continuam iguais.
- **Dados dos orçamentos (2026-09-25)** - A listagem e o detalhe saíram de
  `hooks/use-quotes-data.ts` e `hooks/use-quote-details.ts`. Página 20, limite
  500 no kanban e finais de semana desligados no rascunho continuam iguais.
- **Registro admin do orçamento (2026-09-25)** - Tipos e funções saíram de
  `components/admin/quotes/types.ts` e `utils.ts`. O rótulo `Concluido`, a data
  local e o mapa de categoria do admin continuam separados dos outros.
- **Carregamento dos orçamentos (2026-09-25)** - Os spinners saíram do corpo de
  `app/admin/orcamentos/loading.tsx` e `app/admin/orcamentos/[id]/loading.tsx`.
  O anel da listagem e o texto do detalhe continuam separados.
- **Detalhe do orçamento por id (2026-09-25)** - A tela saiu do corpo de
  `app/admin/orcamentos/[id]/page.tsx`. A busca, o rótulo `Concluído` e o valor
  em `toLocaleString` continuam iguais.
- **Listagem de orçamentos (2026-09-25)** - A tela saiu do corpo de
  `app/admin/orcamentos/page.tsx`. A URL, o rótulo `Concluidos` e o atalho para
  `/admin/financeiro` continuam iguais.
- **Reajuste do orçamento (2026-09-25)** - O diálogo saiu de
  `components/admin/shared/price-adjustment-dialog.tsx`. Categorias, total
  somado ao valor original e o diálogo embutido do financeiro continuam
  separados.
- **Editar período do item (2026-09-25)** - O diálogo saiu de
  `components/admin/quotes/dialogs/edit-item-dates-dialog.tsx`. Finais de
  semana, prévia em dia/dias e o calendário do seletor continuam iguais.
- **Editar entrega do orçamento (2026-09-25)** - O diálogo saiu de
  `components/admin/quotes/dialogs/edit-delivery-dialog.tsx`. Entrega, retirada
  com frete vazio e a máscara de CEP continuam iguais.
- **Editar cliente do orçamento (2026-09-25)** - O diálogo saiu de
  `components/admin/quotes/dialogs/edit-customer-dialog.tsx`. As máscaras de CPF
  e CNPJ e o botão Salvar continuam iguais.
- **Multa por atraso do orçamento (2026-09-25)** - O diálogo saiu de
  `components/admin/quotes/dialogs/late-fee-dialog.tsx`. Os dias, o valor
  recebido e Aprovar e Aplicar Multa continuam iguais.
- **Remover reajuste do orçamento (2026-09-25)** - A confirmação saiu de
  `components/admin/quotes/dialogs/remove-adjustment-confirm.tsx`. O recálculo
  do valor final e Confirmar remoção continuam iguais.
- **Remover item do orçamento (2026-09-25)** - A confirmação saiu de
  `components/admin/quotes/dialogs/remove-item-confirm.tsx`. O recálculo do
  total e Confirmar remoção continuam iguais.
- **Excluir aprovação do orçamento (2026-09-25)** - O diálogo saiu de
  `components/admin/quotes/dialogs/remove-approval-dialog.tsx`. A volta para
  pendente, o aviso sem desfazer e Confirmar continuam iguais.
- **Excluir orçamento (2026-09-25)** - O diálogo saiu de
  `components/admin/quotes/dialogs/delete-dialog.tsx`. A exclusão permanente, o
  aviso sem desfazer e Confirmar continuam iguais.
- **Rejeitar orçamento (2026-09-25)** - O diálogo saiu de
  `components/admin/quotes/dialogs/reject-dialog.tsx`. A pergunta, o email, o
  motivo opcional e Confirmar Rejeição continuam iguais.
- **Cartão de rejeição do orçamento (2026-09-25)** - O cartão saiu de
  `components/admin/quotes/quote-rejection-card.tsx`. Cancelado pelo cliente e
  Rejeitado pelo Administrador continuam separados.
- **Cartão de boleto do orçamento (2026-09-25)** - O cartão saiu de
  `components/admin/quotes/quote-boleto-card.tsx`. Gerar Boleto continua só no
  status aprovado, e o calendário de vencimento usa o widget `seletor-data`.
- **Cartão de entrega do orçamento (2026-09-25)** - O cartão saiu de
  `components/admin/quotes/quote-delivery-card.tsx`. A retirada na loja, o frete
  escondido com ajuste TRAVEL e o formatador de `lib/utils/formatting` continuam
  iguais.
- **Cartão do cliente no orçamento (2026-09-25)** - O cartão saiu de
  `components/admin/quotes/quote-customer-card.tsx`. Empresa, CPF, CNPJ,
  Telefone, Código legado e o selo `#7b81f5` continuam iguais.
- **Painel de detalhe do orçamento (2026-09-25)** - O painel saiu de
  `components/admin/quotes/quote-detail-panel.tsx`. O título, Rejeitar
  Orçamento, Aprovar Orçamento e Aprovar e Converter continuam iguais.
- **Calendário de orçamentos (2026-09-25)** - O calendário saiu de
  `components/admin/quotes/quotes-calendar-view.tsx`. Pendente e rejeitado
  continuam no dia do evento, e o total continua `quote.totalPrice`.
- **Tabela de orçamentos (2026-09-25)** - A tabela saiu de
  `components/admin/quotes/quotes-table-view.tsx`. As colunas, o status
  `pending`, o valor e o formatador de `lib/utils/formatting` continuam iguais.
- **Quadro do kanban (2026-09-25)** - O quadro saiu de
  `components/admin/kanban-pipeline.tsx`. O padrão de 1, 3, 3 e 6 colunas, a
  espera do vazio transitório e a barra laranja continuam iguais.
- **Kanban de orçamentos (2026-09-25)** - A visão saiu de
  `components/admin/quotes/quotes-kanban-view.tsx`. O status `rejected`, o
  valor, o horário pt-BR e as colunas 1/2/4/4 continuam iguais.
- **Navegador de mês do kanban (2026-09-25)** - O navegador saiu de
  `components/admin/kanban-month-navigator.tsx`. O ano, o botão Hoje, os meses
  em pt-BR e o gradiente laranja continuam iguais.
- **Cartão de filtro do admin (2026-09-25)** - O cartão saiu de
  `components/admin/admin-filter-card.tsx`. A busca Buscar..., os layouts
  responsive e stacked e o título Resetar filtros continuam iguais.
- **Seletor de ícone (2026-09-25)** - O bloco e os dados saíram de
  `components/dialogs/icon-customization-block.tsx`. As abas Ícones, Emoji e
  Fazer Upload e as buscas continuam iguais.
- **Visualizar equipamento (2026-09-25)** - O diálogo saiu de
  `components/dialogs/view-equipment-dialog.tsx`. O título, o detalhe de
  avarias, Fechar, Editar Equipamento e as bordas `#3b82f6` e `#ef4444`
  continuam iguais.
- **Visualizar categoria (2026-09-25)** - O diálogo saiu de
  `components/dialogs/view-category-dialog.tsx`. O título, a aba, Sem descrição,
  a contagem de equipamentos e os botões Fechar e Editar Categoria continuam
  iguais.
- **Diálogo de categoria (2026-09-25)** - O diálogo saiu de
  `components/dialogs/category-dialog.tsx`. Nova Categoria, Editar Categoria,
  Personalizar visual e os botões de criar e atualizar continuam iguais.
- **Avaliações do Google (2026-09-25)** - O opt-in e o selo saíram de
  `components/google-customer-reviews.tsx`. O merchant `5721491678`, o país BR,
  os 7 dias e o selo INLINE continuam iguais.
- **Salvar informações do cliente no orçamento (2026-09-25)** - O diálogo saiu
  de `components/dialogs/save-customer-info-dialog.tsx`. Telefone, CPF, CNPJ,
  Empresa, o sumiço sem dados e os botões Não salvar e Salvar continuam iguais.
- **Selecionar endereço do orçamento (2026-09-25)** - O diálogo saiu de
  `components/dialogs/select-address-dialog.tsx`. O título, o selo Principal,
  Usar outro endereço, Cancelar e o formatador de `lib/utils/validation`
  continuam iguais.
- **Confirmar endereço do orçamento (2026-09-25)** - O diálogo saiu de
  `components/dialogs/confirm-address-dialog.tsx`. A pergunta, Não exibir
  novamente e o formatador de `lib/utils/validation` continuam iguais.
- **Salvar endereço do orçamento (2026-09-25)** - O diálogo saiu de
  `components/dialogs/save-address-dialog.tsx`. Os três títulos e o botão Não
  salvar continuam iguais.
- **Página de orçamento (2026-09-25)** - A tela saiu de
  `app/orcamento/page.tsx`. O WhatsApp da página continua `555198205163` e o
  suspense continua nulo.
- **KPIs do dashboard (2026-09-25)** - Os cinco cartões saíram de
  `components/admin/dashboard/DashboardFinancialKPIs.tsx`. O atraso continua
  vermelho e o lucro zero continua verde.
- **Painéis expandidos do dashboard (2026-09-25)** - Os painéis saíram de
  `components/admin/dashboard/dashboard-expanded-overlays.tsx`. Os sete cartões
  continuam fora do SSR e com a visão expandida.
- **Orçamentos recentes do dashboard (2026-09-25)** - A seção saiu de
  `components/admin/dashboard/recent-quotes-section.tsx`. O valor continua com
  ponto decimal e as iniciais continuam nulas no hífen.
- **Atalhos do dashboard (2026-09-25)** - A seção saiu de
  `components/admin/dashboard/quick-actions-section.tsx`. O título, a grade e o
  destino de cada ação continuam iguais.
- **Destaques do dashboard (2026-09-25)** - A seção saiu de
  `components/admin/dashboard/top-equipment-section.tsx`. O top 10 de ROI e a
  média mesmo em zero continuam iguais.
- **Métricas do dashboard (2026-09-25)** - A seção saiu de
  `components/admin/dashboard/business-metrics-section.tsx`. Utilização,
  conversão e ticket médio continuam com o mesmo formato.
- **Equipamentos por categoria (2026-09-25)** - O gráfico saiu de
  `components/admin/dashboard/EquipmentByCategoryChart.tsx`. A barra horizontal,
  a altura 400 e o azul padrão continuam iguais.
- **Distribuição de status (2026-09-25)** - O gráfico saiu de
  `components/admin/dashboard/StatusDistributionChart.tsx`. O total, as cores
  recebidas e as alturas continuam iguais.
- **Tendência de orçamentos (2026-09-25)** - O gráfico saiu de
  `components/admin/dashboard/QuotesTrendChart.tsx`. O vazio, o laranja da marca
  e as alturas continuam iguais.
- **Gráficos do dashboard (2026-09-25)** - A seção saiu de
  `components/admin/dashboard/dashboard-charts-section.tsx`. Os sete títulos, a
  espera e o carregamento fora do SSR continuam iguais.
- **Tipos do dashboard (2026-09-25)** - Os tipos saíram de
  `components/admin/dashboard/types.ts`. Os rótulos no singular, as iniciais
  nulas e os três atalhos continuam iguais.
- **Grade do dashboard (2026-09-25)** - A grade saiu de
  `components/admin/dashboard/dashboard-stats-grid.tsx`. As duas grades, os
  atrasos e o ícone laranja padrão continuam iguais.
- **Carga do dashboard (2026-09-25)** - O gancho saiu de
  `hooks/use-dashboard-data.ts`. As quatro rotas, o limite de 5 orçamentos e o
  gráfico sem valor zero continuam iguais.
- **Dashboard administrativo (2026-09-25)** - A tela saiu de
  `app/admin/dashboard/page.tsx`. Título, erro e os cinco cartões de espera dos
  KPIs continuam iguais.
- **KPI financeiro (2026-09-25)** - O cartão saiu de
  `components/admin/financial/KPICard.tsx`. Tendência zero continua verde e o
  valor numérico continua em pt-BR com duas casas.
- **Gráficos financeiros no widget (2026-09-25)** - Aging, receita, categorias,
  devedores e o cartão saíram de `components/admin/financial`. As cores
  continuam as mesmas.
- **Filtro financeiro (2026-09-25)** - O filtro saiu de
  `components/admin/financial/utils.tsx`. Todos os períodos, os 13 meses e a
  espera de 350 ms continuam iguais.
- **Tipos financeiros (2026-09-25)** - Os tipos saíram de
  `components/admin/financial/types.ts`. Rótulos de cobrança, regimes e
  alíquotas padrão de CPF, CNPJ, CNI e ISS continuam iguais.
- **Detalhe do lançamento (2026-09-25)** - O diálogo saiu de
  `components/admin/financial/entry-detail-dialog.tsx`. Título, reajuste e
  iniciais do admin continuam iguais.
- **Seletor de data (2026-09-25)** - Calendário e seletores saíram da página de
  equipamento para o widget `seletor-data`. O padrão de fim de semana continua
  `true`.
- **Exclusão financeira (2026-09-25)** - Os diálogos saíram de
  `components/admin/financial`. Lançamento permanente e recálculo do reajuste
  continuam com os mesmos textos.
- **Gráficos financeiros (2026-09-25)** - A visão saiu de
  `components/admin/financial/financial-dashboard-view.tsx`. Aging, devedores e
  receitas continuam com os mesmos títulos.
- **Tabela financeira (2026-09-25)** - A tabela saiu de
  `components/admin/financial/financial-table-view.tsx`. Colunas, seleção da
  página e iniciais do admin continuam iguais.
- **Alíquotas financeiras (2026-09-25)** - A seção saiu de
  `components/admin/financial/tax-settings-section.tsx`. Os percentuais de ISS,
  IRPJ, CSLL, PIS/COFINS e DAS continuam os mesmos.
- **Cartões financeiros (2026-09-25)** - Os cartões saíram de
  `components/admin/financial/financial-stat-cards.tsx`. A grade e o anel
  laranja da seleção continuam iguais.
- **Detalhe do lançamento financeiro (2026-09-25)** - O gancho saiu de
  `hooks/use-financial-entry-details.ts`. Status, vencimento, reajuste e
  regeneração de boleto continuam nas mesmas rotas.
- **Carga financeira (2026-09-25)** - O gancho saiu de
  `hooks/use-financial-data.ts`. A lista continua com limite 10000 e o evento
  sem cor continua âmbar.
- **Painel financeiro (2026-09-25)** - A tela saiu de
  `app/admin/financeiro/page.tsx`. O título continua Painel Financeiro e o
  suspense continua sem fallback visível.
- **Rótulos de locação (2026-09-25)** - Os tipos saíram de
  `components/admin/rentals/types.ts`. Ativa e Aguardando Devolução continuam
  com essa grafia.
- **Textos de status (2026-09-25)** - Os textos saíram de
  `lib/status-definitions.ts`. A chave continua em maiúsculas e o desconhecido
  continua sem definição.
- **Selo de status (2026-09-25)** - O selo saiu de
  `components/ui/status-tooltip.tsx`. A ajuda continua no topo, com espera de
  120 ms.
- **Formatador de locação (2026-09-25)** - O formatador saiu de
  `components/admin/rentals/utils.tsx`. A data continua sem hora e o status
  desconhecido continua pendente.
- **Diálogo de locação (2026-09-25)** - O diálogo saiu de
  `components/admin/rentals/rental-detail-dialog.tsx`. Check-in e check-out
  continuam com os mesmos botões.
- **Tabela de locações (2026-09-25)** - A tabela saiu de
  `components/admin/rentals/rental-table.tsx`. A coluna continua Cliente e a
  ação continua Exibir.
- **Carga das locações admin (2026-09-25)** - O gancho saiu de
  `hooks/use-rentals-data.ts`. O check-in continua em ACTIVE e o check-out
  continua em COMPLETED.
- **Locações admin (2026-09-25)** - A tela saiu de `app/admin/rentals/page.tsx`.
  As cores de status continuam as mesmas e a pendente continua na data de
  criação.
- **Formatador de manutenção (2026-09-25)** - O formatador saiu de
  `components/admin/maintenance/utils.tsx`. Valor vazio continua R$ 0,00 e data
  ausente continua Não definido.
- **Rótulos de manutenção (2026-09-25)** - Os tipos saíram de
  `components/admin/maintenance/types.ts`. Em andamento continua amarelo e
  Inspeção continua Inspeção.
- **Diálogo de manutenção (2026-09-25)** - O diálogo saiu de
  `components/admin/maintenance/maintenance-detail-dialog.tsx`. Os cartões
  continuam Equipamento, Informações da Manutenção, Descrição, Custos e Notas.
- **Filtros de manutenção (2026-09-25)** - A barra saiu de
  `components/admin/maintenance/maintenance-filter-bar.tsx`. A busca continua
  por equipamento ou técnico e Agendar Preventiva continua em desenvolvimento.
- **Tabela de manutenção (2026-09-25)** - A tabela saiu de
  `components/admin/maintenance/maintenance-table.tsx`. As colunas continuam
  Equipamento e Técnico e a ação continua Exibir.
- **Carga de manutenção (2026-09-25)** - O gancho saiu de
  `hooks/use-maintenance-data.ts`. A agenda continua com `includeOverdue=true` e
  a página da tabela continua 10.
- **Manutenção admin (2026-09-25)** - A tela saiu de
  `app/admin/maintenance/page.tsx`. Preventiva continua verde, corretiva âmbar e
  os outros tipos índigo.
- **Calendário avançado (2026-09-25)** - O calendário saiu de
  `components/admin/advanced-calendar`. As quatro visões e as cores de status
  continuam as mesmas.
- **Checklist de entrega (2026-09-25)** - O checklist saiu de
  `components/admin/delivery-checklist.tsx`. Entrega e coleta continuam com
  listas separadas.
- **Diálogo de entrega (2026-09-25)** - O diálogo saiu de
  `components/admin/logistics/delivery-detail-dialog.tsx`. O título continua
  Editar Entrega/Coleta.
- **Filtros de logística (2026-09-25)** - A barra saiu de
  `components/admin/logistics/logistics-filter-bar.tsx`. A busca continua Buscar
  por cliente... e o reset continua em `all`.
- **Tabela de logística (2026-09-25)** - A tabela saiu de
  `components/admin/logistics/logistics-table.tsx`. Iniciar continua levando a
  agendada para em trânsito e Concluir continua fechando a entrega.
- **Carga de logística (2026-09-25)** - O gancho saiu de
  `hooks/use-logistics-data.ts`. Veículos continuam só AVAILABLE e motoristas só
  ACTIVE.
- **Logística admin (2026-09-25)** - A tela saiu de
  `app/admin/logistics/page.tsx`. Entrega continua azul e coleta continua roxa.
- **Perfil do cliente (2026-09-25)** - A tela saiu de
  `app/area-cliente/perfil/page.tsx`. A gravação continua em `/api/user/profile`
  e a verificação continua começando em pendente.
- **Endereços do cliente (2026-09-25)** - A tela saiu de
  `app/area-cliente/enderecos/page.tsx`. O CEP continua com 8 dígitos e a lista
  continua em `/api/addresses`.
- **Cartão de itens do orçamento (2026-09-25)** - O cartão saiu de
  `components/admin/quotes/quote-items-card.tsx`. Adicionar equipamento continua
  em desenvolvimento.
- **Bloco de preço do orçamento (2026-09-25)** - O bloco saiu de
  `components/equipment-quote-price-block.tsx`. O período vazio continua Diário
  e o valor final continua por último.
- **Linha do tempo da locação (2026-09-25)** - A linha saiu de
  `components/client/rental-timeline.tsx`. Concluído continua verde e o passo
  atual continua laranja.
- **Detalhe do histórico (2026-09-25)** - O detalhe saiu de
  `app/area-cliente/historico/[id]/page.tsx`. A extensão continua de 1 a 30
  dias.
- **Histórico do cliente (2026-09-25)** - A lista saiu de
  `app/area-cliente/historico/page.tsx`. A busca continua Buscar por
  equipamento... e o filtro continua Todos os status.
- **Dashboard da área do cliente (2026-09-25)** - O dashboard saiu de
  `app/area-cliente/page.tsx`. A saudação continua Bem-vindo de volta, e as
  atividades continuam com limite 10.
- **Layout da área do cliente (2026-09-25)** - O menu saiu de
  `app/area-cliente/layout.tsx`. Sem sessão o destino continua `/login` e Meus
  Orçamentos continua ativo no detalhe.
- **Tela de notificações (2026-09-25)** - A lista saiu de
  `app/area-cliente/notificacoes/page.tsx`. A rota continua a mesma e o vazio
  continua Nenhuma notificação.
- **Carga de notificações (2026-09-25)** - O gancho saiu de
  `hooks/use-notifications.ts`. A chave continua `gb-locacoes-unread-count` e a
  lista continua com limite 50.
- **Dropdown de notificações (2026-09-25)** - O dropdown saiu de
  `components/ui/notification-dropdown.tsx`. A lista continua nos 10 primeiros e
  o vazio continua Nenhuma notificação.
- **Selo de notificação no pacote de UI (2026-09-25)** - O selo saiu de
  `components/ui/notification-badge.tsx`. O teto continua 99 e o ponto continua
  vermelho.
- **Selo da área do cliente (2026-09-25)** - O selo e o gancho saíram de
  `components/ui` e `hooks`. Dentro de `/area-cliente` as variantes continuam
  sem hover.
- **Barra de busca no pacote de UI (2026-09-25)** - A barra saiu de
  `components/ui/search-bar.tsx`. O placeholder padrão continua Buscar... e o
  reset continua zerando os filtros em `all`.
- **Filtros no pacote de UI (2026-09-25)** - O seletor e o grupo saíram de
  `components/ui`. O placeholder continua Selecionar... e o painel continua em
  `z-[25]`.
- **Botão de resetar filtros no pacote de UI (2026-09-25)** - O botão saiu de
  `components/ui/filter-reset-button.tsx`. O título continua Resetar filtros e o
  ícone continua laranja no hover, sem zoom e sem borda laranja.
- **Alternador de visão no pacote de UI (2026-09-25)** - O alternador saiu de
  `components/ui/view-toggle.tsx`. O tamanho médio continua `h-10` e o item
  ativo continua com fundo `bg-slate-700`.
- **Intervalo de datas no frontend compartilhado (2026-09-25)** - O seletor saiu
  de `components/ui/date-range-picker.tsx`. O placeholder continua Selecionar
  período e as datas continuam em `dd/MM/yyyy`.
- **Seletor de data no frontend compartilhado (2026-09-25)** - O seletor saiu de
  `components/ui/date-picker.tsx`. O placeholder continua Selecione uma data e o
  formato continua em português.
- **Mapa da loja no frontend compartilhado (2026-09-25)** - O mapa saiu de
  `components/google-store-locator.tsx`. Continua na Travessa Doutor
  Heinzelmann, 365, com zoom 15.
- **Pilha de scroll no frontend compartilhado (2026-09-25)** - A pilha e o
  cartão saíram de `components/ui`. A distância padrão continua 100 e no celular
  o espaço continua 24. A seção continua em 300.
- **Texto borrado no frontend compartilhado (2026-09-25)** - O componente saiu
  de `components/ui/blur-text.tsx`. O padrão continua atraso de 200 ms, por
  palavras, entrando de cima. A seção continua em 150 ms.
- **Texto giratório no frontend compartilhado (2026-09-25)** - O componente saiu
  de `components/rotating-text.tsx`. O padrão continua 2000 ms, por caracteres,
  começando no primeiro. A vitrine continua em 3200 ms.
- **Abas de categoria no frontend compartilhado (2026-09-25)** - As abas saíram
  de `components/category-showcase.tsx`. O anúncio continua Sessões de
  categorias de equipamentos.
- **Scroll infinito no frontend compartilhado (2026-09-25)** - A faixa saiu de
  `components/equipment-infinite-scroll.tsx`. Continua com no máximo 18
  equipamentos e velocidade 0,5 px por frame.
- **Vitrine da home no frontend compartilhado (2026-09-25)** - A vitrine saiu de
  `components/equipment-showcase-section.tsx`. Cada aba continua com no máximo
  12 categorias. O texto continua girando a cada 3200 ms.
- **Destaques da home no frontend compartilhado (2026-09-25)** - A lista saiu de
  `components/featured-materials.tsx`. Continua buscando `/api/equipments` e
  mostrando no máximo 6 itens.
- **Miolo da home no frontend compartilhado (2026-09-25)** - O agrupamento saiu
  de `components/home-page-client.tsx`. A vitrine e os destaques continuam sem
  SSR.
- **Por que escolher no frontend compartilhado (2026-09-25)** - A seção saiu de
  `components/why-choose-us.tsx`. Os seis benefícios e o botão Solicitar
  Orçamento Online continuam iguais.
- **Contato da home no frontend compartilhado (2026-09-25)** - A seção saiu de
  `components/contact-section.tsx`. Continua exigindo CPF ou CNPJ e enviando
  POST para `/api/contact`.
- **Toaster no pacote de UI (2026-09-25)** - Os avisos saíram de
  `components/ui/sonner-toaster.tsx`. Continuam no topo, por 4 segundos, 120px
  abaixo no site público.
- **Botão flutuante do WhatsApp no frontend compartilhado (2026-09-25)** - O
  botão saiu de `components/whatsapp-fab.tsx`. O número continua
  `5551998205163`. No celular continua abrindo na mesma aba e no desktop em nova
  aba.
- **Rodapé no frontend compartilhado (2026-09-25)** - O rodapé saiu de
  `components/footer.tsx`. O CNPJ continua `34.780.330/0001-69`. O horário e os
  links públicos continuam os mesmos.
- **Fundo, pontos e onda do hero no frontend compartilhado (2026-09-25)** -
  Essas três partes saíram de `components/`. O primeiro slide continua
  prioritário. A onda `none` continua sem desenho. O carrossel 3D não foi
  alterado.
- **Hero da home no frontend compartilhado (2026-09-25)** - O hero saiu de
  `components/hero.tsx`. O título continua Construção Civil. A busca continua
  com andaime e betoneira. O carrossel 3D continua sem SSR.
- **Autocomplete da home no pacote de UI (2026-09-25)** - A busca saiu de
  `components/ui/autocomplete.tsx`. Continua com espera de 300 ms, mínimo de 2
  letras e o placeholder `Buscar equipamentos...`.
- **Upload de imagem no pacote de UI (2026-09-25)** - O upload saiu de
  `components/ui/image-upload.tsx`. O limite continua 5 imagens. Os avisos
  continuam `Limite excedido` e `Upload concluído`.
- **Formulário de endereço no pacote de UI (2026-09-25)** - O formulário saiu de
  `components/ui/address-form.tsx`. O CEP continua `00000-000`. A busca ViaCEP
  continua preenchendo cidade e estado.
- **Campo de moeda no pacote de UI (2026-09-25)** - O input saiu de
  `components/ui/currency-input.tsx`. Continua em real, com os dígitos divididos
  por 100 e o placeholder `R$ 0,00`.
- **Paginação inteligente no pacote de UI (2026-09-25)** - A barra saiu de
  `components/ui/smart-pagination.tsx`. Continua com no máximo 3 números e o
  texto `Página de`. A página atual continua laranja.
- **Paginação no pacote de UI (2026-09-25)** - A paginação saiu de
  `components/ui/pagination.tsx`. Os textos continuam Anterior e Próximo. O
  texto escondido das reticências continua `More pages`.
- **Área de rolagem no pacote de UI (2026-09-25)** - O scroll area saiu de
  `components/ui/scroll-area.tsx`. O passo continua 40 pixels. Os rótulos
  continuam em português e o polegar continua laranja.
- **Tabela no pacote de UI (2026-09-25)** - A tabela saiu de
  `components/ui/table.tsx`. O cabeçalho continua `h-12 px-4`. A linha continua
  com hover `bg-muted/50`.
- **Diálogo no pacote de UI (2026-09-25)** - O dialog saiu de
  `components/ui/dialog.tsx`. O aninhamento continua com deslocamento de
  `0.85rem` e escala `0.985`. O corpo continua contendo o overscroll.
- **Gaveta no pacote de UI (2026-09-25)** - O sheet saiu de
  `components/ui/sheet.tsx`. Continua abrindo pela direita, com overlay
  `bg-black/80` e o fechar rotulado `Close`.
- **Seletor no pacote de UI (2026-09-25)** - O select saiu de
  `components/ui/select.tsx`. Continua sem modal, abrindo embaixo com
  deslocamento 1. O desbloqueio de rolagem do Radix permanece.
- **Menu suspenso no pacote de UI (2026-09-25)** - O dropdown saiu de
  `components/ui/dropdown-menu.tsx`. O conteúdo continua com deslocamento 4 e
  camada `--layer-tooltip`. O hover do item continua laranja.
- **Dica e avatar no pacote de UI (2026-09-25)** - `Tooltip` e `Avatar` saíram
  de `components/ui`. A dica continua com deslocamento 4 e fundo `bg-slate-900`.
  O avatar continua círculo `h-10 w-10` com fallback `bg-muted`.
- **Interruptor e esqueleto no pacote de UI (2026-09-25)** - `Switch` e
  `Skeleton` saíram de `components/ui`. O interruptor continua `h-6 w-11` com
  polegar em `translate-x-5`. O esqueleto continua
  `animate-pulse rounded-md bg-muted`.
- **Selos do menu admin no frontend compartilhado (2026-09-25)** - A contagem
  saiu de `hooks/use-admin-badges.ts`. FINANCIAL continua só no aging. O
  intervalo continua 60 segundos. O evento continua `admin-badges-invalidate`.
- **Caixa de e-mail no frontend compartilhado (2026-09-25)** - Pastas, remetente
  e texto de encaminhamento saíram de `components/admin/email/utils.ts`. Inbox
  continua Caixa de entrada. Outbox continua escondida. `unReadCount` continua
  `unreadCount`. O hook da página continua em `hooks/`.
- **Lista admin de equipamentos no frontend compartilhado (2026-09-25)** -
  Filtro, ordem, preço e data saíram do hook. A página continua com 9 itens. A
  busca continua com limite 1000. Esse filtro continua separado do da vitrine
  pública. O carregamento continua no hook.
- **Mapa da categoria no frontend compartilhado (2026-09-25)** - A conversão
  para o diálogo e para a API saiu do hook. A página continua com 9 itens. Ícone
  com origem none continua lucide. JSON inválido continua no desenho padrão. A
  lista continua no hook.
- **Breakpoint móvel no frontend compartilhado (2026-09-25)** - `useIsMobile`
  saiu de `hooks/use-mobile.tsx`. A largura móvel continua abaixo de 768 e a
  consulta continua `(max-width: 767px)`.
- **Diálogo de saída no frontend compartilhado (2026-09-25)** - O diálogo saiu
  de `components/dialogs/logout-confirmation-dialog.tsx`. O título continua
  Confirmar saída. Os botões continuam Cancelar e Sair. O destino padrão
  continua `/`.
- **Popover no pacote de UI (2026-09-25)** - A busca e os seletores passaram a
  importar `Popover` de `@gb-locacoes/ui`. O alinhamento continua central, o
  deslocamento 4 e a camada `z-[95]`. `components/ui/popover.tsx` foi removido.
- **Busca do cabeçalho no frontend compartilhado (2026-09-25)** - A busca saiu
  de `components/header-search-combobox.tsx`. A chave continua
  `gb-locacoes-recent-searches`, no máximo 6, a partir de 2 caracteres e com
  espera de 300 ms. A dica foi para `@gb-locacoes/ui`.
- **Cabeçalho na variante web (2026-09-25)** - O componente saiu de
  `components/header.tsx`. O layout continua montando o mesmo Header. O fundo
  fixo continua `#334155`. A busca e o diálogo de saída continuam em
  `components/`.
- **Menu do cabeçalho no frontend compartilhado (2026-09-25)** - Os links
  públicos e o menu da conta saíram para o frontend. Equipamentos continua
  `/equipamentos` sem parâmetros. A equipe continua vendo Painel Administrador.
  O cabeçalho ainda desenha os ícones.
- **Usuário do cabeçalho no frontend compartilhado (2026-09-25)** - Iniciais,
  primeiro nome, página ativa e papéis de equipe saíram para o frontend. Nome
  vazio continua U e Cliente. CLIENT continua fora da equipe. O cabeçalho
  continua em `components/header.tsx`.
- **Negócio local sem reexport (2026-09-25)** - Home, detalhe, rodapé e schemas
  leem o negócio local direto do frontend. Sem configuração, o CNPJ continua
  34.780.330/0001-69 e o telefone +55 51 2313-6262.
  `lib/structured-data-utils.ts` foi removido.
- **Configurações públicas sem hook legado (2026-09-25)** - Cabeçalho, rodapé,
  hero, contato e área do cliente leem as configurações direto do frontend. O
  telefone continua (51) 2313-6262 e a busca continua GET /api/settings/public.
  `hooks/use-public-settings.ts` foi removido.
- **Botão sem reexport (2026-09-25)** - As telas importam `Button` de
  `@gb-locacoes/ui`. O padrão continua `bg-slate-700`. A variante reset continua
  sem escala e sem borda laranja. `components/ui/button.tsx` foi removido.
- **Campo sem reexport (2026-09-25)** - Formulários, orçamento, admin, busca e
  moeda importam `Input` de `@gb-locacoes/ui`. O texto continua com altura h-10.
  O número continua com Incrementar e Decrementar. `components/ui/input.tsx` foi
  removido.
- **Cartão sem reexport (2026-09-25)** - Admin, área do cliente, orçamento e
  listagens importam `Card` de `@gb-locacoes/ui`. A borda, a sombra leve e o
  título em `text-2xl` continuam. `components/ui/card.tsx` foi removido.
- **Selo sem reexport (2026-09-25)** - As telas passaram a importar `Badge` de
  `@gb-locacoes/ui`. A pílula padrão continua arredondada e primária. A variante
  destrutiva continua com fundo destrutivo. O selo de categoria continua em
  outro arquivo. `components/ui/badge.tsx` foi removido.
- **Alerta sem reexport do componente (2026-09-25)** - O boleto do cliente
  importa `Alert` de `@gb-locacoes/ui`. Continuam os títulos Boleto não
  disponível e Boleto Vencido. O vencido continua na variante destrutiva.
  `components/ui/alert.tsx` foi removido.
- **Área de texto sem reexport (2026-09-25)** - Orçamento, contato, admin e
  rejeição importam `Textarea` de `@gb-locacoes/ui`. A altura mínima continua
  80px, a largura continua total e o texto continua pequeno.
  `components/ui/textarea.tsx` foi removido.
- **Rótulo sem reexport (2026-09-25)** - Formulários, orçamento, admin e
  histórias importam `Label` de `@gb-locacoes/ui`. O texto continua pequeno,
  peso médio e sem entrelinha extra. `components/ui/label.tsx` foi removido.
- **Separador sem reexport (2026-09-25)** - Orçamento, gantt, menu móvel e
  painéis do calendário importam `Separator` de `@gb-locacoes/ui`. Horizontal
  continua 1px de altura. Vertical continua 1px de largura.
  `components/ui/separator.tsx` foi removido.
- **Alerta sem reexport (2026-09-25)** - Orçamento, histórico e saída importam o
  alerta de `@gb-locacoes/ui`. O título continua Incluir finais de semana?. Os
  botões continuam Não, apenas dias úteis e Sim, incluir finais de semana.
  `components/ui/alert-dialog.tsx` foi removido.
- **Botão de fechar sem reexport (2026-09-25)** - Cabeçalho, orçamento,
  WhatsApp, upload e saída importam `CloseButton` de `@gb-locacoes/ui`. Sem
  rótulo, o aria-label continua Close. No orçamento continua Fechar dialog.
  `components/ui/close-button.tsx` foi removido.
- **Checkbox sem reexport (2026-09-25)** - As telas passaram a importar
  `Checkbox` de `@gb-locacoes/ui`. Marcado, continua laranja. A variante de
  cabeçalho continua branca com borda laranja clara.
  `components/ui/checkbox.tsx` foi removido.
- **Dica sem reexport (2026-09-25)** - Busca, upload, status, diálogos, boleto,
  impostos e equipamento importam a dica direto do frontend. No servidor o
  gatilho continua visível e o texto continua escondido.
  `components/ui/HybridTooltip.tsx` foi removido.
- **Calendário sem reexport (2026-09-25)** - Seletores de data, boleto,
  logística, gantt e edição de equipamento importam o calendário direto do
  frontend. Janeiro de 2026 continua com o texto janeiro. Os botões continuam
  Mês anterior e Próximo mês. `components/ui/calendar.tsx` foi removido.
- **Seletor de período sem reexport (2026-09-25)** - Equipamento novo e edição
  no admin importam o seletor direto do frontend. O rótulo Quinzenal continua.
  `components/equipment-pricing-selector.tsx` foi removido.
- **Multa de locação sem reexport (2026-09-25)** - A rota admin importa
  `calculateRentalLateFee` direto do frontend. Total 1000 em 10 dias, 5 dias
  atrasado, continua multa 25. `lib/rental-late-fee.ts` foi removido. A conta
  continua separada da multa do orçamento.
- **Contato sem reexport (2026-09-25)** - `components/contact-form.tsx` e
  `components/ui/contact-info-card.tsx` não eram importados e foram removidos. O
  título continua Entre em Contato, o botão Enviar Solicitação e o telefone (51)
  2313-6262.
- **Vencimento do boleto sem reexport (2026-09-25)** - O orçamento e a conversão
  de locação importam `getBoletoDueDate` direto do frontend. Segunda 5 de
  janeiro de 2026 mais 3 dias úteis continua 8 de janeiro às 23:59:59. Sexta
  mais 1 dia útil continua segunda 12. `lib/boleto-utils.ts` foi removido.
- **Dica de hover sem reexport em hooks (2026-09-25)** - `hooks/useHasHover.ts`
  não tinha chamadas e foi removido. A dica continua em `HybridTooltip`.
- **Termos do orçamento sem reexport (2026-09-25)** - A página `/orcamento`
  importa os termos direto do frontend. A data continua 19 de janeiro de 2026.
  `components/terms/terms-content.ts` foi removido.
- **Preço do pedido de orçamento sem reexport (2026-09-25)** -
  `POST /api/quotes` e `POST /api/orcamentos` importam `buildQuotePricing`
  direto do frontend. Três dias e quantidade 2 continuam período `diaria` e
  total 600. `lib/quote-pricing.ts` foi removido.
- **Preço do orçamento sem reexport (2026-09-25)** - `/orcamento` e a área do
  cliente importam o motor de preço direto do frontend. Sete dias com valor
  direto semanal 400 continuam 400. `lib/pricing.ts` foi removido.
- **Frete do orçamento sem reexport (2026-09-25)** - A página `/orcamento` e a
  rota `POST /api/quotes` importam o frete direto do frontend. CEP inválido, os
  valores 30 e 45 e os prazos de 3 e 1 dias continuam.
  `lib/freight-calculator.ts` foi removido.
- **CPF e CNPJ do orçamento no frontend compartilhado (2026-09-25)** - A
  validação e a formatação saíram para o frontend. Documento vazio continua
  hífen. A busca de CEP no ViaCEP continua em `lib/utils/validation.ts`.
- **WhatsApp do orçamento no frontend compartilhado (2026-09-25)** - A mensagem
  saiu de `lib/whatsapp.ts`. O título, o CPF vazio omitido e o preço final 0
  continuam iguais. O telefone passado pela página continua `555198205163`. O
  arquivo antigo foi removido.
- **Dados novos do cliente no orçamento (2026-09-25)** - A escolha do que gravar
  no perfil saiu para o frontend. Telefone, CPF e CNPJ continuam comparados só
  pelos dígitos. A empresa continua comparada com maiúsculas e o valor gravado
  continua o texto original do formulário.
- **Fim de semana e endereço do orçamento (2026-09-25)** - A confirmação de fim
  de semana e a comparação de endereço saíram para o frontend. Continua o
  primeiro item sem datas e sem confirmação. CEP com ou sem hífen continua o
  mesmo endereço. Complemento não entra na checagem de endereço completo.
- **Validação do orçamento no frontend compartilhado (2026-09-25)** - A ordem de
  CPF ou CNPJ, documento válido, empresa, dias, tipo de entrega e endereço saiu
  para `assessQuoteSubmit`. Retirada em loja continua sem endereço. Os avisos e
  o foco nos campos continuam na página `/orcamento`.
- **Corpo do orçamento no frontend compartilhado (2026-09-25)** - O POST
  `/api/quotes` da página de orçamento passou a montar o corpo em
  `entities/orcamento`. CPF, CNPJ, CEP, empresa e recado em branco continuam
  omitidos. Quantidade e dias 0 continuam 1. O aviso de campos obrigatórios
  continua Nome Completo, Telefone e E-mail.
- **Formulário de material no frontend compartilhado (2026-09-25)** - A regra
  saiu de `hooks/use-quote-form.ts`. O total continua preço vezes quantidade
  vezes dias. Quantidade e dias continuam no mínimo 1. O envio continua uma
  espera de 2 segundos, sem POST, e o sucesso limpa o carrinho. O arquivo antigo
  foi removido.
- **Sincronia do carrinho no frontend compartilhado (2026-09-25)** - A regra
  saiu de `hooks/use-cart-sync.ts`. Continua o GET `/api/cart/sync` e o POST
  `/api/cart/merge` quando há sessão e itens locais. Preço final ausente
  continua indefinido. O arquivo antigo foi removido.
- **Aviso de carrinho no frontend compartilhado (2026-09-25)** - O cabeçalho lê
  o contador na loja nova. Um item continua "1 item" e dois continuam "2 items".
  O destino continua `/orcamento`. `hooks/use-cart-notifications.ts` foi
  removido.
- **Aposentadoria da loja antiga do carrinho (2026-09-25)** - O orçamento, a
  área do cliente e os hooks do carrinho importam a loja direto do frontend.
  `stores/useCartStore.ts` foi removido. A chave continua `gb-locacoes-cart`.
- **Aposentadoria das datas antigas da locação (2026-09-25)** - O orçamento, a
  área do cliente e a criação de orçamento importam as datas direto do frontend.
  `lib/rental-date-utils.ts` foi removido. Sábado sem fim de semana continua na
  segunda.
- **Carrinho no frontend compartilhado (2026-09-25)** - Sábado sem fim de semana
  continua na segunda. Item repetido continua substituindo a quantidade. A chave
  continua `gb-locacoes-cart`. `stores/useCartStore.ts` e
  `lib/rental-date-utils.ts` só reexportam.
- **Botão de fechar no pacote de UI (2026-09-25)** - Sem rótulo, continua
  "Close". No orçamento, continua "Fechar dialog" no tamanho pequeno.
  `components/ui/close-button.tsx` só reexporta.
- **Diálogo de alerta no pacote de UI (2026-09-25)** - Confirmar continua no
  botão padrão e cancelar no contorno. A pergunta do orçamento continua "Incluir
  finais de semana?". `components/ui/alert-dialog.tsx` só reexporta.
- **Avisos do detalhe no frontend compartilhado (2026-09-25)** - Os toasts de
  data e de login passaram para o modelo da página. Continuam no canto direito
  por 8 segundos, e o login no centro por 12 segundos. O detalhe chama o Sonner
  direto.
- **Dica híbrida no frontend compartilhado (2026-09-25)** - O tooltip de mouse e
  o popover de toque passaram para o frontend. No servidor o texto continua
  escondido. `components/ui/HybridTooltip.tsx` e `hooks/useHasHover.ts` só
  reexportam.
- **Calendário no frontend compartilhado (2026-09-25)** - Os botões continuam
  "Mês anterior" e "Próximo mês". No detalhe, o calendário continua fechado até
  ser aberto. `components/ui/calendar.tsx` só reexporta.
- **Checkbox no pacote de UI (2026-09-25)** - O checkbox web manteve o marcado
  laranja e a variante de cabeçalho. O detalhe continua com "Incluir finais de
  semana". `components/ui/checkbox.tsx` só reexporta.
- **Seletor de período no frontend compartilhado (2026-09-25)** - Diário,
  Semanal, Quinzenal e Mensal passaram para o frontend. O admin ainda importa
  `components/equipment-pricing-selector.tsx`, que agora só reexporta.
- **Botão de orçamento no frontend compartilhado (2026-09-25)** - O botão do
  detalhe passou para a variante web. O rótulo continua "Solicitar Orçamento
  Grátis". `components/smart-quote-button.tsx` foi removido.
- **Preço do detalhe no frontend compartilhado (2026-09-25)** - O bloco de preço
  e orçamento do detalhe passou para a tela. Continuam "Entrega em Porto Alegre
  e região" e "Resposta em até 2 horas".
  `components/smart-equipment-pricing.tsx` foi removido.
- **Selo da categoria no detalhe (2026-09-25)** - A tela de detalhe monta o selo
  no tamanho `sm`, sem hover. A rota só entrega ícone e cores. O desenho do selo
  continua em `components/ui/category-badge.tsx`.
- **Trilha do equipamento no frontend compartilhado (2026-09-25)** - A trilha do
  detalhe passou para a variante web da tela. Continua Home, Equipamentos e a
  categoria. `components/ui/breadcrumb.tsx` foi removido porque ninguém mais o
  importava.
- **Voltar aos equipamentos no frontend compartilhado (2026-09-25)** - O link do
  detalhe passou para a variante web da tela. O texto continua "Voltar aos
  Equipamentos" e o destino continua `/equipamentos`.
- **Galeria do equipamento no frontend compartilhado (2026-09-25)** - A galeria
  do detalhe passou para a variante web da tela. Sem fotos, o placeholder
  continua `height=600&width=800&text=Equipamento`. O aviso "Zoom para ampliar"
  permanece. `components/equipment-image-gallery.tsx` foi removido.
- **Aposentadoria do JSON-LD antigo (2026-09-25)** - A home e o detalhe importam
  o widget direto. `components/structured-data.tsx` foi removido. O CNPJ, os
  catálogos e a nota 4.8 com 124 avaliações permanecem.
- **Dados estruturados no frontend compartilhado (2026-09-25)** - O JSON-LD de
  negócio, produto e trilha saiu de `components/structured-data.tsx`. O CNPJ, os
  quatro catálogos, a condição usada e a nota 4.8 com 124 avaliações permanecem.
  A home e o detalhe ainda importam o reexport.
- **Compartilhar equipamento no frontend compartilhado (2026-09-25)** - O botão
  do detalhe passou para a própria tela. O rótulo inicial continua Compartilhar.
  O título continua `{nome} - GB Locações`. `components/share-button.tsx` foi
  removido porque ninguém mais o importava.
- **Animação do detalhe no frontend compartilhado (2026-09-25)** - A entrada do
  card, das seções e dos benefícios passou para a tela de detalhe. Continua de
  20 pixels até o lugar, em 0,3s, com os mesmos atrasos.
  `components/equipment-detail-animations.tsx` foi removido porque ninguém mais
  o importava.
- **Itens inclusos do equipamento no frontend compartilhado (2026-09-25)** -
  Manutenção preventiva, suporte técnico e entrega passaram para a tela de
  detalhe. O hover continua laranja e o texto em repouso continua cinza.
  `components/equipment-inclusion-item.tsx` foi removido porque ninguém mais o
  importava.
- **Detalhe do equipamento no frontend compartilhado (2026-09-25)** - O layout
  de `/equipamentos/{id}` foi para `@gb-locacoes/frontend`. A nota 4.8 e as 127
  avaliações continuam fixas. A busca no banco, a galeria e o preço permanecem
  na rota.
- **SEO do equipamento no frontend compartilhado (2026-09-25)** - Título,
  descrição, imagem, produto e breadcrumb do detalhe foram para
  `@gb-locacoes/frontend`. O título continua "Aluguel de {nome} em Porto Alegre
  | GB Locações". A busca no banco e a tela continuam na rota.
- **Catálogo de equipamentos no frontend compartilhado (2026-09-25)** -
  `/equipamentos` foi para `@gb-locacoes/frontend`. A rota continua lendo
  `?categoria=`, a imagem, o link, o filtro, a paginação e o selo pequeno da
  categoria. A busca segue em `/api/equipments` e `/api/categories`.
- **Página Sobre no frontend compartilhado (2026-09-25)** - `/sobre` foi para
  `@gb-locacoes/frontend`. A rota continua montando o carrossel 3D e o selo do
  Google. O primeiro modelo continua sem zoom até `scrollRevealReady`. O
  componente do carrossel não mudou.
- **Validade do orçamento no frontend compartilhado (2026-09-25)** - A regra de
  orçamento válido saiu de `lib/quote-validity.ts`. Só PENDING passa. Sem data
  continua válido. A nota de expirado no banco permanece no arquivo legado.
- **Vencimento do boleto no frontend compartilhado (2026-09-25)** - A soma de
  dias úteis saiu de `lib/boleto-utils.ts`. Três dias úteis a partir de uma
  segunda continuam na quinta, no fim do dia. Sexta mais um dia útil continua na
  segunda. A gravação do pagamento permanece onde já estava.
- **Alíquota financeira no frontend compartilhado (2026-09-25)** - A escolha do
  documento, a taxa e o líquido saíram de `lib/financial.ts`. CNI continua na
  frente de CNPJ. 1000 a 6% continua 940. A leitura de `financialSetting`
  permanece no arquivo legado.
- **Código do orçamento no frontend compartilhado (2026-09-25)** - O formato
  `Q-ano-sequência` saiu de `lib/quote-code.ts`. 2026 e 7 continuam
  `Q-2026-0007`. A busca do último código e a gravação permanecem no arquivo
  legado, com Prisma.
- **Tributos no frontend compartilhado (2026-09-25)** - ISS, retenção, Simples,
  Lucro Presumido, Lucro Real e IBS/CBS saíram de `lib/tax-engine.ts`. CPF 1000
  continua líquido 940. A leitura de `financialSetting` permanece no arquivo
  legado, com Prisma.
- **Multa da locação no frontend compartilhado (2026-09-25)** - A conta de 5% do
  valor diário saiu da rota de locação. Sem atraso continua 0. Dez dias de
  contrato a 1000, com 5 dias de atraso, continuam 25. A rota ainda grava a
  multa, marca OVERDUE e cria o pagamento PIX. Não foi unificada com a multa do
  orçamento.
- **Multa do orçamento no frontend compartilhado (2026-09-25)** - O cálculo puro
  saiu de `lib/late-fee-calculator.ts`. Sem atraso continua 0. Cinco dias sobre
  1000 a 2% continuam 100. A gravação em lote permanece no arquivo legado, com
  Prisma. A multa da locação (5% do valor diário) não foi unificada.
- **Reajuste do orçamento no frontend compartilhado (2026-09-25)** - A
  justificativa e os rótulos de `lib/utils.ts` foram para a entidade de
  orçamento. Os textos do financeiro e do PDF de ofício permanecem nos próprios
  arquivos, porque são diferentes.
- **Frete estimado no frontend compartilhado (2026-09-25)** - O cálculo de frete
  foi para a entidade de orçamento. CEP inválido, o par 30/45 e os prazos de 3 e
  1 dias permanecem. `lib/freight-calculator.ts` só reexporta.
- **Preço do orçamento no frontend compartilhado (2026-09-25)** -
  `buildQuotePricing` foi para a entidade de orçamento. Diária, semana e o total
  vezes a quantidade permanecem. `lib/quote-pricing.ts` só reexporta.
- **Preço do equipamento no frontend compartilhado (2026-09-25)** - O cálculo
  por período foi para `@gb-locacoes/frontend`. Semana direta, desconto de 10%,
  valor zero, quinzena e mês permanecem. `lib/pricing.ts` só reexporta.
- **Listagem de equipamentos no frontend compartilhado (2026-09-25)** -
  `/equipamentos` continua na rota legada. Filtro, ordem pt-BR e páginas de 9
  itens passaram para `@gb-locacoes/frontend`.
- **Dados locais de SEO no frontend compartilhado (2026-09-25)** -
  `getLocalBusinessData` foi para `@gb-locacoes/frontend`. CNPJ, endereço e a
  forma do telefone permanecem. `lib/structured-data-utils.ts` só reexporta.
- **Recorte do hero da home (2026-09-25)** - A home continua no `app/page.tsx`
  com Prisma. O carrossel e a onda inicial do hero passaram para
  `@gb-locacoes/frontend/pages/home`, com o mesmo descarte de imagem vazia e o
  padrão `animated`.
- **Callback de login no frontend compartilhado (2026-09-25)** -
  `/auth/callback` continua mostrando “Entrando...”. Sem sessão vai para
  `/login`. Com sessão, o destino é o mesmo do `/login`.
- **Entrada do admin no frontend compartilhado (2026-09-25)** - `/admin/login`
  continua indo para `/login`. `/admin` continua esperando 300 ms e indo ao
  dashboard ou de volta ao login, conforme a sessão.
- **Cadastro no frontend compartilhado (2026-09-25)** - `/cadastro` foi para
  `@gb-locacoes/frontend`. O envio continua em `POST /api/auth/register` e a
  volta ao login preserva `callbackUrl`.
- **Entrar no frontend compartilhado (2026-09-25)** - `/entrar` foi para
  `@gb-locacoes/frontend` sem ser fundida com `/login`. Continuam `router.push`,
  `router.refresh` e o login social em `/auth/callback`.
- **Login no frontend compartilhado (2026-09-25)** - `/login` foi para
  `@gb-locacoes/frontend`. A rota continua chamando `signIn('credentials')`. O
  destino depois do login permanece: callback interno, admin no dashboard,
  demais na área do cliente.
- **Redefinir senha no frontend compartilhado (2026-09-25)** - `/reset-password`
  foi para `@gb-locacoes/frontend`. A rota continua lendo `?token=` e o envio
  continua em `POST /api/auth/reset-password`.
- **Recuperar senha no frontend compartilhado (2026-09-25)** -
  `/recuperar-senha` foi para `@gb-locacoes/frontend`. O envio continua em
  `POST /api/auth/forgot-password` e o link de volta continua em `/login`.
- **Página de contato no frontend compartilhado (2026-09-25)** - `/contato` e o
  formulário foram para `@gb-locacoes/frontend`. O envio continua em
  `POST /api/contact`. O mapa do Google permanece na rota.
- **Cartão de contato no frontend compartilhado (2026-09-25)** - O cartão e a
  leitura de configurações públicas foram para `@gb-locacoes/frontend`. Cookies,
  privacidade, devolução e termos renderizam o mesmo cartão, com as frases e os
  contatos padrão de antes.
- **Termos no frontend compartilhado (2026-09-25)** - O texto de `/termos` e a
  data de atualização foram para `@gb-locacoes/frontend`. O orçamento continua
  lendo o mesmo conteúdo pelo reexport de `components/terms/terms-content.ts`.
- **Privacidade e devolução no frontend compartilhado (2026-09-25)** - Os textos
  de `/privacidade` e `/politica-devolucao` foram para `@gb-locacoes/frontend`.
  As URLs, a metadata e o cartão de contato permanecem.
- **Página de cookies no frontend compartilhado (2026-09-25)** - O texto de
  `/cookies` foi para `@gb-locacoes/frontend/pages/cookies`. A URL, a metadata e
  o cartão de contato permanecem.
- **Card e Badge em packages/ui (2026-09-25)** - `components/ui/card.tsx` e
  `badge.tsx` reexportam `@gb-locacoes/ui`, com as mesmas classes.
- **Label, Textarea e Separator em packages/ui (2026-09-25)** - Os três arquivos
  em `components/ui` reexportam `@gb-locacoes/ui`, com as mesmas classes.
- **Campo Input em packages/ui (2026-09-25)** - `components/ui/input.tsx`
  reexporta `@gb-locacoes/ui`. Campo numérico mantém os controles Incrementar e
  Decrementar.
- **Botão de produção em packages/ui (2026-09-25)** - `components/ui/button.tsx`
  reexporta `@gb-locacoes/ui`. Variantes e classes, inclusive `reset` sem zoom e
  sem borda laranja, permanecem.
- **Formatador de moeda no frontend compartilhado (2026-09-25)** -
  `formatCurrency` mora em `packages/frontend/src/shared/lib/moeda.ts`.
  `lib/utils.ts` e `lib/utils/formatting.ts` reexportam a mesma função, com o
  mesmo resultado em real.
- **Esqueleto da topologia (2026-09-25)** - Hosts `apps/clients/web` e
  `apps/clients/mobile`, pacotes `@gb-locacoes/frontend`, `@gb-locacoes/ui` e
  `@gb-locacoes/design-tokens`, e gates `pnpm arch` / `pnpm tokens`. O app Next
  da raiz segue servindo as URLs atuais. O exemplo de produto do template não
  entrou no repositório.
- **Plano de migração de arquitetura (2026-09-25)** - Inventário do legado e
  ordem das fatias em `docs/migration/00-plano.md` e diário em
  `docs/migration/MIGRATION.md`. Nenhum código de produto, URL, schema ou
  integração foi alterado. A fase seguinte espera confirmação do escopo npm
  `@gb-locacoes`.
- **Excluir reajuste no painel financeiro (2026-02-21)** - O bloco de reajustes
  em `/admin/financeiro` passou a exibir um botão de exclusão em cada item do
  histórico. Ao excluir, um diálogo de confirmação é exibido; o valor total do
  orçamento e a justificativa são recalculados pela API. A role `FINANCIAL` foi
  incluída no endpoint DELETE de adjustments para permitir que usuários
  financeiros excluam reajustes incorretos.

### Changed

- **Dialog de reajuste: containers separados (2026-02-21)** - O modal de
  "Registrar Reajuste" em `/admin/orcamentos` passou a exibir três blocos
  visuais distintos: (1) Orçamento – valor original em container `bg-gray-50`;
  (2) Reajustes – itens e botão "Adicionar reajuste" em container com borda
  tracejada; (3) Resumo – total dos reajustes e novo valor final em container
  `bg-orange-50`, exibido apenas quando há itens adicionados.
- **Kanban: animação de altura estável na 1ª busca e na busca cross-mês
  (2026-02-19)** - Em `/admin/orcamentos`, a resolução do mês da busca em modo
  Kanban passou a ocorrer no `fetchQuotes` no mesmo ciclo do `setQuotes`,
  eliminando render transitório com colunas vazias (`kanbanFilteredQuotes = []`)
  que quebrava a animação de altura. No `KanbanPipeline`, o `AnimatedHeight`
  passou a consolidar medição inicial no mount (`useLayoutEffect` + commit
  inicial), garantindo baseline de animação já na primeira interação no input de
  busca. O wrapper de render do Kanban também passou a usar `key` estável para
  evitar remount do pipeline ao auto-navegar mês durante busca ativa.
- **Busca no Kanban de orçamentos (2026-02-19)** - Corrigido cenário em que o
  badge da coluna mostrava contagem correta mas os cards não renderizavam.
  `KanbanPipeline` deixou de depender do buffer em duas fases
  (`displayedItems`/`onExitComplete`) e passou a animar/renderizar cards por
  item. O loading global da página foi limitado ao primeiro carregamento, sem
  recarregar a tela inteira a cada digitação no input de busca. No Kanban, a
  filtragem mensal foi mantida com auto-navegação para o primeiro mês com
  resultados quando necessário. Filtros ocultos (`period`/`valueRange`) não são
  enviados em modo Kanban; o termo de busca usa `trim()`.
- **Correção aria-hidden no dropdown de notificações do admin (2026-02-19)** -
  Adicionado `modal={false}` nos DropdownMenus de notificações e menu do usuário
  em `admin-header-actions.tsx`, evitando o aviso "Blocked aria-hidden on an
  element because its descendant retained focus" quando o dropdown abre.
- **Supressão de warnings Three.js no console (2026-02-19)** - ClientLayout
  passa a suprimir (via interceptação de console) os avisos conhecidos de
  bibliotecas externas: (1) depreciação de `THREE.Clock` (react-three-fiber usa
  internamente; migração depende de atualização da lib); (2)
  `THREE.WebGLRenderer: Context Lost` (comum em dev com HMR ou troca de aba).
  Adicionado handler `preventDefault` em `webglcontextlost` no ModelViewer para
  suavizar recuperação. Estilos e animações do carrossel 3D mantidos
  inalterados.
- **Atualização de dependências (2026-02-19)** - Storybook 10.2.8 → 10.2.10;
  framer-motion, happy-dom, puppeteer, style-dictionary; @supabase/supabase-js;
  @types/node, @typescript-eslint/\*, jsdom, tailwind-merge, @types/three,
  lucide-react, three. Tailwind mantido em 3.4.17 (4.x incompatível).
- **Otimização de performance (react-best-practices) (2026-02-19)** - Aplicadas
  melhorias sem alterar estilos ou animações: (1) `/equipamentos/[id]`:
  `React.cache()` para deduplicar fetch de equipment entre `generateMetadata` e
  página; (2) `/admin/email`: fetch de mensagens disparado ao carregar pastas,
  eliminando ciclo extra de render; (3) `usePublicSettings`: skip de fetch
  cliente quando `initialData` fornecido pelo servidor; (4) `/admin/orcamentos`:
  `next/dynamic` para KanbanPipeline, KanbanMonthNavigator e AdvancedCalendar;
  (5) `/area-cliente/historico`: `useMemo` para `convertedQuoteIds`,
  `quoteToRentalMap`, `historyItems` e `filteredItems`.

### Added

- **Formato padrão de orçamento por equipamento (2026-02-18)** - Componente
  reutilizável `EquipmentQuotePriceBlock`
  (`components/equipment-quote-price-block.tsx`) que garante o mesmo formato DOM
  em toda a aplicação: nome do equipamento, preço original (quando aplicável),
  desconto percentual/mensal e preço final. Utilizado em
  `app/area-cliente/historico/[id]/page.tsx` e `app/admin/orcamentos/page.tsx`
  (painel lateral de detalhes do orçamento). Documentação em
  `docs/features/equipment-quote-price-block.md`.

### Changed

- **Dialog Ajustar Valor Final: múltiplos itens de reajuste (2026-02-18)** - Na
  dialog de reajuste em `/admin/orcamentos` é possível adicionar vários itens
  antes de registrar: botão "Adicionar reajuste" inclui novo bloco (categoria,
  valor, justificativa); cada item pode ser removido (exceto o último); ao
  confirmar, os reajustes são enviados em sequência à API. Mantido padrão visual
  de bloco com borda tracejada e Select do design system.
  (`app/admin/orcamentos/page.tsx`)
- **Dialog Ajustar Valor Final: mecanismo alinhado ao padrão de equipamentos
  (2026-02-18)** - Categoria do reajuste passou a usar o componente `Select` do
  design system; bloco de formulário dentro de container com borda tracejada, no
  mesmo padrão da seção "Adicionar Especificação" da página de edição de
  equipamentos. (`app/admin/orcamentos/page.tsx`)

### Security

- **🔴 CRÍTICO: Correção de vulnerabilidade de autorização em `/api/quotes`
  (2026-02-14)** - Removido parâmetro `userId` da query string que permitia que
  usuários autenticados acessassem orçamentos de outros usuários via
  `GET /api/quotes?userId=vitima-user-id`. A autenticação agora usa
  EXCLUSIVAMENTE `session.user.id` do NextAuth como fonte única de verdade.
  Adicionado rate limiting (10 req/min) para proteção adicional.
  (`app/api/quotes/route.ts`)

### Fixed

- **Orçamento aprovado deve mover para coluna "Aprovado" no Kanban
  (2026-02-18)** - Ao aprovar um orçamento (UPFRONT ou ON_DELIVERY), o status
  permanecia PENDING e o card continuava na coluna "Aprovação Pendente". A API
  PATCH agora define `status = 'APPROVED'` para todos os payment terms ao
  aprovar. Além disso, `normalizeQuote` no frontend trata orçamentos com
  `approvedAt` e status pendente (dados legados) como aprovados para exibição no
  Kanban. (`app/api/admin/quotes/[id]/route.ts`,
  `app/admin/orcamentos/page.tsx`)
- **Ajuste TRAVEL (Deslocamento/Frete) não deve somar com frete calculado
  (2026-02-18)** - Ao configurar um reajuste com categoria "Deslocamento
  (Frete)" e informar um valor manual (ex.: R$ 30,00), o sistema somava esse
  valor ao frete já calculado pelo sistema, duplicando o frete. Corrigido: o
  valor informado **substitui** o `deliveryFee` no cálculo do total final, não
  soma. APIs `POST` e `DELETE` de adjustments atualizadas.
  (`app/api/admin/quotes/[id]/adjustments/route.ts`,
  `app/api/admin/quotes/[id]/adjustments/[adjustmentId]/route.ts`)
- **CI: Type check ENOENT next-env.d.ts (2026-02-16)** - No GitHub Actions o
  step "Type check" falhava com
  `ENOENT: no such file or directory, open '.../next-env.d.ts'` porque o arquivo
  é gerado pelo Next.js no build e está no `.gitignore`; no job "Tests &
  Quality" o type-check roda antes do build. O script
  `scripts/patch-next-env-for-typecheck.cjs` agora cria um `next-env.d.ts`
  mínimo (referências de tipos do Next) quando o arquivo não existir, permitindo
  que o type-check passe no CI sem alterar o workflow.
- **🔴 CRÍTICO: Preservação de datas individuais na conversão Quote → Rental
  (2026-02-14)** - Corrigido problema onde datas individuais dos itens
  (`startDate`, `endDate`, `includeWeekends`) eram perdidas ao converter
  orçamento para locação. Adicionados novos campos `startDate`, `endDate` e
  `includeWeekends` à tabela `rental_items` (nullable para compatibilidade) e
  atualizado `lib/rental-converter.ts` para preservar essas datas. As datas
  globais do rental agora são calculadas como min/max das datas dos itens.
  (`prisma/schema.prisma`, `lib/rental-converter.ts`)
- **Correção de tipos TypeScript no endpoint de download de PDF de reajustes
  (2026-02-14)** - Corrigidos erros de compilação TypeScript: alterado
  `priceAdjustments` para `adjustments` (nome correto da relação Prisma),
  `reason` para `justification` (nome correto do campo), `createdBy` para
  `createdByUser` (nome correto da relação), e Buffer convertido para Uint8Array
  para compatibilidade com NextResponse.
  (`app/api/admin/quotes/[id]/adjustments/download/route.ts`)
- **Correção de tipos TypeScript em testes críticos (2026-02-14)** - Adicionadas
  verificações `expect(response).toBeDefined()` e non-null assertions
  (`response!`) nos testes de ajuste de orçamento e termos de pagamento para
  resolver erros de "possibly undefined".
  (`tests/critical/quote-adjustment.test.ts`,
  `tests/critical/quote-payment-terms.test.ts`)

### Changed

- **Atualização de dependências (2026-02-14)** - prisma-zod-generator 2.1.2 →
  2.1.4, react-resizable-panels 4.6.2 → 4.6.4. Tailwind mantido em 3.4.17 (4.x
  incompatível com Next 16 + design system).
- **CI: Type check TS1109/TS1160 em routes.d.ts (2026-02-14)** - Implementada
  solução do known-issue #127: removidos paths `.next/types` do tsconfig, criado
  `scripts/patch-next-env-for-typecheck.cjs` que remove o import de
  `routes.d.ts` antes do type-check (evita erros em arquivo gerado pelo
  Next.js). Excluído `scripts/test-quote-system.ts` do type-check (script
  utilitário rodado via tsx).
- **Performance da busca no painel financeiro (2026-02-14)** - Input de busca
  com debounce (350ms) no próprio componente de filtro, evitando re-render da
  página inteira a cada tecla e múltiplas requisições; atualização da lista com
  `startTransition` e `DebtorsTable` memoizado para reduzir re-renders.
  (`app/admin/financeiro/page.tsx`,
  `components/admin/financial/DebtorsTable.tsx`,
  `docs/features/admin-financeiro-page.md`)
- **Fluxo Melnick (`AT_END`) para pagar no fim da locação (2026-02-14)** -
  Adicionado `paymentTerms` em orçamentos (`UPFRONT`, `ON_DELIVERY`, `AT_END`)
  com seletor no modal de `/admin/orcamentos`. Quando aprovado com `AT_END`, o
  backend permite conversão operacional para locação sem pagamento inicial e sem
  autogerar boleto nessa etapa, preservando `UPFRONT` como padrão.
  (`prisma/schema.prisma`, `app/api/admin/quotes/[id]/route.ts`,
  `app/api/admin/quotes/route.ts`, `app/api/quotes/route.ts`,
  `app/admin/orcamentos/page.tsx`, `tests/critical/quote-payment-terms.test.ts`)
- **Conexão direta entre Orçamentos e Financeiro (2026-02-14)** - As páginas
  `/admin/orcamentos` e `/admin/financeiro` agora compartilham contexto por
  query string (`search`/`status`) e atalhos operacionais: "Ver no Financeiro"
  (em orçamentos) e "Ver orçamento" (em financeiro), evitando refazer busca
  manual ao alternar entre as telas. (`app/admin/orcamentos/page.tsx`,
  `app/admin/financeiro/page.tsx`)
- **Orçamentos: alteração de vencimento de boleto no próprio modal
  (2026-02-14)** - O modal de `/admin/orcamentos` ganhou ação "Salvar novo
  vencimento" para boleto já gerado, reutilizando o endpoint financeiro de
  atualização de `dueDate` e sincronizando com o gateway.
  (`app/admin/orcamentos/page.tsx`,
  `app/api/admin/financial/entries/[id]/due-date/route.ts`)
- **Botão de ação "Ver Detalhes" unificado no painel admin (2026-02-13)** -
  Todas as tabelas do painel que tinham o botão grande "Ver Detalhes" passaram a
  usar o mesmo padrão da página `/admin/financeiro`: botão ícone 32×32px
  (MoreHorizontal) com dropdown e item "Exibir". Páginas alteradas: orçamentos,
  locações (rentals), manutenção (maintenance) e logística (logistics).
  (`app/admin/orcamentos/page.tsx`, `app/admin/rentals/page.tsx`,
  `app/admin/maintenance/page.tsx`, `app/admin/logistics/page.tsx`)

### Added

- **Hook `use-debounce` reutilizável (2026-02-14)** - Criado hook customizado de
  debounce (350ms padrão) para otimizar performance em buscas e filtros.
  Aplicado na busca de orçamentos em `/admin/orcamentos`.
  (`hooks/use-debounce.ts`, `app/admin/orcamentos/page.tsx`)
- **Paginação server-side em orçamentos (2026-02-14)** - Implementada paginação
  real com backend retornando metadados (total, page, limit) e frontend
  carregando apenas 20 itens por vez. Melhora significativa de performance para
  bases com 100+ orçamentos. (`app/admin/orcamentos/page.tsx`,
  `app/api/admin/quotes/route.ts`)
- **Página dedicada de detalhes de orçamento (2026-02-14)** - Nova rota
  `/admin/orcamentos/[id]` com URL compartilhável para visualização de detalhes
  completos do orçamento, facilitando suporte e operação. Inclui componente de
  loading dedicado. (`app/admin/orcamentos/[id]/page.tsx`,
  `app/admin/orcamentos/[id]/loading.tsx`)
- **Geração de PDF para reajustes de orçamento (2026-02-14)** - Novo endpoint
  `/api/admin/quotes/[id]/adjustments/download` que gera documento formal
  (ofício) em PDF com todos os reajustes aplicados ao orçamento. Usa PDFKit para
  geração com cabeçalho GB Locações, tabela de reajustes detalhada e valores
  totais. Botão de download disponível no frontend.
  (`app/api/admin/quotes/[id]/adjustments/download/route.ts`,
  `app/admin/orcamentos/page.tsx`)
- **Rate limiting em rotas críticas de orçamentos (2026-02-14)** - Adicionado
  rate limiting em:
  - `POST /api/quotes` - strictRateLimit (10/min) para criação pública
  - `POST /api/admin/quotes/[id]/generate-boleto` - strictRateLimit (10/min)
    para geração de boleto
  - `POST /api/admin/quotes/[id]/send-boleto` - strictRateLimit (10/min) para
    envio de email
  - `PATCH /api/admin/quotes/[id]` - adminApiRateLimit (200/min) para operações
    admin (`app/api/quotes/route.ts`, `app/api/admin/quotes/[id]/route.ts`,
    `app/api/admin/quotes/[id]/generate-boleto/route.ts`,
    `app/api/admin/quotes/[id]/send-boleto/route.ts`)

- **Painel admin WhatsApp (Meta Cloud API + Prisma) (2026-02-02)** - Nova seção
  `/admin/whatsapp` para acompanhar e responder mensagens de clientes via Meta
  WhatsApp Cloud API. Interface inspirada no e-mail: lista de conversas, lista
  de mensagens da conversa selecionada e preview com ações Responder e Expandir.
  Mensagens recebidas via webhook são persistidas no banco
  (WhatsAppConversation, WhatsAppMessage); envio de respostas via API Meta e
  persistência local. Webhook em `/api/webhooks/whatsapp` (GET verificação, POST
  mensagens/status). APIs admin: GET/POST `/api/admin/whatsapp/conversations`,
  GET/POST `/api/admin/whatsapp/conversations/[id]/messages`. Variáveis de
  ambiente: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN,
  WEBHOOK_VERIFY_TOKEN. (`prisma/schema.prisma`, `lib/meta-whatsapp.ts`,
  `app/api/webhooks/whatsapp/route.ts`, `app/api/admin/whatsapp/`,
  `app/admin/whatsapp/page.tsx`, `components/admin/whatsapp/`,
  `components/admin/admin-sidebar.tsx`, `docs/features/admin-whatsapp-ui-ux.md`)
- **Painel Financeiro dedicado (`/admin/financeiro`) (2026-02-11)** - Nova
  página financeira separada do dashboard, com busca unificada por
  cliente/código, filtro por status financeiro, visão tabela/calendário,
  atualização de status de cobrança, configuração de alíquotas CPF/CNPJ/CNI e
  exportação em PDF formato ofício. Endpoints adicionados:
  `GET /api/admin/financial/entries`,
  `PATCH /api/admin/financial/entries/[id]/status`,
  `GET /api/admin/financial/calendar`,
  `GET /api/admin/financial/export?format=pdf`,
  `GET/PATCH /api/admin/financial/settings`. (`app/admin/financeiro/page.tsx`,
  `app/api/admin/financial/*`, `lib/financial.ts`,
  `docs/features/admin-financeiro-page.md`)
- **Reajuste de orçamento categorizado (2026-02-11)** - Novo modelo
  `QuoteAdjustment` com categorias (`LABOR`, `TRAVEL`, `MAINTENANCE`, `OTHER`),
  justificativa obrigatória, histórico de envio por e-mail/WhatsApp e endpoint
  dedicado `GET/POST /api/admin/quotes/[id]/adjustments`.
  (`prisma/schema.prisma`, `app/api/admin/quotes/[id]/adjustments/route.ts`,
  `app/admin/orcamentos/page.tsx`, `docs/features/quote-price-adjustment.md`)
- **Documentos sensíveis do cliente (antifraude) (2026-02-11)** - Inclusão do
  modelo `ClientDocument` com upload privado (URL assinada curta) para
  documento, selfie, contrato assinado e comprovante CPF/CNPJ, incluindo
  bloqueio de fechamento/ativação sem documentos mínimos.
  (`app/api/admin/rentals/[id]/client-documents/route.ts`,
  `app/api/admin/clients/[id]/documents/route.ts`, `lib/client-documents.ts`,
  `app/admin/rentals/page.tsx`, `docs/features/client-documents-antifraud.md`)
- **Código operacional de orçamento `quoteCode` (2026-02-11)** - Campo único
  `Q-ANO-SEQUENCIAL` adicionado ao `Quote` com suporte a backfill e busca por
  código legado (`legacyExternalCode`). (`prisma/schema.prisma`,
  `lib/quote-code.ts`, `app/api/quotes/route.ts`,
  `app/api/admin/quotes/route.ts`, `scripts/backfill-quote-codes.ts`)

### Fixed

- **Warnings do Recharts (`width(-1)/height(-1)`) removidos sem alterar layout
  dos dashboards (2026-02-14)** - `ChartContainer` e sparkline dos KPIs passaram
  a montar `ResponsiveContainer` apenas quando o wrapper tem dimensão válida
  (via `ResizeObserver`), eliminando ruído de console em `/admin/dashboard` e no
  dashboard de `/admin/financeiro` sem impacto visual.
  (`components/ui/chart.tsx`, `components/admin/financial/KPICard.tsx`,
  `docs/issues/known-issues.md`, `docs/features/admin-system.md`)
- **Dashboard e Financeiro alinhados por fonte unica de filtros/agregacoes
  (2026-02-14)** - Consolidado escopo financeiro compartilhado em
  `lib/financial-scope.ts` e aplicado nas rotas
  `entries`/`calendar`/`export`/`revenue`/`aging`, com ajuste do dashboard admin
  para usar o mesmo recorte financeiro. A view Dashboard de `/admin/financeiro`
  passou a reaplicar os filtros ativos (`search`/`status`/`periodo`) nos
  graficos, e o cron de verificacao de boleto sincroniza `status` e
  `billingStatus` em atraso/baixa. Inclui testes criticos para alocacao de
  receita por categoria e sync do cron. (`lib/financial-scope.ts`,
  `app/api/admin/financial/entries/route.ts`,
  `app/api/admin/financial/calendar/route.ts`,
  `app/api/admin/financial/export/route.ts`,
  `app/api/admin/financial/revenue/route.ts`,
  `app/api/admin/financial/aging/route.ts`, `app/api/admin/dashboard/route.ts`,
  `lib/financial-calculations.ts`, `app/admin/financeiro/page.tsx`,
  `app/api/cron/verify-boleto-payments/route.ts`,
  `tests/critical/financial-revenue.test.ts`,
  `tests/critical/verify-boleto-payments-cron.test.ts`)
- **Pagamentos convertidos (quote -> rental) voltaram a aparecer no financeiro
  (2026-02-14)** - Os endpoints financeiros deixaram de depender apenas de
  `quoteId` e passaram a incluir também pagamentos vinculados por `rentalId`,
  com fallback de dados de cliente/código por `rental.quote` e `rental.users`.
  Impacto aplicado em tabela, calendário e exportação PDF, com teste crítico
  cobrindo o cenário de `quoteId = null`.
  (`app/api/admin/financial/entries/route.ts`,
  `app/api/admin/financial/calendar/route.ts`,
  `app/api/admin/financial/export/route.ts`,
  `tests/critical/financial-entries.test.ts`)
- **Substituição de boleto agora cancela cobrança anterior no gateway
  (2026-02-14)** - Ao regenerar boleto por alteração de valor, o fluxo de
  orçamento tenta cancelar a cobrança anterior no Asaas antes de vincular a nova
  transação, evitando acúmulo de cobranças antigas ativas. No financeiro, foi
  adicionado endpoint e ação no modal para alterar vencimento (`dueDate`) com
  sincronização no gateway. (`lib/quote-boleto.ts`,
  `lib/payment-gateways/asaas.ts`, `lib/payment-gateways/boleto.ts`,
  `app/api/admin/financial/entries/[id]/due-date/route.ts`,
  `app/admin/financeiro/page.tsx`, `tests/critical/quote-boleto.test.ts`,
  `tests/critical/financial-due-date.test.ts`)
- **Painel admin mobile no iOS com barras do Safari alternando entre preto e
  azul (2026-02-13)** - Refatorado `app/admin/layout.tsx` para server component
  com `viewport` segmentado (`themeColor: #334155`) e metadata de status bar
  (`apple-mobile-web-app-status-bar-style: default`), movendo a logica client
  para `app/admin/admin-layout-client.tsx`. Resultado: topo (status bar) e base
  (barra de endereco) permanecem consistentes no Safari iPhone durante
  carregamento e scroll. Ajuste complementar: sincronizacao em runtime no
  `app/ClientLayout.tsx` por `pathname` (`/admin` x publico), com deduplicacao
  de meta tags para evitar estado intermitente em navegacao client-side.
  (`app/admin/layout.tsx`, `app/admin/admin-layout-client.tsx`,
  `app/ClientLayout.tsx`, `docs/issues/known-issues.md`,
  `docs/features/admin-system.md`)
- **Preview do Equipamento e HybridTooltip sumiam com apenas 1 imagem
  (2026-02-13)** - Na edição/criação de equipamento, o título "Preview do
  Equipamento" e o ícone de informação (tooltip) só apareciam quando havia mais
  de uma imagem. Correção: exibir o header (título + HybridTooltip) sempre que
  houver pelo menos 1 imagem; manter o indicador "X de Y" apenas quando houver
  múltiplas imagens. (`components/ui/image-upload.tsx`,
  `docs/issues/known-issues.md`)
- **Upload de imagens em equipamentos (novo/editar) não abria o seletor de
  arquivos (2026-02-11)** - Em `/admin/equipamentos/novo` e em editar
  equipamento, o botão "Escolher Arquivos" não abria o diálogo de seleção de
  arquivos. Causa: dependência de ref no componente `Input` e clique
  programático pouco confiável. Correção: uso de `<input type="file">` nativo
  com `Label htmlFor` para ativar o input pelo clique no "Escolher Arquivos"
  (sem depender de ref); quando desabilitado, exibição de `Button` desabilitado.
  (`components/ui/image-upload.tsx`, `docs/issues/known-issues.md`)
- **Geração de boleto duplicada por cliques rápidos (2026-02-11)** - Correção de
  condição de corrida no fluxo de boleto com serialização transacional por
  orçamento (`pg_advisory_xact_lock`) e deduplicação lógica no banco com
  restrição única `quoteId + method + type`. Frontend recebeu lock por `quoteId`
  no botão de gerar boleto. (`lib/quote-boleto.ts`, `prisma/schema.prisma`,
  `app/admin/orcamentos/page.tsx`, `scripts/dedupe-quote-boleto-payments.ts`)
- **APIs admin com erro 500 por schema Prisma local desatualizado
  (2026-02-11)** - Após introdução de novos campos em `Quote`/`Payment`, o banco
  local sem sincronização retornava `P2022 (column does not exist)` em rotas do
  dashboard (`/api/admin/dashboard`, `/api/admin/quotes`,
  `/api/admin/financial/aging`). Correção operacional com `prisma db push`,
  backfill de `quoteCode` e validação das consultas.
  (`docs/issues/known-issues.md`)
- **Testes com falhas `P2022` por banco de teste sem sync de schema
  (2026-02-11)** - `tests/global-setup.ts` passou a sincronizar automaticamente
  o `TEST_DATABASE_URL` com `prisma db push --accept-data-loss` antes de subir o
  servidor de testes, eliminando erros de colunas ausentes durante `pnpm test`.
  (`tests/global-setup.ts`, `docs/guides/testing.md`,
  `docs/issues/known-issues.md`)
- **Timeout e exaustão de conexão na geração concorrente de boleto
  (2026-02-11)** - Ajustada a transação de `ensureQuoteBoletoPayment` com
  `maxWait`/`timeout` explícitos e leitura de alíquotas financeiras via `tx`
  (evitando nova conexão fora da transação), estabilizando os cenários de
  concorrência e geração automática do boleto. (`lib/quote-boleto.ts`,
  `lib/financial.ts`, `docs/issues/known-issues.md`)
- **Scripts de backfill/dedupe falhando sem `DATABASE_URL` no shell
  (2026-02-11)** - `db:backfill:quote-codes` e `db:dedupe:boletos` passaram a
  carregar `.env.local`/`.env` automaticamente para execução consistente fora do
  contexto do Next.js. (`scripts/backfill-quote-codes.ts`,
  `scripts/dedupe-quote-boleto-payments.ts`)
- **CI: Build falhando com JavaScript heap out of memory (2026-02-08)** - O step
  "Build application" do GitHub Actions falhava durante "Running TypeScript" com
  `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`.
  O runner ubuntu-latest tem ~7GB RAM; com Postgres, testes e build no mesmo
  job, a memória era insuficiente. Correção: job `build` separado (runner sem
  Postgres); `productionBrowserSourceMaps: false`,
  `experimental.webpackMemoryOptimizations`, `serverSourceMaps: false` em CI;
  `NODE_OPTIONS: --max-old-space-size=5120`. (`.github/workflows/ci.yml`,
  `next.config.mjs`, `docs/issues/known-issues.md`)
- **CI: Type check falhando com JavaScript heap out of memory (2026-02-06)** - O
  step "Type check" do GitHub Actions falhava com
  `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`.
  O `tsc --noEmit` excedia o limite de heap padrão do Node.js (~2GB). Correção:
  adicionado `NODE_OPTIONS: --max-old-space-size=6144` nos steps de type-check
  dos workflows (`.github/workflows/ci.yml`, `test.yml`, `ci-fallback.yml`).
- **Mapa (Store Locator) não carregava ao alternar entre páginas
  (2026-02-05)** - Em navegação SPA entre homepage e `/contato`, o mapa aparecia
  em branco até dar refresh. Causa: next/script não chama onLoad de novo quando
  o script ECL já está no documento. Correção: detectar ECL já carregado no
  mount (customElements.get('gmpx-store-locator')) e setar scriptLoaded; aplicar
  configureFromQuickBuilder após duplo requestAnimationFrame para garantir
  layout com dimensões. (`components/google-store-locator.tsx`,
  `docs/issues/known-issues.md`)
- **E-mail admin: mensagem marcada como lida não persistia ao navegar
  (2026-02-02)** - A listagem da Zoho retorna `status` ("0"/"1") e não `isRead`;
  a API de listagem não mapeava esse campo, então ao refetch após navegar a
  mensagem voltava a aparecer como não lida. Correção: normalizar `status` →
  `isRead` na rota GET `/api/admin/zoho-mail/messages` e fallback no frontend;
  enviar `threadIds` ao marcar como lida (clique, botão ou em massa) quando
  disponível para a Zoho persistir em conversas.
  (`app/api/admin/zoho-mail/messages/route.ts`, `app/admin/email/page.tsx`,
  `docs/issues/known-issues.md`)
- **CI: Type check falhando com TS1109/TS1160 em routes.d.ts (2026-02-02)** - O
  step "Type check" do GitHub Actions falhava ao validar o arquivo gerado
  `.next/dev/types/routes.d.ts` (Next.js typed routes), que em alguns casos era
  gerado com sintaxe inválida. Ajustes: remoção dos paths `.next/types` e
  `.next/dev/types` do `include` do `tsconfig.json`; `typedRoutes: false` em
  `next.config.mjs`; step no CI que remove o import de `routes.d.ts` do
  `next-env.d.ts` antes do type-check. (`tsconfig.json`, `next.config.mjs`,
  `.github/workflows/ci.yml`, `docs/issues/known-issues.md`)

### Changed

- **Dropdown: z-index acima da dialog para abrir dentro de modal (2026-02-02)**
  - Conteúdo do `DropdownMenuContent` e `DropdownMenuSubContent` passou a usar
    `z-[var(--layer-tooltip)]` (100) em vez de `z-50`, para que o menu abra
    visível quando o trigger está dentro de uma dialog (ex.: "Mais opções" na
    visualização completa de e-mail). A dialog usa `--layer-dialog` (90).
  - (`components/ui/dropdown-menu.tsx`)
- **Roles e permissões admin alinhadas (2026-02-11)** - Enum de roles
  padronizado para `ADMIN`, `FINANCIAL`, `OPERATOR`, `CLIENT`; guards
  centralizadas (`requireRoles`, `requirePermission`, `requireFinancialAccess`),
  restrição de navegação por role e redirecionamento automático do perfil
  financeiro para `/admin/financeiro`. (`prisma/schema.prisma`,
  `middlewares/require-admin.ts`, `lib/auth.ts`, `types/next-auth.d.ts`,
  `app/admin/layout.tsx`, `components/admin/admin-sidebar.tsx`,
  `components/admin/mobile-sidebar.tsx`,
  `docs/features/admin-permissions-and-roles.md`)
- **Busca de orçamentos no admin por cliente OU código (2026-02-11)** - Campo de
  pesquisa unificado passou a contemplar `quoteCode`, `legacyExternalCode` e
  dados do cliente no mesmo filtro. (`app/api/admin/quotes/route.ts`,
  `app/admin/orcamentos/page.tsx`, `docs/features/admin-orcamentos-page.md`,
  `docs/features/quote-system.md`)
- **Tooltips padronizados para status (2026-02-11)** - Criado dicionário central
  de status e componente reutilizável de tooltip aplicado em orçamentos,
  locações e financeiro. (`lib/status-definitions.ts`,
  `components/ui/status-tooltip.tsx`, `app/admin/orcamentos/page.tsx`,
  `app/admin/rentals/page.tsx`, `app/admin/financeiro/page.tsx`)
- **E-mail admin: dropdown "Mais opções" na dialog de visualização completa
  (2026-02-02)** - No bloco de metadados da mensagem (data, De, Para) da dialog
  de visualização completa (Expandir), o botão "Mais opções" passou a ser
  exibido no canto superior direito, com menu: Marcar como lido/não lido,
  Destacar/Remover destaque, Arquivar, separador, Denunciar spam e Excluir
  (ações destrutivas em vermelho). Handlers conectados à page para arquivar,
  excluir, marcar spam e toggle lido/destacar. Opção Arquivar oculta na pasta
  Arquivados. (`email-viewer.tsx`, `email-full-view-dialog.tsx`,
  `app/admin/email/page.tsx`, `docs/features/admin-email-ui-ux.md`)
- **E-mail admin: dialog de confirmação ao marcar como spam (2026-02-02)** - Ao
  clicar em "Spam" (barra de ações em massa) ou em "Denunciar spam" no menu do
  visualizador, é exibida uma dialog de confirmação perguntando se o usuário
  deseja marcar a(s) mensagem(ns) como spam, no mesmo padrão da confirmação de
  exclusão permanente da lixeira. Ação só é executada após confirmar.
  (`app/admin/email/page.tsx`, `docs/features/admin-zoho-mail-integration.md`)
- **E-mail admin: botão Atualizar mensagens no cabeçalho Pastas (2026-02-02)**
  - O botão "Atualizar mensagens" foi movido do card de filtros para o cabeçalho
    "Pastas" na sidebar (à direita do texto "Pastas"), com altura h-7 e text-xs
    igual ao botão "Selecionar". (`email-folder-list.tsx`,
    `email-layout-container.tsx`, `app/admin/email/page.tsx`)
- **E-mail admin: wrap do corpo da mensagem na dialog de expansão (2026-02-02)**
  - Na dialog de visualização completa (botão "Expandir"), o corpo da mensagem
    passou a quebrar linha em vez de exigir scroll horizontal: removido
    `min-w-max` do container, `overflow-x-hidden` no viewport, e aplicado
    `break-words` e `[&_pre]:whitespace-pre-wrap` no bloco prose para leitura
    linear pelo administrador. (`components/admin/email/email-viewer.tsx`)
- **Sheet (mobile): botão Fechar menor no preview de e-mail (2026-02-02)** - O
  botão Close do Sheet em mobile passou de 36×36px (`h-9 w-9`) para 28×28px
  (`h-7 w-7`) para evitar sobreposição com o botão "Mais opções" no header do
  viewer de mensagem em `/admin/email`. Ícone X ajustado proporcionalmente.
  (`components/ui/sheet.tsx`)
- **globals: 17.2.0 → 17.3.0 (2026-02-02)** - Atualização do pacote usado pelo
  ESLint para definição de ambientes (browser, node, es2021).
- **E-mail admin: dialog de visualização completa conforme padrões do projeto
  (2026-02-01)** - A dialog de e-mail expandida em `/admin/email` foi ajustada
  para seguir as normas de identidade visual das dialogs (skill
  dialogs-implementation): botões Responder, Encaminhar e Mais opções movidos
  para o `Dialog.Footer`; `scrollbarGutter: "stable"` no BodyViewport;
  `Dialog.Footer` obrigatório com botões padronizados; `EmailViewer` com prop
  `embedMode` para omitir ações no corpo quando usado na dialog.
  (`components/admin/email/email-full-view-dialog.tsx`,
  `components/admin/email/email-viewer.tsx`, `app/admin/email/page.tsx`)
- **E-mail admin: campo Bcc removido do compositor (2026-02-01)** - O campo
  "Bcc" (cópia oculta) foi removido do modal de composição de e-mail em
  `/admin/email`. O formulário de novo e-mail, responder e encaminhar exibe
  apenas De, Para, Cc, Assunto e Mensagem.
  (`components/admin/email/ email-composer-dialog.tsx`)

### Added

- **Admin Dashboard: otimizações de performance (LCP) (2026-01-31)** - Página
  `/admin/dashboard` otimizada para reduzir LCP (Largest Contentful Paint),
  mantendo layout e funcionalidade. Lazy-load de gráficos Recharts; carregamento
  progressivo (stats primeiro, dados secundários em paralelo); KPIs financeiros
  e DebtorsTable sob demanda. **Shell imediato:** remoção do loading
  full-screen; header e skeletons dos cards são exibidos imediatamente; LCP
  passa a ser o primeiro conteúdo pintado. **API:** `availableEquipments`
  paralelizado no `Promise.all`. Animações stagger mantidas nos cards.
  (`app/admin/dashboard/page.tsx`, `app/api/admin/dashboard/route.ts`,
  `components/admin/dashboard/`)

### Fixed

- **ScrollArea: espessura consistente entre scrollbars vertical e horizontal
  (2026-02-01)** - O thumb agora fixa espessura por orientação via `style`
  (`width`/`height` 8px) e usa `flex-none`, garantindo espessura igual no
  preview de e-mails. (`components/ui/scroll-area.tsx`)
- **E-mail admin: mecanismo nested nas dialogs Responder/Encaminhar
  (2026-02-01)**
  - A dialog de visualização completa (pai) passa a aplicar corretamente o
    mecanismo nested quando a dialog Responder ou Encaminhar está aberta:
    overlay escuro (bg-black/45), animação de recuo e redução de escala na
    dialog pai, conforme skill dialogs-implementation.
    (`components/admin/email/email-full-view-dialog.tsx`,
    `app/admin/email/page.tsx`)
- **E-mail admin: conteúdo encaminhado com código CSS/HTML vazando
  (2026-02-01)** - Ao clicar em Encaminhar, blocos `<style>` e `<script>` eram
  apenas despojados das tags, deixando o CSS (ex:
  `div.zm_... P { margin-top: 0 }`) visível no texto. A extração passa a remover
  esses blocos por completo e converter HTML em texto puro.
  (`app/admin/email/page.tsx`)
- **E-mail admin: scroll do textarea não funcionava no compositor
  (2026-02-01)** - O `Dialog.BodyViewport` interceptava wheel sobre o textarea e
  impedia rolagem. Passa a ignorar eventos de wheel cujo alvo é um `<textarea>`.
  (`components/ui/dialog.tsx`)
- **Zoho Mail: imagens inline de assinatura não apareciam (2026-02-01)** - O
  conteúdo do Zoho trazia URLs relativas `/mail/ImageDisplay?...`, que eram
  requisitadas no domínio do app e retornavam 404. A rota de visualização agora
  reescreve essas URLs para o proxy inline
  `/api/admin/zoho-mail/messages/[messageId]/inline`, usando `cid` e `fileName`
  da query. (`app/api/admin/zoho-mail/messages/[messageId]/route.ts`)
- **Admin: refresh em páginas do painel redirecionava para login e voltava ao
  dashboard (2026-02-01)** - O `SessionProvider` era recriado no
  `app/admin/layout.tsx` sem sessão inicial, fazendo o `useSession` oscilar e
  disparar redirect. Removido o provider aninhado; o admin agora usa o
  `SessionProvider` global com sessão inicial do servidor, evitando redirects no
  refresh. (`app/admin/layout.tsx`)
- **Zoho Mail: desarquivar não movia mensagens (2026-02-01)** - Em conversas, a
  API pode esperar `threadId`, e o `unArchiveMails` pode não mover para o Inbox.
  A lista agora inclui `threadId`, o unarchive envia `threadIds` quando
  disponível e, quando possível, usa `action: 'move'` com `targetFolderId`
  (Caixa de entrada) para garantir o retorno. Para `move`, o payload envia
  `threadId` **e** `messageId` quando ambos existirem e inclui `isArchive` +
  `folderId` (source) ao mover a partir de Arquivados. O payload segue em JSON
  bruto com IDs numéricos preservados (sem `Number(id)`), evitando perda de
  precisão. (`app/admin/email/page.tsx`,
  `components/admin/email/email-message-list.tsx`,
  `app/api/admin/zoho-mail/messages/update/route.ts`)
- **E-mail admin: botão Arquivar na pasta Arquivado e ação Desarquivar
  (2026-02-01)** - Na pasta "Arquivado", o botão "Arquivar" foi substituído por
  "Desarquivar" (ícone ArchiveRestore). Clicar em "Desarquivar" envia a mensagem
  de volta para a Caixa de entrada via API `unarchive` e remove da lista
  (atualização otimista). Assim evita-se clicar em "Arquivar" numa mensagem já
  arquivada (a mensagem sumia e reaparecia ao voltar).
  (`app/admin/email/page.tsx`, `components/admin/email/email-message-list.tsx`,
  `email-layout-container.tsx`)
- **E-mail admin: ações rápidas (ler, arquivar, excluir, destacar) lentas ao
  clicar (2026-02-01)** - Os botões de ação na lista de mensagens em
  `/admin/email` aguardavam a resposta da API antes de atualizar a UI, causando
  sensação de lentidão. Implementada atualização otimista: a UI atualiza
  imediatamente no clique; em caso de erro da API ou de rede, o estado é
  revertido e um toast de erro é exibido. Aplica-se a marcar como lido/não lido,
  arquivar, excluir e destacar. (`app/admin/email/page.tsx`)
- **Zoho Mail: botão Destacar retornava 500 (2026-02-01)** - A ação star/unstar
  usava modos `starMessages`/`unstarMessages` inexistentes na Zoho Mail API.
  Corrigido para usar `setFlag` com `flagid: "important"` ou `"flag_not_set"`.
  (`app/api/admin/zoho-mail/messages/update/route.ts`)
- **E-mail admin: espaçamento uniforme dos botões de ação na lista
  (2026-02-01)** - O botão "Destacar" (estrela) na lista de mensagens em
  `/admin/email` aparecia mais afastado dos demais (ler, arquivar, excluir) por
  estar fora do mesmo container flex. Todos os botões passaram a ser filhos
  diretos do mesmo container com `gap-1`, garantindo espaçamento uniforme.
  (`components/admin/email/email-message-list.tsx`)
- **E-mail admin: seleção de texto na lista de mensagens (2026-02-01)** - Na
  lista de mensagens em `/admin/email`, o texto (remetente, assunto, resumo)
  passou a ser selecionável e copiável; clique simples continua abrindo a
  mensagem no preview. Adicionado `select-text` na área de conteúdo e no resumo;
  o clique só abre a mensagem quando não há seleção de texto.
  (`components/admin/email/email-message-list.tsx`)
- **KPI Valor em Atraso: sparkline desalinhado em relacao aos demais
  (2026-01-31)** - O grafico do cartao "Valor em Atraso" aparecia mais alto ou
  menor que os outros KPIs quando todos os valores do sparkline eram iguais.
  Corrigido com YAxis oculto e dominio explicito que trata o caso min === max,
  alem de margens e min-height consistentes.
  (`components/admin/financial/KPICard.tsx`)
- **Zoho Mail: preview de mensagem carrega via endpoints de detalhes/conteúdo
  (2026-01-31)** - A rota de leitura passou a consultar `details` e `content`
  dentro da pasta, incluindo anexos quando disponíveis, eliminando 500 ao abrir
  o preview em `/admin/email`.
  (`app/api/admin/zoho-mail/messages/[messageId]/route.ts`)
- **Zoho Mail: atualização de mensagens usa endpoint correto (2026-01-31)** -
  Ajustado o `messages/update` para o endpoint `updatemessage`, com
  `moveMessage` e `destfolderId` no payload. Corrige 500 ao marcar lido/não lido
  ou mover. (`app/api/admin/zoho-mail/messages/update/route.ts`)
- **E-mail admin: lista de mensagens sem botão aninhado (2026-01-31)** - A área
  clicável da mensagem passou a usar `role="button"` para evitar `<button>`
  dentro de `<button>`, eliminando o warning de hydration nas ações rápidas da
  lista. (`components/admin/email/email-message-list.tsx`)
- **Zoho Mail: mensagem amigável quando OAuth não está configurado
  (2026-01-30)** - Ao clicar em "Conectar Zoho Mail" sem `ZOHO_CLIENT_ID` no
  `.env`, o app redireciona para `/admin/email` com toast explicando a
  configuração, em vez de retornar 500 e a página genérica "This page isn't
  working". Adicionado `isZohoOAuthConfigured()` em `lib/zoho-mail/client.ts` e
  tratamento na rota `GET /api/admin/zoho-mail/oauth/authorize`. Documentação em
  `docs/features/admin-zoho-mail-integration.md` (variáveis obrigatórias).
- **DateRangePicker: seleção de período no e-mail admin conclui start/end
  (2026-01-30)** - O `DateRangePicker` preserva a data de início ao selecionar
  apenas o primeiro clique, permitindo escolher a data final e aplicar o range
  corretamente no filtro de período. (`components/ui/date-range-picker.tsx`)
- **DateRangePicker: navegacao de mes/ano funciona no filtro do e-mail admin
  (2026-01-30)** - Removido controle fixo do `month` para permitir que o
  calendario responda aos dropdowns de mes/ano e as setas de navegacao.
  (`components/ui/date-range-picker.tsx`)
- **DateRangePicker: dropdown de anos permite ano anterior e seguinte
  (2026-01-30)** - Ajustado o intervalo de navegacao do calendario para permitir
  anos anteriores (quando `allowPastDates` estiver ativo) e o ano seguinte por
  padrão. (`components/ui/date-range-picker.tsx`)
- **DateRangePicker: espaço entre período e botão de limpar (2026-01-30)** -
  Adicionado espaçamento visual entre o texto do período e o ícone de limpar no
  botão do filtro de período. (`components/ui/date-range-picker.tsx`)
- **DateRangePicker: toasts guiadas alinhadas ao calendário de equipamentos
  (2026-01-30)** - Ajustado o texto e duração das toasts para orientar seleção
  de data de início e fim com a mesma mensagem usada na visualização de
  equipamentos. (`components/ui/date-range-picker.tsx`)
- **DateRangePicker: toasts guiadas seguem start/end no filtro do e-mail
  (2026-01-30)** - Corrigido o gatilho das toasts para usar
  `startDate`/`endDate`, evitando que apenas a mensagem final apareça no
  primeiro clique. (`components/ui/date-range-picker.tsx`)
- **Sonner (admin): toasts respeitam altura do header (2026-01-30)** - Ajustado
  o offset vertical do toaster no painel admin para exibir toasts abaixo do
  header fixo, incluindo tratamento do status bar no mobile.
  (`components/ui/sonner-toaster.tsx`)
- **E-mail admin (mobile): bloco de mensagens não é cortado (2026-01-30)** -
  Limitada a altura do painel de pastas no layout mobile para liberar espaço e
  evitar corte do bloco de mensagens.
  (`components/admin/email/email-layout-container.tsx`)
- **E-mail admin: limites do preview convertidos de 500px/800px para percentual
  (2026-01-31)** - O `ResizablePanel` agora calcula min/max com base na largura
  disponível do container e normaliza as preferências salvas para evitar painel
  travado, mantendo a intenção em pixels sem quebrar o resize. Os valores
  percentuais são enviados como string com `%` para a lib interpretar como
  percentual. (`components/admin/email/email-layout-container.tsx`)
- **E-mail admin: bounds do preview e clampPercent robustos (2026-01-31)** -
  `DEFAULT_PREVIEW_BOUNDS` alterado de 0–100% para 40–70% (~500–800px em
  ~1200px) para evitar preview em 0% antes do ResizeObserver. Em containers
  muito estreitos, o fallback mantém o mínimo em pixels (não reseta para 0–100).
  `clampPercent` passa a aceitar undefined/null e retorna valor seguro, evitando
  "NaN" nas props do ResizablePanel.
  (`components/admin/email/email-layout-container.tsx`)
- **E-mail admin: range válido quando container < 500px (2026-01-31)** - Quando
  a largura do container é menor que PREVIEW_MIN_PX (500px), min e max ficavam
  ambos 100%, gerando intervalo inválido e painel de mensagens em 0%. Fallback
  agora define min = 95%, max = 100% nesse caso, mantendo range de 5% e lista
  visível. (`components/admin/email/email-layout-container.tsx`)
- **E-mail admin: range de bounds do preview sempre >= 5% (2026-01-31)** - Em
  larguras 500–600px, quando minPercent ficava entre 95–99%, o else do fallback
  gerava max=100 e min=minPercent (range < 5%), causando preview com tamanho
  inválido ou irredimensionável. Fallback agora trata
  `minPercent + MIN_BOUND_RANGE > 100` com min=95%, max=100%, garantindo
  `max - min >= MIN_BOUND_RANGE`.
  (`components/admin/email/email-layout-container.tsx`)
- **E-mail admin: minSize 30% no painel de mensagens (2026-01-31)** - O painel
  de lista de mensagens teve `minSize={30}` removido na migração para
  percentuais sem equivalente; permitia redimensionar a lista até 0% e deixá-la
  invisível. Restaurado com `minSize="30%"` (30%) conforme documentação.
  (`components/admin/email/email-layout-container.tsx`)
- **E-mail admin: sync de bounds respeita minSize das mensagens (2026-01-31)** -
  O ajuste automático do preview agora considera `messages >= 30%`, evitando
  salvar valores inválidos no localStorage e prevenindo travas no resize.
  (`components/admin/email/email-layout-container.tsx`)
- **E-mail admin: tamanhos do ResizablePanel usam "%" (2026-01-31)** -
  `defaultSize`, `minSize` e `maxSize` usam string com `%` (ex.: `"30%"`),
  evitando interpretação em px e mantendo resize correto.
  (`components/admin/email/email-layout-container.tsx`)
- **E-mail admin: mensagens com maxSize baseado no preview (2026-01-31)** - O
  painel de mensagens passa a respeitar `maxSize={100 - previewMin}`, evitando
  comprimir o preview abaixo do mínimo.
  (`components/admin/email/email-layout-container.tsx`)
- **E-mail admin: remove campo "folders" do localStorage (2026-01-31)** -
  Persistência do layout salva apenas `messages` e `preview`, evitando dado
  legado não utilizado. (`components/admin/email/email-layout-container.tsx`)

### Removed

- **Documentação: skill React/Next.js removido do repositório (2026-01-31)** -
  Removidos `docs/skills/react-best-practices/` e o guia associado. Uso segue
  local via `.cursor/skills/` e `.codex/skills/`. (`docs/README.md`,
  `README.md`, `AGENTS.md`, `docs/ai/context-map.md`)
- **Recurso de atalhos removido da página de e-mail admin (2026-01-30)** -
  Removido completamente o recurso de atalhos de teclado da página de e-mail
  admin (`/admin/email`). Removido botão "Atalhos" do header, dialog de atalhos
  com listagem de teclas (j/k, r, f, e, /, ?), estado `shortcutsOpen` e evento
  de teclado para tecla `?`. Os atalhos de teclado ainda funcionam (j/k para
  navegação, r para responder, f para encaminhar, e para arquivar, / para busca)
  mas não há mais UI para visualizá-los. (`app/admin/email/page.tsx`)

### Changed

- **E-mail admin: preview com ações organizadas (2026-01-31)** - Header do
  `EmailViewer` reorganizado em duas linhas de ações com empilhamento responsivo
  e largura do "Mover para" ajustada com min/max; estilo e altura alinhados aos
  botões outline, com hover/sombra iguais aos botões irmãos.
  (`components/admin/email/email-viewer.tsx`,
  `components/admin/email/email-message-list.tsx`)
- **Atualização de dependências (2026-01-30)** - Storybook 10.2.1 → 10.2.3
  (@storybook/addon-a11y, addon-docs, addon-onboarding, addon-vitest,
  nextjs-vite, eslint-plugin-storybook, storybook). Autoprefixer, playwright,
  react-resizable-panels, pg e stylelint atualizados via pnpm update. Tailwind
  mantido em 3.4.17 (4.x incompatível com Next 16). Build e testes 57/57 OK.
- **Reorganização dos filtros na página de e-mail admin (2026-01-30)** - Filtro
  "Período" (DateRangePicker) movido para a mesma linha dos outros filtros
  (Exibir) no card de filtros. Modificado `AdminFilterCard` para renderizar
  `extraFilters` inline junto com os outros filtros, ao invés de em uma linha
  separada. Removido Label "Período" e grid de 2 colunas desnecessário. Botão
  "Novo e-mail" agora é o único botão de ação no header, sem o botão "Atalhos".
  (`app/admin/email/page.tsx`, `components/admin/admin-filter-card.tsx`)
- **Correção de estilos do input de busca no AdminFilterCard (2026-01-30)** -
  Removido `focus:outline-2` e `focus:outline-blue-500` que não são padrão do
  design system do projeto. Substituído por `focus:border-orange-500` e
  `focus:ring-orange-500` seguindo a cor primária do projeto (Orange-600).
  (`components/admin/admin-filter-card.tsx`)
- **Correção de estilos do DateRangePicker (2026-01-30)** - Removido
  `focus:outline-none` e `focus:ring-offset-2` do botão do DateRangePicker que
  causavam um outline azul offset não padrão do design system. Substituído por
  `focus:border-orange-500` e `focus:ring-2 focus:ring-orange-500` seguindo o
  padrão de foco do projeto (Orange-600).
  (`components/ui/date-range-picker.tsx`)

### Added

- **Toasts guiadas no DateRangePicker (2026-01-30)** - Implementada
  funcionalidade de toasts guiadas no componente `DateRangePicker` através da
  nova prop `showGuidedToasts`. Quando habilitada, exibe toasts informativas
  para orientar o usuário na seleção de datas: (1) ao abrir o calendário pela
  primeira vez informa para selecionar data de início, (2) após selecionar data
  de início orienta a selecionar data final, (3) ao completar a seleção confirma
  sucesso. Sistema adaptado do `SmartEquipmentPricing`. Habilitado na página de
  e-mail admin (`/admin/email`). (`components/ui/date-range-picker.tsx`,
  `app/admin/email/page.tsx`)

- **E-mail admin: anexos, período, mover, rascunhos e atalhos (2026-01-29)** -
  Upload de anexos no composer (`POST /api/admin/zoho-mail/attachments/upload`)
  e suporte a anexos no envio/resposta. Filtro de período na lista de mensagens.
  Ação "Mover para" no preview e em lote. Rascunhos reais com auto-save
  (`POST /api/admin/zoho-mail/messages/drafts`). Ações rápidas na lista e dialog
  de atalhos (j/k, r, f, e, /, ?). (`app/admin/email/page.tsx`,
  `components/admin/email/*`, `app/api/admin/zoho-mail/attachments/upload`,
  `app/api/admin/zoho-mail/messages/drafts`)
- **E-mail admin: composer, anexos, rascunhos, busca e ações em massa
  (2026-01-29)** - Composer para novo e-mail, responder e encaminhar (rotas
  `POST /api/admin/zoho-mail/messages/send` e
  `POST /api/admin/zoho-mail/messages/[messageId]/reply`). Download de anexos
  (`GET /api/admin/zoho-mail/messages/[messageId]/attachments/[attachmentId]`).
  Marcar lido/não lido e destacar/remover estrela na UI (viewer e lista).
  Paginação "Carregar mais" na lista de mensagens. Correção mobile:
  `onClearMessage` ao fechar o Sheet evita fetch com messageId vazio. Rascunhos:
  botão "Editar e enviar" na pasta Rascunhos abre o composer com o conteúdo do
  rascunho. Busca por remetente/assunto, filtros rápidos (Todas, Não lidas,
  Destacadas, Com anexos), modo seleção e ações em massa (Arquivar, Excluir,
  Marcar lido). Botão "Novo e-mail" no header. (`app/admin/email/page.tsx`,
  `components/admin/email/*`, `app/api/admin/zoho-mail/messages/send`, `reply`,
  `attachments/[attachmentId]`)
- **Bloco notificações + avatar no header mobile do admin (2026-01-29)** - Bloco
  com sino de notificações e avatar do usuário (antes só no header desktop)
  passou a ser exibido também no header mobile. Criado componente compartilhado
  `AdminHeaderActions` (`components/admin/admin-header-actions.tsx`) com
  dropdown de notificações e menu do usuário; usado em `AdminDesktopHeader` e
  `AdminMobileHeader`. No mobile o bloco aparece entre o título da página e o
  botão do menu hambúrguer.
- **Sistema de seleção múltipla de notificações no admin (2026-01-28)** - Nova
  funcionalidade de seleção múltipla no dropdown de notificações do header
  admin. Modo normal exibe apenas botão "Selecionar". Ao clicar, ativa modo de
  seleção onde "Selecionar" é substituído por "Marcar todas", aparecem
  checkboxes em cada notificação permitindo seleção individual. Botão "Marcar
  todas" seleciona todas as notificações visíveis, botão "Limpar" (vermelho)
  remove as selecionadas, botão "Cancelar" sai do modo seleção. Badge dinâmico
  mostra quantidade de notificações não lidas (modo normal) ou selecionadas
  (modo seleção). Estados gerenciados com `useState`: `isSelectionMode` e
  `selectedNotifications` (Set). Estilos consistentes com design system: border
  gray-200, shadow, hover:shadow-md, hover:text-orange-600.
  (`components/admin/admin-desktop-header.tsx`)
- **Integração Zoho Mail no Admin (MVP) (2026-01-21)** - OAuth 2.0 com Zoho
  Mail, conectar/desconectar conta, listar pastas e mensagens, visualizar
  conteúdo, arquivar e excluir. Página `/admin/email` com layout 3 colunas
  (pastas | mensagens | visualizador), item "E-mail" no sidebar. Rotas:
  `/api/admin/zoho-mail/oauth/*`, `/accounts`, `/folders`, `/messages`,
  `/messages/[id]`, `/messages/update`, `/messages/[id]/delete`. Modelo
  `ZohoMailToken`, lib `lib/zoho-mail/`. Componentes: `EmailFolderList`,
  `EmailMessageList`, `EmailViewer`. Próximas fases: enviar/responder, composer,
  rascunhos, sanitização HTML com DOMPurify.

### Changed

- **Configurações admin (2026-01-29)** - Removida a seção "E-mail (Zoho Mail)"
  da página de configurações (`/admin/settings`). Conectar/desconectar Zoho Mail
  permanece apenas em `/admin/email`. (`app/admin/settings/page.tsx`,
  `components/admin/settings-navigation-bar.tsx`)
- **Pastas do e-mail admin (2026-01-29)** - Sidebar de pastas em `/admin/email`:
  opções traduzidas para português, ordem: Caixa de entrada → Enviados →
  Rascunhos → Spam → Arquivado → Modelos → Lixeira (Spam abaixo de Rascunhos,
  Arquivado abaixo de Spam). Removidas: Outbox, Newsletter, Notification,
  Snoozed. (`app/admin/email/page.tsx`)
- **Atualização em massa de dependências (2026-01-29)** - Executado
  `pnpm update` para alinhar todas as dependências aos ranges do `package.json`.
  Mantidos tailwindcss em 3.4.17 (4.x incompatível) e @auth/core em 0.41.1
  (override). Ajustado `lib/stripe.ts`: apiVersion de `2025-12-15.clover` para
  `2026-01-28.clover` após atualização do pacote stripe. Build e testes (57/57)
  validados.
- **Dropdown de notificações admin (2026-01-28)** - Modo normal: apenas botão
  "Selecionar". Modo seleção: "Selecionar todas", "Limpar" e "Cancelar". Sem
  botão "Marcar todas como lidas". (`components/admin/admin-desktop-header.tsx`)
- **Atualização de dependências (2026-01-28)** - baseline-browser-mapping
  2.9.18→2.9.19, @types/node 25.0.10→25.1.0. Outros já em latest: Storybook
  10.2.1, @supabase/supabase-js, @types/react, next, puppeteer,
  react-resizable-panels, globals, happy-dom, resend. tailwindcss mantido em
  3.4.17 (4.x incompatível com Next 16 e design system). Cliente Prisma
  regenerado após atualização.
- **Melhorias visuais no menu de pastas de email admin (2026-01-27)** -
  Aplicados os mesmos estilos da área do cliente no menu de pastas de email
  (`EmailFolderList`): pasta ativa com gradiente laranja e sombra, pastas
  inativas com hover cinza claro e texto laranja, ícone ChevronRight adicionado,
  espaçamento entre itens e scrollbar ajustado (`pr-4`). Consistência visual
  entre área do cliente e painel admin.
  (`components/admin/email/email-folder-list.tsx`)

### Fixed

- **Email admin: activeDraftId, auto-save debounce, date filter, shortcuts
  (2026-01-30)** - No composer: activeDraftId agora é limpo quando
  draftMessageId vira null (ex.: cancelar). Auto-save usa ref para evitar
  re-runs do effect em cada tecla. Filtro de período usa construtor Date
  explícito (início/fim do dia local). Atalhos de teclado usam handlersRef para
  evitar re-subscrições desnecessárias.
  (`components/admin/email/email-composer-dialog.tsx`,
  `app/admin/email/page.tsx`)
- **Zoho Mail drafts: payload normalization and safer draftId parsing
  (2026-01-30)** - Normaliza strings de entrada, evita campos vazios e aceita
  múltiplos formatos de resposta antes de remover o rascunho anterior.
  (`app/api/admin/zoho-mail/messages/drafts/route.ts`)
- **Offset horizontal do dropdown de notificacoes no mobile (2026-01-29)** - O
  dropdown do sino no header admin recebe deslocamento horizontal no mobile para
  nao ficar colado na borda direita.
  (`components/admin/admin-header-actions.tsx`)
- **Formatação automática de arquivos gerados pelo Prisma (2026-01-27)** -
  Corrigido problema crítico onde `lib/validations/index.ts` e arquivos helper
  eram formatados manualmente, mas regerados sem formatação pelo script
  `post-prisma-generate.js` durante build/db:generate, causando git churn
  desnecessário. O script agora aplica Prettier automaticamente em todo o
  diretório `lib/validations/` após a geração, garantindo consistência de
  formatação. Corrigido bug no Windows onde o glob pattern
  `lib/validations/**/*.ts` não era expandido corretamente pelo `execSync` sem
  `shell: true`, resultando em arquivos não formatados.
  (`scripts/post-prisma-generate.js`, `lib/validations/index.ts`,
  `lib/validations/helpers/*.ts`)
- **Hover independente nos itens do menu de pastas de email (2026-01-27)** -
  Corrigido conflito de classes `group` entre `ScrollArea` e botões individuais
  que causava hover simultâneo em todos os itens. Implementado `group/item` para
  isolar o hover de cada botão. (`components/admin/email/email-folder-list.tsx`)
- **Badge de não lidas no cabeçalho do dropdown de notificações do admin
  (2026-01-21)** - O título "Notificações" no dropdown do header admin passa a
  exibir à esquerda um Badge (estilo `secondary`) com a quantidade de
  notificações não visualizadas, alinhado ao padrão dos cards do dashboard.
  (`components/admin/admin-desktop-header.tsx`)
- **Alertas admin para orcamentos e locacoes (2026-01-21)** - O dropdown de
  notificacoes do header admin agora sincroniza alertas criticos via
  `/api/admin/notifications/sync`, cobrindo pendencias de orcamentos, boletos e
  locacoes. (`app/api/admin/notifications/sync/route.ts`,
  `hooks/use-notifications.ts`, `lib/notification-service.ts`)
- **Notificacao de novo orcamento para admins (2026-01-21)** - Criacao de
  orcamento dispara alerta para todos os admins no dropdown.
  (`app/api/quotes/route.ts`, `lib/notification-service.ts`)

- **Dropdown de menu do usuário no header admin (2026-01-21)** - Adicionado
  dropdown ao avatar do usuário no header administrativo com opções de "Meu
  Perfil", "Configurações" e "Sair". O menu abre no hover e segue o mesmo padrão
  visual do dropdown de notificações.
  (`components/admin/admin-desktop-header.tsx`)
- **Dropdown de notificacoes no header admin (2026-01-20)** - O sino do header
  admin agora abre um dropdown com notificacoes do usuario, badge de nao lidas e
  acao "Marcar todas". (`components/admin/admin-desktop-header.tsx`)

### Fixed

- **Sanitização HTML em SSR (2026-01-23)** - `sanitizeHtml` em `lib/sanitize.ts`
  passou a usar `isomorphic-dompurify` em vez de `dompurify`. O HTML é sempre
  sanitizado (SSR e client), evitando XSS quando conteúdo externo (ex.: emails
  Zoho) é renderizado durante server rendering. (`lib/sanitize.ts`)
- **Alertas do sync de notificações admin sem dedupeKey (2026-01-21)** - O
  helper `notifyAdmins` em `/api/admin/notifications/sync` não repassava
  `dedupeKey` a `createAdminNotifications`; a deduplicação usava a mensagem
  exata. Como as mensagens tinham IDs (ex.: `Orcamento #ABC123`), cada
  orçamento/locação gerava notificação separada. Foram adicionados `dedupeKey`
  por tipo de alerta (`admin:sync:quote_pending`,
  `admin:sync:boleto_not_generated`, etc.) e mensagens genéricas ("Um ou mais
  orcamentos..."), garantindo no máximo uma notificação por tipo por admin na
  janela de 6h. (`app/api/admin/notifications/sync/route.ts`,
  `docs/issues/known-issues.md`)
- **Dropdowns de notificações e menu do usuário (admin): race com um único
  timeout (2026-01-21)** - Um único `dropdownCloseTimeoutRef` era usado para
  ambos. Ao passar o mouse de um para o outro, o `onMouseEnter` cancelava o
  timeout do primeiro e os dois competiam pelo mesmo ref. Foram criados
  `notificationCloseTimeoutRef` e `userMenuCloseTimeoutRef`, e
  `clearAllCloseTimeouts()` em todo `onMouseEnter` para cancelar ambos ao entrar
  em qualquer área. (`components/admin/admin-desktop-header.tsx`,
  `docs/issues/known-issues.md`)
- **Callback OAuth Zoho Mail: validação de state ignorada sem cookie
  (2026-01-21)** - A checagem `savedState && state !== savedState` só rodava
  quando o cookie existia; se o cookie estivesse ausente ou expirado, a
  validação era pulada e o `code` era trocado por tokens, bypassando a proteção
  CSRF. A condição foi alterada para
  `!savedState || !state || state !== savedState`: exige que cookie e parâmetro
  `state` existam e sejam iguais.
  (`app/api/admin/zoho-mail/oauth/callback/route.ts`,
  `docs/issues/known-issues.md`)
- **Notificações admin de novo orçamento não deduplicavam (2026-01-21)** - A
  mensagem incluía `#${shortId}` e o nome do cliente, tornando-a única por
  orçamento. A deduplicação em `createAdminNotifications` usava match exato da
  mensagem, então cada orçamento gerava novas notificações para todos os admins.
  Foi adicionado `dedupeKey` em `AdminNotificationInput`: quando informado, a
  deduplicação usa `(userId, type, metadata.dedupeKey)` na janela de 6h.
  `notifyAdminsQuoteCreated` passou a usar `dedupeKey: 'admin:quote_created'` e
  mensagem genérica "Um ou mais orcamentos aguardando analise.", garantindo no
  máximo uma notificação por admin nessa janela. (`lib/notification-service.ts`,
  `app/api/quotes/route.ts`, `docs/issues/known-issues.md`)
- **Fechamento antecipado do dropdown ao sair do conteúdo (2026-01-21)** - O
  `DropdownMenuContent` de notificações e do menu do usuário (admin e header
  público) fechava imediatamente no `onMouseLeave`, enquanto o botão usava
  atraso de 120ms. Ao mover rapidamente entre botão e conteúdo o dropdown podia
  fechar antes de o cursor entrar no conteúdo. O `onMouseLeave` do conteúdo
  passou a agendar o fechamento com `setTimeout(..., 120)`, alinhado ao botão e
  evitando fechamento prematuro. (`components/admin/admin-desktop-header.tsx`,
  `components/header.tsx`, `docs/issues/known-issues.md`)
- **Dropdown do usuário no header público (2026-01-21)** - O menu "Olá, [nome]!"
  na top bar passa a abrir e permanecer aberto apenas com o mouse sobre o botão
  ou sobre o próprio dropdown. Ao sair do botão ou do conteúdo, inicia timer de
  120ms para fechar (permitindo mover entre eles); ao entrar no dropdown o timer
  é cancelado. (`components/header.tsx`, `docs/features/header-user-menu.md`)
- **Sininho do admin sem borda no hover (2026-01-20)** - Removida qualquer
  alteracao de borda no hover do botao de notificacoes no header admin.
  (`components/admin/admin-desktop-header.tsx`)
- **Orcamentos Recentes no dashboard admin (2026-01-20)** - O bloco "Orcamentos
  Recentes" exibia Status e Data, mas Cliente, Empresa, Itens e Valor ficavam
  vazios ("-"). Causa: a API `/api/admin/quotes` retorna `name`, `email`,
  `company`, `totalPrice`/`finalTotal` e `items`, enquanto o dashboard esperava
  `customerName`, `customerEmail`, `customerCompany`, `totalAmount` e
  `itemsCount`. Foi adicionado mapeamento em `fetchDashboardData` para converter
  o formato da API ao formato `RecentQuote`. (`app/admin/dashboard/page.tsx`)

### Removed

- **Insights e Oportunidades no dashboard admin (2026-01-20)** - Removido o card
  "Insights e Oportunidades" da página `/admin/dashboard` (alertas de orçamentos
  pendentes, taxa de conversão, utilização e excelência), por não atender às
  expectativas em uso.

### Documentation

- **AI context capsules and process refinements (2026-01-30)** - Added guidance
  for persistent context capsules and wired it into AI docs. Updated AI context
  map, intake checklist, and context system documentation; linked capsules in AI
  README and docs index. (`docs/ai/context-capsules/README.md`,
  `docs/ai/context-map.md`, `docs/ai/context-intake-output-checklist.md`,
  `docs/ai/context-precision-protocol.md`, `docs/ai/README.md`,
  `docs/features/ai-context-system.md`, `docs/README.md`)
- **AI context system documentation update (2026-01-20)** - Rewrote
  `docs/internal/ai-documentation-system-analysis.md` for objective structure
  and added a phased plan integrating diagram, context-window, and hybrid-prompt
  strategies. Added `docs/features/ai-context-system.md` and linked it in
  `docs/features/INDEX.md`.
- **AI context capsule and checklists (2026-01-20)** - Added
  `docs/ai/context-capsule-template.md` and
  `docs/ai/context-intake-output-checklist.md`, and linked them from
  `docs/ai/context-map.md`, `docs/ai/context-precision-protocol.md`,
  `docs/ai/README.md`, and `docs/README.md`.
- **AI diagrams, prompt templates, and docs validation (2026-01-20)** - Added
  baseline Mermaid diagrams and templates under `docs/architecture/diagrams/`,
  added hybrid prompt templates in `docs/ai/prompt-templates/`, updated
  `docs/ai/context-map.md` references for database/prisma and CI, and added
  `scripts/validate-docs-indexes.js` (`pnpm docs:validate`) with links from AI
  docs.
- **Docs validation scope + critical flow diagrams (2026-01-20)** - Expanded
  `docs/README.md` link coverage for the validator, fixed historical missing
  links, and added diagrams for boleto, email, and quote status flows in
  `docs/architecture/diagrams/`.
- **Docs validation in CI + feature diagram links (2026-01-20)** - Added
  `pnpm docs:validate` to CI workflows, linked quote flow diagrams in
  `docs/features/quote-system.md`, `docs/features/quote-email-system.md`, and
  `docs/features/quote-status-tracking.md`, and noted CI enforcement in
  `docs/ai/context-intake-output-checklist.md`.
- **Workflow docs mention docs validation (2026-01-20)** - Documented the
  `pnpm docs:validate` step in `.github/workflows/README.md`.

- **AI context precision protocol (2026-01-20)** - Added the context precision
  and reasoning protocol at `docs/ai/context-precision-protocol.md` and linked
  it in `docs/README.md`, `docs/ai/README.md`, and
  `docs/internal/ai-documentation-system-analysis.md`.

- **AI documentation system analysis (2026-01-20)** - Created comprehensive
  analysis report of the AI documentation and context window system at
  `docs/internal/ai-documentation-system-analysis.md`. Documents how the system
  works, where IAs create/update documentation, how they navigate, and
  recommendations for improvement.

- **AI documentation workflow (2026-01-20)** - Added AI context boot/index docs,
  feature template/index, and known-issues index; aligned agent instructions
  with the new flow and pnpm usage.

### Database Performance 🚀

- **RLS Policy Optimization (2026-01-12)** - ⚠️ **APENAS AMBIENTE DE TESTES**:
  - Fixed **ALL 60 RLS policies** across 24 tables in TEST environment to use
    `(SELECT auth.uid())::text` instead of `auth.uid()`.
  - Resolves all Supabase Performance Advisor warnings about suboptimal query
    performance in test database.
  - Migration:
    `prisma/migrations/20260112_fix_all_rls_auth_uid_optimization.sql`.
  - Impact: `auth.uid()` is now evaluated once per query instead of once per
    row, improving performance at scale.
  - Tables optimized: accounts, sessions, verificationtokens, users, addresses,
    carts, cart_items, categories, equipments, equipment_units, quotes,
    quote_items, rentals, rental_items, maintenances, settings, vehicles,
    drivers, payments, deliveries, notifications, audit_logs, permissions,
    contracts.
  - **Note**: These warnings only appear in the test Supabase instance, not in
    production.
  - **Multiple Permissive Policies Fix (2026-01-12)** - ⚠️ **APENAS AMBIENTE DE
    TESTES**:
    - Consolidated duplicate permissive policies for SELECT operations in 5
      tables in TEST environment.
    - Separated `FOR ALL` policies into separate INSERT, UPDATE, DELETE policies
      to avoid duplicate SELECT policies.
    - Migration:
      `prisma/migrations/20260112_consolidate_multiple_permissive_policies.sql`.
    - Tables fixed: deliveries, payments, quote_items, rental_items, rentals.
    - **Note**: These warnings only appear in the test Supabase instance, not in
      production.

### Testing

- **Test output noise reduction (2026-01-12)**:
  - Suppressed dotenv injection logs in test setup with `quiet: true`.
  - Added `TEST_MODE=true` to silence expected Zod validation logs during tests.

- **Critical test coverage (2026-01-10)**:
  - Added global Next dev server startup for API checks.
  - Added integration fixtures and cleanup helpers for database-backed tests.
  - Added critical suites for quotes, boleto regeneration, stock blocking,
    payment processing, and late fee rules.
  - Documented the new test workflow and test environment variables.

### Payments

- **Email de confirmacao de pagamento (2026-01-13)**:
  - Webhook de boleto agora envia email ao cliente quando o pagamento e
    confirmado e a conversao do orcamento e concluida.
  - Usa o template de status do orcamento para notificar pagamento
    aprovado/locacao ativa.

### 3D / Hero

- **Pausa na rotacao do primeiro modelo 3D (2026-01-18)**:
  - `disableAutoFit` agora depende apenas de `delayBoundsFit`, mantendo
    `maxDuration=0` no primeiro modelo.
  - O fit apos o ScrollReveal permanece instantaneo, evitando pausa na
    auto-rotate.

### UI

- **CategoryShowcase: swipe em qualquer area do card (2026-01-18)**:
  - Drag agora inicia manualmente no painel para permitir swipe mesmo quando o
    toque comeca em um `button`.
  - `touch-action`/`user-select` mantidos para preservar o gesto no mobile.
- **Aceite de Termos no orcamento (2026-01-19)**:
  - Dialog de termos compartilhado via `components/terms/terms-content.ts`.
  - Checkbox obrigatorio bloqueia envio sem aceite no `/orcamento`.
  - Pagina `/termos` alinhada ao novo conteudo e docs atualizadas.
- **Layout unificado do painel de E-mail (2026-01-26)**:
  - Removidos cards internos de pastas/mensagens/preview e criado contêiner
    único.
  - Separadores e scroll interno por painel para experiência próxima ao Outlook.
  - Pastas com largura fixa; divisor redimensionável apenas entre Mensagens e
    Preview.
  - Scrollbar do painel de Pastas com thumb e setas laranja, visível apenas no
    hover.
- **Mobile Sheet de E-mail (2026-01-26)**:
  - Ao fechar o Sheet de preview, `onOpenChange` chamava `onSelectMessage('')` e
    o parent fazia fetch com `messageId` vazio (API inválida).
  - Adicionado `onClearMessage` opcional ao layout; ao fechar o Sheet em mobile
    chama-se `onClearMessage` em vez de `onSelectMessage('')`.
  - Página passa `handleClearMessage` que limpa seleção sem fetch. Ver
    `docs/issues/known-issues.md` §98.

### Dependencies 📦

- **Limpeza e atualizacao de dependencias (2026-01-17)**:
  - Removidos pacotes nao utilizados: `@vercel/blob`, `@auth/prisma-adapter`,
    `jsonwebtoken`, `nodemailer`, `cmdk`, `zod-openapi`,
    `@radix-ui/react-toast`, `@next/bundle-analyzer`, `@types/*`, `@lhci/cli`,
    `eslint-config-next`, `eslint-config-prettier`, `eslint-plugin-prettier`,
    `@next/eslint-plugin-next`, `markdown-to-jsx`, `react-syntax-highlighter`,
    `nodemon`, `typescript-eslint`.
  - Atualizado `@base-ui/react`: `1.0.0` → `1.1.0`
  - Atualizado `framer-motion`: `12.26.1` → `12.26.2`
  - Atualizado `next`: `16.1.1` → `16.1.3`
  - Atualizado `react-hook-form`: `7.71.0` → `7.71.1`
  - Atualizado `react-resizable-panels`: `4.4.0` → `4.4.1`
  - Atualizado `pg`: `8.16.3` → `8.17.1`
  - Atualizado `pino`: `10.1.1` → `10.2.0`
  - Atualizado `stripe`: `20.1.2` → `20.2.0`
  - Atualizado `@types/node`: `25.0.7` → `25.0.9`
  - Atualizado `baseline-browser-mapping`: `2.9.14` → `2.9.15`
  - Atualizado `happy-dom`: `20.1.0` → `20.3.1`
  - Atualizado `prettier`: `3.7.4` → `3.8.0`
  - Atualizado `style-dictionary`: `5.1.3` → `5.1.4`
  - Atualizado `stylelint`: `16.26.1` → `17.0.0`
  - Atualizado `stylelint-config-standard`: `39.0.1` → `40.0.0`
  - **Nota**: `tailwindcss` mantido em `3.4.17` (versao bloqueada).
  - **Arquivos Modificados**:
    - `package.json`: dependencias removidas e versoes atualizadas
    - `pnpm-lock.yaml`: lockfile sincronizado
    - `next.config.mjs`: removido `@radix-ui/react-toast` de
      `optimizePackageImports`

- **Atualização de Dependências (2026-01-11)**:
  - Atualizado `@types/node`: `25.0.5` → `25.0.6`
  - Atualizado `@vitest/browser`: `4.0.16` → `4.0.17`
  - Atualizado `@vitest/browser-playwright`: `4.0.16` → `4.0.17`
  - Atualizado `@vitest/coverage-v8`: `4.0.16` → `4.0.17`
  - Atualizado `@vitest/ui`: `4.0.16` → `4.0.17`
  - Atualizado `markdown-to-jsx`: `9.5.3` → `9.5.6`
  - Atualizado `vitest`: `4.0.16` → `4.0.17`
  - Atualizado `zustand`: `5.0.9` → `5.0.10`
  - Atualizado `@typescript-eslint/eslint-plugin`: `8.52.0` → `8.53.0`
  - Atualizado `@typescript-eslint/parser`: `8.52.0` → `8.53.0`
  - Atualizado `framer-motion`: `12.25.0` → `12.26.1`
  - Atualizado `puppeteer`: `24.34.0` → `24.35.0`
  - Atualizado `react-hook-form`: `7.70.0` → `7.71.0`
  - Atualizado `react-resizable-panels`: `4.3.3` → `4.4.0`
  - Atualizado `typescript-eslint`: `8.52.0` → `8.53.0`
  - Atualizado `next-openapi-gen`: `0.9.2` → `0.9.3`
  - **Nota**: `tailwindcss` mantido em `3.4.17` (versão bloqueada - incompatível
    com 4.x)
  - **Nota**: `prisma` e `@prisma/client` mantidos em `7.2.0` (versão estável)
  - **Arquivos Modificados**:
    - `package.json`: Versões atualizadas conforme `pnpm outdated` (exceto
      Tailwind e Prisma)

- **Atualização de Dependências de Desenvolvimento (2026-01-10)**:
  - Atualizado `@eslint/compat`: `2.0.0` → `2.0.1`
  - Atualizado `@types/node`: `25.0.3` → `25.0.5`
  - Atualizado `@types/nodemailer`: `7.0.4` → `7.0.5`
  - Atualizado `@types/react`: `19.2.7` → `19.2.8`
  - Atualizado `baseline-browser-mapping`: `2.9.13` → `2.9.14`
  - Atualizado `markdown-to-jsx`: `9.5.1` → `9.5.3`
  - Atualizado `pino`: `10.1.0` → `10.1.1`
  - **Nota**: `tailwindcss` mantido em `3.4.17` (versão bloqueada - incompatível
    com 4.x)
  - **Correção de Sincronização**: Atualizado `pnpm.overrides` para sincronizar
    com as versões atualizadas:
    - `@types/react`: `19.2.7` → `19.2.8` (override atualizado)
    - `baseline-browser-mapping`: `^2.9.2` → `^2.9.14` (override atualizado)
  - **Validação**: Build ✅, TypeScript ✅, Lockfile sincronizado ✅, Todas as
    verificações passaram
  - **Arquivos Modificados**:
    - `package.json`: Versões atualizadas conforme `pnpm outdated` + overrides
      sincronizados
    - `pnpm-lock.yaml`: Lockfile sincronizado e validado com `--frozen-lockfile`

### Performance ⚡

- **Otimização Crítica de Tempo de Execução JavaScript (Redução de 4.6s TBT)**:
  - **Removida dependência duplicada `motion`**: Removido `motion@^12.23.25` do
    `package.json` (duplicata do `framer-motion`)
  - **Code Splitting Avançado no Next.js**: Implementado webpack splitChunks no
    `next.config.mjs`:
    - Separado Three.js em chunk próprio (biblioteca muito pesada)
    - Separado Framer Motion em chunk próprio
    - Separado GSAP em chunk próprio
    - Separado ScrollReveal em chunk próprio (quando usado)
    - Separado Radix UI em chunk próprio
    - Criados chunks menores e mais eficientes, reduzindo tempo de
      parsing/compilação
  - **Lazy Loading de GSAP**: Implementado lazy loading agressivo do GSAP:
    - `components/ui/grid-motion.tsx`: GSAP agora carrega apenas quando
      necessário usando `requestIdleCallback`
    - `components/equipment-infinite-scroll.tsx`: Substituído `gsap.set` por CSS
      transforms nativo (mais performático)
    - GSAP não é mais incluído no bundle inicial, reduzindo significativamente o
      tamanho do JavaScript
  - **Otimizações de Package Imports**: Adicionado `gsap` e `scrollreveal` à
    lista de `optimizePackageImports` no `next.config.mjs`
  - **Arquivos Modificados**:
    - `package.json`: Removido `motion@^12.23.25` (duplicata)
    - `next.config.mjs`: Adicionado webpack splitChunks e otimizações de imports
    - `components/ui/grid-motion.tsx`: Lazy loading de GSAP com
      `requestIdleCallback`
    - `components/equipment-infinite-scroll.tsx`: Substituído GSAP por CSS
      transforms nativo
  - **Resultado Esperado**: Redução significativa de 4.6s no JavaScript
    execution time
  - **Impacto**: Melhor TBT (Total Blocking Time), melhor interatividade
    inicial, menor tempo de parsing/compilação

- **Otimização de Tempo de Execução JavaScript (Redução de TBT)**:
  - Implementado lazy load agressivo do Framer Motion no Hero
    - Criados componentes separados com dynamic imports:
      - `HeroWaveAnimation`: Animações de onda (lazy loaded)
      - `HeroBackgroundCarousel`: Carrossel de background (lazy loaded)
      - `HeroCarouselDots`: Dots do carousel (lazy loaded)
    - Framer Motion agora carrega apenas quando necessário (após interação)
    - Reduz bundle inicial significativamente (~100-150 KiB)
  - Otimizações adicionais no `next.config.mjs`:
    - Adicionado `optimizePackageImports` para `@react-three/fiber`,
      `@react-three/drei`, `three`
    - Configurado `serverComponentsExternalPackages` para evitar bundling
      desnecessário
    - Habilitado `swcMinify` para melhor compressão
  - **Arquivos Modificados**:
    - `components/hero.tsx`: Removido import direto de `framer-motion`, usando
      lazy load
    - `components/hero-wave-animation.tsx`: Novo componente com lazy load
    - `components/hero-background-carousel.tsx`: Novo componente com lazy load
    - `components/hero-carousel-dots.tsx`: Novo componente com lazy load
    - `next.config.mjs`: Otimizações adicionais de bundle
  - **Resultado Esperado**: Redução de 3.1s+ no tempo de execução JavaScript
    inicial
  - **Impacto**: Melhor TBT (Total Blocking Time), melhor interatividade
    inicial, menor LCP
  - **Correção de Hydration Mismatch (2026-01-04)**:
    - **Problema Identificado**: Componentes extraídos usavam `dynamic()` com
      `ssr: false`, mas eram importados diretamente no `hero.tsx`, causando
      hydration mismatch
    - **Solução**: Alterado para importar Framer Motion normalmente e usar
      `useEffect` para defer apenas a inicialização das animações após hydration
    - **Correção Adicional**: Mantido `initial={{ opacity: 0 }}` sempre
      (comportamento original) ao invés de `initial={false}` quando
      `shouldAnimate` é false, garantindo que elementos sempre começam
      invisíveis e depois animam para visíveis, evitando inconsistências visuais
    - **Resultado**: SSR funciona corretamente (HTML estático renderizado),
      animações iniciam após hydration sem causar mismatch, comportamento visual
      consistente com código original
    - **Arquivos Corrigidos**:
      - `components/hero-background-carousel.tsx`: Importação normal + defer de
        animações, `initial` sempre definido
      - `components/hero-wave-animation.tsx`: Importação normal + defer de
        animações
      - `components/hero-carousel-dots.tsx`: Importação normal + defer de
        animações
  - **Data**: 2026-01-04

- **Redução de JavaScript Não Utilizado (116 KiB economizados)**:
  - Removidas dependências não utilizadas do bundle de produção
    - Removido: `@sveltejs/kit`, `svelte`, `vue`, `vue-router` (frameworks não
      utilizados)
    - Removido: `react-syntax-highlighter` e tipos relacionados (não utilizado)
  - Movidas dependências de desenvolvimento para `devDependencies`
    - Movido: `@eslint/js`, `@testing-library/dom`, `@vitest/browser`,
      `@vitest/ui`, `happy-dom`
    - Movido: `eslint-config-prettier`, `eslint-plugin-prettier`,
      `eslint-plugin-react`
    - Movido: `@types/debug`, `@types/eslint`, `@types/react-syntax-highlighter`
  - Implementado dynamic import para componentes pesados
    - **Dashboard Admin**: `RevenueChart`, `RevenueByCategoryChart`,
      `AgingChart` (Recharts)
    - Componentes de gráficos carregam apenas quando necessário (lazy loading)
    - Loading states implementados durante carregamento
  - **Otimizações no `next.config.mjs`**:
    - `optimizePackageImports` já configurado para `recharts`,
      `@react-three/fiber`, `@react-three/drei`, `three`
    - Tree-shaking otimizado para bibliotecas pesadas
  - **Arquivos Modificados**:
    - `package.json`: Limpeza de dependências não utilizadas
    - `app/admin/dashboard/page.tsx`: Dynamic imports para componentes de
      gráficos
  - **Resultado Esperado**: Redução de ~116 KiB de JavaScript não utilizado no
    bundle
  - **Impacto**: Melhor performance inicial, menor TBT (Total Blocking Time),
    melhor LCP
  - **Data**: 2026-01-04

- **Otimização de Bundle JavaScript - Redução de TBT e Script Evaluation**:
  - **Problema**: Script Evaluation de 3,055 ms e TBT alto causando bloqueio do
    main thread
  - **Solução Implementada**:
    - Adicionados todos os packages Radix UI, Three.js e bibliotecas pesadas ao
      `optimizePackageImports` em `next.config.mjs` para tree-shaking agressivo
    - Otimizado `useEffect` em `app/ClientLayout.tsx` para usar
      `requestIdleCallback`, deferindo execução não-crítica e reduzindo impacto
      no TBT
    - Adicionado `webVitalsAttribution` para melhor rastreamento de métricas
  - **Arquivos Modificados**:
    - `next.config.mjs`: Expandido `optimizePackageImports` com 34+ packages
    - `app/ClientLayout.tsx`: Defer de console interception usando
      `requestIdleCallback`
    - `docs/guides/javascript-bundle-optimization.md`: Documentação completa das
      otimizações
  - **Impacto Esperado**: Redução de 30-40% no Script Evaluation (de 3,055 ms
    para ~1,800-2,100 ms) e redução de 20-30% no TBT
  - **Data**: 2026-01-04

- **Otimização de JavaScript para Navegadores Modernos**:
  - Atualizado `.browserslistrc` para suportar apenas navegadores modernos
    (ES2020+)
  - **Problema**: Lighthouse reportava 13 KiB de JavaScript legado desnecessário
    (polyfills para Array.at, Object.fromEntries, Object.hasOwn, etc.)
  - **Causa Raiz**: Configuração antiga suportava navegadores muito antigos
    (Chrome 54, Safari 9, iOS 9) que não suportam features ES2020 nativamente
  - **Solução**: Atualizado browserslist para navegadores modernos:
    - Chrome >= 92, Firefox >= 90, Safari >= 15.4, Edge >= 92
    - Suportam ES2020+ features nativamente (sem polyfills)
  - **Arquivos Modificados**:
    - `.browserslistrc`: Atualizado para navegadores modernos
    - `postcss.config.cjs`: Sincronizado com browserslist moderno
  - **Resultado Esperado**: Redução de ~13 KiB de JavaScript legado no bundle
  - **Data**: 2026-01-04

### Fixed 🐛

- **Atualizacao de boleto sem CPF/CNPJ nao gera erro logado**:
  - Atualizacao automatica do boleto e ignorada quando nao ha documento.
  - **Arquivos Modificados**:
    - `app/api/admin/quotes/[id]/route.ts`
    - `docs/features/quote-system.md`
  - **Data**: 2026-01-12

- **Testes nao acionam gateway externo**:
  - Forca BOLETO_GATEWAY_TYPE=direct e limpa chaves externas durante testes.
  - Mock do next-auth inclui export default para evitar falha em
    tests/critical/quote-adjustment.test.ts.
  - **Arquivos Modificados**:
    - `tests/setup.ts`
    - `tests/critical/quote-adjustment.test.ts`
    - `docs/guides/testing.md`
    - `docs/issues/known-issues.md`
  - **Data**: 2026-01-12

- **Protecao contra uso de banco de producao nos testes**:
  - `TEST_DATABASE_URL` agora e obrigatoria no `pnpm test`.
  - Testes abortam se `TEST_DATABASE_URL` igual `DATABASE_URL` ou aponta para o
    mesmo host nao local.
  - **Arquivos Modificados**:
    - `tests/global-setup.ts`
    - `tests/setup.ts`
    - `docs/guides/testing.md`
    - `docs/issues/known-issues.md`
  - **Data**: 2026-01-12

- **Boleto divergente sem CPF/CNPJ**:
  - ensureQuoteBoletoPayment retorna erro quando o valor diverge e falta
    documento.
  - **Arquivos Modificados**:
    - `lib/quote-boleto.ts`
    - `tests/critical/quote-boleto.test.ts`
    - `docs/features/quote-system.md`
    - `docs/issues/known-issues.md`
  - **Data**: 2026-01-10

- **Validacao de ajuste de valor final (finalTotal > 0)**:
  - PATCH /api/admin/quotes/[id] agora rejeita valores nao positivos.
  - ensureQuoteBoletoPayment falha quando total <= 0 para evitar
    inconsistencias.
  - **Arquivos Modificados**:
    - `app/api/admin/quotes/[id]/route.ts`
    - `lib/quote-boleto.ts`
    - `tests/critical/quote-adjustment.test.ts`
    - `docs/features/quote-price-adjustment.md`
    - `docs/issues/known-issues.md`
  - **Data**: 2026-01-10

- **Boleto atualizado apos ajuste de valor final**:
  - Boleto pendente e regenerado quando o valor final muda.
  - Ajuste de valor dispara atualizacao do boleto sem interromper o fluxo do
    admin.
  - **Arquivos Modificados**:
    - `lib/quote-boleto.ts`
    - `app/api/admin/quotes/[id]/route.ts`
    - `docs/features/quote-price-adjustment.md`
    - `docs/features/admin-orcamentos-page.md`
    - `docs/features/quote-system.md`
    - `docs/issues/known-issues.md`
  - **Data**: 2026-01-10

- **Geracao automatica de boleto na criacao do orcamento**:
  - `ensureQuoteBoletoPayment` nao exige aprovacao para gerar boleto.
  - `POST /api/quotes` tenta gerar boleto automaticamente e loga falhas sem
    interromper a criacao.
  - Botao "Baixar PDF" no admin agora abre o boleto em nova aba.
  - **Arquivos Modificados**:
    - `lib/quote-boleto.ts`
    - `app/api/quotes/route.ts`
    - `app/admin/orcamentos/page.tsx`
    - `docs/features/quote-system.md`
    - `docs/features/admin-orcamentos-page.md`
    - `docs/features/orcamento-page.md`
    - `docs/issues/known-issues.md`
  - **Data**: 2026-01-10

- **CurrencyInput com digitacao por digitos (centavos shift)**:
  - Corrigido bug de caret no webview do Cursor ao usar backspace no ajuste de
    valor final.
  - Campo agora extrai apenas numeros e formata com `Intl.NumberFormat` em BRL.
  - **Arquivos Modificados**:
    - `components/ui/currency-input.tsx`
    - `docs/features/quote-price-adjustment.md`
    - `docs/issues/known-issues.md`
  - **Data**: 2026-01-11

- **Envio de orçamento ajustado no admin**:
  - No modal de detalhes, quando há ajuste de valor, o botão de aprovação é
    substituído por "Enviar Orçamento Ajustado".
  - Novo endpoint `POST /api/admin/quotes/[id]/send-adjusted-quote` envia o
    email com valor ajustado e justificativa.
  - Template de email passou a suportar status `ADJUSTED`.
  - **Arquivos Modificados**:
    - `app/admin/orcamentos/page.tsx`
    - `app/api/admin/quotes/[id]/send-adjusted-quote/route.ts`
    - `lib/email-templates.ts`
    - `docs/features/admin-orcamentos-page.md`
    - `docs/features/quote-price-adjustment.md`
    - `docs/features/quote-email-system.md`
  - **Data**: 2026-01-10

- **Atualizacao automatica do historico do cliente**:
  - Area do cliente faz refresh em background a cada 30s quando a aba esta
    visivel
  - Atualizacao imediata ao retornar para a aba (visibilitychange)
  - Sem spinner/toast em refresh de background
  - **Arquivos Modificados**:
    - `app/area-cliente/historico/page.tsx`
    - `app/area-cliente/historico/[id]/page.tsx`
  - **Data**: 2026-01-09

- **Sincronização ScrollReveal e carrossel 3D em produção**:
  - Eliminada animação de zoom no primeiro modelo 3D durante
    carregamento/refresh.
  - **Problema**: O compressor (primeiro modelo) exibia animação de zoom visível
    (bounce/pop-up) durante o carregamento inicial da página.
  - **Causa Raiz**: O componente `<Bounds>` do @react-three/drei anima o zoom
    por padrão com duração de 1s, causando efeito visual indesejado.
  - **Solução**: Usar prop `maxDuration` do Bounds condicionalmente:
    - `maxDuration={0}` para o primeiro modelo → Fit INSTANTÂNEO, sem animação
    - `maxDuration={1}` para modelos seguintes → Animação de zoom normal
  - **Arquivos Modificados**:
    - `components/scroll-reveal-init.tsx`: Timing correto do evento
      `scrollRevealReady`
    - `components/ui/model-viewer.tsx`: `maxDuration` dinâmico baseado em
      `disableAutoFit`
  - **Comportamento Final**:
    - Primeiro modelo: Aparece no tamanho correto SEM animação de zoom
    - Modelos seguintes: Animação de zoom suave de 1 segundo
  - Data: 2026-01-04

### Security 🔒

- **RLS habilitado nas tabelas public do Supabase**:
  - Script `supabase-rls-fix.sql` com enable RLS e politicas basicas.
  - Guia atualizado para execucao no SQL Editor do Supabase.
  - **Arquivos Modificados**:
    - `supabase-rls-fix.sql`
    - `docs/guides/SUPABASE-RLS-FIX-GUIDE.md`
    - `docs/issues/known-issues.md`
  - **Data**: 2026-01-12

- **Correção de Vulnerabilidade**: Corrigida vulnerabilidade LOW no pacote `tmp`
  (GHSA-52f5-9888-hmc6)
  - Adicionado override em `package.json` para forçar `tmp >= 0.2.4`
  - Vulnerabilidade: Arbitrary temporary file/directory write via symbolic link
  - Impacto: Baixo (dev dependency apenas, usado em scripts de performance)
  - Status: ✅ Corrigido - `pnpm audit` agora retorna 0 vulnerabilidades
  - Versão aplicada: `tmp@0.2.5` (todas as dependências transitivas atualizadas)
  - **Data**: 2026-01-04

### Added ✨

- **Otimizações de Performance**: Implementadas otimizações para melhorar Core
  Web Vitals
  - **Scroll Reveal System**: Otimizado com batch processing e
    requestAnimationFrame
    - Periodic check aumentado de 500ms para 2000ms (75% redução)
    - Processamento em batches para reduzir TBT
    - MutationObserver otimizado com requestAnimationFrame
  - **Funções Utilitárias**: Adicionadas funções `debounce` e `throttle` em
    `lib/utils.ts`
  - **Documentação**: Guia completo em `docs/guides/performance-optimization.md`
  - **Impacto Esperado**: Redução de ~200-300ms no TBT, melhor experiência em
    dispositivos de baixa performance
  - **Data**: 2026-01-04

- **Sistema de Testes de Performance Frontend**: Implementado sistema completo
  de testes de performance para simular dispositivos fracos e identificar
  gargalos de performance.
  - **Ferramentas**: Puppeteer para automação, Lighthouse para análise completa
  - **Scripts**:
    - `scripts/performance-test.js` - Testes com Puppeteer simulando
      dispositivos
    - `scripts/lighthouse-batch.js` - Execução em lote do Lighthouse
    - `scripts/generate-performance-report.js` - Gerador de relatórios
      consolidados
    - `scripts/performance-config.json` - Configuração de dispositivos e páginas
  - **Dispositivos Simulados**:
    - Moto G4 (Low-end): CPU 6x throttling, Slow 3G
    - iPhone SE (Mid-range): CPU 4x throttling, Fast 3G
    - Desktop antigo (2015): CPU 4x throttling, Regular 4G
  - **Métricas Coletadas**: LCP, FCP, CLS, TBT, TTI, FID, Performance Score
  - **Scripts NPM**:
    - `pnpm perf:test` - Executar todos os testes Puppeteer
    - `pnpm perf:mobile` - Testar apenas mobile
    - `pnpm perf:desktop` - Testar apenas desktop
    - `pnpm perf:lighthouse` - Executar Lighthouse completo
    - `pnpm perf:report` - Gerar relatório consolidado
  - **Relatórios**: Gerados em `reports/performance/` com análise detalhada,
    problemas críticos e recomendações
  - **Documentação**: Guia completo em `docs/guides/performance-testing.md`
  - **Dependências Adicionadas**: `lighthouse`, `@lhci/cli`, `puppeteer`
  - **Data**: 2026-01-03

### Changed 🔄

- **Organização do globals.css**:
  - Adicionado índice de seções no topo e renumeradas as seções para seguir
    ordem sequencial.
  - Overrides de scroll-lock do Radix consolidados em um único bloco.
  - Helpers de fonte e estilos base de cards agrupados em seções mais adequadas.
  - React-day-picker: unificado o bloco de `.rdp-month_grid`.
  - **Arquivos Modificados**: `app/globals.css`
  - **Data**: 2026-01-07

- **Sincronização explícita entre ScrollReveal e animações 3D do carrossel**:
  - Implementada sincronização explícita entre o sistema de ScrollReveal e as
    animações `Bounds.fit()` do carrossel 3D.
  - **Problema Resolvido**: Anteriormente, a animação de zoom do primeiro modelo
    3D dependia de "timing feliz" (o modelo carregava enquanto o elemento estava
    invisível). Em redes lentas ou modelos grandes, o zoom podia ocorrer após o
    ScrollReveal, causando comportamento inconsistente.
  - **Solução**: O primeiro modelo agora aguarda explicitamente o evento
    `scrollRevealReady` antes de executar `Bounds.fit()`. Modelos seguintes
    executam normalmente.
  - **Arquivos Modificados**:
    - `components/ui/model-viewer.tsx`: Adicionadas props `delayBoundsFit` e
      `isRevealComplete` para controlar quando executar `Bounds.fit()`
    - `components/equipment-3d-carousel.tsx`: Adicionada prop `isRevealComplete`
      e lógica para passar `delayBoundsFit` apenas para o primeiro modelo
    - `components/hero.tsx`: Passa `isScrollRevealReady` para o carrossel
    - `app/sobre/page.tsx`: Implementada mesma sincronização
  - **Comportamento**:
    - Primeiro modelo: aparece com fade-in do ScrollReveal, sem animação de zoom
    - Modelos seguintes: exibem animação de zoom normalmente
  - Data: 2026-01-04

### Fixed 🐛

- **Testes de performance com metricas reais e sem EPERM**:
  - LCP e TBT do Puppeteer agora usam `PerformanceObserver` com `buffered: true`
    registrado antes da navegacao, TBT real (long tasks > 50ms) e TTI pelo
    ultimo long task.
  - Emulacao mobile/slow network corrigida (`isMobile/hasTouch` no viewport e
    perfis Slow/Fast 3G em bytes/s realistas).
  - Lighthouse/chrome-launcher passam a usar `reports/performance/.tmp` como
    user-data-dir e TMP/TEMP forçados, evitando `EPERM` no cleanup.
  - Data: 2026-01-04

- **Lighthouse: retry em falhas de conexao ao Chrome**:
  - Lighthouse tenta novamente em erros `ECONNREFUSED/ECONNRESET/ETIMEDOUT` com
    backoff (2s, 5s), reduzindo falhas intermitentes.
  - Data: 2026-01-04

- **Performance: scroll reveal boot + hero background fallback + infinite scroll
  pause**:
  - Scroll reveal inicia no DOMContentLoaded com requestIdleCallback + timeout.
  - Hero background usa fallback para evitar tela branca e prioriza apenas o
    slide inicial.
  - Infinite scroll pausa fora da viewport/aba oculta, respeita
    prefers-reduced-motion e limpa listeners.
  - Arquivos Modificados:
    - `components/scroll-reveal-init.tsx`
    - `components/hero.tsx`
    - `components/equipment-infinite-scroll.tsx`
    - `docs/guides/scroll-reveal.md`
    - `docs/features/hero-section.md`
    - `docs/features/equipment-infinite-scroll.md`
    - `docs/issues/known-issues.md`
  - Data: 2026-01-03

- **Performance: infinite scroll reflow + contagem de dias otimizada**:
  - Loop infinito agora usa `scrollWidth` cacheado com ResizeObserver para
    evitar leitura de layout por frame.
  - Contagem de dias no SmartEquipmentPricing usa calculo por semanas (O(1)),
    mantendo o comportamento atual.
  - **Arquivos Modificados**:
    - `components/equipment-infinite-scroll.tsx`
    - `components/smart-equipment-pricing.tsx`
    - `docs/features/equipment-infinite-scroll.md`
    - `docs/features/equipment-booking-system.md`
    - `docs/issues/known-issues.md`
  - **Data**: 2026-01-04

- **Performance: swipe do CategoryShowcase mais fluido no mobile**:
  - Largura do painel cacheada com `ResizeObserver` e `will-change: transform`
    no painel/overlay para reduzir repaint no swipe.
  - Mapeamento de tabs e indices memoizado para reduzir trabalho no drag end.
  - Checagem de `ResizeObserver` feita via `typeof` para evitar erro no
    type-check.
  - **Arquivos Modificados**:
    - `components/category-showcase.tsx`
    - `docs/features/tabbed-category-grid.md`
    - `docs/issues/known-issues.md`
  - **Data**: 2026-01-04

- **A11y: tablist do CategoryShowcase com wrappers presentational**:
  - `ul`/`li` marcados como `role="presentation"` para evitar avisos do axe.
  - **Arquivos Modificados**:
    - `components/category-showcase.tsx`
    - `docs/features/tabbed-category-grid.md`
    - `docs/issues/known-issues.md`
  - **Data**: 2026-01-04
- **Sistema de Salvamento e Confirmação de Endereços no Formulário de
  Orçamento**: Implementado sistema completo de gerenciamento de endereços para
  usuários logados, permitindo salvar endereços, confirmar endereços salvos e
  selecionar entre múltiplos endereços.
  - **APIs**: Criado endpoint `/api/addresses` com GET (listar) e POST (criar)
    endereços do usuário logado
  - **Componentes**: Criados três dialogs (SaveAddressDialog,
    ConfirmAddressDialog, SelectAddressDialog) usando Base UI
  - **Funcionalidades**:
    - Dialog de salvamento na primeira solicitação com endereço completo
    - Dialog de confirmação para solicitações subsequentes (com checkbox "Não
      exibir novamente")
    - Dialog de seleção quando usuário tem múltiplos endereços salvos
    - Preferência de "Não exibir novamente" salva no localStorage
    - Primeiro endereço sempre marcado como principal (`isPrimary`)
  - **Arquivos Criados**:
    - `app/api/addresses/route.ts`
    - `components/dialogs/save-address-dialog.tsx`
    - `components/dialogs/confirm-address-dialog.tsx`
    - `components/dialogs/select-address-dialog.tsx`
  - **Arquivos Modificados**:
    - `app/orcamento/page.tsx`
    - `lib/utils/validation.ts` (adicionada função `formatAddress`)
  - **Data**: 2026-01-02

### Changed 🔄

- **README: comandos de testes de performance**: Documentados todos os comandos
  de testes de performance no README.
  - **Data**: 2026-01-04
- **Performance: testes focados apenas na homepage**:
  - `pagesToTest` reduzido para a homepage e scripts `perf:*` apontam para ela
    por padrÆo.
  - Documenta‡Æo atualizada em `docs/guides/performance-testing.md` e README.
  - **Arquivos Modificados**:
    - `scripts/performance-config.json`
    - `package.json`
    - `docs/guides/performance-testing.md`
    - `README.md`
  - **Data**: 2026-01-04
- **Atualização de Dependências**: Atualizadas dependências para versões mais
  recentes mantendo compatibilidade.
  - `react-resizable-panels`: 4.1.0 → 4.2.0
  - `zod`: 4.2.1 → 4.3.4
  - `globals`: 16.5.0 → 17.0.0
  - `next-openapi-gen`: 0.9.1 → 0.9.2
  - **Removido**: `@types/dompurify` (descontinuado - `dompurify` agora inclui
    tipos nativamente)
  - **Mantidas**: `tailwindcss` (3.4.17) conforme regras do projeto
  - **Validação**: Build testado e funcionando corretamente após atualizações
  - **Data**: 2026-01-02

### Fixed 🐛

- **Kanban admin: scroll global piscava na montagem**: Colunas usam
  `overflow-hidden` com `max-height` limitado a 4 cards (via `min()` com a
  viewport) e corpo com `max-height`, `scrollbar-gutter: stable` e
  `overflow-y-auto` **apenas quando ha 5+ cards**, mantendo o scroll interno e
  evitando piscada da barra global ao montar/filtrar.
  - **Arquivos Modificados**:
    - `app/admin/orcamentos/page.tsx`
    - `components/admin/kanban-pipeline.tsx`
    - `docs/issues/known-issues.md`
    - `docs/features/admin-orcamentos-page.md`
  - **Data**: 2026-01-03

- **Admin: botao Excluir Orçamento (outline) dispara DELETE**: Normalizado
  status/approvedAt no frontend para detectar aprovacao mesmo com strings
  vazias/maiúsculas; helper hasApproval garante exibicao do botao e o clique
  agora abre a confirmacao para excluir o orcamento (DELETE) mantendo o estilo
  outline vermelho.
  - **Arquivos Modificados**:
    - `app/admin/orcamentos/page.tsx`
    - `docs/issues/known-issues.md`
    - `docs/features/admin-orcamentos-page.md`
  - **Data**: 2026-01-03

- **Orcamentos: aprovacao so apos pagamento**: A aprovacao do admin registra
  approvedAt/approvedBy e mantem status PENDING; o status muda para APPROVED
  apenas quando o pagamento e confirmado.
  - **Arquivos Modificados**:
    - `app/api/admin/quotes/[id]/route.ts`
    - `lib/payment-processor.ts`
    - `lib/quote-payment-conversion.ts`
    - `lib/quote-boleto.ts`
    - `app/api/admin/quotes/route.ts`
    - `app/admin/orcamentos/page.tsx`
    - `app/area-cliente/orcamentos/page.tsx`
    - `docs/features/admin-orcamentos-page.md`
    - `docs/features/quote-status-tracking.md`
    - `docs/features/quote-system.md`
    - `docs/features/quote-stock-blocking.md`
    - `docs/issues/known-issues.md`
  - **Data**: 2026-01-02

- **Admin: header desktop sincronizado com sidebar**: Header alinha left/width
  ao estado do sidebar sem delay, com regras em `app/globals.css` e propagacao
  imediata do estado.
  - **Arquivos Modificados**:
    - `components/admin/admin-sidebar.tsx`
    - `components/admin/admin-desktop-header.tsx`
    - `app/globals.css`
    - `docs/features/admin-desktop-header.md`
    - `docs/issues/known-issues.md`
  - **Data**: 2025-12-30

- **Boleto inclui frete e bloqueio apos pagamento**: Geracao do boleto passa a
  usar `finalTotal`/`total` (inclui taxa de entrega), e o estoque so bloqueia
  apos pagamento aprovado e conversao para locacao.
  - **Arquivos Modificados**:
    - `lib/quote-boleto.ts`
    - `lib/rental-converter.ts`
    - `lib/quote-payment-conversion.ts`
    - `lib/equipment-availability.ts`
    - `app/api/admin/rentals/[id]/route.ts`
    - `app/api/admin/rentals/route.ts`
  - **Data**: 2025-12-30

- **ASAAS_API_KEY: valor com $ nao era carregado**: Escapado `$` em `.env` e
  `.env.local` para evitar expansao do `@next/env` e permitir geracao automatica
  de boleto.
  - **Arquivos Modificados**:
    - `.env`
    - `.env.local`
    - `docs/issues/known-issues.md`
    - `docs/features/quote-system.md`
  - **Data**: 2025-12-30

- **Boleto: valida CPF/CNPJ no servidor**: `QuoteRequestSchema` passou a validar
  CPF/CNPJ com `validateCPF`/`validateCNPJ` e os guias do Asaas usam CPF valido
  nos exemplos.
  - **Arquivos Modificados**:
    - `lib/validations/index.ts`
    - `docs/guides/asaas-boleto-testing.md`
    - `docs/guides/asaas-boleto-testing-iniciantes.md`
    - `docs/features/quote-system.md`
    - `docs/issues/known-issues.md`
  - **Data**: 2025-12-30

- **CategoryShowcase: Removido focus outline azul dos botões de tabs**:
  Corrigido problema onde botões de tabs do componente CategoryShowcase exibiam
  borda azul de focus, violando a regra do projeto de não ter focus outline em
  botões.
  - **Arquivos Modificados**:
    - `components/category-showcase.tsx`: Adicionado
      `focus:outline-none focus-visible:outline-none focus-visible:ring-0` nos
      botões de tabs e cards
    - `app/globals.css`: Reforçada regra para remover outline de botões com
      `role='tab'`, incluindo variáveis Tailwind (`--tw-ring-width`,
      `--tw-ring-offset-width`, `--tw-ring-color`)
  - **Data**: 2025-12-28

### Changed 🔄

- **Atualização de Dependências (Dezembro 2025)**: Atualizadas todas as
  dependências para as versões mais recentes
  - **Next.js**: 16.1.0 → 16.1.1
  - **@next/bundle-analyzer**: 16.1.0 → 16.1.1
  - **@next/eslint-plugin-next**: 16.1.0 → 16.1.1
  - **eslint-config-next**: 16.1.0 → 16.1.1
  - **@typescript-eslint/eslint-plugin**: 8.50.0 → 8.50.1
  - **@typescript-eslint/parser**: 8.50.0 → 8.50.1
  - **typescript-eslint**: 8.50.0 → 8.50.1
  - **baseline-browser-mapping**: 2.9.10 → 2.9.11
  - **jsdom**: 27.3.0 → 27.4.0
  - **markdown-to-jsx**: 9.4.2 → 9.5.0
  - **react-hook-form**: 7.68.0 → 7.69.0
  - **nodemailer**: 7.0.11 → 7.0.12
  - **react-resizable-panels**: 4.0.8 → 4.0.16
  - **svelte**: 5.46.0 → 5.46.1
  - **next-openapi-gen**: 0.9.0 → 0.9.1
  - **Tailwind CSS**: Mantido em 3.4.17 (conforme regras do projeto)
  - **Status**: ✅ Build passou (6.9s), TypeScript 0 erros, Testes 39/39
    passando
  - **Data**: 2025-12-28

### Fixed 🐛

- **Header: Log In nao pisca no reload**: Sessao inicial fornecida ao
  `SessionProvider` para evitar estado `loading` e flicker do botao quando
  deslogado/logado.
  - **Arquivos Modificados**:
    - `app/layout.tsx`
    - `components/session-provider-wrapper.tsx`
    - `docs/issues/known-issues.md`
    - `docs/features/header-user-menu.md`
  - **Data**: 2025-12-28

- **AlertDialog: cantos arredondados no mobile**: Content agora usa
  `rounded-2xl` em todos os breakpoints para evitar dialog quadrado e vazamento
  de background.
  - **Arquivos Modificados**:
    - `components/ui/alert-dialog.tsx`
    - `docs/issues/known-issues.md`
    - `docs/features/alert-dialog.md`
  - **Data**: 2025-12-28

### Added ✨

- **Boleto: geracao/preview/envio no admin**: Criados endpoints e UI para gerar
  e enviar boleto aprovado, com email + notificacao e exibicao no painel do
  cliente.
  - **Arquivos Modificados**:
    - `app/api/admin/quotes/[id]/generate-boleto/route.ts`
    - `app/api/admin/quotes/[id]/send-boleto/route.ts`
    - `app/admin/orcamentos/page.tsx`
    - `app/area-cliente/orcamentos/page.tsx`
    - `app/area-cliente/historico/[id]/page.tsx`
    - `lib/email-templates.ts`
    - `lib/notification-service.ts`
  - **Data**: 2025-12-30

- **Menu de Usuário no Header com Dropdown**: Substituídos botões "Sign In" e
  "Log In" por menu interativo quando logado
  - Exibe "Olá, [primeiro nome]!" com avatar do usuário (Google/Facebook Auth)
  - Dropdown ao passar o mouse com todas as opções da área do cliente:
    - Dashboard, Notificações (com badge), Meu Perfil, Meus Orçamentos,
      Histórico, Endereços, Suporte, Sair
  - Avatar com fallback para iniciais do nome quando não há imagem
  - Hover effect para abrir/fechar automaticamente
  - Estilo consistente com design system (laranja no hover, vermelho para sair)
  - Componentes utilizados: DropdownMenu, Avatar (Radix UI)
  - **Arquivos Modificados**:
    - `components/header.tsx` - Menu dropdown completo com navegação
  - **Data**: 2025-12-28

- **Sistema de Notificações Funcional com Persistência no Banco**: Implementado
  sistema completo de notificações com persistência real no PostgreSQL
  - **Modelo Prisma**: Novo modelo `Notification` com campos `id`, `userId`,
    `type`, `title`, `message`, `priority`, `isRead`, `actionUrl`, `metadata`,
    `createdAt`, `readAt`
  - **Enums Prisma**: `NotificationType` (QUOTE, ORDER, PAYMENT, EQUIPMENT,
    SYSTEM, RENTAL, DELIVERY, CONTRACT) e `NotificationPriority` (LOW, MEDIUM,
    HIGH)
  - **APIs REST**:
    - `GET /api/client/notifications` - Lista paginada com filtros e
      estatísticas
    - `PATCH /api/client/notifications/[id]` - Marcar como lida
    - `DELETE /api/client/notifications/[id]` - Deletar notificação
    - `POST /api/client/notifications/mark-all-read` - Marcar todas como lidas
    - `GET /api/client/notifications/stats` - Estatísticas de notificações
  - **Serviço Central**: `lib/notification-service.ts` com helpers para criar
    notificações de orçamentos, pagamentos, locações, entregas, contratos, etc.
  - **Hook Atualizado**: `hooks/use-notifications.ts` agora consome a API real,
    mantendo compatibilidade com header/layout via eventos customizados
  - **Página Atualizada**: `/area-cliente/notificacoes` usa dados reais com
    loading states, tratamento de erros, botão de atualizar e marcar todas como
    lidas (visual 100% preservado: bolinha azul, animação laranja, badges)
  - **Arquivos Criados**:
    - `app/api/client/notifications/route.ts`
    - `app/api/client/notifications/[id]/route.ts`
    - `app/api/client/notifications/mark-all-read/route.ts`
    - `app/api/client/notifications/stats/route.ts`
    - `lib/notification-service.ts`
  - **Arquivos Modificados**:
    - `prisma/schema.prisma` - Modelo Notification e enums
    - `hooks/use-notifications.ts` - Consumo de API
    - `app/area-cliente/notificacoes/page.tsx` - Dados reais
  - **Data**: 2025-12-26

- **Sistema de Atividade Recente no Dashboard do Cliente**: Implementada
  funcionalidade completa para exibir atividades recentes do cliente
  - Nova API `/api/client/activities` que busca e agrega atividades do cliente
  - Exibe orçamentos criados, aprovados e rejeitados
  - Mostra locações iniciadas, concluídas e atualizadas
  - Lista pagamentos realizados
  - Formatação de data relativa ("há X minutos/horas/dias")
  - Ícones e cores específicas para cada tipo de atividade
  - Links clicáveis para páginas relacionadas (orçamentos, histórico de
    locações)
  - Design responsivo e consistente com o restante do dashboard
  - **Arquivos Criados**:
    - `app/api/client/activities/route.ts` - API para buscar atividades recentes
  - **Arquivos Modificados**:
    - `app/area-cliente/page.tsx` - Componente de atividade recente implementado
  - **Data**: 2025-12-25

### Changed 🔄

- **Menu do usuario no header sem scroll interno**: dropdown do header agora usa
  altura automatica para exibir todos os itens
  - `DropdownMenuContent` do header recebe `max-h-none` para nao limitar a lista
  - **Arquivo Modificado**: `components/header.tsx`
  - **Data**: 2025-12-28

- **Eliminação completa da página `/area-cliente/locacoes` e consolidação em
  `/area-cliente/historico`**: A página `/area-cliente/locacoes` foi
  completamente removida e toda funcionalidade foi consolidada em
  `/area-cliente/historico`
  - Página `/area-cliente/locacoes/page.tsx` foi deletada
  - Rota dinâmica `/area-cliente/locacoes/[id]` foi movida para
    `/area-cliente/historico/[id]`
  - Todos os links foram atualizados para usar `/area-cliente/historico` e
    `/area-cliente/historico/[id]`
  - Layout atualizado para reconhecer `/area-cliente/historico/[id]` como página
    ativa
  - Pasta `app/area-cliente/locacoes` foi completamente removida do projeto
  - **Arquivos Modificados**:
    - `app/area-cliente/historico/[id]/page.tsx` - Nova rota de detalhes (movida
      de locacoes)
    - `app/area-cliente/page.tsx` - Links atualizados
    - `app/area-cliente/historico/page.tsx` - Links atualizados
    - `app/area-cliente/layout.tsx` - Reconhecimento de rota atualizado
  - **Arquivos Deletados**:
    - `app/area-cliente/locacoes/page.tsx`
    - `app/area-cliente/locacoes/[id]/page.tsx`
    - Pasta `app/area-cliente/locacoes/` completa
  - **Data**: 2025-12-25

- **Reorganização do Card "Meu Carrinho" no Dashboard**: Layout do card de
  carrinho melhorado para agrupar itens e total
  - Itens do carrinho agora ficam DENTRO do bloco laranja de "Total Estimado"
  - Cards de itens com fundo branco e borda laranja para melhor contraste
  - Botões "Ver Carrinho" e "Adicionar Mais" sempre fixos na parte inferior
  - Separador visual entre lista de itens e total com borda laranja
  - **Arquivo Modificado**: `app/area-cliente/page.tsx`
  - **Data**: 2025-12-25

- **Refatoração das Páginas de Locações para Seguir o Design System**: Páginas
  `locacoes/page.tsx` e `locacoes/[id]/page.tsx` refatoradas para consistência
  visual
  - **Problema**: As páginas de locações (Minhas Locações e Detalhes da Locação)
    não seguiam o design system estabelecido nas outras páginas da área do
    cliente (orçamentos, histórico)
  - **Correções Aplicadas**:
    - Adicionada Hero Section com gradiente laranja consistente e onda SVG
    - Botão "Voltar" movido para dentro do Hero Section
    - Implementado componente `SearchBar` para filtros de busca e status
    - Substituído `Badge` por `ClientAreaBadge` para consistência
    - Cards refatorados com gradientes de background e sombras consistentes
    - Stats badges integrados na Hero Section em vez de cards separados
    - Animações motion consistentes com delay escalonado
    - Layout responsivo seguindo padrões mobile-first do projeto
  - **Arquivos Modificados**:
    - `app/area-cliente/locacoes/page.tsx` - Lista de locações
    - `app/area-cliente/locacoes/[id]/page.tsx` - Detalhes da locação
  - **Data**: 2025-12-25

### Added ✨

- **Verificação de Autenticação ao Solicitar Orçamento**: Implementada
  verificação de autenticação no fluxo de solicitação de orçamento de
  equipamentos
  - **Comportamento**:
    - Quando o usuário clica em "Solicitar Orçamento Grátis" na página de
      detalhes do equipamento, o sistema verifica se está logado
    - Se **não estiver logado**: mostra toast informativa e redireciona para a
      página de login
    - Se **estiver logado**: prossegue normalmente com o fluxo de orçamento
  - **Toast Informativa**: Mensagem clara explicando que o login é necessário
    para solicitar orçamentos
  - **Redirecionamento Inteligente (callbackUrl)**:
    - A URL da página atual é preservada como `callbackUrl`
    - Após login/cadastro, o usuário é redirecionado de volta para a página do
      equipamento que estava visualizando
    - Funciona tanto para login com credenciais quanto para login social
      (Google/Facebook)
  - **Dialog de Finais de Semana**: Só aparece quando o usuário está logado e
    não selecionou datas no calendário
  - **Arquivos Modificados**:
    - `components/smart-quote-button.tsx` - Verificação de autenticação
    - `app/login/page.tsx` - Suporte a callbackUrl
    - `app/cadastro/page.tsx` - Suporte a callbackUrl
    - `app/auth/callback/page.tsx` - Redirecionamento com callbackUrl
  - **Data**: 2025-12-24

### Changed 🔄

- **Validação de Campos Obrigatórios com Toasts Informativas**: Adicionadas
  toasts informativas para todos os campos obrigatórios nos formulários de
  orçamento
  - **Campos Validados**:
    - **Nome Completo**: Validação com toast informativa
    - **Telefone**: Validação com toast informativa
    - **E-mail**: Validação com toast informativa
    - **Período de Locação**: Validação com toast informativa (apenas no
      QuoteForm)
  - **Comportamento**: Quando o usuário tentar enviar uma solicitação sem
    preencher campos obrigatórios, será exibida uma única toast informativa
    listando TODOS os campos faltantes de uma vez
  - **Ações**:
    - Toast informativa (info) única mostrando todos os campos faltantes
      separados por vírgula
    - Duração de 6 segundos para permitir leitura completa
    - Foco automático no primeiro campo faltante
    - Scroll suave até o primeiro campo que precisa ser preenchido
  - **Implementação**:
    - Validação coletiva: todos os campos obrigatórios são verificados antes de
      mostrar qualquer toast
    - Validações no início da função `handleSubmit` antes de outras validações
    - Validações nos métodos `onSubmit` e `handleWhatsAppSubmit` do componente
      `QuoteForm`
    - Validações no `onClick` do botão de submit e no `onSubmit` do formulário
    - Validações na função `nextStep` do `QuoteForm` quando usuário tenta
      avançar de etapa
    - Removidos atributos `required` dos inputs HTML para evitar validação
      nativa que bloqueia o JavaScript
    - Adicionado `noValidate` no form para garantir que a validação JavaScript
      seja executada
  - **Arquivos modificados**: `components/quote-form.tsx`,
    `app/orcamento/page.tsx`
  - **Data**: 2025-01-22

- **Sistema de Manutenção Temporariamente Desabilitado**: Desabilitada
  temporariamente a validação de manutenção que bloqueava locações de
  equipamentos
  - **Motivo**: Sistema de manutenção ainda não está completo, causando erros ao
    solicitar equipamentos
  - **Alterações**:
    - Verificação de manutenção comentada em `lib/equipment-availability.ts`
    - Função `isEquipmentInMaintenance` desabilitada temporariamente
    - Função `getMaintenanceBlockingInfo` desabilitada temporariamente
  - **Script de Limpeza**: Criado `scripts/remove-maintenance-records.ts` para
    remover registros de manutenção do banco de dados
    - Comando: `pnpm db:clean:maintenance` ou
      `npx tsx scripts/remove-maintenance-records.ts`
    - Removidos 18 registros de manutenção agendada que estavam bloqueando
      locações
  - **TODO**: Reativar verificação quando o sistema de manutenção estiver
    completo
  - **Data**: 2025-12-21

### Fixed 🐛

- **Menu do usuario no header mostra bolinha de notificacoes no dropdown**: o
  item "Notificacoes" agora exibe o alerta vermelho como na area-cliente.
  - **Problema**: o indicador do dropdown era discreto demais e nao ficava
    visivel como no menu lateral da area-cliente.
  - **Solucao**: alinhar tamanho e borda do indicador ao padrao da area-cliente.
  - **Arquivos modificados**: `components/header.tsx`,
    `docs/issues/known-issues.md`, `docs/features/header-user-menu.md`
  - **Data**: 2025-12-27

- **Menu do usuario no header (mobile) ajusta scroll do banner**: navegacao do
  dropdown para paginas da area do cliente agora aplica o offset do header.
  - **Problema**: itens do dropdown navegavam com `router.push` sem setar
    `adjustScrollAfterLoad`, deixando o banner desalinhado no mobile.
  - **Solucao**: marcar `adjustScrollAfterLoad` para rotas `/area-cliente/*`
    quando em viewport mobile, permitindo o `scrollToBanner` do layout.
  - **Arquivos modificados**: `components/header.tsx`,
    `docs/issues/known-issues.md`, `docs/features/header-user-menu.md`
  - **Data**: 2025-12-27

- **Exclusao de orcamento pelo cliente nao remove do admin**: o cliente agora
  remove apenas do proprio historico em `/area-cliente/orcamentos`.
  - **Problema**: o DELETE de `/api/quotes/[id]` apagava o registro do banco e
    sumia do painel admin.
  - **Solucao**: soft delete via `clientDeletedAt` e filtro no `GET /api/quotes`
    para ocultar somente na area do cliente.
  - **Arquivos modificados**: `prisma/schema.prisma`, `app/api/quotes/route.ts`,
    `app/api/quotes/[id]/route.ts`, `docs/issues/known-issues.md`,
    `docs/features/quote-system.md`
  - **Data**: 2025-12-27

- **Badge de notificacoes no header e na area do cliente**: contador agora
  sincroniza com a API ao autenticar, sem depender de abrir
  `/area-cliente/notificacoes`.
  - **Problema**: badges dependiam apenas do localStorage e so atualizavam ao
    visitar a pagina de notificacoes.
  - **Solucao**: header busca `/api/client/notifications/stats` quando
    autenticado e dispara `notificationUpdate` com o valor real.
  - **Arquivos modificados**: `components/header.tsx`,
    `docs/issues/known-issues.md`, `docs/features/notification-system.md`
  - **Data**: 2025-12-27

- **Dropdown de mes/ano no calendario de equipamentos**: lista apenas meses/anos
  do periodo vigente em diante (limite de 10 anos) e, ao trocar o ano, abre
  janeiro por padrao.
  - **Problema**: meses passados apareciam no dropdown e a troca de ano mantinha
    o mesmo mes (ex.: dezembro -> dezembro).
  - **Solucao**: definir `fromMonth`/`toMonth` e `fromYear`/`toYear`, ampliar o
    `maxDate` para 10 anos, remover `month` fixo, ocultar opcoes desabilitadas e
    resetar o mes ao trocar o ano.
  - **Arquivos modificados**: `components/ui/calendar.tsx`,
    `components/smart-equipment-pricing.tsx`, `docs/issues/known-issues.md`,
    `docs/features/equipment-booking-system.md`
  - **Data**: 2025-12-27

- **Desconto aplicado por equipamento no bloco Total**: o resumo passou a listar
  o desconto aplicado de cada item no historico da locacao.
  - **Problema**: nao havia detalhamento de desconto no bloco "Total".
  - **Solucao**: lista por equipamento usando `quote.items.appliedDiscount` e
    `quote.items.appliedPeriod`.
  - **Arquivos modificados**: `app/area-cliente/historico/[id]/page.tsx`,
    `docs/issues/known-issues.md`,
    `docs/features/area-cliente-historico-detalhes.md`
  - **Data**: 2025-12-26

- **Runtime error ao exibir periodo por item nos detalhes**: corrigido o
  `ReferenceError` que quebrava a pagina de historico da locacao.
  - **Problema**: `showItemizedPeriods` era usado sem definicao.
  - **Solucao**: definicao de variaveis derivadas antes do render.
  - **Arquivos modificados**: `app/area-cliente/historico/[id]/page.tsx`,
    `docs/issues/known-issues.md`
  - **Data**: 2025-12-26

- **Periodo de locacao por equipamento nos detalhes**: o bloco de periodo passou
  a listar datas por item quando os periodos sao diferentes.
  - **Problema**: a pagina exibia apenas o intervalo global, escondendo datas
    individuais dos equipamentos.
  - **Solucao**: leitura de `quote.items` e renderizacao condicional por item.
  - **Arquivos modificados**: `app/area-cliente/historico/[id]/page.tsx`,
    `docs/issues/known-issues.md`,
    `docs/features/area-cliente-historico-detalhes.md`
  - **Data**: 2025-12-26

- **Total a pagar 10x maior nos detalhes da locacao**: o resumo passou a usar o
  total final do orcamento e a soma numerica correta com multa.
  - **Problema**: valores Decimal chegavam como string e a soma gerava
    concatenacao ("60" + 0 = "600").
  - **Solucao**: coercao numerica e prioridade para `quote.finalTotal` ou
    `quote.total`.
  - **Arquivos modificados**: `app/area-cliente/historico/[id]/page.tsx`,
    `docs/issues/known-issues.md`,
    `docs/features/area-cliente-historico-detalhes.md`
  - **Data**: 2025-12-26

- **Recuperacao de senha com pagina de reset e envio de email**: fluxo completo
  para redefinir senha via link.
  - **Problema**: email nao era enviado em dev e a rota `/reset-password` nao
    existia
  - **Solucao**: envio habilitado quando Resend esta configurado e nova pagina
    de redefinicao
  - **Arquivos modificados**: `app/api/auth/forgot-password/route.ts`,
    `app/reset-password/page.tsx`, `docs/features/password-recovery-system.md`
  - **Data**: 2025-12-24

- **Clique em eventos do popover agregado abre dialog corretamente**: Ajustado o
  repasse do `CalendarEvent` para garantir que a dialog de detalhes abra quando
  um evento e selecionado no popover "+N".
  - **Arquivos Modificados**:
    `components/admin/advanced-calendar/event-block.tsx`,
    `components/admin/advanced-calendar/daily-view.tsx`,
    `components/admin/advanced-calendar/weekly-view.tsx`,
    `components/admin/advanced-calendar/aggregated-events-popover.tsx`,
    `docs/issues/known-issues.md`, `docs/features/advanced-calendar-system.md`
  - **Data**: 2025-12-23

- **Scroll Vertical nas Colunas Kanban**: Corrigido problema onde os blocos de
  orçamentos nas visualizações kanban ultrapassavam a altura do componente
  quando havia muitos itens
  - **Problema**: As colunas (Pendente, Aprovado, Rejeitado) não tinham scroll
    vertical configurado, fazendo com que os cartões ultrapassassem o limite
    visual quando havia muitos orçamentos
  - **Solução**: Alterado `overflow-visible` para `overflow-y-auto` no container
    dos itens, mantendo a altura máxima de 600px
  - **Estilização**: Mantida a scrollbar customizada laranja para consistência
    visual com o design system
  - **Arquivos modificados**: `components/admin/kanban-pipeline.tsx`
  - **Data**: 2025-01-22

- **Sincronizacao do periodo ao ajustar dias no orcamento**: quando um item com
  `startDate` tem o campo `days` alterado, o `endDate` e recalculado com base na
  data de inicio e na preferencia de finais de semana.
  - **Arquivos modificados**: `stores/useCartStore.ts`,
    `docs/features/orcamento-page.md`
  - **Data**: 2025-12-22

### Added ✨

- **Column Events Panel - Sidebar de Eventos por Coluna**: Implementado novo
  componente de sidebar para visualização agregada de eventos do calendário
  - **Componente Criado**:
    `components/admin/advanced-calendar/column-events-panel.tsx`
  - **Funcionalidades**:
    - Clique no header de coluna abre sidebar com todos os eventos daquela
      coluna
    - Lista ordenada de eventos com cards compactos (cliente, equipamento,
      horário, status)
    - Cards clicáveis que abrem o Dialog de detalhes individuais
    - Empty state quando não há eventos
    - Contador de eventos no header
    - Badges de status com cores semânticas
  - **Hover Effects Implementados**:
    - Header de coluna com background laranja (`bg-orange-50`) e texto laranja
      (`text-orange-600`)
    - Coluna completa (visão diária) com background laranja suave
      (`bg-orange-50/30`)
    - Swimlanes (visão timeline) com background laranja suave
      (`bg-orange-50/20`)
  - **Arquivos Modificados**:
    - `components/admin/advanced-calendar/index.tsx` - Estado e handlers para
      sidebar
    - `components/admin/advanced-calendar/daily-view.tsx` - onClick e hover em
      colunas
    - `components/admin/advanced-calendar/timeline-view.tsx` - onClick e hover
      em dias
    - `components/admin/advanced-calendar/monthly-view.tsx` - onClick e hover em
      dias da semana
  - **Documentação Atualizada**: `docs/features/advanced-calendar-system.md`
  - **Benefícios**:
    - Elimina redundância entre Dialog e Sidebar
    - Hierarquia clara: Dialog = 1 evento, Sidebar = N eventos de uma coluna
    - Melhor organização e controle sobre categorias/períodos
    - UX aprimorada com feedback visual laranja (identidade visual do projeto)
  - **Casos de Uso**:
    - Visão Diária: Ver todos os orçamentos "Pendentes" / "Aprovados" /
      "Rejeitados"
    - Visão Semanal: Ver todas as entregas de "SEX 19" ou "TER 16"
    - Visão Mensal: Ver todas as manutenções das "Segundas" do mês
  - **Data**: 2025-12-21

### Changed 🔄

- **Atualização de dependências**: Atualizados pacotes para versões mais
  recentes
  - `@types/node`: 24.10.4 → 25.0.3 (devDependency)
  - `react-resizable-panels`: 3.0.6 → 4.0.8
    - **Breaking Changes**: API atualizada na versão 4.x
      - `PanelGroup` → `Group`
      - `PanelResizeHandle` → `Separator`
    - **Arquivos Modificados**: `components/ui/resizable.tsx`
  - **Migração Base UI**: `@base-ui-components/react@1.0.0-rc.0` (deprecated) →
    `@base-ui/react@^1.0.0`
    - Resolvido problema de depreciação do pacote antigo
    - Atualizada importação em `components/ui/dialog.tsx`
    - API do Dialog mantida compatível, sem breaking changes
    - **Arquivos Modificados**: `package.json`, `components/ui/dialog.tsx`
  - **Não atualizado**: `tailwindcss@3.4.17` (mantido conforme diretrizes do
    projeto)
  - **Validação**: Componentes `resizable.tsx` e `dialog.tsx` testados e
    funcionando corretamente
  - **Data**: 2025-12-19

### Added ✨

- **Documentação completa do Sistema de Calendário Avançado**: Criada
  documentação detalhada explicando os três modos de visualização (Diário,
  Semanal e Mensal), onde estão implementados, para que servem e o que
  controlam.
  - **Arquivo Criado**: `docs/features/advanced-calendar-system.md`
  - **Conteúdo**:
    - Descrição técnica completa das três visualizações
    - Localização de todas as implementações (4 páginas admin)
    - Propósito e controle de cada visualização
    - Exemplos de uso por página
    - Funcionalidades técnicas avançadas
    - Roadmap de funcionalidades futuras
  - **Páginas Documentadas**:
    - `/admin/maintenance` - Calendário de Manutenções
    - `/admin/logistics` - Calendário de Logística
    - `/admin/rentals` - Calendário de Locações
    - `/admin/orcamentos` - Calendário de Orçamentos
  - **Data**: 2025-01-XX

### Fixed 🐛

- **Datas automáticas e finais de semana**: Confirmação de finais de semana
  ocorre antes de adicionar ao carrinho quando não há calendário, datas
  automáticas passam a respeitar `includeWeekends` e o orçamento exibe período
  estimado para itens sem datas.
  - **Arquivos Modificados**: `components/smart-quote-button.tsx`,
    `components/smart-equipment-pricing.tsx`, `stores/useCartStore.ts`,
    `lib/rental-date-utils.ts`, `app/api/quotes/route.ts`,
    `app/orcamento/page.tsx`, `docs/issues/known-issues.md`,
    `docs/features/quote-system.md`, `docs/features/orcamento-page.md`
  - **Data**: 2025-12-22

- **Timeline semanal com hover por peer**: Headers dos dias e recursos na
  sidebar agora aplicam `peer`/`peer-hover` para destacar colunas/linhas
  correspondentes, com background laranja consistente ao alternar entre
  `bg-slate-50` e `bg-orange-50`; o hover em "Equipamentos" ativa o destaque
  global da semana, sem impacto nas visäes di ria e mensal.
  - **Arquivos Modificados**:
    `components/admin/advanced-calendar/timeline-view.tsx`,
    `docs/issues/known-issues.md`, `docs/features/advanced-calendar-system.md`
  - **Data**: 2025-12-21

- **Timeline (Equipamentos) com linhas preenchendo a altura do bloco**: Linhas e
  swimlanes agora expandem para ocupar a altura disponivel quando ha poucos
  recursos, mantendo altura minima de 60px.
  - **Arquivos Modificados**:
    `components/admin/advanced-calendar/timeline-view.tsx`,
    `docs/issues/known-issues.md`, `docs/features/advanced-calendar-system.md`
  - **Data**: 2025-12-20

- **Timeline (Equipamentos) com altura consistente**: Cabeçalho e linhas de
  recursos/swinlanes agora usam a mesma altura, evitando discrepâncias visuais;
  `overflow-x-hidden` no grid evita espaço extra no rodapé.
  - **Arquivos Modificados**:
    `components/admin/advanced-calendar/timeline-view.tsx`,
    `docs/issues/known-issues.md`, `docs/features/advanced-calendar-system.md`
  - **Data**: 2025-12-19

- **Equipamento bloqueado incorretamente por manutenção agendada**: Corrigida a
  lógica de verificação de disponibilidade que bloqueava equipamentos mesmo
  quando a manutenção agendada não interferia com o período de locação
  solicitado. Agora o sistema verifica se a data da manutenção realmente
  conflita com as datas de locação antes de bloquear.
  - **Causa**: A função `isEquipmentInMaintenance` verificava apenas se havia
    manutenção agendada, sem considerar o período de locação solicitado.
  - **Solução**:
    - Modificada `isEquipmentInMaintenance` para aceitar período de locação
      opcional
    - Manutenções `IN_PROGRESS` sempre bloqueiam o equipamento
    - Manutenções `SCHEDULED` só bloqueiam se a data agendada está dentro do
      período de locação
  - **Arquivos Modificados**:
    - `lib/maintenance-automation.ts` (lógica de verificação de conflito)
    - `lib/equipment-availability.ts` (passa período para verificação)
  - **Data**: 2025-01-XX

### Changed 🔄

- **Melhoria na detecção do warning de depreciação do Zustand**: Aprimorada a
  lógica de supressão do warning do Zustand para capturar mensagens em múltiplos
  formatos (string, objetos, arrays) e interceptar também `console.log`. A
  detecção agora usa sistema de padrões múltiplos para maior precisão.
  - **Arquivos Modificados**: `app/layout.tsx`, `app/ClientLayout.tsx`,
    `docs/issues/known-issues.md`
  - **Data**: 2025-01-XX

- **Script patch-prisma.js em modo silencioso**: O script agora roda
  silenciosamente por padrão, mostrando apenas warnings e erros. Logs
  informativos de sucesso foram removidos para manter o output do build mais
  limpo. Para debug, use `PATCH_PRISMA_VERBOSE=true pnpm build` para ver logs
  detalhados.
  - **Arquivos Modificados**: `scripts/patch-prisma.js`,
    `docs/issues/known-issues.md`
  - **Data**: 2025-01-XX

- **Atualização de dependências (Next/React/Prisma/Vitest)**: Atualizados
  pacotes core e ferramentas para versões estáveis, respeitando bloqueios
  documentados.
  - **Pacotes**: `next` 16.1.0, `react`/`react-dom` 19.2.3, `@prisma/client` e
    `prisma` 7.2.0 (+ `@prisma/adapter-pg` 7.2.0), `@eslint/js` 9.39.2,
    `@typescript-eslint/*` 8.50.0, `eslint-config-next` 16.1.0, `@vitest/*`
    4.0.16, `lucide-react` 0.562.0, `three`/`@types/three` 0.182.0,
    `markdownlint-cli` 0.47.0, `next-openapi-gen` 0.9.0, `lenis` 1.3.16.
  - **Mantido por compatibilidade**: `@base-ui-components/react` (pedido do
    usuário), `tailwindcss` 3.4.17 (bloqueio), `react-resizable-panels` 3.x
    (major sem validação), `@types/node` 24.x.
  - **Validação**: `pnpm run build -- --webpack` ✅ (Turbopack falha no Windows
    por falta de privilégio de symlink) e `pnpm test` ✅ (testes de contrato
    pulam sem servidor ativo).
  - **Data**: 2025-12-19

### Fixed 🐛

- **Prisma 7.1.0 - Erro "datasource property url is no longer supported" -
  CRÍTICO**: Corrigida configuração do Prisma 7 que estava causando erro de
  validação no build.
  - **Causa**: No Prisma 7, as propriedades `url` e `directUrl` não podem mais
    estar no `schema.prisma` - elas devem estar apenas no `prisma.config.ts`.
  - **Solução**:
    - Removidas propriedades `url` e `directUrl` do `prisma/schema.prisma`
    - Configurado apenas `url` no `prisma.config.ts` (já tinha `url`)
    - `directUrl` não é suportado no `datasource` do `prisma.config.ts` no
      Prisma 7.1.0
    - `DIRECT_URL` é usado automaticamente via variável de ambiente para
      migrations
    - Schema agora contém apenas `provider = "postgresql"`
  - **Arquivos Modificados**:
    - `prisma/schema.prisma` (removidas propriedades de URL)
    - `prisma.config.ts` (adicionado directUrl)
    - `docs/issues/known-issues.md` (documentação do problema)
  - **Data**: 2025-01-XX

- **Deploy na Vercel falhando com "pnpm install" exited with 1 - CRÍTICO**:
  Corrigido script `postinstall` que estava causando falha no deploy da Vercel.
  - **Causa**: O `postinstall` executava `prisma generate` incondicionalmente
    durante o `pnpm install`, mas na Vercel as variáveis de ambiente
    (`DATABASE_URL`) podem não estar disponíveis durante a instalação, causando
    falha no processo.
  - **Solução**:
    - Criado script `scripts/safe-postinstall.js` que detecta ambiente CI/Vercel
    - Script pula Prisma generate se `DATABASE_URL` não estiver disponível
    - Script não falha o build (sai com código 0 mesmo em caso de erro)
    - Prisma generate continua sendo executado no `prebuild` (já configurado)
  - **Arquivos Modificados**:
    - `package.json` (postinstall atualizado)
    - `scripts/safe-postinstall.js` (novo script seguro)
    - `docs/issues/known-issues.md` (documentação do problema)
  - **Data**: 2025-01-XX

- **Configuração incorreta do Supabase para serverless (Vercel) - CRÍTICO**:
  Corrigida configuração de `DATABASE_URL` que estava causando erros "Max
  clients reached" em produção.
  - **Causa**: Documentação local desatualizada recomendava Session Pooler
    (porta 5432) com `connection_limit=1`, que é inadequado para ambientes
    serverless (Vercel) devido ao limite baixo de conexões simultâneas.
  - **Solução**:
    - Atualizado para usar **Transaction Pooler (porta 6543)** conforme
      recomendação oficial do Supabase e Prisma para serverless
    - Removido `connection_limit=1` que estava causando exaustão do pool
    - Configurado `DIRECT_URL` corretamente para migrations
    - Atualizado `schema.prisma` e `prisma.config.ts` para usar `directUrl`
    - Documentação corrigida em `docs/guides/supabase-timeout-fix.md` e
      `docs/getting-started/deployment.md`
  - **Recomendação Oficial**:
    - **Produção (Serverless)**: Transaction Pooler (porta 6543) com
      `?pgbouncer=true`
    - **Migrations**: Direct Connection (porta 5432) via `DIRECT_URL`
    - **Desenvolvimento**: Direct Connection (porta 5432) sem pooler
  - **Arquivos Modificados**:
    - `prisma/schema.prisma` (adicionado `directUrl`)
    - `prisma.config.ts` (habilitado `directUrl`)
    - `docs/guides/supabase-timeout-fix.md` (corrigida recomendação)
    - `docs/getting-started/deployment.md` (adicionada seção sobre Supabase)
  - **Referências Oficiais**:
    - [Supabase: Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
    - [Prisma: Supabase Integration](https://www.prisma.io/docs/orm/overview/databases/supabase)
    - [Supabase: Prisma Guide](https://supabase.com/docs/guides/database/prisma)
  - **Data**: 2025-12-19

- **Warning de depreciação do default export do Zustand (Vercel Analytics/Speed
  Insights)**: Warning agora é suprimido antes da hidratação; código do projeto
  segue usando import { create }.
  - **Causa**: @vercel/analytics e @vercel/speed-insights ainda importam Zustand
    via default export em seus scripts de instrumentação, disparando o warning
    nos navegadores.
  - **Solução**: - Script global movido para ext/script com
    strategy="beforeInteractive" em pp/layout.tsx, interceptando
    console.warn/console.error antes do script instrument.\* da Vercel. -
    Mantido fallback em pp/ClientLayout.tsx para warnings assíncronos; sem
    alteração em dependências ou stores. - Documentação do problema atualizada
    em docs/issues/known-issues.md.
  - **Arquivos Modificados**: pp/layout.tsx, docs/issues/known-issues.md
  - **Data**: 2025-12-19

- **Build falhando com erro 3221226505 no postbuild (patch-prisma.js)**:
  Corrigido problema crítico onde o build falhava na etapa `postbuild` com
  código de erro `3221226505` no Windows.
  - **Causa**: O script `patch-prisma.js` usava `fs.cpSync()` que falha
    silenciosamente no Windows quando há arquivos bloqueados, caminhos longos ou
    problemas de permissões. O método não lida bem com erros individuais durante
    a cópia.
  - **Solução**:
    - Refatorado para usar função `copyDirectory` customizada que trata erros
      individuais de arquivos
    - Adicionada detecção automática do caminho correto do Prisma Client
      (compatível com npm, yarn e pnpm)
    - Melhor tratamento de erros com logging detalhado
    - Verificações de segurança antes de copiar arquivos
  - **Arquivos Modificados**:
    - `scripts/patch-prisma.js` - Refatorado completamente com cópia recursiva
      robusta
    - `docs/issues/known-issues.md` - Documentação detalhada do problema e
      solução
  - **Data**: 2025-12-18

- **Select de frete bloqueava scroll e criava barra branca**: Corrigido problema
  crítico onde o dropdown de opções de frete em `/orcamento` bloqueava o scroll
  vertical da página e adicionava uma barra branca invisível que deslocava todo
  o conteúdo para a esquerda.
  - **Causa**: Radix Select acionava `RemoveScroll` mesmo com `modal={false}`,
    adicionando `data-scroll-locked="1"` ao body e criando wrapper que aplicava
    `margin-right: 10px` via variável `--removed-body-scroll-bar-size`
  - **Solução**:
    - CSS com alta especificidade para neutralizar `data-scroll-locked` e forçar
      `--removed-body-scroll-bar-size: 0`
    - JavaScript que remove o wrapper de scroll lock e usa `setProperty` com
      `!important` para sobrescrever estilos inline do Radix
    - Execução contínua (10ms) enquanto select está aberto
  - **Arquivos Modificados**:
    - `components/ui/select.tsx` - Lógica de remoção de scroll lock
    - `app/globals.css` - Regras CSS preventivas
    - `docs/issues/known-issues.md` - Documentação detalhada do problema e
      solução
  - **Data**: 2025-12-18

### Added ✨

- **Download de PDF de orçamentos (cliente e admin)**: Implementados endpoints
  para download de PDF de orçamentos tanto na área do cliente quanto no painel
  administrativo.
  - **Arquivos Criados**:
    - `app/api/quotes/[id]/download/route.ts` - Endpoint para cliente baixar PDF
      do próprio orçamento
    - `app/api/admin/quotes/[id]/download/route.ts` - Endpoint para admin baixar
      PDF de qualquer orçamento
  - **Arquivos Modificados**:
    - `app/area-cliente/orcamentos/page.tsx` - Adicionado botão de download de
      PDF no modal de detalhes do orçamento
    - `app/admin/orcamentos/page.tsx` - Adicionado botão de download de PDF no
      modal de detalhes do orçamento
  - **Nota**: A geração real de PDF será implementada em breve usando biblioteca
    como `@react-pdf/renderer` ou `puppeteer`. Por enquanto, os endpoints
    retornam JSON com os dados do orçamento.
  - **Data**: 2025-12-17

- **Guia completo de testes para boletos Asaas**: Documentação passo a passo
  para testar o fluxo completo de boletos Asaas no Postman/Insomnia, incluindo:
  - Geração de boleto com exemplos de headers e body
  - Simulação de webhooks (pago, vencido, cancelado, refund)
  - Conciliação manual de pagamentos
  - Verificações no painel Asaas e no banco de dados
  - Troubleshooting completo e checklist de validação
  - **Arquivos criados**:
    - `docs/guides/asaas-boleto-testing.md` - Guia técnico completo
    - `docs/guides/asaas-boleto-testing-iniciantes.md` - Guia passo a passo para
      iniciantes
  - **Data**: 2025-12-16

- **Comandos de formatação e lint combinados**: Adicionados novos comandos npm
  para facilitar o workflow de desenvolvimento
  - `pnpm format:all` - Executa `format` e `format:md` juntos, formatando todos
    os arquivos do projeto (código e Markdown)
  - `pnpm lint:all` - Executa `lint:fix` e `lint` em sequência, corrigindo
    automaticamente problemas e depois verificando o restante
  - **Data**: 2025-12-16

- **Integracao de boletos Asaas (sandbox)**: Gateway de boleto configurado para
  gerar e consultar cobrancas via Asaas, incluindo webhook autenticado e
  verificador de status.
  - **Arquivos Criados**: `lib/payment-gateways/asaas.ts`
  - **Arquivos Modificados**:
    - `lib/payment-gateways/boleto.ts`
    - `app/api/payments/boleto/webhook/route.ts`
    - `app/api/payments/boleto/verify/route.ts`
    - `.env.example`
  - **Data**: 2025-12-16

- **Locacoes pendentes exibem solicitacoes**: Orçamentos agora geram
  locacoes-placeholder PENDING (não bloqueiam estoque) para aparecer em
  `/admin/rentals`; disponibilidade ignora PENDING com orçamento não aprovado.
  - **Arquivos Modificados**:
    - `app/api/quotes/route.ts`
    - `lib/equipment-availability.ts`
  - **Data**: 2025-12-16

### Fixed 🐛

- **Select de frete em `/orcamento` nao bloqueia mais o scroll nem cria faixa
  branca**: O `Select` do design system passa a abrir em modo nao modal por
  padrao, evitando `RemoveScroll` no `body` e mantendo o dropdown alinhado sem
  faixas laterais; CSS global neutraliza `body[data-scroll-locked]` para remover
  padding/margin extra e liberar o scroll.
  - **Arquivos Modificados**: `components/ui/select.tsx`, `app/globals.css`,
    `docs/issues/known-issues.md`, `docs/features/orcamento-page.md`,
    `AGENTS.md`
  - **Data**: 2025-12-18

- **Hover dos botões \"Ver Detalhes\" no admin**: Ajustado CSS global para que
  os botões `admin-action-button` mantenham fundo branco e permitam `scale`
  suave no hover, evitando que regras `!important` anulem `hover:scale-105`.
  - **Arquivos Modificados**: `app/globals.css`
  - **Data**: 2025-12-17

- **Locações pendentes de orçamentos rejeitados não aparecem mais**: A API agora
  exclui locações de orçamentos `REJECTED` e esconde órfãs por padrão; o script
  `pnpm db:clean:rejected-rentals` também cancela registros sem `quoteId` ou com
  `quote` inexistente, limpando bases já afetadas.
  - **Arquivos Modificados**:
    - `app/api/admin/rentals/route.ts`
    - `scripts/clean-rejected-quote-rentals.ts`
  - **Data**: 2025-12-17

- **Confirmação de exclusão de orçamento travava modal no admin**: Ao clicar em
  "Excluir Permanentemente" em orçamentos rejeitados, a confirmação ficava atrás
  do dialog Base UI e o focus trap bloqueava toda a página.
  - **Causa Raiz**: `AlertDialog` usava `z-50` fora do `Dialog.BodyContent`,
    enquanto o modal pai usa `z-[var(--layer-dialog)]`, deixando a confirmação
    invisível e com overlay ativo.
  - **Arquivos Modificados**:
    - `app/admin/orcamentos/page.tsx`
    - `components/ui/alert-dialog.tsx`
  - **Data**: 2025-12-17
- **Sombra dos cards Rejeitado no Kanban**: Sombra aplicada nos cards da coluna
  "Rejeitado" agora é quase imperceptível no estado normal e levemente reforçada
  no hover, com espaçamento do contêiner para não cortar o efeito.
  - **Causa Raiz**: A coluna usa contêiner com `overflow-y-auto`, tornando a
    sombra sutil praticamente invisível quando o item encosta no limite.
  - **Arquivos Modificados**:
    - `app/admin/orcamentos/page.tsx`
    - `components/admin/kanban-pipeline.tsx`
  - **Data**: 2025-12-17

- **Upload de avaria isolado do carrossel público**: O upload de fotos em
  "Registro de Perdas de Peças e Avarias" agora usa inputs únicos por instância,
  evitando que imagens de avaria sejam adicionadas ao carrossel público do
  equipamento.
  - **Causa Raiz**: Ambos os `ImageUpload` compartilhavam `id="file-upload"`, e
    o botão do bloco de avarias acionava o input de imagens públicas.
  - **Arquivos Modificados**:
    - `components/ui/image-upload.tsx`
    - `docs/features/equipment-parts-loss.md`
  - **Data**: 2025-12-17

- **Remoção automática de imagens do Supabase Storage**: Implementada remoção
  automática de imagens do Supabase Storage quando:
  - Uma imagem é removida durante a edição de um equipamento
  - Um equipamento é completamente deletado
  - Isso evita acúmulo de arquivos órfãos ocupando espaço de armazenamento
  - **Arquivos criados**:
    - `lib/storage-utils.ts` - Funções utilitárias para gerenciar remoção de
      arquivos do Storage
    - `scripts/cleanup-orphaned-images.ts` - Script para limpar imagens órfãs
      existentes
  - **Arquivos modificados**:
    - `app/api/admin/equipments/[id]/route.ts` - Rotas PUT e DELETE agora
      removem arquivos do Storage
  - **Data**: 2025-12-16

### Added ✨

- **Automa��o de cron jobs sem upgrade Vercel**: Workflow do GitHub Actions
  .github/workflows/cron-dispatch.yml dispara os 5 cron jobs extras via HTTP
  (fora do limite Hobby), com fallback manual (workflow_dispatch) e segredos
  CRON_BASE_URL + CRON_SECRET. Documenta��o atualizada em
  docs/issues/vercel-deploy-cron-jobs-limit.md.
  - **Data**: 2025-12-15

- **Especificação Gantt (Admin Manutenção/Logística)**: Documento detalhando
  header inspirado no Notion (dropdown diário/semanal/mensal, setas, Hoje,
  mini-calendário), estrutura de linhas/colunas para unidades físicas e
  veículos, barras/legendas de status, interações MVP e evoluções futuras (drag
  & drop na fase 2).
  - **Arquivos Criados**: `docs/features/gantt-admin.md`
  - **Data**: 2025-12-15
- **Sistema de Gestão de Unidades Físicas**: Implementado sistema completo para
  gerenciar unidades físicas individuais de equipamentos
  - **Modelo EquipmentUnit**: Novo modelo no Prisma para representar unidades
    físicas individuais com:
    - Código único por unidade (ex: "BET-001", "COMP-042")
    - Status granular (AVAILABLE, RESERVED, RENTED, MAINTENANCE, RETIRED)
    - Horímetro e odômetro por unidade
    - Número de série e notas
  - **APIs RESTful**: Endpoints completos para CRUD de unidades físicas:
    - `GET /api/admin/equipment-units` - Listar unidades (com filtros por
      equipamento, status, busca)
    - `POST /api/admin/equipment-units` - Criar nova unidade
    - `GET /api/admin/equipment-units/[id]` - Buscar unidade específica
    - `PATCH /api/admin/equipment-units/[id]` - Atualizar unidade (status,
      horímetro, odômetro, etc.)
    - `DELETE /api/admin/equipment-units/[id]` - Deletar unidade (com validação
      de uso)
  - **Componente EquipmentUnitsManager**: Interface completa para gerenciar
    unidades na página de detalhes do equipamento:
    - Listagem de todas as unidades com status visual
    - Criação e edição de unidades via dialog
    - Atualização de horímetro/odômetro por unidade
    - Exibição de número de série e notas
    - Validação de código único
    - Prevenção de exclusão de unidades em uso
  - **Integração na Página de Equipamentos**: Seção "Unidades Físicas"
    adicionada em `/admin/equipamentos/[id]`
  - **Enum EquipmentUnitStatus**: Novo enum com status: AVAILABLE, RESERVED,
    RENTED, MAINTENANCE, RETIRED
  - **Arquivos Criados**:
    - `app/api/admin/equipment-units/route.ts`
    - `app/api/admin/equipment-units/[id]/route.ts`
    - `components/admin/equipment-units-manager.tsx`
  - **Arquivos Modificados**:
    - `prisma/schema.prisma` (adicionado modelo EquipmentUnit e enum
      EquipmentUnitStatus)
    - `app/admin/equipamentos/[id]/page.tsx` (integração do componente)
  - **Data**: 2025-12-13

### Added ✨

- **Script de limpeza de orçamentos**: Criado script `scripts/clean-quotes.ts`
  para limpar todos os registros de orçamentos do banco de dados, útil para
  testes e reset do sistema
  - **Funcionalidades**:
    - Deleta todos os orçamentos (Quote) e seus itens (QuoteItem)
      automaticamente via cascade
    - Exibe estatísticas antes e depois da limpeza
    - Verifica e alerta sobre pagamentos órfãos e locações vinculadas
  - **Comando**: `pnpm db:clean:quotes`
  - **Arquivos Criados**: `scripts/clean-quotes.ts`
  - **Arquivos Modificados**: `package.json` (adicionado script
    `db:clean:quotes`)
  - **Dependências**: Adicionado `dotenv` como dev dependency para carregar
    variáveis de ambiente
  - **Data**: 2025-12-13
- **Documentação interna organizada**: Arquivos de progresso financeiro e
  regeneração do Prisma foram movidos para o diretório `docs/internal` com links
  no índice
  - **Arquivos Criados**: `docs/internal/orcamento-e-progresso.md`,
    `docs/internal/prisma-client-regeneration.md`
  - **Arquivos Modificados**: `docs/README.md`
  - **Data**: 2025-12-15

### Fixed 🛠️

- **Indicador de horário atual no calendário**: Linha laranja volta ao topo após
  23:59, usando o passo real do slot (altura da hora + borda) para evitar
  estouro abaixo da última linha.
  - **Arquivos Modificados**:
    `components/admin/advanced-calendar/time-indicator.tsx`,
    `components/admin/advanced-calendar/constants.ts`,
    `components/admin/advanced-calendar/daily-view.tsx`,
    `components/admin/advanced-calendar/weekly-view.tsx`
  - **Data**: 2025-12-16

- **Warning `--localstorage-file` no build Next**: Persistência do carrinho
  acessava `localStorage` durante o SSR, gerando avisos ao gerar páginas
  estáticas. O store agora é marcado como client-only e ignora o storage quando
  a janela não existe.
  - **Arquivos Modificados**: `stores/useCartStore.ts`
  - **Data**: 2025-12-15

- **Grade diária do calendário em `/admin/maintenance`**: Inclusão da linha de
  00:00 como primeira hora, alinhando a visão diária/semanal para mostrar a
  meia-noite no topo da coluna de horas.
  - **Arquivos Modificados**:
    `components/admin/advanced-calendar/daily-view.tsx`,
    `components/admin/advanced-calendar/weekly-view.tsx`
  - **Data**: 2025-12-15

- **Visão diária do calendário em `/admin/maintenance`**: A grade diária agora
  renderiza uma coluna padrão mesmo quando não há recursos filtrados e mantém
  linhas horizontais por hora, evitando que a área de eventos fique em branco.
  - **Arquivos Modificados**:
    `components/admin/advanced-calendar/daily-view.tsx`
  - **Data**: 2025-12-15

- **Labels de 00:00 ocultos na visão diária/semanal**: A primeira linha da grade
  (meia-noite) permanece visível mas sem texto para reduzir ruído visual,
  mantendo o restante das horas etiquetadas normalmente.
  - **Arquivos Modificados**:
    `components/admin/advanced-calendar/daily-view.tsx`,
    `components/admin/advanced-calendar/weekly-view.tsx`
  - **Data**: 2025-12-15
- **Indicador de horário atual alinhado ao grid**: Linha de tempo real ajustada
  para alinhar pixel a pixel às linhas do calendário, evitando deslocamento
  visual entre a marcação e as linhas de hora.
  - **Arquivos Modificados**:
    `components/admin/advanced-calendar/time-indicator.tsx`
  - **Data**: 2025-12-15

- **Dropdowns de filtros em `/admin/maintenance`**: Ajustado o `CustomSelect`
  para renderizar via portal com posicionamento fixo e camada de popover,
  garantindo que as listas de opções não fiquem atrás do calendário ou de outros
  cards na página.
  - **Arquivos Modificados**: `components/ui/custom-select.tsx`
  - **Data**: 2025-12-15

- **Filtro padrão na página de Locações (Admin)**: Restaurado comportamento onde
  a página `/admin/rentals` exibe por padrão apenas locações com status
  "Pendente" (PENDING), similar ao comportamento da primeira seção em
  `/admin/settings`. Este comportamento havia sido removido acidentalmente em
  uma atualização anterior.
  - **Arquivos Modificados**: `app/admin/rentals/page.tsx`,
    `docs/features/admin-system.md`
  - **Comentário no código**: Adicionado comentário crítico explicando que o
    filtro padrão deve ser 'PENDING' e nunca alterado para 'all' sem consultar o
    usuário
  - **Documentação**: Adicionada seção específica em
    `docs/features/admin-system.md` documentando este comportamento crítico
  - **Data**: 2025-12-12

### Security 🔐

- **RLS nas unidades físicas (`equipment_units`)**: RLS habilitado com políticas
  explícitas para corrigir alerta `rls_disabled_in_public`.
  - Leitura liberada para `authenticated` e `service_role`
  - Escrita (INSERT/UPDATE/DELETE) restrita a usuários com `role = 'ADMIN'`
  - `FORCE ROW LEVEL SECURITY` aplicado para evitar bypass
  - **Arquivos Criados**:
    - `prisma/migrations/20251215_enable_rls_equipment_units.sql`
  - **Documentação**: `docs/architecture/security.md` atualizada com o escopo

### Removed ❌

- Arquivos `ORCAMENTO_E_PROGRESSO.md` e `PRISMA_REGENERATE_REQUIRED.md`
  removidos da raiz; documentação consolidada em
  `docs/internal/orcamento-e-progresso.md` e
  `docs/internal/prisma-client-regeneration.md`
  - **Data**: 2025-12-15

### Added ✨

- **Otimização de Performance do Banco de Dados (Supabase)**: Adicionados
  índices em foreign keys não indexadas na tabela `quotes`
  - **Problema Identificado**: Supabase Database Linter detectou 2 foreign keys
    sem índices (`quotes_approvedBy_fkey` e `quotes_rejectedBy_fkey`) causando
    suboptimal query performance
  - **Solução**: Criados índices `quotes_approvedBy_idx` e
    `quotes_rejectedBy_idx` para otimizar JOINs e filtros
  - **Impacto**: Melhoria significativa na performance de queries envolvendo
    aprovação/rejeição de orçamentos
  - **Arquivos Criados**:
    - `prisma/migrations/20251208_fix_supabase_performance_issues.sql`
    - `scripts/execute-supabase-performance-fix.js`
    - `docs/guides/supabase-performance-analysis-december-2025.md`
  - **Arquivos Modificados**: `prisma/schema.prisma`, `package.json`
  - **Comando**: `pnpm migrate:supabase-performance`
  - **Data**: 2025-12-08
- **Geração de contrato para locações (Admin)**: endpoint dedicado para
  criar/atualizar contrato vinculado à locação e ação no modal de detalhes para
  emitir/atualizar contrato.
  - **Arquivos Criados**: `app/api/admin/rentals/[id]/contract/route.ts`,
    `docs/features/contracts.md`
  - **Arquivos Modificados**: `app/api/admin/rentals/route.ts`,
    `app/admin/rentals/page.tsx`
  - **Data**: 2025-12-12

### Fixed 🛠️

- **Layout em coluna única nos filtros de Orçamentos (Admin) no tablet/`md`**:
  Em resoluções `md`, os filtros/ações ficam em **coluna única** (stack
  vertical) para evitar compactação; em `lg+` o layout volta a ficar **inline**.
  - **Arquivos Modificados**: `components/admin/admin-filter-card.tsx`,
    `app/admin/orcamentos/page.tsx`
  - **Data**: 2025-12-12

- **Direcao da animacao da tabela de Orcamentos (Admin)**: Linhas agora entram
  da esquerda para a direita e saem levemente para a direita, evitando a
  percepcao de slide invertido ao mudar filtros.
  - **Arquivos Modificados**: `app/admin/orcamentos/page.tsx`
  - **Data**: 2025-12-12

- **Toggle de visualização (Kanban/Tabela) nos filtros de Orçamentos (Admin)**:
  Ajustado wrapper para manter o visual flat e alinhar com os outros controles
  do filtro (mesma **altura `h-10`** e **border radius `rounded-md`** no `lg+`).
  - **Arquivos Modificados**: `app/admin/orcamentos/page.tsx`
  - **Data**: 2025-12-12

- **Animação da tabela e Kanban de Orçamentos ao aplicar filtros (Admin)**:
  Corrigido flick/flash e entrada “bruta” sem animação; agora os itens **saem um
  a um de cima para baixo** e **entram um a um de cima para baixo** (sequência
  determinística com `AnimatePresence` `mode="wait"` + transição em duas fases).
  - **Modo Tabela**: linhas animam sequencialmente de cima para baixo
  - **Modo Kanban**: cards em cada coluna animam independentemente, de cima para
    baixo
  - **Ajuste fino**: animação levemente mais lenta para transição mais suave
  - **Ajuste fino (Kanban)**: entrada agora vem da esquerda para a direita
  - **Correção (Kanban)**: evita loop `Maximum update depth exceeded` ao aplicar
    filtros
  - **Arquivos Modificados**: `app/admin/orcamentos/page.tsx`,
    `components/admin/kanban-pipeline.tsx`, `docs/issues/known-issues.md`
  - **Data**: 2025-12-12

- **Posicionamento de toasts no Admin**: Ajustado offset do Sonner para o
  domínio administrativo, mantendo o comportamento das páginas públicas (toast
  abaixo do header).

- **Warning de Depreciação do Zustand (Vercel Analytics/Speed Insights)**:
  Melhorada supressão do warning `[DEPRECATED] Default export is deprecated` no
  console do navegador com solução em duas camadas
  - **Problema**: Múltiplos warnings apareciam no console devido a dependências
    externas da Vercel (`@vercel/analytics` e `@vercel/speed-insights`) que
    ainda usam sintaxe antiga do Zustand internamente
  - **Causa Raiz**: Dependências da Vercel ainda utilizam
    `import zustand from 'zustand'` em vez de `import { create } from 'zustand'`
  - **Solução Melhorada**: Implementada interceptação em duas camadas:
    1. Script inline no `<head>` do `layout.tsx` para interceptação precoce
       (antes do React hidratar)
    2. `useEffect` no `ClientLayout.tsx` para garantir cobertura de warnings
       assíncronos
    - Verificação robusta com múltiplas variações da mensagem de warning
    - Também intercepta `console.error` caso o warning seja emitido como erro
  - **Nota**: O código do projeto está correto (`stores/useCartStore.ts` usa
    sintaxe moderna). Aguardando atualização da Vercel para resolução definitiva
  - **Arquivos Modificados**: `app/layout.tsx`, `app/ClientLayout.tsx`,
    `docs/issues/known-issues.md`
  - **Data**: 2025-01-XX

- **Erros SVG motion.path no console**: Corrigido erro
  `Error: <path> attribute d: Expected moveto path command ('M' or 'm'), "undefined"`
  que aparecia no console durante renderização de animações de ondas
  - **Problema**: `motion.path` do Framer Motion estava renderizando com
    atributo `d` undefined durante hidratação SSR/CSR ou transições de estado
  - **Causa Raiz**: Falta de estado inicial explícito (`initial` prop) nos
    `motion.path` das animações de ondas no Hero e Hero Carousel Preview
  - **Solução**: Adicionada prop `initial` com valor explícito de `d` em todos
    os `motion.path` para garantir estado válido desde a primeira renderização
  - **Arquivos Modificados**: `components/hero.tsx`,
    `components/admin/hero-carousel-preview.tsx`
  - **Data**: 2025-12-05

- **Storybook build quebrando em `pnpm build-storybook`**: Resolvido erro
  `Rollup failed to resolve import "@storybook/blocks"` que bloqueava o build do
  Storybook 10.1.x
  - **Causa Raiz**: pacote `@storybook/blocks` não vinha instalado por padrão,
    mas é requerido pelos arquivos MDX (`Meta/Canvas/Controls`)
  - **Solução**: Pinar devDependency `@storybook/blocks@9.0.0-alpha.17` e
    atualizar guias `docs/guides/storybook*.md` com a dependência obrigatória
  - **Resultado**: `pnpm build-storybook` finaliza com sucesso (avisos esperados
    de `use client` gerados pelo Vite ao empacotar componentes Next)
  - **Data**: 2025-12-05

- **CI/CD Pipeline - pnpm install Failure Resolvido**: Corrigido erro crítico
  que causava falha no step "Install dependencies" do GitHub Actions
  - **Problema**: `pnpm install --frozen-lockfile` falhava com exit code 1
  - **Causa Raiz**: Script `postinstall` executava `prisma generate` sem
    `DATABASE_URL` disponível
  - **Solução Aplicada**: Adicionadas variáveis de ambiente dummy no step de
    install
    - `DATABASE_URL`: postgresql://dummy:dummy@localhost:5432/dummy
    - `NEXTAUTH_SECRET`: dummy-secret-for-ci
    - `NEXTAUTH_URL`: http://localhost:3000
  - **Arquivos Modificados**:
    - `.github/workflows/ci.yml`: Env vars no step "Install dependencies"
    - `.github/workflows/test.yml`: Env vars em ambos os jobs (test e
      storybook-build)
  - **Resultado**: CI/CD pipeline agora executa com sucesso, postinstall
    funciona corretamente
  - **Data**: 2025-12-05
  - **Commit**: 9ddad8a4

- **Crash ao ler `icon` em categorias**: Sanitizada a lista de categorias antes
  de mapear ícones (`components/categories.tsx` e
  `components/equipment-showcase-section.tsx`) para evitar acesso a entradas
  indefinidas retornadas pela API; previne
  `Cannot read properties of undefined (reading 'icon')`.
- **Imagens do Supabase não carregavam localmente**: `next.config.mjs` agora
  inclui o host do `NEXT_PUBLIC_SUPABASE_URL` em `images.remotePatterns`,
  liberando o carregamento de assets do storage Supabase em desenvolvimento.

### Changed 🔄

- **Índices para FKs + PK em verificationtokens (Prisma + Supabase)**: Cobertura
  completa dos FKs sinalizados pelo Performance Advisor e PK composta em
  `verificationtokens`
  - **Schema Prisma**: Adicionados `@@index` em `accounts.userId`,
    `addresses.userId`, `cart_items.equipmentId`, `equipments.categoryId`,
    `quote_items.quoteId`/`equipmentId`, `quotes.userId`,
    `rental_items.rentalid`/`equipmentid`, `rentals.userid`, `sessions.userId`,
    além de `@@id([identifier, token])` em `verificationtokens`
  - **Migration SQL**:
    `prisma/migrations/20251205_add_fk_indexes_and_verificationtokens_pk.sql`
    (usa `CREATE INDEX IF NOT EXISTS` + cria PK se ausente)
  - **Duplicate index fix**:
    `prisma/migrations/20251205_drop_verificationtokens_unique.sql` remove a
    constraint `verificationtokens_identifier_token_key`, já coberta pela PK
  - **Notas**: Em produção, prefira `CREATE INDEX CONCURRENTLY` se executar
    manualmente para evitar locks; reexecute o Performance Advisor após aplicar
  - **Data**: 2025-12-05

- **Evitar flash de "Sign In/Log In" no header durante carregamento de sessao**:
  Header agora so exibe links de login quando `status === 'unauthenticated'`,
  evitando mostrar estado deslogado enquanto a sessao carrega.
  - **Arquivo Modificado**: `components/header.tsx`
  - **Data**: 2025-12-28

### Added ?

rega.

- **Arquivo Modificado**: `components/header.tsx`
- **Data**: 2025-12-28

### Added ?
