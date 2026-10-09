import { TextInput } from "react-native";
import { digitsToCurrencyNumber, formatCurrencyInput, parseCurrencyDigits } from "../web/currency-input";
export function CurrencyInput({value=0,onValueChange,disabled=false,"aria-label":label}:{value?:number;onValueChange?:(value:number)=>void;disabled?:boolean;"aria-label"?:string}){
 return <TextInput value={formatCurrencyInput(value)} keyboardType="numeric" editable={!disabled} accessibilityLabel={label} onChangeText={text=>onValueChange?.(digitsToCurrencyNumber(parseCurrencyDigits(text)))}/>;
}
