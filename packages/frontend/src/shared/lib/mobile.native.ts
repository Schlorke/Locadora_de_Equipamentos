import { useWindowDimensions } from "react-native";
import { MOBILE_BREAKPOINT } from "./mobile-config";

export { MOBILE_BREAKPOINT, mobileMediaQuery } from "./mobile-config";

export function useIsMobile() {
  return useWindowDimensions().width < MOBILE_BREAKPOINT;
}
