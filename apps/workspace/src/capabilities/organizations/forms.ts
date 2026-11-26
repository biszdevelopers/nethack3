import { z } from "zod";
import { organizationRoleSchema } from "@nethack/contracts";

export const addMemberSchema = z.object({
    email: z.email("Enter an email address."),
    role: organizationRoleSchema,
});
export type AddMemberForm = z.infer<typeof addMemberSchema>;

export const settingsSchema = z.object({
    registrationRequiresApproval: z.boolean(),
    allowParticipantTeamCreation: z.boolean(),
    publicShowcaseEnabled: z.boolean(),
});
export type SettingsForm = z.infer<typeof settingsSchema>;

export const auditFilterSchema = z.object({
    action: z.string().max(120),
    entityType: z.string().max(80),
});
export type AuditFilterForm = z.infer<typeof auditFilterSchema>;
