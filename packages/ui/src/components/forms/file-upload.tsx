import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { Upload, X } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { Button } from "../button.js";
import { Field } from "../field.js";

export interface FileUploadProps {
    readonly label: string;
    readonly accept?: string;
    readonly maxBytes?: number;
    readonly multiple?: boolean;
    readonly onFiles?: (files: File[]) => void;
    readonly description?: string;
    readonly error?: string;
    readonly disabled?: boolean;
    readonly className?: string;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function matchesAccept(file: File, accept: string): boolean {
    const name = file.name.toLowerCase();
    const type = file.type.toLowerCase();
    return accept
        .split(",")
        .map((token) => token.trim().toLowerCase())
        .filter((token) => token.length > 0)
        .some((token) => {
            if (token.startsWith(".")) {
                return name.endsWith(token);
            }
            if (token.endsWith("/*")) {
                return type.startsWith(token.slice(0, -1));
            }
            return type === token;
        });
}

export function FileUpload({
    label,
    accept,
    maxBytes,
    multiple = true,
    onFiles,
    description,
    error,
    disabled = false,
    className,
}: FileUploadProps): ReactNode {
    const inputRef = useRef<HTMLInputElement>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [dragging, setDragging] = useState(false);
    const [localError, setLocalError] = useState<string | undefined>(undefined);

    const handleFiles = (incoming: FileList | File[]): void => {
        const list = Array.from(incoming);
        const accepted: File[] = [];
        const problems: string[] = [];
        for (const file of list) {
            if (accept !== undefined && !matchesAccept(file, accept)) {
                problems.push(`${file.name}: file type is not accepted.`);
                continue;
            }
            if (maxBytes !== undefined && file.size > maxBytes) {
                problems.push(`${file.name}: larger than ${formatBytes(maxBytes)}.`);
                continue;
            }
            accepted.push(file);
        }
        const next = multiple ? [...files, ...accepted] : accepted.slice(0, 1);
        if (accepted.length > 0) {
            setFiles(next);
            onFiles?.(next);
        }
        setLocalError(problems.length > 0 ? problems.join(" ") : undefined);
    };

    const removeFile = (index: number): void => {
        const next = files.filter((_, position) => position !== index);
        setFiles(next);
        setLocalError(undefined);
        onFiles?.(next);
    };

    const onDrop = (event: DragEvent<HTMLDivElement>): void => {
        event.preventDefault();
        setDragging(false);
        if (disabled) {
            return;
        }
        handleFiles(event.dataTransfer.files);
    };

    const message = localError ?? error;

    return (
        <Field
            label={label}
            {...(description === undefined ? {} : { description })}
            {...(message === undefined ? {} : { error: message })}
            {...(className === undefined ? {} : { className })}
        >
            {(field) => (
                <div className="flex flex-col gap-2" data-slot="file-upload">
                    <input
                        ref={inputRef}
                        id={field.id}
                        type="file"
                        accept={accept}
                        multiple={multiple}
                        disabled={disabled}
                        tabIndex={-1}
                        aria-describedby={field["aria-describedby"]}
                        aria-invalid={field["aria-invalid"]}
                        onChange={(event) => {
                            if (event.target.files !== null) {
                                handleFiles(event.target.files);
                            }
                            event.target.value = "";
                        }}
                        className="sr-only"
                    />
                    <div
                        onDragOver={(event) => {
                            event.preventDefault();
                            if (!disabled) {
                                setDragging(true);
                            }
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={onDrop}
                        className={cn(
                            "flex flex-col items-center gap-2 rounded-md border border-dashed border-line px-4 py-6 text-center",
                            dragging ? "border-primary bg-primary-soft" : null,
                            disabled ? "opacity-50" : null,
                        )}
                    >
                        <Upload className="size-5 text-ink-muted" aria-hidden="true" />
                        <p className="text-sm text-ink-muted">
                            Drop files here or choose from your device.
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={disabled}
                            onClick={() => inputRef.current?.click()}
                        >
                            Browse files
                        </Button>
                        {accept === undefined && maxBytes === undefined ? null : (
                            <p className="text-xs text-ink-subtle">
                                {accept === undefined ? null : `Accepted: ${accept}. `}
                                {maxBytes === undefined
                                    ? null
                                    : `Maximum size: ${formatBytes(maxBytes)}.`}
                            </p>
                        )}
                    </div>
                    {files.length === 0 ? null : (
                        <ul className="flex flex-col gap-1" aria-label="Selected files">
                            {files.map((file, index) => (
                                <li
                                    key={`${file.name}-${file.size}-${file.lastModified}`}
                                    className="flex items-center justify-between gap-2 rounded-sm border border-line bg-raised px-2 py-1.5 text-sm"
                                >
                                    <span className="min-w-0 truncate text-ink">{file.name}</span>
                                    <span className="shrink-0 text-xs text-ink-muted">
                                        {formatBytes(file.size)}
                                    </span>
                                    <button
                                        type="button"
                                        aria-label={`Remove ${file.name}`}
                                        disabled={disabled}
                                        onClick={() => removeFile(index)}
                                        className="relative flex size-6 shrink-0 items-center justify-center rounded-sm text-ink-muted transition-colors after:absolute after:-inset-1.5 after:content-[''] hover:bg-app hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                                    >
                                        <X className="size-3.5" aria-hidden="true" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </Field>
    );
}
