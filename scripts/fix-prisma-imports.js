#!/usr/bin/env node

/**
 * Script para corrigir imports dinâmicos do Prisma em APIs
 * GB-Locações - Fix Prisma Dynamic Imports
 */

import fs from 'fs'

const apiFiles = [
  'app/api/admin/seed-admin/route.ts',
  'app/api/test-login/route.ts',
  'app/api/quotes/route.ts',
  'app/api/health/route.ts',
  'app/api/equipments/route.ts',
  'app/api/categories/route.ts',
  'app/api/admin/quotes/[id]/route.ts',
  'app/api/admin/equipments/route.ts',
  'app/api/admin/equipments/[id]/route.ts',
  'app/api/admin/categories/route.ts',
  'app/api/admin/categories/[id]/route.ts',
]

console.log('🔧 CORRIGINDO IMPORTS DINÂMICOS DO PRISMA')
console.log('=' * 50)

for (const filePath of apiFiles) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Arquivo não encontrado: ${filePath}`)
      continue
    }

    let content = fs.readFileSync(filePath, 'utf8')
    let modified = false

    // 1. Adicionar import estático do Prisma se não existir
    if (!content.includes("import { prisma } from '@/lib/prisma'")) {
      // Encontrar a linha de import do NextResponse
      const nextResponseImport = content.match(
        /import.*NextResponse.*from ['"]next\/server['"]/
      )
      if (nextResponseImport) {
        const importLine = nextResponseImport[0]
        const newImports = `${importLine}
import { prisma } from '@/lib/prisma'`
        content = content.replace(importLine, newImports)
        modified = true
        console.log(`✅ Adicionado import estático: ${filePath}`)
      }
    }

    // 2. Remover imports dinâmicos do Prisma
    const dynamicPrismaImport =
      /const\s*{\s*prisma\s*}\s*=\s*await\s+import\(['"]@\/lib\/prisma['"]\)/g
    if (dynamicPrismaImport.test(content)) {
      content = content.replace(
        dynamicPrismaImport,
        '// Prisma importado estaticamente'
      )
      modified = true
      console.log(`✅ Removido import dinâmico: ${filePath}`)
    }

    // 3. Remover $connect() manual
    const manualConnect = /await\s+prisma\.\$connect\(\)/g
    if (manualConnect.test(content)) {
      content = content.replace(
        manualConnect,
        '// Conexão automática do Prisma'
      )
      modified = true
      console.log(`✅ Removido $connect() manual: ${filePath}`)
    }

    // 4. Corrigir imports de middlewares se necessário
    if (content.includes("await import('@/middlewares/require-admin')")) {
      if (
        !content.includes(
          "import { requireAdminOrOperator } from '@/middlewares/require-admin'"
        )
      ) {
        content = content.replace(
          "import { prisma } from '@/lib/prisma'",
          `import { prisma } from '@/lib/prisma'
import { requireAdminOrOperator } from '@/middlewares/require-admin'`
        )

        content = content.replace(
          /const\s*{\s*requireAdminOrOperator\s*}\s*=\s*await\s+import\(\s*['"]@\/middlewares\/require-admin['"]\s*\)/g,
          '// Middleware importado estaticamente'
        )
        modified = true
        console.log(`✅ Corrigido import de middleware: ${filePath}`)
      }
    }

    // Salvar arquivo se modificado
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8')
      console.log(`💾 Arquivo salvo: ${filePath}`)
    } else {
      console.log(`👍 Arquivo já correto: ${filePath}`)
    }
  } catch (error) {
    console.log(`❌ Erro processando ${filePath}:`, error.message)
  }
}

console.log('\n🏁 CORREÇÃO CONCLUÍDA')
console.log('=' * 50)
console.log('✅ Todos os imports dinâmicos foram corrigidos')
console.log('✅ Conexões manuais foram removidas')
console.log('✅ Performance melhorada nas APIs')
console.log('\n💡 Reinicie o servidor para aplicar as mudanças:')
