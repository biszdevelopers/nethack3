import { forwardRef, type ComponentPropsWithoutRef } from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cn } from "../../lib/cn.js";

export type ToggleGroupProps =
    | (ToggleGroupPrimitive.ToggleGroupSingleProps & {
          readonly connected?: boolean;
          readonly className?: string;
      })
    | (ToggleGroupPrimitive.ToggleGroupMultipleProps & {
          readonly connected?: boolean;
          readonly className?: string;
      });

export const ToggleGroup = forwardRef<HTMLDivElement, ToggleGroupProps>(function ToggleGroup(
    { className, connected = false, ...rest },
    ref,
) {
    const classes = cn(
        "inline-flex items-center",
        connected
            ? "gap-0 [&>button]:rounded-none [&>button:first-child]:rounded-l-md [&>button:last-child]:rounded-r-md [&>button+button]:-ml-px"
            : "gap-1",
        className,
    );
    if (rest.type === "single") {
        return (
            <ToggleGroupPrimitive.Root
                ref={ref}
                {...rest}
                data-slot="toggle-group"
                className={classes}
            />
        );
    }
    return (
        <ToggleGroupPrimitive.Root
            ref={ref}
            {...rest}
            data-slot="toggle-group"
            className={classes}
        />
    );
});

export const ToggleGroupItem = forwardRef<
    HTMLButtonElement,
    ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>
>(function ToggleGroupItem({ className, ...rest }, ref) {
    return (
        <ToggleGroupPrimitive.Item
            ref={ref}
            data-slot="toggle-group-item"
            className={cn(
                "inline-flex h-9 min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-line-strong bg-transparent px-3 text-sm text-ink-muted transition-colors select-none",
                "hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-app",
                "data-[state=on]:bg-raised data-[state=on]:text-ink",
                "disabled:pointer-events-none disabled:opacity-50",
                className,
            )}
            {...rest}
        />
    );
});
