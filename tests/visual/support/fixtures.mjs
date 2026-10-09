// Respostas determinísticas das APIs para a linha de base visual. Nenhum banco: o spec atende as chamadas do
// navegador com `page.route` e o backend simulado (mock-backend.mjs) atende as leituras do servidor (SSR) com as
// mesmas funções. Datas são fixas e relativas ao relógio pausado (env.mjs FIXED_TIME).
import { PAUSED_TENANT, TENANT } from './env.mjs'
import {
  GB_LEGAL_DOCUMENTS,
  GB_SITE_CONTENT,
} from '../../../tools/gb-site-content.mjs'

/** Foto 1x1 embutida: o next/image não otimiza data: e a imagem não depende de rede nem do otimizador. */
export const PHOTO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM1sAAAAASUVORK5CYII='

const day = (offset, hour = 12) =>
  new Date(Date.UTC(2026, 2, 10 + offset, hour, 0, 0)).toISOString()

export const ADMIN_USER = Object.freeze({
  id: 'user-visual-admin',
  email: 'admin@locadora-alfa.example',
  name: 'Ana Administradora',
  role: 'ADMIN',
  image: null,
})

const membership = {
  tenant: {
    id: TENANT.id,
    slug: TENANT.slug,
    name: TENANT.name,
    status: 'ACTIVE',
  },
  membershipId: 'membership-visual-a',
  role: 'ADMIN',
}

export const CATEGORIES = [
  {
    id: 'cat-andaimes',
    name: 'Andaimes',
    slug: 'andaimes',
    icon: 'Building2',
    iconColor: '#ffffff',
    bgColor: '#ea580c',
    fontColor: '#ffffff',
    customIcon: null,
    description: 'Andaimes e escoras',
    _count: { equipments: 2 },
    createdAt: day(-40),
    updatedAt: day(-40),
  },
  {
    id: 'cat-betoneiras',
    name: 'Betoneiras',
    slug: 'betoneiras',
    icon: 'Truck',
    iconColor: '#ffffff',
    bgColor: '#334155',
    fontColor: '#ffffff',
    customIcon: null,
    description: 'Betoneiras e misturadores',
    _count: { equipments: 1 },
    createdAt: day(-39),
    updatedAt: day(-39),
  },
  {
    id: 'cat-compactacao',
    name: 'Compactação',
    slug: 'compactacao',
    icon: 'Hammer',
    iconColor: '#1e293b',
    bgColor: '#fde68a',
    fontColor: '#1e293b',
    customIcon: null,
    description: 'Placas e sapos compactadores',
    _count: { equipments: 1 },
    createdAt: day(-38),
    updatedAt: day(-38),
  },
]

const categoryRef = (id) => {
  const c = CATEGORIES.find((category) => category.id === id)
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon,
    iconColor: c.iconColor,
    bgColor: c.bgColor,
    fontColor: c.fontColor,
    customIcon: null,
  }
}

const pricing = {
  dailyDiscount: 0,
  weeklyDiscount: 10,
  biweeklyDiscount: 15,
  monthlyDiscount: 20,
  popularPeriod: 'weekly',
  maxStock: 5,
  dailyDirectValue: 0,
  weeklyDirectValue: 0,
  biweeklyDirectValue: 0,
  monthlyDirectValue: 0,
  dailyUseDirectValue: false,
  weeklyUseDirectValue: false,
  biweeklyUseDirectValue: false,
  monthlyUseDirectValue: false,
  dailyRentalEnabled: true,
  weeklyRentalEnabled: true,
  biweeklyRentalEnabled: true,
  monthlyRentalEnabled: true,
}

export const EQUIPMENTS = [
  {
    id: 'eq-andaime-tubular',
    name: 'Andaime Tubular 1,5 m',
    description: 'Andaime tubular com piso metálico e travas de segurança.',
    pricePerDay: 35,
    images: [PHOTO],
    categoryId: 'cat-andaimes',
    isAvailable: true,
  },
  {
    id: 'eq-betoneira-400',
    name: 'Betoneira 400 L',
    description: 'Betoneira elétrica monofásica para obras de médio porte.',
    pricePerDay: 120,
    images: [PHOTO],
    categoryId: 'cat-betoneiras',
    isAvailable: true,
  },
  {
    id: 'eq-escora-metalica',
    name: 'Escora Metálica 3 m',
    description: 'Escora regulável para lajes e vigas.',
    pricePerDay: 8.5,
    images: [PHOTO],
    categoryId: 'cat-andaimes',
    isAvailable: false,
  },
  {
    id: 'eq-placa-vibratoria',
    name: 'Placa Vibratória',
    description: 'Compactador de solo a gasolina com placa de 50 cm.',
    pricePerDay: 95,
    images: [PHOTO],
    categoryId: 'cat-compactacao',
    isAvailable: true,
  },
].map((equipment, index) => ({
  ...equipment,
  ...pricing,
  category: categoryRef(equipment.categoryId),
  reviews: [],
  quantity: 5,
  availableQuantity: equipment.isAvailable ? 4 : 0,
  createdAt: day(-30 + index),
  updatedAt: day(-2 + index),
  specifications: { Potência: '1,5 cv', Peso: '120 kg' },
}))

