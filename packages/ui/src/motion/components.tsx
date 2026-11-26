"use client";

import {
    useRef,
    type CSSProperties,
    type ReactNode,
} from "react";
import { cn } from "../lib/cn.js";
import { gsap, ScrollTrigger, prefersReducedMotion } from "./register.js";
import {
    useGsapCountUp,
    useGsapParallax,
    useGsapReveal,
    useGsapStagger,
    useGsapTextReveal,
    useIsoLayoutEffect,
} from "../hooks/use-gsap.js";

export interface RevealProps {
    readonly children: ReactNode;
    readonly className?: string;
    readonly delay?: number;
    readonly y?: number;
    readonly duration?: number;
    readonly once?: boolean;
    readonly style?: CSSProperties;
}

export function Reveal({
    children,
    className,
    delay = 0,
    y = 26,
    duration = 0.8,
    once = true,
    style,
}: RevealProps): ReactNode {
    const ref = useGsapReveal<HTMLDivElement>({ delay, y, duration, once });
    return (
        <div ref={ref} className={className} style={style} data-gsap="reveal">
            {children}
        </div>
    );
}

export function StaggerReveal({
    children,
    className,
    selector = ":scope > *",
    stagger = 0.08,
    delay = 0,
}: {
    readonly children: ReactNode;
    readonly className?: string;
    readonly selector?: string;
    readonly stagger?: number;
    readonly delay?: number;
}): ReactNode {
    const ref = useGsapStagger<HTMLDivElement>({
        selector,
        stagger,
        delay,
    });
    return (
        <div ref={ref} className={className} data-gsap="stagger">
            {children}
        </div>
    );
}

export function Parallax({
    children,
    className,
    strength = 60,
}: {
    readonly children: ReactNode;
    readonly className?: string;
    readonly strength?: number;
}): ReactNode {
    const ref = useGsapParallax<HTMLDivElement>(strength);
    return (
        <div ref={ref} className={className} data-gsap="parallax">
            {children}
        </div>
    );
}

export function SplitTextReveal({
    children,
    label,
    as = "h1",
    className,
}: {
    readonly children: ReactNode;
    readonly label: string;
    readonly as?: "h1" | "h2" | "h3" | "p" | "div";
    readonly className?: string;
}): ReactNode {
    const ref = useGsapTextReveal<HTMLSpanElement>();
    const Tag = as;
    return (
        <Tag className={className} data-gsap="split-text">
            <span className="sr-only">{label}</span>
            <span ref={ref} aria-hidden="true" className="inline-block">
                {children}
            </span>
        </Tag>
    );
}

export function Tilt({
    children,
    className,
    max = 6,
    scale = 1.01,
}: {
    readonly children: ReactNode;
    readonly className?: string;
    readonly max?: number;
    readonly scale?: number;
}): ReactNode {
    const ref = useRef<HTMLDivElement | null>(null);

    useIsoLayoutEffect(() => {
        const element = ref.current;
        if (
            element === null ||
            prefersReducedMotion() ||
            window.matchMedia("(hover: none)").matches
        ) {
            return;
        }
        const rotateX = gsap.quickTo(element, "rotationX", { duration: 0.4, ease: "power2.out" });
        const rotateY = gsap.quickTo(element, "rotationY", { duration: 0.4, ease: "power2.out" });
        const scaleTo = gsap.quickTo(element, "scale", { duration: 0.4, ease: "power2.out" });
        gsap.set(element, { transformPerspective: 900, transformStyle: "preserve-3d" });

        const onMove = (event: PointerEvent) => {
            const rect = element.getBoundingClientRect();
            const x = (event.clientX - rect.left) / rect.width - 0.5;
            const y = (event.clientY - rect.top) / rect.height - 0.5;
            rotateX(-y * max * 2);
            rotateY(x * max * 2);
            scaleTo(scale);
        };
        const onLeave = () => {
            rotateX(0);
            rotateY(0);
            scaleTo(1);
        };
        element.addEventListener("pointermove", onMove);
        element.addEventListener("pointerleave", onLeave);
        return () => {
            element.removeEventListener("pointermove", onMove);
            element.removeEventListener("pointerleave", onLeave);
            gsap.set(element, { clearProps: "transform" });
        };
    }, [max, scale]);

    return (
        <div ref={ref} className={cn("[will-change:transform]", className)}>
            {children}
        </div>
    );
}

