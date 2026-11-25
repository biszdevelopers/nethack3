export interface OrganizationSummary {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly description: string;
    readonly websiteUrl: string | null;
}

export interface OrganizationsContract {
    getSummary(organizationId: string): Promise<OrganizationSummary | null>;
    isPublicShowcaseEnabled(organizationId: string): Promise<boolean>;
}

export const ORGANIZATIONS_CONTRACT = "organizations.v1";
