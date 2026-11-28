import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { JudgeAssignmentStatus } from "@nethack/contracts";
import {
    Alert,
    AlertDialog,
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    EmptyState,
    EvaluationRubric,
    Form,
    FormField,
    KeyValue,
    LoadingBlock,
    PageHeader,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Textarea,
    useToast,
    type RubricScore,
} from "@nethack/ui";
import { useActiveMembership } from "../../../application/session.js";
import { formatDateTime } from "../../shared/datetime.js";
import { describeError } from "../../shared/errors.js";
import { humanizeToken } from "../../shared/format.js";
import { RequestError } from "../../shared/states.jsx";
import { conflictSchema, flagSchema, type ConflictForm, type FlagForm } from "../forms.js";
import {
    useAssignment,
    useAssignmentHistory,
    useDeclareConflict,
    useFlagAssignment,
    useSaveEvaluation,
    useSubmitEvaluation,
} from "../hooks.js";

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

export function AssignmentDetailPage(): ReactNode {
    const { assignmentId } = useParams<{ assignmentId: string }>();
    const { session, membership } = useActiveMembership();
    const organizationId = membership?.organizationId ?? null;
    const { toast } = useToast();

    const detail = useAssignment(organizationId, assignmentId ?? null);
    const history = useAssignmentHistory(organizationId, assignmentId ?? null);
    const saveEvaluation = useSaveEvaluation(organizationId, assignmentId ?? null);
    const submitEvaluation = useSubmitEvaluation(organizationId, assignmentId ?? null);
    const declareConflict = useDeclareConflict(organizationId, assignmentId ?? null);
    const flagAssignment = useFlagAssignment(organizationId, assignmentId ?? null);

    const [edit, setEdit] = useState<{
        readonly key: string;
        readonly scores: Record<string, RubricScore>;
        readonly comment: string;
    } | null>(null);
    const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
    const [conflictOpen, setConflictOpen] = useState(false);
    const [flagOpen, setFlagOpen] = useState(false);

    const conflictForm = useForm<ConflictForm>({
        resolver: zodResolver(conflictSchema),
        defaultValues: { note: "" },
    });
    const flagForm = useForm<FlagForm>({
        resolver: zodResolver(flagSchema),
        defaultValues: { reason: "" },
    });

    if (session.isPending) {
        return <LoadingBlock rows={4} label="Loading assignment" />;
    }
    if (session.isError) {
        return <RequestError error={session.error} onRetry={() => void session.refetch()} />;
    }
    if (membership === null || organizationId === null) {
        return (
            <EmptyState
                title="No active organization"
                description="Select an organization membership to view this assignment."
            />
        );
    }
    if (assignmentId === undefined) {
        return (
            <EmptyState
                title="Assignment not found"
                description="The route does not include a judging assignment identifier."
            />
        );
    }
    if (detail.isPending) {
        return <LoadingBlock rows={6} label="Loading assignment" />;
    }
    if (detail.isError) {
        return (
            <div className="flex flex-col gap-4">
                <RequestError error={detail.error} onRetry={() => void detail.refetch()} />
                <div>
                    <Button variant="outline" asChild>
                        <Link to="/judging">Back to judging</Link>
                    </Button>
                </div>
            </div>
        );
    }
    if (detail.data === null) {
        return (
            <EmptyState
                title="Assignment not found"
                description="This assignment does not exist in the active organization."
                action={
                    <Button variant="outline" asChild>
                        <Link to="/judging">Back to judging</Link>
                    </Button>
                }
            />
        );
    }

    const { assignment, criteria, submission, evaluation } = detail.data;
    const evaluationKey = evaluation?.id ?? `${assignment.id}-new`;
    const serverScores: Record<string, RubricScore> = {};
    for (const score of evaluation?.scores ?? []) {
        serverScores[score.criterionId] = { score: score.score, comment: score.comment };
    }
    const scores = edit !== null && edit.key === evaluationKey ? edit.scores : serverScores;
    const overallComment =
        edit !== null && edit.key === evaluationKey
            ? edit.comment
            : (evaluation?.overallComment ?? "");
    const setScores = (next: Record<string, RubricScore>): void => {
        setEdit({ key: evaluationKey, scores: next, comment: overallComment });
    };
    const setOverallComment = (next: string): void => {
        setEdit({ key: evaluationKey, scores, comment: next });
    };
    const canEvaluate = assignment.status === "assigned" || assignment.status === "in_progress";
    const submitted = evaluation?.status === "submitted";
    const hasScores = criteria.some((criterion) => scores[criterion.id] !== undefined);

    const onSave = async (): Promise<void> => {
        if (criteria.length === 0) {
            return;
        }
        try {
            await saveEvaluation.mutateAsync({
                scores: criteria.map((criterion) => ({
                    criterionId: criterion.id,
                    score: scores[criterion.id]?.score ?? 0,
                    comment: scores[criterion.id]?.comment ?? "",
                })),
                overallComment,
            });
            toast({ title: "Draft saved", tone: "success" });
        } catch (error) {
            toast({
                title: "Could not save the evaluation",
                description: describeError(error),
                tone: "critical",
            });
        }
    };

    const onSubmit = async (): Promise<void> => {
        try {
            await submitEvaluation.mutateAsync();
            setConfirmSubmitOpen(false);
            toast({ title: "Evaluation submitted", tone: "success" });
        } catch (error) {
            setConfirmSubmitOpen(false);
            toast({
                title: "Could not submit the evaluation",
                description: describeError(error),
                tone: "critical",
            });
        }
    };

    const onDeclareConflict = conflictForm.handleSubmit(async (values) => {
        try {
            await declareConflict.mutateAsync({ note: values.note });
            setConflictOpen(false);
            conflictForm.reset({ note: "" });
            toast({ title: "Recusal recorded", tone: "success" });
        } catch (error) {
            toast({
                title: "Could not record the recusal",
                description: describeError(error),
                tone: "critical",
            });
        }
    });

    const onFlag = flagForm.handleSubmit(async (values) => {
        try {
            await flagAssignment.mutateAsync({ reason: values.reason });
            setFlagOpen(false);
            flagForm.reset({ reason: "" });
            toast({ title: "Flag reported to the organizers", tone: "success" });
        } catch (error) {
            toast({
                title: "Could not report the flag",
                description: describeError(error),
                tone: "critical",
            });
        }
    });

    return (
        <div className="flex flex-col gap-6">
            <div>
                <Button variant="ghost" size="sm" asChild>
                    <Link to="/judging">Back to judging</Link>
                </Button>
            </div>

            <PageHeader
                title={submission.projectTitle}
                description={`Assignment ${assignment.id}`}
                actions={
                    <Badge tone={statusTone(assignment.status)}>
                        {statusLabel(assignment.status)}
                    </Badge>
                }
            />

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="flex min-w-0 flex-col gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Rubric scoring</CardTitle>
                            <CardDescription>
                                {criteria.length === 0
                                    ? "This rubric has no criteria."
                                    : "Scores are saved as a draft until you submit the evaluation."}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {submitted || !canEvaluate ? (
                                <ReadOnlyScores
                                    criteria={criteria}
                                    scores={scores}
                                    evaluationStatus={evaluation?.status ?? null}
                                />
                            ) : (
                                <div className="flex flex-col gap-4">
                                    <EvaluationRubric
                                        criteria={criteria.map((criterion) => ({
                                            id: criterion.id,
                                            label: criterion.name,
                                            description: criterion.description,
                                            maxScore: criterion.maxScore,
                                            weight: criterion.weight,
                                        }))}
                                        scores={scores}
                                        onChange={setScores}
                                    />
                                    <FormFieldForComment
                                        value={overallComment}
                                        onChange={setOverallComment}
                                    />
                                    <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            loading={saveEvaluation.isPending}
                                            disabled={!hasScores}
                                            onClick={() => void onSave()}
                                        >
                                            Save draft
                                        </Button>
                                        <Button
                                            type="button"
                                            loading={submitEvaluation.isPending}
                                            disabled={
                                                evaluation?.status !== "draft" ||
                                                submitEvaluation.isPending
                                            }
                                            onClick={() => setConfirmSubmitOpen(true)}
                                        >
                                            Submit evaluation
                                        </Button>
                                        {evaluation?.status === "draft" ? (
                                            <span className="self-center text-xs text-ink-muted">
                                                Save the draft, then submit it.
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Evaluation history</CardTitle>
                            <CardDescription>
                                Every saved revision of this evaluation, newest first.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {history.isPending ? (
                                <LoadingBlock rows={2} label="Loading evaluation history" />
                            ) : history.isError ? (
                                <RequestError
                                    error={history.error}
                                    onRetry={() => void history.refetch()}
                                />
                            ) : history.data?.evaluation === null ||
                              history.data?.evaluation === undefined ? (
                                <EmptyState
                                    title="No evaluation yet"
                                    description="A draft record appears here after the first save."
                                />
                            ) : (
                                <div className="flex flex-col gap-6">
                                    <KeyValue
                                        columns={2}
                                        items={[
                                            {
                                                label: "Status",
                                                value: humanizeToken(
                                                    history.data.evaluation.status,
                                                ),
                                            },
                                            {
                                                label: "Weighted score",
                                                value:
                                                    history.data.evaluation.weightedScore === null
                                                        ? "Not calculated"
                                                        : `${String(history.data.evaluation.weightedScore)}%`,
                                            },
                                            {
                                                label: "Last updated",
                                                value: formatDateTime(
                                                    history.data.evaluation.updatedAt,
                                                ),
                                            },
                                            {
                                                label: "Submitted",
                                                value: formatDateTime(
                                                    history.data.evaluation.submittedAt,
                                                ),
                                            },
                                        ]}
                                    />
                                    {history.data.versions.length === 0 ? null : (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Revision</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Score</TableHead>
                                                    <TableHead>Saved</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {[...history.data.versions]
                                                    .toSorted(
                                                        (left, right) =>
                                                            right.revision - left.revision,
                                                    )
                                                    .map((version) => (
                                                        <TableRow key={version.revision}>
                                                            <TableCell className="tabular-nums">
                                                                {String(version.revision)}
                                                            </TableCell>
                                                            <TableCell>
                                                                {humanizeToken(version.status)}
                                                            </TableCell>
                                                            <TableCell className="tabular-nums">
                                                                {version.weightedScore === null
                                                                    ? "Not calculated"
                                                                    : `${String(version.weightedScore)}%`}
                                                            </TableCell>
                                                            <TableCell className="text-ink-muted">
                                                                {formatDateTime(version.createdAt)}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                            </TableBody>
                                        </Table>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <aside className="flex flex-col gap-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Assignment</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <KeyValue
                                columns={1}
                                items={[
                                    { label: "Judge", value: assignment.judgeDisplayName },
                                    { label: "Due", value: formatDateTime(assignment.dueAt) },
                                    {
                                        label: "Assigned",
                                        value: formatDateTime(assignment.assignedAt),
                                    },
                                    {
                                        label: "Note",
                                        value:
                                            assignment.assignmentNote.length === 0
                                                ? "No note"
                                                : assignment.assignmentNote,
                                    },
                                ]}
                            />
                        </CardContent>
                    </Card>

                    {assignment.conflictNote === null ? null : (
                        <Alert tone="warning" title="Conflict declared">
                            {assignment.conflictNote}
                        </Alert>
                    )}

                    {canEvaluate && assignment.conflictNote === null ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>Recusal</CardTitle>
                                <CardDescription>
                                    Recuse yourself if you cannot evaluate this submission fairly.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setConflictOpen(true)}
                                >
                                    Recuse from this project
                                </Button>
                            </CardContent>
                        </Card>
                    ) : null}

                    {assignment.status === "conflict_declared" ||
                    assignment.status === "revoked" ? null : (
                        <Card>
                            <CardHeader>
                                <CardTitle>Report a concern</CardTitle>
                                <CardDescription>
                                    Flag this project so organizers can review a rules question or
                                    missing information.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setFlagOpen(true)}
                                >
                                    Flag for organizers
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </aside>
            </div>

            <AlertDialog
                open={confirmSubmitOpen}
                onOpenChange={setConfirmSubmitOpen}
                title="Submit evaluation"
                description="Submitted evaluations cannot be edited. Review the scores and comments before continuing."
                confirmLabel="Submit evaluation"
                loading={submitEvaluation.isPending}
                onConfirm={onSubmit}
            />

            <Dialog open={conflictOpen} onOpenChange={setConflictOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Recuse from this project</DialogTitle>
                        <DialogDescription>
                            The organizer sees this note and can reassign the submission.
                        </DialogDescription>
                    </DialogHeader>
                    <Form form={conflictForm} onSubmit={onDeclareConflict}>
                        <div className="flex flex-col gap-4">
                            <FormField name="note" label="Recusal note" required>
                                {(field) => (
                                    <Textarea
                                        {...field}
                                        value={field.value}
                                        placeholder="Explain the relationship or circumstance that prevents a fair evaluation."
                                    />
                                )}
                            </FormField>
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setConflictOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" loading={declareConflict.isPending}>
                                    Recuse from this project
                                </Button>
                            </DialogFooter>
                        </div>
                    </Form>
                </DialogContent>
            </Dialog>

            <Dialog open={flagOpen} onOpenChange={setFlagOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Flag this project for organizers</DialogTitle>
                        <DialogDescription>
                            Use this for a concern that needs organizer review, such as a rules
                            question or missing information.
                        </DialogDescription>
                    </DialogHeader>
                    <Form form={flagForm} onSubmit={onFlag}>
                        <div className="flex flex-col gap-4">
                            <FormField name="reason" label="Reason" required>
                                {(field) => (
                                    <Textarea
                                        {...field}
                                        value={field.value}
                                        placeholder="Describe what the organizers should review."
                                    />
                                )}
                            </FormField>
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setFlagOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" loading={flagAssignment.isPending}>
                                    Report flag
                                </Button>
                            </DialogFooter>
                        </div>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function FormFieldForComment({
    value,
    onChange,
}: {
    readonly value: string;
    readonly onChange: (value: string) => void;
}): ReactNode {
    const [id] = useState(() => `overall-comment-${Math.random().toString(36).slice(2)}`);
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-sm font-medium text-ink">
                Overall comment
            </label>
            <Textarea
                id={id}
                value={value}
                onChange={(event) => onChange(event.currentTarget.value)}
                placeholder="Summarize the evaluation for the organizer."
            />
        </div>
    );
}

function ReadOnlyScores({
    criteria,
    scores,
    evaluationStatus,
}: {
    readonly criteria: readonly {
        readonly id: string;
        readonly name: string;
        readonly description: string;
        readonly maxScore: number;
        readonly weight: number;
        readonly position: number;
    }[];
    readonly scores: Readonly<Record<string, RubricScore>>;
    readonly evaluationStatus: "draft" | "submitted" | null;
}): ReactNode {
    if (evaluationStatus === null) {
        return (
            <EmptyState
                title="Evaluation not available"
                description="This assignment can no longer be evaluated."
            />
        );
    }
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Criterion</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Comment</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {criteria.map((criterion) => {
                    const score = scores[criterion.id];
                    return (
                        <TableRow key={criterion.id}>
                            <TableCell>{criterion.name}</TableCell>
                            <TableCell className="tabular-nums">
                                {String(score?.score ?? 0)} / {String(criterion.maxScore)}
                            </TableCell>
                            <TableCell className="text-ink-muted">
                                {score?.comment === undefined || score.comment.length === 0
                                    ? "No comment"
                                    : score.comment}
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
}
