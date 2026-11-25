import { forwardRef, type ComponentPropsWithoutRef } from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { cn } from "../../lib/cn.js";

const ScrollBar = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Scrollbar>
>(function ScrollBar({ className, orientation = "vertical", ...rest }, ref) {
    return (
        <ScrollAreaPrimitive.Scrollbar
            ref={ref}
            orientation={orientation}
            data-slot="scroll-area-scrollbar"
            className={cn(
                "flex touch-none select-none transition-colors",
                orientation === "vertical"
                    ? "h-full w-2 border-l border-l-transparent p-px"
                    : "h-2 flex-col border-t border-t-transparent p-px",
                className,
            )}
            {...rest}
        >
            <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-sm bg-line-strong" />
        </ScrollAreaPrimitive.Scrollbar>
    );
});

export interface ScrollAreaProps extends ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> {
    readonly orientation?: "vertical" | "horizontal" | "both";
    readonly viewportClassName?: string;
}

export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(function ScrollArea(
    { className, viewportClassName, orientation = "vertical", children, ...rest },
    ref,
) {
    return (
        <ScrollAreaPrimitive.Root
            ref={ref}
            data-slot="scroll-area"
            className={cn("relative overflow-hidden", className)}
            {...rest}
        >
            <ScrollAreaPrimitive.Viewport
                data-slot="scroll-area-viewport"
                className={cn(
                    "size-full rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    viewportClassName,
                )}
            >
                {children}
            </ScrollAreaPrimitive.Viewport>
            {orientation === "horizontal" ? null : <ScrollBar orientation="vertical" />}
            {orientation === "vertical" ? null : <ScrollBar orientation="horizontal" />}
            <ScrollAreaPrimitive.Corner className="bg-transparent" />
        </ScrollAreaPrimitive.Root>
    );
});

export { ScrollBar as ScrollAreaScrollbar };
