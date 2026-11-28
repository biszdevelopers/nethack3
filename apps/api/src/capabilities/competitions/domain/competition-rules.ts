import type { CompetitionEditionStatus, EditionLifecycleAction } from "@nethack/contracts";
import { ConflictError, ValidationError } from "../../../core/errors.js";

const TRANSITIONS: Record<CompetitionEditionStatus, readonly CompetitionEditionStatus[]> = {
    draft: ["published"],
    published: ["registration_open", "archived"],
    registration_open: ["registration_closed", "archived"],
    registration_closed: ["active", "archived"],
    active: ["judging", "completed", "archived"],
    judging: ["voting", "completed", "archived"],
    voting: ["completed", "archived"],
    paused: [],
    completed: ["archived"],
    archived: [],
};

const PAUSABLE_STATUSES: ReadonlySet<CompetitionEditionStatus> = new Set([
    "published",
    "registration_open",
    "registration_closed",
    "active",
    "judging",
    "voting",
]);

export interface LifecycleTransition {
    readonly status: CompetitionEditionStatus;
    readonly statusBeforePause: CompetitionEditionStatus | null;
}

export interface EditionSchedule {
    readonly teamMinSize: number;
    readonly teamMaxSize: number;
    readonly registrationOpensAt: Date | null;
    readonly registrationClosesAt: Date | null;
    readonly startsAt: Date | null;
    readonly endsAt: Date | null;
}

export interface EditionActivationState {
    readonly isBlankStart: boolean;
    readonly requiresBoardApproval: boolean;
    readonly themeName: string | null;
    readonly startsAt: Date | null;
    readonly endsAt: Date | null;
    readonly boardApprovedAt: Date | null;
}

/** Public phases in which the edition theme is safe to reveal. */
const THEME_PUBLISHED_STATUSES: ReadonlySet<CompetitionEditionStatus> = new Set([
    "active",
    "judging",
    "voting",
    "completed",
    "archived",
]);

export function isThemePublished(status: CompetitionEditionStatus): boolean {
    return THEME_PUBLISHED_STATUSES.has(status);
}

export class CompetitionRules {
    static canTransition(from: CompetitionEditionStatus, to: CompetitionEditionStatus): boolean {
        return TRANSITIONS[from].includes(to);
    }

    static assertTransition(from: CompetitionEditionStatus, to: CompetitionEditionStatus): void {
        if (from === to) {
            throw new ConflictError(`The edition is already ${from}.`);
        }
        if (!CompetitionRules.canTransition(from, to)) {
            throw new ConflictError(`An edition cannot move from ${from} to ${to}.`);
        }
    }

    static assertPublishable(status: CompetitionEditionStatus): void {
        if (status !== "draft") {
            throw new ConflictError("Only a draft edition can be published.");
        }
    }

    /**
     * Missing details that block draft -> published. Judging rubric readiness is
     * owned by the judging capability and is surfaced by administration
     * preflight instead, so it cannot be checked here without a dependency cycle.
     */
    static activationBlockers(edition: EditionActivationState): readonly string[] {
        const blockers: string[] = [];
        if (edition.isBlankStart && !edition.themeName?.trim()) {
            blockers.push("theme name");
        }
        if (edition.isBlankStart && edition.startsAt === null) {
            blockers.push("start date");
        }
        if (edition.isBlankStart && edition.endsAt === null) {
            blockers.push("end date");
        }
        if (
            (edition.isBlankStart || edition.requiresBoardApproval) &&
            edition.boardApprovedAt === null
        ) {
            blockers.push("board approval");
        }
        return blockers;
    }

    static assertActivationReady(edition: EditionActivationState): void {
        const blockers = CompetitionRules.activationBlockers(edition);
        if (blockers.length > 0) {
            throw new ConflictError(
                `The edition is not ready to publish. Missing: ${blockers.join(", ")}.`,
            );
        }
    }

