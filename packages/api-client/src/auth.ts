import {
    logoutResponseSchema,
    sessionSchema,
    updateProfileRequestSchema,
    userSchema,
    type Session,
    type UpdateProfileRequest,
    type User,
} from "@nethack/contracts";
import type { ApiClient } from "./client.js";

export class AuthApi {
    private readonly client: ApiClient;

    constructor(client: ApiClient) {
        this.client = client;
    }

    loginUrl(returnTo = "/"): string {
        return this.client.buildUrl("/api/v1/auth/login", { returnTo });
    }

    async session(): Promise<Session> {
        return this.client.request("GET", "/api/v1/auth/session", { schema: sessionSchema });
    }

    async logout(): Promise<{ providerLogoutUrl: string | null }> {
        return this.client.request("POST", "/api/v1/auth/logout", {
            schema: logoutResponseSchema,
        });
    }

    async updateProfile(input: UpdateProfileRequest): Promise<User> {
        return this.client.request("PATCH", "/api/v1/me", {
            body: updateProfileRequestSchema.parse(input),
            schema: userSchema,
        });
    }
}
