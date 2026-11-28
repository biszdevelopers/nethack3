import type { OrganizationRole } from "@nethack/contracts";
import { ConflictError, ForbiddenError } from "../../../core/errors.js";

const ROLE_RANK: Record<OrganizationRole, number> = {
    owner: 3,
    organizer: 2,
    judge: 1,
    participant: 0,
};

export class OrganizationRules {
    static isOwner(role: OrganizationRole): boolean {
        return role === "owner";
    }

    static atLeast(role: OrganizationRole, minimum: OrganizationRole): boolean {
        return ROLE_RANK[role] >= ROLE_RANK[minimum];
    }

    static assertCanManage(role: OrganizationRole): void {
        if (!OrganizationRules.isOwner(role)) {
            throw new ForbiddenError("Only an organization owner may perform this action.");
        }
    }

    static assertRoleChangeIsSafe(
        currentRole: OrganizationRole,
        nextRole: OrganizationRole,
        ownerCount: number,
    ): void {
        if (currentRole === "owner" && nextRole !== "owner" && ownerCount <= 1) {
            throw new ConflictError("The organization must retain at least one owner.");
        }
    }

    /**
     * Only participants may compete on a team. Judges and organizers (including
     * owners) cannot hold a role above participant while they remain on one.
     */
    static assertRoleFitsTeamMembership(
        role: OrganizationRole,
        hasActiveTeamMembership: boolean,
    ): void {
        if (hasActiveTeamMembership && role !== "participant") {
            throw new ConflictError(
                "A user who competes on a team cannot also be a judge or organizer in this organization.",
            );
        }
    }

    static assertRemovalIsSafe(role: OrganizationRole, ownerCount: number): void {
        if (role === "owner" && ownerCount <= 1) {
            throw new ConflictError("The organization must retain at least one owner.");
        }
    }
}
