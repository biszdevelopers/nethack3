import type {
    JudgeAssignmentStatus,
    JudgeFlagStatus,
    MembershipStatus,
    OrganizationRole,
} from "@nethack/contracts";
import { ConflictError } from "../../../core/errors.js";

export class JudgeFlagRules {
    static assertCanFlag(status: JudgeAssignmentStatus): void {
        if (status !== "assigned" && status !== "in_progress" && status !== "submitted") {
            throw new ConflictError(
                "A flag can only be reported for an active, in-progress, or submitted assignment.",
            );
        }
    }

    static resolution(status: JudgeFlagStatus): "resolved" | null {
        return status === "open" ? "resolved" : null;
    }
}

export interface FlagRecipientCandidate {
    readonly userId: string;
    readonly role: OrganizationRole;
    readonly status: MembershipStatus;
}

/**
 * Organizers who should hear about a new judge flag. The reporting judge is
 * excluded even when they hold an organizer role, and suspended memberships
 * never receive notifications.
 */
export function flagNotificationRecipients(
    candidates: readonly FlagRecipientCandidate[],
    reporterUserId: string,
): readonly FlagRecipientCandidate[] {
    return candidates.filter(
        (candidate) =>
            candidate.status === "active" &&
            (candidate.role === "owner" || candidate.role === "organizer") &&
            candidate.userId !== reporterUserId,
    );
}

export function flagNotificationDedupeKey(
    organizationId: string,
    flagId: string,
    userId: string,
): string {
    return `judging.flag.reported:${organizationId}:${flagId}:${userId}`;
}
