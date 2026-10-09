# Google Merchant Center – Tempo de entrega (GB Locações)

Recomendações para a tela **"Qual seu tempo de entrega?"** no
[Google Merchant Center](https://merchants.google.com/mc/shipping/services/onboarding)
(região BR), alinhadas ao funcionamento da GB Locações (Porto Alegre e região).

---

## 1. Fuso horário (obrigatório corrigir)

**Problema:** Se estiver em **(GMT-08:00) Horário Padrão do Pacífico (Los
Angeles)**, está errado para o Brasil.

**Recomendação:** Trocar para o fuso do Brasil:

- **(GMT-03:00) Horário de Brasília** ou
- **America/São Paulo** / **Brasília**

Porto Alegre usa o mesmo fuso de Brasília (GMT-3). Isso afeta o limite de
pedidos e o cálculo do prazo de entrega.

---

## 2. Limite para pedidos

- **Período:** 14:00 (14h) está ok se, na prática, pedidos após 14h forem
  tratados como “próximo dia útil” para separação.
- **Fuso horário:** Sempre **Horário de Brasília (GMT-03:00)**.

Horário de funcionamento da GB Locações (site): Seg–Sex 8h–18h, Sáb 8h–12h. Um
corte às 14h evita prometer “entrega no mesmo dia” para pedidos no fim da tarde.

---

## 3. Tempo de separação (dias)

- **Mín.:** 0
- **Máx.:** 1
- **Dias de atendimento:** Seg a Sáb

Faz sentido para locação de equipamentos: mesmo dia (0) ou próximo dia útil (1),
conforme disponibilidade e horário do pedido.

---

## 4. Tempo em trânsito (dias)

- **Destinos:** Todos os destinos (ou o que o Merchant permitir para “Porto
  Alegre e região”).
- **Enviado:** Seg a Sáb (igual aos dias de atendimento).
- **Mín. / Máx.:**
  - Se a entrega em **Porto Alegre** costuma ser no mesmo dia e na **região** no
    mesmo dia ou no dia seguinte: use **0** mínimo e **1** máximo (0–1 dias
    úteis em trânsito).
  - Se na prática tudo é “no mesmo dia” (cidade e região): pode manter **0–0**;
    caso contrário, **0–1** é mais seguro e evita subprometer.

---

## 5. Resumo sugerido

| Campo                   | Valor recomendado                                                |
| ----------------------- | ---------------------------------------------------------------- |
| **Fuso horário**        | (GMT-03:00) Horário de Brasília                                  |
| **Limite para pedidos** | 14:00 (no fuso de Brasília)                                      |
| **Tempo de separação**  | Mín. 0, Máx. 1, Seg a Sáb                                        |
| **Tempo em trânsito**   | Mín. 0, Máx. 0 ou 1 (conforme entrega real na região), Seg a Sáb |

Assim o Merchant calcula o “tempo de entrega total” corretamente para o Brasil e
para a operação da GB Locações.

---

_Última atualização: fevereiro 2026._
