import type { JudgeAssignmentStatus, JudgeFlagStatus } from "@nethack/contracts";
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
