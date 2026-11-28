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
import { competitionEditions } from "./competitions.js";
import { organizations } from "./organizations.js";
import { teams } from "./teams.js";
import { users } from "./identity.js";

export const projectStatusEnum = pgEnum("project_status", ["draft", "published", "archived"]);
export const projectMemberRoleEnum = pgEnum("project_member_role", ["owner", "member"]);

export const projects = pgTable(
    "projects",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        editionId: uuid("edition_id").notNull(),
        teamId: uuid("team_id"),
        ownerUserId: uuid("owner_user_id")
            .notNull()
            .references(() => users.id, { onDelete: "restrict" }),
        title: text("title").notNull(),
        slug: text("slug").notNull(),
        summary: text("summary").notNull(),
        descriptionMarkdown: text("description_markdown").notNull().default(""),
        repositoryUrl: text("repository_url"),
        demoUrl: text("demo_url"),
        videoUrl: text("video_url"),
        aiDisclosure: text("ai_disclosure").notNull().default(""),
        tags: text("tags").array().notNull().default([]),
        status: projectStatusEnum("status").notNull().default("draft"),
        publishedAt: timestamp("published_at", { withTimezone: true }),
        lockedAt: timestamp("locked_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        unique("projects_id_org_unique").on(table.id, table.organizationId),
        uniqueIndex("projects_org_slug_unique").on(table.organizationId, table.slug),
        index("projects_org_edition_idx").on(table.organizationId, table.editionId),
        index("projects_team_idx").on(table.organizationId, table.teamId),
        index("projects_owner_idx").on(table.ownerUserId),
        index("projects_published_idx").on(table.status, table.publishedAt),
        foreignKey({
            name: "projects_edition_fk",
            columns: [table.editionId, table.organizationId],
            foreignColumns: [competitionEditions.id, competitionEditions.organizationId],
        }).onDelete("cascade"),
        foreignKey({
            name: "projects_team_fk",
            columns: [table.teamId, table.organizationId],
            foreignColumns: [teams.id, teams.organizationId],
        }).onDelete("set null"),
    ],
);

export const projectMembers = pgTable(
    "project_members",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        projectId: uuid("project_id").notNull(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        role: projectMemberRoleEnum("role").notNull().default("member"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("project_members_project_user_unique").on(table.projectId, table.userId),
        index("project_members_user_idx").on(table.userId),
        foreignKey({
            name: "project_members_project_fk",
            columns: [table.projectId, table.organizationId],
            foreignColumns: [projects.id, projects.organizationId],
        }).onDelete("cascade"),
    ],
);
