"use client";
import * as C from "@gb-locacoes/ui";
export function CatalogToast({error}:{error:boolean}) {
 return <C.Stack><C.Button onClick={()=>error?C.toast.error("Não foi possível concluir",{description:"Mensagem local de demonstração"}):C.toast.success("Concluído",{description:"Mensagem local de demonstração"})}>Mostrar notificação</C.Button><C.Toaster/></C.Stack>;
}
