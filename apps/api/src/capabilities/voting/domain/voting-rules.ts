import type {
    BallotScore,
    CompetitionEditionStatus,
    OrganizationRole,
    SubmissionStatus,
    VotingRoundStatus,
} from "@nethack/contracts";
import { BALLOT_MAX_STARS_PER_SUBMISSION, BALLOT_TOTAL_STARS } from "@nethack/contracts";
import { ConflictError, ForbiddenError, ValidationError } from "../../../core/errors.js";
import { isEditionResultsFrozen } from "../../competitions/contracts.js";

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

    static scoredProjectCap(maxSelections: number, maxVotesPerUser: number): number {
        return maxVotesPerUser > 0 ? Math.min(maxSelections, maxVotesPerUser) : maxSelections;
    }

    static assertEditionAcceptsVoting(status: CompetitionEditionStatus): void {
        if (status === "paused") {
            throw new ConflictError(
                "This competition edition is paused; voting and round changes are unavailable.",
            );
        }
        if (isEditionResultsFrozen(status)) {
            throw new ConflictError(
                "Results are published; voting and round changes are frozen for this edition.",
            );
        }
    }

    static assertScores(
        scores: readonly BallotScore[],
        maxSelections: number,
        maxVotesPerUser = 0,
    ): void {
        if (scores.length === 0) {
            throw new ValidationError("Score at least one submission.", {
                scores: ["Score at least one submission."],
            });
        }
        if (new Set(scores.map((score) => score.submissionId)).size !== scores.length) {
            throw new ValidationError("Each submission may be scored only once.", {
                scores: ["Each submission may be scored only once."],
            });
        }
        const cap = VotingRules.scoredProjectCap(maxSelections, maxVotesPerUser);
        if (scores.length > cap) {
            throw new ValidationError(`Score at most ${String(cap)} submissions.`, {
                scores: [`Score at most ${String(cap)} submissions.`],
            });
        }
        let total = 0;
        for (const score of scores) {
            if (
                !Number.isInteger(score.stars) ||
                score.stars < 1 ||
                score.stars > BALLOT_MAX_STARS_PER_SUBMISSION
            ) {
                throw new ValidationError(
                    `Each scored submission needs between 1 and ${String(BALLOT_MAX_STARS_PER_SUBMISSION)} stars.`,
                    {
                        scores: [
                            `Each scored submission needs between 1 and ${String(BALLOT_MAX_STARS_PER_SUBMISSION)} stars.`,
                        ],
                    },
                );
            }
            total += score.stars;
        }
        if (total !== BALLOT_TOTAL_STARS) {
            throw new ValidationError(`Distribute exactly ${String(BALLOT_TOTAL_STARS)} stars.`, {
                scores: [`Distribute exactly ${String(BALLOT_TOTAL_STARS)} stars.`],
            });
        }
    }

    static isOrganizerRole(role: OrganizationRole): boolean {
        return role === "owner" || role === "organizer";
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
