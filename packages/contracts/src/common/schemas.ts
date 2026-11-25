import { z } from "zod";

export const idSchema = z.uuid();
export type Id = z.infer<typeof idSchema>;

export const slugSchema = z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens.");

export const isoDateTimeSchema = z.iso.datetime({ offset: true });
export type IsoDateTime = z.infer<typeof isoDateTimeSchema>;

export const nonEmptyTextSchema = z.string().trim().min(1).max(2000);
export const markdownSchema = z.string().max(100_000);

export const displayNameSchema = z.string().trim().min(1).max(80);
export const emailSchema = z.email().max(254);

export const timeZoneSchema = z
    .string()
    .min(1)
    .max(64)
    .refine((value) => {
        try {
            new Intl.DateTimeFormat("en-US", { timeZone: value });
            return true;
        } catch {
            return false;
        }
    }, "Unknown time zone.");

export const httpUrlSchema = z
    .url()
    .max(2048)
    .refine((value) => {
        const protocol = new URL(value).protocol;
        return protocol === "http:" || protocol === "https:";
    }, "Use an http or https URL.");

export const cursorSchema = z.string().max(512);
export const limitSchema = z.coerce.number().int().min(1).max(100).default(20);

export const pageQuerySchema = z.object({
    cursor: cursorSchema.optional(),
    limit: limitSchema.optional(),
});
export type PageQuery = z.infer<typeof pageQuerySchema>;

export function listResponseSchema<T extends z.ZodTypeAny>(item: T) {
    return z.object({
        items: z.array(item),
        nextCursor: z.string().nullable(),
    });
}

export type ListResponse<T> = {
    items: T[];
    nextCursor: string | null;
};

export const errorCodeSchema = z.enum([
    "validation_error",
    "authentication_required",
    "invalid_token",
    "insufficient_scope",
    "forbidden",
    "not_found",
    "conflict",
    "rate_limited",
    "external_dependency_failure",
    "payload_too_large",
    "unsupported_media_type",
    "internal_error",
]);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const apiErrorSchema = z.object({
    error: z.object({
        code: errorCodeSchema,
        message: z.string(),
        requestId: z.string(),
        details: z.record(z.string(), z.array(z.string())).optional(),
    }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const healthSchema = z.object({
    status: z.enum(["ok", "degraded", "unavailable"]),
    version: z.string(),
    uptimeSeconds: z.number().int().nonnegative(),
    checks: z.array(
        z.object({
            name: z.string(),
            status: z.enum(["ok", "degraded", "unavailable"]),
            detail: z.string().optional(),
        }),
    ),
});
export type Health = z.infer<typeof healthSchema>;

export const organizationRoleSchema = z.enum(["owner", "organizer", "judge", "participant"]);
export type OrganizationRole = z.infer<typeof organizationRoleSchema>;

export const membershipStatusSchema = z.enum(["active", "suspended"]);
export type MembershipStatus = z.infer<typeof membershipStatusSchema>;

export const organizationSchema = z.object({
    id: idSchema,
    name: z.string(),
    slug: z.string(),
    description: z.string(),
    websiteUrl: httpUrlSchema.nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
});
export type Organization = z.infer<typeof organizationSchema>;

export const organizationMembershipSchema = z.object({
    organizationId: idSchema,
    userId: idSchema,
    role: organizationRoleSchema,
    status: membershipStatusSchema,
    displayName: z.string(),
    email: emailSchema.nullable(),
    createdAt: isoDateTimeSchema,
});
export type OrganizationMembership = z.infer<typeof organizationMembershipSchema>;

export const userSchema = z.object({
    id: idSchema,
    displayName: z.string(),
    email: emailSchema.nullable(),
    avatarUrl: httpUrlSchema.nullable(),
    locale: z.string(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
});
export type User = z.infer<typeof userSchema>;

export const currentMembershipSchema = z.object({
    organizationId: idSchema,
    organizationName: z.string(),
    organizationSlug: z.string(),
    role: organizationRoleSchema,
    status: membershipStatusSchema,
});

export const sessionSchema = z.object({
    user: userSchema,
    memberships: z.array(currentMembershipSchema),
    globalAdministrator: z.boolean(),
    csrfToken: z.string(),
    expiresAt: isoDateTimeSchema,
});
export type Session = z.infer<typeof sessionSchema>;

export const auditLogSchema = z.object({
    id: idSchema,
    organizationId: idSchema.nullable(),
    actorUserId: idSchema.nullable(),
    actorDisplayName: z.string().nullable(),
    action: z.string(),
    entityType: z.string(),
    entityId: z.string().nullable(),
    metadata: z.record(z.string(), z.unknown()),
    createdAt: isoDateTimeSchema,
});
export type AuditLog = z.infer<typeof auditLogSchema>;

export const reportSummarySchema = z.object({
    organizationId: idSchema,
    editions: z.array(
        z.object({
            editionId: idSchema,
            editionName: z.string(),
            registrations: z.number().int().nonnegative(),
            approvedRegistrations: z.number().int().nonnegative(),
            teams: z.number().int().nonnegative(),
            projects: z.number().int().nonnegative(),
            submissions: z.number().int().nonnegative(),
            evaluationsSubmitted: z.number().int().nonnegative(),
        }),
    ),
});
export type ReportSummary = z.infer<typeof reportSummarySchema>;
