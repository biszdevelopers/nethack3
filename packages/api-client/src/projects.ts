import {
    addProjectMemberRequestSchema,
    createProjectRequestSchema,
    listResponseSchema,
    projectDetailSchema,
    projectMemberSchema,
    projectSchema,
    publicProjectSchema,
    updateProjectRequestSchema,
    type AddProjectMemberRequest,
    type CreateProjectRequest,
    type ListResponse,
    type Project,
    type ProjectDetail,
    type ProjectMember,
    type PublicProject,
    type UpdateProjectRequest,
} from "@nethack/contracts";
import type { ApiClient } from "./client.js";

export interface ProjectListQuery {
    readonly editionId?: string;
    readonly teamId?: string;
    readonly mine?: boolean;
    readonly cursor?: string;
    readonly limit?: number;
}

export interface PublicProjectListQuery {
    readonly competition?: string;
    readonly cursor?: string;
    readonly limit?: number;
}

const projectListSchema = listResponseSchema(projectSchema);
const projectMemberListSchema = listResponseSchema(projectMemberSchema);
const publicProjectListSchema = listResponseSchema(publicProjectSchema);

export class ProjectsApi {
    private readonly client: ApiClient;

    constructor(client: ApiClient) {
        this.client = client;
    }

    async list(query: ProjectListQuery = {}): Promise<ListResponse<Project>> {
        return this.client.request("GET", "/api/v1/projects", {
            query: {
                editionId: query.editionId,
                teamId: query.teamId,
                mine: query.mine,
                cursor: query.cursor,
                limit: query.limit,
            },
            schema: projectListSchema,
        });
    }

    async create(input: CreateProjectRequest): Promise<Project> {
        return this.client.request("POST", "/api/v1/projects", {
            body: createProjectRequestSchema.parse(input),
            schema: projectSchema,
        });
    }

    async get(projectId: string): Promise<ProjectDetail> {
        return this.client.request("GET", `/api/v1/projects/${projectId}`, {
            schema: projectDetailSchema,
        });
    }

    async update(projectId: string, input: UpdateProjectRequest): Promise<Project> {
        return this.client.request("PATCH", `/api/v1/projects/${projectId}`, {
            body: updateProjectRequestSchema.parse(input),
            schema: projectSchema,
        });
    }

    async publish(projectId: string): Promise<Project> {
        return this.client.request("POST", `/api/v1/projects/${projectId}/publish`, {
            schema: projectSchema,
        });
    }

    async members(projectId: string): Promise<ListResponse<ProjectMember>> {
        return this.client.request("GET", `/api/v1/projects/${projectId}/members`, {
            schema: projectMemberListSchema,
        });
    }

    async addMember(projectId: string, input: AddProjectMemberRequest): Promise<ProjectMember> {
        return this.client.request("POST", `/api/v1/projects/${projectId}/members`, {
            body: addProjectMemberRequestSchema.parse(input),
            schema: projectMemberSchema,
        });
    }

    async publicList(query: PublicProjectListQuery = {}): Promise<ListResponse<PublicProject>> {
        return this.client.request("GET", "/api/v1/public/projects", {
            query: {
                competition: query.competition,
                cursor: query.cursor,
                limit: query.limit,
            },
            schema: publicProjectListSchema,
        });
    }

    async publicGet(slug: string): Promise<PublicProject> {
        return this.client.request("GET", `/api/v1/public/projects/${slug}`, {
            schema: publicProjectSchema,
        });
    }
}
