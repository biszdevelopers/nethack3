import { describe, expect, it } from "vitest";
import {
    buildFileSnapshot,
    type FileSnapshotIdentity,
    type FileSnapshotSource,
} from "../domain/file-snapshot.js";

const source: FileSnapshotSource = {
    projectId: "11111111-1111-4111-8111-111111111111",
    storageKey: "ab/abcdefab-abcdefab-abcdefab-abcdefab.png",
    fileName: "logo.png",
    contentType: "image/png",
    byteSize: 2048,
    checksumSha256: "a".repeat(64),
    uploadedByUserId: "22222222-2222-4222-8222-222222222222",
    inspectedAt: new Date("2026-01-02T03:04:05.000Z"),
};

const identity: FileSnapshotIdentity = {
    organizationId: "33333333-3333-4333-8333-333333333333",
    submissionId: "44444444-4444-4444-8444-444444444444",
    versionId: "55555555-5555-4555-8555-555555555555",
};

describe("file snapshot", () => {
    it("copies the project-level file into an approved version snapshot", () => {
        const snapshot = buildFileSnapshot(source, identity);
        expect(snapshot).toMatchObject({
            organizationId: identity.organizationId,
            projectId: source.projectId,
            submissionId: identity.submissionId,
            versionId: identity.versionId,
            storageKey: source.storageKey,
            fileName: source.fileName,
            contentType: source.contentType,
            byteSize: source.byteSize,
            checksumSha256: source.checksumSha256,
            uploadedByUserId: source.uploadedByUserId,
            status: "approved",
            inspectedAt: source.inspectedAt,
        });
        expect(snapshot.id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        );
    });

    it("generates a new id for each snapshot", () => {
        const first = buildFileSnapshot(source, identity);
        const second = buildFileSnapshot(source, identity);
        expect(first.id).not.toBe(second.id);
    });

    it("preserves nullable project and inspection values", () => {
        const snapshot = buildFileSnapshot(
            { ...source, projectId: null, inspectedAt: null },
            identity,
        );
        expect(snapshot.projectId).toBeNull();
        expect(snapshot.inspectedAt).toBeNull();
    });
});
