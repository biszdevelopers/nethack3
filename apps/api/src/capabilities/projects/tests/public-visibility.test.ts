import { describe, expect, it } from "vitest";
import { filterShowcasedProjects } from "../domain/project-rules.js";

const showcaseEnabled = new Map<string, boolean>([
    ["org-enabled", true],
    ["org-disabled", false],
]);

const projects = [
    { id: "one", organizationId: "org-enabled" },
    { id: "two", organizationId: "org-disabled" },
    { id: "three", organizationId: "org-enabled" },
    { id: "four", organizationId: "org-missing" },
];

describe("public showcase filtering", () => {
    it("keeps projects from organizations with the showcase enabled", () => {
        const visible = filterShowcasedProjects(projects, showcaseEnabled);
        expect(visible.map((project) => project.id)).toEqual(["one", "three"]);
    });

    it("hides projects from disabled, missing, or unknown organizations", () => {
        const visible = filterShowcasedProjects(projects, showcaseEnabled);
        expect(visible.some((project) => project.id === "two")).toBe(false);
        expect(visible.some((project) => project.id === "four")).toBe(false);
        expect(filterShowcasedProjects(projects, new Map()).length).toBe(0);
    });

    it("preserves order and keeps repeated organizations", () => {
        const reordered = [
            { id: "three", organizationId: "org-enabled" },
            { id: "one", organizationId: "org-enabled" },
        ];
        expect(
            filterShowcasedProjects(reordered, showcaseEnabled).map((project) => project.id),
        ).toEqual(["three", "one"]);
    });
});
