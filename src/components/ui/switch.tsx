import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "group peer relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center overflow-hidden rounded-full transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 hover:brightness-110 active:scale-[0.97] ring-1 ring-inset ring-black/10 dark:ring-white/10 data-[state=unchecked]:bg-muted data-[state=unchecked]:shadow-[inset_0_1px_3px_rgba(0,0,0,0.15)] data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-indigo-500 data-[state=checked]:via-primary data-[state=checked]:to-fuchsia-500 data-[state=checked]:shadow-[0_0_18px_-2px_color-mix(in_oklab,var(--primary)_65%,transparent),inset_0_1px_1px_rgba(255,255,255,0.3)] data-[state=checked]:ring-white/20",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none absolute top-[3px] left-0 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-gradient-to-br from-white to-white/85 ring-0 transition-transform duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] data-[state=unchecked]:translate-x-[3px] data-[state=unchecked]:shadow-[0_1px_3px_rgba(0,0,0,0.2),inset_0_-1px_1px_rgba(0,0,0,0.06)] data-[state=checked]:translate-x-[23px] data-[state=checked]:shadow-[0_2px_8px_rgba(0,0,0,0.25),inset_0_-1px_1px_rgba(147,51,234,0.15)]",
      )}
    >
      <span className="block h-1.5 w-1.5 rounded-full bg-muted-foreground/20 group-data-[state=checked]:bg-primary/40 group-data-[state=checked]:shadow-[0_0_6px_rgba(147,51,234,0.6)]" />
    </SwitchPrimitives.Thumb>
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
