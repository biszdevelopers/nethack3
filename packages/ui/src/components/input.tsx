import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn.js";

export const inputVariants = tv({
    base: [
        "flex w-full rounded-md border border-line bg-app px-3 text-sm text-ink",
        "placeholder:text-ink-subtle",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-[invalid=true]:border-ink aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-ink",
    ],
    variants: {
        size: {
            sm: "h-9 text-xs",
            md: "h-10 text-sm",
            lg: "h-11 text-sm",
        },
    },
    defaultVariants: {
        size: "md",
    },
});

export interface InputProps
    extends Omit<ComponentPropsWithoutRef<"input">, "size">,
        VariantProps<typeof inputVariants> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
    { className, size, type = "text", ...rest },
    ref,
) {
    return (
        <input
            ref={ref}
            type={type}
            className={cn(inputVariants({ size }), className)}
            {...rest}
        />
    );
});
