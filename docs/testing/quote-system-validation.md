# Guia de Validação - Sistema de Orçamentos GB Locações

> **Caminhos atuais (conferidos em 2026-09-30)**: `scripts/create-test-user.ts`
> não existe no repositório (nunca foi versionado); crie os usuários de teste
> pelo cadastro da aplicação, num banco descartável.

Data: 2026-02-14 Versão: 1.0

## 📋 Checklist de Validação

Use este guia para validar todas as implementações do sistema de orçamentos após
as correções críticas e novos recursos.

---

## 🔧 1. PREPARAÇÃO DO AMBIENTE

### 1.1 Verificar que o servidor está rodando

```bash
# Terminal 1 - Iniciar servidor de desenvolvimento
cd "c:\Projetos\GB Locações"
pnpm dev
```

Aguarde até ver:

```
✓ Ready in 2.5s
○ Local:   http://localhost:3000
```

### 1.2 Abrir ferramentas de desenvolvedor

1. Abrir navegador (Chrome/Edge recomendado)
2. Pressionar **F12** para abrir DevTools
3. Ir para aba **Network** (Rede)
4. Ir para aba **Console** em outra janela

### 1.3 Fazer login como ADMIN

1. Acessar: http://localhost:3000/admin
2. Fazer login com credenciais de ADMIN
3. Verificar que está autenticado

---

## 🔴 2. TESTE CRÍTICO DE SEGURANÇA (P0)

### 2.1 Testar Vulnerabilidade Corrigida em `/api/quotes`

**Objetivo**: Confirmar que não é mais possível acessar orçamentos de outros
usuários

#### Passo 1: Criar dois usuários de teste

```bash
# Terminal 2 - Criar usuário 1
npx tsx scripts/create-test-user.ts usuario1@test.com senha123

# Criar usuário 2
npx tsx scripts/create-test-user.ts usuario2@test.com senha123
```

Anotar os IDs retornados:

- Usuário 1 ID: `_________________`
- Usuário 2 ID: `_________________`

#### Passo 2: Criar orçamento com Usuário 1

1. Fazer login como `usuario1@test.com`
2. Acessar: http://localhost:3000/orcamento
3. Adicionar equipamento ao carrinho
4. Preencher formulário e enviar
5. Anotar o ID do orçamento criado: `_________________`

#### Passo 3: Tentar acessar orçamento do Usuário 1 como Usuário 2

1. Fazer logout
2. Fazer login como `usuario2@test.com`
3. Abrir DevTools (F12) → Console
4. Executar o comando:

```javascript
// Tentar acessar orçamentos do usuário 1
fetch("/api/quotes?userId=USUARIO_1_ID_AQUI")
  .then((r) => r.json())
  .then((data) => console.log("Resultado:", data))
```

**✅ RESULTADO ESPERADO:**

- Deve retornar APENAS os orçamentos do Usuário 2 (logado)
- Não deve retornar orçamentos do Usuário 1
- Ignorar completamente o parâmetro `userId` da URL

**❌ FALHOU SE:**

- Retornou orçamentos do Usuário 1
- Aceitou o parâmetro `userId` da query string

#### Passo 4: Verificar Rate Limiting

No DevTools Console, executar:

```javascript
// Fazer 15 requisições rapidamente (limite é 10/min)
async function testRateLimit() {
  for (let i = 0; i < 15; i++) {
    const res = await fetch("/api/quotes")
    console.log(`Request ${i + 1}: Status ${res.status}`)
    if (res.status === 429) {
      console.log("✅ Rate limit funcionando! Bloqueou na requisição", i + 1)
      return
    }
  }
  console.log("❌ Rate limit NÃO funcionou - permitiu todas as 15 requisições")
}

testRateLimit()
```

**✅ RESULTADO ESPERADO:**

- Primeiras 10 requisições: Status 200
- A partir da 11ª: Status 429 (Too Many Requests)

---

## 🗓️ 3. TESTE DE DATAS INDIVIDUAIS (P0)

### 3.1 Testar Preservação de Datas na Conversão Quote → Rental

**Objetivo**: Confirmar que datas individuais dos itens são preservadas

#### Passo 1: Criar orçamento com itens de períodos diferentes

1. Acessar: http://localhost:3000/admin/orcamentos
2. Usar API para criar orçamento com datas diferentes:

