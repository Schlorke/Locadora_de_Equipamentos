"use client";

import { useEffect, useState } from "react";
import { MOBILE_BREAKPOINT, mobileMediaQuery } from "./mobile-config";

export { MOBILE_BREAKPOINT, mobileMediaQuery } from "./mobile-config";

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(mobileMediaQuery());
    const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    query.addEventListener("change", onChange);
    onChange();
    return () => query.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
