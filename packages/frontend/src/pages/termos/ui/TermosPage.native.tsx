import { View, Text } from 'react-native'
import { Card, useTheme } from '@gb-locacoes/ui'
import { space, typography } from '@gb-locacoes/design-tokens'
import { storefrontLegalItemParts } from '@gb-locacoes/contracts/storefront-legal'
import {
  avisoDoDocumentoLegal,
  useDocumentoLegal,
  type DocumentoLegalInicial,
} from '../../../entities/documento-legal'
import { ContactInfoCard } from '../../../widgets/contato-empresa'
import { LegalDocument } from '../../../widgets/documento-legal'

const TITULO = 'Termos e Condições de Uso'
const SUBTITULO = 'Conheça as regras e condições para utilizar nossos serviços'

/**
 * Termos da própria locadora no app (onda 134): o documento publicado, lido pela rota pública; sem ele, o aviso do
 * estado (não publicado, versão nova que pede atualização ou erro). O texto é sempre texto.
 */
export function TermosPage({
  documento = null,
}: { documento?: DocumentoLegalInicial | null }) {
  const theme = useTheme()
  const estado = useDocumentoLegal('terms', { inicial: documento })
  if (estado.status !== 'publicado')
    return (
      <LegalDocument
        title={TITULO}
        subtitle={SUBTITULO}
        introduction={
          <Card>
            <Text accessibilityRole="alert" style={{ color: theme.textMuted }}>
              {avisoDoDocumentoLegal(estado)}
            </Text>
          </Card>
        }
        sections={[]}
      />
    )
  const texto = {
    color: theme.text,
    lineHeight: typography.size.md * typography.lineHeightRatio.body,
  }
  return (
    <LegalDocument
      title={TITULO}
      subtitle={SUBTITULO}
      updatedAt={estado.documento.lastUpdated}
      // A introdução publicada, antes das seções, como na web (TermosPage.web.tsx) e na Privacidade e na Devolução do app.
      introduction={
        estado.documento.intro ? (
          <Card>
            <Text style={texto}>{estado.documento.intro}</Text>
          </Card>
        ) : undefined
      }
      sections={estado.documento.sections.map((section, index) => ({
        id: section.id,
        title: section.title,
        content: (
          <Card>
            <View style={{ gap: space.md }}>
              <Text
                accessibilityRole="header"
                style={{
                  color: theme.text,
                  fontSize: typography.size.lg,
                  fontWeight: typography.weight.semibold,
                }}
              >
                {index + 1}. {section.title}
              </Text>
              {section.blocks.map((block, blockIndex) =>
                block.type === 'paragraph' ? (
                  <Text key={blockIndex} style={texto}>
                    {block.text}
                  </Text>
                ) : (
                  <View key={blockIndex} style={{ gap: space.sm }}>
                    {block.items.map((item, itemIndex) => {
                      const { lead, text } = storefrontLegalItemParts(item)
                      return (
                        <Text key={itemIndex} style={texto}>
                          •{' '}
                          {lead === null ? (
                            text
                          ) : (
                            <>
                              <Text
                                style={{ fontWeight: typography.weight.semibold }}
                              >
                                {lead}
                              </Text>
                              {text}
                            </>
                          )}
                        </Text>
                      )
                    })}
                  </View>
                )
              )}
              {section.contactCard ? (
                <ContactInfoCard
                  {...(section.contactCardNote
                    ? { description: section.contactCardNote }
                    : {})}
                />
              ) : null}
            </View>
          </Card>
        ),
      }))}
    />
  )
}
