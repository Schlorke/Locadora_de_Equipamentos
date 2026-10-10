import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Configurações admin', () => {
  // Achado 143: o teste anterior afirmava o contato, o endereço e o nome da GB como padrão do formulário e dos
  // previews de qualquer locadora (salvar gravava os dados da GB nas configurações de outra).
  it('mantém título, exemplos neutros nos campos e shell da rota, sem dados da GB', () => {
    const source = readFileSync(
      new URL('./ConfiguracoesPage.web.tsx', import.meta.url),
      'utf8'
    )
    expect(source).toContain('Configurações do Sistema')
    expect(source).toContain('Configurações Globais')
    expect(source).toContain('placeholder="(11) 3000-0000"')
    expect(source).toContain('placeholder="contato@sualocadora.com.br"')
    expect(source).toContain('placeholder="comercial@sualocadora.com.br"')
    expect(source).toContain("name: tenant?.tenant.name ?? ''")
    expect(source).toContain("name={tenant?.tenant.name ?? ''}")
    expect(source).toContain("timezone: 'America/Sao_Paulo'")
    expect(source).toContain('maxQuoteItems: 50')
    expect(source).toContain("activeSection === 'company'")
    expect(source).toContain("activeSection === 'hero'")
    expect(source).toContain("activeSection === 'system'")
    expect(source).toContain("activeSection === 'custom'")
    // Onda 134: horário, conteúdo do site, compromissos e textos legais da locadora.
    expect(source).toContain("activeSection === 'hours'")
    expect(source).toContain("activeSection === 'content'")
    expect(source).toContain("activeSection === 'commitments'")
    expect(source).toContain("activeSection === 'legal'")
    expect(source).toContain("from './TextosLegais.web'")
    expect(source).not.toMatch(/!important|![a-z-]+-\[|\b[a-z-]+!\s/)
    expect(source).toContain("from '../model/use-settings-data.web'")
    expect(source).toContain("from './SettingsBlock.web'")
    expect(source).toContain("from './SettingsNavigationBar.web'")
    expect(source).toContain("from './SettingsPreviews.web'")
    expect(source).toContain("from './HeroCarouselPreview.web'")
    expect(source).not.toContain(
      "from '../../../../../../components/admin/hero-carousel-preview'"
    )

    const headerFooter = readFileSync(
      new URL('./HeaderFooterPreview.web.tsx', import.meta.url),
      'utf8'
    )
    expect(headerFooter).toContain('Preview Header & Footer')
    expect(headerFooter).toContain(
      "contactEmail || 'contato@sualocadora.com.br'"
    )

    const heroPreview = readFileSync(
      new URL('./HeroCarouselPreview.web.tsx', import.meta.url),
      'utf8'
    )
    expect(heroPreview).toContain('Preview Hero Carousel')
    expect(heroPreview).toContain('Preview em Tempo Real')
    expect(heroPreview).not.toMatch(
      /equipment-3d-carousel|model-viewer|lazy-3d-carousel|scroll-reveal-init/
    )

    const hook = readFileSync(
      new URL('../model/use-settings-data.tsx', import.meta.url),
      'utf8'
    )
    expect(hook).toContain("const DEFAULT_COMPANY_PHONE = ''")
    expect(hook).toContain("const DEFAULT_COMPANY_ADDRESS = ''")

    const systemPreview = readFileSync(
      new URL('./SettingsPreviews.web.tsx', import.meta.url),
      'utf8'
    )
    expect(systemPreview).toContain('America/Sao_Paulo')
    expect(systemPreview).toContain("from './HeaderFooterPreview.web'")
    expect(systemPreview).not.toContain(
      "from '../../../../../../components/admin/header-footer-preview'"
    )

    // A rota do host web mantém a composição compartilhada.
    const webRoute = readFileSync(
      new URL(
        '../../../../../../apps/clients/web/src/app/(admin)/admin/settings/page.tsx',
        import.meta.url
      ),
      'utf8'
    )
    expect(webRoute).toMatch(
      /from\s+["']@gb-locacoes\/frontend\/pages\/configuracoes["']/
    )
    expect(webRoute).toContain('return <AdminConfiguracoesPage />')

    for (const file of [source, headerFooter, heroPreview, hook, systemPreview])
      expect(file).not.toMatch(
        /GB Loca|locacoesgb|2313-6262|99820-5163|Heinzelmann/
      )
  })
})
