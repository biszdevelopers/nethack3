import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
    ConflictDeclarationRequest,
    CreateRubricRequest,
    CreateAssignmentRequest,
    CreateJudgeFlagRequest,
    JudgeAssignmentStatus,
    SaveEvaluationRequest,
} from "@nethack/contracts";
import { api } from "../../application/api.js";
import { queryKeys } from "../shared/query-keys.js";
import { listEditionSubmissions } from "./edition-submissions.js";

const flagsKeyPrefix = (organizationId: string) => ["judging", organizationId, "flags"] as const;
const coverageKeyPrefix = (organizationId: string) =>
    ["judging", organizationId, "coverage"] as const;
const historyKeyPrefix = (organizationId: string) =>
    ["judging", organizationId, "history"] as const;

export function useMyAssignments(organizationId: string | null, status?: JudgeAssignmentStatus) {
    return useQuery({
        queryKey: [...queryKeys.judgingAssignments(organizationId ?? "none"), status ?? "all"],
        queryFn: async () => {
            if (organizationId === null) {
                return { items: [], nextCursor: null };
            }
            return api.judging.myAssignments(organizationId, status);
        },
        enabled: organizationId !== null,
    });
}

export function useEditionRubrics(organizationId: string | null, editionId: string | null) {
    return useQuery({
        queryKey: queryKeys.editionRubrics(editionId ?? "none"),
        queryFn: async () => {
            if (organizationId === null || editionId === null) {
                return { items: [], nextCursor: null };
            }
            return api.judging.rubrics(organizationId, editionId);
        },
        enabled: organizationId !== null && editionId !== null,
    });
}

export function useEditionAssignments(organizationId: string | null, editionId: string | null) {
    return useQuery({
        queryKey: queryKeys.editionAssignments(editionId ?? "none"),
        queryFn: async () => {
            if (organizationId === null || editionId === null) {
                return { items: [], nextCursor: null };
            }
            return api.judging.assignments(organizationId, editionId);
        },
        enabled: organizationId !== null && editionId !== null,
    });
}

export function useEditionJudgingResults(
    organizationId: string | null,
    editionId: string | null,
    enabled = true,
) {
    return useQuery({
        queryKey: queryKeys.editionJudgingResults(editionId ?? "none"),
        queryFn: async () => {
            if (organizationId === null || editionId === null) {
                return { items: [], nextCursor: null };
            }
            return api.judging.results(organizationId, editionId);
        },
        enabled: organizationId !== null && editionId !== null && enabled,
    });
}

export function useEditionSubmissions(
    organizationId: string | null,
    editionId: string | null,
    enabled = true,
) {
    return useQuery({
        queryKey: queryKeys.editionSubmissions(editionId ?? "none"),
        queryFn: async () => {
            if (organizationId === null || editionId === null) {
                return { items: [], nextCursor: null };
            }
            return listEditionSubmissions(organizationId, editionId);
        },
        enabled: organizationId !== null && editionId !== null && enabled,
    });
}

export function useAssignment(organizationId: string | null, assignmentId: string | null) {
    return useQuery({
        queryKey: queryKeys.judgingAssignment(assignmentId ?? "none"),
        queryFn: async () => {
            if (organizationId === null || assignmentId === null) {
                return null;
            }
            return api.judging.assignment(organizationId, assignmentId);
        },
        enabled: organizationId !== null && assignmentId !== null,
    });
}

export function useAssignmentHistory(organizationId: string | null, assignmentId: string | null) {
    return useQuery({
        queryKey: [...queryKeys.judgingAssignment(assignmentId ?? "none"), "history"],
        queryFn: async () => {
            if (organizationId === null || assignmentId === null) {
                return null;
            }
            return api.judging.history(organizationId, assignmentId);
        },
        enabled: organizationId !== null && assignmentId !== null,
    });
}

export function useCreateAssignment(organizationId: string | null, editionId: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: CreateAssignmentRequest) => {
            if (organizationId === null || editionId === null) {
                throw new Error("Select an edition first.");
            }
            return api.judging.createAssignment(organizationId, editionId, input);
        },
        onSuccess: async () => {
            if (editionId === null) {
                return;
            }
            await queryClient.invalidateQueries({
                queryKey: queryKeys.editionAssignments(editionId),
            });
        },
    });
}

export function useRevokeAssignment(organizationId: string | null, editionId: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (assignmentId: string) => {
            if (organizationId === null) {
                throw new Error("Select an organization first.");
            }
            return api.judging.revoke(organizationId, assignmentId);
        },
        onSuccess: async () => {
            if (organizationId !== null) {
                await queryClient.invalidateQueries({
                    queryKey: queryKeys.judgingAssignments(organizationId),
                });
            }
            if (editionId === null) {
                return;
            }
            await queryClient.invalidateQueries({
                queryKey: queryKeys.editionAssignments(editionId),
            });
        },
    });
}

