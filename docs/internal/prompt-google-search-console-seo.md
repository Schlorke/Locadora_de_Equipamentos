# Prompt para extensão Claude (navegador) – Google Search Console, SEO e geolocalização

Use este prompt **na extensão do Claude no navegador**, com a aba aberta no
**Google Search Console** da propriedade **locacoesgb.com.br** (URL:
https://search.google.com/search-console?resource_id=sc-domain%3Alocacoesgb.com.br).

O texto abaixo dá todo o contexto do projeto e as tarefas para configurar
**indexação**, **SEO** e **geolocalização** no Google.

_(Nota: no pedido do usuário, “CEO” foi interpretado como **SEO** – otimização
para mecanismos de busca.)_

---

## Contexto do projeto (não apagar – a extensão precisa disso)

**Site:** https://locacoesgb.com.br **Empresa:** GB Locações – locação de
equipamentos para construção civil (andaimes, betoneiras, compressores, cadeiras
elétricas, etc.). Porto Alegre e região, RS.

**O que o site já tem implementado (código):**

- **Sitemap:** `https://locacoesgb.com.br/sitemap.xml` (gerado automaticamente).
- **robots.txt:** aponta para o sitemap; páginas públicas liberadas.
- **Meta tags:** title, description, Open Graph, Twitter, keywords (layout).
- **Structured Data:** LocalBusiness (endereço, geo, telefone, horário, image,
  hasMap) + Product nas páginas de equipamento.
- **Endereço visível:** footer, página de contato, card de contato (fallback:
  Travessa Doutor Heinzelmann, 365 - Humaitá, Porto Alegre/RS - CEP 90240-100).
- **Verificação Google:** o projeto suporta a meta tag
  `google-site-verification` via variável de ambiente `GOOGLE_SITE_VERIFICATION`
  (deploy).

**Geolocalização / mapa:** O endereço e o pin no mapa do Google vêm
principalmente do **Google Business Profile (GBP)** (business.google.com), não
só do site. O site já envia todos os dados (LocalBusiness + endereço visível +
hasMap). Para aparecer no mapa, é obrigatório criar/verificar o perfil no GBP e
marcar “Clientes vêm ao meu endereço”.

**Documentação do projeto:**

- Indexação e SEO: `docs/guides/google-indexing-seo.md`
- Mapa/geolocalização: `docs/guides/google-business-profile-map.md`
- Notas CEO/Google: `docs/internal/ceo-google-seo-notes.md`

---

## Prompt para copiar e colar na extensão Claude

Use o bloco abaixo **na extensão do Claude no navegador**, com o Search Console
do **locacoesgb.com.br** já aberto. A IA deve seguir os passos na ordem e
relatar o que fez.

```
Estou no Google Search Console na propriedade do domínio locacoesgb.com.br. Preciso que você me guie e execute (onde for possível na interface) as configurações para maximizar a indexação, o SEO e a geolocalização no Google.

— CONTEXTO DO PROJETO —
Site: https://locacoesgb.com.br
Empresa: GB Locações – locação de equipamentos para construção civil em Porto Alegre e região.
O site já tem: sitemap em /sitemap.xml, robots.txt, meta tags, Structured Data (LocalBusiness com endereço, geo, image, hasMap), endereço visível no footer e na página de contato. A geolocalização no mapa do Google depende do Google Business Profile (business.google.com), não só do Search Console.

— TAREFAS NO SEARCH CONSOLE —

1) Verificação da propriedade
- Confirmar que a propriedade locacoesgb.com.br está verificada (deve estar, pois estou na visão geral).
- Se aparecer opção de verificação pendente, seguir o método indicado (meta tag no site, arquivo HTML em public/ ou DNS). O site suporta GOOGLE_SITE_VERIFICATION em variável de ambiente.

2) Sitemap
- Ir em Indexação > Sitemaps (ou "Mapas do site").
- Se o sitemap ainda não estiver enviado, adicionar: sitemap.xml (ou https://locacoesgb.com.br/sitemap.xml) e enviar.
- Se já estiver, confirmar status (sucesso/erros) e informar.

3) Inspeção de URL e indexação
- Usar "Inspecionar qualquer URL" no topo.
- Inspecionar estas URLs e, se o Google indicar que a página não está indexada ou não foi rastreada recentemente, solicitar indexação (botão "Solicitar indexação"):
  - https://locacoesgb.com.br
  - https://locacoesgb.com.br/equipamentos
  - https://locacoesgb.com.br/contato
  - https://locacoesgb.com.br/orcamento
  - https://locacoesgb.com.br/sobre
Não solicitar indexação para dezenas de URLs de uma vez; priorizar essas principais.

4) Indexação > Páginas
- Abrir a seção e informar resumo: quantas URLs estão indexadas, se há erros ou avisos (e quais). Se houver erros, listar os tipos para eu corrigir no site.

5) Experiência > Core Web Vitals
- Abrir e informar se há problemas em mobile ou desktop (LCP, FID, CLS). Se os dados ainda estiverem "em processamento", informar e sugerir voltar em 1–2 dias.

6) Desempenho (Performance)
- Se os dados já estiverem disponíveis: resumir impressões, cliques e CTR nas buscas. Se ainda "em processamento", informar.

7) Melhorias / Rich results (se existir no menu)
- Verificar se há relatório de "Resultados de pesquisa" ou "Dados estruturados" (LocalBusiness, Product). Informar se há erros ou avisos nos dados estruturados.

8) Configurações
- Em Configurações da propriedade: confirmar ou sugerir país/região (Brasil) e se há restrições de usuário que precisem ser revisadas.

— GEOLOCALIZAÇÃO (fora do Search Console) —
O endereço e o mapa nos resultados do Google vêm do Google Business Profile. Lembrar ao usuário:
- Criar ou verificar o perfil em https://business.google.com
- Usar o endereço: Travessa Doutor Heinzelmann, 365 - Humaitá, Porto Alegre/RS - CEP 90240-100
- Marcar "Clientes vêm ao meu endereço" no GBP
- Manter o mesmo NAP (nome, endereço, telefone) no site, Facebook e GBP

— RESULTADO FINAL —
Ao terminar, listar o que foi feito (sitemap enviado/verificado, URLs inspecionadas/solicitadas, problemas encontrados) e dar 3–5 recomendações objetivas para aumentar SEO e indexação com base no que você viu no Search Console.
```

---

## Observações

- A extensão não consegue alterar o site nem o DNS; ela só pode **guiar e
  executar ações na interface do Search Console** (e, se o usuário abrir, no
  GBP).
- Se aparecer "Dados em processamento: volte em mais ou menos um dia", é normal
  em propriedades novas ou após mudanças; a IA deve informar e sugerir repetir
  os passos de Sitemap e Inspeção de URL depois que os dados estiverem
  disponíveis.
- Para **geolocalização no mapa**, o passo decisivo é o **Google Business
  Profile**; o Search Console não controla a exibição do endereço no painel nem
  o pin no mapa.

---

_Última atualização: fevereiro 2026._
