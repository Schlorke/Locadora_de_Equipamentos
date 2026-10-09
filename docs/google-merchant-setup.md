# Configuração do Google Merchant Center

Este guia explica como integrar o catálogo de equipamentos da GB Locações com o
Google Merchant Center para exibir produtos no Google Shopping e campanhas
Performance Max.

## 📋 Pré-requisitos

- Conta Google Business
- Site verificado no Google Search Console
- Acesso ao Google Cloud Console
- Acesso ao painel de administração da GB Locações

## 🚀 Passo a Passo

### 1. Criar/Configurar Conta no Google Merchant Center

1. Acesse [Google Merchant Center](https://merchants.google.com)
2. Faça login com sua conta Google Business
3. Clique em **"Começar"** ou selecione uma conta existente
4. Preencha as informações da empresa:
   - Nome da empresa: **GB Locações**
   - País: **Brasil**
   - Fuso horário: **Brasília (GMT-3)**

5. Verifique e reivindique seu site:
   - URL do site: `https://locacoesgb.com.br`
   - Escolha o método de verificação (recomendado: Google Search Console)

6. Configure informações de envio e impostos conforme necessário

7. **Anote o Merchant ID** (número de 10 dígitos visível no canto superior
   direito)

### 2. Criar Service Account no Google Cloud

1. Acesse [Google Cloud Console](https://console.cloud.google.com)

2. Crie um novo projeto ou selecione um existente:
   - Nome sugerido: `GB Locacoes Merchant`

3. Ative a **Content API for Shopping**:
   - Menu > **APIs e serviços** > **Biblioteca**
   - Busque por "Content API for Shopping"
   - Clique em **Ativar**

4. Crie um Service Account:
   - Menu > **APIs e serviços** > **Credenciais**
   - Clique em **Criar credenciais** > **Conta de serviço**
   - Nome: `merchant-api-service`
   - Descrição: `Service account para sincronizar produtos com Google Merchant`
   - Clique em **Criar e continuar**

5. Conceda permissões (opcional, pode pular)

6. Crie uma chave JSON:
   - Na lista de contas de serviço, clique na conta criada
   - Aba **Chaves** > **Adicionar chave** > **Criar nova chave**
   - Tipo: **JSON**
   - Clique em **Criar** (o arquivo será baixado automaticamente)

### 3. Vincular Service Account ao Merchant Center

1. Volte ao [Google Merchant Center](https://merchants.google.com)

2. Vá em **Configurações** (ícone de engrenagem) > **Acesso de usuários**

3. Clique em **Adicionar usuário**

4. Cole o email do Service Account (formato:
   `nome@projeto-id.iam.gserviceaccount.com`)
   - Você encontra esse email no arquivo JSON baixado no campo `client_email`

5. Selecione a função: **Administrador**

6. Clique em **Adicionar**

### 4. Adicionar Fonte de Dados (Feed API)

**Este é o passo da tela que você compartilhou!**

1. No Merchant Center, vá em **Produtos** > **Feeds**

2. Clique em **Adicionar produtos**

3. Selecione **Adicionar produtos usando a API** (terceira opção)

4. No campo **"Nome da fonte de dados da API"**, digite:

   ```
   GB Locações - API Feed
   ```

5. Clique em **Continuar**

6. Configure:
   - **País de venda**: Brasil
   - **Idioma**: Português (pt)
   - **Destinos**: Marque **Shopping** e **Performance Max**

7. Clique em **Criar feed**

### 5. Configurar Variáveis de Ambiente

1. Abra o arquivo JSON da chave do Service Account baixado anteriormente

2. Adicione ao seu arquivo `.env.local`:

```bash
# Google Merchant Center
GOOGLE_MERCHANT_ID="1234567890"  # Seu Merchant ID (10 dígitos)
GOOGLE_MERCHANT_SERVICE_ACCOUNT_EMAIL="merchant-api-service@gb-locacoes-merchant.iam.gserviceaccount.com"
GOOGLE_MERCHANT_SERVICE_ACCOUNT_KEY="-----BEGIN PRIVATE KEY-----\nSUA_CHAVE_PRIVADA_AQUI\n-----END PRIVATE KEY-----\n"
```

**Importante:**

- `GOOGLE_MERCHANT_ID`: Merchant ID visível no Merchant Center
- `GOOGLE_MERCHANT_SERVICE_ACCOUNT_EMAIL`: Campo `client_email` do JSON
- `GOOGLE_MERCHANT_SERVICE_ACCOUNT_KEY`: Campo `private_key` do JSON (cole a
  chave completa, incluindo `-----BEGIN PRIVATE KEY-----` e
  `-----END PRIVATE KEY-----`)

### 6. Fazer Deploy das Mudanças

```bash
# Adicionar variáveis ao Vercel (se usar Vercel)
vercel env add GOOGLE_MERCHANT_ID
vercel env add GOOGLE_MERCHANT_SERVICE_ACCOUNT_EMAIL
vercel env add GOOGLE_MERCHANT_SERVICE_ACCOUNT_KEY

# Ou adicione manualmente no painel do Vercel:
# Settings > Environment Variables
```

### 7. Testar a Integração

1. Acesse o painel admin: `https://locacoesgb.com.br/admin`

2. Navegue até **Integrações** > **Google Merchant**

3. Verifique o status da conexão

4. Clique em **Sincronizar Agora** para fazer a primeira sincronização

### 8. Configurar Sincronização Automática

Configure um Cron Job no Vercel:

1. Crie o arquivo `vercel.json` na raiz do projeto (se não existir):

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-google-merchant",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**Opções de agendamento:**

- `0 2 * * *` - Diariamente às 2h da manhã (recomendado)
- `0 */6 * * *` - A cada 6 horas
- `0 * * * *` - A cada hora

2. Faça deploy:

```bash
git add vercel.json
git commit -m "chore: configure Google Merchant sync cron"
git push
```

## 🎯 Endpoints da API

### Verificar Status

```bash
GET /api/admin/google-merchant/status
```

Retorna status da configuração e estatísticas.

### Sincronizar Todos os Equipamentos

```bash
POST /api/admin/google-merchant/sync
Authorization: Bearer {admin-token}
```

Sincroniza todos os equipamentos disponíveis.

### Sincronizar Equipamento Específico

```bash
POST /api/admin/google-merchant/products/{equipmentId}
Authorization: Bearer {admin-token}
```

Sincroniza apenas um equipamento.

### Remover Equipamento

```bash
DELETE /api/admin/google-merchant/products/{equipmentId}
Authorization: Bearer {admin-token}
```

Remove um equipamento do Google Merchant.

## 📊 O Que é Sincronizado

Para cada equipamento disponível, são enviados:

- **Título**: Nome do equipamento (máx. 150 caracteres)
- **Descrição**: Descrição + especificações (máx. 5000 caracteres)
- **Imagem**: Primeira imagem como principal + até 10 adicionais
- **Preço**: Valor da diária em BRL
- **Disponibilidade**: "in stock" ou "out of stock"
- **Categoria**: Categoria do equipamento
- **Link**: URL da página do equipamento
- **Custom Labels**: Categoria, período popular, status

## 🔍 Monitoramento

### No Google Merchant Center

1. Acesse **Produtos** > **Diagnóstico**
2. Verifique:
   - Produtos aprovados
   - Produtos com problemas
   - Produtos pendentes

### No Painel Admin da GB Locações

Acesse `/admin/integrações/google-merchant` para ver:

- Status da conexão
- Última sincronização
- Equipamentos sincronizados
- Logs de erros

## ❌ Solução de Problemas

### Erro: "Merchant ID não configurado"

- Verifique se `GOOGLE_MERCHANT_ID` está no `.env.local`
- Faça redeploy com a variável configurada

### Erro: "Invalid credentials"

- Verifique se o email do Service Account está correto
- Confirme que a chave privada está completa (com quebras de linha `\n`)
- Verifique se o Service Account foi adicionado ao Merchant Center

### Produtos não aparecem no Google Shopping

- Aguarde até 24h para aprovação inicial
- Verifique o **Diagnóstico de Produtos** no Merchant Center
- Certifique-se de que as imagens são válidas (HTTPS, formato correto)
- Confirme que o site está verificado

### Sincronização falha

- Verifique os logs no console do Vercel
- Teste manualmente via endpoint `/api/admin/google-merchant/status`
- Confirme que a Content API está ativada no Google Cloud

## 📚 Recursos Adicionais

- [Google Merchant Center Help](https://support.google.com/merchants)
- [Content API for Shopping Documentation](https://developers.google.com/shopping-content)
- [Product Data Specification](https://support.google.com/merchants/answer/7052112)
- [Google Product Taxonomy](https://www.google.com/basepages/producttype/taxonomy-with-ids.pt-BR.txt)

## 🔐 Segurança

**NUNCA** commite as chaves privadas no Git:

- Use `.env.local` apenas localmente
- Configure variáveis de ambiente no Vercel/provider de hospedagem
- Rotacione chaves periodicamente
- Use Service Accounts com permissões mínimas necessárias

---

**Suporte**: Em caso de dúvidas, consulte a documentação do Google ou entre em
contato com o time de desenvolvimento.
