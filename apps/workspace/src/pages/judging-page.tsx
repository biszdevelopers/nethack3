import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type {
    BulkAssignmentResult,
    JudgeAssignment,
    JudgeAssignmentStatus,
} from "@nethack/contracts";
import {
    Alert,
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    EmptyState,
    Form,
    FormField,
    Input,
    LoadingBlock,
    PageHeader,
    Progress,
    Select,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Textarea,
    useToast,
} from "@nethack/ui";
import { useActiveMembership } from "../application/session.js";
import { EditionSelect } from "../capabilities/shared/edition-select.js";
import { formatDateTime, localInputToIso } from "../capabilities/shared/datetime.js";
import { describeError } from "../capabilities/shared/errors.js";
import { humanizeToken } from "../capabilities/shared/format.js";
import { RequestError } from "../capabilities/shared/states.jsx";
import { assignmentSchema, type AssignmentForm } from "../capabilities/judging/forms.js";
import { JudgingCoveragePanel } from "../capabilities/judging/components/judging-coverage-panel.js";
import { JudgingQueue } from "../capabilities/judging/components/judging-queue.js";
import { JudgingResultsPanel } from "../capabilities/judging/components/judging-results-panel.js";
import { RubricBuilder } from "../capabilities/judging/components/rubric-builder.js";
import { buildJudgeEditionOptions } from "../capabilities/judging/edition-options.js";
import {
    useEdition,
    useDivisions,
    useOrganizerEditions,
    usePublicEditionOptions,
} from "../capabilities/competitions/hooks.js";
import {
    useCreateBulkAssignment,
    useEditionAssignments,
    useEditionRubrics,
    useEditionSubmissions,
    useJudgingHistory,
    useMyAssignments,
    useRevokeAssignment,
} from "../capabilities/judging/hooks.js";

const STATUS_OPTIONS = [
    { value: "all", label: "All statuses" },
    { value: "assigned", label: "Assigned" },
    { value: "in_progress", label: "In progress" },
    { value: "submitted", label: "Submitted" },
    { value: "conflict_declared", label: "Conflict declared" },
    { value: "revoked", label: "Revoked" },
] as const;

const SCOPE_OPTIONS = [
    { value: "submission", label: "One submission" },
    { value: "division", label: "One division" },
    { value: "all", label: "Every submitted project" },
] as const;

function readStatus(value: string | null): JudgeAssignmentStatus | "all" {
    switch (value) {
        case "assigned":
        case "in_progress":
        case "submitted":
        case "conflict_declared":
        case "revoked":
            return value;
        default:
            return "all";
    }
}

function statusTone(status: JudgeAssignmentStatus): "neutral" | "primary" | "outline" {
    switch (status) {
        case "submitted":
            return "primary";
        case "in_progress":
            return "outline";
        default:
            return "neutral";
    }
}

function statusLabel(status: JudgeAssignmentStatus): string {
    switch (status) {
        case "assigned":
            return "Assigned";
        case "in_progress":
            return "In progress";
        case "submitted":
            return "Submitted";
        case "conflict_declared":
            return "Conflict declared";
        case "revoked":
            return "Revoked";
    }
}

