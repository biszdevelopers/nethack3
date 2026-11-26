import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { LightMyRequestResponse } from "fastify";
import { startHarness, type TestHarness, type TestSession } from "../support/app-harness.js";
import { queryAsOwner, uniqueEmail } from "../support/test-database.js";
import {
    addMember,
    buildSecurityFixture,
    emailOf,
    expectStatus,
    type SecurityFixture,
} from "./support/security-fixtures.js";

function expectForbidden(response: LightMyRequestResponse, label: string): void {
    expect([403, 404], label).toContain(response.statusCode);
    if (response.statusCode === 403) {
        const body = response.json() as { error: { code: string } };
        expect(body.error.code).toBe("forbidden");
    }
}

interface ProjectBody {
    readonly id: string;
}

describe("role escalation and least privilege", () => {
    let harness: TestHarness;
    let fixture: SecurityFixture;
    let foreignProjectId: string;
    let pendingRegistrationId: string;

    beforeAll(async () => {
        harness = await startHarness();
        fixture = await buildSecurityFixture(harness);

        const foreignProject = await harness.authenticatedRequest(fixture.extraParticipant, {
            method: "POST",
            url: "/api/v1/projects",
            payload: {
                editionId: fixture.editionId,
                title: "Foreign Project",
                summary: "Owned by another participant.",
            },
            headers: { "x-nethack-organization-id": fixture.organizationId },
        });
        expectStatus(foreignProject, 201, "create foreign project");
        foreignProjectId = (foreignProject.json() as ProjectBody).id;

        const pendingUser = await harness.signIn({
            email: uniqueEmail("pending-applicant"),
            name: "Pending Applicant",
        });
        await addMember(
            harness,
            fixture.owner,
            fixture.organizationId,
            emailOf(pendingUser),
            "participant",
        );
        const registration = await harness.authenticatedRequest(pendingUser, {
            method: "POST",
            url: `/api/v1/competitions/${fixture.editionId}/registrations`,
            payload: {},
            headers: { "x-nethack-organization-id": fixture.organizationId },
        });
        expectStatus(registration, 201, "register pending applicant");
        pendingRegistrationId = (registration.json() as { id: string }).id;
    });

    afterAll(async () => {
        await harness.closeHarness();
    });

    function request(
        session: TestSession,
        options: {
            readonly method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
            readonly url: string;
            readonly payload?: Record<string, unknown>;
        },
    ): Promise<LightMyRequestResponse> {
        return harness.authenticatedRequest(session, {
            method: options.method,
            url: options.url,
            headers: { "x-nethack-organization-id": fixture.organizationId },
            ...(options.payload === undefined ? {} : { payload: options.payload }),
        });
    }

    it("denies participant-only administrative and publication operations", async () => {
        const responses: Array<[string, LightMyRequestResponse]> = [];

        responses.push([
            "approve registration",
            await request(fixture.participant, {
                method: "POST",
                url: `/api/v1/competitions/${fixture.editionId}/registrations/${pendingRegistrationId}/decision`,
                payload: { status: "approved" },
            }),
        ]);
        responses.push([
            "create competition series",
            await request(fixture.participant, {
                method: "POST",
                url: `/api/v1/organizations/${fixture.organizationId}/competitions`,
                payload: {
                    name: "Participant Series",
                    slug: "participant-series",
                    description: "",
                },
            }),
        ]);
        responses.push([
            "create edition",
            await request(fixture.participant, {
                method: "POST",
                url: `/api/v1/organizations/${fixture.organizationId}/competitions/${fixture.seriesId}/editions`,
                payload: {
                    name: "Participant Edition",
                    slug: "participant-edition",
                    timezone: "UTC",
                },
            }),
        ]);
        responses.push([
            "publish another participant's project",
            await request(fixture.participant, {
                method: "POST",
                url: `/api/v1/projects/${foreignProjectId}/publish`,
            }),
        ]);
        responses.push([
            "create judging rubric",
            await request(fixture.participant, {
                method: "POST",
                url: `/api/v1/competitions/${fixture.editionId}/rubrics`,
                payload: {
                    name: "Participant Rubric",
                    criteria: [{ name: "Quality", maxScore: 10 }],
                },
            }),
        ]);
        responses.push([
            "assign judge",
            await request(fixture.participant, {
                method: "POST",
                url: `/api/v1/competitions/${fixture.editionId}/assignments`,
                payload: {
                    submissionId: fixture.submissionId,
                    judgeEmail: emailOf(fixture.judge),
                    rubricId: fixture.rubricId,
                },
            }),
        ]);
        responses.push([
            "publish voting results",
            await request(fixture.participant, {
                method: "POST",
                url: `/api/v1/voting-rounds/${fixture.roundId}/publish`,
            }),
        ]);
        responses.push([
            "grant global administrator",
            await request(fixture.participant, {
                method: "POST",
                url: "/api/v1/admin/global-administrators",
                payload: { email: emailOf(fixture.participant), reason: "escalation attempt" },
            }),
        ]);
        responses.push([
            "read organization audit log",
            await request(fixture.participant, {
                method: "GET",
                url: `/api/v1/organizations/${fixture.organizationId}/audit`,
            }),
        ]);
        responses.push([
            "list organization members",
            await request(fixture.participant, {
                method: "GET",
                url: `/api/v1/organizations/${fixture.organizationId}/members`,
            }),
        ]);
        responses.push([
            "read organization settings",
            await request(fixture.participant, {
                method: "GET",
                url: `/api/v1/organizations/${fixture.organizationId}/settings`,
            }),
        ]);
        responses.push([
            "review submission",
            await request(fixture.participant, {
                method: "POST",
                url: `/api/v1/submissions/${fixture.submissionId}/review`,
                payload: { status: "accepted", note: "" },
            }),
        ]);
        responses.push([
            "read organization reports",
            await request(fixture.participant, {
                method: "GET",
                url: `/api/v1/organizations/${fixture.organizationId}/reports`,
            }),
        ]);

        for (const [label, response] of responses) {
            expectForbidden(response, label);
        }

        const pending = await queryAsOwner<{ status: string }>(
            "select status from registrations where id = $1",
            [pendingRegistrationId],
        );
        expect(pending[0]?.status).toBe("pending");

        const project = await queryAsOwner<{ status: string }>(
            "select status from projects where id = $1",
            [foreignProjectId],
        );
        expect(project[0]?.status).toBe("draft");

        const administrators = await queryAsOwner<{ count: string }>(
            "select count(*)::text as count from global_administrators",
        );
        expect(administrators[0]?.count).toBe("0");
    });

    it("denies a judge organization administration and edition publishing", async () => {
        const responses: Array<[string, LightMyRequestResponse]> = [];

        responses.push([
            "update organization",
            await request(fixture.judge, {
                method: "PATCH",
                url: `/api/v1/organizations/${fixture.organizationId}`,
                payload: { name: "Judge Controlled" },
            }),
        ]);
        responses.push([
            "list members",
            await request(fixture.judge, {
                method: "GET",
                url: `/api/v1/organizations/${fixture.organizationId}/members`,
            }),
        ]);
        responses.push([
            "read settings",
            await request(fixture.judge, {
                method: "GET",
                url: `/api/v1/organizations/${fixture.organizationId}/settings`,
            }),
        ]);
        responses.push([
            "read audit log",
            await request(fixture.judge, {
                method: "GET",
                url: `/api/v1/organizations/${fixture.organizationId}/audit`,
            }),
        ]);
        responses.push([
            "add organization member",
            await request(fixture.judge, {
                method: "POST",
                url: `/api/v1/organizations/${fixture.organizationId}/members`,
                payload: { email: emailOf(fixture.judge), role: "owner" },
            }),
        ]);
        responses.push([
            "publish edition",
            await request(fixture.judge, {
                method: "POST",
                url: `/api/v1/competitions/${fixture.editionId}/publish`,
            }),
        ]);
        responses.push([
            "publish voting round",
            await request(fixture.judge, {
                method: "POST",
                url: `/api/v1/voting-rounds/${fixture.roundId}/publish`,
            }),
        ]);

        for (const [label, response] of responses) {
            expectForbidden(response, label);
        }

        const organization = await queryAsOwner<{ name: string }>(
            "select name from organizations where id = $1",
            [fixture.organizationId],
        );
        expect(organization[0]?.name).not.toBe("Judge Controlled");
    });

    it("lets an organizer run competitions but not grant global administration", async () => {
        const audit = await request(fixture.organizer, {
            method: "GET",
            url: `/api/v1/organizations/${fixture.organizationId}/audit`,
        });
        expectStatus(audit, 200, "organizer audit access");

        const grant = await request(fixture.organizer, {
            method: "POST",
            url: "/api/v1/admin/global-administrators",
            payload: { email: emailOf(fixture.organizer), reason: "escalation attempt" },
        });
        expectForbidden(grant, "organizer global administrator grant");

        const update = await request(fixture.organizer, {
            method: "PATCH",
            url: `/api/v1/organizations/${fixture.organizationId}`,
            payload: { name: "Organizer Controlled" },
        });
        expectForbidden(update, "organizer organization update");

        const members = await request(fixture.organizer, {
            method: "GET",
            url: `/api/v1/organizations/${fixture.organizationId}/members`,
        });
        expectStatus(members, 200, "organizer member listing");

        const addMemberResponse = await request(fixture.organizer, {
            method: "POST",
            url: `/api/v1/organizations/${fixture.organizationId}/members`,
            payload: { email: "organizer-added@example.test", role: "participant" },
        });
        expectForbidden(addMemberResponse, "organizer member administration");

        const administrators = await queryAsOwner<{ count: string }>(
            "select count(*)::text as count from global_administrators",
        );
        expect(administrators[0]?.count).toBe("0");
    });

    it("denies an organization owner without a global grant", async () => {
        const response = await request(fixture.owner, {
            method: "POST",
            url: "/api/v1/admin/global-administrators",
            payload: { email: emailOf(fixture.owner), reason: "self grant attempt" },
        });
        expectForbidden(response, "owner global administrator grant");

        const audit = await request(fixture.owner, {
            method: "GET",
            url: "/api/v1/admin/audit?organizationId=" + fixture.organizationId,
        });
        expectForbidden(audit, "owner global audit access");
    });
});
