import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
    AddProjectMemberRequest,
    CreateProjectRequest,
    UpdateProjectRequest,
} from "@nethack/contracts";
import { resources } from "../../../application/resources.js";

export interface ProjectFilters {
    readonly editionId?: string;
    readonly teamId?: string;
    readonly mine?: boolean;
}

function filterKey(filters: ProjectFilters): string {
    return [filters.editionId ?? "", filters.teamId ?? "", String(filters.mine ?? false)].join("|");
}

export const projectKeys = {
    all: ["projects"] as const,
    list: (filters: ProjectFilters) => ["projects", "list", filterKey(filters)] as const,
    detail: (projectId: string) => ["projects", "detail", projectId] as const,
    files: (projectId: string) => ["projects", "files", projectId] as const,
};

export function useProjects(filters: ProjectFilters = {}) {
    return useQuery({
        queryKey: projectKeys.list(filters),
        queryFn: () =>
            resources.projects.list({
                ...(filters.editionId === undefined ? {} : { editionId: filters.editionId }),
                ...(filters.teamId === undefined ? {} : { teamId: filters.teamId }),
                ...(filters.mine === undefined ? {} : { mine: filters.mine }),
                limit: 100,
            }),
    });
}

export function useProject(projectId: string | null) {
    return useQuery({
        queryKey: projectKeys.detail(projectId ?? "none"),
        queryFn: async () => {
            if (projectId === null) {
                return null;
            }
            return resources.projects.get(projectId);
        },
        enabled: projectId !== null,
    });
}

export function useProjectFiles(projectId: string | null) {
    return useQuery({
        queryKey: projectKeys.files(projectId ?? "none"),
        queryFn: async () => {
            if (projectId === null) {
                return { items: [], nextCursor: null };
            }
            return resources.files.listProjectFiles(projectId);
        },
        enabled: projectId !== null,
    });
}

export function useCreateProject() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: CreateProjectRequest) => resources.projects.create(input),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: projectKeys.all });
        },
    });
}

export function useUpdateProject(projectId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: UpdateProjectRequest) => resources.projects.update(projectId, input),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: projectKeys.all });
        },
    });
}

export function usePublishProject(projectId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => resources.projects.publish(projectId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: projectKeys.all });
        },
    });
}

export function useAddProjectMember(projectId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: AddProjectMemberRequest) =>
            resources.projects.addMember(projectId, input),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: projectKeys.all });
        },
    });
}

export function useUploadProjectFile(projectId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (file: File) => resources.files.upload(projectId, file),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: projectKeys.files(projectId) });
        },
    });
}

export function useDeleteProjectFile(projectId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (fileId: string) => resources.files.remove(fileId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: projectKeys.files(projectId) });
            await queryClient.invalidateQueries({ queryKey: ["submissions"] });
        },
    });
}
