'use client'

import {
  useTenantContext,
  usePublicTenantSlug,
} from '../../../entities/organizacao'
import { useSession } from '../../../entities/sessao'
import { useApiClientRevision } from '../../../shared/api'

import { HeroCarouselPreview } from './HeroCarouselPreview.web'
import { Button } from '@gb-locacoes/ui'
import { ImageUpload } from '@gb-locacoes/ui'
import { Input } from '@gb-locacoes/ui'
import { Label } from '@gb-locacoes/ui'
import { Switch } from '@gb-locacoes/ui'
import { Textarea } from '@gb-locacoes/ui'
import * as Tooltip from '@radix-ui/react-tooltip'
import { motion } from 'framer-motion'
import {
  Building2,
  Clock,
  Code,
  FileText,
  Images,
  Loader2,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react'
import Image from 'next/image'
import { useSettingsData } from '../model/use-settings-data.web'
import { SettingsBlock } from './SettingsBlock.web'
import { SettingsNavigationBar } from './SettingsNavigationBar.web'
import {
  HorarioDeFuncionamento,
  PreviaDoHorario,
} from './HorarioDeFuncionamento.web'
import { ConteudoDoSite } from './ConteudoDoSite.web'
import { Compromissos, PreviaDosCompromissos } from './Compromissos.web'
import { TextosLegais } from './TextosLegais.web'
import { MedicaoEVerificacao } from './MedicaoEVerificacao.web'
import {
  CompanyInfoPreview,
  CustomSettingsPreview,
  SeoPreview,
  SocialLinksPreview,
  SystemPreview,
} from './SettingsPreviews.web'

export function AdminConfiguracoesPage() {
  const tenant = useTenantContext()
  const slug = usePublicTenantSlug()
  const { data: session } = useSession()
  const revision = useApiClientRevision()
  const scope = JSON.stringify([
    tenant?.tenant.id,
    tenant?.role,
    slug,
    session?.user?.id,
    revision,
  ])
  return <AdminConfiguracoesPageContent key={scope} />
}
function AdminConfiguracoesPageContent() {
  // Locadora selecionada: o nome dela nos previews, nunca a marca de outra (achado 143).
  const tenant = useTenantContext()
  const {
    isLoadingData,
    activeSection,
    fileInputRef,
    isUploadingLogo,
    heroCarouselIndex,
    setHeroCarouselIndex,
    sectionLoading,
    sectionResetting,
    formData,
    updateField,
    handlePhoneChange,
    handleLogoUpload,
    uploadHeroFile,
    handleRemoveLogo,
    saveSection,
    resetSection,
    handleSectionChange,
    horario,
    atualizarHorario,
    errosDoHorario,
    conteudo,
    atualizarConteudo,
    errosDoConteudo,
    usarMinhasCategorias,
    carregandoCategorias,
  } = useSettingsData()

  if (isLoadingData) {
    return (
      <div className="h-screen w-full overflow-hidden bg-gray-50 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"
        />
      </div>
    )
  }

  return (
    <Tooltip.Provider delayDuration={150} skipDelayDuration={250}>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto space-y-6 p-3 sm:p-4 lg:p-6 xl:p-8 pb-24 md:pb-12">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 rounded-2xl p-6 text-white shadow-xl">
              <div className="absolute inset-0"></div>
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent"></div>
              <div className="relative z-10">
                <div className="mb-4">
                  <h1 className="text-3xl font-bold mb-2 text-white drop-shadow-sm">
                    Configurações do Sistema
                  </h1>
                  <p className="text-orange-50 font-medium">
                    Gerencie as configurações gerais da plataforma com preview
                    em tempo real
                  </p>
                </div>
                <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2 w-fit">
                  <Settings className="w-5 h-5 text-orange-50" />
                  <span className="font-semibold text-white">
                    Configurações Globais
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <SettingsNavigationBar
              onSectionSelect={handleSectionChange}
              activeSection={activeSection}
            />
          </motion.div>

          <div id="settings-content-container" className="space-y-8">
            {activeSection === 'company' && (
              <motion.div
                id="section-company"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <SettingsBlock
                  title="Informações da Empresa"
                  description="Dados básicos da empresa e informações de contato"
                  icon={Building2}
                  form={
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <Label className="text-base font-semibold block text-center">
                          Logo da Empresa
                        </Label>
                        {formData.companyIconUrl && (
                          <div className="flex justify-center">
                            <div className="relative inline-block">
                              <div className="relative w-32 h-32 border-2 border-gray-200 rounded-lg overflow-hidden bg-white">
                                <Image
                                  src={formData.companyIconUrl}
                                  alt="Logo da empresa"
                                  fill
                                  className="object-contain p-2"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={handleRemoveLogo}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors shadow-md"
                                aria-label="Remover logo"
                                title="Remover logo"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                        <div>
                          <Label htmlFor="companyIconUrl" className="text-sm">
                            URL do Logo
                          </Label>
                          <Input
                            id="companyIconUrl"
                            value={formData.companyIconUrl || ''}
                            onChange={(e) =>
                              updateField('companyIconUrl', e.target.value)
                            }
                            placeholder="https://exemplo.com/logo.png"
                            className="mt-1"
                          />
                          <p className="mt-1 text-xs leading-[var(--line-height-paragraph)] text-[var(--text-secondary)]">
                            Cole a URL do logo ou faça upload de uma imagem
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-px bg-gray-200"></div>
                          <span className="text-sm text-gray-500">ou</span>
                          <div className="flex-1 h-px bg-gray-200"></div>
                        </div>
                        <div>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="hidden"
                            aria-label="Selecionar imagem para upload do logo da empresa"
                            title="Selecionar imagem para upload do logo"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploadingLogo}
                            className="w-full"
                          >
                            {isUploadingLogo ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Enviando...
                              </>
                            ) : (
                              <>
                                <Upload className="w-4 h-4 mr-2" />
                                Fazer Upload de Imagem
                              </>
                            )}
                          </Button>
                          <p className="mt-1 text-xs leading-[var(--line-height-paragraph)] text-[var(--text-secondary)]">
                            Tamanho recomendado: 512x512px • Formatos: PNG, JPG,
                            SVG
                          </p>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="companyPhone">Telefone Fixo</Label>
                        <Input
                          id="companyPhone"
                          value={formData.companyPhone || ''}
                          onChange={(e) =>
                            handlePhoneChange('companyPhone', e.target.value)
                          }
                          placeholder="(11) 3000-0000"
                          className="mt-1"
                        />
                        <p className="mt-1 text-xs leading-[var(--line-height-paragraph)] text-[var(--text-secondary)]">
                          Telefone fixo da empresa exibido em todo o site
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="whatsappNumber">
                          WhatsApp / Celular
                        </Label>
                        <Input
                          id="whatsappNumber"
                          value={formData.whatsappNumber || ''}
                          onChange={(e) =>
                            handlePhoneChange('whatsappNumber', e.target.value)
                          }
                          placeholder="(11) 99999-0000"
                          className="mt-1"
                        />
                        <p className="mt-1 text-xs leading-[var(--line-height-paragraph)] text-[var(--text-secondary)]">
                          Número WhatsApp/celular exibido em todo o site
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="contactEmail">E-mail de Contato</Label>
                        <Input
                          id="contactEmail"
                          type="email"
                          value={formData.contactEmail || ''}
                          onChange={(e) =>
                            updateField('contactEmail', e.target.value)
                          }
                          placeholder="contato@sualocadora.com.br"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="marketingEmail">
                          E-mail Comercial / No-reply
                        </Label>
                        <Input
                          id="marketingEmail"
                          type="email"
                          value={formData.marketingEmail || ''}
                          onChange={(e) =>
                            updateField('marketingEmail', e.target.value)
                          }
                          placeholder="comercial@sualocadora.com.br"
                          className="mt-1"
                        />
                        <p className="mt-1 text-xs leading-[var(--line-height-paragraph)] text-[var(--text-secondary)]">
                          Endereço usado para disparos automáticos e
                          comunicações comerciais.
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="companyAddress">Endereço</Label>
                        <Textarea
                          id="companyAddress"
                          value={formData.companyAddress || ''}
                          onChange={(e) =>
                            updateField('companyAddress', e.target.value)
                          }
                          placeholder="Endereço completo da empresa"
                          className="mt-1"
                          rows={3}
                        />
                      </div>

                      <div>
                        <Label htmlFor="aboutUsText">
                          Sobre Nós / Descrição SEO
                        </Label>
                        <Textarea
                          id="aboutUsText"
                          value={formData.aboutUsText || ''}
                          onChange={(e) =>
                            updateField('aboutUsText', e.target.value)
                          }
                          placeholder="Ex: Locação de equipamentos para construção na sua cidade e região. Andaimes, betoneiras, compressores e muito mais. Qualidade e segurança garantidas."
                          className="mt-1"
                          rows={4}
                        />
                        <p className="mt-1 text-xs leading-[var(--line-height-paragraph)] text-[var(--text-secondary)]">
                          Texto sobre sua empresa exibido no rodapé do site.
                          Pode ser mais detalhado que a meta descrição.
                        </p>
                      </div>
                    </div>
                  }
                  preview={
                    <CompanyInfoPreview
                      data={{
                        // Nome da locadora selecionada; nunca a marca de outra (achado 143).
                        name: tenant?.tenant.name ?? '',
                        description: formData.aboutUsText,
                        address: formData.companyAddress,
                        phone: `${formData.companyPhone || ''} | ${formData.whatsappNumber || ''}`,
                        email: formData.contactEmail,
                        marketingEmail: formData.marketingEmail,
                        logoUrl: formData.companyIconUrl,
                      }}
                    />
                  }
                  onSave={() => saveSection('company')}
                  onReset={() => resetSection('company')}
                  isSaving={sectionLoading.company}
                  isResetting={sectionResetting.company}
                />
              </motion.div>
            )}

            {activeSection === 'hero' && (
              <motion.div
                id="section-hero"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <SettingsBlock
                  title="Carousel Principal"
                  description="Configure as imagens e conteúdo do carousel da página inicial"
                  icon={Images}
                  form={
                    <div className="space-y-6">
                      <ImageUpload
                        uploadFile={uploadHeroFile}
                        images={
                          formData.heroCarousel?.map((item) =>
                            typeof item === 'string' ? item : item.imageUrl
                          ) || []
                        }
                        onImagesChange={(urls) => {
                          updateField(
                            'heroCarousel',
                            urls.map((url) => ({ imageUrl: url }))
                          )
                        }}
                        maxImages={10}
                        currentImageIndex={heroCarouselIndex}
                        onImageIndexChange={setHeroCarouselIndex}
                        tooltipContent={
                          <>
                            💡 <strong>Background Padrão:</strong> Quando
                            nenhuma imagem estiver configurada, o fundo laranja
                            atual será exibido automaticamente no carrossel da
                            página inicial.
                          </>
                        }
                      />
                    </div>
                  }
                  preview={
                    <HeroCarouselPreview
                      name={tenant?.tenant.name ?? ''}
                      companyPhone={formData.companyPhone}
                      whatsappNumber={formData.whatsappNumber}
                      images={
                        formData.heroCarousel?.map((item) =>
                          typeof item === 'string' ? item : item.imageUrl
                        ) || []
                      }
                      anosDeMercado={conteudo.experienceYears}
                      waveAnimation={formData.waveAnimation}
                      onWaveAnimationChange={(value) =>
                        updateField('waveAnimation', value)
                      }
                    />
                  }
                  onSave={() => saveSection('hero')}
                  onReset={() => resetSection('hero')}
                  isSaving={sectionLoading.hero}
                  isResetting={sectionResetting.hero}
                />
              </motion.div>
            )}

            {activeSection === 'social' && (
              <motion.div
                id="section-social"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <SettingsBlock
                  title="Redes Sociais"
                  description="Configure os links das redes sociais da empresa"
                  icon={Share2}
                  form={
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="whatsappNumber">WhatsApp</Label>
                        <Input
                          id="whatsappNumber"
                          value={formData.whatsappNumber || ''}
                          onChange={(e) =>
                            handlePhoneChange('whatsappNumber', e.target.value)
                          }
                          placeholder="(11) 99999-0000"
                          className="mt-1"
                        />
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-500">
                          Campos para Instagram, Facebook, LinkedIn em
                          desenvolvimento
                        </p>
                      </div>
                    </div>
                  }
                  preview={<SocialLinksPreview data={{ socialLinks: [] }} />}
                  onSave={() => saveSection('social')}
                  onReset={() => resetSection('social')}
                  isSaving={sectionLoading.social}
                  isResetting={sectionResetting.social}
                />
              </motion.div>
            )}

            {activeSection === 'seo' && (
              <motion.div
                id="section-seo"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <SettingsBlock
                  title="SEO e Metadados"
                  description="Configure informações para otimização de motores de busca"
                  icon={Search}
                  form={
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="seoTitle">Título SEO</Label>
                        <Input
                          id="seoTitle"
                          value={formData.seoTitle || ''}
                          onChange={(e) =>
                            updateField('seoTitle', e.target.value)
                          }
                          placeholder="Sua Locadora - Equipamentos para Construção"
                          className="mt-1"
                        />
                        <p className="mt-1 text-xs leading-[var(--line-height-paragraph)] text-[var(--text-secondary)]">
                          Máximo 60 caracteres recomendado
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="seoDescription">Meta Descrição</Label>
                          <span
                            className={`text-xs font-medium ${
                              (formData.seoDescription || '').length > 160
                                ? 'text-red-600'
                                : (formData.seoDescription || '').length > 150
                                  ? 'text-orange-600'
                                  : 'text-gray-500'
                            }`}
                          >
                            {(formData.seoDescription || '').length}/160
                          </span>
                        </div>
                        <Textarea
                          id="seoDescription"
                          value={formData.seoDescription || ''}
                          onChange={(e) =>
                            updateField('seoDescription', e.target.value)
                          }
                          placeholder="Descreva sua empresa em até 160 caracteres."
                          className="mt-1"
                          rows={3}
                        />
                        <p className="mt-1 text-xs leading-[var(--line-height-paragraph)] text-[var(--text-secondary)]">
                          Máximo 160 caracteres. Aparece nos resultados do
                          Google.
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="favicon">Favicon URL</Label>
                        <Input
                          id="favicon"
                          value={formData.favicon || ''}
                          onChange={(e) =>
                            updateField('favicon', e.target.value)
                          }
                          placeholder="https://exemplo.com/favicon.ico"
                          className="mt-1"
                        />
                      </div>
                      {/* Onda 135 (A11): medição e verificação da locadora, gravadas no conteúdo do site. */}
                      <MedicaoEVerificacao
                        conteudo={conteudo}
                        erros={errosDoConteudo}
                        onChange={atualizarConteudo}
                      />
                    </div>
                  }
                  preview={
                    <SeoPreview
                      data={{
                        seoTitle: formData.seoTitle,
                        seoDescription: formData.seoDescription,
                        favicon: formData.favicon,
                      }}
                    />
                  }
                  onSave={() => saveSection('seo')}
                  onReset={() => resetSection('seo')}
                  isSaving={sectionLoading.seo}
                  isResetting={sectionResetting.seo}
                />
              </motion.div>
            )}

            {activeSection === 'system' && (
              <motion.div
                id="section-system"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <SettingsBlock
                  title="Configurações do Sistema"
                  description="Configurações gerais de funcionamento da plataforma"
                  icon={Settings}
                  form={
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Modo Manutenção</Label>
                          <p className="text-sm text-gray-500">
                            Ativar para manutenção do sistema
                          </p>
                        </div>
                        <Switch
                          checked={formData.maintenanceMode}
                          onCheckedChange={(checked) =>
                            updateField('maintenanceMode', checked)
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Chat de Suporte</Label>
                          <p className="text-sm text-gray-500">
                            Exibir widget de chat no site
                          </p>
                        </div>
                        <Switch
                          checked={formData.supportChat}
                          onCheckedChange={(checked) =>
                            updateField('supportChat', checked)
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="defaultLanguage">Idioma Padrão</Label>
                        <Input
                          id="defaultLanguage"
                          value={formData.defaultLanguage || ''}
                          onChange={(e) =>
                            updateField('defaultLanguage', e.target.value)
                          }
                          placeholder="pt-BR"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="baseCurrency">Moeda Base</Label>
                        <Input
                          id="baseCurrency"
                          value={formData.baseCurrency || ''}
                          onChange={(e) =>
                            updateField('baseCurrency', e.target.value)
                          }
                          placeholder="BRL"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  }
                  preview={
                    <SystemPreview
                      data={{
                        maintenanceMode: formData.maintenanceMode,
                        defaultCurrency: formData.baseCurrency,
                        timezone: 'America/Sao_Paulo',
                        allowRegistration: true,
                        requireEmailVerification: true,
                        maxQuoteItems: 50,
                      }}
                    />
                  }
                  onSave={() => saveSection('system')}
                  onReset={() => resetSection('system')}
                  isSaving={sectionLoading.system}
                  isResetting={sectionResetting.system}
                />
              </motion.div>
            )}

            {activeSection === 'hours' && (
              <motion.div
                id="section-hours"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <SettingsBlock
                  title="Horário de Funcionamento"
                  description="O horário aparece no rodapé, no contato e nos dados para os buscadores"
                  icon={Clock}
                  form={
                    <HorarioDeFuncionamento
                      horario={horario}
                      erros={errosDoHorario}
                      onChange={atualizarHorario}
                    />
                  }
                  preview={<PreviaDoHorario horario={horario} />}
                  onSave={() => saveSection('hours')}
                  onReset={() => resetSection('hours')}
                  isSaving={sectionLoading.hours}
                  isResetting={sectionResetting.hours}
                />
              </motion.div>
            )}

            {activeSection === 'content' && (
              <motion.div
                id="section-content"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <SettingsBlock
                  title="Conteúdo do Site"
                  description="Números, história, linha do tempo, destaques do rodapé, mapa, Merchant Center e avaliações"
                  icon={FileText}
                  form={
                    <ConteudoDoSite
                      conteudo={conteudo}
                      erros={errosDoConteudo}
                      onChange={atualizarConteudo}
                      onUsarCategorias={() => void usarMinhasCategorias()}
                      carregandoCategorias={carregandoCategorias}
                    />
                  }
                  preview={
                    <HeroCarouselPreview
                      name={tenant?.tenant.name ?? ''}
                      companyPhone={formData.companyPhone}
                      whatsappNumber={formData.whatsappNumber}
                      anosDeMercado={conteudo.experienceYears}
                      images={
                        formData.heroCarousel?.map((item) =>
                          typeof item === 'string' ? item : item.imageUrl
                        ) || []
                      }
                      waveAnimation={formData.waveAnimation}
                    />
                  }
                  onSave={() => saveSection('content')}
                  onReset={() => resetSection('content')}
                  isSaving={sectionLoading.content}
                  isResetting={sectionResetting.content}
                />
              </motion.div>
            )}

            {activeSection === 'commitments' && (
              <motion.div
                id="section-commitments"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <SettingsBlock
                  title="O que você garante aos clientes"
                  description="Compromissos comerciais que o site publica como promessa da sua locadora"
                  icon={ShieldCheck}
                  form={
                    <Compromissos
                      conteudo={conteudo}
                      onChange={atualizarConteudo}
                    />
                  }
                  preview={<PreviaDosCompromissos conteudo={conteudo} />}
                  onSave={() => saveSection('commitments')}
                  onReset={() => resetSection('commitments')}
                  isSaving={sectionLoading.commitments}
                  isResetting={sectionResetting.commitments}
                />
              </motion.div>
            )}

            {activeSection === 'legal' && (
              <motion.div
                id="section-legal"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <TextosLegais />
              </motion.div>
            )}

            {activeSection === 'custom' && (
              <motion.div
                id="section-custom"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <SettingsBlock
                  title="Configurações Avançadas"
                  description="CSS/JS customizado e códigos de rastreamento"
                  icon={Code}
                  form={
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="analyticsTrackingId">
                          Google Analytics ID
                        </Label>
                        <Input
                          id="analyticsTrackingId"
                          value={formData.analyticsTrackingId || ''}
                          onChange={(e) =>
                            updateField('analyticsTrackingId', e.target.value)
                          }
                          placeholder="GA_TRACKING_ID"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="customCss">CSS Customizado</Label>
                        <Textarea
                          id="customCss"
                          value={formData.customCss || ''}
                          onChange={(e) =>
                            updateField('customCss', e.target.value)
                          }
                          placeholder="/* CSS customizado */"
                          className="mt-1 font-mono text-sm"
                          rows={5}
                        />
                      </div>
                      <div>
                        <Label htmlFor="customJs">JavaScript Customizado</Label>
                        <Textarea
                          id="customJs"
                          value={formData.customJs || ''}
                          onChange={(e) =>
                            updateField('customJs', e.target.value)
                          }
                          placeholder="// JavaScript customizado"
                          className="mt-1 font-mono text-sm"
                          rows={5}
                        />
                      </div>
                    </div>
                  }
                  preview={
                    <CustomSettingsPreview
                      data={{
                        customCss: formData.customCss,
                        customJs: formData.customJs,
                        gtmId: formData.analyticsTrackingId,
                      }}
                    />
                  }
                  onSave={() => saveSection('custom')}
                  onReset={() => resetSection('custom')}
                  isSaving={sectionLoading.custom}
                  isResetting={sectionResetting.custom}
                />
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </Tooltip.Provider>
  )
}
