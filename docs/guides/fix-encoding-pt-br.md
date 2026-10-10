# Correção localizada de texto UTF-8

O utilitário existente é `scripts/fix-encoding.mjs`. A
[receita anterior](../archive/wave135-pre-f/docs/guides/fix-encoding-pt-br.md.source)
foi arquivada; seus exemplos de caminhos e recomendações de conversão em lote
não são o procedimento atual.

## Comandos existentes

```sh
pnpm fix:changelog
pnpm fix:encoding
node scripts/fix-encoding.mjs docs/guides/fix-encoding-pt-br.md
```

Os dois primeiros comandos escolhem `CHANGELOG.md`; o último escolhe
explicitamente um arquivo existente. Um arquivo de host, quando for o alvo
comprovado, tem caminho completo como `apps/clients/web/src/app/layout.tsx`.

O script lê UTF-8, aplica um mapa fixo de substituições de texto e sobrescreve o
mesmo arquivo quando o conteúdo muda. Não detecta o encoding original e não é
uma conversão genérica de qualquer charset. Pode atingir ocorrências
intencionais de exemplos ou fixtures; confira o diff antes de aceitar.

## Procedimento

1. Distinguir erro de exibição do terminal de bytes realmente corrompidos.
   Conferir o arquivo no editor com UTF-8 e identificar o trecho exato.
2. Preservar os bytes originais fora do repositório. Aplicar somente ao arquivo
   identificado, sem varrer a árvore ou converter documentação histórica.
3. Revisar o diff e o significado do texto; CRLF/LF e BOM são decisões separadas
   da correção de caracteres. Não substituir literais de teste ou código sem
   caracterizar seu comportamento.
4. Executar a validação proporcional ao arquivo alterado. Para documentação,
   conferir links e índices; para código, também tipos e testes correspondentes.

Nenhum arquivo foi convertido por esta revisão documental. Capturas, backups e
arquivos temporários ficam fora do checkout; um registro histórico deve
conservar os bytes que constituem sua evidência.

_Atualizado em 2026-10-09; comandos conferidos no package.json do clone._
