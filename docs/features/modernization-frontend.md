# Modernização do frontend compartilhado

> **Status**: Critical — migração em andamento  
> **Last updated**: 2026-09-25

## 1. Purpose

Executar o produto pelos hosts Next.js e Expo usando o frontend FSD e o design
system existentes. Preservar a identidade visual web e substituir adaptações
nativas que ainda renderizavam HTML por componentes React Native reais.

## 2. Scope

Inclui fronteiras RSC, transporte de configurações, injeção de consulta CEP,
navegação nativa, modelos compartilhados de autenticação e adapters dos hosts. A
conclusão desta etapa não comprova paridade de todas as telas, publicação,
migração de dados ou execução em iOS.

## 3. Entry Points

- Hosts: `apps/clients/web/src/app` e `apps/clients/mobile/src/app`.
- Providers: `packages/frontend/src/app`.
- Autenticação: páginas `login`, `entrar`, `cadastro`, `recuperar-senha`,
  `reset-password`.
- Configurações: `packages/frontend/src/pages/configuracoes`,
  `GET/PUT /api/admin/settings`.
- Consulta CEP: `packages/ui/src/contract/address-form.ts`, injetada pelo
  consumidor de orçamento.

## 4. Core Flow

1. O host injeta transporte HTTP e navegação em AppProviders.
2. O frontend acessa settings pela API autenticada, sem importar ações do host.
3. O servidor verifica administrador, origem de atualização e schema antes de
   reutilizar as ações existentes.
4. Web e native usam os mesmos modelos de credenciais/cadastro/recuperação;
   apenas o renderer muda.
5. O host traduz sessão/OAuth e URLs para a plataforma.

## 5. Components and Files

- `shared/api/http-client.ts`: base URL, cookies/cabeçalhos, erros HTTP e
  injeção de fetch.
- `features/entrar/model/use-credentials-sign-in.ts`: sessão, validação, estado
  de envio e redirecionamento delegado.
- `pages/*/model`: modelos compartilhados das telas de autenticação.
- `packages/ui/src/contract/navigation.tsx`: navegação injetada.
- `packages/ui/src/{web,native}/AddressForm.*`: mesmo contrato de campos e
  lookup.
- `apps/clients/*/src/host/auth`: adapters de plataforma.

## 6. Data and State

O cliente não importa Prisma ou ações do servidor. Configurações usam o envelope
existente success/data/error. Cadastro mantém nome, email, senha, telefone, CPF
ou CNPJ e CEP opcional. Recuperação mantém os endpoints existentes durante a
coexistência de autenticação.

O host mobile exige EXPO_PUBLIC_API_URL, sem incluir segredos.

Na onda 44 (2026-10-02, sem commit), o tsconfig mobile deixou de incluir o
arquivo de augmentação NextAuth da raiz. Nenhum consumidor nativo usa essa
augmentação; sua importação do barrel backend/identity carregava o runtime de
servidor no programa TypeScript e conflitava com o AbortSignal nativo. O
programa mobile agora inclui src e suas dependências reais, sem arquivos de
packages/backend. A checagem mobile e a do frontend nativo passaram; as
augmentações dos hosts servidores continuam preservadas. Não houve mudança do
adapter de sessão, cookies ou modo de autenticação. NEXT_PUBLIC_AUTH_MODE e
EXPO_PUBLIC_AUTH_MODE selecionam explicitamente legacy, better-auth-v2 ou
better-auth. O segundo usa /api/auth/v2, o terceiro /api/auth. O backend deve
habilitar o modo correspondente. Nenhuma falha provoca troca automática de
motor.

## 7. Constraints and Edge Cases

- Credenciais vazias e senhas incompatíveis não enviam HTTP.
- A configuração HTTP impede caminhos externos/protocol-relative no parâmetro
  path.
- A sessão Better Auth nativa usa Expo/SecureStore; requests de domínio recebem
  o cookie pelo adapter com credentials omit.
- OAuth nativo requer Better Auth/Expo configurado. O modo legado oferece
  credenciais; os botões OAuth nativos só aparecem com o adapter compatível.
- A configuração de scheme/deep links deve corresponder à lista confiável do
  backend.
- O callback e o token de recuperação são tratados pelo host.
- Não alterar hero, modelos 3D, assets nem regras de sincronização do carrossel.

## 8. Error Handling

Erros HTTP mantêm status e mensagem; o formulário libera loading e apresenta a
negativa. Falha de CEP nativo mantém campos editáveis e informa preenchimento
manual. Uma sessão indisponível não bloqueia nova tentativa de credenciais. A
rota de configurações devolve 401/403, 400 para entrada inválida e no-store nas
respostas de dados.

## 9. Performance and Accessibility

Inputs nativos mascaram senhas e configuram teclado de email. Botões/links têm
papéis acessíveis e eventos concretos. As páginas web conservam seu JSX visual.
Avaliação de bundle, leitores de tela, teclado e fidelidade visual exige
evidências separadas.

