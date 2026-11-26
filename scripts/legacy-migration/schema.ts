import { z } from "zod";

const externalIdSchema = z.string().trim().min(1).max(200);
const slugSchema = z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens.");
const timestampSchema = z.iso.datetime({ offset: true });
const emailSchema = z.email().max(254);
const httpUrlSchema = z
    .url()
    .max(2048)
    .refine((value) => {
        const protocol = new URL(value).protocol;
        return protocol === "http:" || protocol === "https:";
    }, "Use an http or https URL.");
const textSchema = z.string().max(20_000);
const markdownSchema = z.string().max(200_000);

export const organizationRoleSchema = z.enum(["owner", "organizer", "judge", "participant"]);
export const membershipStatusSchema = z.enum(["active", "suspended"]);
export const editionStatusSchema = z.enum([
    "draft",
    "published",
    "registration_open",
    "registration_closed",
    "active",
    "judging",
    "voting",
    "completed",
    "archived",
]);
export const registrationStatusSchema = z.enum([
    "pending",
    "approved",
    "rejected",
    "withdrawn",
    "waitlisted",
]);
export const teamStatusSchema = z.enum(["forming", "ready", "disbanded"]);
export const teamMemberRoleSchema = z.enum(["captain", "member"]);
export const projectStatusSchema = z.enum(["draft", "published", "archived"]);
export const projectMemberRoleSchema = z.enum(["owner", "member"]);
export const submissionStatusSchema = z.enum([
    "draft",
    "submitted",
    "under_review",
    "changes_requested",
    "accepted",
    "rejected",
    "withdrawn",
    "disqualified",
]);
export const fileStatusSchema = z.enum([
    "quarantined",
    "scanning",
    "approved",
    "rejected",
    "deleted",
]);
export const userStatusSchema = z.enum(["active", "disabled"]);

export const legacyIdentitySchema = z.strictObject({
    issuer: z.string().trim().min(1).max(512),
    subject: z.string().trim().min(1).max(512),
    emailAtLogin: emailSchema.nullable().optional(),
    createdAt: timestampSchema.optional(),
    lastLoginAt: timestampSchema.optional(),
});
export type LegacyIdentity = z.output<typeof legacyIdentitySchema>;

export const legacyUserSchema = z.strictObject({
    externalId: externalIdSchema,
    displayName: z.string().trim().min(1).max(120),
    email: emailSchema.nullable().optional(),
    locale: z.string().trim().min(1).max(16).default("en"),
    status: userStatusSchema.default("active"),
    createdAt: timestampSchema,
    updatedAt: timestampSchema.optional(),
    identities: z.array(legacyIdentitySchema).min(1),
});
export type LegacyUser = z.output<typeof legacyUserSchema>;

export const legacyOrganizationSettingsSchema = z.strictObject({
    registrationRequiresApproval: z.boolean().default(true),
    allowParticipantTeamCreation: z.boolean().default(true),
    publicShowcaseEnabled: z.boolean().default(true),
});
export type LegacyOrganizationSettings = z.output<typeof legacyOrganizationSettingsSchema>;

export const legacyMembershipSchema = z.strictObject({
    externalId: externalIdSchema,
    userExternalId: externalIdSchema,
    role: organizationRoleSchema,
    status: membershipStatusSchema.default("active"),
    createdAt: timestampSchema,
    updatedAt: timestampSchema.optional(),
});
export type LegacyMembership = z.output<typeof legacyMembershipSchema>;

export const legacyDivisionSchema = z.strictObject({
    externalId: externalIdSchema,
    name: z.string().trim().min(1).max(160),
    slug: slugSchema,
    description: textSchema.default(""),
    minTeamSize: z.number().int().min(1).nullable().optional(),
    maxTeamSize: z.number().int().min(1).nullable().optional(),
    createdAt: timestampSchema,
});
export type LegacyDivision = z.output<typeof legacyDivisionSchema>;

