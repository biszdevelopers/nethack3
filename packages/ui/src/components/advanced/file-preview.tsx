import { useState, type ReactNode } from "react";
import { Download, FileText } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { formatFileSize } from "../data/file-list.js";
import { buttonVariants } from "../button.js";

export type FilePreviewKind = "image" | "text" | "pdf" | "other";

export interface FilePreviewProps {
    readonly name: string;
    readonly kind: FilePreviewKind;
    readonly url?: string;
    readonly mimeType?: string;
    readonly size?: number;
    readonly alt?: string;
    readonly text?: string;
    readonly previewLimit?: number;
    readonly actions?: ReactNode;
    readonly className?: string;
}

function Metadata({
    name,
    kind,
    mimeType,
    size,
}: {
    readonly name: string;
    readonly kind: FilePreviewKind;
    readonly mimeType?: string;
    readonly size?: number;
}): ReactNode {
    return (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-ink-subtle">Name</dt>
            <dd className="break-all text-ink">{name}</dd>
            <dt className="text-ink-subtle">Type</dt>
            <dd className="text-ink">{mimeType ?? kind}</dd>
            {size === undefined ? null : (
                <>
                    <dt className="text-ink-subtle">Size</dt>
                    <dd className="tabular-nums text-ink">{formatFileSize(size)}</dd>
                </>
            )}
        </dl>
    );
}

export function FilePreview({
    name,
    kind,
    url,
    mimeType,
    size,
    alt,
    text,
    previewLimit = 2000,
    actions,
    className,
}: FilePreviewProps): ReactNode {
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    const imageFailed = url !== undefined && failedUrl === url;

    return (
        <section
            aria-label={`Preview of ${name}`}
            data-slot="file-preview"
            className={cn(
                "flex flex-col gap-3 rounded-lg border border-line bg-panel p-3",
                className,
            )}
        >
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                    <FileText className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
                    <h3 className="truncate text-sm font-medium text-ink">{name}</h3>
                </div>
                {actions === undefined ? null : (
                    <div className="flex shrink-0 items-center gap-1">{actions}</div>
                )}
            </div>

            {kind === "image" ? (
                url === undefined || imageFailed ? (
                    <output className="block text-sm text-ink-muted">
                        Preview unavailable. The image could not be loaded.
                    </output>
                ) : (
                    <img
                        src={url}
                        alt={alt ?? name}
                        loading="lazy"
                        onError={() => setFailedUrl(url)}
                        className="max-h-80 w-full rounded-md border border-line object-contain"
                    />
                )
            ) : null}

            {kind === "text" ? (
                text === undefined ? (
                    <p className="text-sm text-ink-muted">No text content is available.</p>
                ) : text.length === 0 ? (
                    <p className="text-sm text-ink-muted">The file is empty.</p>
                ) : (
                    <div className="flex flex-col gap-1">
                        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-app p-3 text-xs text-ink">
                            {text.length > previewLimit ? `${text.slice(0, previewLimit)}…` : text}
                        </pre>
                        {text.length > previewLimit ? (
                            <p className="text-xs text-ink-subtle">
                                Showing the first {previewLimit} of {text.length} characters.
                            </p>
                        ) : null}
                    </div>
                )
            ) : null}

            {kind === "pdf" || kind === "other" ? (
                <div className="flex flex-col gap-3">
                    <Metadata
                        name={name}
                        kind={kind}
                        {...(mimeType === undefined ? {} : { mimeType })}
                        {...(size === undefined ? {} : { size })}
                    />
                    {url === undefined ? (
                        <p className="text-sm text-ink-muted">This file has no download link.</p>
                    ) : (
                        <a
                            href={url}
                            download={name}
                            aria-label={`Download ${name}`}
                            className={cn(
                                buttonVariants({ variant: "outline", size: "sm" }),
                                "self-start",
                            )}
                        >
                            <Download className="size-4" aria-hidden="true" />
                            Download
                        </a>
                    )}
                </div>
            ) : null}

            {kind === "image" || kind === "text" ? (
                <p className="text-xs text-ink-subtle">
                    {mimeType ?? kind}
                    {size === undefined ? "" : ` · ${formatFileSize(size)}`}
                </p>
            ) : null}
        </section>
    );
}
