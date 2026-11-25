import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "../common/schemas.js";

export const registrationStatusSchema = z.enum([
    "pending",
    "approved",
    "rejected",
    "withdrawn",
    "waitlisted",
]);
export type RegistrationStatus = z.infer<typeof registrationStatusSchema>;

export const registrationSchema = z.object({
    id: idSchema,
    organizationId: idSchema,
    editionId: idSchema,
    userId: idSchema,
    participantId: idSchema.nullable(),
    displayName: z.string(),
    email: z.email().nullable(),
    divisionId: idSchema.nullable(),
    status: registrationStatusSchema,
    note: z.string(),
    createdAt: isoDateTimeSchema,
    decidedAt: isoDateTimeSchema.nullable(),
    decidedByUserId: idSchema.nullable(),
});
export type Registration = z.infer<typeof registrationSchema>;

export const participantSchema = z.object({
    id: idSchema,
    organizationId: idSchema,
    editionId: idSchema,
    userId: idSchema,
    displayName: z.string(),
    divisionId: idSchema.nullable(),
    teamId: idSchema.nullable(),
    registeredAt: isoDateTimeSchema,
});
export type Participant = z.infer<typeof participantSchema>;

export const registerForCompetitionRequestSchema = z
    .object({
        divisionId: idSchema.nullable().default(null),
        note: z.string().max(2000).default(""),
    })
    .strict();
export type RegisterForCompetitionRequest = z.infer<typeof registerForCompetitionRequestSchema>;

export const decideRegistrationRequestSchema = z
    .object({
        status: z.enum(["approved", "rejected", "waitlisted"]),
        note: z.string().max(2000).default(""),
    })
    .strict();
export type DecideRegistrationRequest = z.infer<typeof decideRegistrationRequestSchema>;

export const participantSummarySchema = z.object({
    userId: idSchema,
    displayName: z.string(),
    teamId: idSchema.nullable(),
    teamName: z.string().nullable(),
    divisionId: idSchema.nullable(),
    registeredAt: isoDateTimeSchema,
});
export type ParticipantSummary = z.infer<typeof participantSummarySchema>;
