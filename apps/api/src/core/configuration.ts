import { z } from "zod";

const booleanString = z.enum(["true", "false"]).transform((value) => value === "true");

const optionalUrl = z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === undefined || value === "" ? null : value))
    .pipe(z.url().max(2048).nullable());

const environmentSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().default("127.0.0.1"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3002),
    API_ORIGIN: z.url().default("http://localhost:3002"),
    WORKSPACE_ORIGIN: z.url().default("http://localhost:5173"),
    SITE_ORIGIN: z.url().default("http://localhost:3000"),
    ASSET_ORIGIN: z.url().default("http://localhost:3002"),
    TRUST_PROXY: booleanString.default(false),
    LOG_LEVEL: z
        .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
        .default("info"),

    DATABASE_URL: z
        .string()
        .min(1)
        .default("postgres://nethack_app:nethack_app_password@127.0.0.1:55432/nethack"),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

    SESSION_COOKIE_NAME: z.string().default("__Host-nethack_session"),
    SESSION_TTL_SECONDS: z.coerce
        .number()
        .int()
        .min(60)
        .max(60 * 60 * 24 * 30)
        .default(60 * 60 * 24 * 7),
    SESSION_CSRF_HEADER: z.string().default("x-csrf-token"),
    SESSION_ENCRYPTION_KEYS: z.string().optional(),

    BASIS_AUTH_ISSUER: z.url().default("http://localhost:4010"),
    BASIS_AUTH_CLIENT_ID: z.string().default("nethack-dev"),
    BASIS_AUTH_CLIENT_SECRET: z.string().default("nethack-dev-secret-value"),
    BASIS_AUTH_RESOURCE: z.string().default("devconnect://nethack.bisz.dev"),
    BASIS_AUTH_SCOPES: z.string().default("openid profile email offline_access nethack.access"),
    BASIS_AUTH_RESOURCE_SECRET: z.string().default("nethack-dev-resource-secret"),
    BASIS_AUTH_INTERNAL_URL: optionalUrl,
    BASIS_AUTH_REDIRECT_URI: z.url().default("http://localhost:3002/api/v1/auth/callback"),
    BASIS_AUTH_POST_LOGOUT_REDIRECT_URI: z.url().default("http://localhost:5173/"),
    BASIS_AUTH_ALLOW_INSECURE_HTTP: booleanString.default(false),

    STORAGE_ROOT: z.string().default("./storage"),
    MAX_UPLOAD_BYTES: z.coerce
        .number()
        .int()
        .min(1024)
        .max(100 * 1024 * 1024)
        .default(25 * 1024 * 1024),
    MAX_REQUEST_BYTES: z.coerce
        .number()
        .int()
        .min(1024)
        .max(10 * 1024 * 1024)
        .default(1024 * 1024),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(100000).default(300),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60_000),

    SMTP_URL: optionalUrl,
    EMAIL_FROM: z.string().default("nethack <no-reply@nethack.local>"),

    OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl,
    API_DOCS_ENABLED: booleanString.default(false),

    LOGIN_TRANSACTION_TTL_SECONDS: z.coerce.number().int().min(60).max(1800).default(600),
    REFRESH_SKEW_SECONDS: z.coerce.number().int().min(5).max(600).default(60),
    BACKCHANNEL_MAX_TOKEN_AGE_SECONDS: z.coerce.number().int().min(60).max(600).default(120),
});

export type Environment = z.infer<typeof environmentSchema>;

export interface SessionEncryptionKey {
    readonly version: number;
    readonly key: Buffer;
}

export interface AppConfig {
    readonly nodeEnv: Environment["NODE_ENV"];
    readonly isProduction: boolean;
    readonly host: string;
    readonly port: number;
    readonly origins: {
        readonly api: string;
        readonly workspace: string;
        readonly site: string;
        readonly assets: string;
    };
    readonly trustProxy: boolean;
    readonly logLevel: Environment["LOG_LEVEL"];
    readonly database: {
        readonly url: string;
        readonly poolMax: number;
    };
    readonly session: {
        readonly cookieName: string;
        readonly ttlSeconds: number;
        readonly csrfHeader: string;
        readonly encryptionKeys: readonly SessionEncryptionKey[];
    };
    readonly basisAuth: {
        readonly issuer: string;
        readonly clientId: string;
        readonly clientSecret: string;
        readonly resource: string;
        readonly scopes: string;
        readonly resourceSecret: string;
        readonly internalUrl: string | null;
        readonly redirectUri: string;
        readonly postLogoutRedirectUri: string;
        readonly allowInsecureHttp: boolean;
    };
    readonly storage: {
        readonly root: string;
        readonly maxUploadBytes: number;
    };
    readonly maxRequestBytes: number;
    readonly rateLimit: {
        readonly max: number;
        readonly windowMs: number;
    };
    readonly smtpUrl: string | null;
    readonly emailFrom: string;
    readonly otelEndpoint: string | null;
    readonly docsEnabled: boolean;
    readonly loginTransactionTtlSeconds: number;
    readonly refreshSkewSeconds: number;
    readonly backchannelMaxTokenAgeSeconds: number;
}

const DEVELOPMENT_KEY = Buffer.from(
    "9f2a1c3b4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8",
    "hex",
);

