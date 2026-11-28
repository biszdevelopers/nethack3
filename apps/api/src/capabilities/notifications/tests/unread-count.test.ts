import { describe, expect, it } from "vitest";
import type { Clock } from "../../../core/clock.js";
import type {
    DatabaseConnection,
    DatabaseExecutor,
} from "../../../infrastructure/database/client.js";
import { NotificationService } from "../application/notification-service.js";
import type { NotificationRepository } from "../infrastructure/notification-repository.js";

const USER_A = "f1000000-0000-4000-8000-000000000011";
const USER_B = "f1000000-0000-4000-8000-000000000012";

function serviceFor(
    counts: ReadonlyMap<string, number>,
    requestedUserIds: string[],
): NotificationService {
    const repository = {
        async countUnreadForUser(_db: DatabaseExecutor, userId: string): Promise<number> {
            requestedUserIds.push(userId);
            return counts.get(userId) ?? 0;
        },
    } as unknown as NotificationRepository;
    const database = { db: {} as DatabaseExecutor } as unknown as DatabaseConnection;
    return new NotificationService(database, repository, {
        now: () => new Date("2026-03-01T00:00:00.000Z"),
    } as Clock);
}

describe("notification unread count", () => {
    it("counts only the notifications of the requested user", async () => {
        const requested: string[] = [];
        const service = serviceFor(new Map([[USER_A, 3]]), requested);

        await expect(service.unreadCount(USER_A)).resolves.toBe(3);
        expect(requested).toEqual([USER_A]);
    });

    it("keeps counts isolated between users", async () => {
        const requested: string[] = [];
        const service = serviceFor(
            new Map([
                [USER_A, 3],
                [USER_B, 1],
            ]),
            requested,
        );

        await expect(service.unreadCount(USER_A)).resolves.toBe(3);
        await expect(service.unreadCount(USER_B)).resolves.toBe(1);
        expect(requested).toEqual([USER_A, USER_B]);
    });

    it("returns zero when the user has no unread notifications", async () => {
        const requested: string[] = [];
        const service = serviceFor(new Map(), requested);

        await expect(service.unreadCount(USER_A)).resolves.toBe(0);
        expect(requested).toEqual([USER_A]);
    });
});
