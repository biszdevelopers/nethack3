import type { CompetitionEditionStatus } from "@nethack/contracts";
import type { DatabaseSession } from "../../infrastructure/database/client.js";

export interface EditionSummary {
    readonly id: string;
    readonly organizationId: string;
    readonly seriesId: string;
    readonly seriesName: string;
    readonly name: string;
    readonly slug: string;
    readonly description: string;
    readonly themeName: string | null;
    readonly themeDescription: string | null;
    readonly showScores: boolean;
    readonly showRanking: boolean;
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
    readonly resultsOpenAt?: string | null;
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

export interface PublicEditionRef {
    readonly id: string;
    readonly organizationId: string;
}

export interface CompetitionsContract {
    getEdition(organizationId: string, editionId: string): Promise<EditionSummary | null>;
    getPublicEdition(editionId: string): Promise<PublicEditionRef | null>;
    getDivision(organizationId: string, divisionId: string): Promise<DivisionSummary | null>;
    listEditions(organizationId: string): Promise<readonly EditionSummary[]>;
    listDivisions(organizationId: string, editionId: string): Promise<readonly DivisionSummary[]>;
    isPublicEdition(editionId: string): Promise<boolean>;
    /**
     * Results publication freeze. Moves the edition to `completed` inside the
     * caller's transaction and returns the previous status so unpublishing can
     * restore it. The edition stays frozen while it is `completed` or `archived`.
     */
    freezeForResults(
        session: DatabaseSession,
        organizationId: string,
        editionId: string,
    ): Promise<CompetitionEditionStatus>;
    restoreEditionStatus(
        session: DatabaseSession,
        organizationId: string,
        editionId: string,
        status: CompetitionEditionStatus,
    ): Promise<void>;
}

export function isEditionResultsFrozen(status: CompetitionEditionStatus): boolean {
    return status === "completed" || status === "archived";
}

export const COMPETITIONS_CONTRACT = "competitions.v1";
