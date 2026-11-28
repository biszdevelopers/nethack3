import { z } from "zod";
import {
    emailSchema,
    idSchema,
    isoDateTimeSchema,
    markdownSchema,
    slugSchema,
    timeZoneSchema,
} from "../common/schemas.js";

function isHttpsUrl(value: string): boolean {
    try {
        return new URL(value).protocol === "https:";
    } catch {
        return false;
    }
}

const contactEmailValueSchema = z
    .string()
    .trim()
    .max(254)
    .refine((value) => value === "" || emailSchema.safeParse(value).success, {
        message: "Enter a valid email address.",
    })
    .transform((value) => (value === "" ? null : value));

const contactUrlValueSchema = z
    .string()
    .trim()
    .max(2048)
    .refine((value) => value === "" || isHttpsUrl(value), {
        message: "Use an https URL.",
    })
    .transform((value) => (value === "" ? null : value));

export const competitionEditionStatusSchema = z.enum([
    "draft",
    "published",
    "registration_open",
    "registration_closed",
    "active",
    "judging",
    "voting",
    "paused",
    "completed",
    "archived",
]);
export type CompetitionEditionStatus = z.infer<typeof competitionEditionStatusSchema>;

export const editionLifecycleActionSchema = z.enum([
    "pause",
    "resume",
    "reopen_submissions",
    "reopen_judging",
    "reopen_voting",
    "reset",
]);
export type EditionLifecycleAction = z.infer<typeof editionLifecycleActionSchema>;

export const editionLifecycleRequestSchema = z
    .object({
        action: editionLifecycleActionSchema,
        confirm: z.boolean().optional(),
    })
    .strict()
    .refine((value) => value.action !== "reset" || value.confirm === true, {
        message: "Resetting an edition requires explicit confirmation.",
        path: ["confirm"],
    });
export type EditionLifecycleRequest = z.infer<typeof editionLifecycleRequestSchema>;

export const milestoneKindSchema = z.enum([
    "registration",
    "submission",
    "judging",
    "voting",
    "ceremony",
    "other",
]);
export type MilestoneKind = z.infer<typeof milestoneKindSchema>;

