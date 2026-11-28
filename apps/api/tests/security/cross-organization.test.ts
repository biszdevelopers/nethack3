import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { LightMyRequestResponse } from "fastify";
import { startHarness, type TestHarness } from "../support/app-harness.js";
import {
    buildSecurityFixture,
    expectStatus,
    type SecurityFixture,
} from "./support/security-fixtures.js";

function errorCode(response: LightMyRequestResponse): string | null {
    const body: unknown = response.json();
    if (typeof body !== "object" || body === null || !("error" in body)) {
        return null;
    }
    const error = (body as { error?: unknown }).error;
    if (typeof error !== "object" || error === null || !("code" in error)) {
        return null;
    }
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
}

function assertNoLeak(response: LightMyRequestResponse, secrets: readonly string[]): void {
    for (const secret of secrets) {
        expect(response.body.includes(secret), `response leaked "${secret}"`).toBe(false);
    }
}

describe("cross-organization object access (IDOR/BOLA)", () => {
    let harness: TestHarness;
    let fixture: SecurityFixture;
    const secrets = [
        "Security Project",
        "Team Alpha",
        "Main Series",
        "Organization Update",
        "Security Rubric",
        "pixel.png",
        "Submission One",
    ];

    beforeAll(async () => {
        harness = await startHarness();
        fixture = await buildSecurityFixture(harness);
    });

    afterAll(async () => {
        await harness.closeHarness();
    });

    function fromOutsider(options: {
        readonly method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
        readonly url: string;
        readonly payload?: Record<string, unknown>;
    }): Promise<LightMyRequestResponse> {
        return harness.authenticatedRequest(fixture.outsider, {
            method: options.method,
            url: options.url,
            headers: { "x-nethack-organization-id": fixture.outsiderOrganizationId },
            ...(options.payload === undefined ? {} : { payload: options.payload }),
        });
    }

    it("hides the organization itself, its members, settings, audit log, and invitations", async () => {
        const organizationId = fixture.organizationId;
        const organization = await fromOutsider({
            method: "GET",
            url: `/api/v1/organizations/${organizationId}`,
        });
        const members = await fromOutsider({
            method: "GET",
            url: `/api/v1/organizations/${organizationId}/members`,
        });
        const settings = await fromOutsider({
            method: "GET",
            url: `/api/v1/organizations/${organizationId}/settings`,
        });
        const audit = await fromOutsider({
            method: "GET",
            url: `/api/v1/organizations/${organizationId}/audit`,
        });
        const invitations = await fromOutsider({
            method: "GET",
            url: `/api/v1/organizations/${organizationId}/invitations`,
        });

        for (const response of [organization, members, settings, audit, invitations]) {
            expect([403, 404]).toContain(response.statusCode);
            assertNoLeak(response, secrets);
        }
        expect(settings.statusCode).toBe(403);
        expect(errorCode(audit)).toBe("forbidden");

        const update = await fromOutsider({
            method: "PATCH",
            url: `/api/v1/organizations/${organizationId}`,
            payload: { name: "Hijacked Organization" },
        });
        expect([403, 404]).toContain(update.statusCode);

        const addMember = await fromOutsider({
            method: "POST",
            url: `/api/v1/organizations/${organizationId}/members`,
            payload: { email: "attacker@example.test", role: "owner" },
        });
        expect([403, 404]).toContain(addMember.statusCode);
    });

    it("hides competitions, editions, divisions, and milestones", async () => {
        const responses = await Promise.all([
            fromOutsider({
                method: "GET",
                url: `/api/v1/organizations/${fixture.organizationId}/competitions`,
            }),
            fromOutsider({ method: "GET", url: `/api/v1/competitions/${fixture.editionId}` }),
            fromOutsider({
                method: "GET",
                url: `/api/v1/competitions/${fixture.editionId}/divisions`,
            }),
            fromOutsider({
                method: "GET",
                url: `/api/v1/competitions/${fixture.editionId}/milestones`,
            }),
        ]);
        for (const response of responses) {
            expect([403, 404]).toContain(response.statusCode);
            assertNoLeak(response, secrets);
        }

        const create = await fromOutsider({
            method: "POST",
            url: `/api/v1/organizations/${fixture.organizationId}/competitions`,
            payload: { name: "Injected Series", slug: "injected-series", description: "" },
        });
        expect([403, 404]).toContain(create.statusCode);
    });

    it("hides registrations and their decisions", async () => {
        const list = await fromOutsider({
            method: "GET",
            url: `/api/v1/competitions/${fixture.editionId}/registrations`,
        });
        expect([403, 404]).toContain(list.statusCode);
        assertNoLeak(list, secrets);

        const decide = await fromOutsider({
            method: "POST",
            url: `/api/v1/competitions/${fixture.editionId}/registrations/${fixture.registrationId}/decision`,
            payload: { status: "approved" },
        });
        expect([403, 404]).toContain(decide.statusCode);
    });

    it("hides teams, invitations, and team activity", async () => {
        const team = await fromOutsider({ method: "GET", url: `/api/v1/teams/${fixture.teamId}` });
        const teams = await fromOutsider({
            method: "GET",
            url: `/api/v1/competitions/${fixture.editionId}/teams`,
        });
        const activity = await fromOutsider({
            method: "GET",
            url: `/api/v1/teams/${fixture.teamId}/activity`,
        });
        for (const response of [team, teams, activity]) {
            expect([403, 404]).toContain(response.statusCode);
            assertNoLeak(response, secrets);
        }

        const invite = await fromOutsider({
            method: "POST",
            url: `/api/v1/teams/${fixture.teamId}/invitations`,
            payload: { email: "attacker@example.test" },
        });
        expect([403, 404]).toContain(invite.statusCode);
    });

    it("hides projects, their members, and project files", async () => {
        const project = await fromOutsider({
            method: "GET",
            url: `/api/v1/projects/${fixture.projectId}`,
        });
        const members = await fromOutsider({
            method: "GET",
            url: `/api/v1/projects/${fixture.projectId}/members`,
        });
        const files = await fromOutsider({
            method: "GET",
            url: `/api/v1/projects/${fixture.projectId}/files`,
        });
        for (const response of [project, members, files]) {
            expect([403, 404]).toContain(response.statusCode);
            assertNoLeak(response, secrets);
        }

        const create = await fromOutsider({
            method: "POST",
            url: "/api/v1/projects",
            payload: {
                editionId: fixture.editionId,
                title: "Injected Project",
                summary: "Should not be created.",
            },
        });
        expect([400, 403, 404]).toContain(create.statusCode);
    });

    it("hides submissions, versions, reviews, and edition submission lists", async () => {
        const responses = await Promise.all([
            fromOutsider({ method: "GET", url: `/api/v1/submissions/${fixture.submissionId}` }),
            fromOutsider({
                method: "GET",
                url: `/api/v1/submissions/${fixture.submissionId}/versions`,
            }),
            fromOutsider({
                method: "POST",
                url: `/api/v1/submissions/${fixture.submissionId}/review`,
                payload: { status: "accepted", note: "hijacked" },
            }),
            fromOutsider({
                method: "GET",
                url: `/api/v1/competitions/${fixture.editionId}/submissions`,
            }),
        ]);
        for (const response of responses) {
            expect([403, 404]).toContain(response.statusCode);
            assertNoLeak(response, secrets);
        }
    });

    it("hides rubrics, assignments, evaluations, and history", async () => {
        const responses = await Promise.all([
            fromOutsider({
                method: "GET",
                url: `/api/v1/competitions/${fixture.editionId}/rubrics`,
            }),
            fromOutsider({
                method: "GET",
                url: `/api/v1/competitions/${fixture.editionId}/assignments`,
            }),
            fromOutsider({
                method: "GET",
                url: `/api/v1/assignments/${fixture.assignmentId}`,
            }),
            fromOutsider({
                method: "PUT",
                url: `/api/v1/assignments/${fixture.assignmentId}/evaluation`,
                payload: {
                    scores: [{ criterionId: fixture.criterionId, score: 1, comment: "hijacked" }],
                    overallComment: "hijacked",
                },
            }),
            fromOutsider({
                method: "GET",
                url: `/api/v1/assignments/${fixture.assignmentId}/history`,
            }),
        ]);
        for (const response of responses) {
            expect([403, 404]).toContain(response.statusCode);
            assertNoLeak(response, secrets);
        }
    });

    it("hides voting rounds, ballots, and results", async () => {
        const responses = await Promise.all([
            fromOutsider({
                method: "GET",
                url: `/api/v1/competitions/${fixture.editionId}/voting-rounds`,
            }),
            fromOutsider({
                method: "GET",
                url: `/api/v1/voting-rounds/${fixture.roundId}/ballot`,
            }),
            fromOutsider({
                method: "POST",
                url: `/api/v1/voting-rounds/${fixture.roundId}/ballot`,
                payload: {
                    scores: [
                        { submissionId: fixture.submissionId, stars: 5 },
                        { submissionId: fixture.secondSubmissionId, stars: 5 },
                    ],
                },
            }),
            fromOutsider({
                method: "GET",
                url: `/api/v1/voting-rounds/${fixture.roundId}/results`,
            }),
            fromOutsider({
                method: "GET",
                url: `/api/v1/competitions/${fixture.editionId}/results`,
            }),
        ]);
        for (const response of responses) {
            expect([403, 404]).toContain(response.statusCode);
            assertNoLeak(response, secrets);
        }
    });

    it("hides announcements and reports", async () => {
        const list = await fromOutsider({
            method: "GET",
            url: `/api/v1/organizations/${fixture.organizationId}/announcements`,
        });
        const publish = await fromOutsider({
            method: "POST",
            url: `/api/v1/announcements/${fixture.announcementId}/publish`,
        });
        const update = await fromOutsider({
            method: "PATCH",
            url: `/api/v1/announcements/${fixture.announcementId}`,
            payload: { title: "Hijacked Announcement" },
        });
        const report = await fromOutsider({
            method: "GET",
            url: `/api/v1/organizations/${fixture.organizationId}/reports`,
        });
        for (const response of [list, publish, update, report]) {
            expect([403, 404]).toContain(response.statusCode);
            assertNoLeak(response, secrets);
        }
    });

    it("does not serve another organization's private file", async () => {
        const download = await fromOutsider({
            method: "GET",
            url: `/api/v1/files/${fixture.fileId}/download`,
        });
        expect(download.statusCode).toBe(404);

        const remove = await fromOutsider({
            method: "DELETE",
            url: `/api/v1/files/${fixture.fileId}`,
        });
        expect([403, 404]).toContain(remove.statusCode);
    });

    it("rejects a mismatched explicit organization and header context", async () => {
        const response = await harness.authenticatedRequest(fixture.outsider, {
            method: "GET",
            url: `/api/v1/organizations/${fixture.organizationId}/members`,
            headers: { "x-nethack-organization-id": fixture.outsiderOrganizationId },
        });
        expectStatus(response, 403, "mismatched organization context");
        expect(errorCode(response)).toBe("forbidden");
    });

    it("lets the rightful owner read their own organization data", async () => {
        const members = await harness.authenticatedRequest(fixture.owner, {
            method: "GET",
            url: `/api/v1/organizations/${fixture.organizationId}/members`,
        });
        expectStatus(members, 200, "owner members list");
        const body = members.json() as {
            items: Array<{ userId: string; organizationId: string }>;
        };
        expect(body.items.some((member) => member.userId === fixture.owner.userId)).toBe(true);
        expect(body.items.every((member) => member.organizationId === fixture.organizationId)).toBe(
            true,
        );

        const audit = await harness.authenticatedRequest(fixture.owner, {
            method: "GET",
            url: `/api/v1/organizations/${fixture.organizationId}/audit`,
        });
        expectStatus(audit, 200, "owner audit list");
        const auditBody = audit.json() as { items: Array<{ organizationId: string | null }> };
        expect(
            auditBody.items.every(
                (entry) =>
                    entry.organizationId === null ||
                    entry.organizationId === fixture.organizationId,
            ),
        ).toBe(true);
    });
});
