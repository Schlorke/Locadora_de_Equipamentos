"use client";

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import * as React from "react";
import { cn } from "./cn";
import { TRIGGER_FRAME } from "./trigger";

const Collapsible = CollapsiblePrimitive.Root;

const CollapsibleTrigger = React.forwardRef<
  React.ElementRef<typeof CollapsiblePrimitive.CollapsibleTrigger>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.CollapsibleTrigger>
>(({ className, ...props }, ref) => <CollapsiblePrimitive.CollapsibleTrigger ref={ref} className={cn(TRIGGER_FRAME, className)} {...props} />);
CollapsibleTrigger.displayName = "CollapsibleTrigger";

const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
