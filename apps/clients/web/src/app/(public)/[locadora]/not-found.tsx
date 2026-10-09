import { NotFoundContent } from '../../../host/ui/NotFoundContent'

// 404 dentro do site da locadora (ex.: equipamento inexistente ou de outra locadora): mantém o shell da vitrine.
export default function TenantNotFound() {
  return <NotFoundContent />
}
