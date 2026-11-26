"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

if (typeof window !== "undefined") {
    gsap.registerPlugin(ScrollTrigger, SplitText);
    gsap.defaults({ ease: "power3.out", duration: 0.8 });
    ScrollTrigger.config({ ignoreMobileResize: true });
}

export { gsap, ScrollTrigger, SplitText };

export function prefersReducedMotion(): boolean {
    if (typeof window === "undefined") {
        return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
