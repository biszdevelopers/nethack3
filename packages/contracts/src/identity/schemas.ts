import { z } from "zod";
import { sessionSchema } from "../common/schemas.js";

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

export { sessionSchema };
