import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startHarness, type TestHarness } from "../support/app-harness.js";
import { queryAsOwner, queryAsRuntimeTenant, uniqueEmail } from "../support/test-database.js";

describe("organization isolation", () => {
    let harness: TestHarness;

    beforeAll(async () => {
        harness = await startHarness();
    });

    afterAll(async () => {
        await harness.closeHarness();
    });

    it("forbids another user from reading an organization's members", async () => {
        const owner = await harness.signIn({ email: uniqueEmail("owner"), name: "Org Owner" });
        const organization = await harness.createOrganization(owner);

        const other = await harness.signIn({ email: uniqueEmail("other"), name: "Other User" });
        await harness.createOrganization(other);

        const forbidden = await harness.authenticatedRequest(other, {
            method: "GET",
            url: `/api/v1/organizations/${organization.id}/members`,
        });
        expect(forbidden.statusCode).toBe(403);
        expect((forbidden.json() as { error: { code: string } }).error.code).toBe("forbidden");

        const forbiddenViaHeader = await harness.authenticatedRequest(other, {
            method: "GET",
            url: `/api/v1/organizations/${organization.id}/members`,
            headers: { "x-nethack-organization-id": organization.id },
        });
        expect(forbiddenViaHeader.statusCode).toBe(403);

        const allowed = await harness.authenticatedRequest(owner, {
            method: "GET",
            url: `/api/v1/organizations/${organization.id}/members`,
        });
        expect(allowed.statusCode).toBe(200);
        const page = allowed.json() as { items: Array<{ userId: string; role: string }> };
        expect(page.items).toHaveLength(1);
        expect(page.items[0]?.userId).toBe(owner.userId);
        expect(page.items[0]?.role).toBe("owner");
    });

    it("keeps organization settings invisible to a different tenant context under RLS", async () => {
        const owner = await harness.signIn({ email: uniqueEmail("rls-owner"), name: "RLS Owner" });
        const organization = await harness.createOrganization(owner);

        const other = await harness.signIn({ email: uniqueEmail("rls-other"), name: "RLS Other" });
        const otherOrganization = await harness.createOrganization(other);

        const settings = await queryAsOwner<{ organization_id: string }>(
            "select organization_id from organization_settings where organization_id = $1",
            [organization.id],
        );
        expect(settings).toHaveLength(1);

        const matchingTenant = await queryAsRuntimeTenant<{ organization_id: string }>(
            organization.id,
            "select organization_id from organization_settings where organization_id = $1",
            [organization.id],
        );
        expect(matchingTenant).toHaveLength(1);

        const visible = await queryAsRuntimeTenant<{ organization_id: string }>(
            otherOrganization.id,
            "select organization_id from organization_settings where organization_id = $1",
            [organization.id],
        );
        expect(visible).toHaveLength(0);
    });
});
