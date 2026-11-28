import { foreignKey, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./identity.js";

export const debugAiMessageRoleEnum = pgEnum("debug_ai_message_role", ["user", "assistant"]);

export const debugAiSessions = pgTable(
    "debug_ai_sessions",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        name: text("name").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [index("debug_ai_sessions_user_updated_idx").on(table.userId, table.updatedAt)],
);

export const debugAiMessages = pgTable(
    "debug_ai_messages",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        sessionId: uuid("session_id").notNull(),
        role: debugAiMessageRoleEnum("role").notNull(),
        content: text("content").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        index("debug_ai_messages_session_created_idx").on(table.sessionId, table.createdAt),
        foreignKey({
            name: "debug_ai_messages_session_fk",
            columns: [table.sessionId],
            foreignColumns: [debugAiSessions.id],
        }).onDelete("cascade"),
    ],
);
