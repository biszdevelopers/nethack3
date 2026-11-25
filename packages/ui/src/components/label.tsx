import { forwardRef, type ComponentPropsWithoutRef } from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "../lib/cn.js";

export const Label = forwardRef<
    HTMLLabelElement,
    ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(function Label({ className, ...rest }, ref) {
    return (
        <LabelPrimitive.Root
            ref={ref}
            className={cn("text-sm font-medium text-ink", className)}
            {...rest}
        />
    );
});
