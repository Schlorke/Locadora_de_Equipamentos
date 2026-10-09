#!/usr/bin/env node

/**
 * SCRIPT DE CONVERSÃO SVG → COMPONENTE REACT
 *
 * Converte arquivos SVG em componentes React prontos para uso
 * no sistema de ícones customizados do GB-Locações.
 *
 * Uso:
 *   node scripts/convert-svg-to-icon.cjs caminho/para/icone.svg NomeDoIcone
 *
 * Exemplo:
 *   node scripts/convert-svg-to-icon.cjs ./betoneira.svg Betoneira
 *
 * @author GB-Locações Team
 */

const fs = require('fs')
const path = require('path')

// Argumentos da linha de comando
const [, , svgPath, iconName] = process.argv

if (!svgPath || !iconName) {
  console.error(
    '❌ Uso: node scripts/convert-svg-to-icon.cjs <caminho-svg> <NomeDoIcone>'
  )
  console.error(
    '📝 Exemplo: node scripts/convert-svg-to-icon.cjs ./meu-icone.svg MeuIcone'
  )
  process.exit(1)
}

// Verifica se o arquivo existe
if (!fs.existsSync(svgPath)) {
  console.error(`❌ Arquivo não encontrado: ${svgPath}`)
  process.exit(1)
}

// Lê o conteúdo do SVG
let svgContent = fs.readFileSync(svgPath, 'utf8')

// Extrai o viewBox ou usa padrão
const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/)
const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 24 24'

// Extrai o conteúdo interno do SVG (entre tags <svg>)
const innerContent = svgContent
  .replace(/<svg[^>]*>/i, '')
  .replace(/<\/svg>/i, '')
  .trim()

// Limpa atributos problemáticos
let cleanedContent = innerContent
  // Remove IDs
  .replace(/\s*id="[^"]*"/g, '')
  // Remove xmlns extras
  .replace(/\s*xmlns:[^=]*="[^"]*"/g, '')
  // Remove classes desnecessárias
  .replace(/\s*class="[^"]*"/g, '')
  // Substitui fill por none ou currentColor
  .replace(/fill="(?!none)[^"]*"/g, 'fill="currentColor"')
  // Substitui stroke por currentColor (exceto "none")
  .replace(/stroke="(?!none)[^"]*"/g, 'stroke="{color}"')
  // Converte stroke-width para strokeWidth (camelCase)
  .replace(/stroke-width/g, 'strokeWidth')
  .replace(/stroke-linecap/g, 'strokeLinecap')
  .replace(/stroke-linejoin/g, 'strokeLinejoin')
  // Indenta para melhor legibilidade
  .split('\n')
  .map((line) => '    ' + line.trim())
  .filter((line) => line.trim())
  .join('\n')

// Gera o componente React
const componentCode = `export const ${iconName}: React.FC<CustomIconProps> = ({
  size = 24,
  color = 'currentColor',
  className = ''
}) => (
  <svg
    width={size}
    height={size}
    viewBox="${viewBox}"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
${cleanedContent}
  </svg>
)
${iconName}.displayName = '${iconName}'
`

// Exibe o resultado
console.log(
  '\n✅ Conversão concluída! Cole o código abaixo em components/icons/custom/index.tsx:\n'
)
console.log('─'.repeat(80))
console.log(componentCode)
console.log('─'.repeat(80))
console.log(`\n📝 Não esqueça de adicionar ao objeto CUSTOM_ICONS:`)
console.log(`
export const CUSTOM_ICONS = {
  // ... outros ícones
  ${iconName},
} as const
`)

// Salva em arquivo temporário para facilitar
const outputPath = path.join(__dirname, `${iconName}.component.txt`)
fs.writeFileSync(outputPath, componentCode)
console.log(`\n💾 Código salvo em: ${outputPath}`)
console.log('\n🎉 Pronto! Agora é só copiar e colar!')
