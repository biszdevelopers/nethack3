import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "../lib/cn.js";

export const Card = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(function Card(
    { className, ...rest },
    ref,
) {
    return (
        <div
            ref={ref}
            className={cn("rounded-lg border border-line bg-panel text-ink", className)}
            {...rest}
        />
    );
});

export function CardHeader({
    className,
    ...rest
}: ComponentPropsWithoutRef<"div">): ReactNode {
    return <div className={cn("flex flex-col gap-1 border-b border-line p-5", className)} {...rest} />;
}

export function CardTitle({
    className,
    ...rest
}: ComponentPropsWithoutRef<"h3">): ReactNode {
    return <h3 className={cn("text-base font-semibold", className)} {...rest} />;
}

export function CardDescription({
    className,
    ...rest
}: ComponentPropsWithoutRef<"p">): ReactNode {
    return <p className={cn("text-sm text-ink-muted", className)} {...rest} />;
}

export function CardContent({
    className,
    ...rest
}: ComponentPropsWithoutRef<"div">): ReactNode {
    return <div className={cn("p-5", className)} {...rest} />;
}

export function CardFooter({
    className,
    ...rest
}: ComponentPropsWithoutRef<"div">): ReactNode {
    return (
        <div
            className={cn("flex items-center justify-end gap-2 border-t border-line p-5", className)}
            {...rest}
        />
    );
}
