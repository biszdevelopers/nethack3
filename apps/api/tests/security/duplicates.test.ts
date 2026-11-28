import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { LightMyRequestResponse } from "fastify";
import { startHarness, type TestHarness } from "../support/app-harness.js";
import { queryAsOwner, uniqueEmail, uniqueSlug } from "../support/test-database.js";
import {
    addMember,
    buildSecurityFixture,
    createRegistrationEdition,
    emailOf,
    expectStatus,
    type SecurityFixture,
} from "./support/security-fixtures.js";

interface IdBody {
    readonly id: string;
}

interface InvitationBody {
    readonly id: string;
}

function statuses(responses: readonly LightMyRequestResponse[]): number[] {
    return responses.map((response) => response.statusCode).toSorted((left, right) => left - right);
}

async function invitationToken(organizationId: string, email: string): Promise<string> {
    const rows = await queryAsOwner<{ token: string | null }>(
        `select payload->>'token' as token
         from outbox_events
         where organization_id = $1
           and event_type = 'teams.invitation.created'
           and payload->>'email' = $2
         order by occurred_at desc, id desc
         limit 1`,
        [organizationId, email.toLowerCase()],
    );
    const token = rows[0]?.token;
    if (token === null || token === undefined) {
        throw new Error(`No team invitation token was recorded for ${email}.`);
    }
    return token;
}

