# Onde ficam as imagens do produto e das locadoras

O
[inventário anterior](../archive/wave135-pre-f/docs/guides/where-are-images-stored.md.source)
descreve arquivos e operações da GB na época. Seus totais de imagens, URLs e
otimizações não são um inventário nem uma operação executada na nova plataforma.

## Arquivos estáticos e URLs persistidas

`public/` conserva os assets estáticos versionados do produto. Imagens recebidas
pelo formulário não são gravadas nessa pasta: o upload retorna uma URL do
adaptador de armazenamento, que os fluxos correspondentes podem persistir no
banco. Uma URL já presente no banco não comprova que o objeto existe ou que a
conta de armazenamento está configurada neste ambiente.

## Caminho atual do upload

`POST /api/upload` pertence a `apps/services/api/src/app/api/upload/route.ts`. A
rota exige principal autorizado e ADMIN. A composição em
`apps/services/api/src/host/branding.ts` entrega a transação e a porta de
armazenamento ao backend.

`packages/backend/src/http/image-upload.ts` recebe `file` e finalidade
`equipment` ou `logo`. Os caminhos gerados são:

```text
prefixo: tenants/<tenantId>/
finalidade equipamento: equipments/equipment-<UUID>.<extensão>
finalidade logo: logos/logo-<UUID>.<extensão>
```

A gravação usa `upsert: false`; a preparação dos bytes pertence a
`packages/backend/src/modules/catalog/image-upload.ts`. Consulte o
[guia de otimização](optimize-existing-images.md) para os parâmetros efetivos.

## Adaptador mantido, configuração futura

`createSupabaseImageStorage`, na entrada pública `@gb-locacoes/backend/runtime`,
é implementado em `packages/backend/src/runtime/document-storage.ts` e cria o
cliente somente no uso. O bucket nominal ainda é `gb-locacoes-images`; esse nome
é compatibilidade de código, não prova de acesso, existência ou propriedade de
uma conta cloud. `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são
lidos pelo adaptador servidor; a chave de serviço nunca deve chegar ao cliente.

A nova hospedagem, o banco e o armazenamento ainda precisam de recursos e
configuração próprios. Não copiar arquivos privados, URLs de projetos ou
credenciais de GB. Os utilitários em `scripts/ops/storage-utils.ts` são
quarentena operacional e não autorizam apagar objetos existentes.

Para investigar uma imagem ausente, distinguir referência no banco, resposta
HTTP da URL e renderização no cliente; preservar a dimensão e a aparência reais.
Os testes de upload usam recursos próprios/fixtures e não certificam uma conta
cloud ou a conclusão de uma migração externa.

_Atualizado em 2026-10-09; nenhuma conta ou objeto externo foi acessado._
