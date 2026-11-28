import type {
    Criterion,
    RubricCommentGuidance,
    RubricTemplateCriterion,
    RubricTemplateTrack,
} from "@nethack/contracts";
import { ValidationError } from "../../../core/errors.js";
import type {
    RubricCriterionSnapshot,
    RubricSnapshot,
} from "../../../infrastructure/database/schema/judging.js";

const MAX_CRITERIA = 20;
const LEGACY_WEIGHT_TOTAL = 10;

export interface RubricCriterionInput {
    readonly name: string;
    readonly description: string;
    readonly minScore: number;
    readonly maxScore: number;
    readonly weight: number;
}

export function nextRubricVersion(latestVersion: number | null): number {
    return (latestVersion ?? 0) + 1;
}

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

/**
 * New rubrics use percentage weights that total 100. Rubrics authored before
 * percentage weights used a normalized 0-10 scale, so small totals are scaled
 * up instead of rejected.
 */
export function resolveRubricWeights(weights: readonly number[]): readonly number[] {
    if (weights.length === 0) {
        throw new ValidationError("A rubric needs at least one criterion.");
    }
    if (weights.some((weight) => !Number.isFinite(weight) || weight <= 0)) {
        throw new ValidationError("Criterion weights must be positive numbers.");
    }
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (Math.abs(total - 100) < 0.005) {
        return weights.map(round2);
    }
    if (total > LEGACY_WEIGHT_TOTAL) {
        throw new ValidationError("Criterion weights must total 100.");
    }
    const scaled = weights.map((weight) => round2((weight / total) * 100));
    const scaledTotal = scaled.reduce((sum, weight) => sum + weight, 0);
    const last = scaled[scaled.length - 1];
    if (last === undefined) {
        throw new ValidationError("A rubric needs at least one criterion.");
    }
    scaled[scaled.length - 1] = round2(last + (100 - scaledTotal));
    return scaled;
}

export function assertRubricCriteria(criteria: readonly RubricCriterionInput[]): void {
    if (criteria.length === 0 || criteria.length > MAX_CRITERIA) {
        throw new ValidationError(`A rubric needs between 1 and ${String(MAX_CRITERIA)} criteria.`);
    }
    for (const criterion of criteria) {
        if (
            !Number.isInteger(criterion.minScore) ||
            !Number.isInteger(criterion.maxScore) ||
            criterion.minScore < 0 ||
            criterion.minScore > 99 ||
            criterion.maxScore < 1 ||
            criterion.maxScore > 100 ||
            criterion.maxScore <= criterion.minScore
        ) {
            throw new ValidationError(
                `Criterion “${criterion.name}” needs an integer score range with a maximum above the minimum.`,
            );
        }
    }
}

export function assertTemplateTrack(track: RubricTemplateTrack): void {
    if (track.criteria.length === 0) {
        throw new ValidationError(`Track “${track.name}” needs at least one criterion.`);
    }
    assertRubricCriteria(track.criteria);
    const total = track.criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
    if (Math.abs(total - 100) > 0.005) {
        throw new ValidationError(`Track “${track.name}” criterion weights must total 100.`);
    }
}

export function normalizeTemplateCriteria(
    criteria: readonly RubricTemplateCriterion[],
): readonly RubricCriterionInput[] {
    assertRubricCriteria(criteria);
    const weights = resolveRubricWeights(criteria.map((criterion) => criterion.weight));
    return criteria.map((criterion, index) => ({
        name: criterion.name,
        description: criterion.description,
        minScore: criterion.minScore,
        maxScore: criterion.maxScore,
        weight: weights[index] ?? criterion.weight,
    }));
}

export function buildRubricSnapshot(input: {
    readonly id: string;
    readonly name: string;
    readonly version: number;
    readonly divisionId: string | null;
    readonly commentGuidance: RubricCommentGuidance;
    readonly criteria: readonly Criterion[];
}): RubricSnapshot {
    return {
        rubricId: input.id,
        name: input.name,
        version: input.version,
        divisionId: input.divisionId,
        commentGuidance: input.commentGuidance,
        criteria: input.criteria.map((criterion): RubricCriterionSnapshot => ({
            id: criterion.id,
            name: criterion.name,
            description: criterion.description,
            minScore: criterion.minScore,
            maxScore: criterion.maxScore,
            weight: criterion.weight,
            position: criterion.position,
        })),
    };
}
