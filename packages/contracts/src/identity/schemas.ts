import { z } from "zod";
import { httpUrlSchema, idSchema, isoDateTimeSchema, sessionSchema } from "../common/schemas.js";

export const loginRedirectSchema = z.object({
    returnTo: z.string().max(2048).optional(),
});

export const logoutResponseSchema = z.object({
    providerLogoutUrl: z.string().nullable(),
});

export const loginFailureCodeSchema = z.enum([
    "login_cancelled",
    "login_expired",
    "login_failed",
    "account_disabled",
    "account_link_required",
]);
export type LoginFailureCode = z.infer<typeof loginFailureCodeSchema>;

export const updateProfileRequestSchema = z
    .object({
        displayName: z.string().trim().min(1).max(80).optional(),
        locale: z
            .string()
            .min(2)
            .max(16)
            .regex(/^[a-z]{2}(?:-[A-Za-z]{2,8})?$/)
            .optional(),
    })
    .strict()
    .refine((value) => value.displayName !== undefined || value.locale !== undefined, {
        message: "Provide a display name or a locale.",
    });
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

export const csrfTokenSchema = z.object({
    csrfToken: z.string(),
});
export type CsrfToken = z.infer<typeof csrfTokenSchema>;

export const publicUserProfileSchema = z.object({
    id: idSchema,
    displayName: z.string(),
    avatarUrl: httpUrlSchema.nullable(),
    createdAt: isoDateTimeSchema,
});
export type PublicUserProfile = z.infer<typeof publicUserProfileSchema>;

export { sessionSchema };
