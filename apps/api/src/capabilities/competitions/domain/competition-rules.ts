import type { CompetitionEditionStatus } from "@nethack/contracts";
import { ConflictError, ValidationError } from "../../../core/errors.js";

const TRANSITIONS: Record<CompetitionEditionStatus, readonly CompetitionEditionStatus[]> = {
    draft: ["published"],
    published: ["registration_open", "archived"],
    registration_open: ["registration_closed", "archived"],
    registration_closed: ["active", "archived"],
    active: ["judging", "completed", "archived"],
    judging: ["voting", "completed", "archived"],
    voting: ["completed", "archived"],
    completed: ["archived"],
    archived: [],
};

export interface EditionSchedule {
    readonly teamMinSize: number;
    readonly teamMaxSize: number;
    readonly registrationOpensAt: Date | null;
    readonly registrationClosesAt: Date | null;
    readonly startsAt: Date | null;
    readonly endsAt: Date | null;
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