export const PUBLIC_SETTINGS = {
  companyPhone: '(51) 3000-0000',
  whatsappNumber: '(51) 99999-0000',
  contactEmail: 'contato@locadora-alfa.example',
  marketingEmail: 'marketing@locadora-alfa.example',
  companyAddress: 'Rua Exemplo, 100 - Centro, Porto Alegre - RS',
  companyIconUrl: '',
  aboutUsText:
    'Locação de equipamentos para construção civil com entrega na região metropolitana.',
  // Redes da própria locadora (onda 132, achado 143): o rodapé deixou de completar Facebook e Instagram com os da GB;
  // a locadora configurada da linha de base informa as dela (LinkedIn continua sem link, como antes).
  socialLinks: {
    facebook: 'https://social.example/locadora-alfa/facebook',
    instagram: 'https://social.example/locadora-alfa/instagram',
  },
  heroCarousel: [],
  waveAnimation: 'animated',
  // Horário e CNPJ da própria locadora (onda 133, achado 147): a leitura pública traz os dois, e o rodapé e o contato
  // voltam a mostrá-los como na gravação da linha de base (o mesmo horário que o script da GB grava; CNPJ fictício
  // válido, sem nome empresarial diferente do nome do cartão).
  businessHours: {
    monday: { closed: false, open: '08:00', close: '18:00' },
    tuesday: { closed: false, open: '08:00', close: '18:00' },
    wednesday: { closed: false, open: '08:00', close: '18:00' },
    thursday: { closed: false, open: '08:00', close: '18:00' },
    friday: { closed: false, open: '08:00', close: '18:00' },
    saturday: { closed: false, open: '08:00', close: '12:00' },
    sunday: { closed: true },
  },
  legalIdentity: { legalName: null, cnpj: '11.222.333/0001-81' },
  // Conteúdo institucional e textos legais da própria locadora (onda 134, lote vitrine-conteudo): exatamente o que
  // tools/gb-site-settings.mjs grava para a GB no corte, sem a frota (D-B: o dono preenche no painel; nem 200 nem 50) e
  // sem nota de avaliações (D-A). Com eles, a vitrine volta a ser a da produção, menos os selos e o número de frota
  // (aprovações com o motivo D-B em approved-changes.json) e a linha da nota (D-A).
  siteContent: { ...GB_SITE_CONTENT },
  legalDocuments: { terms: true, privacy: true, returnPolicy: true },
}

/** Documento legal publicado por tipo da rota (`/legal-documents/{terms|privacy|return-policy}`; onda 134). */
const LEGAL_KINDS = Object.freeze({
  terms: 'terms',
  privacy: 'privacy',
  'return-policy': 'returnPolicy',
})
const LEGAL_PUBLISHED_AT = '2026-03-01T12:00:00.000Z'
const legalDocument = (slug) => ({
  kind: LEGAL_KINDS[slug],
  document: GB_LEGAL_DOCUMENTS[LEGAL_KINDS[slug]],
  publishedAt: LEGAL_PUBLISHED_AT,
})

const QUOTE_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'completed',
  'pending',
  'approved',
]
export const QUOTES = QUOTE_STATUSES.map((status, index) => {
  const equipment = EQUIPMENTS[index % EQUIPMENTS.length]
  const total = [420, 1280, 95, 2210, 600, 350][index]
  return {
    id: `quote-visual-${index + 1}`,
    quoteCode: `ORC-2026-00${index + 1}`,
    name: [
      'Construtora Beta',
      'Maria Souza',
      'João Lima',
      'Obras Gama',
      'Carlos Dias',
      'Fernanda Reis',
    ][index],
    email: `cliente${index + 1}@exemplo.example`,
    phone: '(51) 98888-000' + index,
    company: index % 2 === 0 ? 'Empresa Exemplo Ltda' : undefined,
    cpf: null,
    cnpj: null,
    status,
    equipments: [
      {
        id: equipment.id,
        name: equipment.name,
        quantity: 2,
        dailyPrice: equipment.pricePerDay,
      },
    ],
    items: [
      {
        id: `item-${index + 1}`,
        quantity: 2,
        days: 7,
        startDate: day(index),
        endDate: day(index + 7),
        pricePerDay: equipment.pricePerDay,
        total,
        equipment: { id: equipment.id, name: equipment.name },
      },
    ],
    startDate: day(index),
    endDate: day(index + 7),
    totalPrice: total,
    finalTotal: total,
    originalTotal: total,
    deliveryType: 'DELIVERY',
    deliveryFee: 50,
    deliveryAddress: {
      street: 'Rua Exemplo',
      number: '100',
      neighborhood: 'Centro',
      city: 'Porto Alegre',
      state: 'RS',
      zipCode: '90000-000',
    },
    createdAt: day(-index - 1),
    updatedAt: day(-index),
    payments: [],
    customerImage: null,
  }
})

