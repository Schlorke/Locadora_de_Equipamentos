import type {PublicTenantStorage} from './public-tenant-routing'

/** Memória da locadora pública por aba do navegador; lida só em efeitos, nunca durante o SSR. */
export const sessionTenantStorage:PublicTenantStorage={
 getItem(key){try{return typeof window==='undefined'?null:window.sessionStorage.getItem(key)}catch{return null}},
 setItem(key,value){try{if(typeof window!=='undefined')window.sessionStorage.setItem(key,value)}catch{/* armazenamento bloqueado: segue sem memória */}},
}
