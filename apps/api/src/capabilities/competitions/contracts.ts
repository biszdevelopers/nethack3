import type { CompetitionEditionStatus } from "@nethack/contracts";

export interface EditionSummary {
    readonly id: string;
    readonly organizationId: string;
    readonly seriesId: string;
    readonly seriesName: string;
    readonly name: string;
    readonly slug: string;
    readonly description: string;
    readonly status: CompetitionEditionStatus;
    readonly timezone: string;
    readonly registrationOpensAt: string | null;
    readonly registrationClosesAt: string | null;
    readonly startsAt: string | null;
    readonly endsAt: string | null;
    readonly teamMinSize: number;
    readonly teamMaxSize: number;
    readonly maxParticipants: number | null;
    readonly rulesMarkdown: string;
    readonly publishedAt: string | null;
}

export interface DivisionSummary {
    readonly id: string;
    readonly organizationId: string;
    readonly editionId: string;
    readonly name: string;
    readonly slug: string;
    readonly description: string;
    readonly minTeamSize: number | null;
    readonly maxTeamSize: number | null;
}

export interface CompetitionsContract {
    getEdition(organizationId: string, editionId: string): Promise<EditionSummary | null>;
    getDivision(organizationId: string, divisionId: string): Promise<DivisionSummary | null>;
    listEditions(organizationId: string): Promise<readonly EditionSummary[]>;
    isPublicEdition(editionId: string): Promise<boolean>;
}

export const COMPETITIONS_CONTRACT = "competitions.v1";
