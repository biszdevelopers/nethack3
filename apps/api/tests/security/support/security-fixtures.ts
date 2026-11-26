import type { LightMyRequestResponse } from "fastify";
import type { TestHarness, TestSession } from "../../support/app-harness.js";
import { queryAsOwner, uniqueEmail, uniqueSlug } from "../../support/test-database.js";

export interface SecurityFixture {
    readonly owner: TestSession;
    readonly participant: TestSession;
    readonly judge: TestSession;
    readonly organizer: TestSession;
    readonly extraParticipant: TestSession;
    readonly joinerA: TestSession;
    readonly joinerB: TestSession;
    readonly outsider: TestSession;
    readonly organizationId: string;
    readonly outsiderOrganizationId: string;
    readonly privateSeriesId: string;
    readonly privateEditionId: string;
    readonly privateDivisionId: string;
    readonly privateMilestoneId: string;
    readonly seriesId: string;
    readonly editionId: string;
    readonly divisionId: string;
    readonly milestoneId: string;
    readonly registrationId: string;
    readonly teamId: string;
    readonly invitationId: string;
    readonly projectId: string;
    readonly projectSlug: string;
    readonly submissionId: string;
    readonly submissionVersionId: string;
    readonly rubricId: string;
    readonly criterionId: string;
    readonly assignmentId: string;
    readonly evaluationId: string;
    readonly evaluationScoreId: string;
    readonly roundId: string;
    readonly ballotId: string;
    readonly voteId: string;
    readonly announcementId: string;
    readonly fileId: string;
}

export interface CreatedOrganizationFixture {
    readonly organizationId: string;
    readonly owner: TestSession;
}

export function expectStatus(
    response: LightMyRequestResponse,
    expected: number,
    context: string,
): void {
    if (response.statusCode !== expected) {
        throw new Error(
            `${context}: expected status ${expected}, received ${response.statusCode}: ${response.body}`,
        );
    }
}

export function emailOf(session: TestSession): string {
    const email = session.session.user.email;
    if (email === null) {
        throw new Error("The signed-in user has no email address.");
    }
    return email;
}

interface JsonRecord {
    readonly [key: string]: unknown;
}

function jsonObject(response: LightMyRequestResponse): JsonRecord {
    const value: unknown = response.json();
    if (typeof value !== "object" || value === null) {
        throw new Error(`Expected a JSON object body: ${response.body}`);
    }
    return value as JsonRecord;
}

function stringField(response: LightMyRequestResponse, field: string): string {
    const value = jsonObject(response)[field];
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`Expected a string field "${field}": ${response.body}`);
    }
    return value;
}

function stringArrayField(response: LightMyRequestResponse, field: string): string[] {
    const value = jsonObject(response)[field];
    if (!Array.isArray(value)) {
        throw new Error(`Expected an array field "${field}": ${response.body}`);
    }
    return value.map((entry) => {
        if (typeof entry !== "string") {
            throw new Error(`Expected string array field "${field}": ${response.body}`);
        }
        return entry;
    });
}

interface ListPage {
    readonly items: readonly JsonRecord[];
}

function listPage(response: LightMyRequestResponse): ListPage {
    const items = jsonObject(response).items;
    if (!Array.isArray(items)) {
        throw new Error(`Expected a list response: ${response.body}`);
    }
    return {
        items: items.map((entry) => entry as JsonRecord),
    };
}

interface RegistrationRow {
    readonly id: string;
    readonly userId: string;
}

interface RubricBody {
    readonly id: string;
    readonly criteria: readonly { readonly id: string }[];
}

interface FileBody {
    readonly id: string;
}

interface SubmissionBody {
    readonly id: string;
    readonly versions: readonly { readonly id: string }[];
}

export async function createSecurityOrganization(
    harness: TestHarness,
    prefix: string,
): Promise<CreatedOrganizationFixture> {
    const owner = await harness.signIn({ email: uniqueEmail(`${prefix}-owner`), name: "Org Owner" });
    const organization = await harness.createOrganization(owner, {
        name: `Security ${prefix}`,
        slug: uniqueSlug(prefix),
    });
    return { organizationId: organization.id, owner };
}

