"use client";

import { Funnel } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { FilterIndicatorProps } from "../contract/filter-indicator";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function FilterIndicator({
  isFiltered,
  className,
  size = "md",
  activeColor = "text-orange-500",
  inactiveColor = "text-gray-500",
}: FilterIndicatorProps) {
  const sizeClasses = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <div className="flex items-center justify-center shrink-0 h-10">
      <Funnel
        className={cn(
          "transition-colors duration-300",
          sizeClasses[size],
          isFiltered ? activeColor : inactiveColor,
          className,
        )}
      />
    </div>
  );
}
