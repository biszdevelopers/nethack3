import { describe, expect, it } from "vitest";
import type {
    JudgeAssignmentStatus,
    JudgeFlagStatus,
    MembershipStatus,
    OrganizationRole,
} from "@nethack/contracts";
import { ConflictError } from "../../../core/errors.js";
import {
    flagNotificationDedupeKey,
    flagNotificationRecipients,
    JudgeFlagRules,
} from "../domain/judge-flags.js";

describe("JudgeFlagRules.assertCanFlag", () => {
    const allowed: readonly JudgeAssignmentStatus[] = ["assigned", "in_progress", "submitted"];
    const blocked: readonly JudgeAssignmentStatus[] = ["conflict_declared", "revoked"];

    it.each(allowed)("allows a flag from %s", (status) => {
        expect(() => JudgeFlagRules.assertCanFlag(status)).not.toThrow();
    });

    it.each(blocked)("blocks a flag from %s", (status) => {
        expect(() => JudgeFlagRules.assertCanFlag(status)).toThrow(ConflictError);
    });
});

describe("JudgeFlagRules.resolution", () => {
    it("resolves an open flag", () => {
        expect(JudgeFlagRules.resolution("open")).toBe("resolved");
    });

    it("keeps a resolved flag resolved", () => {
        const status: JudgeFlagStatus = "resolved";
        expect(JudgeFlagRules.resolution(status)).toBeNull();
    });
});

function member(userId: string, role: OrganizationRole, status: MembershipStatus = "active") {
    return { userId, role, status };
}

describe("flagNotificationRecipients", () => {
    it("notifies active owners and organizers only", () => {
        const recipients = flagNotificationRecipients(
            [
                member("owner", "owner"),
                member("organizer", "organizer"),
                member("judge", "judge"),
                member("participant", "participant"),
                member("suspended", "organizer", "suspended"),
            ],
            "judge",
        );

        expect(recipients.map((recipient) => recipient.userId)).toEqual(["owner", "organizer"]);
    });

    it("never notifies the reporting judge", () => {
        const recipients = flagNotificationRecipients(
            [member("reporter", "organizer"), member("owner", "owner")],
            "reporter",
        );

        expect(recipients.map((recipient) => recipient.userId)).toEqual(["owner"]);
    });

    it("returns nothing when the organization has no organizers", () => {
        expect(flagNotificationRecipients([member("judge", "judge")], "judge")).toEqual([]);
    });

    it("builds one dedupe key per flag and recipient", () => {
        expect(flagNotificationDedupeKey("org", "flag", "user")).toBe(
            "judging.flag.reported:org:flag:user",
        );
    });
});