export async function addMember(
    harness: TestHarness,
    owner: TestSession,
    organizationId: string,
    email: string,
    role: "owner" | "organizer" | "judge" | "participant",
): Promise<void> {
    const response = await harness.authenticatedRequest(owner, {
        method: "POST",
        url: `/api/v1/organizations/${organizationId}/members`,
        payload: { email, role },
    });
    expectStatus(response, 201, `add ${role} member ${email}`);
}

async function approveRegistration(
    harness: TestHarness,
    owner: TestSession,
    organizationId: string,
    editionId: string,
    participant: TestSession,
): Promise<string> {
    const registration = await harness.authenticatedRequest(participant, {
        method: "POST",
        url: `/api/v1/competitions/${editionId}/registrations`,
        payload: {},
        headers: { "x-nethack-organization-id": organizationId },
    });
    expectStatus(registration, 201, "register participant");
    const registrationId = stringField(registration, "id");

    const list = await harness.authenticatedRequest(owner, {
        method: "GET",
        url: `/api/v1/competitions/${editionId}/registrations`,
        headers: { "x-nethack-organization-id": organizationId },
    });
    expectStatus(list, 200, "list registrations");
    const row = listPage(list).items.find(
        (entry) => entry.userId === participant.userId && entry.id === registrationId,
    );
    if (row === undefined) {
        throw new Error("The participant registration was not found after registering.");
    }

    const decision = await harness.authenticatedRequest(owner, {
        method: "POST",
        url: `/api/v1/competitions/${editionId}/registrations/${registrationId}/decision`,
        payload: { status: "approved" },
        headers: { "x-nethack-organization-id": organizationId },
    });
    expectStatus(decision, 200, "approve registration");
    return registrationId;
}

export async function createRegistrationEdition(
    harness: TestHarness,
    organizer: TestSession,
    organizationId: string,
    name: string,
): Promise<{ readonly seriesId: string; readonly editionId: string }> {
    const series = await harness.authenticatedRequest(organizer, {
        method: "POST",
        url: `/api/v1/organizations/${organizationId}/competitions`,
        payload: {
            name: `${name} Series`,
            slug: uniqueSlug("series"),
            description: "",
        },
    });
    expectStatus(series, 201, `create series ${name}`);
    const seriesId = stringField(series, "id");

    const edition = await harness.authenticatedRequest(organizer, {
        method: "POST",
        url: `/api/v1/organizations/${organizationId}/competitions/${seriesId}/editions`,
        payload: {
            name: `${name} Edition`,
            slug: uniqueSlug("edition"),
            description: "",
            timezone: "UTC",
            teamMinSize: 1,
            teamMaxSize: 2,
        },
    });
    expectStatus(edition, 201, `create edition ${name}`);
    const editionId = stringField(edition, "id");

    const published = await harness.authenticatedRequest(organizer, {
        method: "POST",
        url: `/api/v1/competitions/${editionId}/publish`,
        headers: { "x-nethack-organization-id": organizationId },
    });
    expectStatus(published, 200, `publish edition ${name}`);

    const open = await harness.authenticatedRequest(organizer, {
        method: "PATCH",
        url: `/api/v1/competitions/${editionId}`,
        payload: { status: "registration_open" },
        headers: { "x-nethack-organization-id": organizationId },
    });
    expectStatus(open, 200, `open registration for ${name}`);

    return { seriesId, editionId };
}

