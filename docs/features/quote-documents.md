# Consultas e documentos de orçamento por locadora

> Status: o piloto abaixo registrou validação local antes da publicação. A
> primeira etapa foi publicada em `978ceb9244c81c7cb2888b798fad8ce90edad25e`; a
> retirada F está no clone de revalidação, com provas finais pendentes.

## 1. Purpose

Consultar orçamentos e exportar seus documentos reais sob a permissão da
locadora selecionada. Pagamento e assinatura continuam fluxos distintos.

## 2. Scope

Lista administrativa, contadores, prévia de multa, PDF de orçamento para
administrador/titular, reajustes e ofícios de orçamento/lançamento financeiro. O
documento de orçamento não substitui nem modifica contratos assinados.

## 3. Entry Points

GET /api/admin/quotes; POST /api/admin/quotes/[id]/calculate-late-fee; GET
/api/admin/quotes/[id]/download; GET
/api/admin/quotes/[id]/adjustments/download; GET /api/quotes/[id]/download.

GET /api/admin/quotes/[id]/pdf-oficio e GET
/api/admin/financial/entries/[id]/pdf-oficio estão no host API. Os dois adapters
do registro da onda37 eram a API compartilhada e a raiz antiga, retirada em F;
não são os hosts web e API atuais.

## 4. Core Flow

1. Validar sessão e vínculo ativo. Administração exige QUOTES READ; cliente
   exige titularidade e registro não ocultado por ele.
2. Ler somente registros do tenant dentro da transação com contexto RLS.
3. Obter snapshot e identidade da Organization, sem fallback para a empresa de
   origem.
4. Encerrar a transação antes de renderizar PDF.
5. Entregar application/pdf e Cache-Control:no-store, com filename sanitizado.

A prévia de multa valida data/configuração e usa o cálculo canônico, sem aprovar
ou gravar valores. A aplicação de multa permanece na operação administrativa
própria.

## 5. Components and Files

- apps/services/api/src/host/documents.ts: composição atual por factories
  públicas de documents e marca da locadora. A fachada antiga
  `lib/quote-document.ts` foi retirada em F.
- backend/documents: snapshot, queries, mapper e PDFKit compartilhados.
- backend/communications/tenant-branding: identidade/branding da locadora.
- design-tokens/documents: cores canônicas e geometria A4 em pontos.
- packages/backend/src/modules/documents: renderizadores PDFKit.
- apps/services/api/src/app/api/admin/quotes/route.ts: listagem e agregados sob
  o mesmo tenant.
- tests/unit/quote-admin-database.test.ts: regressões com PostgreSQL.

## 6. Data and State

Quote e QuoteAdjustment da locadora; identidade de emissão em Organization.
Valores existentes e histórico são preservados. Listagem mantém DTO anterior,
agora com paginação de 1 a 100 e contadores limitados ao tenant.

## 7. Constraints and Edge Cases

Recurso de outra empresa retorna 404, mesmo quando a identidade global tem
User.role ADMIN. Revogação e perda de permissão impedem leitura. Cliente não
recebe PDF de outro titular. Nome do arquivo nunca interpreta cabeçalhos
fornecidos por identificadores.

Justificativas longas são divididas entre páginas, mantendo todas as palavras. A
tabela repete cabeçalho e identifica continuação. Rodapé não cria páginas em
branco. O total reajustado usa finalTotal quando presente.

## 8. Error Handling

401/403 para acesso, 400 para paginação/configuração inválida, 404 sem
orçamento/reajustes, 500 genérico para falha de geração. Não devolver JSON de
sucesso prometendo PDF futuro.

## 9. Performance and Accessibility

Contagens de status usam uma agregação por tenant. PDF é gerado fora da
transação. Os PDFs são texto selecionável; conformidade PDF/UA e leitura por
tecnologia assistiva ainda não foram certificadas.

## 10. Tests and Validation

No piloto de consultas/documentos, sete testes reais passaram:
listagem/agregados A/B; IDs externos; papel e permissão vigentes; cálculo sem
mutação; PDF real com autor correto; titular/soft delete; reajustes. Amostras
fictícias renderizadas com Poppler e conferidas visualmente. Cenário de 160
repetições de justificativa preservou palavras em cinco páginas, verificado por
extração pypdf. Isso não valida dados históricos reais.

Onda 37 (2026-10-02, sem commit): 36 testes de adapter, 60 casos HTTP reais nos
dois modos de identidade, dois testes dos valores impressos e 21 fiscais.
Rodadas e rechecagens em [API compartilhada](shared-api-host.md). Paridade
binária normaliza somente CreationDate e ID do PDFKit. Ofício mantém seu
truncamento histórico; reajustes preservam todas as palavras. Author usa a
locadora, 500 inesperado fica genérico sem detail. Sem mutação financeira,
cutover ou publicação naquele corte; o legado estava ativo então. Não é
resultado novo após F nem instrução para restaurar a raiz antiga.

## 11. Related Docs

- [Sistema de orçamentos](quote-system.md)
- [Multa por atraso](late-fee-calculation.md)
- [Isolamento multiempresa](../architecture/multiempresa.md)

## 12. Change Log

- Unreleased: exportadores reais, isolamento, autorização e correção de
  tabela/rodapé com texto longo.

## 13. Consumidores administrativos (onda 66, 2026-10-03)

Painel baixa reajustes pelo api da própria página; ofício pelo api de
financeiro. Ambos usam HttpClient configurado e blob completo. Nome/mensagens
anteriores preservados; escopo antigo não libera PDF. Ofício abre aba no clique,
fecha a aba vazia em erro/cancelamento e revoga URL após load. PDFs reais e
negativas de outra locadora passaram nos dois hosts/motores.
Geradores/valores/permissões e truncamento histórico intactos. Popup/viewer/load
ausente em navegador real não certificados. Provas e limites na onda 66 de
[API compartilhada](shared-api-host.md).
