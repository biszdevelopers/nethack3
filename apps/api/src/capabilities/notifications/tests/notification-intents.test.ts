import { describe, expect, it } from "vitest";
import { domainEvents } from "../../../core/domain-event.js";
import { buildNotificationIntent } from "../domain/notification-intents.js";

const origin = "https://workspace.example";
const organizationId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const otherUserId = "33333333-3333-4333-8333-333333333333";

describe("buildNotificationIntent", () => {
    it("maps a membership grant to the invited user", () => {
        const intent = buildNotificationIntent(
            domainEvents.membershipGranted,
            {
                userId,
                email: "member@example.com",
                organizationId,
                organizationName: "Acme",
                role: "judge",
            },
            origin,
        );

        expect(intent).not.toBeNull();
        expect(intent?.userId).toBe(userId);
        expect(intent?.organizationId).toBe(organizationId);
        expect(intent?.kind).toBe("system");
        expect(intent?.linkUrl).toBe(`${origin}/`);
        expect(intent?.dedupeKey).toContain(userId);
        expect(intent?.dedupeKey).toContain("judge");
    });

    it("maps a team invitation to an email-only intent without leaking the token into the dedupe key", () => {
        const token = "invitation-secret-token";
        const intent = buildNotificationIntent(
            domainEvents.teamInvitationCreated,
            {
                email: "invitee@example.com",
                organizationId,
                organizationName: "Acme",
                teamName: "Rockets",
                invitationId: "44444444-4444-4444-8444-444444444444",
                token,
            },
            origin,
        );

        expect(intent).not.toBeNull();
        expect(intent?.userId).toBeNull();
        expect(intent?.email).toBe("invitee@example.com");
        expect(intent?.kind).toBe("team_invitation");
        expect(intent?.linkUrl).toBe(`${origin}/invitations?token=${token}`);
        expect(intent?.dedupeKey).not.toContain(token);
    });

    it("skips events without a recipient", () => {
        expect(
            buildNotificationIntent(
                domainEvents.registrationDecided,
                { organizationId, status: "approved" },
                origin,
            ),
        ).toBeNull();
        expect(
            buildNotificationIntent(domainEvents.votingOpened, { organizationId }, origin),
        ).toBeNull();
    });

    it("skips malformed payloads without throwing", () => {
        expect(
            buildNotificationIntent(
                domainEvents.membershipGranted,
                { userId: 42, organizationId: null },
                origin,
            ),
        ).toBeNull();
        expect(
            buildNotificationIntent(
                domainEvents.teamInvitationCreated,
                { email: "not-an-email", organizationId },
                origin,
            ),
        ).toBeNull();
    });

    it("skips a team-created notification when the captain is the actor", () => {
        expect(
            buildNotificationIntent(
                domainEvents.teamCreated,
                {
                    userId: otherUserId,
                    captainUserId: otherUserId,
                    organizationId,
                    teamName: "Rockets",
                },
                origin,
            ),
        ).toBeNull();
    });

    it("notifies the captain when a team is created by somebody else", () => {
        const intent = buildNotificationIntent(
            domainEvents.teamCreated,
            {
                userId: otherUserId,
                captainUserId: userId,
                organizationId,
                teamName: "Rockets",
            },
            origin,
        );

        expect(intent?.userId).toBe(userId);
        expect(intent?.linkUrl).toBe(`${origin}/teams`);
    });

    it("notifies the captain when an invitation is accepted", () => {
        const intent = buildNotificationIntent(
            domainEvents.teamInvitationAccepted,
            {
                userId: otherUserId,
                captainUserId: userId,
                organizationId,
                teamName: "Rockets",
                invitationId: "44444444-4444-4444-8444-444444444444",
            },
            origin,
        );

        expect(intent?.userId).toBe(userId);
        expect(intent?.kind).toBe("system");
    });

    it("notifies the judge for an assignment", () => {
        const intent = buildNotificationIntent(
            domainEvents.judgeAssigned,
            {
                judgeUserId: userId,
                organizationId,
                projectTitle: "Weather Map",
            },
            origin,
        );

        expect(intent?.userId).toBe(userId);
        expect(intent?.kind).toBe("judge_assignment");
        expect(intent?.body).toContain("Weather Map");
    });

    it("skips published announcements", () => {
        expect(
            buildNotificationIntent(
                domainEvents.announcementPublished,
                { announcementId: "44444444-4444-4444-8444-444444444444", organizationId },
                origin,
            ),
        ).toBeNull();
    });
});
