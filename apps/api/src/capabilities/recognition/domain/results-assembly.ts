import type {
    JudgingResult,
    PublicAward,
    PublicPeopleChoice,
    PublicResultEntry,
    PublicResults,
    PublicResultsEdition,
    PublicTeamAward,
    PublicVotingEntry,
    PublicVotingRound,
    VoteResult,
} from "@nethack/contracts";

export interface AssemblyTeam {
    readonly id: string;
    readonly name: string;
    readonly divisionId: string | null;
}

export interface AssemblySubmission {
    readonly id: string;
    readonly projectId: string;
    readonly teamId: string | null;
    readonly title: string;
}

export interface AssemblyDivision {
    readonly id: string;
    readonly name: string;
}

export interface AssemblyAward {
    readonly id: string;
    readonly namespace: string;
    readonly name: string;
    readonly description: string;
    readonly icon: string;
    readonly color: string;
}

export interface AssemblyTeamAward {
    readonly awardId: string;
    readonly teamId: string;
    readonly note: string;
}

export interface ResultAssemblyInput {
    readonly edition: PublicResultsEdition;
    readonly judging: readonly JudgingResult[];
    readonly voting: readonly VoteResult[];
    readonly teams: readonly AssemblyTeam[];
    readonly submissions: readonly AssemblySubmission[];
    readonly divisions: readonly AssemblyDivision[];
    readonly awards: readonly AssemblyAward[];
    readonly teamAwards: readonly AssemblyTeamAward[];
    readonly publishedAt: string;
}

export interface TeamResultView {
    readonly teamId: string;
    readonly teamName: string;
    readonly project: { readonly id: string; readonly title: string } | null;
    readonly rank: number | null;
    readonly awards: readonly PublicTeamAward[];
}

export function assemblePublicResults(input: ResultAssemblyInput): PublicResults {
    const teamsById = new Map(input.teams.map((team) => [team.id, team] as const));
    const submissionsById = new Map(
        input.submissions.map((submission) => [submission.id, submission] as const),
    );
    const submissionByTeamId = new Map(
        input.submissions.flatMap((submission) =>
            submission.teamId === null ? [] : [[submission.teamId, submission] as const],
        ),
    );
    const divisionsById = new Map(
        input.divisions.map((division) => [division.id, division.name] as const),
    );
    const awardsById = new Map(input.awards.map((award) => [award.id, award] as const));

    const awardsByTeam = new Map<string, PublicTeamAward[]>();
    for (const assignment of input.teamAwards) {
        const award = awardsById.get(assignment.awardId);
        if (award === undefined) {
            throw new Error("A team award references a missing award.");
        }
        const expanded: PublicTeamAward = {
            id: award.id,
            namespace: award.namespace,
            name: award.name,
            description: award.description,
            icon: award.icon,
            color: award.color,
            note: assignment.note,
        };
        const list = awardsByTeam.get(assignment.teamId) ?? [];
        list.push(expanded);
        awardsByTeam.set(assignment.teamId, list);
    }
    for (const [teamId, list] of awardsByTeam) {
        awardsByTeam.set(
            teamId,
            list.toSorted(
                (left, right) =>
                    left.namespace.localeCompare(right.namespace) ||
                    left.name.localeCompare(right.name),
            ),
        );
    }

    const judgingEntries: PublicResultEntry[] = input.judging
        .map((result) => {
            const team = result.teamId === null ? undefined : teamsById.get(result.teamId);
            return {
                submissionId: result.submissionId,
                projectId: result.projectId,
                projectTitle: result.projectTitle,
                teamId: result.teamId,
                teamName: result.teamName,
                divisionName:
                    team === undefined || team.divisionId === null
                        ? null
                        : (divisionsById.get(team.divisionId) ?? null),
                rank: result.rank,
                averageScore: result.averageScore,
                submittedCount: result.submittedCount,
                assignmentCount: result.assignmentCount,
                awards: result.teamId === null ? [] : (awardsByTeam.get(result.teamId) ?? []),
            };
        })
        .toSorted(compareResultEntries);

    const votingRounds: PublicVotingRound[] = input.voting.map((result) => ({
        roundId: result.roundId,
        roundName: result.roundName,
        publishedAt: result.publishedAt,
        totalBallots: result.totalBallots,
        entries: result.entries
            .flatMap((entry): PublicVotingEntry[] => {
                const submission = submissionsById.get(entry.submissionId);
                if (submission === undefined) {
                    return [];
                }
                const team =
                    submission.teamId === null ? undefined : teamsById.get(submission.teamId);
                return [
                    {
                        submissionId: entry.submissionId,
                        projectId: submission.projectId,
                        projectTitle: entry.projectTitle || submission.title,
                        teamId: submission.teamId,
                        teamName: team?.name ?? entry.teamName,
                        rank: entry.rank,
                        votes: entry.votes,
                        totalStars: entry.totalStars,
                        averageStars: entry.averageStars,
                    },
                ];
            })
            .toSorted(
                (left, right) =>
                    right.averageStars - left.averageStars ||
                    right.totalStars - left.totalStars ||
                    right.votes - left.votes ||
                    left.projectTitle.localeCompare(right.projectTitle),
            ),
    }));

    const peopleChoice: PublicPeopleChoice | null =
        votingRounds
            .flatMap((round) =>
                round.entries.map((entry) => ({
                    ...entry,
                    roundId: round.roundId,
                    roundName: round.roundName,
                })),
            )
            .filter((entry) => entry.votes > 0)
            .toSorted(
                (left, right) =>
                    right.averageStars - left.averageStars ||
                    right.totalStars - left.totalStars ||
                    right.votes - left.votes ||
                    left.roundName.localeCompare(right.roundName) ||
                    left.projectTitle.localeCompare(right.projectTitle) ||
                    left.submissionId.localeCompare(right.submissionId),
            )[0] ?? null;

    const awards: PublicAward[] = input.awards.map((award) => ({
        id: award.id,
        namespace: award.namespace,
        name: award.name,
        description: award.description,
        icon: award.icon,
        color: award.color,
        teams: input.teamAwards
            .filter((assignment) => assignment.awardId === award.id)
            .map((assignment) => {
                const team = teamsById.get(assignment.teamId);
                if (team === undefined) {
                    throw new Error("A team award references a missing team.");
                }
                const submission = submissionByTeamId.get(assignment.teamId);
                return {
                    teamId: assignment.teamId,
                    teamName: team.name,
                    projectId: submission?.projectId ?? null,
                    projectTitle: submission?.title ?? null,
                    note: assignment.note,
                };
            })
            .toSorted((left, right) => left.teamName.localeCompare(right.teamName)),
    }));

    return {
        edition: input.edition,
        judgingEntries,
        votingRounds,
        peopleChoice,
        awards,
        publishedAt: input.publishedAt,
    };
}