export const RENTALS = QUOTES.slice(0, 4).map((quote, index) => ({
  id: `rental-visual-${index + 1}`,
  startdate: quote.startDate,
  enddate: quote.endDate,
  total: quote.totalPrice,
  status: ['PENDING', 'ACTIVE', 'COMPLETED', 'OVERDUE'][index],
  createdat: quote.createdAt,
  users: {
    id: `client-${index + 1}`,
    name: quote.name,
    email: quote.email,
    phone: quote.phone,
  },
  rental_items: [
    {
      id: `ritem-${index + 1}`,
      quantity: 2,
      totaldays: 7,
      totalprice: quote.totalPrice,
      equipments: {
        id: quote.equipments[0].id,
        name: quote.equipments[0].name,
        images: [PHOTO],
      },
    },
  ],
  quote: {
    id: quote.id,
    name: quote.name,
    email: quote.email,
    company: quote.company,
    status: quote.status,
  },
  payments: [],
}))

export const FINANCIAL_ENTRIES = QUOTES.slice(0, 4).map((quote, index) => ({
  id: `fin-visual-${index + 1}`,
  rentalId: `rental-visual-${index + 1}`,
  quoteId: quote.id,
  quoteCode: quote.quoteCode,
  legacyExternalCode: null,
  customerName: quote.name,
  customerEmail: quote.email,
  customerDocument: '000.000.000-00',
  grossAmount: quote.totalPrice,
  netAmount: Math.round(quote.totalPrice * 94) / 100,
  taxRate: 6,
  taxDocumentType: 'CPF',
  invoiceNumber: null,
  boletoIssuedAt: null,
  invoiceIssuedAt: null,
  dueDate: day(index * 3 - 4),
  paidAt: index === 1 ? day(-1) : null,
  settledAt: null,
  billingStatus: ['AWAITING_PAYMENT', 'PAID', 'UNPAID', 'AWAITING_PAYMENT'][
    index
  ],
}))

const revenue = {
  revenueHistory: ['out', 'nov', 'dez', 'jan', 'fev', 'mar'].map(
    (month, index) => ({
      month,
      revenue: [3200, 4100, 3900, 5200, 4800, 2600][index],
    })
  ),
  revenueByCategory: CATEGORIES.map((category, index) => ({
    categoryName: category.name,
    revenue: [5400, 3100, 1800][index],
  })),
}
const aging = {
  agingData: [
    { range: '0-30', amount: 1500, count: 3, status: 'onTime' },
    { range: '31-60', amount: 600, count: 1, status: 'slightDelay' },
    { range: '60+', amount: 250, count: 1, status: 'severeDelay' },
  ],
  topDebtors: [
    {
      clientName: 'João Lima',
      overdueAmount: 250,
      daysOverdue: 64,
      status: 'critical',
    },
  ],
}

const dashboard = {
  totalEquipments: 4,
  availableEquipments: 3,
  totalCategories: 3,
  totalQuotes: 6,
  pendingQuotes: 2,
  approvedQuotes: 2,
  rejectedQuotes: 1,
  completedQuotes: 1,
  totalRevenue: 23800,
  monthlyRevenue: 2600,
  utilizationRate: 62,
  conversionRate: 50,
  averageTicket: 825,
  quotesTrend: [0, 1, 2, 3, 4, 5, 6].map((index) => ({
    date: `0${index + 3}/03`,
    fullDate: day(index - 7),
    count: [1, 0, 2, 1, 3, 0, 1][index],
  })),
  equipmentByCategory: CATEGORIES.map((category, index) => ({
    categoryName: category.name,
    count: [2, 1, 1][index],
    available: [1, 1, 1][index],
    categoryId: category.id,
    bgColor: category.bgColor,
    fontColor: category.fontColor,
  })),
  topEquipments: EQUIPMENTS.slice(0, 3).map((equipment, index) => ({
    id: equipment.id,
    name: equipment.name,
    requestCount: 9 - index * 2,
    category: equipment.category.name,
  })),
}

