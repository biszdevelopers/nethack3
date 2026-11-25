import {
    listResponseSchema,
    publicAnnouncementSchema,
    publicCompetitionDetailSchema,
    publicCompetitionSchema,
    publicProjectSchema,
    type ListResponse,
    type PublicAnnouncement,
    type PublicCompetition,
    type PublicCompetitionDetail,
    type PublicProject,
} from "@nethack/contracts";
import type { z } from "zod";

const API_ORIGIN = process.env.PUBLIC_API_ORIGIN ?? "http://localhost:3002";
const REVALIDATE_SECONDS = 60;

export class PublicApiError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PublicApiError";
    }
}

async function publicRequest<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    let response: Response;
    try {
        response = await fetch(new URL(path, API_ORIGIN), {
            headers: { Accept: "application/json" },
            next: { revalidate: REVALIDATE_SECONDS },
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

const competitionListSchema = listResponseSchema(publicCompetitionSchema);
const competitionDetailSchema = publicCompetitionDetailSchema;
const projectListSchema = listResponseSchema(publicProjectSchema);
const announcementListSchema = listResponseSchema(publicAnnouncementSchema);

export async function getCompetitions(): Promise<ListResponse<PublicCompetition>> {
    return publicRequest("/api/v1/public/competitions", competitionListSchema);
}

export async function getCompetition(slug: string): Promise<PublicCompetitionDetail> {
    return publicRequest(
        `/api/v1/public/competitions/${encodeURIComponent(slug)}`,
        competitionDetailSchema,
    );
}

export async function getProjects(competition?: string): Promise<ListResponse<PublicProject>> {
    const query = competition === undefined ? "" : `?competition=${encodeURIComponent(competition)}`;
    return publicRequest(`/api/v1/public/projects${query}`, projectListSchema);
}

export async function getProject(slug: string): Promise<PublicProject> {
    return publicRequest(`/api/v1/public/projects/${encodeURIComponent(slug)}`, publicProjectSchema);
}

export async function getAnnouncements(): Promise<ListResponse<PublicAnnouncement>> {
    return publicRequest("/api/v1/public/announcements", announcementListSchema);
}
