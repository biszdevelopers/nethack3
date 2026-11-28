import { describe, expect, it } from "vitest";
import {
    createProjectRequestSchema,
    projectSchema,
    updateProjectRequestSchema,
} from "@nethack/contracts";

const editionId = "f1000000-0000-4000-8000-000000000003";

const baseCreate = {
    editionId,
    title: "Media project",
    summary: "A project with a demonstration video and an AI-use disclosure.",
};

const validProject = {
    id: "f1000000-0000-4000-8000-000000000030",
    organizationId: "f1000000-0000-4000-8000-000000000001",
    editionId,
    teamId: null,
    ownerUserId: "f1000000-0000-4000-8000-000000000011",
    title: "Media project",
    slug: "media-project",
    summary: "A project with a demonstration video and an AI-use disclosure.",
    descriptionMarkdown: "",
    repositoryUrl: null,
    demoUrl: null,
    videoUrl: null,
    aiDisclosure: "",
    tags: [],
    status: "draft",
    publishedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("project media contracts", () => {
    it("defaults the video URL and AI-use disclosure on create", () => {
        const parsed = createProjectRequestSchema.parse(baseCreate);
        expect(parsed.videoUrl).toBeNull();
        expect(parsed.aiDisclosure).toBe("");
    });

    it("accepts an http video URL and trims the disclosure", () => {
        const parsed = createProjectRequestSchema.parse({
            ...baseCreate,
            videoUrl: "https://example.com/demo.mp4",
            aiDisclosure: "  No AI tools or models were used in this project.  ",
        });
        expect(parsed.videoUrl).toBe("https://example.com/demo.mp4");
        expect(parsed.aiDisclosure).toBe("No AI tools or models were used in this project.");
    });

    it("rejects a non-http video URL and an over-long disclosure", () => {
        expect(
            createProjectRequestSchema.safeParse({
                ...baseCreate,
                videoUrl: "ftp://example.com/demo.mp4",
            }).success,
        ).toBe(false);
        expect(
            createProjectRequestSchema.safeParse({
                ...baseCreate,
                aiDisclosure: "a".repeat(2001),
            }).success,
        ).toBe(false);
    });

    it("keeps the new update fields optional", () => {
        expect(updateProjectRequestSchema.parse({})).toEqual({});
        expect(updateProjectRequestSchema.parse({ videoUrl: null }).videoUrl).toBeNull();
        expect(updateProjectRequestSchema.parse({ aiDisclosure: "" }).aiDisclosure).toBe("");
    });

    it("requires both fields on project responses", () => {
        expect(projectSchema.safeParse(validProject).success).toBe(true);
        expect(projectSchema.safeParse({ ...validProject, videoUrl: undefined }).success).toBe(
            false,
        );
        expect(projectSchema.safeParse({ ...validProject, aiDisclosure: undefined }).success).toBe(
            false,
        );
    });
});