const adminSettings = {
  success: true,
  data: {
    companyPhone: PUBLIC_SETTINGS.companyPhone,
    whatsappNumber: PUBLIC_SETTINGS.whatsappNumber,
    contactEmail: PUBLIC_SETTINGS.contactEmail,
    marketingEmail: PUBLIC_SETTINGS.marketingEmail,
    companyAddress: PUBLIC_SETTINGS.companyAddress,
    aboutUsText: PUBLIC_SETTINGS.aboutUsText,
    companyIconUrl: '',
    heroCarousel: [],
    socialLinks: {},
    waveAnimation: 'animated',
    seoTitle: 'Locadora Alfa',
    seoDescription: 'Locação de equipamentos',
    // Seções novas do painel (onda 134): horário e conteúdo salvos, os mesmos da vitrine.
    businessHours: PUBLIC_SETTINGS.businessHours,
    siteContent: PUBLIC_SETTINGS.siteContent,
  },
}

// --- Onda 135 (A9): dados dos cenários que faltavam na linha de base ---------------------------------------------
// Área do cliente no host da locadora (sessão de cliente), telas de conta do host `app` e as telas do painel que não
// eram capturadas. Mesmas datas fixas e as mesmas locadora, equipamentos, orçamentos e locações de cima.

/** Cliente final da locadora da vitrine (vínculo CLIENT com `loc-a`). */
export const CLIENT_USER = Object.freeze({
  id: 'user-visual-client',
  email: 'carla@cliente.example',
  name: 'Carla Cliente',
  role: 'CLIENT',
  image: null,
})

const clientMembership = {
  tenant: membership.tenant,
  membershipId: 'membership-visual-client',
  role: 'CLIENT',
}

/** Orçamentos e locações da própria cliente (os três primeiros orçamentos e as duas primeiras locações). */
const CLIENT_QUOTES = QUOTES.slice(0, 3).map((quote) => ({
  ...quote,
  name: CLIENT_USER.name,
  email: CLIENT_USER.email,
}))
const CLIENT_RENTALS = RENTALS.slice(0, 2).map((rental, index) => ({
  id: rental.id,
  startdate: rental.startdate,
  enddate: rental.enddate,
  total: rental.total,
  status: rental.status,
  createdat: rental.createdat,
  notes: null,
  quoteId: CLIENT_QUOTES[index].id,
  quote: {
    id: CLIENT_QUOTES[index].id,
    name: CLIENT_USER.name,
    email: CLIENT_USER.email,
  },
  rental_items: rental.rental_items.map((item) => ({
    id: item.id,
    quantity: item.quantity,
    totaldays: item.totaldays,
    includeWeekends: false,
    equipments: item.equipments,
  })),
  payments: [],
}))

/** Detalhe da locação ativa da cliente (`/area-cliente/historico/rental-visual-2`). */
const CLIENT_RENTAL_DETAIL = {
  id: CLIENT_RENTALS[1].id,
  startdate: CLIENT_RENTALS[1].startdate,
  enddate: CLIENT_RENTALS[1].enddate,
  total: CLIENT_RENTALS[1].total,
  status: CLIENT_RENTALS[1].status,
  notes: null,
  rental_items: RENTALS[1].rental_items.map((item) => ({
    id: item.id,
    quantity: item.quantity,
    totaldays: item.totaldays,
    totalprice: item.totalprice,
    priceperday: EQUIPMENTS[1].pricePerDay,
    equipments: {
      ...item.equipments,
      category: { name: EQUIPMENTS[1].category.name },
    },
  })),
  payments: [
    {
      id: 'pay-visual-c1',
      amount: CLIENT_RENTALS[1].total,
      status: 'PENDING',
      method: 'BOLETO',
      dueDate: day(5),
      paidAt: null,
      metadata: null,
    },
  ],
  deliveries: [
    {
      id: 'delivery-visual-c1',
      type: 'DELIVERY',
      status: 'COMPLETED',
      scheduledAt: day(1, 9),
      completedAt: day(1, 11),
      address: {
        street: 'Rua Exemplo, 100',
        city: 'Porto Alegre',
        state: 'RS',
      },
    },
  ],
  quote: {
    id: CLIENT_QUOTES[1].id,
    name: CLIENT_USER.name,
    email: CLIENT_USER.email,
    total: CLIENT_QUOTES[1].totalPrice,
    finalTotal: CLIENT_QUOTES[1].finalTotal,
    deliveryType: 'DELIVERY',
    deliveryFee: 50,
    pickupFee: null,
    deliveryAddress: CLIENT_QUOTES[1].deliveryAddress,
  },
}

