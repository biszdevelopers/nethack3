import {
    publicCertificateSchema,
    publicResultsSchema,
    type PublicCertificate,
    type PublicResults,
} from "@nethack/contracts";
import type { z } from "zod";
import { PublicApiError } from "./public-api";

const API_ORIGIN = process.env.PUBLIC_API_ORIGIN ?? "http://localhost:3002";
const REVALIDATE_SECONDS = 60;

async function publicRequest<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    let response: Response;
    try {
        response = await fetch(new URL(path, API_ORIGIN), {
            headers: { Accept: "application/json" },
            ...(process.env.NODE_ENV === "production"
                ? { next: { revalidate: REVALIDATE_SECONDS } }
                : { cache: "no-store" }),
        });
    } catch (error) {
        throw new PublicApiError(
            error instanceof Error ? error.message : "The public API is unavailable.",
        );
    }
    if (response.status === 404) {
        throw new PublicApiError("Not found");
    }
    if (!response.ok) {
        throw new PublicApiError(`The public API returned ${response.status}.`);
    }
    const payload: unknown = await response.json();
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
        throw new PublicApiError("The public API returned an unexpected response.");
    }
    return parsed.data;
}

export async function getPublicResults(slug: string): Promise<PublicResults> {
    return publicRequest(
        `/api/v1/public/competitions/${encodeURIComponent(slug)}/results`,
        publicResultsSchema,
    );
}

export async function getPublicCertificate(teamId: string): Promise<PublicCertificate> {
    return publicRequest(
        `/api/v1/public/certificates/${encodeURIComponent(teamId)}`,
        publicCertificateSchema,
    );
}
