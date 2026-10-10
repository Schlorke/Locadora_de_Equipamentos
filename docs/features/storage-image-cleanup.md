# 🗑️ Limpeza de Imagens no Supabase Storage

## 📋 Visão Geral

O fluxo automático abaixo documenta o requisito e a implementação antiga
de 2025. Na composição atual, PUT/DELETE de equipamentos alteram o banco da
locadora, sem chamar remoção física de imagens no Storage. O utilitário
operacional e o script de limpeza de órfãos foram portados; sua presença não
prova o critério original de limpeza automática nem certifica o provedor real. A
divergência fica pendente; portar documentação não aceita ou corrige essa lacuna
funcional.

## 🔧 Como Funciona

### 1. Remoção durante edição no adapter antigo (histórico de 2025)

O exemplo antigo envia a diferença entre os arrays ao Storage. Ele não
corresponde ao PUT atual, que salva o novo array no banco, sem executar
`deleteFilesFromStorage`. Essa diferença não comprova quando o efeito deixou de
ser composto nem aprova sua ausência:

```typescript
// Antes da atualização no banco:
const oldImages = existingEquipment.images || []
const newImages = images.filter(...)

// Identifica imagens removidas
const deletedImages = oldImages.filter((oldImg) => !newImages.includes(oldImg))

// Remove arquivos do Storage antes de atualizar o banco
await deleteFilesFromStorage(deletedImages)
```

### 2. Remoção durante exclusão no adapter antigo (histórico de 2025)

O exemplo antigo removia arquivos antes da linha do banco. O DELETE atual
confere existência no tenant e exclui a linha dentro da transação, sem chamar
remoção física no Storage:

```typescript
// Busca o equipamento para obter as imagens
const equipment = await prisma.equipment.findUnique({
  where: { id },
  select: { images: true }
})

// Remove todas as imagens do Storage
await deleteFilesFromStorage(equipment.images)

// Depois deleta o equipamento do banco
await prisma.equipment.delete({ where: { id } })
```

## 📁 Arquivos Relacionados

### `scripts/ops/storage-utils.ts`

Porte do arquivo antigo `lib/storage-utils.ts`, retirado em F, feito na onda 135
(decisão D9 do dono: portar, nunca apagar), para o script de limpeza sobreviver
à exclusão da raiz legada. A quarentena COD-03 de `tools/hygiene-baseline.json`
passou para o arquivo novo; o original foi retirado junto com a raiz antiga. O
cliente administrativo vem de `createSupabaseAdminClient`
(`@gb-locacoes/backend/runtime`) e só é criado na primeira remoção. Prova:
`tests/unit/storage-utils-ops.test.ts`.

Funções utilitárias para gerenciar arquivos no Supabase Storage:

- **`extractFilePathFromSupabaseUrl(url: string)`**: Extrai o caminho do arquivo
  de uma URL completa do Supabase
- **`deleteFileFromStorage(fileUrl: string)`**: Remove um único arquivo do
  Storage
- **`deleteFilesFromStorage(fileUrls: string[])`**: Remove múltiplos arquivos do
  Storage

### `apps/services/api/src/app/api/admin/equipments/[id]/route.ts`

A rota atual autoriza `EQUIPMENTS/WRITE` no PUT e `EQUIPMENTS/DELETE` no DELETE.
`apps/services/api/src/host/catalog.ts` compõe a factory de
`packages/backend/src/modules/catalog/equipments.ts` com transação da locadora.

- **PUT**: Atualiza `images` no banco; não chama o utilitário de limpeza.
- **DELETE**: Confere existência e deleta o equipamento no tenant; não remove
  imagens físicas. A consulta de `images` existente não é um efeito de Storage.

O adapter antigo `app/api/admin/equipments/[id]/route.ts` foi retirado em F. Não
adicionar efeitos de provedor nem esperar remoção automática com base no exemplo
histórico acima.

### `scripts/cleanup-orphaned-images.ts`

Script utilitário para limpar imagens órfãs que podem ter sido deixadas antes da
implementação. Usa o runtime administrativo e consulta todas as imagens
referenciadas no banco; não é uma ação isolada por tenant nem possui dry-run.
Exige ambiente de manutenção deliberado e autorização para remover arquivos; não
executar com o banco/Storage principal para validar essa documentação.

```bash
# Comando de manutenção destrutiva; somente no ambiente autorizado
npx tsx scripts/cleanup-orphaned-images.ts
```

