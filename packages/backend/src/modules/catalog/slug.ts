export function slugify(text: string) {
  return text
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
}
