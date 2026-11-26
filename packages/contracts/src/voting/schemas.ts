import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "../common/schemas.js";

export const votingRoundStatusSchema = z.enum(["draft", "open", "closed", "published"]);
export type VotingRoundStatus = z.infer<typeof votingRoundStatusSchema>;

export const votingRoundSchema = z.object({
    id: idSchema,
    organizationId: idSchema,
    editionId: idSchema,
    name: z.string(),
    description: z.string(),
    status: votingRoundStatusSchema,
    eligibleRoles: z.array(z.enum(["participant", "judge", "organizer"])),
    maxSelections: z.number().int().min(1).max(50),
    opensAt: isoDateTimeSchema.nullable(),
    closesAt: isoDateTimeSchema.nullable(),
    publishedAt: isoDateTimeSchema.nullable(),
    createdAt: isoDateTimeSchema,
});
export type VotingRound = z.infer<typeof votingRoundSchema>;

export const ballotSchema = z.object({
    roundId: idSchema,
    userId: idSchema,
    submissionIds: z.array(idSchema),
    submittedAt: isoDateTimeSchema.nullable(),
});
export type Ballot = z.infer<typeof ballotSchema>;

export const createVotingRoundRequestSchema = z
    .object({
        name: z.string().trim().min(2).max(120),
        description: z.string().max(2000).default(""),
        eligibleRoles: z
            .array(z.enum(["participant", "judge", "organizer"]))
            .min(1)
            .default(["participant"]),
        maxSelections: z.number().int().min(1).max(50).default(1),
        opensAt: isoDateTimeSchema.nullable().default(null),
        closesAt: isoDateTimeSchema.nullable().default(null),
    })
    .strict();
export type CreateVotingRoundRequest = z.infer<typeof createVotingRoundRequestSchema>;

export const castBallotRequestSchema = z
    .object({
        submissionIds: z.array(idSchema).min(1).max(50),
    })
    .strict();
export type CastBallotRequest = z.infer<typeof castBallotRequestSchema>;

export const votableSubmissionSchema = z.object({
    id: idSchema,
    projectTitle: z.string(),
    summary: z.string(),
    teamId: idSchema.nullable(),
    teamName: z.string().nullable(),
});
export type VotableSubmission = z.infer<typeof votableSubmissionSchema>;

export const voteResultSchema = z.object({
    roundId: idSchema,
    roundName: z.string(),
    publishedAt: isoDateTimeSchema.nullable(),
    totalBallots: z.number().int().nonnegative(),
    entries: z.array(
        z.object({
            submissionId: idSchema,
            projectTitle: z.string(),
            teamName: z.string().nullable(),
            votes: z.number().int().nonnegative(),
        }),
    ),
});
export type VoteResult = z.infer<typeof voteResultSchema>;
