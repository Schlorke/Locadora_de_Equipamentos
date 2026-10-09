import { platformEmail } from './platform-mail'

export function subscriptionEmail(input: {
  platform: string
  organization: string
  heading: string
  message: string
  actionUrl: string
}) {
  return platformEmail(input)
}
