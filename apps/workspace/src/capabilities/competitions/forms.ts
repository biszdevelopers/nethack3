import { z } from "zod";
import {
    competitionEditionStatusSchema,
    milestoneKindSchema,
    slugSchema,
} from "@nethack/contracts";
import { localInputToIso } from "../shared/datetime.js";

const optionalDateTime = z
    .string()
    .refine(
        (value) => value.trim().length === 0 || localInputToIso(value) !== null,
        "Enter a valid date and time.",
    );

export const seriesSchema = z.object({
    name: z.string().trim().min(2, "Enter a series name.").max(120),
    slug: slugSchema,
    description: z.string().max(2000),
});
export type SeriesForm = z.infer<typeof seriesSchema>;

export const editionSchema = z.object({
    name: z.string().trim().min(2, "Enter an edition name.").max(160),
    slug: slugSchema,
    description: z.string().max(5000),
    timezone: z.string().min(1, "Enter an IANA time zone.").max(64),
    status: competitionEditionStatusSchema,
    registrationOpensAt: optionalDateTime,
    registrationClosesAt: optionalDateTime,
    startsAt: optionalDateTime,
    endsAt: optionalDateTime,
    teamMinSize: z.number().int().min(1).max(50),
    teamMaxSize: z.number().int().min(1).max(50),
    maxParticipants: z.number().int().min(1).max(100000).nullable(),
    rulesMarkdown: z.string().max(100_000),
});
export type EditionForm = z.infer<typeof editionSchema>;

export const divisionSchema = z.object({
    name: z.string().trim().min(2, "Enter a division name.").max(120),
    slug: slugSchema,
    description: z.string().max(2000),
    minTeamSize: z.number().int().min(1).max(50).nullable(),
    maxTeamSize: z.number().int().min(1).max(50).nullable(),
});
export type DivisionForm = z.infer<typeof divisionSchema>;

export const milestoneSchema = z.object({
    title: z.string().trim().min(2, "Enter a milestone title.").max(160),
    description: z.string().max(2000),
    kind: milestoneKindSchema,
    occursAt: z
        .string()
        .refine(
            (value) => localInputToIso(value) !== null,
            "Enter the date and time of the milestone.",
        ),
});
export type MilestoneForm = z.infer<typeof milestoneSchema>;
