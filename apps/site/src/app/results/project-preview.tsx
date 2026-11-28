"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ExternalLink, GitBranch, Play } from "lucide-react";
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    Markdown,
} from "@nethack/ui";
import type { PublicProject } from "@nethack/contracts";
import { safeExternalUrl } from "../projects/project-links";

export function ResultsProjectPreview({
    project,
    certificateUrl,
}: {
    readonly project: PublicProject;
    readonly certificateUrl: string | null;
}): ReactNode {
    const repository = safeExternalUrl(project.repositoryUrl);
    const demo = safeExternalUrl(project.demoUrl);
    const video = safeExternalUrl(project.videoUrl);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button type="button" variant="outline" color="neutral" size="sm">
                    Preview project
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl border-line bg-panel">
                <DialogHeader>
                    <DialogTitle className="text-2xl">{project.title}</DialogTitle>
                    <DialogDescription>
                        {project.teamName ?? "Independent project"} · {project.competitionName}
                        {project.divisionName === null ? "" : ` · ${project.divisionName}`}
                    </DialogDescription>
                </DialogHeader>
                <p className="text-sm leading-6 text-ink-muted">{project.summary}</p>
                {project.descriptionMarkdown.length === 0 ? null : (
                    <div className="max-h-64 overflow-y-auto border-t border-line pt-3 text-sm leading-6 text-ink-muted">
                        <Markdown source={project.descriptionMarkdown} />
                    </div>
                )}
                <div className="border-t border-line pt-3">
                    <p className="text-xs font-medium text-ink">AI-use disclosure</p>
                    <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-ink-muted">
                        {project.aiDisclosure.trim().length === 0
                            ? "This team did not provide an AI-use disclosure."
                            : project.aiDisclosure}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                    <Button asChild variant="outline" color="neutral" size="sm">
                        <Link href={`/projects/${project.slug}`}>Open project page</Link>
                    </Button>
                    {repository === null ? null : (
                        <Button asChild variant="subtle" color="neutral" size="sm">
                            <a href={repository} target="_blank" rel="noopener noreferrer">
                                <GitBranch className="size-3.5" aria-hidden="true" />
                                Repository
                            </a>
                        </Button>
                    )}
                    {demo === null ? null : (
                        <Button asChild variant="subtle" color="neutral" size="sm">
                            <a href={demo} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="size-3.5" aria-hidden="true" />
                                Live demo
                            </a>
                        </Button>
                    )}
                    {video === null ? null : (
                        <Button asChild variant="subtle" color="neutral" size="sm">
                            <a href={video} target="_blank" rel="noopener noreferrer">
                                <Play className="size-3.5" aria-hidden="true" />
                                Demonstration video
                            </a>
                        </Button>
                    )}
                    {certificateUrl === null ? null : (
                        <Button asChild variant="subtle" color="primary" size="sm">
                            <Link href={certificateUrl}>Certificate</Link>
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
