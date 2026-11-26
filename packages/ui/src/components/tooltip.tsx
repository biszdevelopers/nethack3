import {
    cloneElement,
    forwardRef,
    isValidElement,
    type ComponentPropsWithoutRef,
    type ReactNode,
} from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "../lib/cn.js";

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(function TooltipContent({ className, sideOffset = 6, ...rest }, ref) {
    return (
        <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content
                ref={ref}
                sideOffset={sideOffset}
                className={cn(
                    "z-50 max-w-xs animate-[ui-fade-in_120ms_ease-out] rounded-sm border border-line bg-panel px-2 py-1 text-xs text-ink",
                    "focus:outline-none",
                    className,
                )}
                {...rest}
            />
        </TooltipPrimitive.Portal>
    );
});

export function TooltipLabel({
    label,
    children,
}: {
    readonly label: string;
    readonly children: ReactNode;
}): ReactNode {
    const labelled = isValidElement<{
        "aria-label"?: string;
        "aria-labelledby"?: string;
    }>(children)
        ? children.props["aria-label"] !== undefined ||
          children.props["aria-labelledby"] !== undefined
            ? children
            : cloneElement(children, { "aria-label": label })
        : children;
    return (
        <Tooltip>
            <TooltipTrigger asChild>{labelled}</TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}
