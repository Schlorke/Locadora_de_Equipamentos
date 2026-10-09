import { Text } from 'react-native'
import { Card, CardContent, DocumentContent, useTheme } from '@gb-locacoes/ui'
import {
  avisoDoDocumentoLegal,
  nosDoDocumento,
  useDocumentoLegal,
  type DocumentoLegalInicial,
} from '../../../entities/documento-legal'
import { ContactInfoCard } from '../../../widgets/contato-empresa'
import { LegalDocument } from '../../../widgets/documento-legal'
import {
  CLASSES_DA_PRIVACIDADE,
  documentMetadata,
} from '../model/document-content'
const components = { Card, CardContent, ContactInfoCard }

/**
 * Página legal do app com o documento publicado pela própria locadora (onda 134), nos mesmos nós da web
 * (`nosDoDocumento`); sem documento, o aviso do estado (não publicado, versão nova ou erro).
 */
export function PrivacidadePage({
  documento = null,
}: {
  documento?: DocumentoLegalInicial | null
}) {
  const theme = useTheme()
  const estado = useDocumentoLegal('privacy', { inicial: documento })
  if (estado.status !== 'publicado')
    return (
      <LegalDocument
        {...documentMetadata}
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
  const publicado = estado.documento
  const nos = nosDoDocumento(publicado, CLASSES_DA_PRIVACIDADE)
  const introducao = publicado.intro ? nos[0] : undefined
  const secoes = publicado.intro ? nos.slice(1) : nos
  return (
    <LegalDocument
      {...documentMetadata}
      updatedAt={publicado.lastUpdated}
      introduction={
        introducao ? (
          <DocumentContent node={introducao} components={components} />
        ) : undefined
      }
      sections={publicado.sections.map((section, index) => ({
        id: section.id,
        title: section.title,
        content: (
          <DocumentContent node={secoes[index]!} components={components} />
        ),
      }))}
    />
  )
}
