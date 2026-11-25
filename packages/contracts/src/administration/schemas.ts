import { z } from "zod";
import { reportSummarySchema } from "../common/schemas.js";

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

export { reportSummarySchema };
