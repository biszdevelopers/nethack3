import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn.js";

export const textareaVariants = tv({
    base: [
        "flex min-h-24 w-full rounded-md border border-line bg-app px-3 py-2 text-sm text-ink",
        "placeholder:text-ink-subtle",
        "transition-colors duration-150 resize-y",
        "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-[invalid=true]:border-ink aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-ink",
    ],
});

export interface TextareaProps
    extends ComponentPropsWithoutRef<"textarea">,
        VariantProps<typeof textareaVariants> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
    { className, ...rest },
    ref,
) {
    return <textarea ref={ref} className={cn(textareaVariants(), className)} {...rest} />;
});
