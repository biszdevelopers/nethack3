import { forwardRef, useId, type ComponentPropsWithoutRef } from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Star } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { useControllableState } from "../../hooks/state.js";

export interface RatingInputProps extends Omit<
    ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>,
    "value" | "defaultValue" | "onValueChange" | "className" | "aria-labelledby"
> {
    readonly label: string;
    readonly value?: number;
    readonly defaultValue?: number;
    readonly onValueChange?: (value: number) => void;
    readonly max?: number;
    readonly description?: string;
    readonly error?: string;
    readonly className?: string;
}

export const RatingInput = forwardRef<HTMLDivElement, RatingInputProps>(function RatingInput(
    {
        label,
        value,
        defaultValue,
        onValueChange,
        max = 5,
        description,
        error,
        className,
        disabled,
        ...rest
    },
    ref,
) {
    const id = useId();
    const descriptionId = description === undefined ? undefined : `${id}-description`;
    const errorId = error === undefined ? undefined : `${id}-error`;
    const describedBy =
        [descriptionId, errorId].filter((entry) => entry !== undefined).join(" ") || undefined;
    const [rating, setRating] = useControllableState<number>({
        value,
        defaultValue: defaultValue ?? 0,
        ...(onValueChange === undefined ? {} : { onChange: onValueChange }),
    });
    const stars = Array.from({ length: max }, (_, index) => index + 1);

    return (
        <fieldset
            className={cn("m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0", className)}
            data-slot="rating-input"
            aria-describedby={describedBy}
        >
            <legend className="p-0 text-sm font-medium text-ink">{label}</legend>
            {description === undefined ? null : (
                <p id={descriptionId} className="text-xs text-ink-muted">
                    {description}
                </p>
            )}
            <RadioGroupPrimitive.Root
                ref={ref}
                value={String(rating)}
                onValueChange={(next) => setRating(Number(next))}
                disabled={disabled}
                aria-label={label}
                aria-describedby={describedBy}
                aria-invalid={error === undefined ? undefined : true}
                orientation="horizontal"
                className="flex items-center gap-0.5"
                {...rest}
            >
                {stars.map((star) => (
                    <RadioGroupPrimitive.Item
                        key={star}
                        value={String(star)}
                        aria-label={`${star} of ${max}`}
                        className={cn(
                            "flex size-8 items-center justify-center rounded-sm text-ink-subtle",
                            "transition-colors duration-150 hover:text-ink",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                            "data-[state=checked]:text-primary",
                            "disabled:cursor-not-allowed disabled:opacity-50",
                        )}
                    >
                        <Star
                            className={cn("size-5", star <= rating ? "fill-current" : null)}
                            aria-hidden="true"
                        />
                    </RadioGroupPrimitive.Item>
                ))}
            </RadioGroupPrimitive.Root>
            {error === undefined ? null : (
                <p id={errorId} className="text-xs text-ink" role="alert">
                    {error}
                </p>
            )}
        </fieldset>
    );
});
