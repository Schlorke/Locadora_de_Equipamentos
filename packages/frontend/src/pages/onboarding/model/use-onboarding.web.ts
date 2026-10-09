'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CompanyDataSchema,
  CreateOrganizationInputSchema,
  REQUIRED_SIGNUP_DOCUMENTS,
  SignupSlugSchema,
  type OnboardingStep,
  type OnboardingOptionsResponse,
  type LegalDocumentKind,
  type CreateOrganizationResponse,
} from '@gb-locacoes/contracts/onboarding'
import { OwnerRegistrationSchema } from '@gb-locacoes/contracts/credentials'
import type { PublicPlan } from '@gb-locacoes/contracts/subscription'
import { useApiClient } from '../../../shared/api'
import { useSession } from '../../../entities/sessao'
import { readPublicMonthlyPlans } from '../../../entities/plano'
import { onboardingApi, OnboardingRequestError } from '../api/onboarding'
import {
  clearDraft,
  emptyCompany,
  readDraft,
  writeDraft,
  type CompanyForm,
  type OnboardingDraft,
} from './draft'
import type { OnboardingPageProps } from './contracts'

const storage = {
  getItem: (key: string) => window.localStorage.getItem(key),
  setItem: (key: string, value: string) =>
    window.localStorage.setItem(key, value),
  removeItem: (key: string) => window.localStorage.removeItem(key),
}
const messages: Record<string, string> = {
  SELF_SERVICE_SIGNUP_DISABLED: 'O cadastro está fechado. Fale com a gente.',
  PASSWORD_COMPROMISED:
    'Escolha outra senha. Essa senha apareceu em um vazamento.',
  PASSWORD_CHECK_UNAVAILABLE:
    'A verificação da senha está indisponível. Tente novamente.',
  CAPTCHA_REQUIRED: 'Conclua a verificação de segurança.',
  CAPTCHA_INVALID: 'Refaça a verificação de segurança.',
  EMAIL_NOT_VERIFIED: 'Confirme seu e-mail antes de continuar.',
  AUTHENTICATION_REQUIRED: 'Entre na sua conta para continuar.',
  INVALID_CNPJ: 'Confira o CNPJ informado.',
  SLUG_UNAVAILABLE: 'Este endereço não está disponível. Escolha outro.',
  PLAN_NOT_AVAILABLE: 'O plano mudou. Atualize as opções e escolha novamente.',
  LEGAL_DOCUMENT_CHANGED:
    'Os documentos mudaram. Atualize e leia os textos antes de aceitar.',
  ORGANIZATION_LIMIT_REACHED: 'Sua conta atingiu o limite de locadoras.',
  PLATFORM_STAFF_CANNOT_OWN_TENANT:
    'Esta conta não pode cadastrar uma locadora.',
  ONBOARDING_RATE_LIMITED:
    'Muitas tentativas. Aguarde antes de tentar novamente.',
}
export function useOnboarding(props: OnboardingPageProps) {
  const client = useApiClient()
  const session = useSession()
  const userId = session.data?.user.id ?? ''
  const currentUser = useRef(userId)
  currentUser.current = userId
  const generation = useRef(0)
  const lock = useRef(false)
  const resendAfter = useRef(0)
  const [options, setOptions] = useState<OnboardingOptionsResponse | null>(null)
  const [step, setStep] = useState<OnboardingStep>('ACCOUNT')
  const [access, setAccess] = useState({ name: '', email: '', password: '' })
  const [company, setCompany] = useState<CompanyForm>({ ...emptyCompany })
  const [slug, setSlug] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [plans, setPlans] = useState<PublicPlan[]>([])
  const [planVersionId, setPlanVersionId] = useState('')
  const [accepted, setAccepted] = useState<LegalDocumentKind[]>([])
  const [pending, setPending] = useState<OnboardingDraft['pending']>(null)
  const [receipt, setReceipt] = useState<CreateOrganizationResponse | null>(
    null
  )
  const [hydratedUser, setHydratedUser] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [resendAt, setResendAt] = useState(0)
  const [clock, setClock] = useState(0)
  const consumeCaptcha = () => {
    setToken(null)
    setAttempt((value) => value + 1)
  }
  const reloadOptions = useCallback(
    async (valid: () => boolean) => {
      const result = await onboardingApi.options(client)
      const offers =
        result.mode === 'on' ? await readPublicMonthlyPlans(client) : []
      if (!valid()) return
      setAccepted([])
      setOptions(result)
      setPlans(offers)
    },
    [client]
  )
  useEffect(() => {
    let disposed = false
    void onboardingApi
      .options(client)
      .then(async (result) => {
        if (disposed) return
        setOptions(result)
        if (result.mode === 'on') {
          const offers = await readPublicMonthlyPlans(client)
          if (!disposed) setPlans(offers)
        }
      })
      .catch(() => {
        if (!disposed)
          setError('Não foi possível carregar o cadastro. Tente novamente.')
      })
    return () => {
      disposed = true
    }
  }, [client])
  useEffect(() => {
    generation.current++
    lock.current = false
    setBusy(false)
    setError(null)
    setMessage(null)
    setStep(userId ? 'EMAIL_VERIFICATION' : 'ACCOUNT')
    setCompany({ ...emptyCompany })
    setSlug('')
    setSuggestions([])
    setPlanVersionId('')
    setPending(null)
    setReceipt(null)
    setAccepted([])
    setToken(null)
    setResendAt(0)
    resendAfter.current = 0
    setClock(0)
    setHydratedUser('')
    setAccess({ name: '', email: session.data?.user.email ?? '', password: '' })
    let disposed = false
    if (userId && options?.mode === 'on') {
      void onboardingApi
        .account(client)
        .then((account) => {
          if (disposed || account.userId !== userId) return
          if (!account.emailVerified) return
          const draft = readDraft(storage, userId)
          if (draft) {
            setCompany(draft.company)
            setSlug(draft.slug)
            setPlanVersionId(draft.planVersionId)
            setPending(draft.pending)
          }
          setHydratedUser(userId)
          setStep(draft?.pending ? 'CREATE' : 'COMPANY')
        })
        .catch(() => {
          if (!disposed)
            setError('Não foi possível conferir seu e-mail. Tente novamente.')
        })
    }
    return () => {
      disposed = true
    }
    // The owner id and publication mode delimit this journey; an updated display name is not a new identity.
  }, [userId, options?.mode, client])
  useEffect(() => {
    if (hydratedUser === userId && userId && !receipt)
      writeDraft(storage, userId, {
        version: 1,
        company,
        slug,
        planVersionId,
        pending,
      })
  }, [userId, hydratedUser, company, slug, planVersionId, pending, receipt])
  useEffect(() => {
    if (!resendAt) return
    const timer = setInterval(() => setClock(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [resendAt])
  useEffect(
    () => () => {
      generation.current++
    },
    []
  )
  const run = async (work: (valid: () => boolean) => Promise<void>) => {
    if (lock.current) return
    const gen = generation.current,
      owner = userId
    const valid = () =>
      gen === generation.current && owner === currentUser.current
    lock.current = true
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await work(valid)
    } catch (problem) {
      if (valid())
        setError(
          problem instanceof OnboardingRequestError
            ? (messages[problem.code] ??
                'Não foi possível concluir esta etapa. Tente novamente.')
            : 'Não foi possível concluir esta etapa. Tente novamente.'
        )
    } finally {
      if (valid()) {
        lock.current = false
        setBusy(false)
      }
    }
  }
  const register = () =>
    run(async (valid) => {
      const parsed = OwnerRegistrationSchema.safeParse(access)
      if (!parsed.success) {
        setError(
          'Confira nome, e-mail e senha: no mínimo dez caracteres e até 72 bytes.'
        )
        return
      }
      if (!token) {
        setError('Conclua a verificação de segurança.')
        return
      }
      try {
        await onboardingApi.register(client, parsed.data, token)
        if (!valid()) return
        setAccess({ ...access, password: '' })
        setStep('EMAIL_VERIFICATION')
        setMessage(
          'Pedido recebido. Confira seu e-mail e entre para continuar.'
        )
      } finally {
        if (valid()) consumeCaptcha()
      }
    })
  const login = () =>
    run(async (valid) => {
      const result = await props.signInCredentials(
        access.email,
        access.password
      )
      if (!valid()) return
      setAccess((value) => ({ ...value, password: '' }))
      if (!result?.ok || result.error) {
        setError('Não foi possível entrar. Confira seu e-mail e senha.')
        return
      }
      await session.update()
    })
  const verify = () =>
    run(async (valid) => {
      const fact = await onboardingApi.account(client)
      if (!valid() || fact.userId !== userId) return
      if (!fact.emailVerified) {
        setMessage('Seu e-mail ainda não foi confirmado. Abra o link recebido.')
        return
      }
      const draft = readDraft(storage, userId)
      if (draft) {
        setCompany(draft.company)
        setSlug(draft.slug)
        setPlanVersionId(draft.planVersionId)
        setPending(draft.pending)
      }
      setHydratedUser(userId)
      setStep(draft?.pending ? 'CREATE' : 'COMPANY')
    })
  const resend = () =>
    run(async (valid) => {
      if (resendAfter.current > Date.now()) return
      await onboardingApi.resend(client)
      if (!valid()) return
      resendAfter.current = Date.now() + 60_000
      setResendAt(resendAfter.current)
      setClock(Date.now())
      setMessage('Pedido recebido. Confira seu e-mail para continuar.')
    })
  const advanceCompany = () => {
    const parsed = CompanyDataSchema.safeParse({
      ...company,
      addressComplement: company.addressComplement.trim() || null,
    })
    if (!parsed.success) {
      setError('Confira os dados da empresa e a declaração de representação.')
      return
    }
    setError(null)
    setStep('SITE_ADDRESS')
  }
  const checkSlug = () =>
    run(async (valid) => {
      const parsed = SignupSlugSchema.safeParse(slug)
      if (!parsed.success) {
        setError('Use de 2 a 63 letras minúsculas, números ou hífens.')
        return
      }
      const result = await onboardingApi.slug(client, parsed.data)
      if (!valid()) return
      if (!result.available) {
        setSuggestions(result.suggestions)
        setError('Este endereço não está disponível. Escolha outro.')
        return
      }
      setSuggestions([])
      setStep('PLAN')
    })
  const advancePlan = () => {
    if (!plans.some((plan) => plan.planVersionId === planVersionId)) {
      setError('Escolha um plano vigente.')
      return
    }
    setError(null)
    setStep('TERMS')
  }
  const advanceTerms = () => {
    if (!REQUIRED_SIGNUP_DOCUMENTS.every((kind) => accepted.includes(kind))) {
      setError('Leia e aceite cada documento obrigatório.')
      return
    }
    setError(null)
    setStep('CREATE')
  }
  const create = () =>
    run(async (valid) => {
      if (options?.mode !== 'on' || !userId || !token) {
        setError('Entre na conta e conclua a verificação de segurança.')
        return
      }
      const input =
        pending?.input ??
        CreateOrganizationInputSchema.parse({
          company: {
            ...company,
            addressComplement: company.addressComplement.trim() || null,
          },
          slug,
          planVersionId,
          acceptances: options.documents
            .filter((document) => accepted.includes(document.kind))
            .map(({ kind, version, textSha256 }) => ({
              kind,
              version,
              textSha256,
            })),
        })
      const operation = pending ?? { key: crypto.randomUUID(), input }
      setPending(operation)
      const saved = writeDraft(storage, userId, {
        version: 1,
        company,
        slug,
        planVersionId,
        pending: operation,
      })
      if (!saved)
        setMessage(
          'Mantenha esta aba aberta até confirmar o resultado do pedido.'
        )
      try {
        const result = await onboardingApi.create(
          client,
          operation.input,
          operation.key,
          token
        )
        if (!valid()) return
        clearDraft(storage, userId)
        setReceipt(result)
        setPending(null)
      } catch (problem) {
        if (
          valid() &&
          problem instanceof OnboardingRequestError &&
          problem.status < 500
        ) {
          setPending(null)
          if (problem.code === 'LEGAL_DOCUMENT_CHANGED') {
            await reloadOptions(valid)
            if (valid()) setStep('TERMS')
          } else if (problem.code === 'PLAN_NOT_AVAILABLE') {
            const offers = await readPublicMonthlyPlans(client)
            if (valid()) {
              setPlans(offers)
              setStep('PLAN')
            }
          } else if (problem.code === 'SLUG_UNAVAILABLE')
            setStep('SITE_ADDRESS')
          else if (problem.code === 'INVALID_CNPJ') setStep('COMPANY')
          else if (problem.code === 'EMAIL_NOT_VERIFIED')
            setStep('EMAIL_VERIFICATION')
        }
        throw problem
      } finally {
        if (valid()) consumeCaptcha()
      }
    })
  const back = () => {
    if (busy || pending) return
    const previous: Partial<Record<OnboardingStep, OnboardingStep>> = {
      SITE_ADDRESS: 'COMPANY',
      PLAN: 'SITE_ADDRESS',
      TERMS: 'PLAN',
      CREATE: 'TERMS',
    }
    if (previous[step]) {
      setError(null)
      setStep(previous[step]!)
    }
  }
  return {
    options,
    step,
    access,
    setAccess,
    company,
    setCompany,
    slug,
    setSlug,
    suggestions,
    plans,
    planVersionId,
    setPlanVersionId,
    accepted,
    setAccepted,
    pending,
    receipt,
    busy: busy || session.status === 'loading',
    error,
    message,
    userId,
    attempt,
    token,
    setToken,
    resendSeconds: Math.max(0, Math.ceil((resendAt - clock) / 1000)),
    register,
    login,
    verify,
    resend,
    advanceCompany,
    checkSlug,
    advancePlan,
    advanceTerms,
    create,
    back,
    reload: () =>
      run(async (valid) => {
        consumeCaptcha()
        await reloadOptions(valid)
        if (valid() && ['TERMS', 'CREATE'].includes(step)) setStep('TERMS')
      }),
  }
}
