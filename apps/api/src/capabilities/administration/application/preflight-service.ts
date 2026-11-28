import type {
    AdministrationPreflight,
    AdministrationPreflightTeamWarning,
    JudgingResult,
    VotingRound,
} from "@nethack/contracts";
import type { Clock } from "../../../core/clock.js";
import { NotFoundError } from "../../../core/errors.js";
import type { CompetitionsContract, EditionSummary } from "../../competitions/contracts.js";
import {
    TEAM_FEEDBACK_MINIMUM_EVALUATIONS,
    type JudgingContract,
} from "../../judging/contracts.js";
import type { ParticipantsContract } from "../../participants/contracts.js";
import type { ProjectsContract } from "../../projects/contracts.js";
import type { SubmissionSummary, SubmissionsContract } from "../../submissions/contracts.js";
import type { TeamsContract } from "../../teams/contracts.js";
import type { VotingContract } from "../../voting/contracts.js";

const JUDGEABLE_SUBMISSION_STATUSES: readonly SubmissionSummary["status"][] = [
    "submitted",
    "accepted",
];

export interface PreflightSources {
    readonly editions: Pick<CompetitionsContract, "getEdition" | "listMilestones">;
    readonly teams: Pick<TeamsContract, "countTeams" | "listEditionTeams">;
    readonly projects: Pick<ProjectsContract, "countProjects">;
    readonly submissions: Pick<SubmissionsContract, "countSubmissions" | "listEditionSubmissions">;
    readonly judging: Pick<JudgingContract, "listEditionResults" | "countOpenFlags">;
    readonly voting: Pick<VotingContract, "listRounds">;
    readonly participants: Pick<ParticipantsContract, "countApprovedParticipants">;
}

/**
 * Readiness snapshot for publishing an edition. Counting comes from the public
 * contracts so the preflight can never disagree with the organizer screens.
 * Warning lists only include checks backed by data the contracts expose.
 */
export class PreflightService {
    private readonly sources: PreflightSources;
    private readonly clock: Clock;

    constructor(sources: PreflightSources, clock: Clock) {
        this.sources = sources;
        this.clock = clock;
    }

    async forEdition(organizationId: string, editionId: string): Promise<AdministrationPreflight> {
        const edition = await this.sources.editions.getEdition(organizationId, editionId);
        if (edition === null) {
            throw new NotFoundError("The competition edition was not found.");
        }
        const [
            teams,
            teamList,
            projects,
            submissions,
            submissionList,
            milestones,
            results,
            rounds,
            openFlags,
        ] = await Promise.all([
            this.sources.teams.countTeams(organizationId, editionId),
            this.sources.teams.listEditionTeams(organizationId, editionId),
            this.sources.projects.countProjects(organizationId, editionId),
            this.sources.submissions.countSubmissions(organizationId, editionId),
            this.sources.submissions.listEditionSubmissions(organizationId, editionId),
            this.sources.editions.listMilestones(organizationId, editionId),
            this.sources.judging.listEditionResults(organizationId, editionId),
            this.sources.voting.listRounds(organizationId, editionId),
            this.sources.judging.countOpenFlags(organizationId, editionId),
        ]);
        const assignments = results.reduce((total, result) => total + result.assignmentCount, 0);
        const submittedEvaluations = results.reduce(
            (total, result) => total + result.submittedCount,
            0,
        );
        const belowMinimumTeams = teamsBelowMinimum(
            submissionList,
            results,
            new Map(teamList.map((team) => [team.id, team.name] as const)),
        );
        const now = this.clock.now();
        const evaluatedRounds = rounds.filter((round) => isOpenOrUpcoming(round, now));
        const eligibleSubmissions = submissionList.filter((submission) =>
            JUDGEABLE_SUBMISSION_STATUSES.some((status) => status === submission.status),
        ).length;
        const voterCapChecks = evaluatedRounds.filter(
            (round) =>
                round.maxVotesPerUser > 0 &&
                round.eligibleRoles.every((role) => role === "participant"),
        );
        const eligibleVoters =
            voterCapChecks.length === 0
                ? 0
                : await this.sources.participants.countApprovedParticipants(
                      organizationId,
                      editionId,
                  );
        return {
            editionId,
            teams,
            projects,
            submissions,
            assignments,
            submittedEvaluations,
            openFlags,
            publishedResults: rounds.some((round) => round.status === "published"),
            teamsBelowMinimumEvaluations: belowMinimumTeams.length,
            belowMinimumTeams,
            scheduleWarnings: scheduleWarnings(edition, milestones),
            voteCapWarnings: voteCapWarnings(evaluatedRounds, eligibleSubmissions, eligibleVoters),
            readiness: {
                hasTeams: teams > 0,
                hasSubmissions: submissions > 0,
                hasAssignments: assignments > 0,
                hasSubmittedEvaluations: submittedEvaluations > 0,
            },
        };
    }
}

