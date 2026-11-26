import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: [
            "tests/architecture/**/*.test.ts",
            "tests/security/**/*.test.ts",
            "tests/unit/**/*.test.ts",
            "tests/migration/**/*.test.ts",
            "apps/api/src/**/tests/**/*.test.ts",
            "packages/ui/src/**/tests/**/*.test.ts",
        ],
        environment: "node",
        pool: "threads",
        testTimeout: 20_000,
        hookTimeout: 20_000,
        fileParallelism: false,
        reporters: ["default"],
    },
});
