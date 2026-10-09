"use client";

import * as React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function Skeleton({ className, width, height, style, ...props }: React.HTMLAttributes<HTMLDivElement> & { width?:number; height?:number }) {
  return <div style={{width,height,...style}} className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

export { Skeleton };
