import { TextInput, View } from "react-native";
import { FilterSelectGroup } from "./FilterSelect.native";
import { FilterResetButton } from "./FilterResetButton.native";
import type { ComponentProps } from "react";
import { space } from "@gb-locacoes/design-tokens";
export function SearchBar({searchPlaceholder="Buscar...",searchValue="",onSearchChange,filters=[],showResetButton=true,onReset}:{searchPlaceholder?:string;searchValue?:string;onSearchChange?:(value:string)=>void;filters?:ComponentProps<typeof FilterSelectGroup>["filters"];showResetButton?:boolean;onReset?:()=>void;className?:string}){
 const reset=()=>{filters.forEach(filter=>filter.onValueChange("all"));onSearchChange?.("");onReset?.();};
 return <View style={{gap:space.sm}}><TextInput placeholder={searchPlaceholder} value={searchValue} onChangeText={onSearchChange}/><FilterSelectGroup filters={filters} resetButton={showResetButton?<FilterResetButton onClick={reset}/>:null}/></View>;
}
