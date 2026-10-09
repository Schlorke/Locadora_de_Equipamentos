// Trechos de frase de compromisso comercial que a trava (tests/unit/compromissos-do-modelo.test.ts) procura fora do
// modelo (packages/frontend/src/entities/configuracao/model/compromissos.ts) e que o teste do modelo usa para conferir
// que toda frase publicada está vigiada. Moram aqui, e não no modelo, porque só os testes os leem (pnpm hygiene: export
// que só teste usa é sobra). Cobrem as frases do modelo, sem as declarações de valor, e as variantes antigas que não
// podem voltar.

/** Variantes antigas: saíram das telas (onda 134, parte B) e não existem no modelo; a trava impede que voltem. */
export const VARIANTES_ANTIGAS: readonly string[] = [
  // App, "Por que escolher" do detalhe do equipamento (antes do B7).
  'Qualidade e segurança garantidas em todos os equipamentos',
]

export const FRASES_VIGIADAS: readonly string[] = [
  'Equipamento Certificado',
  'Entrega Gratuita',
  'Suporte Garantido',
  'Manutenção preventiva',
  'Suporte técnico 24h',
  'Entrega e retirada',
  'Equipamentos Certificados',
  'certificações de segurança',
  'Entrega Rápida',
  'Entrega no mesmo dia',
  'Suporte 24h',
  'disponível 24 horas para suporte',
  'possuem certificação e passam por manutenção preventiva',
  'com logística própria e rastreamento',
  'Rastreamento dos Equipamentos',
  'Sistema de rastreamento que identifica',
  'Agendamento Flexível',
  'Entrega e coleta nos horários',
  'certificação de segurança',
  'Consultoria Gratuita',
  'Suporte Técnico',
  'Resposta em até 24 horas',
  'Resposta rápida garantida',
  ...VARIANTES_ANTIGAS,
]
