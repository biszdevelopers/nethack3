import type {
    AdministrationTeam,
    AdministrationTeamSubmission,
    ReopenAdministrationSubmissionRequest,
    TeamStatus,
} from "@nethack/contracts";
import type { AuthContext } from "../../../authentication/types.js";
import { ConflictError, NotFoundError } from "../../../core/errors.js";
import type { CompetitionsContract } from "../../competitions/contracts.js";
import type { JudgingContract } from "../../judging/contracts.js";
import type { SubmissionsContract } from "../../submissions/contracts.js";
import type { TeamsContract } from "../../teams/contracts.js";
import { AdministrationRules } from "../domain/administration-rules.js";
import { standingsCsv } from "./standings-csv.js";

export interface EditionAdministrationSources {
    readonly editions: Pick<CompetitionsContract, "getEdition">;
    readonly teams: Pick<
        TeamsContract,
        "listEditionTeamsWithMembers" | "updateTeamStatus" | "deleteTeam"
    >;
    readonly submissions: Pick<
        SubmissionsContract,
        "getSubmission" | "listEditionSubmissions" | "countTeamSubmissions" | "reopenSubmission"
    >;
    readonly judging: Pick<JudgingContract, "listEditionResults">;
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
        const [teams, submissions] = await Promise.all([
            this.sources.teams.listEditionTeamsWithMembers(organizationId, editionId),
            this.sources.submissions.listEditionSubmissions(organizationId, editionId),
        ]);
        const submissionsByTeam = new Map<string, AdministrationTeamSubmission[]>();
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
        }
        return teams.map((team) => ({
            id: team.id,
            editionId: team.editionId,
            name: team.name,
            description: team.description,
            status: team.status,
            divisionId: team.divisionId,
            captainUserId: team.captainUserId,
            memberCount: team.memberCount,
            maxMembers: team.maxMembers,
            members: [...team.members],
            submissions: submissionsByTeam.get(team.id) ?? [],
        }));
    }

    async updateTeamStatus(
        auth: AuthContext,
        organizationId: string,
        editionId: string,
        teamId: string,
        status: TeamStatus,
        ip: string | null,
    ): Promise<void> {
        await this.sources.teams.updateTeamStatus(
            { userId: auth.user.id, ip },
            organizationId,
            editionId,
            teamId,
            status,
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
        await this.sources.submissions.reopenSubmission(
            { userId: auth.user.id, ip },
            organizationId,
            submissionId,
            input.status,
        );
    }

    async standingsCsv(organizationId: string, editionId: string): Promise<string> {
        const results = await this.sources.judging.listEditionResults(organizationId, editionId);
        return standingsCsv(results);
    }

    private async requireEdition(organizationId: string, editionId: string): Promise<void> {
        const edition = await this.sources.editions.getEdition(organizationId, editionId);
        if (edition === null) {
            throw new NotFoundError("The competition edition was not found.");
        }
    }
}
