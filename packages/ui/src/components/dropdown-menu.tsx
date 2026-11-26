import { forwardRef, type ComponentPropsWithoutRef } from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight } from "lucide-react";
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
                    "z-50 min-w-48 animate-[ui-pop-in_160ms_cubic-bezier(0.16,1,0.3,1)] overflow-hidden rounded-md border border-line bg-panel p-1 text-ink",
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
                "flex min-h-9 cursor-pointer select-none items-center gap-2 rounded-sm px-2 text-sm outline-none",
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

export const DropdownMenuCheckboxItem = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(function DropdownMenuCheckboxItem({ className, children, checked, ...rest }, ref) {
    return (
        <DropdownMenuPrimitive.CheckboxItem
            ref={ref}
            checked={checked}
            className={cn(
                "relative flex min-h-9 cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm text-ink-muted outline-none",
                "focus:bg-raised focus:text-ink",
                "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                className,
            )}
            {...rest}
        >
            <span className="absolute left-2 flex size-3.5 items-center justify-center">
                <DropdownMenuPrimitive.ItemIndicator>
                    <Check className="size-4 text-primary" aria-hidden="true" />
                </DropdownMenuPrimitive.ItemIndicator>
            </span>
            {children}
        </DropdownMenuPrimitive.CheckboxItem>
    );
});

export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

export const DropdownMenuRadioItem = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(function DropdownMenuRadioItem({ className, children, ...rest }, ref) {
    return (
        <DropdownMenuPrimitive.RadioItem
            ref={ref}
            className={cn(
                "relative flex min-h-9 cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm text-ink-muted outline-none",
                "focus:bg-raised focus:text-ink",
                "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                className,
            )}
            {...rest}
        >
            <span className="absolute left-2 flex size-3.5 items-center justify-center">
                <DropdownMenuPrimitive.ItemIndicator>
                    <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
                </DropdownMenuPrimitive.ItemIndicator>
            </span>
            {children}
        </DropdownMenuPrimitive.RadioItem>
    );
});

export const DropdownMenuSubTrigger = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger>
>(function DropdownMenuSubTrigger({ className, children, ...rest }, ref) {
    return (
        <DropdownMenuPrimitive.SubTrigger
            ref={ref}
            className={cn(
                "flex min-h-9 cursor-pointer select-none items-center gap-2 rounded-sm px-2 text-sm text-ink-muted outline-none",
                "focus:bg-raised focus:text-ink data-[state=open]:bg-raised data-[state=open]:text-ink",
                "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                className,
            )}
            {...rest}
        >
            <span className="flex-1">{children}</span>
            <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
        </DropdownMenuPrimitive.SubTrigger>
    );
});

export const DropdownMenuSubContent = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(function DropdownMenuSubContent({ className, sideOffset = 6, ...rest }, ref) {
    return (
        <DropdownMenuPrimitive.Portal>
            <DropdownMenuPrimitive.SubContent
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
