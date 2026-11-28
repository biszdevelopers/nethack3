import { useState, type ReactNode } from "react";
import { Button, Input } from "@nethack/ui";

export function InviteLink({ path }: { readonly path: string }): ReactNode {
    const [copied, setCopied] = useState(false);
    const url = new URL(path, window.location.origin).toString();

    const copy = async (): Promise<void> => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
        } catch {
            setCopied(false);
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <Input
                readOnly
                value={url}
                aria-label="Invitation link"
                onFocus={(event) => {
                    event.currentTarget.select();
                }}
            />
            <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
                    Copy link
                </Button>
                {copied ? (
                    <span role="status" className="text-xs text-ink-muted">
                        Copied to clipboard.
                    </span>
                ) : null}
            </div>
        </div>
    );
}
