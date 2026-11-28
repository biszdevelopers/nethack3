import type { AdministrationPreflight } from "@nethack/contracts";
import { NotFoundError } from "../../../core/errors.js";
import type { CompetitionsContract } from "../../competitions/contracts.js";
import type { JudgingContract } from "../../judging/contracts.js";
import type { ProjectsContract } from "../../projects/contracts.js";
import type { SubmissionsContract } from "../../submissions/contracts.js";
import type { TeamsContract } from "../../teams/contracts.js";
import type { VotingContract } from "../../voting/contracts.js";

export interface PreflightSources {
    readonly editions: Pick<CompetitionsContract, "getEdition">;
    readonly teams: Pick<TeamsContract, "countTeams">;
    readonly projects: Pick<ProjectsContract, "countProjects">;
    readonly submissions: Pick<SubmissionsContract, "countSubmissions">;
    readonly judging: Pick<JudgingContract, "listEditionResults" | "countOpenFlags">;
    readonly voting: Pick<VotingContract, "listRounds">;
}

/**
 * Readiness snapshot for publishing an edition. Counting comes from the public
 * contracts so the preflight can never disagree with the organizer screens.
 */
export class PreflightService {
    private readonly sources: PreflightSources;

    constructor(sources: PreflightSources) {
        this.sources = sources;
    }

    async forEdition(organizationId: string, editionId: string): Promise<AdministrationPreflight> {
        const edition = await this.sources.editions.getEdition(organizationId, editionId);
        if (edition === null) {
            throw new NotFoundError("The competition edition was not found.");
        }
        const [teams, projects, submissions, results, rounds, openFlags] = await Promise.all([
            this.sources.teams.countTeams(organizationId, editionId),
            this.sources.projects.countProjects(organizationId, editionId),
            this.sources.submissions.countSubmissions(organizationId, editionId),
            this.sources.judging.listEditionResults(organizationId, editionId),
            this.sources.voting.listRounds(organizationId, editionId),
            this.sources.judging.countOpenFlags(organizationId, editionId),
        ]);
        const assignments = results.reduce((total, result) => total + result.assignmentCount, 0);
        const submittedEvaluations = results.reduce(
            (total, result) => total + result.submittedCount,
            0,
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
            readiness: {
                hasTeams: teams > 0,
                hasSubmissions: submissions > 0,
                hasAssignments: assignments > 0,
                hasSubmittedEvaluations: submittedEvaluations > 0,
            },
        };
    }
}
