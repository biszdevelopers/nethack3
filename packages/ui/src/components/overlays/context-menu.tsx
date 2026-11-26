import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import { cn } from "../../lib/cn.js";

export const ContextMenu = ContextMenuPrimitive.Root;
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger;
export const ContextMenuGroup = ContextMenuPrimitive.Group;

export const ContextMenuContent = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(function ContextMenuContent({ className, ...rest }, ref) {
    return (
        <ContextMenuPrimitive.Portal>
            <ContextMenuPrimitive.Content
                ref={ref}
                className={cn(
                    "z-50 min-w-48 rounded-md border border-line bg-panel p-1 text-ink animate-[ui-pop-in_160ms_cubic-bezier(0.16,1,0.3,1)]",
                    "focus:outline-none",
                    className,
                )}
                {...rest}
            />
        </ContextMenuPrimitive.Portal>
    );
});

export interface ContextMenuItemProps
    extends ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> {
    readonly icon?: ReactNode;
    readonly shortcut?: string;
}

export const ContextMenuItem = forwardRef<HTMLDivElement, ContextMenuItemProps>(
    function ContextMenuItem({ className, icon, shortcut, children, ...rest }, ref) {
        return (
            <ContextMenuPrimitive.Item
                ref={ref}
                className={cn(
                    "flex min-h-9 cursor-pointer select-none items-center gap-2 rounded-sm px-2 text-sm text-ink-muted outline-none",
                    "focus:bg-raised focus:text-ink",
                    "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                    className,
                )}
                {...rest}
            >
                {icon === undefined ? null : (
                    <span className="shrink-0" aria-hidden="true">
                        {icon}
                    </span>
                )}
                <span className="flex-1">{children}</span>
                {shortcut === undefined ? null : (
                    <span className="text-xs text-ink-subtle">{shortcut}</span>
                )}
            </ContextMenuPrimitive.Item>
        );
    },
);

export const ContextMenuLabel = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Label>
>(function ContextMenuLabel({ className, ...rest }, ref) {
    return (
        <ContextMenuPrimitive.Label
            ref={ref}
            className={cn("px-2 py-1.5 text-xs text-ink-subtle", className)}
            {...rest}
        />
    );
});

export const ContextMenuSeparator = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(function ContextMenuSeparator({ className, ...rest }, ref) {
    return (
        <ContextMenuPrimitive.Separator
            ref={ref}
            className={cn("-mx-1 my-1 h-px bg-line", className)}
            {...rest}
        />
    );
});
