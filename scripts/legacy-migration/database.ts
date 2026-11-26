import { randomUUID } from "node:crypto";
import { Client } from "pg";
import {
    MigrationConflictError,
    type PlannedFile,
    type PlannedOrganization,
    type PlannedProjectMember,
    type PlannedSubmissionVersion,
    type PlannedTeamMember,
    type PlannedUser,
} from "./planner.ts";

export type SqlValue = string | number | boolean | Date | null | string[];

export interface MigrationApplyContext {
    readonly sourceSystem: string;
    readonly inputSha256: string;
    readonly generatedAt: Date;
}

export interface OrganizationApplyResult {
    readonly organizationId: string;
    readonly rows: number;
}

export interface MigrationTarget {
    applyOrganization(
        organization: PlannedOrganization,
        context: MigrationApplyContext,
    ): Promise<OrganizationApplyResult>;
    verifyOrganization(organizationId: string): Promise<boolean>;
    close(): Promise<void>;
}

interface PgError extends Error {
    readonly code?: string;
    readonly constraint?: string;
    readonly detail?: string;
}

function isPgError(error: unknown): error is PgError {
    return error instanceof Error && "code" in error;
}

function translateDatabaseError(error: unknown, organization: PlannedOrganization): Error {
    if (error instanceof MigrationConflictError) {
        return error;
    }
    if (isPgError(error)) {
        const constraint = error.constraint === undefined ? "unknown constraint" : error.constraint;
        if (error.code === "23505") {
            return new MigrationConflictError(
                `Organization "${organization.slug}" (${organization.externalId}) conflicts with existing data at ${constraint}. The organization transaction was rolled back.`,
            );
        }
        if (error.code === "23503") {
            return new MigrationConflictError(
                `Organization "${organization.slug}" (${organization.externalId}) references a missing row at ${constraint}. The organization transaction was rolled back.`,
            );
        }
        if (error.code === "23514") {
            return new MigrationConflictError(
                `Organization "${organization.slug}" (${organization.externalId}) violates ${constraint}. The organization transaction was rolled back.`,
            );
        }
    }
    return error instanceof Error ? error : new Error(String(error));
}

class PgMigrationTarget implements MigrationTarget {
    private readonly connectionString: string;
    private client: Client | null = null;

    constructor(connectionString: string) {
        this.connectionString = connectionString;
    }

    private async connection(): Promise<Client> {
        if (this.client !== null) {
            return this.client;
        }
        const client = new Client({
            connectionString: this.connectionString,
            application_name: "nethack-legacy-migration",
        });
        await client.connect();
        this.client = client;
        return client;
    }

    async applyOrganization(
        organization: PlannedOrganization,
        context: MigrationApplyContext,
    ): Promise<OrganizationApplyResult> {
        const client = await this.connection();
        await client.query("begin");
        try {
            await client.query(
                "select set_config('nethack.organization_id', $1, true), set_config('nethack.user_id', '', true)",
                [organization.id],
            );
            const rows = await this.writeOrganization(client, organization, context);
            await client.query("commit");
            return { organizationId: organization.id, rows };
        } catch (error) {
            try {
                await client.query("rollback");
            } catch {
                // The original error is more useful than a rollback failure.
            }
            throw translateDatabaseError(error, organization);
        }
    }

    async verifyOrganization(organizationId: string): Promise<boolean> {
        const client = await this.connection();
        const result = await client.query<{ id: string }>(
            "select id from organizations where id = $1",
            [organizationId],
        );
        return result.rows.length > 0;
    }

    async close(): Promise<void> {
        if (this.client === null) {
            return;
        }
        const client = this.client;
        this.client = null;
        await client.end();
    }

