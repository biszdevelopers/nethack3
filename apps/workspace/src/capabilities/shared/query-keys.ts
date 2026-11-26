export interface EditionOption {
    readonly id: string;
    readonly name: string;
}

export const queryKeys = {
    organization: (organizationId: string) => ["organizations", organizationId] as const,
    members: (organizationId: string) => ["organizations", organizationId, "members"] as const,
    invitations: (organizationId: string) =>
        ["organizations", organizationId, "invitations"] as const,
    settings: (organizationId: string) => ["organizations", organizationId, "settings"] as const,
    reports: (organizationId: string) => ["organizations", organizationId, "reports"] as const,
    audit: (organizationId: string) => ["organizations", organizationId, "audit"] as const,
    series: (organizationId: string) => ["organizations", organizationId, "competitions"] as const,
    edition: (editionId: string) => ["competitions", "edition", editionId] as const,
    divisions: (editionId: string) => ["competitions", editionId, "divisions"] as const,
    milestones: (editionId: string) => ["competitions", editionId, "milestones"] as const,
    judgingAssignments: (organizationId: string) =>
        ["judging", organizationId, "assignments"] as const,
    judgingAssignment: (assignmentId: string) => ["judging", "assignment", assignmentId] as const,
    editionRubrics: (editionId: string) => ["judging", editionId, "rubrics"] as const,
    editionAssignments: (editionId: string) => ["judging", editionId, "assignments"] as const,
    editionSubmissions: (editionId: string) => ["competitions", editionId, "submissions"] as const,
    votingRounds: (editionId: string) => ["voting", editionId, "rounds"] as const,
    ballot: (roundId: string) => ["voting", roundId, "ballot"] as const,
    editionResults: (editionId: string) => ["voting", editionId, "results"] as const,
    globalAdministrators: () => ["administration", "global-administrators"] as const,
    administrationAudit: (organizationId: string) =>
        ["administration", "audit", organizationId] as const,
    publicCompetitions: () => ["public", "competitions"] as const,
};