export const legacyEditionSchema = z.strictObject({
    externalId: externalIdSchema,
    name: z.string().trim().min(1).max(200),
    slug: slugSchema,
    description: textSchema.default(""),
    status: editionStatusSchema.default("draft"),
    timezone: z.string().trim().min(1).max(64).default("UTC"),
    registrationOpensAt: timestampSchema.nullable().optional(),
    registrationClosesAt: timestampSchema.nullable().optional(),
    startsAt: timestampSchema.nullable().optional(),
    endsAt: timestampSchema.nullable().optional(),
    teamMinSize: z.number().int().min(1).default(1),
    teamMaxSize: z.number().int().min(1).default(4),
    maxParticipants: z.number().int().min(1).nullable().optional(),
    rulesMarkdown: markdownSchema.default(""),
    publishedAt: timestampSchema.nullable().optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema.optional(),
    divisions: z.array(legacyDivisionSchema).default([]),
});
export type LegacyEdition = z.output<typeof legacyEditionSchema>;

export const legacySeriesSchema = z.strictObject({
    externalId: externalIdSchema,
    name: z.string().trim().min(1).max(200),
    slug: slugSchema,
    description: textSchema.default(""),
    createdAt: timestampSchema,
    updatedAt: timestampSchema.optional(),
    editions: z.array(legacyEditionSchema).default([]),
});
export type LegacySeries = z.output<typeof legacySeriesSchema>;

export const legacyRegistrationSchema = z.strictObject({
    externalId: externalIdSchema,
    editionExternalId: externalIdSchema,
    userExternalId: externalIdSchema,
    divisionExternalId: externalIdSchema.nullable().optional(),
    status: registrationStatusSchema.default("pending"),
    note: textSchema.default(""),
    createdAt: timestampSchema,
    updatedAt: timestampSchema.optional(),
    decidedAt: timestampSchema.nullable().optional(),
});
export type LegacyRegistration = z.output<typeof legacyRegistrationSchema>;

export const legacyTeamMemberSchema = z.strictObject({
    userExternalId: externalIdSchema,
    role: teamMemberRoleSchema.default("member"),
    joinedAt: timestampSchema.optional(),
});
export type LegacyTeamMember = z.output<typeof legacyTeamMemberSchema>;

export const legacyTeamSchema = z.strictObject({
    externalId: externalIdSchema,
    editionExternalId: externalIdSchema,
    divisionExternalId: externalIdSchema.nullable().optional(),
    name: z.string().trim().min(1).max(120),
    description: textSchema.default(""),
    status: teamStatusSchema.default("forming"),
    captainUserExternalId: externalIdSchema,
    maxMembers: z.number().int().min(1).max(100).default(4),
    createdAt: timestampSchema,
    updatedAt: timestampSchema.optional(),
    members: z.array(legacyTeamMemberSchema).min(1),
});
export type LegacyTeam = z.output<typeof legacyTeamSchema>;

export const legacyProjectMemberSchema = z.strictObject({
    userExternalId: externalIdSchema,
    role: projectMemberRoleSchema.default("member"),
    createdAt: timestampSchema.optional(),
});
export type LegacyProjectMember = z.output<typeof legacyProjectMemberSchema>;

export const legacyProjectSchema = z.strictObject({
    externalId: externalIdSchema,
    editionExternalId: externalIdSchema,
    teamExternalId: externalIdSchema.nullable().optional(),
    ownerUserExternalId: externalIdSchema,
    title: z.string().trim().min(1).max(200),
    slug: slugSchema,
    summary: z.string().trim().min(1).max(500),
    descriptionMarkdown: markdownSchema.default(""),
    repositoryUrl: httpUrlSchema.nullable().optional(),
    demoUrl: httpUrlSchema.nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    status: projectStatusSchema.default("draft"),
    publishedAt: timestampSchema.nullable().optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema.optional(),
    members: z.array(legacyProjectMemberSchema).default([]),
});
export type LegacyProject = z.output<typeof legacyProjectSchema>;

