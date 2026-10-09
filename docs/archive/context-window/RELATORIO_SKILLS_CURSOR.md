# Relatorio Tecnico: Skills para IA no Cursor e IDEs

## Resumo executivo

Este relatorio consolida como Skills elevam a eficiencia, precisao e governanca
do uso de IA em IDEs, com foco no Cursor. Ele combina documentacao oficial
(Cursor/Anthropic/OpenAI) e literatura academica para orientar: desenho de
SKILL.md, organizacao de recursos, escolhas de modelo e estrategias de mitigacao
de alucinacoes. O objetivo e transformar prompts dispersos em capacidades
reutilizaveis, auditaveis e com desempenho previsivel.

## 1) O papel das Skills em IDEs e por que sao criticas

Skills sao pacotes modulares de instrucoes, recursos e scripts que permitem ao
agente carregar conhecimento sob demanda. Elas:

- Reduzem repeticao e custo de contexto ao evitar reintroduzir instrucoes em
  cada conversa.
- Padronizam resultados (qualidade, formato e compliance).
- Encapsulam conhecimento organizacional (processos, padroes, politicas).
- Melhoram previsibilidade ao acoplar scripts deterministas a tarefas fragis.

Na pratica, Skills funcionam como um "manual de onboarding" para um agente, com
carregamento progressivo de contexto. Isso e fundamental para manter a janela de
contexto enxuta e reduzir alucinacoes por excesso de instrucao ou referencias
irrelevantes.

Fontes:

- Anthropic Agent Skills overview:
  https://docs.anthropic.com/en/docs/agents-and-tools/agent-skills/overview
- Blog Anthropic (arquitetura e progressive disclosure):
  https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
- Guia de Skills no Cursor (interno):
  `C:\Users\harry\.cursor\skills-cursor\create-skill\SKILL.md`

## 2) Arquitetura: progressive disclosure e janela de contexto

O principio central e o carregamento progressivo:

1. Metadados (nome + descricao) sao sempre carregados.
2. Corpo do `SKILL.md` so entra no contexto quando a Skill e ativada.
3. Recursos adicionais (references, scripts, assets) sao lidos apenas se
   necessario.

Impacto direto:

- Escala: muitas Skills instaladas sem inflar contexto.
- Eficiencia: scripts executam sem carregar o codigo no contexto (tokens
  economizados).
- Confiabilidade: reducao de ruido contextual melhora fidelidade.

Fontes:

- Anthropic Agent Skills overview (levels and loading)
- Skill-creator (principios de concisao e progressive disclosure):
  `C:\Users\harry\.codex\skills\.system\skill-creator\SKILL.md`

## 3) Estrutura ideal de uma Skill (padrao recomendado)

### 3.1 Estrutura de pastas

```
nome-da-skill/
├── SKILL.md              # Obrigatorio
├── reference.md          # Opcional: detalhes tecnicos
├── examples.md           # Opcional: exemplos reais
└── scripts/              # Opcional: scripts deterministas
    ├── validate.py
    └── helper.sh
```

### 3.2 Formato do SKILL.md

Requisitos minimos:

```markdown
---
name: sua-skill
description: O que faz e quando usar, com gatilhos claros
---

# Nome da Skill

## Instrucoes

Passos claros e objetivos.

## Exemplos

Entrada -> saida.
```

Regras criticas (Cursor/Anthropic):

- `name`: minusculas, numeros e hifens, max 64 chars.
- `description`: descrever O QUE faz e QUANDO usar; nao deixar para o corpo.
- Evitar texto longo no SKILL.md; preferir referencias externas.

Fontes:

- Cursor create-skill (regras e limites)
- Anthropic Agent Skills overview (requirements)

## 4) Como organizar e estruturar para maxima eficiencia

### 4.1 Concisao e densidade informacional

Principio: "o agente ja e inteligente; escreva apenas o que ele nao sabe".
Recomendacao: manter `SKILL.md` < 500 linhas e mover detalhes para
`reference.md`.

### 4.2 Progressive disclosure na pratica

No `SKILL.md`, descreva:

- Fluxo minimo ("quick start")
- Quando abrir `reference.md` e `examples.md`
- Quando executar scripts (e com quais parametros)

### 4.3 Scripts para tarefas criticas

Use scripts quando:

- O procedimento e repetitivo.
- A acuracia precisa ser deterministica.
- A saida precisa ser validada.

Beneficios: maior confiabilidade e menor custo de tokens.

### 4.4 Terminologia consistente

Defina termos unicos e use sempre os mesmos (ex.: "endpoint", "campo",
"entidade").

Fontes:

- Cursor create-skill (anti-patterns e boas praticas)
- Anthropic skills blog (scripts e recursos)

## 5) Padroes de SKILL.md para IDEs (recomendado)

### 5.1 Padrao base (curto e acionavel)

```markdown
# Nome da Skill

## Quick start

- Passo 1
- Passo 2

## Workflow

1. Fazer X
2. Validar Y (rodar script)
3. Se falhar, corrigir e repetir

## Recursos adicionais

- Ver [reference.md](reference.md) para detalhes
- Ver [examples.md](examples.md) para exemplos
```

### 5.2 Padrao com verificacao (para reduzir alucinacao)

```markdown
## Validacao

1. Gere a resposta.
2. Confirme cada afirmacao com referencia.
3. Se nao houver base, sinalize como incerto.
```

### 5.3 Padrao com escolhas condicionais

```markdown
## Escolha de caminho

- Se tarefa for A, seguir fluxo A
- Se tarefa for B, seguir fluxo B
```

Base conceitual:

- Prompt patterns (White et al., 2023): https://arxiv.org/abs/2302.11382

## 6) Melhor modelo: nao existe unico, existe "mais adequado"

