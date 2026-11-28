import type { ProjectStatus } from "@nethack/contracts";
import type { DatabaseSession } from "../../infrastructure/database/client.js";

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
    readonly videoUrl: string | null;
    readonly aiDisclosure: string;
    readonly tags: readonly string[];
    readonly status: ProjectStatus;
    readonly publishedAt: string | null;
    readonly lockedAt: string | null;
}

export interface ProjectsContract {
    getProject(organizationId: string, projectId: string): Promise<ProjectSummary | null>;
    isProjectMember(organizationId: string, projectId: string, userId: string): Promise<boolean>;
    listTeamProjects(organizationId: string, teamId: string): Promise<readonly ProjectSummary[]>;
    countProjects(organizationId: string, editionId: string): Promise<number>;
    /**
     * Locks project editing after its first submitted version. Passing the
     * caller's session keeps the lock atomic with the submission write; without
     * one the lock runs in its own transaction. Locking is idempotent.
     */
    lockProject(
        organizationId: string,
        projectId: string,
        at: Date,
        session?: DatabaseSession,
    ): Promise<void>;
    /**
     * Unlocks project editing when an organizer reopens a submission. Passing
     * the caller's session keeps the unlock atomic with the submission write.
     * Unlocking is idempotent.
     */
    unlockProject(
        organizationId: string,
        projectId: string,
        at: Date,
        session?: DatabaseSession,
    ): Promise<void>;
}

export const PROJECTS_CONTRACT = "projects.v1";
