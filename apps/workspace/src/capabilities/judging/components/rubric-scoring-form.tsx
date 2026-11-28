import { useId, type ReactNode } from "react";
import type { Criterion, RubricCommentGuidance } from "@nethack/contracts";
import { Button, Input, Label, Textarea, type RubricScore } from "@nethack/ui";

export interface RubricScoringFormProps {
    readonly criteria: readonly Criterion[];
    readonly guidance: RubricCommentGuidance;
    readonly scores: Readonly<Record<string, RubricScore>>;
    readonly overallComment: string;
    readonly rawScore: number | null;
    readonly displayScore: number | null;
    readonly onChange: (scores: Record<string, RubricScore>) => void;
    readonly onOverallCommentChange: (comment: string) => void;
    readonly commentError?: string | null;
    readonly disabled?: boolean;
}

function clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
        return min;
    }
    return Math.min(Math.max(Math.round(value), min), max);
}

export function RubricScoringForm({
    criteria,
    guidance,
    scores,
    overallComment,
    rawScore,
    displayScore,
    onChange,
    onOverallCommentChange,
    commentError = null,
    disabled = false,
}: RubricScoringFormProps): ReactNode {
    const commentId = useId();
    const commentHintId = useId();
    const commentErrorId = useId();

    const setScore = (criterion: Criterion, score: number): void => {
        const current = scores[criterion.id] ?? { score: criterion.minScore };
        onChange({
            ...scores,
            [criterion.id]: {
                ...current,
                score: clamp(score, criterion.minScore, criterion.maxScore),
            },
        });
    };

    const setComment = (criterionId: string, comment: string): void => {
        const current = scores[criterionId] ?? { score: 0 };
        onChange({ ...scores, [criterionId]: { ...current, comment } });
    };

    const applyTemplate = (body: string): void => {
        const next = overallComment.trim().length === 0 ? body : `${overallComment}\n\n${body}`;
        onOverallCommentChange(next);
    };

    return (
        <div className="flex flex-col gap-4">
            {guidance.introduction.length === 0 && guidance.guidelines.length === 0 ? null : (
                <div className="rounded-md border border-line bg-raised/30 p-4">
                    <h3 className="text-sm font-semibold">Comment guidance</h3>
                    {guidance.introduction.length === 0 ? null : (
                        <p className="mt-1 text-sm text-ink-muted">{guidance.introduction}</p>
                    )}
                    {guidance.guidelines.length === 0 ? null : (
                        <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-ink-muted">
                            {guidance.guidelines.map((guideline) => (
                                <li key={guideline}>{guideline}</li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            <ul className="flex flex-col gap-3">
                {criteria.map((criterion) => (
                    <CriterionRow
                        key={criterion.id}
                        criterion={criterion}
                        entry={scores[criterion.id]}
                        disabled={disabled}
                        onScoreChange={(score) => setScore(criterion, score)}
                        onCommentChange={(comment) => setComment(criterion.id, comment)}
                    />
                ))}
            </ul>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor={commentId}>Overall comment</Label>
                <p id={commentHintId} className="text-xs text-ink-muted">
                    Needs at least 20 characters. Do not include your name or email address.
                </p>
                <Textarea
                    id={commentId}
                    value={overallComment}
                    onChange={(event) => onOverallCommentChange(event.currentTarget.value)}
                    placeholder="Summarize the evaluation for the organizer."
                    disabled={disabled}
                    className="min-h-24"
                    aria-invalid={commentError !== null}
                    aria-describedby={
                        commentError === null ? commentHintId : `${commentHintId} ${commentErrorId}`
                    }
                />
                {commentError === null ? null : (
                    <p id={commentErrorId} role="alert" className="text-xs text-ink">
                        {commentError}
                    </p>
                )}
            </div>

            {guidance.templates.length === 0 ? null : (
                <div className="flex flex-wrap gap-2">
                    {guidance.templates.map((template) => (
                        <Button
                            key={template.label}
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={disabled}
                            onClick={() => applyTemplate(template.body)}
                        >
                            {template.label}
                        </Button>
                    ))}
                </div>
            )}

            <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
                <span className="text-sm text-ink-muted">Weighted total</span>
                <span className="flex items-baseline gap-3">
                    <output className="text-lg font-semibold tabular-nums" aria-live="polite">
                        {rawScore === null ? "—" : `${rawScore.toFixed(2)} / 100`}
                    </output>
                    {displayScore === null ? null : (
                        <span className="text-sm text-ink-muted">Display {displayScore} / 100</span>
                    )}
                </span>
            </div>
        </div>
    );
}

function CriterionRow({
    criterion,
    entry,
    disabled,
    onScoreChange,
    onCommentChange,
}: {
    readonly criterion: Criterion;
    readonly entry: RubricScore | undefined;
    readonly disabled: boolean;
    readonly onScoreChange: (score: number) => void;
    readonly onCommentChange: (comment: string) => void;
}): ReactNode {
    const scoreId = useId();
    const commentId = useId();
    return (
        <li className="flex flex-col gap-3 rounded-md border border-line bg-panel p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-0.5">
                    <Label htmlFor={scoreId}>{criterion.name}</Label>
                    {criterion.description.length === 0 ? null : (
                        <p className="text-xs text-ink-muted">{criterion.description}</p>
                    )}
                </div>
                <span className="text-xs text-ink-subtle">
                    weight {criterion.weight} · range {criterion.minScore}–{criterion.maxScore}
                </span>
            </div>
            <div className="flex items-center gap-2">
                <Input
                    id={scoreId}
                    type="number"
                    min={criterion.minScore}
                    max={criterion.maxScore}
                    step={1}
                    value={entry?.score ?? criterion.minScore}
                    onChange={(event) => onScoreChange(Number(event.currentTarget.value))}
                    className="w-20"
                    aria-label={`Score for ${criterion.name}`}
                    disabled={disabled}
                />
                <span className="text-xs text-ink-subtle">
                    of {criterion.maxScore} (minimum {criterion.minScore})
                </span>
            </div>
            <div className="flex flex-col gap-1">
                <Label htmlFor={commentId} className="text-xs text-ink-muted">
                    Comment
                </Label>
                <Textarea
                    id={commentId}
                    value={entry?.comment ?? ""}
                    onChange={(event) => onCommentChange(event.currentTarget.value)}
                    placeholder={`Notes on ${criterion.name}`}
                    aria-label={`Comment on ${criterion.name}`}
                    className="min-h-16"
                    disabled={disabled}
                />
            </div>
        </li>
    );
}
