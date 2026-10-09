import type { ReactNode } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import {
  Button,
  Card,
  Input,
  Textarea,
  Switch,
  ImageUpload,
  useTheme,
} from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import {
  useTenantContext,
  usePublicTenantSlug,
} from '../../../entities/organizacao'
import { useSession } from '../../../entities/sessao'
import { useApiClientRevision } from '../../../shared/api'
import { useSettingsData, type SectionKey } from '../model/use-settings-data'
import type { SettingsInput } from '../model/settings.schema'
import type { SettingsImagePicker } from '../model/media'
import { SettingsPreviews } from './SettingsPreviews.native'
import {
  HorarioDeFuncionamento,
  PreviaDoHorario,
} from './HorarioDeFuncionamento.native'
import { ConteudoDoSite } from './ConteudoDoSite.native'
import { Compromissos, PreviaDosCompromissos } from './Compromissos.native'
import { TextosLegais } from './TextosLegais.native'
import { MedicaoEVerificacao } from './MedicaoEVerificacao.native'
interface Props {
  pickImages: SettingsImagePicker
  image(props: { src: string; alt: string; height: number }): ReactNode
}
const sections = [
  ['company', 'Informações da Empresa'],
  ['hero', 'Carrossel Principal'],
  ['social', 'Redes Sociais'],
  ['seo', 'SEO & Meta Tags'],
  ['system', 'Configurações do Sistema'],
  ['custom', 'Configurações Personalizadas'],
  // Onda 134: horário, conteúdo do site, compromissos e textos legais da locadora.
  ['hours', 'Horário de Funcionamento'],
  ['content', 'Conteúdo do Site'],
  ['commitments', 'O que você garante'],
  ['legal', 'Textos Legais'],
] as const
/** Seções salvas pelo formulário inteiro (os textos legais têm a própria publicação). */
const ORIGINAIS: readonly string[] = [
  'company',
  'hero',
  'social',
  'seo',
  'system',
  'custom',
]
function Content({ pickImages, image }: Props) {
  const m = useSettingsData({ pickImages }),
    theme = useTheme(),
    section = m.activeSection as SectionKey | 'legal',
    f = m.formData,
    // Nome da locadora selecionada nos previews; nunca a marca de outra (achado 143).
    nomeDaLocadora = useTenantContext()?.tenant.name ?? ''
  const text = (value: ReactNode) => (
    <Text style={{ color: theme.text }}>{value}</Text>
  )
  const field = (
    label: string,
    key: keyof SettingsInput,
    multiline = false,
    phone = false
  ) => (
    <View style={{ gap: space.xs }}>
      {text(label)}
      {multiline ? (
        <Textarea
          aria-label={label}
          value={String(f[key] ?? '')}
          onChangeText={(value) => m.updateField(key, value)}
        />
      ) : (
        <Input
          aria-label={label}
          value={String(f[key] ?? '')}
          onChangeText={(value) =>
            phone ? m.handlePhoneChange(key, value) : m.updateField(key, value)
          }
        />
      )}
    </View>
  )
  if (m.isLoadingData)
    return (
      <View>
        <ActivityIndicator color={theme.primary} />
        {text('Carregando configurações...')}
      </View>
    )
  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }}>
      <Text
        accessibilityRole="header"
        style={{
          color: theme.text,
          fontSize: typography.size.xl,
          fontWeight: typography.weight.bold,
        }}
      >
        Configurações do Sistema
      </Text>
      {text('Configurações Globais')}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {sections.map(([key, label]) => (
          <Button
            key={key}
            variant={section === key ? 'default' : 'outline'}
            onClick={() => m.handleSectionChange(key)}
          >
            {label}
          </Button>
        ))}
      </View>
      {section === 'legal' ? (
        <TextosLegais />
      ) : (
        <Card>
          <View style={{ gap: space.md }}>
            {section === 'hours' ? (
              <>
                <Text
                  accessibilityRole="header"
                  style={{
                    color: theme.text,
                    fontWeight: typography.weight.bold,
                  }}
                >
                  Horário de Funcionamento
                </Text>
                <HorarioDeFuncionamento
                  horario={m.horario}
                  erros={m.errosDoHorario}
                  onChange={m.atualizarHorario}
                />
                <PreviaDoHorario horario={m.horario} />
              </>
            ) : null}
            {section === 'content' ? (
              <>
                <Text
                  accessibilityRole="header"
                  style={{
                    color: theme.text,
                    fontWeight: typography.weight.bold,
                  }}
                >
                  Conteúdo do Site
                </Text>
                <ConteudoDoSite
                  conteudo={m.conteudo}
                  erros={m.errosDoConteudo}
                  onChange={m.atualizarConteudo}
                  onUsarCategorias={() => void m.usarMinhasCategorias()}
                  carregandoCategorias={m.carregandoCategorias}
                />
              </>
            ) : null}
            {section === 'commitments' ? (
              <>
                <Text
                  accessibilityRole="header"
                  style={{
                    color: theme.text,
                    fontWeight: typography.weight.bold,
                  }}
                >
                  O que você garante aos clientes
                </Text>
                <Compromissos
                  conteudo={m.conteudo}
                  onChange={m.atualizarConteudo}
                />
                <PreviaDosCompromissos conteudo={m.conteudo} />
              </>
            ) : null}
            {section === 'company' ? (
              <>
                <Text
                  accessibilityRole="header"
                  style={{
                    color: theme.text,
                    fontWeight: typography.weight.bold,
                  }}
                >
                  Informações da Empresa
                </Text>
                {text('Logo da Empresa')}
                {f.companyIconUrl
                  ? image({
                      src: f.companyIconUrl,
                      alt: 'Logo da empresa',
                      height: space.xxl * 4,
                    })
                  : null}
                {field('URL do Logo', 'companyIconUrl')}
                <Button
                  variant="outline"
                  disabled={m.isUploadingLogo}
                  onClick={() => void m.chooseLogo()}
                >
                  {m.isUploadingLogo ? 'Enviando...' : 'Fazer Upload de Imagem'}
                </Button>
                {f.companyIconUrl ? (
                  <Button variant="outline" onClick={m.handleRemoveLogo}>
                    Remover logo
                  </Button>
                ) : null}
                {text(
                  'Tamanho recomendado: 512x512px • Formatos: PNG, JPG, SVG'
                )}
                {field('Telefone Fixo', 'companyPhone', false, true)}
                {field('WhatsApp / Celular', 'whatsappNumber', false, true)}
                {field('E-mail de Contato', 'contactEmail')}
                {field('E-mail Comercial', 'marketingEmail')}
                {field('Endereço', 'companyAddress', true)}
                {field('Sobre Nós / Descrição SEO', 'aboutUsText', true)}
              </>
            ) : null}
            {section === 'hero' ? (
              <>
                <Text
                  accessibilityRole="header"
                  style={{
                    color: theme.text,
                    fontWeight: typography.weight.bold,
                  }}
                >
                  Carousel Principal
                </Text>
                <ImageUpload
                  sectionTitle="Carousel Principal"
                  images={(f.heroCarousel ?? []).map((item) =>
                    typeof item === 'string' ? item : item.imageUrl
                  )}
                  maxImages={10}
                  chooseImages={m.chooseHeroImages}
                  renderImage={(src, alt) =>
                    image({ src, alt, height: space.xxl * 4 })
                  }
                  onImagesChange={(urls) =>
                    m.updateField(
                      'heroCarousel',
                      urls.map((imageUrl) => ({ imageUrl }))
                    )
                  }
                />
                {text(
                  'Quando nenhuma imagem estiver configurada, o fundo laranja atual será exibido automaticamente no carrossel da página inicial.'
                )}
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: space.sm,
                  }}
                >
                  {(
                    [
                      ['none', 'Sem Onda'],
                      ['static', 'Estática'],
                      ['animated', 'Animada'],
                    ] as const
                  ).map(([key, label]) => (
                    <Button
                      key={key}
                      variant={f.waveAnimation === key ? 'default' : 'outline'}
                      onClick={() => m.updateField('waveAnimation', key)}
                    >
                      {label}
                    </Button>
                  ))}
                </View>
              </>
            ) : null}
            {section === 'social' ? (
              <>
                <Text
                  accessibilityRole="header"
                  style={{
                    color: theme.text,
                    fontWeight: typography.weight.bold,
                  }}
                >
                  Redes Sociais
                </Text>
                {field('WhatsApp', 'whatsappNumber', false, true)}
                {text(
                  'Campos para Instagram, Facebook, LinkedIn em desenvolvimento'
                )}
              </>
            ) : null}
            {section === 'seo' ? (
              <>
                <Text
                  accessibilityRole="header"
                  style={{
                    color: theme.text,
                    fontWeight: typography.weight.bold,
                  }}
                >
                  SEO e Metadados
                </Text>
                {field('Título SEO', 'seoTitle')}
                {text('Máximo 60 caracteres recomendado')}
                {field('Meta Descrição', 'seoDescription', true)}
                <Text
                  style={{
                    color:
                      f.seoDescription.length > 160
                        ? theme.danger
                        : f.seoDescription.length > 150
                          ? theme.primary
                          : theme.textMuted,
                  }}
                >
                  {f.seoDescription.length}/160
                </Text>
                {field('Favicon URL', 'favicon')}
                {/* Onda 135 (A11): medição e verificação da locadora, gravadas no conteúdo do site. */}
                <MedicaoEVerificacao
                  conteudo={m.conteudo}
                  erros={m.errosDoConteudo}
                  onChange={m.atualizarConteudo}
                />
              </>
            ) : null}
            {section === 'system' ? (
              <>
                <Text
                  accessibilityRole="header"
                  style={{
                    color: theme.text,
                    fontWeight: typography.weight.bold,
                  }}
                >
                  Configurações do Sistema
                </Text>
                {text('Modo Manutenção')}
                <Switch
                  aria-label="Modo Manutenção"
                  checked={f.maintenanceMode}
                  onCheckedChange={(value) =>
                    m.updateField('maintenanceMode', value)
                  }
                />
                {text('Chat de Suporte')}
                <Switch
                  aria-label="Chat de Suporte"
                  checked={f.supportChat}
                  onCheckedChange={(value) =>
                    m.updateField('supportChat', value)
                  }
                />
                {field('Idioma Padrão', 'defaultLanguage')}
                {field('Moeda Base', 'baseCurrency')}
              </>
            ) : null}
            {section === 'custom' ? (
              <>
                <Text
                  accessibilityRole="header"
                  style={{
                    color: theme.text,
                    fontWeight: typography.weight.bold,
                  }}
                >
                  Configurações Avançadas
                </Text>
                {field('Google Analytics ID', 'analyticsTrackingId')}
                {field('CSS Customizado', 'customCss', true)}
                {field('JavaScript Customizado', 'customJs', true)}
              </>
            ) : null}
            {ORIGINAIS.includes(section) ? (
              <SettingsPreviews
                section={section as SectionKey}
                data={f}
                name={nomeDaLocadora}
                image={image}
              />
            ) : null}
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button
                variant="reset"
                disabled={
                  m.sectionLoading[section] || m.sectionResetting[section]
                }
                onClick={() => void m.resetSection(section)}
              >
                {m.sectionResetting[section] ? 'Resetando...' : 'Resetar'}
              </Button>
              <Button
                disabled={m.sectionLoading[section]}
                onClick={() => void m.saveSection(section)}
              >
                {m.sectionLoading[section]
                  ? 'Salvando...'
                  : 'Salvar Alterações'}
              </Button>
            </View>
          </View>
        </Card>
      )}
    </ScrollView>
  )
}
export function AdminConfiguracoesPage(props: Props) {
  const tenant = useTenantContext(),
    slug = usePublicTenantSlug(),
    { data: session } = useSession(),
    revision = useApiClientRevision()
  return (
    <Content
      {...props}
      key={JSON.stringify([
        tenant?.tenant.id,
        tenant?.tenant.status,
        tenant?.role,
        slug,
        session?.user?.id,
        revision,
      ])}
    />
  )
}
