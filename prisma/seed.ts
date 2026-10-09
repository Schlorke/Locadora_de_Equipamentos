import type { Prisma } from '@prisma/client'
import { pathToFileURL } from 'node:url'
import { planTenantMaintenance } from '../scripts/security/tenant-maintenance'

export async function runSeed(args: string[], env: NodeJS.ProcessEnv) {
  const plan = planTenantMaintenance(args, env, 'seed-catalog')
  if (!plan.apply)
    return {
      tenantId: plan.tenantId,
      mode: 'dry-run',
      scope: 'sample-catalog-only',
    }
  const [{ PrismaClient }, { PrismaPg }] = await Promise.all([
    import('@prisma/client'),
    import('@prisma/adapter-pg'),
  ])
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: plan.connectionString }),
  })
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT set_config('app.tenant_id', ${plan.tenantId}, true)`
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gb-locacoes:rental-mutations'), hashtext(${plan.tenantId}))`
        const tenant = await tx.organization.findUnique({
          where: { id: plan.tenantId },
          select: { status: true },
        })
        if (!tenant || tenant.status !== 'ACTIVE')
          throw new Error('Locadora ativa não encontrada')
        await seedCategories(tx, plan.tenantId)
        await seedEquipments(tx, plan.tenantId)
      },
      { timeout: 60000 }
    )
    return {
      tenantId: plan.tenantId,
      mode: 'applied',
      scope: 'sample-catalog-only',
    }
  } finally {
    await prisma.$disconnect()
  }
}

async function seedCategories(
  prisma: Prisma.TransactionClient,
  tenantId: string
) {
  console.error('Seeding categories...')

  const categories = [
    {
      name: 'Andaimes Suspensos',
      description:
        'Andaimes suspensos elétricos e manuais para trabalhos em altura',
      icon: 'Building',
      iconColor: '#1E40AF',
      bgColor: '#EFF6FF',
      fontColor: '#1E40AF',
    },
    {
      name: 'Cadeiras Elétricas',
      description: 'Cadeiras elétricas e manuais para serviços em altura',
      icon: 'Zap',
      iconColor: '#D97706',
      bgColor: '#FEF3C7',
      fontColor: '#D97706',
    },
    {
      name: 'Andaimes Tubulares',
      description: 'Andaimes tubulares para diversas alturas e aplicações',
      icon: 'Wrench',
      iconColor: '#DC2626',
      bgColor: '#FEE2E2',
      fontColor: '#DC2626',
    },
    {
      name: 'Betoneiras',
      description: 'Betoneiras de diversos tamanhos e capacidades',
      icon: 'Truck',
      iconColor: '#059669',
      bgColor: '#D1FAE5',
      fontColor: '#059669',
    },
    {
      name: 'Rompedores',
      description: 'Rompedores pneumáticos e elétricos',
      icon: 'Hammer',
      iconColor: '#7C3AED',
      bgColor: '#EDE9FE',
      fontColor: '#7C3AED',
    },
    {
      name: 'Compressores',
      description: 'Compressores de ar para obras',
      icon: 'Container',
      iconColor: '#4338CA',
      bgColor: '#E0E7FF',
      fontColor: '#4338CA',
    },
  ]

  for (const category of categories) {
    const category_with_slug = {
      ...category,
      slug: category.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, ''),
    }

    await prisma.category.upsert({
      where: { tenantId_slug: { tenantId, slug: category_with_slug.slug } },
      create: { ...category_with_slug, tenantId },
      update: category_with_slug,
    })
  }

  console.warn('Categories seeded successfully!')
}

