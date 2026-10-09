import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
it('os dois clientes e o legado montam uma única slice por condição de runtime', () => {
  const read = (path: string) =>
    readFileSync(new URL(path, import.meta.url), 'utf8')
  expect(read('./index.ts')).toContain('./ui/AssinaturaPage.web')
  expect(read('./index.native.ts')).toContain('./ui/AssinaturaPage.native')
  for (const path of [
    '../../../../../apps/clients/web/src/app/(admin)/admin/assinatura/page.tsx',
    '../../../../../app/admin/assinatura/page.tsx',
    '../../../../../apps/clients/mobile/src/app/(admin)/admin/assinatura.tsx',
  ]) {
    const source = read(path)
    expect(source).toContain('@gb-locacoes/frontend/pages/assinatura-admin')
    expect(source).not.toMatch(/prisma|fetch\(|invoice|entitlements|!important/)
  }
})
