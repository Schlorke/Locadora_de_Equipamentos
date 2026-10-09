import { View, Text } from 'react-native';
import { radius, space, typography } from '@gb-locacoes/design-tokens';
import { useTheme } from '@gb-locacoes/ui';
import type { AdminPageHeaderProps } from './contract';
export type { AdminPageHeaderProps } from './contract';
export function AdminPageHeader({title,subtitle,icon,infoBadge}:AdminPageHeaderProps){
 const theme=useTheme();
 return <View style={{backgroundColor:theme.primary,borderRadius:radius.lg,padding:space.lg,gap:space.md}}>
  <View style={{flexDirection:'row',alignItems:'center',gap:space.md}}>{icon}<View style={{flex:1,gap:space.xs}}>
   <Text accessibilityRole="header" style={{color:theme.onPrimary,fontSize:typography.size.xl,fontWeight: typography.weight.bold}}>{title}</Text>
   {subtitle?<Text style={{color:theme.onPrimary,fontSize:typography.size.md}}>{subtitle}</Text>:null}
  </View></View>
  {infoBadge?<View style={{flexDirection:'row',alignItems:'center',gap:space.sm}}>{infoBadge.icon}<Text style={{color:theme.onPrimary}}>{infoBadge.text}</Text></View>:null}
 </View>;
}