export async function buildSecurityFixture(harness: TestHarness): Promise<SecurityFixture> {
    const { organizationId, owner } = await createSecurityOrganization(harness, "main");

    const participant = await harness.signIn({
        email: uniqueEmail("main-participant"),
        name: "Participant",
    });
    const judge = await harness.signIn({ email: uniqueEmail("main-judge"), name: "Judge" });
    const organizer = await harness.signIn({
        email: uniqueEmail("main-organizer"),
        name: "Organizer",
    });
    const extraParticipant = await harness.signIn({
        email: uniqueEmail("main-extra"),
        name: "Extra Participant",
    });
    const joinerA = await harness.signIn({ email: uniqueEmail("main-joiner-a"), name: "Joiner A" });
    const joinerB = await harness.signIn({ email: uniqueEmail("main-joiner-b"), name: "Joiner B" });

    for (const session of [participant, extraParticipant, joinerA, joinerB]) {
        await addMember(harness, owner, organizationId, emailOf(session), "participant");
    }
    await addMember(harness, owner, organizationId, emailOf(judge), "judge");
    await addMember(harness, owner, organizationId, emailOf(organizer), "organizer");

    const outsider = await harness.signIn({ email: uniqueEmail("outsider"), name: "Outsider" });
    const outsiderOrganization = await harness.createOrganization(outsider, {
        name: "Outsider Org",
        slug: uniqueSlug("outsider"),
    });

    // Private rows for row-level-security probes: a draft edition must never be
    // visible through the public predicates on competitions or projects.
    const privateSeries = await harness.authenticatedRequest(owner, {
        method: "POST",
        url: `/api/v1/organizations/${organizationId}/competitions`,
        payload: { name: "Private Series", slug: uniqueSlug("private-series"), description: "" },
    });
    expectStatus(privateSeries, 201, "create private series");
    const privateSeriesId = stringField(privateSeries, "id");

    const privateEdition = await harness.authenticatedRequest(owner, {
        method: "POST",
        url: `/api/v1/organizations/${organizationId}/competitions/${privateSeriesId}/editions`,
        payload: {
            name: "Private Edition",
            slug: uniqueSlug("private-edition"),
            description: "",
            timezone: "UTC",
            teamMinSize: 1,
            teamMaxSize: 2,
        },
    });
    expectStatus(privateEdition, 201, "create private edition");
    const privateEditionId = stringField(privateEdition, "id");

    const privateDivision = await harness.authenticatedRequest(owner, {
        method: "POST",
        url: `/api/v1/competitions/${privateEditionId}/divisions`,
        payload: { name: "Private Division", slug: uniqueSlug("private-division"), description: "" },
        headers: { "x-nethack-organization-id": organizationId },
    });
    expectStatus(privateDivision, 201, "create private division");
    const privateDivisionId = stringField(privateDivision, "id");

    const privateMilestone = await harness.authenticatedRequest(owner, {
        method: "POST",
        url: `/api/v1/competitions/${privateEditionId}/milestones`,
        payload: {
            title: "Private Milestone",
            kind: "other",
            occursAt: new Date().toISOString(),
        },
        headers: { "x-nethack-organization-id": organizationId },
    });
    expectStatus(privateMilestone, 201, "create private milestone");
    const privateMilestoneId = stringField(privateMilestone, "id");

    const { seriesId, editionId } = await createRegistrationEdition(
        harness,
        owner,
        organizationId,
        "Main",
    );

    const division = await harness.authenticatedRequest(owner, {
        method: "POST",
        url: `/api/v1/competitions/${editionId}/divisions`,
        payload: { name: "Open", slug: uniqueSlug("open"), description: "" },
        headers: { "x-nethack-organization-id": organizationId },
    });
    expectStatus(division, 201, "create division");
    const divisionId = stringField(division, "id");

    const milestone = await harness.authenticatedRequest(owner, {
        method: "POST",
        url: `/api/v1/competitions/${editionId}/milestones`,
        payload: {
            title: "Kickoff",
            kind: "other",
            occursAt: new Date().toISOString(),
        },
        headers: { "x-nethack-organization-id": organizationId },
    });
    expectStatus(milestone, 201, "create milestone");
    const milestoneId = stringField(milestone, "id");

    const registrationId = await approveRegistration(
        harness,
        owner,
        organizationId,
        editionId,
        participant,
    );
    for (const session of [extraParticipant, joinerA, joinerB]) {
        await approveRegistration(harness, owner, organizationId, editionId, session);
    }

    // Fixture setup uses the real route; the participant row update runs after
    // the team transaction commits (see TeamService.create).
    const team = await harness.authenticatedRequest(participant, {
        method: "POST",
        url: `/api/v1/competitions/${editionId}/teams`,
        payload: { editionId, name: "Team Alpha", description: "" },
        headers: { "x-nethack-organization-id": organizationId },
    });
    expectStatus(team, 201, "create team");
    const teamId = stringField(team, "id");

    const invitation = await harness.authenticatedRequest(participant, {
        method: "POST",
        url: `/api/v1/teams/${teamId}/invitations`,
        payload: { email: uniqueEmail("rls-invitee") },
        headers: { "x-nethack-organization-id": organizationId },
    });
    expectStatus(invitation, 201, "create team invitation");
    const invitationId = stringField(invitation, "id");

    const project = await harness.authenticatedRequest(participant, {
        method: "POST",
        url: "/api/v1/projects",
        payload: {
            editionId,
            title: "Security Project",
            summary: "A project used by the security test suite.",
        },
        headers: { "x-nethack-organization-id": organizationId },
    });
    expectStatus(project, 201, "create project");
    const projectId = stringField(project, "id");
    const projectSlug = stringField(project, "slug");

    const submission = await harness.authenticatedRequest(participant, {
        method: "POST",
        url: "/api/v1/submissions",
        payload: { projectId },
        headers: { "x-nethack-organization-id": organizationId },
    });
    expectStatus(submission, 201, "create submission");
    const submissionId = stringField(submission, "id");

    const versionResponse = await harness.authenticatedRequest(participant, {
        method: "POST",
        url: `/api/v1/submissions/${submissionId}/versions`,
        payload: {
            title: "Submission One",
            summary: "The first submitted version.",
            submit: true,
        },
        headers: { "x-nethack-organization-id": organizationId },
    });
    expectStatus(versionResponse, 200, "submit version");
    const submissionBody = jsonObject(versionResponse) as unknown as SubmissionBody;
    const submissionVersionId = submissionBody.versions[0]?.id;
    if (submissionVersionId === undefined) {
        throw new Error("The submission has no version after submitting.");
    }

    const rubric = await harness.authenticatedRequest(owner, {
        method: "POST",
        url: `/api/v1/competitions/${editionId}/rubrics`,
        payload: {
            name: "Security Rubric",
            description: "",
            criteria: [{ name: "Quality", maxScore: 10, weight: 1 }],
        },
        headers: { "x-nethack-organization-id": organizationId },
    });
    expectStatus(rubric, 201, "create rubric");
    const rubricBody = jsonObject(rubric) as unknown as RubricBody;
    const rubricId = rubricBody.id;
    const criterionId = rubricBody.criteria[0]?.id;
    if (criterionId === undefined) {
        throw new Error("The rubric has no criteria.");
    }

    const assignment = await harness.authenticatedRequest(owner, {
        method: "POST",
        url: `/api/v1/competitions/${editionId}/assignments`,
        payload: {
            submissionId,
            judgeEmail: emailOf(judge),
            rubricId,
        },
        headers: { "x-nethack-organization-id": organizationId },
    });
    expectStatus(assignment, 201, "create judge assignment");
    const assignmentId = stringField(assignment, "id");

    const evaluation = await harness.authenticatedRequest(judge, {
        method: "PUT",
        url: `/api/v1/assignments/${assignmentId}/evaluation`,
        payload: {
            scores: [{ criterionId, score: 8, comment: "Solid." }],
            overallComment: "Good work.",
        },
        headers: { "x-nethack-organization-id": organizationId },
    });
    expectStatus(evaluation, 200, "save evaluation");
    const evaluationId = stringField(evaluation, "id");
    const scoreRows = await queryAsOwner<{ id: string }>(
        "select id from evaluation_scores where organization_id = $1 and evaluation_id = $2 limit 1",
        [organizationId, evaluationId],
    );
    const evaluationScoreId = scoreRows[0]?.id;
    if (evaluationScoreId === undefined) {
        throw new Error("The evaluation has no score rows.");
    }

    const round = await harness.authenticatedRequest(owner, {
        method: "POST",
        url: `/api/v1/competitions/${editionId}/voting-rounds`,
        payload: {
            name: "Security Round",
            eligibleRoles: ["participant"],
            maxSelections: 1,
        },
        headers: { "x-nethack-organization-id": organizationId },
    });
    expectStatus(round, 201, "create voting round");
    const roundId = stringField(round, "id");

    const opened = await harness.authenticatedRequest(owner, {
        method: "POST",
        url: `/api/v1/voting-rounds/${roundId}/open`,
        headers: { "x-nethack-organization-id": organizationId },
    });
    expectStatus(opened, 200, "open voting round");

    const ballot = await harness.authenticatedRequest(participant, {
        method: "POST",
        url: `/api/v1/voting-rounds/${roundId}/ballot`,
        payload: { submissionIds: [submissionId] },
        headers: { "x-nethack-organization-id": organizationId },
    });
    expectStatus(ballot, 201, "cast ballot");
    const ballotRows = await queryAsOwner<{ id: string }>(
        "select id from ballots where organization_id = $1 and round_id = $2 and user_id = $3",
        [organizationId, roundId, participant.userId],
    );
    const ballotId = ballotRows[0]?.id;
    if (ballotId === undefined) {
        throw new Error("The ballot was not stored.");
    }
    const voteRows = await queryAsOwner<{ id: string }>(
        "select id from votes where organization_id = $1 and ballot_id = $2 limit 1",
        [organizationId, ballotId],
    );
    const voteId = voteRows[0]?.id;
    if (voteId === undefined) {
        throw new Error("The ballot has no vote rows.");
    }

    const announcement = await harness.authenticatedRequest(owner, {
        method: "POST",
        url: `/api/v1/organizations/${organizationId}/announcements`,
        payload: {
            title: "Organization Update",
            bodyMarkdown: "Members only.",
            visibility: "organization",
            publish: true,
        },
    });
    expectStatus(announcement, 201, "create announcement");
    const announcementId = stringField(announcement, "id");

    const file = await uploadValidPng(harness, participant, organizationId, projectId);

    return {
        owner,
        participant,
        judge,
        organizer,
        extraParticipant,
        joinerA,
        joinerB,
        outsider,
        organizationId,
        outsiderOrganizationId: outsiderOrganization.id,
        privateSeriesId,
        privateEditionId,
        privateDivisionId,
        privateMilestoneId,
        seriesId,
        editionId,
        divisionId,
        milestoneId,
        registrationId,
        teamId,
        invitationId,
        projectId,
        projectSlug,
        submissionId,
        submissionVersionId,
        rubricId,
        criterionId,
        assignmentId,
        evaluationId,
        evaluationScoreId,
        roundId,
        ballotId,
        voteId,
        announcementId,
        fileId: file.id,
    };
}

