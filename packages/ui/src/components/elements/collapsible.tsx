import { forwardRef, type ComponentPropsWithoutRef } from "react";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn.js";

export const Collapsible = CollapsiblePrimitive.Root;

export interface CollapsibleTriggerProps extends ComponentPropsWithoutRef<
    typeof CollapsiblePrimitive.Trigger
> {
    readonly showIndicator?: boolean;
}

export const CollapsibleTrigger = forwardRef<HTMLButtonElement, CollapsibleTriggerProps>(
    function CollapsibleTrigger({ className, showIndicator = true, children, ...rest }, ref) {
        return (
            <CollapsiblePrimitive.Trigger
                ref={ref}
                className={cn(
                    "group flex min-h-9 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-sm font-medium text-ink transition-colors",
                    "hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-app",
                    "disabled:pointer-events-none disabled:opacity-50",
                    className,
                )}
                {...rest}
            >
                <span className="min-w-0 flex-1">{children}</span>
                {showIndicator ? (
                    <ChevronDown
                        className="size-4 shrink-0 text-ink-muted transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none"
                        aria-hidden="true"
                    />
                ) : null}
            </CollapsiblePrimitive.Trigger>
        );
    },
);

export const CollapsibleContent = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Content>
>(function CollapsibleContent({ className, ...rest }, ref) {
    return (
        <CollapsiblePrimitive.Content
            ref={ref}
            className={cn("px-2 pt-2 text-sm text-ink-muted", className)}
            {...rest}
        />
    );
});
