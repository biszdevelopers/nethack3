import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startHarness, type TestHarness } from "../support/app-harness.js";
import { queryAsOwner, uniqueSlug } from "../support/test-database.js";
import {
    buildSecurityFixture,
    expectStatus,
    type SecurityFixture,
} from "./support/security-fixtures.js";

describe("input injection and URL scheme validation", () => {
    let harness: TestHarness;
    let fixture: SecurityFixture;

    beforeAll(async () => {
        harness = await startHarness();
        fixture = await buildSecurityFixture(harness);
    });

    afterAll(async () => {
        await harness.closeHarness();
    });

    it("treats SQL-looking audit filters as literal values", async () => {
        const injection = "' OR 1=1 --";
        const response = await harness.authenticatedRequest(fixture.owner, {
            method: "GET",
            url: `/api/v1/organizations/${fixture.organizationId}/audit?action=${encodeURIComponent(injection)}&entityType=${encodeURIComponent(injection)}`,
        });
        expectStatus(response, 200, "SQL-looking audit filter");
        const body = response.json() as {
            items: Array<{ organizationId: string | null; action: string }>;
        };
        expect(body.items).toHaveLength(0);

        const all = await harness.authenticatedRequest(fixture.owner, {
            method: "GET",
            url: `/api/v1/organizations/${fixture.organizationId}/audit?limit=100`,
        });
        expectStatus(all, 200, "unfiltered audit list");
        const allItems = (all.json() as { items: Array<{ organizationId: string | null }> }).items;
        expect(allItems.length).toBeGreaterThan(0);
        expect(
            allItems.every(
                (entry) =>
                    entry.organizationId === null ||
                    entry.organizationId === fixture.organizationId,
            ),
        ).toBe(true);
    });

    it("rejects invalid identifier, enum, and limit query values before querying", async () => {
        const responses = await Promise.all([
            harness.authenticatedRequest(fixture.owner, {
                method: "GET",
                url: `/api/v1/organizations/${fixture.organizationId}/audit?actorUserId=${encodeURIComponent("' OR 1=1 --")}`,
            }),
            harness.authenticatedRequest(fixture.owner, {
                method: "GET",
                url: `/api/v1/organizations/${fixture.organizationId}/audit?limit=${encodeURIComponent("1;drop table users")}`,
            }),
            harness.authenticatedRequest(fixture.owner, {
                method: "GET",
                url: `/api/v1/organizations/${fixture.organizationId}/audit?cursor=${"a".repeat(513)}`,
            }),
            harness.authenticatedRequest(fixture.participant, {
                method: "GET",
                url: `/api/v1/projects?mine=${encodeURIComponent("' OR 1=1 --")}`,
                headers: { "x-nethack-organization-id": fixture.organizationId },
            }),
            harness.authenticatedRequest(fixture.participant, {
                method: "GET",
                url: `/api/v1/projects?editionId=${encodeURIComponent("' OR 1=1 --")}`,
                headers: { "x-nethack-organization-id": fixture.organizationId },
            }),
        ]);
        for (const response of responses) {
            expect(response.statusCode).toBe(400);
        }
    });

    it("does not let a malicious public slug alter the public query", async () => {
        const response = await harness.inject({
            method: "GET",
            url: `/api/v1/public/projects/${encodeURIComponent("' OR 1=1 --")}`,
        });
        expect(response.statusCode).toBe(400);

        const valid = await harness.inject({
            method: "GET",
            url: "/api/v1/public/projects/does-not-exist",
        });
        expect(valid.statusCode).toBe(404);
    });

    it("rejects javascript and data URLs in project schemas", async () => {
        const jsUrl = await harness.authenticatedRequest(fixture.participant, {
            method: "PATCH",
            url: `/api/v1/projects/${fixture.projectId}`,
            payload: { repositoryUrl: "javascript:alert(document.cookie)" },
            headers: { "x-nethack-organization-id": fixture.organizationId },
        });
        expect(jsUrl.statusCode).toBe(400);

        const dataUrl = await harness.authenticatedRequest(fixture.participant, {
            method: "PATCH",
            url: `/api/v1/projects/${fixture.projectId}`,
            payload: { demoUrl: "data:text/html,<script>alert(1)</script>" },
            headers: { "x-nethack-organization-id": fixture.organizationId },
        });
        expect(dataUrl.statusCode).toBe(400);

        const create = await harness.authenticatedRequest(fixture.participant, {
            method: "POST",
            url: "/api/v1/projects",
            payload: {
                editionId: fixture.editionId,
                title: `URL Scheme Project ${uniqueSlug("url")}`,
                summary: "Rejected URL schemes.",
                repositoryUrl: "javascript:alert(1)",
            },
            headers: { "x-nethack-organization-id": fixture.organizationId },
        });
        expect(create.statusCode).toBe(400);

        const stored = await queryAsOwner<{
            repository_url: string | null;
            demo_url: string | null;
        }>("select repository_url, demo_url from projects where id = $1", [fixture.projectId]);
        expect(stored[0]?.repository_url).toBe("https://github.com/example/security-project");
        expect(stored[0]?.demo_url).toBe("https://example.com/security-project");
    });

    it("keeps organization-scoped list filters from leaking other organizations", async () => {
        const response = await harness.authenticatedRequest(fixture.participant, {
            method: "GET",
            url: `/api/v1/projects?mine=true&limit=100`,
            headers: { "x-nethack-organization-id": fixture.organizationId },
        });
        expectStatus(response, 200, "participant project list");
        const body = response.json() as {
            items: Array<{ organizationId: string; ownerUserId: string }>;
        };
        expect(body.items.length).toBeGreaterThan(0);
        for (const item of body.items) {
            expect(item.organizationId).toBe(fixture.organizationId);
            expect(item.ownerUserId).toBe(fixture.participant.userId);
        }
    });
});
