import type { LegalDocumentProps } from './contract'
export function LegalDocument({
  title,
  subtitle,
  updatedAt,
  introduction,
  sections,
}: LegalDocumentProps) {
  return (
    <article>
      <header>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
        {updatedAt ? <p>Última atualização: {updatedAt}</p> : null}
      </header>
      <nav aria-label="Índice">
        {sections.map((section, index) => (
          <a key={section.id} href={'#' + section.id}>
            {index + 1}. {section.title}
          </a>
        ))}
      </nav>
      {introduction}
      {sections.map((section) => (
        <section key={section.id} id={section.id}>
          {section.content}
        </section>
      ))}
    </article>
  )
}
