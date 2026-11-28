import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { DatabaseExecutor, DatabaseSession } from "../../../infrastructure/database/client.js";
import { debugAiMessages, debugAiSessions } from "../../../infrastructure/database/schema/debug.js";

export interface DebugAiSessionRow {
    readonly id: string;
    readonly userId: string;
    readonly name: string;
    readonly createdAt: Date;
    readonly updatedAt: Date;
}

export interface DebugAiSessionSummaryRow extends DebugAiSessionRow {
    readonly messageCount: number;
}

export interface DebugAiMessageRow {
    readonly id: string;
    readonly sessionId: string;
    readonly role: "user" | "assistant";
    readonly content: string;
    readonly createdAt: Date;
}

export class DebugAiRepository {
    async listSessions(
        db: DatabaseExecutor,
        userId: string,
    ): Promise<readonly DebugAiSessionSummaryRow[]> {
        return db
            .select({
                id: debugAiSessions.id,
                userId: debugAiSessions.userId,
                name: debugAiSessions.name,
                createdAt: debugAiSessions.createdAt,
                updatedAt: debugAiSessions.updatedAt,
                messageCount: sql<number>`count(${debugAiMessages.id})::int`,
            })
            .from(debugAiSessions)
            .leftJoin(debugAiMessages, eq(debugAiMessages.sessionId, debugAiSessions.id))
            .where(eq(debugAiSessions.userId, userId))
            .groupBy(
                debugAiSessions.id,
                debugAiSessions.userId,
                debugAiSessions.name,
                debugAiSessions.createdAt,
                debugAiSessions.updatedAt,
            )
            .orderBy(desc(debugAiSessions.updatedAt));
    }

    async findSession(
        db: DatabaseExecutor,
        userId: string,
        sessionId: string,
    ): Promise<DebugAiSessionRow | null> {
        const rows = await db
            .select()
            .from(debugAiSessions)
            .where(and(eq(debugAiSessions.id, sessionId), eq(debugAiSessions.userId, userId)))
            .limit(1);
        return rows[0] ?? null;
    }

    async insertSession(
        session: DatabaseSession,
        values: { userId: string; name: string; now: Date },
    ): Promise<DebugAiSessionRow> {
        const [row] = await session.db
            .insert(debugAiSessions)
            .values({
                userId: values.userId,
                name: values.name,
                createdAt: values.now,
                updatedAt: values.now,
            })
            .returning();
        if (row === undefined) {
            throw new Error("The debug session could not be created.");
        }
        return row;
    }

    async touchSession(
        session: DatabaseSession,
        userId: string,
        sessionId: string,
        now: Date,
    ): Promise<void> {
        await session.db
            .update(debugAiSessions)
            .set({ updatedAt: now })
            .where(and(eq(debugAiSessions.id, sessionId), eq(debugAiSessions.userId, userId)));
    }

    async deleteSession(
        session: DatabaseSession,
        userId: string,
        sessionId: string,
    ): Promise<boolean> {
        const rows = await session.db
            .delete(debugAiSessions)
            .where(and(eq(debugAiSessions.id, sessionId), eq(debugAiSessions.userId, userId)))
            .returning({ id: debugAiSessions.id });
        return rows.length > 0;
    }

    async listMessages(
        db: DatabaseExecutor,
        sessionId: string,
        limit?: number,
    ): Promise<readonly DebugAiMessageRow[]> {
        const query = db
            .select()
            .from(debugAiMessages)
            .where(eq(debugAiMessages.sessionId, sessionId))
            .orderBy(asc(debugAiMessages.createdAt), asc(debugAiMessages.id));
        return limit === undefined ? query : query.limit(limit);
    }

    async listRecentMessages(
        db: DatabaseExecutor,
        sessionId: string,
        limit: number,
    ): Promise<readonly DebugAiMessageRow[]> {
        const rows = await db
            .select()
            .from(debugAiMessages)
            .where(eq(debugAiMessages.sessionId, sessionId))
            .orderBy(desc(debugAiMessages.createdAt), desc(debugAiMessages.id))
            .limit(limit);
        return rows.toReversed();
    }

    async insertMessage(
        session: DatabaseSession,
        values: {
            sessionId: string;
            role: "user" | "assistant";
            content: string;
            now: Date;
        },
    ): Promise<DebugAiMessageRow> {
        const [row] = await session.db.insert(debugAiMessages).values(values).returning();
        if (row === undefined) {
            throw new Error("The debug message could not be saved.");
        }
        return row;
    }
}
