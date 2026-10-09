"use client";

import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { clsx, type ClassValue } from "clsx";
import { AlertTriangle } from "lucide-react";
import * as React from "react";
import { twMerge } from "tailwind-merge";
import { buttonVariants } from "./Button.web";
import { useReleaseScrollLockRef } from "./release-scroll-lock";
import { TRIGGER_FRAME } from "./trigger";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const AlertDialog = AlertDialogPrimitive.Root

const AlertDialogTrigger = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Trigger>
>(({ className, ...props }, ref) => <AlertDialogPrimitive.Trigger ref={ref} className={cn(TRIGGER_FRAME, className)} {...props} />);
AlertDialogTrigger.displayName = "AlertDialogTrigger";

const AlertDialogPortal = AlertDialogPrimitive.Portal

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      'fixed inset-0 z-[var(--layer-dialog-backdrop)] bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
    ref={ref}
  />
))
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => {
  const contentRef = useReleaseScrollLockRef(ref)
  return (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      data-dialog-content
      ref={contentRef}
      className={cn(
        'fixed left-[50%] top-[50%] z-[var(--layer-dialog)] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-0 rounded-2xl border bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] overflow-hidden',
        className
      )}
      {...props}
    />
  </AlertDialogPortal>
  )
})
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName

const AlertDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'relative flex shrink-0 items-start gap-3 p-4 md:p-6 border-b border-gray-100 rounded-t-2xl bg-gradient-to-r from-slate-50 to-slate-100',
      className
    )}
    {...props}
  />
)
AlertDialogHeader.displayName = 'AlertDialogHeader'

const AlertDialogHeaderIcon = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 text-white shadow-sm',
      className
    )}
    {...props}
  >
    <AlertTriangle className="h-4 w-4" />
  </div>
)
AlertDialogHeaderIcon.displayName = 'AlertDialogHeaderIcon'

const AlertDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'p-4 md:p-6 border-t bg-gray-50 rounded-b-2xl shrink-0 w-full max-w-full flex flex-col-reverse sm:flex-row gap-2 items-stretch',
      className
    )}
    {...props}
  />
)
AlertDialogFooter.displayName = 'AlertDialogFooter'

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold text-left flex-1 pr-8', className)}
    {...props}
  />
))
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))
AlertDialogDescription.displayName =
  AlertDialogPrimitive.Description.displayName

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action
    ref={ref}
    className={cn(buttonVariants(), 'h-full w-full sm:flex-1', className)}
    {...props}
  />
))
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(
      buttonVariants({ variant: 'outline' }),
      'h-full w-full sm:flex-1',
      className
    )}
    {...props}
  />
))
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogHeaderIcon,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