function isOpenOrUpcoming(round: VotingRound, now: Date): boolean {
    if (round.status === "open") {
        return true;
    }
    if (round.status !== "draft" || round.opensAt === null) {
        return false;
    }
    return new Date(round.opensAt).getTime() > now.getTime();
}

function scheduleWarnings(
    edition: EditionSummary,
    milestones: readonly { readonly title: string; readonly occursAt: string }[],
): string[] {
    const warnings: string[] = [];
    const start = edition.startsAt === null ? null : new Date(edition.startsAt);
    const end = edition.endsAt === null ? null : new Date(edition.endsAt);
    const registrationCloses =
        edition.registrationClosesAt === null ? null : new Date(edition.registrationClosesAt);
    if (start !== null && end !== null && end.getTime() < start.getTime()) {
        warnings.push("The edition ends before it starts.");
    }
    if (
        registrationCloses !== null &&
        start !== null &&
        registrationCloses.getTime() > start.getTime()
    ) {
        warnings.push("Registration closes after the edition starts.");
    }
    for (const milestone of milestones) {
        const occursAt = new Date(milestone.occursAt);
        if (start !== null && occursAt.getTime() < start.getTime()) {
            warnings.push(`Milestone “${milestone.title}” occurs before the edition starts.`);
            continue;
        }
        if (end !== null && occursAt.getTime() > end.getTime()) {
            warnings.push(`Milestone “${milestone.title}” occurs after the edition ends.`);
        }
    }
    return warnings;
}

function voteCapWarnings(
    rounds: readonly VotingRound[],
    eligibleSubmissions: number,
    eligibleVoters: number,
): string[] {
    const warnings: string[] = [];
    for (const round of rounds) {
        if (round.maxSelections > eligibleSubmissions) {
            warnings.push(
                `Round “${round.name}” allows ${String(round.maxSelections)} selections but the edition has ${String(eligibleSubmissions)} eligible submission${
                    eligibleSubmissions === 1 ? "" : "s"
                }.`,
            );
        }
        if (round.maxVotesPerUser === 0) {
            continue;
        }
        if (!round.eligibleRoles.every((role) => role === "participant")) {
            continue;
        }
        const totalVotes = round.maxVotesPerUser * eligibleVoters;
        if (totalVotes < round.maxSelections) {
            warnings.push(
                `Round “${round.name}” caps each of ${String(eligibleVoters)} eligible voters at ${String(round.maxVotesPerUser)} selections, so at most ${String(totalVotes)} votes can cover a ${String(round.maxSelections)} selection limit.`,
            );
        }
    }
    return warnings;
}

function teamsBelowMinimum(
    submissions: readonly SubmissionSummary[],
    results: readonly JudgingResult[],
    teamNames: ReadonlyMap<string, string>,
): AdministrationPreflightTeamWarning[] {
    const submittedBySubmission = new Map(
        results.map((result) => [result.submissionId, result.submittedCount] as const),
    );
    const entries = new Map<string, AdministrationPreflightTeamWarning>();
    for (const submission of submissions) {
        if (!JUDGEABLE_SUBMISSION_STATUSES.some((status) => status === submission.status)) {
            continue;
        }
        const key = submission.teamId ?? submission.id;
        const existing = entries.get(key);
        const submittedEvaluations =
            (existing?.submittedEvaluations ?? 0) + (submittedBySubmission.get(submission.id) ?? 0);
        const projectTitle =
            existing === undefined || existing.projectTitle === submission.title
                ? submission.title
                : `${existing.projectTitle}, ${submission.title}`;
        entries.set(key, {
            teamId: submission.teamId,
            teamName:
                submission.teamId === null ? null : (teamNames.get(submission.teamId) ?? null),
            projectTitle,
            submittedEvaluations,
        });
    }
    return [...entries.values()]
        .filter((entry) => entry.submittedEvaluations < TEAM_FEEDBACK_MINIMUM_EVALUATIONS)
        .toSorted((left, right) =>
            (left.teamName ?? left.projectTitle).localeCompare(
                right.teamName ?? right.projectTitle,
            ),
        );
}
