import type { AppConfig } from "../../core/configuration.js";
import { hashIp } from "../../authentication/crypto.js";
import type { DatabaseSession } from "../database/client.js";
import { auditLogs } from "../database/schema/index.js";

export interface AuditEntry {
    readonly organizationId: string | null;
    readonly actorUserId: string | null;
    readonly action: string;
    readonly entityType: string;
    readonly entityId: string | null;
    readonly metadata?: Record<string, unknown>;
    readonly ip?: string | null;
}

export class AuditLogger {
    private readonly ipHashKey: Buffer;

    constructor(config: AppConfig) {
        const key = config.session.encryptionKeys[0]?.key;
        if (key === undefined) {
            throw new Error("An encryption key is required for audit IP hashing.");
        }
        this.ipHashKey = key;
    }

    async record(session: DatabaseSession, entry: AuditEntry): Promise<void> {
        await session.db.insert(auditLogs).values({
            organizationId: entry.organizationId,
            actorUserId: entry.actorUserId,
            action: entry.action,
            entityType: entry.entityType,
            entityId: entry.entityId,
            metadata: entry.metadata ?? {},
            ipHash:
                entry.ip === undefined || entry.ip === null
                    ? null
                    : hashIp(entry.ip, this.ipHashKey),
        });
    }
}
