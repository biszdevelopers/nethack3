import {
    AdministrationApi,
    ApiClient,
    AuthApi,
    JudgingApi,
    OrganizationsApi,
    VotingApi,
} from "@nethack/api-client";
import { organizationSelectionStore } from "./organization-store.js";

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
    csrfToken = token;
}

export const apiClient = new ApiClient({
    baseUrl: import.meta.env.VITE_API_ORIGIN ?? "http://localhost:3002",
    getCsrfToken: () => csrfToken,
    getOrganizationId: () => organizationSelectionStore.getSnapshot(),
    onUnauthorized: () => {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("nethack:unauthorized"));
        }
    },
});

export const api = {
    auth: new AuthApi(apiClient),
    organizations: new OrganizationsApi(apiClient),
    judging: new JudgingApi(apiClient),
    voting: new VotingApi(apiClient),
    administration: new AdministrationApi(apiClient),
};