## 10. Tests and Validation

- Testes de transporte e settings: host injetado, status de recusa, schema,
  auth, origem, leitura e atualização.
- Teste de interação CEP web com serviço injetado.
- Testes comportamentais de credenciais, cadastro e redefinição, sem banco/rede.
- Typechecks separados: frontend, UI web/native, host web/mobile.
- Gate obrigatório: `pnpm arch`.

Antes de declarar equivalência de produto, validar Android e iOS: inicialização
sem DOM, navegação/back, login/saída/expiração, cadastro/recuperação,
catálogo/detalhes, orçamento/carrinho, área do cliente e fluxos administrativos.
Bundle/export não prova execução no dispositivo.

## 11. Related Docs

- `docs/features/admin-system.md`
- `docs/features/address-management.md`
- `docs/features/design-system.md`
- `docs/features/equipment-3d-carousel.md`

## 12. Change Log

- 2026-09-25: fronteiras RSC e aliases, settings por HTTP, fundamentos nativos e
  extração de modelos de autenticação. Data de trabalho; não representa commit
  ou deploy.

## 13. Escopo por locadora e migração dos fundamentos

As configurações públicas exigem tenantSlug explícito. Ausência de seleção não
consulta a API nem preenche telefone, e-mail ou endereço de outra empresa.
Respostas tardias da locadora anterior são descartadas e campos nulos são
tratados como não configurados. GET público sem configuração retorna estado
indisponível, sem criar registro. Configurações administrativas usam
membership/permissão SETTINGS e transação com tenantId; o DTO exclui senha SMTP,
usuário SMTP e segredo reCAPTCHA. A atualização normal não aceita novas
credenciais em JSON público.

Catálogo e contato compartilham modelos entre web/native. Contato envia
tenantSlug e distingue registro recebido de notificação na fila.
Emissão/regeneração e troca de vencimento de boleto aceitas com HTTP 202
permanecem pendentes; a UI não promete PDF pronto nem substitui o vencimento
confirmado por um campo ausente.

Documentos legais compartilham conteúdo canônico e renderizadores; os textos
jurídicos e comerciais legados ainda precisam revisão/configuração de marca por
locadora. A extração não autoriza reutilizar automaticamente termos GB para
outra empresa. Hero, modelos 3D e sincronização inicial não foram alterados.

O gate arquitetural agora acompanha imports transitivos e inventário legado
explícito. Veja docs/architecture/adr-runtime-boundaries.md. Typecheck nativo
amplo passou; o primeiro export Expo Android/iOS também passou (artefatos
locais, sem instalação ou validação em aparelho). A compilação Next continua
sendo validada separadamente para RSC. A execução ampla da suíte revelou
receitas ausentes no catálogo DS, tratadas como trabalho pendente real.

Seleção de locadora e bootstrap de sessão serão ligados ao contrato
/api/auth/organizations e /api/auth/organizations/selection, sempre sem primeira
opção automática. Ainda não há certificação de equivalência integral de produto
web/Android/iOS.

## 14. Modo host e portão da área privada (2026-09-26, commit `da19f601`)

- `usePublicTenantRouting({ mode: 'host', pathname, tenantSlug })`: slug fixo do
  host, hrefs sem `?tenantSlug=`, sem storage e com `internalRoutePrefix`. O
  modo legado (sem `mode`) não mudou.
- `useVisiblePathname` (`shared/lib/navigation`) é o único leitor de
  `usePathname` em `packages/frontend`; a regra de lint é erro. Os seis widgets
  que ficaram em aviso migraram na onda 3 (seção 15).
- `PrivateAreaGate` (`@gb-locacoes/frontend/app`): o `RuntimeBootstrap` não
  troca mais os filhos; o portão fica por tela (mobile, `screenLayout` do
  `<Stack/>`) ou dentro do `ClientLayoutShell` (web). Regra: nunca trocar nem
  reposicionar `children` do provider raiz no native.
- `callbackUrl` passa por `safeInternalCallback`; "Solicitar Orçamento" espera a
  sessão resolver.
- Detalhes, pendências e testes: `docs/features/tenant-hosts-web.md` e entradas
  161 a 163 de `docs/issues/known-issues.md`.

## 15. Onda 3 (2026-09-26, commit `be859915`)

- **Área do cliente em modo host**: `RuntimeBootstrap` com `tenantMode`
  `'selection' | 'host'`; no modo host usa `/api/auth/organizations/current`,
  sem seletor, e manda para `/vincular` quando falta vínculo. Ver
  `docs/features/tenant-client-enrollment.md`.
- **Caminho visível**: `Cabecalho`, `Busca`, `AreaCliente`, `BarraMobile`,
  `BarraLateral` e `BarraLateralMobile` usam `useVisiblePathname`;
  `EquipamentosPage.native.tsx` monta links pelo resolvedor de href (entrada 185
  de `docs/issues/known-issues.md`).
