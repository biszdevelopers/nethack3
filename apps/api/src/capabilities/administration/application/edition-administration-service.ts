import type {
    AdministrationTeam,
    AdministrationTeamSubmission,
    JudgingResult,
    ReopenAdministrationSubmissionRequest,
    TeamStatus,
} from "@nethack/contracts";
import type { AuthContext } from "../../../authentication/types.js";
import { ConflictError, NotFoundError } from "../../../core/errors.js";
import type { CompetitionsContract } from "../../competitions/contracts.js";
import type { JudgingContract } from "../../judging/contracts.js";
import type { ProjectsContract } from "../../projects/contracts.js";
import type { RecognitionContract } from "../../recognition/contracts.js";
import type { SubmissionSummary, SubmissionsContract } from "../../submissions/contracts.js";
import type { TeamsContract } from "../../teams/contracts.js";
import type { VotingContract } from "../../voting/contracts.js";
import { AdministrationRules } from "../domain/administration-rules.js";
import { standingsCsv, type StandingRow } from "./standings-csv.js";

export interface EditionAdministrationSources {
    readonly editions: Pick<CompetitionsContract, "getEdition" | "listDivisions">;
    readonly teams: Pick<
        TeamsContract,
        "listEditionTeams" | "listEditionTeamsWithMembers" | "updateTeamStatus" | "deleteTeam"
    >;
    readonly submissions: Pick<
        SubmissionsContract,
        "getSubmission" | "listEditionSubmissions" | "countTeamSubmissions" | "reopenSubmission"
    >;
    readonly judging: Pick<JudgingContract, "listEditionResults">;
    readonly projects: Pick<ProjectsContract, "getProject">;
    readonly recognition: Pick<RecognitionContract, "getPublishedResults" | "listTeamAwardNames">;
    readonly voting: Pick<VotingContract, "removeSubmissionVotes">;
}

/**
 * Coordinates edition administration through public capability contracts. Team
 * and submission writes are owned by their capabilities; this service only
 * composes their reads and enforces the cross-capability reopen guard.
 */
export class EditionAdministrationService {
    private readonly sources: EditionAdministrationSources;

    constructor(sources: EditionAdministrationSources) {
        this.sources = sources;
    }

    async listTeams(
        organizationId: string,
        editionId: string,
    ): Promise<readonly AdministrationTeam[]> {
        await this.requireEdition(organizationId, editionId);
        const [teams, submissions, divisions, results] = await Promise.all([
            this.sources.teams.listEditionTeamsWithMembers(organizationId, editionId),
            this.sources.submissions.listEditionSubmissions(organizationId, editionId),
            this.sources.editions.listDivisions(organizationId, editionId),
            this.sources.judging.listEditionResults(organizationId, editionId),
        ]);
        const submissionsByTeam = new Map<string, AdministrationTeamSubmission[]>();
        const latestByTeam = new Map<string, SubmissionSummary>();
        for (const submission of submissions) {
            if (submission.teamId === null) {
                continue;
            }
            const list = submissionsByTeam.get(submission.teamId) ?? [];
            list.push({
                id: submission.id,
                projectTitle: submission.title,
                status: submission.status,
            });
            submissionsByTeam.set(submission.teamId, list);
            const latest = latestByTeam.get(submission.teamId);
            if (latest === undefined || isNewerSubmission(submission, latest)) {
                latestByTeam.set(submission.teamId, submission);
            }
        }
        const divisionNames = new Map(divisions.map((division) => [division.id, division.name]));
        const resultsByTeam = new Map<string, JudgingResult>();
        for (const result of results) {
            if (result.teamId === null) {
                continue;
            }
            const existing = resultsByTeam.get(result.teamId);
            if (existing === undefined || isBetterResult(result, existing)) {
                resultsByTeam.set(result.teamId, result);
            }
        }
        return teams.map((team) => {
            const latest = latestByTeam.get(team.id);
            const result = resultsByTeam.get(team.id);
            return {
                id: team.id,
                editionId: team.editionId,
                name: team.name,
                description: team.description,
                status: team.status,
                statusReason: team.statusReason,
                divisionId: team.divisionId,
                divisionName:
                    team.divisionId === null ? null : (divisionNames.get(team.divisionId) ?? null),
                captainUserId: team.captainUserId,
                memberCount: team.memberCount,
                maxMembers: team.maxMembers,
                members: [...team.members],
                submissions: submissionsByTeam.get(team.id) ?? [],
                projectTitle: latest?.title ?? null,
                submittedAt: latest?.submittedAt ?? null,
                score: result?.displayScore ?? result?.averageScore ?? null,
                rank: result?.rank ?? null,
            };
        });
    }