async function seedEquipments(
  prisma: Prisma.TransactionClient,
  tenantId: string
) {
  console.error('Seeding equipments...')

  // Buscar categorias existentes
  const categories = await prisma.category.findMany({ where: { tenantId } })

  if (categories.length === 0) {
    console.error('No categories found. Please run category seed first.')
    return
  }

  const equipments = [
    {
      name: 'Betoneira 320L',
      description:
        'Betoneira profissional com capacidade de 320 litros, ideal para obras de médio porte. Motor potente e estrutura robusta.',
      pricePerDay: 65.0,
      images: [
        '/placeholder.svg?height=400&width=600&text=Betoneira+320L',
        '/placeholder.svg?height=400&width=600&text=Betoneira+320L+2',
      ],
      available: true,
      categorySlug: 'betoneiras',
    },
    {
      name: 'Andaime Suspenso Elétrico',
      description:
        'Andaime suspenso elétrico para trabalhos em altura, com capacidade para 2 pessoas e carga de até 300kg.',
      pricePerDay: 180.0,
      images: [
        '/placeholder.svg?height=400&width=600&text=Andaime+Suspenso',
        '/placeholder.svg?height=400&width=600&text=Andaime+Suspenso+2',
      ],
      available: true,
      categorySlug: 'andaimes-suspensos',
    },
    {
      name: 'Cadeira Elétrica Unipessoal',
      description:
        'Cadeira elétrica individual para serviços em altura, com controles de segurança e capacidade para 150kg.',
      pricePerDay: 120.0,
      images: [
        '/placeholder.svg?height=400&width=600&text=Cadeira+Eletrica',
        '/placeholder.svg?height=400&width=600&text=Cadeira+Eletrica+2',
      ],
      available: true,
      categorySlug: 'cadeiras-eletricas',
    },
    {
      name: 'Rompedor Pneumático 30kg',
      description:
        'Rompedor pneumático pesado para demolições e quebra de concreto. Requer compressor.',
      pricePerDay: 95.0,
      images: [
        '/placeholder.svg?height=400&width=600&text=Rompedor+Pneumatico',
        '/placeholder.svg?height=400&width=600&text=Rompedor+Pneumatico+2',
      ],
      available: true,
      categorySlug: 'rompedores',
    },
    {
      name: 'Compressor de Ar 10PCM',
      description:
        'Compressor de ar portátil com capacidade de 10 pés cúbicos por minuto. Ideal para ferramentas pneumáticas.',
      pricePerDay: 75.0,
      images: [
        '/placeholder.svg?height=400&width=600&text=Compressor+10PCM',
        '/placeholder.svg?height=400&width=600&text=Compressor+10PCM+2',
      ],
      available: true,
      categorySlug: 'compressores',
    },
    {
      name: 'Andaime Tubular H=2m',
      description:
        'Torre de andaime tubular com altura de 2 metros, inclui base, travessas e plataforma de trabalho.',
      pricePerDay: 45.0,
      images: [
        '/placeholder.svg?height=400&width=600&text=Andaime+Tubular+2m',
        '/placeholder.svg?height=400&width=600&text=Andaime+Tubular+2m+2',
      ],
      available: true,
      categorySlug: 'andaimes-tubulares',
    },
    {
      name: 'Betoneira 400L',
      description:
        'Betoneira industrial com capacidade de 400 litros, motor trifásico e basculante lateral.',
      pricePerDay: 85.0,
      images: [
        '/placeholder.svg?height=400&width=600&text=Betoneira+400L',
        '/placeholder.svg?height=400&width=600&text=Betoneira+400L+2',
      ],
      available: true,
      categorySlug: 'betoneiras',
    },
    {
      name: 'Rompedor Elétrico 15kg',
      description:
        'Rompedor elétrico mais leve para trabalhos de precisão e quebra de pisos.',
      pricePerDay: 65.0,
      images: [
        '/placeholder.svg?height=400&width=600&text=Rompedor+Eletrico',
        '/placeholder.svg?height=400&width=600&text=Rompedor+Eletrico+2',
      ],
      available: false, // Alguns indisponíveis para teste
      categorySlug: 'rompedores',
    },
  ]

  for (const equipment of equipments) {
    const category = categories.find(
      (cat: { slug: string; id: string; name: string }) =>
        cat.slug === equipment.categorySlug
    )

    if (!category) {
      console.error(`Category not found for slug: ${equipment.categorySlug}`)
      continue
    }

    const existingEquipment = await prisma.equipment.findFirst({
      where: { tenantId, name: equipment.name },
    })

    if (!existingEquipment) {
      await prisma.equipment.create({
        data: {
          tenantId,
          name: equipment.name,
          description: equipment.description,
          pricePerDay: equipment.pricePerDay,
          images: equipment.images,
          available: equipment.available,
          categoryId: category.id,
        },
      })
      console.error(`✅ Equipment created: ${equipment.name}`)
    } else {
      console.error(`⚠️ Equipment already exists: ${equipment.name}`)
    }
  }

  console.warn('Equipments seeded successfully!')
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runSeed(process.argv.slice(2), process.env)
    .then((result) => console.log(JSON.stringify(result)))
    .catch(() => {
      console.error(
        'Seed não executado ou revertido. Exige locadora explícita, banco local de testes descartável e confirmações. Nenhuma conta é provisionada.'
      )
      process.exitCode = 1
    })
}
