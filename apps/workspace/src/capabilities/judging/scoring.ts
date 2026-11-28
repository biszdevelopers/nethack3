import type { Criterion, ScoreCurvePoint } from "@nethack/contracts";

export interface ScoreValue {
    readonly score: number;
    readonly comment?: string;
}

export function weightedRubricScore(
    criteria: readonly Pick<Criterion, "id" | "minScore" | "maxScore" | "weight">[],
    scores: Readonly<Record<string, ScoreValue>>,
): number | null {
    if (criteria.length === 0) {
        return null;
    }
    let totalWeight = 0;
    let weighted = 0;
    for (const criterion of criteria) {
        const value = scores[criterion.id]?.score;
        if (value === undefined) {
            return null;
        }
        const range = criterion.maxScore - criterion.minScore;
        totalWeight += criterion.weight;
        weighted += (range > 0 ? (value - criterion.minScore) / range : 0) * criterion.weight;
    }
    if (totalWeight <= 0) {
        return null;
    }
    return Math.round((weighted / totalWeight) * 100 * 100) / 100;
}

export function curveScore(rawScore: number, points: readonly ScoreCurvePoint[]): number {
    const bounded = Math.min(100, Math.max(0, rawScore));
    for (let index = 1; index < points.length; index += 1) {
        const lower = points[index - 1];
        const upper = points[index];
        if (lower === undefined || upper === undefined || bounded > upper.rawScore) {
            continue;
        }
        const span = upper.rawScore - lower.rawScore;
        if (span <= 0) {
            return upper.displayScore;
        }
        return Math.round(
            lower.displayScore +
                (bounded - lower.rawScore) * ((upper.displayScore - lower.displayScore) / span),
        );
    }
    return points[points.length - 1]?.displayScore ?? Math.round(bounded);
}

export function scoreCurveIssues(points: readonly ScoreCurvePoint[]): readonly string[] {
    const issues: string[] = [];
    if (points.length < 2 || points.length > 21) {
        issues.push("Use between 2 and 21 curve points.");
    }
    let previousRaw = -1;
    let previousDisplay = -1;
    for (const [index, point] of points.entries()) {
        if (
            !Number.isInteger(point.rawScore) ||
            !Number.isInteger(point.displayScore) ||
            point.rawScore < 0 ||
            point.rawScore > 100 ||
            point.displayScore < 0 ||
            point.displayScore > 100
        ) {
            issues.push(`Point ${String(index + 1)} must use whole numbers from 0 to 100.`);
        }
        if (point.rawScore <= previousRaw) {
            issues.push("Raw scores must increase strictly.");
        }
        if (point.displayScore < previousDisplay) {
            issues.push("Display scores cannot decrease.");
        }
        previousRaw = point.rawScore;
        previousDisplay = point.displayScore;
    }
    if (points[0]?.rawScore !== 0 || points[points.length - 1]?.rawScore !== 100) {
        issues.push("The curve must start at raw 0 and end at raw 100.");
    }
    return [...new Set(issues)];
}
