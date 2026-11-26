import { sql } from "drizzle-orm";
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
import { projects } from "./projects.js";
import { teams } from "./teams.js";
import { users } from "./identity.js";

export const submissionStatusEnum = pgEnum("submission_status", [
    "draft",
    "submitted",
    "under_review",
    "changes_requested",
    "accepted",
    "rejected",
    "withdrawn",
    "disqualified",
]);

export const fileStatusEnum = pgEnum("file_status", [
    "quarantined",
    "scanning",
    "approved",
    "rejected",
    "deleted",
]);

export const submissions = pgTable(
    "submissions",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        editionId: uuid("edition_id").notNull(),
        projectId: uuid("project_id").notNull(),
        teamId: uuid("team_id"),
        status: submissionStatusEnum("status").notNull().default("draft"),
        currentVersion: integer("current_version").notNull().default(0),
        submittedAt: timestamp("submitted_at", { withTimezone: true }),
        reviewNote: text("review_note").notNull().default(""),
        reviewNoteUpdatedAt: timestamp("review_note_updated_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("submissions_project_unique").on(table.projectId),
        unique("submissions_id_org_unique").on(table.id, table.organizationId),
        index("submissions_org_edition_status_idx").on(
            table.organizationId,
            table.editionId,
            table.status,
        ),
        index("submissions_team_idx").on(table.organizationId, table.teamId),
        foreignKey({
            name: "submissions_edition_fk",
            columns: [table.editionId, table.organizationId],
            foreignColumns: [competitionEditions.id, competitionEditions.organizationId],
        }).onDelete("cascade"),
        foreignKey({
            name: "submissions_project_fk",
            columns: [table.projectId, table.organizationId],
            foreignColumns: [projects.id, projects.organizationId],
        }).onDelete("cascade"),
        foreignKey({
            name: "submissions_team_fk",
            columns: [table.teamId, table.organizationId],
            foreignColumns: [teams.id, teams.organizationId],
        }).onDelete("set null"),
    ],
);

export const submissionVersions = pgTable(
    "submission_versions",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        submissionId: uuid("submission_id").notNull(),
        version: integer("version").notNull(),
        title: text("title").notNull(),
        summary: text("summary").notNull(),
        descriptionMarkdown: text("description_markdown").notNull().default(""),
        repositoryUrl: text("repository_url"),
        demoUrl: text("demo_url"),
        createdByUserId: uuid("created_by_user_id")
            .notNull()
            .references(() => users.id, { onDelete: "restrict" }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("submission_versions_submission_version_unique").on(
            table.submissionId,
            table.version,
        ),
        unique("submission_versions_id_org_unique").on(table.id, table.organizationId),
        index("submission_versions_org_idx").on(table.organizationId, table.submissionId),
        foreignKey({
            name: "submission_versions_submission_fk",
            columns: [table.submissionId, table.organizationId],
            foreignColumns: [submissions.id, submissions.organizationId],
        }).onDelete("cascade"),
    ],
);

export const submissionFiles = pgTable(
    "submission_files",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        projectId: uuid("project_id"),
        submissionId: uuid("submission_id"),
        versionId: uuid("version_id"),
        fileName: text("file_name").notNull(),
        contentType: text("content_type").notNull(),
        byteSize: integer("byte_size").notNull(),
        checksumSha256: text("checksum_sha256").notNull(),
        storageKey: text("storage_key").notNull(),
        status: fileStatusEnum("status").notNull().default("quarantined"),
        rejectionReason: text("rejection_reason"),
        uploadedByUserId: uuid("uploaded_by_user_id")
            .notNull()
            .references(() => users.id, { onDelete: "restrict" }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        inspectedAt: timestamp("inspected_at", { withTimezone: true }),
        deletedAt: timestamp("deleted_at", { withTimezone: true }),
    },
    (table) => [
        unique("submission_files_id_org_unique").on(table.id, table.organizationId),
        uniqueIndex("submission_files_version_storage_unique")
            .on(table.submissionId, table.versionId, table.storageKey)
            .where(sql`${table.submissionId} is not null and ${table.versionId} is not null`),
        index("submission_files_project_idx").on(table.organizationId, table.projectId),
        index("submission_files_submission_idx").on(table.organizationId, table.submissionId),
        index("submission_files_version_idx").on(table.organizationId, table.versionId),
        index("submission_files_status_idx").on(table.status, table.createdAt),
        foreignKey({
            name: "submission_files_project_fk",
            columns: [table.projectId, table.organizationId],
            foreignColumns: [projects.id, projects.organizationId],
        }).onDelete("cascade"),
        foreignKey({
            name: "submission_files_submission_fk",
            columns: [table.submissionId, table.organizationId],
            foreignColumns: [submissions.id, submissions.organizationId],
        }).onDelete("cascade"),
        foreignKey({
            name: "submission_files_version_fk",
            columns: [table.versionId, table.organizationId],
            foreignColumns: [submissionVersions.id, submissionVersions.organizationId],
        }).onDelete("set null"),
    ],
);
