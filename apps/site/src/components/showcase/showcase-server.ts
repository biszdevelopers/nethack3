import type { PublicProject, PublicResults } from "@nethack/contracts";
import type { ShowcaseAward, ShowcaseProject } from "./showcase-data";

export interface ShowcaseStandings {
    readonly showRanking: boolean;
    readonly byProjectId: ReadonlyMap<string, ShowcaseStanding>;
    readonly byProjectSlug: ReadonlyMap<string, ShowcaseStanding>;
}

export interface ShowcaseStanding {
    readonly rank: number | null;
    readonly awards: readonly ShowcaseAward[];
}

export function toShowcaseStandings(results: PublicResults): ShowcaseStandings {
    const byProjectId = new Map<string, ShowcaseStanding>();
    const byProjectSlug = new Map<string, ShowcaseStanding>();
    for (const entry of results.judgingEntries) {
        const standing: ShowcaseStanding = {
            rank: entry.rank,
            awards: entry.awards.map((award) => ({ id: award.id, name: award.name })),
        };
        byProjectId.set(entry.projectId, standing);
        if (entry.projectSlug.length > 0) {
            byProjectSlug.set(entry.projectSlug, standing);
        }
    }
    return { showRanking: results.showRanking, byProjectId, byProjectSlug };
}

export function toShowcaseProject(
    project: PublicProject,
    standings?: ShowcaseStandings,
): ShowcaseProject {
    const standing =
        standings?.byProjectId.get(project.id) ??
        standings?.byProjectSlug.get(project.slug) ??
        null;
    const rank = standing?.rank ?? null;
    const awards = standing?.awards ?? [];
    return {
        id: project.id,
        title: project.title,
        slug: project.slug,
        summary: project.summary,
        descriptionMarkdown: project.descriptionMarkdown,
        repositoryUrl: project.repositoryUrl,
        demoUrl: project.demoUrl,
        videoUrl: project.videoUrl,
        aiDisclosure: project.aiDisclosure,
        tags: project.tags,
        teamId: project.teamId,
        teamName: project.teamName,
        teamStatus: project.teamStatus,
        divisionName: project.divisionName,
        competitionName: project.competitionName,
        rank,
        awards,
        certificateUrl:
            standings !== undefined &&
            project.teamId !== null &&
            (awards.length > 0 || (rank !== null && standings.showRanking))
                ? `/certificates/${encodeURIComponent(project.teamId)}`
                : null,
        showRanking: standings?.showRanking ?? false,
    };
}
