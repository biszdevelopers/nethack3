import {
    foreignKey,
    index,
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
import { teams } from "./teams.js";
import { users } from "./identity.js";

export const registrationStatusEnum = pgEnum("registration_status", [
    "pending",
    "approved",
    "rejected",
    "withdrawn",
    "waitlisted",
]);

export const registrations = pgTable(
    "registrations",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        editionId: uuid("edition_id").notNull(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        divisionId: uuid("division_id"),
        status: registrationStatusEnum("status").notNull().default("pending"),
        note: text("note").notNull().default(""),
        decidedByUserId: uuid("decided_by_user_id").references(() => users.id, {
            onDelete: "set null",
        }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
        decidedAt: timestamp("decided_at", { withTimezone: true }),
    },
    (table) => [
        uniqueIndex("registrations_edition_user_unique").on(table.editionId, table.userId),
        unique("registrations_id_org_unique").on(table.id, table.organizationId),
        index("registrations_org_edition_status_idx").on(
            table.organizationId,
            table.editionId,
            table.status,
        ),
        index("registrations_user_idx").on(table.userId),
        foreignKey({
            name: "registrations_edition_fk",
            columns: [table.editionId, table.organizationId],
            foreignColumns: [competitionEditions.id, competitionEditions.organizationId],
        }).onDelete("cascade"),
        foreignKey({
            name: "registrations_division_fk",
            columns: [table.divisionId, table.organizationId],
            foreignColumns: [divisions.id, divisions.organizationId],
        }).onDelete("set null"),
    ],
);

export const participants = pgTable(
    "participants",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        editionId: uuid("edition_id").notNull(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        divisionId: uuid("division_id"),
        teamId: uuid("team_id"),
        registeredAt: timestamp("registered_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("participants_edition_user_unique").on(table.editionId, table.userId),
        unique("participants_id_org_unique").on(table.id, table.organizationId),
        index("participants_org_edition_idx").on(table.organizationId, table.editionId),
        index("participants_team_idx").on(table.organizationId, table.teamId),
        index("participants_user_idx").on(table.userId),
        foreignKey({
            name: "participants_edition_fk",
            columns: [table.editionId, table.organizationId],
            foreignColumns: [competitionEditions.id, competitionEditions.organizationId],
        }).onDelete("cascade"),
        foreignKey({
            name: "participants_division_fk",
            columns: [table.divisionId, table.organizationId],
            foreignColumns: [divisions.id, divisions.organizationId],
        }).onDelete("set null"),
        foreignKey({
            name: "participants_team_fk",
            columns: [table.teamId, table.organizationId],
            foreignColumns: [teams.id, teams.organizationId],
        }).onDelete("set null"),
    ],
);
