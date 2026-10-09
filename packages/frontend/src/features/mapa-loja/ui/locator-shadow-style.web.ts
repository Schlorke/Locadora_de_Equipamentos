/**
 * Estilo do modo simplificado do localizador (home) dentro do Shadow DOM do `gmpx-store-locator` (Extended Component
 * Library 0.6.11): esconde o título "All locations (N)" e tira bordas e divisórias.
 *
 * Vai numa folha construída acrescentada ao FIM de `shadowRoot.adoptedStyleSheets`. As folhas adotadas vêm depois das
 * folhas `<style>` da mesma raiz e, entre si, na ordem do array; a do componente (Lit) é adotada primeiro. Por isso uma
 * regra daqui vence a do componente com a mesma especificidade, sem `!important`. As regras do componente que definem
 * cor de borda com seletor mais específico que `*` (botões e itens da lista de resultados) são repetidas no fim com o
 * seletor do próprio componente.
 */
export const SIMPLIFIED_LOCATOR_CSS = `
  .result-count, [class*="result-count"], [class*="ResultCount"],
  .location-list > div:first-child:has(span),
  .section-name, [class*="section-name"] {
    display: none;
  }
  /* Remover linha/borda entre mapa e painel */
  .layout-row .locations-panel,
  .layout-column .locations-panel,
  [class*="locations-panel"],
  [class*="LocationsPanel"] {
    border: none;
    box-shadow: none;
  }
  .gm-style iframe + div {
    border: none;
  }
  /* Remover todas as bordas e divisores */
  .layout-row, .layout-column {
    gap: 0;
  }
  .map-container, [class*="map-container"], [class*="MapContainer"] {
    border: none;
    border-bottom: none;
  }
  .divider, [class*="divider"], [class*="Divider"], hr {
    display: none;
  }
  /* Targeting the split layout divider */
  .split-layout-container > *,
  [class*="split"] > * {
    border: none;
  }
  /* Remove border from gmp-map */
  gmp-map, .gmp-map {
    border: none;
    outline: none;
  }
  /* Remove any border between map and panel in column layout */
  :host > div, :host > * {
    border: none;
  }
  /* Additional border removals */
  * {
    border-color: transparent;
  }
  .locations-panel-list {
    border-top: none;
    margin-top: 0;
    padding-top: 8px;
  }
  /* Cor de borda das regras do componente mais específicas que "*": mesmo seletor, folha posterior. */
  button,
  #location-results-list .result-item,
  #location-results-list .result-item:first-of-type,
  #location-results-list .result-item:last-of-type {
    border-color: transparent;
  }
`

type StyleRoot = Pick<ShadowRoot, 'adoptedStyleSheets'>

/**
 * Acrescenta `sheet` ao fim de `root.adoptedStyleSheets`, depois das folhas que já estão lá (as do componente), sem
 * removê-las. Se a folha já foi adotada, não faz nada.
 */
export function adoptSheetLast(root: StyleRoot, sheet: CSSStyleSheet): void {
  if (root.adoptedStyleSheets.includes(sheet)) return
  root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet]
}

let simplifiedSheet: CSSStyleSheet | null = null

/** Adota o estilo do modo simplificado na raiz do localizador; a folha é criada uma vez e serve a todas as raízes. */
export function adoptSimplifiedLocatorStyle(root: StyleRoot): void {
  if (!simplifiedSheet) {
    simplifiedSheet = new CSSStyleSheet()
    simplifiedSheet.replaceSync(SIMPLIFIED_LOCATOR_CSS)
  }
  adoptSheetLast(root, simplifiedSheet)
}
