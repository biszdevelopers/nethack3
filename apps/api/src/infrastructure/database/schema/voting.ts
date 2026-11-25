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
import { competitionEditions } from "./competitions.js";
import { organizations } from "./organizations.js";
import { submissions } from "./submissions.js";
import { users } from "./identity.js";

export const votingRoundStatusEnum = pgEnum("voting_round_status", [
    "draft",
    "open",
    "closed",
    "published",
]);

export const votingRounds = pgTable(
    "voting_rounds",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        editionId: uuid("edition_id").notNull(),
        name: text("name").notNull(),
        description: text("description").notNull().default(""),
        status: votingRoundStatusEnum("status").notNull().default("draft"),
        eligibleRoles: text("eligible_roles").array().notNull().default(["participant"]),
        maxSelections: integer("max_selections").notNull().default(1),
        opensAt: timestamp("opens_at", { withTimezone: true }),
        closesAt: timestamp("closes_at", { withTimezone: true }),
        publishedAt: timestamp("published_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        unique("voting_rounds_id_org_unique").on(table.id, table.organizationId),
        index("voting_rounds_org_edition_idx").on(table.organizationId, table.editionId),
        index("voting_rounds_status_idx").on(table.status),
        foreignKey({
            name: "voting_rounds_edition_fk",
            columns: [table.editionId, table.organizationId],
            foreignColumns: [competitionEditions.id, competitionEditions.organizationId],
        }).onDelete("cascade"),
    ],
);

export const ballots = pgTable(
    "ballots",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        roundId: uuid("round_id").notNull(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("ballots_round_user_unique").on(table.roundId, table.userId),
        unique("ballots_id_org_unique").on(table.id, table.organizationId),
        index("ballots_org_round_idx").on(table.organizationId, table.roundId),
        foreignKey({
            name: "ballots_round_fk",
            columns: [table.roundId, table.organizationId],
            foreignColumns: [votingRounds.id, votingRounds.organizationId],
        }).onDelete("cascade"),
    ],
);

export const votes = pgTable(
    "votes",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        roundId: uuid("round_id").notNull(),
        ballotId: uuid("ballot_id").notNull(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        submissionId: uuid("submission_id").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("votes_round_user_submission_unique").on(
            table.roundId,
            table.userId,
            table.submissionId,
        ),
        uniqueIndex("votes_ballot_submission_unique").on(table.ballotId, table.submissionId),
        index("votes_org_round_idx").on(table.organizationId, table.roundId),
        index("votes_submission_idx").on(table.organizationId, table.submissionId),
        foreignKey({
            name: "votes_round_fk",
            columns: [table.roundId, table.organizationId],
            foreignColumns: [votingRounds.id, votingRounds.organizationId],
        }).onDelete("cascade"),
        foreignKey({
            name: "votes_ballot_fk",
            columns: [table.ballotId, table.organizationId],
            foreignColumns: [ballots.id, ballots.organizationId],
        }).onDelete("cascade"),
        foreignKey({
            name: "votes_submission_fk",
            columns: [table.submissionId, table.organizationId],
            foreignColumns: [submissions.id, submissions.organizationId],
        }).onDelete("cascade"),
    ],
);
