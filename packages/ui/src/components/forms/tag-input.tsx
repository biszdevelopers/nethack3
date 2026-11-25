import {
    forwardRef,
    useId,
    useState,
    type ComponentPropsWithoutRef,
    type KeyboardEvent,
} from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { useControllableState } from "../../hooks/state.js";
import { Field } from "../field.js";
import { inputVariants, type InputProps } from "../input.js";

export interface TagInputProps extends Omit<
    ComponentPropsWithoutRef<"input">,
    "value" | "defaultValue" | "onChange" | "size" | "type"
> {
    readonly label: string;
    readonly value?: string[];
    readonly defaultValue?: string[];
    readonly onValueChange?: (value: string[]) => void;
    readonly maxTags?: number;
    readonly validate?: (tag: string) => string | undefined;
    readonly placeholder?: string;
    readonly description?: string;
    readonly error?: string;
    readonly optionalLabel?: string;
    readonly size?: InputProps["size"];
    readonly className?: string;
}

export const TagInput = forwardRef<HTMLInputElement, TagInputProps>(function TagInput(
    {
        label,
        value,
        defaultValue,
        onValueChange,
        maxTags,
        validate,
        placeholder = "Add a tag",
        description,
        error,
        optionalLabel,
        size,
        className,
        disabled,
        "aria-describedby": ariaDescribedBy,
        ...rest
    },
    ref,
) {
    const id = useId();
    const tagErrorId = `${id}-tag-error`;
    const [tags, setTags] = useControllableState<string[]>({
        value,
        defaultValue: defaultValue ?? [],
        ...(onValueChange === undefined ? {} : { onChange: onValueChange }),
    });
    const [draft, setDraft] = useState("");
    const [tagError, setTagError] = useState<string | undefined>(undefined);

    const addTag = (): void => {
        const candidate = draft.trim();
        if (candidate.length === 0) {
            return;
        }
        if (tags.includes(candidate)) {
            setDraft("");
            return;
        }
        if (maxTags !== undefined && tags.length >= maxTags) {
            setTagError(`You can add up to ${maxTags} tags.`);
            return;
        }
        const message = validate?.(candidate);
        if (message !== undefined) {
            setTagError(message);
            return;
        }
        setTags([...tags, candidate]);
        setDraft("");
        setTagError(undefined);
    };

    const removeTag = (index: number): void => {
        setTags(tags.filter((_, position) => position !== index));
        setTagError(undefined);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
        if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            addTag();
        } else if (event.key === "Backspace" && draft.length === 0 && tags.length > 0) {
            event.preventDefault();
            removeTag(tags.length - 1);
        } else if (event.key === "Escape" && draft.length > 0) {
            event.preventDefault();
            setDraft("");
        }
        rest.onKeyDown?.(event);
    };

    return (
        <Field
            label={label}
            {...(description === undefined ? {} : { description })}
            {...(error === undefined ? {} : { error })}
            {...(optionalLabel === undefined ? {} : { optionalLabel })}
            {...(className === undefined ? {} : { className })}
        >
            {(field) => {
                const describedBy =
                    [
                        ariaDescribedBy,
                        field["aria-describedby"],
                        tagError === undefined ? undefined : tagErrorId,
                    ]
                        .filter((entry) => entry !== undefined)
                        .join(" ") || undefined;
                return (
                    <div className="flex flex-col gap-1.5" data-slot="tag-input">
                        <div
                            className={cn(
                                "flex w-full flex-wrap items-center gap-1.5 rounded-md border border-line bg-app px-2 py-1.5",
                                "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30",
                                "has-[[aria-invalid=true]]:border-ink",
                                disabled === true ? "cursor-not-allowed opacity-50" : null,
                            )}
                        >
                            {tags.map((tag, index) => (
                                <span
                                    key={`${tag}-${index}`}
                                    className="inline-flex items-center gap-1 rounded-sm border border-line bg-raised px-2 py-0.5 text-xs text-ink"
                                >
                                    {tag}
                                    <button
                                        type="button"
                                        aria-label={`Remove ${tag}`}
                                        disabled={disabled === true}
                                        onClick={() => removeTag(index)}
                                        className="flex size-4 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-app hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                                    >
                                        <X className="size-3" aria-hidden="true" />
                                    </button>
                                </span>
                            ))}
                            <input
                                {...rest}
                                ref={ref}
                                id={field.id}
                                type="text"
                                value={draft}
                                disabled={disabled}
                                placeholder={tags.length === 0 ? placeholder : undefined}
                                aria-describedby={describedBy}
                                aria-invalid={
                                    field["aria-invalid"] ??
                                    (tagError === undefined ? undefined : true)
                                }
                                onChange={(event) => {
                                    setDraft(event.target.value);
                                    setTagError(undefined);
                                }}
                                onKeyDown={handleKeyDown}
                                className={cn(
                                    inputVariants({ size }),
                                    "h-7 min-w-24 w-auto flex-1 border-0 bg-transparent p-0 focus-visible:border-0 focus-visible:ring-0",
                                )}
                            />
                        </div>
                        {tagError === undefined ? null : (
                            <p id={tagErrorId} className="text-xs text-ink" role="alert">
                                {tagError}
                            </p>
                        )}
                    </div>
                );
            }}
        </Field>
    );
});