    private async writeOrganization(
        client: Client,
        organization: PlannedOrganization,
        context: MigrationApplyContext,
    ): Promise<number> {
        let rows = 0;

        rows += await insertRow(
            client,
            "organizations",
            ["id", "name", "slug", "description", "website_url", "created_at", "updated_at"],
            [
                organization.id,
                organization.name,
                organization.slug,
                organization.description,
                organization.websiteUrl,
                organization.createdAt,
                organization.updatedAt,
            ],
        );
        rows += await insertRow(
            client,
            "organization_settings",
            [
                "organization_id",
                "registration_requires_approval",
                "allow_participant_team_creation",
                "public_showcase_enabled",
                "updated_at",
            ],
            [
                organization.id,
                organization.settings.registrationRequiresApproval,
                organization.settings.allowParticipantTeamCreation,
                organization.settings.publicShowcaseEnabled,
                organization.updatedAt,
            ],
        );

        for (const user of organization.users) {
            rows += await ensureUser(client, user);
        }

        for (const membership of organization.memberships) {
            rows += await insertRow(
                client,
                "organization_memberships",
                ["id", "organization_id", "user_id", "role", "status", "created_at", "updated_at"],
                [
                    membership.id,
                    organization.id,
                    membership.userId,
                    membership.role,
                    membership.status,
                    membership.createdAt,
                    membership.updatedAt,
                ],
            );
        }

        for (const series of organization.series) {
            rows += await insertRow(
                client,
                "competition_series",
                [
                    "id",
                    "organization_id",
                    "name",
                    "slug",
                    "description",
                    "created_at",
                    "updated_at",
                ],
                [
                    series.id,
                    organization.id,
                    series.name,
                    series.slug,
                    series.description,
                    series.createdAt,
                    series.updatedAt,
                ],
            );
        }

        for (const edition of organization.editions) {
            rows += await insertRow(
                client,
                "competition_editions",
                [
                    "id",
                    "organization_id",
                    "series_id",
                    "name",
                    "slug",
                    "description",
                    "status",
                    "timezone",
                    "registration_opens_at",
                    "registration_closes_at",
                    "starts_at",
                    "ends_at",
                    "team_min_size",
                    "team_max_size",
                    "max_participants",
                    "rules_markdown",
                    "published_at",
                    "created_at",
                    "updated_at",
                ],
                [
                    edition.id,
                    organization.id,
                    edition.seriesId,
                    edition.name,
                    edition.slug,
                    edition.description,
                    edition.status,
                    edition.timezone,
                    edition.registrationOpensAt,
                    edition.registrationClosesAt,
                    edition.startsAt,
                    edition.endsAt,
                    edition.teamMinSize,
                    edition.teamMaxSize,
                    edition.maxParticipants,
                    edition.rulesMarkdown,
                    edition.publishedAt,
                    edition.createdAt,
                    edition.updatedAt,
                ],
            );
        }

        for (const division of organization.divisions) {
            rows += await insertRow(
                client,
                "divisions",
                [
                    "id",
                    "organization_id",
                    "edition_id",
                    "name",
                    "slug",
                    "description",
                    "min_team_size",
                    "max_team_size",
                    "created_at",
                ],
                [
                    division.id,
                    organization.id,
                    division.editionId,
                    division.name,
                    division.slug,
                    division.description,
                    division.minTeamSize,
                    division.maxTeamSize,
                    division.createdAt,
                ],
            );
        }

        for (const registration of organization.registrations) {
            rows += await insertRow(
                client,
                "registrations",
                [
                    "id",
                    "organization_id",
                    "edition_id",
                    "user_id",
                    "division_id",
                    "status",
                    "note",
                    "decided_by_user_id",
                    "created_at",
                    "updated_at",
                    "decided_at",
                ],
                [
                    registration.id,
                    organization.id,
                    registration.editionId,
                    registration.userId,
                    registration.divisionId,
                    registration.status,
                    registration.note,
                    null,
                    registration.createdAt,
                    registration.updatedAt,
                    registration.decidedAt,
                ],
            );
        }

        for (const team of organization.teams) {
            rows += await insertRow(
                client,
                "teams",
                [
                    "id",
                    "organization_id",
                    "edition_id",
                    "division_id",
                    "name",
                    "description",
                    "status",
                    "captain_user_id",
                    "max_members",
                    "created_at",
                    "updated_at",
                ],
                [
                    team.id,
                    organization.id,
                    team.editionId,
                    team.divisionId,
                    team.name,
                    team.description,
                    team.status,
                    team.captainUserId,
                    team.maxMembers,
                    team.createdAt,
                    team.updatedAt,
                ],
            );
        }

        for (const member of organization.teamMembers) {
            rows += await insertTeamMember(client, organization.id, member);
        }

        for (const participant of organization.participants) {
            rows += await insertRow(
                client,
                "participants",
                [
                    "id",
                    "organization_id",
                    "edition_id",
                    "user_id",
                    "division_id",
                    "team_id",
                    "registered_at",
                ],
                [
                    participant.id,
                    organization.id,
                    participant.editionId,
                    participant.userId,
                    participant.divisionId,
                    participant.teamId,
                    participant.registeredAt,
                ],
            );
        }

        for (const project of organization.projects) {
            rows += await insertRow(
                client,
                "projects",
                [
                    "id",
                    "organization_id",
                    "edition_id",
                    "team_id",
                    "owner_user_id",
                    "title",
                    "slug",
                    "summary",
                    "description_markdown",
                    "repository_url",
                    "demo_url",
                    "tags",
                    "status",
                    "published_at",
                    "created_at",
                    "updated_at",
                ],
                [
                    project.id,
                    organization.id,
                    project.editionId,
                    project.teamId,
                    project.ownerUserId,
                    project.title,
                    project.slug,
                    project.summary,
                    project.descriptionMarkdown,
                    project.repositoryUrl,
                    project.demoUrl,
                    [...project.tags],
                    project.status,
                    project.publishedAt,
                    project.createdAt,
                    project.updatedAt,
                ],
            );
        }

        for (const member of organization.projectMembers) {
            rows += await insertProjectMember(client, organization.id, member);
        }

        for (const submission of organization.submissions) {
            rows += await insertRow(
                client,
                "submissions",
                [
                    "id",
                    "organization_id",
                    "edition_id",
                    "project_id",
                    "team_id",
                    "status",
                    "current_version",
                    "submitted_at",
                    "review_note",
                    "review_note_updated_at",
                    "created_at",
                    "updated_at",
                ],
                [
                    submission.id,
                    organization.id,
                    submission.editionId,
                    submission.projectId,
                    submission.teamId,
                    submission.status,
                    submission.currentVersion,
                    submission.submittedAt,
                    submission.reviewNote,
                    null,
                    submission.createdAt,
                    submission.updatedAt,
                ],
            );
        }

        for (const version of organization.submissionVersions) {
            rows += await insertSubmissionVersion(client, organization.id, version);
        }

        for (const file of organization.files) {
            rows += await insertFile(client, organization.id, file);
        }

        rows += await insertRow(
            client,
            "audit_logs",
            [
                "id",
                "organization_id",
                "actor_user_id",
                "action",
                "entity_type",
                "entity_id",
                "metadata",
                "ip_hash",
                "created_at",
            ],
            [
                randomUUID(),
                organization.id,
                null,
                "legacy.migration.applied",
                "organization",
                organization.id,
                JSON.stringify({
                    sourceSystem: context.sourceSystem,
                    inputSha256: context.inputSha256,
                    exportGeneratedAt: context.generatedAt.toISOString(),
                    organizationExternalId: organization.externalId,
                    counts: {
                        users: organization.users.length,
                        memberships: organization.memberships.length,
                        series: organization.series.length,
                        editions: organization.editions.length,
                        divisions: organization.divisions.length,
                        registrations: organization.registrations.length,
                        teams: organization.teams.length,
                        teamMembers: organization.teamMembers.length,
                        participants: organization.participants.length,
                        projects: organization.projects.length,
                        projectMembers: organization.projectMembers.length,
                        submissions: organization.submissions.length,
                        submissionVersions: organization.submissionVersions.length,
                        files: organization.files.length,
                    },
                }),
                null,
                new Date(),
            ],
        );

        return rows;
    }
}

