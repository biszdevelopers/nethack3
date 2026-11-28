import type { VoteResult, VotingRound } from "@nethack/contracts";
import type { DatabaseSession } from "../../infrastructure/database/client.js";

export interface VotingContract {
    listRounds(organizationId: string, editionId: string): Promise<readonly VotingRound[]>;
    getPublishedResults(organizationId: string, editionId: string): Promise<readonly VoteResult[]>;
    /**
     * Results publication freeze: closes every open round of the edition inside
     * the caller's transaction and returns how many rounds were closed.
     */
    closeOpenRoundsForResults(
        session: DatabaseSession,
        organizationId: string,
        editionId: string,
        actorUserId: string,
    ): Promise<number>;
    /**
     * Removes every vote for a submission and audits `voting.votes.cleared`.
     * Used by administration before reopening a submission so a resubmission
     * cannot keep stars from the previous version.
     */
    removeSubmissionVotes(organizationId: string, submissionId: string): Promise<number>;
}

export const VOTING_CONTRACT = "voting.v1";
