import { rmSync } from "node:fs";
import {
    closeTestDatabase,
    truncateAllTables,
} from "../../../apps/api/tests/support/test-database.js";
import { STORAGE_ROOT } from "./config.js";

export default async function globalTeardown(): Promise<void> {
    console.log("[e2e] Cleaning up the test database and storage.");
    try {
        await truncateAllTables();
    } finally {
        await closeTestDatabase();
        rmSync(STORAGE_ROOT, { recursive: true, force: true });
    }
}
