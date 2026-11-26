import { z } from "zod";

export const grantSchema = z.object({
    email: z.email("Enter the email address of an existing account."),
    reason: z.string().trim().min(5, "Explain why access is needed.").max(500),
});
export type GrantForm = z.infer<typeof grantSchema>;

export const revokeSchema = z.object({
    reason: z.string().trim().min(5, "Explain why access is removed.").max(500),
});
export type RevokeForm = z.infer<typeof revokeSchema>;

export const auditSchema = z.object({
    organizationId: z.uuid("Enter the organization identifier."),
    action: z.string().max(120),
    entityType: z.string().max(80),
    actorUserId: z
        .string()
        .refine(
            (value) => value.trim().length === 0 || z.uuid().safeParse(value.trim()).success,
            "Enter a user identifier or leave this empty.",
        ),
});
export type AuditForm = z.infer<typeof auditSchema>;
