"use client";

import { useEffect, useState, type ReactNode } from "react";

function parts(milliseconds: number): string {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const days = Math.floor(totalSeconds / 86_400);
    const hours = Math.floor((totalSeconds % 86_400) / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;
    if (days > 0) {
        return `${String(days)}d ${String(hours)}h ${String(minutes)}m`;
    }
    if (hours > 0) {
        return `${String(hours)}h ${String(minutes)}m ${String(seconds)}s`;
    }
    return `${String(minutes)}m ${String(seconds)}s`;
}

export function Countdown({ target }: { readonly target: string }): ReactNode {
    const [remaining, setRemaining] = useState<number | null>(null);

    useEffect(() => {
        const update = (): void => {
            setRemaining(new Date(target).getTime() - Date.now());
        };
        update();
        const timer = window.setInterval(update, 1_000);
        return () => window.clearInterval(timer);
    }, [target]);

    if (remaining === null || remaining <= 0) {
        return null;
    }
    return <span className="tabular-nums">{parts(remaining)}</span>;
}
