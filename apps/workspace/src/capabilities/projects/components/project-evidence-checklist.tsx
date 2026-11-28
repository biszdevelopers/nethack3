import type { ReactNode } from "react";
import { Link } from "react-router";
import {
    missingProjectEvidence,
    PROJECT_EVIDENCE_LABELS,
    type ProjectEvidence,
    type ProjectEvidenceField,
} from "@nethack/contracts";

const EVIDENCE_FIELDS: readonly ProjectEvidenceField[] = [
    "repositoryUrl",
    "demoUrl",
    "videoUrl",
    "aiDisclosure",
];

export function ProjectEvidenceChecklist({
    project,
    projectId,
}: {
    readonly project: ProjectEvidence;
    readonly projectId?: string;
}): ReactNode {
    const missing = missingProjectEvidence(project);
    return (
        <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-ink">Submission requirements</p>
            <ul aria-label="Submission requirements" className="flex flex-col gap-1 text-sm">
                {EVIDENCE_FIELDS.map((field) => {
                    const done = !missing.includes(field);
                    return (
                        <li key={field} className="flex items-center justify-between gap-2">
                            <span className={done ? "text-ink" : "text-ink-muted"}>
                                {PROJECT_EVIDENCE_LABELS[field]}
                            </span>
                            <span
                                className={
                                    done ? "text-xs text-primary" : "text-xs text-ink-subtle"
                                }
                            >
                                {done ? "Provided" : "Missing"}
                            </span>
                        </li>
                    );
                })}
            </ul>
            {missing.length === 0 || projectId === undefined ? null : (
                <Link
                    to={`/projects/${projectId}`}
                    className="w-fit text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                    Edit project to add the missing requirements
                </Link>
            )}
        </div>
    );
}
