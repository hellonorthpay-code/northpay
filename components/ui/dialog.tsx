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
>(({ className, children, hideClose, style, ...props }, ref) => {
  // Floating popovers (e.g. the date picker calendar) are portaled to
  // document.body so they aren't clipped by this dialog's overflow. But
  // that puts them OUTSIDE DialogContent, so Radix would treat clicks on
  // them as "interact outside" and close the dialog. We mark those
  // popovers with [data-northpay-popover] and cancel the close here.
  const ignoreIfPopover = (e: { target: EventTarget | null; preventDefault: () => void }) => {
    const t = e.target as HTMLElement | null;
    if (t && t.closest("[data-northpay-popover]")) e.preventDefault();
  };

  return (
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
      onPointerDownOutside={ignoreIfPopover}
      onInteractOutside={ignoreIfPopover}
      onFocusOutside={ignoreIfPopover}
      className={cn(
        // Centered via inset-0 + margin auto (NOT translate). A persistent
        // CSS transform / will-change / backdrop-filter on an ancestor makes
        // mobile browsers (Android Chrome) draw the text caret in the wrong
        // place inside child inputs — this avoids all three. The open zoom
        // animation still uses a temporary transform, which is fine once it
        // settles.
        "fixed inset-0 z-50 m-auto grid h-fit w-full max-w-lg gap-6 rounded-3xl border border-border bg-background p-7 shadow-pop",
        "origin-center",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
        "data-[state=open]:zoom-in-90 data-[state=closed]:zoom-out-95",
        className
      )}
      style={{
        animationDuration: "420ms",
        animationTimingFunction: IOS_EASE,
        animationFillMode: "both",
        ...style,
      }}
      {...props}
    >
      {children}
      {/* Solid ink disc with a knocked-out cross — the same vocabulary as the
          primary button, so dismiss reads as a real control instead of a grey
          smudge.
          Sized per input device: 56px on phones, where the target is a thumb
          and 44px reads small next to full-width fields; 44px from sm: up,
          where a pointer is precise and a large disc would crowd the first
          card in the sheet. It also tucks nearer the corner on phones to keep
          that clearance.
          `bg-foreground`/`text-background` rather than literal black/white so
          the disc inverts correctly in dark mode. */}
      {!hideClose && (
        <DialogPrimitive.Close className="absolute right-3 top-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background shadow-soft transition-opacity hover:opacity-85 active:scale-95 sm:right-4 sm:top-4 sm:h-11 sm:w-11">
          <X className="h-7 w-7 sm:h-[22px] sm:w-[22px]" strokeWidth={2.5} />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
  );
});
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
