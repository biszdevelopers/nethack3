import { randomBytes } from "node:crypto";
import type { CompetitionEditionStatus, OrganizationRole, ProjectStatus } from "@nethack/contracts";
import { ConflictError, ForbiddenError } from "../../../core/errors.js";

const PUBLISHABLE_EDITION_STATUSES: ReadonlySet<CompetitionEditionStatus> = new Set([
    "published",
    "registration_closed",
    "active",
    "judging",
    "voting",
    "completed",
]);

export interface ProjectAccessShape {
    readonly ownerUserId: string;
    readonly status: ProjectStatus;
}

export class ProjectRules {
    static isOrganizer(role: OrganizationRole): boolean {
        return role === "owner" || role === "organizer";
    }

    static canView(
        project: ProjectAccessShape,
        userId: string,
        organizationRole: OrganizationRole,
        projectMemberRole: "owner" | "member" | null,
        isTeamMember: boolean,
    ): boolean {
        return (
            ProjectRules.isOrganizer(organizationRole) ||
            project.ownerUserId === userId ||
            projectMemberRole !== null ||
            isTeamMember
        );
    }

    static assertCanEdit(
        project: ProjectAccessShape,
        userId: string,
        organizationRole: OrganizationRole,
        projectMemberRole: "owner" | "member" | null,
    ): void {
        if (
            ProjectRules.isOrganizer(organizationRole) ||
            project.ownerUserId === userId ||
            projectMemberRole === "owner"
        ) {
            return;
        }
        throw new ForbiddenError("Only the project owner or an organizer may edit this project.");
    }

    static assertNotLocked(lockedAt: Date | null): void {
        if (lockedAt !== null) {
            throw new ConflictError(
                "This project was locked when its first version was submitted and can no longer be edited.",
            );
        }
    }

    static assertCanManageMembers(
        project: ProjectAccessShape,
        userId: string,
        organizationRole: OrganizationRole,
        projectMemberRole: "owner" | "member" | null,
    ): void {
        ProjectRules.assertCanEdit(project, userId, organizationRole, projectMemberRole);
    }

    static assertCanPublish(
        project: ProjectAccessShape,
        userId: string,
        organizationRole: OrganizationRole,
        projectMemberRole: "owner" | "member" | null,
    ): void {
        if (
            ProjectRules.isOrganizer(organizationRole) ||
            project.ownerUserId === userId ||
            projectMemberRole === "owner"
        ) {
            return;
        }
        throw new ForbiddenError(
            "Only the project owner or an organizer may publish this project.",
        );
    }

    static assertEditionAllowsPublishing(status: CompetitionEditionStatus): void {
        if (!PUBLISHABLE_EDITION_STATUSES.has(status)) {
            throw new ConflictError("The competition edition is not open for publishing projects.");
        }
    }

    static assertPublishableContent(title: string, summary: string): void {
        if (title.trim().length === 0 || summary.trim().length === 0) {
            throw new ConflictError(
                "A project needs a title and a summary before it can be published.",
            );
        }
    }

    static buildSlug(title: string): string {
        const normalized = title
            .toLowerCase()
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+/, "")
            .replace(/-+$/, "")
            .slice(0, 60)
            .replace(/-+$/, "");
        const base = normalized.length > 0 ? normalized : "project";
        return `${base}-${randomBytes(4).toString("hex").slice(0, 6)}`;
    }
}

export function filterShowcasedProjects<T extends { readonly organizationId: string }>(
    rows: readonly T[],
    showcaseEnabled: ReadonlyMap<string, boolean>,
): readonly T[] {
    return rows.filter((row) => showcaseEnabled.get(row.organizationId) === true);
}
