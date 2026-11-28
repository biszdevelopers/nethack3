import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "../../../authentication/types.js";
import { FixedClock } from "../../../core/clock.js";
import type { DatabaseConnection } from "../../../infrastructure/database/client.js";
import { DebugAiService } from "../application/debug-ai-service.js";
import type { DebugAiRepository } from "../infrastructure/debug-ai-repository.js";

const sessionId = "11111111-1111-4111-8111-111111111111";

function auth(): AuthContext {
    return {
        method: "session",
        sessionId: "22222222-2222-4222-8222-222222222222",
        sessionTokenHash: null,
        csrfToken: null,
        csrfHash: null,
        user: {
            id: "33333333-3333-4333-8333-333333333333",
            displayName: "Operator",
            email: "operator@example.test",
            avatarUrl: null,
            locale: "en",
            status: "active",
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        memberships: [],
        globalAdministrator: true,
        permissions: [],
        expiresAt: new Date(),
    };
}

describe("DebugAiService without configuration", () => {
    it("reports the assistant as not configured without exposing a model", () => {
        const service = new DebugAiService(
            {} as DatabaseConnection,
            {} as DebugAiRepository,
            new FixedClock(new Date("2026-01-02T03:04:05.000Z")),
            null,
        );

        expect(service.status()).toEqual({ configured: false, model: null });
    });

    it("returns a clear 503 and never calls the provider or repository", async () => {
        const findSession = vi.fn();
        const fetchImpl = vi.fn();
        const service = new DebugAiService(
            {} as DatabaseConnection,
            { findSession } as unknown as DebugAiRepository,
            new FixedClock(new Date("2026-01-02T03:04:05.000Z")),
            null,
            fetchImpl as unknown as typeof fetch,
        );

        await expect(service.sendMessage(auth(), sessionId, "Hello")).rejects.toMatchObject({
            statusCode: 503,
            message: expect.stringContaining("not configured"),
        });
        expect(findSession).not.toHaveBeenCalled();
        expect(fetchImpl).not.toHaveBeenCalled();
    });
});