```javascript
// DevTools Console
async function createQuoteWithMultipleDates() {
  const res = await fetch("/api/admin/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Cliente Teste Datas",
      email: "teste-datas@example.com",
      phone: "11999999999",
      items: [
        {
          equipmentId: "EQUIPMENT_ID_1", // Substituir por ID real
          quantity: 1,
          days: 5,
          startDate: "2026-03-01",
          endDate: "2026-03-06",
          includeWeekends: true
        },
        {
          equipmentId: "EQUIPMENT_ID_2", // Substituir por ID real
          quantity: 2,
          days: 10,
          startDate: "2026-03-01",
          endDate: "2026-03-11",
          includeWeekends: false
        },
        {
          equipmentId: "EQUIPMENT_ID_3", // Substituir por ID real
          quantity: 1,
          days: 7,
          startDate: "2026-03-05",
          endDate: "2026-03-12",
          includeWeekends: true
        }
      ]
    })
  })
  const data = await res.json()
  console.log("Orçamento criado:", data)
  return data.id
}

const quoteId = await createQuoteWithMultipleDates()
console.log("ID do orçamento:", quoteId)
```

Anotar ID do orçamento: `_________________`

#### Passo 2: Aprovar e converter para locação

1. Na página `/admin/orcamentos`, localizar o orçamento criado
2. Abrir detalhes (botão **⋯** → **Exibir**)
3. Clicar em **Aprovar**
4. Confirmar aprovação
5. Sistema deve converter automaticamente para Rental

Anotar ID da locação criada: `_________________`

#### Passo 3: Verificar no banco de dados

```bash
# Terminal 2 - Abrir Prisma Studio
npx prisma studio
```

1. Abrir tabela **rental_items**
2. Filtrar por `rentalid` = ID da locação criada
3. Verificar cada item:

**✅ RESULTADO ESPERADO:**

| Item | startDate  | endDate    | totaldays | includeWeekends |
| ---- | ---------- | ---------- | --------- | --------------- |
| 1    | 2026-03-01 | 2026-03-06 | 5         | true            |
| 2    | 2026-03-01 | 2026-03-11 | 10        | false           |
| 3    | 2026-03-05 | 2026-03-12 | 7         | true            |

**✅ Verificar tabela rentals:**

- `startdate` deve ser **2026-03-01** (MIN das datas dos itens)
- `enddate` deve ser **2026-03-12** (MAX das datas dos itens)

**❌ FALHOU SE:**

- Campos `startDate` ou `endDate` estão NULL
- Todos os itens têm a mesma data
- Datas globais não correspondem ao MIN/MAX

---

## 📄 4. TESTE DE PAGINAÇÃO (P1)

### 4.1 Testar Paginação Server-Side

**Objetivo**: Confirmar que apenas 20 itens são carregados por vez

#### Passo 1: Verificar quantidade de orçamentos

1. Acessar: http://localhost:3000/admin/orcamentos
2. Abrir DevTools (F12) → Network
3. Filtrar por `quotes`
4. Recarregar a página (F5)

#### Passo 2: Analisar requisição

Clicar na requisição `quotes?page=1&limit=20` e verificar:

**Preview/Response:**

```json
{
  "quotes": [...], // Array com no máximo 20 itens
  "total": 150,    // Total de orçamentos no banco
  "page": 1,
  "limit": 20
}
```

**✅ RESULTADO ESPERADO:**

- Array `quotes` tem no máximo 20 itens
- Campo `total` mostra total correto do banco
- Campos `page` e `limit` estão presentes

#### Passo 3: Testar navegação de páginas

1. Clicar no botão **Próxima** (ou página 2)
2. No Network, verificar nova requisição: `quotes?page=2&limit=20`
3. Verificar que carregou itens diferentes

**✅ RESULTADO ESPERADO:**

- Nova requisição foi feita ao servidor
- Itens da página 2 são diferentes dos da página 1
- Não carrega todos os orçamentos de uma vez

---

## 🔍 5. TESTE DE BUSCA COM DEBOUNCE (P1)

### 5.1 Testar Debounce na Busca

**Objetivo**: Confirmar que busca só executa após parar de digitar

#### Passo 1: Monitorar requisições

1. Acessar: http://localhost:3000/admin/orcamentos
2. Abrir DevTools → Network
3. Limpar histórico (ícone 🚫)

#### Passo 2: Digitar rapidamente

1. No campo de busca, digitar rapidamente: **"teste"**
2. Observar aba Network

**✅ RESULTADO ESPERADO:**

- Durante digitação: **NENHUMA** requisição é feita
- Após parar de digitar por 350ms: **1 requisição** é feita
- Total de requisições: 1 (não 5, uma por letra)

