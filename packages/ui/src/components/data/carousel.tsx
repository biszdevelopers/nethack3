import { type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { useControllableState } from "../../hooks/state.js";
import { EmptyState } from "../empty-state.js";

export interface CarouselSlide {
    readonly id: string;
    readonly label: string;
    readonly content: ReactNode;
}

export interface CarouselProps {
    readonly slides: readonly CarouselSlide[];
    readonly label: string;
    readonly index?: number;
    readonly defaultIndex?: number;
    readonly onIndexChange?: (index: number) => void;
    readonly className?: string;
}

export function Carousel({
    slides,
    label,
    index,
    defaultIndex = 0,
    onIndexChange,
    className,
}: CarouselProps): ReactNode {
    const [requestedIndex, setIndex] = useControllableState({
        value: index,
        defaultValue: defaultIndex,
        ...(onIndexChange === undefined ? {} : { onChange: onIndexChange }),
    });

    if (slides.length === 0) {
        return (
            <EmptyState
                title="No slides"
                description="Provide at least one slide to display the carousel."
                className={className ?? ""}
            />
        );
    }

    const activeIndex = Math.min(Math.max(requestedIndex, 0), slides.length - 1);
    const activeSlide = slides[activeIndex];

    const goTo = (next: number): void => {
        const count = slides.length;
        setIndex(((next % count) + count) % count);
    };

    return (
        <section
            aria-roledescription="carousel"
            aria-label={label}
            data-slot="carousel"
            className={cn("overflow-hidden rounded-lg border border-line bg-panel", className)}
        >
            <section
                aria-roledescription="slide"
                aria-label={
                    activeSlide === undefined
                        ? undefined
                        : `${activeSlide.label} (${activeIndex + 1} of ${slides.length})`
                }
                aria-live="polite"
                className="min-h-24 p-4"
            >
                {activeSlide?.content}
            </section>
            <div className="flex items-center justify-between gap-2 border-t border-line px-2 py-2">
                <button
                    type="button"
                    aria-label="Previous slide"
                    onClick={() => goTo(activeIndex - 1)}
                    className="inline-flex size-10 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50"
                >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                </button>
                <fieldset className="m-0 flex items-center gap-1 border-0 p-0">
                    <legend className="sr-only">Slide indicators</legend>
                    {slides.map((slide, slideIndex) => (
                        <button
                            key={slide.id}
                            type="button"
                            aria-label={`Go to slide ${slideIndex + 1}: ${slide.label}`}
                            aria-current={slideIndex === activeIndex ? "true" : undefined}
                            onClick={() => setIndex(slideIndex)}
                            className="rounded-sm p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                            <span
                                aria-hidden="true"
                                className={cn(
                                    "block h-1.5 w-6 rounded-sm transition-colors",
                                    slideIndex === activeIndex
                                        ? "bg-primary"
                                        : "bg-line-strong hover:bg-ink-subtle",
                                )}
                            />
                        </button>
                    ))}
                </fieldset>
                <button
                    type="button"
                    aria-label="Next slide"
                    onClick={() => goTo(activeIndex + 1)}
                    className="inline-flex size-10 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50"
                >
                    <ChevronRight className="size-4" aria-hidden="true" />
                </button>
            </div>
        </section>
    );
}
