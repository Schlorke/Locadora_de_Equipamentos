"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApiClient } from "../../../shared/api";
import { filterEquipments, paginate, sortByNamePtBr } from "../../../entities/equipamento";
import type { Category, Equipment } from "./types";
export function getEquipmentReviewSummary(equipment: Pick<Equipment,"reviews">) {
  const reviewCount=equipment.reviews?.length??0;
  return {reviewCount,averageRating:reviewCount?equipment.reviews!.reduce((total,review)=>total+review.rating,0)/reviewCount:0};
}
export function useEquipmentCatalog({categoria,tenantSlug}:{categoria:string|null;tenantSlug?:string|null}) {
  const api=useApiClient(),slug=tenantSlug?.trim()??"",requestRevision=useRef(0);
  const [equipments,setEquipments]=useState<Equipment[]>([]),[categories,setCategories]=useState<Category[]>([]);
  const [isLoading,setIsLoading]=useState(true),[error,setError]=useState<string|null>(null),[loadedSlug,setLoadedSlug]=useState("");
  const [searchTerm,setSearch]=useState(""),[categoryFilter,setCategoryFilter]=useState("all");
  const [currentPage,setCurrentPage]=useState(1),[filterKey,setFilterKey]=useState(0),[pageKey,setPageKey]=useState(0);
  const load=useCallback(async(signal?:AbortSignal)=>{
    const revision=++requestRevision.current;
    setError(null);setIsLoading(true);setEquipments([]);setCategories([]);
    if(!slug){setError("Selecione uma locadora para consultar o catálogo.");setLoadedSlug("");setIsLoading(false);return;}
    try {
      const query="?tenantSlug="+encodeURIComponent(slug);
      const [equipmentData,categoryData]=await Promise.all([api.request<unknown>("/api/equipments"+query,{signal}),api.request<unknown>("/api/categories"+query,{signal})]);
      if(signal?.aborted||revision!==requestRevision.current)return;
      if(!Array.isArray(equipmentData)||!Array.isArray(categoryData))throw new Error("Resposta inválida do catálogo.");
      setEquipments(sortByNamePtBr(equipmentData as Equipment[]));setCategories(categoryData as Category[]);setLoadedSlug(slug);
    } catch(failure) {if(!signal?.aborted&&revision===requestRevision.current)setError(failure instanceof Error?failure.message:"Não foi possível carregar o catálogo.");}
    finally {if(!signal?.aborted&&revision===requestRevision.current)setIsLoading(false);}
  },[api,slug]);
  useEffect(()=>{const controller=new AbortController();setSearch("");setCategoryFilter("all");setCurrentPage(1);void load(controller.signal);return()=>controller.abort();},[load]);
  useEffect(()=>{const selected=categories.find(category=>category.slug===categoria);if(selected){setCategoryFilter(selected.id);setCurrentPage(1);}},[categoria,categories]);
  const handleCategoryChange=(value:string)=>{setCategoryFilter(value);setCurrentPage(1);setFilterKey(previous=>previous+1);};
  const setSearchTerm=(value:string)=>{setSearch(value);setCurrentPage(1);};
  const scopedEquipments=loadedSlug===slug?equipments:[];
  const filteredEquipments=useMemo(()=>filterEquipments(scopedEquipments,searchTerm,categoryFilter),[scopedEquipments,searchTerm,categoryFilter]);
  const {totalPages,items:currentEquipments}=paginate(filteredEquipments,currentPage,9);
  const changePage=(page:number)=>{setCurrentPage(Math.max(1,Math.min(page,totalPages||1)));setPageKey(previous=>previous+1);};
  return {equipments:scopedEquipments,categories:loadedSlug===slug?categories:[],filteredEquipments,currentEquipments,isLoading,error,searchTerm,setSearchTerm,categoryFilter,handleCategoryChange,filterKey,currentPage,totalPages,pageKey,changePage,fetchData:()=>load()};
}
