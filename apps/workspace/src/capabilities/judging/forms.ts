import { z } from "zod";
import { localInputToIso } from "../shared/datetime.js";

export const assignmentSchema = z.object({
    submissionId: z.uuid("Select a submission."),
    rubricId: z.uuid("Select a rubric."),
    judgeEmail: z.email("Enter the email address of an active judge."),
    dueAt: z
        .string()
        .refine(
            (value) => value.trim().length === 0 || localInputToIso(value) !== null,
            "Enter a valid date and time.",
        ),
    note: z.string().max(2000),
});
export type AssignmentForm = z.infer<typeof assignmentSchema>;

export const conflictSchema = z.object({
    note: z.string().trim().min(5, "Describe the conflict in at least five characters.").max(2000),
});
export type ConflictForm = z.infer<typeof conflictSchema>;

export const flagSchema = z.object({
    reason: z.string().trim().min(5, "Describe the concern in at least five characters.").max(2000),
});
export type FlagForm = z.infer<typeof flagSchema>;
