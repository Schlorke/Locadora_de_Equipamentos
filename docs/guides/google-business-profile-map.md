# Aparecer no mapa do Google – Google Business Profile (GBP)

Este guia explica como fazer a **GB Locações** aparecer no **mapa do Google** (e
no painel de conhecimento ao lado dos resultados de busca).

---

## Por que o mapa depende do Google Business Profile?

O Google exibe o **endereço e o pin no mapa** principalmente a partir do
**Google Business Profile** (antigo “Meu Negócio”), não só do site. O site já
envia todos os dados (schema LocalBusiness, endereço visível, link do mapa). O
passo que falta é **ter um perfil no Google** configurado corretamente.

---

## Passo a passo para aparecer no mapa

### 1. Criar ou acessar o perfil

1. Acesse [Google Business Profile](https://business.google.com/) (ou pesquise
   “Google Meu Negócio”).
2. Faça login com a conta Google da empresa (ou crie uma).
3. Se o perfil **já existir**, peça acesso ao proprietário. Se **não existir**,
   clique em “Adicionar seu negócio ao Google” e preencha nome, categoria e
   local.

### 2. Informar o endereço físico

1. No perfil, informe o **endereço oficial** da GB Locações (o mesmo do site e
   do CNPJ):
   - **Endereço:** Travessa Doutor Heinzelmann, 365
   - **Bairro:** Humaitá
   - **Cidade:** Porto Alegre
   - **Estado:** RS
   - **CEP:** 90240-100

2. **Importante:** Marque a opção **“Clientes vêm ao meu endereço”** (ou
   equivalente: que você atende no local). Se marcar só “área de atendimento” ou
   “não exibir endereço”, o Google tende a **não** mostrar o endereço nem o
   mapa.

### 3. Verificar o negócio

O Google pede **verificação** (por cartão postal, e-mail, telefone ou vídeo).
Siga o processo indicado na tela. Sem verificação, o perfil não costuma aparecer
completamente nos resultados.

### 4. Manter NAP consistente

**NAP** = Nome, Endereço, Telefone. Use **exatamente o mesmo** em:

- Site (footer, contato)
- Facebook (Sobre)
- Google Business Profile
- Outros diretórios (se houver)

Qualquer diferença (ex.: “Trav.” vs “Travessa”, outro número) pode fazer o
Google não confiar e não exibir o endereço.

### 5. Completar e manter o perfil

- **Horário de funcionamento:** ex.: Seg–Sex 8h–18h, Sáb 8h–12h (igual ao site).
- **Telefone e site:** https://locacoesgb.com.br e os números já usados no site.
- **Fotos:** do estabelecimento, equipamentos, equipe (ajuda o Google a tratar
  como negócio real e comercial).
- **Categoria:** algo como “Empresa de aluguel de equipamentos” / “Locação de
  equipamentos para construção”.
- **Descrição da empresa:** Use o texto sugerido abaixo (máx. 750 caracteres).
  Ver seção "Texto para descrição da empresa" no final deste guia.

### 6. Aguardar

Perfis novos ou alterados podem levar **6–12 semanas** para o painel de
conhecimento e o mapa passarem a exibir o endereço. Não é instantâneo.

---

## O que o site já faz (não precisa mudar)

- Envia **LocalBusiness** em JSON-LD (endereço, coordenadas, telefone, horário,
  **image**, **hasMap**).
- Exibe o **endereço** no footer, na página de contato e no card de contato (com
  fallback quando o admin não preenche).
- Inclui **meta geo** (região, coordenadas) no layout.

Ou seja: a parte técnica do site está pronta. O que falta é o **perfil no
Google** configurado e verificado.

---

## Texto para descrição da empresa (Google Business Profile)

Use no campo **"Adicionar descrição da empresa"** (máx. 750 caracteres). Copie e
cole:

**Versão completa (~430 caracteres):**

> GB Locações é especializada em locação de equipamentos para construção civil
> em Porto Alegre e região metropolitana. Oferecemos andaimes suspensos,
> betoneiras, compressores, cadeiras elétricas para pintura e fachada, além de
> serviços em altura. Equipamentos certificados, entrega na região e mais de 10
> anos de experiência. Atendimento personalizado, manutenção constante e
> compromisso com segurança e pontualidade. Ideal para obras, reformas e pintura
> em altura. Solicite seu orçamento pelo site locacoesgb.com.br ou pelo
> WhatsApp.

**Versão curta (~280 caracteres), se preferir:**

> GB Locações é especializada em locação de equipamentos para construção civil
> em Porto Alegre e região. Andaimes suspensos, betoneiras, compressores,
> cadeiras elétricas para pintura e fachada. Equipamentos certificados, entrega
> na região e mais de 10 anos de experiência. Solicite seu orçamento pelo site
> locacoesgb.com.br ou WhatsApp.

---

## Localizador no site (Store Locator)

O site exibe um **localizador interativo** na página **Contato** (`/contato`),
usando o
[Google Maps Extended Component Library](https://github.com/googlemaps/extended-component-library)
(Store Locator / Criador rápido de soluções).

### O que você precisa fazer

1. **Chave de API**
   - No [Google Cloud Console](https://console.cloud.google.com/), projeto
     **GB-Locacoes** (ou o que você usa).
   - **APIs e serviços** → **Credenciais** → criar ou usar uma chave de API.
   - Habilitar as APIs: **Maps JavaScript API**, **Places API**, **Directions
     API**, **Distance Matrix API**.

2. **Variável de ambiente**
   - No `.env.local` (e no ambiente de produção, ex.: Vercel):
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="sua-chave-aqui"`.
   - Opcional: `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` para mapa com estilo customizado
     (Cloud-based Map ID).

3. **Concluir configuração da conta (se o Google pedir)**
   - Se no Criador rápido de soluções aparecer _“Termine a configuração da conta
     para adicionar o código”_, clique em **Concluir configuração** e siga os
     passos (ex.: ativar faturamento, aceitar termos). O código do site já está
     integrado; a chave no `.env.local` é o que o localizador usa.

Sem a chave configurada, a página de contato mostra um aviso em vez do mapa.
Nenhuma credencial real deve ser commitada no repositório (sempre use
`.env.local` e variáveis do ambiente de deploy).

**Se aparecer no console "InvalidKeyMapError"**: ver causas e solução em
`docs/issues/known-issues.md` (busque por "InvalidKeyMapError").

---

## Resumo

| Ação                                  | Onde / como                                                        |
| ------------------------------------- | ------------------------------------------------------------------ |
| Criar/verificar perfil                | [business.google.com](https://business.google.com)                 |
| Endereço igual ao do site             | Trav. Doutor Heinzelmann, 365 – Humaitá – POA/RS                   |
| Marcar “Clientes vêm ao meu endereço” | Nas configurações do perfil no GBP                                 |
| NAP idêntico                          | Site, Facebook, GBP                                                |
| Aguardar                              | 6–12 semanas após criar/ajustar o GBP                              |
| Localizador no site                   | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` em `.env.local`; ver seção acima |

---

_Última atualização: fevereiro 2026. Contexto técnico em
`docs/internal/ceo-google-seo-notes.md`._
