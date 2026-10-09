import { notFound } from 'next/navigation'

// Landing e diretório do apex só entram com design aprovado (U3, Lote 7c). Até lá, 404 neutro.
export default function PlatformHome() {
  notFound()
}
