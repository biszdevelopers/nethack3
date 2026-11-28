import type {
    CompetitionEditionStatus,
    JudgeAssignmentStatus,
    OrganizationRole,
} from "@nethack/contracts";
import { isEditionResultsFrozen } from "../../competitions/contracts.js";
import { ConflictError, ValidationError } from "../../../core/errors.js";

export interface ScorableCriterion {
    readonly id: string;
    readonly minScore?: number;
    readonly maxScore: number;
    readonly weight: number;
}

export interface SubmittedScore {
    readonly criterionId: string;
    readonly score: number;
}

export class JudgingRules {
    static isOrganizer(role: OrganizationRole): boolean {
        return role === "owner" || role === "organizer";
    }

    static isEligibleJudgeRole(role: OrganizationRole): boolean {
        return role === "owner" || role === "organizer" || role === "judge";
    }

    static assertJudgeEligible(role: OrganizationRole, status: "active" | "suspended"): void {
        if (status !== "active" || !JudgingRules.isEligibleJudgeRole(role)) {
            throw new ValidationError("That person is not an active judge in this organization.");
        }
    }

    static assertCanDeclareConflict(status: JudgeAssignmentStatus): void {
        if (status !== "assigned" && status !== "in_progress") {
            throw new ConflictError(
                "A conflict can only be declared before the evaluation is submitted or the assignment is revoked.",
            );
        }
    }

    static assertCanEvaluate(status: JudgeAssignmentStatus): void {
        if (status !== "assigned" && status !== "in_progress") {
            throw new ConflictError("This assignment is not open for evaluation.");
        }
    }

    static assertEditionWritable(status: CompetitionEditionStatus): void {
        if (isEditionResultsFrozen(status)) {
            throw new ConflictError(
                "Results are published for this edition, so judging is read-only.",
            );
        }
    }

    static assertBeforeDeadline(dueAt: Date | null, now: Date): void {
        if (dueAt !== null && now.getTime() > dueAt.getTime()) {
            throw new ConflictError("The judging deadline for this assignment has passed.");
        }
    }

    static assertScoresComplete(
        criteria: readonly ScorableCriterion[],
        scores: readonly SubmittedScore[],
    ): void {
        if (criteria.length === 0) {
            throw new ValidationError("The judging rubric has no criteria.");
        }
        const byCriterion = new Map(
            criteria.map((criterion) => [criterion.id, criterion] as const),
        );
        const seen = new Set<string>();
        for (const submitted of scores) {
            if (seen.has(submitted.criterionId)) {
                throw new ValidationError("Each rubric criterion may be scored only once.");
            }
            seen.add(submitted.criterionId);
            const criterion = byCriterion.get(submitted.criterionId);
            if (criterion === undefined) {
                throw new ValidationError("A score references a criterion outside this rubric.");
            }
            if (!Number.isInteger(submitted.score)) {
                throw new ValidationError("Scores must be whole numbers.");
            }
            const minScore = criterion.minScore ?? 0;
            if (submitted.score < minScore || submitted.score > criterion.maxScore) {
                throw new ValidationError(
                    `Scores must be between ${String(minScore)} and ${String(criterion.maxScore)} for this criterion.`,
                );
            }
        }
        for (const criterion of criteria) {
            if (!seen.has(criterion.id)) {
                throw new ValidationError("Every rubric criterion must be scored.");
            }
        }
    }

    static weightedScore(
        criteria: readonly ScorableCriterion[],
        scores: readonly SubmittedScore[],
    ): number {
        JudgingRules.assertScoresComplete(criteria, scores);
        const scoresByCriterion = new Map(
            scores.map((submitted) => [submitted.criterionId, submitted.score] as const),
        );
        let totalWeight = 0;
        let weightedTotal = 0;
        for (const criterion of criteria) {
            const score = scoresByCriterion.get(criterion.id);
            if (score === undefined) {
                throw new ValidationError("Every rubric criterion must be scored.");
            }
            const minScore = criterion.minScore ?? 0;
            const range = criterion.maxScore - minScore;
            totalWeight += criterion.weight;
            weightedTotal += (range > 0 ? (score - minScore) / range : 0) * criterion.weight;
        }
        if (totalWeight <= 0) {
            throw new ValidationError("Judging criteria weights must be positive.");
        }
        return Math.round((weightedTotal / totalWeight) * 10_000) / 100;
    }
}
