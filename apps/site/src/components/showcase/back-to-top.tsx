"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@nethack/ui";

export function BackToTop(): ReactNode {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const onScroll = () => {
            setVisible(window.scrollY > window.innerHeight);
        };
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <Button
            type="button"
            variant="outline"
            color="neutral"
            size="icon"
            aria-label="Back to top"
            aria-hidden={visible ? undefined : "true"}
            tabIndex={visible ? undefined : -1}
            className={`fixed bottom-4 right-4 z-40 bg-app/90 transition-opacity ${
                visible ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            onClick={() => {
                const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
            }}
        >
            <ArrowUp className="size-4" aria-hidden="true" />
        </Button>
    );
}
