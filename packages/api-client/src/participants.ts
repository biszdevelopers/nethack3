import {
    decideRegistrationRequestSchema,
    listResponseSchema,
    myParticipationSchema,
    registerForCompetitionRequestSchema,
    registrationSchema,
    type DecideRegistrationRequest,
    type ListResponse,
    type MyParticipation,
    type RegisterForCompetitionRequest,
    type Registration,
} from "@nethack/contracts";
import type { ApiClient } from "./client.js";

const registrationListSchema = listResponseSchema(registrationSchema);
const participationListSchema = listResponseSchema(myParticipationSchema);

export class ParticipantsApi {
    private readonly client: ApiClient;

    constructor(client: ApiClient) {
        this.client = client;
    }

    async register(editionId: string, input: RegisterForCompetitionRequest): Promise<Registration> {
        return this.client.request("POST", `/api/v1/competitions/${editionId}/registrations`, {
            body: registerForCompetitionRequestSchema.parse(input),
            schema: registrationSchema,
        });
    }

    async listRegistrations(editionId: string): Promise<ListResponse<Registration>> {
        return this.client.request("GET", `/api/v1/competitions/${editionId}/registrations`, {
            schema: registrationListSchema,
        });
    }

    async decide(
        editionId: string,
        registrationId: string,
        input: DecideRegistrationRequest,
    ): Promise<Registration> {
        return this.client.request(
            "POST",
            `/api/v1/competitions/${editionId}/registrations/${registrationId}/decision`,
            {
                body: decideRegistrationRequestSchema.parse(input),
                schema: registrationSchema,
            },
        );
    }

    async withdraw(editionId: string): Promise<void> {
        await this.client.request("DELETE", `/api/v1/competitions/${editionId}/registrations/me`);
    }

    async mine(): Promise<ListResponse<MyParticipation>> {
        return this.client.request("GET", "/api/v1/me/participations", {
            schema: participationListSchema,
        });
    }
}
