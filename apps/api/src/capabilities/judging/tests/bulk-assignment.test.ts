import { describe, expect, it } from "vitest";
import {
    planBulkAssignments,
    selectBulkSubmissionIds,
    type BulkSubmissionCandidate,
} from "../domain/bulk-assignment.js";

const submissions: readonly BulkSubmissionCandidate[] = [
    { id: "s1", teamId: "t1", status: "submitted" },
    { id: "s2", teamId: "t1", status: "accepted" },
    { id: "s3", teamId: "t2", status: "draft" },
    { id: "s4", teamId: "t2", status: "submitted" },
    { id: "s5", teamId: null, status: "submitted" },
    { id: "s6", teamId: "t3", status: "rejected" },
];

describe("selectBulkSubmissionIds", () => {
    it("covers submitted and accepted submissions for the whole edition", () => {
        expect(selectBulkSubmissionIds({ scope: "all", submissions })).toEqual([
            "s1",
            "s2",
            "s4",
            "s5",
        ]);
    });

    it("restricts division scope to that division's submitted work", () => {
        expect(
            selectBulkSubmissionIds({
                scope: "division",
                submissions,
                divisionTeamIds: ["t2"],
            }),
        ).toEqual(["s4"]);
        expect(
            selectBulkSubmissionIds({
                scope: "division",
                submissions,
                divisionTeamIds: ["t1", "t3"],
            }),
        ).toEqual(["s1", "s2"]);
    });

    it("returns nothing for a division without submitted teams", () => {
        expect(
            selectBulkSubmissionIds({
                scope: "division",
                submissions,
                divisionTeamIds: ["missing"],
            }),
        ).toEqual([]);
    });

    it("assigns the named submission even before it is judgeable", () => {
        expect(
            selectBulkSubmissionIds({
                scope: "submission",
                submissions,
                submissionId: "s3",
            }),
        ).toEqual(["s3"]);
    });

    it("returns nothing for a submission outside the edition", () => {
        expect(
            selectBulkSubmissionIds({
                scope: "submission",
                submissions,
                submissionId: "missing",
            }),
        ).toEqual([]);
        expect(selectBulkSubmissionIds({ scope: "submission", submissions })).toEqual([]);
    });
});

describe("planBulkAssignments", () => {
    it("deduplicates candidates and skips active assignments", () => {
        expect(planBulkAssignments(["s1", "s1", "s2", "s3"], new Set(["s2", "s3"]))).toEqual({
            toAssign: ["s1"],
            skipped: 2,
        });
    });

    it("counts a duplicated active candidate once", () => {
        expect(planBulkAssignments(["s1", "s1"], new Set(["s1"]))).toEqual({
            toAssign: [],
            skipped: 1,
        });
    });

    it("assigns submissions whose previous assignment was revoked", () => {
        expect(planBulkAssignments(["s1", "s2"], new Set(["s2"]))).toEqual({
            toAssign: ["s1"],
            skipped: 1,
        });
    });
});
