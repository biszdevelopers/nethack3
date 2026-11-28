"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, ExternalLink, GitBranch } from "lucide-react";
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    Markdown,
} from "@nethack/ui";
import { gsap, useIsoLayoutEffect } from "@nethack/ui/motion";
import { safeExternalUrl, type ShowcaseProject } from "./showcase-data";
import styles from "./signal.module.css";

const DUPLICATE = 1;

export function SignalProjectMarquee({
    projects,
    label,
    reverse = false,
}: {
    readonly projects: readonly ShowcaseProject[];
    readonly label: string;
    readonly reverse?: boolean;
}): ReactNode {
    const shellRef = useRef<HTMLDivElement | null>(null);
    const trackRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState<ShowcaseProject | null>(null);

    useIsoLayoutEffect(() => {
        const shell = shellRef.current;
        const track = trackRef.current;
        if (shell === null || track === null) {
            return;
        }
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            return;
        }

        const tween = gsap.fromTo(
            track,
            { xPercent: reverse ? -50 : 0 },
            {
                xPercent: reverse ? 0 : -50,
                duration: 160,
                ease: "none",
                repeat: -1,
            },
        );

        const pause = () => tween.pause();
        const resume = () => tween.resume();
        shell.addEventListener("pointerenter", pause);
        shell.addEventListener("pointerleave", resume);
        shell.addEventListener("focusin", pause);
        shell.addEventListener("focusout", resume);

        return () => {
            shell.removeEventListener("pointerenter", pause);
            shell.removeEventListener("pointerleave", resume);
            shell.removeEventListener("focusin", pause);
            shell.removeEventListener("focusout", resume);
            tween.kill();
        };
    }, [reverse]);

    const openProject = (project: ShowcaseProject, trigger: HTMLButtonElement): void => {
        triggerRef.current = trigger;
        setSelected(project);
        setOpen(true);
    };

    const handleOpenChange = (next: boolean): void => {
        setOpen(next);
        if (!next) {
            window.setTimeout(() => triggerRef.current?.focus(), 0);
        }
    };

    const repository = selected === null ? null : safeExternalUrl(selected.repositoryUrl);
    const demo = selected === null ? null : safeExternalUrl(selected.demoUrl);

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <div
                ref={shellRef}
                className={`${styles.marqueeShell} rounded-lg border border-line bg-panel/40 py-3`}
                role="group"
                aria-label={label}
            >
                <div ref={trackRef} className={styles.marqueeTrack}>
                    {Array.from({ length: DUPLICATE + 1 }, (_, copy) => (
                        <div
                            key={copy}
                            className={`flex shrink-0 ${
                                copy === DUPLICATE ? styles.marqueeDuplicate : ""
                            }`}
                            aria-hidden={copy === DUPLICATE ? "true" : undefined}
                        >
                            {projects.map((project) => (
                                <button
                                    key={`${copy}-${project.id}`}
                                    type="button"
                                    tabIndex={copy === DUPLICATE ? -1 : undefined}
                                    onClick={(event) => openProject(project, event.currentTarget)}
                                    className="mx-2 flex w-[min(20rem,80vw)] shrink-0 select-none flex-col justify-between border border-line bg-panel p-5 text-left transition-colors hover:border-primary hover:bg-raised focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25"
                                >
                                    <span className="mb-4 block min-w-0">
                                        <span className="block truncate text-xs text-ink-subtle">
                                            {project.competitionName}
                                        </span>
                                        <span className="mt-2 line-clamp-2 block text-lg font-semibold tracking-tight text-ink">
                                            {project.title}
                                        </span>
                                        <span className="mt-2 line-clamp-3 block text-sm leading-6 text-ink-muted">
                                            {project.summary}
                                        </span>
                                    </span>
                                    <span className="flex items-center justify-between gap-3 text-xs text-ink-subtle">
                                        <span className="truncate">
                                            {project.teamName ?? "Independent project"}
                                        </span>
                                        <ArrowUpRight
                                            className="size-4 shrink-0 text-primary"
                                            aria-hidden="true"
                                        />
                                    </span>
                                </button>
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            <DialogContent className="max-w-2xl border-line bg-panel">
                {selected === null ? null : (
                    <>
                        <DialogHeader>
                            <DialogTitle className="text-2xl">{selected.title}</DialogTitle>
                            <DialogDescription>
                                {selected.teamName ?? "Independent project"} ·{" "}
                                {selected.competitionName}
                            </DialogDescription>
                        </DialogHeader>
                        <p className="text-sm leading-6 text-ink-muted">{selected.summary}</p>
                        {selected.descriptionMarkdown.length === 0 ? null : (
                            <div className="max-h-64 overflow-y-auto border-t border-line pt-3 text-sm leading-6 text-ink-muted">
                                <Markdown source={selected.descriptionMarkdown} />
                            </div>
                        )}
                        <div className="flex flex-wrap gap-3 pt-2">
                            <Button asChild variant="outline" size="sm">
                                <Link href={`/projects/${selected.slug}`}>
                                    Open project page
                                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                                </Link>
                            </Button>
                            {repository === null ? null : (
                                <Button asChild variant="subtle" color="neutral" size="sm">
                                    <a href={repository} target="_blank" rel="noopener noreferrer">
                                        <GitBranch className="size-3.5" aria-hidden="true" />
                                        Repository
                                        <span className="sr-only"> (opens in a new tab)</span>
                                    </a>
                                </Button>
                            )}
                            {demo === null ? null : (
                                <Button asChild variant="subtle" color="neutral" size="sm">
                                    <a href={demo} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="size-3.5" aria-hidden="true" />
                                        Live demo
                                        <span className="sr-only"> (opens in a new tab)</span>
                                    </a>
                                </Button>
                            )}
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
