# Pré-visualizações de e-mails

Esta pasta conserva `quote-template.html` e `quote-confirmation-preview.html`
como pré-visualizações estáticas. Abrir esses arquivos permite inspecionar a
apresentação do exemplo; não envia e-mail nem executa um fluxo de orçamento.

O
[README anterior](../../docs/archive/wave135-pre-f/public/email-templates/README.md.source)
foi arquivado. A receita de copiar HTML em três handlers antigos foi aposentada;
o runtime atual tem um único dono de templates e efeitos compartilhados.

## Donos atuais do envio

- `packages/backend/src/modules/communications/email-templates.ts`: funções
  internas que produzem HTML de contato, orçamento, boleto, mudança de status e
  confirmação do cliente.
- `packages/backend/src/modules/communications/tenant-branding.ts`: leitura do
  branding da locadora, validação de origem e escape de texto/URLs.
- `@gb-locacoes/backend/communications`: entrada pública de branding e efeitos
  para o host; os templates internos não viram uma API do cliente.
- `apps/services/api/src/host/communications.ts`: composição das portas no
  servidor. O envio é um efeito do fluxo real, não uma chamada acrescentada ao
  carregar uma página de pré-visualização.

## Alterar um template autorizado

1. Localizar a função correspondente em `email-templates.ts` e seus efeitos
   consumidores dentro do módulo. Não copiar HTML para uma rota HTTP.
2. Preservar a aparência existente, compatibilidade do HTML e os dados da
   locadora. Usar branding explícito; não introduzir contatos, logo, domínio ou
   credenciais GB como padrão para outras organizações.
3. Caracterizar os dados interpolados e o escape antes de alterar. A origem
   pública configurada da locadora deve permanecer a base de links/assets.
4. Comparar a pré-visualização com HTML gerado a partir de fixture local e
   verificar o efeito/destinatário correspondente. Um HTML estático aberto no
   navegador não comprova entrega ou renderização em um cliente de e-mail real.

`tests/unit/email-branding.test.ts` protege isolamento, origem e HTML das
fixtures. Consulte a [regra de orçamentos](../../docs/features/quote-system.md)
e a [API compartilhada](../../docs/features/shared-api-host.md) para os efeitos
persistidos. Prova de entrega, credenciais e infraestrutura de e-mail exigem
ambiente próprio e autorização específica.

Esta revisão não altera os dois HTMLs, templates de runtime, cores ou
provedores, e não dispara mensagens.

_Atualizado em 2026-10-09; documentação da composição pós-retirada._
