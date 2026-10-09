import { organizationSelection } from '../../../../../host/organization-selection'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0
export const GET = (request: Request) => organizationSelection(request, 'GET')
export const POST = (request: Request) => organizationSelection(request, 'POST')
export const DELETE = (request: Request) =>
  organizationSelection(request, 'DELETE')
