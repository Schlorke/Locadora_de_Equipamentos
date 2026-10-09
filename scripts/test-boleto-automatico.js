/**
 * Script de teste para geração automática de boleto ao criar orçamento
 *
 * Uso:
 *   node scripts/test-boleto-automatico.js
 *
 * Pré-requisitos:
 *   - Servidor rodando (pnpm dev)
 *   - Variáveis de ambiente configuradas (.env)
 *   - Pelo menos um equipamento no banco de dados
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'

async function getFirstEquipmentId() {
  try {
    const response = await fetch(`${BASE_URL}/api/equipments`)
    if (!response.ok) {
      throw new Error(`Erro ao buscar equipamentos: ${response.status}`)
    }
    const data = await response.json()

    // O endpoint retorna um array direto
    if (Array.isArray(data) && data.length > 0) {
      return data[0].id
    }

    throw new Error('Nenhum equipamento encontrado no banco de dados')
  } catch (error) {
    console.error('❌ Erro ao buscar equipamento:', error.message)
    throw error
  }
}

async function testCreateQuoteWithBoleto() {
  console.log(
    '🧪 Testando geração automática de boleto ao criar orçamento...\n'
  )

  try {
    // 1. Buscar um equipamento válido
    console.log('📦 Buscando equipamento válido...')
    const equipmentId = await getFirstEquipmentId()
    console.log(`✅ Equipamento encontrado: ${equipmentId}\n`)

    // 2. Preparar dados do orçamento
    const quoteData = {
      customerName: 'João da Silva Teste',
      customerEmail: 'joao.teste@example.com',
      customerPhone: '(11) 98765-4321',
      // CPF válido para testes (008.164.370-50) - opcional, pode ser omitido
      // Este CPF é válido e já foi usado em outros testes do projeto
      cpf: '00816437050',
      // cnpj omitido (campo opcional - não enviar null)
      customerCompany: 'Construtora Teste',
      cep: '01310-100',
      message: 'Teste de geração automática de boleto',
      items: [
        {
          equipmentId: equipmentId,
          quantity: 1,
          days: 7,
        },
      ],
    }

    console.log('📝 Dados do orçamento:')
    console.log(JSON.stringify(quoteData, null, 2))
    console.log('\n')

    // 3. Criar orçamento
    console.log('🚀 Criando orçamento...')
    const response = await fetch(`${BASE_URL}/api/orcamentos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(quoteData),
    })

    const responseData = await response.json()

    if (!response.ok) {
      console.error('❌ Erro na requisição:')
      console.error(`Status: ${response.status}`)
      console.error('Resposta:', JSON.stringify(responseData, null, 2))
      process.exit(1)
    }

    // 4. Verificar resposta
    console.log('✅ Orçamento criado com sucesso!\n')
    console.log('📊 Resposta da API:')
    console.log(JSON.stringify(responseData, null, 2))
    console.log('\n')

    // 5. Verificar se boleto foi gerado
    if (responseData.data?.boletoGenerated) {
      console.log('✅ BOLETO GERADO AUTOMATICAMENTE!\n')
      console.log('📄 Dados do Boleto:')
      console.log(
        `   Código de Barras: ${responseData.data.boleto?.barcode || 'N/A'}`
      )
      console.log(
        `   Linha Digitável: ${responseData.data.boleto?.digitableLine || 'N/A'}`
      )
      console.log(`   PDF URL: ${responseData.data.boleto?.pdfUrl || 'N/A'}`)
      console.log(
        `   Vencimento: ${responseData.data.boleto?.dueDate || 'N/A'}`
      )
      console.log(`   Payment ID: ${responseData.data.paymentId || 'N/A'}`)
      console.log('\n')

      if (responseData.data.boleto?.pdfUrl) {
        console.log('🔗 Links úteis:')
        console.log(
          `   - Baixar PDF do Boleto: ${responseData.data.boleto.pdfUrl}`
        )
        console.log(
          `   - Painel Asaas: https://sandbox.asaas.com/dashboard/home`
        )
        console.log('\n')
      }

      console.log('✅ TESTE CONCLUÍDO COM SUCESSO!')
      console.log('\n📋 Próximos passos:')
      console.log('   1. Verificar o boleto no painel Asaas Sandbox')
      console.log('   2. Verificar o pagamento no banco de dados')
      console.log('   3. Testar webhook de pagamento (quando configurado)')
    } else {
      console.log('⚠️  Boleto NÃO foi gerado automaticamente\n')
      console.log('🔍 Possíveis causas:')
      console.log(
        '   - AUTO_GENERATE_BOLETO_ON_QUOTE não está configurado como "true"'
      )
      console.log('   - ASAAS_API_KEY não está configurada')
      console.log('   - TenantIntegration ASAAS não está configurada para a locadora')
      console.log('   - Valor do orçamento é zero')
      console.log('\n')
      console.log('💡 Verifique as variáveis de ambiente no arquivo .env')
    }
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Executar teste
testCreateQuoteWithBoleto()
