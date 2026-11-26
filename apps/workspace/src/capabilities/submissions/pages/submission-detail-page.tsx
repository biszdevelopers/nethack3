import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
    Alert,
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    FileList,
    Markdown,
} from "@nethack/ui";
import type { FileListItem, StatusTone } from "@nethack/ui";
import { useActiveMembership } from "../../../application/session.js";
import { OrganizationRequired } from "../../../components/organization-required.js";
import { QueryErrorState, QueryLoading } from "../../../components/query-state.js";
import { resources } from "../../../application/resources.js";
import { formatDateTime } from "../../../lib/format.js";
import { humanizeStatus, statusBadgeTone } from "../../../lib/status.js";
import { CreateVersionForm } from "../components/create-version-form.js";
import { ReviewSubmissionDialog } from "../components/review-submission-dialog.js";
import { WithdrawSubmissionButton } from "../components/withdraw-submission-button.js";
import { useSubmission, useSubmissionVersions } from "../hooks/use-submissions.js";

const REVISABLE = new Set(["draft", "submitted", "changes_requested"]);
const WITHDRAWABLE = new Set(["draft", "submitted", "changes_requested"]);

function fileTone(status: string): StatusTone {
    const tone = statusBadgeTone(status);
    return tone === "primary" ? "success" : tone === "critical" ? "attention" : "pending";
}

export function SubmissionDetailPage(): ReactNode {
    const { submissionId } = useParams<{ submissionId: string }>();
    const { membership } = useActiveMembership();
    const navigate = useNavigate();
    const submission = useSubmission(submissionId ?? null);
    const versions = useSubmissionVersions(submissionId ?? null);

    if (membership === null) {
        return <OrganizationRequired />;
    }
    if (submissionId === undefined) {
        return (
            <QueryErrorState error={new Error("No submission was selected.")} title="Submission" />
        );
    }
    if (submission.isPending) {
        return <QueryLoading label="Loading submission" />;
    }
    if (submission.error !== null) {
        return <QueryErrorState error={submission.error} />;
    }
    if (submission.data === null) {
        return <QueryErrorState error={new Error("The submission was not found.")} />;
    }

    const detail = submission.data;
    const revisable = REVISABLE.has(detail.status);
    const withdrawable = WITHDRAWABLE.has(detail.status);
    const canReview = membership.role === "owner" || membership.role === "organizer";
    const orderedVersions = [...(versions.data?.items ?? detail.versions)].toSorted(
        (left, right) => right.version - left.version,
    );

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
                <Link
                    to="/submissions"
                    className="w-fit text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                    Back to submissions
                </Link>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex max-w-2xl flex-col gap-1">
                        <h1 className="text-2xl font-extrabold tracking-tight glow-sm">
                            {detail.projectTitle}
                        </h1>
                        <p className="text-sm text-ink-muted">
                            {detail.teamName === null
                                ? "Individual submission"
                                : `Team ${detail.teamName}`}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={statusBadgeTone(detail.status)} size="md">
                            {humanizeStatus(detail.status)}
                        </Badge>
                        {canReview ? <ReviewSubmissionDialog submission={detail} /> : null}
                        {withdrawable ? (
                            <WithdrawSubmissionButton
                                submissionId={detail.id}
                                onWithdrawn={() => navigate("/submissions")}
                            />
                        ) : null}
                    </div>
                </div>
            </div>

            {detail.reviewNote.length === 0 ? null : (
                <Alert
                    tone={detail.status === "changes_requested" ? "warning" : "neutral"}
                    title="Review note"
                >
                    <p>{detail.reviewNote}</p>
                    <p className="text-xs text-ink-subtle">
                        Updated {formatDateTime(detail.reviewNoteUpdatedAt)}
                    </p>
                </Alert>
            )}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="flex min-w-0 flex-col gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Versions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {versions.isPending ? (
                                <QueryLoading label="Loading versions" />
                            ) : versions.error !== null ? (
                                <QueryErrorState error={versions.error} />
                            ) : orderedVersions.length === 0 ? (
                                <p className="text-sm text-ink-muted">
                                    No version has been saved yet.
                                </p>
                            ) : (
                                <ol className="flex flex-col gap-5">
                                    {orderedVersions.map((version) => {
                                        const fileItems: FileListItem[] = version.files.map(
                                            (file) => ({
                                                id: file.id,
                                                name: file.fileName,
                                                size: file.byteSize,
                                                type: file.contentType,
                                                status: {
                                                    label: humanizeStatus(file.status),
                                                    tone: fileTone(file.status),
                                                },
                                                actions:
                                                    file.status === "approved" ? (
                                                        <Button asChild variant="ghost" size="sm">
                                                            <a
                                                                href={resources.files.downloadUrl(
                                                                    file.id,
                                                                )}
                                                                download={file.fileName}
                                                            >
                                                                Download
                                                            </a>
                                                        </Button>
                                                    ) : null,
                                            }),
                                        );
                                        return (
                                            <li
                                                key={version.id}
                                                className="flex flex-col gap-3 border-b border-line pb-5 last:border-0 last:pb-0"
                                            >
                                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                                    <h3 className="text-sm font-semibold text-ink">
                                                        Version {version.version}: {version.title}
                                                    </h3>
                                                    <span className="text-xs tabular-nums text-ink-subtle">
                                                        {formatDateTime(version.createdAt)}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-ink-muted">
                                                    {version.summary}
                                                </p>
                                                {version.descriptionMarkdown.trim().length ===
                                                0 ? null : (
                                                    <Markdown
                                                        source={version.descriptionMarkdown}
                                                    />
                                                )}
                                                <div className="flex flex-wrap gap-3 text-sm">
                                                    {version.repositoryUrl === null ? null : (
                                                        <a
                                                            href={version.repositoryUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-primary underline-offset-4 hover:underline"
                                                        >
                                                            Repository
                                                        </a>
                                                    )}
                                                    {version.demoUrl === null ? null : (
                                                        <a
                                                            href={version.demoUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-primary underline-offset-4 hover:underline"
                                                        >
                                                            Demo
                                                        </a>
                                                    )}
                                                </div>
                                                <FileList
                                                    items={fileItems}
                                                    label={`Files in version ${version.version}`}
                                                    emptyTitle="No files in this version"
                                                    emptyDescription="No files are attached to this version."
                                                />
                                            </li>
                                        );
                                    })}
                                </ol>
                            )}
                        </CardContent>
                    </Card>

                    {revisable ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>New version</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CreateVersionForm submission={detail} />
                            </CardContent>
                        </Card>
                    ) : (
                        <Alert tone="neutral" title="This submission is closed for revision">
                            The current status does not allow new versions.
                        </Alert>
                    )}
                </div>

                <div className="flex flex-col gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Submission details</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <dl className="flex flex-col gap-3 text-sm">
                                <div className="flex flex-col gap-0.5">
                                    <dt className="text-xs text-ink-subtle">Project</dt>
                                    <dd>
                                        <Link
                                            to={`/projects/${detail.projectId}`}
                                            className="text-primary underline-offset-4 hover:underline"
                                        >
                                            {detail.projectTitle}
                                        </Link>
                                    </dd>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <dt className="text-xs text-ink-subtle">Current version</dt>
                                    <dd className="tabular-nums text-ink">
                                        {detail.currentVersion}
                                    </dd>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <dt className="text-xs text-ink-subtle">Submitted</dt>
                                    <dd className="text-ink">
                                        {formatDateTime(detail.submittedAt)}
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
                </div>
            </div>
        </div>
    );
}
