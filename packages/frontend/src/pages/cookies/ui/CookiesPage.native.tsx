import { Card, CardContent, DocumentContent } from '@gb-locacoes/ui'
import { CheckCircle } from 'lucide-react-native'
import { ContactInfoCard } from '../../../widgets/contato-empresa'
import { LegalDocument } from '../../../widgets/documento-legal'
import {
  sections,
  documentBlocks,
  documentMetadata,
} from '../model/document-content'
const components = { Card, CardContent, ContactInfoCard, CheckCircle }
export function CookiesPage() {
  return (
    <LegalDocument
      {...documentMetadata}
      introduction={
        <DocumentContent node={documentBlocks[0]!} components={components} />
      }
      sections={sections.map((section, index) => ({
        ...section,
        content: (
          <DocumentContent
            node={documentBlocks[index + 1]!}
            components={components}
          />
        ),
      }))}
    />
  )
}
