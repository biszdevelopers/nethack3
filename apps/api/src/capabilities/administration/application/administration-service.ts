import type {
    AdministrationUser,
    AuditLog,
    GlobalAdministrator,
    GrantGlobalAdministratorRequest,
    OrganizationRole,
    RevokeGlobalAdministratorRequest,
} from "@nethack/contracts";
import type { AuthContext } from "../../../authentication/types.js";
import type { Clock } from "../../../core/clock.js";
import { ConflictError, NotFoundError } from "../../../core/errors.js";
import type { AuditLogger } from "../../../infrastructure/audit/audit-logger.js";
import type { DatabaseConnection } from "../../../infrastructure/database/client.js";
import type { OrganizationsContract } from "../../organizations/contracts.js";
import { AdministrationRules } from "../domain/administration-rules.js";
import type {
    AdministrationRepository,
    AuditRow,
    GlobalAdministratorRow,
    GlobalAuditOptions,
} from "../infrastructure/administration-repository.js";

export class AdministrationService {
    private readonly database: DatabaseConnection;
    private readonly repository: AdministrationRepository;
    private readonly audit: AuditLogger;
    private readonly clock: Clock;
    private readonly organizations: OrganizationsContract;

    constructor(
        database: DatabaseConnection,
        repository: AdministrationRepository,
        audit: AuditLogger,
        clock: Clock,
        organizations: OrganizationsContract,
    ) {
        this.database = database;
        this.repository = repository;
        this.audit = audit;
        this.clock = clock;
        this.organizations = organizations;
    }

    async listGlobalAdministrators(): Promise<readonly GlobalAdministrator[]> {
        const rows = await this.repository.listAdministrators(this.database.db);
        return rows.map(toGlobalAdministrator);
    }

    async grant(
        auth: AuthContext,
        input: GrantGlobalAdministratorRequest,
        ip: string | null,
    ): Promise<GlobalAdministrator> {
        const user = await this.repository.findUserByEmail(this.database.db, input.email);
        if (user === null) {
            throw new NotFoundError("No user account matches that email address.");
        }
        try {
            const row = await this.database.transaction(
                { organizationId: null, userId: auth.user.id },
                async (session) => {
                    const existing = await this.repository.findAdministrator(session.db, user.id);
                    if (existing !== null) {
                        throw new ConflictError("That user is already a global administrator.");
                    }
                    await this.repository.insertGrant(session, {
                        userId: user.id,
                        grantedByUserId: auth.user.id,
                        reason: input.reason,
                        grantedAt: this.clock.now(),
                    });
                    await this.audit.record(session, {
                        organizationId: null,
                        actorUserId: auth.user.id,
                        action: "administration.global_administrator.granted",
                        entityType: "global_administrator",
                        entityId: user.id,
                        metadata: { reason: input.reason },
                        ip,
                    });
                    const created = await this.repository.findAdministrator(session.db, user.id);
                    if (created === null) {
                        throw new Error("The global administrator grant could not be read back.");
                    }
                    return created;
                },
            );
            return toGlobalAdministrator(row);
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new ConflictError("That user is already a global administrator.");
            }
            throw error;
        }
    }

    async revoke(
        auth: AuthContext,
        userId: string,
        input: RevokeGlobalAdministratorRequest,
        ip: string | null,
    ): Promise<void> {
        await this.database.transaction(
            { organizationId: null, userId: auth.user.id },
            async (session) => {
                const grant = await this.repository.findAdministrator(session.db, userId);
                if (grant === null) {
                    throw new NotFoundError("That user is not a global administrator.");
                }
                const count = await this.repository.lockAdministratorCount(session);
                AdministrationRules.assertCanRevoke(count);
                await this.repository.deleteGrant(session, userId);
                await this.audit.record(session, {
                    organizationId: null,
                    actorUserId: auth.user.id,
                    action: "administration.global_administrator.revoked",
                    entityType: "global_administrator",
                    entityId: userId,
                    metadata: { reason: input.reason },
                    ip,
                });
            },
        );
    }

    async auditPage(options: {
        organizationId: string;
        limit: number;
        before: Date | null;
        action: string | null;
        entityType: string | null;
        actorUserId: string | null;
    }): Promise<readonly AuditLog[]> {
        const rows = await this.repository.auditPage(this.database.db, options);
        return rows.map(toAuditLog);
    }

    async globalAuditPage(options: GlobalAuditOptions): Promise<readonly AuditLog[]> {
        const rows = await this.repository.globalAuditPage(this.database.db, options);
        return rows.map(toAuditLog);
    }

    async listOrganizationUsers(organizationId: string): Promise<readonly AdministrationUser[]> {
        const [memberships, administrators] = await Promise.all([
            this.organizations.listMembershipsWithUsers(organizationId),
            this.repository.listAdministrators(this.database.db),
        ]);
        const globalAdministratorIds = new Set(
            administrators.map((administrator) => administrator.userId),
        );
        return memberships.map((membership) => ({
            userId: membership.userId,
            displayName: membership.displayName,
            email: membership.email,
            role: membership.role,
            status: membership.status,
            isJudge: membership.role === "judge",
            isGlobalAdministrator: globalAdministratorIds.has(membership.userId),
            joinedAt: membership.createdAt,
        }));
    }

    async updateOrganizationUserRole(
        auth: AuthContext,
        organizationId: string,
        targetUserId: string,
        role: OrganizationRole,
        ip: string | null,
    ): Promise<void> {
        await this.organizations.updateMemberRole(
            { userId: auth.user.id, ip },
            organizationId,
            targetUserId,
            role,
        );
    }
}

function toAuditLog(row: AuditRow): AuditLog {
    return {
        id: row.id,
        organizationId: row.organizationId,
        actorUserId: row.actorUserId,
        actorDisplayName: row.actorDisplayName,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        metadata: row.metadata,
        createdAt: row.createdAt.toISOString(),
    };
}

function toGlobalAdministrator(row: GlobalAdministratorRow): GlobalAdministrator {
    return {
        userId: row.userId,
        displayName: row.displayName,
        email: row.email,
        grantedAt: row.grantedAt.toISOString(),
        grantedByUserId: row.grantedByUserId,
    };
}

function isUniqueViolation(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code === "23505"
    );
}