export function Magnetic({
    children,
    className,
    strength = 10,
}: {
    readonly children: ReactNode;
    readonly className?: string;
    readonly strength?: number;
}): ReactNode {
    const ref = useRef<HTMLSpanElement | null>(null);

    useIsoLayoutEffect(() => {
        const element = ref.current;
        if (
            element === null ||
            prefersReducedMotion() ||
            window.matchMedia("(hover: none)").matches
        ) {
            return;
        }
        const xTo = gsap.quickTo(element, "x", { duration: 0.5, ease: "power3.out" });
        const yTo = gsap.quickTo(element, "y", { duration: 0.5, ease: "power3.out" });
        const onMove = (event: PointerEvent) => {
            const rect = element.getBoundingClientRect();
            xTo(((event.clientX - rect.left) / rect.width - 0.5) * strength * 2);
            yTo(((event.clientY - rect.top) / rect.height - 0.5) * strength * 2);
        };
        const onLeave = () => {
            xTo(0);
            yTo(0);
        };
        element.addEventListener("pointermove", onMove);
        element.addEventListener("pointerleave", onLeave);
        return () => {
            element.removeEventListener("pointermove", onMove);
            element.removeEventListener("pointerleave", onLeave);
            gsap.set(element, { clearProps: "transform" });
        };
    }, [strength]);

    return (
        <span ref={ref} className={cn("inline-block", className)}>
            {children}
        </span>
    );
}

export function CountUp({
    value,
    decimals = 0,
    className,
}: {
    readonly value: number;
    readonly decimals?: number;
    readonly className?: string;
}): ReactNode {
    const ref = useGsapCountUp<HTMLSpanElement>(value, { decimals });
    return (
        <span ref={ref} className={className} aria-label={value.toFixed(decimals)}>
            {value.toFixed(decimals)}
        </span>
    );
}

export function ScrollProgress(): ReactNode {
    const ref = useRef<HTMLDivElement | null>(null);

    useIsoLayoutEffect(() => {
        const element = ref.current;
        if (element === null || prefersReducedMotion()) {
            return;
        }
        const context = gsap.context(() => {
            gsap.fromTo(
                element,
                { scaleX: 0 },
                {
                    scaleX: 1,
                    ease: "none",
                    scrollTrigger: {
                        trigger: document.documentElement,
                        start: "top top",
                        end: "bottom bottom",
                        scrub: 0.3,
                    },
                },
            );
        }, element);
        return () => context.revert();
    }, []);

    return <div ref={ref} className="scroll-progress" aria-hidden="true" />;
}

export function MotionProvider({
    children,
    scrollProgress = true,
}: {
    readonly children: ReactNode;
    readonly scrollProgress?: boolean;
}): ReactNode {
    useIsoLayoutEffect(() => {
        let cancelled = false;
        const refresh = () => {
            if (!cancelled) {
                ScrollTrigger.refresh();
            }
        };
        if (typeof document !== "undefined" && "fonts" in document) {
            void document.fonts.ready.then(refresh);
        } else {
            refresh();
        }
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <>
            {scrollProgress ? <ScrollProgress /> : null}
            {children}
        </>
    );
}

export function PageTransition({
    routeKey,
    children,
    className,
}: {
    readonly routeKey: string;
    readonly children: ReactNode;
    readonly className?: string;
}): ReactNode {
    const ref = useRef<HTMLDivElement | null>(null);
    const previousKey = useRef(routeKey);

    useIsoLayoutEffect(() => {
        const element = ref.current;
        if (element === null || prefersReducedMotion()) {
            return;
        }
        const isNewRoute = previousKey.current !== routeKey;
        previousKey.current = routeKey;
        const context = gsap.context(() => {
            gsap.fromTo(
                element,
                { autoAlpha: 0, y: isNewRoute ? 16 : 8 },
                { autoAlpha: 1, y: 0, duration: 0.55, ease: "power3.out" },
            );
        }, element);
        return () => context.revert();
    }, [routeKey]);

    return (
        <div ref={ref} className={className} data-gsap="page">
            {children}
        </div>
    );
}

export function Pulse({
    children,
    className,
}: {
    readonly children: ReactNode;
    readonly className?: string;
}): ReactNode {
    const ref = useRef<HTMLDivElement | null>(null);
    useIsoLayoutEffect(() => {
        const element = ref.current;
        if (element === null || prefersReducedMotion()) {
            return;
        }
        const context = gsap.context(() => {
            gsap.to(element, {
                opacity: 0.55,
                duration: 2.2,
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut",
            });
        }, element);
        return () => context.revert();
    }, []);
    return (
        <div ref={ref} className={className}>
            {children}
        </div>
    );
}
