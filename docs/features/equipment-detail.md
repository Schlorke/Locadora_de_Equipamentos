# Detalhe público de equipamento

> **Status**: Standard **Last updated**: 2026-10-03

## 1. Propósito

Apresentar o equipamento da locadora, imagens, disponibilidade e condições de
locação. Cliente seleciona período ou datas, confirma fins de semana e adiciona
o item ao carrinho usando o motor existente.

## 2. Escopo

Web conserva seu SSR/SEO e apresentação anterior. Expo monta a mesma URL de
detalhe com variantes na slice existente. Envio de orçamento no Expo e aceite em
aparelho permanecem pendentes; não há cutover da API.

## 3. Entradas

- Web:
  `apps/clients/web/src/app/(public)/[locadora]/(vitrine)/equipamentos/[id]/page.tsx`.
- Expo: apps/clients/mobile/src/app/(public)/equipamentos/[id].tsx.
- Produto: `packages/frontend/src/pages/equipamento-detalhe`, com
  `EquipamentoDetalhePage.{web,native}.tsx`,
  `EquipamentoPeriodo.{web,native}.tsx` e `EquipamentoPreco.{web,native}.tsx` em
  `ui/`.
- API: GET /api/equipments/{id}?tenantSlug.

## 4. Dados e invariantes

Parser único em packages/contracts/src/public-equipment.ts, consumido pelos dois
clientes através da entrada existente de contracts. Preserva defaults e
normalização anteriores do web, sem copiar autorização/ownership do servidor.
HTTP 404 é ausência neutra; falha de transporte/corpo inválido permite retry.

Preços usam entities/equipamento e seu domínio. Direto zero não vira desconto.
Períodos desabilitados permanecem visíveis/inativos. Datas determinam período e
bloqueiam seleção manual; limpar datas permite escolher o período novamente.

## 5. Comportamento

Calendário aceita datas entre hoje e dez anos à frente. Sem incluir fins de
semana, sábado/domingo são desabilitados e a contagem é de dias úteis. Primeiro
clique mantém o calendário aberto, segundo completa o intervalo; limpar reinicia
a seleção. Alterar fins de semana recalcula o intervalo existente.

Clique durante loading aguarda a sessão. Visitante vai para login com retorno
seguro ao detalhe. Autenticado sem datas/preferência confirmada escolhe fins de
semana antes de addItem. Carrinho preserva configuração de preços, datas e
confirmação. Destino anterior /orcamento permanece, mas a tela Expo ainda falta.

## 6. Contratos de UI

Web mantém classes, rótulos, helpers de preço e metadados. Native usa primitivas
e tokens existentes: calendário mensal com escolha de mês/ano, galeria,
ampliação em modal, preço, informações e benefícios. Textos comerciais da GB
permanecem dívida compatível.

JSON-LD é metadado HTML, não conteúdo de tela nativa. A variante native do
widget não renderiza scripts. Host fornece imagem e Share/deep link, sem regra
de negócio. Scheme atual vem do Expo; não foi inventado domínio público.

## 7. Dependências

packages/ui, design-tokens e contracts; entidades sessao/equipamento/organizacao
e feature carrinho. Leitura usa HttpClient configurado e ciclo cancelável.
Nenhuma dependência nova. A entrada pública da página seleciona
`index.native.ts` no Expo e `index.ts` no web, mantendo os símbolos do contrato
existente.

## 8. Erros e isolamento

Troca de locadora, usuário, sessão, transporte ou id reinicia a tela. Resposta
antiga não reaparece. Falha de compartilhamento mostra erro; efeito externo em
aparelho ainda precisa de aceite. Backend continua revalidando o tenant e RLS.

## 9. Performance e acessibilidade

Calendário renderiza somente um mês. Contagem de dias usa o modelo anterior
otimizado por semanas completas. Botões de data têm rótulos dd/MM/yyyy e estado
desabilitado/selecionado; modais usam o overlay nativo existente. Gestos, zoom e
fidelidade visual devem ser verificados nos aparelhos alvo.

## 10. Testes e validação

45 casos focados únicos, incluindo web e RN sobre host simulado; oito do gateway
web e 57 do host Expo. Tipos/gates/builds e source maps aprovados. AST confirma
355 atributos web e 13 inicializadores de preço preservados. Não equivale a
aceite em aparelho, recebimento de Share ou envio completo de orçamento.

Relatório e próximo corte: [onda 73](shared-api-host.md).
