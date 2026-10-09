import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DocumentContent } from './DocumentContent.web'
describe('Document renderer', () => {
  it('preserves tags, spacing, inline formatting and explicit slots', () => {
    const html = renderToStaticMarkup(
      <DocumentContent
        node={{
          tag: 'article',
          props: { id: 'policy' },
          children: [
            {
              tag: 'p',
              children: [
                'Leia ',
                { tag: 'strong', children: ['antes'] },
                ' de aceitar.',
              ],
            },
            { tag: 'Contact', props: { description: 'Dúvidas?' } },
          ],
        }}
        components={{
          Contact: ({ description }) => (
            <a href="mailto:tenant@example.test">{String(description)}</a>
          ),
        }}
      />
    )
    expect(html).toBe(
      '<article id="policy"><p>Leia <strong>antes</strong> de aceitar.</p><a href="mailto:tenant@example.test">Dúvidas?</a></article>'
    )
  })
  it('fails clearly when a content slot is not supplied', () => {
    expect(() =>
      renderToStaticMarkup(<DocumentContent node={{ tag: 'MissingSlot' }} />)
    ).toThrow('Componente de documento ausente: MissingSlot')
  })
})