**❌ FALHOU SE:**

- Fez requisição para cada letra digitada
- Fez múltiplas requisições enquanto digitava

---

## 📑 6. TESTE DE GERAÇÃO DE PDF (P1)

### 6.1 Testar Download de PDF de Reajustes

**Objetivo**: Gerar PDF formal com reajustes do orçamento

#### Passo 1: Criar orçamento com reajuste

1. Acessar: http://localhost:3000/admin/orcamentos
2. Criar novo orçamento ou usar existente
3. Abrir detalhes do orçamento
4. Na seção **Reajustes de Valor**:
   - Clicar em **+ Adicionar Reajuste**
   - Categoria: **Desconto**
   - Valor: **-150.00**
   - Justificativa: **"Desconto promocional para teste de PDF"**
   - Salvar

Anotar ID do orçamento: `_________________`

#### Passo 2: Verificar endpoint no banco

```bash
# Terminal 2
npx prisma studio
```

1. Abrir tabela **QuoteAdjustment**
2. Verificar que existe registro com:
   - `quoteId` = ID do orçamento
   - `category` = DISCOUNT
   - `amount` = -150
   - `justification` = "Desconto promocional para teste de PDF"

#### Passo 3: Baixar PDF

1. No modal de detalhes do orçamento
2. Localizar botão **📄 Baixar Ofício de Reajuste**
3. Clicar no botão
4. Abrir o PDF baixado

**✅ VERIFICAR NO PDF:**

- ✅ Cabeçalho com "GB Locações"
- ✅ Título "OFÍCIO DE REAJUSTE DE ORÇAMENTO"
- ✅ Dados do cliente (nome, email, empresa)
- ✅ Valor original e valor reajustado
- ✅ Tabela com reajustes:
  - Categoria: "Desconto"
  - Valor: "-R$ 150,00" (em vermelho)
  - Justificativa: "Desconto promocional para teste de PDF"
  - Data: data atual
- ✅ Rodapé com data de geração

**❌ FALHOU SE:**

- PDF não baixou
- Erro 404 "Nenhum reajuste encontrado"
- PDF vazio ou sem formatação
- Dados incorretos

---

## 🔗 7. TESTE DE PÁGINA DEDICADA (P1)

### 7.1 Testar URL Compartilhável

**Objetivo**: Acessar orçamento por URL dedicada

#### Passo 1: Acessar via URL direta

1. Pegar ID de qualquer orçamento
2. Acessar: http://localhost:3000/admin/orcamentos/QUOTE_ID_AQUI
3. Aguardar carregamento

**✅ RESULTADO ESPERADO:**

- Página carrega com todos os detalhes do orçamento
- Informações do cliente visíveis
- Lista de equipamentos
- Datas e valores

#### Passo 2: Testar compartilhamento

1. Copiar a URL da barra de endereços
2. Abrir em nova aba anônima (Ctrl + Shift + N)
3. Fazer login como ADMIN
4. Colar a URL copiada

**✅ RESULTADO ESPERADO:**

- Mesma página carrega
- Mesmo orçamento é exibido
- URL é compartilhável

#### Passo 3: Testar botão voltar

1. Na página de detalhes, clicar em **← Voltar para Orçamentos**
2. Verificar navegação

**✅ RESULTADO ESPERADO:**

- Volta para `/admin/orcamentos`
- Lista de orçamentos é exibida

---

## 🚦 8. TESTE DE RATE LIMITING (P1)

### 8.1 Testar Limites nas Rotas Críticas

**Objetivo**: Verificar que rate limiting bloqueia excesso de requisições

#### Teste 1: POST /api/quotes (10 req/min)

```javascript
// DevTools Console
async function testQuotesRateLimit() {
  console.log("Testando rate limit em POST /api/quotes (limite: 10/min)...")
  for (let i = 1; i <= 12; i++) {
    const res = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test",
        email: "test@test.com",
        phone: "11999999999",
        items: []
      })
    })
    console.log(
      `${i}: ${res.status} ${res.status === 429 ? "⛔ BLOQUEADO" : ""}`
    )
    if (res.status === 429) {
      const data = await res.json()
      console.log("Mensagem:", data.error)
      return
    }
  }
}

testQuotesRateLimit()
```

**✅ RESULTADO ESPERADO:**

```
1: 200
2: 200
...
10: 200
11: 429 ⛔ BLOQUEADO
Mensagem: "Muitas requisições. Tente novamente em alguns instantes."
```

#### Teste 2: POST /api/admin/quotes/[id]/generate-boleto (10 req/min)