## 🔍 Detalhes Técnicos

### Extração de Caminho da URL

O sistema suporta URLs do Supabase no formato:

```
https://[project].supabase.co/storage/v1/object/public/gb-locacoes-images/equipments/equipment-[uuid].jpg
```

E extrai o caminho relativo:

```
equipments/equipment-[uuid].jpg
```

### Tratamento de erros do utilitário e do fluxo automático histórico

- Se um arquivo não existe no Storage (já foi removido), não é considerado um
  erro crítico
- O utilitário devolve resultado/contadores de falhas; não é chamado pelo
  PUT/DELETE atual.
- No fluxo automático antigo, falhas de Storage eram logadas sem bloquear a
  alteração no banco; isso é histórico, não efeito garantido pelo host atual.

### Performance

- Remoções são feitas em paralelo usando `Promise.allSettled`
- O script de limpeza processa arquivos em lotes de 50 para evitar sobrecarga

## ⚠️ Critérios do fluxo automático antigo (não instalado no host atual)

### ❌ Não Fazer

1. **Não remover arquivos antes de confirmar a operação no banco**: Sempre
   buscar o equipamento primeiro
2. **Não bloquear operações no banco por erros no Storage**: Logar erros mas
   continuar
3. **Não assumir formato de URL**: Sempre validar e extrair o caminho
   corretamente

### ✅ Sempre Fazer

1. **Sempre buscar equipamento existente**: Para comparar imagens antigas vs
   novas
2. **Sempre validar URLs**: Usar `extractFilePathFromSupabaseUrl` antes de
   remover
3. **Sempre logar operações**: Para facilitar debugging e auditoria
4. **Sempre processar erros**: Não deixar falhas silenciosas

## 🧪 Testando

### Teste manual: critério original e lacuna atual, somente em ambiente autorizado

O critério original continua sendo remover arquivos físicos junto da edição e
exclusão. A fonte atual não compõe esse efeito; validar somente a linha no banco
não fecha o teste abaixo. Provedor e manutenção precisam de prova própria.

1. **Criar equipamento com imagens**:
   - Criar novo equipamento via admin
   - Adicionar 2-3 imagens
   - Verificar que aparecem no Supabase Storage

2. **Remover uma imagem**:
   - Editar o equipamento
   - Remover uma imagem
   - Salvar
   - Verificar o array persistido e a remoção física esperada no Storage; a
     fonte atual só compõe o primeiro efeito, portanto o segundo fica sem prova

3. **Deletar equipamento**:
   - Deletar o equipamento completamente
   - Verificar a linha excluída no tenant e a remoção física esperada de todas
     as imagens; a ausência desse segundo efeito mantém a lacuna funcional

### Script de Limpeza

Para limpeza operacional de órfãos, somente após escolher e autorizar o ambiente
administrativo descrito acima:

```bash
npx tsx scripts/cleanup-orphaned-images.ts
```

O script irá:

1. Listar todos os arquivos no Storage
2. Buscar todas as imagens referenciadas no banco
3. Identificar arquivos órfãos
4. Remover arquivos órfãos em lotes

## 📊 Monitoramento

### Logs

O utilitário/script gera logs de suas operações. Os exemplos antigos abaixo não
são logs esperados do PUT/DELETE atual:

- `✅ X imagem(ns) removida(s) do Storage` - Sucesso
- `❌ Erro ao remover imagens do Storage` - Falhas (não críticas)

### Métricas

Verificar periodicamente:

- Tamanho do bucket `gb-locacoes-images` no Supabase
- Número de arquivos no Storage vs número de imagens no banco
- Avaliar manutenção de órfãos em ambiente autorizado; não há agendamento
  automático instalado por esse documento

## 🔄 Melhorias Futuras

1. **Job agendado**: Executar limpeza automática periodicamente
2. **Relatório de uso**: Dashboard mostrando uso de Storage
3. **Alertas**: Notificações quando uso de Storage está alto
4. **Backup**: Opção de fazer backup antes de remover arquivos

## 📚 Referências

- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Storage API Reference](https://supabase.com/docs/reference/javascript/storage-from-remove)

---

**Registro histórico**: 2025-12-16 **Versão**: 1.0.0 (fluxo automático antigo).
**Estado atual após F**: utilitário/script operacional preservados; PUT/DELETE
canônicos sem limpeza física automática. Nenhum Storage real foi validado nesta
revisão.
