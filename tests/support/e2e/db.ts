import { Client, type QueryResultRow } from "pg";
import { OWNER_DATABASE_URL } from "./config.js";

async function withClient<T>(run: (client: Client) => Promise<T>): Promise<T> {
    const client = new Client({
        connectionString: OWNER_DATABASE_URL,
        application_name: "nethack-e2e-owner",
    });
    await client.connect();
    try {
        return await run(client);
    } finally {
        await client.end();
    }
}

export async function ownerQuery<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values: readonly unknown[] = [],
): Promise<T[]> {
    return withClient(async (client) => {
        const result = await client.query<T>(text, [...values]);
        return result.rows;
    });
}

/**
 * Owner queries against tables with FORCE ROW LEVEL SECURITY still need the
 * organization context in the same transaction, exactly like the API.
 */
export async function ownerTenantQuery<T extends QueryResultRow = QueryResultRow>(
    organizationId: string,
    text: string,
    values: readonly unknown[] = [],
): Promise<T[]> {
    return withClient(async (client) => {
        await client.query("begin");
        try {
            await client.query("select set_config('nethack.organization_id', $1, true)", [
                organizationId,
            ]);
            const result = await client.query<T>(text, [...values]);
            await client.query("commit");
            return result.rows;
        } catch (error) {
            await client.query("rollback");
            throw error;
        }
    });
}

export async function ownerTenantBatch(
    organizationId: string,
    statements: readonly { readonly text: string; readonly values?: readonly unknown[] }[],
): Promise<void> {
    await withClient(async (client) => {
        await client.query("begin");
        try {
            await client.query("select set_config('nethack.organization_id', $1, true)", [
                organizationId,
            ]);
            for (const statement of statements) {
                await client.query(statement.text, [...(statement.values ?? [])]);
            }
            await client.query("commit");
        } catch (error) {
            await client.query("rollback");
            throw error;
        }
    });
}

export async function invitationTokenForEmail(email: string): Promise<string | null> {
    const rows = await ownerQuery<{ token: string | null }>(
        `select payload->>'token' as token
         from outbox_events
         where event_type = 'teams.invitation.created'
           and payload->>'email' = $1
         order by occurred_at desc
         limit 1`,
        [email.toLowerCase()],
    );
    return rows[0]?.token ?? null;
}

export async function notificationCountForUser(userId: string): Promise<number> {
    const rows = await ownerQuery<{ count: string }>(
        "select count(*)::text as count from notifications where user_id = $1",
        [userId],
    );
    return Number(rows[0]?.count ?? "0");
}
