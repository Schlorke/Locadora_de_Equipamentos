# Documentos privados e contratos por locadora

## Fronteira e regras

As rotas de imagens, documentos de clientes e contratos resolvem a sessão e a
membership ativa a cada pedido. Cabeçalho e cookie divergentes continuam
inválidos. Nenhum papel global do User autoriza esses recursos.

- Imagens públicas de catálogo/logo: ADMIN; chave `tenants/<tenantId>/...`, cota
  por locadora/usuário, decodificação real e SVG sanitizado.
- Documentos sensíveis: ADMIN/OPERATOR incluem documentos em locações da própria
  locadora. CLIENT consulta somente os seus documentos. FINANCIAL não acessa
  documentos.
- O bucket de documentos precisa existir e declarar `public=false`; a API recusa
  armazenamento/URLs se essa condição não for confirmada.
- Arquivos privados têm prefixo de locadora/cliente, UUID, upload sem overwrite
  e URL de download válida por 300 segundos. Arquivos legados sem prefixo ficam
  sem URL até migração explícita.
- Metadados são validados antes do upload. Imagens são decodificadas; PDF exige
  assinatura/cabeçalho e EOF. Isso não equivale a análise antimalware. PDFs são
  entregues como download privado.
- Falha no banco após upload remove somente a chave nova criada por aquele
  pedido.

## Contratos

ADMIN/OPERATOR geram DRAFT usando o ClientProfile e o nome da Organization.
CLIENT pode consultar/solicitar assinatura somente do próprio contrato;
FINANCIAL não pode. O HTML escapa dados interpolados. Nenhum download GET gera
ou altera contrato; ausência retorna404.

Geração não sobrescreve SENT/SIGNED/CANCELLED/EXPIRED nem DRAFT com tentativa de
assinatura. A migration010 protege no PostgreSQL conteúdo, estado, identidade e
exclusão de SIGNED; permite apenas o primeiro vínculo com arquivo privado, sem
substituir arquivo já arquivado. Uma nova versão jurídica precisa de fluxo
próprio; não se simula uma versão reabrindo o contrato assinado.

Os textos jurídicos legados foram preservados, incluindo referências regionais.
Ainda precisam de configuração/revisão específica por locadora antes de
habilitar essa superfície comercialmente para todas as empresas.

## Entrega externa

POST de assinatura grava outbox `contract.signature.request` e
ContractSignatureAttempt na mesma transação. O handler
`runContractSignatureEffect` resolve exatamente uma integração ZAPSIGN ativa da
locadora, usa credencial explícita e signatário do ClientProfile. Campos de
signatário enviados pelo cliente não alteram o destinatário.

O adapter envia PDF em base64 com Bearer e external_id. Não há mock nem segredo
global de fallback. A tentativa passa a PROCESSING antes da rede.
Falha/timeout/resposta sem referência comprovada vira UNKNOWN, sem retry de
criação; interrupção em PROCESSING também exige reconciliação.
`reconcileContractSignature` confere documento e external_id consultando o mesmo
vínculo de integração. Não se interpreta external_id como garantia de
idempotência do provedor.

O webhook autenticado apenas confirma assinatura e enfileira
`contract.signed.archive`. O efeito consulta o documento no provedor, rejeita
hosts de PDF fora do S3 ZapSign, não segue redirects, limita o corpo a10MB e
armazena em bucket privado sem overwrite. O download de SIGNED aguarda
arquivamento privado (409 enquanto pendente), sem redirecionar pdfUrl externo
legado. Registry vincula provider/integration/documento/locadora.

Referências verificadas:
[criação de documentos ZapSign](https://docs.zapsign.com.br/documentos/criar-documento)
e
[URLs temporárias do webhook](https://docs.zapsign.com.br/webhooks/eventos/document/documento-criado).

## Validação

- `node node_modules/vitest/vitest.mjs run --config vitest.security.config.ts`:144
  testes isolados, incluindo três testes originais de imagem, handlers HTTP,
  ACL/cross-tenant, storage privado, imutabilidade, corpo escapado, UNKNOWN e
  host não confiável.
- `TEST_DATABASE_URL` apontando explicitamente ao PostgreSQL descartável
  local55437 +
  `node node_modules/vitest/vitest.mjs run --config vitest.identity.config.ts`:14
  testes reais, incluindo sete de contratos/FK/trigger/RLS metadata com
  rollback.
- Migrações009/010 aplicadas somente ao banco descartável. Nenhum envio
  ZapSign/storage/email real, migração de dados reais ou corte de auth foi
  realizado.
