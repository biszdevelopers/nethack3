import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Layers, TerminalSquare } from "lucide-react";
import { Reveal } from "@nethack/ui/motion";

const COPYRIGHT_YEAR = new Date().getFullYear();

export function SiteFooter(): ReactNode {
    const workspaceOrigin = process.env.WORKSPACE_ORIGIN ?? "http://localhost:5173";
    return (
        <footer className="border-t border-line bg-panel/40">
            <Reveal className="mx-auto grid w-full max-w-[1280px] gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-8">
                <div className="flex flex-col gap-3">
                    <Link
                        href="/"
                        className="flex items-center gap-2 text-lg font-extrabold tracking-tight"
                    >
                        <TerminalSquare className="size-4 text-primary" aria-hidden="true" />
                        <span className="text-primary">nethack</span>
                    </Link>
                    <p className="max-w-sm text-sm text-ink-muted">
                        Competition infrastructure for organizers and participants. Rules,
                        registration, teams, submissions, judging, and results in one place.
                    </p>
                    <p className="text-xs text-ink-subtle">
                        © {COPYRIGHT_YEAR} nethack. All rights reserved.
                    </p>
                </div>

                <nav aria-label="Footer" className="flex flex-col gap-2 text-sm">
                    <p className="text-xs text-ink-subtle">Explore</p>
                    <Link
                        href="/competitions"
                        className="text-ink-muted transition-colors hover:text-primary"
                    >
                        Competitions
                    </Link>
                    <Link
                        href="/projects"
                        className="text-ink-muted transition-colors hover:text-primary"
                    >
                        Showcase
                    </Link>
                    <Link
                        href="/announcements"
                        className="text-ink-muted transition-colors hover:text-primary"
                    >
                        Announcements
                    </Link>
                    <Link
                        href="/past"
                        className="text-ink-muted transition-colors hover:text-primary"
                    >
                        Seasons archive
                    </Link>
                    <Link
                        href="/results"
                        className="text-ink-muted transition-colors hover:text-primary"
                    >
                        Results
                    </Link>
                    <Link
                        href="/about"
                        className="text-ink-muted transition-colors hover:text-primary"
                    >
                        About
                    </Link>
                    <Link
                        href="/faq"
                        className="text-ink-muted transition-colors hover:text-primary"
                    >
                        FAQ
                    </Link>
                </nav>

                <nav aria-label="Support" className="flex flex-col gap-2 text-sm">
                    <p className="text-xs text-ink-subtle">Support</p>
                    <Link
                        href="/contact"
                        className="text-ink-muted transition-colors hover:text-primary"
                    >
                        Contact
                    </Link>
                    <Link
                        href="/contributing"
                        className="text-ink-muted transition-colors hover:text-primary"
                    >
                        Contributing
                    </Link>
                </nav>

                <div className="flex flex-col gap-2 text-sm">
                    <p className="text-xs text-ink-subtle">Participate</p>
                    <a
                        href={`${workspaceOrigin}/sign-in`}
                        className="inline-flex items-center gap-1.5 text-primary transition-colors hover:text-primary-hover"
                    >
                        Open workspace
                        <ArrowUpRight className="size-3" aria-hidden="true" />
                    </a>
                    <a
                        href={`${workspaceOrigin}/sign-in`}
                        className="inline-flex items-center gap-1.5 text-ink-muted transition-colors hover:text-primary"
                    >
                        Sign in with Basis Auth
                        <ArrowUpRight className="size-3" aria-hidden="true" />
                    </a>
                    <span className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-subtle">
                        <Layers className="size-3" aria-hidden="true" />
                        Built on a capability architecture
                    </span>
                </div>
            </Reveal>
        </footer>
    );
}
