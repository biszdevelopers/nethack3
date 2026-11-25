import { z } from "zod";
import {
    emailSchema,
    httpUrlSchema,
    idSchema,
    isoDateTimeSchema,
    membershipStatusSchema,
    organizationRoleSchema,
    slugSchema,
} from "../common/schemas.js";

export const createOrganizationRequestSchema = z
    .object({
        name: z.string().trim().min(2).max(120),
        slug: slugSchema,
        description: z.string().max(2000).default(""),
        websiteUrl: httpUrlSchema.nullable().default(null),
    })
    .strict();
export type CreateOrganizationRequest = z.infer<typeof createOrganizationRequestSchema>;

export const updateOrganizationRequestSchema = z
    .object({
        name: z.string().trim().min(2).max(120).optional(),
        description: z.string().max(2000).optional(),
        websiteUrl: httpUrlSchema.nullable().optional(),
    })
    .strict();
export type UpdateOrganizationRequest = z.infer<typeof updateOrganizationRequestSchema>;

export const addOrganizationMemberRequestSchema = z
    .object({
        email: emailSchema,
        role: organizationRoleSchema.optional(),
    })
    .strict();
export type AddOrganizationMemberRequest = z.infer<typeof addOrganizationMemberRequestSchema>;

export const updateOrganizationMemberRequestSchema = z
    .object({
        role: organizationRoleSchema.optional(),
        status: membershipStatusSchema.optional(),
    })
    .strict()
    .refine((value) => value.role !== undefined || value.status !== undefined, {
        message: "Provide a role or a status.",
    });
export type UpdateOrganizationMemberRequest = z.infer<
    typeof updateOrganizationMemberRequestSchema
>;

export const acceptOrganizationInvitationRequestSchema = z
    .object({
        token: z.string().min(32).max(256),
    })
    .strict();
export type AcceptOrganizationInvitationRequest = z.infer<
    typeof acceptOrganizationInvitationRequestSchema
>;

export const organizationInvitationSchema = z.object({
    id: idSchema,
    organizationId: idSchema,
    email: emailSchema,
    role: organizationRoleSchema,
    status: z.enum(["pending", "accepted", "revoked", "expired"]),
    expiresAt: isoDateTimeSchema,
    createdAt: isoDateTimeSchema,
});
export type OrganizationInvitation = z.infer<typeof organizationInvitationSchema>;

export const addOrganizationMemberResultSchema = z.object({
    kind: z.enum(["membership", "invitation"]),
    membership: z
        .object({
            organizationId: idSchema,
            userId: idSchema,
            role: organizationRoleSchema,
            status: membershipStatusSchema,
            displayName: z.string(),
            email: emailSchema.nullable(),
            createdAt: isoDateTimeSchema,
        })
        .nullable(),
    invitation: organizationInvitationSchema.nullable(),
});
export type AddOrganizationMemberResult = z.infer<typeof addOrganizationMemberResultSchema>;

export const acceptOrganizationInvitationResultSchema = z.object({
    organization: z.object({
        id: idSchema,
        name: z.string(),
        slug: z.string(),
        description: z.string(),
        websiteUrl: httpUrlSchema.nullable(),
        createdAt: isoDateTimeSchema,
        updatedAt: isoDateTimeSchema,
    }),
    role: organizationRoleSchema,
});
export type AcceptOrganizationInvitationResult = z.infer<
    typeof acceptOrganizationInvitationResultSchema
>;
