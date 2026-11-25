import type { ReactNode } from "react";
import Link from "next/link";

export function SiteFooter(): ReactNode {
    const workspaceOrigin = process.env.WORKSPACE_ORIGIN ?? "http://localhost:5173";
    return (
        <footer className="border-t border-line">
            <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-6 py-8 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold">nethack</span>
                    <span className="text-xs text-ink-subtle">
                        Competition infrastructure for organizers and participants.
                    </span>
                </div>
                <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
                    <Link
                        href="/competitions"
                        className="text-ink-muted transition-colors hover:text-ink"
                    >
                        Competitions
                    </Link>
                    <Link href="/projects" className="text-ink-muted transition-colors hover:text-ink">
                        Projects
                    </Link>
                    <Link href="/about" className="text-ink-muted transition-colors hover:text-ink">
                        About
                    </Link>
                    <Link href="/faq" className="text-ink-muted transition-colors hover:text-ink">
                        FAQ
                    </Link>
                    <a
                        href={`${workspaceOrigin}/sign-in`}
                        className="text-ink-muted transition-colors hover:text-ink"
                    >
                        Workspace
                    </a>
                </nav>
            </div>
        </footer>
    );
}
