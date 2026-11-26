"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { gsap, prefersReducedMotion } from "../motion/register.js";

export const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export interface RevealOptions {
    readonly y?: number;
    readonly x?: number;
    readonly delay?: number;
    readonly duration?: number;
    readonly start?: string;
    readonly once?: boolean;
    readonly scale?: number;
}

export function useGsapReveal<T extends HTMLElement>(
    options: RevealOptions = {},
): RefObject<T | null> {
    const ref = useRef<T | null>(null);
    const {
        y = 24,
        x = 0,
        delay = 0,
        duration = 0.8,
        start = "top 88%",
        once = true,
        scale = 1,
    } = options;

    useIsoLayoutEffect(() => {
        const element = ref.current;
        if (element === null || prefersReducedMotion()) {
            return;
        }
        const context = gsap.context(() => {
            gsap.fromTo(
                element,
                { autoAlpha: 0, y, x, scale },
                {
                    autoAlpha: 1,
                    y: 0,
                    x: 0,
                    scale: 1,
                    duration,
                    delay,
                    ease: "power3.out",
                    scrollTrigger: { trigger: element, start, once },
                },
            );
        }, element);
        return () => context.revert();
    }, [y, x, delay, duration, start, once, scale]);

    return ref;
}

export function useGsapStagger<T extends HTMLElement>(
    options: {
        readonly selector?: string;
        readonly y?: number;
        readonly stagger?: number;
        readonly delay?: number;
        readonly duration?: number;
        readonly start?: string;
    } = {},
): RefObject<T | null> {
    const ref = useRef<T | null>(null);
    const {
        selector = ":scope > *",
        y = 22,
        stagger = 0.08,
        delay = 0,
        duration = 0.7,
        start = "top 85%",
    } = options;

    useIsoLayoutEffect(() => {
        const element = ref.current;
        if (element === null || prefersReducedMotion()) {
            return;
        }
        const targets = Array.from(element.querySelectorAll<HTMLElement>(selector));
        if (targets.length === 0) {
            return;
        }
        const context = gsap.context(() => {
            gsap.fromTo(
                targets,
                { autoAlpha: 0, y },
                {
                    autoAlpha: 1,
                    y: 0,
                    duration,
                    delay,
                    stagger,
                    ease: "power3.out",
                    scrollTrigger: { trigger: element, start, once: true },
                },
            );
        }, element);
        return () => context.revert();
    }, [selector, y, stagger, delay, duration, start]);

    return ref;
}

export function useGsapParallax<T extends HTMLElement>(strength = 60): RefObject<T | null> {
    const ref = useRef<T | null>(null);
    useIsoLayoutEffect(() => {
        const element = ref.current;
        if (element === null || prefersReducedMotion()) {
            return;
        }
        const context = gsap.context(() => {
            gsap.to(element, {
                yPercent: -strength / 10,
                ease: "none",
                scrollTrigger: {
                    trigger: element,
                    start: "top bottom",
                    end: "bottom top",
                    scrub: 0.6,
                },
            });
        }, element);
        return () => context.revert();
    }, [strength]);
    return ref;
}

export function useGsapTextReveal<T extends HTMLElement>(): RefObject<T | null> {
    const ref = useRef<T | null>(null);
    useIsoLayoutEffect(() => {
        const element = ref.current;
        if (element === null || prefersReducedMotion()) {
            return;
        }
        let split: InstanceType<typeof SplitText> | null = null;
        const context = gsap.context(() => {
            split = SplitText.create(element, { type: "chars,words", charsClass: "split-char" });
            gsap.fromTo(
                split.chars,
                { autoAlpha: 0, yPercent: 60, rotateX: -30 },
                {
                    autoAlpha: 1,
                    yPercent: 0,
                    rotateX: 0,
                    duration: 0.65,
                    stagger: 0.022,
                    ease: "power3.out",
                    delay: 0.05,
                },
            );
        }, element);
        return () => {
            context.revert();
            split?.revert();
        };
    }, []);
    return ref;
}

export function useGsapCountUp<T extends HTMLElement>(
    value: number,
    options: { readonly decimals?: number; readonly duration?: number } = {},
): RefObject<T | null> {
    const ref = useRef<T | null>(null);
    const { decimals = 0, duration = 1.4 } = options;
    useIsoLayoutEffect(() => {
        const element = ref.current;
        if (element === null) {
            return;
        }
        if (prefersReducedMotion()) {
            element.textContent = value.toFixed(decimals);
            return;
        }
        const state = { value: 0 };
        const context = gsap.context(() => {
            gsap.to(state, {
                value,
                duration,
                ease: "power2.out",
                scrollTrigger: { trigger: element, start: "top 92%", once: true },
                onUpdate: () => {
                    element.textContent = state.value.toFixed(decimals);
                },
            });
        }, element);
        return () => context.revert();
    }, [value, decimals, duration]);
    return ref;
}