    async updateTeamStatus(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        teamId: string,
        status: TeamStatus,
        reason: string,
        ip: string | null,
    ): Promise<void> {
        await this.sources.teams.updateTeamStatus(
            { userId: auth.user.id, ip },
            organizationId,
            editionId,
            teamId,
            status,
            reason,
        );
    }

    async deleteTeam(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        teamId: string,
        ip: string | null,
    ): Promise<void> {
        const submissionCount = await this.sources.submissions.countTeamSubmissions(
            organizationId,
            editionId,
            teamId,
        );
        if (submissionCount > 0) {
            throw new ConflictError("Remove the team's submission before deleting the team.");
        }
        await this.sources.teams.deleteTeam(
            { userId: auth.user.id, ip },
            organizationId,
            editionId,
            teamId,
        );
    }

    async reopenSubmission(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        submissionId: string,
        input: ReopenAdministrationSubmissionRequest,
        ip: string | null,
    ): Promise<void> {
        await this.requireEdition(organizationId, editionId);
        const published = await this.sources.recognition.getPublishedResults(
            organizationId,
            editionId,
        );
        AdministrationRules.assertResultsNotPublished(published !== null);
        const submission = await this.sources.submissions.getSubmission(
            organizationId,
            submissionId,
        );
        if (submission === null || submission.editionId !== editionId) {
            throw new NotFoundError("The submission was not found in this edition.");
        }
        const results = await this.sources.judging.listEditionResults(organizationId, editionId);
        const result = results.find((candidate) => candidate.submissionId === submissionId);
        AdministrationRules.assertNoSubmittedEvaluations(result?.submittedCount ?? 0);
        // Clear People's Choice stars first so a resubmission cannot inherit the
        // votes earned by the previous version. Reopening runs only after the
        // cleanup commits.
        await this.sources.voting.removeSubmissionVotes(organizationId, submissionId);
        await this.sources.submissions.reopenSubmission(
            { userId: auth.user.id, ip },
            organizationId,
            submissionId,
            input.status,
        );
    }

    async standingsCsv(organizationId: string, editionId: string): Promise<string> {
        return standingsCsv(await this.listStandings(organizationId, editionId));
    }