describe("duplicate and racing operations", () => {
    let harness: TestHarness;
    let fixture: SecurityFixture;

    beforeAll(async () => {
        harness = await startHarness();
        fixture = await buildSecurityFixture(harness);
    });

    afterAll(async () => {
        await harness.closeHarness();
    });

    function orgHeaders(organizationId: string): Record<string, string> {
        return { "x-nethack-organization-id": organizationId };
    }

    it("allows exactly one of two concurrent registrations", async () => {
        const applicant = await harness.signIn({
            email: uniqueEmail("race-registration"),
            name: "Race Applicant",
        });
        await addMember(
            harness,
            fixture.owner,
            fixture.organizationId,
            emailOf(applicant),
            "participant",
        );
        const edition = await createRegistrationEdition(
            harness,
            fixture.owner,
            fixture.organizationId,
            "Registration Race",
        );

        const requests = await Promise.all([
            harness.authenticatedRequest(applicant, {
                method: "POST",
                url: `/api/v1/competitions/${edition.editionId}/registrations`,
                payload: {},
                headers: orgHeaders(fixture.organizationId),
            }),
            harness.authenticatedRequest(applicant, {
                method: "POST",
                url: `/api/v1/competitions/${edition.editionId}/registrations`,
                payload: {},
                headers: orgHeaders(fixture.organizationId),
            }),
        ]);

        expect(statuses(requests)).toEqual([201, 409]);
        const rows = await queryAsOwner<{ count: string }>(
            "select count(*)::text as count from registrations where organization_id = $1 and edition_id = $2 and user_id = $3",
            [fixture.organizationId, edition.editionId, applicant.userId],
        );
        expect(rows[0]?.count).toBe("1");
    });

    it("keeps one ballot row when two recasts race from the same voter", async () => {
        const round = await harness.authenticatedRequest(fixture.owner, {
            method: "POST",
            url: `/api/v1/competitions/${fixture.editionId}/voting-rounds`,
            payload: {
                name: "Judge Race Round",
                eligibleRoles: ["judge"],
                maxSelections: 2,
            },
            headers: orgHeaders(fixture.organizationId),
        });
        expectStatus(round, 201, "create race round");
        const roundId = (round.json() as IdBody).id;

        const opened = await harness.authenticatedRequest(fixture.owner, {
            method: "POST",
            url: `/api/v1/voting-rounds/${roundId}/open`,
            headers: orgHeaders(fixture.organizationId),
        });
        expectStatus(opened, 200, "open race round");

        const requests = await Promise.all([
            harness.authenticatedRequest(fixture.judge, {
                method: "POST",
                url: `/api/v1/voting-rounds/${roundId}/ballot`,
                payload: {
                    scores: [
                        { submissionId: fixture.submissionId, stars: 5 },
                        { submissionId: fixture.secondSubmissionId, stars: 5 },
                    ],
                },
                headers: orgHeaders(fixture.organizationId),
            }),
            harness.authenticatedRequest(fixture.judge, {
                method: "POST",
                url: `/api/v1/voting-rounds/${roundId}/ballot`,
                payload: {
                    scores: [
                        { submissionId: fixture.submissionId, stars: 5 },
                        { submissionId: fixture.secondSubmissionId, stars: 5 },
                    ],
                },
                headers: orgHeaders(fixture.organizationId),
            }),
        ]);

        expect(statuses(requests)).toEqual([201, 201]);
        const rows = await queryAsOwner<{ count: string }>(
            "select count(*)::text as count from ballots where organization_id = $1 and round_id = $2 and user_id = $3",
            [fixture.organizationId, roundId, fixture.judge.userId],
        );
        expect(rows[0]?.count).toBe("1");
    });

    it("allows exactly one duplicate team invitation and one duplicate membership", async () => {
        const email = emailOf(fixture.joinerA);
        const invites = await Promise.all([
            harness.authenticatedRequest(fixture.participant, {
                method: "POST",
                url: `/api/v1/teams/${fixture.teamId}/invitations`,
                payload: { email },
                headers: orgHeaders(fixture.organizationId),
            }),
            harness.authenticatedRequest(fixture.participant, {
                method: "POST",
                url: `/api/v1/teams/${fixture.teamId}/invitations`,
                payload: { email },
                headers: orgHeaders(fixture.organizationId),
            }),
        ]);
        expect(statuses(invites)).toEqual([201, 409]);
        const invitations = await queryAsOwner<{ count: string }>(
            "select count(*)::text as count from team_invitations where organization_id = $1 and team_id = $2 and email = $3",
            [fixture.organizationId, fixture.teamId, email.toLowerCase()],
        );
        expect(invitations[0]?.count).toBe("1");

        const token = await invitationToken(fixture.organizationId, email);
        const accepts = await Promise.all([
            harness.authenticatedRequest(fixture.joinerA, {
                method: "POST",
                url: "/api/v1/team-invitations/accept",
                payload: { token },
                headers: orgHeaders(fixture.organizationId),
            }),
            harness.authenticatedRequest(fixture.joinerA, {
                method: "POST",
                url: "/api/v1/team-invitations/accept",
                payload: { token },
                headers: orgHeaders(fixture.organizationId),
            }),
        ]);
        expect(statuses(accepts)).toEqual([200, 409]);

        const members = await queryAsOwner<{ count: string }>(
            "select count(*)::text as count from team_members where organization_id = $1 and team_id = $2",
            [fixture.organizationId, fixture.teamId],
        );
        expect(members[0]?.count).toBe("2");
    });

    it("enforces team capacity under concurrent invitation acceptance", async () => {
        const edition = await createRegistrationEdition(
            harness,
            fixture.owner,
            fixture.organizationId,
            "Capacity Race",
        );
        const captain = await harness.signIn({
            email: uniqueEmail("capacity-captain"),
            name: "Capacity Captain",
        });
        const contenderA = await harness.signIn({
            email: uniqueEmail("capacity-a"),
            name: "Capacity A",
        });
        const contenderB = await harness.signIn({
            email: uniqueEmail("capacity-b"),
            name: "Capacity B",
        });
        for (const session of [captain, contenderA, contenderB]) {
            await addMember(
                harness,
                fixture.owner,
                fixture.organizationId,
                emailOf(session),
                "participant",
            );
            const registration = await harness.authenticatedRequest(session, {
                method: "POST",
                url: `/api/v1/competitions/${edition.editionId}/registrations`,
                payload: {},
                headers: orgHeaders(fixture.organizationId),
            });
            expectStatus(registration, 201, "register capacity user");
            const registrationId = (registration.json() as IdBody).id;
            const decision = await harness.authenticatedRequest(fixture.owner, {
                method: "POST",
                url: `/api/v1/competitions/${edition.editionId}/registrations/${registrationId}/decision`,
                payload: { status: "approved" },
                headers: orgHeaders(fixture.organizationId),
            });
            expectStatus(decision, 200, "approve capacity user");
        }

        const team = await harness.authenticatedRequest(captain, {
            method: "POST",
            url: `/api/v1/competitions/${edition.editionId}/teams`,
            payload: { editionId: edition.editionId, name: "Capacity Team", description: "" },
            headers: orgHeaders(fixture.organizationId),
        });
        expectStatus(team, 201, "create capacity team");
        const teamId = (team.json() as IdBody).id;

        for (const contender of [contenderA, contenderB]) {
            const invitation = await harness.authenticatedRequest(captain, {
                method: "POST",
                url: `/api/v1/teams/${teamId}/invitations`,
                payload: { email: emailOf(contender) },
                headers: orgHeaders(fixture.organizationId),
            });
            expectStatus(invitation, 201, `invite ${emailOf(contender)}`);
            const body = invitation.json() as InvitationBody;
            expect(body.id).toBeTruthy();
        }

        const tokenA = await invitationToken(fixture.organizationId, emailOf(contenderA));
        const tokenB = await invitationToken(fixture.organizationId, emailOf(contenderB));
        const accepts = await Promise.all([
            harness.authenticatedRequest(contenderA, {
                method: "POST",
                url: "/api/v1/team-invitations/accept",
                payload: { token: tokenA },
                headers: orgHeaders(fixture.organizationId),
            }),
            harness.authenticatedRequest(contenderB, {
                method: "POST",
                url: "/api/v1/team-invitations/accept",
                payload: { token: tokenB },
                headers: orgHeaders(fixture.organizationId),
            }),
        ]);

        expect(statuses(accepts)).toEqual([200, 409]);
        const members = await queryAsOwner<{ count: string }>(
            "select count(*)::text as count from team_members where organization_id = $1 and team_id = $2",
            [fixture.organizationId, teamId],
        );
        expect(members[0]?.count).toBe("2");
        const pending = await queryAsOwner<{ status: string }>(
            "select status from team_invitations where organization_id = $1 and team_id = $2 and email = any($3) order by email",
            [fixture.organizationId, teamId, [emailOf(contenderA), emailOf(contenderB)]],
        );
        expect(pending.map((row) => row.status).toSorted()).toEqual(["accepted", "pending"]);
    });

    it("rejects a duplicate competition-series slug", async () => {
        const slug = uniqueSlug("duplicate-series");
        const first = await harness.authenticatedRequest(fixture.owner, {
            method: "POST",
            url: `/api/v1/organizations/${fixture.organizationId}/competitions`,
            payload: { name: "Duplicate Series One", slug, description: "" },
        });
        expectStatus(first, 201, "first series");
        const second = await harness.authenticatedRequest(fixture.owner, {
            method: "POST",
            url: `/api/v1/organizations/${fixture.organizationId}/competitions`,
            payload: { name: "Duplicate Series Two", slug, description: "" },
        });
        expect(second.statusCode).toBe(409);

        const rows = await queryAsOwner<{ count: string }>(
            "select count(*)::text as count from competition_series where organization_id = $1 and slug = $2",
            [fixture.organizationId, slug],
        );
        expect(rows[0]?.count).toBe("1");
    });

    it("rejects a duplicate organization slug", async () => {
        const slug = uniqueSlug("duplicate-org");
        const firstOwner = await harness.signIn({
            email: uniqueEmail("dup-org-one"),
            name: "Duplicate Org One",
        });
        const secondOwner = await harness.signIn({
            email: uniqueEmail("dup-org-two"),
            name: "Duplicate Org Two",
        });
        const first = await harness.authenticatedRequest(firstOwner, {
            method: "POST",
            url: "/api/v1/organizations",
            payload: { name: "Duplicate Org One", slug, description: "" },
        });
        expectStatus(first, 201, "first organization");
        const second = await harness.authenticatedRequest(secondOwner, {
            method: "POST",
            url: "/api/v1/organizations",
            payload: { name: "Duplicate Org Two", slug, description: "" },
        });
        expect(second.statusCode).toBe(409);
    });

    it("keeps server-generated project slugs unique when titles collide", async () => {
        const title = `Concurrent Project ${uniqueSlug("title")}`;
        const requests = await Promise.all([
            harness.authenticatedRequest(fixture.participant, {
                method: "POST",
                url: "/api/v1/projects",
                payload: { editionId: fixture.editionId, title, summary: "First copy." },
                headers: orgHeaders(fixture.organizationId),
            }),
            harness.authenticatedRequest(fixture.extraParticipant, {
                method: "POST",
                url: "/api/v1/projects",
                payload: { editionId: fixture.editionId, title, summary: "Second copy." },
                headers: orgHeaders(fixture.organizationId),
            }),
        ]);
        expect(statuses(requests)).toEqual([201, 201]);
        const slugs = requests.map((response) => (response.json() as { slug: string }).slug);
        expect(new Set(slugs).size).toBe(2);

        const rows = await queryAsOwner<{ count: string }>(
            "select count(*)::text as count from projects where organization_id = $1 and slug = any($2)",
            [fixture.organizationId, slugs],
        );
        expect(rows[0]?.count).toBe("2");
    });
});
