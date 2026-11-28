import { describe, expect, it } from "vitest";
import { toProjectDisclosure } from "../application/project-disclosure.js";

describe("toProjectDisclosure", () => {
    it("returns an empty disclosure for a missing project", () => {
        expect(toProjectDisclosure(null)).toEqual({ videoUrl: null, aiDisclosure: "" });
    });

    it("reads the demonstration video and AI-use disclosure", () => {
        expect(
            toProjectDisclosure({
                videoUrl: "https://videos.example.org/demo.mp4",
                aiDisclosure: "Generated placeholder art with an image model.",
            }),
        ).toEqual({
            videoUrl: "https://videos.example.org/demo.mp4",
            aiDisclosure: "Generated placeholder art with an image model.",
        });
    });

    it("defaults fields a project row has not provided", () => {
        expect(toProjectDisclosure({ title: "Legacy project" })).toEqual({
            videoUrl: null,
            aiDisclosure: "",
        });
    });
});
