import { useRef, type ComponentRef } from "react";
import { ActivityIndicator, ScrollView, View, Text } from "react-native";
import { Button, Card, Badge, useTheme } from "@gb-locacoes/ui";
import { radius, space, typography } from "@gb-locacoes/design-tokens";
import { useEquipmentCatalog, getEquipmentReviewSummary } from "../model/use-equipment-catalog";
import { useHrefResolver } from "../../../shared/lib/navigation";
import { withPublicTenant } from "../../../entities/organizacao";
import type { EquipamentosPageProps } from "../model/types";
export type { EquipamentoImageProps } from "../model/types";
export function EquipamentosPage({categoria,tenantSlug,image,link,filterCard,pagination,categoryBadge}:EquipamentosPageProps){
  const model=useEquipmentCatalog({categoria,tenantSlug}),theme=useTheme(),scroll=useRef<ComponentRef<typeof ScrollView>>(null);
  // Como no web: o resolvedor do host decide (legado acrescenta ?tenantSlug=, modo host mantém o caminho limpo);
  // sem resolvedor na árvore, preserva a locadora recebida pela página.
  const resolveHref=useHrefResolver()??((href:string)=>withPublicTenant(href,tenantSlug??null));
  if(model.isLoading)return <View style={{padding:space.lg,gap:space.md}}><ActivityIndicator color={theme.primary}/><Text style={{color:theme.text}}>Carregando equipamentos...</Text></View>;
  if(model.error)return <View style={{padding:space.lg,gap:space.md}}><Text accessibilityRole="header" style={{color:theme.text}}>Erro ao carregar equipamentos</Text><Text accessibilityRole="alert" style={{color:theme.danger}}>{model.error}</Text><Button onClick={()=>void model.fetchData()}>Tentar Novamente</Button></View>;
  return <ScrollView ref={scroll} contentContainerStyle={{padding:space.md,gap:space.lg,backgroundColor:theme.background}}>
    <View style={{backgroundColor:theme.primary,borderRadius:radius.lg,padding:space.lg,gap:space.sm}}>
      <Text accessibilityRole="header" style={{color:theme.onPrimary,fontSize:typography.size.lg,fontWeight: typography.weight.semibold}}>Nossos Equipamentos</Text>
      <Text style={{color:theme.onPrimary}}>Encontre o equipamento ideal para sua obra</Text>
      <Text style={{color:theme.onPrimary}}>{model.filteredEquipments.length} equipamentos encontrados</Text>
    </View>
    {filterCard({searchPlaceholder:"Buscar equipamentos...",searchValue:model.searchTerm,onSearchChange:model.setSearchTerm,filters:[{label:"Categoria",value:model.categoryFilter,onValueChange:model.handleCategoryChange,placeholder:"Categoria",options:[{value:"all",label:"Todas as categorias"},...model.categories.map(category=>({value:category.id,label:category.name}))]}]})}
    {model.currentEquipments.map((equipment,index)=>{
      const {averageRating,reviewCount}=getEquipmentReviewSummary(equipment);
      const href=resolveHref("/equipamentos/"+encodeURIComponent(equipment.id));
      return <Card key={equipment.id}><View style={{gap:space.md}}>
        {equipment.images?.[0]?image({src:equipment.images[0],alt:equipment.name,width:300,height:200,priority:index<3,className:"",style:{width:"auto",height:"auto"}}):<Text style={{color:theme.textMuted}}>Imagem não disponível</Text>}
        {!equipment.isAvailable?<Badge variant="destructive">Indisponível</Badge>:null}
        <Text accessibilityRole="header" style={{color:theme.text,fontSize:typography.size.lg,fontWeight: typography.weight.semibold}}>{equipment.name}</Text>
        <Text style={{color:theme.textMuted}}>{equipment.description}</Text>
        <Text style={{color:theme.textMuted}}>{reviewCount?averageRating.toFixed(1)+" ("+reviewCount+" "+(reviewCount===1?"avaliação":"avaliações")+")":"Nenhuma avaliação"}</Text>
        <Text style={{color:theme.primary,fontSize:typography.size.lg}}>R$ {equipment.pricePerDay?.toFixed(2)??"0.00"}/dia</Text>
        {equipment.category?categoryBadge(equipment.category):<Badge variant="secondary">Sem categoria</Badge>}
        {link({href,children:"Ver Detalhes"})}
        {equipment.isAvailable?link({href,children:"Solicitar Orçamento"}):<Button disabled>Indisponível</Button>}
      </View></Card>;
    })}
    {!model.filteredEquipments.length?<Card><Text style={{color:theme.text,fontSize:typography.size.lg}}>Nenhum equipamento disponível</Text><Text style={{color:theme.textMuted}}>{model.equipments.length?"Que tal tentar uma categoria diferente ou ajustar os filtros de busca?":"Estamos atualizando nosso catálogo com novos equipamentos. Em breve teremos mais opções para você!"}</Text></Card>:null}
    {pagination({currentPage:model.currentPage,totalPages:model.totalPages,onPageChange:page=>{model.changePage(page);scroll.current?.scrollTo({y:0,animated:true});}})}
  </ScrollView>;
}
