import { z } from "zod";
import {
    httpUrlSchema,
    idSchema,
    isoDateTimeSchema,
    sessionSchema,
    userSchema,
} from "../common/schemas.js";

export const PROFILE_THEME_MAX_BYTES = 1024 * 1024;
const PROFILE_THEME_MAX_DATA_URL_LENGTH = 1_400_000;

export const profileThemeSchema = z
    .string()
    .max(PROFILE_THEME_MAX_DATA_URL_LENGTH)
    .regex(
        /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/,
        "Use a PNG, JPEG, or WebP image.",
    );

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
        profileTheme: profileThemeSchema.nullable().optional(),
    })
    .strict()
    .refine(
        (value) =>
            value.displayName !== undefined ||
            value.locale !== undefined ||
            value.profileTheme !== undefined,
        { message: "Provide a display name, a locale, or a profile theme." },
    );
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

export const userWithProfileThemeSchema = userSchema.extend({
    profileTheme: profileThemeSchema.nullable(),
});
export type UserWithProfileTheme = z.infer<typeof userWithProfileThemeSchema>;

export const csrfTokenSchema = z.object({
    csrfToken: z.string(),
});
export type CsrfToken = z.infer<typeof csrfTokenSchema>;

export const publicUserProfileSchema = z.object({
    id: idSchema,
    displayName: z.string(),
    avatarUrl: httpUrlSchema.nullable(),
    profileTheme: profileThemeSchema.optional(),
    createdAt: isoDateTimeSchema,
});
export type PublicUserProfile = z.infer<typeof publicUserProfileSchema>;

export { sessionSchema };
