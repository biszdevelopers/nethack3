import type { CompetitionEditionStatus, RegistrationStatus } from "@nethack/contracts";
import { ConflictError } from "../../../core/errors.js";

export type DecisionStatus = "approved" | "rejected" | "waitlisted";

export interface RegistrationWindow {
    readonly status: CompetitionEditionStatus;
    readonly registrationOpensAt: Date | null;
    readonly registrationClosesAt: Date | null;
}

export class RegistrationRules {
    static assertRegistrationOpen(window: RegistrationWindow, now: Date): void {
        if (window.status !== "registration_open") {
            throw new ConflictError("Registration is not open for this competition.");
        }
        if (window.registrationOpensAt !== null && now < window.registrationOpensAt) {
            throw new ConflictError("Registration has not opened yet.");
        }
        if (window.registrationClosesAt !== null && now > window.registrationClosesAt) {
            throw new ConflictError("Registration has closed.");
        }
    }

    static initialStatus(
        maxParticipants: number | null,
        approvedCount: number,
    ): "waitlisted" | "pending" {
        return maxParticipants !== null && approvedCount >= maxParticipants
            ? "waitlisted"
            : "pending";
    }

    static assertCanDecide(current: RegistrationStatus, next: DecisionStatus): void {
        if (current !== "pending" && current !== "waitlisted") {
            throw new ConflictError(`A ${current} registration cannot be decided.`);
        }
        if (current === next) {
            throw new ConflictError(`The registration is already ${current}.`);
        }
    }

    static assertCapacity(maxParticipants: number | null, approvedCount: number): void {
        if (maxParticipants !== null && approvedCount >= maxParticipants) {
            throw new ConflictError("This competition has reached its participant limit.");
        }
    }

    static assertWithdrawable(status: RegistrationStatus): void {
        if (status !== "pending" && status !== "approved" && status !== "waitlisted") {
            throw new ConflictError(`A ${status} registration cannot be withdrawn.`);
        }
    }

    static assertNoTeam(teamId: string | null): void {
        if (teamId !== null) {
            throw new ConflictError("Leave your team before withdrawing from this competition.");
        }
    }
}
