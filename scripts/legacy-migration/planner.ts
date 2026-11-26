import { createHash } from "node:crypto";
import type {
    LegacyExport,
    LegacyFile,
    LegacyOrganization,
    LegacyProject,
    LegacySeries,
    LegacySubmission,
    LegacyTeam,
    LegacyUser,
    MigrationMap,
} from "./schema.ts";

const ID_NAMESPACE = "5f0d6b1e-3b7c-5d2a-9e4f-6a1b2c3d4e5f";

export class MigrationValidationError extends Error {
    readonly issues: readonly string[];

    constructor(issues: readonly string[]) {
        super(
            `Legacy export validation failed:\n${issues.map((issue) => `- ${issue}`).join("\n")}`,
        );
        this.name = "MigrationValidationError";
        this.issues = issues;
    }
}

export class MigrationConflictError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "MigrationConflictError";
    }
}

export interface MigrationCounts {
    readonly organizations: number;
    readonly users: number;
    readonly identities: number;
    readonly memberships: number;
    readonly series: number;
    readonly editions: number;
    readonly divisions: number;
    readonly registrations: number;
    readonly teams: number;
    readonly teamMembers: number;
    readonly participants: number;
    readonly projects: number;
    readonly projectMembers: number;
    readonly submissions: number;
    readonly submissionVersions: number;
    readonly files: number;
}

export interface PlannedIdentity {
    readonly id: string;
    readonly issuer: string;
    readonly subject: string;
    readonly emailAtLogin: string | null;
    readonly createdAt: Date;
    readonly lastLoginAt: Date;
}

export interface PlannedUser {
    readonly key: string;
    readonly id: string;
    readonly externalId: string;
    readonly displayName: string;
    readonly email: string | null;
    readonly locale: string;
    readonly status: "active" | "disabled";
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly identities: readonly PlannedIdentity[];
}

export interface PlannedMembership {
    readonly id: string;
    readonly userId: string;
    readonly role: "owner" | "organizer" | "judge" | "participant";
    readonly status: "active" | "suspended";
    readonly createdAt: Date;
    readonly updatedAt: Date;
}

export interface PlannedSeries {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly description: string;
    readonly createdAt: Date;
    readonly updatedAt: Date;
}

export interface PlannedEdition {
    readonly id: string;
    readonly seriesId: string;
    readonly name: string;
    readonly slug: string;
    readonly description: string;
    readonly status:
        | "draft"
        | "published"
        | "registration_open"
        | "registration_closed"
        | "active"
        | "judging"
        | "voting"
        | "completed"
        | "archived";
    readonly timezone: string;
    readonly registrationOpensAt: Date | null;
    readonly registrationClosesAt: Date | null;
    readonly startsAt: Date | null;
    readonly endsAt: Date | null;
    readonly teamMinSize: number;
    readonly teamMaxSize: number;
    readonly maxParticipants: number | null;
    readonly rulesMarkdown: string;
    readonly publishedAt: Date | null;
    readonly createdAt: Date;
    readonly updatedAt: Date;
}

export interface PlannedDivision {
    readonly id: string;
    readonly editionId: string;
    readonly name: string;
    readonly slug: string;
    readonly description: string;
    readonly minTeamSize: number | null;
    readonly maxTeamSize: number | null;
    readonly createdAt: Date;
}

export interface PlannedRegistration {
    readonly id: string;
    readonly editionId: string;
    readonly userId: string;
    readonly divisionId: string | null;
    readonly status: "pending" | "approved" | "rejected" | "withdrawn" | "waitlisted";
    readonly note: string;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly decidedAt: Date | null;
}

export interface PlannedTeam {
    readonly id: string;
    readonly editionId: string;
    readonly divisionId: string | null;
    readonly name: string;
    readonly description: string;
    readonly status: "forming" | "ready" | "disbanded";
    readonly captainUserId: string;
    readonly maxMembers: number;
    readonly createdAt: Date;
    readonly updatedAt: Date;
}

export interface PlannedTeamMember {
    readonly id: string;
    readonly teamId: string;
    readonly userId: string;
    readonly role: "captain" | "member";
    readonly joinedAt: Date;
}

export interface PlannedParticipant {
    readonly id: string;
    readonly editionId: string;
    readonly userId: string;
    readonly divisionId: string | null;
    readonly teamId: string | null;
    readonly registeredAt: Date;
}

export interface PlannedProject {
    readonly id: string;
    readonly editionId: string;
    readonly teamId: string | null;
    readonly ownerUserId: string;
    readonly title: string;
    readonly slug: string;
    readonly summary: string;
    readonly descriptionMarkdown: string;
    readonly repositoryUrl: string | null;
    readonly demoUrl: string | null;
    readonly tags: readonly string[];
    readonly status: "draft" | "published" | "archived";
    readonly publishedAt: Date | null;
    readonly createdAt: Date;
    readonly updatedAt: Date;
}

export interface PlannedProjectMember {
    readonly id: string;
    readonly projectId: string;
    readonly userId: string;
    readonly role: "owner" | "member";
    readonly createdAt: Date;
}

export interface PlannedSubmission {
    readonly id: string;
    readonly editionId: string;
    readonly projectId: string;
    readonly teamId: string | null;
    readonly status:
        | "draft"
        | "submitted"
        | "under_review"
        | "changes_requested"
        | "accepted"
        | "rejected"
        | "withdrawn"
        | "disqualified";
    readonly currentVersion: number;
    readonly submittedAt: Date | null;
    readonly reviewNote: string;
    readonly createdAt: Date;
    readonly updatedAt: Date;
}

export interface PlannedSubmissionVersion {
    readonly id: string;
    readonly submissionId: string;
    readonly version: number;
    readonly title: string;
    readonly summary: string;
    readonly descriptionMarkdown: string;
    readonly repositoryUrl: string | null;
    readonly demoUrl: string | null;
    readonly createdByUserId: string;
    readonly createdAt: Date;
}

export interface PlannedFile {
    readonly id: string;
    readonly projectId: string;
    readonly submissionId: string | null;
    readonly versionId: string | null;
    readonly fileName: string;
    readonly contentType: string;
    readonly byteSize: number;
    readonly checksumSha256: string;
    readonly storageKey: string;
    readonly status: "quarantined" | "scanning" | "approved" | "rejected" | "deleted";
    readonly rejectionReason: string | null;
    readonly uploadedByUserId: string;
    readonly createdAt: Date;
    readonly inspectedAt: Date | null;
    readonly deletedAt: Date | null;
}

