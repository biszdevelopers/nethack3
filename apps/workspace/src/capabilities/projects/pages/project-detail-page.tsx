import type { ReactNode } from "react";
import { Link, useParams } from "react-router";
import {
    Badge,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Markdown,
    UserDisplay,
} from "@nethack/ui";
import { useActiveMembership, useSession } from "../../../application/session.js";
import { OrganizationRequired } from "../../../components/organization-required.js";
import { QueryErrorState, QueryLoading } from "../../../components/query-state.js";
import { formatDateTime } from "../../../lib/format.js";
import { humanizeStatus, statusBadgeTone } from "../../../lib/status.js";
import { useEdition } from "../../competitions/hooks/use-competitions.js";
import { AddProjectMemberForm } from "../components/add-project-member-form.js";
import { ProjectEditForm } from "../components/project-edit-form.js";
import { ProjectFiles } from "../components/project-files.js";
import { PublishProjectButton } from "../components/publish-project-button.js";
import { useProject } from "../hooks/use-projects.js";

export function ProjectDetailPage(): ReactNode {
    const { projectId } = useParams<{ projectId: string }>();
    const { membership } = useActiveMembership();
    const session = useSession();
    const project = useProject(projectId ?? null);
    const edition = useEdition(project.data?.editionId ?? null);

    if (membership === null) {
        return <OrganizationRequired />;
    }
    if (projectId === undefined) {
        return <QueryErrorState error={new Error("No project was selected.")} title="Project" />;
    }
    if (project.isPending) {
        return <QueryLoading label="Loading project" />;
    }
    if (project.error !== null) {
        return <QueryErrorState error={project.error} />;
    }
    if (project.data === null) {
        return <QueryErrorState error={new Error("The project was not found.")} />;
    }

    const detail = project.data;
    const userId = session.data?.user.id ?? null;
    const isOrganizer = membership.role === "owner" || membership.role === "organizer";
    const memberRole =
        userId === null
            ? null
            : (detail.members.find((member) => member.userId === userId)?.role ?? null);
    const canEdit = isOrganizer || detail.ownerUserId === userId || memberRole === "owner";
    const canUploadFiles = isOrganizer || detail.ownerUserId === userId || memberRole !== null;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
                <Link
                    to="/projects"
                    className="w-fit text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                    Back to projects
                </Link>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex max-w-2xl flex-col gap-1">
                        <h1 className="text-2xl font-extrabold tracking-tight">{detail.title}</h1>
                        <p className="text-sm text-ink-muted">
                            {edition.data === undefined || edition.data === null
                                ? "Edition"
                                : edition.data.name}
                            {detail.teamName === null ? "" : ` · ${detail.teamName}`}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={statusBadgeTone(detail.status)} size="md">
                            {humanizeStatus(detail.status)}
                        </Badge>
                        {canEdit && detail.status === "draft" ? (
                            <PublishProjectButton projectId={detail.id} />
                        ) : null}
                    </div>
                </div>
                <p className="max-w-3xl text-sm text-ink-muted">{detail.summary}</p>
                <div className="flex flex-wrap items-center gap-2">
                    {detail.tags.map((tag) => (
                        <Badge key={tag} tone="neutral" size="sm">
                            {tag}
                        </Badge>
                    ))}
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="flex min-w-0 flex-col gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Description</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {detail.descriptionMarkdown.trim().length === 0 ? (
                                <p className="text-sm text-ink-muted">
                                    This project has no description yet.
                                </p>
                            ) : (
                                <Markdown source={detail.descriptionMarkdown} />
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>AI-use disclosure</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {detail.aiDisclosure.trim().length === 0 ? (
                                <p className="text-sm text-ink-muted">
                                    No AI-use disclosure was recorded.
                                </p>
                            ) : (
                                <p className="whitespace-pre-line break-words text-sm text-ink-muted">
                                    {detail.aiDisclosure}
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Project files</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ProjectFiles projectId={detail.id} canEdit={canUploadFiles} />
                        </CardContent>
                    </Card>

                    {canEdit ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>Edit project</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ProjectEditForm project={detail} />
                            </CardContent>
                        </Card>
                    ) : null}
                </div>

                <div className="flex flex-col gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <dl className="flex flex-col gap-3 text-sm">
                                <div className="flex flex-col gap-0.5">
                                    <dt className="text-xs text-ink-subtle">Edition</dt>
                                    <dd className="text-ink">
                                        {edition.data === undefined || edition.data === null ? (
                                            detail.editionId
                                        ) : (
                                            <Link
                                                to={`/competitions/${edition.data.id}`}
                                                className="text-primary underline-offset-4 hover:underline"
                                            >
                                                {edition.data.name}
                                            </Link>
                                        )}
                                    </dd>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <dt className="text-xs text-ink-subtle">Team</dt>
                                    <dd className="text-ink">
                                        {detail.teamId === null ? (
                                            "No team"
                                        ) : (
                                            <Link
                                                to={`/teams/${detail.teamId}`}
                                                className="text-primary underline-offset-4 hover:underline"
                                            >
                                                {detail.teamName ?? "Open team"}
                                            </Link>
                                        )}
                                    </dd>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <dt className="text-xs text-ink-subtle">Repository</dt>
                                    <dd className="break-all text-ink">
                                        {detail.repositoryUrl === null ? (
                                            "Not provided"
                                        ) : (
                                            <a
                                                href={detail.repositoryUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-primary underline-offset-4 hover:underline"
                                            >
                                                {detail.repositoryUrl}
                                            </a>
                                        )}
                                    </dd>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <dt className="text-xs text-ink-subtle">Demo</dt>
                                    <dd className="break-all text-ink">
                                        {detail.demoUrl === null ? (
                                            "Not provided"
                                        ) : (
                                            <a
                                                href={detail.demoUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-primary underline-offset-4 hover:underline"
                                            >
                                                {detail.demoUrl}
                                            </a>
                                        )}
                                    </dd>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <dt className="text-xs text-ink-subtle">Demonstration video</dt>
                                    <dd className="break-all text-ink">
                                        {detail.videoUrl === null ? (
                                            "Not provided"
                                        ) : (
                                            <a
                                                href={detail.videoUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-primary underline-offset-4 hover:underline"
                                            >
                                                {detail.videoUrl}
                                            </a>
                                        )}
                                    </dd>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <dt className="text-xs text-ink-subtle">Created</dt>
                                    <dd className="text-ink">{formatDateTime(detail.createdAt)}</dd>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <dt className="text-xs text-ink-subtle">Updated</dt>
                                    <dd className="text-ink">{formatDateTime(detail.updatedAt)}</dd>
                                </div>
                            </dl>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Members</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <ul className="flex flex-col divide-y divide-line">
                                {detail.members.map((member) => (
                                    <li
                                        key={member.userId}
                                        className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                                    >
                                        <div className="min-w-0">
                                            <UserDisplay
                                                name={member.displayName}
                                                imageUrl={member.avatarUrl}
                                                size="sm"
                                            />
                                        </div>
                                        <Badge
                                            tone={member.role === "owner" ? "primary" : "neutral"}
                                            size="sm"
                                        >
                                            {humanizeStatus(member.role)}
                                        </Badge>
                                    </li>
                                ))}
                            </ul>
                            {canEdit ? <AddProjectMemberForm projectId={detail.id} /> : null}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Submissions</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-2">
                            {detail.submissions.length === 0 ? (
                                <p className="text-sm text-ink-muted">
                                    This project has no submission yet.
                                </p>
                            ) : (
                                <ul className="flex flex-col divide-y divide-line">
                                    {detail.submissions.map((submission) => (
                                        <li
                                            key={submission.id}
                                            className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                                        >
                                            <Link
                                                to={`/submissions/${submission.id}`}
                                                className="text-sm text-primary underline-offset-4 hover:underline"
                                            >
                                                Version {submission.currentVersion}
                                            </Link>
                                            <Badge
                                                tone={statusBadgeTone(submission.status)}
                                                size="sm"
                                            >
                                                {humanizeStatus(submission.status)}
                                            </Badge>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <Link
                                to={`/submissions?projectId=${detail.id}`}
                                className="text-sm text-primary underline-offset-4 hover:underline"
                            >
                                Open submissions
                            </Link>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
