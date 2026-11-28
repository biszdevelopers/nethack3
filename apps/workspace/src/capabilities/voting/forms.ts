import { z } from "zod";
import { localInputToIso } from "../shared/datetime.js";

const optionalDateTime = z
    .string()
    .refine(
        (value) => value.trim().length === 0 || localInputToIso(value) !== null,
        "Enter a valid date and time.",
    );

export const roundSchema = z.object({
    name: z.string().trim().min(2, "Enter a round name.").max(120),
    description: z.string().max(2000),
    eligibleRoles: z
        .array(z.enum(["participant", "judge", "organizer"]))
        .min(1, "Select at least one eligible role."),
    maxSelections: z.number().int().min(2).max(50),
    maxVotesPerUser: z.number().int().min(0).max(50),
    opensAt: optionalDateTime,
    closesAt: optionalDateTime,
});
export type RoundForm = z.infer<typeof roundSchema>;
