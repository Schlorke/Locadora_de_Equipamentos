# 📋 Dados da Empresa - GB Locações (Para Cadastro Asaas)

> **Dados formatados para preenchimento no cadastro do Asaas Sandbox**

---

## 🏢 **Dados da Empresa**

### **Informações Básicas**

- **Nome/Razão Social**: `GUSTAVO BARBOSA BRENNER`
- **Nome Fantasia**: `GB LOCACOES E MANUTENCAO`
- **CNPJ**: `34780330000169` (sem formatação) ou `34.780.330/0001-69`
  (formatado)
- **Data de Abertura**: `05/09/2019`
- **Porte**: `ME` (Microempresa)
- **Natureza Jurídica**: `213-5 - Empresário (Individual)`

### **Contato**

- **Email**: `gustavobbrenner@gmail.com`
- **Telefone**: `(51) 9982-0516` ou `5199820516` (sem formatação)

### **Endereço**

- **Logradouro**: `R IRMAO FRANCISCO`
- **Número**: `44`
- **Complemento**: (deixar em branco ou preencher se necessário)
- **Bairro**: `HUMAITA`
- **Cidade**: `PORTO ALEGRE`
- **Estado**: `RS`
- **CEP**: `90240120` (sem formatação) ou `90.240-120` (formatado)

### **Atividades Econômicas**

**Principal:**

- `43.30-4-04` - Serviços de pintura de edifícios em geral

**Secundárias:**

- `43.22-3-01` - Instalações hidráulicas, sanitárias e de gás
- `43.99-1-02` - Montagem e desmontagem de andaimes e outras estruturas
  temporárias
- `77.32-2-02` - Aluguel de andaimes

---

## 👤 **Dados do Responsável (Gustavo Barbosa Brenner)**

- **CPF**: `00816437050` (sem formatação) ou `008.164.370-50` (formatado)
- **RG**: `7080394741`
- **Data de Nascimento**: `30/03/1983`
- **Nome Completo**: `GUSTAVO BARBOSA BRENNER`

---

## 📝 **Como Preencher no Asaas**

### **No Formulário de Cadastro:**

1. **Tipo de Conta**: Selecione **"Pessoa Jurídica"** ou **"CNPJ"**

2. **Dados da Empresa**:
   - CNPJ: `34780330000169`
   - Razão Social: `GUSTAVO BARBOSA BRENNER`
   - Nome Fantasia: `GB LOCACOES E MANUTENCAO`

3. **Dados do Responsável**:
   - Nome: `GUSTAVO BARBOSA BRENNER`
   - CPF: `00816437050`
   - Email: `gustavobbrenner@gmail.com`
   - Telefone: `5199820516` (sem parênteses ou hífens)

4. **Endereço**:
   - Rua: `R IRMAO FRANCISCO`
   - Número: `44`
   - Bairro: `HUMAITA`
   - Cidade: `PORTO ALEGRE`
   - Estado: `RS`
   - CEP: `90240120`

---

## ⚠️ **Observações Importantes**

1. **Formatação**: O Asaas geralmente aceita dados com ou sem formatação, mas é
   recomendado usar **sem formatação** (apenas números)

2. **CNPJ**: Use `34780330000169` (14 dígitos, sem pontos ou barras)

3. **CPF**: Use `00816437050` (11 dígitos, sem pontos ou hífens)

4. **Telefone**: Use `5199820516` (DDD + número, sem parênteses, espaços ou
   hífens)

5. **CEP**: Use `90240120` (8 dígitos, sem hífen)

---

## ✅ **Checklist de Preenchimento**

Antes de enviar o formulário, verifique:

- [ ] CNPJ correto: `34780330000169`
- [ ] Razão Social: `GUSTAVO BARBOSA BRENNER`
- [ ] Email: `gustavobbrenner@gmail.com`
- [ ] Telefone: `5199820516`
- [ ] Endereço completo preenchido
- [ ] CEP: `90240120`
- [ ] Dados do responsável (CPF, nome)

---

## 🔧 **Configuração do Beneficiário para Boletos**

### **Importância da Configuração Correta**

⚠️ **CRÍTICO**: A configuração do beneficiário no Asaas determina quais dados
aparecem nos boletos bancários. Para conformidade legal (FEBRABAN/BCB), é
essencial que:

- O beneficiário seja a **pessoa jurídica** (CNPJ da empresa), não pessoa física
- Os dados estejam completos e corretos (razão social, endereço fiscal)
- Todos os boletos sejam emitidos com esses dados

### **Validação após Cadastro**

Após cadastrar a conta no Asaas:

1. Acesse o painel administrativo
2. Verifique em **"Minha Conta" → "Dados da Empresa"**:
   - Tipo de conta: **"Pessoa Jurídica"**
   - CNPJ: `34780330000169`
   - Razão Social: `GUSTAVO BARBOSA BRENNER`
   - Endereço completo e correto

3. **Teste**: Gere um boleto de teste e verifique o PDF:
   - Campo "CPF/CNPJ do Beneficiário" deve mostrar: `34.780.330/0001-69`
   - Nome do beneficiário deve corresponder à razão social da empresa

### **Documentação Relacionada**

Para mais detalhes sobre conformidade legal de boletos:

- [`docs/features/boleto-conformity.md`](../features/boleto-conformity.md) -
  Requisitos legais completos
- [`docs/guides/asaas-boleto-conformity-setup.md`](./asaas-boleto-conformity-setup.md) -
  Guia prático de configuração e validação

---

_Última atualização: Janeiro 2026_
