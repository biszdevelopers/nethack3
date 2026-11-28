import type { OrganizationMembership, OrganizationRole } from "@nethack/contracts";

export interface OrganizationSummary {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly description: string;
    readonly websiteUrl: string | null;
}

/**
 * Membership administration assumes the caller has already established an
 * owner/organizer membership in the addressed organization. The implementation
 * enforces last-owner protection and writes its own audit record.
 */
export interface OrganizationMembershipActor {
    readonly userId: string;
    readonly ip: string | null;
}

export interface OrganizationsContract {
    getSummary(organizationId: string): Promise<OrganizationSummary | null>;
    getSummaryBySlug(slug: string): Promise<OrganizationSummary | null>;
    isPublicShowcaseEnabled(organizationId: string): Promise<boolean>;
    listMembershipsWithUsers(organizationId: string): Promise<readonly OrganizationMembership[]>;
    updateMemberRole(
        actor: OrganizationMembershipActor,
        organizationId: string,
        userId: string,
        role: OrganizationRole,
    ): Promise<OrganizationMembership>;
}

export const ORGANIZATIONS_CONTRACT = "organizations.v1";
