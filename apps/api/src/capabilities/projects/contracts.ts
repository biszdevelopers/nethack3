import type { ProjectStatus } from "@nethack/contracts";

export interface ProjectSummary {
    readonly id: string;
    readonly organizationId: string;
    readonly editionId: string;
    readonly teamId: string | null;
    readonly ownerUserId: string;
    readonly title: string;
    readonly slug: string;
    readonly summary: string;
    readonly descriptionMarkdown: string;
    readonly repositoryUrl: string | null;
    readonly demoUrl: string | null;
    readonly tags: readonly string[];
    readonly status: ProjectStatus;
    readonly publishedAt: string | null;
}

export interface ProjectsContract {
    getProject(organizationId: string, projectId: string): Promise<ProjectSummary | null>;
    isProjectMember(organizationId: string, projectId: string, userId: string): Promise<boolean>;
    listTeamProjects(organizationId: string, teamId: string): Promise<readonly ProjectSummary[]>;
    countProjects(organizationId: string, editionId: string): Promise<number>;
}

export const PROJECTS_CONTRACT = "projects.v1";
