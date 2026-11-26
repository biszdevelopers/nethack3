import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn.js";

export const cardVariants = tv({
    base: "rounded-lg border text-ink transition-[border-color,background-color,box-shadow,transform] duration-200",
    variants: {
        variant: {
            solid: "border-line bg-panel",
            outline: "border-line bg-transparent",
            soft: "border-transparent bg-raised/60",
            subtle: "border-transparent bg-panel",
        },
        hoverable: {
            true: "hover-lift",
            false: "",
        },
    },
    defaultVariants: {
        variant: "solid",
        hoverable: false,
    },
});

export interface CardProps
    extends ComponentPropsWithoutRef<"div">, VariantProps<typeof cardVariants> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
    { className, variant, hoverable, ...rest },
    ref,
) {
    return (
        <div ref={ref} className={cn(cardVariants({ variant, hoverable }), className)} {...rest} />
    );
});

export function CardHeader({ className, ...rest }: ComponentPropsWithoutRef<"div">): ReactNode {
    return <div className={cn("flex flex-col gap-1.5 p-5", className)} {...rest} />;
}

export function CardTitle({
    className,
    children,
    ...rest
}: ComponentPropsWithoutRef<"h3">): ReactNode {
    return (
        <h3 className={cn("text-base font-semibold tracking-tight", className)} {...rest}>
            {children}
        </h3>
    );
}

export function CardDescription({ className, ...rest }: ComponentPropsWithoutRef<"p">): ReactNode {
    return <p className={cn("text-sm text-ink-muted", className)} {...rest} />;
}

export function CardContent({ className, ...rest }: ComponentPropsWithoutRef<"div">): ReactNode {
    return <div className={cn("px-5 pb-5", className)} {...rest} />;
}

export function CardFooter({ className, ...rest }: ComponentPropsWithoutRef<"div">): ReactNode {
    return (
        <div
            className={cn(
                "flex items-center justify-end gap-2 border-t border-line px-5 py-3.5",
                className,
            )}
            {...rest}
        />
    );
}