const CLIENT_ACTIVITIES = [
  {
    id: 'activity-visual-1',
    type: 'quote_approved',
    title: 'Orçamento aprovado',
    description: `${CLIENT_QUOTES[1].quoteCode} foi aprovado pela locadora.`,
    timestamp: day(-1, 10),
    link: '/area-cliente/historico',
    metadata: { amount: CLIENT_QUOTES[1].totalPrice, status: 'approved' },
  },
  {
    id: 'activity-visual-2',
    type: 'rental_created',
    title: 'Locação iniciada',
    description: `${EQUIPMENTS[1].name} reservado por 7 dias.`,
    timestamp: day(-2, 15),
    link: '/area-cliente/historico',
    metadata: { itemCount: 1 },
  },
]

const CLIENT_ADDRESSES = [
  {
    id: 'address-visual-1',
    street: 'Rua Exemplo',
    number: '100',
    complement: 'Sala 2',
    neighborhood: 'Centro',
    city: 'Porto Alegre',
    state: 'RS',
    zipCode: '90000-000',
    isPrimary: true,
  },
  {
    id: 'address-visual-2',
    street: 'Avenida Modelo',
    number: '2500',
    complement: null,
    neighborhood: 'Navegantes',
    city: 'Porto Alegre',
    state: 'RS',
    zipCode: '90240-000',
    isPrimary: false,
  },
]

const CLIENT_NOTIFICATIONS = [
  {
    id: 'notification-visual-1',
    type: 'quote',
    title: 'Orçamento aprovado',
    message: `Seu orçamento ${CLIENT_QUOTES[1].quoteCode} foi aprovado.`,
    isRead: false,
    createdAt: day(-1, 10),
    actionUrl: '/area-cliente/historico',
    priority: 'high',
    readAt: null,
  },
  {
    id: 'notification-visual-2',
    type: 'delivery',
    title: 'Entrega concluída',
    message: `${EQUIPMENTS[1].name} entregue na Rua Exemplo, 100.`,
    isRead: true,
    createdAt: day(-2, 11),
    priority: 'medium',
    readAt: day(-2, 12),
  },
]

/** Concessões de papel da locadora (tela de permissões do painel). */
const PERMISSIONS = [
  ['FINANCIAL', 'FINANCIAL', 'READ'],
  ['FINANCIAL', 'FINANCIAL', 'WRITE'],
  ['FINANCIAL', 'CONTRACTS', 'READ'],
  ['OPERATOR', 'EQUIPMENTS', 'READ'],
  ['OPERATOR', 'EQUIPMENTS', 'WRITE'],
  ['OPERATOR', 'RENTALS', 'READ'],
  ['OPERATOR', 'LOGISTICS', 'READ'],
  ['OPERATOR', 'LOGISTICS', 'WRITE'],
  ['OPERATOR', 'MAINTENANCE', 'READ'],
].map(([role, module, action], index) => ({
  id: `permission-visual-${index + 1}`,
  role,
  module,
  action,
}))

const VEHICLES = [
  {
    id: 'vehicle-visual-1',
    plate: 'ABC1D23',
    brand: 'Fiat',
    model: 'Strada',
    type: 'PICKUP',
    status: 'AVAILABLE',
  },
]
const DRIVERS = [
  {
    id: 'driver-visual-1',
    name: 'Paulo Motorista',
    phone: '(51) 97777-0000',
    status: 'ACTIVE',
  },
]
const DELIVERIES = RENTALS.slice(0, 3).map((rental, index) => ({
  id: `delivery-visual-${index + 1}`,
  rentalId: rental.id,
  type: index === 2 ? 'PICKUP' : 'DELIVERY',
  status: ['SCHEDULED', 'IN_TRANSIT', 'COMPLETED'][index],
  scheduledAt: day(index, 9 + index),
  completedAt: index === 2 ? day(index, 12) : null,
  address: {
    street: 'Rua Exemplo',
    number: String(100 + index * 10),
    city: 'Porto Alegre',
    state: 'RS',
    zipCode: '90000-000',
  },
  distance: 12 + index * 3,
  vehicleId: index === 1 ? VEHICLES[0].id : null,
  driverId: index === 1 ? DRIVERS[0].id : null,
  driverName: index === 1 ? DRIVERS[0].name : null,
  photos: [],
  checklist: null,
  notes: null,
  rental: {
    id: rental.id,
    users: {
      name: rental.users.name,
      email: rental.users.email,
      phone: rental.users.phone,
    },
  },
}))

