import {
    boolean,
    foreignKey,
    index,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";
import { competitionEditions } from "./competitions.js";
import { organizations } from "./organizations.js";
import { users } from "./identity.js";

export const announcementVisibilityEnum = pgEnum("announcement_visibility", [
    "organization",
    "public",
]);

export const notificationKindEnum = pgEnum("notification_kind", [
    "team_invitation",
    "registration_decision",
    "submission_review",
    "judge_assignment",
    "evaluation_due",
    "voting_open",
    "announcement",
    "system",
]);

export const announcements = pgTable(
    "announcements",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id")
            .notNull()
            .references(() => organizations.id, { onDelete: "cascade" }),
        editionId: uuid("edition_id"),
        title: text("title").notNull(),
        bodyMarkdown: text("body_markdown").notNull().default(""),
        visibility: announcementVisibilityEnum("visibility").notNull().default("organization"),
        publishedAt: timestamp("published_at", { withTimezone: true }),
        authorUserId: uuid("author_user_id")
            .notNull()
            .references(() => users.id, { onDelete: "restrict" }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        index("announcements_org_published_idx").on(table.organizationId, table.publishedAt),
        index("announcements_public_idx").on(table.visibility, table.publishedAt),
        foreignKey({
            name: "announcements_edition_fk",
            columns: [table.editionId, table.organizationId],
            foreignColumns: [competitionEditions.id, competitionEditions.organizationId],
        }).onDelete("set null"),
    ],
);

export const notifications = pgTable(
    "notifications",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        organizationId: uuid("organization_id").references(() => organizations.id, {
            onDelete: "cascade",
        }),
        kind: notificationKindEnum("kind").notNull(),
        title: text("title").notNull(),
        body: text("body").notNull().default(""),
        linkUrl: text("link_url"),
        readAt: timestamp("read_at", { withTimezone: true }),
        dedupeKey: text("dedupe_key"),
        emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        index("notifications_user_read_idx").on(table.userId, table.readAt, table.createdAt),
        index("notifications_org_idx").on(table.organizationId),
        uniqueIndex("notifications_dedupe_unique").on(table.dedupeKey),
    ],
);

export const notificationPreferences = pgTable("notification_preferences", {
    userId: uuid("user_id")
        .primaryKey()
        .references(() => users.id, { onDelete: "cascade" }),
    emailEnabled: boolean("email_enabled").notNull().default(true),
    inAppEnabled: boolean("in_app_enabled").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
