import type {
    CompetitionEditionStatus,
    OrganizationRole,
    SubmissionStatus,
} from "@nethack/contracts";
import { ConflictError } from "../../../core/errors.js";

export interface EditionSubmissionWindow {
    readonly status: CompetitionEditionStatus;
    readonly startsAt: string | null;
    readonly endsAt: string | null;
}

/** Revision is allowed while a submission is not locked by review. */
const REVISABLE_STATUSES: ReadonlySet<SubmissionStatus> = new Set([
    "draft",
    "submitted",
    "changes_requested",
]);

const WITHDRAWABLE_STATUSES: ReadonlySet<SubmissionStatus> = new Set([
    "draft",
    "submitted",
    "changes_requested",
]);

const OPEN_EDITION_STATUSES: ReadonlySet<CompetitionEditionStatus> = new Set([
    "published",
    "registration_open",
    "registration_closed",
    "active",
    "judging",
]);

/** Explicit review state machine. Statuses outside the map are terminal. */
const REVIEW_TRANSITIONS: Readonly<Record<SubmissionStatus, readonly SubmissionStatus[]>> = {
    draft: [],
    submitted: ["under_review", "changes_requested", "accepted", "rejected", "disqualified"],
    under_review: ["changes_requested", "accepted", "rejected", "disqualified"],
    changes_requested: ["under_review", "accepted", "rejected"],
    accepted: ["accepted"],
    rejected: ["rejected"],
    withdrawn: [],
    disqualified: [],
};

export class SubmissionRules {
    static isOrganizer(role: OrganizationRole): boolean {
        return role === "owner" || role === "organizer";
    }

    /**
     * Display title: current version title, then project title, then a neutral
     * placeholder. Never fabricate content beyond the placeholder.
     */
    static displayTitle(versionTitle: string | null, projectTitle: string | null): string {
        if (versionTitle !== null && versionTitle.trim().length > 0) {
            return versionTitle;
        }
        if (projectTitle !== null && projectTitle.trim().length > 0) {
            return projectTitle;
        }
        return "Untitled project";
    }

    static assertSubmissionWindow(edition: EditionSubmissionWindow, now: Date): void {
        if (edition.status === "completed" || edition.status === "archived") {
            throw new ConflictError(
                "This competition has ended and no longer accepts submissions.",
            );
        }
        if (!OPEN_EDITION_STATUSES.has(edition.status)) {
            throw new ConflictError("This competition is not accepting submissions.");
        }
        if (edition.startsAt !== null && now.getTime() < new Date(edition.startsAt).getTime()) {
            throw new ConflictError("The submission window has not opened yet.");
        }
        if (edition.endsAt !== null && now.getTime() > new Date(edition.endsAt).getTime()) {
            throw new ConflictError("The submission deadline has passed.");
        }
    }

    static canTransition(from: SubmissionStatus, to: SubmissionStatus): boolean {
        return (REVIEW_TRANSITIONS[from] ?? []).includes(to);
    }

    static assertReviewTransition(from: SubmissionStatus, to: SubmissionStatus): void {
        if (!SubmissionRules.canTransition(from, to)) {
            throw new ConflictError(`A ${from} submission cannot move to ${to}.`);
        }
    }

    static assertRevisable(status: SubmissionStatus): void {
        if (!REVISABLE_STATUSES.has(status)) {
            throw new ConflictError(`A ${status} submission cannot receive a new version.`);
        }
    }

    static assertWithdrawable(status: SubmissionStatus): void {
        if (!WITHDRAWABLE_STATUSES.has(status)) {
            throw new ConflictError(`A ${status} submission cannot be withdrawn.`);
        }
    }

    /** Administrative reopen returns a submitted submission to an editable state. */
    static assertReopenable(status: SubmissionStatus): void {
        if (status !== "submitted") {
            throw new ConflictError("Only a submitted submission can be reopened.");
        }
    }
}