A literatura e documentacao destacam que o melhor modelo depende do objetivo:

- Modelos mais capazes (ou latest) melhoram qualidade e reduzem esforco de
  prompt.
- Modelos com raciocinio podem exigir instrucoes menos detalhadas.
- Modelos menores servem para tarefas rotineiras e baratas.

Recomendacao operacional:

1. Autorar Skills e fluxos com o modelo mais capaz disponivel.
2. Depois, otimizar custo usando modelos menores para execucao rotineira.
3. Manter avaliacoes (evals) ao trocar de modelo.

Fontes:

- OpenAI Prompt Engineering:
  https://platform.openai.com/docs/guides/prompt-engineering
- OpenAI Best Practices:
  https://help.openai.com/en/articles/6654000-best-practices-for-prompt-engineering-with-openai-api
- Anthropic Prompt Engineering:
  https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview

## 7) Como evitar alucinacoes e aumentar precisao

A evidencia academica mostra que alucinacoes sao mitigadas por:

- RAG e grounding: trazer fontes externas relevantes.
- Verificacao iterativa (self-refinement).
- Estrutura de prompts e exemplos claros.
- Reducao de ambiguidade no input.

Pesquisa relevante:

- Survey de mitigacao de alucinacoes: https://arxiv.org/html/2401.01313v2
- Survey de RAG: https://arxiv.org/html/2506.00054v1

Recomendacoes praticas para Skills:

- Exigir citacao ou evidencias internas em saidas criticas.
- Definir regras de "quando dizer nao sei".
- Separar "resposta final" de "checar e revisar".
- Criar scripts de validacao para dados e formatacao.

## 8) Estrategias de prompt engineering aplicadas a Skills

Boas praticas com evidencia:

- Instrucoes claras e no inicio.
- Separadores explicitos entre contexto e tarefa.
- Exemplos concretos de saida.
- Metricas de sucesso e teste.

Fontes:

- OpenAI best practices
- Anthropic prompting overview
- Prompt Pattern Catalog (White et al., 2023)
- Chain-of-Thought (Wei et al., 2022): https://arxiv.org/abs/2201.11903

## 9) Avaliacao e metricas

Para medir qualidade de Skills e resultados:

- Precisao e completude das respostas.
- Taxa de retrabalho.
- Consistencia com padroes e compliance.
- Tempo medio de conclusao.
- "Faithfulness" quando ha fontes.

Quando usar testes:

- Suites de tarefas representativas do dominio.
- Testes regressivos antes de atualizar Skills.

## 10) Governanca e organizacao em times SaaS

Recomendacoes:

- Skills por dominio (produto, financeiro, suporte, engenharia).
- Padrao de naming e ownership.
- Revisao periodica e controle de versao.
- Separar Skills pessoais e Skills do projeto.

## 11) Seguranca e riscos

Skills sao poderosas e podem executar scripts. Boas praticas:

- Usar apenas Skills de fontes confiaveis.
- Auditar scripts e referencias.
- Evitar chamadas externas nao autorizadas.
- Tratar Skills como software (supply chain).

Fonte:

- Anthropic Agent Skills (security considerations)

## 12) Checklists praticos

### 12.1 Checklist de criacao

- [ ] `name` valido e especifico
- [ ] `description` com o que faz e quando usar
- [ ] `SKILL.md` < 500 linhas
- [ ] Exemplos claros
- [ ] Referencias separadas quando necessario
- [ ] Scripts testados e documentados

### 12.2 Checklist de qualidade

- [ ] Saidas consistentes com o formato desejado
- [ ] Reducao de alucinacoes em cenarios criticos
- [ ] Validacao automatizada disponivel (scripts)
- [ ] Atualizacoes com teste regressivo

## 13) Exemplo de SKILL.md recomendado (modelo)

```markdown
---
name: revisao-contratos
description:
  Revisar contratos SaaS e gerar relatorio de riscos, clausulas criticas e
  recomendacoes. Usar quando houver analise de contratos, termos legais ou
  compliance.
---

# Revisao de Contratos SaaS

## Quick start

1. Identificar tipo de contrato e partes.
2. Extrair clausulas criticas (responsabilidade, SLA, dados).
3. Classificar riscos (alto, medio, baixo).
4. Gerar relatorio com recomendacoes.

## Validacao

- Se uma clausula nao estiver no texto, sinalizar como "nao encontrado".

## Recursos

- Ver [reference.md](reference.md) para clausulas padrao.
- Rodar `scripts/validate.py` quando houver planilha de riscos.
```

## Conclusao

Skills bem projetadas aumentam a produtividade e reduzem erros em workflows
SaaS. O padrao recomendado combina: descricao precisa, SKILL.md conciso,
recursos externos organizados e scripts deterministas. A literatura confirma que
clareza, exemplos e verificacao reduzem alucinacoes. Em ambientes profissionais,
a governanca de Skills e tao importante quanto a governanca de codigo.

## Referencias (selecionadas)

- OpenAI Prompt Engineering:
  https://platform.openai.com/docs/guides/prompt-engineering
- OpenAI Best Practices:
  https://help.openai.com/en/articles/6654000-best-practices-for-prompt-engineering-with-openai-api
- Anthropic Prompt Engineering:
  https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview
- Anthropic Agent Skills Overview:
  https://docs.anthropic.com/en/docs/agents-and-tools/agent-skills/overview
- Anthropic Skills Blog:
  https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
- Prompt Pattern Catalog (White et al., 2023): https://arxiv.org/abs/2302.11382
- Chain-of-Thought (Wei et al., 2022): https://arxiv.org/abs/2201.11903
- Hallucination Mitigation Survey (2024): https://arxiv.org/html/2401.01313v2
- RAG Survey (2024/2025): https://arxiv.org/html/2506.00054v1
