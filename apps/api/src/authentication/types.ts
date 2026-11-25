import type { InferSelectModel } from "drizzle-orm";
import type { OrganizationRole } from "@nethack/contracts";
import type { organizationMemberships, users } from "../infrastructure/database/schema/index.js";

export type UserRow = InferSelectModel<typeof users>;
export type MembershipRow = InferSelectModel<typeof organizationMemberships>;

export interface SessionMembership {
    readonly organizationId: string;
    readonly organizationName: string;
    readonly organizationSlug: string;
    readonly role: OrganizationRole;
    readonly status: "active" | "suspended";
}

export interface AuthContext {
    readonly method: "session" | "bearer";
    readonly sessionId: string | null;
    readonly sessionTokenHash: string | null;
    readonly csrfToken: string | null;
    readonly csrfHash: string | null;
    readonly user: UserRow;
    readonly memberships: readonly SessionMembership[];
    readonly globalAdministrator: boolean;
    readonly permissions: readonly string[];
    readonly expiresAt: Date;
}

export interface SessionCreationResult {
    readonly sessionId: string;
    readonly sessionToken: string;
    readonly csrfToken: string;
    readonly expiresAt: Date;
}

export interface RequestMetadata {
    readonly ip: string;
    readonly userAgent: string;
}