export interface PlannedOrganization {
    readonly key: string;
    readonly id: string;
    readonly externalId: string;
    readonly name: string;
    readonly slug: string;
    readonly description: string;
    readonly websiteUrl: string | null;
    readonly settings: {
        readonly registrationRequiresApproval: boolean;
        readonly allowParticipantTeamCreation: boolean;
        readonly publicShowcaseEnabled: boolean;
    };
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly users: readonly PlannedUser[];
    readonly memberships: readonly PlannedMembership[];
    readonly series: readonly PlannedSeries[];
    readonly editions: readonly PlannedEdition[];
    readonly divisions: readonly PlannedDivision[];
    readonly registrations: readonly PlannedRegistration[];
    readonly teams: readonly PlannedTeam[];
    readonly teamMembers: readonly PlannedTeamMember[];
    readonly participants: readonly PlannedParticipant[];
    readonly projects: readonly PlannedProject[];
    readonly projectMembers: readonly PlannedProjectMember[];
    readonly submissions: readonly PlannedSubmission[];
    readonly submissionVersions: readonly PlannedSubmissionVersion[];
    readonly files: readonly PlannedFile[];
}

export interface MigrationPlan {
    readonly sourceSystem: string;
    readonly generatedAt: Date;
    readonly inputSha256: string;
    readonly users: readonly PlannedUser[];
    readonly organizations: readonly PlannedOrganization[];
    readonly appliedOrganizations: readonly string[];
    readonly mapIds: Readonly<Record<string, string>>;
    readonly warnings: readonly string[];
    readonly counts: MigrationCounts;
}

export interface PlanOptions {
    readonly map?: MigrationMap | null;
}

export function hashExport(input: LegacyExport): string {
    return createHash("sha256").update(canonicalJson(input)).digest("hex");
}

export function canonicalJson(value: unknown): string {
    return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map((item) => canonicalize(item));
    }
    if (value !== null && typeof value === "object") {
        const source = value as Record<string, unknown>;
        const result: Record<string, unknown> = {};
        for (const key of Object.keys(source).toSorted()) {
            result[key] = canonicalize(source[key]);
        }
        return result;
    }
    return value;
}

