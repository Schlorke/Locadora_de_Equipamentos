import { AdminEmailPage } from '@gb-locacoes/frontend/pages/email-admin'
import { mailDevice } from '../../../host/mail-storage.native'
import { pickMailFiles } from '../../../host/mail-files.native'
import { connectMail } from '../../../host/mail-connect.native'
import { MailHtml } from '../../../host/mail-html.native'
const device = {
  ...mailDevice,
  pickFiles: pickMailFiles,
  connect: connectMail,
  html: (html: string, height: number) => (
    <MailHtml html={html} height={height} />
  ),
}
export default function EmailRoute() {
  return <AdminEmailPage device={device} />
}
