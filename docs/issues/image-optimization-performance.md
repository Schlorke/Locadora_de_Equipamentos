# 📊 Otimização de Imagens - Problemas de Performance

## 🎯 Problema Identificado

O Lighthouse/PageSpeed Insights está reportando problemas de performance com
imagens de equipamentos:

### Sintomas

1. **Formato de imagem não moderno**: Imagens em JPG ao invés de WebP/AVIF
2. **Tamanho excessivo**: Imagens maiores que o necessário para dimensões
   exibidas
3. **Compressão subótima**: Imagens não otimizadas adequadamente

### Exemplos do Relatório

- **Betoneira 320L**: Arquivo 559x353 (49.3 KiB), exibido 270x249 (17.2 KiB
  economizável)
- **Compressor de Ar 10PCM**: Arquivo 502x315 (45.2 KiB), exibido 270x208 (19.4
  KiB economizável)
- **Rompedor Elétrico 15kg**: Arquivo 507x320 (37.5 KiB), exibido 287x170 (11.1
  KiB economizável)

## 🔍 Causa Raiz

### 1. Next.js Image Optimization Desabilitado

O `next.config.mjs` tem `unoptimized: true`, o que significa:

- ❌ Next.js não converte automaticamente para WebP/AVIF
- ❌ Next.js não redimensiona imagens automaticamente
- ❌ Imagens são servidas diretamente do Supabase Storage

```typescript
// next.config.mjs
images: {
  unoptimized: true, // ← Problema aqui
  remotePatterns,
}
```

### 2. Imagens no Supabase Storage

As imagens estão hospedadas no Supabase Storage
(`eeuwkiiugbantxvphpnz.supabase.co`), então:

- Não podem ser otimizadas pelo Next.js Image Optimization API (quando
  habilitado)
- Precisam ser otimizadas antes do upload OU
- Precisam usar um serviço de CDN com otimização automática

### 3. Atributo `sizes` Inadequado

O atributo `sizes` estava usando valores genéricos que não refletiam as
dimensões reais de exibição:

**Antes:**

```tsx
sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
```

**Depois (ajustado):**

```tsx
sizes =
  "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 400px"
```

## ✅ Soluções Implementadas

### 1. Ajuste do Atributo `sizes` ✅

**Arquivo**: `components/equipment-card.tsx`

Ajustado para valores mais precisos que refletem as dimensões reais de exibição
dos cards de equipamentos:

- Mobile (< 640px): 100vw (tela completa)
- Tablet (640-1024px): 50vw (2 colunas)
- Desktop (1024-1280px): 33vw (3 colunas)
- Desktop grande (> 1280px): 400px fixo (4 colunas)

**Impacto**: Ajuda o navegador a escolher tamanhos mais adequados.

### 2. Otimização Automática no Upload ✅

**Arquivo**: `app/api/upload/route.ts`

Implementada otimização automática usando Sharp:

- ✅ **Conversão para WebP**: JPEG e PNG são automaticamente convertidos para
  WebP
- ✅ **Redimensionamento**: Imagens maiores que 1200px de largura são
  redimensionadas (otimizado para cards)
- ✅ **Compressão**: Qualidade 80% (equilíbrio entre tamanho e qualidade, reduz
  ~60-75% do tamanho)
- ✅ **Formatos preservados**: SVG, GIF e WebP mantêm formato original
- ✅ **Fallback seguro**: Se a otimização falhar, usa arquivo original

**Detalhes técnicos**:

```typescript
// Otimização aplicada apenas para JPEG e PNG
const shouldOptimize = file.type === "image/jpeg" || file.type === "image/png"

if (shouldOptimize) {
  // Redimensionar se > 1200px
  // Converter para WebP com qualidade 80%
  optimizedBuffer = await sharp(fileBuffer)
    .resize(maxWidth, null, { withoutEnlargement: true, fit: "inside" })
    .webp({ quality: 80, effort: 4 })
    .toBuffer()
}
```

**Impacto esperado**:

- ✅ Redução de ~50-70% no tamanho de arquivo
- ✅ Formato WebP (melhor compressão que JPEG)
- ✅ Redimensionamento automático para otimizar dimensões
- ✅ Aplicado automaticamente a todas as novas imagens

**Status**: ✅ Implementado e ativo