async function insertRow(
    client: Client,
    table: string,
    columns: readonly string[],
    values: readonly SqlValue[],
): Promise<number> {
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
    const result = await client.query(
        `insert into ${table} (${columns.join(", ")}) values (${placeholders})`,
        [...values],
    );
    return result.rowCount ?? 0;
}

async function ensureUser(client: Client, user: PlannedUser): Promise<number> {
    const existing = await client.query<{
        display_name: string;
        email: string | null;
        status: string;
    }>("select display_name, email, status from users where id = $1", [user.id]);
    const row = existing.rows[0];
    let inserted = 0;
    if (row === undefined) {
        inserted = await insertRow(
            client,
            "users",
            [
                "id",
                "display_name",
                "email",
                "avatar_url",
                "locale",
                "status",
                "created_at",
                "updated_at",
            ],
            [
                user.id,
                user.displayName,
                user.email,
                null,
                user.locale,
                user.status,
                user.createdAt,
                user.updatedAt,
            ],
        );
    } else {
        const existingEmail = row.email === null ? null : row.email.toLowerCase();
        const plannedEmail = user.email === null ? null : user.email.toLowerCase();
        if (
            row.display_name !== user.displayName ||
            existingEmail !== plannedEmail ||
            row.status !== user.status
        ) {
            throw new MigrationConflictError(
                `User ${user.externalId} (${user.id}) already exists with different profile fields. The migration never overwrites or links by email.`,
            );
        }
    }

    for (const identity of user.identities) {
        const existingIdentity = await client.query<{ user_id: string }>(
            "select user_id from external_identities where issuer = $1 and subject = $2",
            [identity.issuer, identity.subject],
        );
        const identityRow = existingIdentity.rows[0];
        if (identityRow !== undefined) {
            if (identityRow.user_id !== user.id) {
                throw new MigrationConflictError(
                    `Identity (${identity.issuer}, ${identity.subject}) is already linked to another user. Resolve the identity mapping explicitly; the migration does not relink identities.`,
                );
            }
            continue;
        }
        inserted += await insertRow(
            client,
            "external_identities",
            ["id", "user_id", "issuer", "subject", "email_at_login", "created_at", "last_login_at"],
            [
                identity.id,
                user.id,
                identity.issuer,
                identity.subject,
                identity.emailAtLogin,
                identity.createdAt,
                identity.lastLoginAt,
            ],
        );
    }

    return inserted;
}

