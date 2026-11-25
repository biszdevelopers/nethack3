import { forwardRef, useCallback, useEffect, useRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "../../lib/cn.js";

export interface ValidationSummaryItem {
    readonly field: string;
    readonly message: string;
    readonly href?: string;
}

export interface ValidationSummaryProps extends ComponentPropsWithoutRef<"div"> {
    readonly items: readonly ValidationSummaryItem[];
    readonly title?: string;
    readonly autoFocus?: boolean;
}

export const ValidationSummary = forwardRef<HTMLDivElement, ValidationSummaryProps>(
    function ValidationSummary(
        { items, title = "Please fix the following", autoFocus = false, className, ...rest },
        ref,
    ) {
        const localRef = useRef<HTMLDivElement | null>(null);
        const setRefs = useCallback(
            (node: HTMLDivElement | null) => {
                localRef.current = node;
                if (typeof ref === "function") {
                    ref(node);
                } else if (ref !== null) {
                    ref.current = node;
                }
            },
            [ref],
        );

        useEffect(() => {
            if (autoFocus && items.length > 0) {
                localRef.current?.focus();
            }
        }, [autoFocus, items.length]);

        if (items.length === 0) {
            return null;
        }

        return (
            <div
                ref={setRefs}
                role="alert"
                aria-live="assertive"
                tabIndex={-1}
                className={cn(
                    "rounded-md border border-ink bg-raised p-4 text-sm text-ink",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    className,
                )}
                data-slot="validation-summary"
                {...rest}
            >
                <p className="font-medium">{title}</p>
                <ul className="mt-2 flex list-inside list-disc flex-col gap-1 text-ink-muted">
                    {items.map((item, index) => (
                        <li key={`${item.field}-${index}`}>
                            {item.href === undefined ? (
                                <>
                                    <span className="font-medium text-ink">{item.field}</span>
                                    {": "}
                                    {item.message}
                                </>
                            ) : (
                                <a
                                    href={item.href}
                                    className="underline underline-offset-2 hover:text-ink"
                                >
                                    <span className="font-medium text-ink">{item.field}</span>
                                    {": "}
                                    {item.message}
                                </a>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        );
    },
);
