import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "../common/schemas.js";
import { teamStatusSchema } from "../teams/schemas.js";

export const publicCompetitionSchema = z.object({
    editionId: idSchema,
    name: z.string(),
    slug: z.string(),
    description: z.string(),
    themeName: z.string().nullable(),
    themeDescription: z.string().nullable(),
    status: z.string(),
    organizationName: z.string(),
    organizationSlug: z.string(),
    seriesName: z.string(),
    startsAt: isoDateTimeSchema.nullable(),
    endsAt: isoDateTimeSchema.nullable(),
    registrationClosesAt: isoDateTimeSchema.nullable(),
    resultsOpenAt: isoDateTimeSchema.nullable(),
    teamMinSize: z.number().int(),
    teamMaxSize: z.number().int(),
    showScores: z.boolean(),
    showRanking: z.boolean(),
    publishedProjectCount: z.number().int().nonnegative(),
});
export type PublicCompetition = z.infer<typeof publicCompetitionSchema>;

export const publicCompetitionDetailSchema = publicCompetitionSchema.extend({
    rulesMarkdown: z.string(),
    divisions: z.array(
        z.object({
            id: idSchema,
            name: z.string(),
            slug: z.string(),
            description: z.string(),
        }),
    ),
    milestones: z.array(
        z.object({
            id: idSchema,
            title: z.string(),
            description: z.string(),
            kind: z.string(),
            occursAt: isoDateTimeSchema,
        }),
    ),
    projects: z.array(
        z.object({
            id: idSchema,
            title: z.string(),
            slug: z.string(),
            summary: z.string(),
            teamName: z.string().nullable(),
            publishedAt: isoDateTimeSchema.nullable(),
        }),
    ),
});
export type PublicCompetitionDetail = z.infer<typeof publicCompetitionDetailSchema>;

export const publicProjectSchema = z.object({
    id: idSchema,
    title: z.string(),
    slug: z.string(),
    summary: z.string(),
    descriptionMarkdown: z.string(),
    repositoryUrl: z.string().nullable(),
    demoUrl: z.string().nullable(),
    videoUrl: z.string().nullable(),
    aiDisclosure: z.string(),
    tags: z.array(z.string()),
    publishedAt: isoDateTimeSchema.nullable(),
    teamId: idSchema.nullable(),
    teamName: z.string().nullable(),
    teamStatus: teamStatusSchema.nullable(),
    divisionName: z.string().nullable(),
    organizationName: z.string(),
    competitionName: z.string(),
    competitionSlug: z.string(),
    members: z.array(z.object({ displayName: z.string() })),
});
export type PublicProject = z.infer<typeof publicProjectSchema>;

export const publicAnnouncementSchema = z.object({
    id: idSchema,
    title: z.string(),
    bodyMarkdown: z.string(),
    publishedAt: isoDateTimeSchema.nullable(),
    organizationName: z.string(),
    organizationSlug: z.string(),
});
export type PublicAnnouncement = z.infer<typeof publicAnnouncementSchema>;

export const publicOrganizationSchema = z.object({
    id: idSchema,
    name: z.string(),
    slug: z.string(),
    description: z.string(),
    websiteUrl: z.string().nullable(),
    competitions: z.array(publicCompetitionSchema),
});
export type PublicOrganization = z.infer<typeof publicOrganizationSchema>;
