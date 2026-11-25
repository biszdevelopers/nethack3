import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: [
            {
                find: /^@nethack\/ui$/,
                replacement: fileURLToPath(
                    new URL("../../packages/ui/src/index.ts", import.meta.url),
                ),
            },
            {
                find: /^@nethack\/contracts$/,
                replacement: fileURLToPath(
                    new URL("../../packages/contracts/src/index.ts", import.meta.url),
                ),
            },
            {
                find: /^@nethack\/api-client$/,
                replacement: fileURLToPath(
                    new URL("../../packages/api-client/src/index.ts", import.meta.url),
                ),
            },
        ],
    },
    server: {
        port: 5173,
        strictPort: true,
    },
    preview: {
        port: 5173,
        strictPort: true,
    },
    build: {
        target: "es2022",
        sourcemap: true,
    },
});
