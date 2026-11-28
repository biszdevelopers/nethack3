"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Award, ExternalLink, FileCheck, GitBranch, Video } from "lucide-react";
import {
    Badge,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    Markdown,
} from "@nethack/ui";
import { gsap, useIsoLayoutEffect } from "@nethack/ui/motion";
import { AI_DISCLOSURE_EMPTY, safeExternalUrl, type ShowcaseProject } from "./showcase-data";
import styles from "./signal.module.css";

const DUPLICATE = 3;

function disclosureText(project: ShowcaseProject): string {
    return project.aiDisclosure.trim().length === 0 ? AI_DISCLOSURE_EMPTY : project.aiDisclosure;
}

function ResultBadges({
    project,
    size = "sm",
}: {
    readonly project: ShowcaseProject;
    readonly size?: "xs" | "sm";
}): ReactNode {
    if ((!project.showRanking || project.rank === null) && project.awards.length === 0) {
        return null;
    }
    return (
        <div className="flex flex-wrap gap-1.5">
            {project.showRanking && project.rank !== null ? (
                <Badge variant="soft" color="primary" size={size}>
                    Rank #{project.rank}
                </Badge>
            ) : null}
            {project.awards.map((award) => (
                <Badge key={award.id} variant="outline" color="neutral" size={size}>
                    <Award className="size-3" aria-hidden="true" />
                    {award.name}
                </Badge>
            ))}
        </div>
    );
}

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
    const video = selected === null ? null : safeExternalUrl(selected.videoUrl);

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
                            {projects.map((project) => {
                                const projectVideo = safeExternalUrl(project.videoUrl);
                                return (
                                    <div
                                        key={`${copy}-${project.id}`}
                                        className="mx-2 flex w-[min(22rem,85vw)] shrink-0 flex-col border border-line bg-panel transition-colors hover:border-primary focus-within:border-primary"
                                    >
                                        <button
                                            type="button"
                                            tabIndex={copy === DUPLICATE ? -1 : undefined}
                                            onClick={(event) =>
                                                openProject(project, event.currentTarget)
                                            }
                                            className="flex flex-1 select-none flex-col p-5 text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25"
                                        >
                                            <span className="mb-4 flex flex-wrap items-center gap-1.5">
                                                {project.showRanking && project.rank !== null ? (
                                                    <span className="inline-flex items-center border border-primary/40 px-1.5 py-0 text-[11px] font-medium text-primary">
                                                        Rank #{project.rank}
                                                    </span>
                                                ) : null}
                                                {project.awards.map((award) => (
                                                    <span
                                                        key={award.id}
                                                        className="inline-flex items-center gap-1 border border-line-strong px-1.5 py-0 text-[11px] text-ink-muted"
                                                    >
                                                        <Award
                                                            className="size-3"
                                                            aria-hidden="true"
                                                        />
                                                        {award.name}
                                                    </span>
                                                ))}
                                            </span>
                                            <span className="block min-w-0">
                                                <span className="block truncate text-xs text-ink-subtle">
                                                    {project.competitionName}
                                                    {project.divisionName === null
                                                        ? ""
                                                        : ` · ${project.divisionName}`}
                                                </span>
                                                <span className="mt-2 line-clamp-2 block text-lg font-semibold tracking-tight text-ink">
                                                    {project.title}
                                                </span>
                                                <span className="mt-2 line-clamp-3 block text-sm leading-6 text-ink-muted">
                                                    {project.summary}
                                                </span>
                                                <span className="mt-3 block text-xs leading-5 text-ink-muted">
                                                    <span className="text-ink-subtle">
                                                        AI use:{" "}
                                                    </span>
                                                    <span className="line-clamp-2">
                                                        {disclosureText(project)}
                                                    </span>
                                                </span>
                                            </span>
                                            <span className="mt-auto flex items-center justify-between gap-3 pt-4 text-xs text-ink-subtle">
                                                <span className="truncate">
                                                    {project.teamName ?? "Independent project"}
                                                </span>
                                                <ArrowUpRight
                                                    className="size-4 shrink-0 text-primary"
                                                    aria-hidden="true"
                                                />
                                            </span>
                                        </button>
                                        {projectVideo === null &&
                                        project.certificateUrl === null ? null : (
                                            <div className="flex flex-wrap items-center border-t border-line">
                                                {projectVideo === null ? null : (
                                                    <a
                                                        href={projectVideo}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        tabIndex={
                                                            copy === DUPLICATE ? -1 : undefined
                                                        }
                                                        className="inline-flex min-h-10 flex-1 items-center gap-1.5 px-5 text-xs text-ink-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25"
                                                    >
                                                        <Video
                                                            className="size-3.5"
                                                            aria-hidden="true"
                                                        />
                                                        Demonstration video
                                                        <span className="sr-only">
                                                            {" "}
                                                            (opens in a new tab)
                                                        </span>
                                                    </a>
                                                )}
                                                {project.certificateUrl === null ? null : (
                                                    <Link
                                                        href={project.certificateUrl}
                                                        tabIndex={
                                                            copy === DUPLICATE ? -1 : undefined
                                                        }
                                                        className="inline-flex min-h-10 items-center gap-1.5 border-l border-line px-5 text-xs text-ink-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25"
                                                    >
                                                        <FileCheck
                                                            className="size-3.5"
                                                            aria-hidden="true"
                                                        />
                                                        Certificate
                                                    </Link>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
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
                                {selected.divisionName === null
                                    ? ""
                                    : ` · ${selected.divisionName}`}
                            </DialogDescription>
                        </DialogHeader>
                        <ResultBadges project={selected} />
                        <p className="text-sm leading-6 text-ink-muted">{selected.summary}</p>
                        {selected.descriptionMarkdown.length === 0 ? null : (
                            <div className="max-h-64 overflow-y-auto border-t border-line pt-3 text-sm leading-6 text-ink-muted">
                                <Markdown source={selected.descriptionMarkdown} />
                            </div>
                        )}
                        <div className="border-t border-line pt-3">
                            <p className="text-xs font-medium text-ink">AI use disclosure</p>
                            <p className="mt-1 max-h-40 overflow-y-auto text-sm leading-6 text-ink-muted">
                                {disclosureText(selected)}
                            </p>
                        </div>
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
                            {video === null ? null : (
                                <Button asChild variant="subtle" color="neutral" size="sm">
                                    <a href={video} target="_blank" rel="noopener noreferrer">
                                        <Video className="size-3.5" aria-hidden="true" />
                                        Demonstration video
                                        <span className="sr-only"> (opens in a new tab)</span>
                                    </a>
                                </Button>
                            )}
                            {selected.certificateUrl === null ? null : (
                                <Button asChild variant="subtle" color="neutral" size="sm">
                                    <Link href={selected.certificateUrl}>
                                        <FileCheck className="size-3.5" aria-hidden="true" />
                                        Certificate
                                    </Link>
                                </Button>
                            )}
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