export const PNG_1X1 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
);

export async function multipartFile(file: {
    readonly filename: string;
    readonly contentType: string;
    readonly data: Buffer;
}): Promise<{ readonly payload: Buffer; readonly contentType: string }> {
    const form = new FormData();
    form.append(
        "file",
        new Blob([new Uint8Array(file.data)], { type: file.contentType }),
        file.filename,
    );
    const response = new Response(form);
    const contentType = response.headers.get("content-type");
    if (contentType === null) {
        throw new Error("The multipart body has no content type.");
    }
    return {
        payload: Buffer.from(await response.arrayBuffer()),
        contentType,
    };
}

export async function uploadValidPng(
    harness: TestHarness,
    session: TestSession,
    organizationId: string,
    projectId: string,
): Promise<FileBody> {
    const body = await multipartFile({
        filename: "pixel.png",
        contentType: "image/png",
        data: PNG_1X1,
    });
    const response = await harness.authenticatedRequest(session, {
        method: "POST",
        url: `/api/v1/projects/${projectId}/files`,
        payload: body.payload,
        headers: {
            "content-type": body.contentType,
            "x-nethack-organization-id": organizationId,
        },
    });
    expectStatus(response, 201, "upload PNG");
    return jsonObject(response) as unknown as FileBody;
}

export async function listIds(response: LightMyRequestResponse): Promise<readonly string[]> {
    return listPage(response).items.flatMap((item) =>
        typeof item.id === "string" ? [item.id] : [],
    );
}

export { stringArrayField, stringField };
