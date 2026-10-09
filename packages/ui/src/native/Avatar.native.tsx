import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Image, Text, View } from "react-native";
import { componentTokens, typography } from "@gb-locacoes/design-tokens";
import { useTheme } from "../theme/ThemeProvider";

type ImageStatus = "idle" | "loading" | "loaded" | "error";
const AvatarContext = createContext<{status: ImageStatus; setStatus: (status: ImageStatus) => void} | null>(null);
function useAvatar() { const context = useContext(AvatarContext); if (!context) throw new Error("Avatar parts require Avatar"); return context; }

export function Avatar({children}: {children?: ReactNode; className?: string}) {
 const [status,setStatus] = useState<ImageStatus>("idle");
 const theme = useTheme();
 const avatar=componentTokens(theme).avatar;
 return <AvatarContext.Provider value={{status,setStatus}}><View style={{width:avatar.size,height:avatar.size,borderRadius:avatar.radius,overflow:"hidden",backgroundColor:theme.surface,alignItems:"center",justifyContent:"center"}}>{children}</View></AvatarContext.Provider>;
}
export function AvatarImage({src,alt,onLoadingStatusChange}: {src?:string;alt?:string;className?:string;onLoadingStatusChange?:(status:ImageStatus)=>void}) {
 const {setStatus}=useAvatar();
 useEffect(()=>{setStatus(src ? "loading" : "error");},[src,setStatus]);
 if(!src) return null;
 const update=(status:ImageStatus)=>{setStatus(status);onLoadingStatusChange?.(status);};
 return <Image key={src} source={{uri:src}} accessibilityLabel={alt} onLoad={()=>update("loaded")} onError={()=>update("error")} resizeMode="cover" style={{position:"absolute",width:"100%",height:"100%"}}/>;
}
export function AvatarFallback({children,delayMs=0}: {children?:ReactNode;delayMs?:number;className?:string}) {
 const {status}=useAvatar(); const theme=useTheme(); const [ready,setReady]=useState(delayMs===0);
 useEffect(()=>{if(delayMs===0)return;const timer=setTimeout(()=>setReady(true),delayMs);return()=>clearTimeout(timer);},[delayMs]);
 return ready && status!=="loaded" ? <Text style={{color:theme.text,fontSize:typography.size.sm}}>{children}</Text> : null;
}
