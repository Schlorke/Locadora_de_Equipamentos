# Configurações da GB para o corte (site da GB sem os padrões do código)

Estado em 2026-10-07, ondas 132 (achado 143), 133 (achado 147) e 134 (lote
vitrine-conteúdo, partes A e B), sem commit. Procedimento de referência para o
corte da GB (Lote 12 da ADR `docs/architecture/adr-tenant-hosts.md`), não uma
autorização para escrever em produção: o `--apply` só roda com aprovação do dono
da GB, no banco e no momento que ele aprovar.

## Por que existe

Até a onda 131 o frontend completava a vitrine com os dados reais da GB quando a
locadora não os tinha nas configurações: nome, endereço, texto do rodapé,
Facebook e Instagram, horário, CNPJ, WhatsApp do botão flutuante e do orçamento,
e o JSON-LD. Qualquer locadora sem configurações completas mostrava esses dados
(T12 da ADR de hosts). A onda 132 tirou os padrões do código: cada locadora
mostra só o que está no cartão público (nome, cidade, UF, logo) e nas
configurações públicas dela; o que falta fica de fora.

A GB dependia desses padrões. Para o site dela não mudar, os mesmos valores
precisam estar gravados nas configurações (`settings`) da organização da GB.

## O que o script faz

`tools/gb-site-settings.mjs`:

- Lê a organização pelo slug e confere, sem alterar, se o nome é `GB Locações`
  (o nome do cartão aparece no cabeçalho, no rodapé e no título) e se o CNPJ que
  a vitrine mostra é o da GB: o normalizado do cadastro da plataforma
  (`documentNormalized`) e, sem ele, o legado (`document`), a mesma ordem da
  identificação legal da leitura pública.
- Trava do `--apply`: só grava na organização com o CNPJ da GB. Com outro CNPJ
  ou sem CNPJ cadastrado, sai com `GB_SETTINGS_ORGANIZATION_MISMATCH` antes de
  abrir a transação, sem escrever nada. Um slug errado gravaria o endereço, os
  telefones, o e-mail e as redes da GB no site de outro dono, que é o próprio
  defeito do achado 143. A simulação já mostra `"blocked": true` nesses casos. O
  nome diferente não trava (é dado da própria locadora), mas muda o cabeçalho e
  o rodapé: tratar no passo 2.
- Planeja o preenchimento só dos campos vazios: `companyAddress`, `aboutUsText`,
  `companyPhone`, `whatsappNumber`, `contactEmail`, `socialLinks.facebook`,
  `socialLinks.instagram` (as outras redes ficam) e `businessHours` (horário de
  segunda a sexta 8h às 18h e sábado 8h às 12h). Desde a onda 133 a vitrine lê
  esse horário na leitura pública das configurações (`GET /api/settings/public`,
  campo `businessHours`) e o mostra no rodapé, no contato da home e na página de
  contato.
- Onda 134 (decisões do dono de 2026-10-06 e 2026-10-07): o conteúdo
  institucional da GB (`settings.siteContent`, dados em
  `tools/gb-site-content.mjs`): anos de mercado, clientes, projetos, cidades,
  construtoras clientes, história, linha do tempo, destaques do rodapé, os 11
  compromissos comerciais ligados (D-E), o local da loja no mapa e o ID do
  Merchant Center. Chave a chave: só entra a chave ausente; nada do que o dono
  gravou muda (os compromissos são uma chave só: com os do dono gravados, nenhum
  da GB entra). Nunca a frota (D-B: o dono preenche no painel) nem a nota de
  avaliações (D-A: a GB não tem fonte); o relatório as lista em `pending`.
- Onda 135 (A11; decisão do dono D4 de 2026-10-08): a medição da GB no mesmo
  `siteContent`, uma vez por campo como o resto: o ID do Google Analytics 4
  (`G-5S49T61C7N`) e o do Google Ads (`AW-17933178077`), os padrões do código da
  produção `eb4c0098` (`app/layout.tsx:191,193`). Os códigos de verificação do
  Search Console e da Meta vinham do ambiente da produção
  (`GOOGLE_SITE_VERIFICATION` e `FACEBOOK_DOMAIN_VERIFICATION`), nunca do
  código: o script não os inventa e os lista em `pending` (D4).
