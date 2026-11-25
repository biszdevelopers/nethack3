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

export interface SubmissionsContract {
    getSubmission(organizationId: string, submissionId: string): Promise<SubmissionSummary | null>;
    listEditionSubmissions(
        organizationId: string,
        editionId: string,
    ): Promise<readonly SubmissionSummary[]>;
    isSubmittedForProject(organizationId: string, projectId: string): Promise<boolean>;
    countSubmissions(organizationId: string, editionId: string): Promise<number>;
}

export const SUBMISSIONS_CONTRACT = "submissions.v1";
