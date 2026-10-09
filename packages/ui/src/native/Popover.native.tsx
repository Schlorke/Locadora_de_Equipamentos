import {OverlayRoot,OverlayTrigger,OverlayClose,OverlayPopup,type OverlayPopupProps} from "./overlay.native";
export const Popover=OverlayRoot,PopoverTrigger=OverlayTrigger,PopoverClose=OverlayClose;
export function PopoverContent({side="bottom",align="center",sideOffset=4,...props}:OverlayPopupProps){return <OverlayPopup {...props} anchored placement={side} align={align} sideOffset={sideOffset}/>}
