import { z } from "zod";

export const loginQuerySchema = z.object({
    returnTo: z.string().max(2048).optional(),
});

export const callbackQuerySchema = z.object({
    code: z.string().max(4096).optional(),
    state: z.string().max(512).optional(),
    error: z.string().max(256).optional(),
    error_description: z.string().max(1024).optional(),
});