export function deterministicUuid(kind: string, scope: string, externalId: string): string {
    const digest = createHash("sha1")
        .update(ID_NAMESPACE)
        .update("\0")
        .update(kind)
        .update("\0")
        .update(scope)
        .update("\0")
        .update(externalId)
        .digest();
    const bytes = Buffer.from(digest.subarray(0, 16));
    bytes.writeUInt8((bytes.readUInt8(6) & 0x0f) | 0x50, 6);
    bytes.writeUInt8((bytes.readUInt8(8) & 0x3f) | 0x80, 8);
    const hex = bytes.toString("hex");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function mapKey(kind: string, scope: string, externalId: string): string {
    return `${kind}:${encodeURIComponent(scope)}:${encodeURIComponent(externalId)}`;
}

class PlanContext {
    readonly issues: string[] = [];
    readonly warnings: string[] = [];
    readonly mapIds: Record<string, string> = {};
    private readonly map: MigrationMap | null;
    private readonly idOwners = new Map<string, string>();

    constructor(map: MigrationMap | null) {
        this.map = map;
        if (map !== null) {
            const owners = new Map<string, string>();
            for (const [key, id] of Object.entries(map.ids)) {
                const owner = owners.get(id);
                if (owner !== undefined) {
                    this.issues.push(
                        `migration map: UUID ${id} is assigned to both ${owner} and ${key}.`,
                    );
                } else {
                    owners.set(id, key);
                }
            }
        }
    }

    id(kind: string, scope: string, externalId: string, path: string): string {
        const key = mapKey(kind, scope, externalId);
        const existing = this.mapIds[key];
        if (existing !== undefined) {
            return existing;
        }
        const mapped = this.map?.ids[key];
        const id = mapped ?? deterministicUuid(kind, scope, externalId);
        this.mapIds[key] = id;
        const previous = this.idOwners.get(id);
        if (previous !== undefined && previous !== key) {
            this.issues.push(`${path}: UUID ${id} is already assigned to ${previous}.`);
        } else {
            this.idOwners.set(id, key);
        }
        return id;
    }

    issue(path: string, message: string): void {
        this.issues.push(`${path}: ${message}`);
    }

    warn(message: string): void {
        this.warnings.push(message);
    }

    throwIfInvalid(): void {
        if (this.issues.length > 0) {
            throw new MigrationValidationError(this.issues);
        }
    }
}

function toDate(value: string): Date {
    return new Date(value);
}

function toNullableDate(value: string | null | undefined): Date | null {
    return value === null || value === undefined ? null : new Date(value);
}

function isValidTimeZone(value: string): boolean {
    try {
        const formatter = new Intl.DateTimeFormat("en-US", { timeZone: value });
        return formatter.resolvedOptions().timeZone.length > 0;
    } catch {
        return false;
    }
}

type MutableCounts = { -readonly [Key in keyof MigrationCounts]: MigrationCounts[Key] };

function emptyCounts(): MutableCounts {
    return {
        organizations: 0,
        users: 0,
        identities: 0,
        memberships: 0,
        series: 0,
        editions: 0,
        divisions: 0,
        registrations: 0,
        teams: 0,
        teamMembers: 0,
        participants: 0,
        projects: 0,
        projectMembers: 0,
        submissions: 0,
        submissionVersions: 0,
        files: 0,
    };
}

function buildUsers(input: LegacyExport, context: PlanContext): Map<string, PlannedUser> {
    const users = new Map<string, PlannedUser>();
    const emailOwners = new Map<string, string>();
    const identityOwners = new Map<string, string>();
    const issuerOwners = new Map<string, string>();

    input.users.forEach((user: LegacyUser, index) => {
        const path = `users[${index}]`;
        if (users.has(user.externalId)) {
            context.issue(`${path}.externalId`, `Duplicate user externalId "${user.externalId}".`);
            return;
        }

        if (user.email !== null && user.email !== undefined) {
            const emailKey = user.email.toLowerCase();
            const owner = emailOwners.get(emailKey);
            if (owner !== undefined) {
                context.issue(
                    `${path}.email`,
                    `Email is shared by users "${owner}" and "${user.externalId}". Resolve it explicitly; the migration never links by email.`,
                );
            } else {
                emailOwners.set(emailKey, user.externalId);
            }
        }

        const createdAt = toDate(user.createdAt);
        const identities: PlannedIdentity[] = [];
        user.identities.forEach((identity, identityIndex) => {
            const identityPath = `${path}.identities[${identityIndex}]`;
            const subjectKey = `${identity.issuer}\u0000${identity.subject}`;
            const identityOwner = identityOwners.get(subjectKey);
            if (identityOwner !== undefined) {
                context.issue(
                    identityPath,
                    `Identity (${identity.issuer}, ${identity.subject}) already belongs to user "${identityOwner}".`,
                );
            } else {
                identityOwners.set(subjectKey, user.externalId);
            }

            const issuerKey = `${user.externalId}\u0000${identity.issuer}`;
            if (issuerOwners.has(issuerKey)) {
                context.issue(
                    identityPath,
                    `User "${user.externalId}" has more than one identity for issuer "${identity.issuer}". The database stores one identity per issuer per user.`,
                );
            } else {
                issuerOwners.set(issuerKey, identity.subject);
            }

            const identityCreatedAt = toDate(identity.createdAt ?? user.createdAt);
            identities.push({
                id: context.id(
                    "identity",
                    "global",
                    `${identity.issuer}\u0000${identity.subject}`,
                    identityPath,
                ),
                issuer: identity.issuer,
                subject: identity.subject,
                emailAtLogin: identity.emailAtLogin ?? null,
                createdAt: identityCreatedAt,
                lastLoginAt: toDate(
                    identity.lastLoginAt ?? identity.createdAt ?? user.updatedAt ?? user.createdAt,
                ),
            });
        });

        users.set(user.externalId, {
            key: mapKey("user", "global", user.externalId),
            id: context.id("user", "global", user.externalId, path),
            externalId: user.externalId,
            displayName: user.displayName,
            email: user.email ?? null,
            locale: user.locale,
            status: user.status,
            createdAt,
            updatedAt: toDate(user.updatedAt ?? user.createdAt),
            identities,
        });
    });

    return users;
}

function requireUser(
    users: Map<string, PlannedUser>,
    externalId: string,
    path: string,
    context: PlanContext,
): PlannedUser | null {
    const user = users.get(externalId);
    if (user === undefined) {
        context.issue(path, `Unknown user externalId "${externalId}".`);
        return null;
    }
    return user;
}

interface SeriesResult {
    readonly series: PlannedSeries[];
    readonly editions: PlannedEdition[];
    readonly divisions: PlannedDivision[];
    readonly editionByExternalId: Map<string, PlannedEdition>;
    readonly divisionByExternalId: Map<string, PlannedDivision>;
}

function buildSeries(
    organization: LegacyOrganization,
    path: string,
    context: PlanContext,
): SeriesResult {
    const series: PlannedSeries[] = [];
    const editions: PlannedEdition[] = [];
    const divisions: PlannedDivision[] = [];
    const seriesIds = new Set<string>();
    const seriesSlugs = new Set<string>();
    const editionByExternalId = new Map<string, PlannedEdition>();
    const editionSlugs = new Set<string>();
    const divisionByExternalId = new Map<string, PlannedDivision>();

    organization.series.forEach((seriesInput: LegacySeries, seriesIndex) => {
        const seriesPath = `${path}.series[${seriesIndex}]`;
        if (seriesIds.has(seriesInput.externalId)) {
            context.issue(
                `${seriesPath}.externalId`,
                `Duplicate series externalId "${seriesInput.externalId}".`,
            );
            return;
        }
        if (seriesSlugs.has(seriesInput.slug)) {
            context.issue(
                `${seriesPath}.slug`,
                `Duplicate series slug "${seriesInput.slug}" in this organization.`,
            );
            return;
        }
        seriesIds.add(seriesInput.externalId);
        seriesSlugs.add(seriesInput.slug);
        const plannedSeries: PlannedSeries = {
            id: context.id("series", organization.externalId, seriesInput.externalId, seriesPath),
            name: seriesInput.name,
            slug: seriesInput.slug,
            description: seriesInput.description,
            createdAt: toDate(seriesInput.createdAt),
            updatedAt: toDate(seriesInput.updatedAt ?? seriesInput.createdAt),
        };
        series.push(plannedSeries);

        seriesInput.editions.forEach((editionInput, editionIndex) => {
            const editionPath = `${seriesPath}.editions[${editionIndex}]`;
            if (editionByExternalId.has(editionInput.externalId)) {
                context.issue(
                    `${editionPath}.externalId`,
                    `Duplicate edition externalId "${editionInput.externalId}".`,
                );
                return;
            }
            if (editionSlugs.has(editionInput.slug)) {
                context.issue(
                    `${editionPath}.slug`,
                    `Duplicate edition slug "${editionInput.slug}" in this organization.`,
                );
                return;
            }
            if (!isValidTimeZone(editionInput.timezone)) {
                context.issue(
                    `${editionPath}.timezone`,
                    `Unknown time zone "${editionInput.timezone}".`,
                );
            }
            if (editionInput.teamMinSize > editionInput.teamMaxSize) {
                context.issue(
                    `${editionPath}.teamMaxSize`,
                    "teamMaxSize must be at least teamMinSize.",
                );
            }
            editionSlugs.add(editionInput.slug);

            const plannedEdition: PlannedEdition = {
                id: context.id(
                    "edition",
                    organization.externalId,
                    editionInput.externalId,
                    editionPath,
                ),
                seriesId: plannedSeries.id,
                name: editionInput.name,
                slug: editionInput.slug,
                description: editionInput.description,
                status: editionInput.status,
                timezone: editionInput.timezone,
                registrationOpensAt: toNullableDate(editionInput.registrationOpensAt),
                registrationClosesAt: toNullableDate(editionInput.registrationClosesAt),
                startsAt: toNullableDate(editionInput.startsAt),
                endsAt: toNullableDate(editionInput.endsAt),
                teamMinSize: editionInput.teamMinSize,
                teamMaxSize: editionInput.teamMaxSize,
                maxParticipants: editionInput.maxParticipants ?? null,
                rulesMarkdown: editionInput.rulesMarkdown,
                publishedAt: toNullableDate(editionInput.publishedAt),
                createdAt: toDate(editionInput.createdAt),
                updatedAt: toDate(editionInput.updatedAt ?? editionInput.createdAt),
            };
            editionByExternalId.set(editionInput.externalId, plannedEdition);
            editions.push(plannedEdition);

            const divisionSlugs = new Set<string>();
            editionInput.divisions.forEach((divisionInput, divisionIndex) => {
                const divisionPath = `${editionPath}.divisions[${divisionIndex}]`;
                if (divisionByExternalId.has(divisionInput.externalId)) {
                    context.issue(
                        `${divisionPath}.externalId`,
                        `Duplicate division externalId "${divisionInput.externalId}".`,
                    );
                    return;
                }
                if (divisionSlugs.has(divisionInput.slug)) {
                    context.issue(
                        `${divisionPath}.slug`,
                        `Duplicate division slug "${divisionInput.slug}" in this edition.`,
                    );
                    return;
                }
                if (
                    divisionInput.minTeamSize !== null &&
                    divisionInput.minTeamSize !== undefined &&
                    divisionInput.maxTeamSize !== null &&
                    divisionInput.maxTeamSize !== undefined &&
                    divisionInput.minTeamSize > divisionInput.maxTeamSize
                ) {
                    context.issue(
                        `${divisionPath}.maxTeamSize`,
                        "maxTeamSize must be at least minTeamSize.",
                    );
                }
                divisionSlugs.add(divisionInput.slug);
                const plannedDivision: PlannedDivision = {
                    id: context.id(
                        "division",
                        organization.externalId,
                        divisionInput.externalId,
                        divisionPath,
                    ),
                    editionId: plannedEdition.id,
                    name: divisionInput.name,
                    slug: divisionInput.slug,
                    description: divisionInput.description,
                    minTeamSize: divisionInput.minTeamSize ?? null,
                    maxTeamSize: divisionInput.maxTeamSize ?? null,
                    createdAt: toDate(divisionInput.createdAt),
                };
                divisionByExternalId.set(divisionInput.externalId, plannedDivision);
                divisions.push(plannedDivision);
            });
        });
    });

    return { series, editions, divisions, editionByExternalId, divisionByExternalId };
}

function buildRegistrations(
    organization: LegacyOrganization,
    path: string,
    context: PlanContext,
    users: Map<string, PlannedUser>,
    editionByExternalId: Map<string, PlannedEdition>,
    divisionByExternalId: Map<string, PlannedDivision>,
): PlannedRegistration[] {
    const registrations: PlannedRegistration[] = [];
    const externalIds = new Set<string>();
    const naturalKeys = new Set<string>();

    organization.registrations.forEach((input, index) => {
        const registrationPath = `${path}.registrations[${index}]`;
        if (externalIds.has(input.externalId)) {
            context.issue(
                `${registrationPath}.externalId`,
                `Duplicate registration externalId "${input.externalId}".`,
            );
            return;
        }
        externalIds.add(input.externalId);

        const edition = editionByExternalId.get(input.editionExternalId);
        if (edition === undefined) {
            context.issue(
                `${registrationPath}.editionExternalId`,
                `Unknown edition "${input.editionExternalId}".`,
            );
            return;
        }
        const user = requireUser(
            users,
            input.userExternalId,
            `${registrationPath}.userExternalId`,
            context,
        );
        if (user === null) {
            return;
        }
        const naturalKey = `${input.editionExternalId}\u0000${input.userExternalId}`;
        if (naturalKeys.has(naturalKey)) {
            context.issue(
                registrationPath,
                `User "${input.userExternalId}" is registered more than once for edition "${input.editionExternalId}".`,
            );
            return;
        }
        naturalKeys.add(naturalKey);

        let divisionId: string | null = null;
        if (input.divisionExternalId !== null && input.divisionExternalId !== undefined) {
            const division = divisionByExternalId.get(input.divisionExternalId);
            if (division === undefined) {
                context.issue(
                    `${registrationPath}.divisionExternalId`,
                    `Unknown division "${input.divisionExternalId}".`,
                );
                return;
            }
            if (division.editionId !== edition.id) {
                context.issue(
                    `${registrationPath}.divisionExternalId`,
                    `Division "${input.divisionExternalId}" belongs to a different edition.`,
                );
                return;
            }
            divisionId = division.id;
        }

        registrations.push({
            id: context.id(
                "registration",
                organization.externalId,
                input.externalId,
                registrationPath,
            ),
            editionId: edition.id,
            userId: user.id,
            divisionId,
            status: input.status,
            note: input.note,
            createdAt: toDate(input.createdAt),
            updatedAt: toDate(input.updatedAt ?? input.createdAt),
            decidedAt: toNullableDate(input.decidedAt),
        });
    });

    return registrations;
}

interface TeamResult {
    readonly teams: PlannedTeam[];
    readonly teamMembers: PlannedTeamMember[];
    readonly teamByExternalId: Map<string, PlannedTeam>;
    readonly teamByEditionUser: Map<string, PlannedTeam>;
}

function buildTeams(
    organization: LegacyOrganization,
    path: string,
    context: PlanContext,
    users: Map<string, PlannedUser>,
    editionByExternalId: Map<string, PlannedEdition>,
    divisionByExternalId: Map<string, PlannedDivision>,
): TeamResult {
    const teams: PlannedTeam[] = [];
    const teamMembers: PlannedTeamMember[] = [];
    const teamByExternalId = new Map<string, PlannedTeam>();
    const teamByEditionUser = new Map<string, PlannedTeam>();
    const externalIds = new Set<string>();
    const namesByEdition = new Map<string, Set<string>>();

    organization.teams.forEach((input: LegacyTeam, index) => {
        const teamPath = `${path}.teams[${index}]`;
        if (externalIds.has(input.externalId)) {
            context.issue(
                `${teamPath}.externalId`,
                `Duplicate team externalId "${input.externalId}".`,
            );
            return;
        }
        externalIds.add(input.externalId);

        const edition = editionByExternalId.get(input.editionExternalId);
        if (edition === undefined) {
            context.issue(
                `${teamPath}.editionExternalId`,
                `Unknown edition "${input.editionExternalId}".`,
            );
            return;
        }
        const names = namesByEdition.get(input.editionExternalId) ?? new Set<string>();
        namesByEdition.set(input.editionExternalId, names);
        if (names.has(input.name)) {
            context.issue(
                `${teamPath}.name`,
                `Duplicate team name "${input.name}" in this edition.`,
            );
            return;
        }
        names.add(input.name);

        let divisionId: string | null = null;
        if (input.divisionExternalId !== null && input.divisionExternalId !== undefined) {
            const division = divisionByExternalId.get(input.divisionExternalId);
            if (division === undefined) {
                context.issue(
                    `${teamPath}.divisionExternalId`,
                    `Unknown division "${input.divisionExternalId}".`,
                );
                return;
            }
            if (division.editionId !== edition.id) {
                context.issue(
                    `${teamPath}.divisionExternalId`,
                    `Division "${input.divisionExternalId}" belongs to a different edition.`,
                );
                return;
            }
            divisionId = division.id;
        }

        const captain = requireUser(
            users,
            input.captainUserExternalId,
            `${teamPath}.captainUserExternalId`,
            context,
        );
        if (captain === null) {
            return;
        }

        const memberIds = new Set<string>();
        const members: {
            readonly user: PlannedUser;
            readonly role: "captain" | "member";
            readonly joinedAt: Date;
        }[] = [];
        let captainRoleCount = 0;
        for (const [memberIndex, member] of input.members.entries()) {
            const memberPath = `${teamPath}.members[${memberIndex}]`;
            if (memberIds.has(member.userExternalId)) {
                context.issue(
                    memberPath,
                    `User "${member.userExternalId}" appears twice on this team.`,
                );
                return;
            }
            const user = requireUser(
                users,
                member.userExternalId,
                `${memberPath}.userExternalId`,
                context,
            );
            if (user === null) {
                return;
            }
            memberIds.add(member.userExternalId);
            if (member.role === "captain") {
                captainRoleCount += 1;
                if (user.id !== captain.id) {
                    context.issue(
                        memberPath,
                        "A user other than the declared captain has the captain role.",
                    );
                    return;
                }
            }
            members.push({
                user,
                role: member.role,
                joinedAt: toDate(member.joinedAt ?? input.createdAt),
            });
        }

        if (captainRoleCount !== 1) {
            context.issue(
                `${teamPath}.members`,
                "Exactly one team member must have the captain role.",
            );
            return;
        }
        if (!memberIds.has(input.captainUserExternalId)) {
            context.issue(
                `${teamPath}.members`,
                "The declared captain must appear in the member list.",
            );
            return;
        }
        if (members.length > input.maxMembers) {
            context.issue(`${teamPath}.maxMembers`, "maxMembers is smaller than the member list.");
            return;
        }

        const teamId = context.id("team", organization.externalId, input.externalId, teamPath);
        const plannedTeam: PlannedTeam = {
            id: teamId,
            editionId: edition.id,
            divisionId,
            name: input.name,
            description: input.description,
            status: input.status,
            captainUserId: captain.id,
            maxMembers: input.maxMembers,
            createdAt: toDate(input.createdAt),
            updatedAt: toDate(input.updatedAt ?? input.createdAt),
        };
        teams.push(plannedTeam);
        teamByExternalId.set(input.externalId, plannedTeam);

        for (const member of members) {
            teamMembers.push({
                id: context.id(
                    "team-member",
                    organization.externalId,
                    `${input.externalId}\u0000${member.user.externalId}`,
                    teamPath,
                ),
                teamId,
                userId: member.user.id,
                role: member.role,
                joinedAt: member.joinedAt,
            });

            const key = `${edition.id}\u0000${member.user.id}`;
            const existing = teamByEditionUser.get(key);
            if (existing !== undefined && existing.id !== teamId) {
                context.issue(
                    `${teamPath}.members`,
                    `User "${member.user.externalId}" belongs to more than one team in edition "${input.editionExternalId}"; participant team assignment is ambiguous.`,
                );
            } else {
                teamByEditionUser.set(key, plannedTeam);
            }
        }
    });

    return { teams, teamMembers, teamByExternalId, teamByEditionUser };
}

function buildParticipants(
    registrations: PlannedRegistration[],
    teams: PlannedTeam[],
    teamMembers: PlannedTeamMember[],
    teamByEditionUser: Map<string, PlannedTeam>,
    organizationExternalId: string,
    context: PlanContext,
): PlannedParticipant[] {
    const participants: PlannedParticipant[] = [];
    const approvedKeys = new Set<string>();
    const teamById = new Map(teams.map((team) => [team.id, team] as const));

    for (const registration of registrations) {
        if (registration.status !== "approved") {
            continue;
        }
        const team =
            teamByEditionUser.get(`${registration.editionId}\u0000${registration.userId}`) ?? null;
        approvedKeys.add(`${registration.editionId}\u0000${registration.userId}`);
        if (
            team !== null &&
            registration.divisionId !== null &&
            team.divisionId !== null &&
            registration.divisionId !== team.divisionId
        ) {
            context.warn(
                `Registration ${registration.id} and team ${team.id} use different divisions; the registration division is preserved on the participant.`,
            );
        }
        participants.push({
            id: context.id(
                "participant",
                organizationExternalId,
                `${registration.editionId}\u0000${registration.userId}`,
                "participants",
            ),
            editionId: registration.editionId,
            userId: registration.userId,
            divisionId: registration.divisionId,
            teamId: team?.id ?? null,
            registeredAt: registration.createdAt,
        });
    }

    for (const member of teamMembers) {
        const team = teamById.get(member.teamId);
        if (team === undefined) {
            continue;
        }
        if (!approvedKeys.has(`${team.editionId}\u0000${member.userId}`)) {
            context.warn(
                `Team member ${member.userId} has no approved registration for edition ${team.editionId}; the team member is migrated but no participant record is created.`,
            );
        }
    }

    return participants;
}

interface ProjectResult {
    readonly projects: PlannedProject[];
    readonly projectMembers: PlannedProjectMember[];
    readonly projectByExternalId: Map<string, PlannedProject>;
}

function buildProjects(
    organization: LegacyOrganization,
    path: string,
    context: PlanContext,
    users: Map<string, PlannedUser>,
    editionByExternalId: Map<string, PlannedEdition>,
    teamByExternalId: Map<string, PlannedTeam>,
): ProjectResult {
    const projects: PlannedProject[] = [];
    const projectMembers: PlannedProjectMember[] = [];
    const projectByExternalId = new Map<string, PlannedProject>();
    const externalIds = new Set<string>();
    const slugs = new Set<string>();

    organization.projects.forEach((input: LegacyProject, index) => {
        const projectPath = `${path}.projects[${index}]`;
        if (externalIds.has(input.externalId)) {
            context.issue(
                `${projectPath}.externalId`,
                `Duplicate project externalId "${input.externalId}".`,
            );
            return;
        }
        if (slugs.has(input.slug)) {
            context.issue(
                `${projectPath}.slug`,
                `Duplicate project slug "${input.slug}" in this organization.`,
            );
            return;
        }

        const edition = editionByExternalId.get(input.editionExternalId);
        if (edition === undefined) {
            context.issue(
                `${projectPath}.editionExternalId`,
                `Unknown edition "${input.editionExternalId}".`,
            );
            return;
        }

        let team: PlannedTeam | null = null;
        if (input.teamExternalId !== null && input.teamExternalId !== undefined) {
            team = teamByExternalId.get(input.teamExternalId) ?? null;
            if (team === null) {
                context.issue(
                    `${projectPath}.teamExternalId`,
                    `Unknown team "${input.teamExternalId}".`,
                );
                return;
            }
            if (team.editionId !== edition.id) {
                context.issue(
                    `${projectPath}.teamExternalId`,
                    `Team "${input.teamExternalId}" belongs to a different edition.`,
                );
                return;
            }
        }

        const owner = requireUser(
            users,
            input.ownerUserExternalId,
            `${projectPath}.ownerUserExternalId`,
            context,
        );
        if (owner === null) {
            return;
        }

        const memberIds = new Set<string>();
        const members: {
            readonly user: PlannedUser;
            readonly role: "owner" | "member";
            readonly createdAt: Date;
        }[] = [];
        for (const [memberIndex, member] of input.members.entries()) {
            const memberPath = `${projectPath}.members[${memberIndex}]`;
            if (memberIds.has(member.userExternalId)) {
                context.issue(
                    memberPath,
                    `User "${member.userExternalId}" appears twice on this project.`,
                );
                return;
            }
            const user = requireUser(
                users,
                member.userExternalId,
                `${memberPath}.userExternalId`,
                context,
            );
            if (user === null) {
                return;
            }
            memberIds.add(member.userExternalId);
            members.push({
                user,
                role: member.role,
                createdAt: toDate(member.createdAt ?? input.createdAt),
            });
        }

        if (!memberIds.has(input.ownerUserExternalId)) {
            members.push({ user: owner, role: "owner", createdAt: toDate(input.createdAt) });
            context.warn(
                `Project "${input.slug}" did not list its owner as a member; the owner membership was derived.`,
            );
        }

        externalIds.add(input.externalId);
        slugs.add(input.slug);
        const projectId = context.id(
            "project",
            organization.externalId,
            input.externalId,
            projectPath,
        );
        const plannedProject: PlannedProject = {
            id: projectId,
            editionId: edition.id,
            teamId: team?.id ?? null,
            ownerUserId: owner.id,
            title: input.title,
            slug: input.slug,
            summary: input.summary,
            descriptionMarkdown: input.descriptionMarkdown,
            repositoryUrl: input.repositoryUrl ?? null,
            demoUrl: input.demoUrl ?? null,
            tags: input.tags,
            status: input.status,
            publishedAt: toNullableDate(input.publishedAt),
            createdAt: toDate(input.createdAt),
            updatedAt: toDate(input.updatedAt ?? input.createdAt),
        };
        projects.push(plannedProject);
        projectByExternalId.set(input.externalId, plannedProject);

        for (const member of members) {
            projectMembers.push({
                id: context.id(
                    "project-member",
                    organization.externalId,
                    `${input.externalId}\u0000${member.user.externalId}`,
                    projectPath,
                ),
                projectId,
                userId: member.user.id,
                role: member.role,
                createdAt: member.createdAt,
            });
        }
    });

    return { projects, projectMembers, projectByExternalId };
}

interface SubmissionResult {
    readonly submissions: PlannedSubmission[];
    readonly versions: PlannedSubmissionVersion[];
    readonly submissionByExternalId: Map<string, PlannedSubmission>;
    readonly versionIds: Map<string, string>;
}

function buildSubmissions(
    organization: LegacyOrganization,
    path: string,
    context: PlanContext,
    users: Map<string, PlannedUser>,
    teamByExternalId: Map<string, PlannedTeam>,
    projectByExternalId: Map<string, PlannedProject>,
): SubmissionResult {
    const submissions: PlannedSubmission[] = [];
    const versions: PlannedSubmissionVersion[] = [];
    const submissionByExternalId = new Map<string, PlannedSubmission>();
    const versionIds = new Map<string, string>();
    const externalIds = new Set<string>();
    const projectsWithSubmission = new Set<string>();

    organization.submissions.forEach((input: LegacySubmission, index) => {
        const submissionPath = `${path}.submissions[${index}]`;
        if (externalIds.has(input.externalId)) {
            context.issue(
                `${submissionPath}.externalId`,
                `Duplicate submission externalId "${input.externalId}".`,
            );
            return;
        }

        const project = projectByExternalId.get(input.projectExternalId);
        if (project === undefined) {
            context.issue(
                `${submissionPath}.projectExternalId`,
                `Unknown project "${input.projectExternalId}".`,
            );
            return;
        }
        if (projectsWithSubmission.has(input.projectExternalId)) {
            context.issue(
                submissionPath,
                `Project "${input.projectExternalId}" already has a submission; the database allows one per project.`,
            );
            return;
        }

        let teamId = project.teamId;
        if (input.teamExternalId !== null && input.teamExternalId !== undefined) {
            const team = teamByExternalId.get(input.teamExternalId);
            if (team === undefined) {
                context.issue(
                    `${submissionPath}.teamExternalId`,
                    `Unknown team "${input.teamExternalId}".`,
                );
                return;
            }
            if (project.teamId !== null && project.teamId !== team.id) {
                context.issue(
                    `${submissionPath}.teamExternalId`,
                    `Team "${input.teamExternalId}" does not match the project team.`,
                );
                return;
            }
            if (team.editionId !== project.editionId) {
                context.issue(
                    `${submissionPath}.teamExternalId`,
                    `Team "${input.teamExternalId}" belongs to a different edition.`,
                );
                return;
            }
            teamId = team.id;
        }

        const versionNumbers = new Set<number>();
        let maxVersion = 0;
        const plannedVersions: {
            readonly input: (typeof input.versions)[number];
            readonly userId: string;
        }[] = [];
        for (const [versionIndex, versionInput] of input.versions.entries()) {
            const versionPath = `${submissionPath}.versions[${versionIndex}]`;
            if (versionNumbers.has(versionInput.version)) {
                context.issue(versionPath, `Duplicate version number ${versionInput.version}.`);
                return;
            }
            const user = requireUser(
                users,
                versionInput.createdByUserExternalId,
                `${versionPath}.createdByUserExternalId`,
                context,
            );
            if (user === null) {
                return;
            }
            versionNumbers.add(versionInput.version);
            maxVersion = Math.max(maxVersion, versionInput.version);
            plannedVersions.push({ input: versionInput, userId: user.id });
        }

        if (input.status !== "draft") {
            if (plannedVersions.length === 0) {
                context.issue(
                    submissionPath,
                    "A non-draft submission requires at least one version.",
                );
                return;
            }
            if (input.submittedAt === null || input.submittedAt === undefined) {
                context.issue(submissionPath, "A non-draft submission requires submittedAt.");
                return;
            }
        }
        if (
            input.status === "draft" &&
            input.submittedAt !== null &&
            input.submittedAt !== undefined
        ) {
            context.issue(submissionPath, "A draft submission must not have submittedAt.");
            return;
        }

        externalIds.add(input.externalId);
        projectsWithSubmission.add(input.projectExternalId);
        const submissionId = context.id(
            "submission",
            organization.externalId,
            input.externalId,
            submissionPath,
        );
        const plannedSubmission: PlannedSubmission = {
            id: submissionId,
            editionId: project.editionId,
            projectId: project.id,
            teamId,
            status: input.status,
            currentVersion: maxVersion,
            submittedAt: toNullableDate(input.submittedAt),
            reviewNote: input.reviewNote,
            createdAt: toDate(input.createdAt),
            updatedAt: toDate(input.updatedAt ?? input.createdAt),
        };
        submissions.push(plannedSubmission);
        submissionByExternalId.set(input.externalId, plannedSubmission);

        for (const version of plannedVersions) {
            const versionId = context.id(
                "submission-version",
                organization.externalId,
                `${input.externalId}\u0000${version.input.version}`,
                submissionPath,
            );
            versionIds.set(`${input.externalId}\u0000${version.input.version}`, versionId);
            versions.push({
                id: versionId,
                submissionId,
                version: version.input.version,
                title: version.input.title,
                summary: version.input.summary,
                descriptionMarkdown: version.input.descriptionMarkdown,
                repositoryUrl: version.input.repositoryUrl ?? null,
                demoUrl: version.input.demoUrl ?? null,
                createdByUserId: version.userId,
                createdAt: toDate(version.input.createdAt),
            });
        }
    });

    return { submissions, versions, submissionByExternalId, versionIds };
}

function buildFiles(
    organization: LegacyOrganization,
    path: string,
    context: PlanContext,
    users: Map<string, PlannedUser>,
    projectByExternalId: Map<string, PlannedProject>,
    submissionByExternalId: Map<string, PlannedSubmission>,
    versionIds: Map<string, string>,
    storageKeys: Set<string>,
): PlannedFile[] {
    const files: PlannedFile[] = [];
    const externalIds = new Set<string>();

    organization.files.forEach((input: LegacyFile, index) => {
        const filePath = `${path}.files[${index}]`;
        if (externalIds.has(input.externalId)) {
            context.issue(
                `${filePath}.externalId`,
                `Duplicate file externalId "${input.externalId}".`,
            );
            return;
        }

        if (storageKeys.has(input.storageKey)) {
            context.issue(
                `${filePath}.storageKey`,
                `Duplicate storage key "${input.storageKey}" in this export.`,
            );
            return;
        }

        const project = projectByExternalId.get(input.projectExternalId);
        if (project === undefined) {
            context.issue(
                `${filePath}.projectExternalId`,
                `Unknown project "${input.projectExternalId}".`,
            );
            return;
        }

        let submissionId: string | null = null;
        let versionId: string | null = null;
        if (input.submissionExternalId !== null && input.submissionExternalId !== undefined) {
            const submission = submissionByExternalId.get(input.submissionExternalId);
            if (submission === undefined) {
                context.issue(
                    `${filePath}.submissionExternalId`,
                    `Unknown submission "${input.submissionExternalId}".`,
                );
                return;
            }
            if (submission.projectId !== project.id) {
                context.issue(
                    `${filePath}.submissionExternalId`,
                    `Submission "${input.submissionExternalId}" belongs to a different project.`,
                );
                return;
            }
            if (input.version === null || input.version === undefined) {
                context.issue(
                    `${filePath}.version`,
                    "A submission file requires a version number.",
                );
                return;
            }
            const resolvedVersionId = versionIds.get(
                `${input.submissionExternalId}\u0000${input.version}`,
            );
            if (resolvedVersionId === undefined) {
                context.issue(
                    `${filePath}.version`,
                    `Submission "${input.submissionExternalId}" has no version ${input.version}.`,
                );
                return;
            }
            submissionId = submission.id;
            versionId = resolvedVersionId;
        } else if (input.version !== null && input.version !== undefined) {
            context.issue(
                `${filePath}.version`,
                "A version number requires a submissionExternalId.",
            );
            return;
        }

        const uploader = requireUser(
            users,
            input.uploadedByUserExternalId,
            `${filePath}.uploadedByUserExternalId`,
            context,
        );
        if (uploader === null) {
            return;
        }

        if (
            input.status === "approved" &&
            (input.inspectedAt === null || input.inspectedAt === undefined)
        ) {
            context.warn(
                `File "${input.externalId}" is marked approved without inspectedAt; confirm the blob was scanned before relying on it.`,
            );
        }

        externalIds.add(input.externalId);
        storageKeys.add(input.storageKey);
        files.push({
            id: context.id("file", organization.externalId, input.externalId, filePath),
            projectId: project.id,
            submissionId,
            versionId,
            fileName: input.fileName,
            contentType: input.contentType,
            byteSize: input.byteSize,
            checksumSha256: input.checksumSha256.toLowerCase(),
            storageKey: input.storageKey,
            status: input.status,
            rejectionReason: input.rejectionReason ?? null,
            uploadedByUserId: uploader.id,
            createdAt: toDate(input.createdAt),
            inspectedAt: toNullableDate(input.inspectedAt),
            deletedAt: toNullableDate(input.deletedAt),
        });
    });

    return files;
}

export function planMigration(input: LegacyExport, options: PlanOptions = {}): MigrationPlan {
    const inputSha256 = hashExport(input);
    const map = options.map ?? null;
    if (map !== null) {
        if (map.sourceSystem !== input.sourceSystem) {
            throw new MigrationValidationError([
                `migration map: sourceSystem "${map.sourceSystem}" does not match export sourceSystem "${input.sourceSystem}".`,
            ]);
        }
        if (map.inputSha256 !== inputSha256) {
            throw new MigrationValidationError([
                "migration map: inputSha256 does not match this export. Use a map produced from the same input or start a new map after resolving the difference.",
            ]);
        }
        for (const organizationExternalId of map.appliedOrganizations) {
            if (
                !input.organizations.some(
                    (organization) => organization.externalId === organizationExternalId,
                )
            ) {
                throw new MigrationValidationError([
                    `migration map: applied organization "${organizationExternalId}" is not present in this export.`,
                ]);
            }
        }
    }

    const context = new PlanContext(map);
    const users = buildUsers(input, context);
    const organizations: PlannedOrganization[] = [];
    const referencedUsers = new Set<string>();
    const organizationExternalIds = new Set<string>();
    const organizationSlugs = new Set<string>();
    const storageKeys = new Set<string>();
    const counts = emptyCounts();

    input.organizations.forEach((organization, organizationIndex) => {
        const path = `organizations[${organizationIndex}]`;
        if (organizationExternalIds.has(organization.externalId)) {
            context.issue(
                `${path}.externalId`,
                `Duplicate organization externalId "${organization.externalId}".`,
            );
            return;
        }
        if (organizationSlugs.has(organization.slug)) {
            context.issue(`${path}.slug`, `Duplicate organization slug "${organization.slug}".`);
            return;
        }
        organizationExternalIds.add(organization.externalId);
        organizationSlugs.add(organization.slug);

        const organizationId = context.id("organization", "global", organization.externalId, path);

        const membershipUsers = new Set<string>();
        let activeOwners = 0;
        const memberships: PlannedMembership[] = [];
        organization.memberships.forEach((membership, membershipIndex) => {
            const membershipPath = `${path}.memberships[${membershipIndex}]`;
            if (membershipUsers.has(membership.userExternalId)) {
                context.issue(
                    membershipPath,
                    `User "${membership.userExternalId}" has more than one membership.`,
                );
                return;
            }
            const user = requireUser(
                users,
                membership.userExternalId,
                `${membershipPath}.userExternalId`,
                context,
            );
            if (user === null) {
                return;
            }
            membershipUsers.add(membership.userExternalId);
            if (membership.role === "owner" && membership.status === "active") {
                activeOwners += 1;
            }
            memberships.push({
                id: context.id(
                    "membership",
                    organization.externalId,
                    membership.externalId,
                    membershipPath,
                ),
                userId: user.id,
                role: membership.role,
                status: membership.status,
                createdAt: toDate(membership.createdAt),
                updatedAt: toDate(membership.updatedAt ?? membership.createdAt),
            });
        });
        if (activeOwners === 0) {
            context.issue(
                `${path}.memberships`,
                "At least one active owner membership is required.",
            );
        }

        const { series, editions, divisions, editionByExternalId, divisionByExternalId } =
            buildSeries(organization, path, context);

        const registrations = buildRegistrations(
            organization,
            path,
            context,
            users,
            editionByExternalId,
            divisionByExternalId,
        );

        const { teams, teamMembers, teamByExternalId, teamByEditionUser } = buildTeams(
            organization,
            path,
            context,
            users,
            editionByExternalId,
            divisionByExternalId,
        );

        const participants = buildParticipants(
            registrations,
            teams,
            teamMembers,
            teamByEditionUser,
            organization.externalId,
            context,
        );

        const { projects, projectMembers, projectByExternalId } = buildProjects(
            organization,
            path,
            context,
            users,
            editionByExternalId,
            teamByExternalId,
        );

        const { submissions, versions, submissionByExternalId, versionIds } = buildSubmissions(
            organization,
            path,
            context,
            users,
            teamByExternalId,
            projectByExternalId,
        );

        const files = buildFiles(
            organization,
            path,
            context,
            users,
            projectByExternalId,
            submissionByExternalId,
            versionIds,
            storageKeys,
        );

        const organizationUserIds = new Set<string>();
        for (const membership of memberships) {
            organizationUserIds.add(membership.userId);
        }
        for (const registration of registrations) {
            organizationUserIds.add(registration.userId);
        }
        for (const teamMember of teamMembers) {
            organizationUserIds.add(teamMember.userId);
        }
        for (const projectMember of projectMembers) {
            organizationUserIds.add(projectMember.userId);
        }
        for (const version of versions) {
            organizationUserIds.add(version.createdByUserId);
        }
        for (const file of files) {
            organizationUserIds.add(file.uploadedByUserId);
        }

        const organizationUsers = Array.from(users.values()).filter((user) =>
            organizationUserIds.has(user.id),
        );
        for (const user of organizationUsers) {
            referencedUsers.add(user.externalId);
        }

        organizations.push({
            key: mapKey("organization", "global", organization.externalId),
            id: organizationId,
            externalId: organization.externalId,
            name: organization.name,
            slug: organization.slug,
            description: organization.description,
            websiteUrl: organization.websiteUrl ?? null,
            settings: {
                registrationRequiresApproval:
                    organization.settings?.registrationRequiresApproval ?? true,
                allowParticipantTeamCreation:
                    organization.settings?.allowParticipantTeamCreation ?? true,
                publicShowcaseEnabled: organization.settings?.publicShowcaseEnabled ?? true,
            },
            createdAt: toDate(organization.createdAt),
            updatedAt: toDate(organization.updatedAt ?? organization.createdAt),
            users: organizationUsers,
            memberships,
            series,
            editions,
            divisions,
            registrations,
            teams,
            teamMembers,
            participants,
            projects,
            projectMembers,
            submissions,
            submissionVersions: versions,
            files,
        });

        counts.organizations += 1;
        counts.memberships += memberships.length;
        counts.series += series.length;
        counts.editions += editions.length;
        counts.divisions += divisions.length;
        counts.registrations += registrations.length;
        counts.teams += teams.length;
        counts.teamMembers += teamMembers.length;
        counts.participants += participants.length;
        counts.projects += projects.length;
        counts.projectMembers += projectMembers.length;
        counts.submissions += submissions.length;
        counts.submissionVersions += versions.length;
        counts.files += files.length;
    });

    context.throwIfInvalid();

    const plannedUsers = input.users
        .filter((user) => referencedUsers.has(user.externalId))
        .map((user) => users.get(user.externalId))
        .filter((user): user is PlannedUser => user !== undefined);
    const unusedUsers = input.users
        .filter((user) => !referencedUsers.has(user.externalId))
        .map((user) => user.externalId);

    for (const externalId of unusedUsers) {
        context.warn(
            `User "${externalId}" is exported but not referenced by any organization; it was not migrated because global users are written inside organization transactions.`,
        );
    }
    if (counts.files > 0) {
        context.warn(
            "File rows are metadata only. File bytes are not copied by this tool; stage the blobs under the recorded storage keys and verify their checksums before marking them approved.",
        );
    }

    const countsWithUsers: MigrationCounts = {
        ...counts,
        users: plannedUsers.length,
        identities: plannedUsers.reduce((total, user) => total + user.identities.length, 0),
    };

    return {
        sourceSystem: input.sourceSystem,
        generatedAt: toDate(input.generatedAt),
        inputSha256,
        users: plannedUsers,
        organizations,
        appliedOrganizations: map?.appliedOrganizations ?? [],
        mapIds: context.mapIds,
        warnings: context.warnings,
        counts: countsWithUsers,
    };
}
