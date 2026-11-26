"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../lib/cn.js";
import { gsap, prefersReducedMotion } from "./register.js";
import { useIsoLayoutEffect } from "../hooks/use-gsap.js";

export interface AnimatedDisclosureProps {
    readonly title: ReactNode;
    readonly children: ReactNode;
    readonly defaultOpen?: boolean;
    readonly className?: string;
    readonly triggerClassName?: string;
    readonly contentClassName?: string;
    readonly icon?: ReactNode;
}

/**
 * Accessible disclosure with a GSAP height transition. The trigger is a real
 * button with aria-expanded/aria-controls; content remains in the DOM for
 * assistive technology only while open. Reduced motion switches instantly.
 */
export function AnimatedDisclosure({
    title,
    children,
    defaultOpen = false,
    className,
    triggerClassName,
    contentClassName,
    icon,
}: AnimatedDisclosureProps): ReactNode {
    const [open, setOpen] = useState(defaultOpen);
    const contentRef = useRef<HTMLDivElement | null>(null);
    const id = useId();

    useIsoLayoutEffect(() => {
        const element = contentRef.current;
        if (element === null) {
            return;
        }
        if (prefersReducedMotion()) {
            element.style.height = open ? "auto" : "0px";
            element.style.visibility = open ? "visible" : "hidden";
            return;
        }
        const context = gsap.context(() => {
            if (open) {
                element.style.visibility = "visible";
                gsap.fromTo(
                    element,
                    { height: 0, autoAlpha: 0 },
                    {
                        height: "auto",
                        autoAlpha: 1,
                        duration: 0.38,
                        ease: "power2.out",
                        onComplete: () => {
                            element.style.height = "auto";
                        },
                    },
                );
            } else {
                gsap.to(element, {
                    height: 0,
                    autoAlpha: 0,
                    duration: 0.28,
                    ease: "power2.in",
                    onComplete: () => {
                        element.style.visibility = "hidden";
                    },
                });
            }
        }, element);
        return () => context.revert();
    }, [open]);

    return (
        <div className={cn("rounded-lg border border-line bg-panel/60", className)}>
            <button
                type="button"
                aria-expanded={open}
                aria-controls={id}
                onClick={() => setOpen((value) => !value)}
                className={cn(
                    "flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-sm font-medium",
                    "rounded-lg transition-colors hover:bg-raised/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25",
                    triggerClassName,
                )}
            >
                <span className="flex min-w-0 items-center gap-2">
                    {icon}
                    <span className="truncate">{title}</span>
                </span>
                <ChevronDown
                    className={cn(
                        "size-4 shrink-0 text-ink-subtle transition-transform duration-200",
                        open ? "rotate-180 text-primary" : "",
                    )}
                    aria-hidden="true"
                />
            </button>
            <div
                id={id}
                ref={contentRef}
                role="region"
                style={{
                    height: defaultOpen ? "auto" : 0,
                    visibility: defaultOpen ? "visible" : "hidden",
                    overflow: "hidden",
                }}
            >
                <div className={cn("border-t border-line px-5 py-4", contentClassName)}>
                    {children}
                </div>
            </div>
        </div>
    );
}
