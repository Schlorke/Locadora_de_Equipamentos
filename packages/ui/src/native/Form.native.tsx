import { Children, cloneElement, createContext, isValidElement, useContext, useId, type ReactElement, type ReactNode } from "react";
import { Text, View } from "react-native";
import { Controller, FormProvider, useFormContext, type ControllerProps, type FieldPath, type FieldValues } from "react-hook-form";
import { space, typography } from "@gb-locacoes/design-tokens";
import { useTheme } from "../theme/ThemeProvider";
const FieldContext=createContext<{name:string}|null>(null);
const ItemContext=createContext<string|null>(null);
export const Form=FormProvider;
export function FormField<T extends FieldValues,P extends FieldPath<T>>({...props}:ControllerProps<T,P>){return <FieldContext.Provider value={{name:props.name}}><Controller {...props}/></FieldContext.Provider>;}
export function FormItem({children}:{children?:ReactNode;className?:string}){const id=useId();return <ItemContext.Provider value={id}><View style={{gap:space.sm}}>{children}</View></ItemContext.Provider>;}
export function useFormField(){
 const field=useContext(FieldContext),item=useContext(ItemContext),form=useFormContext();
 if(!field||!item||!form)throw new Error("Form parts require Form, FormField and FormItem");
 return {id:item,name:field.name,formItemId:`${item}-input`,formDescriptionId:`${item}-description`,formMessageId:`${item}-message`,...form.getFieldState(field.name,form.formState)};
}
export function FormLabel({children}:{children?:ReactNode;className?:string}){const {formItemId,error}=useFormField();const theme=useTheme();return <Text nativeID={`${formItemId}-label`} style={{color:error?theme.danger:theme.text,fontSize:typography.size.sm}}>{children}</Text>;}
export function FormControl({children}:{children?:ReactNode}){
 const {formItemId,error}=useFormField();const child=Children.only(children);
 if(!isValidElement(child))return null;
 return cloneElement(child as ReactElement<Record<string,unknown>>,{id:formItemId,"aria-labelledby":`${formItemId}-label`,"aria-invalid":Boolean(error)});
}
export function FormDescription({children}:{children?:ReactNode;className?:string}){const {formDescriptionId}=useFormField();const theme=useTheme();return <Text nativeID={formDescriptionId} style={{color:theme.textMuted,fontSize:typography.size.sm}}>{children}</Text>;}
export function FormMessage({children}:{children?:ReactNode;className?:string}){const {error,formMessageId}=useFormField();const theme=useTheme();const body=error?.message?String(error.message):children;return body?<Text nativeID={formMessageId} accessibilityRole="alert" accessibilityLiveRegion="polite" style={{color:theme.danger,fontSize:typography.size.sm}}>{body}</Text>:null;}
