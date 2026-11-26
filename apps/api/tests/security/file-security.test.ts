import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { LightMyRequestResponse } from "fastify";
import { startHarness, type TestHarness } from "../support/app-harness.js";
import { queryAsOwner } from "../support/test-database.js";
import {
    buildSecurityFixture,
    expectStatus,
    multipartFile,
    PNG_1X1,
    type SecurityFixture,
} from "./support/security-fixtures.js";
import { buildZip } from "./support/zip-builder.js";

async function upload(
    harness: TestHarness,
    fixture: SecurityFixture,
    file: { readonly filename: string; readonly contentType: string; readonly data: Buffer },
): Promise<LightMyRequestResponse> {
    const body = await multipartFile(file);
    return harness.authenticatedRequest(fixture.participant, {
        method: "POST",
        url: `/api/v1/projects/${fixture.projectId}/files`,
        payload: body.payload,
        headers: {
            "content-type": body.contentType,
            "x-nethack-organization-id": fixture.organizationId,
        },
    });
}

describe("file upload and download security", () => {
    let harness: TestHarness;
    let fixture: SecurityFixture;

    beforeAll(async () => {
        harness = await startHarness();
        fixture = await buildSecurityFixture(harness);
    });

    afterAll(async () => {
        await harness.closeHarness();
    });

    it("accepts a signature-valid PNG and records it as approved", async () => {
        const response = await upload(harness, fixture, {
            filename: "valid.png",
            contentType: "image/png",
            data: PNG_1X1,
        });
        expectStatus(response, 201, "valid PNG upload");
        const body = response.json() as { status: string; contentType: string; fileName: string };
        expect(body.status).toBe("approved");
        expect(body.contentType).toBe("image/png");
        expect(body.fileName).toBe("valid.png");
    });

    it("accepts a structurally valid ZIP", async () => {
        const response = await upload(harness, fixture, {
            filename: "archive.zip",
            contentType: "application/zip",
            data: buildZip([{ name: "notes.txt", data: Buffer.from("hello", "utf8") }]),
        });
        expectStatus(response, 201, "valid ZIP upload");
    });

    it("rejects SVG, HTML, and executable payloads by signature", async () => {
        const svg = await upload(harness, fixture, {
            filename: "vector.svg",
            contentType: "image/svg+xml",
            data: Buffer.from(
                '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
                "utf8",
            ),
        });
        expect(svg.statusCode).toBe(400);

        const html = await upload(harness, fixture, {
            filename: "page.html",
            contentType: "text/html",
            data: Buffer.from("<!doctype html><script>alert(1)</script>", "utf8"),
        });
        expect(html.statusCode).toBe(400);

        const executable = await upload(harness, fixture, {
            filename: "program.exe",
            contentType: "application/octet-stream",
            data: Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]),
        });
        expect(executable.statusCode).toBe(400);

        const shebang = await upload(harness, fixture, {
            filename: "script.txt",
            contentType: "text/plain",
            data: Buffer.from("#!/bin/sh\nrm -rf /\n", "utf8"),
        });
        expect(shebang.statusCode).toBe(400);

        const rows = await queryAsOwner<{ count: string }>(
            "select count(*)::text as count from submission_files where organization_id = $1 and file_name = any($2)",
            [fixture.organizationId, ["vector.svg", "page.html", "program.exe", "script.txt"]],
        );
        expect(rows[0]?.count).toBe("0");
    });

    it("rejects an oversize upload", async () => {
        const response = await upload(harness, fixture, {
            filename: "huge.png",
            contentType: "image/png",
            data: Buffer.concat([PNG_1X1, Buffer.alloc(1_100_000, 0x41)]),
        });
        expect(response.statusCode).toBe(413);
    });

    it("rejects a ZIP with a traversal entry name", async () => {
        const response = await upload(harness, fixture, {
            filename: "traversal.zip",
            contentType: "application/zip",
            data: buildZip([{ name: "../escape.txt", data: Buffer.from("x", "utf8") }]),
        });
        expect(response.statusCode).toBe(400);
        expect(response.body).toContain("traversal");
    });

    it("rejects a ZIP with an absolute entry path", async () => {
        const response = await upload(harness, fixture, {
            filename: "absolute.zip",
            contentType: "application/zip",
            data: buildZip([{ name: "/etc/passwd", data: Buffer.from("x", "utf8") }]),
        });
        expect(response.statusCode).toBe(400);
    });

    it("rejects a ZIP with too many entries", async () => {
        const entries = Array.from({ length: 201 }, (_, index) => ({
            name: `entry-${index}.txt`,
            data: Buffer.alloc(0),
        }));
        const response = await upload(harness, fixture, {
            filename: "many.zip",
            contentType: "application/zip",
            data: buildZip(entries),
        });
        expect(response.statusCode).toBe(400);
        expect(response.body).toContain("too many entries");
    });

    it("requires authorization to download a private file", async () => {
        const unauthenticated = await harness.inject({
            method: "GET",
            url: `/api/v1/files/${fixture.fileId}/download`,
        });
        expect(unauthenticated.statusCode).toBe(404);

        const judge = await harness.authenticatedRequest(fixture.judge, {
            method: "GET",
            url: `/api/v1/files/${fixture.fileId}/download`,
        });
        expect(judge.statusCode).toBe(403);

        const uploader = await harness.authenticatedRequest(fixture.participant, {
            method: "GET",
            url: `/api/v1/files/${fixture.fileId}/download`,
        });
        expectStatus(uploader, 200, "uploader private download");
        expect(uploader.headers["content-disposition"]).toContain("attachment;");
        expect(uploader.headers["x-content-type-options"]).toBe("nosniff");
        expect(uploader.headers["content-security-policy"]).toBe("sandbox");
        expect(uploader.headers["cache-control"]).toBe("private, no-store");
    });

    it("serves approved files publicly only after the project is published", async () => {
        const closed = await harness.authenticatedRequest(fixture.owner, {
            method: "PATCH",
            url: `/api/v1/competitions/${fixture.editionId}`,
            payload: { status: "registration_closed" },
            headers: { "x-nethack-organization-id": fixture.organizationId },
        });
        expectStatus(closed, 200, "close registration");
        const active = await harness.authenticatedRequest(fixture.owner, {
            method: "PATCH",
            url: `/api/v1/competitions/${fixture.editionId}`,
            payload: { status: "active" },
            headers: { "x-nethack-organization-id": fixture.organizationId },
        });
        expectStatus(active, 200, "activate edition");

        const publicDownload = await harness.inject({
            method: "GET",
            url: `/api/v1/files/${fixture.fileId}/download`,
        });
        expect(publicDownload.statusCode).toBe(404);

        const published = await harness.authenticatedRequest(fixture.participant, {
            method: "POST",
            url: `/api/v1/projects/${fixture.projectId}/publish`,
            headers: { "x-nethack-organization-id": fixture.organizationId },
        });
        expectStatus(published, 200, "publish project");

        const allowed = await harness.inject({
            method: "GET",
            url: `/api/v1/files/${fixture.fileId}/download`,
        });
        expectStatus(allowed, 200, "public file download");
        expect(allowed.headers["content-disposition"]).toContain("attachment;");
        expect(allowed.headers["x-content-type-options"]).toBe("nosniff");
        expect(allowed.headers["content-security-policy"]).toBe("sandbox");
        expect(allowed.headers["content-type"]).toBe("image/png");
        expect(allowed.headers["cache-control"]).toContain("public");
    });

    it("stops serving a file once it is no longer approved", async () => {
        const extra = await upload(harness, fixture, {
            filename: "rejected.png",
            contentType: "image/png",
            data: PNG_1X1,
        });
        expectStatus(extra, 201, "upload rejection candidate");
        const fileId = (extra.json() as { id: string }).id;

        const published = await harness.authenticatedRequest(fixture.participant, {
            method: "POST",
            url: `/api/v1/projects/${fixture.projectId}/publish`,
            headers: { "x-nethack-organization-id": fixture.organizationId },
        });
        expect(published.statusCode).toBe(200);

        await queryAsOwner(
            "update submission_files set status = 'rejected' where id = $1 and organization_id = $2",
            [fileId, fixture.organizationId],
        );

        const response = await harness.inject({
            method: "GET",
            url: `/api/v1/files/${fileId}/download`,
        });
        expect(response.statusCode).toBe(404);
    });
});
