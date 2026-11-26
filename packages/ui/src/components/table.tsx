import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "../lib/cn.js";

export const Table = forwardRef<HTMLTableElement, ComponentPropsWithoutRef<"table">>(function Table(
    { className, ...rest },
    ref,
) {
    return (
        <div className="w-full overflow-x-auto">
            <table
                ref={ref}
                className={cn("w-full caption-bottom border-collapse text-sm", className)}
                {...rest}
            />
        </div>
    );
});

export function TableHeader({ className, ...rest }: ComponentPropsWithoutRef<"thead">): ReactNode {
    return <thead className={cn("border-b border-line", className)} {...rest} />;
}

export function TableBody({ className, ...rest }: ComponentPropsWithoutRef<"tbody">): ReactNode {
    return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...rest} />;
}

export function TableFooter({ className, ...rest }: ComponentPropsWithoutRef<"tfoot">): ReactNode {
    return (
        <tfoot className={cn("border-t border-line bg-raised font-medium", className)} {...rest} />
    );
}

export function TableRow({ className, ...rest }: ComponentPropsWithoutRef<"tr">): ReactNode {
    return (
        <tr
            className={cn("border-b border-line transition-colors hover:bg-raised/60", className)}
            {...rest}
        />
    );
}

export function TableHead({ className, ...rest }: ComponentPropsWithoutRef<"th">): ReactNode {
    return (
        <th
            className={cn(
                "h-10 px-3 text-left align-middle text-xs font-medium text-ink-muted",
                className,
            )}
            {...rest}
        />
    );
}

export function TableCell({ className, ...rest }: ComponentPropsWithoutRef<"td">): ReactNode {
    return <td className={cn("px-3 py-3 align-middle text-sm text-ink", className)} {...rest} />;
}

export function TableCaption({
    className,
    ...rest
}: ComponentPropsWithoutRef<"caption">): ReactNode {
    return <caption className={cn("mt-4 text-xs text-ink-subtle", className)} {...rest} />;
}