export function useSaveEvaluation(organizationId: string | null, assignmentId: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: SaveEvaluationRequest) => {
            if (organizationId === null || assignmentId === null) {
                throw new Error("Select an assignment first.");
            }
            return api.judging.saveEvaluation(organizationId, assignmentId, input);
        },
        onSuccess: async () => {
            if (assignmentId === null) {
                return;
            }
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: queryKeys.judgingAssignment(assignmentId),
                }),
                queryClient.invalidateQueries({
                    queryKey: [...queryKeys.judgingAssignment(assignmentId), "history"],
                }),
                ...(organizationId === null
                    ? []
                    : [
                          queryClient.invalidateQueries({
                              queryKey: queryKeys.judgingAssignments(organizationId),
                          }),
                      ]),
            ]);
        },
    });
}

export function useSubmitEvaluation(organizationId: string | null, assignmentId: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            if (organizationId === null || assignmentId === null) {
                throw new Error("Select an assignment first.");
            }
            return api.judging.submitEvaluation(organizationId, assignmentId);
        },
        onSuccess: async () => {
            if (assignmentId === null) {
                return;
            }
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: queryKeys.judgingAssignment(assignmentId),
                }),
                queryClient.invalidateQueries({
                    queryKey: [...queryKeys.judgingAssignment(assignmentId), "history"],
                }),
                ...(organizationId === null
                    ? []
                    : [
                          queryClient.invalidateQueries({
                              queryKey: queryKeys.judgingAssignments(organizationId),
                          }),
                          queryClient.invalidateQueries({
                              queryKey: historyKeyPrefix(organizationId),
                          }),
                      ]),
            ]);
        },
    });
}

export function useDeclareConflict(organizationId: string | null, assignmentId: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: ConflictDeclarationRequest) => {
            if (organizationId === null || assignmentId === null) {
                throw new Error("Select an assignment first.");
            }
            return api.judging.declareConflict(organizationId, assignmentId, input);
        },
        onSuccess: async () => {
            if (assignmentId === null) {
                return;
            }
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: queryKeys.judgingAssignment(assignmentId),
                }),
                ...(organizationId === null
                    ? []
                    : [
                          queryClient.invalidateQueries({
                              queryKey: queryKeys.judgingAssignments(organizationId),
                          }),
                      ]),
            ]);
        },
    });
}

export function useJudgingHistory(organizationId: string | null, editionId: string | null) {
    return useQuery({
        queryKey: [...historyKeyPrefix(organizationId ?? "none"), editionId ?? "none"],
        queryFn: async () => {
            if (organizationId === null || editionId === null) {
                return { items: [], nextCursor: null };
            }
            return api.judging.judgingHistory(organizationId, editionId);
        },
        enabled: organizationId !== null && editionId !== null,
    });
}

export function useEditionJudgingFlags(organizationId: string | null, editionId: string | null) {
    return useQuery({
        queryKey: [...flagsKeyPrefix(organizationId ?? "none"), editionId ?? "none"],
        queryFn: async () => {
            if (organizationId === null || editionId === null) {
                return { items: [], nextCursor: null };
            }
            return api.judging.flags(organizationId, editionId);
        },
        enabled: organizationId !== null && editionId !== null,
    });
}

export function useJudgingCoverage(organizationId: string | null, editionId: string | null) {
    return useQuery({
        queryKey: [...coverageKeyPrefix(organizationId ?? "none"), editionId ?? "none"],
        queryFn: async () => {
            if (organizationId === null || editionId === null) {
                return null;
            }
            return api.judging.coverage(organizationId, editionId);
        },
        enabled: organizationId !== null && editionId !== null,
    });
}

export function useFlagAssignment(organizationId: string | null, assignmentId: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: CreateJudgeFlagRequest) => {
            if (organizationId === null || assignmentId === null) {
                throw new Error("Select an assignment first.");
            }
            return api.judging.flagAssignment(organizationId, assignmentId, input);
        },
        onSuccess: async () => {
            if (organizationId === null) {
                return;
            }
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: flagsKeyPrefix(organizationId) }),
                queryClient.invalidateQueries({ queryKey: coverageKeyPrefix(organizationId) }),
            ]);
        },
    });
}

export function useResolveJudgingFlag(organizationId: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (flagId: string) => {
            if (organizationId === null) {
                throw new Error("Select an organization first.");
            }
            return api.judging.resolveFlag(organizationId, flagId);
        },
        onSuccess: async () => {
            if (organizationId === null) {
                return;
            }
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: flagsKeyPrefix(organizationId) }),
                queryClient.invalidateQueries({ queryKey: coverageKeyPrefix(organizationId) }),
            ]);
        },
    });
}

export function useCreateRubric(organizationId: string | null, editionId: string | null) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: CreateRubricRequest) => {
            if (organizationId === null || editionId === null) {
                throw new Error("Select an edition first.");
            }
            return api.judging.createRubric(organizationId, editionId, input);
        },
        onSuccess: async () => {
            if (editionId === null) {
                return;
            }
            await queryClient.invalidateQueries({
                queryKey: queryKeys.editionRubrics(editionId),
            });
        },
    });
}