const MAINTENANCES = [
  ['PREVENTIVE', 'SCHEDULED', 2, null],
  ['CORRECTIVE', 'IN_PROGRESS', -1, null],
  ['INSPECTION', 'COMPLETED', -6, 180],
].map(([type, status, offset, cost], index) => {
  const equipment = EQUIPMENTS[index]
  return {
    id: `maintenance-visual-${index + 1}`,
    equipmentId: equipment.id,
    type,
    scheduledAt: day(offset, 8),
    completedAt: status === 'COMPLETED' ? day(offset, 17) : null,
    cost,
    laborCost: cost === null ? null : 120,
    partsCost: cost === null ? null : 60,
    description: 'Revisão geral do equipamento',
    notes: null,
    technician: 'Equipe interna',
    status,
    equipment: {
      id: equipment.id,
      name: equipment.name,
      images: equipment.images,
      category: { id: equipment.category.id, name: equipment.category.name },
    },
  }
})

const WHATSAPP_CONVERSATIONS = QUOTES.slice(0, 3).map((quote, index) => ({
  id: `conversation-visual-${index + 1}`,
  phone: `55519888800${index}0`,
  displayName: quote.name,
  lastMessageAt: day(-index, 14),
  createdAt: day(-10 - index),
  updatedAt: day(-index, 14),
  messageCount: 3 - index,
}))

/** Unidades físicas do equipamento do detalhe e da edição no painel. */
const EQUIPMENT_UNITS = [
  ['AVAILABLE', '1200.5', null, 'SN-4001'],
  ['RENTED', '860', null, 'SN-4002'],
].map(([status, hourMeter, odometer, serialNumber], index) => ({
  id: `unit-visual-${index + 1}`,
  uniqueCode: `BET-400-0${index + 1}`,
  status,
  hourMeter,
  odometer,
  serialNumber,
  notes: null,
  createdAt: day(-30),
  updatedAt: day(-3),
}))

const json = (body, status = 200, headers = undefined) =>
  headers ? { status, body, headers } : { status, body }

/**
 * Resposta para uma chamada de API; `null` quando a rota não tem fixture (o chamador responde 404 e registra).
 * `session`: 'admin' no host do painel, 'anonymous' na vitrine e nas telas de conta do host `app`, 'client' na área do
 * cliente da vitrine (onda 135, A9).
 */
