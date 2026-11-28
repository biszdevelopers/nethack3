import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "../common/schemas.js";

export const notificationKindSchema = z.enum([
    "team_invitation",
    "registration_decision",
    "submission_review",
    "judge_assignment",
    "evaluation_due",
    "voting_open",
    "announcement",
    "system",
]);
export type NotificationKind = z.infer<typeof notificationKindSchema>;

export const notificationSchema = z.object({
    id: idSchema,
    organizationId: idSchema.nullable(),
    kind: notificationKindSchema,
    title: z.string(),
    body: z.string(),
    linkUrl: z.string().nullable(),
    readAt: isoDateTimeSchema.nullable(),
    createdAt: isoDateTimeSchema,
});
export type Notification = z.infer<typeof notificationSchema>;

export const notificationUnreadCountSchema = z.object({
    count: z.number().int().nonnegative(),
});
export type NotificationUnreadCount = z.infer<typeof notificationUnreadCountSchema>;

export const notificationPreferencesSchema = z.object({
    emailEnabled: z.boolean(),
    inAppEnabled: z.boolean(),
});
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

export const updateNotificationPreferencesRequestSchema = z
    .object({
        emailEnabled: z.boolean(),
        inAppEnabled: z.boolean(),
    })
    .strict();
export type UpdateNotificationPreferencesRequest = z.infer<
    typeof updateNotificationPreferencesRequestSchema
>;
