import { describe, expect, it } from "vitest";
import type { SubmissionStatus } from "@nethack/contracts";
import {
    toVotableSubmissions,
    type VotableSubmissionSource,
} from "../domain/votable-submissions.js";

const TEAM_ID = "3d0f2d0e-1111-4111-8111-111111111111";
const OTHER_TEAM_ID = "3d0f2d0e-2222-4222-8222-222222222222";

function source(
    id: string,
    status: SubmissionStatus,
    overrides: Partial<VotableSubmissionSource> = {},
): VotableSubmissionSource {
    return {
        id,
        title: `Project ${id}`,
        summary: `Summary ${id}`,
        status,
        teamId: TEAM_ID,
        videoUrl: null,
        aiDisclosure: "",
        ...overrides,
    };
}

describe("toVotableSubmissions", () => {
    it("keeps only submissions in a votable status", () => {
        const result = toVotableSubmissions(
            [
                source("a", "submitted"),
                source("b", "draft"),
                source("c", "under_review"),
                source("d", "rejected"),
                source("e", "changes_requested"),
                source("f", "disqualified"),
                source("g", "accepted"),
                source("h", "withdrawn"),
            ],
            new Map(),
        );
        expect(result.map((submission) => submission.id)).toEqual(["a", "c", "e", "g"]);
    });

    it("maps the public fields and the resolved team name", () => {
        const result = toVotableSubmissions(
            [source("a", "submitted", { teamId: OTHER_TEAM_ID })],
            new Map([[OTHER_TEAM_ID, "Falcons"]]),
        );
        expect(result).toEqual([
            {
                id: "a",
                projectTitle: "Project a",
                summary: "Summary a",
                teamId: OTHER_TEAM_ID,
                teamName: "Falcons",
                videoUrl: null,
                aiDisclosure: "",
            },
        ]);
    });

    it("passes the demonstration video and AI-use disclosure through", () => {
        const result = toVotableSubmissions(
            [
                source("a", "submitted", {
                    videoUrl: "https://videos.example.org/demo.mp4",
                    aiDisclosure: "Used a code assistant for boilerplate.",
                }),
            ],
            new Map(),
        );
        expect(result[0]?.videoUrl).toBe("https://videos.example.org/demo.mp4");
        expect(result[0]?.aiDisclosure).toBe("Used a code assistant for boilerplate.");
    });

    it("keeps a null team and never resolves a name for it", () => {
        const result = toVotableSubmissions(
            [source("a", "accepted", { teamId: null })],
            new Map([[TEAM_ID, "Falcons"]]),
        );
        expect(result[0]?.teamId).toBeNull();
        expect(result[0]?.teamName).toBeNull();
    });

    it("uses a null team name when the team cannot be resolved", () => {
        const result = toVotableSubmissions([source("a", "submitted")], new Map());
        expect(result[0]?.teamId).toBe(TEAM_ID);
        expect(result[0]?.teamName).toBeNull();
    });

    it("returns an empty list when no submission is votable", () => {
        expect(toVotableSubmissions([source("a", "draft")], new Map())).toEqual([]);
    });
});
