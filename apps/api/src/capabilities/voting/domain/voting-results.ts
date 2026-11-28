import type { VoteTallyRow } from "../infrastructure/voting-repository.js";

export interface RankedResultEntry {
    readonly submissionId: string;
    readonly projectTitle: string;
    readonly teamName: string | null;
    readonly rank: number;
    readonly votes: number;
    readonly totalStars: number;
    readonly averageStars: number;
}

export function rankVoteTallies(
    tallies: readonly VoteTallyRow[],
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
            average: tally.votes === 0 ? 0 : tally.totalStars / tally.votes,
        }))
        .toSorted(
            (left, right) =>
                right.average - left.average ||
                right.totalStars - left.totalStars ||
                left.projectTitle.localeCompare(right.projectTitle) ||
                left.submissionId.localeCompare(right.submissionId),
        )
        .slice(0, limit);

    const ranked: RankedResultEntry[] = [];
    for (const [index, entry] of sorted.entries()) {
        ranked.push({
            submissionId: entry.submissionId,
            projectTitle: entry.projectTitle,
            teamName: teamNames.get(entry.submissionId) ?? null,
            rank: index + 1,
            votes: entry.votes,
            totalStars: entry.totalStars,
            averageStars: Math.round(entry.average * 100) / 100,
        });
    }
    return ranked;
}
