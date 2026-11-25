import type { PointerEvent, ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "../../lib/cn.js";

export interface EditorDragHandleProps {
    readonly label?: string;
    readonly onPointerDown?: (event: PointerEvent<HTMLButtonElement>) => void;
    readonly disabled?: boolean;
    readonly className?: string;
}

export function EditorDragHandle({
    label = "Reorder item",
    onPointerDown,
    disabled = false,
    className,
}: EditorDragHandleProps): ReactNode {
    return (
        <button
            type="button"
            aria-label={label}
            disabled={disabled}
            onPointerDown={onPointerDown}
            data-slot="editor-drag-handle"
            className={cn(
                "inline-flex size-7 shrink-0 cursor-grab items-center justify-center rounded-sm text-ink-subtle",
                "transition-colors hover:bg-raised hover:text-ink active:cursor-grabbing",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                "disabled:pointer-events-none disabled:opacity-50",
                className,
            )}
        >
            <GripVertical className="size-4" aria-hidden="true" />
        </button>
    );
}