export const legacySubmissionVersionSchema = z.strictObject({
    version: z.number().int().min(1),
    title: z.string().trim().min(1).max(200),
    summary: z.string().trim().min(1).max(500),
    descriptionMarkdown: markdownSchema.default(""),
    repositoryUrl: httpUrlSchema.nullable().optional(),
    demoUrl: httpUrlSchema.nullable().optional(),
    createdByUserExternalId: externalIdSchema,
    createdAt: timestampSchema,
});
export type LegacySubmissionVersion = z.output<typeof legacySubmissionVersionSchema>;

export const legacySubmissionSchema = z.strictObject({
    externalId: externalIdSchema,
    projectExternalId: externalIdSchema,
    teamExternalId: externalIdSchema.nullable().optional(),
    status: submissionStatusSchema.default("draft"),
    submittedAt: timestampSchema.nullable().optional(),
    reviewNote: textSchema.default(""),
    createdAt: timestampSchema,
    updatedAt: timestampSchema.optional(),
    versions: z.array(legacySubmissionVersionSchema).default([]),
});
export type LegacySubmission = z.output<typeof legacySubmissionSchema>;

export const legacyFileSchema = z.strictObject({
    externalId: externalIdSchema,
    projectExternalId: externalIdSchema,
    submissionExternalId: externalIdSchema.nullable().optional(),
    version: z.number().int().min(1).nullable().optional(),
    fileName: z.string().trim().min(1).max(255),
    contentType: z.string().trim().min(1).max(255),
    byteSize: z.number().int().min(0),
    checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i, "Use a 64-character SHA-256 hex digest."),
    storageKey: z.string().trim().min(1).max(1024),
    status: fileStatusSchema.default("quarantined"),
    rejectionReason: textSchema.nullable().optional(),
    uploadedByUserExternalId: externalIdSchema,
    createdAt: timestampSchema,
    inspectedAt: timestampSchema.nullable().optional(),
    deletedAt: timestampSchema.nullable().optional(),
});
export type LegacyFile = z.output<typeof legacyFileSchema>;

export const legacyOrganizationSchema = z.strictObject({
    externalId: externalIdSchema,
    name: z.string().trim().min(1).max(200),
    slug: slugSchema,
    description: textSchema.default(""),
    websiteUrl: httpUrlSchema.nullable().optional(),
    settings: legacyOrganizationSettingsSchema.optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema.optional(),
    memberships: z.array(legacyMembershipSchema).default([]),
    series: z.array(legacySeriesSchema).default([]),
    registrations: z.array(legacyRegistrationSchema).default([]),
    teams: z.array(legacyTeamSchema).default([]),
    projects: z.array(legacyProjectSchema).default([]),
    submissions: z.array(legacySubmissionSchema).default([]),
    files: z.array(legacyFileSchema).default([]),
});
export type LegacyOrganization = z.output<typeof legacyOrganizationSchema>;

export const legacyExportSchema = z.strictObject({
    format: z.literal("nethack-legacy-export/1"),
    sourceSystem: z.string().trim().min(1).max(120),
    generatedAt: timestampSchema,
    users: z.array(legacyUserSchema).default([]),
    organizations: z.array(legacyOrganizationSchema).min(1),
});
export type LegacyExport = z.output<typeof legacyExportSchema>;

export const migrationMapSchema = z.strictObject({
    format: z.literal("nethack-legacy-migration-map/1"),
    sourceSystem: z.string().trim().min(1),
    inputSha256: z.string().regex(/^[a-f0-9]{64}$/),
    updatedAt: timestampSchema,
    appliedOrganizations: z.array(z.string().trim().min(1)),
    ids: z.record(z.string().trim().min(1), z.uuid()),
});
export type MigrationMap = z.output<typeof migrationMapSchema>;

export function formatSchemaIssues(error: z.ZodError): string[] {
    return error.issues.map((issue) => {
        const path = issue.path.length === 0 ? "(root)" : issue.path.join(".");
        return `${path}: ${issue.message}`;
    });
}
