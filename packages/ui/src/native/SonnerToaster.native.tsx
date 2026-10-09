import { useSyncExternalStore, type ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { border, radius, space, typography } from "@gb-locacoes/design-tokens";
import { nativeToastStore, type ToastAction } from "../contract/toast-store";
import { useTheme } from "../theme/ThemeProvider";
export const toast = nativeToastStore.toast;
export function useSonner() {
  return { toasts: useSyncExternalStore(nativeToastStore.subscribe, nativeToastStore.getSnapshot, nativeToastStore.getSnapshot) };
}
function isAction(value: unknown): value is ToastAction {
  return !!value && typeof value === "object" && "label" in value && "onClick" in value && typeof value.onClick === "function";
}
export function Toaster() {
  const { toasts } = useSonner();
  const theme = useTheme();
  const content = (node: ReactNode) => typeof node === "string" || typeof node === "number" ? <Text style={{color:theme.text,fontSize:typography.size.sm}}>{node}</Text> : node;
  if (!toasts.length) return null;
  return <View pointerEvents="box-none" style={{position:"absolute",bottom:space.xl,left:space.md,right:space.md,gap:space.sm}}>
    {toasts.slice(-3).map(entry => <View key={entry.id} accessibilityLiveRegion="polite" accessibilityRole="alert"
      style={{padding:space.md,borderRadius:radius.md,borderWidth:border.hairline,borderColor:entry.type==="error"?theme.danger:theme.border,backgroundColor:theme.surface,gap:space.sm}}>
      <View style={{flexDirection:"row",alignItems:"center",gap:space.sm}}>
        {entry.type==="loading"?<ActivityIndicator color={theme.primary}/>:null}
        <View style={{flex:1}}>{content(entry.title)}</View>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar notificação" onPress={() => toast.dismiss(entry.id)} hitSlop={space.sm}><Text style={{color:theme.text}}>×</Text></Pressable>
      </View>
      {entry.description ? content(typeof entry.description === "function" ? entry.description() : entry.description) : null}
      {[entry.action,entry.cancel].map((action,index) => isAction(action) ? <Pressable key={index} accessibilityRole="button" onPress={() => { action.onClick(); toast.dismiss(entry.id); }} style={{paddingVertical:space.sm}}>{content(action.label)}</Pressable> : content(action))}
    </View>)}
  </View>;
}
