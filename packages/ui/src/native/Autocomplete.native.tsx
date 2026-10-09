import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { border, radius, space, typography } from "@gb-locacoes/design-tokens";
import type { AutocompleteOption, AutocompleteProps } from "../contract/autocomplete";
import { useTheme } from "../theme/ThemeProvider";
export function Autocomplete({placeholder="Buscar...",loadOptions,onSelect,onSearch,disabled=false}:AutocompleteProps) {
 const theme=useTheme(); const [query,setQuery]=useState("");const [options,setOptions]=useState<AutocompleteOption[]>([]);const [loading,setLoading]=useState(false);const [selected,setSelected]=useState<AutocompleteOption|null>(null);
 useEffect(()=>{let current=true;if(disabled||query.length<2||selected){setOptions([]);setLoading(false);return;}
 const timer=setTimeout(()=>{setLoading(true);void loadOptions(query).then(rows=>{if(current)setOptions(rows);}).catch(()=>{if(current)setOptions([]);}).finally(()=>{if(current)setLoading(false);});},300);
 return()=>{current=false;clearTimeout(timer);};},[query,loadOptions,disabled,selected]);
 return <View style={{gap:space.sm}}><TextInput value={query} placeholder={placeholder} editable={!disabled} accessibilityRole="search" onChangeText={text=>{setSelected(null);setQuery(text);}} onSubmitEditing={()=>selected?onSelect?.(selected):onSearch?.(query)} style={{color:theme.text,padding:space.sm,borderWidth:border.hairline,borderColor:theme.border,borderRadius:radius.sm}}/>{loading?<ActivityIndicator accessibilityLabel="Carregando sugestões"/>:null}{options.map(option=><Pressable key={option.id} accessibilityRole="button" onPress={()=>{setSelected(option);setQuery(option.label);setOptions([]);onSelect?.(option);}} style={{padding:space.sm,gap:space.xs}}><Text style={{color:theme.text,fontSize:typography.size.md}}>{option.label}</Text>{option.description?<Text style={{color:theme.textMuted}}>{option.description}</Text>:null}{option.group?<Text style={{color:theme.textMuted}}>{option.group}</Text>:null}{option.detail?<Text style={{color:theme.textMuted}}>{option.detail}</Text>:null}</Pressable>)}</View>;
}
