import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "../common/schemas.js";

export const BALLOT_TOTAL_STARS = 10;
export const BALLOT_MAX_STARS_PER_SUBMISSION = 5;
export const BALLOT_REASONING_MAX_LENGTH = 2000;

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
    maxVotesPerUser: z.number().int().min(0).max(50),
    opensAt: isoDateTimeSchema.nullable(),
    closesAt: isoDateTimeSchema.nullable(),
    publishedAt: isoDateTimeSchema.nullable(),
    createdAt: isoDateTimeSchema,
});
export type VotingRound = z.infer<typeof votingRoundSchema>;

export const ballotScoreSchema = z.object({
    submissionId: idSchema,
    stars: z.number().int().min(1).max(BALLOT_MAX_STARS_PER_SUBMISSION),
});
export type BallotScore = z.infer<typeof ballotScoreSchema>;

export const ballotSchema = z.object({
    roundId: idSchema,
    userId: idSchema,
    scores: z.array(ballotScoreSchema),
    reasoning: z.string().max(BALLOT_REASONING_MAX_LENGTH).default(""),
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
        maxSelections: z.number().int().min(2).max(50).default(10),
        maxVotesPerUser: z.number().int().min(0).max(50).default(0),
        opensAt: isoDateTimeSchema.nullable().default(null),
        closesAt: isoDateTimeSchema.nullable().default(null),
    })
    .strict();
export type CreateVotingRoundRequest = z.infer<typeof createVotingRoundRequestSchema>;

export const castBallotRequestSchema = z
    .object({
        scores: z.array(ballotScoreSchema).min(1).max(50),
        reasoning: z.string().trim().max(BALLOT_REASONING_MAX_LENGTH).default(""),
    })
    .strict()
    .superRefine(({ scores }, context) => {
        const submissionIds = new Set<string>();
        for (const score of scores) {
            if (submissionIds.has(score.submissionId)) {
                context.addIssue({
                    code: "custom",
                    message: "Each submission may be scored only once.",
                    path: ["scores"],
                });
                break;
            }
            submissionIds.add(score.submissionId);
        }
        const total = scores.reduce((sum, score) => sum + score.stars, 0);
        if (total !== BALLOT_TOTAL_STARS) {
            context.addIssue({
                code: "custom",
                message: `Distribute exactly ${String(BALLOT_TOTAL_STARS)} stars.`,
                path: ["scores"],
            });
        }
    });
export type CastBallotRequest = z.infer<typeof castBallotRequestSchema>;

export const votableSubmissionSchema = z.object({
    id: idSchema,
    projectTitle: z.string(),
    summary: z.string(),
    teamId: idSchema.nullable(),
    teamName: z.string().nullable(),
});
export type VotableSubmission = z.infer<typeof votableSubmissionSchema>;

export const voteAuditEntrySchema = z.object({
    userId: idSchema,
    submittedAt: isoDateTimeSchema.nullable(),
    reasoning: z.string(),
    scores: z.array(ballotScoreSchema),
});
export type VoteAuditEntry = z.infer<typeof voteAuditEntrySchema>;

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
            rank: z.number().int().positive(),
            votes: z.number().int().nonnegative(),
            totalStars: z.number().int().nonnegative(),
            averageStars: z.number().nonnegative(),
        }),
    ),
    audit: z.array(voteAuditEntrySchema).optional(),
});
export type VoteResult = z.infer<typeof voteResultSchema>;
