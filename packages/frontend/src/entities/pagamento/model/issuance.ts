export interface BoletoIssuanceResponse {
  processing?: string;
  boletoPending?: boolean;
  boleto?: { processing?: string; metadata?: {pdfUrl?:string} | null };
}
export function getBoletoIssuanceFeedback(status:number, result:BoletoIssuanceResponse) {
  if(status===202 || result.processing==="PENDING" || result.boleto?.processing==="PENDING" || result.boletoPending===true)
    return {pending:true,message:"Solicitação registrada. O boleto está em processamento.",pdfUrl:null};
  const pdfUrl=result.boleto?.metadata?.pdfUrl??null;
  return {pending:false,message:pdfUrl?'Boleto gerado com sucesso. Clique em "Abrir Boleto" para visualizar.':"Boleto gerado com sucesso.",pdfUrl};
}
