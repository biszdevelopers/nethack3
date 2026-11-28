import type { SubmissionStatus } from "@nethack/contracts";

export interface SubmissionSummary {
    readonly id: string;
    readonly organizationId: string;
    readonly editionId: string;
    readonly projectId: string;
    readonly teamId: string | null;
    readonly status: SubmissionStatus;
    readonly currentVersion: number;
    readonly submittedAt: string | null;
    readonly title: string;
    readonly summary: string;
}

export type SubmissionReopenStatus = "draft" | "changes_requested";

/**
 * Administration operations assume the caller has already established an
 * owner/organizer membership in the addressed organization. The reopened state
 * is only allowed when no submitted evaluation exists; callers verify that
 * through the judging contract before calling.
 */
export interface SubmissionAdministrationActor {
    readonly userId: string;
    readonly ip: string | null;
}

export interface SubmissionsContract {
    getSubmission(organizationId: string, submissionId: string): Promise<SubmissionSummary | null>;
    listEditionSubmissions(
        organizationId: string,
        editionId: string,
    ): Promise<readonly SubmissionSummary[]>;
    isSubmittedForProject(organizationId: string, projectId: string): Promise<boolean>;
    countSubmissions(organizationId: string, editionId: string): Promise<number>;
    countTeamSubmissions(
        organizationId: string,
        editionId: string,
        teamId: string,
    ): Promise<number>;
    reopenSubmission(
        actor: SubmissionAdministrationActor,
        organizationId: string,
        submissionId: string,
        status: SubmissionReopenStatus,
    ): Promise<void>;
}

export const SUBMISSIONS_CONTRACT = "submissions.v1";
