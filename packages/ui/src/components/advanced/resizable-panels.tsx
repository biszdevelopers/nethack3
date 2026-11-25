import {
    useRef,
    type KeyboardEvent,
    type PointerEvent as ReactPointerEvent,
    type ReactNode,
} from "react";
import { cn } from "../../lib/cn.js";
import { EmptyState } from "../empty-state.js";

export type ResizablePanelsOrientation = "horizontal" | "vertical";

export interface ResizablePanel {
    readonly id: string;
    readonly label?: string;
    readonly content: ReactNode;
}

export interface ResizablePanelsProps {
    readonly panels: readonly ResizablePanel[];
    /** Percentages of the container, one per panel; expected to sum to 100. */
    readonly sizes: readonly number[];
    readonly onSizesChange: (sizes: number[]) => void;
    /** Minimum percentage for each panel. */
    readonly minSizes: readonly number[];
    readonly orientation?: ResizablePanelsOrientation;
    readonly label?: string;
    readonly className?: string;
}

interface DragState {
    readonly index: number;
    readonly start: number;
    readonly sizes: readonly number[];
}

const KEYBOARD_STEP = 2;

export function ResizablePanels({
    panels,
    sizes,
    onSizesChange,
    minSizes,
    orientation = "horizontal",
    label = "Resizable panels",
    className,
}: ResizablePanelsProps): ReactNode {
    const containerRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<DragState | null>(null);

    if (panels.length === 0) {
        return (
            <EmptyState
                title="No panels"
                description="Provide at least one panel to display this layout."
                className={className ?? ""}
            />
        );
    }

    const isHorizontal = orientation === "horizontal";

    const coordinate = (event: ReactPointerEvent<HTMLButtonElement>): number =>
        isHorizontal ? event.clientX : event.clientY;

    const resizePair = (index: number, startSizes: readonly number[], delta: number): void => {
        const currentA = startSizes[index];
        const currentB = startSizes[index + 1];
        if (currentA === undefined || currentB === undefined) {
            return;
        }
        const pair = currentA + currentB;
        const minA = minSizes[index] ?? 0;
        const minB = minSizes[index + 1] ?? 0;
        const nextA = Math.min(Math.max(currentA + delta, minA), pair - minB);
        const next = [...startSizes];
        next[index] = nextA;
        next[index + 1] = pair - nextA;
        onSizesChange(next);
    };

    const handlePointerDown = (
        index: number,
        event: ReactPointerEvent<HTMLButtonElement>,
    ): void => {
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { index, start: coordinate(event), sizes: [...sizes] };
        event.preventDefault();
    };

    const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>): void => {
        const drag = dragRef.current;
        const container = containerRef.current;
        if (drag === null || container === null) {
            return;
        }
        const bounds = container.getBoundingClientRect();
        const totalPx = isHorizontal ? bounds.width : bounds.height;
        if (totalPx <= 0) {
            return;
        }
        const deltaPercent = ((coordinate(event) - drag.start) / totalPx) * 100;
        resizePair(drag.index, drag.sizes, deltaPercent);
    };

    const handlePointerEnd = (event: ReactPointerEvent<HTMLButtonElement>): void => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        dragRef.current = null;
    };

    const handleKeyDown = (index: number, event: KeyboardEvent<HTMLButtonElement>): void => {
        const currentA = sizes[index];
        const currentB = sizes[index + 1];
        if (currentA === undefined || currentB === undefined) {
            return;
        }
        const decreaseKey = isHorizontal ? "ArrowLeft" : "ArrowUp";
        const increaseKey = isHorizontal ? "ArrowRight" : "ArrowDown";
        const pair = currentA + currentB;
        const minA = minSizes[index] ?? 0;
        const minB = minSizes[index + 1] ?? 0;
        if (event.key === decreaseKey) {
            event.preventDefault();
            resizePair(index, sizes, -KEYBOARD_STEP);
        } else if (event.key === increaseKey) {
            event.preventDefault();
            resizePair(index, sizes, KEYBOARD_STEP);
        } else if (event.key === "Home") {
            event.preventDefault();
            resizePair(index, sizes, minA - currentA);
        } else if (event.key === "End") {
            event.preventDefault();
            resizePair(index, sizes, pair - minB - currentA);
        }
    };

    return (
        <section
            ref={containerRef}
            aria-label={label}
            data-slot="resizable-panels"
            className={cn(
                "flex overflow-hidden rounded-md border border-line",
                isHorizontal ? "flex-row" : "flex-col",
                className,
            )}
        >
            {panels.map((panel, index) => {
                const size = sizes[index] ?? 100 / panels.length;
                const nextPanel = panels[index + 1];
                return (
                    <div key={panel.id} className="contents">
                        <div
                            style={{
                                flexBasis: `${size}%`,
                                flexGrow: 0,
                                flexShrink: 0,
                                minWidth: 0,
                                minHeight: 0,
                            }}
                            className="overflow-auto"
                        >
                            {panel.content}
                        </div>
                        {nextPanel === undefined ? null : (
                            <button
                                type="button"
                                aria-label={`Resize ${panel.label ?? panel.id} and ${nextPanel.label ?? nextPanel.id}`}
                                onPointerDown={(event) => handlePointerDown(index, event)}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerEnd}
                                onPointerCancel={handlePointerEnd}
                                onKeyDown={(event) => handleKeyDown(index, event)}
                                className={cn(
                                    "relative z-10 m-0 shrink-0 touch-none border-0 bg-transparent p-0",
                                    "after:absolute after:bg-line hover:after:bg-line-strong",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
                                    isHorizontal
                                        ? "w-2 cursor-col-resize after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2"
                                        : "h-2 w-full cursor-row-resize after:inset-x-0 after:top-1/2 after:h-px after:-translate-y-1/2",
                                )}
                            />
                        )}
                    </div>
                );
            })}
        </section>
    );
}
