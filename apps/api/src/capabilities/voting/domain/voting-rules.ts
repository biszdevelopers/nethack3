import type { OrganizationRole, SubmissionStatus, VotingRoundStatus } from "@nethack/contracts";
import { ConflictError, ForbiddenError, ValidationError } from "../../../core/errors.js";

export type VotingEligibleRole = "participant" | "judge" | "organizer";

const TRANSITIONS: Record<VotingRoundStatus, readonly VotingRoundStatus[]> = {
    draft: ["open"],
    open: ["closed"],
    closed: ["published"],
    published: [],
};

const VOTABLE_SUBMISSION_STATUSES = new Set<SubmissionStatus>([
    "submitted",
    "under_review",
    "changes_requested",
    "accepted",
]);

const ELIGIBLE_ROLES = new Set<string>(["participant", "judge", "organizer"]);

export interface VotingWindow {
    readonly status: VotingRoundStatus;
    readonly opensAt: Date | null;
    readonly closesAt: Date | null;
}

export function isEligibleRole(value: string): value is VotingEligibleRole {
    return ELIGIBLE_ROLES.has(value);
}

export function normalizeEligibleRoles(values: readonly string[]): VotingEligibleRole[] {
    return [...new Set(values.filter(isEligibleRole))];
}

export class VotingRules {
    static assertTransition(from: VotingRoundStatus, to: VotingRoundStatus): void {
        if (from === to) {
            throw new ConflictError(`The voting round is already ${from}.`);
        }
        if (!TRANSITIONS[from].includes(to)) {
            throw new ConflictError(`A voting round cannot move from ${from} to ${to}.`);
        }
    }

    static assertSchedule(opensAt: Date | null, closesAt: Date | null): void {
        if (opensAt !== null && closesAt !== null && closesAt <= opensAt) {
            throw new ValidationError("Voting must close after it opens.", {
                closesAt: ["Voting must close after it opens."],
            });
        }
    }

    static assertOpenable(window: VotingWindow, now: Date): void {
        VotingRules.assertTransition(window.status, "open");
        VotingRules.assertSchedule(window.opensAt, window.closesAt);
        if (window.closesAt !== null && window.closesAt <= now) {
            throw new ConflictError("The voting window has already ended.");
        }
    }

    static assertBallotWindow(window: VotingWindow, now: Date): void {
        if (window.status !== "open") {
            throw new ConflictError("Voting is not open for this round.");
        }
        if (window.opensAt !== null && now < window.opensAt) {
            throw new ConflictError("Voting has not opened yet.");
        }
        if (window.closesAt !== null && now > window.closesAt) {
            throw new ConflictError("Voting has closed.");
        }
    }

    static assertSelections(submissionIds: readonly string[], maxSelections: number): void {
        if (submissionIds.length === 0) {
            throw new ValidationError("Select at least one submission.", {
                submissionIds: ["Select at least one submission."],
            });
        }
        if (new Set(submissionIds).size !== submissionIds.length) {
            throw new ValidationError("Each submission may be selected only once.", {
                submissionIds: ["Each submission may be selected only once."],
            });
        }
        if (submissionIds.length > maxSelections) {
            throw new ValidationError(`Select at most ${maxSelections} submissions.`, {
                submissionIds: [`Select at most ${maxSelections} submissions.`],
            });
        }
    }

    static effectiveRole(role: OrganizationRole): VotingEligibleRole {
        return role === "owner" ? "organizer" : role;
    }

    static assertRoleEligible(
        role: OrganizationRole,
        eligibleRoles: readonly VotingEligibleRole[],
    ): void {
        if (!eligibleRoles.includes(VotingRules.effectiveRole(role))) {
            throw new ForbiddenError(
                "Your organization role is not eligible to vote in this round.",
            );
        }
    }

    static assertApprovedParticipant(approved: boolean): void {
        if (!approved) {
            throw new ForbiddenError("Only approved participants can vote in this round.");
        }
    }

    static assertCanViewResults(status: VotingRoundStatus, role: OrganizationRole): void {
        if (role === "owner" || role === "organizer") {
            return;
        }
        if (status !== "published") {
            throw new ForbiddenError("Voting results are not published yet.");
        }
    }

    static isVotableSubmission(status: SubmissionStatus): boolean {
        return VOTABLE_SUBMISSION_STATUSES.has(status);
    }
}