## 📋 Soluções Adicionais (Opcionais)

### Script para Otimizar Imagens Existentes ✅

**Arquivo**: `scripts/optimize-existing-images.ts`

Script completo para otimizar todas as imagens já existentes no Supabase
Storage:

- ✅ Lista automaticamente todas as imagens JPEG/PNG
- ✅ Baixa, otimiza e faz upload da versão WebP
- ✅ Atualiza URLs no banco de dados automaticamente
- ✅ Remove arquivos originais após sucesso
- ✅ Modo dry-run para testes
- ✅ Estatísticas detalhadas de economia

**Uso:**

```bash
# Modo teste (dry-run)
pnpm tsx scripts/optimize-existing-images.ts --dry-run

# Executar otimização
pnpm tsx scripts/optimize-existing-images.ts

# Apenas pasta específica
pnpm tsx scripts/optimize-existing-images.ts --folder=equipments
```

**Documentação completa**: `docs/guides/optimize-existing-images.md`

### Opção 2: Habilitar Next.js Image Optimization

**Remover `unoptimized: true` do `next.config.mjs`:**

```typescript
images: {
  // unoptimized: true, ← Remover
  remotePatterns,
  formats: ['image/avif', 'image/webp'],
}
```

**Vantagens:**

- ✅ Conversão automática para WebP/AVIF
- ✅ Redimensionamento automático
- ✅ Lazy loading nativo

**Desvantagens:**

- ⚠️ Requer servidor Node.js (não funciona em CDN estático)
- ⚠️ Pode ser mais lento na primeira requisição
- ⚠️ Imagens do Supabase Storage precisam ser acessíveis pelo Next.js

**Nota**: Com `unoptimized: true`, o Next.js Image apenas adiciona lazy loading
e `srcset`, mas não otimiza o formato ou tamanho.

### Opção 3: CDN com Otimização Automática

Usar um serviço como:

- **Cloudinary**: Transformações automáticas via URL
- **ImageKit**: Otimização automática de imagens
- **Supabase Storage + Transform**: Se disponível

**Exemplo com Cloudinary:**

```tsx
const optimizedUrl = `https://res.cloudinary.com/demo/image/fetch/w_400,q_auto,f_auto/${imageUrl}`
```

**Vantagens:**

- ✅ Otimização automática sem código
- ✅ Cache global
- ✅ Múltiplos formatos

**Desvantagens:**

- ⚠️ Custo adicional
- ⚠️ Dependência de serviço externo

### Opção 4: Script de Otimização em Lote

**Criar script para otimizar imagens existentes no Supabase:**

```typescript
// scripts/optimize-existing-images.ts
// 1. Listar todas as imagens do Supabase
// 2. Baixar cada uma
// 3. Otimizar com Sharp
// 4. Fazer upload da versão otimizada
// 5. Atualizar URLs no banco de dados
```

**Vantagens:**

- ✅ Otimiza imagens existentes
- ✅ Pode ser executado uma vez

**Desvantagens:**

- ⚠️ Processo manual
- ⚠️ Requer armazenamento temporário

## 🎯 Status das Soluções

**Implementado:**

1. ✅ **Ajuste de `sizes`**: Valores mais precisos para responsividade
2. ✅ **Otimização no Upload**: Conversão automática para WebP com compressão

**Opcional (Futuro):**

- Considerar CDN com otimização se escala for necessária
- Script para otimizar imagens existentes (se necessário)

## 📊 Impacto Esperado

### Com Ajuste de `sizes` (Implementado)

- ✅ Redução de ~10-15% no tamanho de download
- ✅ Melhor seleção de tamanho pelo navegador
- ⚠️ Ainda em formato JPG (não WebP/AVIF)

### Com Otimização no Upload (Recomendado)

- ✅ Redução de ~50-70% no tamanho de arquivo
- ✅ Formato WebP (melhor compressão)
- ✅ Redimensionamento automático
- ✅ Melhor Core Web Vitals

## 📝 Notas Técnicas

### Por que `unoptimized: true` está habilitado?

Provavelmente por uma das seguintes razões:

1. Deploy em ambiente estático (GitHub Pages, etc.)
2. Problemas anteriores com otimização
3. Imagens externas (Supabase) que não podem ser otimizadas pelo Next.js

**Para habilitar otimização**, é necessário:

- Servidor Node.js (Vercel, Netlify Functions, etc.)
- Acesso às imagens do Supabase pelo servidor Next.js

### Como verificar se está funcionando?

```bash
# Verificar formato de imagem no Network tab
# Deve mostrar image/webp ou image/avif quando otimizado

