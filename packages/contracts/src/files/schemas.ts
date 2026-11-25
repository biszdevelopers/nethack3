import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "../common/schemas.js";

export const fileStatusSchema = z.enum([
    "quarantined",
    "scanning",
    "approved",
    "rejected",
    "deleted",
]);
export type FileStatus = z.infer<typeof fileStatusSchema>;

export const storedFileSchema = z.object({
    id: idSchema,
    organizationId: idSchema.nullable(),
    fileName: z.string(),
    contentType: z.string(),
    byteSize: z.number().int().nonnegative(),
    checksumSha256: z.string(),
    status: fileStatusSchema,
    createdAt: isoDateTimeSchema,
});
export type StoredFile = z.infer<typeof storedFileSchema>;

export const downloadTicketSchema = z.object({
    url: z.string(),
    expiresAt: isoDateTimeSchema,
});
export type DownloadTicket = z.infer<typeof downloadTicketSchema>;
