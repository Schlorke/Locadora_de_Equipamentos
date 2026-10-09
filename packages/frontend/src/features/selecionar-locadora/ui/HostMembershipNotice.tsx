'use client'
import {Button,Stack,Text} from '@gb-locacoes/ui'
import type {HostMembershipStatus} from '../model/use-host-tenant'
/**
 * Área do cliente em modo host sem vínculo ativo com a locadora do host. Não há seletor: sem vínculo, o caminho é a
 * tela de vínculo (consentimento explícito); vínculo suspenso ou revogado não é reativado por aqui.
 */
export function HostMembershipNotice({status,error,onEnroll,onRetry}:{status:HostMembershipStatus;error:string|null;onEnroll:()=>void;onRetry:()=>void}){
 if(status==='no-membership')return <Stack padding="md" gap="sm" surface><Text heading={2}>Vincular sua conta</Text><Text>Sua conta ainda não está vinculada a esta locadora. Vincule para acompanhar seus orçamentos e locações aqui.</Text><Button onClick={onEnroll}>Vincular minha conta</Button></Stack>
 if(status==='forbidden')return <Stack padding="md" gap="sm" surface><Text>Seu acesso a esta locadora está suspenso ou foi encerrado. Fale com a locadora.</Text></Stack>
 if(status==='error')return <Stack padding="md" gap="sm" surface><Text>{error??'Não foi possível verificar seu vínculo com esta locadora.'}</Text><Button variant="outline" onClick={onRetry}>Tentar novamente</Button></Stack>
 if(status==='loading')return <Stack padding="md"><Text>Carregando...</Text></Stack>
 return null
}
