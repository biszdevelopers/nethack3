import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn.js";

export const inputVariants = tv({
    base: [
        "flex w-full rounded-md border text-ink",
        "placeholder:text-ink-subtle",
        "transition-[color,background-color,border-color,box-shadow] duration-150",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-[invalid=true]:border-ink aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-ink",
    ],
    variants: {
        variant: {
            outline: "border-line bg-app hover:border-line-strong focus-visible:border-primary",
            soft: "border-transparent bg-raised focus-visible:border-primary/50",
            subtle: "border-transparent bg-transparent hover:bg-raised focus-visible:bg-raised",
            ghost: "border-transparent bg-transparent hover:bg-raised/60",
        },
        size: {
            xs: "h-8 px-2.5 text-xs",
            sm: "h-9 px-3 text-xs",
            md: "h-10 px-3.5 text-sm",
            lg: "h-11 px-4 text-sm",
        },
    },
    defaultVariants: {
        variant: "outline",
        size: "md",
    },
});

export interface InputProps
    extends Omit<ComponentPropsWithoutRef<"input">, "size">,
        VariantProps<typeof inputVariants> {
    readonly leading?: ReactNode;
    readonly trailing?: ReactNode;
    readonly wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
    {
        className,
        wrapperClassName,
        variant = "outline",
        size = "md",
        type = "text",
        leading,
        trailing,
        ...rest
    },
    ref,
) {
    const input = (
        <input
            ref={ref}
            type={type}
            className={cn(
                inputVariants({ variant, size }),
                leading === undefined ? "" : "pl-9",
                trailing === undefined ? "" : "pr-9",
                className,
            )}
            {...rest}
        />
    );

    if (leading === undefined && trailing === undefined) {
        return input;
    }

    return (
        <div className={cn("relative flex items-center", wrapperClassName)}>
            {leading === undefined ? null : (
                <span className="pointer-events-none absolute left-3 flex items-center text-ink-subtle">
                    {leading}
                </span>
            )}
            {input}
            {trailing === undefined ? null : (
                <span className="absolute right-3 flex items-center text-ink-subtle">
                    {trailing}
                </span>
            )}
        </div>
    );
});
