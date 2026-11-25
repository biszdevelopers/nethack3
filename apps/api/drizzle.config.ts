import { defineConfig } from "drizzle-kit";

export default defineConfig({
    schema: "./src/infrastructure/database/schema/index.ts",
    out: "../../database/migrations",
    dialect: "postgresql",
    strict: true,
    verbose: true,
    dbCredentials: {
        url:
            process.env.DATABASE_URL ??
            "postgres://nethack:nethack_dev_password@127.0.0.1:55432/nethack",
    },
});
