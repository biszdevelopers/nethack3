import { useId, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { EmptyState } from "../empty-state.js";
import { Input } from "../input.js";
import { Label } from "../label.js";
import { Textarea } from "../textarea.js";

export interface RubricCriterion {
    readonly id: string;
    readonly label: string;
    readonly description?: string;
    readonly maxScore: number;
    readonly weight?: number;
}

export interface RubricScore {
    readonly score: number;
    readonly comment?: string;
}

export interface EvaluationRubricProps {
    readonly criteria: readonly RubricCriterion[];
    readonly scores: Readonly<Record<string, RubricScore>>;
    readonly onChange: (scores: Record<string, RubricScore>) => void;
    readonly label?: string;
    readonly className?: string;
}

function clampScore(value: number, maxScore: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.min(Math.max(Math.round(value), 0), Math.max(Math.round(maxScore), 0));
}

function formatPercent(value: number): string {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

interface CriterionRowProps {
    readonly criterion: RubricCriterion;
    readonly score: number;
    readonly comment: string;
    readonly onScoreChange: (score: number) => void;
    readonly onCommentChange: (comment: string) => void;
}

function CriterionRow({
    criterion,
    score,
    comment,
    onScoreChange,
    onCommentChange,
}: CriterionRowProps): ReactNode {
    const inputId = useId();
    const commentId = useId();
    const maxScore = Math.max(Math.round(criterion.maxScore), 0);
    return (
        <li className="flex flex-col gap-3 rounded-md border border-line bg-panel p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-0.5">
                    <Label htmlFor={inputId}>{criterion.label}</Label>
                    {criterion.description === undefined ? null : (
                        <p className="text-xs text-ink-muted">{criterion.description}</p>
                    )}
                </div>
                <span className="text-xs text-ink-subtle">
                    weight {Math.max(criterion.weight ?? 1, 0)}
                </span>
            </div>
            <div className="flex items-center gap-2">
                <Input
                    id={inputId}
                    type="number"
                    min={0}
                    max={maxScore}
                    step={1}
                    value={score}
                    onChange={(event) => onScoreChange(Number(event.currentTarget.value))}
                    className="w-20"
                    aria-label={`Score for ${criterion.label}`}
                />
                <span className="text-xs text-ink-subtle">of {maxScore}</span>
            </div>
            <div className="flex flex-col gap-1">
                <Label htmlFor={commentId} className="text-xs text-ink-muted">
                    Comment
                </Label>
                <Textarea
                    id={commentId}
                    value={comment}
                    onChange={(event) => onCommentChange(event.currentTarget.value)}
                    placeholder={`Notes on ${criterion.label}`}
                    aria-label={`Comment on ${criterion.label}`}
                    className="min-h-16"
                />
            </div>
        </li>
    );
}

export function EvaluationRubric({
    criteria,
    scores,
    onChange,
    label = "Evaluation rubric",
    className,
}: EvaluationRubricProps): ReactNode {
    if (criteria.length === 0) {
        return (
            <EmptyState
                title="No rubric criteria"
                description="Add criteria to evaluate this submission."
                className={className ?? ""}
            />
        );
    }

    const setScore = (criterionId: string, score: number): void => {
        const current = scores[criterionId] ?? { score: 0 };
        onChange({ ...scores, [criterionId]: { ...current, score } });
    };

    const setComment = (criterionId: string, comment: string): void => {
        const current = scores[criterionId] ?? { score: 0 };
        onChange({ ...scores, [criterionId]: { ...current, comment } });
    };

    let weightedSum = 0;
    let weightTotal = 0;
    for (const criterion of criteria) {
        const maxScore = Math.max(Math.round(criterion.maxScore), 1);
        const score = clampScore(scores[criterion.id]?.score ?? 0, maxScore);
        const weight = Math.max(criterion.weight ?? 1, 0);
        weightedSum += (score / maxScore) * weight;
        weightTotal += weight;
    }
    const weightedTotal = weightTotal > 0 ? (weightedSum / weightTotal) * 100 : 0;

    return (
        <section
            aria-label={label}
            data-slot="evaluation-rubric"
            className={cn("flex flex-col gap-3", className)}
        >
            <ul className="flex flex-col gap-3">
                {criteria.map((criterion) => {
                    const maxScore = Math.max(Math.round(criterion.maxScore), 0);
                    const entry = scores[criterion.id];
                    const score = clampScore(entry?.score ?? 0, maxScore);
                    return (
                        <CriterionRow
                            key={criterion.id}
                            criterion={criterion}
                            score={score}
                            comment={entry?.comment ?? ""}
                            onScoreChange={(next) =>
                                setScore(criterion.id, clampScore(next, maxScore))
                            }
                            onCommentChange={(next) => setComment(criterion.id, next)}
                        />
                    );
                })}
            </ul>
            <div className="flex items-baseline justify-between gap-2 border-t border-line pt-3">
                <span className="text-sm text-ink-muted">Weighted total</span>
                <output className="text-lg font-semibold tabular-nums text-ink" aria-live="polite">
                    {weightTotal > 0 ? formatPercent(weightedTotal) : "—"}
                </output>
            </div>
        </section>
    );
}