    /**
     * One row per team in the edition, composed from the public contracts:
     * team identity and status from teams, division from competitions, latest
     * submission from submissions, scores from judging, award names from
     * recognition, and demo/repository links from projects.
     */
    async listStandings(
        organizationId: string,
        editionId: string,
    ): Promise<readonly StandingRow[]> {
        await this.requireEdition(organizationId, editionId);
        const [teams, submissions, results, divisions, awardNames] = await Promise.all([
            this.sources.teams.listEditionTeams(organizationId, editionId),
            this.sources.submissions.listEditionSubmissions(organizationId, editionId),
            this.sources.judging.listEditionResults(organizationId, editionId),
            this.sources.editions.listDivisions(organizationId, editionId),
            this.sources.recognition.listTeamAwardNames(organizationId, editionId),
        ]);

        const latestByTeam = new Map<string, SubmissionSummary>();
        for (const submission of submissions) {
            if (submission.teamId === null) {
                continue;
            }
            const latest = latestByTeam.get(submission.teamId);
            if (latest === undefined || isNewerSubmission(submission, latest)) {
                latestByTeam.set(submission.teamId, submission);
            }
        }
        const resultsByTeam = new Map<string, JudgingResult>();
        for (const result of results) {
            if (result.teamId === null) {
                continue;
            }
            const existing = resultsByTeam.get(result.teamId);
            if (existing === undefined || isBetterResult(result, existing)) {
                resultsByTeam.set(result.teamId, result);
            }
        }
        const divisionNames = new Map(divisions.map((division) => [division.id, division.name]));
        const awardsByTeam = new Map<string, string[]>();
        for (const award of awardNames) {
            const names = awardsByTeam.get(award.teamId) ?? [];
            names.push(award.name);
            awardsByTeam.set(award.teamId, names);
        }
        for (const [teamId, names] of awardsByTeam) {
            awardsByTeam.set(
                teamId,
                names.toSorted((left, right) => left.localeCompare(right)),
            );
        }

        const projectIds = new Set<string>();
        for (const team of teams) {
            const projectId =
                resultsByTeam.get(team.id)?.projectId ?? latestByTeam.get(team.id)?.projectId;
            if (projectId !== undefined) {
                projectIds.add(projectId);
            }
        }
        const projects = new Map(
            await Promise.all(
                [...projectIds].map(
                    async (projectId) =>
                        [
                            projectId,
                            await this.sources.projects.getProject(organizationId, projectId),
                        ] as const,
                ),
            ),
        );

        const rows = teams.map((team): StandingRow => {
            const latest = latestByTeam.get(team.id);
            const result = resultsByTeam.get(team.id);
            const projectId = result?.projectId ?? latest?.projectId ?? null;
            const project = projectId === null ? null : (projects.get(projectId) ?? null);
            return {
                teamId: team.id,
                teamName: team.name,
                status: team.status,
                pathway:
                    team.divisionId === null ? null : (divisionNames.get(team.divisionId) ?? null),
                rank: result?.rank ?? null,
                averageScore: result?.averageScore ?? null,
                displayScore: result?.displayScore ?? null,
                awards: awardsByTeam.get(team.id) ?? [],
                projectTitle: result?.projectTitle ?? latest?.title ?? project?.title ?? null,
                demoUrl: project?.demoUrl ?? null,
                repositoryUrl: project?.repositoryUrl ?? null,
                submitted: latest !== undefined && latest.submittedAt !== null,
            };
        });
        return rows.toSorted(compareStandings);
    }

    private async requireEdition(organizationId: string, editionId: string): Promise<void> {
        const edition = await this.sources.editions.getEdition(organizationId, editionId);
        if (edition === null) {
            throw new NotFoundError("The competition edition was not found.");
        }
    }
}

function isNewerSubmission(candidate: SubmissionSummary, current: SubmissionSummary): boolean {
    if (candidate.submittedAt === null) {
        return false;
    }
    if (current.submittedAt === null) {
        return true;
    }
    if (candidate.submittedAt !== current.submittedAt) {
        return candidate.submittedAt > current.submittedAt;
    }
    return candidate.currentVersion > current.currentVersion;
}

function isBetterResult(candidate: JudgingResult, current: JudgingResult): boolean {
    const candidateRank = candidate.rank ?? Number.POSITIVE_INFINITY;
    const currentRank = current.rank ?? Number.POSITIVE_INFINITY;
    if (candidateRank !== currentRank) {
        return candidateRank < currentRank;
    }
    const candidateScore = candidate.displayScore ?? candidate.averageScore ?? -1;
    const currentScore = current.displayScore ?? current.averageScore ?? -1;
    return candidateScore > currentScore;
}

function compareStandings(left: StandingRow, right: StandingRow): number {
    const leftRank = left.rank ?? Number.POSITIVE_INFINITY;
    const rightRank = right.rank ?? Number.POSITIVE_INFINITY;
    if (leftRank !== rightRank) {
        return leftRank - rightRank;
    }
    return left.teamName.localeCompare(right.teamName) || left.teamId.localeCompare(right.teamId);
}
