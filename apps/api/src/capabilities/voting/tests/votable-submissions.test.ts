import { describe, expect, it } from "vitest";
import type { SubmissionStatus } from "@nethack/contracts";
import type { BallotEligibility } from "../domain/ballot-eligibility.js";
import {
    hasVotableTeamSubmission,
    toVotableSubmissions,
    type VotableSubmissionSource,
    type VotableTeamInfo,
} from "../domain/votable-submissions.js";

const TEAM_ID = "3d0f2d0e-1111-4111-8111-111111111111";
const OTHER_TEAM_ID = "3d0f2d0e-2222-4222-8222-222222222222";
const THIRD_TEAM_ID = "3d0f2d0e-3333-4333-8333-333333333333";
const DIVISION_ID = "5e0f2d0e-1111-4111-8111-111111111111";
const OTHER_DIVISION_ID = "5e0f2d0e-2222-4222-8222-222222222222";

const VIEWER: BallotEligibility = {
    teamId: TEAM_ID,
    divisionId: DIVISION_ID,
    active: true,
};

const TEAMS = new Map<string, VotableTeamInfo>([
    [TEAM_ID, { name: "Falcons", divisionId: DIVISION_ID, divisionName: "Open" }],
    [OTHER_TEAM_ID, { name: "Owls", divisionId: DIVISION_ID, divisionName: "Open" }],
    [THIRD_TEAM_ID, { name: "Foxes", divisionId: OTHER_DIVISION_ID, divisionName: "Junior" }],
]);

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

describe("hasVotableTeamSubmission", () => {
    it("accepts a team with submitted, under review, changes requested, or accepted work", () => {
        for (const status of [
            "submitted",
            "under_review",
            "changes_requested",
            "accepted",
        ] as const) {
            expect(hasVotableTeamSubmission([{ teamId: TEAM_ID, status }], TEAM_ID)).toBe(true);
        }
    });

    it("rejects a draft-only team and submissions from another team", () => {
        expect(hasVotableTeamSubmission([{ teamId: TEAM_ID, status: "draft" }], TEAM_ID)).toBe(
            false,
        );
        expect(
            hasVotableTeamSubmission([{ teamId: OTHER_TEAM_ID, status: "submitted" }], TEAM_ID),
        ).toBe(false);
        expect(hasVotableTeamSubmission([], TEAM_ID)).toBe(false);
    });

    it("rejects a null team id", () => {
        expect(hasVotableTeamSubmission([{ teamId: null, status: "submitted" }], null)).toBe(false);
    });
});

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

    it("maps the public fields, team name, and division name", () => {
        const result = toVotableSubmissions(
            [source("a", "submitted", { teamId: OTHER_TEAM_ID })],
            TEAMS,
        );
        expect(result).toEqual([
            {
                id: "a",
                projectTitle: "Project a",
                summary: "Summary a",
                teamId: OTHER_TEAM_ID,
                teamName: "Owls",
                divisionName: "Open",
                videoUrl: null,
                aiDisclosure: "",
                repositoryUrl: null,
                demoUrl: null,
            },
        ]);
    });

    it("passes the demonstration video and AI-use disclosure through", () => {
        const result = toVotableSubmissions(
            [
                source("a", "submitted", {
                    teamId: OTHER_TEAM_ID,
                    videoUrl: "https://videos.example.org/demo.mp4",
                    aiDisclosure: "Used a code assistant for boilerplate.",
                }),
            ],
            TEAMS,
        );
        expect(result[0]?.videoUrl).toBe("https://videos.example.org/demo.mp4");
        expect(result[0]?.aiDisclosure).toBe("Used a code assistant for boilerplate.");
    });

    it("keeps a null team and never resolves a name for it", () => {
        const result = toVotableSubmissions(
            [source("a", "accepted", { teamId: null })],
            new Map([
                [TEAM_ID, { name: "Falcons", divisionId: DIVISION_ID, divisionName: "Open" }],
            ]),
        );
        expect(result[0]?.teamId).toBeNull();
        expect(result[0]?.teamName).toBeNull();
        expect(result[0]?.divisionName).toBeNull();
    });

    it("uses null names when the team cannot be resolved", () => {
        const result = toVotableSubmissions([source("a", "submitted")], new Map());
        expect(result[0]?.teamId).toBe(TEAM_ID);
        expect(result[0]?.teamName).toBeNull();
        expect(result[0]?.divisionName).toBeNull();
    });

    it("returns an empty list when no submission is votable", () => {
        expect(toVotableSubmissions([source("a", "draft")], new Map())).toEqual([]);
    });

    it("keeps only submissions from the voter's division", () => {
        const result = toVotableSubmissions(
            [
                source("same", "submitted", { teamId: OTHER_TEAM_ID }),
                source("other", "submitted", { teamId: THIRD_TEAM_ID }),
            ],
            TEAMS,
            VIEWER,
        );
        expect(result.map((submission) => submission.id)).toEqual(["same"]);
    });

    it("excludes the voter's own team even inside the same division", () => {
        const result = toVotableSubmissions(
            [
                source("own", "submitted", { teamId: TEAM_ID }),
                source("same", "submitted", { teamId: OTHER_TEAM_ID }),
            ],
            TEAMS,
            VIEWER,
        );
        expect(result.map((submission) => submission.id)).toEqual(["same"]);
    });

    it("keeps a teamless judge's ballot unrestricted", () => {
        const result = toVotableSubmissions(
            [
                source("a", "submitted", { teamId: TEAM_ID }),
                source("b", "submitted", { teamId: THIRD_TEAM_ID }),
            ],
            TEAMS,
            { teamId: null, divisionId: null, active: true },
        );
        expect(result.map((submission) => submission.id)).toEqual(["a", "b"]);
    });

    it("keeps every division for a judge's team without one but still excludes the own team", () => {
        const result = toVotableSubmissions(
            [
                source("own", "submitted", { teamId: TEAM_ID }),
                source("a", "submitted", { teamId: OTHER_TEAM_ID }),
                source("b", "submitted", { teamId: THIRD_TEAM_ID }),
            ],
            TEAMS,
            { teamId: TEAM_ID, divisionId: null, active: true },
        );
        expect(result.map((submission) => submission.id)).toEqual(["a", "b"]);
    });

    it("returns no options for a withdrawn, disqualified, no-show, or disbanded team", () => {
        expect(
            toVotableSubmissions([source("a", "submitted", { teamId: OTHER_TEAM_ID })], TEAMS, {
                teamId: TEAM_ID,
                divisionId: DIVISION_ID,
                active: false,
            }),
        ).toEqual([]);
    });

    it("lets an organizer scope review every votable submission", () => {
        const result = toVotableSubmissions(
            [
                source("own", "submitted", { teamId: TEAM_ID }),
                source("same", "submitted", { teamId: OTHER_TEAM_ID }),
                source("other", "submitted", { teamId: THIRD_TEAM_ID }),
            ],
            TEAMS,
            null,
        );
        expect(result.map((submission) => submission.id)).toEqual(["own", "same", "other"]);
    });
});
