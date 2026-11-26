import { forwardRef, type ComponentPropsWithoutRef } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "../../lib/cn.js";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

export const PopoverContent = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(function PopoverContent({ className, align = "start", sideOffset = 6, ...rest }, ref) {
    return (
        <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
                ref={ref}
                align={align}
                sideOffset={sideOffset}
                className={cn(
                    "z-50 w-72 max-w-[calc(100vw-2rem)] rounded-md border border-line bg-panel p-4 text-ink animate-[ui-pop-in_160ms_cubic-bezier(0.16,1,0.3,1)]",
                    "focus:outline-none",
                    className,
                )}
                {...rest}
            />
        </PopoverPrimitive.Portal>
    );
});
