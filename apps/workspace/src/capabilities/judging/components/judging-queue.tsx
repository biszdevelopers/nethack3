import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useForm } from "react-hook-form";
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
    Progress,
    Textarea,
    useToast,
} from "@nethack/ui";
import { formatDateTime } from "../../shared/datetime.js";
import { describeError } from "../../shared/errors.js";
import { RequestError } from "../../shared/states.jsx";
import { conflictSchema, flagSchema, type ConflictForm, type FlagForm } from "../forms.js";
import { useDeclareConflict, useFlagAssignment } from "../hooks.js";
import { safeExternalUrl } from "../media.js";

function statusTone(status: JudgeAssignmentStatus): "neutral" | "primary" | "outline" | "critical" {
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
            return "Recused";
        case "revoked":
            return "Revoked";
    }
}

function isPending(status: JudgeAssignmentStatus): boolean {
    return status === "assigned" || status === "in_progress";
}

export function JudgingQueue({
    organizationId,
    items,
    isPending: loading,
    error,
    onRetry,
    frozen = false,
}: {
    readonly organizationId: string;
    readonly items: readonly JudgeAssignment[];
    readonly isPending: boolean;
    readonly error: unknown;
    readonly onRetry: () => void;
    readonly frozen?: boolean;
}): ReactNode {
    const { toast } = useToast();
    const [selected, setSelected] = useState<number | null>(null);
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

    const trackedItems = items.filter((item) => item.status !== "revoked");
    const submittedCount = trackedItems.filter((item) => item.status === "submitted").length;
    const firstPending = items.findIndex((item) => isPending(item.status));
    const preferred = selected ?? (firstPending === -1 ? 0 : firstPending);
    const activeIndex = items.length === 0 ? 0 : Math.min(Math.max(preferred, 0), items.length - 1);
    const current = items[activeIndex] ?? null;
    const currentFrozen = frozen || current?.frozen === true;
    const currentId = current?.id ?? null;
    const currentVideoUrl = current === null ? null : safeExternalUrl(current.videoUrl);
    const declareConflict = useDeclareConflict(organizationId, currentId);
    const flagAssignment = useFlagAssignment(organizationId, currentId);
    const hasUnscored = items.some((item) => isPending(item.status));

    const go = (next: number): void => {
        if (items.length === 0) {
            return;
        }
        setSelected(((next % items.length) + items.length) % items.length);
    };

    const nextUnscored = (): void => {
        for (let offset = 1; offset <= items.length; offset += 1) {
            const index = (activeIndex + offset) % items.length;
            const item = items[index];
            if (item !== undefined && isPending(item.status)) {
                setSelected(index);
                return;
            }
        }
    };

    const onDeclareConflict = conflictForm.handleSubmit(async (values) => {
        try {
            await declareConflict.mutateAsync({ note: values.note });
            setConflictOpen(false);
            conflictForm.reset({ note: "" });
            toast({ title: "Recusal recorded", tone: "success" });
        } catch (mutationError) {
            toast({
                title: "Could not record the recusal",
                description: describeError(mutationError),
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
        } catch (mutationError) {
            toast({
                title: "Could not report the flag",
                description: describeError(mutationError),
                tone: "critical",
            });
        }
    });

    if (loading) {
        return <LoadingBlock rows={4} label="Loading the judging queue" />;
    }
    if (error !== null && error !== undefined) {
        return <RequestError error={error} onRetry={onRetry} />;
    }
    if (items.length === 0) {
        return (
            <EmptyState
                title="No projects in this queue"
                description="Assignments appear when an organizer assigns you to a submission in this edition."
            />
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {currentFrozen ? (
                <Alert tone="warning" title="Results are published">
                    This edition is completed, so judging is read-only. You can review submitted
                    work and history, but new scores cannot be saved or submitted.
                </Alert>
            ) : null}
            <Card>
                <CardContent className="flex flex-col gap-4 pt-6">
                    <Progress
                        label="Evaluations submitted"
                        value={submittedCount}
                        max={trackedItems.length}
                        valueText={`${String(submittedCount)} of ${String(trackedItems.length)} submitted`}
                    />
                    <div
                        role="group"
                        aria-label="Judging queue controls"
                        className="flex flex-wrap items-center gap-2"
                    >
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => go(activeIndex - 1)}
                        >
                            Previous
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => go(activeIndex + 1)}
                        >
                            Next
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!hasUnscored}
                            onClick={nextUnscored}
                        >
                            Next unscored
                        </Button>
                        <span className="text-sm text-ink-muted tabular-nums">
                            Project {String(activeIndex + 1)} of {String(items.length)}
                        </span>
                    </div>
                </CardContent>
            </Card>

            {current === null ? null : (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                    <Card>
                        <CardHeader>
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="flex flex-col gap-1">
                                    <CardTitle>{current.projectTitle}</CardTitle>
                                    <CardDescription>Assignment {current.id}</CardDescription>
                                </div>
                                <Badge tone={statusTone(current.status)}>
                                    {statusLabel(current.status)}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <KeyValue
                                columns={2}
                                items={[
                                    { label: "Due", value: formatDateTime(current.dueAt) },
                                    {
                                        label: "Assigned",
                                        value: formatDateTime(current.assignedAt),
                                    },
                                    {
                                        label: "Status",
                                        value: statusLabel(current.status),
                                    },
                                    {
                                        label: "Note",
                                        value:
                                            current.assignmentNote.length === 0
                                                ? "No note"
                                                : current.assignmentNote,
                                    },
                                ]}
                            />
                            {current.conflictNote === null ? null : (
                                <p className="text-sm text-ink-muted">
                                    Recusal note: {current.conflictNote}
                                </p>
                            )}
                            <div className="flex flex-col gap-3 border-t border-line pt-4">
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm font-medium text-ink">
                                        Demonstration video
                                    </span>
                                    {currentVideoUrl === null ? (
                                        <span className="text-sm text-ink-muted">
                                            No demonstration video link was provided.
                                        </span>
                                    ) : (
                                        <a
                                            href={currentVideoUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-primary underline-offset-4 hover:underline"
                                        >
                                            Watch demonstration video
                                        </a>
                                    )}
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm font-medium text-ink">
                                        AI-use disclosure
                                    </span>
                                    {current.aiDisclosure.trim().length === 0 ? (
                                        <p className="text-sm text-ink-muted">
                                            No AI-use disclosure was recorded.
                                        </p>
                                    ) : (
                                        <p className="whitespace-pre-wrap text-sm text-ink">
                                            {current.aiDisclosure}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                                <Button asChild>
                                    <Link to={`/judging/assignments/${current.id}`}>
                                        Open project
                                    </Link>
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={currentFrozen || !isPending(current.status)}
                                    onClick={() => setConflictOpen(true)}
                                >
                                    Recuse from this project
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    disabled={
                                        currentFrozen ||
                                        current.status === "conflict_declared" ||
                                        current.status === "revoked"
                                    }
                                    onClick={() => setFlagOpen(true)}
                                >
                                    Flag for organizers
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Project navigator</CardTitle>
                            <CardDescription>
                                Every assignment in this edition and its state.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto">
                                {items.map((item, index) => (
                                    <li key={item.id}>
                                        <button
                                            type="button"
                                            aria-current={
                                                index === activeIndex ? "true" : undefined
                                            }
                                            onClick={() => setSelected(index)}
                                            className="flex w-full flex-col gap-1 rounded-sm border border-line px-3 py-2 text-left text-sm transition-colors hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary aria-[current=true]:border-primary"
                                        >
                                            <span className="font-medium">{item.projectTitle}</span>
                                            <span className="flex items-center justify-between gap-2 text-xs text-ink-muted">
                                                <span>{statusLabel(item.status)}</span>
                                                <span>Due {formatDateTime(item.dueAt)}</span>
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            )}

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
