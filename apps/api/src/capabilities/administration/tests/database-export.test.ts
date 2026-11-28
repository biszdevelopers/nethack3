import { describe, expect, it } from "vitest";
import { FixedClock } from "../../../core/clock.js";
import {
    DatabaseExportService,
    type DatabaseExportSection,
    type DatabaseExportSnapshot,
    type DatabaseExportSource,
} from "../application/database-export.js";

class FakeSnapshot implements DatabaseExportSnapshot {
    readonly rows: Partial<Record<DatabaseExportSection, readonly Record<string, unknown>[]>>;
    closeCalls = 0;
    abortCalls = 0;
    organizationsUsed: string[] = [];

    constructor(rows: Partial<Record<DatabaseExportSection, readonly Record<string, unknown>[]>>) {
        this.rows = rows;
    }

    async useOrganization(organizationId: string): Promise<void> {
        this.organizationsUsed.push(organizationId);
    }

    async read(
        section: DatabaseExportSection,
        _offset: number,
        _limit: number,
    ): Promise<readonly Record<string, unknown>[]> {
        return this.rows[section] ?? [];
    }

    async close(): Promise<void> {
        this.closeCalls += 1;
    }

    async abort(): Promise<void> {
        this.abortCalls += 1;
    }
}

function sourceFor(snapshot: FakeSnapshot): DatabaseExportSource {
    return {
        async open() {
            return snapshot;
        },
    };
}

describe("DatabaseExportService", () => {
    it("writes a parseable archive without judge, token, file, or notification secrets", async () => {
        const snapshot = new FakeSnapshot({
            organizations: [
                {
                    id: "11111111-1111-4111-8111-111111111111",
                    name: "Organization",
                    tokenHash: "must-not-leak",
                },
            ],
            judgeAssignments: [
                {
                    id: "22222222-2222-4222-8222-222222222222",
                    submissionId: "33333333-3333-4333-8333-333333333333",
                    judgeUserId: "judge-identity",
                    assignedByUserId: "assigner-identity",
                    storageKey: "private/storage/key",
                },
            ],
            submissionFiles: [
                {
                    id: "44444444-4444-4444-8444-444444444444",
                    fileName: "proposal.pdf",
                    storageKey: "private/storage/path",
                    content: "file bytes",
                },
            ],
            editionResults: [
                {
                    editionId: "55555555-5555-4555-8555-555555555555",
                    snapshot: {
                        judgingEntries: [
                            {
                                submissionId: "33333333-3333-4333-8333-333333333333",
                                judgeUserId: "nested-judge-identity",
                            },
                        ],
                    },
                },
            ],
            notifications: [
                {
                    id: "66666666-6666-4666-8666-666666666666",
                    title: "Results published",
                    userId: "recipient-identity",
                    body: "private body",
                    dedupeKey: "private-dedupe",
                },
            ],
        });
        const service = new DatabaseExportService(
            sourceFor(snapshot),
            new FixedClock(new Date("2026-01-02T03:04:05.000Z")),
        );

        let output = "";
        for await (const chunk of service.stream()) {
            output += chunk;
        }
        const archive = JSON.parse(output) as {
            formatVersion: number;
            generatedAt: string;
            omitted: string[];
            organizations: Record<string, unknown>[];
            judgeAssignments: Record<string, unknown>[];
            submissionFiles: Record<string, unknown>[];
            editionResults: {
                snapshot: { judgingEntries: Record<string, unknown>[] };
            }[];
            notifications: Record<string, unknown>[];
        };

        expect(archive.formatVersion).toBe(1);
        expect(archive.generatedAt).toBe("2026-01-02T03:04:05.000Z");
        expect(archive.omitted.join(" ")).toContain("Judge identities");
        expect(archive.organizations[0]?.name).toBe("Organization");
        expect(archive.organizations[0]?.tokenHash).toBeUndefined();
        expect(archive.judgeAssignments[0]?.judgeUserId).toBeUndefined();
        expect(archive.judgeAssignments[0]?.assignedByUserId).toBeUndefined();
        expect(archive.judgeAssignments[0]?.storageKey).toBeUndefined();
        expect(archive.submissionFiles[0]?.storageKey).toBeUndefined();
        expect(archive.submissionFiles[0]?.content).toBeUndefined();
        expect(archive.editionResults[0]?.snapshot.judgingEntries[0]?.judgeUserId).toBeUndefined();
        expect(archive.notifications[0]?.userId).toBeUndefined();
        expect(archive.notifications[0]?.body).toBeUndefined();
        expect(archive.notifications[0]?.dedupeKey).toBeUndefined();
        expect(archive.notifications[0]?.title).toBe("Results published");
        expect(snapshot.organizationsUsed).toContain("11111111-1111-4111-8111-111111111111");
        expect(snapshot.closeCalls).toBe(1);
        expect(snapshot.abortCalls).toBe(0);
    });

    it("aborts the snapshot when reading fails", async () => {
        const snapshot = new FakeSnapshot({});
        snapshot.read = async () => {
            throw new Error("read failed");
        };
        const service = new DatabaseExportService(
            sourceFor(snapshot),
            new FixedClock(new Date("2026-01-02T03:04:05.000Z")),
        );

        const consume = async (): Promise<void> => {
            for await (const chunk of service.stream()) {
                void chunk;
            }
        };

        await expect(consume()).rejects.toThrow("read failed");
        expect(snapshot.abortCalls).toBe(1);
        expect(snapshot.closeCalls).toBe(0);
    });

    it("writes quoted CSV with headers and the same redactions", async () => {
        const snapshot = new FakeSnapshot({
            organizations: [
                {
                    id: "11111111-1111-4111-8111-111111111111",
                    name: 'Organization, "One"',
                    tokenHash: "must-not-leak",
                },
            ],
            teams: [
                {
                    id: "22222222-2222-4222-8222-222222222222",
                    name: "Team\nTwo",
                    description: "=SUM(A1:A2)",
                    captainUserId: "33333333-3333-4333-8333-333333333333",
                },
            ],
            notifications: [
                {
                    id: "44444444-4444-4444-8444-444444444444",
                    title: "Results, published",
                    body: "private body",
                    dedupeKey: "private-dedupe",
                },
            ],
        });
        const service = new DatabaseExportService(
            sourceFor(snapshot),
            new FixedClock(new Date("2026-01-02T03:04:05.000Z")),
        );

        let output = "";
        for await (const chunk of service.streamCsv()) {
            output += chunk;
        }
        const lines = output.split("\n");

        expect(lines[0]).toBe("id,name");
        expect(lines[1]).toBe('11111111-1111-4111-8111-111111111111,"Organization, ""One"""');
        expect(output).not.toContain("must-not-leak");
        expect(output).toContain("id,name,description,captainUserId");
        expect(output).toContain('"Team\nTwo"');
        expect(output).toContain("'=SUM(A1:A2)");
        expect(output).toContain("id,title");
        expect(output).toContain('44444444-4444-4444-8444-444444444444,"Results, published"');
        expect(output).not.toContain("private body");
        expect(output).not.toContain("private-dedupe");
        expect(snapshot.closeCalls).toBe(1);
        expect(snapshot.abortCalls).toBe(0);
    });
});