export function apiResponse({ method, pathname, session }) {
  const m = method.toUpperCase()
  const admin = session === 'admin'
  const client = session === 'client'
  // Sessão (Better Auth no modo better-auth e NextAuth no legado).
  if (
    pathname === '/api/auth/get-session' ||
    pathname === '/api/auth/v2/get-session'
  ) {
    const user = admin ? ADMIN_USER : client ? CLIENT_USER : null
    return json(
      user
        ? {
            session: {
              id: client ? 'session-visual-client' : 'session-visual',
              userId: user.id,
              expiresAt: '2026-12-31T00:00:00.000Z',
            },
            user,
          }
        : null
    )
  }
  if (pathname === '/api/auth/session')
    return json(
      admin
        ? { user: ADMIN_USER, expires: '2026-12-31T00:00:00.000Z' }
        : client
          ? { user: CLIENT_USER, expires: '2026-12-31T00:00:00.000Z' }
          : {}
    )
  // Área do cliente no host da locadora (onda 135, A9): o vínculo é o da locadora do host, sem seletor.
  if (client) {
    const answer = clientResponse(m, pathname)
    if (answer) return answer
  }
  if (pathname === '/api/auth/organizations')
    return json({ memberships: admin ? [membership] : [] })
  if (
    pathname === '/api/auth/organizations/selection' ||
    pathname === '/api/auth/organizations/current'
  ) {
    return json({ selection: admin ? membership : null })
  }
  // Vitrine e SSR.
  if (pathname === `/api/public/tenants/${TENANT.slug}`) {
    return json({
      slug: TENANT.slug,
      name: TENANT.name,
      city: TENANT.city,
      state: TENANT.state,
      logoUrl: TENANT.logoUrl,
    })
  }
  // Site em pausa (S13): o modo vai nos cabeçalhos do cartão, como no backend.
  if (pathname === `/api/public/tenants/${PAUSED_TENANT.slug}`)
    return json(
      {
        slug: PAUSED_TENANT.slug,
        name: PAUSED_TENANT.name,
        city: PAUSED_TENANT.city,
        state: PAUSED_TENANT.state,
        logoUrl: PAUSED_TENANT.logoUrl,
      },
      200,
      { 'x-site-mode': 'PAUSED', 'x-site-indexable': 'false' }
    )
  if (pathname.startsWith('/api/public/tenants/'))
    return json({ error: 'Locadora não encontrada' }, 404)
  if (pathname === '/api/settings/public') return json(PUBLIC_SETTINGS)
  const publicLegal = pathname.match(
    /^\/api\/settings\/public\/legal-documents\/(terms|privacy|return-policy)$/
  )
  if (publicLegal) return json(legalDocument(publicLegal[1]))
  if (pathname === '/api/categories') return json(CATEGORIES)
  if (pathname === '/api/equipments') return json(EQUIPMENTS)
  const availability = pathname.match(
    /^\/api\/equipments\/([^/]+)\/availability$/
  )
  if (availability)
    return json({
      available: true,
      availableQuantity: 4,
      totalQuantity: 5,
      conflicts: [],
      unavailableDates: [],
    })
  const equipment = pathname.match(/^\/api\/equipments\/([^/]+)$/)
  if (equipment) {
    const found = EQUIPMENTS.find((item) => item.id === equipment[1])
    return found
      ? json(found)
      : json({ error: 'Equipamento não encontrado' }, 404)
  }
  if (pathname === '/api/equipamentos/search')
    return json({ results: [], equipments: [], categories: [] })
  if (pathname === '/api/client/notifications/stats')
    return json({ total: 0, unread: 0 })
  // A inbox também aceita equipe com vínculo ativo; o hook do painel consulta ?limit=50.
  // Esta ADMIN não possui notificações (mesma fixture de sync/stats), sem reutilizar a inbox de CLIENT.
  if (admin && m === 'GET' && pathname === '/api/client/notifications')
    return json({
      notifications: [],
      pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      stats: { total: 0, unread: 0, byType: {} },
    })
  if (pathname === '/api/cart/sync' || pathname === '/api/cart/merge')
    return json({ items: [] })
  if (pathname === '/api/contact' && m === 'POST')
    return json({ success: true })
  // Cadastro de locadora fechado, como na produção hoje (PLATFORM_SELF_SERVICE_SIGNUP=off; onda 135, A9).
  if (pathname === '/api/onboarding/options' && m === 'GET')
    return json({ mode: 'off' })
  // ADMIN é equipe, não o dono: o leitor real exige ownerUserId e o checklist oculta o widget neste 403.
  if (admin && m === 'GET' && pathname === '/api/onboarding/status')
    return json(
      {
        error: 'Não foi possível consultar o cadastro.',
        code: 'OWNER_REQUIRED',
      },
      403,
      { 'cache-control': 'private, no-store', vary: 'Cookie, Host' }
    )
  // Painel.
  if (!admin && pathname.startsWith('/api/admin/'))
    return json({ error: 'Não autorizado' }, 401)
  // A persona da linha de base é equipe ADMIN; propriedade não é inferida do papel.
  if (
    pathname === '/api/admin/subscription' ||
    pathname === '/api/admin/subscription/invoices'
  )
    return json(
      { error: 'Consulta exclusiva do dono', code: 'OWNER_REQUIRED' },
      403
    )
  if (pathname === '/api/admin/dashboard') return json(dashboard)
  if (pathname === '/api/admin/quotes')
    return json({
      quotes: QUOTES,
      total: QUOTES.length,
      page: 1,
      totalPages: 1,
    })
  if (/^\/api\/admin\/quotes\/[^/]+\/adjustments$/.test(pathname))
    return json({ adjustments: [] })
  const quote = pathname.match(/^\/api\/admin\/quotes\/([^/]+)$/)
  if (quote && m === 'GET')
    return json(QUOTES.find((item) => item.id === quote[1]) ?? QUOTES[0])
  if (pathname === '/api/admin/financial/revenue') return json(revenue)
  if (pathname === '/api/admin/financial/aging') return json(aging)
  if (pathname === '/api/admin/financial/entries') {
    const totals = {
      gross: 4005,
      net: 3765,
      paid: 1280,
      paidNet: 1203,
      paidCount: 1,
      unpaid: 95,
      unpaidCount: 1,
      awaiting: 2630,
      awaitingCount: 2,
      count: 4,
    }
    return json({ entries: FINANCIAL_ENTRIES, totals })
  }
  if (pathname === '/api/admin/financial/calendar') {
    return json({
      events: FINANCIAL_ENTRIES.map((entry) => ({
        id: entry.id,
        title: entry.customerName,
        start: entry.dueDate,
        color: '#f59e0b',
        status: entry.billingStatus,
      })),
    })
  }
  if (pathname === '/api/admin/financial/settings') {
    return json({
      settings: {
        cpfRate: 6,
        cnpjRate: 2.5,
        cniRate: 3,
        taxRegime: 'SIMPLES_NACIONAL',
        issRate: 2.5,
        issExemptRental: true,
        ibsCbsActive: false,
      },
    })
  }
  if (pathname === '/api/admin/badges')
    return json({ email: 0, quotes: 2, rentals: 1, whatsapp: 0, financial: 1 })
  if (pathname === '/api/admin/notifications/sync')
    return json({ success: true, notifications: [], unreadCount: 0 })
  if (pathname === '/api/admin/equipments')
    return json({ equipments: EQUIPMENTS, total: EQUIPMENTS.length })
  if (pathname === '/api/admin/categories') return json(CATEGORIES)
  if (pathname === '/api/admin/rentals') return json({ rentals: RENTALS })
  const adminLegal = pathname.match(
    /^\/api\/admin\/settings\/legal-documents\/(terms|privacy|return-policy)$/
  )
  if (adminLegal)
    return json(
      m === 'DELETE'
        ? {
            kind: LEGAL_KINDS[adminLegal[1]],
            document: null,
            publishedAt: null,
          }
        : legalDocument(adminLegal[1])
    )
  if (pathname === '/api/admin/settings') {
    if (m === 'PUT')
      return json({
        ...adminSettings,
        message: 'Configurações atualizadas com sucesso!',
      })
    return json(adminSettings)
  }
  return panelResponse(m, pathname)
}

