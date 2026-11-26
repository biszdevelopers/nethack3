import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn.js";

export const textareaVariants = tv({
    base: [
        "flex w-full rounded-md border text-ink",
        "placeholder:text-ink-subtle",
        "transition-[color,background-color,border-color,box-shadow] duration-150 resize-y",
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
            sm: "min-h-20 px-3 py-2 text-xs",
            md: "min-h-24 px-3.5 py-2.5 text-sm",
            lg: "min-h-32 px-4 py-3 text-sm",
        },
    },
    defaultVariants: {
        variant: "outline",
        size: "md",
    },
});

export interface TextareaProps
    extends ComponentPropsWithoutRef<"textarea">,
        VariantProps<typeof textareaVariants> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
    { className, variant, size, ...rest },
    ref,
) {
    return (
        <textarea
            ref={ref}
            className={cn(textareaVariants({ variant, size }), className)}
            {...rest}
        />
    );
});
