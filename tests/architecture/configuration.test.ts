import { describe, expect, it } from "vitest";
import { loadConfiguration, type AppConfig } from "../../apps/api/src/core/configuration.js";

const KEY = Buffer.alloc(32, 7).toString("base64");

function productionEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
    return {
        NODE_ENV: "production",
        API_ORIGIN: "https://api.nethack.example",
        WORKSPACE_ORIGIN: "https://app.nethack.example",
        SITE_ORIGIN: "https://www.nethack.example",
        ASSET_ORIGIN: "https://assets.nethack.example",
        BASIS_AUTH_ISSUER: "https://auth.nethack.example",
        BASIS_AUTH_CLIENT_SECRET: "a-production-secret-value",
        BASIS_AUTH_REDIRECT_URI: "https://api.nethack.example/api/v1/auth/callback",
        SESSION_ENCRYPTION_KEYS: KEY,
        ...overrides,
    };
}

describe("loadConfiguration", () => {
    it("accepts a complete production configuration", () => {
        const config = loadConfiguration(productionEnv());
        expect(config.isProduction).toBe(true);
        expect(config.session.encryptionKeys).toHaveLength(1);
        expect(config.origins.api).toBe("https://api.nethack.example");
    });

    it("rejects the development client secret in production", () => {
        expect(() =>
            loadConfiguration(
                productionEnv({ BASIS_AUTH_CLIENT_SECRET: "nethack-dev-secret-value" }),
            ),
        ).toThrow(/development Basis Auth client secret/);
    });

    it("rejects insecure origins in production", () => {
        expect(() =>
            loadConfiguration(productionEnv({ API_ORIGIN: "http://api.nethack.example" })),
        ).toThrow(/must use HTTPS/);
    });

    it("requires encryption keys in production", () => {
        expect(() => loadConfiguration(productionEnv({ SESSION_ENCRYPTION_KEYS: "" }))).toThrow(
            /SESSION_ENCRYPTION_KEYS is required/,
        );
    });

    it("validates encryption key length", () => {
        expect(() =>
            loadConfiguration(
                productionEnv({ SESSION_ENCRYPTION_KEYS: Buffer.from("short").toString("base64") }),
            ),
        ).toThrow(/32-byte base64/);
    });

    it("forbids insecure provider HTTP in production", () => {
        expect(() =>
            loadConfiguration(productionEnv({ BASIS_AUTH_ALLOW_INSECURE_HTTP: "true" })),
        ).toThrow(/forbidden in production/);
    });

    it("returns a frozen configuration", () => {
        const config = loadConfiguration(productionEnv());
        expect(Object.isFrozen(config)).toBe(true);
        expect(Object.isFrozen(config.session.encryptionKeys)).toBe(true);
    });

    it("uses the dark-first development defaults only outside production", () => {
        const config: AppConfig = loadConfiguration({ NODE_ENV: "development" });
        expect(config.isProduction).toBe(false);
        expect(config.origins.workspace).toBe("http://localhost:5173");
    });
});