export const competitionSeriesSchema = z.object({
    id: idSchema,
    organizationId: idSchema,
    name: z.string(),
    slug: z.string(),
    description: z.string(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
});
export type CompetitionSeries = z.infer<typeof competitionSeriesSchema>;

export const divisionSchema = z.object({
    id: idSchema,
    organizationId: idSchema,
    editionId: idSchema,
    name: z.string(),
    slug: z.string(),
    description: z.string(),
    minTeamSize: z.number().int().min(1).nullable(),
    maxTeamSize: z.number().int().min(1).nullable(),
    createdAt: isoDateTimeSchema,
});
export type Division = z.infer<typeof divisionSchema>;

export const milestoneSchema = z.object({
    id: idSchema,
    organizationId: idSchema,
    editionId: idSchema,
    title: z.string(),
    description: z.string(),
    kind: milestoneKindSchema,
    occursAt: isoDateTimeSchema,
    createdAt: isoDateTimeSchema,
});
export type Milestone = z.infer<typeof milestoneSchema>;

export const competitionEditionSchema = z.object({
    id: idSchema,
    organizationId: idSchema,
    seriesId: idSchema,
    name: z.string(),
    slug: z.string(),
    description: z.string(),
    themeName: z.string().nullable(),
    themeDescription: z.string().nullable(),
    contactEmail: z.string().nullable(),
    contactUrl: z.string().nullable(),
    showScores: z.boolean(),
    showRanking: z.boolean(),
    status: competitionEditionStatusSchema,
    statusBeforePause: competitionEditionStatusSchema.nullable(),
    timezone: z.string(),
    registrationOpensAt: isoDateTimeSchema.nullable(),
    registrationClosesAt: isoDateTimeSchema.nullable(),
    startsAt: isoDateTimeSchema.nullable(),
    endsAt: isoDateTimeSchema.nullable(),
    teamMinSize: z.number().int().min(1),
    teamMaxSize: z.number().int().min(1),
    maxParticipants: z.number().int().min(1).nullable(),
    rulesMarkdown: z.string(),
    resultsOpenAt: isoDateTimeSchema.nullable(),
    publishedAt: isoDateTimeSchema.nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
});
export type CompetitionEdition = z.infer<typeof competitionEditionSchema>;

export const competitionEditionDetailSchema = competitionEditionSchema.extend({
    seriesName: z.string(),
    organizationName: z.string(),
    organizationSlug: z.string(),
    divisions: z.array(divisionSchema),
    milestones: z.array(milestoneSchema),
    registrationCount: z.number().int().nonnegative(),
    teamCount: z.number().int().nonnegative(),
    submissionCount: z.number().int().nonnegative(),
});
export type CompetitionEditionDetail = z.infer<typeof competitionEditionDetailSchema>;

export const organizerEditionSchema = competitionEditionSchema.extend({
    seriesName: z.string(),
    registrationCount: z.number().int().nonnegative(),
    teamCount: z.number().int().nonnegative(),
});
export type OrganizerEdition = z.infer<typeof organizerEditionSchema>;

export const createSeriesRequestSchema = z
    .object({
        name: z.string().trim().min(2).max(120),
        slug: slugSchema,
        description: z.string().max(2000).default(""),
    })
    .strict();
export type CreateSeriesRequest = z.infer<typeof createSeriesRequestSchema>;

export const createEditionRequestSchema = z
    .object({
        name: z.string().trim().min(2).max(160),
        slug: slugSchema,
        description: z.string().max(5000).default(""),
        themeName: z
            .string()
            .trim()
            .max(160)
            .nullable()
            .default(null)
            .transform((value) => (value === "" ? null : value)),
        themeDescription: z
            .string()
            .max(2000)
            .nullable()
            .default(null)
            .transform((value) => (value === "" ? null : value)),
        contactEmail: contactEmailValueSchema.nullable().default(null),
        contactUrl: contactUrlValueSchema.nullable().default(null),
        showScores: z.boolean().default(false),
        showRanking: z.boolean().default(false),
        timezone: timeZoneSchema,
        registrationOpensAt: isoDateTimeSchema.nullable().default(null),
        registrationClosesAt: isoDateTimeSchema.nullable().default(null),
        startsAt: isoDateTimeSchema.nullable().default(null),
        endsAt: isoDateTimeSchema.nullable().default(null),
        teamMinSize: z.number().int().min(1).max(50).default(1),
        teamMaxSize: z.number().int().min(1).max(50).default(4),
        maxParticipants: z.number().int().min(1).max(100000).nullable().default(null),
        rulesMarkdown: markdownSchema.default(""),
        resultsOpenAt: isoDateTimeSchema.nullable().default(null),
    })
    .strict()
    .refine((value) => value.teamMinSize <= value.teamMaxSize, {
        message: "Minimum team size cannot exceed maximum team size.",
        path: ["teamMinSize"],
    })
    .refine(
        (value) =>
            !value.registrationOpensAt ||
            !value.registrationClosesAt ||
            new Date(value.registrationOpensAt) <= new Date(value.registrationClosesAt),
        { message: "Registration must close after it opens.", path: ["registrationClosesAt"] },
    )
    .refine(
        (value) =>
            !value.startsAt || !value.endsAt || new Date(value.startsAt) <= new Date(value.endsAt),
        { message: "The end must not precede the start.", path: ["endsAt"] },
    );
export type CreateEditionRequest = z.infer<typeof createEditionRequestSchema>;

export const updateEditionRequestSchema = z
    .object({
        name: z.string().trim().min(2).max(160).optional(),
        description: z.string().max(5000).optional(),
        themeName: z
            .string()
            .trim()
            .max(160)
            .nullable()
            .optional()
            .transform((value) => (value === "" ? null : value)),
        themeDescription: z
            .string()
            .max(2000)
            .nullable()
            .optional()
            .transform((value) => (value === "" ? null : value)),
        contactEmail: contactEmailValueSchema.nullable().optional(),
        contactUrl: contactUrlValueSchema.nullable().optional(),
        showScores: z.boolean().optional(),
        showRanking: z.boolean().optional(),
        status: competitionEditionStatusSchema.optional(),
        timezone: timeZoneSchema.optional(),
        registrationOpensAt: isoDateTimeSchema.nullable().optional(),
        registrationClosesAt: isoDateTimeSchema.nullable().optional(),
        startsAt: isoDateTimeSchema.nullable().optional(),
        endsAt: isoDateTimeSchema.nullable().optional(),
        teamMinSize: z.number().int().min(1).max(50).optional(),
        teamMaxSize: z.number().int().min(1).max(50).optional(),
        maxParticipants: z.number().int().min(1).max(100000).nullable().optional(),
        rulesMarkdown: markdownSchema.optional(),
        resultsOpenAt: isoDateTimeSchema.nullable().optional(),
    })
    .strict();
export type UpdateEditionRequest = z.infer<typeof updateEditionRequestSchema>;

export const updateSeriesRequestSchema = z
    .object({
        name: z.string().trim().min(2).max(120).optional(),
        description: z.string().max(2000).optional(),
    })
    .strict()
    .refine((value) => value.name !== undefined || value.description !== undefined, {
        message: "Provide a name or a description.",
    });
export type UpdateSeriesRequest = z.infer<typeof updateSeriesRequestSchema>;

export const updateDivisionRequestSchema = z
    .object({
        name: z.string().trim().min(2).max(120).optional(),
        description: z.string().max(2000).optional(),
        minTeamSize: z.number().int().min(1).max(50).nullable().optional(),
        maxTeamSize: z.number().int().min(1).max(50).nullable().optional(),
    })
    .strict()
    .refine(
        (value) =>
            value.name !== undefined ||
            value.description !== undefined ||
            value.minTeamSize !== undefined ||
            value.maxTeamSize !== undefined,
        { message: "Provide at least one field to update." },
    );
export type UpdateDivisionRequest = z.infer<typeof updateDivisionRequestSchema>;

export const updateMilestoneRequestSchema = z
    .object({
        title: z.string().trim().min(2).max(160).optional(),
        description: z.string().max(2000).optional(),
        kind: milestoneKindSchema.optional(),
        occursAt: isoDateTimeSchema.optional(),
    })
    .strict()
    .refine(
        (value) =>
            value.title !== undefined ||
            value.description !== undefined ||
            value.kind !== undefined ||
            value.occursAt !== undefined,
        { message: "Provide at least one field to update." },
    );
export type UpdateMilestoneRequest = z.infer<typeof updateMilestoneRequestSchema>;

export const createDivisionRequestSchema = z
    .object({
        name: z.string().trim().min(2).max(120),
        slug: slugSchema,
        description: z.string().max(2000).default(""),
        minTeamSize: z.number().int().min(1).max(50).nullable().default(null),
        maxTeamSize: z.number().int().min(1).max(50).nullable().default(null),
    })
    .strict();
export type CreateDivisionRequest = z.infer<typeof createDivisionRequestSchema>;

export const createMilestoneRequestSchema = z
    .object({
        title: z.string().trim().min(2).max(160),
        description: z.string().max(2000).default(""),
        kind: milestoneKindSchema.default("other"),
        occursAt: isoDateTimeSchema,
    })
    .strict();
export type CreateMilestoneRequest = z.infer<typeof createMilestoneRequestSchema>;
