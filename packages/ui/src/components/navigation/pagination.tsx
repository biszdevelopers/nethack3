import { type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { Button } from "../button.js";

type PageItem = number | "ellipsis";

function buildPageItems(current: number, pageCount: number, siblingCount: number): PageItem[] {
    const totalVisible = siblingCount * 2 + 5;
    if (pageCount <= totalVisible) {
        return Array.from({ length: pageCount }, (_, index) => index + 1);
    }
    const left = Math.max(current - siblingCount, 1);
    const right = Math.min(current + siblingCount, pageCount);
    const showLeft = left > 2;
    const showRight = right < pageCount - 1;
    if (!showLeft) {
        const count = 3 + siblingCount * 2;
        return [...Array.from({ length: count }, (_, index) => index + 1), "ellipsis", pageCount];
    }
    if (!showRight) {
        const start = pageCount - (2 + siblingCount * 2);
        return [
            1,
            "ellipsis",
            ...Array.from({ length: pageCount - start + 1 }, (_, index) => start + index),
        ];
    }
    return [
        1,
        "ellipsis",
        ...Array.from({ length: right - left + 1 }, (_, index) => left + index),
        "ellipsis",
        pageCount,
    ];
}

export interface PaginationProps {
    readonly page: number;
    readonly pageCount: number;
    readonly onPageChange: (page: number) => void;
    readonly siblingCount?: number;
    readonly label?: string;
    readonly className?: string;
}

export function Pagination({
    page,
    pageCount,
    onPageChange,
    siblingCount = 1,
    label = "Pagination",
    className,
}: PaginationProps): ReactNode {
    if (pageCount <= 1) {
        return null;
    }
    const current = Math.min(Math.max(page, 1), pageCount);
    const items = buildPageItems(current, pageCount, siblingCount);
    return (
        <nav
            data-slot="pagination"
            aria-label={label}
            className={cn("flex flex-wrap items-center gap-1", className)}
        >
            <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Previous page"
                disabled={current === 1}
                onClick={() => onPageChange(current - 1)}
            >
                <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            {items.map((item, index) =>
                item === "ellipsis" ? (
                    <span
                        key={`ellipsis-${String(index)}`}
                        aria-hidden="true"
                        className="px-1 text-sm text-ink-subtle"
                    >
                        ...
                    </span>
                ) : (
                    <Button
                        key={item}
                        type="button"
                        variant={item === current ? "outline" : "ghost"}
                        size="sm"
                        aria-label={
                            item === current
                                ? `Page ${String(item)}, current page`
                                : `Page ${String(item)}`
                        }
                        aria-current={item === current ? "page" : undefined}
                        className={cn(
                            "min-w-9 px-2",
                            item === current && "border-primary text-primary",
                        )}
                        onClick={() => {
                            if (item !== current) {
                                onPageChange(item);
                            }
                        }}
                    >
                        {item}
                    </Button>
                ),
            )}
            <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Next page"
                disabled={current === pageCount}
                onClick={() => onPageChange(current + 1)}
            >
                <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
        </nav>
    );
}

export interface PaginationControlsProps {
    readonly canNext: boolean;
    readonly onNext: () => void;
    readonly onPrevious: () => void;
    readonly canPrevious?: boolean;
    readonly previousLabel?: string;
    readonly nextLabel?: string;
    readonly label?: string;
    readonly className?: string;
}

export function PaginationControls({
    canNext,
    onNext,
    onPrevious,
    canPrevious = true,
    previousLabel = "Previous",
    nextLabel = "Next",
    label = "Pagination",
    className,
}: PaginationControlsProps): ReactNode {
    return (
        <nav
            data-slot="pagination-controls"
            aria-label={label}
            className={cn("flex items-center gap-2", className)}
        >
            <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canPrevious}
                onClick={onPrevious}
            >
                <ChevronLeft className="size-4" aria-hidden="true" />
                {previousLabel}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={!canNext} onClick={onNext}>
                {nextLabel}
                <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
        </nav>
    );
}
