import {
    foreignKey,
    index,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    unique,
    uuid,
} from "drizzle-orm/pg-core";
import type { PublicResults } from "@nethack/contracts";
import { competitionEditions, editionStatusEnum } from "./competitions.js";
import { organizations } from "./organizations.js";
import { teams } from "./teams.js";
import { users } from "./identity.js";

// RLS: the generated database migration must add organization-scoped policies
// for all three tables. edition_results additionally needs a public SELECT policy
// because certificates and results are served without an organization context.
export const awards = pgTable(
    "awards",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        editionId: uuid("edition_id").notNull(),
        namespace: text("namespace").notNull(),
        name: text("name").notNull(),
        description: text("description").notNull().default(""),
        icon: text("icon").notNull().default("award"),
        color: text("color").notNull().default("gold"),
        createdByUserId: uuid("created_by_user_id")
            .notNull()
            .references(() => users.id, { onDelete: "restrict" }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("awards_edition_namespace_unique").on(table.editionId, table.namespace),
        unique("awards_id_org_unique").on(table.id, table.organizationId),
        index("awards_org_edition_idx").on(table.organizationId, table.editionId),
        foreignKey({
            name: "awards_edition_fk",
            columns: [table.editionId, table.organizationId],
            foreignColumns: [competitionEditions.id, competitionEditions.organizationId],
        }).onDelete("cascade"),
    ],
);

export const teamAwards = pgTable(
    "team_awards",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        editionId: uuid("edition_id").notNull(),
        teamId: uuid("team_id").notNull(),
        awardId: uuid("award_id").notNull(),
        note: text("note").notNull().default(""),
        assignedByUserId: uuid("assigned_by_user_id")
            .notNull()
            .references(() => users.id, { onDelete: "restrict" }),
        assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        unique("team_awards_team_award_unique").on(table.teamId, table.awardId),
        unique("team_awards_id_org_unique").on(table.id, table.organizationId),
        index("team_awards_org_edition_idx").on(table.organizationId, table.editionId),
        index("team_awards_org_team_idx").on(table.organizationId, table.teamId),
        index("team_awards_org_award_idx").on(table.organizationId, table.awardId),
        foreignKey({
            name: "team_awards_team_fk",
            columns: [table.teamId, table.organizationId],
            foreignColumns: [teams.id, teams.organizationId],
        }).onDelete("cascade"),
        foreignKey({
            name: "team_awards_award_fk",
            columns: [table.awardId, table.organizationId],
            foreignColumns: [awards.id, awards.organizationId],
        }).onDelete("no action"),
    ],
);

export const editionResults = pgTable(
    "edition_results",
    {
        editionId: uuid("edition_id").primaryKey(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
        publishedByUserId: uuid("published_by_user_id")
            .notNull()
            .references(() => users.id, { onDelete: "restrict" }),
        previousEditionStatus: editionStatusEnum("previous_edition_status"),
        snapshot: jsonb("snapshot").$type<PublicResults>().notNull(),
    },
    (table) => [
        index("edition_results_org_idx").on(table.organizationId),
        foreignKey({
            name: "edition_results_edition_fk",
            columns: [table.editionId, table.organizationId],
            foreignColumns: [competitionEditions.id, competitionEditions.organizationId],
        }).onDelete("cascade"),
    ],
);
