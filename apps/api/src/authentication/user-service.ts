import { eq, sql } from "drizzle-orm";
import type { Clock } from "../core/clock.js";
import type { Logger } from "../core/logger.js";
import type { DatabaseConnection } from "../infrastructure/database/client.js";
import { externalIdentities, users } from "../infrastructure/database/schema/index.js";
import type { IdTokenClaims } from "./basis-auth-client.js";
import type { UserRow } from "./types.js";

export class AccountLinkRequiredError extends Error {
    constructor() {
        super("An account with this email already exists and is linked to a different identity.");
        this.name = "AccountLinkRequiredError";
    }
}

export interface ProfileUpdate {
    readonly displayName?: string;
    readonly locale?: string;
}

export class UserService {
    private readonly database: DatabaseConnection;
    private readonly clock: Clock;
    private readonly logger: Logger;

    constructor(database: DatabaseConnection, clock: Clock, logger: Logger) {
        this.database = database;
        this.clock = clock;
        this.logger = logger.child({ component: "users" });
    }

    async findOrCreateFromIdentity(claims: IdTokenClaims, issuer: string): Promise<UserRow> {
        return this.database.transaction({}, async (session) => {
            const existing = await session.db
                .select({ user: users, identityId: externalIdentities.id })
                .from(externalIdentities)
                .innerJoin(users, eq(users.id, externalIdentities.userId))
                .where(
                    sql`${externalIdentities.issuer} = ${issuer} and ${externalIdentities.subject} = ${claims.subject}`,
                )
                .limit(1);

            const match = existing[0];
            if (match !== undefined) {
                const now = this.clock.now();
                await session.db
                    .update(externalIdentities)
                    .set({
                        lastLoginAt: now,
                        emailAtLogin: claims.email,
                    })
                    .where(eq(externalIdentities.id, match.identityId));

                const profileChanged =
                    (claims.name !== null && claims.name !== match.user.displayName) ||
                    (claims.email !== null && claims.email !== match.user.email) ||
                    (claims.pictureUrl !== null && claims.pictureUrl !== match.user.avatarUrl);

                if (profileChanged) {
                    const [updated] = await session.db
                        .update(users)
                        .set({
                            displayName: claims.name ?? match.user.displayName,
                            email: claims.email ?? match.user.email,
                            avatarUrl: claims.pictureUrl ?? match.user.avatarUrl,
                            updatedAt: now,
                        })
                        .where(eq(users.id, match.user.id))
                        .returning();
                    if (updated !== undefined) {
                        return updated;
                    }
                }
                return match.user;
            }

            if (claims.email !== null) {
                const emailMatch = await session.db
                    .select({ id: users.id })
                    .from(users)
                    .where(sql`lower(${users.email}) = ${claims.email}`)
                    .limit(1);
                if (emailMatch.length > 0) {
                    this.logger.warn(
                        "Login rejected because the email belongs to another identity.",
                        {
                            issuer,
                        },
                    );
                    throw new AccountLinkRequiredError();
                }
            }

            const displayName = sanitizeDisplayName(claims);
            const now = this.clock.now();
            const [created] = await session.db
                .insert(users)
                .values({
                    displayName,
                    email: claims.email,
                    avatarUrl: claims.pictureUrl,
                    locale: "en",
                    createdAt: now,
                    updatedAt: now,
                })
                .returning();
            if (created === undefined) {
                throw new Error("The local user could not be created.");
            }
            await session.db.insert(externalIdentities).values({
                userId: created.id,
                issuer,
                subject: claims.subject,
                emailAtLogin: claims.email,
                createdAt: now,
                lastLoginAt: now,
            });
            return created;
        });
    }

    async getById(userId: string): Promise<UserRow | null> {
        const rows = await this.database.db
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
        return rows[0] ?? null;
    }

    async findByEmail(email: string): Promise<UserRow | null> {
        const rows = await this.database.db
            .select()
            .from(users)
            .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
            .limit(1);
        return rows[0] ?? null;
    }

    async updateProfile(userId: string, update: ProfileUpdate): Promise<UserRow> {
        const [updated] = await this.database.db
            .update(users)
            .set({
                ...(update.displayName === undefined ? {} : { displayName: update.displayName }),
                ...(update.locale === undefined ? {} : { locale: update.locale }),
                updatedAt: this.clock.now(),
            })
            .where(eq(users.id, userId))
            .returning();
        if (updated === undefined) {
            throw new Error("The user profile could not be updated.");
        }
        return updated;
    }
}

function sanitizeDisplayName(claims: IdTokenClaims): string {
    let source = "Participant";
    if (claims.name !== null && claims.name.trim() !== "") {
        source = claims.name;
    } else if (claims.email !== null) {
        const local = claims.email.split("@")[0];
        if (local !== undefined && local.length > 0) {
            source = local;
        }
    }
    const cleaned = Array.from(source, (character) =>
        character.charCodeAt(0) < 0x20 || character.charCodeAt(0) === 0x7f ? "" : character,
    )
        .join("")
        .trim()
        .slice(0, 80);
    return cleaned.length > 0 ? cleaned : "Participant";
}
