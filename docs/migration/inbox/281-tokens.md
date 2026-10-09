# 281-tokens

Gate `token-check` já estava verde. Nenhum comentário `token-check-allow` foi
adicionado; nenhum arquivo de produto foi editado. Carrossel 3D não tocado.

```yaml
fatia:
  id: 281-tokens
  estado: done
  conceito:
    token-check-allow apenas onde o gate falha (sem mudar valores visuais)
  origem: []
  destino: []
  arquivos_comentados: []
  comandos:
    - cmd: "node tools/token-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:02"
      nota: "já verde — examined 483 code / 0 CSS; 231 test/fixture skipped"
    - cmd: "node tools/arch-check.mjs"
      exit: 0
      verificado_em: "2026-09-25 16:02"
      nota: "architecture gate passed (5 packages)"
  bloqueios: []
```
