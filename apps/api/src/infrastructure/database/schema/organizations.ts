import {
    boolean,
    index,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";
import { users } from "./identity.js";

export const organizationRoleEnum = pgEnum("organization_role", [
    "owner",
    "organizer",
    "judge",
    "participant",
]);
export const membershipStatusEnum = pgEnum("membership_status", ["active", "suspended"]);
export const invitationStatusEnum = pgEnum("invitation_status", [
    "pending",
    "accepted",
    "revoked",
    "expired",
]);

export const organizations = pgTable(
    "organizations",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        name: text("name").notNull(),
        slug: text("slug").notNull(),
        description: text("description").notNull().default(""),
        websiteUrl: text("website_url"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("organizations_slug_unique").on(table.slug),
        index("organizations_name_idx").on(table.name),
    ],
);

export const organizationSettings = pgTable("organization_settings", {
    organizationId: uuid("organization_id")
        .primaryKey()
        .references(() => organizations.id, { onDelete: "cascade" }),
    registrationRequiresApproval: boolean("registration_requires_approval").notNull().default(true),
    allowParticipantTeamCreation: boolean("allow_participant_team_creation")
        .notNull()
        .default(true),
    publicShowcaseEnabled: boolean("public_showcase_enabled").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const organizationMemberships = pgTable(
    "organization_memberships",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        role: organizationRoleEnum("role").notNull(),
        status: membershipStatusEnum("status").notNull().default("active"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("organization_memberships_org_user_unique").on(
            table.organizationId,
            table.userId,
        ),
        index("organization_memberships_user_idx").on(table.userId),
        index("organization_memberships_org_role_idx").on(table.organizationId, table.role),
    ],
);

export const organizationInvitations = pgTable(
    "organization_invitations",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        email: text("email").notNull(),
        role: organizationRoleEnum("role").notNull(),
        tokenHash: text("token_hash").notNull(),
        status: invitationStatusEnum("status").notNull().default("pending"),
        invitedByUserId: uuid("invited_by_user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id, {
            onDelete: "set null",
        }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
        acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    },
    (table) => [
        uniqueIndex("organization_invitations_token_unique").on(table.tokenHash),
        index("organization_invitations_org_email_idx").on(table.organizationId, table.email),
        index("organization_invitations_pending_idx").on(table.status, table.expiresAt),
    ],
);