export function JudgingPage(): ReactNode {
    const { session, membership } = useActiveMembership();
    const [searchParams, setSearchParams] = useSearchParams();
    const organizationId = membership?.organizationId ?? null;
    const isOrganizer = membership?.role === "owner" || membership?.role === "organizer";
    const { toast } = useToast();

    const statusParam = readStatus(searchParams.get("status"));
    const myAssignments = useMyAssignments(organizationId);

    const organizerEditions = useOrganizerEditions(organizationId, isOrganizer);
    const publicEditions = usePublicEditionOptions(membership?.organizationSlug ?? null);
    const editionId = searchParams.get("edition");
    const editionDetail = useEdition(organizationId, editionId);
    const editionFrozen =
        editionDetail.data?.status === "completed" || editionDetail.data?.status === "archived";
    const rubrics = useEditionRubrics(organizationId, isOrganizer ? editionId : null);
    const assignments = useEditionAssignments(organizationId, isOrganizer ? editionId : null);
    const submissions = useEditionSubmissions(
        organizationId,
        isOrganizer ? editionId : null,
        isOrganizer,
    );
    const divisions = useDivisions(organizationId, isOrganizer ? editionId : null);

    const createAssignment = useCreateBulkAssignment(organizationId, editionId);
    const revokeAssignment = useRevokeAssignment(organizationId, editionId);
    const [bulkResult, setBulkResult] = useState<BulkAssignmentResult | null>(null);

    const assignmentForm = useForm<AssignmentForm>({
        resolver: zodResolver(assignmentSchema),
        defaultValues: {
            scope: "submission",
            divisionId: "",
            submissionId: "",
            rubricId: "",
            judgeEmail: "",
            dueAt: "",
            note: "",
        },
    });

    const allMyItems = myAssignments.data?.items ?? [];
    const divisionItems = divisions.data?.items ?? [];
    const assignmentScope = useWatch({
        control: assignmentForm.control,
        name: "scope",
    });
    const judgeEditionOptions = buildJudgeEditionOptions(allMyItems, [
        ...publicEditions.editions,
        ...organizerEditions.editions,
    ]);
    const historyEditionId = editionId ?? judgeEditionOptions[0]?.id ?? null;
    const myHistory = useJudgingHistory(organizationId, historyEditionId);

    if (session.isPending) {
        return <LoadingBlock rows={4} label="Loading judging" />;
    }
    if (session.isError) {
        return <RequestError error={session.error} onRetry={() => void session.refetch()} />;
    }
    if (membership === null || organizationId === null) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeader
                    title="Judging"
                    description="Assignments, rubric scoring, and evaluation submission."
                />
                <EmptyState
                    title="No active organization"
                    description="Select an organization membership to view judging assignments."
                />
            </div>
        );
    }

    const editionAssignments = assignments.data?.items ?? [];
    const rubricItems = rubrics.data?.items ?? [];
    const submissionItems = submissions.data?.items ?? [];
    const selectedEdition =
        organizerEditions.editions.find((edition) => edition.id === editionId) ?? null;
    const myItems =
        editionId === null
            ? allMyItems
            : allMyItems.filter((assignment) => assignment.editionId === editionId);
    const visibleMyItems =
        statusParam === "all"
            ? myItems
            : myItems.filter((assignment) => assignment.status === statusParam);
    const trackedMyItems = myItems.filter((assignment) => assignment.status !== "revoked");
    const submittedCount = trackedMyItems.filter(
        (assignment) => assignment.status === "submitted",
    ).length;
    const pendingCount = trackedMyItems.filter(
        (assignment) => assignment.status === "assigned" || assignment.status === "in_progress",
    ).length;
    const conflictCount = trackedMyItems.filter(
        (assignment) => assignment.status === "conflict_declared",
    ).length;
    const editionFilterOptions = [
        { value: "all", label: "All editions" },
        ...judgeEditionOptions.map((edition) => ({ value: edition.id, label: edition.name })),
    ];
    const historyItems = myHistory.data?.items ?? [];
    const historyHasCurve = historyItems.some(
        (item) =>
            item.displayWeightedScore !== undefined &&
            item.displayWeightedScore !== null &&
            item.displayWeightedScore !== item.weightedScore,
    );

    const setEdition = (next: string): void => {
        const params = new URLSearchParams(searchParams);
        params.set("edition", next);
        setSearchParams(params, { replace: true });
        setBulkResult(null);
        assignmentForm.reset({
            scope: "submission",
            divisionId: "",
            submissionId: "",
            rubricId: "",
            judgeEmail: "",
            dueAt: "",
            note: "",
        });
    };

    const setEditionFilter = (next: string): void => {
        const params = new URLSearchParams(searchParams);
        if (next === "all") {
            params.delete("edition");
        } else {
            params.set("edition", next);
        }
        setSearchParams(params, { replace: true });
        if (next !== "all") {
            setBulkResult(null);
            assignmentForm.reset({
                scope: "submission",
                divisionId: "",
                submissionId: "",
                rubricId: "",
                judgeEmail: "",
                dueAt: "",
                note: "",
            });
        }
    };

    const setStatus = (next: string): void => {
        const params = new URLSearchParams(searchParams);
        if (next === "all") {
            params.delete("status");
        } else {
            params.set("status", next);
        }
        setSearchParams(params, { replace: true });
    };

    const onCreateAssignment = assignmentForm.handleSubmit(async (values) => {
        const dueAt = values.dueAt.trim().length === 0 ? null : localInputToIso(values.dueAt);
        try {
            const result = await createAssignment.mutateAsync({
                judgeEmail: values.judgeEmail,
                rubricId: values.rubricId,
                scope: values.scope,
                ...(values.scope === "submission" ? { submissionId: values.submissionId } : {}),
                ...(values.scope === "division" ? { divisionId: values.divisionId } : {}),
                dueAt,
                note: values.note,
            });
            setBulkResult(result);
            assignmentForm.reset({
                scope: "submission",
                divisionId: "",
                submissionId: "",
                rubricId: "",
                judgeEmail: "",
                dueAt: "",
                note: "",
            });
            toast({
                title: "Assignments updated",
                description: `${String(result.assigned.length)} assigned · ${String(result.skipped)} skipped.`,
                tone: "success",
            });
        } catch (error) {
            toast({
                title: "Could not create the assignments",
                description: describeError(error),
                tone: "critical",
            });
        }
    });

    const onRevoke = (assignment: JudgeAssignment): void => {
        revokeAssignment.mutate(assignment.id, {
            onSuccess: () => toast({ title: "Assignment revoked", tone: "success" }),
            onError: (error) =>
                toast({
                    title: "Could not revoke the assignment",
                    description: describeError(error),
                    tone: "critical",
                }),
        });
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Judging"
                description="Review assigned submissions, score each rubric criterion, and submit feedback."
            />

            <Tabs defaultValue="assignments">
                <TabsList aria-label="Judging sections">
                    <TabsTrigger value="assignments">My assignments</TabsTrigger>
                    <TabsTrigger value="queue">Continue judging</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                    {isOrganizer ? <TabsTrigger value="coverage">Coverage</TabsTrigger> : null}
                </TabsList>

                <TabsContent value="assignments">
                    <section
                        className="flex flex-col gap-4"
                        aria-labelledby="my-assignments-heading"
                    >
                        <div className="flex flex-wrap items-end justify-between gap-4">
                            <div className="flex flex-col gap-1">
                                <h2
                                    id="my-assignments-heading"
                                    className="text-lg font-bold tracking-tight"
                                >
                                    My assignments
                                </h2>
                                <p className="text-sm text-ink-muted">
                                    Assignments where you are the assigned judge.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <div className="w-52">
                                    <Select
                                        label="Filter by edition"
                                        options={editionFilterOptions}
                                        value={editionId ?? "all"}
                                        onValueChange={setEditionFilter}
                                    />
                                </div>
                                <div className="w-48">
                                    <Select
                                        label="Filter by status"
                                        options={STATUS_OPTIONS}
                                        value={statusParam}
                                        onValueChange={setStatus}
                                    />
                                </div>
                            </div>
                        </div>

                        {myAssignments.isPending ? (
                            <LoadingBlock rows={4} label="Loading assignments" />
                        ) : myAssignments.isError ? (
                            <RequestError
                                error={myAssignments.error}
                                onRetry={() => void myAssignments.refetch()}
                            />
                        ) : myItems.length === 0 ? (
                            <EmptyState
                                title="No judging assignments"
                                description="Assignments appear after an organizer creates a rubric and assigns you to a submission."
                            />
                        ) : (
                            <>
                                {editionFrozen ? (
                                    <Alert tone="warning" title="Results are published">
                                        This edition is completed, so judging is read-only. Open an
                                        assignment to review its saved feedback.
                                    </Alert>
                                ) : null}
                                <Card>
                                    <CardContent className="flex flex-col gap-3 pt-6">
                                        <Progress
                                            label="Evaluations submitted"
                                            value={submittedCount}
                                            max={trackedMyItems.length}
                                            valueText={`${String(submittedCount)} of ${String(trackedMyItems.length)} submitted`}
                                        />
                                        <p className="text-sm text-ink-muted">
                                            {String(pendingCount)} pending ·{" "}
                                            {String(submittedCount)} submitted ·{" "}
                                            {String(conflictCount)} recused
                                        </p>
                                    </CardContent>
                                </Card>
                                {visibleMyItems.length === 0 ? (
                                    <EmptyState
                                        title="No assignments match this filter"
                                        description="Change the edition or status filter to see more assignments."
                                    />
                                ) : (
                                    <Card>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Project</TableHead>
                                                    <TableHead>Edition</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Due</TableHead>
                                                    <TableHead>Assigned</TableHead>
                                                    <TableHead className="text-right">
                                                        Open
                                                    </TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {visibleMyItems.map((assignment) => (
                                                    <TableRow key={assignment.id}>
                                                        <TableCell>
                                                            <span className="font-medium">
                                                                {assignment.projectTitle}
                                                            </span>
                                                            <span className="block text-xs text-ink-subtle">
                                                                {assignment.id}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-ink-muted">
                                                            {judgeEditionOptions.find(
                                                                (edition) =>
                                                                    edition.id ===
                                                                    assignment.editionId,
                                                            )?.name ?? "—"}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge
                                                                tone={statusTone(assignment.status)}
                                                            >
                                                                {statusLabel(assignment.status)}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-ink-muted">
                                                            {formatDateTime(assignment.dueAt)}
                                                        </TableCell>
                                                        <TableCell className="text-ink-muted">
                                                            {formatDateTime(assignment.assignedAt)}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                asChild
                                                            >
                                                                <Link
                                                                    to={`/judging/assignments/${assignment.id}`}
                                                                >
                                                                    Open assignment
                                                                </Link>
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </Card>
                                )}
                            </>
                        )}
                    </section>
                </TabsContent>

                <TabsContent value="queue">
                    <section
                        className="flex flex-col gap-4"
                        aria-labelledby="judging-queue-heading"
                    >
                        <div className="flex flex-col gap-1">
                            <h2
                                id="judging-queue-heading"
                                className="text-lg font-bold tracking-tight"
                            >
                                Continue judging
                            </h2>
                            <p className="text-sm text-ink-muted">
                                Work through one project at a time. Open a project to score it, or
                                recuse yourself if you cannot evaluate it fairly.
                            </p>
                        </div>
                        <JudgingQueue
                            organizationId={organizationId}
                            items={myItems}
                            isPending={myAssignments.isPending}
                            error={myAssignments.isError ? myAssignments.error : null}
                            onRetry={() => void myAssignments.refetch()}
                            frozen={editionFrozen}
                        />
                    </section>
                </TabsContent>

                <TabsContent value="history">
                    <section
                        className="flex flex-col gap-4"
                        aria-labelledby="judging-history-heading"
                    >
                        <div className="flex flex-wrap items-end justify-between gap-4">
                            <div className="flex flex-col gap-1">
                                <h2
                                    id="judging-history-heading"
                                    className="text-lg font-bold tracking-tight"
                                >
                                    History
                                </h2>
                                <p className="text-sm text-ink-muted">
                                    Submitted evaluations for the selected edition. This stays
                                    available when judging is closed.
                                </p>
                            </div>
                            {historyEditionId === null ? null : (
                                <Button variant="outline" asChild>
                                    <Link to={`/judging/history?edition=${historyEditionId}`}>
                                        Open evaluation history
                                    </Link>
                                </Button>
                            )}
                        </div>

                        {judgeEditionOptions.length > 0 ? (
                            <div className="max-w-md">
                                <Select
                                    label="Edition"
                                    options={judgeEditionOptions.map((edition) => ({
                                        value: edition.id,
                                        label: edition.name,
                                    }))}
                                    value={historyEditionId ?? ""}
                                    onValueChange={setEditionFilter}
                                />
                            </div>
                        ) : null}

                        {historyEditionId === null ? (
                            <EmptyState
                                title="No submitted evaluations"
                                description="Submitted evaluations appear here after you finish scoring an assignment."
                            />
                        ) : myHistory.isPending ? (
                            <LoadingBlock rows={3} label="Loading submitted evaluations" />
                        ) : myHistory.isError ? (
                            <RequestError
                                error={myHistory.error}
                                onRetry={() => void myHistory.refetch()}
                            />
                        ) : historyItems.length === 0 ? (
                            <EmptyState
                                title="No submitted evaluations"
                                description="Submitted evaluations for this edition appear here after you finish scoring."
                            />
                        ) : (
                            <Card>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Project</TableHead>
                                            <TableHead>Team</TableHead>
                                            <TableHead>Score</TableHead>
                                            {historyHasCurve ? (
                                                <TableHead>Display</TableHead>
                                            ) : null}
                                            <TableHead>Submitted</TableHead>
                                            <TableHead className="text-right">Open</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {historyItems.map((item) => (
                                            <TableRow key={item.assignmentId}>
                                                <TableCell className="font-medium">
                                                    {item.projectTitle}
                                                </TableCell>
                                                <TableCell>
                                                    {item.teamName ?? "No team"}
                                                    <span className="block text-xs text-ink-subtle">
                                                        {item.divisionName ?? "Edition-wide"}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="tabular-nums">
                                                    {item.weightedScore === null
                                                        ? "Not scored"
                                                        : `${item.weightedScore.toFixed(2)} / 100`}
                                                </TableCell>
                                                {historyHasCurve ? (
                                                    <TableCell className="tabular-nums text-ink-muted">
                                                        {item.displayWeightedScore === undefined ||
                                                        item.displayWeightedScore === null
                                                            ? "—"
                                                            : `${String(item.displayWeightedScore)} / 100`}
                                                    </TableCell>
                                                ) : null}
                                                <TableCell className="text-ink-muted">
                                                    {formatDateTime(item.submittedAt)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="outline" size="sm" asChild>
                                                        <Link
                                                            to={`/judging/assignments/${item.assignmentId}`}
                                                        >
                                                            Open assignment
                                                        </Link>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Card>
                        )}
                    </section>
                </TabsContent>

                {isOrganizer ? (
                    <TabsContent value="coverage">
                        <section
                            className="flex flex-col gap-4"
                            aria-labelledby="judging-coverage-heading"
                        >
                            <div className="flex flex-col gap-1">
                                <h2
                                    id="judging-coverage-heading"
                                    className="text-lg font-bold tracking-tight"
                                >
                                    Coverage
                                </h2>
                                <p className="text-sm text-ink-muted">
                                    Per-judge progress, calibration, and open flags for this
                                    edition.
                                </p>
                            </div>
                            {organizerEditions.query.isPending ? (
                                <LoadingBlock rows={2} label="Loading editions" />
                            ) : organizerEditions.query.isError ? (
                                <RequestError
                                    error={organizerEditions.query.error}
                                    onRetry={() => void organizerEditions.query.refetch()}
                                />
                            ) : organizerEditions.editions.length === 0 ? (
                                <EmptyState
                                    title="No competition editions"
                                    description="Create a competition edition before reviewing judge coverage."
                                />
                            ) : (
                                <div className="max-w-md">
                                    <EditionSelect
                                        editions={organizerEditions.editions}
                                        value={editionId ?? ""}
                                        onValueChange={setEdition}
                                    />
                                </div>
                            )}
                            <JudgingCoveragePanel
                                organizationId={organizationId}
                                editionId={editionId}
                            />
                        </section>
                    </TabsContent>
                ) : null}
            </Tabs>

            {isOrganizer && editionId !== null ? (
                <JudgingResultsPanel organizationId={organizationId} editionId={editionId} />
            ) : null}

            {isOrganizer ? (
                <section
                    className="flex flex-col gap-4 border-t border-line pt-6"
                    aria-labelledby="assignment-management-heading"
                >
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div className="flex flex-col gap-1">
                            <h2
                                id="assignment-management-heading"
                                className="text-lg font-bold tracking-tight"
                            >
                                Assignment management
                            </h2>
                            <p className="text-sm text-ink-muted">
                                Assign judges to submissions in a competition edition.
                            </p>
                        </div>
                        {editionId === null ? null : (
                            <Button variant="outline" asChild>
                                <Link to={`/judging/rubrics?edition=${editionId}`}>
                                    Open rubric manager
                                </Link>
                            </Button>
                        )}
                    </div>

                    {organizerEditions.query.isPending ? (
                        <LoadingBlock rows={2} label="Loading editions" />
                    ) : organizerEditions.query.isError ? (
                        <RequestError
                            error={organizerEditions.query.error}
                            onRetry={() => void organizerEditions.query.refetch()}
                        />
                    ) : organizerEditions.editions.length === 0 ? (
                        <EmptyState
                            title="No competition editions"
                            description="Create a competition edition before assigning judges."
                        />
                    ) : (
                        <div className="max-w-md">
                            <EditionSelect
                                editions={organizerEditions.editions}
                                value={editionId ?? ""}
                                onValueChange={setEdition}
                            />
                        </div>
                    )}

                    {editionId === null ? null : (
                        <>
                            {selectedEdition === null ? null : (
                                <p className="text-sm text-ink-muted">
                                    Managing {selectedEdition.name}.
                                </p>
                            )}

                            <RubricBuilder
                                organizationId={organizationId ?? ""}
                                editionId={editionId}
                            />

                            <div className="grid gap-4 lg:grid-cols-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Create an assignment</CardTitle>
                                        <CardDescription>
                                            The judge must already have an active judge or organizer
                                            role in this organization.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {submissions.isPending || rubrics.isPending ? (
                                            <LoadingBlock rows={4} label="Loading edition data" />
                                        ) : submissions.isError ? (
                                            <RequestError
                                                error={submissions.error}
                                                onRetry={() => void submissions.refetch()}
                                            />
                                        ) : rubrics.isError ? (
                                            <RequestError
                                                error={rubrics.error}
                                                onRetry={() => void rubrics.refetch()}
                                            />
                                        ) : rubricItems.length === 0 ? (
                                            <Alert
                                                tone="warning"
                                                title="No rubrics in this edition"
                                            >
                                                A rubric is required before a judge can be assigned.
                                            </Alert>
                                        ) : submissionItems.length === 0 ? (
                                            <Alert
                                                tone="warning"
                                                title="No submissions in this edition"
                                            >
                                                Judges can be assigned after a submission exists.
                                            </Alert>
                                        ) : (
                                            <Form
                                                form={assignmentForm}
                                                onSubmit={onCreateAssignment}
                                            >
                                                <div className="flex flex-col gap-4">
                                                    <Controller
                                                        control={assignmentForm.control}
                                                        name="scope"
                                                        render={({ field, fieldState }) => (
                                                            <Select
                                                                label="Assignment scope"
                                                                options={SCOPE_OPTIONS}
                                                                value={field.value}
                                                                onValueChange={field.onChange}
                                                                description="Edition-wide and division scopes only cover submitted or accepted work."
                                                                {...(fieldState.error?.message ===
                                                                undefined
                                                                    ? {}
                                                                    : {
                                                                          error: fieldState.error
                                                                              .message,
                                                                      })}
                                                            />
                                                        )}
                                                    />
                                                    {assignmentScope === "submission" ? (
                                                        <Controller
                                                            control={assignmentForm.control}
                                                            name="submissionId"
                                                            render={({ field, fieldState }) => (
                                                                <Select
                                                                    label="Submission"
                                                                    options={submissionItems.map(
                                                                        (submission) => ({
                                                                            value: submission.id,
                                                                            label: `${submission.projectTitle} · ${submission.teamName ?? "No team"} (${humanizeToken(submission.status)})`,
                                                                        }),
                                                                    )}
                                                                    value={field.value}
                                                                    onValueChange={field.onChange}
                                                                    placeholder="Select a submission"
                                                                    {...(fieldState.error
                                                                        ?.message === undefined
                                                                        ? {}
                                                                        : {
                                                                              error: fieldState
                                                                                  .error.message,
                                                                          })}
                                                                />
                                                            )}
                                                        />
                                                    ) : null}
                                                    {assignmentScope === "division" ? (
                                                        <Controller
                                                            control={assignmentForm.control}
                                                            name="divisionId"
                                                            render={({ field, fieldState }) => (
                                                                <Select
                                                                    label="Division"
                                                                    options={divisionItems.map(
                                                                        (division) => ({
                                                                            value: division.id,
                                                                            label: division.name,
                                                                        }),
                                                                    )}
                                                                    value={field.value}
                                                                    onValueChange={field.onChange}
                                                                    placeholder="Select a division"
                                                                    {...(fieldState.error
                                                                        ?.message === undefined
                                                                        ? {}
                                                                        : {
                                                                              error: fieldState
                                                                                  .error.message,
                                                                          })}
                                                                />
                                                            )}
                                                        />
                                                    ) : null}
                                                    <Controller
                                                        control={assignmentForm.control}
                                                        name="rubricId"
                                                        render={({ field, fieldState }) => (
                                                            <Select
                                                                label="Rubric"
                                                                options={rubricItems.map(
                                                                    (rubric) => ({
                                                                        value: rubric.id,
                                                                        label: `${rubric.name} (${String(rubric.criteria.length)} criteria)`,
                                                                    }),
                                                                )}
                                                                value={field.value}
                                                                onValueChange={field.onChange}
                                                                placeholder="Select a rubric"
                                                                {...(fieldState.error?.message ===
                                                                undefined
                                                                    ? {}
                                                                    : {
                                                                          error: fieldState.error
                                                                              .message,
                                                                      })}
                                                            />
                                                        )}
                                                    />
                                                    <FormField
                                                        name="judgeEmail"
                                                        label="Judge email"
                                                        required
                                                    >
                                                        {(field) => (
                                                            <Input
                                                                {...field}
                                                                type="email"
                                                                value={field.value}
                                                                autoComplete="email"
                                                                placeholder="judge@example.com"
                                                            />
                                                        )}
                                                    </FormField>
                                                    <FormField
                                                        name="dueAt"
                                                        label="Due date"
                                                        optionalLabel="optional"
                                                    >
                                                        {(field) => (
                                                            <Input
                                                                {...field}
                                                                type="datetime-local"
                                                                value={field.value}
                                                            />
                                                        )}
                                                    </FormField>
                                                    <FormField
                                                        name="note"
                                                        label="Assignment note"
                                                        optionalLabel="optional"
                                                    >
                                                        {(field) => (
                                                            <Textarea
                                                                {...field}
                                                                value={field.value}
                                                                placeholder="Context the judge needs before starting."
                                                            />
                                                        )}
                                                    </FormField>
                                                    <Button
                                                        type="submit"
                                                        loading={createAssignment.isPending}
                                                    >
                                                        Assign judge
                                                    </Button>
                                                </div>
                                            </Form>
                                        )}
                                        {bulkResult === null ? null : (
                                            <Alert tone="success" title="Bulk assignment complete">
                                                {String(bulkResult.assigned.length)} assigned ·{" "}
                                                {String(bulkResult.skipped)} already assigned and
                                                skipped.
                                            </Alert>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Rubrics</CardTitle>
                                        <CardDescription>
                                            Rubrics available for this edition.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {rubrics.isPending ? (
                                            <LoadingBlock rows={3} label="Loading rubrics" />
                                        ) : rubrics.isError ? (
                                            <RequestError
                                                error={rubrics.error}
                                                onRetry={() => void rubrics.refetch()}
                                            />
                                        ) : rubricItems.length === 0 ? (
                                            <EmptyState
                                                title="No rubrics"
                                                description="A rubric must exist in this edition before judges can be assigned."
                                            />
                                        ) : (
                                            <ul className="flex flex-col gap-3">
                                                {rubricItems.map((rubric) => (
                                                    <li
                                                        key={rubric.id}
                                                        className="flex flex-col gap-1 rounded-md border border-line p-3"
                                                    >
                                                        <span className="text-sm font-medium">
                                                            {rubric.name}
                                                        </span>
                                                        <span className="text-xs text-ink-muted">
                                                            {String(rubric.criteria.length)}{" "}
                                                            criteria
                                                        </span>
                                                        {rubric.description.length === 0 ? null : (
                                                            <span className="text-xs text-ink-subtle">
                                                                {rubric.description}
                                                            </span>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Submissions in this edition</CardTitle>
                                    <CardDescription>
                                        Submissions available in the selected edition.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {submissions.isPending ? (
                                        <LoadingBlock rows={3} label="Loading submissions" />
                                    ) : submissions.isError ? (
                                        <RequestError
                                            error={submissions.error}
                                            onRetry={() => void submissions.refetch()}
                                        />
                                    ) : submissionItems.length === 0 ? (
                                        <EmptyState
                                            title="No submissions"
                                            description="No submissions exist in this edition yet."
                                        />
                                    ) : (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Project</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Version</TableHead>
                                                    <TableHead>Submitted</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {submissionItems.map((submission) => (
                                                    <TableRow key={submission.id}>
                                                        <TableCell>
                                                            <span className="font-medium">
                                                                {submission.projectTitle}
                                                            </span>
                                                            <span className="block text-xs text-ink-subtle">
                                                                {submission.id}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge tone="neutral">
                                                                {humanizeToken(submission.status)}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="tabular-nums">
                                                            {String(submission.currentVersion)}
                                                        </TableCell>
                                                        <TableCell className="text-ink-muted">
                                                            {formatDateTime(submission.submittedAt)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Edition assignments</CardTitle>
                                    <CardDescription>
                                        Every judge assignment in the selected edition.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {assignments.isPending ? (
                                        <LoadingBlock
                                            rows={4}
                                            label="Loading edition assignments"
                                        />
                                    ) : assignments.isError ? (
                                        <RequestError
                                            error={assignments.error}
                                            onRetry={() => void assignments.refetch()}
                                        />
                                    ) : editionAssignments.length === 0 ? (
                                        <EmptyState
                                            title="No assignments in this edition"
                                            description="Create the first assignment using the form above."
                                        />
                                    ) : (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Project</TableHead>
                                                    <TableHead>Judge</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Due</TableHead>
                                                    <TableHead className="text-right">
                                                        Actions
                                                    </TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {editionAssignments.map((assignment) => (
                                                    <TableRow key={assignment.id}>
                                                        <TableCell>
                                                            {assignment.projectTitle}
                                                        </TableCell>
                                                        <TableCell>
                                                            {assignment.judgeDisplayName}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge
                                                                tone={statusTone(assignment.status)}
                                                            >
                                                                {statusLabel(assignment.status)}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-ink-muted">
                                                            {formatDateTime(assignment.dueAt)}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                disabled={
                                                                    assignment.status ===
                                                                        "revoked" ||
                                                                    revokeAssignment.isPending
                                                                }
                                                                onClick={() => onRevoke(assignment)}
                                                            >
                                                                Revoke
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    )}
                                </CardContent>
                            </Card>
                        </>
                    )}
                </section>
            ) : null}
        </div>
    );
}
