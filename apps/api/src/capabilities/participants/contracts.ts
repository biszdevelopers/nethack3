import type { RegistrationStatus } from "@nethack/contracts";

export interface ParticipantEligibility {
    readonly registrationId: string;
    readonly status: RegistrationStatus;
    readonly divisionId: string | null;
    readonly participantId: string | null;
}

export interface ParticipantsContract {
    getRegistration(
        organizationId: string,
        editionId: string,
        userId: string,
    ): Promise<ParticipantEligibility | null>;
    isApprovedParticipant(
        organizationId: string,
        editionId: string,
        userId: string,
    ): Promise<boolean>;
    countApprovedParticipants(organizationId: string, editionId: string): Promise<number>;
    countRegistrations(
        organizationId: string,
        editionId: string,
    ): Promise<{ total: number; approved: number }>;
    setParticipantTeam(
        organizationId: string,
        editionId: string,
        userId: string,
        teamId: string | null,
    ): Promise<void>;
}

export const PARTICIPANTS_CONTRACT = "participants.v1";
