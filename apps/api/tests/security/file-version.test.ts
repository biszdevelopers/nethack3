import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startHarness, type TestHarness } from "../support/app-harness.js";
import {
    buildSecurityFixture,
    expectStatus,
    multipartFile,
    type SecurityFixture,
} from "./support/security-fixtures.js";

const PNG_1X1 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
);

describe("submission version file snapshots", () => {
    let harness: TestHarness;
    let fixture: SecurityFixture;

    beforeAll(async () => {
        harness = await startHarness();
        fixture = await buildSecurityFixture(harness);
    });

    afterAll(async () => {
        await harness.closeHarness();
    });

    it("snapshots an approved project file into the new version", async () => {
        const body = await multipartFile({
            filename: "version-pixel.png",
            contentType: "image/png",
            data: PNG_1X1,
        });
        const upload = await harness.authenticatedRequest(fixture.participant, {
            method: "POST",
            url: `/api/v1/projects/${fixture.projectId}/files`,
            payload: body.payload,
            headers: {
                "content-type": body.contentType,
                "x-nethack-organization-id": fixture.organizationId,
            },
        });
        expectStatus(upload, 201, "upload project file");

        const version = await harness.authenticatedRequest(fixture.participant, {
            method: "POST",
            url: `/api/v1/submissions/${fixture.submissionId}/versions`,
            payload: {
                title: "Version Two",
                summary: "A version with an attached project file.",
                descriptionMarkdown: "",
                submit: false,
            },
            headers: { "x-nethack-organization-id": fixture.organizationId },
        });
        expectStatus(version, 200, "create version with file");

        const detail = await harness.authenticatedRequest(fixture.participant, {
            method: "GET",
            url: `/api/v1/submissions/${fixture.submissionId}`,
            headers: { "x-nethack-organization-id": fixture.organizationId },
        });
        expectStatus(detail, 200, "read submission detail");
        const payload = detail.json() as {
            readonly versions: readonly {
                readonly version: number;
                readonly files: readonly { readonly fileName: string }[];
            }[];
        };
        const latest = payload.versions.find((entry) => entry.version === 2);
        expect(latest?.files.map((file) => file.fileName)).toContain("version-pixel.png");
    });
});
