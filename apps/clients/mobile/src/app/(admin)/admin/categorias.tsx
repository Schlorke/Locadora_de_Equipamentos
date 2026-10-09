import { AdminCategoriesPage } from '@gb-locacoes/frontend/pages/categorias'
import { pickCategorySvg } from '../../../host/category-svg.native'
export default function CategoriesRoute() {
  return <AdminCategoriesPage pickSvg={pickCategorySvg} />
}