/** Área do cliente (sessão de cliente): vínculo, painel inicial, perfil, endereços, histórico e notificações. */
function clientResponse(m, pathname) {
  if (m !== 'GET') return null
  if (pathname === '/api/auth/organizations')
    return json({ memberships: [clientMembership] })
  if (pathname === '/api/auth/organizations/current')
    return json({ membership: clientMembership })
  if (pathname === '/api/client/activities')
    return json({ activities: CLIENT_ACTIVITIES })
  if (pathname === '/api/client/rentals')
    return json({ rentals: CLIENT_RENTALS })
  if (pathname === `/api/client/rentals/${CLIENT_RENTAL_DETAIL.id}`)
    return json({ rental: CLIENT_RENTAL_DETAIL })
  if (pathname === '/api/quotes') return json(CLIENT_QUOTES)
  if (pathname === '/api/user/profile')
    return json({
      user: {
        phone: '(51) 98888-1234',
        cpf: null,
        cnpj: null,
        company: 'Carla Reformas',
      },
    })
  if (pathname === '/api/addresses')
    return json({ addresses: CLIENT_ADDRESSES })
  if (pathname === '/api/client/notifications')
    return json({
      notifications: CLIENT_NOTIFICATIONS,
      pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
      stats: { total: 2, unread: 1, byType: { quote: 1, delivery: 1 } },
    })
  if (pathname === '/api/client/notifications/stats')
    return json({ total: 2, unread: 1 })
  return null
}

/** Telas do painel que entraram na linha de base na onda 135 (A9). */
function panelResponse(m, pathname) {
  if (m !== 'GET') return null
  if (pathname === '/api/admin/permissions')
    return json({ permissions: PERMISSIONS })
  if (pathname === '/api/admin/logistics')
    return json({ deliveries: DELIVERIES })
  if (pathname === '/api/admin/vehicles') return json({ vehicles: VEHICLES })
  if (pathname === '/api/admin/drivers') return json({ drivers: DRIVERS })
  if (pathname === '/api/admin/maintenance')
    return json({ maintenances: MAINTENANCES })
  if (pathname === '/api/admin/maintenance/scheduled')
    return json({
      maintenances: MAINTENANCES.filter((item) => item.status === 'SCHEDULED'),
    })
  if (pathname === '/api/admin/whatsapp/conversations')
    return json({
      conversations: WHATSAPP_CONVERSATIONS,
      total: WHATSAPP_CONVERSATIONS.length,
    })
  // E-mail sem a caixa Zoho conectada: o painel mostra o convite para conectar.
  if (pathname === '/api/admin/zoho-mail/accounts')
    return json({ error: 'Zoho Mail não conectado' }, 401)
  if (pathname === '/api/admin/equipment-units') return json(EQUIPMENT_UNITS)
  const equipment = pathname.match(/^\/api\/admin\/equipments\/([^/]+)$/)
  if (equipment) {
    const found = EQUIPMENTS.find((item) => item.id === equipment[1])
    return found
      ? json({ ...found, _count: { quoteItems: 3, reviews: 0 } })
      : json({ error: 'Equipamento não encontrado' }, 404)
  }
  return null
}
