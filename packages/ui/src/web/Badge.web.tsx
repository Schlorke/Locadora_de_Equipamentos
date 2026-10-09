import { cva, type VariantProps } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import * as React from "react";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold leading-tight text-center transition-colors w-fit",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        custom: "",
        "no-hover-default": "bg-primary text-primary-foreground",
        "no-hover-secondary": "bg-secondary text-secondary-foreground",
        "no-hover-destructive": "bg-destructive text-destructive-foreground",
        "no-hover-outline": "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
