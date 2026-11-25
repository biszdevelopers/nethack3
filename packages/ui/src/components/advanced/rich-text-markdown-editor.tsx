import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { Bold, Code, Italic, Link2, List } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { Label } from "../label.js";
import { Textarea } from "../textarea.js";
import { EditorToolbar, type EditorToolbarAction } from "./editor-toolbar.js";

export interface RichTextEditorProps {
    readonly value: string;
    readonly onChange: (value: string) => void;
    readonly label: string;
    readonly description?: string;
    readonly placeholder?: string;
    readonly disabled?: boolean;
    readonly maxLength?: number;
    readonly rows?: number;
    readonly className?: string;
}

interface PendingSelection {
    readonly start: number;
    readonly end: number;
}

export function RichTextEditor({
    value,
    onChange,
    label,
    description,
    placeholder,
    disabled = false,
    maxLength,
    rows = 10,
    className,
}: RichTextEditorProps): ReactNode {
    const fieldId = useId();
    const descriptionId = useId();
    const counterId = useId();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const pendingSelection = useRef<PendingSelection | null>(null);

    useLayoutEffect(() => {
        const selection = pendingSelection.current;
        const textarea = textareaRef.current;
        if (selection === null || textarea === null) {
            return;
        }
        pendingSelection.current = null;
        textarea.focus();
        textarea.setSelectionRange(selection.start, selection.end);
    });

    const applyChange = (next: string, selectionStart: number, selectionEnd: number): void => {
        const bounded = maxLength === undefined ? next : next.slice(0, maxLength);
        pendingSelection.current = {
            start: Math.min(selectionStart, bounded.length),
            end: Math.min(selectionEnd, bounded.length),
        };
        onChange(bounded);
    };

    const wrapSelection = (prefix: string, suffix: string, placeholderText: string): void => {
        const textarea = textareaRef.current;
        if (textarea === null) {
            return;
        }
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selected = value.slice(start, end);
        const inner = selected.length > 0 ? selected : placeholderText;
        const next = `${value.slice(0, start)}${prefix}${inner}${suffix}${value.slice(end)}`;
        applyChange(next, start + prefix.length, start + prefix.length + inner.length);
    };

    const prefixLines = (prefix: string): void => {
        const textarea = textareaRef.current;
        if (textarea === null) {
            return;
        }
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const lineStart = start === 0 ? 0 : value.lastIndexOf("\n", start - 1) + 1;
        const lineEndIndex = value.indexOf("\n", end);
        const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
        const block = value.slice(lineStart, lineEnd);
        const lines = block.split("\n");
        const allPrefixed = lines.every((line) => line.startsWith(prefix));
        const nextBlock = lines
            .map((line) =>
                allPrefixed
                    ? line.slice(prefix.length)
                    : line.startsWith(prefix)
                      ? line
                      : `${prefix}${line}`,
            )
            .join("\n");
        const next = `${value.slice(0, lineStart)}${nextBlock}${value.slice(lineEnd)}`;
        applyChange(next, lineStart, lineStart + nextBlock.length);
    };

    const actions: readonly EditorToolbarAction[] = [
        {
            id: "bold",
            label: "Bold",
            icon: <Bold className="size-3.5" />,
            onSelect: () => wrapSelection("**", "**", "bold text"),
            disabled,
        },
        {
            id: "italic",
            label: "Italic",
            icon: <Italic className="size-3.5" />,
            onSelect: () => wrapSelection("_", "_", "italic text"),
            disabled,
        },
        {
            id: "link",
            label: "Link",
            icon: <Link2 className="size-3.5" />,
            onSelect: () => wrapSelection("[", "](https://)", "link text"),
            disabled,
        },
        {
            id: "list",
            label: "Bulleted list",
            icon: <List className="size-3.5" />,
            onSelect: () => prefixLines("- "),
            disabled,
        },
        {
            id: "code",
            label: "Inline code",
            icon: <Code className="size-3.5" />,
            onSelect: () => wrapSelection("`", "`", "code"),
            disabled,
        },
    ];

    const describedBy = [description === undefined ? null : descriptionId, counterId]
        .filter((id): id is string => id !== null)
        .join(" ");

    return (
        <div className={cn("flex flex-col gap-1.5", className)} data-slot="rich-text-editor">
            <Label htmlFor={fieldId}>{label}</Label>
            {description === undefined ? null : (
                <p id={descriptionId} className="text-xs text-ink-muted">
                    {description}
                </p>
            )}
            <div>
                <EditorToolbar actions={actions} label={`${label} formatting`} />
                <Textarea
                    ref={textareaRef}
                    id={fieldId}
                    value={value}
                    onChange={(event) => onChange(event.currentTarget.value)}
                    placeholder={placeholder}
                    disabled={disabled}
                    rows={rows}
                    maxLength={maxLength}
                    aria-describedby={describedBy}
                    className="min-h-0 rounded-t-none"
                />
            </div>
            <p id={counterId} className="text-right text-xs tabular-nums text-ink-subtle">
                {value.length}
                {maxLength === undefined ? "" : ` / ${maxLength}`} characters
            </p>
        </div>
    );
}
