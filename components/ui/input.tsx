"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        // No backdrop-blur: a backdrop-filter on the input creates its own
        // compositing layer, which mis-positions the text caret on mobile
        // (Android Chrome). Solid bg instead — the blur did nothing over the
        // card anyway.
        "h-11 w-full rounded-xl border border-border bg-background px-4 text-[15px] text-foreground placeholder:text-muted-foreground transition-all duration-200 ease-out outline-none",
        "focus:border-foreground/30 focus:bg-background focus:shadow-soft",
        "disabled:opacity-50 disabled:pointer-events-none",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
