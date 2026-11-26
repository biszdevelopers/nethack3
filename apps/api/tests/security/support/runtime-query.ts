import { Client, type QueryResultRow } from "pg";
import { runtimeDatabaseUrl } from "../../support/test-database.js";

/**
 * Runs a query as the non-owner runtime role without setting any tenant or
 * user context. This is what a leaked runtime credential could do if the
 * application forgot its WHERE clause.
 */
export async function queryAsRuntime<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values: readonly unknown[] = [],
): Promise<T[]> {
    const client = new Client({
        connectionString: runtimeDatabaseUrl,
        application_name: "nethack-tests-runtime-unscoped",
    });
    await client.connect();
    try {
        const result = await client.query<T>(text, [...values]);
        return result.rows;
    } finally {
        await client.end();
    }
}
