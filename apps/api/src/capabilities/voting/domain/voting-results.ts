import type { SubmissionStatus, TeamStatus } from "@nethack/contracts";
import { isActiveVotingTeam } from "./ballot-eligibility.js";
import { VotingRules } from "./voting-rules.js";

export interface BallotScoreRow {
    readonly submissionId: string;
    readonly stars: number;
}

export interface BallotRowInput {
    readonly userId: string;
    readonly voterTeamId?: string | null;
    readonly scores: readonly BallotScoreRow[];
}

export interface VoterTeamMembership {
    readonly teamId: string;
    readonly status: TeamStatus;
}

export interface CountableSubmission {
    readonly status: SubmissionStatus;
    /** Null when the submission belongs to no team. */
    readonly teamStatus: TeamStatus | null;
}

export interface VoteTally {
    readonly submissionId: string;
    /** Raw counted scores; not the denominator of the unit-weighted average. */
    readonly votes: number;
    readonly totalStars: number;
    /**
     * Unit-weighted People's Choice average: the mean stars within each voting
     * unit (a team, or one teamless voter) averaged across the units that
     * scored this submission. A large team therefore cannot outweigh a small
     * one.
     */
    readonly averageStars: number;
}

export interface VoteTallyResult {
    /** Ballots from active teams or teamless voters; turnout excludes inactive teams. */
    readonly totalBallots: number;
    readonly tallies: readonly VoteTally[];
}

export interface RankedResultEntry {
    readonly submissionId: string;
    readonly projectTitle: string;
    readonly teamName: string | null;
    readonly rank: number;
    readonly votes: number;
    readonly totalStars: number;
    readonly averageStars: number;
}

/** Votes only count for a votable submission whose team is still active. */
export function isCountableSubmission(submission: CountableSubmission): boolean {
    if (!VotingRules.isVotableSubmission(submission.status)) {
        return false;
    }
    return submission.teamStatus === null || isActiveVotingTeam(submission.teamStatus);
}

/** A voting unit is a team, or a single user when the voter has no team. */
export function votingUnitId(userId: string, teamId: string | null): string {
    return teamId === null ? `user:${userId}` : `team:${teamId}`;
}

/**
 * Tallies eligible ballots into unit-weighted submission results. Ballots from
 * inactive teams are dropped from turnout and totals. Scores for submissions
 * that are no longer votable, or whose team is inactive, are ignored.
 */
export function tallyVoteUnits(
    ballots: readonly BallotRowInput[],
    teamsByUserId: ReadonlyMap<string, VoterTeamMembership>,
    votableSubmissionIds: ReadonlySet<string>,
    teamsById: ReadonlyMap<string, VoterTeamMembership> = new Map(
        [...teamsByUserId.values()].map((membership) => [membership.teamId, membership] as const),
    ),
): VoteTallyResult {
    const bySubmission = new Map<
        string,
        {
            readonly unitSums: Map<string, { readonly sum: number; readonly count: number }>;
            votes: number;
            totalStars: number;
        }
    >();
    let totalBallots = 0;

    for (const ballot of ballots) {
        const currentMembership = teamsByUserId.get(ballot.userId);
        const voterTeamId = ballot.voterTeamId ?? currentMembership?.teamId ?? null;
        const membership = voterTeamId === null ? undefined : teamsById.get(voterTeamId);
        if (voterTeamId !== null && membership === undefined) {
            continue;
        }
        if (membership !== undefined && !isActiveVotingTeam(membership.status)) {
            continue;
        }
        totalBallots += 1;
        const unitId = votingUnitId(ballot.userId, voterTeamId);
        for (const score of ballot.scores) {
            if (!votableSubmissionIds.has(score.submissionId)) {
                continue;
            }
            let entry = bySubmission.get(score.submissionId);
            if (entry === undefined) {
                entry = { unitSums: new Map(), votes: 0, totalStars: 0 };
                bySubmission.set(score.submissionId, entry);
            }
            entry.votes += 1;
            entry.totalStars += score.stars;
            const unit = entry.unitSums.get(unitId) ?? { sum: 0, count: 0 };
            entry.unitSums.set(unitId, {
                sum: unit.sum + score.stars,
                count: unit.count + 1,
            });
        }
    }

    const tallies: VoteTally[] = [];
    for (const [submissionId, entry] of bySubmission) {
        let sumOfUnitMeans = 0;
        for (const unit of entry.unitSums.values()) {
            sumOfUnitMeans += unit.sum / unit.count;
        }
        tallies.push({
            submissionId,
            votes: entry.votes,
            totalStars: entry.totalStars,
            averageStars:
                entry.unitSums.size === 0
                    ? 0
                    : Math.round((sumOfUnitMeans / entry.unitSums.size) * 100) / 100,
        });
    }
    return { totalBallots, tallies };
}

export function rankVoteTallies(
    tallies: readonly VoteTally[],
    titles: ReadonlyMap<string, string>,
    limit: number,
    teamNames: ReadonlyMap<string, string | null> = new Map(),
): RankedResultEntry[] {
    const sorted = tallies
        .map((tally) => ({
            submissionId: tally.submissionId,
            projectTitle: titles.get(tally.submissionId) ?? "",
            votes: tally.votes,
            totalStars: tally.totalStars,
            averageStars: tally.averageStars,
        }))
        .toSorted(
            (left, right) =>
                right.averageStars - left.averageStars ||
                right.totalStars - left.totalStars ||
                right.votes - left.votes ||
                left.projectTitle.localeCompare(right.projectTitle) ||
                left.submissionId.localeCompare(right.submissionId),
        )
        .slice(0, limit);

    return sorted.map((entry, index) => ({
        submissionId: entry.submissionId,
        projectTitle: entry.projectTitle,
        teamName: teamNames.get(entry.submissionId) ?? null,
        rank: index + 1,
        votes: entry.votes,
        totalStars: entry.totalStars,
        averageStars: entry.averageStars,
    }));
}
