import { eq } from "drizzle-orm";
import type { Clock } from "../../../core/clock.js";
import type { DatabaseConnection } from "../../../infrastructure/database/client.js";
import { userProfileThemes } from "../../../infrastructure/database/schema/index.js";

export class ProfileThemeRepository {
    private readonly database: DatabaseConnection;
    private readonly clock: Clock;

    constructor(database: DatabaseConnection, clock: Clock) {
        this.database = database;
        this.clock = clock;
    }

    async get(userId: string): Promise<string | null> {
        const rows = await this.database.db
            .select({ theme: userProfileThemes.theme })
            .from(userProfileThemes)
            .where(eq(userProfileThemes.userId, userId))
            .limit(1);
        return rows[0]?.theme ?? null;
    }

    async set(userId: string, theme: string | null): Promise<void> {
        await this.database.transaction({ userId }, async (session) => {
            if (theme === null) {
                await session.db
                    .delete(userProfileThemes)
                    .where(eq(userProfileThemes.userId, userId));
                return;
            }
            await session.db
                .insert(userProfileThemes)
                .values({ userId, theme, updatedAt: this.clock.now() })
                .onConflictDoUpdate({
                    target: userProfileThemes.userId,
                    set: { theme, updatedAt: this.clock.now() },
                });
        });
    }
}
