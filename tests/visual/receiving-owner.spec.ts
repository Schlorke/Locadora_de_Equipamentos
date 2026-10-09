import path from 'node:path'
import { test, expect } from 'playwright/test'
import { APP_ORIGIN } from './support/env.mjs'
import { apiResponse } from './support/fixtures.mjs'

/**
 * Onda 134 (S9): pedido da conta de recebimentos no host web real (Chromium, 390 e 1440 px), com APIs simuladas.
 * Não substitui a prova HTTP dos dois backends; confere a tela: ordem dos cartões (D-1), valor só digitado, envio
 * único do contrato exato e ausência de rolagem horizontal.
 */
const offer = {
  available: true,
  blocker: null,
  model: 'STANDARD',
  company: {
    legalName: 'Locadora Alfa Ltda',
    cnpj: '11.222.333/0001-81',
    companyType: 'LIMITED',
    loginEmail: 'dono@example.test',
    email: 'contato@example.test',
    address: {
      street: 'Rua Sintetica',
      number: '100',
      complement: null,
      district: 'Centro',
      postalCode: '01001000',
    },
    site: 'https://loc-a.locadora.example.test',
  },
  suggestedMobilePhone: '11987654321',
  companyDataVersion: 'a'.repeat(64),
  lastRequestOutcome: null,
}
const unavailable = {
  available: false,
  blocker: 'CREATION_UNAVAILABLE',
  model: null,
  company: null,
  suggestedMobilePhone: null,
  companyDataVersion: null,
  lastRequestOutcome: null,
}
const provisioning = {
  kind: 'STANDARD',
  status: 'PROVISIONING',
  environment: 'sandbox',
  healthIssue: null,
  providerStatusText: null,
  commercialInfoExpiresAt: null,
  commercialInfoExpired: false,
  approvedAt: null,
  lastSyncedAt: null,
}

test.describe('conta de recebimentos do dono', () => {
  for (const creation of ['available', 'unavailable'] as const)
    test(`criação ${creation === 'available' ? 'disponível' : 'indisponível'}`, async ({
      page,
    }, info) => {
      let accepted = false
      const posts: (string | null)[] = []
      await page.route('**/*', async (route) => {
        const request = route.request(),
          url = new URL(request.url())
        if (url.pathname === '/api/admin/payment-account/create') {
          if (request.method() === 'POST') {
            posts.push(request.postData())
            accepted = true
            return route.fulfill({ status: 202, json: { accepted: true } })
          }
          return route.fulfill({
            json: creation === 'available' ? offer : unavailable,
          })
        }
        if (url.pathname === '/api/admin/payment-account')
          return route.fulfill({
            json: { account: accepted ? provisioning : null },
          })
        if (url.pathname.startsWith('/api/')) {
          const answer = apiResponse({
            method: request.method(),
            pathname: url.pathname,
            session: 'admin',
          })
          return route.fulfill({
            status: answer?.status ?? 404,
            json: answer?.body ?? {},
          })
        }
        if (url.host !== new URL(APP_ORIGIN).host) return route.abort()
        return route.continue()
      })
      await page.goto(APP_ORIGIN + '/admin/recebimentos')
      const connect = page.getByRole('button', {
        name: 'Conectar conta própria',
        exact: true,
      })
      await expect(connect).toBeVisible()
      const start = page.getByRole('button', {
        name: 'Começar pedido',
        exact: true,
      })
      if (creation === 'unavailable') {
        // Criação desligada: a página é a de antes, só com a conexão de conta própria.
        await expect(start).toHaveCount(0)
        await expect(
          page.getByText('Criar conta de recebimentos', { exact: true })
        ).toHaveCount(0)
        return
      }
      const startBox = await start.boundingBox()
      const connectBox = await connect.boundingBox()
      expect(startBox!.y).toBeLessThan(connectBox!.y)
      await start.click()
      const income = page.getByLabel('Faturamento mensal da empresa')
      const send = page.getByRole('button', {
        name: 'Criar conta de recebimentos',
        exact: true,
      })
      await page
        .getByRole('checkbox', {
          name: 'Confirmo que os dados da empresa acima estão corretos',
        })
        .check()
      await income.focus()
      await income.blur()
      await expect(
        page.getByText('Informe o faturamento mensal.')
      ).toBeVisible()
      await expect(send).toBeDisabled()
      await income.click()
      await page.keyboard.type('9876543')
      await expect(
        page.getByText('Faturamento informado: R$ 98.765,43')
      ).toBeVisible()
      await expect(page.getByLabel('Celular para contato')).toHaveValue(
        '11987654321'
      )
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth + 1
        )
      ).toBe(true)
      await page.screenshot({
        path: path.join(
          process.env.TEMP!,
          `locadora-wave134-recebimentos-${info.project.name}.png`
        ),
        animations: 'disabled',
        fullPage: true,
      })
      await send.click()
      await expect(
        page.getByText(
          'Pedido recebido. A criação está em andamento; acompanhe a situação abaixo.'
        )
      ).toBeVisible()
      await expect(page.getByText('Criação em andamento')).toBeVisible()
      expect(posts).toEqual([
        JSON.stringify({
          incomeValue: '98765.43',
          mobilePhone: '11987654321',
          companyDataConfirmed: true,
          companyDataVersion: 'a'.repeat(64),
        }),
      ])
    })
})
