import type { PublicProject } from "@nethack/contracts";
import type { ShowcaseProject } from "./showcase-data";

export function toShowcaseProject(project: PublicProject): ShowcaseProject {
    return {
        id: project.id,
        title: project.title,
        slug: project.slug,
        summary: project.summary,
        descriptionMarkdown: project.descriptionMarkdown,
        repositoryUrl: project.repositoryUrl,
        demoUrl: project.demoUrl,
        tags: project.tags,
        teamName: project.teamName,
        competitionName: project.competitionName,
    };
}
