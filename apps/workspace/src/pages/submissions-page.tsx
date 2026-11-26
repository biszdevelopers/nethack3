import { useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    EmptyState,
    Select,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@nethack/ui";
import { useActiveMembership } from "../application/session.js";
import { OrganizationRequired } from "../components/organization-required.js";
import { QueryErrorState, QueryLoading } from "../components/query-state.js";
import { formatDateTime } from "../lib/format.js";
import { humanizeStatus, statusBadgeTone } from "../lib/status.js";
import { useMyParticipations } from "../capabilities/competitions/hooks/use-competitions.js";
import { CreateSubmissionDialog } from "../capabilities/submissions/components/create-submission-dialog.js";
import { useSubmissions } from "../capabilities/submissions/hooks/use-submissions.js";
import { useProjects } from "../capabilities/projects/hooks/use-projects.js";

export function SubmissionsPage(): ReactNode {
    const { membership } = useActiveMembership();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const initialEditionId = searchParams.get("editionId");
    const [editionSelection, setEditionSelection] = useState(initialEditionId ?? "initial");
    const [createOpen, setCreateOpen] = useState(false);
    const participations = useMyParticipations();
    const projects = useProjects({});
    const projectFilter = searchParams.get("projectId");
    const organizationParticipations = (participations.data?.items ?? []).filter(
        (participation) =>
            membership !== null && participation.organizationId === membership.organizationId,
    );
    const selectionIsEdition =
        editionSelection !== "initial" &&
        editionSelection !== "all" &&
        (editionSelection === initialEditionId ||
            organizationParticipations.some(
                (participation) => participation.editionId === editionSelection,
            ));
    const effectiveEditionId =
        editionSelection === "all"
            ? null
            : selectionIsEdition
              ? editionSelection
              : (organizationParticipations[0]?.editionId ?? null);
    const submissions = useSubmissions({
        editionId: effectiveEditionId ?? undefined,
        projectId: projectFilter ?? undefined,
    });

    if (membership === null) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeading />
                <OrganizationRequired />
            </div>
        );
    }

    const visibleProjects = (projects.data?.items ?? []).filter(
        (project) => effectiveEditionId === null || project.editionId === effectiveEditionId,
    );
    const projectTitles = new Map(
        (projects.data?.items ?? []).map((project) => [project.id, project.title]),
    );
    const filterProjectTitle =
        projectFilter === null ? null : (projectTitles.get(projectFilter) ?? null);
    const editionOptions = [
        { value: "all", label: "All editions" },
        ...organizationParticipations.map((participation) => ({
            value: participation.editionId,
            label: participation.editionName,
        })),
    ];
    if (
        initialEditionId !== null &&
        !organizationParticipations.some(
            (participation) => participation.editionId === initialEditionId,
        )
    ) {
        editionOptions.push({ value: initialEditionId, label: "Selected edition" });
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <PageHeading />
                <Button onClick={() => setCreateOpen(true)} disabled={visibleProjects.length === 0}>
                    Start submission
                </Button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="w-full sm:w-72">
                    <Select
                        label="Edition"
                        options={editionOptions}
                        value={effectiveEditionId ?? "all"}
                        onValueChange={(value) => setEditionSelection(value)}
                    />
                </div>
                {filterProjectTitle === null ? null : (
                    <p className="text-xs text-ink-muted">Filtered to {filterProjectTitle}.</p>
                )}
            </div>

            {submissions.isPending ? (
                <QueryLoading label="Loading submissions" />
            ) : submissions.error !== null ? (
                <QueryErrorState error={submissions.error} />
            ) : submissions.data.items.length === 0 ? (
                <EmptyState
                    title="No submissions yet"
                    description="Submit a project when your team is ready and before the deadline."
                    action={
                        visibleProjects.length === 0 ? undefined : (
                            <Button variant="outline" onClick={() => setCreateOpen(true)}>
                                Start submission
                            </Button>
                        )
                    }
                />
            ) : (
                <Card hoverable>
                    <CardHeader>
                        <CardTitle>Submissions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Project</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Version</TableHead>
                                    <TableHead>Submitted</TableHead>
                                    <TableHead>Updated</TableHead>
                                    <TableHead className="text-right">Open</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {submissions.data.items.map((submission) => (
                                    <TableRow key={submission.id}>
                                        <TableCell className="font-medium">
                                            {projectTitles.get(submission.projectId) ??
                                                submission.projectId}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                tone={statusBadgeTone(submission.status)}
                                                size="sm"
                                            >
                                                {humanizeStatus(submission.status)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {submission.currentVersion}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {submission.submittedAt === null
                                                ? "Not submitted"
                                                : formatDateTime(submission.submittedAt)}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {formatDateTime(submission.updatedAt)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button asChild variant="ghost" size="sm">
                                                <Link to={`/submissions/${submission.id}`}>
                                                    View
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            <CreateSubmissionDialog
                projects={visibleProjects}
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreated={(submissionId) => {
                    navigate(`/submissions/${submissionId}`);
                }}
            />
        </div>
    );
}

function PageHeading(): ReactNode {
    return (
        <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-extrabold tracking-tight glow-sm">Submissions</h1>
            <p className="text-sm text-ink-muted">
                Submit a project version and track organizer review.
            </p>
        </div>
    );
}