- **Sanitização por plataforma**: `shared/lib/sanitize-contract.ts` (contrato),
  `sanitize.web.ts` (DOMPurify) e `sanitize.native.ts` (texto puro para
  `<Text>`, nunca HTML). `sanitize.ts` só reexporta o web (entrada 184).
- **CSS em camadas e sem `!important`**: regras e arquivos em
  `docs/features/design-system.md` (seção "Arquitetura do CSS", que substituiu a
  seção "CSS da modernização" na onda 4).
- **Nomes de teste**: todo teste colocado aninha sob o arquivo que testa
  (`pnpm check:test-names`); por exemplo, os 23 `contrato.migracao.test.ts`
  viraram `index.contract.test.ts` e os testes de `app/providers` passaram a
  `RuntimeBootstrap.*`, `SessionProviderWrapper.web` e
  `public-tenant-routing.host-mode.web`.

## 16. Onda 4 (2026-09-26, commit `4b02f52f`)

- **Portão no web**: toda rota da área do cliente ou com `awaitSession` espera o
  escopo do carrinho (`scopeReady`) em qualquer transição; a exceção da tela que
  continua aberta (`keepsOpenScreen`) é só do mobile. Antes, `/orcamento`
  montava com o carrinho da locadora anterior (entrada 193 de
  `docs/issues/known-issues.md`).
- **`callbackUrl`**: `safeInternalCallback` também recusa segmentos de ponto e
  codificação dupla (`/.//evil.test`, `%252e`) (entrada 162).
- **Layout mobile testado de verdade**:
  `apps/clients/mobile/src/app/_layout.test.tsx` monta o `_layout.tsx` real com
  o `StackRouter` do expo-router e substitui o teste que copiava a lógica do
  host; o `metro.config.js` bloqueia testes em `src/app` para o expo-router não
  os tratar como tela (entrada 161).
- **ESLint**: o bloco de exceção em aviso de `usePathname` saiu; importar
  `usePathname` fora de `shared/lib/navigation/use-visible-pathname.web.ts` é
  erro em todo o `packages/frontend`.
- **Login**: o `LoginPage` ganhou a prop `allowSignUp` (padrão `true`, web e
  native); o login da equipe no host `app` passa `false`. `resolvePanelCallback`
  (`pages/login/model/panel-callback.ts`) prende o retorno a `/admin/**`
  (entrada 189).
- **CSS**: `!important` zerado, estilos de formulários, botões e gatilhos nos
  componentes de `packages/ui` e tokens CSS em `packages/design-tokens`
  (`docs/features/design-system.md`, seção "Arquitetura do CSS"; entradas 194 e
  195).

## 17. Onda 5 (2026-09-29, sem commit)

- **Carrinho por escopo**: a troca de escopo (visitante, locadora, usuário) não
  apaga mais o carrinho salvo do escopo anterior. Durante a troca o `persist`
  fica num armazenamento que não lê nem grava (`detachedStorage`); o nome novo e
  o armazenamento real voltam juntos só na troca mais recente, depois da
  leitura. Sair da conta deixa o carrinho salvo no escopo do usuário (entrada
  197 de `docs/issues/known-issues.md`).
- **"Entrar" com retorno**: o `PrivateAreaGate` leva a `/login` com
  `callbackUrl` = caminho visível (`refreshKey`) + query da URL no web (variante
  `app/providers/current-query.ts`/`.web.ts`/`.native.ts`), só se o
  `safeInternalCallback` a devolver sem mudar. O "Solicitar Orçamento" usa
  `signInHref` de `features/entrar`, com a mesma regra (entrada 198).
- **Páginas de conta com `shell`**: `LoginPage` (e `LoginPageFallback`),
  `RecuperarSenhaPage` e `ResetPasswordPage` recebem `shell` (`storefront`, o
  padrão, ou `platform`) no mesmo contrato web e native; o `ClientLayoutShell`
  ganhou a prop `chrome`, e o widget `widgets/casca-plataforma` é a barra da
  plataforma no host `app` (`docs/features/tenant-hosts-web.md`).
- **Seletor de locadora**: `TenantSelector.web.tsx` (barra compacta) e
  `TenantSelector.native.tsx` (bloco) atrás de `ui/contract.ts`
  (`docs/features/organization-selection.md`).
- **Revelação por rolagem**: o primeiro quadro dos elementos parados com
  movimento reduzido usa `motion-safe:` no JSX; `ScrollRevealInit` e
  `scrollRevealReady` não mudaram (entrada 201).
- **CSS**: cascata da produção restaurada, anel de foco laranja, X do diálogo
  pela modalidade de entrada e `Drawer` com a trava solta
  (`docs/features/design-system.md`; entradas 195 e 200).
