import { useId, type ReactNode } from "react";
import { cn } from "../lib/cn.js";
import { Label } from "./label.js";

export interface FieldProps {
    readonly label: string;
    readonly children: (props: {
        id: string;
        "aria-describedby": string | undefined;
        "aria-invalid": boolean | undefined;
        "aria-required": boolean | undefined;
    }) => ReactNode;
    readonly description?: string;
    readonly error?: string;
    readonly required?: boolean;
    readonly className?: string;
    readonly optionalLabel?: string;
}

export function Field({
    label,
    children,
    description,
    error,
    required = false,
    className,
    optionalLabel,
}: FieldProps): ReactNode {
    const id = useId();
    const descriptionId = description === undefined ? undefined : `${id}-description`;
    const errorId = error === undefined ? undefined : `${id}-error`;
    const describedBy = [descriptionId, errorId].filter((value) => value !== undefined).join(" ");
    return (
        <div className={cn("flex flex-col gap-1.5", className)}>
            <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor={id}>
                    {label}
                    {required ? (
                        <>
                            <span className="ml-1 text-primary" aria-hidden="true">
                                *
                            </span>
                            <span className="sr-only"> (required)</span>
                        </>
                    ) : optionalLabel === undefined ? null : (
                        <span className="ml-2 text-xs font-normal text-ink-subtle">
                            {optionalLabel}
                        </span>
                    )}
                </Label>
            </div>
            {children({
                id,
                "aria-describedby": describedBy.length > 0 ? describedBy : undefined,
                "aria-invalid": error === undefined ? undefined : true,
                "aria-required": required ? true : undefined,
            })}
            {description === undefined ? null : (
                <p id={descriptionId} className="text-xs text-ink-muted">
                    {description}
                </p>
            )}
            {error === undefined ? null : (
                <p id={errorId} className="text-xs text-ink" role="alert">
                    <span className="mr-1 text-primary" aria-hidden="true">
                        !
                    </span>
                    {error}
                </p>
            )}
        </div>
    );
}
