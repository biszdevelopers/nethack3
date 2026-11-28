import { useId, type ReactNode } from "react";
import type { Criterion, RubricCommentGuidance } from "@nethack/contracts";
import { Button, Label, Textarea, cn, type RubricScore } from "@nethack/ui";

export type RubricDraftScore = Partial<RubricScore>;

export function isValidCriterionScore(
    criterion: Pick<Criterion, "minScore" | "maxScore">,
    score: number | undefined,
): score is number {
    return (
        score !== undefined &&
        Number.isInteger(score) &&
        score >= criterion.minScore &&
        score <= criterion.maxScore
    );
}

function scoreChoices(minScore: number, maxScore: number): readonly number[] {
    return Array.from(
        { length: Math.max(0, maxScore - minScore + 1) },
        (_, index) => minScore + index,
    );
}

export interface RubricScoringFormProps {
    readonly criteria: readonly Criterion[];
    readonly guidance: RubricCommentGuidance;
    readonly scores: Readonly<Record<string, RubricDraftScore>>;
    readonly overallComment: string;
    readonly rawScore: number | null;
    readonly displayScore: number | null;
    readonly onChange: (scores: Record<string, RubricDraftScore>) => void;
    readonly onOverallCommentChange: (comment: string) => void;
    readonly commentError?: string | null;
    readonly disabled?: boolean;
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
        if (!isValidCriterionScore(criterion, score)) {
            return;
        }
        onChange({ ...scores, [criterion.id]: { ...scores[criterion.id], score } });
    };

    const setComment = (criterionId: string, comment: string): void => {
        onChange({ ...scores, [criterionId]: { ...scores[criterionId], comment } });
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
    readonly entry: RubricDraftScore | undefined;
    readonly disabled: boolean;
    readonly onScoreChange: (score: number) => void;
    readonly onCommentChange: (comment: string) => void;
}): ReactNode {
    const groupName = useId();
    const commentId = useId();
    const rawScore = entry?.score;
    const selectedScore = isValidCriterionScore(criterion, rawScore) ? rawScore : null;

    return (
        <li className="flex min-w-0 flex-col gap-3 rounded-md border border-line bg-panel p-4">
            <fieldset className="flex min-w-0 flex-col gap-3" disabled={disabled}>
                <legend className="w-full text-sm font-medium text-ink">{criterion.name}</legend>
                {criterion.description.length === 0 ? null : (
                    <p className="text-xs text-ink-muted">{criterion.description}</p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-ink-subtle">
                        weight {criterion.weight} · range {criterion.minScore}–{criterion.maxScore}
                    </span>
                    <output
                        className={cn(
                            "rounded-sm border px-2 py-0.5 text-xs font-semibold tabular-nums",
                            selectedScore === null
                                ? "border-line-strong text-ink-muted"
                                : "border-primary/40 bg-primary/10 text-primary",
                        )}
                    >
                        {selectedScore === null
                            ? "No score selected"
                            : `${String(selectedScore)} / ${String(criterion.maxScore)}`}
                    </output>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1.5">
                    {scoreChoices(criterion.minScore, criterion.maxScore).map((choice) => (
                        <label
                            key={choice}
                            className={cn(
                                "relative flex h-11 min-w-0 items-center justify-center rounded-sm border text-sm font-semibold tabular-nums transition-colors",
                                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-panel",
                                selectedScore === choice
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-line bg-app text-ink hover:border-line-strong",
                                disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                            )}
                        >
                            <input
                                type="radio"
                                name={`${groupName}-${criterion.id}`}
                                value={choice}
                                checked={selectedScore === choice}
                                onChange={() => onScoreChange(choice)}
                                disabled={disabled}
                                aria-label={`${String(choice)} of ${String(criterion.maxScore)} for ${criterion.name}`}
                                className="absolute inset-0 size-full cursor-pointer opacity-0 focus-visible:outline-none"
                            />
                            <span aria-hidden="true">{choice}</span>
                        </label>
                    ))}
                </div>
            </fieldset>
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
