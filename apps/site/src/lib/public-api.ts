import {
    listResponseSchema,
    publicAnnouncementSchema,
    publicCompetitionDetailSchema,
    publicCompetitionSchema,
    publicProjectSchema,
    publicRubricSchema,
    publicUserProfileSchema,
    type ListResponse,
    type PublicAnnouncement,
    type PublicCompetition,
    type PublicCompetitionDetail,
    type PublicProject,
    type PublicRubric,
    type PublicUserProfile,
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
            // Dev renders on demand so fixture changes are visible without a rebuild.
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

const competitionListSchema = listResponseSchema(publicCompetitionSchema);
const competitionDetailSchema = publicCompetitionDetailSchema;
const projectListSchema = listResponseSchema(publicProjectSchema);
const announcementListSchema = listResponseSchema(publicAnnouncementSchema);
const rubricListSchema = publicRubricSchema.array();

export async function getCompetitions(): Promise<ListResponse<PublicCompetition>> {
    return publicRequest("/api/v1/public/competitions", competitionListSchema);
}

export async function getCompetition(slug: string): Promise<PublicCompetitionDetail> {
    return publicRequest(
        `/api/v1/public/competitions/${encodeURIComponent(slug)}`,
        competitionDetailSchema,
    );
}

export async function getCompetitionRubric(editionId: string): Promise<readonly PublicRubric[]> {
    return publicRequest(
        `/api/v1/public/editions/${encodeURIComponent(editionId)}/rubric`,
        rubricListSchema,
    );
}

export async function getProjects(competition?: string): Promise<ListResponse<PublicProject>> {
    const query =
        competition === undefined ? "" : `?competition=${encodeURIComponent(competition)}`;
    return publicRequest(`/api/v1/public/projects${query}`, projectListSchema);
}

const MAX_PROJECT_PAGES = 50;

export async function getAllProjects(competition?: string): Promise<readonly PublicProject[]> {
    const projects: PublicProject[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < MAX_PROJECT_PAGES; page += 1) {
        const params = new URLSearchParams({ limit: "100" });
        if (competition !== undefined) {
            params.set("competition", competition);
        }
        if (cursor !== null) {
            params.set("cursor", cursor);
        }
        const response = await publicRequest(
            `/api/v1/public/projects?${params.toString()}`,
            projectListSchema,
        );
        projects.push(...response.items);
        cursor = response.nextCursor;
        if (cursor === null) {
            return projects;
        }
    }
    throw new PublicApiError("The public project archive is too large to load.");
}

export async function getProject(slug: string): Promise<PublicProject> {
    return publicRequest(
        `/api/v1/public/projects/${encodeURIComponent(slug)}`,
        publicProjectSchema,
    );
}

export async function getAnnouncements(): Promise<ListResponse<PublicAnnouncement>> {
    return publicRequest("/api/v1/public/announcements", announcementListSchema);
}

export async function getPublicUserProfile(userId: string): Promise<PublicUserProfile> {
    return publicRequest(
        `/api/v1/public/users/${encodeURIComponent(userId)}`,
        publicUserProfileSchema,
    );
}
