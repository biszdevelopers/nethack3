import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface EditorToolbarAction {
    readonly id: string;
    readonly label: string;
    readonly icon?: ReactNode;
    readonly onSelect: () => void;
    readonly disabled?: boolean;
    readonly pressed?: boolean;
}

export interface EditorToolbarProps {
    readonly actions: readonly EditorToolbarAction[];
    readonly label?: string;
    readonly className?: string;
}

export function EditorToolbar({
    actions,
    label = "Formatting",
    className,
}: EditorToolbarProps): ReactNode {
    const toolbarRef = useRef<HTMLDivElement>(null);

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
        if (
            event.key !== "ArrowLeft" &&
            event.key !== "ArrowRight" &&
            event.key !== "Home" &&
            event.key !== "End"
        ) {
            return;
        }
        const toolbar = toolbarRef.current;
        if (toolbar === null) {
            return;
        }
        const buttons = Array.from(
            toolbar.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
        );
        const active = document.activeElement;
        const currentIndex = active instanceof HTMLButtonElement ? buttons.indexOf(active) : -1;
        if (currentIndex === -1) {
            return;
        }
        event.preventDefault();
        const nextIndex =
            event.key === "Home"
                ? 0
                : event.key === "End"
                  ? buttons.length - 1
                  : event.key === "ArrowRight"
                    ? (currentIndex + 1) % buttons.length
                    : (currentIndex - 1 + buttons.length) % buttons.length;
        buttons[nextIndex]?.focus();
    };

    return (
        <div
            ref={toolbarRef}
            role="toolbar"
            aria-label={label}
            tabIndex={-1}
            data-slot="editor-toolbar"
            onKeyDown={handleKeyDown}
            className={cn(
                "flex flex-wrap items-center gap-1 rounded-t-md border border-b-0 border-line bg-raised p-1",
                className,
            )}
        >
            {actions.map((action) => (
                <button
                    key={action.id}
                    type="button"
                    aria-label={action.label}
                    title={action.label}
                    aria-pressed={action.pressed}
                    disabled={action.disabled}
                    onClick={action.onSelect}
                    className={cn(
                        "inline-flex h-8 items-center gap-1 rounded-sm px-2 text-xs text-ink-muted transition-colors",
                        "hover:bg-panel hover:text-ink",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        "disabled:pointer-events-none disabled:opacity-50",
                        action.pressed === true && "bg-panel text-ink",
                    )}
                >
                    {action.icon === undefined ? null : (
                        <span aria-hidden="true" className="inline-flex">
                            {action.icon}
                        </span>
                    )}
                    {action.icon === undefined ? action.label : null}
                </button>
            ))}
        </div>
    );
}
