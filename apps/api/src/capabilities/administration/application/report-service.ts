import type { ReportSummary } from "@nethack/contracts";
import type { CompetitionsContract, EditionSummary } from "../../competitions/contracts.js";
import type { JudgingContract } from "../../judging/contracts.js";
import type { ParticipantsContract } from "../../participants/contracts.js";
import type { ProjectsContract } from "../../projects/contracts.js";
import type { SubmissionsContract } from "../../submissions/contracts.js";
import type { TeamsContract } from "../../teams/contracts.js";

export interface ReportSources {
    readonly editions: Pick<CompetitionsContract, "listEditions">;
    readonly registrations: Pick<ParticipantsContract, "countRegistrations">;
    readonly teams: Pick<TeamsContract, "countTeams">;
    readonly projects: Pick<ProjectsContract, "countProjects">;
    readonly submissions: Pick<SubmissionsContract, "countSubmissions">;
    readonly evaluations: Pick<JudgingContract, "countSubmittedEvaluations">;
}

const MAX_EDITIONS = 50;

export class ReportService {
    private readonly sources: ReportSources;

    constructor(sources: ReportSources) {
        this.sources = sources;
    }

    async summary(organizationId: string): Promise<ReportSummary> {
        const editions = await this.sources.editions.listEditions(organizationId);
        const bounded = editions.toSorted(byStartDescending).slice(0, MAX_EDITIONS);
        const summaries: ReportSummary["editions"] = [];
        for (const edition of bounded) {
            const [registrations, teams, projects, submissions, evaluationsSubmitted] =
                await Promise.all([
                    this.sources.registrations.countRegistrations(organizationId, edition.id),
                    this.sources.teams.countTeams(organizationId, edition.id),
                    this.sources.projects.countProjects(organizationId, edition.id),
                    this.sources.submissions.countSubmissions(organizationId, edition.id),
                    this.sources.evaluations.countSubmittedEvaluations(organizationId, edition.id),
                ]);
            summaries.push({
                editionId: edition.id,
                editionName: edition.name,
                registrations: registrations.total,
                approvedRegistrations: registrations.approved,
                teams,
                projects,
                submissions,
                evaluationsSubmitted,
            });
        }
        return { organizationId, editions: summaries };
    }
}

function byStartDescending(left: EditionSummary, right: EditionSummary): number {
    if (left.startsAt === right.startsAt) {
        return 0;
    }
    if (left.startsAt === null) {
        return 1;
    }
    if (right.startsAt === null) {
        return -1;
    }
    return Date.parse(right.startsAt) - Date.parse(left.startsAt);
}
