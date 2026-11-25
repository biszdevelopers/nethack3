import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "../lib/cn.js";

export const Tabs = TabsPrimitive.Root;

export const TabsList = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...rest }, ref) {
    return (
        <TabsPrimitive.List
            ref={ref}
            className={cn(
                "inline-flex h-10 items-center gap-1 rounded-md border border-line bg-panel p-1",
                className,
            )}
            {...rest}
        />
    );
});

export const TabsTrigger = forwardRef<
    HTMLButtonElement,
    ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...rest }, ref) {
    return (
        <TabsPrimitive.Trigger
            ref={ref}
            className={cn(
                "inline-flex h-8 items-center justify-center rounded-sm px-3 text-sm text-ink-muted transition-colors",
                "hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                "data-[state=active]:bg-raised data-[state=active]:text-ink",
                "disabled:pointer-events-none disabled:opacity-50",
                className,
            )}
            {...rest}
        />
    );
});

export const TabsContent = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...rest }, ref) {
    return (
        <TabsPrimitive.Content
            ref={ref}
            className={cn("mt-4 focus-visible:outline-none", className)}
            {...rest}
        />
    );
});

export function TabPanel({
    title,
    children,
}: {
    readonly title: string;
    readonly children: ReactNode;
}): ReactNode {
    return (
        <section aria-label={title} className="flex flex-col gap-3">
            {children}
        </section>
    );
}
