# Pagina de Orcamento (/orcamento) - Documentacao

## 1. Proposito

Pagina publica onde o cliente revisa o carrinho, informa dados de contato e
endereco, escolhe modalidade de entrega/retirada, avalia opcoes de frete e envia
o orcamento para `/api/quotes`. Mantem os preços sincronizados com o catalogo e
exibe resumo final (itens + frete).

## 2. Logica de Funcionamento

1. Itens do carrinho vem de `useCartStore` e sao exibidos com quantidade, datas
   e precos inteligentes (`calculateIntelligentPrice` / `getPricingConfig`).
2. Quando um item nao possui `startDate`/`endDate`, a pagina calcula e exibe um
   periodo estimado a partir da data da solicitacao, respeitando
   `includeWeekends` (se false, inicia no proximo dia util e conta apenas dias
   uteis).
3. Quando um item possui `startDate` e o usuario ajusta `days`, o `endDate` e
   recalculado a partir da data de inicio, respeitando `includeWeekends`.
4. Ao montar, a pagina reidrata os itens via `hydrateItems` com dados atuais de
   `/api/equipments` (ver `docs/features/cart-pricing-sync.md`), preservando
   quantidade e dias.
5. Formulario de contato controla estado local (`formData`) e preenche
   nome/email se o usuario estiver logado (`useSession`).
6. `deliveryType`:
   - `PICKUP`: esconde endereco e frete.
   - `DELIVERY`: renderiza `AddressForm` e, com CEP valido/endereco definido,
     chama `calculateFreight` para montar `freightOptions`.
7. Dropdown de frete usa o `Select` do design system e preserva rolagem livre. O
   Radix Select não declara `modal`: `modal={false}` é compatibilidade da
   fachada, não a proteção efetiva. `SelectContent` liga
   `useReleaseScrollLockRef`, de `packages/ui/src/web/release-scroll-lock.ts`,
   enquanto o conteúdo está conectado: remove `data-scroll-locked`, libera
   `pointer-events: none` e usa `data-scroll-released` para o recorte global.
   Observador/registro encerram no ref solto ou conteúdo desconectado. Os guards
   antigos de `app/globals.css`/`app/orcamento/page.tsx` foram retirados em F;
   não devem ser recriados. Cada opção mantém nome, transportadora e preço.
8. Resumo (sidebar sticky) soma subtotais calculados pelo pricing inteligente e
   inclui o valor da opcao de frete selecionada. Desde as ondas 6 e 7, o
   subtotal de cada item e `buildQuotePricing(...).total` (preco exato em
   Decimal × quantidade, arredondado uma vez, igual ao servidor), nunca a
   unidade arredondada × quantidade (`docs/features/quote-system.md`, secao
   4.4).
9. Antes de enviar, o cliente precisa aceitar os Termos de Uso via checkbox. O
   texto "Termos de Uso" abre um dialog com o conteudo completo; o envio e
   bloqueado sem aceite.
10. Envio do orcamento posta para `/api/quotes` com itens, dados de contato,
    `deliveryType`, endereco (quando `DELIVERY`) e opcao de frete escolhida.
    Opcionalmente abre WhatsApp via `convertFormDataToWhatsApp` /
    `openWhatsAppQuote`. Ao concluir, limpa o carrinho (`clearCart`). O backend
    tenta gerar o boleto automaticamente quando ha CPF/CNPJ e total > 0; falhas
    sao logadas e nao interrompem o fluxo.

## 3. Arquitetura e Dependencias

- `packages/frontend/src/pages/orcamento/ui/OrcamentoPage.web.tsx` —
  apresentação da página. `model/use-quote-page.ts` é o fluxo compartilhado; o
  host fino está em
  `apps/clients/web/src/app/(public)/[locadora]/(vitrine)/orcamento/page.tsx`.
- `packages/frontend/src/features/carrinho/model/carrinho.ts` — estado do
  carrinho, `hydrateItems`, `updateItem*`.
- `packages/frontend/src/entities/equipamento/model/preco.ts` e
  `packages/frontend/src/entities/orcamento/model/preco.ts` — motor de
  precificacao inteligente.
- `packages/frontend/src/entities/orcamento/model/frete.ts` — `calculateFreight`
  (opcoes de entrega).
- `packages/frontend/src/entities/orcamento/model/whatsapp.ts` —
  montagem/abertura de mensagens para contato rapido.
- Componentes: `packages/ui/src/web/Select.web.tsx` (modo nao modal),
  `packages/ui/src/web/AddressForm.web.tsx`, inputs/labels/cards do design
  system.

## 4. Como Usar

- Itens chegam a partir das paginas de equipamento (cada item com `startDate`,
  `endDate`, `days`, `includeWeekends`).
- Para frete: defina `deliveryType = 'DELIVERY'`, preencha CEP/endereco; a
  pagina busca opcoes via `calculateFreight` e mostra no select (scroll
  permanece livre enquanto o dropdown esta aberto).
- A fachada `Select` mantém `modal={false}` por compatibilidade; a liberação do
  scroll depende do ref do `SelectContent`, não dessa prop. Preserve esse ref no
  fluxo público e seu cleanup, sem copiar observadores para a página.
- Totais e badges de preco sao recalculados automaticamente ao alterar dias,
  quantidades ou opcao de frete.
- O envio do orcamento exige aceite dos Termos de Uso (checkbox + dialog).

## 5. Armadilhas a Evitar

- Não remova a liberação de scroll do conteúdo Select de frete. Alterar apenas
  `modal` não desativa o RemoveScroll do Radix Select.
- Nao enviar itens sem datas (`startDate`/`endDate`/`days`) — a API bloqueia.
- Nao pular a reidratacao de precos (`hydrateItems`), senao valores podem ficar
  defasados.
- Nao sobrescrever o `min-w-[var(--radix-select-trigger-width)]` do
  `SelectContent`, que garante alinhamento ao trigger.
- Nao remover a validacao do aceite dos Termos de Uso antes do envio.

## 6. Licoes Aprendidas

- O Radix Select ativa `RemoveScroll` no body. A solução antiga de2025 descrevia
  `modal={false}`/guard da página; o owner atual é o ref de liberação do design
  system, que evita trava/padding e encerra o registro ao fechar.
- Manter frete e endereco condicionais ao `deliveryType` reduz erros de
  submissao e evita requisicoes de frete desnecessarias.

## 7. Historico de Alteracoes

| Data       | Descricao                                                                   | Autor    |
| ---------- | --------------------------------------------------------------------------- | -------- |
| 2026-09-30 | Subtotal do item pela regra da linha (`buildQuotePricing`), ondas 6 e 7     | IA       |
| 2025-12-22 | Ajuste de dias recalcula o endDate para itens com datas                     | IA Codex |
| 2025-12-22 | Datas estimadas sem calendario e confirmacao antecipada de finais de semana | IA Codex |
| 2025-12-18 | Documentada logica da pagina e correcao do select de frete                  | IA Codex |