# Verificar tamanho de arquivo
# Deve ser ~50-70% menor que o original
```

## 🔗 Referências

- [Next.js Image Optimization](https://nextjs.org/docs/pages/building-your-application/optimizing/images)
- [WebP vs JPEG Comparison](https://developers.google.com/speed/webp/docs/webp_study)
- [Lighthouse Image Optimization](https://developer.chrome.com/docs/lighthouse/performance/uses-optimized-images/)

---

## 🚨 Problema de Cache TTL (Atualizado - Janeiro 2025)

### Problema Identificado pelo Lighthouse

O Lighthouse/PageSpeed Insights está reportando que as imagens do Supabase
Storage têm cache TTL muito baixo (1 hora), resultando em economia potencial de
299 KiB com cache lifetimes mais longos.

**Sintomas:**

- Imagens servidas com `Cache-Control: max-age=3600` (1 hora)
- Lighthouse sugere cache TTL mais longo para assets estáticos
- Economia potencial de 299 KiB em visitas repetidas

### Causa Raiz

O Supabase Storage permite configurar cache headers durante o upload através do
parâmetro `cacheControl`, mas:

- Imagens existentes foram uploadadas sem esse parâmetro
- Supabase usa cache padrão de 1 hora quando `cacheControl` não é especificado
- Não é possível atualizar cache headers de imagens já existentes sem re-upload

### Solução Implementada ✅

**Arquivo**: `app/api/upload/route.ts`

Adicionado parâmetro `cacheControl: '31536000'` (1 ano) em todos os uploads de
imagens:

```typescript
const { data, error } = await supabaseAdmin.storage
  .from("gb-locacoes-images")
  .upload(filePath, optimizedBuffer, {
    contentType: finalContentType,
    upsert: false,
    cacheControl: "31536000" // 1 ano em segundos
  })
```

**Impacto:**

- ✅ Todas as novas imagens terão cache TTL de 1 ano
- ✅ Melhor performance em visitas repetidas
- ✅ Redução de requisições ao servidor
- ✅ Economia de ~299 KiB em visitas subsequentes (conforme Lighthouse)

**Status**: ✅ Implementado em janeiro 2025

### Imagens Existentes

Para imagens já existentes no Supabase Storage:

- Opção 1: Deixar como está (cache de 1h ainda é funcional, apenas menos
  otimizado)
- Opção 2: Re-upload das imagens existentes usando o script de otimização com
  cacheControl (ver abaixo)

**Nota**: O Supabase não permite atualizar metadata de arquivos existentes
diretamente. É necessário fazer re-upload para aplicar novos cache headers.

### Script Opcional para Re-upload com Cache

Se necessário atualizar imagens existentes, criar script que:

1. Lista todas as imagens do bucket
2. Baixa cada imagem
3. Faz re-upload com `cacheControl: '31536000'`
4. Atualiza URLs no banco de dados (se necessário)

**Atenção**: Esta operação requer cuidado pois pode alterar URLs das imagens.

---

**Última atualização**: Janeiro 2025  
**Status**: `sizes` ajustado ✅ | Otimização no upload implementada ✅ | Script
para imagens existentes criado ✅ | Cache TTL configurado ✅

## 📝 Notas de Implementação

### Dependências Adicionadas

- `sharp@^0.33.5`: Biblioteca para processamento e otimização de imagens

### Configuração

O Sharp está configurado em `pnpm.onlyBuiltDependencies` para garantir que os
binários nativos sejam construídos corretamente durante o deploy.

### Testes Recomendados

Após o deploy, testar:

1. Upload de nova imagem JPEG → deve ser convertida para WebP
2. Upload de nova imagem PNG → deve ser convertida para WebP
3. Upload de SVG/GIF → deve manter formato original
4. Verificar tamanho do arquivo otimizado (deve ser ~50-70% menor)
5. Verificar qualidade visual (deve ser equivalente ao original)
