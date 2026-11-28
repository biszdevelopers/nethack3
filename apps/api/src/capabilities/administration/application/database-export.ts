import type { Clock } from "../../../core/clock.js";

const PAGE_SIZE = 500;

export const DATABASE_EXPORT_OMISSIONS = [
    "Judge identities and per-judge evaluation records; assignments are exported without judge or assigner identity, and judging is aggregated per submission.",
    "Invitation tokens, session token hashes, CSRF hashes, encrypted OAuth access and refresh tokens, and other authentication secrets.",
    "Stored file contents and storage keys; file rows export name, type, size, checksum, status, and linkage only.",
    "Notification recipients, bodies, and deduplication keys; only notification metadata is exported.",
] as const;

export const TENANT_EXPORT_SECTIONS = [
    "competitionSeries",
    "competitionEditions",
    "divisions",
    "milestones",
    "teams",
    "teamMembers",
    "projects",
    "projectMembers",
    "submissions",
    "submissionVersions",
    "submissionFiles",
    "judgingRubrics",
    "judgingCriteria",
    "judgeAssignments",
    "judgingAggregates",
    "awards",
    "teamAwards",
    "editionResults",
    "votingRounds",
    "voteTotals",
] as const;

export type TenantExportSection = (typeof TENANT_EXPORT_SECTIONS)[number];
export type DatabaseExportSection = "organizations" | "notifications" | TenantExportSection;

export interface DatabaseExportSnapshot {
    useOrganization(organizationId: string): Promise<void>;
    read(
        section: DatabaseExportSection,
        offset: number,
        limit: number,
    ): Promise<readonly Record<string, unknown>[]>;
    close(): Promise<void>;
    abort(): Promise<void>;
}

export interface DatabaseExportSource {
    open(): Promise<DatabaseExportSnapshot>;
}

const FORBIDDEN_KEYS = new Set(
    [
        "judgeUserId",
        "assignedByUserId",
        "reportedByUserId",
        "resolvedByUserId",
        "tokenHash",
        "accessTokenEncrypted",
        "refreshTokenEncrypted",
        "tokenKeyVersion",
        "csrfHash",
        "stateHash",
        "codeVerifierEncrypted",
        "ipHash",
        "userAgent",
        "storageKey",
        "content",
        "contents",
        "fileData",
        "body",
        "dedupeKey",
        "password",
        "secret",
        "apiKey",
        "authorization",
    ].map((key) => key.replaceAll("_", "").toLowerCase()),
);

const NOTIFICATION_FORBIDDEN_KEYS = new Set([...FORBIDDEN_KEYS, "userid"]);

/**
 * Defense in depth for the export: even if a repository column selection later
 * grows a sensitive field, the serializer drops it before it reaches the wire.
 */
export function stripForbiddenFields(
    value: unknown,
    forbidden: ReadonlySet<string> = FORBIDDEN_KEYS,
): unknown {
    if (value instanceof Date || value === null || typeof value !== "object") {
        return value;
    }
    if (ArrayBuffer.isView(value)) {
        return "[redacted]";
    }
    if (Array.isArray(value)) {
        return value.map((item) => stripForbiddenFields(item, forbidden));
    }
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
        if (forbidden.has(key.replaceAll("_", "").toLowerCase())) {
            continue;
        }
        result[key] = stripForbiddenFields(item, forbidden);
    }
    return result;
}

/**
 * Streams a repeatable-read snapshot as a single JSON object. Each section is
 * written incrementally so the archive is never fully materialized in memory.
 * Tenant tables are read organization by organization because PostgreSQL row
 * level security is enforced for the runtime role.
 */
export class DatabaseExportService {
    private readonly source: DatabaseExportSource;
    private readonly clock: Clock;

    constructor(source: DatabaseExportSource, clock: Clock) {
        this.source = source;
        this.clock = clock;
    }

    async *stream(): AsyncGenerator<string> {
        const snapshot = await this.source.open();
        let failed = true;
        try {
            const organizations = await readAll(snapshot, "organizations");
            const organizationIds = organizations.flatMap((organization) =>
                typeof organization.id === "string" ? [organization.id] : [],
            );

            yield "{";
            yield `"formatVersion":1,"generatedAt":${JSON.stringify(this.clock.now().toISOString())}`;
            yield `,"omitted":${JSON.stringify(DATABASE_EXPORT_OMISSIONS)}`;
            yield `,"organizations":${JSON.stringify(
                organizations.map((organization) => stripForbiddenFields(organization)),
            )}`;

            for (const section of TENANT_EXPORT_SECTIONS) {
                yield `,${JSON.stringify(section)}:[`;
                let first = true;
                for (const organizationId of organizationIds) {
                    await snapshot.useOrganization(organizationId);
                    let offset = 0;
                    for (;;) {
                        const rows = await snapshot.read(section, offset, PAGE_SIZE);
                        for (const row of rows) {
                            if (!first) {
                                yield ",";
                            }
                            first = false;
                            yield JSON.stringify(stripForbiddenFields(row));
                        }
                        if (rows.length < PAGE_SIZE) {
                            break;
                        }
                        offset += rows.length;
                    }
                }
                yield "]";
            }

            yield `,"notifications":[`;
            let firstNotification = true;
            let notificationOffset = 0;
            for (;;) {
                const rows = await snapshot.read("notifications", notificationOffset, PAGE_SIZE);
                for (const row of rows) {
                    if (!firstNotification) {
                        yield ",";
                    }
                    firstNotification = false;
                    yield JSON.stringify(stripForbiddenFields(row, NOTIFICATION_FORBIDDEN_KEYS));
                }
                if (rows.length < PAGE_SIZE) {
                    break;
                }
                notificationOffset += rows.length;
            }
            yield "]";
            yield "}";

            failed = false;
        } finally {
            if (failed) {
                await snapshot.abort().catch(() => undefined);
            } else {
                await snapshot.close();
            }
        }
    }
}

async function readAll(
    snapshot: DatabaseExportSnapshot,
    section: DatabaseExportSection,
): Promise<readonly Record<string, unknown>[]> {
    const rows: Record<string, unknown>[] = [];
    let offset = 0;
    for (;;) {
        const page = await snapshot.read(section, offset, PAGE_SIZE);
        rows.push(...page);
        if (page.length < PAGE_SIZE) {
            return rows;
        }
        offset += page.length;
    }
}
