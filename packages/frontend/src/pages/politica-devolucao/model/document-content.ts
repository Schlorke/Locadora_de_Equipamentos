// Apresentação da Política de Devolução (onda 134, lote vitrine-conteúdo): o título e o subtítulo do modelo de site e
// as classes de cada parte do documento. O texto (e a data da última atualização) é o documento publicado pela própria
// locadora (`entities/documento-legal`); a GB recebe o dela pelo tools/gb-site-settings.mjs. Com o documento da GB,
// estas classes dão a mesma árvore de antes da troca (tests/unit/gb-legal-documents.parity.test.ts).
import type { ClassesDoDocumento } from '../../../entities/documento-legal'

export const documentMetadata = {
  title: 'Política de Devolução',
  subtitle:
    'Saiba como funciona o processo de devolução dos equipamentos locados',
}

const CARTAO =
  'relative overflow-hidden bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border-0'

export const CLASSES_DA_DEVOLUCAO: ClassesDoDocumento = {
  cartao: CARTAO,
  cartaoDaSecao: CARTAO + ' scroll-mt-32',
  conteudo: 'relative z-10 p-6 md:p-8',
  introducao:
    'p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 border border-blue-100/50',
  textoDaIntroducao: 'text-[16px] leading-relaxed text-gray-700 m-0',
  titulo: 'text-[20px] font-bold text-gray-900 mb-4 flex items-center gap-3',
  numero: 'text-orange-600',
  corpo: 'space-y-4 leading-relaxed',
  corpoComContato: 'space-y-4',
  paragrafo: 'text-[16px] text-gray-700',
  paragrafoComContato: 'text-[16px] text-gray-700 leading-relaxed',
  lista: 'list-disc list-inside space-y-2 ml-4 text-[16px] text-gray-700',
}
