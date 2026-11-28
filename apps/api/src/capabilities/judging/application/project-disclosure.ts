export interface ProjectDisclosure {
    readonly videoUrl: string | null;
    readonly aiDisclosure: string;
    readonly repositoryUrl: string | null;
    readonly demoUrl: string | null;
    readonly descriptionMarkdown: string;
}

export const EMPTY_PROJECT_DISCLOSURE: ProjectDisclosure = {
    videoUrl: null,
    aiDisclosure: "",
    repositoryUrl: null,
    demoUrl: null,
    descriptionMarkdown: "",
};

interface ProjectDisclosureFields {
    readonly videoUrl?: string | null;
    readonly aiDisclosure?: string;
    readonly repositoryUrl?: string | null;
    readonly demoUrl?: string | null;
    readonly descriptionMarkdown?: string;
}

// The projects contract exposes these fields alongside this integration, so read
// them defensively from whatever project row or summary the loader provides.
export function toProjectDisclosure(project: object | null): ProjectDisclosure {
    if (project === null) {
        return EMPTY_PROJECT_DISCLOSURE;
    }
    const fields = project as ProjectDisclosureFields;
    return {
        videoUrl: fields.videoUrl ?? null,
        aiDisclosure: fields.aiDisclosure ?? "",
        repositoryUrl: fields.repositoryUrl ?? null,
        demoUrl: fields.demoUrl ?? null,
        descriptionMarkdown: fields.descriptionMarkdown ?? "",
    };
}
