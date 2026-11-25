import {
    foreignKey,
    index,
    integer,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    unique,
    uuid,
} from "drizzle-orm/pg-core";
import { competitionEditions, divisions } from "./competitions.js";
import { organizations } from "./organizations.js";
import { users } from "./identity.js";

export const teamStatusEnum = pgEnum("team_status", ["forming", "ready", "disbanded"]);
export const teamMemberRoleEnum = pgEnum("team_member_role", ["captain", "member"]);

export const teams = pgTable(
    "teams",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        editionId: uuid("edition_id").notNull(),
        divisionId: uuid("division_id"),
        name: text("name").notNull(),
        description: text("description").notNull().default(""),
        status: teamStatusEnum("status").notNull().default("forming"),
        captainUserId: uuid("captain_user_id")
            .notNull()
            .references(() => users.id, { onDelete: "restrict" }),
        maxMembers: integer("max_members").notNull().default(4),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        unique("teams_id_org_unique").on(table.id, table.organizationId),
        uniqueIndex("teams_edition_name_unique").on(table.editionId, table.name),
        index("teams_org_edition_idx").on(table.organizationId, table.editionId),
        index("teams_captain_idx").on(table.captainUserId),
        index("teams_division_idx").on(table.organizationId, table.divisionId),
        foreignKey({
            name: "teams_edition_fk",
            columns: [table.editionId, table.organizationId],
            foreignColumns: [competitionEditions.id, competitionEditions.organizationId],
        }).onDelete("cascade"),
        foreignKey({
            name: "teams_division_fk",
            columns: [table.divisionId, table.organizationId],
            foreignColumns: [divisions.id, divisions.organizationId],
        }).onDelete("set null"),
    ],
);

export const teamMembers = pgTable(
    "team_members",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        teamId: uuid("team_id").notNull(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        role: teamMemberRoleEnum("role").notNull().default("member"),
        joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("team_members_team_user_unique").on(table.teamId, table.userId),
        index("team_members_user_idx").on(table.userId),
        index("team_members_org_team_idx").on(table.organizationId, table.teamId),
        foreignKey({
            name: "team_members_team_fk",
            columns: [table.teamId, table.organizationId],
            foreignColumns: [teams.id, teams.organizationId],
        }).onDelete("cascade"),
    ],
);

export const teamInvitations = pgTable(
    "team_invitations",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        teamId: uuid("team_id").notNull(),
        email: text("email").notNull(),
        tokenHash: text("token_hash").notNull(),
        status: text("status").notNull().default("pending"),
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
        uniqueIndex("team_invitations_token_unique").on(table.tokenHash),
        uniqueIndex("team_invitations_team_email_unique").on(table.teamId, table.email),
        index("team_invitations_org_team_idx").on(table.organizationId, table.teamId),
        index("team_invitations_pending_idx").on(table.status, table.expiresAt),
        foreignKey({
            name: "team_invitations_team_fk",
            columns: [table.teamId, table.organizationId],
            foreignColumns: [teams.id, teams.organizationId],
        }).onDelete("cascade"),
    ],
);
