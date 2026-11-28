import type { PublicResults } from "@nethack/contracts";

export interface TeamAwardName {
    readonly teamId: string;
    readonly name: string;
}

export interface RecognitionContract {
    getPublishedResults(organizationId: string, editionId: string): Promise<PublicResults | null>;
    /** Award names by team, available before publication for organizer exports. */
    listTeamAwardNames(
        organizationId: string,
        editionId: string,
    ): Promise<readonly TeamAwardName[]>;
}

export const RECOGNITION_CONTRACT = "recognition.v1";
