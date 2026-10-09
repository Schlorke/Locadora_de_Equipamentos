import {createContext,useContext,type ReactNode} from "react";
import {OverlayRoot,OverlayTrigger,OverlayPopup,type OverlayRootProps,type OverlayActionProps,type OverlayPartProps} from "./overlay.native";
const Settings=createContext({delayDuration:500});
export function TooltipProvider({children,delayDuration=500}:{children?:ReactNode;delayDuration?:number}){return <Settings.Provider value={{delayDuration}}>{children}</Settings.Provider>}
export function Tooltip(props:OverlayRootProps){return <OverlayRoot {...props}/>}
export function TooltipTrigger(props:OverlayActionProps){const {delayDuration}=useContext(Settings);return <OverlayTrigger {...props} longPressDelay={delayDuration}/>}
export function TooltipContent({side="top",...props}:OverlayPartProps&{side?:"top"|"right"|"bottom"|"left";sideOffset?:number}){return <OverlayPopup {...props} placement={side} kind="tooltip"/>}
