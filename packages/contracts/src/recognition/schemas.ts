import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "../common/schemas.js";

export const awardNamespaceSchema = z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(
        /^[a-z0-9][a-z0-9_-]*$/,
        "Use lowercase letters, numbers, underscores, or hyphens, starting with a letter or number.",
    );

export const awardSchema = z.object({
    id: idSchema,
    organizationId: idSchema,
    editionId: idSchema,
    namespace: awardNamespaceSchema,
    name: z.string(),
    description: z.string(),
    icon: z.string(),
    color: z.string(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
});
export type Award = z.infer<typeof awardSchema>;

export const createAwardRequestSchema = z
    .object({
        namespace: awardNamespaceSchema,
        name: z.string().trim().min(1).max(120),
        description: z.string().trim().max(500).default(""),
        icon: z.string().trim().min(1).max(100).default("award"),
        color: z.string().trim().min(1).max(32).default("gold"),
    })
    .strict();
export type CreateAwardRequest = z.infer<typeof createAwardRequestSchema>;

export const updateAwardRequestSchema = z
    .object({
        name: z.string().trim().min(1).max(120).optional(),
        description: z.string().trim().max(500).optional(),
        icon: z.string().trim().min(1).max(100).optional(),
        color: z.string().trim().min(1).max(32).optional(),
    })
    .strict()
    .refine((value) => Object.keys(value).length > 0, "Provide at least one field to update.");
export type UpdateAwardRequest = z.infer<typeof updateAwardRequestSchema>;

export const assignAwardRequestSchema = z
    .object({
        note: z.string().trim().max(500).default(""),
    })
    .strict();
export type AssignAwardRequest = z.infer<typeof assignAwardRequestSchema>;

export const teamAwardSchema = z.object({
    id: idSchema,
    organizationId: idSchema,
    editionId: idSchema,
    teamId: idSchema,
    teamName: z.string(),
    awardId: idSchema,
    note: z.string(),
    assignedByUserId: idSchema,
    assignedAt: isoDateTimeSchema,
    award: awardSchema,
});
export type TeamAward = z.infer<typeof teamAwardSchema>;

export const awardCatalogSchema = z.object({
    awards: z.array(awardSchema),
    teamAwards: z.array(teamAwardSchema),
});
export type AwardCatalog = z.infer<typeof awardCatalogSchema>;

export const publicationStateSchema = z.object({
    editionId: idSchema,
    published: z.boolean(),
    publishedAt: isoDateTimeSchema.nullable(),
    publishedByUserId: idSchema.nullable(),
});
export type PublicationState = z.infer<typeof publicationStateSchema>;

export const resultsStatusSchema = publicationStateSchema.extend({
    judgingEntryCount: z.number().int().nonnegative(),
    awardAssignmentCount: z.number().int().nonnegative(),
    votingRoundCount: z.number().int().nonnegative(),
});
export type ResultsStatus = z.infer<typeof resultsStatusSchema>;

export const publicTeamAwardSchema = z.object({
    id: idSchema,
    namespace: awardNamespaceSchema,
    name: z.string(),
    description: z.string(),
    icon: z.string(),
    color: z.string(),
    note: z.string(),
});
export type PublicTeamAward = z.infer<typeof publicTeamAwardSchema>;

export const publicResultEntrySchema = z.object({
    submissionId: idSchema,
    projectId: idSchema,
    projectTitle: z.string(),
    teamId: idSchema.nullable(),
    teamName: z.string().nullable(),
    divisionName: z.string().nullable(),
    rank: z.number().int().positive().nullable(),
    averageScore: z.number().nullable(),
    submittedCount: z.number().int().nonnegative(),
    assignmentCount: z.number().int().nonnegative(),
    awards: z.array(publicTeamAwardSchema),
});
export type PublicResultEntry = z.infer<typeof publicResultEntrySchema>;

export const publicVotingEntrySchema = z.object({
    submissionId: idSchema,
    projectId: idSchema,
    projectTitle: z.string(),
    teamId: idSchema.nullable(),
    teamName: z.string().nullable(),
    rank: z.number().int().positive(),
    votes: z.number().int().nonnegative(),
    totalStars: z.number().int().nonnegative(),
    averageStars: z.number().nonnegative(),
});
export type PublicVotingEntry = z.infer<typeof publicVotingEntrySchema>;

export const publicVotingRoundSchema = z.object({
    roundId: idSchema,
    roundName: z.string(),
    publishedAt: isoDateTimeSchema.nullable(),
    totalBallots: z.number().int().nonnegative(),
    entries: z.array(publicVotingEntrySchema),
});
export type PublicVotingRound = z.infer<typeof publicVotingRoundSchema>;

export const publicAwardTeamSchema = z.object({
    teamId: idSchema,
    teamName: z.string(),
    projectId: idSchema.nullable(),
    projectTitle: z.string().nullable(),
    note: z.string(),
});
export type PublicAwardTeam = z.infer<typeof publicAwardTeamSchema>;

export const publicAwardSchema = z.object({
    id: idSchema,
    namespace: awardNamespaceSchema,
    name: z.string(),
    description: z.string(),
    icon: z.string(),
    color: z.string(),
    teams: z.array(publicAwardTeamSchema),
});
export type PublicAward = z.infer<typeof publicAwardSchema>;

export const publicPeopleChoiceSchema = publicVotingEntrySchema.extend({
    roundId: idSchema,
    roundName: z.string(),
});
export type PublicPeopleChoice = z.infer<typeof publicPeopleChoiceSchema>;

export const publicResultsEditionSchema = z.object({
    id: idSchema,
    name: z.string(),
    slug: z.string(),
    description: z.string(),
    status: z.string(),
    seriesName: z.string(),
    organizationName: z.string(),
    organizationSlug: z.string(),
    startsAt: isoDateTimeSchema.nullable(),
    endsAt: isoDateTimeSchema.nullable(),
});
export type PublicResultsEdition = z.infer<typeof publicResultsEditionSchema>;

export const publicResultsSchema = z.object({
    edition: publicResultsEditionSchema,
    judgingEntries: z.array(publicResultEntrySchema),
    votingRounds: z.array(publicVotingRoundSchema),
    peopleChoice: publicPeopleChoiceSchema.nullable(),
    awards: z.array(publicAwardSchema),
    publishedAt: isoDateTimeSchema,
});
export type PublicResults = z.infer<typeof publicResultsSchema>;

export const publicCertificateSchema = z.object({
    team: z.object({
        id: idSchema,
        name: z.string(),
    }),
    project: z
        .object({
            id: idSchema,
            title: z.string(),
        })
        .nullable(),
    edition: z.object({
        id: idSchema,
        name: z.string(),
        slug: z.string(),
        organizationName: z.string(),
        startsAt: isoDateTimeSchema.nullable(),
        endsAt: isoDateTimeSchema.nullable(),
    }),
    rank: z.number().int().positive().nullable(),
    awards: z.array(publicTeamAwardSchema),
    publishedAt: isoDateTimeSchema,
});
export type PublicCertificate = z.infer<typeof publicCertificateSchema>;

export const myResultsPastEntrySchema = z.object({
    editionId: idSchema,
    editionName: z.string(),
    editionSlug: z.string(),
    teamId: idSchema,
    teamName: z.string(),
    rank: z.number().int().positive().nullable(),
    awards: z.array(publicTeamAwardSchema),
    publishedAt: isoDateTimeSchema,
});
export type MyResultsPastEntry = z.infer<typeof myResultsPastEntrySchema>;

export const myResultsSchema = z.object({
    editionId: idSchema,
    published: z.boolean(),
    publishedAt: isoDateTimeSchema.nullable(),
    current: z
        .object({
            teamId: idSchema,
            teamName: z.string(),
            rank: z.number().int().positive().nullable(),
            awards: z.array(publicTeamAwardSchema),
        })
        .nullable(),
    past: z.array(myResultsPastEntrySchema),
});
export type MyResults = z.infer<typeof myResultsSchema>;
