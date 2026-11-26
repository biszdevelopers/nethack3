import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
    CreateSubmissionRequest,
    CreateSubmissionVersionRequest,
    ReviewSubmissionRequest,
} from "@nethack/contracts";
import { resources } from "../../../application/resources.js";

export interface SubmissionFilters {
    readonly editionId?: string | undefined;
    readonly projectId?: string | undefined;
    readonly mine?: boolean | undefined;
}

function filterKey(filters: SubmissionFilters): string {
    return [filters.editionId ?? "", filters.projectId ?? "", String(filters.mine ?? false)].join(
        "|",
    );
}

export const submissionKeys = {
    all: ["submissions"] as const,
    list: (filters: SubmissionFilters) => ["submissions", "list", filterKey(filters)] as const,
    detail: (submissionId: string) => ["submissions", "detail", submissionId] as const,
    versions: (submissionId: string) => ["submissions", "versions", submissionId] as const,
};

export function useSubmissions(filters: SubmissionFilters = {}) {
    return useQuery({
        queryKey: submissionKeys.list(filters),
        queryFn: () =>
            resources.submissions.list({
                ...(filters.editionId === undefined ? {} : { editionId: filters.editionId }),
                ...(filters.projectId === undefined ? {} : { projectId: filters.projectId }),
                ...(filters.mine === undefined ? {} : { mine: filters.mine }),
                limit: 100,
            }),
    });
}

export function useSubmission(submissionId: string | null) {
    return useQuery({
        queryKey: submissionKeys.detail(submissionId ?? "none"),
        queryFn: async () => {
            if (submissionId === null) {
                return null;
            }
            return resources.submissions.get(submissionId);
        },
        enabled: submissionId !== null,
    });
}

export function useSubmissionVersions(submissionId: string | null) {
    return useQuery({
        queryKey: submissionKeys.versions(submissionId ?? "none"),
        queryFn: async () => {
            if (submissionId === null) {
                return { items: [], nextCursor: null };
            }
            return resources.submissions.versions(submissionId);
        },
        enabled: submissionId !== null,
    });
}

export function useCreateSubmission() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: CreateSubmissionRequest) => resources.submissions.create(input),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: submissionKeys.all });
            await queryClient.invalidateQueries({ queryKey: ["projects"] });
        },
    });
}

export function useCreateSubmissionVersion(submissionId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: CreateSubmissionVersionRequest) =>
            resources.submissions.createVersion(submissionId, input),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: submissionKeys.all });
        },
    });
}

export function useReviewSubmission(submissionId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: ReviewSubmissionRequest) =>
            resources.submissions.review(submissionId, input),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: submissionKeys.all });
        },
    });
}

export function useWithdrawSubmission(submissionId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => resources.submissions.withdraw(submissionId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: submissionKeys.all });
        },
    });
}
