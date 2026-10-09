export { usePublicSettings, type PublicSettings } from "./api/use-public-settings";
export { getLocalBusinessData } from "./model/local-business";
export type { LocalBusinessData } from "./model/local-business";
export { faixasDoHorario, linhaDaFaixa } from "./model/horario-de-funcionamento";
export { linhaLegal } from "./model/identificacao-legal";
export { anos, comMais, decadas, maisAntes, numeroDaVitrine } from "./model/numeros";
export {
  COMPROMISSOS,
  DETALHE_INCLUIDO,
  DETALHE_TOPO,
  FAQ_CERTIFICACAO,
  RESPOSTA_DO_EMAIL,
  RESPOSTA_RAPIDA,
  SELOS_DO_CONTATO,
  SERVICOS_DO_CONTATO,
  SERVICO_COM_CERTIFICACAO,
  SUPORTE_NOS_NUMEROS,
  beneficiosComCompromisso,
  comCompromissosDeclarados,
  compromissosDeclarados,
  declarouTodos,
  detalhePorQueEscolher,
  frasesPorCompromisso,
} from "./model/compromissos";
export type { CompromissosDeclarados } from "./model/compromissos";
export { localDaLoja } from "./model/local-da-loja";
export { seoDaVitrine } from "./model/seo-da-vitrine";
export type { PaginaDaVitrine } from "./model/seo-da-vitrine";
export { medicaoDaLocadora, tagDoGoogle } from "./model/medicao";
