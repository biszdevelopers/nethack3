import { z } from "zod";

export const awardNamespacePattern = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export const awardFormSchema = z.object({
    namespace: z
        .string()
        .trim()
        .min(1, "Enter an award key.")
        .max(64)
        .regex(
            awardNamespacePattern,
            "Use lowercase letters, numbers, underscores, or hyphens, starting with a letter or number.",
        ),
    name: z.string().trim().min(1, "Enter an award name.").max(120),
    description: z.string().max(500),
    icon: z.string().max(100),
    color: z.string().max(32),
});
export type AwardForm = z.infer<typeof awardFormSchema>;

export const awardAssignmentSchema = z.object({
    awardId: z.string().min(1, "Select an award."),
    teamId: z.string().min(1, "Select a team."),
    note: z.string().max(500),
});
export type AwardAssignmentForm = z.infer<typeof awardAssignmentSchema>;

export const awardEditSchema = z.object({
    name: z.string().trim().min(1, "Enter an award name.").max(120),
    description: z.string().max(500),
    icon: z.string().max(100),
    color: z.string().max(32),
});
export type AwardEditForm = z.infer<typeof awardEditSchema>;