- Onda 134: os três textos legais da GB (Termos, Privacidade e Devolução, os
  textos atuais, no formato do contrato
  `@gb-locacoes/contracts/storefront-legal`), só os não publicados
  (`legalDocuments`). Cada documento é gravado por escrita condicional (só onde
  ainda não há documento publicado) com a data da publicação e uma linha em
  `audit_logs` (`STOREFRONT_LEGAL_PUBLISHED`, sem usuário, com
  `changes.source = 'tools/gb-site-settings'`, o sha256 e o tamanho do JSON
  canônico; nunca o texto). Documento publicado pelo dono entre a leitura e a
  escrita fica (`legalDocumentsWritten` mostra o que foi gravado).
- Onda 134: antes de ler as configurações, a transação trava a organização
  (`SELECT … FOR UPDATE`, o mesmo lock do formulário e dos textos legais do
  painel). Mesmo assim, não edite o painel da GB durante o corte.
- Uma vez por campo (onda 134, segunda rodada): cada `--apply` grava em
  `audit_logs` uma linha `GB_SITE_SETTINGS_APPLIED` (sem usuário,
  `changes.source = 'tools/gb-site-settings'`) com os nomes dos campos que
  conferiu (`checked`: os que gravou e os que o dono já tinha) e dos que gravou
  (`written`), nunca os valores. Uma execução seguinte lê essa auditoria e não
  volta a nenhum desses campos, nem ao texto legal com publicação ou
  despublicação registrada (`STOREFRONT_LEGAL_PUBLISHED` ou
  `STOREFRONT_LEGAL_UNPUBLISHED`, do painel ou do script). O que o dono apagar,
  desligar ou retirar no painel depois do corte fica como ele deixou: o script
  não religa compromisso desligado, não regrava chave apagada e não republica
  texto despublicado. Só um campo novo dos dados da GB, nunca conferido, entra
  numa execução seguinte.
- Nunca sobrescreve valor gravado pelo dono; repetir não muda nada
  (idempotente), mesmo depois de o dono mudar o painel.
- Simulação por padrão. `--apply` grava numa transação com o contexto da
  locadora (`app.tenant_id`), sob a RLS de `settings`; sem linha de
  configurações, cria uma.
- Imprime uma linha JSON com os nomes dos campos e a ação, nunca a URL do banco,
  segredo ou valor gravado pelo dono. Erro sai como código
  (`GB_SETTINGS_ORGANIZATION_NOT_FOUND`, `GB_SETTINGS_ORGANIZATION_MISMATCH`,
  `GB_SETTINGS_UNAVAILABLE`…).

## Procedimento

1. Confirmar com o dono da GB o slug da organização, o banco (produção ou
   staging) e a janela. Não copiar a URL do banco para logs ou documentos.
2. Simular:

   ```bash
   DATABASE_URL=<url-do-banco> node tools/gb-site-settings.mjs --slug=<slug-da-gb>
   ```

   Conferir `organization.nameMatches`, `organization.documentMatches` e
   `blocked`. Com `blocked: true`, o slug não é o da GB, ou a organização da GB
   está sem o CNPJ: parar e conferir com o dono. O CNPJ entra pelo fluxo da
   plataforma; o script não altera a organização. Nome diferente muda o
   cabeçalho e o rodapé da GB: corrigir pelo mesmo fluxo, com o dono, antes do
   corte. Conferir `fields`: são os campos que o site mostrava pelo padrão do
   código. Se `companyPhone` ou `contactEmail` estiverem na lista, o topo e o
   rodapé passam a mostrá-los (antes só o JSON-LD tinha o padrão): confirmar com
   o dono. Se `companyAddress` estiver na lista, o cartão "Endereço" da página
   de contato também passa a mostrar o endereço (antes ele ficava sem a linha do
   endereço, porque o padrão do código só valia no rodapé).

3. Com a aprovação do dono, aplicar:

   ```bash
   DATABASE_URL=<url-do-banco> node tools/gb-site-settings.mjs --slug=<slug-da-gb> --apply
   ```

   Saída esperada: `"applied": true` com os mesmos `fields`, `siteContentKeys` e
   `legalDocuments` da simulação e `legalDocumentsWritten` igual a
   `legalDocuments`.

4. Rodar de novo com `--apply`: `"upToDate": true`, `"fields": []` e
   `"legalDocuments": []`. A partir daqui o painel é do dono: o script pode
   rodar de novo (por exemplo, depois de uma versão nova dos dados da GB) sem
   desfazer nada do que ele mudou, porque só confere campo que nunca conferiu.
