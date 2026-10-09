import {OverlayRoot,OverlayTrigger,OverlayPortal,OverlayBackdrop,OverlayPopup,OverlayClose,OverlayTitle,OverlayDescription,OverlaySection,type OverlayRootProps,type OverlayPartProps} from "./overlay.native";
export function AlertDialog(props:OverlayRootProps){return <OverlayRoot {...props} dismissOnBackdrop={false}/>}
export const AlertDialogTrigger=OverlayTrigger,AlertDialogPortal=OverlayPortal,AlertDialogOverlay=OverlayBackdrop,AlertDialogHeader=OverlaySection,AlertDialogHeaderIcon=OverlaySection,AlertDialogFooter=OverlaySection,AlertDialogTitle=OverlayTitle,AlertDialogDescription=OverlayDescription,AlertDialogAction=OverlayClose,AlertDialogCancel=OverlayClose;
export function AlertDialogContent(props:OverlayPartProps){return <OverlayPopup {...props} kind="alertdialog"/>}