function parseEncryptionKeys(
    raw: string | undefined,
    isProduction: boolean,
): SessionEncryptionKey[] {
    if (!raw || raw.trim() === "") {
        if (isProduction) {
            throw new Error("SESSION_ENCRYPTION_KEYS is required in production.");
        }
        return [{ version: 1, key: DEVELOPMENT_KEY }];
    }
    const keys = raw
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .map((entry, index) => {
            const key = Buffer.from(entry, "base64");
            if (key.length !== 32) {
                throw new Error(
                    `SESSION_ENCRYPTION_KEYS entry ${index + 1} must be a 32-byte base64 value.`,
                );
            }
            return { version: index + 1, key };
        });
    if (keys.length === 0) {
        throw new Error("SESSION_ENCRYPTION_KEYS must contain at least one key.");
    }
    return keys;
}

function assertHttpsInProduction(url: string, name: string, isProduction: boolean): void {
    if (isProduction && new URL(url).protocol !== "https:") {
        throw new Error(`${name} must use HTTPS in production.`);
    }
}

export function loadConfiguration(env: NodeJS.ProcessEnv = process.env): AppConfig {
    const parsed = environmentSchema.parse(env);
    const isProduction = parsed.NODE_ENV === "production";

    for (const [name, value] of [
        ["API_ORIGIN", parsed.API_ORIGIN],
        ["WORKSPACE_ORIGIN", parsed.WORKSPACE_ORIGIN],
        ["SITE_ORIGIN", parsed.SITE_ORIGIN],
        ["ASSET_ORIGIN", parsed.ASSET_ORIGIN],
        ["BASIS_AUTH_ISSUER", parsed.BASIS_AUTH_ISSUER],
        ["BASIS_AUTH_REDIRECT_URI", parsed.BASIS_AUTH_REDIRECT_URI],
    ] as const) {
        assertHttpsInProduction(value, name, isProduction);
    }

    if (isProduction && parsed.BASIS_AUTH_CLIENT_SECRET === "nethack-dev-secret-value") {
        throw new Error("The development Basis Auth client secret must not be used in production.");
    }
    if (isProduction && parsed.BASIS_AUTH_ALLOW_INSECURE_HTTP) {
        throw new Error("BASIS_AUTH_ALLOW_INSECURE_HTTP is forbidden in production.");
    }

    return Object.freeze({
        nodeEnv: parsed.NODE_ENV,
        isProduction,
        host: parsed.HOST,
        port: parsed.PORT,
        origins: Object.freeze({
            api: parsed.API_ORIGIN,
            workspace: parsed.WORKSPACE_ORIGIN,
            site: parsed.SITE_ORIGIN,
            assets: parsed.ASSET_ORIGIN,
        }),
        trustProxy: parsed.TRUST_PROXY,
        logLevel: parsed.LOG_LEVEL,
        database: Object.freeze({
            url: parsed.DATABASE_URL,
            poolMax: parsed.DATABASE_POOL_MAX,
        }),
        session: Object.freeze({
            cookieName: parsed.SESSION_COOKIE_NAME,
            ttlSeconds: parsed.SESSION_TTL_SECONDS,
            csrfHeader: parsed.SESSION_CSRF_HEADER,
            encryptionKeys: Object.freeze(
                parseEncryptionKeys(parsed.SESSION_ENCRYPTION_KEYS, isProduction),
            ),
        }),
        basisAuth: Object.freeze({
            issuer: parsed.BASIS_AUTH_ISSUER,
            clientId: parsed.BASIS_AUTH_CLIENT_ID,
            clientSecret: parsed.BASIS_AUTH_CLIENT_SECRET,
            resource: parsed.BASIS_AUTH_RESOURCE,
            scopes: parsed.BASIS_AUTH_SCOPES,
            resourceSecret: parsed.BASIS_AUTH_RESOURCE_SECRET,
            internalUrl: parsed.BASIS_AUTH_INTERNAL_URL,
            redirectUri: parsed.BASIS_AUTH_REDIRECT_URI,
            postLogoutRedirectUri: parsed.BASIS_AUTH_POST_LOGOUT_REDIRECT_URI,
            allowInsecureHttp: parsed.BASIS_AUTH_ALLOW_INSECURE_HTTP,
        }),
        storage: Object.freeze({
            root: parsed.STORAGE_ROOT,
            maxUploadBytes: parsed.MAX_UPLOAD_BYTES,
        }),
        maxRequestBytes: parsed.MAX_REQUEST_BYTES,
        rateLimit: Object.freeze({
            max: parsed.RATE_LIMIT_MAX,
            windowMs: parsed.RATE_LIMIT_WINDOW_MS,
        }),
        smtpUrl: parsed.SMTP_URL,
        emailFrom: parsed.EMAIL_FROM,
        otelEndpoint: parsed.OTEL_EXPORTER_OTLP_ENDPOINT,
        docsEnabled: parsed.API_DOCS_ENABLED,
        loginTransactionTtlSeconds: parsed.LOGIN_TRANSACTION_TTL_SECONDS,
        refreshSkewSeconds: parsed.REFRESH_SKEW_SECONDS,
        backchannelMaxTokenAgeSeconds: parsed.BACKCHANNEL_MAX_TOKEN_AGE_SECONDS,
    });
}
