import type { VoteResult, VotingRound } from "@nethack/contracts";

export interface VotingContract {
    listRounds(organizationId: string, editionId: string): Promise<readonly VotingRound[]>;
    getPublishedResults(organizationId: string, editionId: string): Promise<readonly VoteResult[]>;
}

export const VOTING_CONTRACT = "voting.v1";
