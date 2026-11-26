import { describe, expect, it } from "vitest";
import { ConflictError } from "../../../core/errors.js";
import { SubmissionRules, type EditionSubmissionWindow } from "../domain/submission-rules.js";

const openWindow: EditionSubmissionWindow = {
    status: "active",
    startsAt: "2026-02-01T00:00:00.000Z",
    endsAt: "2026-02-28T23:59:59.000Z",
};

describe("SubmissionRules submission window", () => {
    it("accepts a time inside the window", () => {
        expect(() =>
            SubmissionRules.assertSubmissionWindow(
                openWindow,
                new Date("2026-02-10T12:00:00.000Z"),
            ),
        ).not.toThrow();
    });

    it("accepts both window boundaries", () => {
        expect(() =>
            SubmissionRules.assertSubmissionWindow(
                openWindow,
                new Date("2026-02-01T00:00:00.000Z"),
            ),
        ).not.toThrow();
        expect(() =>
            SubmissionRules.assertSubmissionWindow(
                openWindow,
                new Date("2026-02-28T23:59:59.000Z"),
            ),
        ).not.toThrow();
    });

    it("rejects before the window opens", () => {
        expect(() =>
            SubmissionRules.assertSubmissionWindow(
                openWindow,
                new Date("2026-01-31T23:59:59.000Z"),
            ),
        ).toThrow(ConflictError);
        expect(() =>
            SubmissionRules.assertSubmissionWindow(
                openWindow,
                new Date("2026-01-31T23:59:59.000Z"),
            ),
        ).toThrow("The submission window has not opened yet.");
    });

    it("rejects after the deadline", () => {
        expect(() =>
            SubmissionRules.assertSubmissionWindow(
                openWindow,
                new Date("2026-03-01T00:00:00.000Z"),
            ),
        ).toThrow("The submission deadline has passed.");
    });

    it("accepts editions without a start or end time", () => {
        expect(() =>
            SubmissionRules.assertSubmissionWindow(
                { status: "active", startsAt: null, endsAt: null },
                new Date("2030-01-01T00:00:00.000Z"),
            ),
        ).not.toThrow();
    });

    it("rejects completed and archived editions", () => {
        expect(() =>
            SubmissionRules.assertSubmissionWindow(
                { ...openWindow, status: "completed" },
                new Date("2026-02-10T12:00:00.000Z"),
            ),
        ).toThrow(ConflictError);
        expect(() =>
            SubmissionRules.assertSubmissionWindow(
                { ...openWindow, status: "archived" },
                new Date("2026-02-10T12:00:00.000Z"),
            ),
        ).toThrow(ConflictError);
    });

    it("rejects editions that are not accepting submissions", () => {
        expect(() =>
            SubmissionRules.assertSubmissionWindow(
                { ...openWindow, status: "draft" },
                new Date("2026-02-10T12:00:00.000Z"),
            ),
        ).toThrow(ConflictError);
        expect(() =>
            SubmissionRules.assertSubmissionWindow(
                { ...openWindow, status: "voting" },
                new Date("2026-02-10T12:00:00.000Z"),
            ),
        ).toThrow(ConflictError);
    });
});

describe("SubmissionRules display title", () => {
    it("prefers the current version title", () => {
        expect(SubmissionRules.displayTitle("Version title", "Project title")).toBe(
            "Version title",
        );
    });

    it("falls back to the project title without a version", () => {
        expect(SubmissionRules.displayTitle(null, "Project title")).toBe("Project title");
        expect(SubmissionRules.displayTitle("", "Project title")).toBe("Project title");
        expect(SubmissionRules.displayTitle("   ", "Project title")).toBe("Project title");
    });

    it("uses the placeholder only when neither title exists", () => {
        expect(SubmissionRules.displayTitle(null, null)).toBe("Untitled project");
        expect(SubmissionRules.displayTitle(null, " ")).toBe("Untitled project");
    });
});

describe("SubmissionRules review transitions", () => {
    it("allows every first review decision from submitted", () => {
        for (const target of [
            "under_review",
            "changes_requested",
            "accepted",
            "rejected",
            "disqualified",
        ] as const) {
            expect(SubmissionRules.canTransition("submitted", target)).toBe(true);
            expect(() => SubmissionRules.assertReviewTransition("submitted", target)).not.toThrow();
        }
    });

    it("allows review decisions from under_review", () => {
        for (const target of [
            "changes_requested",
            "accepted",
            "rejected",
            "disqualified",
        ] as const) {
            expect(() =>
                SubmissionRules.assertReviewTransition("under_review", target),
            ).not.toThrow();
        }
        expect(SubmissionRules.canTransition("under_review", "submitted")).toBe(false);
    });

    it("allows corrections to return to review", () => {
        expect(SubmissionRules.canTransition("changes_requested", "under_review")).toBe(true);
        expect(SubmissionRules.canTransition("changes_requested", "accepted")).toBe(true);
        expect(SubmissionRules.canTransition("changes_requested", "rejected")).toBe(true);
        expect(SubmissionRules.canTransition("changes_requested", "disqualified")).toBe(false);
    });

    it("treats accepted and rejected as idempotent but final", () => {
        expect(() => SubmissionRules.assertReviewTransition("accepted", "accepted")).not.toThrow();
        expect(() => SubmissionRules.assertReviewTransition("rejected", "rejected")).not.toThrow();
        expect(() => SubmissionRules.assertReviewTransition("accepted", "rejected")).toThrow(
            ConflictError,
        );
        expect(() => SubmissionRules.assertReviewTransition("rejected", "under_review")).toThrow(
            ConflictError,
        );
    });

    it("rejects review of drafts, withdrawn, and disqualified submissions", () => {
        for (const from of ["draft", "withdrawn", "disqualified"] as const) {
            expect(() => SubmissionRules.assertReviewTransition(from, "accepted")).toThrow(
                ConflictError,
            );
        }
    });

    it("rejects unknown transitions with a state message", () => {
        expect(() => SubmissionRules.assertReviewTransition("draft", "accepted")).toThrow(
            "A draft submission cannot move to accepted.",
        );
    });
});

describe("SubmissionRules revision and withdrawal", () => {
    it("allows revisions only before review locks the submission", () => {
        for (const status of ["draft", "submitted", "changes_requested"] as const) {
            expect(() => SubmissionRules.assertRevisable(status)).not.toThrow();
        }
        for (const status of [
            "under_review",
            "accepted",
            "rejected",
            "withdrawn",
            "disqualified",
        ] as const) {
            expect(() => SubmissionRules.assertRevisable(status)).toThrow(ConflictError);
        }
    });

    it("allows withdrawal only for draft, submitted, and changes requested", () => {
        for (const status of ["draft", "submitted", "changes_requested"] as const) {
            expect(() => SubmissionRules.assertWithdrawable(status)).not.toThrow();
        }
        for (const status of [
            "under_review",
            "accepted",
            "rejected",
            "withdrawn",
            "disqualified",
        ] as const) {
            expect(() => SubmissionRules.assertWithdrawable(status)).toThrow(ConflictError);
        }
    });
});
