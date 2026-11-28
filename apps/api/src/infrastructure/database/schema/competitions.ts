import {
    boolean,
    index,
    integer,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    unique,
    uuid,
    foreignKey,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";

export const editionStatusEnum = pgEnum("edition_status", [
    "draft",
    "published",
    "registration_open",
    "registration_closed",
    "active",
    "judging",
    "voting",
    "paused",
    "completed",
    "archived",
]);

export const milestoneKindEnum = pgEnum("milestone_kind", [
    "registration",
    "submission",
    "judging",
    "voting",
    "ceremony",
    "other",
]);

export const competitionSeries = pgTable(
    "competition_series",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        name: text("name").notNull(),
        slug: text("slug").notNull(),
        description: text("description").notNull().default(""),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("competition_series_org_slug_unique").on(table.organizationId, table.slug),
        unique("competition_series_id_org_unique").on(table.id, table.organizationId),
        index("competition_series_org_idx").on(table.organizationId),
    ],
);

export const competitionEditions = pgTable(
    "competition_editions",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        seriesId: uuid("series_id").notNull(),
        name: text("name").notNull(),
        slug: text("slug").notNull(),
        description: text("description").notNull().default(""),
        themeName: text("theme_name"),
        themeDescription: text("theme_description"),
        contactEmail: text("contact_email"),
        contactUrl: text("contact_url"),
        showScores: boolean("show_scores").notNull().default(false),
        showRanking: boolean("show_ranking").notNull().default(false),
        status: editionStatusEnum("status").notNull().default("draft"),
        statusBeforePause: editionStatusEnum("status_before_pause"),
        timezone: text("timezone").notNull().default("UTC"),
        registrationOpensAt: timestamp("registration_opens_at", { withTimezone: true }),
        registrationClosesAt: timestamp("registration_closes_at", { withTimezone: true }),
        startsAt: timestamp("starts_at", { withTimezone: true }),
        endsAt: timestamp("ends_at", { withTimezone: true }),
        teamMinSize: integer("team_min_size").notNull().default(1),
        teamMaxSize: integer("team_max_size").notNull().default(4),
        maxParticipants: integer("max_participants"),
        rulesMarkdown: text("rules_markdown").notNull().default(""),
        resultsOpenAt: timestamp("results_open_at", { withTimezone: true }),
        publishedAt: timestamp("published_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("competition_editions_org_slug_unique").on(table.organizationId, table.slug),
        unique("competition_editions_id_org_unique").on(table.id, table.organizationId),
        index("competition_editions_series_idx").on(table.organizationId, table.seriesId),
        index("competition_editions_status_idx").on(table.status),
        index("competition_editions_public_idx").on(table.slug, table.status),
        foreignKey({
            name: "competition_editions_series_fk",
            columns: [table.seriesId, table.organizationId],
            foreignColumns: [competitionSeries.id, competitionSeries.organizationId],
        }).onDelete("cascade"),
    ],
);

export const divisions = pgTable(
    "divisions",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        editionId: uuid("edition_id").notNull(),
        name: text("name").notNull(),
        slug: text("slug").notNull(),
        description: text("description").notNull().default(""),
        minTeamSize: integer("min_team_size"),
        maxTeamSize: integer("max_team_size"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("divisions_edition_slug_unique").on(table.editionId, table.slug),
        unique("divisions_id_org_unique").on(table.id, table.organizationId),
        index("divisions_org_edition_idx").on(table.organizationId, table.editionId),
        foreignKey({
            name: "divisions_edition_fk",
            columns: [table.editionId, table.organizationId],
            foreignColumns: [competitionEditions.id, competitionEditions.organizationId],
        }).onDelete("cascade"),
    ],
);

export const milestones = pgTable(
    "milestones",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        editionId: uuid("edition_id").notNull(),
        title: text("title").notNull(),
        description: text("description").notNull().default(""),
        kind: milestoneKindEnum("kind").notNull().default("other"),
        occursAt: timestamp("occurs_at", { withTimezone: true }).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        index("milestones_edition_time_idx").on(
            table.organizationId,
            table.editionId,
            table.occursAt,
        ),
        foreignKey({
            name: "milestones_edition_fk",
            columns: [table.editionId, table.organizationId],
            foreignColumns: [competitionEditions.id, competitionEditions.organizationId],
        }).onDelete("cascade"),
    ],
);
