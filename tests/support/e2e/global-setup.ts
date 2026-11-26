import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import {
    closeTestDatabase,
    resetTestDatabase,
} from "../../../apps/api/tests/support/test-database.js";
import {
    AUTH_ORIGIN,
    OWNER_DATABASE_URL,
    RUNTIME_DATABASE_URL,
    STORAGE_ROOT,
    USERS,
} from "./config.js";
import { seedE2eFixtures } from "./seed-e2e.js";

export default async function globalSetup(): Promise<void> {
    console.log("[e2e] Resetting the test database.");
    await resetTestDatabase();
    await closeTestDatabase();

    console.log("[e2e] Applying the development fixture seed.");
    execFileSync(process.env.BUN_BINARY ?? "bun", ["apps/api/src/seed.ts"], {
        cwd: process.cwd(),
        stdio: "inherit",
        env: {
            ...process.env,
            NODE_ENV: "test",
            DATABASE_URL: RUNTIME_DATABASE_URL,
            DATABASE_MIGRATION_URL: OWNER_DATABASE_URL,
            BASIS_AUTH_ISSUER: AUTH_ORIGIN,
        },
    });

    console.log("[e2e] Inserting E2E-specific fixtures.");
    await seedE2eFixtures();

    rmSync(STORAGE_ROOT, { recursive: true, force: true });
    mkdirSync(STORAGE_ROOT, { recursive: true });

    console.log("[e2e] Configuring the mock identity provider user.");
    await configureMockUser();
}

async function configureMockUser(): Promise<void> {
    const body = JSON.stringify(USERS.participant);
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
        try {
            const response = await fetch(`${AUTH_ORIGIN}/__test/user`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body,
                signal: AbortSignal.timeout(2000),
            });
            if (response.ok) {
                return;
            }
            lastError = new Error(`Mock provider returned ${String(response.status)}.`);
        } catch (error) {
            lastError = error;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    console.warn(
        "[e2e] Could not preconfigure the mock provider user; each sign-in sets it explicitly.",
        lastError instanceof Error ? lastError.message : lastError,
    );
}
