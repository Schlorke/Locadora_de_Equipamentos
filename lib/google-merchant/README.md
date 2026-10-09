# Google Merchant Center Integration

Integração com o Google Merchant Center para sincronizar o catálogo de
equipamentos da GB Locações com o Google Shopping.

## 🚀 Quick Start

### 1. Instalar Dependência

```bash
pnpm install
```

A dependência `googleapis` já está incluída no `package.json`.

### 2. Configurar Variáveis de Ambiente

Adicione ao seu `.env.local`:

```bash
GOOGLE_MERCHANT_ID="1234567890"
GOOGLE_MERCHANT_SERVICE_ACCOUNT_EMAIL="service@project.iam.gserviceaccount.com"
GOOGLE_MERCHANT_SERVICE_ACCOUNT_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 3. Sincronizar Equipamentos

**Via API:**

```bash
curl -X POST http://localhost:3000/api/admin/google-merchant/sync \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Programaticamente:**

```typescript
import { googleMerchantSync } from "@/lib/google-merchant"

// Sincronizar todos os equipamentos
const result = await googleMerchantSync.syncAllEquipments()

// Sincronizar um equipamento específico
await googleMerchantSync.syncEquipment("equipmentId")

// Remover equipamento
await googleMerchantSync.removeEquipment("equipmentId")
```

## 📁 Estrutura

```
lib/google-merchant/
├── index.ts           # Exportações principais
├── types.ts           # Tipos TypeScript
├── client.ts          # Cliente da Google Content API
├── mapper.ts          # Conversão Equipment → Google Product
├── sync-service.ts    # Serviço de sincronização
└── README.md          # Este arquivo
```

## 🔌 Endpoints da API

| Método | Endpoint                                   | Descrição                          |
| ------ | ------------------------------------------ | ---------------------------------- |
| GET    | `/api/admin/google-merchant/status`        | Status da integração               |
| POST   | `/api/admin/google-merchant/sync`          | Sincronizar todos os equipamentos  |
| POST   | `/api/admin/google-merchant/products/[id]` | Sincronizar equipamento específico |
| DELETE | `/api/admin/google-merchant/products/[id]` | Remover equipamento                |
| GET    | `/api/cron/sync-google-merchant`           | Cron job (automático)              |

## 📖 Documentação Completa

Veja o guia completo em:
[docs/google-merchant-setup.md](../../docs/google-merchant-setup.md)

## 🔧 Desenvolvimento

### Testar Localmente

```bash
# 1. Configure as variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas credenciais

# 2. Inicie o servidor
pnpm dev

# 3. Teste o status
curl http://localhost:3000/api/admin/google-merchant/status
```

### Debug

Logs detalhados são exibidos no console durante a sincronização:

```
[Google Merchant] Iniciando sincronização manual...
✓ Equipamento Escavadeira XYZ atualizado
✓ Equipamento Betoneira ABC inserido
✗ Erro ao sincronizar Compressor DEF: Invalid image URL
[Google Merchant] Sincronização concluída: { inseridos: 5, atualizados: 10, removidos: 2, erros: 1 }
```

## 🎯 Como Funciona

1. **Busca equipamentos disponíveis** no banco de dados (Prisma)
2. **Converte para formato Google Product** usando o mapper
3. **Envia para Google Merchant Center** via Content API
4. **Remove produtos órfãos** (que não existem mais no banco)
5. **Retorna resultado** com estatísticas de sucesso/erro

## ⚙️ Configuração de Cron

Para sincronização automática, adicione ao `vercel.json`:

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

Ou use qualquer outro serviço de cron (GitHub Actions, AWS EventBridge, etc.)

## 🔐 Segurança

- ✅ Autenticação via Service Account do Google
- ✅ Validação de admin no backend
- ✅ Secrets nunca expostos no frontend
- ✅ CRON_SECRET para proteger endpoints de cron
- ⚠️ **NUNCA** commite credenciais no Git

## 📊 Monitoramento

Verifique o status da sincronização:

- **No código:**

```typescript
import { createGoogleMerchantClient } from "@/lib/google-merchant"

const client = createGoogleMerchantClient()
const products = await client.listProducts()
console.log(`${products.length} produtos no Google Merchant`)
```

- **No Google Merchant Center:** https://merchants.google.com → Produtos →
  Diagnóstico

## 🐛 Solução de Problemas

| Erro                                 | Solução                                            |
| ------------------------------------ | -------------------------------------------------- |
| `GOOGLE_MERCHANT_ID não configurado` | Adicione variável ao `.env.local`                  |
| `Invalid credentials`                | Verifique chave privada e email do Service Account |
| `404 Not Found`                      | Produto não existe, será criado na próxima sync    |
| `Invalid image URL`                  | Certifique-se de que imagens são HTTPS válidas     |

## 🔗 Links Úteis

- [Google Merchant Center](https://merchants.google.com)
- [Content API Documentation](https://developers.google.com/shopping-content)
- [googleapis npm package](https://www.npmjs.com/package/googleapis)

---

**Desenvolvido para GB Locações** | Precisa de ajuda? Consulte
[docs/google-merchant-setup.md](../../docs/google-merchant-setup.md)