    /**
     * Backward and pausing transitions are owned by the lifecycle operation.
     * The PATCH transition table above never accepts `paused` as a target, so
     * a general update cannot pause, resume, reopen, or reset an edition.
     */
    static resolveLifecycle(
        action: EditionLifecycleAction,
        current: CompetitionEditionStatus,
        statusBeforePause: CompetitionEditionStatus | null,
    ): LifecycleTransition {
        switch (action) {
            case "pause": {
                if (current === "paused") {
                    throw new ConflictError("The edition is already paused.");
                }
                if (!PAUSABLE_STATUSES.has(current)) {
                    throw new ConflictError(
                        `A ${current} edition cannot be paused. Only an edition that is public or running can be paused.`,
                    );
                }
                return { status: "paused", statusBeforePause: current };
            }
            case "resume": {
                if (current !== "paused") {
                    throw new ConflictError("Only a paused edition can be resumed.");
                }
                const resumed = statusBeforePause ?? "registration_open";
                if (resumed === "paused" || !PAUSABLE_STATUSES.has(resumed)) {
                    throw new ConflictError(
                        "The paused edition does not record a resumable status.",
                    );
                }
                return { status: resumed, statusBeforePause: null };
            }
            case "reopen_submissions": {
                CompetitionRules.assertResultsArePrivate(current, "reopening submissions");
                if (current !== "paused" && current !== "judging" && current !== "voting") {
                    throw new ConflictError(`A ${current} edition cannot reopen submissions.`);
                }
                return { status: "active", statusBeforePause: null };
            }
            case "reopen_judging": {
                CompetitionRules.assertResultsArePrivate(current, "reopening judging");
                if (current !== "voting") {
                    throw new ConflictError(`A ${current} edition cannot reopen judging.`);
                }
                return { status: "judging", statusBeforePause: null };
            }
            case "reopen_voting": {
                CompetitionRules.assertResultsArePrivate(current, "reopening voting");
                if (current !== "judging") {
                    throw new ConflictError(`A ${current} edition cannot reopen voting.`);
                }
                return { status: "voting", statusBeforePause: null };
            }
            case "reset": {
                if (current === "draft") {
                    throw new ConflictError("The edition is already a draft.");
                }
                if (current === "archived") {
                    throw new ConflictError("An archived edition cannot be reset.");
                }
                CompetitionRules.assertResultsArePrivate(current, "resetting the edition");
                return { status: "draft", statusBeforePause: null };
            }
        }
    }

    /**
     * A completed edition is the results-publication freeze. Backward
     * lifecycle actions require unpublishing results first, which restores
     * the pre-freeze status through the recognition contract.
     */
    static assertResultsArePrivate(current: CompetitionEditionStatus, operation: string): void {
        if (current === "completed") {
            throw new ConflictError(
                `Unpublish the results before ${operation}. Publishing results completed the edition.`,
            );
        }
    }

    static assertEditionIsValid(schedule: EditionSchedule): void {
        if (schedule.teamMinSize > schedule.teamMaxSize) {
            throw new ValidationError("Minimum team size cannot exceed maximum team size.", {
                teamMinSize: ["Minimum team size cannot exceed maximum team size."],
            });
        }
        if (
            schedule.registrationOpensAt !== null &&
            schedule.registrationClosesAt !== null &&
            schedule.registrationOpensAt > schedule.registrationClosesAt
        ) {
            throw new ValidationError("Registration must close after it opens.", {
                registrationClosesAt: ["Registration must close after it opens."],
            });
        }
        if (
            schedule.startsAt !== null &&
            schedule.endsAt !== null &&
            schedule.startsAt > schedule.endsAt
        ) {
            throw new ValidationError("The end must not precede the start.", {
                endsAt: ["The end must not precede the start."],
            });
        }
    }

    static assertDivisionTeamSizes(min: number | null, max: number | null): void {
        if (min !== null && max !== null && min > max) {
            throw new ValidationError("Minimum team size cannot exceed maximum team size.", {
                minTeamSize: ["Minimum team size cannot exceed maximum team size."],
            });
        }
    }

    static assertSeriesIsDeletable(editionCount: number): void {
        if (editionCount > 0) {
            throw new ConflictError(
                "The competition series still has editions. Delete them before deleting the series.",
            );
        }
    }

    static assertDivisionIsDeletable(registrationCount: number, teamCount: number): void {
        if (registrationCount > 0 || teamCount > 0) {
            throw new ConflictError(
                "The division is referenced by registrations or teams and cannot be deleted.",
            );
        }
    }
}
