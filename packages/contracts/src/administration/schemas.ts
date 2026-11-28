import { z } from "zod";
import {
    emailSchema,
    idSchema,
    isoDateTimeSchema,
    membershipStatusSchema,
    organizationRoleSchema,
    reportSummarySchema,
} from "../common/schemas.js";
import { submissionStatusSchema } from "../submissions/schemas.js";
import { teamRoleSchema, teamStatusSchema } from "../teams/schemas.js";

export const grantGlobalAdministratorRequestSchema = z
    .object({
        email: z.email(),
        reason: z.string().trim().min(5).max(500),
    })
    .strict();
export type GrantGlobalAdministratorRequest = z.infer<typeof grantGlobalAdministratorRequestSchema>;

export const revokeGlobalAdministratorRequestSchema = z
    .object({
        reason: z.string().trim().min(5).max(500),
    })
    .strict();
export type RevokeGlobalAdministratorRequest = z.infer<
    typeof revokeGlobalAdministratorRequestSchema
>;

export const globalAdministratorSchema = z.object({
    userId: z.uuid(),
    displayName: z.string(),
    email: z.email().nullable(),
    grantedAt: z.iso.datetime({ offset: true }),
    grantedByUserId: z.uuid().nullable(),
});
export type GlobalAdministrator = z.infer<typeof globalAdministratorSchema>;

export const organizationSettingsSchema = z.object({
    organizationId: z.uuid(),
    registrationRequiresApproval: z.boolean(),
    allowParticipantTeamCreation: z.boolean(),
    publicShowcaseEnabled: z.boolean(),
    updatedAt: z.iso.datetime({ offset: true }),
});
export type OrganizationSettings = z.infer<typeof organizationSettingsSchema>;

export const updateOrganizationSettingsRequestSchema = z
    .object({
        registrationRequiresApproval: z.boolean().optional(),
        allowParticipantTeamCreation: z.boolean().optional(),
        publicShowcaseEnabled: z.boolean().optional(),
    })
    .strict();
export type UpdateOrganizationSettingsRequest = z.infer<
    typeof updateOrganizationSettingsRequestSchema
>;

export const auditQuerySchema = z.object({
    cursor: z.string().max(512).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    action: z.string().max(120).optional(),
    entityType: z.string().max(80).optional(),
    actorUserId: z.uuid().optional(),
});

export const administrationAuditQuerySchema = auditQuerySchema.extend({
    organizationId: z.uuid(),
});
export type AdministrationAuditQuery = z.infer<typeof administrationAuditQuerySchema>;

export const globalAdministrationAuditQuerySchema = auditQuerySchema.extend({
    organizationId: z.uuid().optional(),
});
export type GlobalAdministrationAuditQuery = z.infer<typeof globalAdministrationAuditQuerySchema>;

/** An organization member as seen by the administrator user table. */
export const administrationUserSchema = z.object({
    userId: idSchema,
    displayName: z.string(),
    email: emailSchema.nullable(),
    role: organizationRoleSchema,
    status: membershipStatusSchema,
    isJudge: z.boolean(),
    isGlobalAdministrator: z.boolean(),
    joinedAt: isoDateTimeSchema,
});
export type AdministrationUser = z.infer<typeof administrationUserSchema>;

export const updateAdministrationUserRequestSchema = z
    .object({
        role: organizationRoleSchema,
    })
    .strict();
export type UpdateAdministrationUserRequest = z.infer<typeof updateAdministrationUserRequestSchema>;

export const administrationTeamMemberSchema = z.object({
    userId: idSchema,
    displayName: z.string(),
    role: teamRoleSchema,
    joinedAt: isoDateTimeSchema,
});
export type AdministrationTeamMember = z.infer<typeof administrationTeamMemberSchema>;

export const administrationTeamSubmissionSchema = z.object({
    id: idSchema,
    projectTitle: z.string(),
    status: submissionStatusSchema,
});
export type AdministrationTeamSubmission = z.infer<typeof administrationTeamSubmissionSchema>;

export const administrationTeamSchema = z.object({
    id: idSchema,
    editionId: idSchema,
    name: z.string(),
    description: z.string(),
    status: teamStatusSchema,
    divisionId: idSchema.nullable(),
    captainUserId: idSchema,
    memberCount: z.number().int().nonnegative(),
    maxMembers: z.number().int().min(1),
    members: z.array(administrationTeamMemberSchema),
    submissions: z.array(administrationTeamSubmissionSchema),
});
export type AdministrationTeam = z.infer<typeof administrationTeamSchema>;

export const updateAdministrationTeamRequestSchema = z
    .object({
        status: teamStatusSchema,
    })
    .strict();
export type UpdateAdministrationTeamRequest = z.infer<typeof updateAdministrationTeamRequestSchema>;

/**
 * Reopening moves a submitted submission back to an editable status. Draft is
 * the default; changes_requested keeps the review trail while allowing edits.
 */
export const reopenAdministrationSubmissionRequestSchema = z
    .object({
        status: z.enum(["draft", "changes_requested"]).default("draft"),
    })
    .strict();
export type ReopenAdministrationSubmissionRequest = z.infer<
    typeof reopenAdministrationSubmissionRequestSchema
>;

export const administrationPreflightSchema = z.object({
    editionId: idSchema,
    teams: z.number().int().nonnegative(),
    projects: z.number().int().nonnegative(),
    submissions: z.number().int().nonnegative(),
    assignments: z.number().int().nonnegative(),
    submittedEvaluations: z.number().int().nonnegative(),
    openFlags: z.number().int().nonnegative(),
    publishedResults: z.boolean(),
    readiness: z.object({
        hasTeams: z.boolean(),
        hasSubmissions: z.boolean(),
        hasAssignments: z.boolean(),
        hasSubmittedEvaluations: z.boolean(),
    }),
});
export type AdministrationPreflight = z.infer<typeof administrationPreflightSchema>;

export { reportSummarySchema };