```javascript
async function testBoletoRateLimit(quoteId) {
  console.log("Testando rate limit em generate-boleto (limite: 10/min)...")
  for (let i = 1; i <= 12; i++) {
    const res = await fetch(`/api/admin/quotes/${quoteId}/generate-boleto`, {
      method: "POST"
    })
    console.log(
      `${i}: ${res.status} ${res.status === 429 ? "⛔ BLOQUEADO" : ""}`
    )
    if (res.status === 429) return
  }
}

testBoletoRateLimit("QUOTE_ID_AQUI")
```

**✅ RESULTADO ESPERADO:**

- Bloqueia na 11ª requisição com status 429

---

## 🧪 9. TESTES AUTOMATIZADOS

### 9.1 Executar Testes Unitários

```bash
# Terminal 2
cd "c:\Projetos\GB Locações"
pnpm test
```

**✅ RESULTADO ESPERADO:**

```
✓ tests/critical/quote-adjustment.test.ts (5 testes)
✓ tests/critical/quote-payment-terms.test.ts (1 teste)
✓ tests/critical/financial-revenue.test.ts
✓ tests/critical/verify-boleto-payments-cron.test.ts

Todos os testes: PASSOU ✓
```

**❌ FALHOU SE:**

- Qualquer teste falhar
- Erros de TypeScript
- Timeouts

### 9.2 Executar Verificação de Tipos

```bash
pnpm type-check
```

**✅ RESULTADO ESPERADO:**

```
> tsc --noEmit

(sem erros)
```

### 9.3 Executar Linter

```bash
pnpm lint
```

**✅ RESULTADO ESPERADO:**

```
> eslint . --ext .js,.ts,.tsx

(sem erros)
```

---

## ✅ 10. CHECKLIST FINAL

Marque cada item conforme completa:

### Segurança (P0)

- [ ] Vulnerabilidade de `userId` corrigida
- [ ] Rate limiting bloqueando após limite
- [ ] Sessão sendo usada corretamente

### Funcionalidade (P0/P1)

- [ ] Datas individuais preservadas na conversão
- [ ] Rental tem startDate/endDate corretos (MIN/MAX)
- [ ] Paginação carregando apenas 20 itens
- [ ] Busca com debounce (350ms)
- [ ] PDF de reajustes gerado corretamente
- [ ] Página dedicada acessível por URL

### Qualidade de Código

- [ ] TypeScript sem erros
- [ ] ESLint sem warnings
- [ ] Build de produção funcionando
- [ ] Testes unitários passando

### Performance

- [ ] Busca não trava durante digitação
- [ ] Paginação reduz tempo de carga
- [ ] Rate limiting protege de abuso

---

## 📊 RELATÓRIO DE RESULTADOS

Após completar todos os testes, preencha:

**Data do teste:** **_/_**/**\_\_** **Testado por:** **\*\*\*\***\_**\*\*\*\***

**Resumo:**

- Total de testes: 10
- Testes aprovados: \_\_\_
- Testes falhados: \_\_\_
- Bugs encontrados: \_\_\_

**Observações:**

---

---

---

**Status final:**

- [ ] ✅ APROVADO - Pronto para produção
- [ ] ⚠️ APROVADO COM RESSALVAS - Listar ressalvas abaixo
- [ ] ❌ REPROVADO - Necessário correções

**Assinatura:** **\*\*\*\***\_**\*\*\*\***

---

## 🆘 TROUBLESHOOTING

### Problema: "response is possibly undefined"

**Solução:** Certificar que fez build após as correções

```bash
pnpm build
```

### Problema: PDF não gera

**Verificar:**

1. Orçamento tem reajustes? (tabela QuoteAdjustment)
2. Erros no console do servidor?
3. Network mostra erro 404 ou 500?

### Problema: Paginação não funciona

**Verificar:**

1. API retorna metadados (total, page, limit)?
2. Frontend está enviando page na query string?
3. Console tem erros?

### Problema: Rate limiting não bloqueia

**Verificar:**

1. Redis está rodando? (rate limit usa cache)
2. Fazer requisições rápidas suficientes?
3. Verificar implementação em `lib/rate-limit.ts`

---

## 📞 CONTATO

Se encontrar problemas durante os testes:

1. Verificar console do navegador (F12)
2. Verificar logs do servidor (terminal onde rodou `pnpm dev`)
3. Verificar Prisma Studio para dados do banco
4. Documentar erro e reportar

**Boa sorte com os testes! 🚀**
