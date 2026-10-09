# Notas para o CEO – Google, Facebook e redes sociais (GB Locações)

Documento interno para alinhamento com o CEO sobre o que aparece no Google,
redes sociais e próximos passos.

---

## 1. Link oficial da página no Facebook

**URL oficial:** https://www.facebook.com/locacoesgb/

Este é o link correto da página da GB Locações no Facebook. O site e o
structured data (schema LocalBusiness) foram atualizados para usar esse link em
`sameAs`, para o Google e outros sistemas associarem corretamente a marca à
página.

---

## 2. Instagram – conta oficial

**URL oficial:** https://www.instagram.com/locacoes_gb/

A conta oficial da GB Locações no Instagram é **@locacoes_gb**.

**O que o Google mostra:** Nos resultados de busca (painel de conhecimento à
direita), o Google pode exibir uma seção **“Perfis”** com ícone do Instagram.
Isso não significa que alguém criou a conta por nós: o Google pode estar
inferindo um perfil a partir de menções, do domínio ou de dados de outras
fontes. É um comportamento comum quando a marca já tem presença (site, Facebook
etc.).

**O que fizemos no projeto:**

- O **Instagram foi removido** da lista `sameAs` no structured data do site
  (`lib/structured-data-utils.ts`), pois a conta oficial ainda não existe.
- Assim evitamos que o site aponte para um perfil que não é nosso ou que ainda
  não existe.

**Recomendação para o CEO:**

- Quando a conta oficial no Instagram for criada (ex.: @locacoesgb ou outro nome
  definido pela empresa), avisar para que o link seja adicionado de volta ao
  site (sameAs) e, se desejado, no footer e em outras páginas.
- Se no Google aparecer “Instagram” em Perfis antes da criação da conta, pode
  ser associação automática do Google; não é um link que colocamos no site nesse
  momento.

---

## 3. O “10+” nos resultados do Google – não é metadado de busca

**Pergunta:** O projeto colocou “10+” como metadado de pesquisa?

**Resposta:** **Não.** O “10+” não é um metadado de busca que tenhamos
configurado.

**De onde vem:**

- No site, a descrição oficial (meta description e textos) diz: **“Há 10 anos
  oferecendo soluções em locação de equipamentos para obras e serviços em
  altura…”**.
- Na homepage (Hero) e na página Sobre existe um **badge visual “10+”** (anos de
  experiência).
- O Google **extrai e interpreta** esse conteúdo: ele “vê” o número “10” e a
  ideia de “anos” no texto e pode exibir algo como “10+” ou “Há mais de 10 anos
  …” no snippet ou no painel.

Ou seja: o “10+” que aparece no Google vem do **conteúdo da página** (texto +
badge), não de um campo específico de metadado chamado “10+”. O algoritmo do
Google está apenas resumindo o que está escrito no site.

---

## 4. Por que a localização geográfica pode não aparecer no Google?

**Situação:** No painel de conhecimento (lado direito dos resultados), o Google
pode não mostrar endereço ou mapa, mesmo com telefones (51) visíveis.

**O que o site já envia (reforçado para geolocalização):**

- O projeto envia dados estruturados de **LocalBusiness** (schema.org),
  incluindo:
  - Endereço completo (rua, bairro, cidade, CEP, país)
  - Coordenadas (latitude/longitude)
  - **image** (logo/OG) e **hasMap** (link do Google Maps) para o Google
    associar o negócio ao mapa
  - Telefone, e-mail, área de atendimento, horário, links (site, Facebook,
    WhatsApp)
- O **endereço aparece sempre no site** (footer, página de contato, card de
  contato), mesmo quando não está preenchido no admin — assim o Google “vê” o
  endereço na página.

Arquivos: `lib/structured-data-utils.ts`, `components/structured-data.tsx`,
footer, `contact-section`, `contact-info-card`.

**Por que o Google pode não mostrar o endereço no painel (causas
identificadas):**

1. **Google Business Profile (GBP) é o principal motor do endereço no painel** O
   Google costuma puxar endereço e mapa do **Google Business Profile** (antigo
   “Meu Negócio”), não só do schema do site. Se o perfil não existir, não
   estiver verificado ou estiver como “área de atendimento” (sem endereço
   visível), o painel pode não exibir endereço.

2. **Opção “Clientes vêm ao meu endereço”** No GBP, é preciso marcar que **os
   clientes vão ao seu endereço** (local físico). Se o negócio estiver
   configurado só como “área de atendimento” ou “não exibir endereço”, o Google
   tende a não mostrar o endereço no painel.

3. **Inconsistência de NAP (Nome, Endereço, Telefone)** Se o endereço for
   diferente entre site, Facebook, GBP e outros diretórios, o Google pode não
   confiar e omitir o endereço. O ideal é **exatamente o mesmo** endereço em
   todos os lugares.

4. **Classificação como “negócio em casa” ou área residencial** Se o Google
   interpretar o endereço como residencial ou “home-based”, pode suprimir o
   endereço. Fotos do local e Street View ajudam a sinalizar que é um
   estabelecimento comercial.

5. **Tempo (6–12 semanas)** Perfis novos ou alterados no GBP podem levar de 6 a
   12 semanas para o painel de conhecimento passar a exibir o endereço.

**Checklist para o endereço aparecer no Google:**

- [ ] **Criar/verificar Google Business Profile** com o endereço oficial da GB
      Locações.
- [ ] No GBP, marcar **“Clientes vêm ao meu endereço”** (local físico).
- [ ] **NAP idêntico** no site, no Facebook (Sobre) e no GBP (mesmo formato:
      rua, número, bairro, cidade, CEP).
- [ ] Fotos do estabelecimento e, se possível, Street View atualizado.
- [ ] Aguardar **6–12 semanas** após criar ou corrigir o GBP.
- [ ] **Testar o schema:**
      [Teste de resultados ricos](https://search.google.com/test/rich-results)
      com uma URL do site para confirmar que o LocalBusiness está válido (o site
      já envia endereço e geo corretamente).

**Para a empresa aparecer no mapa do Google (resultados de busca):**

O **mapa** que o Google exibe ao lado dos resultados vem do **Google Business
Profile (GBP)**. O site já faz a parte dele (schema + endereço visível + link do
mapa). O passo que falta é **criar ou verificar o perfil no Google** e marcar
“Clientes vêm ao meu endereço”. Sem GBP configurado assim, o Google não costuma
mostrar o endereço no painel nem o pin no mapa. Ver checklist acima.

---

## Resumo para o CEO

| Tópico              | Situação                                                                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Facebook**        | Link oficial atualizado no site: https://www.facebook.com/locacoesgb/                                                                                                |
| **Instagram**       | Conta oficial @locacoes_gb; link no site (rodapé e structured data sameAs): https://www.instagram.com/locacoes_gb/                                                   |
| **“10+” no Google** | Era o texto “10 anos” em destaque; snippet foi alterado para priorizar **Porto Alegre e região** (meta description e página Sobre).                                  |
| **Localização**     | Causa: Google puxa endereço principalmente do **Google Business Profile**; marcar “Clientes vêm ao meu endereço” e manter NAP consistente. Ver checklist na seção 4. |

---

_Última atualização: fevereiro 2026._
