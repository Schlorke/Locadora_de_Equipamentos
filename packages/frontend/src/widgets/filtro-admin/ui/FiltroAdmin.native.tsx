import { View } from "react-native";
import { space } from "@gb-locacoes/design-tokens";
import { Card, Input, CustomSelect, CustomSelectItem, FilterResetButton } from "@gb-locacoes/ui";
import type { AdminFilterCardProps } from "./contract";
export function AdminFilterCard({searchPlaceholder="Buscar...",searchValue="",onSearchChange,filters=[],extraFilters,actionButtons,viewToggleButtons,onReset}:AdminFilterCardProps){
  const reset=()=>{filters.forEach(filter=>filter.onValueChange("all"));onSearchChange?.("");onReset?.();};
  return <Card><View style={{gap:space.md}}>
    {onSearchChange?<Input placeholder={searchPlaceholder} value={searchValue} onChangeText={onSearchChange}/>:null}
    {filters.map((filter,index)=><CustomSelect key={index} value={filter.value} onValueChange={filter.onValueChange} placeholder={filter.placeholder??filter.label}>
      {filter.options.map(option=><CustomSelectItem key={option.value} value={option.value}>{option.label}</CustomSelectItem>)}
    </CustomSelect>)}
    {extraFilters}<FilterResetButton onClick={reset}/>{viewToggleButtons}{actionButtons}
  </View></Card>;
}
