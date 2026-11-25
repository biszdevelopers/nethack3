import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface FieldGroupProps extends Omit<ComponentPropsWithoutRef<"fieldset">, "children"> {
    readonly legend: string;
    readonly description?: string;
    readonly columns?: 1 | 2 | 3;
    readonly errors?: readonly string[];
    readonly errorTitle?: string;
    readonly children: ReactNode;
}

const COLUMNS_CLASS: Record<1 | 2 | 3, string> = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
};

export function FieldGroup({
    className,
    legend,
    description,
    columns = 1,
    errors,
    errorTitle = "Please fix the following",
    children,
    ...rest
}: FieldGroupProps): ReactNode {
    const hasErrors = errors !== undefined && errors.length > 0;
    return (
        <fieldset className={cn("flex min-w-0 flex-col gap-4", className)} {...rest}>
            <legend className="text-sm font-medium text-ink">{legend}</legend>
            {description === undefined ? null : (
                <p className="-mt-3 text-xs text-ink-muted">{description}</p>
            )}
            {hasErrors ? (
                <div
                    role="alert"
                    className="flex flex-col gap-1 rounded-md border border-line-strong bg-raised p-3 text-xs text-ink"
                >
                    <p className="font-medium">{errorTitle}</p>
                    <ul className="list-disc pl-4 text-ink-muted">
                        {errors.map((error, index) => (
                            <li key={`${index}-${error}`}>{error}</li>
                        ))}
                    </ul>
                </div>
            ) : null}
            <div className={cn("grid gap-4", COLUMNS_CLASS[columns])}>{children}</div>
        </fieldset>
    );
}
