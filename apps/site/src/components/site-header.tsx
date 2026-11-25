import type { ReactNode } from "react";
import Link from "next/link";

const NAVIGATION = [
    { href: "/competitions", label: "Competitions" },
    { href: "/projects", label: "Projects" },
    { href: "/announcements", label: "Announcements" },
    { href: "/about", label: "About" },
    { href: "/faq", label: "FAQ" },
] as const;

export function SiteHeader(): ReactNode {
    const workspaceOrigin = process.env.WORKSPACE_ORIGIN ?? "http://localhost:5173";
    return (
        <header className="border-b border-line">
            <a
                href="#main"
                className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-panel focus:px-3 focus:py-2 focus:text-sm"
            >
                Skip to content
            </a>
            <div className="mx-auto flex min-h-16 w-full max-w-[1280px] flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
                <Link href="/" className="text-sm font-semibold tracking-tight">
                    nethack
                </Link>
                <nav
                    aria-label="Main"
                    className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-2 text-sm"
                >
                    {NAVIGATION.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="text-ink-muted transition-colors hover:text-ink"
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>
                <a
                    href={`${workspaceOrigin}/sign-in`}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-line-strong px-3 text-xs font-medium text-ink transition-colors hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                    Open workspace
                </a>
            </div>
        </header>
    );
}
