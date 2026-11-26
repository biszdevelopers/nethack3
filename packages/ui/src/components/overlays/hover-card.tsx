import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import { cn } from "../../lib/cn.js";

export interface HoverCardProps
    extends ComponentPropsWithoutRef<typeof HoverCardPrimitive.Root> {
    readonly openDelay?: number;
    readonly closeDelay?: number;
}

export function HoverCard({
    openDelay = 200,
    closeDelay = 100,
    ...rest
}: HoverCardProps): ReactNode {
    return <HoverCardPrimitive.Root openDelay={openDelay} closeDelay={closeDelay} {...rest} />;
}

export const HoverCardTrigger = HoverCardPrimitive.Trigger;

export const HoverCardContent = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content>
>(function HoverCardContent({ className, sideOffset = 6, ...rest }, ref) {
    return (
        <HoverCardPrimitive.Portal>
            <HoverCardPrimitive.Content
                ref={ref}
                sideOffset={sideOffset}
                className={cn(
                    "z-50 w-64 max-w-[calc(100vw-2rem)] rounded-md border border-line bg-panel p-4 text-sm text-ink animate-[ui-pop-in_160ms_cubic-bezier(0.16,1,0.3,1)]",
                    "focus:outline-none",
                    className,
                )}
                {...rest}
            />
        </HoverCardPrimitive.Portal>
    );
});
