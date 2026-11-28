import {
    useEffect,
    useRef,
    useState,
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent,
    type ReactNode,
} from "react";
import { Link, useBlocker, useParams } from "react-router";
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
    Form,
    FormField,
    KeyValue,
    LoadingBlock,
    Markdown,
    PageHeader,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Textarea,
    useMediaQuery,
    useToast,
} from "@nethack/ui";
import { useActiveMembership } from "../../../application/session.js";
import { formatDateTime } from "../../shared/datetime.js";
import { describeError } from "../../shared/errors.js";
import { humanizeToken } from "../../shared/format.js";
import { RequestError } from "../../shared/states.jsx";
import {
    isValidCriterionScore,
    RubricScoringForm,
    type RubricDraftScore,
} from "../components/rubric-scoring-form.js";
import { conflictSchema, flagSchema, type ConflictForm, type FlagForm } from "../forms.js";
import { judgeCommentIssue } from "../judge-comments.js";
import { safeExternalUrl } from "../media.js";
import { curveScore, weightedRubricScore } from "../scoring.js";
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

const AUTOSAVE_DEBOUNCE_MS = 650;

type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

interface EvaluationDraftEdit {
    readonly key: string;
    readonly scores: Record<string, RubricDraftScore>;
    readonly comment: string;
}

interface AutosaveDraft {
    readonly key: string;
    readonly scores: Record<string, RubricDraftScore>;
    readonly comment: string;
}

interface SaveState {
    readonly key: string | null;
    readonly status: SaveStatus;
    readonly savedAt: number | null;
    readonly error: string | null;
    readonly dirty: boolean;
}

