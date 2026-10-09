# 🔍 Explicação: Por que o Sandbox do Asaas mostra dados incorretos?

> **Por que o CPF correto retorna "João da Silva" no sandbox?**

---

## ✅ **SIM, o Sandbox é APENAS para Testes!**

O **sandbox.asaas.com** é um ambiente de **testes e desenvolvimento**, não é o
ambiente de produção. Ele foi criado especificamente para:

- ✅ Testar integrações sem afetar dados reais
- ✅ Desenvolver aplicações sem custos
- ✅ Simular pagamentos sem movimentar dinheiro real
- ✅ Validar fluxos antes de ir para produção

---

## 🐛 **Por que aparece "João da Silva" com CPF correto?**

### **1. Dados Mockados/Fictícios**

O sandbox do Asaas **não consulta a Receita Federal real**. Em vez disso, ele
usa:

- **Dados fictícios/mockados** para CPFs
- **Respostas simuladas** da API da Receita Federal
- **Validações simplificadas** que não verificam dados reais

### **2. Comportamento Esperado no Sandbox**

Quando você digita um CPF no sandbox:

1. O sistema **não faz consulta real** à Receita Federal
2. Ele retorna **dados fictícios** (como "João da Silva")
3. Isso é **intencional** para facilitar testes

### **3. O que fazer?**

**✅ Solução**: **Edite manualmente** o campo de nome!

- O sandbox permite editar qualquer campo
- Você pode corrigir o nome para o valor correto
- Isso não afeta o funcionamento da integração

---

## 📋 **Diferenças: Sandbox vs Produção**

| Aspecto               | Sandbox             | Produção                      |
| --------------------- | ------------------- | ----------------------------- |
| **URL**               | `sandbox.asaas.com` | `asaas.com`                   |
| **Consulta CPF/CNPJ** | Dados fictícios     | Consulta real Receita Federal |
| **Pagamentos**        | Simulados           | Reais                         |
| **API Key**           | Diferente           | Diferente                     |
| **Custo**             | Gratuito            | Taxas reais                   |
| **Finalidade**        | Testes              | Operação real                 |

---

## 🎯 **O que isso significa para você?**

### **✅ Para Desenvolvimento/Testes:**

1. **Use o sandbox normalmente** para testar a integração
2. **Edite manualmente** os campos que aparecem incorretos
3. **Não se preocupe** - isso é comportamento esperado
4. **Teste a geração de boletos** - funcionará normalmente

### **⚠️ Para Produção:**

Quando estiver pronto para produção:

1. **Crie conta em produção**: `https://asaas.com` (não sandbox)
2. **Use API Key de produção** (diferente do sandbox)
3. **Dados serão consultados corretamente** da Receita Federal
4. **Pagamentos serão reais**

---

## 🔧 **Como Corrigir no Sandbox**

### **Passo a Passo:**

1. **Preencha o CPF**: `00816437050`
2. **Aguarde o preenchimento automático** (pode aparecer "João da Silva")
3. **Clique no campo "Nome completo"**
4. **Apague o nome incorreto**
5. **Digite**: `GUSTAVO BARBOSA BRENNER`
6. **Salve as alterações**

### **Outros campos que podem precisar correção:**

- ✅ Nome completo
- ✅ Razão Social (se Pessoa Jurídica)
- ✅ Endereço (pode vir incorreto)
- ✅ Telefone (pode vir incorreto)

**Todos podem ser editados manualmente!**

---

## 📚 **Referências**

- **Documentação Asaas Sandbox**: https://docs.asaas.com/docs/sandbox
- **Guia de Setup Completo**: `docs/guides/asaas-setup-completo.md`
- **Guia de Testes**: `docs/guides/asaas-boleto-testing.md`

---

## ✅ **Conclusão**

**Não é um bug!** É o comportamento esperado do sandbox:

- ✅ Sandbox = Ambiente de testes com dados fictícios
- ✅ Produção = Ambiente real com consultas reais
- ✅ Para testes, edite manualmente os campos incorretos
- ✅ Para produção, os dados serão consultados corretamente

**Continue usando o sandbox normalmente para desenvolver e testar!** 🚀

---

_Última atualização: Dezembro 2025_