5. Conferir o site da GB no host dela: nome e sigla no cabeçalho e no rodapé,
   endereço, texto, Facebook e Instagram no rodapé, botão do WhatsApp, horário
   ("Seg-Sex: 8h às 18h", "Sáb: 8h às 12h") e "CNPJ: 34.780.330/0001-69" no
   rodapé, o cartão "Horário de Funcionamento" com o CNPJ no contato da home e o
   horário ("Segunda a Sexta: 8h às 18h"; "Sábado: 8h às 12h • Domingo:
   Fechado") na página de contato. Comparar com a captura anterior ao corte.
   Conferência por HTTP: `GET /api/settings/public?tenantSlug=<slug-da-gb>` traz
   `businessHours` com os sete dias, `legalIdentity.cnpj` igual a
   `34.780.330/0001-69`, `siteContent` com as chaves gravadas e `legalDocuments`
   com os três `true`;
   `GET /api/settings/public/legal-documents/{terms|privacy|return-policy}?tenantSlug=<slug-da-gb>`
   traz cada documento. Conferir também (vitrine da onda 134, parte B): o
   subtítulo "Há 10 anos…" e o selo "10+ Anos de Experiência" do hero; os
   cartões "Parceira de Grandes Construtoras" e "10 Anos de Experiência" de "Por
   que escolher"; os números, a história, a Nossa Jornada, os selos e o selo do
   Google na Sobre; os números do topo do contato e o cartão "Onde estamos" com
   o mapa; a coluna "Equipamentos" e os links legais do rodapé; o topo, o
   "incluído" e o "Por que escolher" do detalhe; e Termos, Privacidade e
   Devolução com o texto e a data de antes. Os selos de frota ("+200
   Equipamentos Disponíveis" no hero e na Sobre) só aparecem depois do passo 6.
6. Com o dono, no painel: preencher a frota (D-B) e, se houver fonte, a nota de
   avaliações com o link (D-A). Na seção "SEO & Meta Tags", os códigos de
   verificação do Search Console e da Meta (os valores de
   `GOOGLE_SITE_VERIFICATION` e `FACEBOOK_DOMAIN_VERIFICATION` do projeto da
   produção), ou a verificação pelo DNS do domínio novo (D4). Só então o tráfego
   da GB vai para o host novo (ordem do corte: `prisma migrate deploy`,
   simulação, `--apply`, painel, troca de tráfego).

## O que ainda não volta só com o script (bloqueia o corte)

Desde a onda 134 (partes A e B) a vitrine mostra o conteúdo institucional, os
compromissos e os textos legais que o script grava. Ficam diferentes do site
atual até o passo 6 ou até a decisão do dono:

- Frota (D-B): o script não grava. Sem ela, o hero e a Sobre ficam sem os selos
  "+200 Equipamentos Disponíveis" e o número de frota sai da Sobre e do topo do
  contato. A produção mostrava 200 no hero e na Sobre e "50+" no contato; o dono
  preenche um número só no painel ("Equipamentos na frota"). A linha de base
  visual (`tests/visual`) captura a GB assim, sem frota, com essas diferenças
  aprovadas com o motivo D-B (`tests/visual/approved-changes.json`); a Sobre,
  fora da captura, tem a prova de texto em
  `tests/unit/gb-site-content.textos.test.tsx`.
- Nota de avaliações (D-A): "4.8 (127 avaliações)" do detalhe não volta sem a
  fonte; a linha só aparece com a nota, a quantidade, o nome e o link da fonte
  preenchidos no painel, e nunca entra no JSON-LD (`aggregateRating`).
- Frete do orçamento (P-1): a estimativa mostra "Transportadora GB" e usa o CEP
  de origem da GB para qualquer locadora; frete por locadora fica para um lote
  próprio.
- Verificação do Search Console e da Meta (D4): sem os códigos no painel (ou a
  verificação pelo DNS), as metas não saem no site novo.

O que volta igual com o script e o cartão da GB: o nome e a sigla no cabeçalho e
no rodapé; o texto, o endereço, o telefone, o WhatsApp, o e-mail, o Facebook e o
Instagram; o copyright "© 2024 GB Locações"; a região de atendimento ("Porto
Alegre" e "RS" vêm da cidade e da UF do cartão da GB); e, desde a onda 133, o
horário de funcionamento (do `businessHours` que o script grava) e o CNPJ no
rodapé, no contato da home e na página de contato.

O CNPJ vem da organização (`documentNormalized` ou, sem ele, `document`), não
das configurações: é o mesmo documento, na mesma ordem, que a trava do `--apply`
confere (`organization.documentMatches`). Trava verde implica a linha "CNPJ:
34.780.330/0001-69" no site; a GB sem o CNPJ cadastrado fica travada e também
sem a linha do CNPJ. Com o normalizado preenchido e diferente do da GB, a trava
recusa mesmo que o legado seja o da GB (a vitrine mostraria o normalizado):
conferir o cadastro com o dono. O nome empresarial (`organizations.legalName`)
entra na mesma linha quando é diferente do nome do cartão ("<nome empresarial> ·
CNPJ: …"); a produção mostrava só "CNPJ: 34.780.330/0001-69". Antes do corte,
conferir com o dono o nome empresarial gravado na organização da GB: vazio ou
igual a "GB Locações" mantém a linha da produção; outro valor muda a linha (é o
nome empresarial que o Decreto 7.962/2013, art. 2º, I, pede). O script não lê
nem altera esse campo.

O corte da GB (Lote 12) só acontece depois da decisão sobre esses pontos, ou com
o aceite do dono para cada diferença da lista.

## Validação

- `tests/unit/gb-site-settings.test.ts`: argumentos, plano (só campos vazios,
  redes do dono preservadas), CLI sem URL nem segredo na saída e, no banco
  descartável (`TEST_DATABASE_URL`, `TEST_DATABASE_DISPOSABLE=true`), simulação
  sem escrita, criação com um papel restrito sem `BYPASSRLS`, segunda execução
  sem mudança e preservação do que o dono gravou. A trava do `--apply` também é
  testada: numa locadora com outro CNPJ e na GB sem CNPJ, a simulação mostra
  `blocked: true`, e o `--apply` sai com `GB_SETTINGS_ORGANIZATION_MISMATCH` sem
  criar configurações. Fora do banco, o teste prova que a transação nem chega a
  abrir. A trava confere o CNPJ que a vitrine mostra: o teste compara
  `checkGbOrganization` com `publicLegalIdentity` do `packages/backend` (legado
  da GB com normalizado de outra empresa trava; normalizado da GB passa; máscara
  aceita; caractere a mais trava).
- Onda 134, no mesmo arquivo: plano do conteúdo chave a chave (o do dono fica),
  frota e nota nunca gravadas e listadas em `pending`, o lock `FOR UPDATE` antes
  da leitura (ordem das consultas), a escrita condicional dos documentos (o
  preenchido depois da leitura fica, sem auditoria), a auditoria com o mesmo
  hash do painel (`storefrontLegalDigest`) e, no banco, os três documentos, as
  três linhas de `audit_logs` e a linha da execução gravados pelo papel
  restrito. O papel do teste recebe `UPDATE ("updatedAt")` em `organizations` (o
  `FOR UPDATE` exige) e `SELECT` e `INSERT` em `audit_logs` (a leitura do que já
  foi conferido, sob a RLS da locadora); o `app_runtime` já tem os três.
- Onda 134, segunda rodada, no mesmo arquivo: uma vez por campo. O plano ignora
  o que a auditoria marca como conferido (`handledGbFields`), só a chave nova
  entra, e linha de outra origem ou ação não conta. No banco, depois do
  `--apply`, o dono desliga os compromissos, apaga os anos e o texto do rodapé e
  retira a Privacidade; a simulação e o `--apply` de novo saem `upToDate` e a
  linha de configurações fica igual. Antes, a segunda execução religava os 11
  compromissos, regravava as chaves e republicava a Privacidade.
- Onda 134, parte B: `tests/unit/gb-site-content.textos.test.tsx` (hero, "Por
  que escolher", contato, detalhe e Sobre com os dados da GB iguais aos textos
  de `55763c1e`, menos a frota no contato, D-B, e a nota, D-A; a Sobre igual
  byte a byte à marcação de antes), `tests/unit/gb-site-content.painel.test.ts`
  (o que o script grava abre no painel e volta igual ao salvar) e
  `tests/unit/paginas-legais.characterization.test.tsx` mais os
  `*.native.test.tsx` das três páginas (as páginas com os documentos da GB
  iguais às de antes, na web e no app).
- `tests/unit/gb-site-content.test.ts`: os dados da GB passam pelos esquemas do
  contrato sem mudar nenhum valor; Privacidade e Devolução são, seção a seção,
  as árvores das páginas de antes da troca
  (`tests/unit/__fixtures__/paginas-legais/`); cada texto dos Termos está na
  página de antes; a sintaxe leve do editor vai e volta igual em todas as
  seções; e os valores batem com os goldens de texto das telas de `55763c1e`
  (`tests/unit/__fixtures__/vitrine-gb/`).