function formatTimeOfDay(value: number): string {
    return new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).format(value);
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

    const loaded = detail.data ?? null;
    const draftKey = loaded?.assignment.id ?? null;
    const criteria = loaded?.criteria ?? [];
    const evaluation = loaded?.evaluation ?? null;
    const serverScores: Record<string, RubricDraftScore> = {};
    for (const score of evaluation?.scores ?? []) {
        serverScores[score.criterionId] = { score: score.score, comment: score.comment };
    }
    const judgeIdentity = {
        displayName: session.data?.user.displayName ?? "",
        email: session.data?.user.email ?? null,
    };

    const [edit, setEdit] = useState<EvaluationDraftEdit | null>(null);
    const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
    const [conflictOpen, setConflictOpen] = useState(false);
    const [flagOpen, setFlagOpen] = useState(false);
    const [manualSaving, setManualSaving] = useState(false);
    const [saveState, setSaveState] = useState<SaveState>({
        key: draftKey,
        status: "idle",
        savedAt: null,
        error: null,
        dirty: false,
    });

    const dirtyRef = useRef(false);
    const revisionRef = useRef(0);
    const autosaveDraftRef = useRef<AutosaveDraft | null>(null);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inFlightRef = useRef<Promise<boolean> | null>(null);
    const lastSaveErrorRef = useRef<string | null>(null);
    const mountedRef = useRef(true);
    const activeDraftKeyRef = useRef<string | null>(draftKey);
    const flushRef = useRef<() => Promise<boolean>>(async () => true);

    const currentSave = saveState.key === draftKey ? saveState : null;
    const dirty = currentSave?.dirty ?? false;
    const saveStatus = currentSave?.status ?? "idle";
    const savedAt = currentSave?.savedAt ?? null;
    const saveError = currentSave?.error ?? null;

    const draft = edit !== null && draftKey !== null && edit.key === draftKey ? edit : null;
    const scores = draft?.scores ?? serverScores;
    const overallComment = draft?.comment ?? evaluation?.overallComment ?? "";
    const scoresComplete =
        criteria.length > 0 &&
        criteria.every((criterion) =>
            isValidCriterionScore(criterion, scores[criterion.id]?.score),
        );
    const commentIssue = judgeCommentIssue(overallComment, judgeIdentity);
    const commentError = overallComment.trim().length === 0 ? null : commentIssue;
    const serverSavedAt = evaluation === null ? null : Date.parse(evaluation.updatedAt);
    const displaySavedAt =
        savedAt ?? (serverSavedAt !== null && !Number.isNaN(serverSavedAt) ? serverSavedAt : null);

    const updateSaveState = (
        patch: Partial<Pick<SaveState, "status" | "savedAt" | "error" | "dirty">>,
    ): void => {
        if (draftKey === null || activeDraftKeyRef.current !== draftKey) {
            return;
        }
        setSaveState((previous) =>
            previous.key === draftKey
                ? { ...previous, ...patch }
                : {
                      key: draftKey,
                      status: "idle",
                      savedAt: null,
                      error: null,
                      dirty: false,
                      ...patch,
                  },
        );
    };

    const clearSaveTimer = (): void => {
        if (saveTimerRef.current !== null) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
    };

    const isSaveableDraft = (
        nextScores: Readonly<Record<string, RubricDraftScore>>,
        nextComment: string,
    ): boolean =>
        criteria.length > 0 &&
        criteria.every((criterion) =>
            isValidCriterionScore(criterion, nextScores[criterion.id]?.score),
        ) &&
        judgeCommentIssue(nextComment, judgeIdentity) === null;

    const buildScoresPayload = (current: AutosaveDraft) => {
        const payload = criteria.flatMap((criterion) => {
            const entry = current.scores[criterion.id];
            const score = entry?.score;
            if (!isValidCriterionScore(criterion, score)) {
                return [];
            }
            return [{ criterionId: criterion.id, score, comment: entry?.comment ?? "" }];
        });
        return payload.length === criteria.length ? payload : null;
    };

    const scheduleAutosave = (): void => {
        clearSaveTimer();
        saveTimerRef.current = setTimeout(() => {
            saveTimerRef.current = null;
            void flushRef.current();
        }, AUTOSAVE_DEBOUNCE_MS);
    };

    const flushDraft = async (): Promise<boolean> => {
        clearSaveTimer();
        const active = inFlightRef.current;
        if (active !== null) {
            const previousSaved = await active;
            if (!previousSaved) {
                return false;
            }
            if (!dirtyRef.current) {
                return true;
            }
            return flushDraft();
        }
        if (!dirtyRef.current) {
            return true;
        }
        const current = autosaveDraftRef.current;
        if (current === null || current.key !== draftKey) {
            autosaveDraftRef.current = null;
            dirtyRef.current = false;
            return true;
        }
        if (!isSaveableDraft(current.scores, current.comment)) {
            return false;
        }
        const payload = buildScoresPayload(current);
        if (payload === null) {
            return false;
        }
        const revision = revisionRef.current;
        updateSaveState({ status: "saving" });
        const request = (async (): Promise<boolean> => {
            try {
                await saveEvaluation.mutateAsync({
                    scores: payload,
                    overallComment: current.comment,
                });
                if (mountedRef.current && activeDraftKeyRef.current === draftKey) {
                    lastSaveErrorRef.current = null;
                    if (revisionRef.current === revision) {
                        dirtyRef.current = false;
                        updateSaveState({
                            status: "saved",
                            savedAt: Date.now(),
                            error: null,
                            dirty: false,
                        });
                    } else {
                        updateSaveState({ status: "unsaved", error: null });
                        scheduleAutosave();
                    }
                }
                return true;
            } catch (error) {
                const message = describeError(error);
                lastSaveErrorRef.current = message;
                if (mountedRef.current && activeDraftKeyRef.current === draftKey) {
                    updateSaveState({ status: "error", error: message, dirty: true });
                }
                return false;
            } finally {
                inFlightRef.current = null;
            }
        })();
        inFlightRef.current = request;
        return request;
    };

    const queueDraftChange = (
        nextScores: Record<string, RubricDraftScore>,
        nextComment: string,
    ): void => {
        if (draftKey === null) {
            return;
        }
        autosaveDraftRef.current = { key: draftKey, scores: nextScores, comment: nextComment };
        revisionRef.current += 1;
        dirtyRef.current = true;
        lastSaveErrorRef.current = null;
        updateSaveState({ status: "unsaved", error: null, dirty: true });
        if (!isSaveableDraft(nextScores, nextComment)) {
            clearSaveTimer();
            return;
        }
        scheduleAutosave();
    };

    const setScores = (next: Record<string, RubricDraftScore>): void => {
        if (draftKey === null) {
            return;
        }
        setEdit({ key: draftKey, scores: next, comment: overallComment });
        queueDraftChange(next, overallComment);
    };

    const setOverallComment = (next: string): void => {
        if (draftKey === null) {
            return;
        }
        setEdit({ key: draftKey, scores, comment: next });
        queueDraftChange(scores, next);
    };

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (saveTimerRef.current !== null) {
                clearTimeout(saveTimerRef.current);
                saveTimerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        activeDraftKeyRef.current = draftKey;
    }, [draftKey]);

    useEffect(() => {
        if (!dirty) {
            return;
        }
        const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [dirty]);

    useEffect(() => {
        flushRef.current = flushDraft;
    });

    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            dirty &&
            scoresComplete &&
            commentIssue === null &&
            currentLocation.pathname !== nextLocation.pathname,
    );

    useEffect(() => {
        if (blocker.state !== "blocked") {
            return;
        }
        const blocked = blocker;
        let cancelled = false;
        void (async () => {
            const flushed = await flushRef.current();
            if (cancelled) {
                return;
            }
            if (flushed) {
                blocked.proceed();
            } else {
                blocked.reset();
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [blocker]);

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
    if (loaded === null) {
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

    const { assignment, rubric, submission, scoreCurve, frozen } = loaded;
    const videoUrl = safeExternalUrl(submission.videoUrl);
    const repositoryUrl = safeExternalUrl(submission.repositoryUrl);
    const demoUrl = safeExternalUrl(submission.demoUrl);
    const canEvaluate =
        (assignment.status === "assigned" || assignment.status === "in_progress") && !frozen;
    const submitted = evaluation?.status === "submitted";
    const previewScores: Record<string, { score: number; comment?: string }> = {};
    for (const criterion of criteria) {
        const score = scores[criterion.id]?.score;
        if (isValidCriterionScore(criterion, score)) {
            previewScores[criterion.id] = { score };
        }
    }
    const rawPreview = weightedRubricScore(criteria, previewScores);
    const displayPreview = rawPreview === null ? null : curveScore(rawPreview, scoreCurve.points);
    const trackLabel = assignment.divisionName ?? "Edition-wide";
    const submissionState = humanizeToken(submission.submissionStatus);

    const onSave = async (): Promise<void> => {
        if (!scoresComplete) {
            return;
        }
        setManualSaving(true);
        const saved = await flushDraft();
        setManualSaving(false);
        if (saved) {
            toast({ title: "Draft saved", tone: "success" });
        } else {
            toast({
                title: "Could not save the evaluation",
                description: lastSaveErrorRef.current ?? "The draft could not be saved.",
                tone: "critical",
            });
        }
    };

    const onSubmit = async (): Promise<void> => {
        const flushed = await flushDraft();
        if (!flushed) {
            setConfirmSubmitOpen(false);
            toast({
                title: "Could not save the latest draft",
                description:
                    lastSaveErrorRef.current ??
                    "Finish every criterion and the overall comment, then try again.",
                tone: "critical",
            });
            return;
        }
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
                description={`${submission.teamName ?? "No team"} · ${trackLabel} · Assignment ${assignment.id}`}
                actions={
                    <Badge tone={statusTone(assignment.status)}>
                        {statusLabel(assignment.status)}
                    </Badge>
                }
            />

            {frozen ? (
                <Alert tone="warning" title="Results are published">
                    This edition is completed, so judging is read-only. Saved scores and history
                    remain available.
                </Alert>
            ) : null}

            <div className="flex min-w-0 flex-col gap-6">
                <SplitWorkspace
                    context={
                        <>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Project context</CardTitle>
                                    <CardDescription>
                                        The submission details, links, and AI-use disclosure the
                                        team provided.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-4">
                                    <KeyValue
                                        columns={2}
                                        items={[
                                            {
                                                label: "Team",
                                                value: submission.teamName ?? "No team",
                                            },
                                            { label: "Track", value: trackLabel },
                                            { label: "Submission", value: submissionState },
                                        ]}
                                    />
                                    {submission.descriptionMarkdown.trim().length === 0 ? null : (
                                        <div className="flex flex-col gap-1">
                                            <h3 className="text-sm font-medium text-ink">
                                                Project description
                                            </h3>
                                            <div className="prose-nethack">
                                                <Markdown source={submission.descriptionMarkdown} />
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex flex-wrap gap-4">
                                        <div className="flex flex-col gap-1">
                                            <h3 className="text-sm font-medium text-ink">
                                                Repository
                                            </h3>
                                            {repositoryUrl === null ? (
                                                <p className="text-sm text-ink-muted">
                                                    No repository link was provided.
                                                </p>
                                            ) : (
                                                <a
                                                    href={repositoryUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm text-primary underline-offset-4 hover:underline"
                                                >
                                                    Open repository
                                                </a>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <h3 className="text-sm font-medium text-ink">Demo</h3>
                                            {demoUrl === null ? (
                                                <p className="text-sm text-ink-muted">
                                                    No demo link was provided.
                                                </p>
                                            ) : (
                                                <a
                                                    href={demoUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm text-primary underline-offset-4 hover:underline"
                                                >
                                                    Open demo
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <h3 className="text-sm font-medium text-ink">
                                            Demonstration video
                                        </h3>
                                        {videoUrl === null ? (
                                            <p className="text-sm text-ink-muted">
                                                No demonstration video link was provided.
                                            </p>
                                        ) : (
                                            <a
                                                href={videoUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm text-primary underline-offset-4 hover:underline"
                                            >
                                                Watch demonstration video
                                            </a>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <h3 className="text-sm font-medium text-ink">
                                            AI-use disclosure
                                        </h3>
                                        {submission.aiDisclosure.trim().length === 0 ? (
                                            <p className="text-sm text-ink-muted">
                                                No AI-use disclosure was recorded.
                                            </p>
                                        ) : (
                                            <p className="whitespace-pre-wrap text-sm text-ink">
                                                {submission.aiDisclosure}
                                            </p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    }
                    scoring={
                        <Card>
                            <CardHeader>
                                <CardTitle>Rubric scoring</CardTitle>
                                <CardDescription>
                                    {rubric.name} · version {rubric.version} ·{" "}
                                    {criteria.length === 0
                                        ? "no criteria"
                                        : "scores are saved as a draft until you submit the evaluation"}
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
                                        <RubricScoringForm
                                            criteria={criteria}
                                            guidance={rubric.commentGuidance}
                                            scores={scores}
                                            overallComment={overallComment}
                                            rawScore={rawPreview}
                                            displayScore={displayPreview}
                                            onChange={setScores}
                                            onOverallCommentChange={setOverallComment}
                                            commentError={commentError}
                                        />
                                        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                loading={manualSaving}
                                                disabled={!scoresComplete || commentIssue !== null}
                                                onClick={() => void onSave()}
                                            >
                                                Save draft
                                            </Button>
                                            <Button
                                                type="button"
                                                loading={submitEvaluation.isPending}
                                                disabled={
                                                    evaluation?.status !== "draft" ||
                                                    submitEvaluation.isPending ||
                                                    commentIssue !== null
                                                }
                                                onClick={() => setConfirmSubmitOpen(true)}
                                            >
                                                Submit evaluation
                                            </Button>
                                            <SaveStateIndicator
                                                status={saveStatus}
                                                savedAt={displaySavedAt}
                                                error={saveError}
                                                onRetry={() => void flushDraft()}
                                            />
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    }
                />

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
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
                                                label: "Display score",
                                                value:
                                                    history.data.displayWeightedScore === null
                                                        ? "Not calculated"
                                                        : `${String(history.data.displayWeightedScore)} / 100`,
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
                                        { label: "Team", value: assignment.teamName ?? "No team" },
                                        { label: "Track", value: trackLabel },
                                        { label: "Submission", value: submissionState },
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
                                        Recuse yourself if you cannot evaluate this submission
                                        fairly.
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
                                        Flag this project so organizers can review a rules question
                                        or missing information.
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

const SPLIT_MIN = 30;
const SPLIT_MAX = 70;

function clampSplit(value: number): number {
    return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, value));
}

function SplitWorkspace({
    context,
    scoring,
}: {
    readonly context: ReactNode;
    readonly scoring: ReactNode;
}): ReactNode {
    const isDesktop = useMediaQuery("(min-width: 64rem)");
    const containerRef = useRef<HTMLDivElement | null>(null);
    const draggingRef = useRef(false);
    const [split, setSplit] = useState(50);

    const updateFromPointer = (clientX: number): void => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect === undefined || rect.width === 0) {
            return;
        }
        setSplit(clampSplit(((clientX - rect.left) / rect.width) * 100));
    };

    const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
        if (event.button !== 0) {
            return;
        }
        event.preventDefault();
        draggingRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        updateFromPointer(event.clientX);
    };

    const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
        if (draggingRef.current) {
            updateFromPointer(event.clientX);
        }
    };

    const stopDragging = (event: ReactPointerEvent<HTMLDivElement>): void => {
        if (!draggingRef.current) {
            return;
        }
        draggingRef.current = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            setSplit((value) => clampSplit(value - 2));
        } else if (event.key === "ArrowRight") {
            event.preventDefault();
            setSplit((value) => clampSplit(value + 2));
        } else if (event.key === "Home") {
            event.preventDefault();
            setSplit(SPLIT_MIN);
        } else if (event.key === "End") {
            event.preventDefault();
            setSplit(SPLIT_MAX);
        }
    };

    return (
        <div
            ref={containerRef}
            className="flex min-w-0 flex-col gap-4 break-words lg:grid lg:h-[calc(100dvh_-_17rem)] lg:min-h-[24rem] lg:gap-2"
            style={{ gridTemplateColumns: `${String(split)}% 0.5rem minmax(0, 1fr)` }}
        >
            <div className="flex min-w-0 flex-col gap-4 lg:min-h-0 lg:overflow-y-auto">
                {context}
            </div>
            {isDesktop ? (
                <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize project context and scoring panes"
                    aria-valuemin={SPLIT_MIN}
                    aria-valuemax={SPLIT_MAX}
                    aria-valuenow={Math.round(split)}
                    aria-valuetext={`${String(Math.round(split))}% project context`}
                    title="Drag to resize; use the arrow keys"
                    tabIndex={0}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={stopDragging}
                    onPointerCancel={stopDragging}
                    onLostPointerCapture={stopDragging}
                    onKeyDown={onKeyDown}
                    className="group flex w-2 shrink-0 cursor-col-resize touch-none items-center justify-center self-stretch rounded-sm bg-line transition-colors hover:bg-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                    <span
                        aria-hidden="true"
                        className="h-10 w-1 rounded-full bg-ink-subtle transition-colors group-hover:bg-primary"
                    />
                </div>
            ) : null}
            <div className="flex min-w-0 flex-col gap-4 lg:min-h-0 lg:overflow-y-auto">
                {scoring}
            </div>
        </div>
    );
}

function SaveStateIndicator({
    status,
    savedAt,
    error,
    onRetry,
}: {
    readonly status: SaveStatus;
    readonly savedAt: number | null;
    readonly error: string | null;
    readonly onRetry: () => void;
}): ReactNode {
    if (status === "error") {
        return (
            <span role="alert" className="flex items-center gap-2 self-center text-xs text-ink">
                <span title={error ?? undefined}>Save failed</span>
                <Button type="button" variant="ghost" size="sm" onClick={onRetry}>
                    Retry save
                </Button>
            </span>
        );
    }
    if (status === "saving") {
        return (
            <span role="status" className="self-center text-xs text-ink-muted">
                Saving...
            </span>
        );
    }
    if (savedAt !== null && (status === "saved" || status === "idle")) {
        return (
            <span role="status" className="self-center text-xs text-ink-muted">
                Draft saved at {formatTimeOfDay(savedAt)}
            </span>
        );
    }
    if (status === "unsaved") {
        return (
            <span role="status" className="self-center text-xs text-ink-muted">
                Unsaved changes
            </span>
        );
    }
    return null;
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
    readonly scores: Readonly<Record<string, RubricDraftScore>>;
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
                                {score?.score === undefined
                                    ? "Not scored"
                                    : `${String(score.score)} / ${String(criterion.maxScore)}`}
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
