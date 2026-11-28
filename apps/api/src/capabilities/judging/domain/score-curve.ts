import type { ScoreCurvePoint } from "@nethack/contracts";
import { ValidationError } from "../../../core/errors.js";

export const DEFAULT_SCORE_CURVE_POINTS: readonly ScoreCurvePoint[] = [
    { rawScore: 0, displayScore: 0 },
    { rawScore: 100, displayScore: 100 },
];

export function assertValidScoreCurve(points: readonly ScoreCurvePoint[]): void {
    if (points.length < 2 || points.length > 21) {
        throw new ValidationError("A score curve needs between 2 and 21 points.");
    }
    let previousRaw = -1;
    let previousDisplay = -1;
    for (const point of points) {
        if (
            !Number.isInteger(point.rawScore) ||
            !Number.isInteger(point.displayScore) ||
            point.rawScore < 0 ||
            point.rawScore > 100 ||
            point.displayScore < 0 ||
            point.displayScore > 100
        ) {
            throw new ValidationError("Score curve points must be integers from 0 to 100.");
        }
        if (point.rawScore <= previousRaw) {
            throw new ValidationError("Score curve raw scores must increase strictly.");
        }
        if (point.displayScore < previousDisplay) {
            throw new ValidationError("Score curve display scores cannot decrease.");
        }
        previousRaw = point.rawScore;
        previousDisplay = point.displayScore;
    }
    if (points[0]?.rawScore !== 0 || points[points.length - 1]?.rawScore !== 100) {
        throw new ValidationError("A score curve must start at raw score 0 and end at 100.");
    }
}

export function applyScoreCurve(
    rawScore: number,
    points: readonly ScoreCurvePoint[] = DEFAULT_SCORE_CURVE_POINTS,
): number {
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