export function awardsForTeam(results: PublicResults, teamId: string): readonly PublicTeamAward[] {
    return results.awards.flatMap((award) =>
        award.teams
            .filter((assignment) => assignment.teamId === teamId)
            .map((assignment) => ({
                id: award.id,
                namespace: award.namespace,
                name: award.name,
                description: award.description,
                icon: award.icon,
                color: award.color,
                note: assignment.note,
            })),
    );
}

export function findTeamResult(results: PublicResults, teamId: string): TeamResultView | null {
    const entry = results.judgingEntries.find((candidate) => candidate.teamId === teamId);
    const awards = awardsForTeam(results, teamId);
    if (entry === undefined && awards.length === 0) {
        return null;
    }
    const awardTeam = results.awards
        .flatMap((award) => award.teams)
        .find((candidate) => candidate.teamId === teamId);
    const teamName = entry?.teamName ?? awardTeam?.teamName;
    if (teamName === undefined) {
        return null;
    }
    const project =
        entry !== undefined
            ? { id: entry.projectId, title: entry.projectTitle }
            : awardTeam === undefined ||
                awardTeam.projectId === null ||
                awardTeam.projectTitle === null
              ? null
              : { id: awardTeam.projectId, title: awardTeam.projectTitle };
    return {
        teamId,
        teamName,
        project,
        rank: entry?.rank ?? null,
        awards,
    };
}

function compareResultEntries(left: PublicResultEntry, right: PublicResultEntry): number {
    if (left.rank !== right.rank) {
        if (left.rank === null) {
            return 1;
        }
        if (right.rank === null) {
            return -1;
        }
        return left.rank - right.rank;
    }
    return (
        left.projectTitle.localeCompare(right.projectTitle) ||
        left.submissionId.localeCompare(right.submissionId)
    );
}
