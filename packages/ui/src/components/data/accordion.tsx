import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn.js";

export const Accordion = AccordionPrimitive.Root;

export const AccordionItem = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(function AccordionItem({ className, ...rest }, ref) {
    return (
        <AccordionPrimitive.Item
            ref={ref}
            data-slot="accordion-item"
            className={cn("border-b border-line", className)}
            {...rest}
        />
    );
});

export const AccordionTrigger = forwardRef<
    HTMLButtonElement,
    ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(function AccordionTrigger({ className, children, ...rest }, ref) {
    return (
        <AccordionPrimitive.Header className="flex">
            <AccordionPrimitive.Trigger
                ref={ref}
                data-slot="accordion-trigger"
                className={cn(
                    "group flex flex-1 items-center justify-between gap-3 py-3 text-left text-sm font-medium text-ink",
                    "transition-colors hover:text-primary",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
                    "disabled:pointer-events-none disabled:opacity-50",
                    className,
                )}
                {...rest}
            >
                {children}
                <ChevronDown
                    className="size-4 shrink-0 text-ink-muted transition-transform duration-150 group-data-[state=open]:rotate-180"
                    aria-hidden="true"
                />
            </AccordionPrimitive.Trigger>
        </AccordionPrimitive.Header>
    );
});

export const AccordionContent = forwardRef<
    HTMLDivElement,
    ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(function AccordionContent({ className, children, ...rest }, ref) {
    return (
        <AccordionPrimitive.Content
            ref={ref}
            data-slot="accordion-content"
            className={cn("pb-3 text-sm text-ink-muted", className)}
            {...rest}
        >
            {children}
        </AccordionPrimitive.Content>
    );
});

export interface AccordionSectionProps {
    readonly value: string;
    readonly title: string;
    readonly children: ReactNode;
}

export function AccordionSection({ value, title, children }: AccordionSectionProps): ReactNode {
    return (
        <AccordionItem value={value}>
            <AccordionTrigger>{title}</AccordionTrigger>
            <AccordionContent>{children}</AccordionContent>
        </AccordionItem>
    );
}
