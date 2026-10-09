import path from 'node:path'
import { test, expect } from 'playwright/test'
import { SUBSCRIPTION_STATUSES } from '@gb-locacoes/contracts/subscription'
import {
  invoiceFixture,
  subscriptionFixture,
  subscriptionOfferFixture,
} from '../helpers/subscription-account'
import { APP_ORIGIN } from './support/env.mjs'
import { apiResponse } from './support/fixtures.mjs'

/** Renderização no host real, com identidade/dados sintéticos; não substitui a prova RLS da onda 104. */
test.describe('assinatura do dono', () => {
  test('reativação escolhe oferta, confirma sem teste e repete intenção incerta com mesma versão/chave', async ({
    page,
  }, info) => {
    let accepted = false
    const commands: { body: string | null; key: string | undefined }[] = []
    await page.route('**/*', async (route) => {
      const request = route.request(),
        url = new URL(request.url())
      if (url.pathname === '/api/public/plans')
        return route.fulfill({
          json: {
            plans: [
              subscriptionOfferFixture(),
              subscriptionOfferFixture({
                planVersionId: 'other-offer',
                name: 'Outra oferta de teste',
                amount: '249.90',
              }),
            ],
          },
        })
      if (url.pathname === '/api/admin/subscription/reactivate') {
        commands.push({
          body: request.postData(),
          key: request.headers()['idempotency-key'],
        })
        if (commands.length === 1)
          return route.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } })
        accepted = true
        return route.fulfill({ json: { accepted: true } })
      }
      if (url.pathname === '/api/admin/subscription')
        return route.fulfill({
          json: {
            ...subscriptionFixture(accepted ? 'INCOMPLETE' : 'CANCELED'),
            trialEndsAt: null,
          },
        })
      if (url.pathname === '/api/admin/subscription/invoices')
        return route.fulfill({
          json: {
            invoices: [
              invoiceFixture({
                status: 'PAID',
                paidAt: '2026-10-02T12:00:00Z',
              }),
            ],
          },
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
    await page.goto(APP_ORIGIN + '/admin/assinatura')
    const reactivate = page.getByRole('button', {
      name: 'Reativar assinatura',
      exact: true,
    })
    await expect(
      page.getByRole('radiogroup', { name: 'Plano para reativação' })
    ).toBeVisible()
    await expect(reactivate).toBeDisabled()
    await page.getByRole('radio', { name: /Plano de teste/ }).check()
    await reactivate.click()
    await expect(
      page.getByText(
        /plano Plano de teste por R\$ 199,90 por mês, sem novo período de teste/
      )
    ).toBeVisible()
    expect(commands).toHaveLength(0)
    await page.getByRole('button', { name: 'Voltar', exact: true }).click()
    await expect(reactivate).toBeFocused()
    await page.getByRole('radio', { name: /Outra oferta de teste/ }).check()
    await reactivate.click()
    await expect(
      page.getByText(/Outra oferta de teste por R\$ 249,90 por mês/)
    ).toBeVisible()
    await page.screenshot({
      path: path.join(
        process.env.TEMP!,
        `locadora-wave111-reativacao-${info.project.name}.png`
      ),
      animations: 'disabled',
    })
    await page.getByRole('button', { name: 'Confirmar reativação' }).click()
    await expect(
      page.getByRole('button', { name: 'Repetir o mesmo pedido' })
    ).toBeVisible()
    await page.getByRole('button', { name: 'Voltar', exact: true }).click()
    await expect(reactivate).toBeFocused()
    await expect(
      page.getByRole('radio', { name: /Plano de teste/ })
    ).toBeDisabled()
    expect(commands).toHaveLength(1)
    await reactivate.click()
    await page.getByRole('button', { name: 'Repetir o mesmo pedido' }).click()
    await expect(
      page.getByText(/Pedido de reativação registrado/)
    ).toBeVisible()
    await expect(page.getByText('Incompleta', { exact: true })).toBeVisible()
    await expect(page.getByText('Paga', { exact: true })).toBeVisible()
    await expect(page.getByText('Ativa', { exact: true })).toHaveCount(0)
    expect(commands).toHaveLength(2)
    expect(commands[0]!.body).toBe('{"planVersionId":"other-offer"}')
    expect(commands[0]!.key).toBeTruthy()
    expect(commands[1]).toEqual(commands[0])
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth + 1
      )
    ).toBe(true)
  })
  test('ativação confirma o plano, preserva foco e a mesma chave na repetição; accepted não confirma pagamento', async ({
    page,
  }, info) => {
    let accepted = false
    const commands: {
      path: string
      key: string | undefined
      body: string | null
    }[] = []
    await page.route('**/*', async (route) => {
      const request = route.request(),
        url = new URL(request.url())
      if (url.pathname === '/api/admin/subscription/activate') {
        commands.push({
          path: url.pathname,
          key: request.headers()['idempotency-key'],
          body: request.postData(),
        })
        if (commands.length === 1)
          return route.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } })
        accepted = true
        return route.fulfill({ json: { accepted: true } })
      }
      if (url.pathname === '/api/admin/subscription')
        return route.fulfill({ json: subscriptionFixture('TRIALING') })
      if (url.pathname === '/api/admin/subscription/invoices')
        return route.fulfill({
          json: { invoices: accepted ? [invoiceFixture()] : [] },
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
    await page.goto(APP_ORIGIN + '/admin/assinatura')
    const activate = page.getByRole('button', {
      name: 'Ativar assinatura',
      exact: true,
    })
    await activate.click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await expect(
      page.getByText(/plano Plano de teste por R\$ 199,90/)
    ).toBeVisible()
    await expect(
      page.getByText(/O pagamento é confirmado separadamente/)
    ).toBeVisible()
    expect(commands).toHaveLength(0)
    await page.getByRole('button', { name: 'Voltar', exact: true }).click()
    await expect(activate).toBeFocused()
    await activate.click()
    await page.screenshot({
      path: path.join(
        process.env.TEMP!,
        `locadora-wave109-ativacao-${info.project.name}.png`
      ),
      animations: 'disabled',
    })
    await page.getByRole('button', { name: 'Confirmar ativação' }).click()
    await expect(
      page.getByRole('button', { name: 'Repetir o mesmo pedido' })
    ).toBeVisible()
    expect(commands).toHaveLength(1)
    await page.getByRole('button', { name: 'Voltar', exact: true }).click()
    await expect(activate).toBeFocused()
    await expect(
      page.getByRole('button', { name: 'Cancelar assinatura', exact: true })
    ).toBeDisabled()
    await activate.click()
    await page.getByRole('button', { name: 'Repetir o mesmo pedido' }).click()
    await expect(
      page.getByText(
        'Pedido de ativação registrado. Consulte as faturas; o pagamento ainda precisa ser confirmado.'
      )
    ).toBeVisible()
    await expect(page.getByText('Pendente', { exact: true })).toBeVisible()
    await expect(page.getByText('Em teste', { exact: true })).toBeVisible()
    expect(commands).toHaveLength(2)
    expect(commands[0]!.key).toBeTruthy()
    expect(commands[1]!.key).toBe(commands[0]!.key)
    expect(
      commands.every(
        (command) =>
          command.body === '{}' &&
          command.path === '/api/admin/subscription/activate'
      )
    ).toBe(true)
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth + 1
      )
    ).toBe(true)
  })
  test('confirmar, repetir pedido incerto e reler; autenticação antiga requer nova confirmação', async ({
    page,
  }, info) => {
    let scheduled = false
    const commands: { path: string; key: string | undefined }[] = []
    await page.route('**/*', async (route) => {
      const request = route.request(),
        url = new URL(request.url())
      if (url.pathname === '/api/admin/subscription/cancel') {
        commands.push({
          path: url.pathname,
          key: request.headers()['idempotency-key'],
        })
        if (commands.length === 1)
          return route.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } })
        scheduled = true
        return route.fulfill({ json: { accepted: true } })
      }
      if (url.pathname === '/api/admin/subscription/undo-cancel') {
        commands.push({
          path: url.pathname,
          key: request.headers()['idempotency-key'],
        })
        return route.fulfill({
          status: 401,
          json: { code: 'FRESH_SESSION_REQUIRED' },
        })
      }
      if (url.pathname === '/api/admin/subscription')
        return route.fulfill({
          json: { ...subscriptionFixture(), cancelAtPeriodEnd: scheduled },
        })
      if (url.pathname === '/api/admin/subscription/invoices')
        return route.fulfill({ json: { invoices: [] } })
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
    await page.goto(APP_ORIGIN + '/admin/assinatura')
    await page
      .getByRole('button', { name: 'Cancelar assinatura', exact: true })
      .click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    expect(commands).toHaveLength(0)
    await expect(
      page.getByText(/Faturas e dívidas existentes não serão apagadas/)
    ).toBeVisible()
    await page.screenshot({
      path: path.join(
        process.env.TEMP!,
        `locadora-wave107-confirmacao-${info.project.name}.png`
      ),
      animations: 'disabled',
    })
    await page
      .getByRole('button', { name: 'Confirmar cancelamento', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'Repetir o mesmo pedido' })
    ).toBeVisible()
    expect(commands).toHaveLength(1)
    await page.getByRole('button', { name: 'Repetir o mesmo pedido' }).click()
    await expect(
      page.getByText(
        'Pedido registrado. Confira o estado atualizado da assinatura.'
      )
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Desfazer cancelamento', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Confirmar desfazimento', exact: true })
      .click()
    const reauthenticate = page.getByRole('link', { name: 'Entrar novamente' })
    await expect(reauthenticate).toBeVisible()
    expect(commands).toHaveLength(3)
    expect(commands[0]!.key).toBeTruthy()
    expect(commands[1]!.key).toBe(commands[0]!.key)
    const href = new URL(
      (await reauthenticate.getAttribute('href')) ?? '',
      APP_ORIGIN
    )
    expect(href.searchParams.get('reauthenticate')).toBe('1')
    expect([...href.searchParams.keys()].sort()).toEqual([
      'callbackUrl',
      'reauthenticate',
    ])
    await reauthenticate.click()
    await expect(
      page.getByText('Confirme sua identidade', { exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Entrar no Sistema' })
    ).toBeVisible()
    expect(commands).toHaveLength(3)
    await page.screenshot({
      path: path.join(
        process.env.TEMP!,
        `locadora-wave107-reauth-${info.project.name}.png`
      ),
      fullPage: true,
      animations: 'disabled',
    })
  })
  for (const status of SUBSCRIPTION_STATUSES) {
    test(`${status}: estado, fatura e largura responsiva`, async ({
      page,
    }, info) => {
      const methods: string[] = []
      await page.route('**/*', async (route) => {
        const request = route.request(),
          url = new URL(request.url())
        if (url.pathname.startsWith('/api/')) {
          methods.push(request.method())
          if (url.pathname === '/api/admin/subscription')
            return route.fulfill({ json: subscriptionFixture(status) })
          if (url.pathname === '/api/admin/subscription/invoices')
            return route.fulfill({ json: { invoices: [invoiceFixture()] } })
          const answer = apiResponse({
            method: request.method(),
            pathname: url.pathname,
            session: 'admin',
          })
          return route.fulfill({
            status: answer?.status ?? 404,
            json: answer?.body ?? { error: 'Sem fixture' },
          })
        }
        if (url.host !== new URL(APP_ORIGIN).host) return route.abort()
        return route.continue()
      })
      await page.goto(APP_ORIGIN + '/admin/assinatura')
      await expect(
        page.getByRole('heading', { name: 'Assinatura', exact: true })
      ).toBeVisible()
      await expect(
        page.getByText('Plano de teste', { exact: true })
      ).toBeVisible()
      await expect(
        page.getByText('R$ 199,90 / mês', { exact: true })
      ).toBeVisible()
      const link = page.getByRole('link', { name: /Ver fatura no Asaas/ })
      await expect(link).toHaveAttribute(
        'href',
        'https://www.asaas.com/i/fixture'
      )
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      await expect(link).toHaveAttribute('referrerpolicy', 'no-referrer')
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth + 1
        )
      ).toBe(true)
      expect(methods.every((method) => method === 'GET')).toBe(true)
      if (status === 'PAST_DUE') {
        await page.screenshot({
          path: path.join(
            process.env.TEMP!,
            `locadora-wave105-assinatura-${info.project.name}.png`
          ),
          fullPage: true,
          animations: 'disabled',
        })
      }
    })
  }
  test('recusa de dono esconde plano e faturas em vez de inferir ADMIN', async ({
    page,
  }) => {
    await page.route('**/api/**', async (route) => {
      const request = route.request(),
        pathname = new URL(request.url()).pathname
      const answer = apiResponse({
        method: request.method(),
        pathname,
        session: 'admin',
      })
      await route.fulfill({
        status: answer?.status ?? 404,
        json: answer?.body ?? {},
      })
    })
    await page.goto(APP_ORIGIN + '/admin/assinatura')
    await expect(
      page.getByText('Esta consulta é exclusiva do dono atual da locadora.')
    ).toBeVisible()
    await expect(page.getByRole('link', { name: /Asaas/ })).toHaveCount(0)
    await expect(page.getByText('Plano atual', { exact: true })).toHaveCount(0)
  })
})