function insertTeamMember(
    client: Client,
    organizationId: string,
    member: PlannedTeamMember,
): Promise<number> {
    return insertRow(
        client,
        "team_members",
        ["id", "organization_id", "team_id", "user_id", "role", "joined_at"],
        [member.id, organizationId, member.teamId, member.userId, member.role, member.joinedAt],
    );
}

function insertProjectMember(
    client: Client,
    organizationId: string,
    member: PlannedProjectMember,
): Promise<number> {
    return insertRow(
        client,
        "project_members",
        ["id", "organization_id", "project_id", "user_id", "role", "created_at"],
        [member.id, organizationId, member.projectId, member.userId, member.role, member.createdAt],
    );
}

function insertSubmissionVersion(
    client: Client,
    organizationId: string,
    version: PlannedSubmissionVersion,
): Promise<number> {
    return insertRow(
        client,
        "submission_versions",
        [
            "id",
            "organization_id",
            "submission_id",
            "version",
            "title",
            "summary",
            "description_markdown",
            "repository_url",
            "demo_url",
            "created_by_user_id",
            "created_at",
        ],
        [
            version.id,
            organizationId,
            version.submissionId,
            version.version,
            version.title,
            version.summary,
            version.descriptionMarkdown,
            version.repositoryUrl,
            version.demoUrl,
            version.createdByUserId,
            version.createdAt,
        ],
    );
}

function insertFile(client: Client, organizationId: string, file: PlannedFile): Promise<number> {
    return insertRow(
        client,
        "submission_files",
        [
            "id",
            "organization_id",
            "project_id",
            "submission_id",
            "version_id",
            "file_name",
            "content_type",
            "byte_size",
            "checksum_sha256",
            "storage_key",
            "status",
            "rejection_reason",
            "uploaded_by_user_id",
            "created_at",
            "inspected_at",
            "deleted_at",
        ],
        [
            file.id,
            organizationId,
            file.projectId,
            file.submissionId,
            file.versionId,
            file.fileName,
            file.contentType,
            file.byteSize,
            file.checksumSha256,
            file.storageKey,
            file.status,
            file.rejectionReason,
            file.uploadedByUserId,
            file.createdAt,
            file.inspectedAt,
            file.deletedAt,
        ],
    );
}

export function createPgMigrationTarget(connectionString: string): MigrationTarget {
    return new PgMigrationTarget(connectionString);
}
