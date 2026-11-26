import { sql } from "drizzle-orm";
import {
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";

export const userStatusEnum = pgEnum("user_status", ["active", "disabled"]);

export const users = pgTable(
    "users",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        displayName: text("display_name").notNull(),
        email: text("email"),
        avatarUrl: text("avatar_url"),
        locale: text("locale").notNull().default("en"),
        status: userStatusEnum("status").notNull().default("active"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("users_email_unique")
            .on(sql`lower(${table.email})`)
            .where(sql`${table.email} is not null`),
        index("users_status_idx").on(table.status),
    ],
);

export const externalIdentities = pgTable(
    "external_identities",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        issuer: text("issuer").notNull(),
        subject: text("subject").notNull(),
        emailAtLogin: text("email_at_login"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        lastLoginAt: timestamp("last_login_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("external_identities_issuer_subject_unique").on(table.issuer, table.subject),
        uniqueIndex("external_identities_user_issuer_unique").on(table.userId, table.issuer),
        index("external_identities_subject_idx").on(table.subject),
    ],
);

export const sessions = pgTable(
    "sessions",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        tokenHash: text("token_hash").notNull(),
        csrfHash: text("csrf_hash").notNull(),
        accessTokenEncrypted: text("access_token_encrypted"),
        refreshTokenEncrypted: text("refresh_token_encrypted"),
        tokenKeyVersion: integer("token_key_version").notNull().default(1),
        accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
        refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
        ipHash: text("ip_hash"),
        userAgent: text("user_agent"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
        revokedAt: timestamp("revoked_at", { withTimezone: true }),
        revokedReason: text("revoked_reason"),
    },
    (table) => [
        uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
        index("sessions_user_idx").on(table.userId),
        index("sessions_expires_idx").on(table.expiresAt),
        index("sessions_refresh_expiry_idx").on(table.refreshTokenExpiresAt),
    ],
);

export const authTransactions = pgTable(
    "auth_transactions",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        stateHash: text("state_hash").notNull(),
        nonce: text("nonce").notNull(),
        codeVerifierEncrypted: text("code_verifier_encrypted").notNull(),
        tokenKeyVersion: integer("token_key_version").notNull().default(1),
        returnTo: text("return_to"),
        ipHash: text("ip_hash"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
        consumedAt: timestamp("consumed_at", { withTimezone: true }),
    },
    (table) => [
        uniqueIndex("auth_transactions_state_unique").on(table.stateHash),
        index("auth_transactions_expires_idx").on(table.expiresAt),
    ],
);

export const revokedAccessTokens = pgTable(
    "revoked_access_tokens",
    {
        jti: text("jti").primaryKey(),
        validAfter: timestamp("valid_after", { withTimezone: true }).notNull(),
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [index("revoked_access_tokens_expires_idx").on(table.expiresAt)],
);

export const backchannelEvents = pgTable(
    "backchannel_events",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        eventType: text("event_type").notNull(),
        externalId: text("external_id"),
        payloadHash: text("payload_hash").notNull(),
        processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("backchannel_events_idempotency_unique").on(
            table.eventType,
            table.externalId,
            table.payloadHash,
        ),
        index("backchannel_events_processed_idx").on(table.processedAt),
    ],
);

export const backchannelChallenges = pgTable("backchannel_challenges", {
    nonce: text("nonce").primaryKey(),
    challengeHash: text("challenge_hash").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const globalAdministrators = pgTable("global_administrators", {
    userId: uuid("user_id")
        .primaryKey()
        .references(() => users.id, { onDelete: "cascade" }),
    grantedByUserId: uuid("granted_by_user_id").references(() => users.id, {
        onDelete: "set null",
    }),
    reason: text("reason"),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const idempotencyKeys = pgTable(
    "idempotency_keys",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        route: text("route").notNull(),
        key: text("key").notNull(),
        requestHash: text("request_hash").notNull(),
        responseStatus: integer("response_status").notNull(),
        responseBody: jsonb("response_body").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    },
    (table) => [
        uniqueIndex("idempotency_keys_user_route_key_unique").on(
            table.userId,
            table.route,
            table.key,
        ),
        index("idempotency_keys_expires_idx").on(table.expiresAt),
    ],
);

export const outboxEvents = pgTable(
    "outbox_events",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id"),
        aggregateType: text("aggregate_type").notNull(),
        aggregateId: text("aggregate_id").notNull(),
        eventType: text("event_type").notNull(),
        payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
        dedupeKey: text("dedupe_key"),
        occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
        processedAt: timestamp("processed_at", { withTimezone: true }),
        attempts: integer("attempts").notNull().default(0),
        lastError: text("last_error"),
        availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex("outbox_events_dedupe_unique").on(table.dedupeKey),
        index("outbox_events_pending_idx").on(table.processedAt, table.availableAt),
        index("outbox_events_organization_idx").on(table.organizationId),
    ],
);

export const jobStatusEnum = pgEnum("job_status", [
    "pending",
    "running",
    "completed",
    "failed",
    "dead",
]);

export const jobs = pgTable(
    "jobs",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        kind: text("kind").notNull(),
        payload: jsonb("payload").notNull(),
        organizationId: uuid("organization_id"),
        status: jobStatusEnum("status").notNull().default("pending"),
        dedupeKey: text("dedupe_key"),
        runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
        attempts: integer("attempts").notNull().default(0),
        maxAttempts: integer("max_attempts").notNull().default(5),
        lockedUntil: timestamp("locked_until", { withTimezone: true }),
        lockedBy: text("locked_by"),
        lastError: text("last_error"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        completedAt: timestamp("completed_at", { withTimezone: true }),
    },
    (table) => [
        uniqueIndex("jobs_dedupe_unique").on(table.dedupeKey),
        index("jobs_queue_idx").on(table.status, table.runAt),
        index("jobs_organization_idx").on(table.organizationId),
    ],
);

export const auditLogs = pgTable(
    "audit_logs",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        organizationId: uuid("organization_id"),
        actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
        action: text("action").notNull(),
        entityType: text("entity_type").notNull(),
        entityId: text("entity_id"),
        metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
        ipHash: text("ip_hash"),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        index("audit_logs_organization_created_idx").on(table.organizationId, table.createdAt),
        index("audit_logs_action_idx").on(table.action),
        index("audit_logs_actor_idx").on(table.actorUserId),
    ],
);
