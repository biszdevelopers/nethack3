import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { JudgeAssignment, JudgeAssignmentStatus } from "@nethack/contracts";
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
    Select,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
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
import { RubricBuilder } from "../capabilities/judging/components/rubric-builder.js";
import { useOrganizerEditions } from "../capabilities/competitions/hooks.js";
import {
    useCreateAssignment,
    useEditionAssignments,
    useEditionRubrics,
    useEditionSubmissions,
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
    const myAssignments = useMyAssignments(
        organizationId,
        statusParam === "all" ? undefined : statusParam,
    );

    const organizerEditions = useOrganizerEditions(organizationId, isOrganizer);
    const editionId = searchParams.get("edition");
    const rubrics = useEditionRubrics(organizationId, isOrganizer ? editionId : null);
    const assignments = useEditionAssignments(organizationId, isOrganizer ? editionId : null);
    const submissions = useEditionSubmissions(
        organizationId,
        isOrganizer ? editionId : null,
        isOrganizer,
    );

    const createAssignment = useCreateAssignment(organizationId, editionId);
    const revokeAssignment = useRevokeAssignment(organizationId, editionId);

    const assignmentForm = useForm<AssignmentForm>({
        resolver: zodResolver(assignmentSchema),
        defaultValues: {
            submissionId: "",
            rubricId: "",
            judgeEmail: "",
            dueAt: "",
            note: "",
        },
    });

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

    const myItems = myAssignments.data?.items ?? [];
    const editionAssignments = assignments.data?.items ?? [];
    const rubricItems = rubrics.data?.items ?? [];
    const submissionItems = submissions.data?.items ?? [];
    const selectedEdition =
        organizerEditions.editions.find((edition) => edition.id === editionId) ?? null;

    const setEdition = (next: string): void => {
        const params = new URLSearchParams(searchParams);
        params.set("edition", next);
        setSearchParams(params, { replace: true });
        assignmentForm.reset({
            submissionId: "",
            rubricId: "",
            judgeEmail: "",
            dueAt: "",
            note: "",
        });
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
            await createAssignment.mutateAsync({
                submissionId: values.submissionId,
                judgeEmail: values.judgeEmail,
                rubricId: values.rubricId,
                dueAt,
                note: values.note,
            });
            assignmentForm.reset({
                submissionId: "",
                rubricId: "",
                judgeEmail: "",
                dueAt: "",
                note: "",
            });
            toast({ title: "Assignment created", tone: "success" });
        } catch (error) {
            toast({
                title: "Could not create the assignment",
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

            <section className="flex flex-col gap-4" aria-labelledby="my-assignments-heading">
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
                    <div className="w-48">
                        <Select
                            label="Filter by status"
                            options={STATUS_OPTIONS}
                            value={statusParam}
                            onValueChange={setStatus}
                        />
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
                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Project</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Due</TableHead>
                                    <TableHead>Assigned</TableHead>
                                    <TableHead className="text-right">Open</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {myItems.map((assignment) => (
                                    <TableRow key={assignment.id}>
                                        <TableCell>
                                            <span className="font-medium">
                                                {assignment.projectTitle}
                                            </span>
                                            <span className="block text-xs text-ink-subtle">
                                                {assignment.id}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge tone={statusTone(assignment.status)}>
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
                                            <Button variant="outline" size="sm" asChild>
                                                <Link to={`/judging/assignments/${assignment.id}`}>
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

            {isOrganizer ? (
                <section
                    className="flex flex-col gap-4 border-t border-line pt-6"
                    aria-labelledby="assignment-management-heading"
                >
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
                                                        Create assignment
                                                    </Button>
                                                </div>
                                            </Form>
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
