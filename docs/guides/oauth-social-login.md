# 🔐 Guia Completo - OAuth Social Login (Google & Facebook)

> **Caminhos atuais (conferidos em 2026-09-30)**: os botões estão em
> `packages/ui/src/web/SocialLoginButtons.web.tsx` (e `native/`, no
> `@gb-locacoes/ui`); `components/ui/social-login-buttons` é o caminho antigo.

> **Documentação completa para implementação e configuração de autenticação
> social com Google e Facebook**

## 📋 Índice

- [🎯 Visão Geral](#-visão-geral)
- [⚙️ Configuração Google OAuth](#️-configuração-google-oauth)
- [⚙️ Configuração Facebook OAuth](#️-configuração-facebook-oauth)
- [🔧 Configuração do Projeto](#-configuração-do-projeto)
- [🧩 Componentes Implementados](#-componentes-implementados)
- [🚀 Como Usar](#-como-usar)
- [🐛 Troubleshooting](#-troubleshooting)

---

## 🎯 Visão Geral

O sistema de autenticação social do GB-Locações permite que usuários façam
login/cadastro usando suas contas Google ou Facebook, simplificando o processo
de registro e melhorando a experiência do usuário.

### ✨ Funcionalidades Implementadas

- **🔐 Login Social**: Google e Facebook
- **👤 Auto-cadastro**: Usuários são criados automaticamente
- **🔄 Sincronização**: Atualização de dados do perfil
- **🎨 UI Melhorada**: Componentes reutilizáveis
- **⚡ Loading States**: Feedback visual durante autenticação
- **🛡️ Segurança**: Validação e tratamento de erros

---

## ⚙️ Configuração Google OAuth

### 1. **Criar Projeto no Google Cloud Console**

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Ative a **Google+ API** (se disponível) ou **Google Identity API**

### 2. **Configurar OAuth Consent Screen**

1. No menu lateral, vá em **APIs & Services > OAuth consent screen**
2. Escolha **External** (para usuários externos)
3. Preencha as informações obrigatórias:
   ```
   App name: GB Locações
   User support email: contato@locacoesgb.com.br
   Developer contact: contato@locacoesgb.com.br
   ```
4. Adicione os domínios autorizados:
   ```
   Authorized domains:
   - localhost (para desenvolvimento)
   - seudominio.com (para produção)
   ```

### 3. **Criar Credenciais OAuth**

1. Vá em **APIs & Services > Credentials**
2. Clique em **Create Credentials > OAuth 2.0 Client IDs**
3. Configure o tipo de aplicação:
   ```
   Application type: Web application
   Name: GB Locações Web Client
   ```
4. Adicione as URLs autorizadas:

   ```
   Authorized JavaScript origins:
   - http://localhost:3000
   - https://seudominio.com

   Authorized redirect URIs:
   - http://localhost:3000/api/auth/callback/google
   - https://seudominio.com/api/auth/callback/google
   ```

### 4. **Obter Credenciais**

Após criar, você receberá:

- **Client ID**: `seu-google-client-id`
- **Client Secret**: `seu-google-client-secret`

---

## ⚙️ Configuração Facebook OAuth

### 1. **Criar App no Facebook Developers**

1. Acesse [Facebook Developers](https://developers.facebook.com/)
2. Clique em **Create App**
3. Escolha **Consumer** como tipo de app
4. Preencha as informações:
   ```
   App name: GB Locações
   App contact email: contato@locacoesgb.com.br
   ```

### 2. **Configurar Facebook Login**

1. No dashboard do app, adicione o produto **Facebook Login**
2. Escolha **Web** como plataforma
3. Adicione a URL do site:
   ```
   Site URL: https://seudominio.com
   ```

### 3. **Configurar URLs de Redirecionamento**

1. Vá em **Facebook Login > Settings**
2. Adicione as URLs válidas:
   ```
   Valid OAuth Redirect URIs:
   - http://localhost:3000/api/auth/callback/facebook
   - https://seudominio.com/api/auth/callback/facebook
   ```

### 4. **Configurar Domínios do App**

1. Em **App Settings > Basic**
2. Adicione os domínios:
   ```
   App Domains:
   - localhost (desenvolvimento)
   - seudominio.com (produção)
   ```

### 5. **Obter Credenciais**

1. Em **App Settings > Basic**
2. Anote:
   - **App ID**: `seu-facebook-app-id`
   - **App Secret**: `seu-facebook-app-secret`

---

## 🔧 Configuração do Projeto

### 1. **Variáveis de Ambiente**

Crie um arquivo `.env.local` na raiz do projeto:

```bash
# NextAuth
NEXTAUTH_SECRET="sua-chave-secreta-aqui"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth
GOOGLE_CLIENT_ID="seu-google-client-id"
GOOGLE_CLIENT_SECRET="seu-google-client-secret"

# Facebook OAuth
FACEBOOK_CLIENT_ID="seu-facebook-app-id"
FACEBOOK_CLIENT_SECRET="seu-facebook-app-secret"
```

### 2. **Gerar NEXTAUTH_SECRET**

```bash
# Opção 1: Online
openssl rand -base64 32

# Opção 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. **Configuração NextAuth**

O arquivo `lib/auth.ts` já está configurado com:

```typescript
providers: [
  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!
  }),
  FacebookProvider({
    clientId: process.env.FACEBOOK_CLIENT_ID!,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET!
  })
  // ... outros providers
]
```

---

## 🧩 Componentes Implementados

### 1. **SocialLoginButtons**

Componente reutilizável para botões de login social:

```tsx
import { SocialLoginButtons, SocialDivider } from '@/components/ui/social-login-buttons'

// Uso básico
<SocialLoginButtons
  isLoading={isLoading}
  onError={(error) => setError(error)}
/>

// Com divisor
<SocialDivider>Ou continue com</SocialDivider>
<SocialLoginButtons
  isLoading={isLoading}
  onError={(error) => setError(error)}
/>
```

### 2. **Props Disponíveis**

```typescript
interface SocialLoginButtonsProps {
  isLoading?: boolean // Estado de loading geral
  onError?: (error: string) => void // Callback para erros
  className?: string // Classes CSS adicionais
  variant?: "default" | "compact" // Tamanho dos botões
}
```

### 3. **Funcionalidades**

- **🔄 Loading States**: Spinner individual para cada provider
- **⚡ Feedback Visual**: Hover effects e transições
- **🛡️ Error Handling**: Tratamento de erros com callback
- **📱 Responsivo**: Design adaptável para mobile
- **♿ Acessível**: ARIA labels e navegação por teclado

---

## 🚀 Como Usar

### 1. **Página de Login**

```tsx
"use client"

import {
  SocialLoginButtons,
  SocialDivider
} from "@/components/ui/social-login-buttons"
import { useState } from "react"

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSocialError = (error: string) => {
    setError(error)
  }

  return (
    <div>
      {/* Seu formulário de login aqui */}

      <SocialDivider>Ou continue com</SocialDivider>

      <SocialLoginButtons isLoading={isLoading} onError={handleSocialError} />

      {error && <div className="error">{error}</div>}
    </div>
  )
}
```

### 2. **Página de Cadastro**

```tsx
"use client"

import {
  SocialLoginButtons,
  SocialDivider
} from "@/components/ui/social-login-buttons"

export default function CadastroPage() {
  // ... lógica do componente

  return (
    <div>
      {/* Seu formulário de cadastro aqui */}

      <SocialDivider>Ou continue com</SocialDivider>

      <SocialLoginButtons isLoading={isLoading} onError={handleSocialError} />
    </div>
  )
}
```

### 3. **Fluxo de Autenticação**

1. **Usuário clica** no botão Google/Facebook
2. **Redirecionamento** para o provider OAuth
3. **Autorização** do usuário no provider
4. **Callback** para `/api/auth/callback/[provider]`
5. **Criação/Atualização** do usuário no banco
6. **Redirecionamento** para `/area-cliente`

---

## 🐛 Troubleshooting

### **Problemas Comuns**

#### 1. **"Invalid redirect_uri"**

**Causa**: URL de redirecionamento não configurada corretamente

**Solução**:

- Verifique se as URLs estão exatamente iguais nos providers
- Para desenvolvimento: `http://localhost:3000/api/auth/callback/google`
- Para produção: `https://seudominio.com/api/auth/callback/google`

#### 2. **"App not verified" (Google)**

**Causa**: App ainda não foi verificado pelo Google

**Solução**:

- Em desenvolvimento, adicione usuários de teste
- Em produção, submeta o app para verificação do Google

#### 3. **"App in development mode" (Facebook)**

**Causa**: App Facebook ainda em modo desenvolvimento

**Solução**:

- Adicione usuários de teste no Facebook Developers
- Ou altere para modo público (requer verificação)

#### 4. **"User creation failed"**

**Causa**: Erro no callback do NextAuth

**Solução**:

- Verifique se o banco está acessível
- Confirme se o schema do Prisma está atualizado
- Verifique os logs do servidor

#### 5. **"Environment variables missing"**

**Causa**: Variáveis de ambiente não configuradas

**Solução**:

```bash
# Verificar se as variáveis estão definidas
echo $GOOGLE_CLIENT_ID
echo $FACEBOOK_CLIENT_ID
echo $NEXTAUTH_SECRET
```

### **Debug Mode**

Para ativar logs de debug:

```bash
# No .env.local
NEXTAUTH_DEBUG=true
```

### **Verificação de Configuração**

```typescript
// Teste rápido no console do browser
console.log("Google Client ID:", process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID)
console.log("NextAuth URL:", process.env.NEXTAUTH_URL)
```

---

## 🔗 Links Úteis

### **Documentação Oficial**

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Facebook Login](https://developers.facebook.com/docs/facebook-login/)

### **Ferramentas**

- [Google OAuth Playground](https://developers.google.com/oauthplayground/)
- [Facebook Graph API Explorer](https://developers.facebook.com/tools/explorer/)

### **Testes**

- [OAuth 2.0 Test Suite](https://www.oauth.com/playground/)
- [JWT.io](https://jwt.io/) - Para debug de tokens

---

## 📝 Checklist de Implementação

### **✅ Configuração Inicial**

- [ ] Projeto Google Cloud criado
- [ ] App Facebook criado
- [ ] OAuth consent screen configurado
- [ ] URLs de redirecionamento adicionadas
- [ ] Credenciais obtidas

### **✅ Configuração do Projeto**

- [ ] Variáveis de ambiente configuradas
- [ ] NEXTAUTH_SECRET gerado
- [ ] NextAuth configurado
- [ ] Componentes importados

### **✅ Testes**

- [ ] Login Google funcionando
- [ ] Login Facebook funcionando
- [ ] Criação de usuários funcionando
- [ ] Redirecionamento correto
- [ ] Tratamento de erros funcionando

### **✅ Produção**

- [ ] Domínios atualizados nos providers
- [ ] HTTPS configurado
- [ ] Variáveis de produção configuradas
- [ ] App verificado (quando necessário)

---

_Última atualização: janeiro 2025 | Versão: 1.0_
