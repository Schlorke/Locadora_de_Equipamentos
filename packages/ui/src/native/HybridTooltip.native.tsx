import type {HybridTooltipProps} from "../contract/hybrid-tooltip";
import {Popover,PopoverTrigger,PopoverContent} from "./Popover.native";
export function useHasHover(){return false}
export function HybridTooltip({children,content,sideMobile="bottom",alignMobile="center",sideOffset=5,className}:HybridTooltipProps){return <Popover><PopoverTrigger asChild>{children}</PopoverTrigger><PopoverContent side={sideMobile} align={alignMobile} sideOffset={sideOffset} className={className}>{content}</PopoverContent></Popover>}
