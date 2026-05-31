"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

// iOS "smooth" easing curve (close to UIView.animate default). Reused for
// both the overlay's fade and the content's inflate so the two animations
// feel like one motion instead of two competing ones.
const IOS_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, style, ...props }, ref) => (
  // iOS-style backdrop: a deeper blur builds up as the world "recedes"
  // behind the sheet. Inline animation styling because tailwindcss-animate's
  // duration utility doesn't currently honour arbitrary values reliably.
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/40 backdrop-blur-xl",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
      className
    )}
    style={{
      animationDuration: "420ms",
      animationTimingFunction: IOS_EASE,
      animationFillMode: "both",
      ...style,
    }}
    {...props}
  />
));
DialogOverlay.displayName = "DialogOverlay";

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    hideClose?: boolean;
  }
>(({ className, children, hideClose, style, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogOverlay />
    {/* iOS modal vocabulary:
        - start at scale 0.90 (zoom-in-90) — the "inflate" reads more
          than the default 0.95.
        - no slide-from-bottom; iOS-style sheets swell from the centre.
        - 420ms with the iOS smooth curve so the swell feels deliberate
          rather than abrupt. Same curve on close → symmetric dismiss. */}
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // ── Mobile: bottom sheet ──────────────────────────────────────
        "fixed inset-x-0 bottom-0 z-50 grid w-full gap-5 rounded-t-[28px] border border-border bg-background/95 backdrop-blur-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-pop max-h-[92vh] overflow-y-auto",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
        "data-[state=open]:slide-in-from-bottom-8 data-[state=closed]:slide-out-to-bottom-8",
        // ── Desktop: centred modal ────────────────────────────────────
        "sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-lg sm:rounded-3xl sm:gap-6 sm:p-7 sm:max-h-none sm:overflow-visible",
        "sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-90",
        "sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=closed]:zoom-out-95",
        "origin-center will-change-transform",
        className
      )}
      style={{
        animationDuration: "380ms",
        animationTimingFunction: IOS_EASE,
        animationFillMode: "both",
        ...style,
      }}
      {...props}
    >
      {/* Drag handle — visible only on mobile */}
      <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 sm:hidden">
        <div className="h-1 w-9 rounded-full bg-muted-foreground/25" />
      </div>
      {children}
      {!hideClose && (
        <DialogPrimitive.Close className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors sm:right-5 sm:top-5">
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";

export const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-1.5 text-left", className)} {...props} />
);

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-xl font-semibold tracking-tighter text-foreground",
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";
