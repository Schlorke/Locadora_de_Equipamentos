# ✅ Checklist de Configuração - Google Merchant Center

Use este checklist para configurar a integração passo a passo.

## 📋 Pré-configuração

- [ ] Você tem uma conta Google Business ativa
- [ ] Seu site está verificado no Google Search Console
- [ ] Você tem acesso ao Google Cloud Console
- [ ] Você tem pelo menos 1 equipamento cadastrado no sistema

## 🔧 Configuração Google

### 1. Google Merchant Center

- [ ] Acessou [merchants.google.com](https://merchants.google.com)
- [ ] Criou ou selecionou conta Merchant
- [ ] Preencheu dados da empresa (nome, país, fuso)
- [ ] Verificou e reivindicou o site `locacoesgb.com.br`
- [ ] **Anotou o Merchant ID** (10 dígitos)

### 2. Google Cloud Console

- [ ] Acessou [console.cloud.google.com](https://console.cloud.google.com)
- [ ] Criou ou selecionou um projeto
- [ ] Ativou a **Content API for Shopping**
- [ ] Criou um Service Account (`merchant-api-service`)
- [ ] Gerou e **baixou** a chave JSON
- [ ] **Anotou** o email do Service Account (`xxx@xxx.iam.gserviceaccount.com`)

### 3. Vincular Service Account

- [ ] Voltou ao Merchant Center > Configurações > Acesso de usuários
- [ ] Adicionou o email do Service Account
- [ ] Concedeu função **Administrador**
- [ ] Salvou as alterações

### 4. Criar Feed API

- [ ] No Merchant Center, foi em Produtos > Feeds
- [ ] Clicou em "Adicionar produtos"
- [ ] Selecionou **"Adicionar produtos usando a API"**
- [ ] Nomeou como `GB Locações - API Feed`
- [ ] Configurou país (Brasil) e idioma (Português)
- [ ] Marcou destinos: Shopping + Performance Max
- [ ] Criou o feed

## 💻 Configuração do Código

### 5. Variáveis de Ambiente

- [ ] Abriu o arquivo JSON baixado do Service Account
- [ ] Copiou o `client_email` para `GOOGLE_MERCHANT_SERVICE_ACCOUNT_EMAIL`
- [ ] Copiou a `private_key` para `GOOGLE_MERCHANT_SERVICE_ACCOUNT_KEY`
- [ ] Copiou o Merchant ID para `GOOGLE_MERCHANT_ID`
- [ ] Adicionou as 3 variáveis ao `.env.local`
- [ ] Reiniciou o servidor de desenvolvimento

**Exemplo `.env.local`:**

```bash
GOOGLE_MERCHANT_ID="1234567890"
GOOGLE_MERCHANT_SERVICE_ACCOUNT_EMAIL="merchant-api@project.iam.gserviceaccount.com"
GOOGLE_MERCHANT_SERVICE_ACCOUNT_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQI...\n-----END PRIVATE KEY-----\n"
```

### 6. Instalação

- [ ] Executou `pnpm install` (dependência `googleapis` já incluída)
- [ ] Build passou sem erros: `pnpm build`
- [ ] Types estão ok: `pnpm type-check`

## 🧪 Testes

### 7. Testar Localmente

- [ ] Servidor rodando: `pnpm dev`
- [ ] Acessou `/api/admin/google-merchant/status`
- [ ] Status retornou `configured: true` e `connected: true`
- [ ] Testou sincronização manual via Postman/Insomnia

**Teste manual via curl:**

```bash
# Verificar status
curl http://localhost:3000/api/admin/google-merchant/status

# Sincronizar (precisa estar autenticado como admin)
curl -X POST http://localhost:3000/api/admin/google-merchant/sync \
  -H "Authorization: Bearer SEU_TOKEN_ADMIN"
```

### 8. Verificar no Google Merchant

- [ ] Acessou Merchant Center > Produtos > Todos os produtos
- [ ] Viu os produtos sincronizados
- [ ] Verificou imagens carregando corretamente
- [ ] Conferiu preços e disponibilidade

## 🚀 Deploy

### 9. Deploy em Produção

- [ ] Adicionou variáveis ao Vercel (ou provedor de hospedagem)

```bash
vercel env add GOOGLE_MERCHANT_ID
vercel env add GOOGLE_MERCHANT_SERVICE_ACCOUNT_EMAIL
vercel env add GOOGLE_MERCHANT_SERVICE_ACCOUNT_KEY
```

- [ ] Fez deploy: `git push` ou `vercel --prod`
- [ ] Deploy passou com sucesso
- [ ] Testou endpoint em produção

### 10. Configurar Cron Job

- [ ] Verificou que `vercel.json` tem o cron configurado
- [ ] Cron está agendado para `0 2 * * *` (2h da manhã)
- [ ] Deploy do `vercel.json` foi feito
- [ ] Cron aparece no painel do Vercel

## 🎯 Validação Final

### 11. Tudo Funcionando

- [ ] Sincronização manual funciona
- [ ] Produtos aparecem no Google Merchant Center
- [ ] Imagens carregam corretamente
- [ ] Preços estão corretos
- [ ] Disponibilidade está correta
- [ ] Cron job está configurado e ativo
- [ ] Logs não mostram erros críticos

### 12. Diagnóstico de Produtos

- [ ] No Merchant Center, foi em Produtos > Diagnóstico
- [ ] **Todos** os produtos estão "Aprovados" ✅
- [ ] Não há erros críticos ❌
- [ ] Avisos (se houver) foram revisados ⚠️

## 📊 Próximos Passos

### 13. Campanhas Google Ads (Opcional)

- [ ] Criou conta Google Ads (se ainda não tiver)
- [ ] Vinculou Merchant Center ao Google Ads
- [ ] Criou campanha Performance Max ou Shopping
- [ ] Configurou orçamento e lances
- [ ] Ativou campanhas

### 14. Monitoramento

- [ ] Configurou alertas no Merchant Center
- [ ] Adicionou monitoramento de logs (Sentry, LogRocket, etc.)
- [ ] Criou dashboard de métricas
- [ ] Definiu KPIs (cliques, impressões, conversões)

## 🆘 Problemas Comuns

| Problema                   | Solução                                           |
| -------------------------- | ------------------------------------------------- |
| Status `configured: false` | Verifique variáveis de ambiente                   |
| Status `connected: false`  | Verifique Service Account no Merchant Center      |
| Produtos não aparecem      | Aguarde até 24h, verifique diagnóstico            |
| Erro de autenticação       | Verifique chave privada (com quebras `\n`)        |
| Imagens não carregam       | Use URLs HTTPS válidas                            |
| Cron não executa           | Verifique `CRON_SECRET` e deploy do `vercel.json` |

## 📚 Documentação de Referência

- [📖 Guia Completo](./google-merchant-setup.md)
- [📁 Código da Integração](../scripts/ops/google-merchant/) (porte da onda 135;
  em quarentena, a fábrica recusa com `GOOGLE_MERCHANT_LEGACY_DISABLED`)
- [💡 Exemplos de Uso](../scripts/ops/google-merchant/README.md)

---

**🎉 Parabéns!** Se você marcou todos os itens, sua integração está completa e
funcionando!

**Precisa de ajuda?** Consulte a
[documentação completa](./google-merchant-setup.md) ou abra uma issue no
repositório.
