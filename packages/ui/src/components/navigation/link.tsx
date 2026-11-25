import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../../lib/cn.js";

export interface LinkProps extends ComponentPropsWithoutRef<"a"> {
    readonly asChild?: boolean;
    readonly active?: boolean;
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
    { className, asChild = false, active = false, children, ...rest },
    ref,
) {
    const classes = cn(
        "rounded-sm underline-offset-4 transition-colors",
        "hover:text-ink hover:underline",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-app",
        active ? "font-medium text-ink" : "text-ink-muted",
        className,
    );
    const ariaCurrent = active ? "page" : undefined;
    const dataActive = active ? "" : undefined;
    if (asChild) {
        return (
            <Slot
                ref={ref}
                data-slot="link"
                className={classes}
                aria-current={ariaCurrent}
                data-active={dataActive}
                {...rest}
            >
                {children}
            </Slot>
        );
    }
    return (
        <a
            ref={ref}
            data-slot="link"
            className={classes}
            aria-current={ariaCurrent}
            data-active={dataActive}
            {...rest}
        >
            {children}
        </a>
    );
});
