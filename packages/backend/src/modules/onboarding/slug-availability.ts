import type { Prisma } from '@prisma/client'
import { isSignupSlug } from '@gb-locacoes/contracts/platform'
import {
  SLUG_SUGGESTIONS_MAX,
  type SlugAvailabilityResponse,
} from '@gb-locacoes/contracts/onboarding'

/** New-slug policy and collisions are deliberately indistinguishable to the caller. */
export async function readSignupSlugAvailability(
  tx: Prisma.TransactionClient,
  slug: string
): Promise<SlugAvailabilityResponse> {
  if (
    isSignupSlug(slug) &&
    !(await tx.organization.findUnique({
      where: { slug },
      select: { id: true },
    }))
  )
    return { available: true }
  const base = isSignupSlug(slug)
    ? slug.slice(0, 55).replace(/-+$/, '')
    : 'locadora'
  const candidates = Array.from(
    { length: SLUG_SUGGESTIONS_MAX + 5 },
    (_, index) => base + '-' + (index + 2)
  ).filter(isSignupSlug)
  const taken = new Set(
    (
      await tx.organization.findMany({
        where: { slug: { in: candidates } },
        select: { slug: true },
      })
    ).map((row) => row.slug)
  )
  return {
    available: false,
    suggestions: candidates
      .filter((candidate) => !taken.has(candidate))
      .slice(0, SLUG_SUGGESTIONS_MAX),
  }
}
