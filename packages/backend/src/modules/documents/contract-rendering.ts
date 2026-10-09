import { contractHtmlTokens } from '@gb-locacoes/design-tokens/documents'

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ]!
  )
}

export function generateContractHTML(
  rental: {
    id: string
    startdate: Date | string
    enddate: Date | string
    total: number | string
    users: { name: string | null; email: string; phone: string | null }
    rental_items: Array<{
      quantity: number
      totaldays: number
      totalprice: number | string
      equipments: { name: string }
    }>
  },
  organizationName: string
): string {
  const startDate = new Date(rental.startdate).toLocaleDateString('pt-BR')
  const endDate = new Date(rental.enddate).toLocaleDateString('pt-BR')
  const total = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(rental.total))

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Contrato de Locação - ${escapeHtml(rental.id)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; }
        h1 { color: ${contractHtmlTokens.brand}; border-bottom: 2px solid ${contractHtmlTokens.brand}; padding-bottom: 10px; }
        .section { margin: 20px 0; }
        .equipment-item { padding: 10px; background: ${contractHtmlTokens.equipmentBackground}; margin: 5px 0; border-radius: 5px; }
        .signature { margin-top: 50px; }
      </style>
    </head>
    <body>
      <h1>CONTRATO DE LOCAÇÃO DE EQUIPAMENTOS</h1>

      <div class="section">
        <h2>1. DADOS DAS PARTES</h2>
        <p><strong>Locador:</strong> ${escapeHtml(organizationName)}</p>
        <p><strong>Locatário:</strong> ${escapeHtml(rental.users.name || 'N/A')}</p>
        <p><strong>Email:</strong> ${escapeHtml(rental.users.email)}</p>
        <p><strong>Telefone:</strong> ${escapeHtml(rental.users.phone || 'N/A')}</p>
      </div>

      <div class="section">
        <h2>2. EQUIPAMENTOS LOCADOS</h2>
        ${rental.rental_items
          .map(
            (item) => `
          <div class="equipment-item">
            <p><strong>${escapeHtml(item.equipments.name)}</strong></p>
            <p>Quantidade: ${item.quantity} | Período: ${item.totaldays} dias</p>
            <p>Valor: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item.totalprice))}</p>
          </div>
        `
          )
          .join('')}
      </div>

      <div class="section">
        <h2>3. PERÍODO DE LOCAÇÃO</h2>
        <p><strong>Data de Início:</strong> ${startDate}</p>
        <p><strong>Data de Término:</strong> ${endDate}</p>
      </div>

      <div class="section">
        <h2>4. VALOR TOTAL</h2>
        <p><strong>Valor Total da Locação:</strong> ${total}</p>
      </div>

      <div class="section">
        <h2>5. CONDIÇÕES GERAIS</h2>
        <p><strong>5.1.</strong> O locatário se compromete a devolver os equipamentos no prazo estabelecido e em bom estado de conservação.</p>
        <p><strong>5.2.</strong> Em caso de atraso na devolução, será cobrada multa diária de 10% do valor da diária por dia de atraso.</p>
        <p><strong>5.3.</strong> Danos aos equipamentos serão cobrados do locatário conforme avaliação técnica.</p>
        <p><strong>5.4.</strong> O locatário é responsável pelo uso adequado dos equipamentos conforme instruções fornecidas.</p>
        <p><strong>5.5.</strong> Em caso de perda ou roubo, o locatário será responsável pelo valor integral do equipamento.</p>
        <p><strong>5.6.</strong> O locador não se responsabiliza por acidentes ou danos causados pelo uso inadequado dos equipamentos.</p>
        <p><strong>5.7.</strong> O locatário deve manter os equipamentos em local seguro e protegido.</p>
        <p><strong>5.8.</strong> É proibida a sublocação dos equipamentos sem autorização prévia do locador.</p>
      </div>

      <div class="section">
        <h2>6. PAGAMENTO</h2>
        <p><strong>6.1.</strong> O pagamento deve ser realizado conforme acordado no momento da contratação.</p>
        <p><strong>6.2.</strong> Em caso de atraso no pagamento, será cobrado juros de 1% ao mês mais multa de 2%.</p>
        <p><strong>6.3.</strong> O não pagamento pode resultar na rescisão do contrato e cobrança judicial.</p>
      </div>

      <div class="section">
        <h2>7. RESCISÃO</h2>
        <p><strong>7.1.</strong> O contrato pode ser rescindido por qualquer das partes mediante aviso prévio de 48 horas.</p>
        <p><strong>7.2.</strong> Em caso de rescisão antecipada pelo locatário, não haverá devolução proporcional do valor pago.</p>
        <p><strong>7.3.</strong> O locador pode rescindir o contrato em caso de inadimplência ou uso inadequado dos equipamentos.</p>
      </div>

      <div class="section">
        <h2>8. FORO</h2>
        <p>Fica eleito o foro da comarca de Porto Alegre/RS para dirimir quaisquer controvérsias oriundas do presente contrato.</p>
      </div>

      <div class="signature">
        <p>Porto Alegre, ${new Date().toLocaleDateString('pt-BR')}</p>
        <br><br>
        <p>_________________________</p>
        <p>Locador - ${escapeHtml(organizationName)}</p>
        <br><br>
        <p>_________________________</p>
        <p>Locatário - ${escapeHtml(rental.users.name || 'N/A')}</p>
      </div>
    </body>
    </html>
  `
}
