import { forwardRef, type ComponentPropsWithoutRef } from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "../lib/cn.js";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuSub = DropdownMenuPrimitive.Sub;

export const DropdownMenuContent = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(function DropdownMenuContent({ className, sideOffset = 6, ...rest }, ref) {
    return (
        <DropdownMenuPrimitive.Portal>
            <DropdownMenuPrimitive.Content
                ref={ref}
                sideOffset={sideOffset}
                className={cn(
                    "z-50 min-w-48 overflow-hidden rounded-md border border-line bg-panel p-1 text-ink",
                    "focus:outline-none",
                    className,
                )}
                {...rest}
            />
        </DropdownMenuPrimitive.Portal>
    );
});

export const DropdownMenuItem = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { readonly destructive?: boolean }
>(function DropdownMenuItem({ className, destructive = false, ...rest }, ref) {
    return (
        <DropdownMenuPrimitive.Item
            ref={ref}
            className={cn(
                "flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
                "focus:bg-raised focus:text-ink",
                "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                destructive ? "text-ink" : "text-ink-muted",
                className,
            )}
            {...rest}
        />
    );
});

export const DropdownMenuLabel = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>
>(function DropdownMenuLabel({ className, ...rest }, ref) {
    return (
        <DropdownMenuPrimitive.Label
            ref={ref}
            className={cn("px-2 py-1.5 text-xs text-ink-subtle", className)}
            {...rest}
        />
    );
});

export const DropdownMenuSeparator = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(function DropdownMenuSeparator({ className, ...rest }, ref) {
    return (
        <DropdownMenuPrimitive.Separator
            ref={ref}
            className={cn("-mx-1 my-1 h-px bg-line", className)}
            {...rest}
        />
    );
});

export const DropdownMenuCheckboxItem = DropdownMenuPrimitive.CheckboxItem;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;
export const DropdownMenuRadioItem = DropdownMenuPrimitive.RadioItem;
