import { z } from "zod";
import { emailSchema, idSchema, isoDateTimeSchema } from "../common/schemas.js";

export const teamStatusSchema = z.enum(["forming", "ready", "disbanded"]);
export type TeamStatus = z.infer<typeof teamStatusSchema>;

export const teamRoleSchema = z.enum(["captain", "member"]);
export type TeamRole = z.infer<typeof teamRoleSchema>;

export const teamSchema = z.object({
    id: idSchema,
    organizationId: idSchema,
    editionId: idSchema,
    divisionId: idSchema.nullable(),
    name: z.string(),
    description: z.string(),
    status: teamStatusSchema,
    captainUserId: idSchema,
    memberCount: z.number().int().nonnegative(),
    maxMembers: z.number().int().min(1),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
});
export type Team = z.infer<typeof teamSchema>;

export const teamDetailSchema = teamSchema.extend({
    members: z.array(
        z.object({
            userId: idSchema,
            displayName: z.string(),
            role: teamRoleSchema,
            joinedAt: isoDateTimeSchema,
        }),
    ),
    invitations: z.array(
        z.object({
            id: idSchema,
            email: emailSchema,
            status: z.enum(["pending", "accepted", "declined", "revoked", "expired"]),
            expiresAt: isoDateTimeSchema,
            createdAt: isoDateTimeSchema,
        }),
    ),
    project: z
        .object({
            id: idSchema,
            title: z.string(),
            status: z.enum(["draft", "published", "archived"]),
        })
        .nullable(),
});
export type TeamDetail = z.infer<typeof teamDetailSchema>;

export const createTeamRequestSchema = z
    .object({
        editionId: idSchema,
        divisionId: idSchema.nullable().default(null),
        name: z.string().trim().min(2).max(80),
        description: z.string().max(2000).default(""),
    })
    .strict();
export type CreateTeamRequest = z.infer<typeof createTeamRequestSchema>;

export const updateTeamRequestSchema = z
    .object({
        name: z.string().trim().min(2).max(80).optional(),
        description: z.string().max(2000).optional(),
        status: teamStatusSchema.optional(),
        divisionId: idSchema.nullable().optional(),
    })
    .strict();
export type UpdateTeamRequest = z.infer<typeof updateTeamRequestSchema>;

export const inviteTeamMemberRequestSchema = z
    .object({
        email: emailSchema,
    })
    .strict();
export type InviteTeamMemberRequest = z.infer<typeof inviteTeamMemberRequestSchema>;

export const updateTeamMemberRoleRequestSchema = z
    .object({
        role: z.literal("captain"),
    })
    .strict();
export type UpdateTeamMemberRoleRequest = z.infer<typeof updateTeamMemberRoleRequestSchema>;

export const teamInvitationAcceptanceSchema = z.object({
    teamId: idSchema,
    teamName: z.string(),
    acceptedAt: isoDateTimeSchema,
});
export type TeamInvitationAcceptance = z.infer<typeof teamInvitationAcceptanceSchema>;
